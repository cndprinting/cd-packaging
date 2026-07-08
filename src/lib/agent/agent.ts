import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/email/graph-client";

// AI sales-agent chase engine (Benjy 6/26). A status machine on the Lead with
// a clock — nothing sits silent. Customer-facing QUOTE sends are gated behind
// owner approval (spec: watch the first ~10-15); follow-ups auto-send once a
// quote is out. The smart layer (Claude classify / house-style draft) plugs in
// later behind ANTHROPIC_API_KEY — for now drafts are clean templates.

export const MARY = "mbitting@cndprinting.com";
export const OWNERS = ["bwaxman@cndprinting.com", "nlaor@cndprinting.com", "awaxman@cndprinting.com"];
// Customer-facing identity: the agent sends AS Albert (sales manager) and reads
// his mailbox for replies, so what the customer sees matches the lead owner.
export const SENDER = "awaxman@cndprinting.com";
export const SIGNOFF = "Albert Waxman"; // closing name; the signature card below is appended automatically
// Company signature block appended to every customer-facing email. Matches
// Benjy's real Outlook signature: logo, company, address, office line, and the
// "C&D Printing Website" link, in gray (#333). Logo is hosted at the app root
// (public/cd-logo.png) so it renders without a per-email attachment.
export const SIGNATURE = `<div style="font-family:Arial,Helvetica,sans-serif;color:#333333;font-size:13px;line-height:1.5;margin-top:18px;"><img src="https://packaging.cndprinting.com/cd-logo.png" alt="C&amp;D Printing &amp; Packaging" width="200" height="75" style="display:block;border:0;margin-bottom:8px;"><span style="color:#333333;">C&amp;D Printing &amp; Packaging</span><br>12150 28th Street North, St. Petersburg, FL 33716<br>Office (727) 572-9999<br><a href="http://www.cndprinting.com/" style="color:#333333;">C&amp;D Printing Website</a></div>`;
const BASE = "https://packaging.cndprinting.com";

// Master switch — the agent only chases when AGENT_ENABLED=true, so intake can
// run (leak fixed) while the owners watch before turning the emails on.
export const agentEnabled = () => process.env.AGENT_ENABLED === "true";
// Small routine orders auto-send by default (Mary still prices them — the agent
// just sends without owner approval). Set AGENT_REVIEW_ALL=true to pause that
// and route everything to the owners (training wheels).
const reviewAll = () => process.env.AGENT_REVIEW_ALL === "true";
// Quotes at/above this dollar amount always get owner review before sending.
const QUOTE_REVIEW_THRESHOLD = 5000;
// Pull the order value out of Mary's free-text quote (largest $ figure wins).
function quoteAmount(q: string): number {
  const nums = (q.match(/\$\s?[\d,]+(?:\.\d{1,2})?/g) || []).map((s) => parseFloat(s.replace(/[^0-9.]/g, ""))).filter((n) => !isNaN(n));
  return nums.length ? Math.max(...nums) : 0;
}

const newToken = () => randomBytes(16).toString("hex");
// Greet customers by first name only (full name reads stiff/automated).
const firstName = (n?: string | null) => (n || "").trim().split(/\s+/)[0] || "there";
const link = (id: string, token: string, action: string) => `${BASE}/agent?id=${id}&token=${token}&do=${action}`;

// Business-day clock — skips weekends.
function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); const dow = d.getUTCDay(); if (dow !== 0 && dow !== 6) added++; }
  return d;
}
const addHours = (from: Date, h: number) => new Date(from.getTime() + h * 3600 * 1000);
function logLine(prev: string | null, event: string): string {
  let arr: any[] = [];
  try { arr = prev ? JSON.parse(prev) : []; } catch { /* reset */ }
  arr.push({ at: new Date().toISOString(), event });
  return JSON.stringify(arr.slice(-50));
}

const wrap = (inner: string) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;">${inner}</div>`;

// All agent email goes through here. AGENT_TEST_TO redirects every message to
// one inbox (the owner running the test) so a dry run never reaches Mary or a
// real customer (Benjy 6/26).
// Strip em/en dashes from anything customer-facing — they read as an AI tell.
// Replaces the dash (and its HTML entities) with a normal spaced hyphen.
export function noEmDash(s: string): string {
  return (s || "")
    .replace(/&mdash;|&#8212;|&#x2014;|&ndash;|&#8211;|&#x2013;/gi, "—")
    .replace(/\s*[—–]\s*/g, " - ");
}

export async function agentSend(opts: { to: string | string[]; cc?: string | string[]; subject: string; body: string }) {
  const subject = noEmDash(opts.subject);
  const body = noEmDash(opts.body);
  const test = process.env.AGENT_TEST_TO;
  if (test) {
    // AGENT_TEST_TO may be a comma-separated list so several owners can watch a dry run.
    const testTo = test.split(",").map((s) => s.trim()).filter(Boolean);
    const realTo = (Array.isArray(opts.to) ? opts.to.join(", ") : opts.to) + (opts.cc ? `, cc ${Array.isArray(opts.cc) ? opts.cc.join(", ") : opts.cc}` : "");
    return sendEmail({ from: SENDER, to: testTo, subject: `[TEST] ${subject}`, body: body + `<p style="color:#bbb;font-size:11px;">[Test mode - in production this would go to: ${realTo}]</p>` });
  }
  return sendEmail({ from: SENDER, to: opts.to, cc: opts.cc, subject, body });
}
const btn = (href: string, label: string) => `<a href="${href}" style="display:inline-block;background:#27AAE1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;">${label}</a>`;

// One stable subject per customer so all their emails group into one thread.
export const customerSubject = (lead: any) => `Your quote from C&D Printing - ${lead.companyName}`;

// All customer-facing email goes through here so it threads into ONE conversation.
// First email starts the thread (and we store its conversationId); the rest reply
// into it. Test mode falls back to the redirected dry-run send.
export async function agentCustomerSend(prisma: any, lead: any, opts: { subject?: string; body: string; copyAttachmentsFrom?: string }): Promise<void> {
  if (!lead.contactEmail) return;
  const subject = noEmDash(opts.subject || customerSubject(lead));
  const body = noEmDash(opts.body) + SIGNATURE;
  if (process.env.AGENT_TEST_TO) { await agentSend({ to: lead.contactEmail, cc: OWNERS, subject, body }); return; }
  const { sendEmailGetConversation, replyInConversation } = await import("@/lib/email/graph-client");
  if (lead.agentConvId) {
    const r = await replyInConversation({ from: SENDER, conversationId: lead.agentConvId, to: lead.contactEmail, cc: OWNERS, body, copyAttachmentsFrom: opts.copyAttachmentsFrom });
    if (r.success) return; // threaded
  }
  const r = await sendEmailGetConversation({ from: SENDER, to: lead.contactEmail, cc: OWNERS, subject, body, copyAttachmentsFrom: opts.copyAttachmentsFrom });
  if (r.conversationId) { try { await prisma.lead.update({ where: { id: lead.id }, data: { agentConvId: r.conversationId } }); } catch { /* ignore */ } }
}

// All email to Mary for a given lead threads into ONE conversation: the first
// "Quote needed" starts it; reminders and forwarded customer info reply into it
// (carrying any attachments). Test mode falls back to the redirected send.
export async function agentMarySend(prisma: any, lead: any, opts: { subject?: string; body: string; copyAttachmentsFrom?: string }): Promise<void> {
  const subject = noEmDash(opts.subject || `Quote needed: ${lead.companyName}`);
  const body = noEmDash(opts.body);
  if (process.env.AGENT_TEST_TO) { await agentSend({ to: MARY, cc: OWNERS, subject, body }); return; }
  const { sendEmailGetConversation, replyInConversation } = await import("@/lib/email/graph-client");
  if (lead.agentMaryConvId) {
    const r = await replyInConversation({ from: SENDER, conversationId: lead.agentMaryConvId, to: MARY, cc: OWNERS, body, copyAttachmentsFrom: opts.copyAttachmentsFrom });
    if (r.success) return;
  }
  const r = await sendEmailGetConversation({ from: SENDER, to: MARY, cc: OWNERS, subject, body });
  if (r.conversationId) { try { await prisma.lead.update({ where: { id: lead.id }, data: { agentMaryConvId: r.conversationId } }); } catch { /* ignore */ } }
}

// Shared duplicate guard (Benjy 7/2, expanded 7/7). If another active lead for
// this same company/contact is already in progress in the last 30 days — with
// Mary OR awaiting the customer — compare the two briefs; if it's the same job,
// drop this one to Lost as a duplicate and return true. Covers BOTH the Mary
// handoff and the ask-customer path, so a resubmission (one with specs, one
// without) never creates two active leads.
export async function dropIfDuplicate(prisma: any, lead: any): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const orMatch: any[] = [{ companyName: { equals: lead.companyName, mode: "insensitive" } }];
    if (lead.contactEmail) orMatch.push({ contactEmail: { equals: lead.contactEmail, mode: "insensitive" } });
    const dup = await prisma.lead.findFirst({
      where: { id: { not: lead.id }, agentStatus: { in: ["awaiting_mary", "quote_received", "awaiting_customer_info", "info_nudge_1"] }, createdAt: { gte: cutoff }, OR: orMatch },
      select: { id: true, companyName: true, agentStatus: true, commentary: true },
    });
    if (!dup) return false;
    let verdict: { duplicate: boolean; reason: string } | null = null;
    try {
      const { isDuplicateQuote } = await import("@/lib/agent/claude");
      verdict = await isDuplicateQuote({ a: dup.commentary || "", b: lead.commentary || "" });
    } catch { /* fall through → treat as separate */ }
    if (verdict && verdict.duplicate) {
      const note = `${lead.commentary || ""}\n\n[Agent] Duplicate of an active lead already in progress for ${lead.companyName} - dropped. ${verdict.reason || ""}`.slice(0, 4000);
      await prisma.lead.update({ where: { id: lead.id }, data: { agentStatus: "duplicate", agentNextAt: null, pipelineStage: "LOST", stage: "Duplicate", commentary: note, agentLog: logLine(lead.agentLog, `Auto-detected duplicate of ${dup.agentStatus}. ${verdict.reason || ""}`) } });
      return true;
    }
  } catch { /* dedup check failed → behave as before */ }
  return false;
}

// ── Step 1: hand a new lead to Mary ────────────────────────────────────────
export async function kickoffAgent(prisma: any, lead: any): Promise<void> {
  if (!agentEnabled()) return;
  if (await dropIfDuplicate(prisma, lead)) return;

  const token = lead.agentToken || newToken();
  const body = wrap(`
    <p>Hi Mary,</p>
    <p>Can you put a quote together for this one when you get a chance? Everything we have is below. Just reply to me with your price and terms, or let me know if you need anything else, and I'll take it from there.</p>
    <p><strong>${lead.companyName}</strong>${lead.contactName ? ` · ${lead.contactName}` : ""}${lead.contactEmail ? ` · ${lead.contactEmail}` : ""}${lead.contactPhone ? ` · ${lead.contactPhone}` : ""}</p>
    <pre style="white-space:pre-wrap;background:#f7f7f7;border-radius:6px;padding:12px;font-family:inherit;">${(lead.commentary || "").replace(/</g, "&lt;")}</pre>
    <p>Thanks,<br>Albert</p>`);
  await agentMarySend(prisma, lead, { body });
  await prisma.lead.update({
    where: { id: lead.id },
    data: { agentStatus: "awaiting_mary", agentToken: token, agentNextAt: addHours(new Date(), 24), stage: "Awaiting Mary", agentLog: logLine(lead.agentLog, "Sent to Mary for quote") },
  });
}

// ── Step 0 (when specs are missing): ask the CUSTOMER first ────────────────
// Instead of handing Mary an assumption-heavy brief, the agent emails the lead
// the missing-spec questions, waits for their reply (caught by the inbox loop),
// then hands Mary a complete brief. Falls back to house defaults + Mary if the
// customer goes quiet (see processDueAgentLeads). Benjy 6/28.
export async function askCustomer(prisma: any, lead: any, missing: string[]): Promise<void> {
  if (!agentEnabled()) return;
  if (await dropIfDuplicate(prisma, lead)) return; // resubmission where this copy is missing specs
  const token = lead.agentToken || newToken();
  if (!lead.contactEmail) { await kickoffAgent(prisma, { ...lead, agentToken: token }); return; } // can't ask → Mary with defaults
  let inner: string | null = null;
  try {
    const { draftClarifyEmail } = await import("@/lib/agent/claude");
    inner = await draftClarifyEmail({ contactName: lead.contactName, productName: lead.productName, missing });
  } catch { /* fall back */ }
  const body = inner ? wrap(inner) : wrap(`
    <p>Hi ${firstName(lead.contactName)},</p>
    <p>Thank you for reaching out to C&amp;D Printing. To put together an accurate quote for your ${lead.productName || "project"}, could you share a few details:</p>
    <ul>${missing.map((m) => `<li>${m.replace(/</g, "&lt;")}</li>`).join("")}</ul>
    <p>If you're not sure on any of these, just say so and we'll recommend what works best. Once we have these we'll turn a quote around quickly.</p>
    <p>Best regards,<br>${SIGNOFF}</p>`);
  await agentCustomerSend(prisma, lead, { body });
  await prisma.lead.update({
    where: { id: lead.id },
    data: { agentStatus: "awaiting_customer_info", agentToken: token, agentNextAt: addBusinessDays(new Date(), 2), stage: "Awaiting customer info", agentLog: logLine(lead.agentLog, "Asked customer for missing specs") },
  });
}

// ── Corrugated request → propose a folding carton (we don't do corrugated) ──
// C&D makes folding cartons, not corrugated. Instead of quoting something we
// can't produce, the agent proposes a heavier folding carton and asks if that
// works. If the customer says yes, their reply loops back into the quote flow
// (now tagged Folding Carton). Benjy 7/7.
export async function suggestFoldingCarton(prisma: any, lead: any): Promise<void> {
  if (!agentEnabled()) return;
  if (await dropIfDuplicate(prisma, lead)) return;
  const token = lead.agentToken || newToken();
  if (!lead.contactEmail) { await kickoffAgent(prisma, { ...lead, agentToken: token }); return; }
  const body = wrap(`
    <p>Hi ${firstName(lead.contactName)},</p>
    <p>Thank you for reaching out to C&amp;D Printing about your ${lead.productName || lead.productCategory || "project"}. One quick note: we specialize in folding cartons rather than corrugated. For a lot of projects, a heavier folding carton board gives you a sturdy box that works well in place of corrugated.</p>
    <p>Would a heavier folding carton work for you, or do you specifically need corrugated? If a folding carton works, we'll put a quote together right away.</p>
    <p>Best regards,<br>${SIGNOFF}</p>`);
  await agentCustomerSend(prisma, lead, { body });
  await prisma.lead.update({
    where: { id: lead.id },
    data: { agentStatus: "awaiting_customer_info", agentToken: token, productCategory: "Folding Carton", stage: "Proposed folding carton (no corrugated)", agentNextAt: addBusinessDays(new Date(), 3), commentary: `${lead.commentary || ""}\n\n[Agent] Customer asked for corrugated (we don't do corrugated). Proposed a heavier folding carton and asked if that works.`.slice(0, 4000), agentLog: logLine(lead.agentLog, "Proposed folding carton alternative (no corrugated)") },
  });
}

// ── MailerCity (direct-mail) lane ───────────────────────────────────────────
// Leads from the marketing.cndprinting.com (MailerCity) landing page. Pricing is
// self-service on the site, so the agent does NOT quote and Mary is NEVER
// involved — it qualifies (postcards vs letters, 1/2 sheet, quantity, address
// list for cleansing, artwork) and hands the answers to the owners. Sends as
// Albert. Benjy 7/8.
const MAILERCITY_SUBJECT = "Your direct mail with C&D (MailerCity)";

export async function kickoffMailerCity(prisma: any, lead: any): Promise<void> {
  if (!agentEnabled() || !lead.contactEmail) return;
  const token = lead.agentToken || newToken();
  // Acknowledge the specific template they sampled, if the landing page gave us one.
  const template = (String(lead.commentary || "").match(/Template:\s*(.+?)\s*(?:\(|\n|$)/i) || [])[1]?.trim();
  const intro = template
    ? `Thanks so much for requesting a sample of our ${template} mailer! We'll get that out to you.`
    : `Thanks so much for reaching out to C&amp;D about direct mail!`;
  const body = wrap(`
    <p>Hi ${firstName(lead.contactName)},</p>
    <p>${intro} When you're ready to run a campaign, a few quick things so we can set it up for you:</p>
    <ul>
      <li>Roughly how many pieces are you looking to mail?</li>
      <li>Do you already have your mailing list, or would you like us to pull one for a specific area / counties?</li>
      <li>Any timeline you're working toward?</li>
    </ul>
    <p>Our per-piece pricing by quantity is right on our site (<a href="https://marketing.cndprinting.com/">marketing.cndprinting.com</a>), and we handle the list cleansing (NCOA/CASS) on our end. Happy to answer any questions on pricing or the process too.</p>
    <p>Best regards,<br>${SIGNOFF}</p>`);
  await agentCustomerSend(prisma, lead, { subject: MAILERCITY_SUBJECT, body });
  await prisma.lead.update({
    where: { id: lead.id },
    data: { agentStatus: "mailercity_qualifying", agentToken: token, stage: "MailerCity - qualifying", agentNextAt: addBusinessDays(new Date(), 3), agentLog: logLine(lead.agentLog, "MailerCity lead - sent qualifying questions") },
  });
}

// Customer answered the MailerCity questions → capture and hand to the owners
// (you, Nitay, Albert). The agent does not run the campaign; the owners take it.
export async function onMailerCityReply(prisma: any, lead: any, reply: string): Promise<void> {
  const commentary = `${lead.commentary || ""}\n\n[Customer reply] ${reply}`.slice(0, 4000);
  await prisma.lead.update({ where: { id: lead.id }, data: { agentStatus: "mailercity_handoff", stage: "MailerCity - qualified, owners handling", agentNextAt: null, commentary } });
  await agentSend({ to: OWNERS, subject: `MailerCity lead ready: ${lead.companyName || lead.contactName}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;"><p><strong>${lead.companyName || lead.contactName}</strong>${lead.contactEmail ? ` · ${lead.contactEmail}` : ""}${lead.contactPhone ? ` · ${lead.contactPhone}` : ""} replied with their direct-mail details - over to you:</p><blockquote style="color:#555;border-left:3px solid #ddd;padding-left:10px;">${(reply || "").slice(0, 800).replace(/</g, "&lt;")}</blockquote><p>Full context is on the lead in the pipeline.</p></div>` });
}

// ── Always ask for artwork when it's missing — but never block the quote ────
// Artwork clarifies colors, bleeds, finish and the actual look, so we request
// it on every lead that didn't include it. When the specs are otherwise
// complete, Mary quotes in parallel; this is just a side ask (Benjy 6/29).
export async function requestArtwork(prisma: any, lead: any): Promise<void> {
  if (!agentEnabled() || !lead.contactEmail) return;
  const body = wrap(`
    <p>Hi ${firstName(lead.contactName)},</p>
    <p>While we put your quote together, could you send over your print-ready artwork, or even a rough proof or mockup? It helps us confirm the exact look and details (colors, bleeds, finish) so the final piece comes out right.</p>
    <p>If it isn't ready yet, no problem, just let us know and we can recommend specs in the meantime.</p>
    <p>Best regards,<br>${SIGNOFF}</p>`);
  await agentCustomerSend(prisma, lead, { body });
  await prisma.lead.update({ where: { id: lead.id }, data: { agentLog: logLine(lead.agentLog, "Requested artwork from customer") } });
}

// ── Mary submits her quote → notify owners to approve (or auto-send) ────────
export async function onMaryQuote(prisma: any, lead: any, quote: string): Promise<void> {
  await prisma.lead.update({
    where: { id: lead.id },
    data: { agentQuote: quote, agentStatus: "quote_received", stage: "Quote received", agentNextAt: addBusinessDays(new Date(), 1), agentLog: logLine(lead.agentLog, "Quote received from Mary") },
  });
  // Small routine orders go out fully autonomously (Benjy 6/28). Gate only when:
  // a flagged major client (priority 1), OR the order is >= the review threshold,
  // OR we can't read a dollar amount (play it safe), OR review-all is on.
  const amount = quoteAmount(quote);
  const vip = lead.priority === 1;
  const small = amount > 0 && amount < QUOTE_REVIEW_THRESHOLD;
  const mustGate = reviewAll() || vip || !small;
  if (!mustGate) { await sendCustomerQuote(prisma, { ...lead, agentQuote: quote }); return; }

  const banner = vip
    ? `<p style="background:#FEF3C7;border:1px solid #F59E0B;border-radius:6px;padding:10px;"><strong>⭐ Potential major client — review carefully before this goes out.</strong></p>`
    : "";
  const why = vip ? " (major client)" : (amount >= QUOTE_REVIEW_THRESHOLD ? ` (over $${QUOTE_REVIEW_THRESHOLD.toLocaleString()})` : "");
  const body = wrap(`${banner}
    <p>Mary quoted <strong>${lead.companyName}</strong>${why}. Review and send to the customer:</p>
    <pre style="white-space:pre-wrap;background:#f7f7f7;border-radius:6px;padding:12px;font-family:inherit;">${quote.replace(/</g, "&lt;")}</pre>
    <p>To: ${lead.contactName || "customer"} · ${lead.contactEmail || "(no email on file)"}</p>
    <p>${btn(link(lead.id, lead.agentToken, "approve"), "Approve &amp; send to customer")}</p>`);
  await agentSend({to: OWNERS, subject: `${vip ? "⭐ " : ""}Approve quote: ${lead.companyName}`, body });
}

// ── Send the quote to the customer → start the follow-up clock ─────────────
export async function sendCustomerQuote(prisma: any, lead: any): Promise<void> {
  if (lead.contactEmail) {
    // House-style draft via Claude when enabled; clean template otherwise.
    let inner: string | null = null;
    try {
      const { draftCustomerQuote } = await import("@/lib/agent/claude");
      inner = await draftCustomerQuote({ customerName: lead.companyName, contactName: lead.contactName, productName: lead.productName, quote: lead.agentQuote || "" });
    } catch { /* fall back */ }
    const body = inner ? wrap(inner) : wrap(`
      <p>Hi ${firstName(lead.contactName)},</p>
      <p>Thank you for reaching out to C&amp;D Printing. Here's your quote:</p>
      <pre style="white-space:pre-wrap;background:#f7f7f7;border-radius:6px;padding:12px;font-family:inherit;">${(lead.agentQuote || "").replace(/</g, "&lt;")}</pre>
      <p>Happy to adjust quantities or specs — just reply and we'll take care of it.</p>
      <p>Best regards,<br>${SIGNOFF}</p>`);
    await agentCustomerSend(prisma, lead, { body });
  }
  await prisma.lead.update({
    where: { id: lead.id },
    data: { agentStatus: "sent", stage: "Sent", agentNextAt: addBusinessDays(new Date(), 2), agentLog: logLine(lead.agentLog, lead.contactEmail ? "Quote sent to customer" : "Approved — no customer email, manual send") },
  });
}

// Forward Mary's quote PDF to the customer with a clean cover note (Albert's
// voice), threaded into the customer conversation. Used when Mary quotes via an
// attached file rather than typing a price. Benjy 6/29.
export async function sendQuotePdfToCustomer(prisma: any, lead: any): Promise<void> {
  const product = lead.productName || lead.productCategory || "project";
  // Read Mary's PDF and lay out a per-item pricing breakdown (house style); fall
  // back to a plain cover note if Claude/PDF read isn't available.
  let inner: string | null = null;
  try {
    if (lead.agentQuoteMsgId) {
      const { getFirstPdfAttachment } = await import("@/lib/email/graph-client");
      const pdf = await getFirstPdfAttachment(SENDER, lead.agentQuoteMsgId);
      if (pdf?.contentBytes) {
        const { draftQuoteBreakdown } = await import("@/lib/agent/claude");
        inner = await draftQuoteBreakdown({ pdfBase64: pdf.contentBytes, customerName: lead.companyName, contactName: lead.contactName, productName: product });
      }
    }
  } catch { /* fall back */ }
  const body = inner ? wrap(inner) : wrap(`
    <p>Hi ${firstName(lead.contactName)},</p>
    <p>Thank you for your patience. Please find our pricing for your ${product} attached.</p>
    <p>Happy to adjust quantities or specs, just reply and we'll take care of it. As a note on timing, our standard lead time is 2 to 3 weeks after payment and final approval, and we can prioritize when you have a deadline.</p>
    <p>Best regards,<br>${SIGNOFF}</p>`);
  await agentCustomerSend(prisma, lead, { body, copyAttachmentsFrom: lead.agentQuoteMsgId });
  await prisma.lead.update({ where: { id: lead.id }, data: { agentStatus: "sent", stage: "Sent", agentNextAt: addBusinessDays(new Date(), 2), agentLog: logLine(lead.agentLog, "Quote PDF sent to customer") } });
}

const FOLLOWUPS: Record<string, { next: string; days: number; msg: string }> = {
  sent: { next: "followup_1", days: 4, msg: "Just following up on the quote we sent — happy to answer any questions." },
  followup_1: { next: "followup_2", days: 5, msg: "Checking back — we can adjust the quantity or specs if that helps." },
  followup_2: { next: "followup_3", days: 0, msg: "We'll leave this open on our end — reach out anytime and we'll pick right back up." },
};

// ── Cron worker: act on every lead whose clock is due ──────────────────────
export async function processDueAgentLeads(prisma: any): Promise<{ acted: number }> {
  if (!agentEnabled()) return { acted: 0 };
  const now = new Date();
  const due = await prisma.lead.findMany({
    where: { agentNextAt: { not: null, lte: now }, agentStatus: { in: ["awaiting_customer_info", "info_nudge_1", "awaiting_mary", "quote_received", "sent", "followup_1", "followup_2"] } },
    take: 100,
  });
  let acted = 0;
  for (const l of due) {
    try {
      if (l.agentStatus === "awaiting_customer_info") {
        // Customer hasn't sent the details yet — nudge once.
        if (l.contactEmail) {
          await agentCustomerSend(prisma, l, { body: wrap(`<p>Hi ${firstName(l.contactName)},</p><p>Just circling back on the few details we need to quote your ${l.productName || "project"}. If anything's unclear, reply and we'll recommend what works, happy to help.</p><p>Best regards,<br>${SIGNOFF}</p>`) });
        }
        await prisma.lead.update({ where: { id: l.id }, data: { agentStatus: "info_nudge_1", agentNextAt: addBusinessDays(now, 2), agentLog: logLine(l.agentLog, "Nudged customer for missing specs") } });
      } else if (l.agentStatus === "info_nudge_1") {
        // Still silent — fall back to house defaults and hand Mary the brief.
        await prisma.lead.update({ where: { id: l.id }, data: { commentary: `${l.commentary || ""}\n\n[No customer response to spec questions — proceeding with house defaults.]`.trim(), agentLog: logLine(l.agentLog, "Customer silent — falling back to house defaults") } });
        const fresh = await prisma.lead.findUnique({ where: { id: l.id } });
        await kickoffAgent(prisma, fresh);
      } else if (l.agentStatus === "awaiting_mary") {
        // Chase Mary every ~24h until the quote is in. If she can't get to it
        // right away, ask for a timeline so we can set the customer's expectations.
        await agentMarySend(prisma, l, { body: wrap(`<p>Hi Mary,</p><p>Following up on the quote for <strong>${l.companyName}</strong>. If you can get it over today that's great. If not, can you let me know roughly when you'll have it so I can keep the customer in the loop? Thanks,<br>Albert</p>`) });
        await prisma.lead.update({ where: { id: l.id }, data: { agentNextAt: addHours(now, 24), agentLog: logLine(l.agentLog, "Nudged Mary for quote / timeline") } });
      } else if (l.agentStatus === "quote_received") {
        await agentSend({to: OWNERS, subject: `Reminder — approve quote: ${l.companyName}`, body: wrap(`<p>Quote for <strong>${l.companyName}</strong> is waiting to go out.</p><p>${btn(link(l.id, l.agentToken, "approve"), "Approve &amp; send")}</p>`) });
        await prisma.lead.update({ where: { id: l.id }, data: { agentNextAt: addBusinessDays(now, 1), agentLog: logLine(l.agentLog, "Nudged owners to approve") } });
      } else {
        const step = FOLLOWUPS[l.agentStatus as string];
        if (step) {
          if (l.contactEmail) {
            await agentCustomerSend(prisma, l, { body: wrap(`<p>Hi ${firstName(l.contactName)},</p><p>${step.msg}</p><p>Best regards,<br>${SIGNOFF}</p>`) });
          }
          const next = step.days > 0 ? addBusinessDays(now, step.days) : null;
          const status = step.days > 0 ? step.next : "closed";
          await prisma.lead.update({ where: { id: l.id }, data: { agentStatus: status, stage: status === "closed" ? "Closed (no response)" : "Sent", agentNextAt: next, pipelineStage: status === "closed" ? "LOST" : l.pipelineStage, agentLog: logLine(l.agentLog, `Sent ${l.agentStatus} follow-up`) } });
        }
      }
      acted++;
    } catch { /* skip this lead, continue */ }
  }
  return { acted };
}
