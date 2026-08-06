import { sendEmail } from "@/lib/email/graph-client";

// Lead notes — the shared timeline (Shimmie 8/6, approved by Benjy 8/6).
//
// Two entry points:
//   addSystemNote()  the agent and the crons, so Jessica's activity lands in
//                    the same history the reps read instead of a parallel one
//   addHumanNote()   a rep posting from the pipeline, incl. @mention fan-out
//
// The author may edit for EDIT_WINDOW_MIN minutes, then the note is frozen for
// everyone — long enough to fix a typo, short enough that nobody quietly
// rewrites what was said on a call last week.

export const EDIT_WINDOW_MIN = 15;
const PORTAL = "https://packaging.cndprinting.com/dashboard/pipeline";

export function isEditable(note: { authorId: string | null; kind: string; createdAt: Date | string }, userId: string): boolean {
  if (note.kind !== "human") return false;            // system notes are never editable
  if (!note.authorId || note.authorId !== userId) return false;
  const age = Date.now() - new Date(note.createdAt).getTime();
  return age <= EDIT_WINDOW_MIN * 60 * 1000;
}

// A system note is written by the machine, so it must never fail the caller —
// the agent losing a note is bad, the agent CRASHING because a note failed is
// worse.
export async function addSystemNote(prisma: any, leadId: string, body: string, source = "agent"): Promise<void> {
  try {
    const text = (body || "").trim();
    if (!text) return;
    await prisma.leadNote.create({
      data: { leadId, body: text.slice(0, 8000), kind: "system", source, authorName: source === "agent" ? "Jessica (AI)" : "Godzilla" },
    });
  } catch (e) {
    console.error("[lead-notes] system note failed", e);
  }
}

// @mentions. Matched against the real team roster rather than a regex alone,
// so "email me @ 9" or "@cndprinting.com" never pings anyone.
export type Mentionable = { id: string; name: string; email: string; notifyMentions: boolean };

export async function roster(prisma: any): Promise<Mentionable[]> {
  return prisma.user.findMany({
    where: { isActive: true, pipelineAccess: true },
    select: { id: true, name: true, email: true, notifyMentions: true },
    orderBy: { name: "asc" },
  });
}

// Longest-name-first so "@Albert Waxman" wins over "@Albert", and first names
// still resolve because that is how the team actually types.
export function findMentions(body: string, people: Mentionable[]): Mentionable[] {
  const hits = new Map<string, Mentionable>();
  const candidates = people
    .flatMap((p) => {
      const first = p.name.trim().split(/\s+/)[0];
      return [{ token: p.name, p }, ...(first && first !== p.name ? [{ token: first, p }] : [])];
    })
    .sort((a, b) => b.token.length - a.token.length);
  for (const { token, p } of candidates) {
    // \B@ so an email address mid-word never matches; boundary after the name
    // so "@Al" doesn't fire on "@Albert".
    const re = new RegExp(`(^|[^\\w@])@${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w@.])`, "i");
    if (re.test(body)) hits.set(p.id, p);
  }
  return [...hits.values()];
}

export async function notifyMentioned(
  prisma: any,
  opts: { mentioned: Mentionable[]; actorId: string; actorName: string; actorEmail: string; leadId: string; companyName: string; body: string },
): Promise<void> {
  const { mentioned, actorId, actorName, actorEmail, leadId, companyName, body } = opts;
  for (const m of mentioned) {
    if (m.id === actorId) continue; // tagging yourself pings nobody
    try {
      await prisma.notification.create({
        data: {
          userId: m.id, type: "mention", actorName,
          title: `${actorName} mentioned you on ${companyName}`,
          body: body.slice(0, 500),
          url: `${PORTAL}?lead=${leadId}`,
        },
      });
    } catch (e) { console.error("[lead-notes] notification failed", e); }

    if (!m.notifyMentions || !m.email) continue;
    try {
      // Sent AS the person who tagged you, so hitting reply reaches a human
      // rather than a no-reply mailbox.
      await sendEmail({
        from: actorEmail,
        to: m.email,
        subject: `${actorName} tagged you: ${companyName}`,
        body: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;">
          <p><strong>${actorName}</strong> mentioned you in a note on <strong>${companyName}</strong>:</p>
          <blockquote style="margin:12px 0;padding:8px 14px;border-left:3px solid #27AAE1;color:#333;white-space:pre-wrap;">${escapeHtml(body).slice(0, 2000)}</blockquote>
          <p style="margin-top:16px;"><a href="${PORTAL}?lead=${leadId}" style="color:#27AAE1;">Open this lead in Godzilla &rarr;</a></p>
          <p style="color:#aaa;font-size:11px;margin-top:20px;">You get this because you were tagged by name. Turn it off in Settings.</p>
        </div>`,
      });
    } catch (e) { console.error("[lead-notes] mention email failed", e); }
  }
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
