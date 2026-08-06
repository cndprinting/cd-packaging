import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { sendEmail } from "@/lib/email/graph-client";

// These jobs poll a mailbox, call Claude, and send email — they need room.
// With no limit declared they were killed at Vercel's ~15s default MID-RUN,
// so the next run started over and re-sent what had already gone out. That
// is why Mary got the same nudge repeatedly (Benjy 7/27). Pro allows 300s.
export const maxDuration = 300;

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

  // Day-guard: the GitHub Actions backstop (16:00 UTC) re-hits this endpoint;
  // if today's run already happened (Vercel cron), skip so digest/accountability
  // emails never double-send. ?force=1 bypasses for manual reruns.
  if (request.nextUrl.searchParams.get("force") !== "1") {
    try {
      const last = await prisma.cronRun.findUnique({ where: { job: "pipeline-reminders" } });
      if (last && new Date(last.ranAt) >= startOfToday) {
        return NextResponse.json({ ok: true, skipped: "already ran today", ranAt: last.ranAt });
      }
    } catch { /* table missing → proceed */ }
  }
  // Active stages only — no point nudging won/lost. Re-nag every morning until
  // the follow-up is marked done: send if not already reminded today, and skip
  // any that are completed (followUpDoneAt set).
  const due = await prisma.lead.findMany({
    where: {
      followUpAt: { not: null, lte: now },
      followUpDoneAt: null,
      OR: [{ reminderSentAt: null }, { reminderSentAt: { lt: startOfToday } }],
      pipelineStage: { in: ["LEAD", "QUALIFIED"] },
      // Agent-desk (Jessica) follow-ups are handled separately below and must
      // NEVER appear in a human owner personal due list (Benjy 7/16).
      NOT: { ownerName: { equals: "Jessica", mode: "insensitive" } },
    },
    orderBy: { followUpAt: "asc" },
  });
  // (No early return here — the agent chase engine below must run even when
  // there are no follow-up reminders due. Bug fix, Benjy 6/26.)

  // Map owner display names → real mailbox emails. Known owners are hardcoded
  // (deterministic — the User table has several duplicate-name rows); anything
  // unknown falls back to Benjy.
  const OWNER_EMAILS: Record<string, string> = { benjy: "bwaxman@cndprinting.com", albert: "awaxman@cndprinting.com", nitay: "nlaor@cndprinting.com", shimmie: "sjacoby@cndprinting.com", kelsey: "kjacobsen@cndprinting.com", suzanne: "salvarez@cndprinting.com" };
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { name: true, email: true } });
  const emailFor = (ownerName: string | null): string => {
    if (!ownerName || ownerName.toUpperCase() === "TBD") return FALLBACK_TO;
    const first = ownerName.trim().toLowerCase().split(/\s+/)[0];
    if (OWNER_EMAILS[first]) return OWNER_EMAILS[first];
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
        source: { in: ["inbound", "mailercity"] },
        OR: [
          {
            pipelineStage: { in: ["LEAD", "QUALIFIED"] },
            OR: [
              // Hand-off states nag until a real person takes ownership: changing the
              // lead's Owner to yourself (not Jessica/TBD) tells Godzilla you're on it
              // and drops it from this digest (Benjy 7/14, Avini -> Suzanne).
              { agentStatus: { in: ["owner_handling", "needs_review", "needs_owner", "mailercity_handoff"] }, OR: [{ ownerName: { in: ["Jessica", "TBD"], mode: "insensitive" } }, { ownerName: null }] },
              { agentStatus: { in: ["quote_received", "needs_info"] } },
              { agentStatus: { in: ["awaiting_mary", "awaiting_customer_info", "info_nudge_1", "mailercity_qualifying", "awaiting_customer_file"] }, agentNextAt: { lt: stale } },
            ],
          },
          // CATCH-ALL stuck sweep (Benjy 7/23): ANY live agent state with no
          // future clock and no movement for 3+ days escalates here, whatever
          // the status or pipeline stage — Sunny Brooke sat in "replied" and
          // two spam leads sat in "needs_review" for weeks because the digest
          // only looked for the states it knew about. Never again.
          {
            // Only OPEN leads. Moving a lead to Lost or Customer is a human
            // saying "this is finished" — the sweep must not keep nagging
            // about it (Benjy 8/3: Teresa was already Lost, Sunken already a
            // customer, and both still showed up).
            pipelineStage: { in: ["LEAD", "QUALIFIED"] },
            agentStatus: { notIn: ["closed", "declined", "disqualified", "duplicate", "unsubscribed", "done", "owner_handling"] },
            agentNextAt: null,
            updatedAt: { lt: stale },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    if (inbound.length) {
      const needLabel = (l: any): string => {
        switch (l.agentStatus) {
          case "quote_received": return "Approve &amp; send Mary's quote to the customer (reply 'approved' to the Approve email)";
          case "replied": return "Customer replied - review and respond";
          case "owner_handling": return "Existing account - reach out to them directly";
          case "needs_review": return "Review - flagged possible scam";
          case "needs_info":
          case "needs_owner": return "Mary needs something / a decision from you";
          case "awaiting_mary": return "Stalled - Mary hasn't quoted yet, give her a nudge";
          case "mailercity_handoff": return "MailerCity lead qualified - follow up on their mailer";
          case "mailercity_qualifying": return "MailerCity - customer hasn't answered the qualifying questions";
          case "awaiting_customer_file": return "Customer hasn't sent the item Mary needs - consider a personal nudge";
          default: return "Stalled - customer hasn't sent info, consider a personal nudge";
        }
      };
      // Every row carries its own "I've got this" link, so the same three
      // leads stop coming back every morning with no way to clear them
      // (Benjy 8/6). The token IS the credential — mint one for any lead that
      // never got through the agent flow, or the link can't be built.
      const BASE = "https://packaging.cndprinting.com";
      for (const l of inbound as any[]) {
        if (!l.agentToken) {
          l.agentToken = crypto.randomUUID();
          await prisma.lead.update({ where: { id: l.id }, data: { agentToken: l.agentToken } });
        }
      }
      const rows = inbound.map((l: any) => {
        const done = `${BASE}/api/agent?action=handled&id=${l.id}&token=${l.agentToken}`;
        return `<li style="margin-bottom:12px;"><strong>${l.companyName}</strong>${l.contactName ? ` <span style="color:#888;">(${l.contactName})</span>` : ""}<br><span style="color:#27AAE1;">${needLabel(l)}</span>${l.stage ? ` <span style="color:#aaa;">· ${l.stage}</span>` : ""}<br><a href="${done}" style="display:inline-block;margin-top:4px;color:#0a8043;font-size:12px;text-decoration:none;">&#10003; I&#39;ve got this - stop reminding me</a></li>`;
      }).join("");
      const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;"><p>These inbound inquiries need a human - the agent has taken them as far as it can on its own:</p><ul style="padding-left:18px;">${rows}</ul><p style="margin-top:16px;"><a href="${PORTAL}" style="color:#27AAE1;">Open the sales pipeline →</a></p><p style="color:#888;font-size:12px;margin-top:14px;">A lead drops off this list when you click "I&#39;ve got this", take ownership of it in the pipeline, or move it to Lost / Existing customer.</p><p style="color:#aaa;font-size:11px;margin-top:16px;">Automated to-do from Godzilla.</p></div>`;
      const { OWNERS, agentSend } = await import("@/lib/agent/agent");
      await agentSend({ to: OWNERS, subject: `Inbound leads needing your attention (${inbound.length})`, body });
      inboundDigest = inbound.length;
    }
  } catch (e) { console.error("[Godzilla CRON] inbound digest failed", e); }

  // Agent-desk (Jessica) follow-ups (Benjy 7/16): stale human follow-up dates on
  // agent-owned leads must not land in any personal list. If the agent has an
  // active sequence (or the lead is still queued for its intro), the human
  // reminder is redundant — auto-complete it with a note. Anything left goes to
  // the owners as ONE clearly-labeled agent-desk email.
  let agentDesk = 0;
  try {
    const jDue = await prisma.lead.findMany({
      where: { ownerName: { equals: "Jessica", mode: "insensitive" }, followUpAt: { not: null, lte: now }, followUpDoneAt: null, pipelineStage: { in: ["LEAD", "QUALIFIED"] } },
      select: { id: true, companyName: true, pipelineStage: true, stage: true, followUpNote: true, agentStatus: true, outreachStatus: true, commentary: true },
      take: 100,
    });
    const ACTIVE_A = ["awaiting_customer_info", "info_nudge_1", "awaiting_mary", "quote_received", "sent", "followup_1", "followup_2", "followup_3", "mailercity_qualifying", "awaiting_customer_file"];
    const ACTIVE_O = ["intro_sent", "followup_1"];
    const needHuman: typeof jDue = [];
    for (const l of jDue) {
      const agentOnIt = (l.agentStatus && ACTIVE_A.includes(l.agentStatus)) || (l.outreachStatus && ACTIVE_O.includes(l.outreachStatus)) || (l.pipelineStage === "LEAD" && l.outreachStatus === null);
      if (agentOnIt) {
        await prisma.lead.update({ where: { id: l.id }, data: { followUpDoneAt: now, commentary: `${l.commentary || ""}
[Agent] Cleared a stale human follow-up date - this lead is on the agent cadence.`.slice(0, 8000) } });
      } else {
        needHuman.push(l);
      }
    }
    if (needHuman.length) {
      const rows = needHuman.map((l) => `<li style="margin-bottom:8px;"><strong>${l.companyName}</strong> <span style="color:#888;">(${l.pipelineStage === "QUALIFIED" ? "Qualified" : "Lead"}${l.stage ? ` · ${l.stage}` : ""} · agent: ${l.outreachStatus || l.agentStatus || "idle"})</span>${l.followUpNote ? ` — ${l.followUpNote}` : ""}</li>`).join("");
      const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;"><p>These are <strong>agent-desk (Jessica) leads</strong> with a follow-up date due — the agent has no active sequence on them, so a human should decide: restart outreach, take it over, or clear the date. This is not your personal list.</p><ul style="padding-left:18px;">${rows}</ul><p style="margin-top:16px;"><a href="${PORTAL}" style="color:#27AAE1;">Open the sales pipeline →</a></p><p style="color:#aaa;font-size:11px;margin-top:20px;">Automated from Godzilla.</p></div>`;
      await sendEmail({ from: SENDER, to: ["bwaxman@cndprinting.com", "nlaor@cndprinting.com", "awaxman@cndprinting.com"], subject: `Agent desk (Jessica): follow-ups due (${needHuman.length})`, body });
      agentDesk = needHuman.length;
    }
  } catch (e) { console.error("[Godzilla CRON] agent-desk follow-ups failed", e); }

  // Owner accountability nags (Benjy 7/14): some owners (Albert) forget to keep
  // next-step dates current. Every QUALIFIED / CUSTOMER record they own should
  // always carry a live follow-up date — flag any with NO date or a LAPSED date
  // (past and never rescheduled), daily, with the configured watchers CC'd.
  const ACCOUNTABILITY: { owner: string; to: string; cc: string[] }[] = [
    { owner: "Albert", to: "awaxman@cndprinting.com", cc: ["bwaxman@cndprinting.com", "nlaor@cndprinting.com"] },
  ];
  let accountability = 0;
  try {
    for (const a of ACCOUNTABILITY) {
      const missing = await prisma.lead.findMany({
        where: {
          ownerName: { equals: a.owner, mode: "insensitive" },
          pipelineStage: { in: ["QUALIFIED", "CUSTOMER"] },
          OR: [{ followUpAt: null }, { followUpAt: { lt: startOfToday } }],
        },
        orderBy: [{ pipelineStage: "asc" }, { companyName: "asc" }],
        take: 100,
        select: { companyName: true, pipelineStage: true, stage: true, followUpAt: true, followUpDoneAt: true },
      });
      if (!missing.length) continue;
      const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const rows = missing.map((l: any) => {
        const tab = l.pipelineStage === "CUSTOMER" ? "Customer" : "Qualified";
        const state = !l.followUpAt ? "no follow-up date set" : (l.followUpDoneAt ? `last follow-up done, no new date (was ${fmt(l.followUpAt)})` : `date lapsed ${fmt(l.followUpAt)} - reschedule or mark done`);
        return `<li style="margin-bottom:8px;"><strong>${l.companyName}</strong> <span style="color:#888;">(${tab}${l.stage ? ` · ${l.stage}` : ""})</span><br><span style="color:#B45309;">${state}</span></li>`;
      }).join("");
      const body = `<div style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.6;"><p>Hi ${a.owner},</p><p><strong>${missing.length}</strong> of your qualified prospects / customers ${missing.length === 1 ? "is" : "are"} missing a next-step date. Set a follow-up date on each (or mark the last one done and pick a new date) and this reminder stops:</p><ul style="padding-left:18px;">${rows}</ul><p style="margin-top:16px;"><a href="${PORTAL}" style="color:#27AAE1;">Open the sales pipeline →</a></p><p style="color:#aaa;font-size:11px;margin-top:20px;">Daily until the dates are set. Automated from Godzilla.</p></div>`;
      const res = await sendEmail({ from: SENDER, to: a.to, cc: a.cc, subject: `${a.owner}: ${missing.length} account${missing.length === 1 ? "" : "s"} need a next-step date`, body });
      if (res.success) accountability += missing.length;
    }
  } catch (e) { console.error("[Godzilla CRON] accountability nag failed", e); }

  try {
    await prisma.cronRun.upsert({
      where: { job: "pipeline-reminders" },
      create: { job: "pipeline-reminders", ranAt: new Date() },
      update: { ranAt: new Date() },
    });
  } catch { /* guard table missing — non-fatal */ }
  return NextResponse.json({ ok: true, emails: sent, reminders: sentLeadIds.length, agentActed: agent.acted, inboundDigest, accountability });
}
