import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ROUTE_PRESSES, ROUTE_ROLES, ROUTE_STATUSES, ROUTE_TASKS, routingMachines, taskList } from "@/lib/routing";

// Darrin's routing review for one job (11/18/26).
// GET  -> current routing + machine options
// POST -> save it { routeStatus, routeTasks[], foils, inkFront, inkBack, pressAssignment, dieCutterCode, gluerCode }
async function load(prisma: any, id: string) {
  return prisma.job.findUnique({ where: { id }, select: { id: true, jobNumber: true, routedAt: true, routedBy: true, routeStatus: true, routeTasks: true, foils: true, inkFront: true, inkBack: true, pressAssignment: true, dieCutterCode: true, gluerCode: true } as any });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const { id } = await params;
  const job = await load(prisma, id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ routing: { ...job, routeTasks: taskList(job.routeTasks) }, machines: await routingMachines(prisma), statuses: ROUTE_STATUSES, presses: ROUTE_PRESSES, tasks: ROUTE_TASKS, canEdit: ROUTE_ROLES.includes(session.role) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !ROUTE_ROLES.includes(session.role)) return NextResponse.json({ error: "Routing is the plant manager's" }, { status: 403 });
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const { id } = await params;
  const job = await load(prisma, id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const t = (v: unknown, max = 200) => (v === null || v === undefined ? null : String(v).trim().slice(0, max) || null);
  const status = ROUTE_STATUSES.some(([k]) => k === b.routeStatus) ? b.routeStatus : null;
  if (!status) return NextResponse.json({ error: "Pick the status" }, { status: 400 });
  const tasks = Array.isArray(b.routeTasks) ? b.routeTasks.filter((x: string) => ROUTE_TASKS.some(([k]) => k === x)) : [];
  const m = await routingMachines(prisma);
  const okCode = (code: unknown, list: { code: string }[]) => (code && list.some((x) => x.code === code) ? String(code) : null);
  const data: any = {
    routeStatus: status, routeTasks: JSON.stringify(tasks), foils: t(b.foils, 300),
    inkFront: t(b.inkFront, 60), inkBack: t(b.inkBack, 60),
    pressAssignment: ROUTE_PRESSES.some(([k]) => k === b.pressAssignment) ? b.pressAssignment : okCode(b.pressAssignment, m.presses) || t(b.pressAssignment, 60),
    dieCutterCode: tasks.includes("letterpress") ? okCode(b.dieCutterCode, m.dieCutters) : null,
    gluerCode: tasks.includes("letterpress") ? okCode(b.gluerCode, m.gluers) : null,
    routedAt: job.routedAt || new Date(), routedBy: job.routedBy || session.name,
  };
  await prisma.job.update({ where: { id }, data });
  const order = await prisma.job.findUnique({ where: { id }, select: { orderId: true } });
  await prisma.activityLog.create({ data: { orderId: order.orderId, userId: session.id, action: "ROUTED", details: `${job.jobNumber} routed by ${session.name}: ${status}${tasks.length ? `, ${tasks.join(", ")}` : ""}` } }).catch(() => {});
  const fresh = await load(prisma, id);
  return NextResponse.json({ routing: { ...fresh, routeTasks: taskList(fresh.routeTasks) } });
}
