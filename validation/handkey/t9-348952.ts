// TRANCHE 9b -- #348952 Raymond James pocket folder x100, $1,405.08.
// Mary's live A/B against QT-2026-084/086. Keyed from the E&M printout.
// npx tsx validation/handkey/t9-348952.ts
import { defaultClassicForm } from "../../src/lib/classic-estimate";
import { runQuote, report, type HandKeyResult } from "./runner";

const out: HandKeyResult[] = [];
const f: any = defaultClassicForm();
f.quantity = 100; f.jobTitle = "Muller Asset Management pocket folder 9x12";
f.markupPaperPct = 33; f.markupMaterialPct = 18; f.markupOutsidePct = 32; f.markupLaborPct = 40;
f.commissionPct = 10; f.deliveryRatePerHr = 50; f.useSpeedCurve = false;

// Paper: McCoy Silk Cover 120lb, parent 26x40 @ 943.20/M, press sheet 20x26,
// 2 out of parent. Use 360 parents = 339.55.
f.pricePerM = 943.20; f.weightPerMSheets = 480; f.paperBuyRounding = 10;
f.sheetWidthRun = 20; f.sheetHeightRun = 26; f.sheetsOutOfParent = 2;
f.numberUp = 1; f.sheetsPerPiece = 1; f.numPages = 2;
f.wasteSheetsManual = 600; f.runWastePct = 5;              // MR 600, press waste 5

// Press: KOMII, 1 color + 1 flood varnish per side, sheetwise -> 2 plates,
// 4 wash/makereadys. Printed: setup .1, MR .1 (0.3), washup .1 (0.3),
// run .4 + .4 at 2000/hr, ink 2.8 lbs color 109.09.
f.runColorsSide1 = 1; f.runColorsSide2 = 1; f.workAndTurn = false;
f.coatingType = "Varnish"; f.coatingIsSpot = false; f.coatingDollarsPerLb = 0;
f.plateCostEach = 19; f.plateHrsPerPlate = 0.05; f.plateHrsDiff = 0.7; f.plateLaborRate = 29.29;
f.pressSetupHrs = 0.1; f.pressSetupDiff = 1;
f.baseMakereadyHrsPerPlate = 0.1111; f.makereadyDiff = 0.3; // 3 units x 0.1111 x 0.3 = 0.1 hr as printed
f.washupHrsPerUnit = 0.1111; f.washupDiff = 0.3;          // 3 units x 0.1111 x 0.3 = 0.1 hr as printed
f.runSpeedSph = 1762.5;                                   // 705 through x 2 passes = 0.8 hr
f.pressHourlyRate = 172.95;   // FINDING: this quote's press lines average $172.95/hr (setup 154 / MR 231 / wash 185 / run 166.5), not the 188.5 KOMII average
f.inkLbsManual = 2.8; f.inkDollarsPerLb = 38.96;          // 2.8 lbs PMS = 109.09

// Prep: type output .3 = 20.00; proof .1 hr = 3.12 + Sherpa2 16.12; plates 2.05 labor.
f.typeOutputHrs = 0.3; f.typeOutputRate = 66.67;
f.designHours = 0.1; f.prepressRate = 31.2;                // proof hours (no dedicated field)
f.laserProofs = 1; f.laserProofCharge = 16.12;

// Bindery: cutter .1 (5 lifts) 3.28, trim .1 (0.5) 6.19, hand DC/GL/Fold 1.88,
// ctn pack .2 -> 7 ctns 6.51 + 2.63 labor, delivery .2 -> 9.00 + freight 37.24.
f.cutterHrsManual = 3.28 / 45; f.sheetsPerLift = 0; f.trimHrs = 6.19 / 45;
f.handOp1 = { description: "DC/GL/Fold", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
f.packHrs = 2.63 / 15; f.cartons = 7; f.cartonCost = 0.93;
f.deliveryHrs = 0.18;
f.paperHandlingHrs = 0.1; f.paperHandlingRate = 26.7;      // E&M 'Paper handling 0.1 Hrs' = 2.67
f.outsidePurchases = [
  { description: "C&D 26 215-01 die cut/glue", amount: 180.0 },
  { description: "LED Gloss Varnish", amount: 31.06 },
];
f.freight = 37.24;

out.push(runQuote("348952", "RJ pocket folder x100 (Mary's live A/B)", f, {
  letterPrice: 1405.0, internalTotal: 1405.08,
  paperCost: 339.55, outsideCost: 248.30,
  perBucket: { material: 169.72, labor: 241.07 },
}));
report(out);
