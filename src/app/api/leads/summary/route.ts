import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getClaude } from "@/lib/agent/claude";

// Account overview (Shimmie 9/24): "a brief overview that is concise yet
// informative enough to get a glimpse into the full history of the account,
// based off the notes." Written from every note on the lead (reps' notes
// carry the weight; agent/system notes fill in dates) and stored on the lead
// so the next reader gets it instantly. The button recomputes.
const SYSTEM = `You write a short account overview for a print-and-packaging sales team from the notes on one lead.

Rules:
- Use only the notes and lead facts given. Never invent names, dates, prices or outcomes.
- 4 to 7 short lines, plain English, no headings, no bullets, no markdown. Newest developments last.
- Cover: who the account is and what they buy or asked about; how we got connected; what has happened, in order, with dates from the notes; where it stands now; anything a rep must know before touching it (people to avoid, promises made, pricing said).
- Reps' notes matter most. "[Agent]" or system notes only add dates and sent/replied facts.
- If there are fewer than two useful notes, say in one line what little is known.`;

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const u = await prisma.user.findUnique({ where: { id: session.id }, select: { pipelineAccess: true } });
  if (!u?.pipelineAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const id = String(body.id || "");
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { companyName: true, endMarket: true, productCategory: true, city: true, state: true, pipelineStage: true, stage: true, ownerName: true, volume: true, createdAt: true, followUpAt: true, followUpNote: true,
      contacts: { orderBy: { sort: "asc" }, select: { name: true, title: true } },
      notes: { orderBy: { createdAt: "asc" }, take: 60, select: { body: true, authorName: true, kind: true, createdAt: true } } },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  const claude = getClaude();
  if (!claude) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const notes = lead.notes.filter((n) => n.body.trim());
  const user = [
    `Account: ${lead.companyName}${lead.endMarket ? ` (${lead.endMarket})` : ""}${lead.productCategory ? `, product: ${lead.productCategory}` : ""}${lead.city || lead.state ? `, ${[lead.city, lead.state].filter(Boolean).join(", ")}` : ""}`,
    `Stage: ${lead.pipelineStage}${lead.stage ? ` / ${lead.stage}` : ""} · Owner: ${lead.ownerName || "unassigned"}${lead.volume ? ` · Volume: ${lead.volume}` : ""}`,
    `In pipeline since ${lead.createdAt.toISOString().slice(0, 10)}${lead.followUpAt ? ` · Follow-up ${lead.followUpAt.toISOString().slice(0, 10)}${lead.followUpNote ? ` (${lead.followUpNote})` : ""}` : ""}`,
    lead.contacts.length ? `Contacts: ${lead.contacts.map((c) => c.name + (c.title ? ` (${c.title})` : "")).join(", ")}` : "",
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    "",
    `Notes, oldest first (${notes.length}):`,
    ...notes.map((n) => `[${n.createdAt.toISOString().slice(0, 10)} ${n.kind === "human" ? n.authorName : "system/agent"}] ${n.body.replace(/\s+/g, " ").slice(0, 900)}`),
  ].filter((x) => x !== "").join("\n");
  try {
    const r = await claude.messages.create({ model: "claude-opus-4-8", max_tokens: 500, system: SYSTEM, messages: [{ role: "user", content: user }] });
    const text = r.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
    if (!text) return NextResponse.json({ error: "No summary came back" }, { status: 502 });
    const summaryAt = new Date();
    await prisma.lead.update({ where: { id }, data: { summary: text, summaryAt, summaryNotes: notes.length } });
    return NextResponse.json({ summary: text, summaryAt: summaryAt.toISOString(), summaryNotes: notes.length });
  } catch (e) {
    console.error("[summary] failed", (e as Error).message);
    return NextResponse.json({ error: "Could not write the overview right now" }, { status: 502 });
  }
}
