import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ROUTE_ROLES } from "@/lib/routing";
import { MACHINE_SCHEDULES, machineSchedules } from "@/lib/machine-schedules";

// Darrin's machine schedules (11/18/26).
// GET ?m=CODE,CODE -> schedules (all seven if no m)
// POST { machineCode, order: [jobId, ...] } -> Darrin's job order for that machine
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ machines: [] });
  const m = (request.nextUrl.searchParams.get("m") || "").split(",").map((x) => x.trim()).filter(Boolean);
  return NextResponse.json({ machines: await machineSchedules(prisma, m), canEdit: ROUTE_ROLES.includes(session.role) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !ROUTE_ROLES.includes(session.role)) return NextResponse.json({ error: "The plant manager sets the order" }, { status: 403 });
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const b = await request.json().catch(() => ({}));
  const code = String(b.machineCode || "");
  if (!MACHINE_SCHEDULES.some((x) => x.code === code)) return NextResponse.json({ error: "Unknown schedule" }, { status: 400 });
  const ids: string[] = Array.isArray(b.order) ? b.order.map(String).slice(0, 300) : [];
  await prisma.$transaction([
    prisma.scheduleOrder.deleteMany({ where: { machineCode: code, jobId: { notIn: ids } } }),
    ...ids.map((jobId, i) => prisma.scheduleOrder.upsert({ where: { machineCode_jobId: { machineCode: code, jobId } }, create: { machineCode: code, jobId, position: i, updatedBy: session.name }, update: { position: i, updatedBy: session.name } })),
  ]);
  return NextResponse.json({ machines: await machineSchedules(prisma, [code]) });
}
