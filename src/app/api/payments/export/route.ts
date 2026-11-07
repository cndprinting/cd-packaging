import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { sageExportCsv } from "@/lib/ar";

// Monthly CSV for Sage (GL stays in Sage): invoices billed + payments received.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "GM", "ADMIN", "ACCOUNTING"].includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const month = new URL(request.url).searchParams.get("month") || new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  const prisma = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const csv = await sageExportCsv(prisma, month);
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="godzilla-ar-${month}.csv"` } });
}
