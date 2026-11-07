import { NextRequest, NextResponse } from "next/server";
import { runInvoiceReminders, agingReport, agingRecipients, AR_FROM } from "@/lib/ar";
import { sendEmail } from "@/lib/email/graph-client";

// Daily: payment reminders at due, +7, +14, +28 days. Mondays: the weekly
// aging report to accounting and the owners (Denise's item 3).
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const key = new URL(request.url).searchParams.get("key");
    if (auth !== `Bearer ${secret}` && key !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const now = new Date();
  const force = new URL(request.url).searchParams.get("aging") === "1";
  const sent = await runInvoiceReminders(prisma, now);
  let aging: string[] = [];
  if (now.getUTCDay() === 1 || force) {
    const rep = await agingReport(prisma, now);
    aging = await agingRecipients(prisma);
    if (aging.length) await sendEmail({ from: AR_FROM, to: aging, subject: `Receivables aging · ${rep.rows.length} open · ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(rep.total)} | Godzilla`, body: rep.html });
  }
  return NextResponse.json({ ok: true, reminders: sent, agingSentTo: aging });
}
