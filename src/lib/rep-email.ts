// Rep email inside Godzilla (Benjy 9/24: "Shimmie sends an email from
// Godzilla and when we get responses it's recorded in GZ ... specific to each
// sales person"). Outbound goes out through Graph FROM the rep's own mailbox
// (so it also sits in their Outlook Sent folder); replies are pulled back by
// conversationId from that mailbox and stored on the lead, tagged to the rep.
import { getGraphClient, sendEmailGetConversation } from "@/lib/email/graph-client";

const PORTAL = "https://packaging.cndprinting.com/dashboard/pipeline";
const strip = (h: string) => h.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\n{3,}/g, "\n\n").trim();

// Cut the quoted history off a reply so the lead shows just what they wrote.
export function replyOnly(text: string): string {
  const cut = text.search(/\n\s*(From: .+|On .{5,80} wrote:|-----Original Message-----|_{10,})/);
  return (cut > 0 ? text.slice(0, cut) : text).trim();
}

export const TEMPLATES: { key: string; label: string; subject: string; body: string }[] = [
  { key: "intro", label: "Intro", subject: "C&D Printing & Packaging — {{company}}",
    body: "Hi {{first}},\n\nI'm {{me}} with C&D Printing & Packaging in St. Petersburg. We print and convert folding cartons, labels and printed collateral for brands like yours, all under one roof.\n\nWould you be open to a quick call this week to see if we can help with {{product}}?\n\nBest,\n{{me}}" },
  { key: "followup", label: "Follow-up", subject: "Re: {{company}} — following up",
    body: "Hi {{first}},\n\nFollowing up on my last note. Happy to put together pricing on {{product}} if you can share sizes and quantities, or just jump on a 10-minute call.\n\nBest,\n{{me}}" },
  { key: "quote", label: "Quote sent", subject: "Your quote from C&D Printing — {{company}}",
    body: "Hi {{first}},\n\nAttached is our quote for {{product}}. Pricing is good for 30 days. Let me know if you'd like a different quantity break or any changes to the spec, and I'll turn it around quickly.\n\nBest,\n{{me}}" },
  { key: "checkin", label: "Check-in", subject: "Checking in — {{company}}",
    body: "Hi {{first}},\n\nChecking in to see where things stand on your packaging needs. If timing has moved, no problem, just let me know when it makes sense to reconnect.\n\nBest,\n{{me}}" },
];

export function fillTemplate(s: string, v: Record<string, string>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => v[k] ?? "");
}

export function signatureHtml(name: string, email: string): string {
  return `<p style="margin-top:18px;">${name}<br>C&D Printing &amp; Packaging<br>12150 28th Street North, St. Petersburg, FL 33716<br>Office (727) 572-9999<br><a href="mailto:${email}">${email}</a> · <a href="https://www.cndprinting.com">cndprinting.com</a></p>`;
}

export async function sendRepEmail(prisma: any, user: { id: string; email: string; name: string }, input: { leadId: string; to: string[]; cc?: string[]; subject: string; bodyText: string; attachmentIds?: string[] }) {
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, select: { id: true, companyName: true } });
  if (!lead) return { error: "Lead not found" };
  if (!/@cndprinting\.com$/i.test(user.email)) return { error: "Your login isn't a C&D mailbox, so Godzilla can't send as you." };
  const to = input.to.map((x) => x.trim()).filter((x) => /@/.test(x));
  if (!to.length) return { error: "Add at least one recipient" };
  const subject = input.subject.trim() || `C&D Printing — ${lead.companyName}`;
  const text = input.bodyText.trim();
  if (!text) return { error: "Write something first" };
  // Guardrail (same lesson as Jessica): internal-note markers never leave the building.
  if (/\[Agent\]|\[Godzilla|owner_handling|agentStatus/i.test(text)) return { error: "That looks like internal Godzilla text. Remove it before sending." };

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5;">${text.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`).join("")}${signatureHtml(user.name, user.email)}</div>`;

  const attachments: { name: string; contentType: string; base64Content: string }[] = [];
  for (const aid of input.attachmentIds || []) {
    const a = await prisma.attachment.findUnique({ where: { id: aid }, select: { name: true, url: true, leadId: true } });
    if (!a || a.leadId !== lead.id) continue;
    try {
      const r = await fetch(a.url); const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 20 * 1024 * 1024) continue;
      attachments.push({ name: a.name, contentType: r.headers.get("content-type") || "application/octet-stream", base64Content: buf.toString("base64") });
    } catch { /* skip unreadable attachment */ }
  }

  const client = getGraphClient();
  if (!client) return { error: "Email isn't configured" };
  let conversationId: string | undefined; let graphMessageId: string | undefined;
  try {
    // same draft -> send path as sendEmailGetConversation, but we also keep the message id
    const draft: any = await client.api(`/users/${user.email}/messages`).post({
      subject, body: { contentType: "HTML", content: html },
      toRecipients: to.map((address) => ({ emailAddress: { address } })),
      ccRecipients: (input.cc || []).filter((x) => /@/.test(x)).map((address) => ({ emailAddress: { address: address.trim() } })),
    });
    for (const att of attachments) await client.api(`/users/${user.email}/messages/${draft.id}/attachments`).post({ "@odata.type": "#microsoft.graph.fileAttachment", name: att.name, contentType: att.contentType, contentBytes: att.base64Content });
    await client.api(`/users/${user.email}/messages/${draft.id}/send`).post({});
    conversationId = draft.conversationId; graphMessageId = draft.id;
  } catch (e) {
    const msg = (e as Error).message || "send failed";
    console.error("[rep-email] send failed", msg);
    // fall back to the shared helper once (handles a few Graph quirks)
    const r = await sendEmailGetConversation({ from: user.email, to, cc: input.cc, subject, body: html, attachments });
    if (!r.success) return { error: `Could not send: ${r.error || msg}` };
    conversationId = r.conversationId;
  }

  const row = await prisma.leadEmail.create({ data: {
    leadId: lead.id, direction: "out", mailbox: user.email.toLowerCase(), fromAddr: user.email, toAddr: to.join(", "), cc: (input.cc || []).join(", ") || null,
    subject, bodyText: text + (attachments.length ? `\n\n[attached: ${attachments.map((a) => a.name).join(", ")}]` : ""), graphMessageId: graphMessageId || null, conversationId: conversationId || null, userId: user.id, userName: user.name,
  } });
  await prisma.leadNote.create({ data: { leadId: lead.id, kind: "system", source: "email", authorName: user.name, body: `[Email] ${user.name} → ${to.join(", ")}: "${subject}"` } });
  await prisma.lead.update({ where: { id: lead.id }, data: { lastInteraction: new Date() } });
  return { email: row };
}

// Called from the inbox cron: for every mailbox that has sent from Godzilla,
// look for new messages in those conversations that weren't sent by us.
export async function pollRepInboxes(prisma: any): Promise<{ mailboxes: number; replies: number }> {
  const client = getGraphClient();
  if (!client) return { mailboxes: 0, replies: 0 };
  const since = new Date(Date.now() - 120 * 86400e3);
  const threads: { mailbox: string; conversationId: string; leadId: string; userId: string | null; userName: string | null }[] = await prisma.leadEmail.findMany({
    where: { direction: "out", conversationId: { not: null }, sentAt: { gte: since } },
    distinct: ["mailbox", "conversationId"], select: { mailbox: true, conversationId: true, leadId: true, userId: true, userName: true },
  });
  const byMailbox = new Map<string, typeof threads>();
  for (const t of threads) { const a = byMailbox.get(t.mailbox) || []; a.push(t); byMailbox.set(t.mailbox, a); }
  let replies = 0;
  for (const [mailbox, list] of byMailbox) {
    for (const t of list) {
      try {
        const r: any = await client.api(`/users/${mailbox}/messages`).filter(`conversationId eq '${t.conversationId}'`).select("id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,isDraft").top(50).get();
        for (const m of r.value || []) {
          if (m.isDraft) continue;
          const from = (m.from?.emailAddress?.address || "").toLowerCase();
          if (!from || from === mailbox || from.endsWith("@cndprinting.com")) continue;
          const exists = await prisma.leadEmail.findUnique({ where: { graphMessageId: m.id }, select: { id: true } });
          if (exists) continue;
          const text = replyOnly(strip(m.body?.content || ""));
          await prisma.leadEmail.create({ data: {
            leadId: t.leadId, direction: "in", mailbox, fromAddr: from, toAddr: (m.toRecipients || []).map((x: any) => x.emailAddress?.address).filter(Boolean).join(", "),
            cc: (m.ccRecipients || []).map((x: any) => x.emailAddress?.address).filter(Boolean).join(", ") || null,
            subject: m.subject || "(no subject)", bodyText: text.slice(0, 20000), graphMessageId: m.id, conversationId: t.conversationId,
            userId: t.userId, userName: t.userName, sentAt: new Date(m.receivedDateTime),
          } });
          await prisma.leadNote.create({ data: { leadId: t.leadId, kind: "system", source: "email", authorName: m.from?.emailAddress?.name || from, body: `[Email reply] ${m.from?.emailAddress?.name || from}: ${text.slice(0, 600)}` } });
          const lead = await prisma.lead.update({ where: { id: t.leadId }, data: { lastInteraction: new Date(m.receivedDateTime) }, select: { companyName: true } });
          if (t.userId) {
            await prisma.notification.create({ data: { userId: t.userId, type: "email_reply", actorName: m.from?.emailAddress?.name || from, title: `${m.from?.emailAddress?.name || from} replied — ${lead.companyName}`, body: text.slice(0, 500), url: `${PORTAL}?lead=${t.leadId}` } }).catch(() => {});
          }
          replies++;
        }
      } catch (e) { console.error("[rep-email] poll failed", mailbox, (e as Error).message.slice(0, 120)); }
    }
  }
  return { mailboxes: byMailbox.size, replies };
}
