import { getClaude } from "@/lib/agent/claude";
import { checkBlocked } from "@/lib/agent/blocklist";
import { noEmDash, SIGNATURE, firstName, informalCompany, hasRealName, isWeekendET } from "@/lib/agent/agent";
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
  jessica: { email: "jwaxman@cndprinting.com", full: "Jessica Waxman", first: "Jessica" }, // the agent's own identity (Benjy 7/13)
};
// The agent's pool (owner "Jessica", Kelsey, TBD, blank, unknown) sends as
// Jessica. Real owner names still send as themselves — the family voice.
const DEFAULT_OWNER = OWNERS_MAP.jessica;
// Jessica's mailbox is brand-new with zero cold-send reputation — ramp it.
// Raise AGENT_OUTBOUND_JESSICA_LIMIT in the env as deliverability proves out.
const jessicaPerRunCap = () => parseInt(process.env.AGENT_OUTBOUND_JESSICA_LIMIT || "8", 10);
// Benjy, Nitay, Albert are BCC'd on every outbound send so they can monitor the
// agent (invisible to the prospect). The sending owner is dropped since their
// own copy already lands in Sent.
// Nitay asked off the outreach threads (Benjy 7/20) — he still gets the
// internal alerts (replies/digests), just not the per-email monitoring copies.
const OWNER_BCC = [OWNERS_MAP.benjy.email, OWNERS_MAP.albert.email];
const bccFor = (owner: Owner) => OWNER_BCC.filter((e) => e.toLowerCase() !== owner.email.toLowerCase());
// The AI never sends as Albert anymore (Benjy 7/27: "AI emails from Albert
// should be discontinued and moved to Jessica"). Albert-owned prospects are
// cold-emailed BY Jessica, who says she is picking it up for him. Real people
// (Benjy/Nitay) keep their own voice on leads they own.
const NO_AGENT_SEND = new Set(["albert"]);
function resolveOwner(ownerName?: string | null): Owner {
  const key = (ownerName || "").trim().toLowerCase();
  if (NO_AGENT_SEND.has(key)) return OWNERS_MAP.jessica;
  return OWNERS_MAP[key] || DEFAULT_OWNER;
}
// Reverse lookup for a stamped sender mailbox (lead.outreachMailbox).
function ownerByEmail(email?: string | null): Owner | null {
  const e = (email || "").trim().toLowerCase();
  return Object.values(OWNERS_MAP).find((o) => o.email.toLowerCase() === e) || null;
}
// firstName/informalCompany come from agent.ts (quote-aware nickname + no LLC/Inc suffixes)

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
// Emails the agent has already reached out to on this lead (lowercased set).
// This is tracked by ADDRESS, not list position, so editing/adding contacts
// never causes a re-email and a newly added contact gets picked up cleanly.
function emailedSet(lead: any): Set<string> {
  try { return new Set((JSON.parse(lead.outreachEmailed || "[]") as string[]).map((e) => String(e).toLowerCase())); }
  catch { return new Set(); }
}
function withEmailed(lead: any, email: string): string {
  const s = emailedSet(lead); s.add(email.toLowerCase());
  return JSON.stringify([...s].slice(-50));
}
// Next contact we have NOT emailed yet (primary first, then secondary/extras).
// How a freshly-added contact triggers a new round.
function nextUnemailedContact(lead: any): Contact | null {
  const done = emailedSet(lead);
  return contactList(lead).find((c) => c.email && !done.has(c.email.toLowerCase())) || null;
}
// The contact the current in-progress sequence is aimed at (matched by email).
function sequenceContact(lead: any): Contact | null {
  const list = contactList(lead);
  if (lead.outreachTo) return list.find((c) => c.email.toLowerCase() === String(lead.outreachTo).toLowerCase()) || { email: String(lead.outreachTo), name: "" };
  return list[0] || null;
}

export const outboundEnabled = () => process.env.AGENT_OUTBOUND_ENABLED === "true";
const autoSend = () => process.env.AGENT_OUTBOUND_AUTOSEND === "true";
const perRunLimit = () => parseInt(process.env.AGENT_OUTBOUND_LIMIT || "20", 10);
// Per-lead web research on the intro (Claude web search). OFF by default (Benjy
// decided against the ~$0.10/lead research cost). Set AGENT_OUTBOUND_RESEARCH=true
// to turn it back on. Without it, intros still personalize from the lead's own
// data (company, market, notes) in the house voice — just no web-sourced specifics.
const research = () => process.env.AGENT_OUTBOUND_RESEARCH === "true";
// Optional hold-until date (YYYY-MM-DD, UTC). Lets us arm the agent now but keep
// it from sending until a chosen day, e.g. skip the July 4th holiday window.
// Gates SENDING only — replies/bounces are still processed so live threads work.
function beforeStart(): boolean {
  const s = process.env.AGENT_OUTBOUND_START;
  if (!s) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !isNaN(d.getTime()) && new Date() < d;
}

// Sequence per contact: intro, then (+3d) follow-up #1, then (+7d) follow-up #2, done.
const FOLLOWUPS: Record<string, { next: string; days: number }> = {
  intro_sent: { next: "followup_1", days: 7 },
  followup_1: { next: "done", days: 0 },
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
      <p>I'm ${owner.first} with C&amp;D Printing &amp; Packaging, a family-owned folding carton manufacturer in St. Petersburg, Florida with about 50 years of history behind it. Our family and a team of 50-plus make folding cartons, custom boxes, and retail packaging for cosmetics, skincare, nutraceutical, and other consumer brands.</p>
      <p>I came across ${informalCompany(lead.companyName)} and thought we could be a good fit. What sets us apart is that working with us means working with our family directly. Would you be open to a quick call, or an in-person visit if you are nearby?</p>
      <p>Best,<br>${owner.first}</p>`),
  };
  const claude = getClaude();
  if (!claude) return fallback;
  try {
    const system = `You write warm, personal cold-intro emails for C&D Printing & Packaging, in the voice of the Waxman family that owns it. C&D is a family-owned folding carton and packaging manufacturer in St. Petersburg, Florida with roughly 50 years of history (folding cartons, custom boxes, retail and printed packaging), with a team of 50-plus, serving cosmetics, skincare, nutraceutical, health-and-wellness, and other consumer brands and contract manufacturers. IMPORTANT accuracy note: C&D the company is about 50 years old, but the Waxman family acquired it in 2025 and runs it hands-on now. Describe C&D as a 50-year-old company that is now family-owned. Do NOT claim the family has run or owned C&D for 50 years, and do NOT call it "multi-generation." ${owner.first === "Jessica"
    ? `You are writing AS Jessica Waxman (first name Jessica), on C&D's sales team at the St. Petersburg plant. Speak as part of the team at a family-owned company ("our family-owned shop", "you'd work directly with our owners and our team"), but do NOT claim to be one of the owners.`
    : `You are writing AS ${owner.full} (first name ${owner.first}), part of the Waxman family that owns C&D.`}

Model the tone on our best-performing emails:
- Warm, personal, human. Never salesy or templated.
- Open with something specific and genuine about THEIR company (their market, what they make, their family or story if evident) and tie it to C&D being a family-owned manufacturer.
- Lean on being local when it fits (St. Petersburg, Tampa, Orlando, "neighbors", "a short drive away", "an hour from you").
- Emphasize that working with C&D means working directly with the family (and a 50-plus person team).
- Soft call to action: offer a quick call or an in-person visit, and invite a reply.
- A few short paragraphs.

${owner.first === "Jessica"
    ? `You (Jessica) are based at the plant in St. Petersburg, Florida.`
    : `You (${owner.first}) are based in Miami (Brickell); C&D's manufacturing plant is in St. Petersburg, Florida.`} Use the prospect's location (given below, or from the notes) to pick the RIGHT geography hook, and never claim to be local when you are not:
- Prospect in South Florida (Miami, Fort Lauderdale, West Palm): ${owner.first === "Jessica" ? `mention the owners are in Miami and would gladly meet in person.` : `say you are local to them in Miami and could easily meet in person.`}
- Prospect near Tampa, St. Petersburg, or Orlando: note the plant is a short drive and you would be glad to visit.
- Prospect elsewhere in Florida: mention you are a fellow Florida company, same state, easy to work with in person or by phone.
- Prospect in Georgia or another state (i.e. NOT Florida): do NOT imply you are local or nearby. Instead lean on being a Southeast manufacturer that already works with brands across the region and ships nationwide, and offer a call or to send samples. For Georgia specifically you may note you are just down in Florida, a straightforward regional partner, but never say "local" or "neighbors."
- If you genuinely cannot tell where they are, keep geography light and do not guess.

Research the prospect first using web search: what they make, where they are based, their notable products or brands, and anything genuinely current. Weave in one or two specific, accurate details you find (for example the kinds of products they package). Use only facts you actually verify. Never guess or fabricate a product, location, or person.

Rules: address the contact by FIRST name (a real human name - if the provided name is a role word like Info or Sales, something has gone wrong: do not write the email). Plain personal email: NO bold, NO <strong>/<b>, NO em dashes or en dashes (use commas or periods), no emoji, no exclamation points, no hype. Sign off with just the first name (${owner.first}). Personalize from the company name, market, website, and notes provided, and from what you genuinely know about the company, but NEVER invent specific facts (do not make up product names, locations, or people you are unsure of).

Output format: the FIRST line must be "SUBJECT: " then a short, warm, specific subject (in the spirit of "Family-built packaging, right here in St. Pete and Orlando"). Then a blank line, then ONLY the inner HTML email body using <p> and <br> only.`;
    const loc = [lead.city, lead.state].filter(Boolean).join(", ") || "unknown (see notes)";
    const user = `Prospect company: ${informalCompany(lead.companyName)}. Location: ${loc}. Market: ${lead.endMarket || lead.productCategory || "unknown"}. Website: ${lead.website || "n/a"}. Contact first name: ${contact}. Notes: ${(lead.commentary || "").slice(0, 600)}. Write the subject and intro email now.`;
    const req: any = { model: "claude-opus-4-8", max_tokens: 2500, system, messages: [{ role: "user", content: user }] };
    if (research()) req.tools = [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]; // newer variant (dynamic filtering) for Opus 4.8 — more token-efficient
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
  // Sequences Jessica took over from a colleague say so plainly ("picking this
  // up for Albert") instead of pretending "my note below" (Benjy 7/15).
  const handoff = lead.outreachHandoff && lead.outreachHandoff !== owner.first ? lead.outreachHandoff : null;
  const msg = step === "intro_sent"
    ? (handoff
        ? `${owner.first} here with C&D, picking this up for ${handoff}. Just wanted to circle back on his note about packaging for ${informalCompany(lead.companyName)}. Happy to send over a few samples or hop on a quick call if useful.`
        : `Just following up on my note below about packaging for ${informalCompany(lead.companyName)}. Happy to send over a few samples or hop on a quick call if useful.`)
    : (handoff
        ? `${owner.first} here with C&D, picking up for ${handoff}. Last note from us for now - if custom packaging is ever on the radar for ${informalCompany(lead.companyName)}, we would love the chance to help, just reply anytime.`
        : `Last note from me for now. If custom packaging is ever on the radar for ${informalCompany(lead.companyName)}, we would love the chance to help, just reply anytime.`);
  return wrap(`<p>Hi ${contact},</p><p>${msg}</p><p>Best,<br>${owner.first}</p>`);
}

// ── Sending (threaded, from the owner's mailbox) ───────────────────────────
async function outboundSend(prisma: any, lead: any, owner: Owner, to: string, toName: string, subject: string, body: string): Promise<boolean> {
  const subj = noEmDash(subject);
  const html = stripBold(noEmDash(body)) + SIGNATURE;
  // Review mode: redirect the draft to the owner's own inbox so they can see it.
  if (!autoSend()) {
    await sendEmail({ from: owner.email, to: owner.email, subject: `[DRAFT → ${to}] ${subj}`, body: html + `<p style="color:#bbb;font-size:11px;">[Outbound review mode — in production this would send to ${toName || lead.companyName} &lt;${to}&gt; from ${owner.full}.]</p>` });
    return false; // not actually sent to the prospect; state not advanced
  }
  const bcc = bccFor(owner);
  if (lead.outreachConvId) {
    const r = await replyInConversation({ from: owner.email, conversationId: lead.outreachConvId, to, bcc, body: html });
    if (r.success) return true;
  }
  const r = await sendEmailGetConversation({ from: owner.email, to, bcc, subject: subj, body: html });
  if (r.conversationId) { try { await prisma.lead.update({ where: { id: lead.id }, data: { outreachConvId: r.conversationId } }); } catch { /* ignore */ } }
  return !!r.success;
}

// Generic email providers — a shared domain here does NOT mean same company.
const GENERIC_DOMAINS = new Set(["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "aol.com", "icloud.com", "me.com", "live.com", "msn.com", "comcast.net", "att.net", "verizon.net", "protonmail.com"]);

// True if we're already engaged with this company via a Qualified prospect or an
// existing Customer (usually a duplicate import row) — so a cold intro would be
// embarrassing. Matches by exact company name or business email domain. Benjy 7/9.
async function alreadyEngaged(prisma: any, lead: any, email: string): Promise<boolean> {
  const d = (email || "").toLowerCase().split("@")[1] || "";
  const bizDomain = d && !GENERIC_DOMAINS.has(d) ? d : null;
  const or: any[] = [{ companyName: { equals: lead.companyName, mode: "insensitive" } }];
  if (bizDomain) or.push({ contactEmail: { endsWith: `@${bizDomain}`, mode: "insensitive" } });
  const hit = await prisma.lead.findFirst({
    where: { id: { not: lead.id }, pipelineStage: { in: ["QUALIFIED", "CUSTOMER"] }, OR: or },
    select: { id: true },
  });
  return !!hit;
}

// ── The sweep ──────────────────────────────────────────────────────────────
export async function processOutbound(prisma: any): Promise<{ intros: number; followups: number; previews: number }> {
  if (!outboundEnabled()) return { intros: 0, followups: 0, previews: 0 };
  if (beforeStart()) return { intros: 0, followups: 0, previews: 0 }; // armed, but holding until AGENT_OUTBOUND_START
  if (isWeekendET()) return { intros: 0, followups: 0, previews: 0 }; // no cold email on Sat/Sun
  const now = new Date();
  const limit = perRunLimit();
  let sends = 0, intros = 0, followups = 0, previews = 0;

  // Follow-ups first (existing conversations), only when actually sending.
  let jessicaSends = 0; // ramp guard: TOTAL sends from the brand-new jwaxman mailbox per run
  if (autoSend()) {
    const due = await prisma.lead.findMany({
      where: { pipelineStage: "LEAD", agentHold: false, source: "prospecting", outreachNextAt: { not: null, lte: now }, outreachStatus: { in: ["intro_sent", "followup_1"] } },
      take: limit,
    });
    for (const l of due) {
      if (sends >= limit) break;
      const contact = sequenceContact(l);
      if (!contact) continue;
      if (!hasRealName(contact.name)) { // slipped through before the name gate existed
        await prisma.lead.update({ where: { id: l.id }, data: { outreachStatus: "needs_name", outreachNextAt: null, outreachLog: logLine(l.outreachLog, "No real contact name - follow-ups stopped") } });
        continue;
      }
      // Follow-ups come from WHOEVER SENT THE INTRO (outreachMailbox), never the
      // current default — so a mid-sequence thread can't flip Albert→Jessica
      // when ownership or defaults change (Benjy 7/13, the VEI case).
      const owner = ownerByEmail(l.outreachMailbox) || resolveOwner(l.ownerName);
      const step = FOLLOWUPS[l.outreachStatus as string];
      if (!step) continue;
      if (owner.email === OWNERS_MAP.jessica.email) {
        if (jessicaSends >= jessicaPerRunCap()) continue; // stays due — goes next run
        jessicaSends++;
      }
      try {
        const ok = await outboundSend(prisma, l, owner, contact.email, contact.name, `Re: C&D Printing & Packaging - ${informalCompany(l.companyName)}`, draftFollowup(l, owner, l.outreachStatus, contact.name));
        if (ok) {
          await appendNote(prisma, l.id, `Follow-up sent to ${contact.name || contact.email}`);
          if (step.next === "done") {
            // This contact's sequence is done with no reply. If there's another
            // contact we haven't emailed yet (e.g. one just added), reset so the
            // intro pass starts a fresh sequence to THEM; otherwise close out.
            if (nextUnemailedContact(l)) {
              await prisma.lead.update({ where: { id: l.id }, data: { outreachStatus: null, outreachTo: null, outreachConvId: null, outreachMailbox: null, outreachNextAt: null, outreachLog: logLine(l.outreachLog, "No reply, moving to next contact") } });
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

  // New intros — leads that are un-started OR finished-with-no-reply but now have
  // a contact we haven't emailed yet (e.g. one you just added). Replied /
  // not-interested / unsubscribed leads are intentionally left alone.
  const fresh = await prisma.lead.findMany({
    where: { pipelineStage: "LEAD", agentHold: false, source: "prospecting", OR: [{ outreachStatus: null }, { outreachStatus: "done" }, { outreachStatus: "bounced" }] },
    orderBy: { createdAt: "asc" }, take: limit * 3,
  });
  for (const l of fresh) {
    if (sends >= limit) break;
    const contact = nextUnemailedContact(l); // the first person on this lead we haven't emailed
    if (!contact) continue; // nothing new to reach out to here
    if (checkBlocked({ name: contact.name, email: contact.email, phone: l.contactPhone, company: l.companyName })) continue;
    // No real person's name -> NO email (Benjy 7/14, "Hi Info"). Flag for a name.
    if (!hasRealName(contact.name)) {
      await prisma.lead.update({ where: { id: l.id }, data: { outreachStatus: "needs_name", outreachNextAt: null, outreachLog: logLine(l.outreachLog, `No real contact name for ${contact.email} - not emailed`) } });
      await appendNote(prisma, l.id, `Not emailed - no real contact name (only "${(contact.name || "blank").slice(0, 40)}"). Add a person's name and clear the Outreach status to send.`);
      continue;
    }
    // Never cold-email a company we're ALREADY engaged with — a qualified prospect
    // or existing customer (often a duplicate row from an import). Match by exact
    // company name or business email domain. Benjy 7/9.
    if (await alreadyEngaged(prisma, l, contact.email)) {
      await prisma.lead.update({ where: { id: l.id }, data: { agentHold: true, outreachLog: logLine(l.outreachLog, "Skipped - company already a qualified prospect/customer") } });
      continue;
    }
    const owner = resolveOwner(l.ownerName);
    // Jessica taking an Albert-owned prospect → say so in the intro.
    if (NO_AGENT_SEND.has((l.ownerName || "").trim().toLowerCase()) && !l.outreachHandoff) {
      try { await prisma.lead.update({ where: { id: l.id }, data: { outreachHandoff: "Albert" } }); l.outreachHandoff = "Albert"; } catch { /* non-fatal */ }
    }
    // Warm up Jessica's fresh mailbox slowly — leave the rest for tomorrow's run.
    if (owner.email === OWNERS_MAP.jessica.email) {
      if (jessicaSends >= jessicaPerRunCap()) continue;
      jessicaSends++;
    }
    try {
      const draft = await draftIntro(l, owner, contact.name);
      l.outreachConvId = null; // an intro always opens a fresh thread for this person
      const sent = await outboundSend(prisma, l, owner, contact.email, contact.name, draft.subject, draft.body);
      if (sent) {
        await prisma.lead.update({ where: { id: l.id }, data: { outreachStatus: "intro_sent", outreachTo: contact.email, outreachMailbox: owner.email, outreachEmailed: withEmailed(l, contact.email), outreachNextAt: addDays(now, 3), outreachLog: logLine(l.outreachLog, `Intro sent to ${contact.name || contact.email}`) } });
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
