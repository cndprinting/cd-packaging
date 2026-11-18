// Prototypes (Benjy 11/18/26). Prototyping happens during the quoting
// back-and-forth, before there is a job ticket: sales asks Todd for a sample
// box, the customer reacts, Todd makes another round, until they approve it.
// The approved structure then carries onto the job when the CSR enters it.
import { AR_FROM } from "@/lib/ar";

export const BASE_URL = process.env.NEXTAUTH_URL || "https://packaging.cndprinting.com";
// Who makes prototypes and runs finishing.
export const MAKER_ROLES = ["FINISHING_MANAGER", "OWNER", "GM", "ADMIN", "SENIOR_PLANT_MANAGER", "PRODUCTION_MANAGER"];
// Who can ask for one (sales first, CSRs sometimes).
export const REQUEST_ROLES = ["SALES_REP", "SALES_MANAGER", "CSR", "OWNER", "GM", "ADMIN", "ESTIMATOR", "FINISHING_MANAGER", "SENIOR_PLANT_MANAGER", "PRODUCTION_MANAGER"];
export const VIEW_ROLES = [...new Set([...MAKER_ROLES, ...REQUEST_ROLES, "ACCOUNTING", "PREPRESS_MANAGER", "DIGITAL_PRESS"])];

export const STATUSES = [
  { key: "requested", label: "New requests", who: "Todd", help: "Asked for, not started. Changes from the customer land here as the next round." },
  { key: "making", label: "Making it", who: "Todd", help: "On the table." },
  { key: "ready", label: "Ready", who: "Sales", help: "Done. Sales picks it up and gets it to the customer." },
  { key: "with_customer", label: "With customer", who: "Customer", help: "Waiting on their reaction." },
  { key: "approved", label: "Approved", who: "", help: "The customer signed off on the structure. It carries onto the job ticket." },
] as const;

export const STYLE_OPTIONS: [string, string][] = [
  ["STE", "Straight tuck end"], ["RTE", "Reverse tuck end"], ["TTAB", "Tuck top auto bottom"], ["TTSB", "Tuck top snap lock bottom"],
  ["SE", "Seal end"], ["SLV", "Sleeve"], ["RETF", "Tray"], ["OTHER", "Other / custom"],
];

export const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const sizeText = (p: { style?: string | null; length?: number | null; width?: number | null; depth?: number | null }) =>
  [p.style && p.style !== "OTHER" ? p.style : null, p.length && p.width ? `${p.length} x ${p.width}${p.depth ? ` x ${p.depth}` : ""} in` : null].filter(Boolean).join(" ");

export async function nextNumber(prisma: any) {
  const all = await prisma.prototype.findMany({ select: { number: true } });
  const max = all.reduce((m: number, r: any) => Math.max(m, parseInt(String(r.number).replace(/\D/g, "")) || 0), 0);
  return `PRO-${String(max + 1).padStart(4, "0")}`;
}

export function addLog(raw: string | null | undefined, by: string, event: string) {
  let log: any[] = [];
  try { log = JSON.parse(raw || "[]"); } catch { log = []; }
  log.push({ at: new Date().toISOString(), by, event });
  return JSON.stringify(log.slice(-100));
}

/** A system note on the lead, so the funnel shows the prototype history. */
export async function noteOnLead(prisma: any, leadId: string | null | undefined, body: string) {
  if (!leadId) return;
  await prisma.leadNote.create({ data: { leadId, kind: "system", source: "prototype", authorName: "Godzilla", body: body.slice(0, 2000) } }).catch(() => {});
}

/** Exact and near dies from the inventory for these inside dimensions. */
export async function dieCheck(l?: number | null, w?: number | null, d?: number | null) {
  if (!(l && w && d)) return null;
  try {
    const { findDies } = await import("@/lib/dieline/shared");
    const r = await findDies([l, w, d]);
    const slim = (m: any) => ({ dieNumber: m.dieNumber, customerName: m.customerName || null, item: m.item || null, length: m.length, width: m.width, height: m.height, dielineUrl: m.dielineUrl || null });
    return { exact: (r.exact || []).slice(0, 5).map(slim), near: (r.near || []).slice(0, 5).map(slim) };
  } catch (e) { console.error("prototype die check failed", e); return null; }
}

export async function makers(prisma: any) {
  return prisma.user.findMany({ where: { isActive: true, role: "FINISHING_MANAGER" }, select: { email: true, name: true } });
}

export async function mail(to: string[], subject: string, html: string, fromEmail?: string | null) {
  const list = [...new Set(to.filter(Boolean))];
  if (!list.length) return;
  try {
    const { sendEmail } = await import("@/lib/email/graph-client");
    await sendEmail({ from: fromEmail && fromEmail.endsWith("@cndprinting.com") ? fromEmail : AR_FROM, to: list, subject, body: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;">${html}</div>` });
  } catch (e) { console.error("prototype email failed", e); }
}
