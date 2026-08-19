// Agent identity (Benjy 7/9) — the persona the agents send/read/sign as.
//
// Cutover plan: today the agent is "Albert Waxman" from awaxman@. Once Lee
// creates the Jessica shared mailbox, set in Vercel (Production):
//   AGENT_SENDER_EMAIL = jessica@cndprinting.com
//   AGENT_SENDER_NAME  = Jessica Waxman
// and redeploy. NEW leads then start under Jessica; leads whose threads already
// live in Albert's mailbox keep finishing there (lead.agentMailbox), and the
// inbox reader polls both mailboxes during the transition.
//
// Outbound cold prospecting is intentionally NOT part of this identity — those
// intros stay signed by the real owners (the family voice is what converts).

export const LEGACY_MAILBOX = "awaxman@cndprinting.com";
export const AGENT_MAILBOX = process.env.AGENT_SENDER_EMAIL || LEGACY_MAILBOX;
export const AGENT_NAME = process.env.AGENT_SENDER_NAME || "Albert Waxman";
export const AGENT_FIRST = AGENT_NAME.split(" ")[0];

// Which mailbox a given lead's conversation lives in. Existing threads stay
// where they started; brand-new leads adopt the current identity.
export function leadMailbox(lead: { agentMailbox?: string | null; agentConvId?: string | null; agentMaryConvId?: string | null }): string {
  if (lead.agentMailbox) return lead.agentMailbox;
  if (lead.agentConvId || lead.agentMaryConvId) return LEGACY_MAILBOX; // pre-cutover thread
  return AGENT_MAILBOX;
}

// The NAME follows the mailbox: a conversation that started as Albert keeps
// signing "Albert" to the end — never Albert yesterday, Jessica today (Benjy
// 7/13, e.g. St.Agave mid-flow with Mary). New leads sign as the current identity.
export const LEGACY_NAME = "Albert Waxman";
export function leadAgentName(lead: Parameters<typeof leadMailbox>[0]): string {
  return leadMailbox(lead) === LEGACY_MAILBOX && AGENT_MAILBOX !== LEGACY_MAILBOX ? LEGACY_NAME : AGENT_NAME;
}
export function leadAgentFirst(lead: Parameters<typeof leadMailbox>[0]): string {
  return leadAgentName(lead).split(" ")[0];
}

// Mailboxes the inbound reader must poll (deduped — a single box pre-cutover).
export const READ_MAILBOXES = [...new Set([AGENT_MAILBOX, LEGACY_MAILBOX])];

// House brevity rule (Benjy 8/19: "keep emails short"). Appended to every
// customer-facing prompt so the agent stops writing three paragraphs where two
// sentences do. The old copy opened with throat-clearing, restated the ask, and
// volunteered lead time nobody asked about.
export const BREVITY = ` BREVITY IS THE HOUSE STYLE and it matters more than completeness. Hard limits: at most 3 short sentences (a bullet list may replace one of them), under 70 words total, and never more than two <p> blocks. Get to the point in the first sentence. Do NOT open with filler like "Thank you for the quick reply", "I hope this finds you well", or "I wanted to reach out" - if a thank-you is warranted make it four words at most and put the substance in the same sentence. Do NOT restate what the customer just told us. Do NOT explain our process, our capabilities, or what happens next in general terms. Say only the ONE next thing you need from them. Do NOT mention lead time, timing, or turnaround UNLESS the customer explicitly asked about it. Do NOT add a closing pleasantry line such as "just send those over whenever you are ready" - end on the ask or the sign-off. Write the way a busy person types on their phone: plain, direct, warm, finished.`;
