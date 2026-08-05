import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Attachments that follow the work (Benjy 8/5) — artwork, dielines, specs and
// samples collected on a lead have to still be there when Mary quotes it and
// when pre-press opens the job. See the Attachment model for the linking rule.
//
// Read is open to any logged-in internal user: pre-press, the estimator and
// the plant all need to open the artwork. Write is limited to the person who
// owns the record's stage — anyone internal can add, only an owner/admin or
// the uploader can delete.

const KINDS = ["artwork", "dieline", "spec", "sample", "proof", "po", "quote", "photo", "other"];
const SCOPES = ["leadId", "companyId", "quoteRequestId", "quoteId", "jobId"] as const;

async function ctx() {
  const session = await getSession();
  if (!session) return { error: "Unauthorized", status: 401 as const };
  const prismaModule = await import("@/lib/prisma");
  const prisma = prismaModule.default;
  if (!prisma) return { error: "Database not available", status: 500 as const };
  return { session, prisma };
}

// GET /api/attachments?leadId=… (or companyId / quoteRequestId / quoteId / jobId)
//
// A job passes every id it knows (jobId + quoteRequestId + companyId) and gets
// the union back, which is what makes a file uploaded way upstream on the lead
// show up on the job ticket without anything having copied it.
export async function GET(request: NextRequest) {
  const c = await ctx();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: c.status });
  const sp = request.nextUrl.searchParams;
  const or: any[] = [];
  for (const k of SCOPES) {
    const v = sp.get(k);
    if (v) or.push({ [k]: v });
  }
  if (!or.length) return NextResponse.json({ error: "A scope id is required" }, { status: 400 });
  const attachments = await c.prisma.attachment.findMany({ where: { OR: or }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ attachments });
}

export async function POST(request: NextRequest) {
  const c = await ctx();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: c.status });
  const body = await request.json();
  if (!body.url || !body.name) return NextResponse.json({ error: "name and url are required" }, { status: 400 });

  const data: any = {
    kind: KINDS.includes(body.kind) ? body.kind : "other",
    name: String(body.name).slice(0, 300),
    url: String(body.url).slice(0, 2000),
    fileSize: body.fileSize ? Number(body.fileSize) : null,
    notes: body.notes ? String(body.notes).slice(0, 2000) : null,
    uploadedBy: c.session.id,
    uploadedByName: c.session.name || null,
  };
  for (const k of SCOPES) if (body[k]) data[k] = String(body[k]);
  if (!SCOPES.some((k) => data[k])) return NextResponse.json({ error: "A scope id is required" }, { status: 400 });

  // Attaching to a lead that already has a customer behind it stamps the
  // company too, so the file survives the lead going quiet.
  if (data.leadId && !data.companyId) {
    const lead = await c.prisma.lead.findUnique({ where: { id: data.leadId }, select: { companyId: true } });
    if (lead?.companyId) data.companyId = lead.companyId;
  }

  const attachment = await c.prisma.attachment.create({ data });
  return NextResponse.json({ attachment });
}

// PUT — carry a file forward: stamp the downstream ids onto an existing row.
// Nothing is copied and nothing is unlinked, so it stays visible upstream too.
export async function PUT(request: NextRequest) {
  const c = await ctx();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: c.status });
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const data: any = {};
  for (const k of SCOPES) if (k in body) data[k] = body[k] || null;
  if ("kind" in body && KINDS.includes(body.kind)) data.kind = body.kind;
  if ("notes" in body) data.notes = body.notes || null;
  const attachment = await c.prisma.attachment.update({ where: { id: body.id }, data });
  return NextResponse.json({ attachment });
}

export async function DELETE(request: NextRequest) {
  const c = await ctx();
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: c.status });
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const row = await c.prisma.attachment.findUnique({ where: { id }, select: { uploadedBy: true } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Downstream departments open these files; one person shouldn't be able to
  // pull artwork out from under a job they don't own.
  const u = await c.prisma.user.findUnique({ where: { id: c.session.id }, select: { role: true } });
  const privileged = ["OWNER", "ADMIN", "GM", "SENIOR_PLANT_MANAGER", "PREPRESS_MANAGER"].includes(u?.role || "");
  if (!privileged && row.uploadedBy !== c.session.id) {
    return NextResponse.json({ error: "Only the uploader or a manager can remove this file" }, { status: 403 });
  }
  await c.prisma.attachment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
