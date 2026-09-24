// Next task (Shimmie 9/23): "AI scrubs the notes left by a rep and computes a
// possible next step ... It is only going off of the notes that were entered
// by the rep ... AI should not be given any sort of capabilities to go free on
// recommendation." So: input = the rep's human notes on this lead (newest
// first) plus the lead's sub-status and follow-up date; output = one task
// grounded in a quoted note, or "none" when the notes don't say.
import { getClaude } from "@/lib/agent/claude";

export type NextTaskKind = "call" | "text" | "email" | "quote" | "internal" | "wait" | "none";
export interface NextTask { kind: NextTaskKind; task: string; basis: string }

const KINDS: NextTaskKind[] = ["call", "text", "email", "quote", "internal", "wait", "none"];

const SYSTEM = `You turn a sales rep's own notes and email exchange on one lead into the single next task for that rep.

Hard rules:
- Use ONLY the notes and emails below. Do not invent facts, names, dates, products or reasons that are not there.
- Emails count: a customer reply asking for something means answering it; a rep email with no reply after several days means a follow-up; a promise in a sent email is a task.
- Sub-status and follow-up date are context only. They are never a basis. A task must trace to a note; if only the sub-status suggests a step, answer "none".
- If the notes do not point to a concrete next step, answer kind "none" with an empty task.
- Prefer the most recent note or email. Older ones only add context.
- One task, one line, at most 90 characters, written as an instruction ("Call Reid re: carton specs", "Send the 3-tier quote", "Email Mary for pricing").
- kind must be one of: call, text, email, quote, internal, wait, none.
  call/text/email = touch the customer that way; quote = get a quote out; internal = something inside C&D (ask Mary, Todd, Benjy); wait = the note says to hold until a date or until the customer comes back.
- basis = the exact note or email fragment (max 140 chars) the task comes from, copied verbatim.

Reply with JSON only: {"kind": "...", "task": "...", "basis": "..."}`;

export async function computeNextTask(input: { companyName: string; stage: string | null; followUpAt: Date | null; followUpNote: string | null; notes: { body: string; authorName: string; createdAt: Date }[]; emails?: { direction: string; fromAddr: string; toAddr: string; subject: string; bodyText: string; userName: string | null; sentAt: Date }[] }): Promise<NextTask | null> {
  const claude = getClaude();
  if (!claude) return null;
  const human = input.notes.filter((n) => n.body.trim()).slice(0, 8);
  const emails = (input.emails || []).slice(0, 8);
  if (human.length === 0 && emails.length === 0) return { kind: "none", task: "", basis: "" };
  const user = [
    `Lead: ${input.companyName}`,
    `Sub-status: ${input.stage || "—"}`,
    `Follow-up date: ${input.followUpAt ? input.followUpAt.toISOString().slice(0, 10) : "none"}${input.followUpNote ? ` (${input.followUpNote})` : ""}`,
    `Today: ${new Date().toISOString().slice(0, 10)}`,
    "",
    "Rep notes, newest first:",
    ...(human.length ? human.map((n) => `[${n.createdAt.toISOString().slice(0, 10)} ${n.authorName}] ${n.body.replace(/\s+/g, " ").slice(0, 700)}`) : ["(none)"]),
    "",
    "Emails on this lead, newest first:",
    ...(emails.length ? emails.map((e) => `[${e.sentAt.toISOString().slice(0, 10)} ${e.direction === "in" ? `REPLY from ${e.fromAddr}` : `SENT by ${e.userName || e.fromAddr} to ${e.toAddr}`}] ${e.subject} — ${e.bodyText.replace(/\s+/g, " ").slice(0, 500)}`) : ["(none)"]),
  ].join("\n");
  try {
    const r = await claude.messages.create({ model: "claude-opus-4-8", max_tokens: 200, system: SYSTEM, messages: [{ role: "user", content: user }] });
    const text = r.content.map((c) => (c.type === "text" ? c.text : "")).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    let kind: NextTaskKind = KINDS.includes(j.kind) ? j.kind : "none";
    const basis = String(j.basis || "").slice(0, 140);
    // Guardrail: the basis must actually appear in a rep note, or we drop the suggestion.
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const nb = norm(basis);
    const grounded = nb.length >= 8 && (human.some((n) => norm(n.body).includes(nb)) || emails.some((e) => norm(`${e.subject} ${e.bodyText}`).includes(nb)));
    if (!grounded) kind = "none";
    return { kind, task: kind === "none" ? "" : String(j.task || "").slice(0, 90), basis: kind === "none" ? "" : basis };
  } catch (e) {
    console.error("[next-task] failed", (e as Error).message);
    return null;
  }
}

/** Recompute and store on the lead. Cheap to call after every human note. */
export async function refreshNextTask(prisma: any, leadId: string): Promise<NextTask | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { companyName: true, stage: true, followUpAt: true, followUpNote: true,
      notes: { where: { kind: "human" }, orderBy: { createdAt: "desc" }, take: 8, select: { body: true, authorName: true, createdAt: true } },
      emails: { orderBy: { sentAt: "desc" }, take: 8, select: { direction: true, fromAddr: true, toAddr: true, subject: true, bodyText: true, userName: true, sentAt: true } } },
  });
  if (!lead) return null;
  const t = await computeNextTask(lead);
  if (!t) return null;
  await prisma.lead.update({ where: { id: leadId }, data: { nextTask: t.task || null, nextTaskKind: t.kind, nextTaskBasis: t.basis || null, nextTaskAt: new Date() } });
  return t;
}
