import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { OVERRIDE_ROLES, TERMS, TERMS_SET_ROLES, draftDepositInvoice, paymentState } from "@/lib/press-gate";

// Job payment + press gate (Benjy 11/17).
// GET  -> payment state: terms, linked invoices, deposit paid, proof approved, cleared for press
// POST { action: "terms", terms }        -> set payment terms
//      { action: "draft_deposit" }       -> draft the deposit invoice now (if it wasn't drafted at entry)
//      { action: "override", reason }    -> owners/GM/accounting release to press without the gate (logged)
//      { action: "clear_override" }
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const { id } = await params;
  const st = await paymentState(prisma, id);
  if (!st) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ ...st, canOverride: OVERRIDE_ROLES.includes(session.role), terms_options: TERMS });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const job = await prisma.job.findUnique({ where: { id }, select: { id: true, jobNumber: true, orderId: true, paymentNotes: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const log = (details: string) => prisma.activityLog.create({ data: { orderId: job.orderId, userId: session.id, action: "PAYMENT_GATE", details } }).catch(() => {});

  if (b.action === "terms") {
    if (!TERMS[b.terms]) return NextResponse.json({ error: "Unknown payment terms" }, { status: 400 });
    if (!TERMS_SET_ROLES.includes(session.role)) return NextResponse.json({ error: "Payment terms are set by accounting or Customer Service" }, { status: 403 });
    await prisma.job.update({ where: { id }, data: { paymentTerms: b.terms } as any });
    // A deposit draft nobody sent yet is wrong once the job is on credit terms.
    if (b.terms === "net30" || b.terms === "cod") {
      const n = await prisma.invoice.updateMany({ where: { jobId: id, status: "draft", kind: "prebill" }, data: { status: "cancelled", notes: `Cancelled: job terms changed to ${TERMS[b.terms]} by ${session.name}` } as any });
      if (n.count) await log(`${job.jobNumber}: unsent deposit draft cancelled (terms now ${TERMS[b.terms]})`);
    }
    await log(`${job.jobNumber} terms set to ${TERMS[b.terms]} by ${session.name}`);
  } else if (b.action === "draft_deposit") {
    const inv = await draftDepositInvoice(prisma, id, { byName: session.name, byEmail: session.email });
    if (!inv) return NextResponse.json({ error: "No deposit invoice drafted. The job needs a price and deposit or prepaid terms, and it can't already have an invoice." }, { status: 400 });
    await log(`${job.jobNumber} deposit invoice ${inv.invoiceNumber} drafted by ${session.name}`);
  } else if (b.action === "override") {
    if (!OVERRIDE_ROLES.includes(session.role)) return NextResponse.json({ error: "Only owners, the GM or accounting can release a job without the gate" }, { status: 403 });
    const reason = String(b.reason || "").trim();
    if (!reason) return NextResponse.json({ error: "Say why it's OK to go to press" }, { status: 400 });
    const stamp = `Released to press by ${session.name} on ${new Date().toLocaleDateString("en-US")}: ${reason}`.slice(0, 500);
    await prisma.job.update({ where: { id }, data: { pressOverride: stamp, paymentNotes: `${job.paymentNotes ? job.paymentNotes + "\n" : ""}${stamp}` } as any });
    await log(`${job.jobNumber}: ${stamp}`);
  } else if (b.action === "clear_override") {
    if (!OVERRIDE_ROLES.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    await prisma.job.update({ where: { id }, data: { pressOverride: null } as any });
    await log(`${job.jobNumber}: press release removed by ${session.name}`);
  } else return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  return NextResponse.json({ ...(await paymentState(prisma, id)), canOverride: OVERRIDE_ROLES.includes(session.role), terms_options: TERMS });
}
