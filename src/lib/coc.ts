// Certificate of Conformance (Shayla 11/19/26). Printed from a shipment in C&D's
// own C.O.C. layout, numbered by Godzilla (picks up after Shayla's #003968),
// filled from the job ticket, signed by whoever ships it. Same record serves
// SQF FRM-011a. Who gets one: customers with "COC required" switched on
// (Cervidea, Florida Nutrition, nutra/derma) and anything run on a folder-gluer.

export const COC_FIRST = 3969;
export const COC_INKS = "Vegetable based Process and Pantone colors / Coatings are water based Aqueous coatings";
export const COC_ROLES_BLOCKED = ["CUSTOMER", "VENDOR"];

export type CocLine = { qty: string; description: string };
export type CocData = {
  to: string; attn: string; subject: string; customerPO: string; estimate: string;
  flatW: string; flatH: string; finishedW: string; finishedH: string;
  stock: string; inks: string; filePrep: string; finishing: string; packaging: string;
  mfgDate: string; expDate: string; lines: CocLine[];
  qualityBy: string; qualityDate: string; preparedBy: string;
  companyName: string; companyAddress: string; companyCity: string; jobNumber: string;
};

export const cocNumber = (n: number) => String(n).padStart(6, "0");
const ymd = (d: Date) => d.toISOString().slice(0, 10);
/** Expiration: 2 years from manufacture (Shayla 11/19), editable per COC. */
export const plus2y = (iso: string) => { const d = new Date(`${iso}T12:00:00Z`); if (isNaN(d.getTime())) return ""; d.setUTCFullYear(d.getUTCFullYear() + 2); return ymd(d); };
const num = (v: unknown) => (v === null || v === undefined || v === "" ? "" : String(v));

/** Does this shipment need a COC? Job shipments for COC customers, or folder-gluer jobs. */
export const needsCoc = (s: { kind?: string | null }, company: { cocRequired?: boolean | null } | null, job: { gluerCode?: string | null } | null) =>
  (s.kind || "job") === "job" && (!!company?.cocRequired || !!job?.gluerCode);

/** A filled-in draft from the shipment, its job ticket and the customer. */
export function cocDraft(s: any, job: any, co: any, by: string): CocData {
  const today = ymd(new Date());
  const finishing = [job?.dieNumber || job?.dieCutterCode ? "Diecut" : null, job?.gluerCode || job?.binderyGlue ? "Glue" : null, job?.binderyFold ? "Fold" : null, job?.binderyStitch ? "Stitch" : null, job?.coating || job?.varnish ? [job.coating, job.varnish].filter(Boolean).join(" / ") : null].filter(Boolean).join(", ");
  const filePrep = job?.artworkStatus === "design" ? "C&D DESIGNED" : job?.artworkStatus === "reprint" ? "FILE ON HAND (REPRINT)" : "FILE SUPPLIED";
  const lines: CocLine[] = (s.items || []).map((i: any) => ({ qty: i.quantity ? String(i.quantity) : "", description: i.description || "" }));
  return {
    to: (co?.name || s.customerName || "").toUpperCase(), attn: (s.contactName || job?.contactName || "").toUpperCase(),
    subject: job?.name || lines[0]?.description || "", customerPO: s.poNumber || job?.customerPO || "", estimate: job?.estimateNumber || "",
    flatW: num(job?.flatSizeWidth), flatH: num(job?.flatSizeHeight), finishedW: num(job?.finishedWidth), finishedH: num(job?.finishedHeight),
    stock: (job?.stockDescription || "").toUpperCase(), inks: COC_INKS, filePrep, finishing, packaging: job?.deliveryPackaging || "Carton Pack",
    mfgDate: today, expDate: plus2y(today), lines: lines.length ? lines : [{ qty: "", description: "" }],
    qualityBy: by, qualityDate: today, preparedBy: by,
    companyName: (co?.name || s.customerName || "").toUpperCase(), companyAddress: (co?.address || "").toUpperCase(),
    companyCity: [co?.city, [co?.state, co?.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ").toUpperCase(),
    jobNumber: s.jobNumber || job?.jobNumber || "",
  };
}

/** Next COC number: after the highest one, never below Shayla's last paper number. */
export async function nextCocNumber(prisma: any) {
  const last = await prisma.coc.findFirst({ orderBy: { number: "desc" }, select: { number: true } });
  return Math.max(COC_FIRST, (last?.number || 0) + 1);
}

export function cleanCoc(raw: any, base: CocData): CocData {
  const t = (v: unknown, max = 300) => String(v ?? "").slice(0, max);
  const out: any = { ...base };
  for (const k of Object.keys(base)) if (k !== "lines" && raw?.[k] !== undefined) out[k] = t(raw[k], k === "subject" ? 600 : 300);
  if (Array.isArray(raw?.lines)) out.lines = raw.lines.slice(0, 12).map((l: any) => ({ qty: t(l?.qty, 20), description: t(l?.description, 300) }));
  return out;
}
