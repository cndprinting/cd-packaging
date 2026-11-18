import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { shipmentEmail, type NotifyKind } from "@/lib/shipping";
import { deliveryLabel, jobTallies, syncFreight } from "@/lib/shipping-server";

const RELEASE_ROLES = ["OWNER", "GM", "ADMIN", "ACCOUNTING"];
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// PUT    -> update a shipment (status, tracking, dates, links). COD shipments
//           can't be marked shipped until the linked invoice is paid, unless
//           override=true (Shayla confirmed payment some other way).
// POST   -> { action: "notify", kind: "shipdate" | "tracking", note?, preview? }
//           emails the customer from the sender's own mailbox.
// DELETE -> remove a shipment that has not gone out yet.

const OUT = ["PICKED_UP", "IN_TRANSIT", "DELIVERED"];
const remaining = (i: { total: number; paidAmount: number | null }) => Math.max(0, Math.round((i.total - (i.paidAmount || 0)) * 100) / 100);

async function ctx(params: Promise<{ id: string }>) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return { error: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) };
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return { error: NextResponse.json({ error: "Database not configured" }, { status: 500 }) };
  const { id } = await params;
  const s = await prisma.shipment.findUnique({ where: { id }, include: { items: true } });
  if (!s) return { error: NextResponse.json({ error: "Shipment not found" }, { status: 404 }) };
  return { session, prisma, s };
}

// GET -> everything the packing slip prints (Shayla 11/18).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctx(params); if ("error" in c) return c.error;
  const { prisma, s } = c;
  const co = s.companyId ? await prisma.company.findUnique({ where: { id: s.companyId }, select: { name: true, address: true, city: true, state: true, zip: true, phone: true } }) : null;
  const job = s.jobId ? await prisma.job.findUnique({ where: { id: s.jobId }, select: { jobNumber: true, name: true, customerPO: true, contactName: true, quantity: true } as any }) as any : null;
  return NextResponse.json({ shipment: s, company: co, job, label: await deliveryLabel(prisma, s) });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctx(params); if ("error" in c) return c.error;
  const { prisma, s } = c;
  const b = await request.json();
  const data: Record<string, unknown> = {};
  const str = (k: string, max = 200) => { if (k in b) data[k] = b[k] ? String(b[k]).trim().slice(0, max) : null; };
  const date = (k: string) => { if (k in b) data[k] = b[k] ? new Date(b[k]) : null; };
  const num = (k: string, int = false) => { if (k in b) data[k] = b[k] === "" || b[k] === null || !Number.isFinite(Number(b[k])) ? null : (int ? Math.round(Number(b[k])) : Number(b[k])); };
  ["carrier", "trackingNumber", "poNumber", "contactName", "destination", "notes"].forEach((k) => str(k));
  str("shipTo", 500); str("jobNumber", 60);
  if ("contactEmail" in b) data.contactEmail = b.contactEmail ? String(b.contactEmail).trim().toLowerCase() : null;
  ["targetShipDate", "shipDate", "estimatedDelivery", "actualDelivery"].forEach(date);
  num("cartons", true); num("pallets", true); num("weight"); num("freightCost");
  if (Array.isArray(b.items)) {
    await prisma.shipmentItem.deleteMany({ where: { shipmentId: s.id } });
    const rows = b.items.filter((i: any) => i?.description).map((i: any) => ({ shipmentId: s.id, description: String(i.description).slice(0, 200), quantity: Number(i.quantity) || 0, boxes: i.boxes ? String(i.boxes).slice(0, 80) : null }));
    if (rows.length) await prisma.shipmentItem.createMany({ data: rows });
    // Less than what's left on the job is a partial (Shayla 11/18).
    const jid = s.jobId;
    if (jid && !("isPartial" in b && b.isPartial)) {
      const qty = rows.reduce((t: number, r: any) => t + r.quantity, 0);
      const tl = (await jobTallies(prisma, [jid])).get(jid);
      // The tally already counts the new lines, so anything still left means this one is a partial.
      if (tl && qty) data.isPartial = tl.remaining > 0;
    }
  }
  if ("isPartial" in b) data.isPartial = !!b.isPartial;
  if ("cod" in b) data.cod = !!b.cod;
  if ("invoiceId" in b) {
    if (!b.invoiceId) { data.invoiceId = null; data.invoiceNumber = null; }
    else {
      const inv = await prisma.invoice.findUnique({ where: { id: String(b.invoiceId) }, select: { invoiceNumber: true, companyId: true } });
      if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 400 });
      if (inv.companyId && s.companyId && inv.companyId !== s.companyId) return NextResponse.json({ error: "That invoice belongs to a different customer" }, { status: 400 });
      data.invoiceId = String(b.invoiceId); data.invoiceNumber = inv.invoiceNumber;
    }
  }
  if (b.status) {
    const goingOut = OUT.includes(b.status) && !OUT.includes(s.status);
    const cod = "cod" in b ? !!b.cod : s.cod;
    const invId = (data.invoiceId as string | null | undefined) ?? s.invoiceId;
    // COD waits for Denise's OK (Shayla 11/18), or a paid invoice.
    if (goingOut && cod && !b.override && !s.codReleasedAt) {
      const inv = invId ? await prisma.invoice.findUnique({ where: { id: invId }, select: { status: true, total: true, paidAmount: true, invoiceNumber: true } }) : null;
      const paid = inv ? inv.status === "paid" || remaining(inv) <= 0 : false;
      if (!paid) return NextResponse.json({ error: s.codRequestedAt ? `COD: still waiting on accounting's OK to release (asked ${new Date(s.codRequestedAt).toLocaleDateString("en-US")}).` : "COD: ask accounting to release it first (the \"Ask Denise to release\" button).", cod: true }, { status: 409 });
    }
    data.status = b.status;
    if (goingOut && !s.shipDate && !("shipDate" in b)) data.shipDate = new Date();
    if (b.status === "DELIVERED" && !s.actualDelivery && !("actualDelivery" in b)) data.actualDelivery = new Date();
  }
  let shipment: any = await prisma.shipment.update({ where: { id: s.id }, data, include: { items: true } });
  // Freight cost onto the invoice's freight line (Shayla 11/18).
  if ("freightCost" in b || "invoiceId" in b) { await syncFreight(prisma, s.id, c.session.name); shipment = await prisma.shipment.findUnique({ where: { id: s.id }, include: { items: true } }); }
  // Move the job with its shipment (a partial doesn't ship the whole job).
  if (b.status && shipment.jobId) {
    try {
      const job = await prisma.job.findUnique({ where: { id: shipment.jobId }, select: { status: true } });
      const order = ["PACKED", "SHIPPED", "DELIVERED", "INVOICED"];
      const target = b.status === "DELIVERED" ? "DELIVERED" : OUT.includes(b.status) ? "SHIPPED" : null;
      if (job && target && !shipment.isPartial && order.indexOf(job.status) < order.indexOf(target)) await prisma.job.update({ where: { id: shipment.jobId }, data: { status: target as any } });
    } catch (e) { console.error("job status from shipment failed", e); }
  }
  return NextResponse.json({ shipment });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctx(params); if ("error" in c) return c.error;
  const { session, prisma, s } = c;
  const b = await request.json();
  if (b.action === "cod_request" || b.action === "cod_release") return codAction(prisma, session, s, b);
  if (b.action !== "notify") return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const kind: NotifyKind = b.kind === "tracking" ? "tracking" : "shipdate";
  if (kind === "shipdate" && !s.targetShipDate) return NextResponse.json({ error: "Set a target ship date first" }, { status: 400 });
  if (kind === "tracking" && !s.trackingNumber && !/local|pickup/i.test(s.carrier || "")) return NextResponse.json({ error: "Add the tracking number first" }, { status: 400 });
  const to = String(b.to || s.contactEmail || "").trim().toLowerCase();
  const { subject, html } = shipmentEmail(s, kind, { name: session.name, email: session.email }, b.note ? String(b.note).slice(0, 2000) : undefined);
  if (b.preview) return NextResponse.json({ to, subject, html });
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(to)) return NextResponse.json({ error: "Add the customer's email first" }, { status: 400 });
  const { sendEmail } = await import("@/lib/email/graph-client");
  // From the sender's own mailbox, so customer replies come back to her.
  const r = await sendEmail({ from: session.email, to, subject, body: html });
  if (!r.success) return NextResponse.json({ error: r.error || "Email failed" }, { status: 502 });
  const line = `${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}: ${kind === "tracking" ? "tracking" : "ship date"} email to ${to} by ${session.name}`;
  const shipment = await prisma.shipment.update({ where: { id: s.id }, data: { notifiedAt: new Date(), notifyLog: `${s.notifyLog ? s.notifyLog + "\n" : ""}${line}`.slice(-4000), contactEmail: s.contactEmail || to }, include: { items: true } });
  return NextResponse.json({ ok: true, to, shipment });
}

// COD (Shayla 11/18): she tells Denise, the CSR and the rep it's done (with any
// shipping cost); Denise gives the OK; then it can go.
async function codAction(prisma: any, session: any, s: any, b: any) {
  const { sendEmail } = await import("@/lib/email/graph-client");
  const job = s.jobId ? await prisma.job.findUnique({ where: { id: s.jobId }, select: { name: true, csr: { select: { email: true } }, salesRep: { select: { email: true } } } }) : null;
  const what = `${esc(s.customerName || "")}${s.jobNumber ? `, job ${esc(s.jobNumber)}` : ""}${job?.name ? ` (${esc(job.name)})` : ""}`;
  const link = "https://packaging.cndprinting.com/dashboard/shipping";
  if (b.action === "cod_request") {
    if (!s.cod) return NextResponse.json({ error: "This shipment isn't marked COD" }, { status: 400 });
    const acct = await prisma.user.findMany({ where: { role: "ACCOUNTING", isActive: true }, select: { id: true, email: true } });
    const to = [...new Set([...acct.map((u: any) => u.email), job?.csr?.email, job?.salesRep?.email].filter(Boolean))] as string[];
    const cost = Number(s.freightCost) || 0;
    if (to.length) await sendEmail({ from: session.email, to, subject: `COD ready to release: ${s.customerName || ""}${s.jobNumber ? ` job ${s.jobNumber}` : ""}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>${what} is done and ready to go out. It's COD.</p><p>${cost > 0 ? `Shipping cost: <b>$${cost.toFixed(2)}</b>.` : "No shipping cost on it."}${s.invoiceNumber ? ` Invoice ${esc(s.invoiceNumber)}.` : ""}</p>${b.note ? `<p>${esc(b.note)}</p>` : ""}<p>Denise, click <b>OK to release</b> on the shipment when it's good to go. <a href="${link}">Open Shipping</a></p></div>` }).catch(() => {});
    for (const u of acct) await prisma.notification.create({ data: { userId: u.id, type: "cod", actorName: session.name, title: `COD ready to release: ${s.customerName || ""}${s.jobNumber ? ` job ${s.jobNumber}` : ""}`, url: "/dashboard/shipping" } }).catch(() => {});
    const shipment = await prisma.shipment.update({ where: { id: s.id }, data: { codRequestedAt: new Date(), codRequestedBy: session.name, codRequestedEmail: session.email }, include: { items: true } });
    return NextResponse.json({ ok: true, shipment, emailed: to });
  }
  if (!RELEASE_ROLES.includes(session.role)) return NextResponse.json({ error: "Only accounting releases COD shipments" }, { status: 403 });
  const shipment = await prisma.shipment.update({ where: { id: s.id }, data: { codReleasedAt: new Date(), codReleasedBy: session.name }, include: { items: true } });
  if (s.codRequestedEmail) await sendEmail({ from: session.email, to: [s.codRequestedEmail], subject: `OK to release: ${s.customerName || ""}${s.jobNumber ? ` job ${s.jobNumber}` : ""}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>${what} is OK to ship or deliver. (${esc(session.name)})</p><p><a href="${link}">Open Shipping</a></p></div>` }).catch(() => {});
  return NextResponse.json({ ok: true, shipment });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctx(params); if ("error" in c) return c.error;
  const { prisma, s } = c;
  if (OUT.includes(s.status)) return NextResponse.json({ error: "This shipment already went out; change its status instead" }, { status: 400 });
  await prisma.shipment.delete({ where: { id: s.id } });
  return NextResponse.json({ ok: true });
}
