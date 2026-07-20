import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Talent tracker API (Benjy 7/19) — recruiting pipeline for print/packaging
// sales hires. Owners-only: gated by the same pipelineAccess flag as the CRM.

async function gate() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 as const };
  const prismaModule = await import("@/lib/prisma");
  const prisma = prismaModule.default;
  if (!prisma) return { error: "Database not available", status: 500 as const };
  const u = await prisma.user.findUnique({ where: { id: session.id }, select: { pipelineAccess: true } });
  if (!u?.pipelineAccess) return { error: "Forbidden", status: 403 as const };
  return { session, prisma };
}

const FIELDS = ["name", "company", "title", "city", "state", "email", "phone", "linkedinUrl", "background", "source", "status", "ownerName", "notes"] as const;

export async function GET() {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const talent = await g.prisma.talent.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }] });
  return NextResponse.json({ talent });
}

export async function POST(request: NextRequest) {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await request.json();

  // Bulk import: { candidates: [...] } — used to seed researched lists.
  if (Array.isArray(body.candidates)) {
    let created = 0, skipped = 0;
    for (const c of body.candidates) {
      if (!c.name) { skipped++; continue; }
      const dup = await g.prisma.talent.findFirst({ where: { name: { equals: c.name, mode: "insensitive" }, company: { equals: c.company || "", mode: "insensitive" } } });
      if (dup) { skipped++; continue; }
      const data: any = { createdBy: g.session.id };
      for (const k of FIELDS) if (c[k]) data[k] = String(c[k]).slice(0, 2000);
      if (c.rating) data.rating = Number(c.rating) || null;
      await g.prisma.talent.create({ data });
      created++;
    }
    return NextResponse.json({ created, skipped });
  }

  if (!body.name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  const data: any = { createdBy: g.session.id };
  for (const k of FIELDS) if (k in body) data[k] = body[k] || null;
  if ("rating" in body) data.rating = body.rating ? Number(body.rating) : null;
  if ("nextStepAt" in body) data.nextStepAt = body.nextStepAt ? new Date(body.nextStepAt) : null;
  const t = await g.prisma.talent.create({ data });
  return NextResponse.json({ talent: t });
}

export async function PUT(request: NextRequest) {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const data: any = {};
  for (const k of FIELDS) if (k in body) data[k] = body[k] || null;
  if ("rating" in body) data.rating = body.rating ? Number(body.rating) : null;
  if ("nextStepAt" in body) data.nextStepAt = body.nextStepAt ? new Date(body.nextStepAt) : null;
  const t = await g.prisma.talent.update({ where: { id: body.id }, data });
  return NextResponse.json({ talent: t });
}

export async function DELETE(request: NextRequest) {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  await g.prisma.talent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
