import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { jobTallies, syncFreight } from "@/lib/shipping-server";
import { JOBS_LIVE_SINCE as LIVE } from "@/lib/press-gate";

// Shipping queue (rebuilt 11/17/26). Every shipment is tied to a Customers
// record, and to the job and invoice when there is one.
// GET               -> { shipments, ready }   ready = jobs marked PACKED
// GET ?invoicesFor= -> that customer's invoices, so Shayla can link one and see COD paid status
// POST              -> create a shipment

// Jobs created before CSRs start entering real tickets are test data; keep them
// out of Shayla's "ready to ship" list.
const JOBS_LIVE_SINCE = new Date(process.env.JOBS_LIVE_SINCE || "2026-11-17");

const remaining = (i: { total: number; paidAmount: number | null }) => Math.max(0, Math.round((i.total - (i.paidAmount || 0)) * 100) / 100);

async function nextShipmentNumber(prisma: any) {
  const last = await prisma.shipment.findFirst({ where: { shipmentNumber: { startsWith: "SHP-" } }, orderBy: { shipmentNumber: "desc" }, select: { shipmentNumber: true } });
  const n = last ? parseInt(String(last.shipmentNumber).replace(/\D/g, ""), 10) : 999;
  return `SHP-${String((Number.isFinite(n) ? n : 999) + 1).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ shipments: [], ready: [] });
  const sp = new URL(request.url).searchParams;

  // Job # lookup for the shipment form (Benjy 11/19): pick the ticket, everything fills in.
  const jq = (sp.get("jobs") || "").trim();
  if (jq) {
    if (jq.length < 2) return NextResponse.json({ jobs: [] });
    const found = await prisma.job.findMany({
      where: { createdAt: { gte: LIVE }, status: { notIn: ["DELIVERED", "INVOICED"] as any }, OR: [{ jobNumber: { contains: jq, mode: "insensitive" } }, { name: { contains: jq, mode: "insensitive" } }, { order: { company: { name: { contains: jq, mode: "insensitive" } } } }] },
      select: { id: true, jobNumber: true, name: true, quantity: true, dueDate: true, deliveryTo: true, generalNotes: true, contactName: true, customerPO: true, order: { select: { companyId: true, poNumber: true, company: { select: { name: true, address: true, city: true, state: true, zip: true, contacts: { select: { name: true, email: true }, orderBy: { isPrimary: "desc" }, take: 3 } } } } } } as any,
      orderBy: { createdAt: "desc" }, take: 8,
    });
    const ids = found.map((j: any) => j.id);
    const invs = ids.length ? await prisma.invoice.findMany({ where: { jobId: { in: ids }, status: { notIn: ["cancelled", "draft"] } }, orderBy: { createdAt: "desc" }, select: { id: true, jobId: true } }) : [];
    const tl = await jobTallies(prisma, ids);
    return NextResponse.json({ jobs: found.map((j: any) => ({ id: j.id, jobNumber: j.jobNumber, name: j.name, quantity: j.quantity, companyId: j.order?.companyId || null, customerName: j.order?.company?.name || null, poNumber: j.customerPO || j.order?.poNumber || null, invoiceId: invs.find((i: any) => i.jobId === j.id)?.id || null, tally: tl.get(j.id) || null, ...fromTicket(j) })) });
  }
  const invoicesFor = sp.get("invoicesFor");
  if (invoicesFor) {
    const invs = await prisma.invoice.findMany({ where: { companyId: invoicesFor, status: { not: "cancelled" } }, orderBy: { createdAt: "desc" }, take: 25, select: { id: true, invoiceNumber: true, status: true, total: true, paidAmount: true, description: true, poNumber: true } as any });
    return NextResponse.json({ invoices: invs.map((i: any) => ({ ...i, remaining: remaining(i) })) });
  }

  const shipments = await prisma.shipment.findMany({ include: { items: true }, orderBy: [{ createdAt: "desc" }], take: 300 });
  const invIds = [...new Set(shipments.map((s: any) => s.invoiceId).filter(Boolean))] as string[];
  const invs = invIds.length ? await prisma.invoice.findMany({ where: { id: { in: invIds } }, select: { id: true, status: true, total: true, paidAmount: true } }) : [];
  const invMap = new Map(invs.map((i: any) => [i.id, i]));
  const ready = await prisma.job.findMany({
    where: { status: "PACKED" as any, createdAt: { gte: JOBS_LIVE_SINCE } },
    // What Shayla reads off the job ticket (11/18): deliver-to, shipping instructions, contact, PO.
    select: { id: true, jobNumber: true, name: true, quantity: true, dueDate: true, deliveryTo: true, generalNotes: true, contactName: true, customerPO: true, order: { select: { companyId: true, poNumber: true, company: { select: { name: true, address: true, city: true, state: true, zip: true, contacts: { select: { name: true, email: true }, orderBy: { isPrimary: "desc" }, take: 3 } } } } } } as any,
    orderBy: { dueDate: "asc" }, take: 100,
  }).catch(() => []);
  // The invoice for each ready job, so Shayla's shipment links to it automatically.
  const readyIds = ready.map((j: any) => j.id);
  const jobInvs = readyIds.length ? await prisma.invoice.findMany({ where: { jobId: { in: readyIds }, status: { notIn: ["cancelled", "draft"] } }, orderBy: { createdAt: "desc" }, select: { id: true, jobId: true } }) : [];
  const invFor = (jobId: string) => jobInvs.find((i: any) => i.jobId === jobId)?.id || null;
  // Ordered / delivered / balance per job (Shayla 11/18: partials).
  const tally = await jobTallies(prisma, [...shipments.map((s: any) => s.jobId), ...readyIds]);
  const out = shipments.map((s: any) => {
    const inv: any = s.invoiceId ? invMap.get(s.invoiceId) : null;
    return { ...s, invoicePaid: inv ? inv.status === "paid" || remaining(inv) <= 0 : null, invoiceBalance: inv ? remaining(inv) : null, codReleased: !!s.codReleasedAt || (inv ? inv.status === "paid" || remaining(inv) <= 0 : false), tally: s.jobId ? tally.get(s.jobId) || null : null };
  });
  return NextResponse.json({
    shipments: out,
    // A packed job stays on the list until its full quantity has shipped.
    ready: ready.filter((j: any) => (tally.get(j.id)?.remaining ?? j.quantity) > 0).map((j: any) => ({ tally: tally.get(j.id) || null, id: j.id, jobNumber: j.jobNumber, name: j.name, quantity: j.quantity, dueDate: j.dueDate, companyId: j.order?.companyId || null, customerName: j.order?.company?.name || null, poNumber: j.customerPO || j.order?.poNumber || null, invoiceId: invFor(j.id), ...fromTicket(j) })),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  const b = await request.json();

  if (!b.companyId) return NextResponse.json({ error: "Pick the customer from the Customers list" }, { status: 400 });
  const co = await prisma.company.findUnique({ where: { id: String(b.companyId) }, select: { id: true, name: true } });
  if (!co) return NextResponse.json({ error: "Customer record not found" }, { status: 400 });

  let jobId: string | null = b.jobId || null, jobNumber: string | null = b.jobNumber ? String(b.jobNumber).trim() : null;
  if (!jobId && jobNumber) { const j = await prisma.job.findFirst({ where: { jobNumber: { equals: jobNumber, mode: "insensitive" } }, select: { id: true, jobNumber: true } }); if (j) { jobId = j.id; jobNumber = j.jobNumber; } }
  if (jobId && !jobNumber) { const j = await prisma.job.findUnique({ where: { id: jobId }, select: { jobNumber: true } }); jobNumber = j?.jobNumber || null; }

  let invoiceId: string | null = b.invoiceId || null, invoiceNumber: string | null = null;
  // Shipping a Godzilla job with no invoice picked: use the job's own invoice.
  if (!invoiceId && jobId) invoiceId = (await prisma.invoice.findFirst({ where: { jobId, status: { notIn: ["cancelled", "draft"] } }, orderBy: { createdAt: "desc" }, select: { id: true } }))?.id || null;
  if (invoiceId) {
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { invoiceNumber: true, companyId: true } });
    if (!inv) return NextResponse.json({ error: "Invoice not found" }, { status: 400 });
    if (inv.companyId && inv.companyId !== co.id) return NextResponse.json({ error: "That invoice belongs to a different customer" }, { status: 400 });
    invoiceNumber = inv.invoiceNumber;
  }

  const num = (v: unknown) => (v === "" || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
  const shipment = await prisma.shipment.create({
    data: {
      shipmentNumber: await nextShipmentNumber(prisma),
      companyId: co.id, customerName: co.name, jobId, jobNumber, invoiceId, invoiceNumber,
      poNumber: b.poNumber ? String(b.poNumber).trim().slice(0, 60) : null,
      contactName: b.contactName ? String(b.contactName).trim().slice(0, 120) : null,
      contactEmail: b.contactEmail ? String(b.contactEmail).trim().toLowerCase().slice(0, 200) : null,
      shipTo: b.shipTo ? String(b.shipTo).trim().slice(0, 500) : null,
      destination: b.destination ? String(b.destination).trim().slice(0, 120) : null,
      carrier: b.carrier || null, trackingNumber: b.trackingNumber ? String(b.trackingNumber).trim() : null,
      targetShipDate: b.targetShipDate ? new Date(b.targetShipDate) : null,
      estimatedDelivery: b.estimatedDelivery ? new Date(b.estimatedDelivery) : null,
      cartons: num(b.cartons) as any, pallets: num(b.pallets) as any, weight: num(b.weight),
      isPartial: !!b.isPartial || (await isShort(prisma, jobId, b.items)), cod: !!b.cod, notes: b.notes || null, status: "PREPARING", createdBy: session.name,
      freightCost: num(b.freightCost),
      items: Array.isArray(b.items) && b.items.length ? { create: b.items.filter((i: any) => i?.description).map((i: any) => ({ description: String(i.description).slice(0, 200), quantity: Number(i.quantity) || 0, boxes: i.boxes ? String(i.boxes).slice(0, 80) : null })) } : undefined,
    },
    include: { items: true },
  });
  if (shipment.freightCost) await syncFreight(prisma, shipment.id, session.name);
  return NextResponse.json({ shipment });
}

/** Ship-to, instructions and contact as the CSR entered them on the job ticket,
 *  falling back to the customer record. */
function fromTicket(j: any) {
  const lines = String(j.deliveryTo || "").split("\n");
  const shipLine = lines.find((l) => /^Shipping:/i.test(l));
  const address = lines.filter((l) => l !== shipLine).join("\n").trim();
  const co = j.order?.company;
  const coAddr = co ? [co.address, [co.city, [co.state, co.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join("\n") : "";
  const special = String(j.generalNotes || "").split("\n").filter((l) => /^Special instructions:/i.test(l)).map((l) => l.replace(/^Special instructions:\s*/i, ""));
  const instructions = [shipLine ? shipLine.replace(/^Shipping:\s*/i, "") : "", ...special].filter(Boolean).join("\n");
  return {
    shipTo: address || (co?.name ? `${co.name}\n${coAddr}` : coAddr) || null,
    instructions: instructions || null,
    contactName: j.contactName || co?.contacts?.[0]?.name || null,
    contactEmail: co?.contacts?.find((c: any) => c.email)?.email || null,
  };
}

/** True when this shipment is less than what's left on the job (a partial). */
async function isShort(prisma: any, jobId: string | null, items: any) {
  if (!jobId || !Array.isArray(items)) return false;
  const qty = items.reduce((t: number, i: any) => t + (Number(i?.quantity) || 0), 0);
  if (!qty) return false;
  const left = (await jobTallies(prisma, [jobId])).get(jobId)?.remaining;
  return left !== undefined && qty < left;
}
