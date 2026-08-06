import { NextRequest, NextResponse } from "next/server";
import { onMaryQuote, sendCustomerQuote } from "@/lib/agent/agent";

// Public, TOKEN-gated agent actions (Benjy 6/26) — Mary and the owners act
// straight from the email links, no login. Every call is validated against the
// lead's agentToken, so the URL itself is the credential.

async function load(id: string | null, token: string | null) {
  if (!id || !token) return { error: "Missing id or token", status: 400 as const };
  const prismaModule = await import("@/lib/prisma");
  const prisma = prismaModule.default;
  if (!prisma) return { error: "Database not available", status: 500 as const };
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead || lead.agentToken !== token) return { error: "Invalid link", status: 403 as const };
  return { prisma, lead };
}

// Plain HTML so a click straight from Outlook lands somewhere that reads like
// a confirmation, not a JSON blob.
function page(title: string, detail: string) {
  return new NextResponse(
    `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
    `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:15vh auto;padding:0 24px;text-align:center;color:#1a1a1a;">` +
    `<div style="font-size:44px;line-height:1;">&#10003;</div>` +
    `<h1 style="font-size:20px;margin:16px 0 8px;">${title}</h1>` +
    `<p style="color:#666;font-size:14px;line-height:1.6;">${detail}</p>` +
    `<p style="margin-top:24px;"><a href="https://packaging.cndprinting.com/dashboard/pipeline" style="color:#27AAE1;font-size:14px;">Open the sales pipeline &rarr;</a></p></div>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const r = await load(req.nextUrl.searchParams.get("id"), req.nextUrl.searchParams.get("token"));
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { lead } = r;

  // One-click "I've got this" straight from the daily digest (Benjy 8/6:
  // "how do these get marked as done so I stop receiving the same email every
  // morning"). Standing the agent down is exactly what a human taking over
  // means, and "closed" is excluded from every branch of the digest query.
  if (req.nextUrl.searchParams.get("action") === "handled") {
    const { prisma } = r;
    if (lead.agentStatus === "closed") {
      return page("Already marked handled", `<strong>${lead.companyName}</strong> is off the daily list. Nothing more to do.`);
    }
    const who = req.nextUrl.searchParams.get("by") || "a human";
    await prisma.lead.update({ where: { id: lead.id }, data: {
      agentStatus: "closed", agentNextAt: null,
      commentary: `${lead.commentary || ""}
[Digest] Marked handled by ${who} on ${new Date().toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" })} - removed from the daily to-do email.`.trim().slice(0, 8000),
    } });
    return page("Marked handled", `<strong>${lead.companyName}</strong> will stop appearing in the daily email. The lead stays open in the pipeline - only the reminder is cleared.`);
  }

  // Only expose what the action pages need.
  return NextResponse.json({ lead: {
    id: lead.id, companyName: lead.companyName, contactName: lead.contactName, contactEmail: lead.contactEmail,
    contactPhone: lead.contactPhone, commentary: lead.commentary, agentStatus: lead.agentStatus, agentQuote: lead.agentQuote,
    agentDraft: lead.agentDraft, hasPdfQuote: !!lead.agentQuoteMsgId,
  } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const r = await load(body.id, body.token);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { prisma, lead } = r;

  if (body.action === "submit_quote") {
    if (!body.quote?.trim()) return NextResponse.json({ error: "Quote is empty" }, { status: 400 });
    await onMaryQuote(prisma, lead, body.quote.trim());
    return NextResponse.json({ ok: true, message: "Quote received — the owners will review and send it." });
  }
  if (body.action === "mark_missing") {
    const note = body.note?.trim() || "Mary flagged missing info";
    await prisma.lead.update({ where: { id: lead.id }, data: {
      agentStatus: "needs_info", stage: "Needs info", agentNextAt: null,
      commentary: `${lead.commentary || ""}\n\n[Mary] Missing: ${note}`.trim(),
    } });
    // Best-effort: tell the owners a human needs to chase the customer.
    try {
      const { OWNERS, agentSend } = await import("@/lib/agent/agent");
      await agentSend({ to: OWNERS, subject: `Needs info: ${lead.companyName}`, body: `<p>Mary needs more from <strong>${lead.companyName}</strong> before quoting:</p><p>${note}</p>` });
    } catch { /* ignore */ }
    return NextResponse.json({ ok: true, message: "Flagged — the team will follow up with the customer." });
  }
  if (body.action === "approve_send") {
    if (lead.agentQuoteMsgId) {
      // Mary quoted via an attached PDF → forward it with a cover note.
      const { sendQuotePdfToCustomer } = await import("@/lib/agent/agent");
      await sendQuotePdfToCustomer(prisma, lead);
    } else {
      await sendCustomerQuote(prisma, lead);
    }
    return NextResponse.json({ ok: true, message: "Sent to the customer. Follow-ups are now scheduled." });
  }
  // Owner reviewed the agent's drafted reply → send it to the customer and
  // re-arm the chase so the back-and-forth continues.
  if (body.action === "approve_reply") {
    const reply = (body.reply || lead.agentDraft || "").trim();
    if (!reply) return NextResponse.json({ error: "No reply to send" }, { status: 400 });
    if (lead.contactEmail) {
      const { agentCustomerSend } = await import("@/lib/agent/agent");
      await agentCustomerSend(prisma, lead, { body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;">${reply}</div>` });
    }
    const next = new Date(); next.setDate(next.getDate() + 4); // re-arm follow-up clock
    await prisma.lead.update({ where: { id: lead.id }, data: { agentStatus: "sent", agentDraft: null, agentNextAt: next } });
    return NextResponse.json({ ok: true, message: "Reply sent to the customer. The agent will keep following up if they go quiet again." });
  }
  if (body.action === "mark_replied") {
    await prisma.lead.update({ where: { id: lead.id }, data: { agentStatus: "active", stage: "Active (replied)", agentNextAt: null } });
    return NextResponse.json({ ok: true, message: "Marked active — follow-ups stopped, it's in your hands now." });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
