import { randomBytes } from "crypto";
import { sendEmail } from "@/lib/email/graph-client";

// AI sales-agent chase engine (Benjy 6/26). A status machine on the Lead with
// a clock — nothing sits silent. Customer-facing QUOTE sends are gated behind
// owner approval (spec: watch the first ~10-15); follow-ups auto-send once a
// quote is out. The smart layer (Claude classify / house-style draft) plugs in
// later behind ANTHROPIC_API_KEY — for now drafts are clean templates.

export const MARY = "mbitting@cndprinting.com";
export const OWNERS = ["bwaxman@cndprinting.com", "nlaor@cndprinting.com", "awaxman@cndprinting.com"];
export const SENDER = "bwaxman@cndprinting.com"; // a real C&D mailbox the app can send as
const BASE = "https://packaging.cndprinting.com";

// Master switch — the agent only chases when AGENT_ENABLED=true, so intake can
// run (leak fixed) while the owners watch before turning the emails on.
export const agentEnabled = () => process.env.AGENT_ENABLED === "true";
// When true, the customer quote auto-sends instead of waiting for approval.
const autoSend = () => process.env.AGENT_AUTOSEND === "true";

const newToken = () => randomBytes(16).toString("hex");
const link = (id: string, token: string, action: string) => `${BASE}/agent?id=${id}&token=${token}&do=${action}`;

// Business-day clock — skips weekends.
function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); const dow = d.getUTCDay(); if (dow !== 0 && dow !== 6) added++; }
  return d;
}
function logLine(prev: string | null, event: string): string {
  let arr: any[] = [];
  try { arr = prev ? JSON.parse(prev) : []; } catch { /* reset */ }
  arr.push({ at: new Date().toISOString(), event });
  return JSON.stringify(arr.slice(-50));
}

const wrap = (inner: string) => `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;">${inner}<p style="color:#aaa;font-size:11px;margin-top:20px;">Godzilla sales agent · C&amp;D Printing</p></div>`;
const btn = (href: string, label: string) => `<a href="${href}" style="display:inline-block;background:#27AAE1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:bold;">${label}</a>`;

// ── Step 1: hand a new lead to Mary ────────────────────────────────────────
export async function kickoffAgent(prisma: any, lead: any): Promise<void> {
  if (!agentEnabled()) return;
  const token = lead.agentToken || newToken();
  const body = wrap(`
    <p>New lead ready to quote — here's everything from the website:</p>
    <p><strong>${lead.companyName}</strong>${lead.contactName ? ` · ${lead.contactName}` : ""}${lead.contactEmail ? ` · ${lead.contactEmail}` : ""}${lead.contactPhone ? ` · ${lead.contactPhone}` : ""}</p>
    <pre style="white-space:pre-wrap;background:#f7f7f7;border-radius:6px;padding:12px;font-family:inherit;">${(lead.commentary || "").replace(/</g, "&lt;")}</pre>
    <p>${btn(link(lead.id, token, "quote"), "Reply with the quote")}</p>
    <p style="font-size:12px;color:#888;">Click above to paste price + terms, or flag anything missing — no login needed.</p>`);
  await sendEmail({ from: SENDER, to: MARY, subject: `Quote needed: ${lead.companyName}`, body });
  await prisma.lead.update({
    where: { id: lead.id },
    data: { agentStatus: "awaiting_mary", agentToken: token, agentNextAt: addBusinessDays(new Date(), 1), stage: "Awaiting Mary", agentLog: logLine(lead.agentLog, "Sent to Mary for quote") },
  });
}

// ── Mary submits her quote → notify owners to approve (or auto-send) ────────
export async function onMaryQuote(prisma: any, lead: any, quote: string): Promise<void> {
  await prisma.lead.update({
    where: { id: lead.id },
    data: { agentQuote: quote, agentStatus: "quote_received", stage: "Quote received", agentNextAt: addBusinessDays(new Date(), 1), agentLog: logLine(lead.agentLog, "Quote received from Mary") },
  });
  if (autoSend()) { await sendCustomerQuote(prisma, { ...lead, agentQuote: quote }); return; }
  const body = wrap(`
    <p>Mary quoted <strong>${lead.companyName}</strong>. Review and send to the customer:</p>
    <pre style="white-space:pre-wrap;background:#f7f7f7;border-radius:6px;padding:12px;font-family:inherit;">${quote.replace(/</g, "&lt;")}</pre>
    <p>To: ${lead.contactName || "customer"} · ${lead.contactEmail || "(no email on file)"}</p>
    <p>${btn(link(lead.id, lead.agentToken, "approve"), "Approve &amp; send to customer")}</p>`);
  await sendEmail({ from: SENDER, to: OWNERS, subject: `Approve quote: ${lead.companyName}`, body });
}

// ── Send the quote to the customer → start the follow-up clock ─────────────
export async function sendCustomerQuote(prisma: any, lead: any): Promise<void> {
  if (lead.contactEmail) {
    const body = wrap(`
      <p>Hi ${lead.contactName || "there"},</p>
      <p>Thank you for reaching out to C&amp;D Printing. Here's your quote:</p>
      <pre style="white-space:pre-wrap;background:#f7f7f7;border-radius:6px;padding:12px;font-family:inherit;">${(lead.agentQuote || "").replace(/</g, "&lt;")}</pre>
      <p>Happy to adjust quantities or specs — just reply and we'll take care of it.</p>
      <p>Best regards,<br>C&amp;D Printing &amp; Packaging</p>`);
    await sendEmail({ from: SENDER, to: lead.contactEmail, cc: OWNERS, subject: `Your quote from C&D Printing — ${lead.companyName}`, body });
  }
  await prisma.lead.update({
    where: { id: lead.id },
    data: { agentStatus: "sent", stage: "Sent", agentNextAt: addBusinessDays(new Date(), 2), agentLog: logLine(lead.agentLog, lead.contactEmail ? "Quote sent to customer" : "Approved — no customer email, manual send") },
  });
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
    where: { agentNextAt: { not: null, lte: now }, agentStatus: { in: ["awaiting_mary", "quote_received", "sent", "followup_1", "followup_2"] } },
    take: 100,
  });
  let acted = 0;
  for (const l of due) {
    try {
      if (l.agentStatus === "awaiting_mary") {
        await sendEmail({ from: SENDER, to: MARY, cc: OWNERS, subject: `Reminder — quote needed: ${l.companyName}`, body: wrap(`<p>Still need a quote for <strong>${l.companyName}</strong>.</p><p>${btn(link(l.id, l.agentToken, "quote"), "Reply with the quote")}</p>`) });
        await prisma.lead.update({ where: { id: l.id }, data: { agentNextAt: addBusinessDays(now, 1), agentLog: logLine(l.agentLog, "Nudged Mary") } });
      } else if (l.agentStatus === "quote_received") {
        await sendEmail({ from: SENDER, to: OWNERS, subject: `Reminder — approve quote: ${l.companyName}`, body: wrap(`<p>Quote for <strong>${l.companyName}</strong> is waiting to go out.</p><p>${btn(link(l.id, l.agentToken, "approve"), "Approve &amp; send")}</p>`) });
        await prisma.lead.update({ where: { id: l.id }, data: { agentNextAt: addBusinessDays(now, 1), agentLog: logLine(l.agentLog, "Nudged owners to approve") } });
      } else {
        const step = FOLLOWUPS[l.agentStatus as string];
        if (step) {
          if (l.contactEmail) {
            await sendEmail({ from: SENDER, to: l.contactEmail, cc: OWNERS, subject: `Following up — ${l.companyName} quote`, body: wrap(`<p>Hi ${l.contactName || "there"},</p><p>${step.msg}</p><p>Best regards,<br>C&amp;D Printing &amp; Packaging</p>`) });
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
