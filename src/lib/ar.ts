// Receivables in Godzilla (Benjy + Denise, 11/7/26): one invoice record per
// job, one pay link, one status everyone sees. Stripe (card + ACH) reports
// back through the webhook; checks and wires are recorded by hand. Reminders
// go out from the system so reps and Denise stop nudging separately. The
// general ledger, payables and bank rec stay in Sage; invoices export monthly.
import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/email/graph-client";

// Rollout gate (Benjy 11/10/26): Godzilla rolls out sales funnel -> invoicing
// -> jobs (from FileMaker) -> Mary's estimating. While invoicing is live but
// jobs/quotes are still test data, invoices are created ONLY from the Invoices
// tab and never auto-created by a job or a won quote. Set AR_STANDALONE=0 to
// reconnect once jobs are real.
export const AR_STANDALONE = process.env.AR_STANDALONE !== "0";
export const STANDALONE_MSG = "Invoicing runs on its own right now. Create invoices from the Invoices tab.";
// Florida sales tax (Denise 11/12): 6% state on the whole amount, plus the
// Pinellas 1% discretionary surtax on only the first $5,000 of the sale. So 7%
// up to $5,000 and 6% on the balance. Postage/freight is not taxed.
export const TAX_STATE_PCT = 6, TAX_SURTAX_PCT = 1, SURTAX_CAP = 5000;
export function floridaTax(subtotal: number, exempt = false): number {
  if (exempt) return 0;
  const s = Math.max(0, Number(subtotal) || 0);
  return round2(s * TAX_STATE_PCT / 100 + Math.min(s, SURTAX_CAP) * TAX_SURTAX_PCT / 100);
}
export function taxLabel(inv: { taxRate: number; subtotal: number }): string {
  if (!inv.taxRate) return "Sales tax (exempt)";
  return inv.subtotal > SURTAX_CAP ? `Sales tax (7% to $5,000, 6% above)` : "Sales tax (7%)";
}
// Department codes for the invoice (Jennifer 11/12). Free text is allowed; these are the suggestions.
export const DEPARTMENTS = ["Komori", "Digital", "ASI", "Letterpress", "Bindery", "Mailing", "Wide Format", "Packaging", "Vendor"];
export const CARD_SURCHARGE = 0.03;
export const NET_DAYS = 30;
export const REMINDER_DAYS = [0, 7, 14, 28]; // days past due for reminders 1..4
export const DEFAULT_COMMISSION_PCT = Number(process.env.COMMISSION_DEFAULT_PCT || 5);
export const AR_FROM = process.env.INVOICE_FROM || "bwaxman@cndprinting.com";
export const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://packaging.cndprinting.com";

export const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
export const newPayToken = () => randomBytes(18).toString("base64url");
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Recompute paidAmount / status / commission from the Payment rows. Call after any payment change. */
export async function applyPayments(prisma: any, invoiceId: string) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!inv) return null;
  if (inv.status === "cancelled") return inv;
  const paid = round2(inv.payments.reduce((s: number, p: any) => s + p.amount, 0));
  const last = inv.payments.slice().sort((a: any, b: any) => +new Date(b.receivedAt) - +new Date(a.receivedAt))[0];
  const fullyPaid = paid >= inv.total - 0.01;
  const depositMet = paid >= inv.depositAmount - 0.01;
  const overdue = !fullyPaid && inv.dueDate && new Date(inv.dueDate) < new Date();
  const status = fullyPaid ? "paid" : overdue ? "overdue" : depositMet && inv.depositAmount > 0 ? "deposit_paid" : paid > 0 ? "partial" : "pending";
  const data: any = {
    paidAmount: paid, status,
    depositPaid: depositMet && inv.depositAmount > 0, depositPaidAt: depositMet && inv.depositAmount > 0 ? (inv.depositPaidAt || last?.receivedAt || new Date()) : null,
    balancePaid: fullyPaid, balancePaidAt: fullyPaid ? (inv.balancePaidAt || last?.receivedAt || new Date()) : null,
    paidAt: fullyPaid ? (inv.paidAt || last?.receivedAt || new Date()) : null,
  };
  // Commission is earned when the customer pays (Denise's rule), never before.
  if (inv.commissionAmount && inv.commissionStatus !== "paid") data.commissionStatus = fullyPaid ? "payable" : "pending";
  return prisma.invoice.update({ where: { id: invoiceId }, data });
}

export async function recordPayment(prisma: any, args: { invoiceId: string; amount: number; method: string; reference?: string | null; receivedAt?: Date; recordedBy?: string | null; stripeId?: string | null; note?: string | null }) {
  if (args.stripeId) {
    const dup = await prisma.payment.findUnique({ where: { stripeId: args.stripeId } });
    if (dup) return applyPayments(prisma, args.invoiceId);
  }
  await prisma.payment.create({ data: { invoiceId: args.invoiceId, amount: round2(args.amount), method: args.method, reference: args.reference || null, receivedAt: args.receivedAt || new Date(), recordedBy: args.recordedBy || null, stripeId: args.stripeId || null, note: args.note || null } });
  return applyPayments(prisma, args.invoiceId);
}

/** Commission on an invoice from the job's sales rep. */
export async function commissionFor(prisma: any, jobId: string | null | undefined, subtotal: number) {
  if (!jobId) return {};
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { salesRep: { select: { id: true, name: true, email: true, commissionPct: true } } } }).catch(() => null);
  const rep = job?.salesRep;
  if (!rep) return {};
  const pct = rep.commissionPct ?? DEFAULT_COMMISSION_PCT;
  return { salesRepId: rep.id, salesRepName: rep.name, commissionPct: pct, commissionAmount: round2(subtotal * pct / 100), commissionStatus: "pending" };
}

export function remaining(inv: { total: number; paidAmount: number }) { return Math.max(0, round2(inv.total - (inv.paidAmount || 0))); }
export function dueLabel(inv: { dueDate: Date | string | null }) { return inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "on receipt"; }

const shell = (inner: string) => `
<div style="font-family:Arial,sans-serif;max-width:600px;">
  <div style="background:linear-gradient(135deg,#ED1C24,#27AAE1);padding:3px;"></div>
  <div style="padding:24px;">${inner}
    <hr style="margin:24px 0;border:none;border-top:1px solid #eee;" />
    <p style="color:#999;font-size:12px;">C&amp;D Printing Co. | 727-572-9999 | 12150 28th St N., St. Petersburg, FL 33716. Pay online by card or bank transfer, or mail a check.</p>
  </div>
  <div style="background:linear-gradient(135deg,#ED1C24,#27AAE1);padding:3px;"></div>
</div>`;

export function payUrl(inv: { payToken?: string | null }) { return inv.payToken ? `${BASE_URL}/pay/${inv.payToken}` : `${BASE_URL}/portal/payments`; }

export function invoiceEmailHtml(inv: any) {
  const bal = remaining(inv);
  const isPrebill = inv.kind === "prebill" || inv.kind === "deposit";
  return shell(`
    <h2 style="margin:0 0 4px;">${isPrebill ? "Deposit invoice" : "Invoice"} from C&amp;D Printing Co.</h2>
    <p style="color:#666;margin:0 0 20px;">${inv.customerName}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">
      <tr><td style="padding:8px 0;color:#888;">Invoice #</td><td style="padding:8px 0;font-weight:bold;">${inv.invoiceNumber}</td></tr>
      ${inv.poNumber ? `<tr><td style="padding:8px 0;color:#888;">Your PO #</td><td style="padding:8px 0;">${String(inv.poNumber).replace(/</g, "&lt;")}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#888;">Description</td><td style="padding:8px 0;">${inv.description || "C&amp;D Printing services"}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">Subtotal</td><td style="padding:8px 0;">${money(inv.subtotal)}</td></tr>
      <tr><td style="padding:8px 0;color:#888;">${taxLabel(inv)}</td><td style="padding:8px 0;">${money(inv.taxAmount)}</td></tr>
      ${inv.shipping > 0 ? `<tr><td style="padding:8px 0;color:#888;">Postage / freight</td><td style="padding:8px 0;">${money(inv.shipping)}</td></tr>` : ""}
      <tr style="border-top:2px solid #ED1C24;"><td style="padding:12px 0;font-weight:bold;">Total</td><td style="padding:12px 0;font-size:20px;font-weight:bold;color:#ED1C24;">${money(inv.total)}</td></tr>
      ${inv.paidAmount > 0 ? `<tr><td style="padding:8px 0;color:#888;">Paid so far</td><td style="padding:8px 0;">${money(inv.paidAmount)}</td></tr><tr><td style="padding:8px 0;color:#888;">Balance</td><td style="padding:8px 0;font-weight:bold;">${money(bal)}</td></tr>` : ""}
      <tr><td style="padding:8px 0;color:#888;">Due</td><td style="padding:8px 0;">${dueLabel(inv)}</td></tr>
    </table>
    ${inv.depositAmount > 0 && !inv.depositPaid ? `<p style="color:#666;font-size:14px;"><strong>${inv.depositPercent}% deposit (${money(inv.depositAmount)}) due before production.</strong> Balance due on delivery.</p>` : ""}
    <p style="color:#666;font-size:14px;">Bank transfer (ACH) has no fee. Card payments carry a 3% surcharge.</p>
    <a href="${payUrl(inv)}" style="display:inline-block;background:#ED1C24;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px;">Pay online</a>`);
}

export function reminderEmailHtml(inv: any, n: number) {
  const bal = remaining(inv);
  const lines = [
    `This is a friendly reminder that invoice ${inv.invoiceNumber} for ${money(bal)} was due ${dueLabel(inv)}.`,
    `Invoice ${inv.invoiceNumber} for ${money(bal)} is now a week past due. If it has already been sent, thank you, and please disregard this note.`,
    `Invoice ${inv.invoiceNumber} for ${money(bal)} is two weeks past due. Please let us know if there is a problem with the invoice or a date we can expect payment.`,
    `Invoice ${inv.invoiceNumber} for ${money(bal)} is now four weeks past due. Please arrange payment this week or call us at 727-572-9999 so we can work something out.`,
  ];
  return shell(`<h2 style="margin:0 0 12px;">Payment reminder</h2><p style="color:#333;font-size:15px;">${lines[Math.min(n, lines.length - 1)]}</p>
    <p style="color:#666;font-size:14px;">Pay online by bank transfer (no fee) or card below. If you have mailed a check, reply to this email with the check number.</p>
    <a href="${payUrl(inv)}" style="display:inline-block;background:#ED1C24;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;margin-top:16px;">Pay ${money(bal)}</a>`);
}

/** Daily: send the reminder that is due on each open invoice. Returns what it sent. */
export async function runInvoiceReminders(prisma: any, now = new Date()) {
  // Only invoices that were actually emailed to the customer get reminders, so
  // invoices entered for testing or bookkeeping never ping a customer.
  const open = await prisma.invoice.findMany({ where: { status: { in: ["pending", "partial", "deposit_paid", "overdue"] }, contactEmail: { not: null }, total: { gt: 0 }, sentAt: { not: null } } });
  const sent: string[] = [];
  for (const inv of open) {
    if (!inv.dueDate) continue;
    const daysPast = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400e3);
    const n = inv.remindCount || 0;
    if (n >= REMINDER_DAYS.length || daysPast < REMINDER_DAYS[n]) continue;
    const rep = inv.salesRepId ? await prisma.user.findUnique({ where: { id: inv.salesRepId }, select: { email: true } }).catch(() => null) : null;
    const r = await sendEmail({ from: AR_FROM, to: inv.contactEmail, cc: rep?.email ? [rep.email] : undefined, subject: `${n === 0 ? "Reminder" : "Past due"}: invoice ${inv.invoiceNumber} ${money(remaining(inv))} | C&D Printing`, body: reminderEmailHtml(inv, n) });
    if (r.success) {
      await prisma.invoice.update({ where: { id: inv.id }, data: { remindedAt: now, remindCount: n + 1, status: inv.status === "paid" ? "paid" : daysPast > 0 ? "overdue" : inv.status } });
      sent.push(`${inv.invoiceNumber} reminder ${n + 1}`);
    }
  }
  return sent;
}

/** Yearly sales by customer and by sales rep (Denise 11/12). Sales = amount
 *  before tax and freight on non-cancelled invoices dated in the year. */
export async function salesReport(prisma: any, year: number) {
  const from = new Date(Date.UTC(year, 0, 1)), to = new Date(Date.UTC(year + 1, 0, 1));
  const invs = await prisma.invoice.findMany({ where: { createdAt: { gte: from, lt: to }, status: { not: "cancelled" } }, select: { customerName: true, companyId: true, salesRepName: true, department: true, subtotal: true, taxAmount: true, shipping: true, total: true, paidAmount: true, commissionAmount: true } });
  const byC: Record<string, any> = {}, byR: Record<string, any> = {}, byD: Record<string, any> = {};
  for (const i of invs) {
    const c = byC[i.customerName] ||= { name: i.customerName, invoices: 0, sales: 0, tax: 0, shipping: 0, billed: 0, paid: 0 };
    c.invoices++; c.sales += i.subtotal; c.tax += i.taxAmount; c.shipping += i.shipping || 0; c.billed += i.total; c.paid += i.paidAmount || 0;
    const rn = i.salesRepName || "House account";
    const r = byR[rn] ||= { name: rn, invoices: 0, sales: 0, billed: 0, paid: 0, commission: 0 };
    r.invoices++; r.sales += i.subtotal; r.billed += i.total; r.paid += i.paidAmount || 0; r.commission += i.commissionAmount || 0;
    const dn = i.department || "Not set";
    const dd = byD[dn] ||= { name: dn, invoices: 0, sales: 0, billed: 0, paid: 0 };
    dd.invoices++; dd.sales += i.subtotal; dd.billed += i.total; dd.paid += i.paidAmount || 0;
  }
  const r2 = (o: any) => { for (const k of Object.keys(o)) if (typeof o[k] === "number") o[k] = round2(o[k]); return o; };
  const byCustomer = Object.values(byC).map(r2).sort((a: any, b: any) => b.sales - a.sales);
  const byRep = Object.values(byR).map(r2).sort((a: any, b: any) => b.sales - a.sales);
  const byDepartment = Object.values(byD).map(r2).sort((a: any, b: any) => b.sales - a.sales);
  const totals = r2({ invoices: invs.length, sales: invs.reduce((s: number, i: any) => s + i.subtotal, 0), billed: invs.reduce((s: number, i: any) => s + i.total, 0), paid: invs.reduce((s: number, i: any) => s + (i.paidAmount || 0), 0), commission: invs.reduce((s: number, i: any) => s + (i.commissionAmount || 0), 0) });
  return { year, byCustomer, byRep, byDepartment, totals };
}
export function salesReportCsv(rep: Awaited<ReturnType<typeof salesReport>>): string {
  const esc = (v: any) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [`Sales by customer,${rep.year}`, "Customer,Invoices,Sales (before tax),Tax,Shipping,Billed,Paid"];
  for (const c of rep.byCustomer as any[]) lines.push([c.name, c.invoices, c.sales.toFixed(2), c.tax.toFixed(2), c.shipping.toFixed(2), c.billed.toFixed(2), c.paid.toFixed(2)].map(esc).join(","));
  lines.push("", `Sales by sales rep,${rep.year}`, "Sales rep,Invoices,Sales (before tax),Billed,Paid,Commission");
  for (const r of rep.byRep as any[]) lines.push([r.name, r.invoices, r.sales.toFixed(2), r.billed.toFixed(2), r.paid.toFixed(2), r.commission.toFixed(2)].map(esc).join(","));
  lines.push("", `Sales by department,${rep.year}`, "Department,Invoices,Sales (before tax),Billed,Paid");
  for (const d of rep.byDepartment as any[]) lines.push([d.name, d.invoices, d.sales.toFixed(2), d.billed.toFixed(2), d.paid.toFixed(2)].map(esc).join(","));
  lines.push("", `Total,${rep.totals.invoices},${rep.totals.sales.toFixed(2)},${rep.totals.billed.toFixed(2)},${rep.totals.paid.toFixed(2)},${rep.totals.commission.toFixed(2)}`);
  return lines.join("\r\n");
}

/** Weekly aging report (Denise's item 3): buckets by days past due, plus what's coming due. */
export async function agingReport(prisma: any, now = new Date()) {
  const open = await prisma.invoice.findMany({ where: { status: { in: ["pending", "partial", "deposit_paid", "overdue"] }, total: { gt: 0 } }, orderBy: { dueDate: "asc" } });
  const buckets: Record<string, { n: number; amt: number }> = { "Not yet due": { n: 0, amt: 0 }, "1-30 days": { n: 0, amt: 0 }, "31-60 days": { n: 0, amt: 0 }, "61-90 days": { n: 0, amt: 0 }, "Over 90": { n: 0, amt: 0 } };
  const rows = open.map((inv: any) => {
    const bal = remaining(inv);
    const days = inv.dueDate ? Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400e3) : 0;
    const b = days <= 0 ? "Not yet due" : days <= 30 ? "1-30 days" : days <= 60 ? "31-60 days" : days <= 90 ? "61-90 days" : "Over 90";
    buckets[b].n++; buckets[b].amt += bal;
    return { ...inv, bal, days, bucket: b };
  });
  const total = rows.reduce((s: number, r: any) => s + r.bal, 0);
  const html = shell(`<h2 style="margin:0 0 4px;">Receivables aging</h2><p style="color:#666;margin:0 0 16px;">${now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · ${rows.length} open invoices · ${money(total)} outstanding</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;"><tr style="background:#f5f5f5;"><th style="text-align:left;padding:6px;">Bucket</th><th style="text-align:right;padding:6px;">Invoices</th><th style="text-align:right;padding:6px;">Amount</th></tr>
    ${Object.entries(buckets).map(([k, v]) => `<tr><td style="padding:6px;border-top:1px solid #eee;">${k}</td><td style="padding:6px;text-align:right;border-top:1px solid #eee;">${v.n}</td><td style="padding:6px;text-align:right;border-top:1px solid #eee;">${money(v.amt)}</td></tr>`).join("")}</table>
    <h3 style="margin:20px 0 6px;">Open invoices</h3>
    <table style="width:100%;border-collapse:collapse;font-size:13px;"><tr style="background:#f5f5f5;"><th style="text-align:left;padding:6px;">#</th><th style="text-align:left;padding:6px;">Customer</th><th style="text-align:right;padding:6px;">Balance</th><th style="text-align:left;padding:6px;">Due</th><th style="text-align:left;padding:6px;">Rep</th><th style="text-align:left;padding:6px;">Last reminder</th></tr>
    ${rows.map((r: any) => `<tr><td style="padding:6px;border-top:1px solid #eee;">${r.invoiceNumber}</td><td style="padding:6px;border-top:1px solid #eee;">${r.customerName}</td><td style="padding:6px;text-align:right;border-top:1px solid #eee;">${money(r.bal)}</td><td style="padding:6px;border-top:1px solid #eee;${r.days > 0 ? "color:#b91c1c;" : ""}">${dueLabel(r)}${r.days > 0 ? ` (${r.days}d late)` : ""}</td><td style="padding:6px;border-top:1px solid #eee;">${r.salesRepName || ""}</td><td style="padding:6px;border-top:1px solid #eee;">${r.remindedAt ? `${new Date(r.remindedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} (#${r.remindCount})` : "none"}</td></tr>`).join("")}</table>
    <p style="color:#666;font-size:13px;margin-top:16px;">Open the full list at <a href="${BASE_URL}/dashboard/invoices">${BASE_URL}/dashboard/invoices</a>.</p>`);
  return { rows, buckets, total, html };
}

export async function agingRecipients(prisma: any): Promise<string[]> {
  const env = (process.env.AR_REPORT_TO || "").split(/[;,]/).map((s) => s.trim()).filter(Boolean);
  // Accounting users join the report once Benjy has walked them through it
  // (11/7/26: "don't send anything yet"); flip AR_INCLUDE_ACCOUNTING=1 then.
  const roles = process.env.AR_INCLUDE_ACCOUNTING === "1" ? ["OWNER", "ACCOUNTING"] : ["OWNER"];
  const users = await prisma.user.findMany({ where: { role: { in: roles as any }, email: { endsWith: "@cndprinting.com" } }, select: { email: true, name: true } });
  const set = new Set<string>([...env, ...users.filter((u: any) => !/retired|duplicate/i.test(u.name)).map((u: any) => u.email)]);
  return [...set];
}

/** CSV for Sage: invoices billed and payments received in a month. */
export async function sageExportCsv(prisma: any, month: string) {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1)), to = new Date(Date.UTC(y, m, 1));
  const invs = await prisma.invoice.findMany({ where: { createdAt: { gte: from, lt: to }, status: { not: "cancelled" } }, orderBy: { createdAt: "asc" } });
  const pays = await prisma.payment.findMany({ where: { receivedAt: { gte: from, lt: to } }, include: { invoice: { select: { invoiceNumber: true, customerName: true } } }, orderBy: { receivedAt: "asc" } });
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const d = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : "");
  const lines = ["Type,Date,Invoice,Customer,PO,Department,Kind,Description,Subtotal,Tax,Shipping,Total,Method,Reference,Amount,SalesRep,Commission"];
  for (const i of invs) lines.push(["INVOICE", d(i.createdAt), i.invoiceNumber, i.customerName, i.poNumber, i.department, i.kind, i.description, i.subtotal.toFixed(2), i.taxAmount.toFixed(2), (i.shipping || 0).toFixed(2), i.total.toFixed(2), "", "", "", i.salesRepName, (i.commissionAmount || 0).toFixed(2)].map(esc).join(","));
  for (const p of pays) lines.push(["PAYMENT", d(p.receivedAt), p.invoice.invoiceNumber, p.invoice.customerName, "", "", "", p.note, "", "", "", "", p.method, p.reference, p.amount.toFixed(2), "", ""].map(esc).join(","));
  await prisma.invoice.updateMany({ where: { id: { in: invs.map((i: any) => i.id) }, sageExportedAt: null }, data: { sageExportedAt: new Date() } });
  return lines.join("\r\n");
}
