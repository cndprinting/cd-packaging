import { getClaude } from "@/lib/agent/claude";
import { checkBlocked } from "@/lib/agent/blocklist";
import { noEmDash } from "@/lib/agent/agent";
import { sendEmail, sendEmailGetConversation, replyInConversation } from "@/lib/email/graph-client";

// Outbound prospecting agent (Benjy 6/30). Sweeps the Leads tab and sends a
// bespoke intro + follow-ups from the lead's OWNER mailbox. Separate from the
// inbound agent but reuses the same email/Claude/blocklist plumbing.
//
// Gates (all OFF by default — nothing sends until reviewed):
//   AGENT_OUTBOUND_ENABLED=true  → the sweep runs at all
//   AGENT_OUTBOUND_AUTOSEND=true → emails go to PROSPECTS; otherwise each draft
//                                  is redirected to the owner's own inbox tagged
//                                  [DRAFT] so they can review what it would send
//   AGENT_OUTBOUND_LIMIT         → max sends per run (default 20, deliverability)

type Owner = { email: string; full: string; first: string };
const OWNERS_MAP: Record<string, Owner> = {
  benjy: { email: "bwaxman@cndprinting.com", full: "Benjy Waxman", first: "Benjy" },
  albert: { email: "awaxman@cndprinting.com", full: "Albert Waxman", first: "Albert" },
  nitay: { email: "nlaor@cndprinting.com", full: "Nitay Laor", first: "Nitay" },
};
const DEFAULT_OWNER = OWNERS_MAP.albert; // Kelsey / TBD / blank / unknown → Albert
function resolveOwner(ownerName?: string | null): Owner {
  return OWNERS_MAP[(ownerName || "").trim().toLowerCase()] || DEFAULT_OWNER;
}
const firstName = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "there";

export const outboundEnabled = () => process.env.AGENT_OUTBOUND_ENABLED === "true";
const autoSend = () => process.env.AGENT_OUTBOUND_AUTOSEND === "true";
const perRunLimit = () => parseInt(process.env.AGENT_OUTBOUND_LIMIT || "20", 10);

const FOLLOWUPS: Record<string, { next: string; days: number }> = {
  intro_sent: { next: "followup_1", days: 3 },
  followup_1: { next: "followup_2", days: 7 },
  followup_2: { next: "done", days: 0 },
};
const addDays = (from: Date, n: number) => new Date(from.getTime() + n * 24 * 3600 * 1000);
function logLine(prev: string | null, event: string): string {
  let arr: any[] = [];
  try { arr = prev ? JSON.parse(prev) : []; } catch { /* reset */ }
  arr.push({ at: new Date().toISOString(), event });
  return JSON.stringify(arr.slice(-50));
}
const wrap = (inner: string) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;">${inner}</div>`;

// ── Drafting ───────────────────────────────────────────────────────────────
async function draftIntro(lead: any, owner: Owner): Promise<string> {
  const contact = firstName(lead.contactName);
  const fallback = wrap(`
    <p>Hi ${contact},</p>
    <p>I'm ${owner.first} with C&amp;D Printing &amp; Packaging, a family-owned custom packaging manufacturer in St. Petersburg, Florida. We make folding cartons, custom boxes, and retail packaging for cosmetics, skincare, nutraceutical, and other consumer brands.</p>
    <p>I came across ${lead.companyName} and thought our work might be a good fit. We'd be glad to send over a few samples, or set up a quick call whenever it's convenient.</p>
    <p>Best regards,<br>${owner.full}<br>C&amp;D Printing &amp; Packaging</p>`);
  const claude = getClaude();
  if (!claude) return fallback;
  try {
    const system = `You write short, warm cold-intro emails for C&D Printing & Packaging, a family-owned custom packaging manufacturer in St. Petersburg, FL (folding cartons, custom boxes, retail packaging for cosmetics, skincare, nutraceutical, and CPG brands). You are writing AS ${owner.full}, a member of the C&D team, to a prospect. Goal: start a conversation, not hard-sell. When you know their market, note we specialize in that kind of product. Offer to send samples or set up a quick call. A few sentences only. Address the contact by FIRST name. No hype, no exclamation points, no emoji, no em dashes or en dashes (use commas/periods). Sign off "${owner.full}, C&D Printing & Packaging". Output ONLY the inner HTML body (<p>, <strong>, <br>).`;
    const user = `Prospect company: ${lead.companyName}. End market: ${lead.endMarket || lead.productCategory || "unknown"}. Contact first name: ${contact}. Notes: ${(lead.commentary || "").slice(0, 500)}. Write the intro email body now.`;
    const msg = await claude.messages.create({ model: "claude-opus-4-8", max_tokens: 1024, system, messages: [{ role: "user", content: user }] });
    const t: any = (msg.content || []).find((b: any) => b.type === "text");
    const html = t?.text?.trim();
    return html ? wrap(html) : fallback;
  } catch { return fallback; }
}
function draftFollowup(lead: any, owner: Owner, step: string): string {
  const contact = firstName(lead.contactName);
  const msg = step === "intro_sent"
    ? `Just following up on my note below about packaging for ${lead.companyName}. Happy to send over a few samples or hop on a quick call if useful.`
    : `Last note from me for now. If custom packaging is ever on the radar for ${lead.companyName}, we would love the chance to help, just reply anytime.`;
  return wrap(`<p>Hi ${contact},</p><p>${msg}</p><p>Best regards,<br>${owner.full}<br>C&amp;D Printing &amp; Packaging</p>`);
}

// ── Sending (threaded, from the owner's mailbox) ───────────────────────────
async function outboundSend(prisma: any, lead: any, owner: Owner, subject: string, body: string): Promise<boolean> {
  const subj = noEmDash(subject);
  const html = noEmDash(body);
  // Review mode: redirect the draft to the owner's own inbox so they can see it.
  if (!autoSend()) {
    await sendEmail({ from: owner.email, to: owner.email, subject: `[DRAFT → ${lead.contactEmail}] ${subj}`, body: html + `<p style="color:#bbb;font-size:11px;">[Outbound review mode — in production this would send to ${lead.contactName || lead.companyName} &lt;${lead.contactEmail}&gt; from ${owner.full}.]</p>` });
    return false; // not actually sent to the prospect; state not advanced
  }
  if (lead.outreachConvId) {
    const r = await replyInConversation({ from: owner.email, conversationId: lead.outreachConvId, to: lead.contactEmail, body: html });
    if (r.success) return true;
  }
  const r = await sendEmailGetConversation({ from: owner.email, to: lead.contactEmail, subject: subj, body: html });
  if (r.conversationId) { try { await prisma.lead.update({ where: { id: lead.id }, data: { outreachConvId: r.conversationId } }); } catch { /* ignore */ } }
  return !!r.success;
}

// ── The sweep ──────────────────────────────────────────────────────────────
export async function processOutbound(prisma: any): Promise<{ intros: number; followups: number; previews: number }> {
  if (!outboundEnabled()) return { intros: 0, followups: 0, previews: 0 };
  const now = new Date();
  const limit = perRunLimit();
  let sends = 0, intros = 0, followups = 0, previews = 0;

  // Follow-ups first (existing conversations), only when actually sending.
  if (autoSend()) {
    const due = await prisma.lead.findMany({
      where: { pipelineStage: "LEAD", agentHold: false, outreachNextAt: { not: null, lte: now }, outreachStatus: { in: ["intro_sent", "followup_1"] } },
      take: limit,
    });
    for (const l of due) {
      if (sends >= limit) break;
      const owner = resolveOwner(l.ownerName);
      const step = FOLLOWUPS[l.outreachStatus as string];
      if (!step) continue;
      try {
        const ok = await outboundSend(prisma, l, owner, `Re: C&D Printing & Packaging - ${l.companyName}`, draftFollowup(l, owner, l.outreachStatus));
        if (ok) {
          const next = step.days > 0 ? addDays(now, step.days) : null;
          await prisma.lead.update({ where: { id: l.id }, data: { outreachStatus: step.next, outreachNextAt: next, outreachLog: logLine(l.outreachLog, `Sent ${l.outreachStatus} follow-up`) } });
          sends++; followups++;
        }
      } catch { /* skip */ }
    }
  }

  // New intros — never-contacted, has email, not held, not blocklisted.
  const fresh = await prisma.lead.findMany({
    where: { pipelineStage: "LEAD", agentHold: false, outreachStatus: null, contactEmail: { not: null } },
    orderBy: { createdAt: "asc" }, take: limit * 2,
  });
  for (const l of fresh) {
    if (sends >= limit) break;
    if (!l.contactEmail || checkBlocked({ name: l.contactName, email: l.contactEmail, phone: l.contactPhone, company: l.companyName })) continue;
    const owner = resolveOwner(l.ownerName);
    try {
      const body = await draftIntro(l, owner);
      const sent = await outboundSend(prisma, l, owner, `C&D Printing & Packaging - ${l.companyName}`, body);
      if (sent) {
        await prisma.lead.update({ where: { id: l.id }, data: { outreachStatus: "intro_sent", outreachNextAt: addDays(now, 3), outreachLog: logLine(l.outreachLog, "Intro sent") } });
        sends++; intros++;
      } else {
        previews++; // review mode — drafted to owner, state untouched
        if (previews >= limit) break;
      }
    } catch { /* skip */ }
  }
  return { intros, followups, previews };
}
