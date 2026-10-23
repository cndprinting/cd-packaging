// Press-sheet optimizer for die-cut blanks (Nitay 10/22): which sheet to run,
// how many blanks per sheet, waste, and a drawing the pressman can use.
//
// Allowances are the same ones Mary's imposition calculator uses (verified
// against pressroom jobs): 3/4" gripper on the lead edge, 1/8" side guide, 1/16"
// added to each blank dimension. Blanks are packed on their bounding box with a
// two-stage layout: a main grid in one orientation, then the leftover strip on
// the long and the short side filled with blanks turned 90 degrees. The Komori
// maximum is 23.25 x 29.75 (29" presses), so nothing larger is offered.
import { IMPOSITION } from "@/lib/classic-estimate";
import { flatten, type Dieline, type Pt } from "./tuck-box";

export const PRESS_MAX = { w: 23.25, h: 29.75 };
export const PRESS_MIN = { w: 12.5, h: 19 };

/** Sheets C&D can run on the Komoris: stock press sheets plus common parent sheets cut in half. */
export const STANDARD_SHEETS: { w: number; h: number; from?: string }[] = [
  { w: 23.25, h: 29.75 }, { w: 23, h: 29 }, { w: 22, h: 28 }, { w: 20, h: 28 }, { w: 20, h: 26 },
  { w: 19, h: 25 }, { w: 18, h: 24 }, { w: 17.5, h: 23, from: "23 x 35 cut in half" },
  { w: 20, h: 26, from: "26 x 40 cut in half" }, { w: 20, h: 28, from: "28 x 40 cut in half" },
  { w: 19, h: 25, from: "25 x 38 cut in half" }, { w: 18, h: 24, from: "24 x 36 cut in half" },
  { w: 13, h: 19 }, { w: 12.5, h: 19 },
];

export interface Placed { x: number; y: number; w: number; h: number; rot: 0 | 90 }
export interface SheetPlan {
  sheetW: number; sheetH: number; label: string; from?: string;
  nUp: number; grid: string; waste: number; sheets: number; placed: Placed[];
  usable: { x0: number; y0: number; x1: number; y1: number };
}

export function layoutOnSheet(blankW: number, blankH: number, sheetW: number, sheetH: number): { placed: Placed[]; grid: string } {
  const bw = blankW + IMPOSITION.bleedTotalIn, bh = blankH + IMPOSITION.bleedTotalIn;
  // usable area: gripper off the lead edge (sheet first dimension = across the press), side guide off the other
  const ux0 = IMPOSITION.gripperIn, uy0 = IMPOSITION.sideGuideIn, UW = sheetW - IMPOSITION.gripperIn, UH = sheetH - IMPOSITION.sideGuideIn;
  const fill = (w: number, h: number, rot: 0 | 90, x0: number, y0: number, aw: number, ah: number, out: Placed[]) => {
    const nx = Math.floor(aw / w), ny = Math.floor(ah / h);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) out.push({ x: x0 + i * w, y: y0 + j * h, w, h, rot });
    return { nx, ny };
  };
  const options: { placed: Placed[]; grid: string }[] = [];
  for (const [w, h, rot] of [[bw, bh, 0], [bh, bw, 90]] as [number, number, 0 | 90][]) {
    const base: Placed[] = [];
    const { nx, ny } = fill(w, h, rot, ux0, uy0, UW, UH, base);
    if (nx * ny === 0) continue;
    const r: 0 | 90 = rot === 0 ? 90 : 0;
    // leftover on the right (full height) or on top (full width), rotated
    const right: Placed[] = []; const rg = fill(h, w, r, ux0 + nx * w, uy0, UW - nx * w, UH, right);
    const top: Placed[] = []; const tg = fill(h, w, r, ux0, uy0 + ny * h, UW, UH - ny * h, top);
    const main = `${nx} x ${ny}${rot ? " turned" : ""}`;
    options.push({ placed: base, grid: main });
    if (right.length) options.push({ placed: [...base, ...right], grid: `${main} + ${rg.nx} x ${rg.ny} turned on the side` });
    if (top.length) options.push({ placed: [...base, ...top], grid: `${main} + ${tg.nx} x ${tg.ny} turned on the end` });
  }
  if (!options.length) return { placed: [], grid: "does not fit" };
  options.sort((a, b) => b.placed.length - a.placed.length);
  return options[0];
}

export function planSheets(blankW: number, blankH: number, qty: number, extra: { w: number; h: number; from?: string }[] = []): SheetPlan[] {
  const seen = new Set<string>();
  const cands = [...STANDARD_SHEETS, ...extra].filter((s) => {
    const w = Math.min(s.w, s.h), h = Math.max(s.w, s.h);
    if (w > PRESS_MAX.w || h > PRESS_MAX.h || w < PRESS_MIN.w || h < PRESS_MIN.h) return false;
    const k = `${w}x${h}|${s.from || ""}`; if (seen.has(k)) return false; seen.add(k); return true;
  });
  const plans: SheetPlan[] = [];
  for (const s of cands) {
    const sw = Math.min(s.w, s.h), sh = Math.max(s.w, s.h);
    // try the sheet both ways through the press (which edge is gripped)
    for (const [W, H] of [[sw, sh], [sh, sw]] as [number, number][]) {
      if (W > PRESS_MAX.w || H > PRESS_MAX.h) continue;
      const { placed, grid } = layoutOnSheet(blankW, blankH, W, H);
      if (!placed.length) continue;
      const nUp = placed.length;
      const waste = 1 - (nUp * blankW * blankH) / (W * H);
      plans.push({ sheetW: W, sheetH: H, label: `${fmt(W)} x ${fmt(H)}`, from: s.from, nUp, grid, waste, sheets: qty > 0 ? Math.ceil(qty / nUp) : 0,
        placed, usable: { x0: IMPOSITION.gripperIn, y0: IMPOSITION.sideGuideIn, x1: W, y1: H } });
    }
  }
  plans.sort((a, b) => (qty > 0 ? a.sheets - b.sheets : 0) || a.waste - b.waste || a.sheetW * a.sheetH - b.sheetW * b.sheetH);
  // one entry per sheet size (best feed direction)
  const best = new Map<string, SheetPlan>();
  for (const p of plans) { const k = `${Math.min(p.sheetW, p.sheetH)}x${Math.max(p.sheetW, p.sheetH)}|${p.from || ""}`; if (!best.has(k)) best.set(k, p); }
  return [...best.values()];
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/** Segments of the blank outline (cuts) in blank-local inches, origin at the blank's min corner. */
function outline(d: Dieline) {
  return flatten(d, 0.05).filter((s) => s.kind === "cut").map((s) => ({ a: [s.a[0] - d.flat.minX, s.a[1] - d.flat.minY] as Pt, b: [s.b[0] - d.flat.minX, s.b[1] - d.flat.minY] as Pt }));
}

/** Transform a blank-local point for a placement (bleed allowance centers the blank in its cell). */
function place(p: Pt, pl: Placed, d: Dieline): Pt {
  const g = IMPOSITION.bleedTotalIn / 2;
  if (pl.rot === 0) return [pl.x + g + p[0], pl.y + g + p[1]];
  return [pl.x + g + (d.flat.height - p[1]), pl.y + g + p[0]];
}

export function layoutSVG(d: Dieline, plan: SheetPlan, scale = 24): string {
  const s = scale, m = 0.6;
  const W = (plan.sheetW + 2 * m) * s, H = (plan.sheetH + 2 * m) * s;
  const X = (x: number) => ((x + m) * s).toFixed(1), Y = (y: number) => ((plan.sheetH - y + m) * s).toFixed(1);
  const segs = outline(d);
  let paths = "";
  for (const pl of plan.placed) {
    paths += `<path d="${segs.map((sg) => { const a = place(sg.a, pl, d), b = place(sg.b, pl, d); return `M${X(a[0])} ${Y(a[1])}L${X(b[0])} ${Y(b[1])}`; }).join("")}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="100%">` +
    `<rect x="${X(0)}" y="${Y(plan.sheetH)}" width="${(plan.sheetW * s).toFixed(1)}" height="${(plan.sheetH * s).toFixed(1)}" fill="#fff" stroke="#111" stroke-width="1.5"/>` +
    `<rect x="${X(0)}" y="${Y(plan.sheetH)}" width="${(IMPOSITION.gripperIn * s).toFixed(1)}" height="${(plan.sheetH * s).toFixed(1)}" fill="#fde68a" opacity="0.7"/>` +
    `<text x="${X(IMPOSITION.gripperIn / 2)}" y="${Y(plan.sheetH / 2)}" font-size="${(0.3 * s).toFixed(1)}" text-anchor="middle" transform="rotate(-90 ${X(IMPOSITION.gripperIn / 2)} ${Y(plan.sheetH / 2)})" fill="#92400e">GRIPPER</text>` +
    `<g fill="none" stroke="#e6007e" stroke-width="1">${paths}</g>` +
    `<text x="${X(plan.sheetW / 2)}" y="${(H - 0.15 * s).toFixed(1)}" font-size="${(0.32 * s).toFixed(1)}" text-anchor="middle" fill="#111">${plan.label} in · ${plan.nUp} up (${plan.grid}) · ${(plan.waste * 100).toFixed(0)}% waste</text>` +
    `</svg>`;
}

/** Letter-landscape PDF layout for the pressman. */
export async function layoutPDF(d: Dieline, plan: SheetPlan, info: { title: string; qty: number; style: string; box: string; flat: string }): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([792, 612]);
  const font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  page.drawText("C&D Printing & Packaging  ·  Press layout", { x: 36, y: 578, size: 14, font: bold });
  const lines = [
    `${info.title}`,
    `Box ${info.box}  ·  flat blank ${info.flat} in  ·  style ${info.style}`,
    `Run on ${plan.label} in${plan.from ? ` (${plan.from})` : ""}  ·  ${plan.nUp} up, ${plan.grid}  ·  ${(plan.waste * 100).toFixed(1)}% waste`,
    info.qty > 0 ? `Quantity ${info.qty.toLocaleString()}  ·  ${plan.sheets.toLocaleString()} press sheets before makeready and spoilage` : "Quantity not set",
    `Gripper ${IMPOSITION.gripperIn}" on the ${fmt(plan.sheetW)}" edge (shaded), side guide ${IMPOSITION.sideGuideIn}", ${IMPOSITION.bleedTotalIn}" added per blank dimension. Blanks on bounding boxes; nesting into flap gaps not counted.`,
  ];
  lines.forEach((t, i) => page.drawText(t, { x: 36, y: 556 - i * 14, size: 9.5, font }));
  // drawing area
  const ax = 36, ay = 36, aw = 720, ah = 440;
  const sc = Math.min(aw / plan.sheetW, ah / plan.sheetH);
  const ox = ax + (aw - plan.sheetW * sc) / 2, oy = ay + (ah - plan.sheetH * sc) / 2;
  page.drawRectangle({ x: ox, y: oy, width: plan.sheetW * sc, height: plan.sheetH * sc, borderColor: rgb(0, 0, 0), borderWidth: 1 });
  page.drawRectangle({ x: ox, y: oy, width: IMPOSITION.gripperIn * sc, height: plan.sheetH * sc, color: rgb(0.99, 0.9, 0.55), opacity: 0.7 });
  const segs = outline(d);
  for (const pl of plan.placed) for (const sg of segs) {
    const a = place(sg.a, pl, d), b = place(sg.b, pl, d);
    page.drawLine({ start: { x: ox + a[0] * sc, y: oy + a[1] * sc }, end: { x: ox + b[0] * sc, y: oy + b[1] * sc }, thickness: 0.5, color: rgb(0.9, 0, 0.5) });
  }
  page.drawText(`${plan.label} in`, { x: ox, y: oy - 12, size: 8, font });
  return pdf.save();
}
