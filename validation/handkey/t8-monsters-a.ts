// TRANCHE 8a — the mixed multi-run publication and the 216pp magazine.
// npx tsx validation/handkey/t8-monsters-a.ts
import { defaultClassicForm, defaultClassicPart, defaultPressRun, type ClassicForm } from "../../src/lib/classic-estimate";
import { runQuote, report, type HandKeyResult } from "./runner";

const out: HandKeyResult[] = [];

{ // 348472 — Wakefield trade pub 28pp self-cover: SHEETWISE + W&T runs in ONE
  // part, Seacap mailing, and the confirmed -252 plate discount.
  const f: any = defaultClassicForm();
  f.quantity = 9500; f.jobTitle = "Trade publication 28pp self-cover";
  f.pressHourlyRate = 188.5; f.useSpeedCurve = false;
  f.deliveryRatePerHr = 50; f.paperBuyRounding = 10;
  f.plateCostEach = 19; f.plateHrsPerPlate = 0.075; f.plateLaborRate = 45;
  f.prepressRate = 45; f.typeOutputRate = 45;
  f.makereadyDiff = 1; f.pressSetupHrs = 0.081; f.washupHrsPerUnit = 0;
  f.pricePerM = 123.65; f.weightPerMSheets = 136;
  f.runColorsSide1 = 4; f.runColorsSide2 = 4;
  // E&M buys the NET sheets (15,750 + 2,750 = "Use 18,500") and bills press
  // time on the gross; runs carry the sheets, the extra press time is keyed.
  f.runs = [
    { ...defaultPressRun(), label: "Run 3: 3 8pp sigs SHEETWISE", sheets: 15750,
      workAndTurn: false, runColorsSide1: 4, runColorsSide2: 4, plates: 24,
      makereadySheets: 0, runWastePct: 0, bindWasteSheets: 0, runSpeedSph: 9375 },
    { ...defaultPressRun(), label: "Run 1: 2 4pp sigs W&T", sheets: 2750,
      workAndTurn: true, runColorsSide1: 4, runColorsSide2: 4, plates: 4,
      makereadySheets: 0, runWastePct: 0, bindWasteSheets: 0, runSpeedSph: 9375 },
  ];
  f.baseMakereadyHrsPerPlate = 2.1 / 28;
  f.pressCheckHrs = 3.85;   // gross-vs-net press time E&M bills beyond the bought sheets
  f.inkLbsManual = 339.81 / 10.84;
  f.designHours = 0.5; f.typeOutputHrs = 0.3; f.colorProofs = 1; f.colorProofCharge = 472.06;
  f.plateDiscount = 252;    // "-252.00 plate discount" — confirmed to the cent
  f.outsidePurchases = [{ description: "Seacap inkjet/sort/mail", amount: 397.50 }];
  f.freight = 0; f.deliveryHrs = 0;
  f.cutterLifts = 1; f.trimHrs = 0.116;
  f.binderyOperation = 2;
  f.foldSetupHrs = 0.992; f.foldRunHrs = 5.562; f.folderRatePerHr = 48;
  f.stitchSetupHrs = 1.192; f.stitchRunHrs = 1.306; f.stitchRatePerHr = 95;
  f.stitchHelpHrs = 1.306; f.stitchHelpRatePerHr = 20;
  f.handOp1 = { description: "Inkjet Sort", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.handOp2 = { description: "Mail", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
  f.cartonCost = 0; (f as any).cartonsPerHour = 100000;  // mailed via Seacap
  out.push(runQuote("348472", "28pp pub, mixed runs + discount", f, {
    letterPrice: 9083.0, internalTotal: 9083.21, paperCost: 2287.53, outsideCost: 145.50,
    perBucket: { material: 1343.87 },
  }));
}
{ // 348228 — Falstaff Travel Europe Magazine: 216pp + cover, 27 runs, $217k
  const f: any = defaultClassicForm();
  f.quantity = 35000; f.numParts = 2; f.jobTitle = "Travel Europe Magazine 216pp + cover";
  f.markupPaperPct = 32; f.markupMaterialPct = 17; f.markupOutsidePct = 30;
  f.commissionPct = 5;   // big-job rate, same as SUPERFRIDGE
  f.deliveryRatePerHr = 50; f.paperBuyRounding = 10; f.useSpeedCurve = false;
  // part 1 — COVER on the Kom LED (plates @ $16)
  f.partName = "Cover";
  f.pricePerM = 174.0; f.numberUp = 2; f.weightPerMSheets = 200;
  f.runColorsSide1 = 4; f.runColorsSide2 = 4; f.workAndTurn = true;
  f.wasteSheetsManual = 560; f.runWastePct = 4;
  f.runSpeedSph = 12500; f.pressHourlyRate = 215; f.pressSetupHrs = 0.081;
  f.makereadyDiff = 1; f.baseMakereadyHrsPerPlate = 0.4 / 4; f.washupHrsPerUnit = 0;
  f.plateCostEach = 16; f.plateHrsPerPlate = 0.05; f.plateLaborRate = 45;
  f.inkLbsManual = 265.35 / 10.84;
  f.designHours = 1.5; f.prepressRate = 45;
  f.colorProofs = 1; f.colorProofCharge = 108.92;
  f.cutterLifts = 94; f.cuttingDiff = 1.2; f.trimHrs = 2.762;
  f.cartonCost = 0; (f as any).cartonsPerHour = 100000;
  // part 2 — TEXT: 27 sheetwise runs, 216 plates, 986,540 sheets
  const p2: any = defaultClassicPart();
  p2.partName = "216pp Text";
  p2.pricePerM = 66.25; p2.numberUp = 1; p2.sheetsPerPiece = 27; p2.weightPerMSheets = 77;
  p2.runColorsSide1 = 4; p2.runColorsSide2 = 4; p2.workAndTurn = false;
  p2.signatureRuns = 27;                          // 216 plates
  p2.wasteSheetsManual = 13080; p2.runWastePct = 3; p2.bindWasteSheets = 100;
  p2.runSpeedSph = 12500; p2.pressHourlyRate = 188.5; p2.pressSetupHrs = 0.081;
  p2.makereadyDiff = 1; p2.baseMakereadyHrsPerPlate = 16.2 / 216; p2.washupHrsPerUnit = 0;
  p2.plateCostEach = 19; p2.plateHrsPerPlate = 0.0505; p2.plateLaborRate = 45;
  p2.inkLbsManual = 10982.21 / 10.84;
  p2.cutterHrsManual = 0.001; p2.sheetsPerLift = 0;
  p2.binderyOperation = 3;
  p2.foldSetupHrs = 6.358; p2.foldRunHrs = 156.354; p2.folderRatePerHr = 48;
  p2.packHrs = 68.375; p2.cartons = 2735; p2.cartonCost = 0.93;
  p2.paperBuyRounding = 10;
  f.parts = [p2];
  f.plateDiscount = 1980;                          // "-1980 = plate discount"
  f.outsidePurchases = [{ description: "Perfect binding service + LED UV", amount: 21611.0 }];
  f.freight = 0; f.deliveryHrs = 0;
  // proof material is per part in E&M; the text's $4,802.46 rides here too
  f.laserProofs = 1; f.laserProofCharge = 4802.46;
  out.push(runQuote("348228", "216pp magazine, 27 runs, $217k", f, {
    letterPrice: 217240.0, internalTotal: 217240.45, paperCost: 68624.26, outsideCost: 19631.0,
  }));
}

report(out);
