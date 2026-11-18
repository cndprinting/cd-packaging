// Darrin's schedules (11/18/26). Built from his routing: the press he picked,
// the die cutter and gluer for letterpress jobs, the production checkboxes, and
// the job status. Plating is his nightly hand pick of what prints tomorrow.
// He sets the order; the floor gets a printout (no screens at the machines yet).
import { JOBS_LIVE_SINCE } from "@/lib/press-gate";

type Kind = "press" | "diecutter" | "gluer" | "task" | "status" | "plating";
// His FileMaker list, confirmed 11/18. Hand Bindery stays in his Excel.
export const MACHINE_SCHEDULES: { code: string; name: string; kind: Kind; task?: string; status?: string }[] = [
  { code: "PLATING", name: "Plating", kind: "plating" },
  { code: "KOM-0172", name: "Press 0172", kind: "press" },
  { code: "KOM-0153", name: "Press 0153", kind: "press" },
  { code: "STATUS-DIG", name: "Digital", kind: "status", status: "DIG" },
  { code: "STATUS-BND", name: "Bindery", kind: "status", status: "BND" },
  { code: "YOCO-85E", name: "Yoco 85e", kind: "diecutter" },
  { code: "YOCO-85T", name: "Yoco 85t", kind: "diecutter" },
  { code: "KLUGE-01", name: "Kluge", kind: "diecutter" },
  { code: "HEID-01", name: "Heidelberg", kind: "diecutter" },
  { code: "VEGA-01", name: "Vega gluer", kind: "gluer" },
  { code: "OMNI-FOLD", name: "Omni gluer", kind: "gluer" },
  { code: "TASK-FOLDING", name: "Folder", kind: "task", task: "folding" },
  { code: "TASK-STITCHING", name: "Stitcher", kind: "task", task: "stitching" },
  { code: "TASK-SECAP", name: "SeCap", kind: "task", task: "secap" },
  { code: "TASK-INSERTER", name: "Inserter", kind: "task", task: "inserter" },
];
const PRESS_CODES = MACHINE_SCHEDULES.filter((m) => m.kind === "press").map((m) => m.code);
const FIELD: Record<string, string> = { press: "pressAssignment", diecutter: "dieCutterCode", gluer: "gluerCode" };
// A job leaves a list once it's past that step.
const FLOW = ["ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PROOFING", "CUSTOMER_APPROVAL", "PREPRESS", "PLATING", "MATERIALS_ORDERED", "MATERIALS_RECEIVED", "SCHEDULED", "PRINTING", "COATING_FINISHING", "DIE_CUTTING", "GLUING_FOLDING", "QA", "PACKED", "SHIPPED", "DELIVERED", "INVOICED"];
// Bindery steps have no status of their own, so they stay on until QA / packed.
// Digital and Bindery follow Darrin's status (one per job; he changes it as it moves).
const DONE_AFTER: Record<Kind, string> = { press: "PRINTING", diecutter: "DIE_CUTTING", gluer: "GLUING_FOLDING", task: "GLUING_FOLDING", status: "QA", plating: "PRINTING" };
const stillOpen = (status: string, kind: Kind) => FLOW.indexOf(status) <= FLOW.indexOf(DONE_AFTER[kind]);

/** Tomorrow's date in Florida, as YYYY-MM-DD: what Darrin plates tonight. */
export function tomorrowET(): string {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  now.setDate(now.getDate() + 1);
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export const plateDay = (d: string) => new Date(`${d}T00:00:00.000Z`);

export async function machineSchedules(prisma: any, codes?: string[], opts: { plateDate?: string } = {}) {
  const list = MACHINE_SCHEDULES.filter((m) => !codes?.length || codes.includes(m.code));
  const plateDate = /^\d{4}-\d{2}-\d{2}$/.test(opts.plateDate || "") ? opts.plateDate! : tomorrowET();
  const picks = await prisma.platePick.findMany({ where: { plateDate: plateDay(plateDate) }, select: { jobId: true } });
  const picked = new Set(picks.map((x: any) => x.jobId));
  const or: any[] = [];
  for (const m of list) {
    if (m.kind === "task") or.push({ routeTasks: { contains: `"${m.task}"` } });
    else if (m.kind === "status") or.push({ routeStatus: m.status });
    else if (m.kind === "plating") or.push({ id: { in: [...picked] } });
    else or.push({ [FIELD[m.kind]]: m.code });
  }
  // Press schedules also carry the plating checkbox, so their jobs are needed for Plating's order.
  if (list.some((m) => m.kind === "plating")) or.push({ pressAssignment: { in: PRESS_CODES } });
  const jobs = or.length ? await prisma.job.findMany({
    where: { createdAt: { gte: JOBS_LIVE_SINCE }, routedAt: { not: null }, OR: or },
    select: { id: true, jobNumber: true, name: true, quantity: true, dueDate: true, status: true, priority: true, inkFront: true, inkBack: true, foils: true, dieNumber: true, routeStatus: true, routeTasks: true, generalNotes: true, pressAssignment: true, dieCutterCode: true, gluerCode: true, order: { select: { company: { select: { name: true } } } } } as any,
  }) : [];
  const orders = await prisma.scheduleOrder.findMany({ where: { machineCode: { in: [...list.map((m) => m.code), ...PRESS_CODES] } } });
  const posOf = (code: string) => new Map<string, number>(orders.filter((o: any) => o.machineCode === code).map((o: any) => [o.jobId as string, o.position as number]));
  const byOrder = (pos: Map<string, number>) => (a: any, b: any) => {
    const pa = pos.has(a.id) ? (pos.get(a.id) as number) : 1e9, pb = pos.has(b.id) ? (pos.get(b.id) as number) : 1e9;
    if (pa !== pb) return pa - pb;
    return (a.dueDate ? +new Date(a.dueDate) : 9e15) - (b.dueDate ? +new Date(b.dueDate) : 9e15);
  };
  const onIt = (j: any, m: (typeof MACHINE_SCHEDULES)[number]) =>
    m.kind === "task" ? String(j.routeTasks || "").includes(`"${m.task}"`)
    : m.kind === "status" ? j.routeStatus === m.status
    : m.kind === "plating" ? picked.has(j.id)
    : j[FIELD[m.kind]] === m.code;
  const shape = (j: any, placed: boolean) => ({
    id: j.id, jobNumber: j.jobNumber, name: j.name, quantity: j.quantity, dueDate: j.dueDate, status: j.status, priority: j.priority,
    customer: j.order?.company?.name || "", inks: [j.inkFront, j.inkBack].filter(Boolean).join(" / ") || null, foils: j.foils || null,
    dieNumber: j.dieNumber || null, routeStatus: j.routeStatus || null, notes: j.generalNotes || null, placed,
    press: j.pressAssignment || null, plate: picked.has(j.id),
  });
  return list.map((m) => {
    const mine = jobs.filter((j: any) => onIt(j, m) && stillOpen(j.status, m.kind));
    if (m.kind === "plating") {
      // In press order: 0172's list, then 0153's, each in Darrin's order.
      const pressRank = (j: any) => { const i = PRESS_CODES.indexOf(j.pressAssignment); return i < 0 ? 99 : i; };
      mine.sort((a: any, b: any) => pressRank(a) - pressRank(b) || byOrder(posOf(a.pressAssignment || ""))(a, b));
      return { ...m, plateDate, jobs: mine.map((j: any) => shape(j, true)) };
    }
    const pos = posOf(m.code);
    mine.sort(byOrder(pos));
    return { ...m, plateDate: m.kind === "press" ? plateDate : undefined, jobs: mine.map((j: any) => shape(j, pos.has(j.id))) };
  });
}
