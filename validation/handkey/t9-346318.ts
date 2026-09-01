// TRANCHE 9 -- THE ACCEPTANCE TEST: #346318, 1oz Tuck Box w/Divider,
// 34 versions, Florida Nutrition, qty 504,750 -> $65,931.47.
// Keyed from Mary's complete screen set (8 input screens 8/27 + cost
// summary/terms/selling 9/1). npx tsx validation/handkey/t9-346318.ts
import { defaultClassicForm, type ClassicForm } from "../../src/lib/classic-estimate";
import { runQuote, report, type HandKeyResult } from "./runner";

const out: HandKeyResult[] = [];

const f: any = defaultClassicForm();
f.quantity = 504750; f.jobTitle = "1oz Tuck Box w/Divider - 34 versions FLN-546";
f.markupPaperPct = 33; f.markupMaterialPct = 18; f.markupOutsidePct = 32; f.markupLaborPct = 40;
f.commissionPct = 10;
f.deliveryRatePerHr = 50; f.useSpeedCurve = false;

// Paper screen: 18pt C1S 23x29 @ 295.00/M, basis 180. Cost 21,343.25 =
// exactly 72,350 sheets. 8-up on the FLN-546 die.
f.pricePerM = 295.0; f.weightPerMSheets = 180; f.paperBuyRounding = 10;
f.numberUp = 8; f.sheetsPerPiece = 1;
f.sheetWidthRun = 23; f.sheetHeightRun = 29;
// 34 versions: 5 base colors + 55 extra plates (the screen's Extra Plates).
f.runColorsSide1 = 5; f.runColorsSide2 = 0;
f.extraPlates = 55;
f.plateCostEach = 19; f.plateHrsPerPlate = 0.075; f.plateLaborRate = 19.73;
// Makeready: 100/plate-change keyed as waste; remainder is running waste to
// land the printed 72,350-sheet order.
f.wasteSheetsManual = 6090; f.runWastePct = (3156 / 63094) * 100;
f.runSpeedSph = 8000; f.pressHourlyRate = 188.5; f.pressSetupHrs = 0.081;
f.makereadyDiff = 0.4; f.baseMakereadyHrsPerPlate = 0.1; f.washupHrsPerUnit = 0.025; f.washupDiff = 0.3;
f.helpers = 1; f.helperHourlyRate = 20;
f.inkLbsManual = 0;          // from coverage: 6% black + 12%/color process
f.coatingType = "Varnish"; f.coatingIsSpot = false; f.inkCoverageVarnishPct = 12;
// E&M screen reads "12% Color" as TOTAL color coverage on this quote
f.inkCoverageColorPct = 12;
f.laserProofs = 1; f.laserProofCharge = 637.62; // Sherpa43 x14 + Sherpa2 + 30 scans (E&M proof material)
f.cutterLifts = 145; f.cuttingDiff = 0.5; f.trimHrs = 17.46;
f.packHrs = 25; f.cartons = 0; f.cartonCost = 0;
f.outsidePurchases = [
  { description: "C&D 22 230-01 die cut/glue", amount: 13482.0 },
  { description: "CTNS", amount: 760.0 },
  { description: "Softtouch", amount: 2256.0 },
];
f.freight = 1747.45;
f.deliveryHrs = 0;
f.pressCheckHrs = 6.017;   // E&M presses 24.5 total press+prep hrs (69.5 - 45 bind)

out.push(runQuote("346318", "ACCEPTANCE TEST tuck box x504,750", f, {
  letterPrice: 65931.0, internalTotal: 65931.47,
  paperCost: 21343.25, outsideCost: 18245.45,
  perBucket: { material: 2601.11, labor: 4487.9 },
}));

report(out);

