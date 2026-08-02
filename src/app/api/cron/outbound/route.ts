import { NextRequest, NextResponse } from "next/server";

// These jobs poll a mailbox, call Claude, and send email — they need room.
// With no limit declared they were killed at Vercel's ~15s default MID-RUN,
// so the next run started over and re-sent what had already gone out. That
// is why Mary got the same nudge repeatedly (Benjy 7/27). Pro allows 300s.
export const maxDuration = 300;

// Runs the outbound prospecting sweep (Benjy 6/30). Secured by CRON_SECRET when
// set; also callable manually for testing. No-ops unless AGENT_OUTBOUND_ENABLED.
export async function GET(request: NextRequest) {
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
  try {
    const { processOutbound } = await import("@/lib/agent/outbound");
    const { processOutboundReplies } = await import("@/lib/agent/outbound-replies");
    const sweep = await processOutbound(prisma);
    const replies = await processOutboundReplies(prisma);
    return NextResponse.json({ ok: true, ...sweep, replies });
  } catch (e) {
    console.error("[Godzilla CRON] outbound failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
