// Classic (E&M Parsec-style) estimator math — shared by
// /dashboard/quotes/estimate-classic. Pure functions over one big form
// object so every number recomputes live as Mary types.
//
// All rates/diffs arrive as editable form fields (prefilled with defaults
// or PlantStandard values) — nothing here reads the database directly.

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

export interface ClassicForm {
  // ── Screen 1 — Main Entry ──
  customerName: string;
  customerNumber: string;
  address: string;
  jobTitle: string;
  quantity: number;
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

  // ── Screen 6 — Paper / Stock ──
  sheetWidthRun: number;
  sheetHeightRun: number;
  sheetWidthOrder: number;
  sheetHeightOrder: number;
  numPages: number;
  stockDescription: string;
  caliperBasisWeight: string;
  pricePerM: number; // $ per 1000 sheets
  numberUp: number;
  sheetsPerPiece: number; // press sheets per finished piece (booklets: 16pg on 4pp/side = 4) — Cybake #347528
  sheetsOutOfParent: number; // press sheets cut from each parent sheet bought (E&M "out of parent"); pricePerM is per PARENT
  bindWasteSheets: number;   // extra press sheets bought for bindery spoilage — paper only, never clicked/printed
  bleedAllowance: string;
  brandColorFinish: string;

  // ── Screen 7 — Press (offset) ──
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
  wasteFactorPct: number;
  helpers: number;
  inkCoverageBlackPct: number;
  inkCoverageColorPct: number;
  inkCoverageVarnishPct: number;
  inkFactorMsqinPerLb: number; // thousand sq-in of coverage per lb of ink
  inkDollarsPerLb: number;
  dieCutHrs: number;
  scorePerfHrs: number;
  dieCost: number;
  pressCheckHrs: number;

  // ── Screen 7 — Digital branch ──
  digitalInkConfig: InkConfig;
  digitalMakereadySheets: number;
  digitalVariableData: boolean;
  digitalVDSetupHrs: number;

  // ── Screen 8 — Bindery ──
  binderyOperation: number; // 1 Flat / 2 Saddle / 3 Folded / 4 Perfect / 5 Multibind / 6 Plastic
  cuttingDiff: number;
  cutterSheetsPerHr: number; // divisor for auto cutter hours
  trimHrs: number;
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
    quantity: 0, numParts: 1,
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
    pricePerM: 0, numberUp: 1, sheetsPerPiece: 1, sheetsOutOfParent: 1, bindWasteSheets: 0, bleedAllowance: "", brandColorFinish: "",
    pressId: "", pressConfigId: "", pressHourlyRate: 0, helperHourlyRate: 0,
    runColorsSide1: 0, runColorsSide2: 0,
    baseMakereadyHrsPerPlate: 0.25, makereadyDiff: 1,
    washupHrsPerUnit: 0.25, washupDiff: 1,
    runSpeedSph: 0, runDiff: 1, wasteFactorPct: 5, helpers: 0,
    inkCoverageBlackPct: 0, inkCoverageColorPct: 0, inkCoverageVarnishPct: 0,
    inkFactorMsqinPerLb: 425, inkDollarsPerLb: 8.5,
    dieCutHrs: 0, scorePerfHrs: 0, dieCost: 0, pressCheckHrs: 0,
    digitalInkConfig: "4/4", digitalMakereadySheets: 25,
    digitalVariableData: false, digitalVDSetupHrs: 0.5,
    binderyOperation: 1, cuttingDiff: 1, cutterSheetsPerHr: 5000,
    trimHrs: 0, drillHoles: 0, drillDiff: 1, drillHrsPerHole: 0.1,
    folderConfig: "",
    handOp1: { description: "", piecesPerHour: 0, pctOfQty: 0 },
    handOp2: { description: "", piecesPerHour: 0, pctOfQty: 0 },
    cartons: 0, cartonCost: 0.93, skids: 0, skidCost: 5, packHrs: 0,
    binderyHourlyRate: 65,
    additionalCosts: 0, freight: 0, outsidePurchases: [],
    deliveryZone: "", quoteNotes: "",
  };
}

export interface ClassicCalc {
  isDigital: boolean;

  // Paper
  pressSheets: number;
  mrWasteSheets: number;
  orderSheets: number;
  paperCost: number;
  paperSelling: number;

  // Prep (Screens 4 + 5) — sold at Material markup
  prepHours: number;
  prepLabor: number;
  prepMaterials: number;
  prepCost: number;
  prepSelling: number;

  // Press (Screen 7) — sold at Labor markup
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
  // digital detail
  digitalTier: 1 | 2 | 3;
  digitalClickRate: number;
  digitalVDRate: number;
  digitalClickSheets: number;
  digitalClickCost: number;
  digitalVDCost: number;
  digitalVDSetupCost: number;

  // Bindery (Screen 8) — sold at Labor markup
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

export function computeClassic(
  f: ClassicForm,
  digitalStd: DigitalClickStandards | null
): ClassicCalc {
  const isDigital = f.jobType === "Digital Direct";
  const qty = Math.max(0, f.quantity || 0);
  const numberUp = Math.max(1, f.numberUp || 1);

  // ── Paper (Screen 6, waste from Screen 7) ──
  const sheetsPerPiece = Math.max(1, f.sheetsPerPiece || 1);
  const pressSheets = Math.ceil((qty * sheetsPerPiece) / numberUp);
  const mrWasteSheets = isDigital
    ? Math.ceil(f.digitalMakereadySheets || 0)
    : Math.ceil(pressSheets * ((f.wasteFactorPct || 0) / 100));
  // Paper buy: press sheets + MR/overs + bindery spoilage, rounded up to whole
  // PARENT sheets (E&M: "Use 1,110 sheets 19x25 ... 2 out of parent").
  // pricePerM is per parent sheet when sheetsOutOfParent > 1.
  const outOfParent = Math.max(1, f.sheetsOutOfParent || 1);
  const sheetsToBuy = pressSheets + mrWasteSheets + Math.ceil(f.bindWasteSheets || 0);
  const orderSheets = Math.ceil(sheetsToBuy / outOfParent);
  const paperCost = (orderSheets / 1000) * (f.pricePerM || 0);

  // ── Prep = Electronic Prepress (4) + Camera/Stripping/Platemaking (5) ──
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

  // ── Press (Screen 7) ──
  const plates = (f.runColorsSide1 || 0) + (f.runColorsSide2 || 0);
  const sheetArea = (f.sheetWidthRun || 0) * (f.sheetHeightRun || 0); // sq in

  let makereadyHrs = 0, washupHrs = 0, runHrs = 0;
  let inkLbs = 0, inkCost = 0;
  let pressLaborCost = 0;
  let digitalTier: 1 | 2 | 3 = 1;
  let digitalClickRate = 0, digitalVDRate = 0, digitalClickSheets = 0;
  let digitalClickCost = 0, digitalVDCost = 0, digitalVDSetupCost = 0;
  const dieScoreHrs = (f.dieCutHrs || 0) + (f.scorePerfHrs || 0);
  const pressCheckHrs = f.pressCheckHrs || 0;
  let pressHrs = 0;

  if (isDigital && digitalStd) {
    // Digital click engine (Mary's tier × ink-config table).
    digitalTier = getDigitalSizeTier(f.sheetWidthRun || 0, f.sheetHeightRun || 0, digitalStd);
    digitalClickRate = getDigitalClickRate(digitalTier, f.digitalInkConfig, digitalStd);
    digitalVDRate = getDigitalVDRate(digitalTier, digitalStd);
    digitalClickSheets = pressSheets + (f.digitalMakereadySheets || 0);
    digitalClickCost = digitalClickSheets * digitalClickRate;
    if (f.digitalVariableData) {
      digitalVDCost = digitalClickSheets * digitalVDRate;
      digitalVDSetupCost = (f.digitalVDSetupHrs || 0) * (digitalStd.digitalVDSetupRate || 0);
    }
    pressHrs = dieScoreHrs + pressCheckHrs;
    // Clicks are NOT press labor — E&M books digital as an outside purchase
    // (Cybake #347528: Digital 793.80 under Outside at 0%). They land in the
    // outside bucket below; press labor is only die/score/press-check hours.
    pressLaborCost = pressHrs * (f.pressHourlyRate || 0);
  } else {
    makereadyHrs = (f.baseMakereadyHrsPerPlate || 0) * (f.makereadyDiff || 1) * plates;
    washupHrs = (f.washupHrsPerUnit || 0) * (f.washupDiff || 1) * plates;
    runHrs = f.runSpeedSph > 0 ? (pressSheets / f.runSpeedSph) * (f.runDiff || 1) : 0;
    pressHrs = makereadyHrs + washupHrs + runHrs + dieScoreHrs + pressCheckHrs;
    // Ink: press sheets × sheet area × coverage% ÷ (thousand sq-in per lb).
    const coveragePct =
      (f.inkCoverageBlackPct || 0) + (f.inkCoverageColorPct || 0) + (f.inkCoverageVarnishPct || 0);
    inkLbs = f.inkFactorMsqinPerLb > 0
      ? (pressSheets * sheetArea * (coveragePct / 100)) / (f.inkFactorMsqinPerLb * 1000)
      : 0;
    inkCost = inkLbs * (f.inkDollarsPerLb || 0);
    pressLaborCost =
      pressHrs * (f.pressHourlyRate || 0) +
      pressHrs * (f.helpers || 0) * (f.helperHourlyRate || 0) +
      inkCost;
  }
  const pressMaterialsCost = f.dieCost || 0;
  const pressCost = pressLaborCost + pressMaterialsCost;

  // ── Bindery (Screen 8) ──
  const cutterHrs = f.cutterSheetsPerHr > 0
    ? (pressSheets / f.cutterSheetsPerHr) * (f.cuttingDiff || 1)
    : 0;
  const drillHrs = (f.drillHoles || 0) * (f.drillHrsPerHole || 0) * (f.drillDiff || 1);
  const op1 = f.handOp1, op2 = f.handOp2;
  const handOp1Hrs = op1.piecesPerHour > 0 ? (qty * (op1.pctOfQty || 0)) / 100 / op1.piecesPerHour : 0;
  const handOp2Hrs = op2.piecesPerHour > 0 ? (qty * (op2.pctOfQty || 0)) / 100 / op2.piecesPerHour : 0;
  const binderyHrs = cutterHrs + (f.trimHrs || 0) + drillHrs + handOp1Hrs + handOp2Hrs + (f.packHrs || 0);
  const binderyLabor = binderyHrs * (f.binderyHourlyRate || 0);
  // Cartons/skids are E&M MATERIAL (18% line on Cybake #347528), not bindery
  // labor — they ride the prep/materials bucket at Material markup below.
  const cartonSkidCost = (f.cartons || 0) * (f.cartonCost || 0) + (f.skids || 0) * (f.skidCost || 0);
  const binderyCost = binderyLabor;
  const prepCostWithMaterials = prepCost + cartonSkidCost;

  // ── Outside / pass-through (Screen 9) ──
  const digitalClickTotal = digitalClickCost + digitalVDCost + digitalVDSetupCost;
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
    pressSheets, mrWasteSheets, orderSheets, paperCost, paperSelling,
    prepHours, prepLabor,
    prepMaterials: prepMaterials + cartonSkidCost,
    prepCost: prepCostWithMaterials,
    prepSelling,
    plates, makereadyHrs, washupHrs, runHrs, dieScoreHrs, pressCheckHrs, pressHrs,
    inkLbs, inkCost, pressLaborCost, pressMaterialsCost, pressCost, pressSelling,
    digitalTier, digitalClickRate, digitalVDRate, digitalClickSheets,
    digitalClickCost, digitalVDCost, digitalVDSetupCost,
    cutterHrs, drillHrs, handOp1Hrs, handOp2Hrs, binderyHrs, binderyLabor,
    cartonSkidCost, binderyCost, binderySelling,
    outsideCost, outsideSelling,
    freightAndAdditional,
    totalCost, sellingSubtotal, commission, total,
    costPerUnit: qty > 0 ? total / qty : 0,
    costPerM: qty > 0 ? (total / qty) * 1000 : 0,
  };
}
