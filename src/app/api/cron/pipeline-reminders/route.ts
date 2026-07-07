import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email/graph-client";

// Daily pipeline follow-up reminders (Benjy 6/26). Vercel Cron hits this once
// a day; it emails each owner a digest of the leads whose follow-up date has
// arrived, and keeps re-sending every morning until each is marked done
// (Benjy 7/1). Uses app-level Graph mail, so no logged-in user is required.

const SENDER = "bwaxman@cndprinting.com";      // a real C&D mailbox the app can send as
const FALLBACK_TO = "bwaxman@cndprinting.com"; // where unowned/unknown reminders go
const PORTAL = "https://packaging.cndprinting.com/dashboard/pipeline";

export async function GET(request: NextRequest) {
  // Secure: if CRON_SECRET is set, require Vercel's bearer header (or ?key=).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const key = request.nextUrl.searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const prismaModule = await import("@/lib/prisma");
  const prisma = prismaModule.default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

  const now = new Date();
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  // Active stages only — no point nudging won/lost. Re-nag every morning until
  // the follow-up is marked done: send if not already reminded today, and skip
  // any that are completed (followUpDoneAt set).
  const due = await prisma.lead.findMany({
    where: {
      followUpAt: { not: null, lte: now },
      followUpDoneAt: null,
      OR: [{ reminderSentAt: null }, { reminderSentAt: { lt: startOfToday } }],
      pipelineStage: { in: ["LEAD", "QUALIFIED"] },
    },
    orderBy: { followUpAt: "asc" },
  });
  // (No early return here — the agent chase engine below must run even when
  // there are no follow-up reminders due. Bug fix, Benjy 6/26.)

  // Map owner display names → real mailbox emails.
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { name: true, email: true } });
  const emailFor = (ownerName: string | null): string => {
    if (!ownerName || ownerName.toUpperCase() === "TBD") return FALLBACK_TO;
    const first = ownerName.trim().toLowerCase().split(/\s+/)[0];
    const u = users.find((x) => x.name.toLowerCase().startsWith(first));
    return u?.email || FALLBACK_TO;
  };

  // Group due leads by recipient email.
  const groups = new Map<string, typeof due>();
  for (const lead of due) {
    const to = emailFor(lead.ownerName);
    if (!groups.has(to)) groups.set(to, []);
    groups.get(to)!.push(lead);
  }

  let sent = 0;
  const sentLeadIds: string[] = [];
  for (const [to, leads] of groups) {
    const rows = leads.map((l) => {
      const note = l.followUpNote ? ` — ${l.followUpNote}` : "";
      const stage = l.pipelineStage === "QUALIFIED" ? "Qualified prospect" : "Lead";
      return `<li style="margin-bottom:8px;"><strong>${l.companyName}</strong> <span style="color:#888;">(${stage}${l.stage ? ` · ${l.stage}` : ""})</span>${note}</li>`;
    }).join("");
    const body = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;">
        <p>You have <strong>${leads.length}</strong> pipeline follow-up${leads.length > 1 ? "s" : ""} due:</p>
        <ul style="padding-left:18px;">${rows}</ul>
        <p style="margin-top:16px;"><a href="${PORTAL}" style="color:#27AAE1;">Open the sales pipeline →</a></p>
        <p style="color:#aaa;font-size:11px;margin-top:20px;">Automated reminder from Godzilla.</p>
      </div>`;
    const res = await sendEmail({ from: SENDER, to, subject: `Pipeline follow-ups due (${leads.length})`, body });
    if (res.success) { sent++; sentLeadIds.push(...leads.map((l) => l.id)); }
  }

  if (sentLeadIds.length) {
    await prisma.lead.updateMany({ where: { id: { in: sentLeadIds } }, data: { reminderSentAt: now } });
  }

  // Also drive the sales-agent chase engine (nudges, follow-ups) on the same
  // daily tick (no-op unless AGENT_ENABLED=true).
  let agent = { acted: 0 };
  try {
    const { processDueAgentLeads } = await import("@/lib/agent/agent");
    agent = await processDueAgentLeads(prisma);
  } catch (e) { console.error("[Godzilla CRON] agent processing failed", e); }

  // Daily "inbound leads needing a human" digest (Benjy 7/7) — the follow-up idea,
  // but for inbound inquiries the agent can't advance on its own: owner approval,
  // existing accounts, scam review, or threads that have stalled. So leads never
  // just sit there unseen.
  let inboundDigest = 0;
  try {
    const stale = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
    const inbound = await prisma.lead.findMany({
      where: {
        source: "inbound",
        pipelineStage: { in: ["LEAD", "QUALIFIED"] },
        OR: [
          { agentStatus: { in: ["quote_received", "owner_handling", "needs_review", "needs_info", "needs_owner"] } },
          { agentStatus: { in: ["awaiting_mary", "awaiting_customer_info", "info_nudge_1"] }, agentNextAt: { lt: stale } },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    if (inbound.length) {
      const needLabel = (l: any): string => {
        switch (l.agentStatus) {
          case "quote_received": return "Approve &amp; send Mary's quote to the customer";
          case "owner_handling": return "Existing account - reach out to them directly";
          case "needs_review": return "Review - flagged possible scam";
          case "needs_info":
          case "needs_owner": return "Mary needs something / a decision from you";
          case "awaiting_mary": return "Stalled - Mary hasn't quoted yet, give her a nudge";
          default: return "Stalled - customer hasn't sent info, consider a personal nudge";
        }
      };
      const rows = inbound.map((l: any) => `<li style="margin-bottom:10px;"><strong>${l.companyName}</strong>${l.contactName ? ` <span style="color:#888;">(${l.contactName})</span>` : ""}<br><span style="color:#27AAE1;">${needLabel(l)}</span>${l.stage ? ` <span style="color:#aaa;">· ${l.stage}</span>` : ""}</li>`).join("");
      const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;"><p>These inbound inquiries need a human - the agent has taken them as far as it can on its own:</p><ul style="padding-left:18px;">${rows}</ul><p style="margin-top:16px;"><a href="${PORTAL}" style="color:#27AAE1;">Open the sales pipeline →</a></p><p style="color:#aaa;font-size:11px;margin-top:20px;">Automated to-do from Godzilla.</p></div>`;
      const { OWNERS, agentSend } = await import("@/lib/agent/agent");
      await agentSend({ to: OWNERS, subject: `Inbound leads needing your attention (${inbound.length})`, body });
      inboundDigest = inbound.length;
    }
  } catch (e) { console.error("[Godzilla CRON] inbound digest failed", e); }

  return NextResponse.json({ ok: true, emails: sent, reminders: sentLeadIds.length, agentActed: agent.acted, inboundDigest });
}
