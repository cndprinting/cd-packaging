import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getClaude } from "@/lib/agent/claude";

// Dictation cleanup (Benjy 10/12): the browser transcribes the rep's voice;
// this turns the raw transcript into a clean note or a one-line reminder.
// Facts only — names, numbers, dates and promises stay exactly as said.
const SYSTEMS: Record<string, string> = {
  note: `You clean up a sales rep's spoken note about one lead so it reads well in a CRM.
Rules: keep every fact, name, number, date, price and promise exactly as spoken; remove filler (um, like, you know), false starts and repetition; fix grammar; write in first person past tense the way the rep would type it ("Met with Angela on 8/4. Samples from Martin coming week of 8/14."); keep it to the point, usually 1 to 4 sentences, one short paragraph per topic; never add anything that wasn't said; never use em dashes. Output only the cleaned note text.`,
  reminder: `You turn a sales rep's spoken reminder about one lead into one short reminder line for a CRM follow-up field.
Rules: at most 120 characters; imperative ("Call Reid about the carton specs"); keep names, numbers and dates exactly as spoken; no filler; never add anything that wasn't said; never use em dashes. Output only the line.`,
};

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  const mode = body.mode === "reminder" ? "reminder" : "note";
  if (!text) return NextResponse.json({ error: "Nothing was heard" }, { status: 400 });
  const claude = getClaude();
  if (!claude) return NextResponse.json({ text }); // no AI configured: hand back the raw transcript
  try {
    const r = await claude.messages.create({ model: "claude-opus-4-8", max_tokens: 600, system: SYSTEMS[mode], messages: [{ role: "user", content: `Lead: ${String(body.company || "").slice(0, 120)}\nToday: ${new Date().toLocaleDateString("en-US")}\n\nTranscript:\n${text.slice(0, 6000)}` }] });
    const out = r.content.map((c) => (c.type === "text" ? c.text : "")).join("").trim();
    return NextResponse.json({ text: out || text, raw: text });
  } catch (e) {
    console.error("[dictate] cleanup failed", (e as Error).message);
    return NextResponse.json({ text, raw: text, warning: "AI cleanup unavailable, raw transcript used" });
  }
}
