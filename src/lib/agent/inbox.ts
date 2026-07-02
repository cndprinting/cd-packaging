import { getGraphClient } from "@/lib/email/graph-client";
import { agentSend, agentMarySend, SENDER, OWNERS, MARY, onMaryQuote } from "@/lib/agent/agent";
import { getClaude } from "@/lib/agent/claude";

// Inbound reply handler (Benjy 6/26) — the second half of the lead↔agent
// conversation. Reads the agent mailbox, matches each unread message to the
// lead it's replying to, drafts a response with Claude, and routes it to the
// owners for one-click send. Needs Mail.ReadWrite (application) consent in
// Azure on top of the existing Mail.Send — until that's granted the read call
// throws and this no-ops.

const MAILBOX = SENDER; // bwaxman@cndprinting.com
const BASE = "https://packaging.cndprinting.com";

// Loose company match: Mary may title her quote "Mid-Pacific Flyer pricing"
// rather than the full lead name, so match on a distinctive word too.
const COMPANY_STOP = new Set(["club", "llc", "inc", "corp", "co", "the", "company", "ltd", "group", "and"]);
function companyMatches(name: string | null, subjectLc: string): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  if (subjectLc.includes(n)) return true;
  return n.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !COMPANY_STOP.has(w)).some((w) => subjectLc.includes(w));
}

export async function pollAgentInbox(prisma: any): Promise<{ checked: number; handled: number; error?: string }> {
  if (process.env.AGENT_ENABLED !== "true") return { checked: 0, handled: 0 };
  const client = getGraphClient();
  if (!client) return { checked: 0, handled: 0, error: "graph not configured" };

  let items: any[] = [];
  try {
    const res = await client
      .api(`/users/${MAILBOX}/mailFolders/Inbox/messages`)
      .filter("isRead eq false")
      .top(25)
      .select("id,subject,from,bodyPreview,receivedDateTime,hasAttachments,conversationId")
      .get();
    items = res.value || [];
  } catch (e) {
    console.error("[agent inbox] read failed — needs Mail.ReadWrite app permission", e);
    return { checked: 0, handled: 0, error: "mail read failed (Mail.ReadWrite not granted?)" };
  }

  let handled = 0;
  for (const m of items) {
    const from = m.from?.emailAddress?.address?.toLowerCase();
    if (!from) continue;

    // Mary replied to a "Quote needed" handoff with her price. Match it to the
    // awaiting-Mary lead by the company name in the subject, and treat her reply
    // as the quote. (She just emails Albert back — never sees the system.)
    if (from === MARY.toLowerCase()) {
      const conv = m.conversationId;
      const subjectLc = (m.subject || "").toLowerCase();
      // Match by conversation first — Mary may reply in her own thread OR in the
      // customer thread — then fall back to company name in the subject.
      let ml: any = conv ? await prisma.lead.findFirst({ where: { agentStatus: "awaiting_mary", OR: [{ agentMaryConvId: conv }, { agentConvId: conv }] }, orderBy: { updatedAt: "desc" } }) : null;
      if (!ml) {
        const open = await prisma.lead.findMany({ where: { agentStatus: "awaiting_mary" }, orderBy: { updatedAt: "desc" }, take: 50 });
        ml = open.find((l: any) => companyMatches(l.companyName, subjectLc)) || null;
      }
      if (!ml) continue; // unrelated Mary email — leave it untouched (and unread)
      try { await client.api(`/users/${MAILBOX}/messages/${m.id}`).patch({ isRead: true }); } catch { /* ignore */ }
      const preview = (m.bodyPreview || "").trim();

      // Mary quotes via an attached PDF → store it and route to the owners for
      // one-click approval to forward it (with a cover note) to the customer.
      if (m.hasAttachments) {
        await prisma.lead.update({ where: { id: ml.id }, data: { agentStatus: "quote_received", stage: "Quote received", agentQuoteMsgId: m.id, agentNextAt: new Date(Date.now() + 24 * 3600 * 1000) } });
        const link = `${BASE}/agent?id=${ml.id}&token=${ml.agentToken}&do=approve`;
        await agentSend({ to: OWNERS, subject: `Approve quote: ${ml.companyName}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Mary sent the quote for <strong>${ml.companyName}</strong> (attached to her email).</p>${preview ? `<blockquote style="color:#555;border-left:3px solid #ddd;padding-left:10px;">${preview.replace(/</g, "&lt;")}</blockquote>` : ""}<p>Review her email and attachment, then forward it to the customer:</p><p><a href="${link}" style="display:inline-block;background:#27AAE1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;">Approve &amp; send to customer</a></p></div>` });
        handled++;
        continue;
      }

      // Otherwise pull her full message text (uniqueBody = just her new content).
      let reply = preview;
      try {
        const full: any = await client.api(`/users/${MAILBOX}/messages/${m.id}`).header("Prefer", 'outlook.body-content-type="text"').select("uniqueBody").get();
        if (full?.uniqueBody?.content) reply = full.uniqueBody.content.trim();
      } catch { /* fall back to preview */ }

      if (/\$/.test(reply)) {
        await onMaryQuote(prisma, ml, reply); // has a price → run it as the quote
      } else {
        // No price yet (she's working it) — note it for owners, give Mary room,
        // but keep following up until the actual quote arrives.
        const grace = new Date(Date.now() + 2 * 24 * 3600 * 1000);
        await prisma.lead.update({ where: { id: ml.id }, data: { agentNextAt: grace } });
        await agentSend({ to: OWNERS, subject: `Mary replied on ${ml.companyName}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Mary replied on <strong>${ml.companyName}</strong> (working on it, no price yet):</p><blockquote style="color:#555;border-left:3px solid #ddd;padding-left:10px;">${reply.slice(0, 600).replace(/</g, "&lt;")}</blockquote><p>The agent will keep following up until the quote is in.</p></div>` });
      }
      handled++;
      continue;
    }

    // Match to a lead the agent is actively chasing. We do NOT touch messages
    // that aren't agent replies — leave the rest of the mailbox untouched.
    const lead = await prisma.lead.findFirst({
      where: { contactEmail: { equals: from, mode: "insensitive" }, agentStatus: { in: ["awaiting_customer_info", "info_nudge_1", "awaiting_mary", "quote_received", "sent", "followup_1", "followup_2", "followup_3"] } },
      orderBy: { updatedAt: "desc" },
    });
    if (!lead) continue;

    // Only now mark it read — it's a lead reply we're handling.
    try { await client.api(`/users/${MAILBOX}/messages/${m.id}`).patch({ isRead: true }); } catch { /* ignore */ }

    // CASE 0: we're already quoting (Mary has it / owners reviewing). A customer
    // reply here is usually artwork or more detail — forward it to Mary, copy owners.
    if (lead.agentStatus === "awaiting_mary" || lead.agentStatus === "quote_received") {
      const preview = (m.bodyPreview || "").trim();
      await agentMarySend(prisma, lead, {
        body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Hi Mary,</p><p>${lead.companyName}${lead.contactName ? ` (${lead.contactName})` : ""} just sent this through${m.hasAttachments ? " (artwork attached)" : ""}. Please factor it into the quote. Thanks,<br>Albert</p>${preview ? `<blockquote style="color:#555;border-left:3px solid #ddd;padding-left:10px;">${preview.replace(/</g, "&lt;")}</blockquote>` : ""}</div>`,
        copyAttachmentsFrom: m.id,
      });
      handled++;
      continue;
    }

    // CASE 1: the customer answered our spec questions → fold the answers into
    // the brief and hand a complete package to Mary to quote.
    if (lead.agentStatus === "awaiting_customer_info" || lead.agentStatus === "info_nudge_1") {
      let res: { merged: string; quotable: boolean; reason: string } | null = null;
      try {
        const { mergeCustomerAnswers } = await import("@/lib/agent/claude");
        res = await mergeCustomerAnswers({ productName: lead.productCategory || "project", priorBrief: lead.commentary || "", reply: m.bodyPreview || "" });
      } catch { /* fall back to raw append */ }
      const commentary = res?.merged
        ? `${res.merged}\n\n[Customer's reply, verbatim] ${m.bodyPreview || ""}`.slice(0, 4000)
        : `${lead.commentary || ""}\n\n[Customer answered] ${m.bodyPreview || ""}`.slice(0, 4000);

      // Not actually a print/packaging quote (vendor pitch, misrouted, spam)?
      // Do NOT hand it to Mary — flag it for the owners to close out.
      if (res && res.quotable === false) {
        await prisma.lead.update({ where: { id: lead.id }, data: { commentary, agentStatus: "disqualified", agentNextAt: null } });
        await agentSend({ to: OWNERS, subject: `Not a quote: ${lead.companyName}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;"><p>Heads up - <strong>${lead.companyName}</strong> replied, and it is not a print or packaging inquiry, so I did not send it to Mary.</p><p><strong>Why:</strong> ${res.reason || "the sender is not seeking a printing or packaging quote."}</p><p><strong>Their reply:</strong> "${(m.bodyPreview || "").slice(0, 500)}"</p><p>Safe to close this one out (move to Lost) whenever.</p></div>` });
        handled++;
        continue;
      }

      await prisma.lead.update({ where: { id: lead.id }, data: { commentary, agentLog: lead.agentLog } });
      const fresh = await prisma.lead.findUnique({ where: { id: lead.id } });
      const { kickoffAgent } = await import("@/lib/agent/agent");
      await kickoffAgent(prisma, { ...fresh, productName: fresh.productCategory });
      handled++;
      continue;
    }

    // CASE 2: a reply after the quote went out — draft a response for approval.
    // Draft a reply (Claude) — falls back to a human handoff if no key.
    let draft: string | null = null;
    try {
      const claude = getClaude();
      if (claude) {
        const sys = `You write replies to customers for C&D Printing & Packaging. Understated, warm, professional — no hype, no emoji, no exclamation points. Address their message directly, keep it short, propose a clear next step. Use the customer's FIRST name only (never the full name). Sign off with just the name "Albert Waxman" (a company signature is appended automatically). Never use em dashes or en dashes (— –); use commas, periods, or parentheses instead, so it doesn't read as AI-written. Output ONLY the inner HTML body (<p>, <strong>, <br>). Don't invent prices or commitments beyond what's in the quote. If the customer asks about timing, our standard lead time is 2 to 3 weeks after we receive payment and final approval of the quote, and we can prioritize when they have a deadline.`;
        const u = `Customer ${lead.companyName} replied to our quote for ${lead.productName}.\nOur quote was:\n${lead.agentQuote || "(not recorded)"}\n\nTheir message:\n${m.bodyPreview || ""}`;
        const r = await claude.messages.create({ model: "claude-opus-4-8", max_tokens: 1024, system: sys, messages: [{ role: "user", content: u }] });
        const t: any = (r.content || []).find((b: any) => b.type === "text");
        draft = t?.text?.trim() || null;
      }
    } catch (e) { console.error("[agent inbox] draft failed", e); }

    // Stop the chase, record the reply + draft, alert owners to approve a send.
    await prisma.lead.update({
      where: { id: lead.id },
      data: { agentStatus: "replied", agentNextAt: null, agentDraft: draft, commentary: `${lead.commentary || ""}\n\n[Customer replied] ${m.bodyPreview || ""}`.slice(0, 4000) },
    });
    const link = `${BASE}/agent?id=${lead.id}&token=${lead.agentToken}&do=reply`;
    const body = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;">
      <p><strong>${lead.companyName}</strong> replied to the quote:</p>
      <blockquote style="color:#555;border-left:3px solid #ddd;padding-left:10px;">${(m.bodyPreview || "").replace(/</g, "&lt;")}</blockquote>
      ${draft ? `<p>Suggested reply (review &amp; edit before sending):</p><pre style="white-space:pre-wrap;background:#f7f7f7;padding:10px;border-radius:6px;font-family:inherit;">${draft.replace(/<[^>]+>/g, "").replace(/</g, "&lt;")}</pre>` : "<p>No draft (Claude not enabled).</p>"}
      <p><a href="${link}" style="display:inline-block;background:#27AAE1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;">Review &amp; send reply</a></p></div>`;
    await agentSend({ to: OWNERS, subject: `Lead replied: ${lead.companyName}`, body });
    handled++;
  }
  return { checked: items.length, handled };
}
