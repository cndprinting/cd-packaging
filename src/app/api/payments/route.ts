import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sendEmail } from "@/lib/email/graph-client";
import { AR_FROM, AR_STANDALONE, STANDALONE_MSG, CARD_SURCHARGE, DEFAULT_COMMISSION_PCT, NET_DAYS, applyPayments, commissionFor, invoiceEmailHtml, newPayToken, payUrl, recordPayment, remaining, round2 } from "@/lib/ar";

// Receivables API (rebuilt 11/7/26, Benjy + Denise): Godzilla is the system of
// record for invoices and payments; Sage keeps the GL. Actions:
//   create_invoice, send_invoice, pay (portal Stripe checkout), record_payment
//   (check / ACH / wire), mark_paid (legacy), convert_to_final, cancel,
//   commission_paid, set_due
const ADMIN = ["OWNER", "GM", "ADMIN", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER", "ACCOUNTING", "CSR"];
const MONEY_ROLES = ["OWNER", "GM", "ADMIN", "ACCOUNTING"];

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const Stripe = require("stripe");
  return new Stripe(key);
}

// GET: list invoices (customers see their own; sales see all, read-only)
export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const prisma = (await import("@/lib/prisma")).default;
    if (!prisma) return NextResponse.json({ invoices: [] });
    const where = session.role === "CUSTOMER" ? { companyId: session.companyId || undefined } : {};
    const invoices = await prisma.invoice.findMany({ where, orderBy: { createdAt: "desc" }, include: { payments: { orderBy: { receivedAt: "desc" } } } });
    const out = invoices.map((i) => ({ ...i, remaining: remaining(i), payUrl: session.role === "CUSTOMER" ? undefined : payUrl(i) }));
    return NextResponse.json({ invoices: out });
  } catch (error) {
    console.error("Payments GET error:", error);
    return NextResponse.json({ invoices: [] });
  }
}

// Next number = highest existing + 1 (count-based numbering repeats after a delete).
async function nextInvoiceNumber(prisma: any) {
  const last = await prisma.invoice.findFirst({ orderBy: { invoiceNumber: "desc" }, select: { invoiceNumber: true } });
  const n = last ? parseInt(String(last.invoiceNumber).replace(/\D/g, ""), 10) : 999;
  return `INV-${String((Number.isFinite(n) ? n : 999) + 1).padStart(5, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await request.json();
    const { action } = body;
    const prisma = (await import("@/lib/prisma")).default;
    if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

    if (action === "create_invoice") {
      if (!ADMIN.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      let { contactEmail, description, jobId, orderId, notes } = body;
      // Standalone invoicing: only the Invoices tab creates invoices, and they
      // never link to (test) jobs or orders. The job page button is refused.
      if (AR_STANDALONE) {
        if (body.via !== "invoices") return NextResponse.json({ error: STANDALONE_MSG }, { status: 400 });
        jobId = null; orderId = null;
      }
      // Every invoice hangs off a Customers record (Benjy 11/7): no retyped names.
      const companyId = body.companyId ? String(body.companyId) : null;
      let customerName = String(body.customerName || "").trim();
      if (companyId) {
        const co = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
        if (!co) return NextResponse.json({ error: "Customer record not found" }, { status: 400 });
        customerName = co.name;
      } else if (!body.allowUnlinked) return NextResponse.json({ error: "Pick a customer from the Customers module" }, { status: 400 });
      if (!customerName) return NextResponse.json({ error: "Customer required" }, { status: 400 });
      const subtotal = round2(Number(body.subtotal) || 0);
      const kind = ["final", "prebill", "deposit"].includes(body.kind) ? body.kind : "final";
      const taxRate = body.taxExempt ? 0 : 7;
      const taxAmount = round2(subtotal * (taxRate / 100));
      const total = round2(subtotal + taxAmount);
      const depositPercent = kind === "deposit" ? 100 : Number.isFinite(Number(body.depositPercent)) ? Number(body.depositPercent) : 50;
      const depositAmount = round2(total * depositPercent / 100);
      const invoiceNumber = await nextInvoiceNumber(prisma);
      const dueDate = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + (kind === "final" ? NET_DAYS : 7) * 86400e3);
      // Rep + commission: from the job when there is one, else typed in by accounting from the estimate.
      let comm: Record<string, unknown> = kind === "final" ? await commissionFor(prisma, jobId, subtotal) : {};
      if (kind === "final" && body.salesRepId) {
        const rep = await prisma.user.findUnique({ where: { id: String(body.salesRepId) }, select: { id: true, name: true, commissionPct: true } });
        if (rep) {
          const pct = Number.isFinite(Number(body.commissionPct)) ? Number(body.commissionPct) : (rep.commissionPct ?? DEFAULT_COMMISSION_PCT);
          comm = { salesRepId: rep.id, salesRepName: rep.name, commissionPct: pct, commissionAmount: round2(subtotal * pct / 100), commissionStatus: pct > 0 ? "pending" : "none" };
        }
      }
      const invoice = await prisma.invoice.create({ data: {
        invoiceNumber, customerName, contactEmail: contactEmail || null, companyId: companyId || null, description, subtotal, taxRate, taxAmount, total,
        depositPercent, depositAmount, jobId: jobId || null, orderId: orderId || null, notes, createdBy: session.id, kind, payToken: newPayToken(), dueDate, ...comm,
      } });
      return NextResponse.json({ invoice: { ...invoice, payUrl: payUrl(invoice) } });
    }

    const inv = body.invoiceId ? await prisma.invoice.findUnique({ where: { id: body.invoiceId }, include: { payments: true } }) : null;
    if (action !== "pay" && !inv) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });

    // Email the invoice (or re-send it) from the accounting mailbox, cc the rep who asked.
    if (action === "send_invoice") {
      const to = String(body.to || inv!.contactEmail || "").trim();
      if (!to) return NextResponse.json({ error: "No customer email on this invoice" }, { status: 400 });
      let cur = inv!;
      if (!cur.payToken) cur = await prisma.invoice.update({ where: { id: cur.id }, data: { payToken: newPayToken() }, include: { payments: true } });
      if (to !== cur.contactEmail) cur = await prisma.invoice.update({ where: { id: cur.id }, data: { contactEmail: to }, include: { payments: true } });
      const r = await sendEmail({ from: AR_FROM, to, cc: session.email && session.email !== AR_FROM ? [session.email] : undefined, subject: `${cur.kind === "final" ? "Invoice" : "Deposit invoice"} ${cur.invoiceNumber} · ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(remaining(cur))} | C&D Printing`, body: invoiceEmailHtml(cur) });
      if (!r.success) return NextResponse.json({ error: r.error || "Email failed" }, { status: 502 });
      await prisma.invoice.update({ where: { id: cur.id }, data: { sentAt: cur.sentAt || new Date(), notes: `${cur.notes ? cur.notes + "\n" : ""}Sent to ${to} by ${session.name} on ${new Date().toLocaleDateString("en-US")}` } });
      return NextResponse.json({ ok: true, to });
    }

    // Portal checkout (logged-in customer). Card or ACH.
    if (action === "pay") {
      const stripe = getStripe();
      if (!stripe) return NextResponse.json({ error: "Stripe not configured. Contact C&D Printing at 727-572-9999 to pay by phone." }, { status: 400 });
      const invoice = await prisma.invoice.findUnique({ where: { id: body.invoiceId } });
      if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
      const method = body.method === "ach" ? "ach" : "card";
      const rem = remaining(invoice);
      const base = body.paymentType === "deposit" && !invoice.depositPaid ? Math.min(invoice.depositAmount, rem) : rem;
      if (base <= 0) return NextResponse.json({ error: "Nothing left to pay on this invoice" }, { status: 400 });
      const surcharge = method === "card" ? round2(base * CARD_SURCHARGE) : 0;
      const { origin } = new URL(request.url);
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: method === "ach" ? ["us_bank_account"] : ["card"],
        line_items: [{ price_data: { currency: "usd", product_data: { name: `${invoice.invoiceNumber} - ${body.paymentType === "deposit" ? `${invoice.depositPercent}% Deposit` : "Balance Due"} - ${invoice.customerName}` }, unit_amount: Math.round((base + surcharge) * 100) }, quantity: 1 }],
        mode: "payment",
        success_url: `${origin}/portal/payments?success=true&invoice=${invoice.invoiceNumber}`,
        cancel_url: `${origin}/portal/payments?cancelled=true`,
        metadata: { invoiceId: invoice.id, paymentType: body.paymentType || "balance", method, baseAmount: String(base) },
      });
      await prisma.invoice.update({ where: { id: invoice.id }, data: { stripeSessionId: checkoutSession.id } });
      return NextResponse.json({ url: checkoutSession.url });
    }

    // Denise records a check / ACH / wire that came in outside Stripe.
    if (action === "record_payment") {
      if (!MONEY_ROLES.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const amount = round2(Number(body.amount));
      if (!(amount > 0)) return NextResponse.json({ error: "Amount required" }, { status: 400 });
      const method = ["card", "ach", "check", "wire", "other"].includes(body.method) ? body.method : "check";
      const updated = await recordPayment(prisma, { invoiceId: inv!.id, amount, method, reference: body.reference || null, receivedAt: body.receivedAt ? new Date(body.receivedAt) : new Date(), recordedBy: session.name || session.email, note: body.note || null });
      return NextResponse.json({ invoice: updated });
    }

    // Legacy button: mark deposit / balance paid = record a payment of that amount.
    if (action === "mark_paid") {
      if (!MONEY_ROLES.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const rem = remaining(inv!);
      const amount = body.paymentType === "deposit" && !inv!.depositPaid ? Math.min(inv!.depositAmount, rem) : rem;
      if (amount <= 0) return NextResponse.json({ invoice: inv });
      const updated = await recordPayment(prisma, { invoiceId: inv!.id, amount, method: body.method || "other", reference: body.reference || null, recordedBy: session.name || session.email, note: "Marked paid" });
      return NextResponse.json({ invoice: updated });
    }

    if (action === "convert_to_final") {
      if (!MONEY_ROLES.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const comm = await commissionFor(prisma, inv!.jobId, inv!.subtotal);
      await prisma.invoice.update({ where: { id: inv!.id }, data: { kind: "final", dueDate: inv!.dueDate && inv!.dueDate > new Date() ? inv!.dueDate : new Date(Date.now() + NET_DAYS * 86400e3), ...comm } });
      return NextResponse.json({ invoice: await applyPayments(prisma, inv!.id) });
    }

    if (action === "cancel") {
      if (!MONEY_ROLES.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      const invoice = await prisma.invoice.update({ where: { id: inv!.id }, data: { status: "cancelled", commissionStatus: "none" } });
      return NextResponse.json({ invoice });
    }

    if (action === "commission_paid") {
      if (!MONEY_ROLES.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      if (inv!.commissionStatus !== "payable") return NextResponse.json({ error: "Commission is not payable until the invoice is paid" }, { status: 400 });
      const invoice = await prisma.invoice.update({ where: { id: inv!.id }, data: { commissionStatus: "paid", commissionPaidAt: new Date() } });
      return NextResponse.json({ invoice });
    }

    if (action === "set_due") {
      if (!MONEY_ROLES.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      await prisma.invoice.update({ where: { id: inv!.id }, data: { dueDate: body.dueDate ? new Date(body.dueDate) : null } });
      return NextResponse.json({ invoice: await applyPayments(prisma, inv!.id) });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Payments POST error:", error);
    return NextResponse.json({ error: "Payment failed" }, { status: 500 });
  }
}
