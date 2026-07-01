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

// Lead fields sometimes hold MULTIPLE people, pipe/comma/slash separated, e.g.
// name "Ken Lorichio | Reid Barack", email "ken@sunnutra.com | rbarack27@gmail.com".
// Pull out each valid email and pair it (by position) with the matching name.
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
type Contact = { name: string; email: string };
export function parseContacts(emailField?: string | null, nameField?: string | null): Contact[] {
  const emails = (emailField || "").match(EMAIL_RE) || [];
  const names = (nameField || "").split(/\s*[|,;/]\s*|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
  // de-dupe emails, keep order
  const seen = new Set<string>();
  return emails.map((e) => e.toLowerCase()).filter((e) => (seen.has(e) ? false : (seen.add(e), true)))
    .map((email, i) => ({ email, name: names[i] || names[0] || "" }));
}
// Ordered contacts for a lead: the structured primary/secondary fields, plus any
// extra people parsed out of a combined field (e.g. "Ken | Reid"). De-duped.
function contactList(lead: any): Contact[] {
  const list = parseContacts(lead.contactEmail, lead.contactName);
  if (lead.contactEmail2) {
    for (const c of parseContacts(lead.contactEmail2, lead.contactName2)) {
      if (!list.some((x) => x.email === c.email)) list.push(c);
    }
  }
  return list;
}
// The contact the sequence is currently on (primary first, then secondary).
function currentContact(lead: any): Contact | null {
  return contactList(lead)[lead.outreachContact || 0] || null;
}

export const outboundEnabled = () => process.env.AGENT_OUTBOUND_ENABLED === "true";
const autoSend = () => process.env.AGENT_OUTBOUND_AUTOSEND === "true";
const perRunLimit = () => parseInt(process.env.AGENT_OUTBOUND_LIMIT || "20", 10);
// Per-lead web research on the intro (Claude web search). On by default; set
// AGENT_OUTBOUND_RESEARCH=false to disable (small per-search cost).
const research = () => process.env.AGENT_OUTBOUND_RESEARCH !== "false";

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
// Outbound emails read like a plain personal note — strip any bold that slips in.
const stripBold = (s: string) => (s || "").replace(/<\/?(?:b|strong)\b[^>]*>/gi, "");

// Append a dated, human-readable line to the lead's Notes so owners see the
// agent's activity in the pipeline, e.g. "[Agent] Intro email sent 6/27/2026".
// Re-reads commentary right before writing to avoid clobbering manual edits.
export async function appendNote(prisma: any, leadId: string, line: string): Promise<void> {
  try {
    const cur = await prisma.lead.findUnique({ where: { id: leadId }, select: { commentary: true } });
    const stamp = new Date().toLocaleDateString("en-US");
    const note = `${(cur?.commentary || "").trim()}\n[Agent] ${line} ${stamp}`.trim().slice(0, 8000);
    await prisma.lead.update({ where: { id: leadId }, data: { commentary: note } });
  } catch { /* ignore */ }
}

// ── Drafting ───────────────────────────────────────────────────────────────
async function draftIntro(lead: any, owner: Owner, contactName: string): Promise<{ subject: string; body: string }> {
  const contact = firstName(contactName);
  const fallback = {
    subject: `Family-built packaging from C&D, right here in St. Pete`,
    body: wrap(`
      <p>Hi ${contact},</p>
      <p>I'm ${owner.first} with C&amp;D Printing &amp; Packaging, a family-owned folding carton manufacturer that has been in St. Petersburg, Florida for about 50 years. Our family, the Waxmans, and a team of 50-plus make folding cartons, custom boxes, and retail packaging for cosmetics, skincare, nutraceutical, and other consumer brands.</p>
      <p>I came across ${lead.companyName} and thought we could be a good fit. What sets us apart is that working with us means working with our family directly. Would you be open to a quick call, or an in-person visit if you are nearby?</p>
      <p>Best,<br>${owner.first}</p>`),
  };
  const claude = getClaude();
  if (!claude) return fallback;
  try {
    const system = `You write warm, personal cold-intro emails for C&D Printing & Packaging, in the voice of the Waxman family that owns it. C&D is a family-owned, roughly 50-year-old folding carton and packaging manufacturer in St. Petersburg, Florida (folding cartons, custom boxes, retail and printed packaging), with a team of 50-plus, serving cosmetics, skincare, nutraceutical, health-and-wellness, and other consumer brands and contract manufacturers. You are writing AS ${owner.full} (first name ${owner.first}), part of the C&D team.

Model the tone on our best-performing emails:
- Warm, personal, human. Never salesy or templated.
- Open with something specific and genuine about THEIR company (their market, what they make, their family or story if evident) and tie it to C&D being a family, multi-generation manufacturer.
- Lean on being local when it fits (St. Petersburg, Tampa, Orlando, "neighbors", "a short drive away", "an hour from you").
- Emphasize that working with C&D means working directly with the family (and a 50-plus person team).
- Soft call to action: offer a quick call or an in-person visit, and invite a reply.
- A few short paragraphs.

You (${owner.first}) are based in Miami (Brickell); C&D's manufacturing plant is in St. Petersburg. Pick the stronger local hook: if the prospect is in South Florida (Miami, Fort Lauderdale, West Palm), say you are local to them in Miami and could easily meet in person; if they are near Tampa, St. Petersburg, or Orlando, note the plant is a short drive; otherwise keep geography light.

Research the prospect first using web search: what they make, where they are based, their notable products or brands, and anything genuinely current. Weave in one or two specific, accurate details you find (for example the kinds of products they package). Use only facts you actually verify. Never guess or fabricate a product, location, or person.

Rules: address the contact by FIRST name. Plain personal email: NO bold, NO <strong>/<b>, NO em dashes or en dashes (use commas or periods), no emoji, no exclamation points, no hype. Sign off with just the first name (${owner.first}). Personalize from the company name, market, website, and notes provided, and from what you genuinely know about the company, but NEVER invent specific facts (do not make up product names, locations, or people you are unsure of).

Output format: the FIRST line must be "SUBJECT: " then a short, warm, specific subject (in the spirit of "Family-built packaging, right here in St. Pete and Orlando"). Then a blank line, then ONLY the inner HTML email body using <p> and <br> only.`;
    const user = `Prospect company: ${lead.companyName}. Market: ${lead.endMarket || lead.productCategory || "unknown"}. Website: ${lead.website || "n/a"}. Contact first name: ${contact}. Notes: ${(lead.commentary || "").slice(0, 600)}. Write the subject and intro email now.`;
    const req: any = { model: "claude-opus-4-8", max_tokens: 2500, system, messages: [{ role: "user", content: user }] };
    if (research()) req.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
    const msg = await claude.messages.create(req);
    // With web search there can be interim text between searches; the email is
    // the LAST text block (the model's final answer after researching).
    const texts = (msg.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text || "");
    const raw = (texts[texts.length - 1] || "").trim();
    const m = raw.match(/^\s*SUBJECT:\s*(.+?)\s*\r?\n([\s\S]+)$/i);
    if (m) return { subject: m[1].trim(), body: wrap(m[2].trim()) };
    return raw ? { subject: fallback.subject, body: wrap(raw) } : fallback;
  } catch { return fallback; }
}
function draftFollowup(lead: any, owner: Owner, step: string, contactName: string): string {
  const contact = firstName(contactName);
  const msg = step === "intro_sent"
    ? `Just following up on my note below about packaging for ${lead.companyName}. Happy to send over a few samples or hop on a quick call if useful.`
    : `Last note from me for now. If custom packaging is ever on the radar for ${lead.companyName}, we would love the chance to help, just reply anytime.`;
  return wrap(`<p>Hi ${contact},</p><p>${msg}</p><p>Best regards,<br>${owner.full}<br>C&amp;D Printing &amp; Packaging</p>`);
}

// ── Sending (threaded, from the owner's mailbox) ───────────────────────────
async function outboundSend(prisma: any, lead: any, owner: Owner, to: string, toName: string, subject: string, body: string): Promise<boolean> {
  const subj = noEmDash(subject);
  const html = stripBold(noEmDash(body));
  // Review mode: redirect the draft to the owner's own inbox so they can see it.
  if (!autoSend()) {
    await sendEmail({ from: owner.email, to: owner.email, subject: `[DRAFT → ${to}] ${subj}`, body: html + `<p style="color:#bbb;font-size:11px;">[Outbound review mode — in production this would send to ${toName || lead.companyName} &lt;${to}&gt; from ${owner.full}.]</p>` });
    return false; // not actually sent to the prospect; state not advanced
  }
  if (lead.outreachConvId) {
    const r = await replyInConversation({ from: owner.email, conversationId: lead.outreachConvId, to, body: html });
    if (r.success) return true;
  }
  const r = await sendEmailGetConversation({ from: owner.email, to, subject: subj, body: html });
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
      const contact = currentContact(l);
      if (!contact) continue;
      const owner = resolveOwner(l.ownerName);
      const step = FOLLOWUPS[l.outreachStatus as string];
      if (!step) continue;
      try {
        const ok = await outboundSend(prisma, l, owner, contact.email, contact.name, `Re: C&D Printing & Packaging - ${l.companyName}`, draftFollowup(l, owner, l.outreachStatus, contact.name));
        if (ok) {
          await appendNote(prisma, l.id, `Follow-up sent to ${contact.name || contact.email}`);
          if (step.next === "done") {
            // Sequence for this contact is done with no reply. Roll to the next
            // contact (secondary) if there is one; otherwise close out.
            const nextIdx = (l.outreachContact || 0) + 1;
            if (contactList(l)[nextIdx]) {
              await prisma.lead.update({ where: { id: l.id }, data: { outreachContact: nextIdx, outreachStatus: null, outreachConvId: null, outreachNextAt: null, outreachLog: logLine(l.outreachLog, `No reply, moving to contact ${nextIdx + 1}`) } });
            } else {
              await prisma.lead.update({ where: { id: l.id }, data: { outreachStatus: "done", outreachNextAt: null, outreachLog: logLine(l.outreachLog, "Sequence complete, no response") } });
            }
          } else {
            await prisma.lead.update({ where: { id: l.id }, data: { outreachStatus: step.next, outreachNextAt: addDays(now, step.days), outreachLog: logLine(l.outreachLog, `Sent ${l.outreachStatus} follow-up`) } });
          }
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
    const contact = currentContact(l); // primary, or secondary once we've rolled over
    if (!contact) continue;
    if (checkBlocked({ name: contact.name, email: contact.email, phone: l.contactPhone, company: l.companyName })) continue;
    const owner = resolveOwner(l.ownerName);
    try {
      const draft = await draftIntro(l, owner, contact.name);
      const sent = await outboundSend(prisma, l, owner, contact.email, contact.name, draft.subject, draft.body);
      if (sent) {
        await prisma.lead.update({ where: { id: l.id }, data: { outreachStatus: "intro_sent", outreachNextAt: addDays(now, 3), outreachLog: logLine(l.outreachLog, "Intro sent") } });
        await appendNote(prisma, l.id, `Intro email sent to ${contact.name || contact.email}`);
        sends++; intros++;
      } else {
        previews++; // review mode — drafted to owner, state untouched
        if (previews >= limit) break;
      }
    } catch { /* skip */ }
  }
  return { intros, followups, previews };
}
