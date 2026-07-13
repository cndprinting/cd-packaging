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
