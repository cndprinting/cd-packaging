import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  return NextResponse.json({
    activeTimers: [],
    recentEntries: [
      { id: "tc-1", jobNumber: "PKG-2026-001", jobName: "Organic Cereal Box", department: "Press", operator: "Mike Torres", startTime: "08:15", endTime: "10:45", duration: "2h 30m" },
      { id: "tc-2", jobNumber: "PKG-2026-005", jobName: "Foundation Box", department: "QA", operator: "Sarah Johnson", startTime: "09:00", endTime: "09:45", duration: "0h 45m" },
      { id: "tc-3", jobNumber: "PKG-2026-012", jobName: "Wireless Earbuds Box", department: "Die Cutting", operator: "Mike Torres", startTime: "11:00", endTime: "13:30", duration: "2h 30m" },
    ],
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId, action, department } = await request.json();
    if (!jobId || !action) return NextResponse.json({ error: "Job ID and action required" }, { status: 400 });

    // In production, this would write to a TimeEntry table
    return NextResponse.json({
      ok: true,
      action,
      jobId,
      department,
      timestamp: new Date().toISOString(),
      operator: session.name,
    });
  } catch (error) {
    console.error("Timeclock error:", error);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
