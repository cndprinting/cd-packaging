// Classic (E&M Parsec-style) estimator math — shared by
// /dashboard/quotes/estimate-classic. Pure functions over one big form
// object so every number recomputes live as Mary types.
//
// All rates/diffs arrive as editable form fields (prefilled with defaults
// or PlantStandard values) — nothing here reads the database directly.
//
// Multi-part jobs (E&M "No. of Parts"): part 1 lives in the flat Screen 6-8
// fields (unchanged shape — old drafts keep working); parts 2..N live in
// `parts[]`. Each part gets its own paper+press+bindery pass at the job
// quantity; prep/outside/freight/markups/commission stay job-level.

import {
  DigitalClickStandards,
  InkConfig,
  getDigitalSizeTier,
  getDigitalClickRate,
  getDigitalVDRate,
} from "@/lib/digital-clicks";

export const JOB_TYPES = [
  "New With Pre-Press",
  "New w/o Pre-Press",
  "Exact Reprint",
  "Reprint w/Changes",
  "Pre-Press Only",
  "Bindery Only",
  "Press Only",
  "Custom Only",
  "All Outside",
  "Digital Direct",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export interface OutsidePurchase {
  description: string;
  amount: number;
}

export interface HandOp {
  description: string;
  piecesPerHour: number;
  pctOfQty: number; // % of quantity that goes through this op
}

// ── Per-part field set (Screens 6 + 7 + 8) ──────────────────────────────
// Part 1 IS the flat fields on ClassicForm; additional parts are Picks of
// exactly these keys stored in `parts[]`.
export const PART_FIELD_KEYS = [
  // Screen 6 — Paper/Stock
  "sheetWidthRun", "sheetHeightRun", "sheetWidthOrder", "sheetHeightOrder",
  "numPages", "stockDescription", "caliperBasisWeight", "pricePerM", "weightPerMSheets",
  "numberUp", "sheetsPerPiece", "sheetsOutOfParent", "bindWasteSheets",
  "bleedAllowance", "brandColorFinish",
  // Screen 7 — Press
  "pressId", "pressConfigId", "pressHourlyRate", "helperHourlyRate",
  "runColorsSide1", "runColorsSide2", "baseMakereadyHrsPerPlate",
  "makereadyDiff", "washupHrsPerUnit", "washupDiff", "runSpeedSph",
  "runDiff", "wasteFactorPct", "helpers",
  "wasteSheetsManual", "wastePerColorSheets", "wastePerEquipmentSheets", "equipmentPassesManual",
  "inkCoverageBlackPct", "inkCoverageColorPct", "inkCoverageVarnishPct",
  "inkFactorMsqinPerLb", "inkDollarsPerLb",
  "dieCutHrs", "scorePerfHrs", "dieCost", "dieNumber", "pressCheckHrs",
  "digitalInkConfig", "digitalMakereadySheets", "digitalVariableData", "digitalVDSetupHrs",
  // Screen 8 — Bindery
  "binderyOperation", "cuttingDiff", "cutterSheetsPerHr", "trimHrs",
  "cutsToFinalSize", "sheetsPerLift", "cutSecPerCut",
  "drillHoles", "drillDiff", "drillHrsPerHole", "folderConfig",
  "handOp1", "handOp2", "cartons", "cartonCost", "skids", "skidCost",
  "packHrs", "binderyHourlyRate",
  "bandIn", "bandHrs", "padIn", "padHrs", "wrapIn", "wrapHrs", "bundleRatePerHr",
] as const;

export type ClassicPart = Pick<ClassicForm, (typeof PART_FIELD_KEYS)[number]>;

export interface ClassicForm {
  // ── Screen 1 — Main Entry ──
  customerName: string;
  customerNumber: string;
  address: string;
  jobTitle: string;
  quantity: number;
  // Up to 3 additional quantities (E&M quotes multiple quantities per
  // estimate). 0/blank entries are ignored.
  additionalQuantities: number[];
  numParts: number;
  markupPaperPct: number;
  markupMaterialPct: number;
  markupOutsidePct: number;
  markupLaborPct: number;
  commissionPct: number;

  // ── Screen 2 — Additional Instructions ──
  instructions: string;

  // ── Screen 3 — Job Type ──
  jobType: JobType;

  // ── Screen 4 — Electronic Prepress ──
  designHours: number;
  photoshopHours: number;
  prepressRate: number; // $/hr
  scans85x11: number;
  scans11x17: number;
  scans20x25: number;
  scanCharge85x11: number;
  scanCharge11x17: number;
  scanCharge20x25: number;
  furnishedDisks: number;
  furnishedDiskCharge: number;
  laserProofs: number;
  laserProofCharge: number;
  colorProofs: number;
  colorProofCharge: number;

  // ── Screen 5 — Camera / Stripping / Platemaking ──
  plateDiffFactor: number;
  dyluxProofs: number;
  dyluxCharge: number;
  matchprintProofs: number;
  matchprintCharge: number;
  separations: number;
  separationCharge: number;

  // ── Screen 6 — Paper / Stock (part 1) ──
  sheetWidthRun: number;
  sheetHeightRun: number;
  sheetWidthOrder: number;
  sheetHeightOrder: number;
  numPages: number;
  stockDescription: string;
  caliperBasisWeight: string;
  pricePerM: number; // $ per 1000 sheets
  weightPerMSheets: number; // lbs per 1000 parent sheets (E&M "147M" notation) — drives auto cartons
  numberUp: number;
  sheetsPerPiece: number; // press sheets per finished piece (booklets: 16pg on 4pp/side = 4) — Cybake #347528
  sheetsOutOfParent: number; // press sheets cut from each parent sheet bought (E&M "out of parent"); pricePerM is per PARENT
  bindWasteSheets: number;   // extra press sheets bought for bindery spoilage — paper only, never clicked/printed
  bleedAllowance: string;
  brandColorFinish: string;

  // ── Screen 7 — Press (part 1, offset) ──
  pressId: string;
  pressConfigId: string;
  pressHourlyRate: number;
  helperHourlyRate: number;
  runColorsSide1: number;
  runColorsSide2: number;
  baseMakereadyHrsPerPlate: number;
  makereadyDiff: number;
  washupHrsPerUnit: number;
  washupDiff: number;
  runSpeedSph: number;
  runDiff: number;
  wasteFactorPct: number; // LEGACY — superseded by Mary's sheet-based waste rule below (7/20)
  // Press waste, Mary's actual E&M rule (7/20): 100 sheets per color per side
  // + 100 sheets per piece of equipment the job passes through (cut/fold/
  // die/score/stitch). All knobs editable; manual sheets override wins.
  wasteSheetsManual: number;       // 0 = auto formula
  wastePerColorSheets: number;     // default 100
  wastePerEquipmentSheets: number; // default 100
  equipmentPassesManual: number;   // 0 = auto-count from the job's operations
  helpers: number;
  inkCoverageBlackPct: number;
  inkCoverageColorPct: number;
  inkCoverageVarnishPct: number;
  inkFactorMsqinPerLb: number; // thousand sq-in of coverage per lb of ink
  inkDollarsPerLb: number;
  dieCutHrs: number;
  scorePerfHrs: number;
  dieCost: number;
  dieNumber: string; // existing die # from the die inventory (blank = new die)
  pressCheckHrs: number;

  // ── Screen 7 — Digital branch (part 1) ──
  digitalInkConfig: InkConfig;
  digitalMakereadySheets: number;
  digitalVariableData: boolean;
  digitalVDSetupHrs: number;

  // ── Screen 8 — Bindery (part 1) ──
  binderyOperation: number; // 1 Flat / 2 Saddle / 3 Folded / 4 Perfect / 5 Multibind / 6 Plastic
  cuttingDiff: number;       // Mary eyeballs .5/.6/.7 — more cuts to final size = higher (7/20)
  cutterSheetsPerHr: number; // divisor for auto cutter hours
  trimHrs: number;           // 0 = auto from cuts × sec/cut × diff (E&M computed trim from difficulty)
  cutsToFinalSize: number;   // cuts to get a lift to final size (0 = auto trim off)
  sheetsPerLift: number;     // sheets the cutter takes per lift (default 500)
  cutSecPerCut: number;      // seconds per cut (plant standard: 8)
  drillHoles: number;
  drillDiff: number;
  drillHrsPerHole: number;
  folderConfig: string;
  handOp1: HandOp;
  handOp2: HandOp;
  cartons: number;
  cartonCost: number;
  skids: number;
  skidCost: number;
  packHrs: number;
  binderyHourlyRate: number;
  // Band / Pad / Wrap (E&M Screen 8 trio — Mary 7/20). The "In" value is the
  // pieces-per-bundle count; hours AUTO-compute (bundles ÷ bundle rate) with
  // the Hrs field as a manual override (0 = auto), like E&M.
  bandIn: string;  // pieces per band, e.g. "50" (extra text tolerated)
  bandHrs: number; // 0 = auto
  padIn: string;   // pieces per pad, e.g. "100"
  padHrs: number;  // 0 = auto
  wrapIn: string;  // pieces per wrap, e.g. "100 kraft"
  wrapHrs: number; // 0 = auto
  bundleRatePerHr: number; // bundles processed per hour (shared band/pad/wrap standard)

  // ── Multi-part: parts 2..N (Screen 6-8 field subset each) ──
  parts: ClassicPart[];

  // ── Screen 9 — Cost Summary ──
  additionalCosts: number;
  freight: number;
  outsidePurchases: OutsidePurchase[];
  deliveryZone: string;
  quoteNotes: string;
}

export const BINDERY_OPERATIONS = [
  "1 Flat",
  "2 Saddle",
  "3 Folded",
  "4 Perfect",
  "5 Multibind",
  "6 Plastic",
] as const;

export function defaultClassicForm(): ClassicForm {
  return {
    customerName: "", customerNumber: "", address: "", jobTitle: "",
    quantity: 0, additionalQuantities: [], numParts: 1,
    markupPaperPct: 33, markupMaterialPct: 16, markupOutsidePct: 24,
    markupLaborPct: 40, commissionPct: 10,
    instructions: "",
    jobType: "New With Pre-Press",
    designHours: 0, photoshopHours: 0, prepressRate: 95,
    scans85x11: 0, scans11x17: 0, scans20x25: 0,
    scanCharge85x11: 15, scanCharge11x17: 25, scanCharge20x25: 40,
    furnishedDisks: 0, furnishedDiskCharge: 10,
    laserProofs: 0, laserProofCharge: 12,
    colorProofs: 0, colorProofCharge: 30,
    plateDiffFactor: 1, dyluxProofs: 0, dyluxCharge: 15,
    matchprintProofs: 0, matchprintCharge: 45,
    separations: 0, separationCharge: 20,
    sheetWidthRun: 0, sheetHeightRun: 0, sheetWidthOrder: 0, sheetHeightOrder: 0,
    numPages: 0, stockDescription: "", caliperBasisWeight: "",
    pricePerM: 0, weightPerMSheets: 0, numberUp: 1, sheetsPerPiece: 1, sheetsOutOfParent: 1, bindWasteSheets: 0, bleedAllowance: "", brandColorFinish: "",
    pressId: "", pressConfigId: "", pressHourlyRate: 0, helperHourlyRate: 0,
    runColorsSide1: 0, runColorsSide2: 0,
    baseMakereadyHrsPerPlate: 0.25, makereadyDiff: 1,
    washupHrsPerUnit: 0.25, washupDiff: 1,
    runSpeedSph: 0, runDiff: 1, wasteFactorPct: 0, helpers: 0,
    wasteSheetsManual: 0, wastePerColorSheets: 100, wastePerEquipmentSheets: 100, equipmentPassesManual: 0,
    inkCoverageBlackPct: 0, inkCoverageColorPct: 0, inkCoverageVarnishPct: 0,
    inkFactorMsqinPerLb: 425, inkDollarsPerLb: 8.5,
    dieCutHrs: 0, scorePerfHrs: 0, dieCost: 0, dieNumber: "", pressCheckHrs: 0,
    digitalInkConfig: "4/4", digitalMakereadySheets: 25,
    digitalVariableData: false, digitalVDSetupHrs: 0.5,
    binderyOperation: 1, cuttingDiff: 0.5, cutterSheetsPerHr: 5000,
    trimHrs: 0, cutsToFinalSize: 0, sheetsPerLift: 500, cutSecPerCut: 8,
    drillHoles: 0, drillDiff: 1, drillHrsPerHole: 0.1,
    folderConfig: "",
    handOp1: { description: "", piecesPerHour: 0, pctOfQty: 0 },
    handOp2: { description: "", piecesPerHour: 0, pctOfQty: 0 },
    cartons: 0, cartonCost: 0.93, skids: 0, skidCost: 5, packHrs: 0,
    binderyHourlyRate: 65,
    bandIn: "", bandHrs: 0, padIn: "", padHrs: 0, wrapIn: "", wrapHrs: 0,
    bundleRatePerHr: 200, // PLACEHOLDER standard — awaiting Mary's E&M figure

    parts: [],
    additionalCosts: 0, freight: 0, outsidePurchases: [],
    deliveryZone: "", quoteNotes: "",
  };
}

/** Fresh part with the same defaults as the flat Screen 6-8 fields. */
export function defaultClassicPart(): ClassicPart {
  const d = defaultClassicForm();
  const part = {} as Record<string, unknown>;
  for (const k of PART_FIELD_KEYS) part[k] = d[k];
  return part as unknown as ClassicPart;
}

// ── Per-part computed detail ─────────────────────────────────────────────
export interface PartCalc {
  pressSheets: number;
  mrWasteSheets: number;
  orderSheets: number;
  paperCost: number;
  plates: number;
  makereadyHrs: number;
  washupHrs: number;
  runHrs: number;
  dieScoreHrs: number;
  pressCheckHrs: number;
  pressHrs: number;
  inkLbs: number;
  inkCost: number;
  pressLaborCost: number;
  pressMaterialsCost: number; // die cost
  pressCost: number;
  digitalTier: 1 | 2 | 3;
  digitalClickRate: number;
  digitalVDRate: number;
  digitalClickSheets: number;
  digitalClickCost: number;
  digitalVDCost: number;
  digitalVDSetupCost: number;
  cutterHrs: number;
  drillHrs: number;
  handOp1Hrs: number;
  handOp2Hrs: number;
  binderyHrs: number;
  binderyLabor: number;
  cartonSkidCost: number;
  binderyCost: number;
  paperLbs: number;     // order sheets × lbs-per-M
  cartonsAuto: number;  // ceil(paperLbs / 35) — Mary's 35-lb max rule
  cartonsUsed: number;  // manual override if cartons > 0, else auto
  bandHrsUsed: number;  // auto (bundles ÷ rate) unless manually overridden
  padHrsUsed: number;
  wrapHrsUsed: number;
  trimHrsUsed: number;      // auto from cuts × sec/cut × diff unless overridden
  equipmentPasses: number;  // waste-formula equipment pass count in effect
}

/** Paper + press + bindery math for ONE part at the job quantity.
 *  Formulas identical to the original single-part computeClassic. */
function computePart(
  p: ClassicPart,
  qty: number,
  isDigital: boolean,
  digitalStd: DigitalClickStandards | null
): PartCalc {
  const numberUp = Math.max(1, p.numberUp || 1);

  // ── Paper (Screen 6, waste from Screen 7) ──
  const sheetsPerPiece = Math.max(1, p.sheetsPerPiece || 1);
  const pressSheets = Math.ceil((qty * sheetsPerPiece) / numberUp);
  // Press waste — Mary's E&M rule (7/20): 100 sheets per color per side +
  // 100 per piece of equipment the job passes through. Passes auto-count from
  // the operations on the job; every knob is editable and a typed waste-sheet
  // count overrides the whole formula.
  const passesAuto =
    ((p.trimHrs || 0) > 0 || (p.cutsToFinalSize || 0) > 0 ? 1 : 0) + // cutting
    ((p.dieCutHrs || 0) > 0 ? 1 : 0) +
    ((p.scorePerfHrs || 0) > 0 ? 1 : 0) +
    (p.folderConfig || p.binderyOperation === 3 ? 1 : 0) +           // folding
    ([2, 4, 5].includes(p.binderyOperation) ? 1 : 0);                // stitch/bind
  const equipmentPasses = (p.equipmentPassesManual || 0) > 0 ? p.equipmentPassesManual : passesAuto;
  const wasteColors = (p.runColorsSide1 || 0) + (p.runColorsSide2 || 0);
  const mrWasteSheets = isDigital
    ? Math.ceil(p.digitalMakereadySheets || 0)
    : (p.wasteSheetsManual || 0) > 0
      ? Math.ceil(p.wasteSheetsManual)
      : wasteColors * (p.wastePerColorSheets || 0) + equipmentPasses * (p.wastePerEquipmentSheets || 0);
  // Paper buy: press sheets + MR/overs + bindery spoilage, rounded up to whole
  // PARENT sheets (E&M: "Use 1,110 sheets 19x25 ... 2 out of parent").
  // pricePerM is per parent sheet when sheetsOutOfParent > 1.
  const outOfParent = Math.max(1, p.sheetsOutOfParent || 1);
  const sheetsToBuy = pressSheets + mrWasteSheets + Math.ceil(p.bindWasteSheets || 0);
  const orderSheets = Math.ceil(sheetsToBuy / outOfParent);
  const paperCost = (orderSheets / 1000) * (p.pricePerM || 0);

  // ── Press (Screen 7) ──
  const plates = (p.runColorsSide1 || 0) + (p.runColorsSide2 || 0);
  const sheetArea = (p.sheetWidthRun || 0) * (p.sheetHeightRun || 0); // sq in

  let makereadyHrs = 0, washupHrs = 0, runHrs = 0;
  let inkLbs = 0, inkCost = 0;
  let pressLaborCost = 0;
  let digitalTier: 1 | 2 | 3 = 1;
  let digitalClickRate = 0, digitalVDRate = 0, digitalClickSheets = 0;
  let digitalClickCost = 0, digitalVDCost = 0, digitalVDSetupCost = 0;
  const dieScoreHrs = (p.dieCutHrs || 0) + (p.scorePerfHrs || 0);
  const pressCheckHrs = p.pressCheckHrs || 0;
  let pressHrs = 0;

  if (isDigital && digitalStd) {
    // Digital click engine (Mary's tier × ink-config table).
    digitalTier = getDigitalSizeTier(p.sheetWidthRun || 0, p.sheetHeightRun || 0, digitalStd);
    digitalClickRate = getDigitalClickRate(digitalTier, p.digitalInkConfig, digitalStd);
    digitalVDRate = getDigitalVDRate(digitalTier, digitalStd);
    digitalClickSheets = pressSheets + (p.digitalMakereadySheets || 0);
    digitalClickCost = digitalClickSheets * digitalClickRate;
    if (p.digitalVariableData) {
      digitalVDCost = digitalClickSheets * digitalVDRate;
      digitalVDSetupCost = (p.digitalVDSetupHrs || 0) * (digitalStd.digitalVDSetupRate || 0);
    }
    pressHrs = dieScoreHrs + pressCheckHrs;
    // Clicks are NOT press labor — E&M books digital as an outside purchase
    // (Cybake #347528: Digital 793.80 under Outside at 0%). They land in the
    // outside bucket in computeClassic; press labor is only die/score/check hrs.
    pressLaborCost = pressHrs * (p.pressHourlyRate || 0);
  } else {
    makereadyHrs = (p.baseMakereadyHrsPerPlate || 0) * (p.makereadyDiff || 1) * plates;
    washupHrs = (p.washupHrsPerUnit || 0) * (p.washupDiff || 1) * plates;
    runHrs = p.runSpeedSph > 0 ? (pressSheets / p.runSpeedSph) * (p.runDiff || 1) : 0;
    pressHrs = makereadyHrs + washupHrs + runHrs + dieScoreHrs + pressCheckHrs;
    // Ink: press sheets × sheet area × coverage% ÷ (thousand sq-in per lb).
    const coveragePct =
      (p.inkCoverageBlackPct || 0) + (p.inkCoverageColorPct || 0) + (p.inkCoverageVarnishPct || 0);
    inkLbs = p.inkFactorMsqinPerLb > 0
      ? (pressSheets * sheetArea * (coveragePct / 100)) / (p.inkFactorMsqinPerLb * 1000)
      : 0;
    inkCost = inkLbs * (p.inkDollarsPerLb || 0);
    pressLaborCost =
      pressHrs * (p.pressHourlyRate || 0) +
      pressHrs * (p.helpers || 0) * (p.helperHourlyRate || 0) +
      inkCost;
  }
  const pressMaterialsCost = p.dieCost || 0;
  const pressCost = pressLaborCost + pressMaterialsCost;

  // ── Bindery (Screen 8) ──
  const cutterHrs = p.cutterSheetsPerHr > 0
    ? (pressSheets / p.cutterSheetsPerHr) * (p.cuttingDiff || 1)
    : 0;
  const drillHrs = (p.drillHoles || 0) * (p.drillHrsPerHole || 0) * (p.drillDiff || 1);
  const op1 = p.handOp1, op2 = p.handOp2;
  const handOp1Hrs = op1.piecesPerHour > 0 ? (qty * (op1.pctOfQty || 0)) / 100 / op1.piecesPerHour : 0;
  const handOp2Hrs = op2.piecesPerHour > 0 ? (qty * (op2.pctOfQty || 0)) / 100 / op2.piecesPerHour : 0;
  // Band/Pad/Wrap: "In" = pieces per bundle → bundles = ceil(qty / in);
  // auto hrs = bundles ÷ bundle rate; a typed Hrs value overrides (0 = auto).
  const perBundle = (s: string) => parseFloat(String(s || "").replace(/[^0-9.]/g, "")) || 0;
  const rate = p.bundleRatePerHr || 0;
  const opHrs = (inStr: string, manual: number) => {
    if (manual > 0) return manual;
    const size = perBundle(inStr);
    return size > 0 && rate > 0 ? Math.ceil(qty / size) / rate : 0;
  };
  const bandHrsUsed = opHrs(p.bandIn, p.bandHrs || 0);
  const padHrsUsed = opHrs(p.padIn, p.padHrs || 0);
  const wrapHrsUsed = opHrs(p.wrapIn, p.wrapHrs || 0);
  // Trim-to-size: E&M computed it once the difficulty was entered (Mary 7/20).
  // Auto = lifts × cuts-to-final × sec/cut × cutting diff; typed hours override.
  const trimAuto = (p.cutsToFinalSize || 0) > 0
    ? (Math.ceil(pressSheets / Math.max(1, p.sheetsPerLift || 500)) * p.cutsToFinalSize * (p.cutSecPerCut || 8) / 3600) * (p.cuttingDiff || 1)
    : 0;
  const trimHrsUsed = (p.trimHrs || 0) > 0 ? p.trimHrs : trimAuto;
  const binderyHrs = cutterHrs + trimHrsUsed + drillHrs + handOp1Hrs + handOp2Hrs + (p.packHrs || 0)
    + bandHrsUsed + padHrsUsed + wrapHrsUsed;
  const binderyLabor = binderyHrs * (p.binderyHourlyRate || 0);
  // Cartons/skids are E&M MATERIAL (18% line on Cybake #347528), not bindery
  // labor — they ride the prep/materials bucket at Material markup.
  // Cartons auto-compute from paper weight at Mary's rule: no carton over
  // 35 lbs (7/20). paperLbs = order sheets × lbs-per-M ("147M" on her sheets).
  // A hand-entered carton count overrides the auto (0 = auto).
  const paperLbs = (orderSheets / 1000) * (p.weightPerMSheets || 0);
  const cartonsAuto = paperLbs > 0 ? Math.ceil(paperLbs / 35) : 0;
  const cartonsUsed = (p.cartons || 0) > 0 ? p.cartons : cartonsAuto;
  const cartonSkidCost = cartonsUsed * (p.cartonCost || 0) + (p.skids || 0) * (p.skidCost || 0);
  const binderyCost = binderyLabor;

  return {
    pressSheets, mrWasteSheets, orderSheets, paperCost,
    plates, makereadyHrs, washupHrs, runHrs, dieScoreHrs, pressCheckHrs, pressHrs,
    inkLbs, inkCost, pressLaborCost, pressMaterialsCost, pressCost,
    digitalTier, digitalClickRate, digitalVDRate, digitalClickSheets,
    digitalClickCost, digitalVDCost, digitalVDSetupCost,
    cutterHrs, drillHrs, handOp1Hrs, handOp2Hrs, binderyHrs, binderyLabor,
    cartonSkidCost, binderyCost,
    paperLbs, cartonsAuto, cartonsUsed,
    bandHrsUsed, padHrsUsed, wrapHrsUsed,
    trimHrsUsed, equipmentPasses,
  };
}

export interface ClassicCalc {
  isDigital: boolean;

  // Per-part detail (index 0 = part 1 / flat fields)
  partCalcs: PartCalc[];

  // Paper (sums across parts)
  pressSheets: number;
  mrWasteSheets: number;
  orderSheets: number;
  paperCost: number;
  paperSelling: number;

  // Prep (Screens 4 + 5, job-level) — sold at Material markup
  prepHours: number;
  prepLabor: number;
  prepMaterials: number;
  prepCost: number;
  prepSelling: number;

  // Press (sums across parts) — sold at Labor markup
  plates: number;
  makereadyHrs: number;
  washupHrs: number;
  runHrs: number;
  dieScoreHrs: number;
  pressCheckHrs: number;
  pressHrs: number;
  inkLbs: number;
  inkCost: number;
  pressLaborCost: number;
  pressMaterialsCost: number; // die cost
  pressCost: number;
  pressSelling: number;
  // digital detail (rate/tier from part 1; sheet/cost figures summed)
  digitalTier: 1 | 2 | 3;
  digitalClickRate: number;
  digitalVDRate: number;
  digitalClickSheets: number;
  digitalClickCost: number;
  digitalVDCost: number;
  digitalVDSetupCost: number;

  // Bindery (sums across parts) — sold at Labor markup
  cutterHrs: number;
  drillHrs: number;
  handOp1Hrs: number;
  handOp2Hrs: number;
  binderyHrs: number;
  binderyLabor: number;
  cartonSkidCost: number;
  binderyCost: number;
  binderySelling: number;

  // Outside — sold at Outside markup
  outsideCost: number;
  outsideSelling: number;

  // Pass-through
  freightAndAdditional: number;

  totalCost: number;
  sellingSubtotal: number;
  commission: number;
  total: number;
  costPerUnit: number;
  costPerM: number;
}

/** Resolve the effective part list: part 1 = flat fields, parts 2..N merged
 *  over part defaults (so partially-filled or legacy data can't crash). */
export function effectiveParts(f: ClassicForm): ClassicPart[] {
  const numParts = Math.max(1, Math.floor(f.numParts || 1));
  const extras = Array.isArray(f.parts) ? f.parts : [];
  const list: ClassicPart[] = [f];
  for (let i = 1; i < numParts; i++) {
    list.push({ ...defaultClassicPart(), ...(extras[i - 1] || {}) });
  }
  return list;
}

export function computeClassic(
  f: ClassicForm,
  digitalStd: DigitalClickStandards | null
): ClassicCalc {
  const isDigital = f.jobType === "Digital Direct";
  const qty = Math.max(0, f.quantity || 0);

  const partCalcs = effectiveParts(f).map((p) => computePart(p, qty, isDigital, digitalStd));
  const sum = (get: (c: PartCalc) => number) => partCalcs.reduce((s, c) => s + get(c), 0);
  const p1 = partCalcs[0];

  // ── Paper (summed across parts) ──
  const pressSheets = sum((c) => c.pressSheets);
  const mrWasteSheets = sum((c) => c.mrWasteSheets);
  const orderSheets = sum((c) => c.orderSheets);
  const paperCost = sum((c) => c.paperCost);

  // ── Prep = Electronic Prepress (4) + Camera/Stripping/Platemaking (5) — job-level ──
  const prepHours = (f.designHours || 0) + (f.photoshopHours || 0);
  const prepLabor = prepHours * (f.prepressRate || 0);
  const prepMaterials =
    (f.scans85x11 || 0) * (f.scanCharge85x11 || 0) +
    (f.scans11x17 || 0) * (f.scanCharge11x17 || 0) +
    (f.scans20x25 || 0) * (f.scanCharge20x25 || 0) +
    (f.furnishedDisks || 0) * (f.furnishedDiskCharge || 0) +
    (f.laserProofs || 0) * (f.laserProofCharge || 0) +
    (f.colorProofs || 0) * (f.colorProofCharge || 0) +
    ((f.dyluxProofs || 0) * (f.dyluxCharge || 0) +
      (f.matchprintProofs || 0) * (f.matchprintCharge || 0) +
      (f.separations || 0) * (f.separationCharge || 0)) *
      (f.plateDiffFactor || 1);
  const prepCost = prepLabor + prepMaterials;

  // ── Press (summed) ──
  const pressLaborCost = sum((c) => c.pressLaborCost);
  const pressMaterialsCost = sum((c) => c.pressMaterialsCost);
  const pressCost = pressLaborCost + pressMaterialsCost;
  const inkCost = sum((c) => c.inkCost);

  // ── Bindery (summed) ──
  const binderyLabor = sum((c) => c.binderyLabor);
  const cartonSkidCost = sum((c) => c.cartonSkidCost);
  const binderyCost = binderyLabor;
  const prepCostWithMaterials = prepCost + cartonSkidCost;

  // ── Outside / pass-through (Screen 9) ──
  const digitalClickTotal = sum((c) => c.digitalClickCost + c.digitalVDCost + c.digitalVDSetupCost);
  const outsideCost =
    f.outsidePurchases.reduce((s, p) => s + (Number(p.amount) || 0), 0) + digitalClickTotal;
  const freightAndAdditional = (f.freight || 0) + (f.additionalCosts || 0);

  // ── Sellings (E&M cost sheet) ──
  // E&M charges a $1 minimum markup on any nonzero cost line (Cybake #347528:
  // Outside 843.80 at 0% still shows +1.00).
  const mk = (cost: number, pct: number) =>
    cost > 0 ? cost + Math.max((cost * (pct || 0)) / 100, 1) : 0;
  const paperSelling = mk(paperCost, f.markupPaperPct);
  const prepSelling = mk(prepCostWithMaterials, f.markupMaterialPct);
  const pressSelling = mk(pressCost, f.markupLaborPct);
  const binderySelling = mk(binderyCost, f.markupLaborPct);
  const outsideSelling = mk(outsideCost, f.markupOutsidePct);

  const totalCost = paperCost + prepCostWithMaterials + pressCost + binderyCost + outsideCost + freightAndAdditional;
  // Commission is % of total COST, not of selling — verified against Cybake
  // #347528 (117.33 = 10% × 1,173.28) — added on top like a markup line.
  const commission = totalCost * ((f.commissionPct || 0) / 100);
  const sellingSubtotal =
    paperSelling + prepSelling + pressSelling + binderySelling + outsideSelling + freightAndAdditional;
  const total = sellingSubtotal + commission;

  return {
    isDigital,
    partCalcs,
    pressSheets, mrWasteSheets, orderSheets, paperCost, paperSelling,
    prepHours, prepLabor,
    prepMaterials: prepMaterials + cartonSkidCost,
    prepCost: prepCostWithMaterials,
    prepSelling,
    plates: sum((c) => c.plates),
    makereadyHrs: sum((c) => c.makereadyHrs),
    washupHrs: sum((c) => c.washupHrs),
    runHrs: sum((c) => c.runHrs),
    dieScoreHrs: sum((c) => c.dieScoreHrs),
    pressCheckHrs: sum((c) => c.pressCheckHrs),
    pressHrs: sum((c) => c.pressHrs),
    inkLbs: sum((c) => c.inkLbs),
    inkCost, pressLaborCost, pressMaterialsCost, pressCost, pressSelling,
    digitalTier: p1.digitalTier,
    digitalClickRate: p1.digitalClickRate,
    digitalVDRate: p1.digitalVDRate,
    digitalClickSheets: sum((c) => c.digitalClickSheets),
    digitalClickCost: sum((c) => c.digitalClickCost),
    digitalVDCost: sum((c) => c.digitalVDCost),
    digitalVDSetupCost: sum((c) => c.digitalVDSetupCost),
    cutterHrs: sum((c) => c.cutterHrs),
    drillHrs: sum((c) => c.drillHrs),
    handOp1Hrs: sum((c) => c.handOp1Hrs),
    handOp2Hrs: sum((c) => c.handOp2Hrs),
    binderyHrs: sum((c) => c.binderyHrs),
    binderyLabor, cartonSkidCost, binderyCost, binderySelling,
    outsideCost, outsideSelling,
    freightAndAdditional,
    totalCost, sellingSubtotal, commission, total,
    costPerUnit: qty > 0 ? total / qty : 0,
    costPerM: qty > 0 ? (total / qty) * 1000 : 0,
  };
}

// ── Quantity tiers (E&M quotes multiple quantities per estimate) ─────────
export interface QuantityBreak {
  quantity: number;
  total: number;
  costPerUnit: number;
  costPer1000: number;
}

/** Re-run the whole estimate at each quantity (primary first). Everything
 *  else stays as entered — fixed MR/overs sheets stay fixed; %-driven waste
 *  and per-piece sheets scale naturally. */
export function computeQuantityBreaks(
  f: ClassicForm,
  digitalStd: DigitalClickStandards | null
): QuantityBreak[] {
  const qtys = [
    f.quantity || 0,
    ...(Array.isArray(f.additionalQuantities) ? f.additionalQuantities : []).map((q) => Number(q) || 0).filter((q) => q > 0),
  ];
  return qtys.map((q) => {
    const c = computeClassic({ ...f, quantity: q }, digitalStd);
    return { quantity: q, total: c.total, costPerUnit: c.costPerUnit, costPer1000: c.costPerM };
  });
}
