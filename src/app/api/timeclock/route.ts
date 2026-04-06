import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) {
      return NextResponse.json({ activeTimers: [], recentEntries: [], source: "demo" });
    }

    const active = await prisma.timeEntry.findMany({
      where: { userId: session.id, endTime: null },
      include: { job: true },
    });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const recent = await prisma.timeEntry.findMany({
      where: { endTime: { not: null }, startTime: { gte: today } },
      include: { job: true, user: true },
      orderBy: { endTime: "desc" },
      take: 20,
    });

    return NextResponse.json({
      activeTimers: active.map(t => ({
        id: t.id, jobId: t.jobId, jobNumber: t.job.jobNumber, jobName: t.job.name,
        department: t.department, startTime: t.startTime.toISOString(),
        elapsed: Math.floor((Date.now() - t.startTime.getTime()) / 1000),
      })),
      recentEntries: recent.map(t => ({
        id: t.id, jobNumber: t.job.jobNumber, jobName: t.job.name,
        department: t.department, operator: t.user.name,
        duration: t.duration ? `${Math.floor(t.duration / 3600)}h ${Math.floor((t.duration % 3600) / 60)}m` : "",
      })),
      source: "database",
    });
  } catch (error) {
    console.error("Timeclock GET error:", error);
    return NextResponse.json({ activeTimers: [], recentEntries: [], source: "demo" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { jobId, action, department } = await request.json();
    if (!jobId || !action) return NextResponse.json({ error: "Job ID and action required" }, { status: 400 });

    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;
    if (!prisma) return NextResponse.json({ ok: true, action, jobId, department });

    if (action === "start") {
      const existing = await prisma.timeEntry.findFirst({ where: { jobId, userId: session.id, endTime: null } });
      if (existing) return NextResponse.json({ error: "Timer already running" }, { status: 409 });
      const entry = await prisma.timeEntry.create({ data: { jobId, userId: session.id, department: department || "Unknown", startTime: new Date() } });
      return NextResponse.json({ ok: true, action: "start", entryId: entry.id });
    }

    if (action === "stop") {
      const entry = await prisma.timeEntry.findFirst({ where: { jobId, userId: session.id, endTime: null }, orderBy: { startTime: "desc" } });
      if (!entry) return NextResponse.json({ error: "No active timer" }, { status: 404 });
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - entry.startTime.getTime()) / 1000);
      await prisma.timeEntry.update({ where: { id: entry.id }, data: { endTime, duration } });
      return NextResponse.json({ ok: true, action: "stop", duration });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Timeclock POST error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
