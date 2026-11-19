import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { COC_ROLES_BLOCKED, cleanCoc, cocDraft, cocNumber, nextCocNumber } from "@/lib/coc";

// Certificates of Conformance (Shayla 11/19/26).
// GET ?shipmentId=  -> { coc } if one exists, else { draft } filled from the ticket
// GET ?id=          -> one COC (print page)
// GET ?jobId=       -> the job's COCs (job page)
// POST { shipmentId, data }        -> create (numbered)
// PUT  { id, data }                -> edit
// POST { action: "customer_flag", companyId, on } -> COC required for this customer
const JOB_SELECT = { id: true, jobNumber: true, name: true, contactName: true, customerPO: true, estimateNumber: true, stockDescription: true, flatSizeWidth: true, flatSizeHeight: true, finishedWidth: true, finishedHeight: true, dieNumber: true, dieCutterCode: true, gluerCode: true, binderyGlue: true, binderyFold: true, binderyStitch: true, coating: true, varnish: true, deliveryPackaging: true, artworkStatus: true } as any;
const CO_SELECT = { id: true, name: true, address: true, city: true, state: true, zip: true, cocRequired: true } as any;

async function ctx() {
  const session = await getSession();
  if (!session || COC_ROLES_BLOCKED.includes(session.role)) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 403 }) };
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return { error: NextResponse.json({ error: "Database not available" }, { status: 500 }) };
  return { session, prisma };
}
const shape = (c: any) => ({ id: c.id, number: c.number, label: cocNumber(c.number), shipmentId: c.shipmentId, jobId: c.jobId, data: c.data, preparedBy: c.preparedBy, createdAt: c.createdAt, updatedAt: c.updatedAt });

async function draftFor(prisma: any, shipmentId: string, by: string) {
  const s = await prisma.shipment.findUnique({ where: { id: shipmentId }, include: { items: true } });
  if (!s) return null;
  const job = s.jobId ? await prisma.job.findUnique({ where: { id: s.jobId }, select: JOB_SELECT }) : null;
  const co = s.companyId ? await prisma.company.findUnique({ where: { id: s.companyId }, select: CO_SELECT }) : null;
  return { s, draft: cocDraft(s, job, co, by) };
}

export async function GET(request: NextRequest) {
  const c = await ctx(); if ("error" in c) return c.error;
  const { prisma, session } = c;
  const sp = new URL(request.url).searchParams;
  if (sp.get("id")) {
    const coc = await prisma.coc.findUnique({ where: { id: sp.get("id")! } });
    return coc ? NextResponse.json({ coc: shape(coc) }) : NextResponse.json({ error: "COC not found" }, { status: 404 });
  }
  if (sp.get("jobId")) {
    const list = await prisma.coc.findMany({ where: { jobId: sp.get("jobId")! }, orderBy: { number: "asc" } });
    return NextResponse.json({ cocs: list.map(shape) });
  }
  const shipmentId = sp.get("shipmentId");
  if (!shipmentId) return NextResponse.json({ error: "Which shipment?" }, { status: 400 });
  const existing = await prisma.coc.findFirst({ where: { shipmentId }, orderBy: { number: "desc" } });
  if (existing) return NextResponse.json({ coc: shape(existing) });
  const d = await draftFor(prisma, shipmentId, session.name);
  if (!d) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  return NextResponse.json({ draft: d.draft, next: cocNumber(await nextCocNumber(prisma)) });
}

export async function POST(request: NextRequest) {
  const c = await ctx(); if ("error" in c) return c.error;
  const { prisma, session } = c;
  const b = await request.json().catch(() => ({}));
  if (b.action === "customer_flag") {
    const co = await prisma.company.update({ where: { id: String(b.companyId || "") }, data: { cocRequired: !!b.on }, select: { id: true, name: true, cocRequired: true } }).catch(() => null);
    if (!co) return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    return NextResponse.json({ ok: true, company: co });
  }
  const d = await draftFor(prisma, String(b.shipmentId || ""), session.name);
  if (!d) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  const data = cleanCoc(b.data, d.draft);
  // Two people printing at once: retry on a number collision.
  for (let i = 0; i < 3; i++) {
    try {
      const coc = await prisma.coc.create({ data: { number: await nextCocNumber(prisma), shipmentId: d.s.id, jobId: d.s.jobId || null, companyId: d.s.companyId || null, data, preparedBy: data.preparedBy || session.name, createdById: session.id } });
      if (d.s.jobId) {
        const job = await prisma.job.findUnique({ where: { id: d.s.jobId }, select: { orderId: true } });
        if (job?.orderId) await prisma.activityLog.create({ data: { orderId: job.orderId, userId: session.id, action: "COC", details: `COC #${cocNumber(coc.number)} for ${d.s.shipmentNumber} by ${session.name}` } }).catch(() => {});
      }
      return NextResponse.json({ coc: shape(coc) });
    } catch (e: any) { if (!String(e?.message || e).includes("Unique")) throw e; }
  }
  return NextResponse.json({ error: "Could not number the COC, try again" }, { status: 409 });
}

export async function PUT(request: NextRequest) {
  const c = await ctx(); if ("error" in c) return c.error;
  const { prisma } = c;
  const b = await request.json().catch(() => ({}));
  const coc = await prisma.coc.findUnique({ where: { id: String(b.id || "") } });
  if (!coc) return NextResponse.json({ error: "COC not found" }, { status: 404 });
  const data = cleanCoc(b.data, coc.data);
  const upd = await prisma.coc.update({ where: { id: coc.id }, data: { data, preparedBy: data.preparedBy || coc.preparedBy } });
  return NextResponse.json({ coc: shape(upd) });
}
