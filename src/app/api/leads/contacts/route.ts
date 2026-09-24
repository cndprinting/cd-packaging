import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Lead contacts (Shimmie 9/23): up to three people per lead, each with a
// confirmed primary email/phone and a candidate "dump" behind a click.
// Contact #1 mirrors onto the lead's legacy contact fields and #2 onto the
// secondary pair, so the inbound/outbound agents keep reading what they always did.
const MAX = 3;

async function gate() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 as const };
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return { error: "Database not available", status: 500 as const };
  const u = await prisma.user.findUnique({ where: { id: session.id }, select: { pipelineAccess: true } });
  if (!u?.pipelineAccess) return { error: "Forbidden", status: 403 as const };
  return { session, prisma };
}

const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "") || null;
const lines = (v: unknown) => (typeof v === "string" ? v.split(/\r?\n|;|·/).map((x) => x.trim()).filter(Boolean) : []);

async function syncLead(prisma: any, leadId: string) {
  const cs = await prisma.leadContact.findMany({ where: { leadId }, orderBy: { sort: "asc" } });
  const a = cs[0], b = cs[1];
  await prisma.lead.update({ where: { id: leadId }, data: {
    contactName: a?.name || null, contactTitle: a?.title || null, contactEmail: a?.email || null, contactPhone: a?.phone || null,
    contactName2: b?.name || null, contactEmail2: b?.email || null,
  } });
  return cs;
}

export async function POST(request: NextRequest) {
  const g = await gate(); if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await request.json().catch(() => ({}));
  const leadId = String(body.leadId || "");
  const name = clean(body.name, 120);
  if (!leadId || !name) return NextResponse.json({ error: "Lead and contact name are required" }, { status: 400 });
  { const { newLeadBlock } = await import("@/lib/lead-gate"); const blocked = await newLeadBlock(g.prisma, leadId); if (blocked) return NextResponse.json({ error: blocked, code: "new_lead" }, { status: 409 }); }
  const n = await g.prisma.leadContact.count({ where: { leadId } });
  if (n >= MAX) return NextResponse.json({ error: `A lead holds up to ${MAX} contacts` }, { status: 400 });
  await g.prisma.leadContact.create({ data: {
    leadId, name, title: clean(body.title, 120), email: clean(body.email, 200)?.toLowerCase() || null, phone: clean(body.phone, 60),
    emailCandidates: lines(body.emailCandidates).join("\n") || null, phoneCandidates: lines(body.phoneCandidates).join("\n") || null, sort: n,
  } });
  return NextResponse.json({ contacts: await syncLead(g.prisma, leadId) });
}

export async function PUT(request: NextRequest) {
  const g = await gate(); if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  const cur = await g.prisma.leadContact.findUnique({ where: { id } });
  if (!cur) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  { const { newLeadBlock } = await import("@/lib/lead-gate"); const blocked = await newLeadBlock(g.prisma, cur.leadId); if (blocked) return NextResponse.json({ error: blocked, code: "new_lead" }, { status: 409 }); }
  const data: Record<string, unknown> = {};
  if ("name" in body) { const nm = clean(body.name, 120); if (!nm) return NextResponse.json({ error: "Name can't be blank" }, { status: 400 }); data.name = nm; }
  if ("title" in body) data.title = clean(body.title, 120);
  if ("email" in body) data.email = clean(body.email, 200)?.toLowerCase() || null;
  if ("phone" in body) data.phone = clean(body.phone, 60);
  if ("emailCandidates" in body) data.emailCandidates = lines(body.emailCandidates).join("\n") || null;
  if ("phoneCandidates" in body) data.phoneCandidates = lines(body.phoneCandidates).join("\n") || null;
  if ("sort" in body && Number.isInteger(body.sort)) data.sort = body.sort;
  await g.prisma.leadContact.update({ where: { id }, data });
  return NextResponse.json({ contacts: await syncLead(g.prisma, cur.leadId) });
}

export async function DELETE(request: NextRequest) {
  const g = await gate(); if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  const cur = await g.prisma.leadContact.findUnique({ where: { id } });
  if (!cur) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  await g.prisma.leadContact.delete({ where: { id } });
  const rest = await g.prisma.leadContact.findMany({ where: { leadId: cur.leadId }, orderBy: { sort: "asc" } });
  for (let i = 0; i < rest.length; i++) if (rest[i].sort !== i) await g.prisma.leadContact.update({ where: { id: rest[i].id }, data: { sort: i } });
  return NextResponse.json({ contacts: await syncLead(g.prisma, cur.leadId) });
}
