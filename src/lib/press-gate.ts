// Press gate + deposit link (Benjy 11/17/26, built from Carrie's procedure).
// A job can't move into printing until (1) a proof is approved and (2) for
// deposit or prepaid terms, the money is in on the job's invoice. Entering a
// job drafts its deposit invoice for accounting automatically, so nobody has
// to forward job details or ask whether the deposit came in.
import { floridaTax, newPayToken, round2, AR_FROM } from "@/lib/ar";

export const TERMS: Record<string, string> = {
  deposit50: "50% deposit, balance before delivery",
  prepaid: "Prepaid in full before press",
  net30: "Net 30 (approved credit)",
  cod: "COD, paid on delivery",
};
export const DEFAULT_TERMS = "deposit50"; // Carrie: "the required 50% deposit"

// Jobs entered before CSRs start on Godzilla are test data and are not gated
// on deposits (they have no invoices). Same cutoff the shipping queue uses.
export const JOBS_LIVE_SINCE = new Date(process.env.JOBS_LIVE_SINCE || "2026-11-17");

// Moving into any of these means the job is going to (or past) press.
export const PRESS_STAGES = new Set(["PRINTING", "COATING_FINISHING", "DIE_CUTTING", "GLUING_FOLDING", "QA", "PACKED", "SHIPPED", "DELIVERED", "INVOICED"]);
export const OVERRIDE_ROLES = ["OWNER", "GM", "ADMIN", "ACCOUNTING"];
// Who can enter jobs (and act on sales handoffs).
export const ENTER_ROLES = ["CSR", "OWNER", "ADMIN", "GM", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER"];

const rem = (i: { total: number; paidAmount: number | null }) => Math.max(0, round2(i.total - (i.paidAmount || 0)));

export type PaymentState = {
  terms: string | null; termsLabel: string; live: boolean;
  invoices: { id: string; invoiceNumber: string; status: string; total: number; depositAmount: number; depositPaid: boolean; paidAmount: number; remaining: number; kind: string }[];
  depositRequired: boolean; depositPaid: boolean; proofApproved: boolean;
  cleared: boolean; waitingOn: string[]; override: string | null;
};

export async function paymentState(prisma: any, jobId: string): Promise<PaymentState | null> {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { id: true, paymentTerms: true, createdAt: true, pressOverride: true } });
  if (!job) return null;
  const invs = await prisma.invoice.findMany({ where: { jobId, status: { not: "cancelled" } }, orderBy: { createdAt: "asc" } });
  const proofApproved = (await prisma.proof.count({ where: { jobId, status: "APPROVED" } })) > 0;
  const live = new Date(job.createdAt) >= JOBS_LIVE_SINCE;
  const terms = job.paymentTerms || (live ? DEFAULT_TERMS : null);
  const depositRequired = live && (terms === "deposit50" || terms === "prepaid");
  const real = invs.filter((i: any) => i.status !== "draft");
  const depositPaid = !depositRequired ? true
    : terms === "prepaid" ? real.length > 0 && real.every((i: any) => i.status === "paid" || rem(i) <= 0)
    : real.some((i: any) => i.depositPaid || i.status === "paid" || i.status === "deposit_paid");
  const waitingOn: string[] = [];
  if (!proofApproved) waitingOn.push("proof approval");
  if (!depositPaid) waitingOn.push(terms === "prepaid" ? "payment in full" : "50% deposit");
  return {
    terms, termsLabel: terms ? TERMS[terms] || terms : "Not set", live,
    invoices: invs.map((i: any) => ({ id: i.id, invoiceNumber: i.invoiceNumber, status: i.status, total: i.total, depositAmount: i.depositAmount, depositPaid: i.depositPaid, paidAmount: i.paidAmount || 0, remaining: rem(i), kind: i.kind })),
    depositRequired, depositPaid, proofApproved, cleared: waitingOn.length === 0 || !!job.pressOverride,
    waitingOn, override: job.pressOverride || null,
  };
}

/** Returns an error message if the job may not move to nextStatus, else null. */
export async function checkPressGate(prisma: any, jobId: string, nextStatus: string): Promise<string | null> {
  if (!PRESS_STAGES.has(nextStatus)) return null;
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { status: true, pressOverride: true } });
  if (!job) return null;
  if (PRESS_STAGES.has(job.status)) return null; // already past the gate (e.g. moving between finishing steps)
  if (job.pressOverride) return null;
  const st = await paymentState(prisma, jobId);
  if (!st || st.waitingOn.length === 0) return null;
  return `Not cleared for press yet. Waiting on: ${st.waitingOn.join(" and ")}.`;
}

async function nextInvoiceNumber(prisma: any) {
  const last = await prisma.invoice.findFirst({ where: { invoiceNumber: { startsWith: "INV-" } }, orderBy: { invoiceNumber: "desc" }, select: { invoiceNumber: true } });
  const n = last ? parseInt(String(last.invoiceNumber).replace(/\D/g, ""), 10) : 999;
  return `INV-${String((Number.isFinite(n) ? n : 999) + 1).padStart(5, "0")}`;
}

/** Drafts the job's deposit invoice for accounting (status "draft": never sent,
 *  never reminded, not in AR until Denise approves it). Returns the invoice or null. */
export async function draftDepositInvoice(prisma: any, jobId: string, opts: { byName: string; byEmail?: string | null; taxExempt?: boolean; contactEmail?: string | null }) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { order: { include: { company: { include: { contacts: { orderBy: { isPrimary: "desc" }, take: 3 } } } } }, salesRep: { select: { id: true, name: true } } } });
  if (!job || new Date(job.createdAt) < JOBS_LIVE_SINCE) return null;
  const terms = job.paymentTerms || DEFAULT_TERMS;
  if (!["deposit50", "prepaid"].includes(terms)) return null;
  const subtotal = round2(Number(job.quotedPrice) || 0);
  if (!(subtotal > 0)) return null;
  const existing = await prisma.invoice.findFirst({ where: { jobId, status: { not: "cancelled" } } });
  if (existing) return null;
  const co = job.order?.company;
  const taxAmount = floridaTax(subtotal, !!opts.taxExempt);
  const total = round2(subtotal + taxAmount);
  const depositPercent = terms === "prepaid" ? 100 : 50;
  const inv = await prisma.invoice.create({ data: {
    invoiceNumber: await nextInvoiceNumber(prisma), status: "draft", kind: "prebill",
    customerName: co?.name || "Customer", companyId: co?.id || null, jobId: job.id, orderId: job.orderId,
    contactEmail: opts.contactEmail || co?.contacts?.find((c: any) => c.email)?.email || null,
    description: `Job ${job.jobNumber} · ${job.name}`, poNumber: job.customerPO || null,
    subtotal, taxRate: opts.taxExempt ? 0 : 7, taxAmount, shipping: 0, total,
    depositPercent, depositAmount: round2(total * depositPercent / 100),
    dueDate: new Date(Date.now() + 7 * 86400e3), payToken: newPayToken(),
    salesRepId: job.salesRep?.id || null, salesRepName: job.salesRep?.name || job.repName || null,
    createdBy: opts.byName,
    notes: `Drafted automatically when job ${job.jobNumber} was entered by ${opts.byName} (${TERMS[terms]}). Review and send.`,
  } as any });
  // Tell accounting it's waiting (Carrie's step 5, without anyone forwarding anything).
  try {
    const acct = await prisma.user.findMany({ where: { role: "ACCOUNTING", isActive: true }, select: { email: true } });
    const to = acct.map((u: any) => u.email).filter(Boolean);
    if (to.length) {
      const { sendEmail } = await import("@/lib/email/graph-client");
      const from = opts.byEmail && opts.byEmail.endsWith("@cndprinting.com") ? opts.byEmail : AR_FROM;
      const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
      await sendEmail({ from, to, subject: `Deposit invoice ready: ${co?.name || ""} job ${job.jobNumber}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>New job entered by ${opts.byName}. The ${depositPercent === 100 ? "prepaid" : "50% deposit"} invoice is drafted in Godzilla and ready for you to review and send.</p><p><b>${co?.name || ""}</b><br>Job ${job.jobNumber}: ${job.name}<br>Total ${money(total)}, ${depositPercent === 100 ? "due in full" : `deposit ${money(round2(total * depositPercent / 100))}`}<br>Invoice ${inv.invoiceNumber} (draft)</p><p><a href="https://packaging.cndprinting.com/dashboard/invoices">Open Invoices in Godzilla</a></p></div>` });
    }
  } catch { /* the draft exists either way */ }
  return inv;
}
