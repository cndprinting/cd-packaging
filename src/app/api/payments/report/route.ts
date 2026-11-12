import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { salesReport, salesReportCsv } from "@/lib/ar";

// Yearly sales by customer and by sales rep (Denise 11/12). JSON for the page,
// ?format=csv for a download she can hand to the CPA or paste into Excel.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "GM", "ADMIN", "ACCOUNTING"].includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sp = new URL(request.url).searchParams;
  const year = Number(sp.get("year") || new Date().getFullYear());
  if (!Number.isInteger(year) || year < 2020 || year > 2100) return NextResponse.json({ error: "year must be YYYY" }, { status: 400 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const report = await salesReport(prisma, year);
  if (sp.get("format") === "csv") {
    return new NextResponse(salesReportCsv(report), { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="godzilla-sales-${year}.csv"` } });
  }
  return NextResponse.json(report);
}
