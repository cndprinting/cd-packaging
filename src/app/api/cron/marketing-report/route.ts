import { NextRequest, NextResponse } from "next/server";
import { buildLeadsLog, leadsLogCsv, leadsLogHtml } from "@/lib/marketing-report";
import { sendEmail } from "@/lib/email/graph-client";

export const maxDuration = 120;

// Runs on the 1st of each month (vercel.json). Emails Habib's leads log for
// the month that just ended. MARKETING_REPORT_TO = Habib's address (comma
// separated for more); owners are always copied. ?test=1 sends to Benjy only.
// ?format=csv returns the CSV instead of emailing (owners, for ad-hoc pulls).
const OWNER = "bwaxman@cndprinting.com";
const SENDER = process.env.AGENT_MAILBOX || "jwaxman@cndprinting.com";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  const key = request.nextUrl.searchParams.get("key");
  if (secret && auth !== `Bearer ${secret}` && key !== secret) {
    // fall back to a signed-in owner for ad-hoc pulls
    const { getSession } = await import("@/lib/session");
    const s = await getSession();
    if (!s || !["OWNER", "GM", "ADMIN"].includes(s.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });

  const { rows, months } = await buildLeadsLog(prisma);
  const csv = leadsLogCsv(rows);
  if (request.nextUrl.searchParams.get("format") === "csv") {
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="cnd-leads-log.csv"` } });
  }

  // report month = the month that just ended (or ?month=Sep 26)
  const prev = new Date(); prev.setUTCDate(1); prev.setUTCDate(0);
  const reportMonth = request.nextUrl.searchParams.get("month") || (prev.toLocaleString("en-US", { month: "short", timeZone: "America/New_York" }) + " " + String(prev.getFullYear()).slice(2));
  const test = request.nextUrl.searchParams.get("test") === "1";
  const habib = (process.env.MARKETING_REPORT_TO || "").split(",").map((s) => s.trim()).filter(Boolean);
  const to = test || habib.length === 0 ? [OWNER] : habib;
  const cc = test || habib.length === 0 ? [] : [OWNER, "nlaor@cndprinting.com"];
  const m = months.find((x) => x.month === reportMonth);
  const subject = `C&D leads log — ${reportMonth}: ${m?.leads ?? 0} leads, ${m?.quoted ?? 0} quoted, ${m?.won ?? 0} won${test ? " (TEST)" : ""}${habib.length === 0 && !test ? " (MARKETING_REPORT_TO not set)" : ""}`;
  const r = await sendEmail({
    from: SENDER, to, cc, subject,
    body: leadsLogHtml(rows, months, reportMonth),
    attachments: [{ name: `cnd-leads-log-${reportMonth.replace(/\s/g, "-")}.csv`, contentType: "text/csv", base64Content: Buffer.from(csv, "utf8").toString("base64") }],
  });
  console.log(`[Godzilla CRON] marketing report ${reportMonth}: ${rows.length} rows -> ${to.join(",")} ${r.success ? "sent" : "FAILED " + r.error}`);
  return NextResponse.json({ ok: r.success, error: r.error, reportMonth, rows: rows.length, months, to });
}
