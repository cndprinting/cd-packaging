import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { shipmentEmail, type NotifyKind } from "@/lib/shipping";

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
  num("cartons", true); num("pallets", true); num("weight");
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
    if (goingOut && cod && !b.override) {
      const inv = invId ? await prisma.invoice.findUnique({ where: { id: invId }, select: { status: true, total: true, paidAmount: true, invoiceNumber: true } }) : null;
      const paid = inv ? inv.status === "paid" || remaining(inv) <= 0 : false;
      if (!paid) return NextResponse.json({ error: inv ? `COD: invoice ${inv.invoiceNumber} still has $${remaining(inv).toFixed(2)} open. Don't release until it's paid.` : "COD: no invoice is linked, so payment can't be confirmed. Don't release until it's paid.", cod: true }, { status: 409 });
    }
    data.status = b.status;
    if (goingOut && !s.shipDate && !("shipDate" in b)) data.shipDate = new Date();
    if (b.status === "DELIVERED" && !s.actualDelivery && !("actualDelivery" in b)) data.actualDelivery = new Date();
  }
  const shipment = await prisma.shipment.update({ where: { id: s.id }, data, include: { items: true } });
  return NextResponse.json({ shipment });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctx(params); if ("error" in c) return c.error;
  const { session, prisma, s } = c;
  const b = await request.json();
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

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await ctx(params); if ("error" in c) return c.error;
  const { prisma, s } = c;
  if (OUT.includes(s.status)) return NextResponse.json({ error: "This shipment already went out; change its status instead" }, { status: 400 });
  await prisma.shipment.delete({ where: { id: s.id } });
  return NextResponse.json({ ok: true });
}
