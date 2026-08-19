// Validation harness — replicate E&M estimate #348988 (Complete Management,
// "Aspire Summer 2026" 28pg + cover perfect-bound book, KOMII 5C KOMORI,
// qty 2,250 @ $7,420) in the Godzilla classic estimator and diff line-by-line.
// Run: npx tsx validation/replicate-348988.ts
import { defaultClassicForm, defaultClassicPart, computeClassic, type ClassicForm, type ClassicPart } from "../src/lib/classic-estimate";

// ── E&M printed targets (from the scanned detail sheets) ──
const EM = {
  cover: {
    pressSheets: 1125, orderSheets: 2000, paperCost: 337.50,
    makereadySheets: 700, pressWaste: 56,
    prepHrs: 0.9, prepMaterials: 152.76, prepTotal: 191.80, // design .5 + proof .1 + plates .3
    pressHrs: 1.1, pressMaterials: 53.12, pressTotal: 251.76,
    bindHrs: 0.6, bindTotal: 26.33, // load cutter .2 (7.88) + trim .4 (18.45)
    paperHandling: { hrs: 0.1, total: 340.17 },
    buckets: { paper: 337.50, material: 205.88, outside: 0, labor: 266.68 },
    sellups: { paper: 111.38, material: 37.06, outside: 1.00, labor: 106.67, commission: 81.01 },
    partTotal: 1147.19, partCost: 810.07,
  },
  jobTotal: 7420.00,
};

// ── Re-key the Cover exactly as Mary did ──
const form: ClassicForm = defaultClassicForm();
form.customerName = "Complete Management Solutions";
form.jobTitle = "H0676_0726 Aspire Summer 2026 - 28pgs plus Cover";
form.quantity = 2250;
form.numParts = 1; // Cover only for now; parts 2-3 once part 1 reconciles
// job-level prep: Design/Art 0.5 hrs (E&M "Design/Art 0.5 Hrs" → $30.00 ⇒ $60/hr rate?)
form.designHours = 0.5;
form.prepressRate = 60;        // E&M: Design/Art 0.5 hr = $30.00 ⇒ $60/hr
// Proof line: 0.1 hr labor + $76.76 material (1 Sherpa2 + 1 Sherpa43)
form.colorProofs = 2; form.colorProofCharge = 38.38;   // = 76.76 material

// Part 1 — Cover: 4pgs on 19x25, WORK & TURN, 2-up, 5/5 (4c + varnish)
Object.assign(form, {
  paperDescription: "100 LB Coated Cover Explorer White Silk",
  pricePerM: 168.75,        // per parent (= press) sheet
  weightPerMSheets: 183,
  numberUp: 2,              // 2 finished 4-pg covers per press sheet (W&T)
  sheetsPerPiece: 1,
  sheetsOutOfParent: 1,     // 19x25 bought = press size
  bindWasteSheets: 0,
  // "4c Process - 1 Varnish(s)" per side = 4 INK units; the varnish is the
  // 5th press unit and comes from coatingType (no plate).
  runColorsSide1: 4, runColorsSide2: 4,
  workAndTurn: true,
  sheetWidthRun: 19, sheetHeightRun: 25,
  caliperBasisWeight: "100 lb Coated Cover",
  runSpeedSph: 6500,
  useSpeedCurve: false,     // E&M printed 6500 flat
  plateCostEach: 19,        // 4 plates @ $19 = $76 ✓ printed
  coatingType: "Varnish",   // "4c Process - 1 Varnish(s)" per side
  coatingCoveragePct: 100,
  binderyOperation: 4,      // Perfect — the cover is bound onto the book (2 equip passes: cut + bind)
  // Ink coverage: E&M printed 0.8 lbs black + 4.1 lbs color. Derived below;
  // needs Mary's confirmation of E&M's standard coverage per ink config.
  // Mary's standard coverage now comes from the defaults (6% / 36%)
  makereadyDiff: 0.3, washupHrsPerUnit: 0,
  inkDollarsPerLb: 10.84,
  inkCoverageVarnishPct: 0,
  pressHourlyRate: 188.5,   // KOMII — E&M labor 198.64 / 1.054 actual hrs
  cartonCost: 0,            // E&M charges cartons once, on the final part
  paperHandlingHrs: 0.1, paperHandlingRate: 26.7,  // E&M: 340.17 - 337.50 = 2.67
  paperBuyRounding: 250,   // this quote rounds to 250; most round to 10
  cutsToFinalSize: 0,       // let auto derive; E&M shows Load Cutter .2 + Trim .4
} as Partial<ClassicPart>);

const calc = computeClassic(form, null);
const c = calc.partCalcs?.[0] ?? (calc as any);

const rows: [string, number | string, number | string][] = [
  ["press sheets", EM.cover.pressSheets, c.pressSheets],
  ["MR+waste sheets", EM.cover.makereadySheets + EM.cover.pressWaste, c.mrWasteSheets],
  ["order sheets", EM.cover.orderSheets, c.orderSheets],
  ["paper cost $", EM.cover.paperCost, c.paperCost?.toFixed(2)],
  ["press hrs", EM.cover.pressHrs, ((c.pressHrs ?? 0)).toFixed(2)],
  ["ink cost $", EM.cover.pressMaterials, c.inkCost?.toFixed(2)],
  ["plates", 4, c.plates],
  ["plate material $", 76.0, c.plateMaterialsCost?.toFixed(2)],
  ["bindery hrs", EM.cover.bindHrs, c.binderyHrs?.toFixed(2)],
  ["TOTAL COST $", EM.cover.partCost, (calc as any).totalCost?.toFixed(2)],
  ["SELL TOTAL $", EM.cover.partTotal, (calc as any).total?.toFixed(2)],
];
console.log("#348988 Cover — E&M vs Godzilla");
console.log("line".padEnd(20), "E&M".padStart(10), "Godzilla".padStart(10), "  Δ");
for (const [k, em, gz] of rows) {
  const d = Number(gz) - Number(em);
  const flag = Math.abs(d) < 0.01 ? " ✓" : ` Δ ${d > 0 ? "+" : ""}${d.toFixed(2)}`;
  console.log(String(k).padEnd(20), String(em).padStart(10), String(gz).padStart(10), flag);
}

// Cost-bucket breakdown vs E&M's printed buckets
const k: any = calc;
console.log("\nbucket        E&M      Godzilla");
console.log("paper      ", EM.cover.buckets.paper.toFixed(2).padStart(8), k.paperCost?.toFixed(2).padStart(10));
console.log("material   ", EM.cover.buckets.material.toFixed(2).padStart(8), k.materialCost?.toFixed(2).padStart(10));
console.log("labor      ", EM.cover.buckets.labor.toFixed(2).padStart(8),
  ((k.prepLabor||0)+(k.pressCost||0)+(k.binderyCost||0)).toFixed(2).padStart(10),
  ` (prep ${(k.prepLabor||0).toFixed(2)} + press ${(k.pressCost||0).toFixed(2)} + bind ${(k.binderyCost||0).toFixed(2)})`);
