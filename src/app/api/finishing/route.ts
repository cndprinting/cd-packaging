import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { JOBS_LIVE_SINCE } from "@/lib/press-gate";
import { MAKER_ROLES } from "@/lib/prototypes";

// Finishing board (Benjy 11/18, Todd). Every job headed to finishing, with its
// die status, so a die that has to be ordered shows up when the job is entered,
// not when it lands on the cutter.
// GET            -> { columns, diesToOrder }
// POST { action: "move", jobId, status }            -> next finishing step
// POST { action: "set_die", jobId, dieNumber }      -> die from the rack
// POST { action: "die_ordered" | "die_received", jobId, vendor?, poNumber? }
const FINISHING_COLUMNS = [
  { key: "coming", label: "Coming off press", statuses: ["SCHEDULED", "PRINTING"] },
  { key: "coating", label: "Coating / foil", statuses: ["COATING_FINISHING"] },
  { key: "diecut", label: "Die cutting", statuses: ["DIE_CUTTING"] },
  { key: "glue", label: "Gluing / folding", statuses: ["GLUING_FOLDING"] },
  { key: "qa", label: "QA / packing", statuses: ["QA"] },
];
const ALL = FINISHING_COLUMNS.flatMap((c) => c.statuses);
const VIEW = [...MAKER_ROLES, "CSR", "ACCOUNTING", "PREPRESS_MANAGER", "DIGITAL_PRESS", "SALES_REP", "SALES_MANAGER", "SHIPPING"];
const OPEN = ["ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PROOFING", "CUSTOMER_APPROVAL", "PREPRESS", "PLATING", "MATERIALS_ORDERED", "MATERIALS_RECEIVED", ...ALL];

async function dieState(prisma: any, job: any, inRack: Set<string>) {
  const flag = (job.purchases || []).find((f: any) => f.category === "cutting_die");
  if (job.productType === "COMMERCIAL_PRINT" && !flag) return { state: "none", label: "No die", flagId: null };
  if (job.dieNumber && inRack.has(job.dieNumber.toUpperCase())) return { state: "rack", label: `Die ${job.dieNumber} in the rack`, flagId: flag?.id || null };
  if (flag?.status === "received") return { state: "received", label: `New die received${job.dieNumber ? ` (${job.dieNumber})` : ""}`, flagId: flag.id };
  if (flag?.status === "ordered") return { state: "ordered", label: `Die ordered${flag.vendor ? ` from ${flag.vendor}` : ""}${flag.orderedDate ? `, ${new Date(flag.orderedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`, flagId: flag.id };
  if (job.dieNumber) return { state: "unknown", label: `Die ${job.dieNumber} (not found in the rack list)`, flagId: flag?.id || null };
  return { state: "needed", label: "Die not set", flagId: flag?.id || null };
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !VIEW.includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ columns: [], diesToOrder: [] });
  const includeTest = request.nextUrl.searchParams.get("all") === "1";
  const jobs = await prisma.job.findMany({
    where: { status: { in: OPEN }, ...(includeTest ? {} : { createdAt: { gte: JOBS_LIVE_SINCE } }) },
    include: { order: { include: { company: { select: { name: true } } } }, purchases: true, csr: { select: { name: true } }, salesRep: { select: { name: true } } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
    take: 500,
  });
  const nums = jobs.map((j: any) => j.dieNumber).filter(Boolean).map((d: string) => d.toUpperCase());
  const rack = new Set<string>(nums.length ? (await prisma.cuttingDie.findMany({ where: { dieNumber: { in: nums }, isActive: true }, select: { dieNumber: true } })).map((d: any) => d.dieNumber.toUpperCase()) : []);
  const now = Date.now();
  const out = await Promise.all(jobs.map(async (j: any) => ({
    id: j.id, jobNumber: j.jobNumber, name: j.name, status: j.status, quantity: j.quantity, dueDate: j.dueDate, priority: j.priority,
    customer: j.order?.company?.name || "", csr: j.csr?.name || null, rep: j.salesRep?.name || j.repName || null,
    coating: j.coating || null, productType: j.productType, dieNumber: j.dieNumber || null,
    die: await dieState(prisma, j, rack),
    late: !!j.dueDate && new Date(j.dueDate).getTime() < now,
    test: new Date(j.createdAt) < JOBS_LIVE_SINCE,
  })));
  const columns = FINISHING_COLUMNS.map((c) => ({ ...c, jobs: out.filter((j: any) => c.statuses.includes(j.status)) }));
  // Dies to order: any open job (not just ones in finishing) whose die isn't in hand.
  const diesToOrder = out.filter((j: any) => j.die.state === "needed" || j.die.state === "unknown");
  const diesOnOrder = out.filter((j: any) => j.die.state === "ordered");
  return NextResponse.json({ columns, diesToOrder, diesOnOrder, canAct: MAKER_ROLES.includes(session.role) || ["CSR"].includes(session.role) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !(MAKER_ROLES.includes(session.role) || session.role === "CSR")) return NextResponse.json({ error: "Finishing updates are Todd's (and the plant's)" }, { status: 403 });
  const prisma: any = (await import("@/lib/prisma")).default;
  if (!prisma) return NextResponse.json({ error: "Database not available" }, { status: 500 });
  const b = await request.json().catch(() => ({}));
  const job = await prisma.job.findUnique({ where: { id: String(b.jobId || "") }, include: { purchases: true } });
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const log = (details: string) => prisma.activityLog.create({ data: { orderId: job.orderId, userId: session.id, action: "FINISHING", details } }).catch(() => {});
  const flag = (job.purchases || []).find((f: any) => f.category === "cutting_die");
  const t = (v: unknown, max = 100) => String(v ?? "").trim().slice(0, max);

  if (b.action === "move") {
    const to = String(b.status || "");
    if (![...ALL.filter((s) => s !== "SCHEDULED"), "PACKED"].includes(to)) return NextResponse.json({ error: "Not a finishing step" }, { status: 400 });
    const { checkPressGate } = await import("@/lib/press-gate");
    const gate = await checkPressGate(prisma, job.id, to);
    if (gate) return NextResponse.json({ error: gate }, { status: 409 });
    await prisma.job.update({ where: { id: job.id }, data: { status: to } });
    await log(`${job.jobNumber} moved to ${to} by ${session.name}`);
  } else if (b.action === "set_die") {
    const dn = t(b.dieNumber, 40).toUpperCase();
    await prisma.job.update({ where: { id: job.id }, data: { dieNumber: dn || null } });
    const inRack = dn ? await prisma.cuttingDie.findUnique({ where: { dieNumber: dn }, select: { id: true } }) : null;
    if (inRack && flag && flag.status === "needed") await prisma.purchaseFlag.update({ where: { id: flag.id }, data: { status: "received", notes: `Existing die ${dn} from the rack (${session.name})` } });
    await log(`${job.jobNumber} die set to ${dn || "none"} by ${session.name}`);
  } else if (b.action === "die_ordered" || b.action === "die_received") {
    const data: any = b.action === "die_ordered"
      ? { status: "ordered", orderedDate: new Date(), vendor: t(b.vendor) || flag?.vendor || null, poNumber: t(b.poNumber, 60) || flag?.poNumber || null }
      : { status: "received", receivedDate: new Date() };
    if (flag) await prisma.purchaseFlag.update({ where: { id: flag.id }, data });
    else await prisma.purchaseFlag.create({ data: { jobId: job.id, category: "cutting_die", description: `Cutting die for ${job.name}`, ...data } });
    if (b.dieNumber) await prisma.job.update({ where: { id: job.id }, data: { dieNumber: t(b.dieNumber, 40).toUpperCase() } });
    await log(`${job.jobNumber} cutting die ${data.status} by ${session.name}${data.vendor ? ` (${data.vendor})` : ""}`);
  } else return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
