import { getGraphClient, replyInConversation, sendEmail } from "@/lib/email/graph-client";
import { getClaude } from "@/lib/agent/claude";
import { outboundEnabled, appendNote } from "@/lib/agent/outbound";
import { noEmDash } from "@/lib/agent/agent";

// Handles replies to outbound prospecting emails (Benjy 6/30). Scans each owner
// mailbox, matches a reply to its lead, and classifies it: not interested →
// 6-month recheck; interested → hand to owner (HOT); unsubscribe → do-not-contact.
// The agent never negotiates — it only tags, schedules, and notifies.

const MAILBOXES: Record<string, string> = {
  "awaxman@cndprinting.com": "Albert Waxman",
  "bwaxman@cndprinting.com": "Benjy Waxman",
  "nlaor@cndprinting.com": "Nitay Laor",
};
const ACTIVE = ["intro_sent", "followup_1", "followup_2", "replied"];
const SIX_MONTHS_DAYS = 182;

async function classify(text: string): Promise<"interested" | "not_interested" | "unsubscribe" | "other"> {
  const claude = getClaude();
  if (!claude) return "other";
  try {
    const system = `Classify a prospect's reply to a cold sales email into exactly one label: interested, not_interested, unsubscribe, other. "unsubscribe" = asks to stop/remove/opt out/do not contact. "not_interested" = a polite or firm no, not now, no need, all set. "interested" = wants info, samples, a call, pricing, or asks a question showing interest. "other" = unclear, auto-reply, out-of-office, or wrong person. Respond with ONLY the label.`;
    const msg = await claude.messages.create({ model: "claude-opus-4-8", max_tokens: 16, system, messages: [{ role: "user", content: text.slice(0, 1500) }] });
    const t: any = (msg.content || []).find((b: any) => b.type === "text");
    const out = (t?.text || "").toLowerCase();
    if (out.includes("unsubscribe")) return "unsubscribe";
    if (out.includes("not_interested") || out.includes("not interested")) return "not_interested";
    if (out.includes("interested")) return "interested";
    return "other";
  } catch { return "other"; }
}

export async function processOutboundReplies(prisma: any): Promise<{ handled: number }> {
  if (!outboundEnabled()) return { handled: 0 };
  const client = getGraphClient();
  if (!client) return { handled: 0 };
  let handled = 0;

  for (const mb of Object.keys(MAILBOXES)) {
    let items: any[] = [];
    try {
      const res = await client.api(`/users/${mb}/mailFolders/Inbox/messages`).filter("isRead eq false").top(25).select("id,from,subject,bodyPreview,conversationId").get();
      items = res.value || [];
    } catch { continue; }

    for (const m of items) {
      const from = m.from?.emailAddress?.address?.toLowerCase();
      if (!from) continue;
      const conv = m.conversationId;
      let lead = conv ? await prisma.lead.findFirst({ where: { outreachConvId: conv, outreachStatus: { in: ACTIVE } } }) : null;
      if (!lead) lead = await prisma.lead.findFirst({ where: { contactEmail: { equals: from, mode: "insensitive" }, outreachStatus: { in: ACTIVE } } });
      if (!lead) continue; // not an outbound reply — leave it alone

      try { await client.api(`/users/${mb}/messages/${m.id}`).patch({ isRead: true }); } catch { /* ignore */ }
      const preview = (m.bodyPreview || "").trim();
      const cls = await classify(preview);
      const ownerFull = MAILBOXES[mb];
      const notify = (subject: string, note: string) =>
        sendEmail({ from: mb, to: mb, subject: noEmDash(subject), body: noEmDash(`<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>${note}</p><blockquote style="color:#555;border-left:3px solid #ddd;padding-left:10px;">${preview.replace(/</g, "&lt;")}</blockquote></div>`) });

      if (cls === "unsubscribe") {
        await prisma.lead.update({ where: { id: lead.id }, data: { outreachStatus: "unsubscribed", agentHold: true, outreachNextAt: null } });
        await appendNote(prisma, lead.id, "Prospect asked to opt out, marked do-not-contact");
        await notify(`Unsubscribe: ${lead.companyName}`, `<strong>${lead.companyName}</strong> asked to be removed. Marked do-not-contact, the agent will not email them again.`);
      } else if (cls === "interested") {
        await prisma.lead.update({ where: { id: lead.id }, data: { outreachStatus: "replied", outreachNextAt: null } });
        await appendNote(prisma, lead.id, "Prospect replied interested, handed to owner");
        await notify(`HOT - ${lead.companyName} replied interested`, `<strong>${lead.companyName}</strong> replied with interest. Over to you, the agent has stopped its sequence.`);
      } else if (cls === "not_interested") {
        const recheck = new Date(Date.now() + SIX_MONTHS_DAYS * 24 * 3600 * 1000);
        await prisma.lead.update({ where: { id: lead.id }, data: { outreachStatus: "not_interested", outreachNextAt: null, followUpAt: recheck, followUpNote: `Recheck - said not interested ${new Date().toISOString().slice(0, 10)}` } });
        await appendNote(prisma, lead.id, `Prospect not interested, recheck set ${recheck.toLocaleDateString("en-US")}`);
        // brief gracious note, threaded from the owner's mailbox
        if (lead.outreachConvId) {
          try { await replyInConversation({ from: mb, conversationId: lead.outreachConvId, to: lead.contactEmail, body: noEmDash(`<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>Totally understand, and thank you for letting me know. I will check back down the road. If anything changes in the meantime, we are here to help.</p><p>Best regards,<br>${ownerFull}<br>C&amp;D Printing &amp; Packaging</p></div>`) }); } catch { /* ignore */ }
        }
        await notify(`Not interested: ${lead.companyName}`, `<strong>${lead.companyName}</strong> passed for now. Recheck scheduled in ~6 months.`);
      } else {
        await prisma.lead.update({ where: { id: lead.id }, data: { outreachStatus: "replied", outreachNextAt: null } });
        await appendNote(prisma, lead.id, "Prospect replied, needs review");
        await notify(`Reply: ${lead.companyName}`, `<strong>${lead.companyName}</strong> replied (needs your eyes - the agent could not clearly classify it).`);
      }
      handled++;
    }
  }
  return { handled };
}
