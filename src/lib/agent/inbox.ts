import { getGraphClient } from "@/lib/email/graph-client";
import { agentSend, agentMarySend, agentCustomerSend, OWNERS, MARY, SHAYLA, onMaryQuote, kickoffMailerCity, onMailerCityReply, isAutoReply, isWeekendET } from "@/lib/agent/agent";
import { READ_MAILBOXES, leadAgentName, leadAgentFirst } from "@/lib/agent/identity";
import { getClaude } from "@/lib/agent/claude";
import { isTestSubmission } from "@/lib/agent/blocklist";

// Inbound reply handler (Benjy 6/26) — the second half of the lead↔agent
// conversation. Reads the agent mailbox, matches each unread message to the
// lead it's replying to, drafts a response with Claude, and routes it to the
// owners for one-click send. Needs Mail.ReadWrite (application) consent in
// Azure on top of the existing Mail.Send — until that's granted the read call
// throws and this no-ops.

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
  // Weekend: don't process replies either — handling one sends mail (a quote
  // to a customer, a forward to Mary). Messages are simply left unread and
  // picked up Monday; nothing is lost because agentLastMsgAt isn't stamped.
  if (isWeekendET()) return { checked: 0, handled: 0 };
  const client = getGraphClient();
  if (!client) return { checked: 0, handled: 0, error: "graph not configured" };

  // Fetch recent mail regardless of read state — an owner opening a reply in
  // Outlook must NOT hide it from the agent. We de-dupe per lead via
  // agentLastMsgAt instead of relying on the unread flag. Benjy 7/7.
  // Polls BOTH the current identity mailbox and the legacy Albert mailbox during
  // the Jessica cutover, so in-flight threads keep working. Benjy 7/9.
  const items: any[] = [];
  // 10 days, not 5: a skipped cron run (Hobby crons are best-effort) plus a
  // weekend could push an unhandled reply out of the window permanently.
  const cutoff = new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString();
  for (const box of READ_MAILBOXES) {
    try {
      const res = await client
        .api(`/users/${box}/mailFolders/Inbox/messages`)
        .filter(`receivedDateTime ge ${cutoff}`)
        .orderby("receivedDateTime desc")   // NEWEST first — a busy mailbox has >100 msgs in 5d; asc missed recent replies
        .top(200)
        .select("id,subject,from,bodyPreview,receivedDateTime,hasAttachments,conversationId,internetMessageId")
        .get();
      for (const m of (res.value || [])) { m._mb = box; items.push(m); }
    } catch (e) {
      console.error(`[agent inbox] read failed for ${box} — needs Mail.ReadWrite app permission`, e);
      if (items.length === 0 && box === READ_MAILBOXES[READ_MAILBOXES.length - 1]) return { checked: 0, handled: 0, error: "mail read failed (Mail.ReadWrite not granted?)" };
    }
  }

  // PROCESS OLDEST-FIRST. Fetching desc gets the freshest 200, but handling
  // newest-first swallowed older unhandled replies: processing a newer message
  // stamps agentLastMsgAt, and anything older then looks already-handled.
  // Sunny Brooke (7/17): Mary's "too big" reply at 6:45pm was skipped because
  // the customer's 6:50pm artwork email was processed first — she was then
  // nudged for days on a job she'd already declined (Benjy 7/20).
  items.sort((a, b) => new Date(a.receivedDateTime).getTime() - new Date(b.receivedDateTime).getTime());

  // The same message often exists in BOTH polled mailboxes (owners are CC'd)
  // with delivery-skewed timestamps, which double-processed it (duplicate
  // forwards to Mary). De-dupe by internetMessageId within the run.
  const seenMsgIds = new Set<string>();
  const preDedupe = items.length;
  const deduped: any[] = [];
  for (const m of items) {
    const key = m.internetMessageId || m.id;
    if (seenMsgIds.has(key)) continue;
    seenMsgIds.add(key);
    deduped.push(m);
  }
  items.length = 0; items.push(...deduped);
  if (preDedupe !== items.length) console.log(`[agent inbox] cross-mailbox de-dupe: ${preDedupe} -> ${items.length}`);

  // Alert-once threshold: messages newer than the previous poll. Without this
  // an unmatched reply would re-alert every day until it aged out (Benjy 7/27).
  let alertSince = new Date(Date.now() - 26 * 3600 * 1000);
  try {
    const lastRun = await prisma.cronRun.findUnique({ where: { job: "agent-inbox" } });
    if (lastRun?.ranAt) alertSince = new Date(lastRun.ranAt);
  } catch { /* table missing -> 26h fallback */ }

  const unmatchedInternal: { who: string; subject: string; preview: string }[] = [];

  let handled = 0;
  for (const m of items) {
    const MAILBOX = m._mb; // the mailbox this message lives in
    const from = m.from?.emailAddress?.address?.toLowerCase();
    if (!from) continue;

    // REPLY-TO-APPROVE (Benjy 7/23): an owner replying "approved" to the
    // "Approve quote: X" email sends Mary's quote — no link click needed.
    // Only fires on a held quote (quote_received); once sent, re-polls no-op.
    if (OWNERS.some((o) => o.toLowerCase() === from)) {
      const subj = (m.subject || "").replace(/^((re|fw|fwd):\s*)+/i, "").trim();
      const am = subj.match(/^approve quote:\s*(.+)$/i);
      if (am) {
        const lead = await prisma.lead.findFirst({
          where: { companyName: { equals: am[1].trim(), mode: "insensitive" }, agentStatus: "quote_received" },
          orderBy: { updatedAt: "desc" },
        });
        if (lead) {
          let txt = (m.bodyPreview || "").trim();
          try {
            const fm: any = await client.api(`/users/${MAILBOX}/messages/${m.id}`).header("Prefer", 'outlook.body-content-type="text"').select("uniqueBody").get();
            if (fm?.uniqueBody?.content?.trim()) txt = fm.uniqueBody.content.trim();
          } catch { /* preview fallback */ }
          const newText = txt.split(/On \w{3}, \w{3} \d|From: /)[0];
          const yes = /\b(approved?|send it|send|yes|go ahead|ok(ay)?|looks good|lgtm)\b/i.test(newText);
          const no = /\b(no\b|don'?t|do not|hold|wait|revise|stop|cancel)\b/i.test(newText);
          try { await client.api(`/users/${MAILBOX}/messages/${m.id}`).patch({ isRead: true }); } catch { /* ignore */ }
          if (yes && !no) {
            const { sendQuotePdfToCustomer, sendCustomerQuote, agentSend: send2 } = await import("@/lib/agent/agent");
            if (lead.agentQuoteMsgId) await sendQuotePdfToCustomer(prisma, lead);
            else await sendCustomerQuote(prisma, lead);
            const who = from.split("@")[0];
            await send2({ to: OWNERS, subject: `Quote sent: ${lead.companyName}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Approved by reply (${who}) - Mary's quote for <strong>${lead.companyName}</strong> is on its way to the customer. Follow-ups are scheduled.</p></div>` });
            handled++;
          }
          // Negative or ambiguous reply → keep holding; the link still works.
          continue;
        }
      }
    }

    // Mary replied to a "Quote needed" handoff with her price. Match it to the
    // awaiting-Mary lead by the company name in the subject, and treat her reply
    // as the quote. (She just emails Albert back — never sees the system.)
    // Shayla (shipping) answers freight asks in the same internal threads —
    // her replies are read exactly like Mary's: "working on it" = grace,
    // a $ figure = quote for owner approval (Benjy 7/23, St.Agave freight).
    if (from === MARY.toLowerCase() || from === SHAYLA.toLowerCase()) {
      const conv = m.conversationId;
      const subjectLc = (m.subject || "").toLowerCase();
      // Match by conversation first — Mary may reply in her own thread OR in the
      // customer thread — then fall back to company name in the subject.
      const agentScope = { OR: [{ pipelineStage: "LEAD" }, { pipelineStage: "QUALIFIED", ownerName: { equals: "Jessica", mode: "insensitive" as const } }] };
      // Match against ANY live agent state, not just awaiting_mary (Benjy 7/27:
      // "we keep missing Mary's responses"). She often sends a SECOND email —
      // a revised price, an answer, freight from Shayla — after the lead has
      // moved to quote_received/needs_owner/sent, and those were dropped on the
      // floor because the matcher only looked at awaiting_mary.
      const LIVE_FOR_INTERNAL = ["awaiting_mary", "quote_received", "needs_owner", "needs_info", "awaiting_customer_file", "awaiting_customer_info", "info_nudge_1", "sent", "followup_1", "followup_2", "followup_3", "replied"];
      // Match on the AGENT's own conversation/state, NOT on who owns the lead
      // (Benjy 7/27): embe is Suzanne's but the agent had asked Mary for that
      // quote, and her reply was being dropped because the owner wasn't
      // Jessica. If the agent started the thread, the agent finishes it.
      let ml: any = conv ? await prisma.lead.findFirst({ where: { agentStatus: { in: LIVE_FOR_INTERNAL }, OR: [{ agentMaryConvId: conv }, { agentConvId: conv }] }, orderBy: { updatedAt: "desc" } }) : null;
      if (!ml) {
        const open = await prisma.lead.findMany({ where: { agentStatus: { in: LIVE_FOR_INTERNAL } }, orderBy: { updatedAt: "desc" }, take: 80 });
        ml = open.find((l: any) => companyMatches(l.companyName, subjectLc)) || null;
      }
      // A REAL PERSON owns it → Jessica works only her own leads (Benjy 7/27).
      // Log what Mary/Shayla said, hand it to the owner, and stand down. This
      // is the rule that keeps the agent out of Suzanne's/Albert's accounts.
      const HUMAN_OWNERS = ["benjy", "nitay", "albert", "suzanne", "mary"];
      if (ml && HUMAN_OWNERS.includes((ml.ownerName || "").trim().toLowerCase())) {
        const who = from === MARY.toLowerCase() ? "Mary" : "Shayla";
        try {
          await prisma.lead.update({ where: { id: ml.id }, data: {
            agentStatus: "owner_handling", agentNextAt: null, stage: "Owner handling - agent stood down",
            commentary: `${ml.commentary || ""}
[${who}] ${new Date().toLocaleDateString("en-US")}: ${(m.subject || "").slice(0, 90)} - ${(m.bodyPreview || "").slice(0, 200)}`.slice(0, 8000),
          } });
        } catch { /* non-fatal */ }
        try { await client.api(`/users/${MAILBOX}/messages/${m.id}`).patch({ isRead: true }); } catch { /* ignore */ }
        handled++;
        continue;
      }

      if (!ml) {
        // No live agent thread. Does the lead exist at all under a human?
        // Holy Toast (Albert), Tempted (Albert), Cardon (nobody) all got
        // flagged as "unmatched" — but a human-run lead is NOT the agent's
        // business: log it on the record and stay silent (Benjy 7/27).
        const human = await prisma.lead.findMany({ orderBy: { updatedAt: "desc" }, take: 400, select: { id: true, companyName: true, commentary: true, ownerName: true } });
        const owned = human.find((l: any) => companyMatches(l.companyName, subjectLc));
        if (owned) {
          const who = from === MARY.toLowerCase() ? "Mary" : "Shayla";
          try {
            await prisma.lead.update({ where: { id: owned.id }, data: { commentary: `${owned.commentary || ""}
[${who}] ${new Date().toLocaleDateString("en-US")}: ${(m.subject || "").slice(0, 90)} - ${(m.bodyPreview || "").slice(0, 160)}`.slice(0, 8000) } });
          } catch { /* non-fatal */ }
          try { await client.api(`/users/${MAILBOX}/messages/${m.id}`).patch({ isRead: true }); } catch { /* ignore */ }
          handled++;
          continue; // ${owned.ownerName} owns it and is already on the thread
        }
      }
      if (!ml) {
        // NEVER silently drop an internal reply. If Mary or Shayla wrote to the
        // agent and we can't tie it to a lead, tell the owners so a human sees
        // it — the whole class of "we missed Mary's response" failures.
        const fresh = new Date(m.receivedDateTime) > alertSince; // alert exactly once
        if (fresh && /quote|estimate|freight|price|pricing/i.test(`${m.subject || ""} ${m.bodyPreview || ""}`)) {
          const who = from === MARY.toLowerCase() ? "Mary" : "Shayla";
          // Collect — ONE digest at the end of the poll, never one email per
          // message (Benjy 7/27: that flooded the owners' inboxes).
          unmatchedInternal.push({ who, subject: m.subject || "(no subject)", preview: (m.bodyPreview || "").slice(0, 300) });
        }
        continue;
      }
      // Already handled this message (even if an owner opened it since)? skip.
      if (ml.agentLastMsgAt && new Date(m.receivedDateTime) <= new Date(ml.agentLastMsgAt)) continue;
      try { await client.api(`/users/${MAILBOX}/messages/${m.id}`).patch({ isRead: true }); } catch { /* ignore */ }
      try { await prisma.lead.update({ where: { id: ml.id }, data: { agentLastMsgAt: new Date(m.receivedDateTime) } }); } catch { /* ignore */ }
      const preview = (m.bodyPreview || "").trim();

      // Mary is out of office → give her a quiet 2-day grace, no owner alert,
      // and the normal nudge cadence resumes after. Benjy 7/13.
      if (isAutoReply(m.subject, preview)) {
        await prisma.lead.update({ where: { id: ml.id }, data: { agentNextAt: new Date(Date.now() + 2 * 24 * 3600 * 1000) } });
        handled++;
        continue;
      }

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

      // UNDERSTAND Mary's reply, don't just pattern-match it (Benjy 7/14 — "too
      // big for our equipment" / "this is corrugated" must stop the chase, not
      // trigger another nudge). Falls back to the old $-check if Claude is off.
      let mCls: { kind: string; reason: string; corrugated: boolean; otherBlocker: boolean } | null = null;
      try { const { classifyMaryReply } = await import("@/lib/agent/claude"); mCls = await classifyMaryReply({ company: ml.companyName, reply }); } catch { /* fall back */ }
      const mKind = mCls?.kind || (/\$/.test(reply) ? "quote" : "working");
      const quoted = (t: string) => `<blockquote style="color:#555;border-left:3px solid #ddd;padding-left:10px;">${t.slice(0, 600).replace(/</g, "&lt;")}</blockquote>`;

      if (mKind === "quote" && /\$/.test(reply)) {
        await onMaryQuote(prisma, ml, reply); // has a price → run it as the quote
      } else if (mKind === "cannot_do") {
        if (mCls?.corrugated && !mCls?.otherBlocker) {
          // Only blocker is corrugated → run the standard play: propose a
          // heavier folding carton to the customer and stop chasing Mary.
          const { suggestFoldingCarton } = await import("@/lib/agent/agent");
          const fresh = await prisma.lead.findUnique({ where: { id: ml.id } });
          await suggestFoldingCarton(prisma, { ...fresh, productName: fresh.productCategory });
          await agentSend({ to: OWNERS, subject: `FYI - ${ml.companyName} is corrugated; proposed folding carton`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Mary flagged <strong>${ml.companyName}</strong> as corrugated (we don't make corrugated), so I stopped chasing her and asked the customer whether a heavier folding carton works. Her note:</p>${quoted(reply)}</div>` });
        } else {
          // Hard blocker (size / process) → close the loop OURSELVES: tell the
          // customer honestly, move the lead to Lost, one-time FYI to owners.
          // No digest nagging for a decision that has no real choice (Benjy 7/14).
          if (ml.contactEmail) {
            await agentCustomerSend(prisma, ml, { body: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;"><p>Hi ${(ml.contactName || "there").trim().split(/\s+/)[0].replace(/["'“”]/g, "") || "there"},</p><p>Thank you for your patience while our production team took a close look. I have to be straight with you: ${mCls?.reason ? mCls.reason.replace(/</g, "&lt;") : "this one falls outside what our equipment can produce"}, so we are not able to make this project for you, and I did not want to leave you waiting on a quote that was not coming.</p><p>If your needs ever shift toward folding cartons or printed pieces in our range, we would genuinely love to help. Wishing you the best with this one.</p><p>Best regards,<br>${leadAgentName(ml)}</p></div>` });
          }
          await prisma.lead.update({ where: { id: ml.id }, data: { agentStatus: "declined", stage: `Can't produce - customer told`, pipelineStage: "LOST", agentNextAt: null, commentary: `${ml.commentary || ""}
[Agent] Mary says C&D can't produce this (${mCls?.reason || "capability blocker"}). Sent the customer a courteous decline and closed to Lost.`.slice(0, 8000) } });
          await agentSend({ to: OWNERS, subject: `FYI - declined ${ml.companyName} (can't produce)`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Mary flagged <strong>${ml.companyName}</strong> as un-producible${mCls?.reason ? ` (${mCls.reason})` : ""}. I let the customer know politely and moved the lead to Lost - nothing needed from you. Reopen it from the pipeline if you see an angle.</p>${quoted(reply)}</div>` });
        }
      } else if (mKind === "needs_from_customer" && ml.contactEmail) {
        // Mary needs something from the CUSTOMER (art file, dieline, sample) →
        // relay her ask; the customer's reply routes back through the agent.
        await agentCustomerSend(prisma, ml, { body: `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;"><p>Hi ${(ml.contactName || "there").trim().split(/\s+/)[0].replace(/["'“”]/g, "") || "there"},</p><p>Quick update on your quote: to finish it up, our estimator needs one thing from you - ${(mCls?.reason || "an item to complete the estimate").replace(/</g, "&lt;")}. If you can send that over by reply, we'll keep things moving right away.</p><p>Best regards,<br>${leadAgentName(ml)}</p></div>`, copyAttachmentsFrom: m.id });
        await prisma.lead.update({ where: { id: ml.id }, data: { agentStatus: "awaiting_customer_file", stage: "Waiting on customer (for Mary)", agentNextAt: new Date(Date.now() + 2 * 24 * 3600 * 1000), commentary: `${ml.commentary || ""}
[Agent] Mary needs from the customer: ${mCls?.reason || "(see her reply)"}. Relayed the ask; chase paused until they respond.`.slice(0, 8000) } });
        await agentSend({ to: OWNERS, subject: `FYI - asked ${ml.companyName} for what Mary needs`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Mary needs something from <strong>${ml.companyName}</strong>${mCls?.reason ? ` (${mCls.reason})` : ""} - I've relayed the ask to the customer and paused her chase. Her note:</p>${quoted(reply)}</div>` });
      } else {
        // Genuinely still working it — give Mary room, keep the normal cadence.
        const grace = new Date(Date.now() + 2 * 24 * 3600 * 1000);
        await prisma.lead.update({ where: { id: ml.id }, data: { agentNextAt: grace } });
        await agentSend({ to: OWNERS, subject: `Mary replied on ${ml.companyName}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Mary replied on <strong>${ml.companyName}</strong> (working on it, no price yet):</p>${quoted(reply)}<p>The agent will keep following up until the quote is in.</p></div>` });
      }
      handled++;
      continue;
    }

    // Match to a lead the agent is actively chasing. We do NOT touch messages
    // that aren't agent replies — leave the rest of the mailbox untouched.
    const lead = await prisma.lead.findFirst({
      where: {
        contactEmail: { equals: from, mode: "insensitive" },
        OR: [
          { pipelineStage: "LEAD", agentStatus: { in: ["awaiting_customer_info", "info_nudge_1", "awaiting_mary", "quote_received", "sent", "followup_1", "followup_2", "followup_3", "mailercity_qualifying", "awaiting_customer_file"] } },
          { pipelineStage: "QUALIFIED", ownerName: { equals: "Jessica", mode: "insensitive" }, agentStatus: { in: ["awaiting_customer_info", "info_nudge_1", "awaiting_mary", "quote_received", "sent", "followup_1", "followup_2", "followup_3", "mailercity_qualifying", "awaiting_customer_file", "closed"] } }, // agent-run qualified leads (Benjy 7/15)
          { pipelineStage: "LOST", agentStatus: "declined" }, // customer came back after a can't-produce decline (revised specs?)
        ],
      },
      orderBy: { updatedAt: "desc" },
    });
    if (!lead) continue;
    // Skip if we already handled this message (an owner may have opened it since).
    if (lead.agentLastMsgAt && new Date(m.receivedDateTime) <= new Date(lead.agentLastMsgAt)) continue;

    // Mark handled (read + timestamp) before processing so we never double-handle.
    try { await client.api(`/users/${MAILBOX}/messages/${m.id}`).patch({ isRead: true }); } catch { /* ignore */ }
    try { await prisma.lead.update({ where: { id: lead.id }, data: { agentLastMsgAt: new Date(m.receivedDateTime) } }); } catch { /* ignore */ }

    // Pull the FULL new-content text (uniqueBody) before ANY classification or
    // drafting. bodyPreview truncates at ~255 chars and once hid a freight
    // question mid-message (Benjy 7/19, Gino at St.Agave) — the agent must read
    // the whole message, never the preview.
    let fullText = (m.bodyPreview || "").trim();
    try {
      const fullMsg: any = await client.api(`/users/${MAILBOX}/messages/${m.id}`).header("Prefer", 'outlook.body-content-type="text"').select("uniqueBody").get();
      if (fullMsg?.uniqueBody?.content?.trim()) fullText = fullMsg.uniqueBody.content.trim();
    } catch { /* fall back to preview */ }

    // A pure pleasantry on an already-declined lead ("no problem, thanks for
    // letting me know") ends the conversation — log it quietly, never draft a
    // reply or task the owners (Benjy 7/16, Jo at No.1 Flowers).
    if (lead.agentStatus === "declined") {
      const txt = fullText.split(/On \w{3}, \w{3} \d|From: /)[0].trim(); // strip quoted history
      const pleasantry = txt.length < 350 && !txt.includes("?") && /thank|thanks|no problem|appreciate|understood|got it|all good|take care|okay|ok/i.test(txt) && !/quote|price|order|need|can you|could you|would you|spec|size|change/i.test(txt);
      if (pleasantry) {
        try { await prisma.lead.update({ where: { id: lead.id }, data: { commentary: `${lead.commentary || ""}
[Agent] Customer acknowledged the decline graciously ("${txt.slice(0, 80)}") - conversation closed, no action needed.`.slice(0, 8000) } }); } catch { /* ignore */ }
        handled++;
        continue;
      }
    }

    // Out-of-office auto-reply → NOT a real customer reply. The address is
    // verified; leave the status and follow-up clock exactly as they are so the
    // normal cadence continues. Never draft a response to a robot. Benjy 7/13.
    if (isAutoReply(m.subject, m.bodyPreview)) {
      try { await prisma.lead.update({ where: { id: lead.id }, data: { commentary: `${lead.commentary || ""}\n[Agent] Out-of-office auto-reply received - address verified, follow-ups continue as scheduled`.slice(0, 8000) } }); } catch { /* ignore */ }
      handled++;
      continue;
    }

    // MailerCity lane: they answered the qualifying questions → capture and hand
    // to the owners. The agent never quotes these or involves Mary.
    if (lead.source === "mailercity") {
      await onMailerCityReply(prisma, lead, fullText);
      handled++;
      continue;
    }

    // Customer sent what Mary was waiting on (art file / dieline / answer) →
    // forward it to Mary with attachments and resume the quote clock.
    if (lead.agentStatus === "awaiting_customer_file") {
      const preview = fullText.slice(0, 1500);
      await agentMarySend(prisma, lead, {
        body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Hi Mary,</p><p>${lead.companyName}${lead.contactName ? ` (${lead.contactName})` : ""} sent over what you needed${m.hasAttachments ? " (attached)" : ""}. Over to you for the quote. Thanks,<br>${leadAgentFirst(lead)}</p>${preview ? `<blockquote style="color:#555;border-left:3px solid #ddd;padding-left:10px;">${preview.replace(/</g, "&lt;")}</blockquote>` : ""}</div>`,
        copyAttachmentsFrom: m.id,
      });
      await prisma.lead.update({ where: { id: lead.id }, data: { agentStatus: "awaiting_mary", stage: "Awaiting Mary", agentNextAt: new Date(Date.now() + 24 * 3600 * 1000) } });
      handled++;
      continue;
    }

    // CASE 0: we're already quoting (Mary has it / owners reviewing). A customer
    // reply here is usually artwork or more detail — forward it to Mary, copy owners.
    if (lead.agentStatus === "awaiting_mary" || lead.agentStatus === "quote_received") {
      const preview = fullText.slice(0, 1500);
      await agentMarySend(prisma, lead, {
        body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Hi Mary,</p><p>${lead.companyName}${lead.contactName ? ` (${lead.contactName})` : ""} just sent this through${m.hasAttachments ? " (artwork attached)" : ""}. Please factor it into the quote. Thanks,<br>${leadAgentFirst(lead)}</p>${preview ? `<blockquote style="color:#555;border-left:3px solid #ddd;padding-left:10px;">${preview.replace(/</g, "&lt;")}</blockquote>` : ""}</div>`,
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
        res = await mergeCustomerAnswers({ productName: lead.productCategory || "project", priorBrief: lead.commentary || "", reply: fullText });
      } catch { /* fall back to raw append */ }
      const commentary = res?.merged
        ? `${res.merged}\n\n[Customer's reply, verbatim] ${fullText}`.slice(0, 4000)
        : `${lead.commentary || ""}\n\n[Customer answered] ${fullText}`.slice(0, 4000);

      // Not actually a print/packaging quote (vendor pitch, misrouted, spam)?
      // Do NOT hand it to Mary — flag it for the owners to close out.
      if (res && res.quotable === false) {
        await prisma.lead.update({ where: { id: lead.id }, data: { commentary, agentStatus: "disqualified", agentNextAt: null, pipelineStage: "LOST", stage: "Not a quote" } });
        await agentSend({ to: OWNERS, subject: `Not a quote: ${lead.companyName}`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;"><p>Heads up - <strong>${lead.companyName}</strong> replied, and it is not a print or packaging inquiry, so I did not send it to Mary.</p><p><strong>Why:</strong> ${res.reason || "the sender is not seeking a printing or packaging quote."}</p><p><strong>Their reply:</strong> "${fullText.slice(0, 500)}"</p><p>Safe to close this one out (move to Lost) whenever.</p></div>` });
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
        const sys = `You write replies to customers for C&D Printing & Packaging. Understated, warm, professional — no hype, no emoji, no exclamation points. Address their message directly, keep it short, propose a clear next step. Use the customer's FIRST name only (never the full name). Sign off with just the name "${leadAgentName(lead)}" (a company signature is appended automatically). Never use em dashes or en dashes (— –); use commas, periods, or parentheses instead, so it doesn't read as AI-written. Output ONLY the inner HTML body (<p>, <strong>, <br>). Don't invent prices or commitments beyond what's in the quote. If the customer asks about timing, our standard lead time is 2 to 3 weeks after we receive payment and final approval of the quote, and we can prioritize when they have a deadline.`;
        const u = `Customer ${lead.companyName} replied to our quote for ${lead.productName}.\nOur quote was:\n${lead.agentQuote || "(not recorded)"}\n\nTheir message:\n${fullText}`;
        const r = await claude.messages.create({ model: "claude-opus-4-8", max_tokens: 1024, system: sys, messages: [{ role: "user", content: u }] });
        const t: any = (r.content || []).find((b: any) => b.type === "text");
        draft = t?.text?.trim() || null;
      }
    } catch (e) { console.error("[agent inbox] draft failed", e); }

    // Benign acknowledgment (thanks / price works / waiting on a partner) → the
    // agent answers it directly and keeps the cadence; only substantive replies
    // (questions, changes, go-aheads) become an owner task (Benjy 7/19, Gino).
    let cCls: { kind: string; reason: string } | null = null;
    try { const { classifyCustomerReply } = await import("@/lib/agent/claude"); cCls = await classifyCustomerReply({ company: lead.companyName, reply: fullText }); } catch { /* review path */ }
    if (cCls?.kind === "benign" && draft) {
      await agentCustomerSend(prisma, lead, { body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;">${draft}</div>` });
      const nextBenign = new Date(); nextBenign.setDate(nextBenign.getDate() + 12);
      await prisma.lead.update({ where: { id: lead.id }, data: { agentStatus: "sent", agentNextAt: nextBenign, agentDraft: null, commentary: `${lead.commentary || ""}
[Customer replied - benign] ${fullText.slice(0, 500)}
[Agent] Acknowledged directly (${cCls.reason || "no action needed"}); next check-in ${nextBenign.toISOString().slice(0, 10)}.`.slice(0, 8000) } });
      handled++;
      continue;
    }

    // Stop the chase, record the reply + draft, alert owners to approve a send.
    await prisma.lead.update({
      where: { id: lead.id },
      data: { agentStatus: "replied", agentNextAt: null, agentDraft: draft, commentary: `${lead.commentary || ""}\n\n[Customer replied] ${fullText}`.slice(0, 4000) },
    });
    const link = `${BASE}/agent?id=${lead.id}&token=${lead.agentToken}&do=reply`;
    const body = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;">
      <p><strong>${lead.companyName}</strong> replied to the quote:</p>
      <blockquote style="color:#555;border-left:3px solid #ddd;padding-left:10px;">${fullText.slice(0, 1500).replace(/</g, "&lt;")}</blockquote>
      ${draft ? `<p>Suggested reply (review &amp; edit before sending):</p><pre style="white-space:pre-wrap;background:#f7f7f7;padding:10px;border-radius:6px;font-family:inherit;">${draft.replace(/<[^>]+>/g, "").replace(/</g, "&lt;")}</pre>` : "<p>No draft (Claude not enabled).</p>"}
      <p><a href="${link}" style="display:inline-block;background:#27AAE1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;">Review &amp; send reply</a></p></div>`;
    await agentSend({ to: OWNERS, subject: `Lead replied: ${lead.companyName}`, body });
    handled++;
  }
  // ONE digest for everything Mary/Shayla sent that has no home in Godzilla.
  if (unmatchedInternal.length) {
    const rows = unmatchedInternal.map((u) => `<li style="margin-bottom:8px;"><strong>${u.who}</strong> - ${u.subject.replace(/</g, "&lt;")}<br><span style="color:#777;font-size:12px;">${u.preview.replace(/</g, "&lt;")}</span></li>`).join("");
    try {
      await agentSend({ to: OWNERS, subject: `Quote emails with no matching lead (${unmatchedInternal.length})`, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Mary or Shayla sent these about quotes, but they do not match any lead in Godzilla, so the agent could not act on them:</p><ul style="padding-left:18px;">${rows}</ul><p style="color:#888;font-size:12px;">One summary per day. Add a lead in the pipeline if any of these should be tracked.</p></div>` });
    } catch { /* non-fatal */ }
  }

  try {
    await prisma.cronRun.upsert({ where: { job: "agent-inbox" }, create: { job: "agent-inbox", ranAt: new Date() }, update: { ranAt: new Date() } });
  } catch { /* non-fatal */ }
  return { checked: items.length, handled };
}

// ── MailerCity feed (Benjy 7/8) ─────────────────────────────────────────────
// The MailerCity landing page (marketing.cndprinting.com) emails a "New
// MailerCity lead" notification from reports@cndprinting.com. We read those,
// parse the lead, drop it into Godzilla tagged source="mailercity" (so the
// outbound agent can never touch it), and kick off the qualifying email.
const MAILERCITY_MAILBOX = "bwaxman@cndprinting.com";
const REPORTS = "reports@cndprinting.com";

export async function pollMailerCityLeads(prisma: any): Promise<{ created: number }> {
  if (process.env.AGENT_ENABLED !== "true") return { created: 0 };
  const client = getGraphClient();
  if (!client) return { created: 0 };
  let items: any[] = [];
  try {
    // Targeted search (avoids paging the whole mailbox); newest are returned.
    const res = await client.api(`/users/${MAILERCITY_MAILBOX}/messages`)
      .search('"New MailerCity lead"')
      .top(25)
      .select("id,subject,from,body,receivedDateTime").get();
    items = (res.value || []).filter((m: any) => new Date(m.receivedDateTime).getTime() > Date.now() - 14 * 24 * 3600 * 1000);
  } catch (e) { console.error("[mailercity] read failed", e); return { created: 0 }; }

  let created = 0;
  for (const m of items) {
    const fromAddr = m.from?.emailAddress?.address?.toLowerCase();
    if (fromAddr !== REPORTS.toLowerCase()) continue;
    if (!/new mailercity lead/i.test(m.subject || "")) continue;
    const text = (m.body?.content || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;|’/g, "'").replace(/\s+/g, " ").trim();
    const email = (text.match(/Email\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i) || [])[1] || (text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/i) || [])[0];
    if (!email) continue;
    const name = ((text.match(/Name\s+(.+?)\s+Email/i) || [])[1] || "").trim() || null;
    if (isTestSubmission(email, name)) continue; // Habib/SlashPie tests (email OR name)
    const exists = await prisma.lead.findFirst({ where: { source: "mailercity", contactEmail: { equals: email, mode: "insensitive" } }, select: { id: true } });
    if (exists) continue; // already captured
    const lead = await prisma.lead.create({ data: {
      companyName: name || email,
      contactName: name,
      contactEmail: email,
      productCategory: "MailerCity",
      ownerName: "Jessica", // agent-owned until a human takes over (Benjy 7/13)
      source: "mailercity",
      pipelineStage: "LEAD",
      stage: "MailerCity - new",
      commentary: `MailerCity landing-page lead.\n${text.slice(0, 1500)}`,
      intakeRaw: JSON.stringify({ mailercityEmailId: m.id, receivedDateTime: m.receivedDateTime }),
      lastInteraction: new Date(),
    } });
    try { await kickoffMailerCity(prisma, lead); created++; } catch (e) { console.error("[mailercity] kickoff failed", lead.id, e); }
  }
  return { created };
}
