// #348988 — ALL THREE PARTS (Cover + 24pg Text + 4pg Text), qty 2,250.
// E&M job total $7,420. Run: npx tsx validation/replicate-348988-full.ts
import { defaultClassicForm, defaultClassicPart, computeClassic, type ClassicForm, type ClassicPart } from "../src/lib/classic-estimate";

const EM = {
  parts: [
    { name: "Cover",    orderSheets: 2000, paperCost: 337.50, mr: 700,  waste: 56,  cost: 810.07, total: 1147.19 },
    { name: "24pg Text", orderSheets: 6750, paperCost: 859.28, mr: 1760, waste: 180, cost: 2776.34, total: 3870.55 },
    { name: "4pg Text",  orderSheets: 2000, paperCost: 181.90, mr: 560,  waste: 45,  cost: 0,      total: 0 },
  ],
  jobTotal: 7420.00,
};

const form: ClassicForm = defaultClassicForm();
form.customerName = "Complete Management Solutions";
form.jobTitle = "H0676_0726 Aspire Summer 2026 - 28pgs plus Cover";
form.quantity = 2250;
form.numParts = 3;
form.prepressRate = 60;
form.designHours = 0.5;
// Proof material across all parts: 76.76 + 460.58 + 76.76 = 614.10
form.colorProofs = 1; form.colorProofCharge = 614.10;

// ── Part 1 — Cover (reconciled to 0.05% in replicate-348988.ts) ──
Object.assign(form, {
  pricePerM: 168.75, weightPerMSheets: 183,
  numberUp: 2, sheetsPerPiece: 1, sheetsOutOfParent: 1, bindWasteSheets: 0,
  runColorsSide1: 4, runColorsSide2: 4, workAndTurn: true,
  sheetWidthRun: 19, sheetHeightRun: 25,
  runSpeedSph: 6500, useSpeedCurve: false,
  plateCostEach: 19, coatingType: "Varnish", coatingCoveragePct: 100,
  binderyOperation: 4,
  inkCoverageBlackPct: 31.8, inkCoverageColorPct: 163, inkDollarsPerLb: 10.81,
  makereadyDiff: 0.3, washupHrsPerUnit: 0,
  pressHourlyRate: 188.5, cartonCost: 0,
  paperHandlingHrs: 0.1, paperHandlingRate: 26.7,
  runWastePct: 5,
} as Partial<ClassicPart>);

// ── Part 2 — 24pg Text: 23x29 parent, SHEETWISE, 12-pg sigs, 2 runs ──
const p2 = defaultClassicPart();
Object.assign(p2, {
  pricePerM: 127.30, weightPerMSheets: 141,
  numberUp: 1, sheetsPerPiece: 2,   // 24pp at 12pp/sheet = 2 sheets per book
  sheetsOutOfParent: 1, bindWasteSheets: 100,
  runColorsSide1: 4, runColorsSide2: 4, workAndTurn: false, // SHEETWISE
  sheetWidthRun: 23, sheetHeightRun: 29,
  runSpeedSph: 6625, useSpeedCurve: false,
  plateCostEach: 19,                 // 24 plates × 19 = 456 ✓
  coatingType: "Varnish", coatingCoveragePct: 100,
  binderyOperation: 3,               // Folded (fold setup + folding lines)
  inkCoverageBlackPct: 31.8, inkCoverageColorPct: 163, inkDollarsPerLb: 10.81,
  makereadyDiff: 0.3, washupHrsPerUnit: 0,
  pressHourlyRate: 188.5, cartonCost: 0,
  paperHandlingHrs: 0.2, paperHandlingRate: 26.7,
  runWastePct: 4,                    // 180 / 4500 = 4%
  wasteSheetsManual: 1760,           // E&M's printed makeready; per-unit rule unknown (needs Mary)
  foldSetupHrs: 0.6, foldRunHrs: 0.9, folderRatePerHr: 48,
} as Partial<ClassicPart>);

// ── Part 3 — 4pg Text: 19x25, WORK & TURN ──
const p3 = defaultClassicPart();
Object.assign(p3, {
  pricePerM: 90.95, weightPerMSheets: 100,
  numberUp: 2, sheetsPerPiece: 1, sheetsOutOfParent: 1, bindWasteSheets: 100,
  runColorsSide1: 4, runColorsSide2: 4, workAndTurn: true,
  sheetWidthRun: 19, sheetHeightRun: 25,
  runSpeedSph: 6500, useSpeedCurve: false,
  plateCostEach: 19, coatingType: "Varnish", coatingCoveragePct: 100,
  binderyOperation: 4,
  inkCoverageBlackPct: 31.8, inkCoverageColorPct: 163, inkDollarsPerLb: 10.81,
  makereadyDiff: 0.3, washupHrsPerUnit: 0,
  pressHourlyRate: 188.5,
  paperHandlingHrs: 0.1, paperHandlingRate: 26.7,
  runWastePct: 4,
} as Partial<ClassicPart>);

form.parts = [p2, p3];

const calc: any = computeClassic(form, null);
console.log("#348988 — all 3 parts, qty 2,250\n");
console.log("part          E&M sheets  GZ sheets   E&M paper$   GZ paper$");
(calc.partCalcs || []).forEach((c: any, i: number) => {
  const em = EM.parts[i];
  const okS = c.orderSheets === em.orderSheets ? "✓" : "Δ";
  const okP = Math.abs(c.paperCost - em.paperCost) < 0.02 ? "✓" : "Δ";
  console.log(
    String(em.name).padEnd(12),
    String(em.orderSheets).padStart(10), String(c.orderSheets).padStart(10), okS,
    em.paperCost.toFixed(2).padStart(10), c.paperCost.toFixed(2).padStart(10), okP
  );
});
console.log("\nJOB TOTAL   E&M", EM.jobTotal.toFixed(2), "  Godzilla", (calc.total || 0).toFixed(2),
  ` Δ ${((calc.total || 0) - EM.jobTotal).toFixed(2)}  (${(((calc.total || 0) / EM.jobTotal - 1) * 100).toFixed(1)}%)`);
