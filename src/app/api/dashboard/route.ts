import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const DONE = ["DELIVERED", "INVOICED"];
function onTimePct(jobs: any[]): number | null {
  const done = jobs.filter((j) => DONE.includes(j.status) && j.dueDate);
  if (!done.length) return null;
  const onTime = done.filter((j) => new Date(j.updatedAt) <= new Date(new Date(j.dueDate).getTime() + 86400e3));
  return Math.round((onTime.length / done.length) * 1000) / 10;
}
function cycleDays(jobs: any[]): number | null {
  const done = jobs.filter((j) => DONE.includes(j.status));
  if (!done.length) return null;
  const avg = done.reduce((t, j) => t + (new Date(j.updatedAt).getTime() - new Date(j.createdAt).getTime()), 0) / done.length / 86400e3;
  return Math.round(avg * 10) / 10;
}

export async function GET() {
  try {
    const session = await getSession();
    const prismaModule = await import("@/lib/prisma");
    const prisma = prismaModule.default;

    if (!prisma) {
      return NextResponse.json({ kpis: { openJobs: 0, inProduction: 0, dueThisWeek: 0, lateJobs: 0, blockedJobs: 0, proofsPending: 0, materialShortages: 0, readyToShip: 0, onTimeShipmentPct: 0, avgCycleTimeDays: 0 }, alerts: [], recentJobs: [], source: "empty" });
    }

    const now = new Date();
    const weekFromNow = new Date(); weekFromNow.setDate(weekFromNow.getDate() + 7);

    // Build where clause based on role
    const isCustomer = session?.role === "CUSTOMER";
    // Real jobs only (Benjy 11/19): test jobs from before go-live don't count.
    const { JOBS_LIVE_SINCE } = await import("@/lib/press-gate");
    const jobWhere = isCustomer && session.companyId ? { order: { companyId: session.companyId } } : { createdAt: { gte: JOBS_LIVE_SINCE } };

    const [allJobs, alerts] = await Promise.all([
      prisma.job.findMany({ where: jobWhere, include: { order: { include: { company: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.alert.findMany({ where: { resolvedAt: null }, orderBy: { createdAt: "desc" }, take: 10 }),
    ]);

    const productionStatuses = ["PRINTING", "COATING_FINISHING", "DIE_CUTTING", "GLUING_FOLDING"];
    const openStatuses = ["QUOTE", "ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PROOFING", "CUSTOMER_APPROVAL", "PREPRESS", "PLATING", "MATERIALS_ORDERED", "MATERIALS_RECEIVED", "SCHEDULED", "PRINTING", "COATING_FINISHING", "DIE_CUTTING", "GLUING_FOLDING", "QA", "PACKED"];

    const openJobs = allJobs.filter(j => openStatuses.includes(j.status));
    const inProduction = allJobs.filter(j => productionStatuses.includes(j.status));
    const dueThisWeek = allJobs.filter(j => j.dueDate && j.dueDate >= now && j.dueDate <= weekFromNow);
    const lateJobs = allJobs.filter(j => j.dueDate && j.dueDate < now && !["SHIPPED", "DELIVERED", "INVOICED"].includes(j.status));
    const packedJobs = allJobs.filter(j => j.status === "PACKED");

    const kpis = {
      openJobs: openJobs.length,
      inProduction: inProduction.length,
      dueThisWeek: dueThisWeek.length,
      lateJobs: lateJobs.length,
      blockedJobs: 0, // Would need a blocked flag on jobs
      proofsPending: 0,
      materialShortages: 0,
      readyToShip: packedJobs.length,
      // Measured, not typed in (Benjy 11/19): on time = delivered on or before its due date;
      // cycle time = entered to delivered. Empty until real jobs deliver.
      onTimeShipmentPct: onTimePct(allJobs),
      avgCycleTimeDays: cycleDays(allJobs),
    };

    const recentJobs = allJobs.slice(0, 8).map(j => ({
      id: j.id, jobNumber: j.jobNumber, name: j.name,
      companyName: j.order.company.name, status: j.status, priority: j.priority,
      quantity: j.quantity, dueDate: j.dueDate?.toISOString().split("T")[0] || "",
      isLate: j.dueDate ? j.dueDate < now && !["SHIPPED", "DELIVERED", "INVOICED"].includes(j.status) : false,
      isBlocked: false,
    }));

    const formattedAlerts = alerts.map(a => ({
      id: a.id, type: a.type, severity: a.severity, message: a.message,
      createdAt: a.createdAt.toISOString().split("T")[0],
    }));

    return NextResponse.json({ kpis, alerts: formattedAlerts, recentJobs, source: "database" });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json({ kpis: { openJobs: 0, inProduction: 0, dueThisWeek: 0, lateJobs: 0, blockedJobs: 0, proofsPending: 0, materialShortages: 0, readyToShip: 0, onTimeShipmentPct: 0, avgCycleTimeDays: 0 }, alerts: [], recentJobs: [], source: "error" });
  }
}
