import { NextRequest, NextResponse } from "next/server";

// Runs the inbound reply handler on a schedule (Benjy 6/26). Frequent cadence
// so the lead↔agent conversation feels responsive. Secured by CRON_SECRET when
// set; also callable manually for testing.
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
    const { pollAgentInbox } = await import("@/lib/agent/inbox");
    const result = await pollAgentInbox(prisma);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[Godzilla CRON] agent-inbox failed", e);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
