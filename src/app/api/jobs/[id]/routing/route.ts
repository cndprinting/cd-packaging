import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { ROUTE_PRESSES, ROUTE_ROLES, ROUTE_STATUSES, ROUTE_TASKS, STATUS_ROLES, routingMachines, taskList } from "@/lib/routing";

// Darrin's routing review for one job (11/18/26).
// GET  -> current routing + machine options
// POST -> save it { routeStatus, routeTasks[], foils, inkFront, inkBack, pressAssignment, dieCutterCode, gluerCode }
// PATCH -> from the Jobs list (WIP screen): { routeStatus? , pressAssignment? } only
async function load(prisma: any, id: string) {
  return prisma.job.findUnique({ where: { id }, select: { id: true, jobNumber: true, routedAt: true, routedBy: true, routeStatus: true, routeTasks: true, foils: true, inkFront: true, inkBack: true, pressAssignment: true, dieCutterCode: true, gluerCode: true, routeNote: true, isTest: true } as any });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role === "CUSTOMER" || session.role === "VENDOR") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const { id } = await params;
  const job = await load(prisma, id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  return NextResponse.json({ routing: { ...job, routeTasks: taskList(job.routeTasks) }, machines: await routingMachines(prisma), statuses: ROUTE_STATUSES, presses: ROUTE_PRESSES, tasks: ROUTE_TASKS, canEdit: ROUTE_ROLES.includes(session.role), canStatus: STATUS_ROLES.includes(session.role) });
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
    inkFront: t(b.inkFront, 60), inkBack: t(b.inkBack, 60), routeNote: t(b.routeNote, 500),
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !STATUS_ROLES.includes(session.role)) return NextResponse.json({ error: "Routing is the plant manager's" }, { status: 403 });
  const plant = ROUTE_ROLES.includes(session.role);
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const { id } = await params;
  const job = await load(prisma, id);
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const b = await request.json().catch(() => ({}));
  const data: any = {};
  const said: string[] = [];
  if ("routeStatus" in b) {
    if (!ROUTE_STATUSES.some(([k]) => k === b.routeStatus)) return NextResponse.json({ error: "Pick the status" }, { status: 400 });
    data.routeStatus = b.routeStatus; said.push(`status ${b.routeStatus}`);
    // Only Darrin's first status counts as routing it; a CSR move leaves it on his "to route" list.
    if (!job.routedAt && plant) { data.routedAt = new Date(); data.routedBy = session.name; }
  }
  if ("pressAssignment" in b) {
    if (!plant) return NextResponse.json({ error: "Darrin picks the press" }, { status: 403 });
    if (b.pressAssignment && !ROUTE_PRESSES.some(([k]) => k === b.pressAssignment)) return NextResponse.json({ error: "Pick a press from the list" }, { status: 400 });
    data.pressAssignment = b.pressAssignment || null; said.push(`press ${ROUTE_PRESSES.find(([k]) => k === b.pressAssignment)?.[1] || "cleared"}`);
  }
  if (!said.length) return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  const upd = await prisma.job.update({ where: { id }, data, select: { orderId: true, routeStatus: true, pressAssignment: true, routedAt: true } });
  await prisma.activityLog.create({ data: { orderId: upd.orderId, userId: session.id, action: "ROUTED", details: `${job.jobNumber}: ${said.join(", ")} by ${session.name} (Jobs list)` } }).catch(() => {});
  return NextResponse.json({ ok: true, routeStatus: upd.routeStatus, pressAssignment: upd.pressAssignment, routed: !!upd.routedAt });
}
