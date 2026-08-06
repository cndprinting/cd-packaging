import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { EDIT_WINDOW_MIN, isEditable, roster, findMentions, notifyMentioned } from "@/lib/lead-notes";

// Lead note timeline (Shimmie 8/6). Append-only by design: posting is open to
// anyone with pipeline access, editing is the author's alone and only for a
// short window, and nothing is ever deleted — the point is an honest record of
// what was said to a prospect when two reps share the lead.

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

export async function GET(request: NextRequest) {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const leadId = request.nextUrl.searchParams.get("leadId");
  if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });
  const rows = await g.prisma.leadNote.findMany({ where: { leadId }, orderBy: { createdAt: "desc" }, take: 200 });
  // canEdit is computed here so the UI never has to know the locking rule.
  const notes = rows.map((n: any) => ({ ...n, canEdit: isEditable(n, g.session.id) }));
  return NextResponse.json({ notes, editWindowMin: EDIT_WINDOW_MIN });
}

export async function POST(request: NextRequest) {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await request.json();
  const text = String(body.body || "").trim();
  if (!body.leadId || !text) return NextResponse.json({ error: "leadId and body required" }, { status: 400 });

  const lead = await g.prisma.lead.findUnique({ where: { id: body.leadId }, select: { id: true, companyName: true } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  const people = await roster(g.prisma);
  const mentioned = findMentions(text, people);

  const note = await g.prisma.leadNote.create({
    data: {
      leadId: lead.id, body: text.slice(0, 8000), kind: "human",
      authorId: g.session.id, authorName: g.session.name || g.session.email,
      mentions: mentioned.length ? JSON.stringify(mentioned.map((m) => m.id)) : null,
    },
  });

  // A note also counts as touching the lead — it should stop reading as stale.
  await g.prisma.lead.update({ where: { id: lead.id }, data: { lastInteraction: new Date() } });

  // Fan-out must never cost the rep their note: it already saved above.
  try {
    await notifyMentioned(g.prisma, {
      mentioned, actorId: g.session.id, actorName: g.session.name || g.session.email,
      actorEmail: g.session.email, leadId: lead.id, companyName: lead.companyName, body: text,
    });
  } catch (e) { console.error("[notes] mention fan-out failed", e); }

  return NextResponse.json({ note: { ...note, canEdit: true }, notified: mentioned.map((m) => m.name) });
}

export async function PUT(request: NextRequest) {
  const g = await gate();
  if ("error" in g) return NextResponse.json({ error: g.error }, { status: g.status });
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "ID required" }, { status: 400 });
  const text = String(body.body || "").trim();
  if (!text) return NextResponse.json({ error: "Note cannot be empty" }, { status: 400 });

  const existing = await g.prisma.leadNote.findUnique({ where: { id: body.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isEditable(existing, g.session.id)) {
    return NextResponse.json({
      error: existing.authorId === g.session.id
        ? `This note locked ${EDIT_WINDOW_MIN} minutes after it was posted. Add a new note instead.`
        : "Only the person who wrote a note can edit it.",
    }, { status: 403 });
  }

  const note = await g.prisma.leadNote.update({ where: { id: body.id }, data: { body: text.slice(0, 8000), editedAt: new Date() } });
  return NextResponse.json({ note: { ...note, canEdit: isEditable(note, g.session.id) } });
}
