// TRANCHE 8c — #347866 Renuvion Body Brag Book 16pp + cover, Kom LED, no commission.
// npx tsx validation/handkey/t8-347866.ts
import { defaultClassicForm, defaultClassicPart, type ClassicForm } from "../../src/lib/classic-estimate";
import { runQuote, report, type HandKeyResult } from "./runner";

const out: HandKeyResult[] = [];

const f: any = defaultClassicForm();
f.quantity = 1000; f.numParts = 2; f.jobTitle = "Renuvion brag book 16pp + cover, flood LED UV";
f.markupPaperPct = 33; f.markupMaterialPct = 18; f.markupOutsidePct = 32; f.markupLaborPct = 40;
f.commissionMode = "none";              // printed markups show commission 0
f.deliveryRatePerHr = 50; f.useSpeedCurve = false;

// -- Part 1: COVER, W&T 2-up on the Kom LED, 4 plates @ 16 --
f.partName = "Cover";
f.pricePerM = 220.0; f.numberUp = 2; f.sheetsPerPiece = 1; f.weightPerMSheets = 220;
f.paperBuyRounding = 250;
f.runColorsSide1 = 4; f.runColorsSide2 = 4; f.workAndTurn = true;   // W&T: 4 plates, 2 passes
f.plateCostEach = 16; f.plateHrsPerPlate = 0; f.plateLaborRate = 45;
f.wasteSheetsManual = 700; f.runWastePct = 5;                        // MR 700, waste 25
f.runSpeedSph = 4800; f.pressHourlyRate = 215; f.pressSetupHrs = 0.1;
f.makereadyDiff = 1; f.baseMakereadyHrsPerPlate = 0.4 / 4; f.washupHrsPerUnit = 0;
f.pressCheckHrs = 0.2108;               // wash 0.2 + prep labor 9.04 + run rounding
f.inkLbsManual = 43.34 / 10.84;
f.laserProofs = 1; f.laserProofCharge = 76.76 + 3.63 + 307.05 + 7.78; // proof+varnish BOTH parts (per-part proof is job-level workaround)
f.cutterHrsManual = (4.59 + 12.23) / 45; f.sheetsPerLift = 0;
f.handOp1 = { description: "Flood LED UV", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
f.handOp2 = { description: "Hand bind 2", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
f.cartonCost = 0; (f as any).cartonsPerHour = 100000;

// -- Part 2: TEXT 16pp, sheetwise Run 2, 16 plates, Mueller saddle --
const p2: any = defaultClassicPart();
p2.partName = "16pp Text";
p2.pricePerM = 147.0; p2.numberUp = 1; p2.sheetsPerPiece = 2; p2.weightPerMSheets = 147;
p2.paperBuyRounding = 250;
p2.runColorsSide1 = 4; p2.runColorsSide2 = 4; p2.workAndTurn = false;
p2.signatureRuns = 2;                   // 16 plates
p2.plateCostEach = 16; p2.plateHrsPerPlate = 0; p2.plateLaborRate = 45;
p2.wasteSheetsManual = 1650; p2.runWastePct = 3.75; p2.bindWasteSheets = 200;
p2.runSpeedSph = 5200; p2.useSpeedCurve = false; p2.pressHourlyRate = 215; p2.pressSetupHrs = 0.1;
p2.makereadyDiff = 1; p2.baseMakereadyHrsPerPlate = 1.2 / 16; p2.washupHrsPerUnit = 0;
p2.pressCheckHrs = 0.2776;              // wash 20 MRs + prep labor 26.81
p2.inkLbsManual = 79.22 / 10.84;
p2.cutterHrsManual = (0.66 + 5.14) / 45; p2.sheetsPerLift = 0;
p2.binderyOperation = 2;
p2.foldSetupHrs = 25.2 / 48; p2.foldRunHrs = 15.27 / 48; p2.folderRatePerHr = 48;
p2.stitchSetupHrs = 102.92 / 95; p2.stitchRunHrs = 23.75 / 95; p2.stitchRatePerHr = 95;
p2.stitchHelpHrs = 5.0 / 20; p2.stitchHelpRatePerHr = 20;
p2.handOp1 = { description: "Flood LED UV", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
p2.handOp2 = { description: "Score", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
p2.wrapIn = "5"; p2.wrapHrs = 0.833; p2.wrapRatePerHr = 35;
p2.packHrs = 8.25 / 15; p2.cartons = 22; p2.cartonCost = 0.93;

f.parts = [p2];
f.outsidePurchases = [{ description: "Score 150 + Flood LED UV 260.05", amount: 410.05 }];
f.freight = 117.25;                     // outside freight, at cost

out.push(runQuote("347866", "brag book 16pp + cover x1000", f, {
  letterPrice: 4412.0, internalTotal: 4412.94,
  paperCost: 275.0 + 588.0, outsideCost: 527.30,
  perBucket: { material: 187.72 + 670.51, labor: 284.17 + 853.63 },
}));

report(out);
