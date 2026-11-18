import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { TERMS } from "@/lib/press-gate";

// Sales-to-CSR handoff (Benjy 11/17, Carrie's step 3). Sales submits the won
// job with everything the CSR needs; it can't be submitted incomplete. CSRs see
// the queue on the Jobs page and enter the job in one click.
// GET            -> handoffs (CSR/ops: open queue + recent; sales: their own)
// POST           -> submit a handoff
// PUT {id, action: "return", note} -> send back to sales for missing info
// PUT {id, action: "gather", note} -> CSR parks it while chasing info (Benjy 11/18)
// GET ?count=1 -> how many are waiting (menu badge)

const SUBMIT_ROLES = ["SALES_REP", "SALES_MANAGER", "OWNER", "ADMIN", "GM", "CSR"];
const ENTER_ROLES = ["CSR", "OWNER", "ADMIN", "GM", "PRODUCTION_MANAGER", "SENIOR_PLANT_MANAGER"];
const ARTWORK = ["ready", "coming", "design", "reprint"];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !(SUBMIT_ROLES.includes(session.role) || ENTER_ROLES.includes(session.role))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ handoffs: [] });
  const csr = ENTER_ROLES.includes(session.role);
  if (request.nextUrl.searchParams.get("count") === "1") {
    const n = await (prisma as any).jobHandoff.count({ where: csr ? { status: { in: ["submitted", "gathering"] } } : { submittedById: session.id, status: "returned" } });
    return NextResponse.json({ count: n });
  }
  const since = new Date(Date.now() - 30 * 86400e3);
  const handoffs = await (prisma as any).jobHandoff.findMany({
    where: csr ? { OR: [{ status: { in: ["submitted", "gathering"] } }, { updatedAt: { gte: since } }] } : { submittedById: session.id },
    orderBy: { createdAt: "desc" }, take: 100,
  });
  return NextResponse.json({ handoffs, canEnter: csr });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !SUBMIT_ROLES.includes(session.role)) return NextResponse.json({ error: "Only sales and customer service can hand off jobs" }, { status: 403 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const b = await request.json();
  const t = (v: unknown, max = 500) => (v === null || v === undefined ? "" : String(v).trim().slice(0, max));

  // Carrie's checklist: nothing goes to the CSR incomplete.
  const missing: string[] = [];
  let customerName = t(b.customerName, 200);
  if (b.companyId) {
    const co = await prisma.company.findUnique({ where: { id: String(b.companyId) }, select: { name: true } });
    if (!co) return NextResponse.json({ error: "Customer record not found" }, { status: 400 });
    customerName = co.name;
  } else if (!b.newCustomer) missing.push("the customer (pick from Customers, or mark it a new customer)");
  if (!customerName) missing.push("customer name");
  if (!t(b.estimateNumber) && !t(b.estimateFileName)) missing.push("the accepted estimate (attach it or enter the estimate #)");
  if (!t(b.jobName)) missing.push("job name");
  if (!(Number(b.quantity) > 0)) missing.push("quantity");
  if (!(Number(b.quotedPrice) > 0)) missing.push("accepted price");
  if (!ARTWORK.includes(b.artworkStatus)) missing.push("artwork status");
  if (!t(b.deliveryAddress)) missing.push("delivery address");
  if (b.newCustomer) {
    if (!t(b.billingContact)) missing.push("billing contact");
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(t(b.billingEmail))) missing.push("billing email");
    if (!t(b.billingAddress)) missing.push("billing address");
  }
  if (missing.length) return NextResponse.json({ error: `Still needed: ${missing.join(", ")}.`, missing }, { status: 400 });

  const h = await (prisma as any).jobHandoff.create({ data: {
    leadId: b.leadId || null, companyId: b.companyId || null, customerName,
    submittedById: session.id, submittedByName: session.name,
    salesRepId: b.salesRepId || (["SALES_REP", "SALES_MANAGER", "OWNER", "ADMIN"].includes(session.role) ? session.id : null),
    estimateNumber: t(b.estimateNumber, 60) || null, jobName: t(b.jobName, 200), specs: t(b.specs, 4000) || null,
    quantity: Math.round(Number(b.quantity)), quotedPrice: Math.round(Number(b.quotedPrice) * 100) / 100,
    productType: b.productType === "COMMERCIAL_PRINT" ? "COMMERCIAL_PRINT" : "FOLDING_CARTON",
    customerPO: t(b.customerPO, 60) || null, dueDate: b.dueDate ? new Date(b.dueDate) : null,
    artworkStatus: b.artworkStatus, artworkNotes: t(b.artworkNotes, 2000) || null,
    newCustomer: !!b.newCustomer, billingContact: t(b.billingContact, 120) || null, billingEmail: t(b.billingEmail, 200).toLowerCase() || null,
    billingPhone: t(b.billingPhone, 40) || null, billingAddress: t(b.billingAddress, 500) || null, taxExempt: !!b.taxExempt,
    paymentTerms: TERMS[b.paymentTerms] ? b.paymentTerms : null, deliveryAddress: t(b.deliveryAddress, 500), shippingNotes: t(b.shippingNotes, 1000) || null,
    specialNotes: t(b.specialNotes, 2000) || null, estimateFileName: t(b.estimateFileName, 200) || null,
    estimateRead: b.estimateRead ? JSON.stringify(b.estimateRead).slice(0, 8000) : null,
  } });

  // Let the CSRs know it's waiting.
  try {
    const csrs = await prisma.user.findMany({ where: { role: "CSR", isActive: true }, select: { email: true } });
    const to = csrs.map((u) => u.email).filter(Boolean);
    if (to.length && session.email?.endsWith("@cndprinting.com")) {
      const { sendEmail } = await import("@/lib/email/graph-client");
      const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(h.quotedPrice);
      await sendEmail({ from: session.email, to, subject: `New job to enter: ${customerName}, ${h.jobName}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>${session.name} handed off a won job.</p><p><b>${customerName}</b>${h.newCustomer ? " (new customer)" : ""}<br>${h.jobName}<br>${h.quantity.toLocaleString()} at ${money}${h.estimateNumber ? `, estimate ${h.estimateNumber}` : ""}${h.paymentTerms ? `<br>Rep says terms: ${TERMS[h.paymentTerms]}` : ""}</p><p><a href="https://packaging.cndprinting.com/dashboard/csr-queue">Open the CSR Job Queue</a> to review it and create the job ticket.</p></div>` });
    }
  } catch { /* the handoff is saved either way */ }
  return NextResponse.json({ handoff: h });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session || !ENTER_ROLES.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const b = await request.json();
  const h = await (prisma as any).jobHandoff.findUnique({ where: { id: String(b.id || "") } });
  if (!h) return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
  if (b.action === "gather") {
    if (!ENTER_ROLES.includes(session.role)) return NextResponse.json({ error: "Only Customer Service" }, { status: 403 });
    const gn = String(b.note || "").trim();
    if (!gn) return NextResponse.json({ error: "Say what you're waiting on" }, { status: 400 });
    const g = await (prisma as any).jobHandoff.update({ where: { id: h.id }, data: { status: "gathering", gatherNote: gn.slice(0, 1000), gatheringBy: session.name, gatheringAt: new Date() } });
    return NextResponse.json({ handoff: g });
  }
  if (b.action !== "return") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const note = String(b.note || "").trim();
  if (!note) return NextResponse.json({ error: "Say what's missing so sales can fix it" }, { status: 400 });
  const updated = await (prisma as any).jobHandoff.update({ where: { id: h.id }, data: { status: "returned", returnedNote: note.slice(0, 2000), handledByName: session.name } });
  try {
    const rep = h.submittedById ? await prisma.user.findUnique({ where: { id: h.submittedById }, select: { email: true } }) : null;
    if (rep?.email && session.email?.endsWith("@cndprinting.com")) {
      const { sendEmail } = await import("@/lib/email/graph-client");
      await sendEmail({ from: session.email, to: rep.email, subject: `Need more info: ${h.customerName}, ${h.jobName}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>${session.name} sent this job back before entering it:</p><p>${note.replace(/</g, "&lt;")}</p><p><a href="https://packaging.cndprinting.com/dashboard/csr-queue">Open the CSR Job Queue</a> to fix and resend it.</p></div>` });
    }
  } catch { /* ignore */ }
  return NextResponse.json({ handoff: updated });
}
