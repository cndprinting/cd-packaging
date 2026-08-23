// TRANCHE 8b — #343786 Kolter case-bound book: 5 parts, 5 stocks, $76,795.
// npx tsx validation/handkey/t8-kolter.ts
import { defaultClassicForm, defaultClassicPart, type ClassicForm } from "../../src/lib/classic-estimate";
import { runQuote, report, type HandKeyResult } from "./runner";

const out: HandKeyResult[] = [];

const f: any = defaultClassicForm();
f.quantity = 250; f.numParts = 5; f.jobTitle = "Kolter case-bound 128pp + foldout + 7 inserts";
f.markupPaperPct = 22; f.markupMaterialPct = 17; f.markupOutsidePct = 30; f.markupLaborPct = 38;
f.commissionPct = 10;
f.deliveryRatePerHr = 50; f.useSpeedCurve = false;

// ── Part 1: End sheet — Reich Shine metallic 28x40 ──
f.partName = "End sheet";
f.pricePerM = 2926.91; f.numberUp = 1; f.sheetsPerPiece = 1; f.weightPerMSheets = 461;
f.paperBuyRounding = 10;
f.runColorsSide1 = 1; f.runColorsSide2 = 0; f.signatureRuns = 2;   // 2 plates @ 16
f.plateCostEach = 16; f.plateHrsPerPlate = 0.045; f.plateLaborRate = 45;
f.wasteSheetsManual = 130; f.runWastePct = (20 / 250) * 100;
f.runSpeedSph = 0; f.pressHourlyRate = 215; f.pressSetupHrs = 0.1;
f.makereadyDiff = 1; f.baseMakereadyHrsPerPlate = 0.2 / 2; f.washupHrsPerUnit = 0;
f.pressCheckHrs = 2.62;                    // the printed 2.4-hr run + trim on this slow stock
f.inkLbsManual = 39.05 / 10.84;
f.designHours = 2.3; f.prepressRate = 58.7;
f.laserProofs = 1; f.laserProofCharge = 5026.73;   // proof material across all 5 parts
f.cutterLifts = 5; f.cuttingDiff = 1.36; f.trimHrs = 0.22;
f.wrapIn = "1"; f.wrapHrs = 2.083; f.wrapRatePerHr = 35;
f.cartonCost = 0; (f as any).cartonsPerHour = 100000;

// ── Part 2: 128pgs — 16 sheetwise runs on the Kom LED 6/6, 192 plates ──
const p2: any = defaultClassicPart();
p2.partName = "128pgs";
p2.pricePerM = 653.40; p2.numberUp = 1; p2.sheetsPerPiece = 16; p2.weightPerMSheets = 170;
p2.paperBuyRounding = 500;
p2.runColorsSide1 = 6; p2.runColorsSide2 = 6; p2.workAndTurn = false; p2.signatureRuns = 16;
p2.plateCostEach = 16; p2.plateHrsPerPlate = 0.045; p2.plateLaborRate = 45;
p2.wasteSheetsManual = 19400; p2.runWastePct = 5;
p2.runSpeedSph = 4720; p2.useSpeedCurve = false; p2.pressHourlyRate = 215; p2.pressSetupHrs = 0.1;
p2.makereadyDiff = 1; p2.baseMakereadyHrsPerPlate = 14.4 / 192; p2.washupHrsPerUnit = 0;
p2.inkLbsManual = 1946.25 / 10.84;
p2.cutterLifts = 102; p2.cuttingDiff = 1.6; p2.trimHrs = 3.981;
p2.handOp1 = { description: "Score", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
p2.packHrs = 3.675; p2.cartons = 147; p2.cartonCost = 0.93;

// ── Part 3: Fold out ──
const p3: any = defaultClassicPart();
p3.partName = "Fold out";
p3.pricePerM = 653.40; p3.numberUp = 1; p3.sheetsPerPiece = 1; p3.weightPerMSheets = 170;
p3.paperBuyRounding = 10;
p3.runColorsSide1 = 5; p3.runColorsSide2 = 5; p3.workAndTurn = false;   // 10 plates @ 16
p3.plateCostEach = 16; p3.plateHrsPerPlate = 0.045; p3.plateLaborRate = 45;
p3.wasteSheetsManual = 1200; p3.runWastePct = (13 / 250) * 100; p3.bindWasteSheets = 787; // E&M Use 2,250
p3.runSpeedSph = 3658; p3.useSpeedCurve = false; p3.pressHourlyRate = 215; p3.pressSetupHrs = 0.1;
p3.makereadyDiff = 1; p3.baseMakereadyHrsPerPlate = 0.8 / 10; p3.washupHrsPerUnit = 0;
p3.inkLbsManual = 172.27 / 10.84;
p3.cutterLifts = 10; p3.cuttingDiff = 1.6; p3.trimHrs = 0.267;
p3.binderyOperation = 3;
p3.foldSetupHrs = 0.25; p3.foldRunHrs = 0.25; p3.folderRatePerHr = 48;
p3.handOp1 = { description: "Score", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
p3.packHrs = 0.35; p3.cartons = 14; p3.cartonCost = 0.93;

// ── Part 4: 6 inserts — 12pp sig, 6-up, 3/3 ──
const p4: any = defaultClassicPart();
p4.partName = "6 inserts";
p4.pricePerM = 849.0; p4.numberUp = 6; p4.sheetsPerPiece = 6; p4.weightPerMSheets = 400;
p4.paperBuyRounding = 10;
p4.runColorsSide1 = 3; p4.runColorsSide2 = 3; p4.workAndTurn = false;   // 6 plates @ 16
p4.plateCostEach = 16; p4.plateHrsPerPlate = 0.045; p4.plateLaborRate = 45;
p4.wasteSheetsManual = 700; p4.runWastePct = (13 / 250) * 100;
p4.runSpeedSph = 4815; p4.useSpeedCurve = false; p4.pressHourlyRate = 215; p4.pressSetupHrs = 0.1;
p4.makereadyDiff = 1; p4.baseMakereadyHrsPerPlate = 0.4 / 6; p4.washupHrsPerUnit = 0;
p4.inkLbsManual = 38.81 / 10.84;
p4.cutterLifts = 10; p4.cuttingDiff = 1.6; p4.trimHrs = 0.733;
p4.handOp1 = { description: "Score", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
p4.packHrs = 0.35; p4.cartons = 14; p4.cartonCost = 0.93;

// ── Part 5: 1 insert on the Phantom + the BindTech outside block ──
const p5: any = defaultClassicPart();
p5.partName = "1 insert";
p5.pricePerM = 2926.91; p5.numberUp = 1; p5.sheetsPerPiece = 1; p5.weightPerMSheets = 461;
p5.paperBuyRounding = 10; p5.sheetsOutOfParent = 2;
p5.runColorsSide1 = 0; p5.runColorsSide2 = 0;
p5.plateCostEach = 0; p5.plateHrsPerPlate = 0;
p5.wasteSheetsManual = 133; p5.runWastePct = (15 / 250) * 100;
p5.runSpeedSph = 0; p5.useSpeedCurve = false; p5.pressHourlyRate = 33.35; p5.pressSetupHrs = 0;
p5.pressCheckHrs = 0.08; p5.washupHrsPerUnit = 0;
p5.cutterLifts = 3; p5.cuttingDiff = 1.03; p5.trimHrs = 0.145;
p5.handOp1 = { description: "Emboss/Score", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
p5.handOp2 = { description: "Collate/Bind", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
p5.packHrs = 0.1; p5.cartons = 4; p5.cartonCost = 0.93;
p5.deliveryHrs = 0.3; p5.deliveryRatePerHr = 50;
p5.binderyOperation = 7;                   // Case Bound

f.parts = [p2, p3, p4, p5];
f.outsidePurchases = [{ description: "BindTech + C&D25 189/5 6 7 + Handwork/PS", amount: 11641.30 }];
f.freight = 10000.0;                        // Outside Freight, at cost
f.binderyOvers = 5;                         // "5 overs in Bindtech price"

// The letter says $76,795 but the five printed part totals sum to $78,295.28
// -- a manual $1,500 reduction on the letter (finding). Target the parts sum.
out.push(runQuote("343786", "Kolter case-bound, 5 parts", f, {
  letterPrice: 76795.0, internalTotal: 78295.28,
  paperCost: 1170.76 + 15681.60 + 1470.15 + 823.53 + 585.38,
  outsideCost: 21641.30,
  perBucket: { material: 10748.58, labor: 7633.30 },
}));

report(out);
