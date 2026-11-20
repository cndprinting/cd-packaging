// Job routing (Darrin, 11/18/26). In FileMaker, Darrin gets every new job
// ticket, reviews it (inks, foils, status PRE/DIG/BND/OUT, production boxes) and
// that review decides which department and machine schedules the job lands on.
// Here: the plant gets a notice when a job is entered, the job waits on his
// "To route" list, and the routing panel on the job captures his review.
import { JOBS_LIVE_SINCE } from "@/lib/press-gate";

export const ROUTE_ROLES = ["SENIOR_PLANT_MANAGER", "PRODUCTION_MANAGER", "OWNER", "GM", "ADMIN"];
// Status also moves with the CSRs: they send a signed-off job from PRE to KOM / DIG ... (Darrin 11/20).
export const STATUS_ROLES = [...ROUTE_ROLES, "CSR", "SHIPPING"]; // Shayla moves jobs to COMP / DEL (Kelsey 11/20)
// One status per job; it changes as the job moves (Darrin 11/18).
// His FileMaker WIP Status drop-down, in his order (email 11/20/26).
export const ROUTE_STATUSES: [string, string][] = [
  ["PRE", "PRE · Prepress"], ["KOM", "KOM · Komori"], ["Ricoh", "Ricoh"], ["DIG", "DIG · Digital"], ["BND", "BND · Bindery"],
  ["Diecut", "Diecut"], ["GLUE", "GLUE"], ["SeCap", "SeCap"], ["Inserter", "Inserter"], ["P/O", "P/O · Packout"], ["ASI", "ASI"],
  ["OUT", "OUT · Outside vendor"], ["COMP", "COMP · Complete"], ["DEL", "DEL · Delivered"], ["HLD", "HLD · Hold"],
];
// His WIP Press drop-down (11/20). 29New / 29Old are the two Komori 29s, stored as
// the machine codes so the Press 0172 / 0153 schedules and plating pick them up.
export const ROUTE_PRESSES: [string, string][] = [
  ["KOM", "KOM"], ["DIG", "DIG"], ["Ricoh", "Ricoh"], ["KOM-0153", "29Old (0153)"], ["KOM-0172", "29New (0172)"],
  ["SeCap", "SeCap"], ["Ltr Press", "Ltr Press"], ["Glue", "Glue"],
];
export const ROUTE_TASKS: [string, string][] = [
  ["letterpress", "Letterpress"], ["folding", "Folding"], ["stitching", "Stitching"],
  ["inserter", "Inserter"], ["secap", "SeCap (inkjet)"], ["handBindery", "Hand Bindery"],
];
export const taskList = (raw: string | null | undefined): string[] => { try { const v = JSON.parse(raw || "[]"); return Array.isArray(v) ? v.filter((x) => ROUTE_TASKS.some(([k]) => k === x)) : []; } catch { return []; } };
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Machines Darrin picks from: presses, die cutters, gluers (live from Work Centers). */
export async function routingMachines(prisma: any) {
  const wcs = await prisma.workCenter.findMany({ where: { isActive: true }, include: { machines: { where: { isActive: true }, orderBy: { name: "asc" }, select: { code: true, name: true } } } });
  const of = (type: string) => wcs.filter((w: any) => w.type === type).flatMap((w: any) => w.machines.map((m: any) => ({ ...m, workCenter: w.name })));
  return { presses: of("press"), dieCutters: of("die-cutting"), gluers: of("gluing") };
}

/** Email + bell to the plant when a CSR enters a job (once, live jobs, not QA tests). */
export async function notifyPlantNewJob(prisma: any, jobId: string, by: { name: string; email?: string | null }) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { order: { include: { company: { select: { name: true } } } }, csr: { select: { name: true } }, salesRep: { select: { name: true } } } });
  if (!job || job.plantNotifiedAt || new Date(job.createdAt) < JOBS_LIVE_SINCE) return;
  await prisma.job.update({ where: { id: jobId }, data: { plantNotifiedAt: new Date() } });
  if (/^QA-/i.test(job.jobNumber || "")) return;
  const plant = await prisma.user.findMany({ where: { isActive: true, role: { in: ["SENIOR_PLANT_MANAGER", "PRODUCTION_MANAGER"] } }, select: { id: true, email: true } });
  if (!plant.length) return;
  const customer = job.order?.company?.name || "";
  const link = `https://packaging.cndprinting.com/dashboard/jobs/${job.id}#routing`;
  const rows: [string, string][] = [
    ["Customer", esc(customer)], ["Job", `${esc(job.jobNumber)}, ${esc(job.name)}`], ["Quantity", (job.quantity || 0).toLocaleString()],
    ["Due", job.dueDate ? new Date(job.dueDate).toLocaleDateString("en-US", { timeZone: "UTC" }) : "-"],
    ["Product", job.productType === "COMMERCIAL_PRINT" ? "Commercial print" : "Folding carton"],
    ["Artwork", esc(job.artworkStatus || "-")], ["CSR", esc(job.csr?.name || by.name)], ["Sales rep", esc(job.salesRep?.name || job.repName || "-")],
  ];
  const subject = `New job to route: ${job.jobNumber} ${customer}`;
  const body = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;"><p>New job entered by ${esc(by.name)}.</p><table style="border-collapse:collapse;">${rows.map(([k, v]) => `<tr><td style="padding:3px 16px 3px 0;color:#666;">${k}</td><td>${v}</td></tr>`).join("")}</table>${job.description ? `<p style="white-space:pre-wrap;">${esc(job.description)}</p>` : ""}<p><a href="${link}">Open the job to route it</a> (inks, foils, status, production boxes, machines).</p></div>`;
  try {
    const { sendEmail } = await import("@/lib/email/graph-client");
    const { AR_FROM } = await import("@/lib/ar");
    await sendEmail({ from: by.email && by.email.endsWith("@cndprinting.com") ? by.email : AR_FROM, to: plant.map((u: any) => u.email), subject, body });
  } catch (e) { console.error("plant new-job email failed", e); }
  for (const u of plant) await prisma.notification.create({ data: { userId: u.id, type: "route", actorName: by.name, title: subject, url: `/dashboard/jobs/${job.id}#routing` } }).catch(() => {});
}
