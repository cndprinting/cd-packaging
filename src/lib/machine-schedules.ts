// Darrin's machine schedules (11/18/26). Built from his routing: the press he
// picked, the die cutter and the gluer for letterpress jobs. He sets the order;
// the floor gets a printout (no screens at the machines yet).
import { JOBS_LIVE_SINCE } from "@/lib/press-gate";

type Kind = "press" | "diecutter" | "gluer" | "task";
// From his FileMaker list (confirmed 11/18). Machines come from the routing
// picks; Folder/Stitcher/SeCap/Inserter from the production checkboxes ("these
// tasks are what make the job appear in different schedules"). Hand Bindery
// stays in his Excel. Plating, Digital, Bindery wait on his answer.
export const MACHINE_SCHEDULES: { code: string; name: string; kind: Kind; task?: string }[] = [
  { code: "KOM-0172", name: "Press 0172", kind: "press" },
  { code: "KOM-0153", name: "Press 0153", kind: "press" },
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
const FIELD: Record<Kind, string> = { press: "pressAssignment", diecutter: "dieCutterCode", gluer: "gluerCode", task: "routeTasks" };
// A job leaves a machine's list once it's past that step.
const FLOW = ["ARTWORK_RECEIVED", "STRUCTURAL_DESIGN", "PROOFING", "CUSTOMER_APPROVAL", "PREPRESS", "PLATING", "MATERIALS_ORDERED", "MATERIALS_RECEIVED", "SCHEDULED", "PRINTING", "COATING_FINISHING", "DIE_CUTTING", "GLUING_FOLDING", "QA", "PACKED", "SHIPPED", "DELIVERED", "INVOICED"];
// Bindery steps have no status of their own, so they stay on until QA / packed.
const DONE_AFTER: Record<Kind, string> = { press: "PRINTING", diecutter: "DIE_CUTTING", gluer: "GLUING_FOLDING", task: "GLUING_FOLDING" };
const onIt = (j: any, m: { code: string; kind: Kind; task?: string }) => (m.kind === "task" ? String(j.routeTasks || "").includes(`"${m.task}"`) : j[FIELD[m.kind]] === m.code);
const stillOpen = (status: string, kind: Kind) => FLOW.indexOf(status) <= FLOW.indexOf(DONE_AFTER[kind]);

export async function machineSchedules(prisma: any, codes?: string[]) {
  const list = MACHINE_SCHEDULES.filter((m) => !codes?.length || codes.includes(m.code));
  const jobs = await prisma.job.findMany({
    where: { createdAt: { gte: JOBS_LIVE_SINCE }, routedAt: { not: null }, OR: list.map((m) => (m.kind === "task" ? { routeTasks: { contains: `"${m.task}"` } } : { [FIELD[m.kind]]: m.code })) },
    select: { id: true, jobNumber: true, name: true, quantity: true, dueDate: true, status: true, priority: true, inkFront: true, inkBack: true, foils: true, dieNumber: true, routeStatus: true, generalNotes: true, routeTasks: true, pressAssignment: true, dieCutterCode: true, gluerCode: true, order: { select: { company: { select: { name: true } } } } } as any,
  });
  const orders = await prisma.scheduleOrder.findMany({ where: { machineCode: { in: list.map((m) => m.code) } } });
  return list.map((m) => {
    const pos = new Map(orders.filter((o: any) => o.machineCode === m.code).map((o: any) => [o.jobId, o.position]));
    const mine = jobs.filter((j: any) => onIt(j, m) && stillOpen(j.status, m.kind));
    mine.sort((a: any, b: any) => {
      const pa = pos.has(a.id) ? (pos.get(a.id) as number) : 1e9, pb = pos.has(b.id) ? (pos.get(b.id) as number) : 1e9;
      if (pa !== pb) return pa - pb;
      return (a.dueDate ? +new Date(a.dueDate) : 9e15) - (b.dueDate ? +new Date(b.dueDate) : 9e15);
    });
    return {
      ...m,
      jobs: mine.map((j: any) => ({
        id: j.id, jobNumber: j.jobNumber, name: j.name, quantity: j.quantity, dueDate: j.dueDate, status: j.status, priority: j.priority,
        customer: j.order?.company?.name || "", inks: [j.inkFront, j.inkBack].filter(Boolean).join(" / ") || null, foils: j.foils || null,
        dieNumber: j.dieNumber || null, routeStatus: j.routeStatus || null, notes: j.generalNotes || null, placed: pos.has(j.id),
      })),
    };
  });
}
