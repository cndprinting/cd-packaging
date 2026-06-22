import { NextRequest, NextResponse } from "next/server";

// Captures client-side render errors caught by the dashboard error boundary
// (Benjy 6/21) so we get the stack in server logs — used to pinpoint the
// estimator "froze / can't enter anything" crash when it recurs.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    // eslint-disable-next-line no-console
    console.error("[Godzilla CLIENT ERROR]", JSON.stringify({
      message: body?.message || null,
      path: body?.path || null,
      at: body?.at || null,
      digest: body?.digest || null,
      stack: body?.stack || null,
    }));
  } catch { /* never throw from the logger */ }
  return NextResponse.json({ ok: true });
}
