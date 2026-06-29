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

export async function GET(req: NextRequest) {
  const r = await load(req.nextUrl.searchParams.get("id"), req.nextUrl.searchParams.get("token"));
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });
  const { lead } = r;
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
