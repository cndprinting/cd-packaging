// TRANCHE 6 — saddle books, big brochures, Mary's own #349123 x3 quantities.
// npx tsx validation/handkey/t6-saddle-books.ts
import { defaultClassicForm, type ClassicForm } from "../../src/lib/classic-estimate";
import { runQuote, report, type HandKeyResult } from "./runner";

const out: HandKeyResult[] = [];
const komori = (): ClassicForm => {
  const f: any = defaultClassicForm();
  f.pressHourlyRate = 188.5; f.useSpeedCurve = false;
  f.deliveryRatePerHr = 50; f.paperBuyRounding = 10;
  f.plateCostEach = 19; f.plateHrsPerPlate = 0.075; f.plateLaborRate = 45;
  f.prepressRate = 45; f.typeOutputRate = 45;
  f.makereadyDiff = 1; f.pressSetupHrs = 0.081; f.washupHrsPerUnit = 0;
  return f as ClassicForm;
};

{ // 348440 — Dogs Inc 24pp self-cover saddle x9,900. NO commission.
  const f: any = komori();
  f.quantity = 9900; f.jobTitle = "Life Unleashed 24pp self-cover";
  f.pricePerM = 68.60; f.numberUp = 1; f.sheetsPerPiece = 3; f.weightPerMSheets = 80;
  f.runColorsSide1 = 4; f.runColorsSide2 = 4; f.workAndTurn = false;
  f.signatureRuns = 3;                       // 3 8-page sigs -> 24 plates
  f.wasteSheetsManual = 1300; f.runWastePct = (743 / 29700) * 100; f.bindWasteSheets = 200;
  f.runSpeedSph = 12500; f.baseMakereadyHrsPerPlate = 1.8 / 24;
  f.inkLbsManual = 809.09 / 10.84;
  f.typeOutputHrs = 1.0; f.colorProofs = 1; f.colorProofCharge = 460.58;
  f.commissionMode = "none";                 // FINDING: no commission on this quote
  f.freight = 284.0; f.deliveryHrs = 0.18;
  f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
  f.binderyOperation = 2;
  f.foldSetupHrs = 0.758; f.foldRunHrs = 4.725; f.folderRatePerHr = 48;
  f.stitchSetupHrs = 0.833; f.stitchRunHrs = 1.237; f.stitchRatePerHr = 95;
  f.stitchHelpHrs = 1.237; f.stitchHelpRatePerHr = 20;
  f.packHrs = 2.325; f.cartons = 93; f.cartonCost = 0.93;
  out.push(runQuote("348440", "24pp saddle x9,900, no commission", f, {
    letterPrice: 8029.0, internalTotal: 8030.0, paperCost: 2191.77, outsideCost: 284.0,
    perBucket: { labor: 1922.58, material: 1812.15 },
  }));
}
{ // 348795 — Daily Dose 8pp self-cover 5x7 x150,000. Markups 28/17/30.
  const f: any = komori();
  f.quantity = 150000; f.jobTitle = "8pg self cover 5x7";
  f.markupPaperPct = 28; f.markupMaterialPct = 17; f.markupOutsidePct = 30;
  f.pricePerM = 178.35; f.numberUp = 4; f.weightPerMSheets = 206;
  f.runColorsSide1 = 4; f.runColorsSide2 = 4; f.workAndTurn = false;
  f.wasteSheetsManual = 400; f.runWastePct = (750 / 37500) * 100; f.bindWasteSheets = 3350; // E&M Use 42,000
  f.runSpeedSph = 11200; f.baseMakereadyHrsPerPlate = 0.3 / 6;
  f.inkLbsManual = 534.65 / 10.84;
  // 6 plates for 4/4 (16pp/side layout oddity) — override via colors 3/3
  f.runColorsSide1 = 3; f.runColorsSide2 = 3;
  f.typeOutputHrs = 0.7; f.colorProofs = 1; f.colorProofCharge = 58.42;
  f.outsidePurchases = [{ description: "Additional cut + crease C&D 26 117-01", amount: 1640.0 }];
  f.freight = 0; f.deliveryHrs = 0.18;
  f.cutterLifts = 4; f.cuttingDiff = 1.2; f.trimHrs = 0.255;
  f.binderyOperation = 2;
  f.foldSetupHrs = 0.167; f.foldRunHrs = 15.818; f.folderRatePerHr = 48;
  f.stitchSetupHrs = 0.3; f.stitchRunHrs = 16.875; f.stitchRatePerHr = 95;
  f.stitchHelpHrs = 16.875; f.stitchHelpRatePerHr = 20;
  f.packHrs = 7.8; f.cartons = 312; f.cartonCost = 0.93;
  out.push(runQuote("348795", "8pp saddle x150k", f, {
    letterPrice: 20172.0, internalTotal: 20172.28, paperCost: 7490.70, outsideCost: 1640.0,
    perBucket: { material: 997.24 },
  }));
}
{ // 349108 — CryoCell booklet 5/5, foil outside, PLATE DISCOUNT -72, no commission
  const f: any = komori();
  f.quantity = 10000; f.jobTitle = "CryoCell Maternity booklet Spanish";
  f.paperBuyRounding = 250;
  f.pricePerM = 140.70; f.numberUp = 2; f.weightPerMSheets = 147;
  f.runColorsSide1 = 4; f.runColorsSide2 = 4; f.workAndTurn = false;
  f.signatureRuns = 2;                       // 16 plates
  f.coatingType = "Varnish"; f.coatingDollarsPerLb = 0; f.coatingIsSpot = false;
  f.wasteSheetsManual = 600; f.runWastePct = (125 / 5000) * 100; f.bindWasteSheets = 200;
  f.runSpeedSph = 5600; f.baseMakereadyHrsPerPlate = 1.2 / 16;
  f.inkLbsManual = 93.72 / 10.84;
  f.colorProofs = 1; f.colorProofCharge = 46.58; f.typeOutputHrs = 0.3;
  f.commissionMode = "none";
  f.outsidePurchases = [{ description: "C&D 26 43-01 foil + Aqueous", amount: 919.88 }];
  f.freight = 43.26; f.deliveryHrs = 0.18;
  f.cutterLifts = 1; f.trimHrs = 0.124;
  f.binderyOperation = 2;
  f.foldSetupHrs = 0.292; f.foldRunHrs = 1.591; f.folderRatePerHr = 48;
  f.stitchSetupHrs = 0.4; f.stitchRunHrs = 1.5; f.stitchRatePerHr = 95;
  f.stitchHelpHrs = 1.5; f.stitchHelpRatePerHr = 20;
  f.handOp1 = { description: "Foil Stamp", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.wrapIn = "50"; f.wrapHrs = 0.833; f.wrapRatePerHr = 35;
  f.cartonCost = 0; (f as any).cartonsPerHour = 100000;   // wrapped, no cartons
  out.push(runQuote("349108", "5/5 booklet + foil, plate discount", f, {
    letterPrice: 4337.0, internalTotal: 4337.57, paperCost: 844.20, outsideCost: 963.14,
    perBucket: { material: 444.29 },
  }));
}
{ // 349126 — FKQ RONA brochures, 3 versions x115,000
  const f: any = komori();
  f.quantity = 115000; f.jobTitle = "RONA brochures, 3 versions";
  f.paperBuyRounding = 250;
  f.pricePerM = 128.80; f.numberUp = 4; f.weightPerMSheets = 147;
  f.runColorsSide1 = 4; f.runColorsSide2 = 4; f.workAndTurn = false;
  f.versions = 3;                            // 24 plates
  f.wasteSheetsManual = 5640; f.runWastePct = (6756 / 28750) * 100;
  f.runSpeedSph = 12500; f.baseMakereadyHrsPerPlate = 1.8 / 8;
  f.inkLbsManual = 565.27 / 10.84;
  f.washupHrsPerUnit = 0.025;
  f.typeOutputHrs = 0.513; f.colorProofs = 1; f.colorProofCharge = 95.04;
  f.outsidePurchases = [{ description: "C&D 26 229-03 score", amount: 1019.0 }];
  f.freight = 0; f.deliveryHrs = 0.24;
  f.cutterLifts = 152; f.cuttingDiff = 1.4; f.trimHrs = 5.117;
  f.handOp1 = { description: "Score", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.wrapIn = "50"; f.wrapHrs = 9.583; f.wrapRatePerHr = 35;
  f.packHrs = 5.475; f.cartons = 219; f.cartonCost = 0.93;
  out.push(runQuote("349126", "3-version brochures x115k", f, {
    letterPrice: 14415.0, internalTotal: 14415.77, paperCost: 5313.0, outsideCost: 1019.0,
    perBucket: { material: 1319.98 },
  }));
}
{ // 349123 — Mary's own Simply Vital insert, THREE quantities
  const mk = (qty: number, sph: number, mrWaste: number, wastePct: number, ink: number, score: number,
              cutterL: number, trimH: number, foldRun: number, bandH: number,
              packH: number, cartons: number, exp: any) => {
    const f: any = komori();
    f.quantity = qty; f.jobTitle = "Insert booklet 9.921x3.071";
    f.paperBuyRounding = 250;
    f.pricePerM = 137.66; f.numberUp = 16; f.weightPerMSheets = 141;
    f.runColorsSide1 = 4; f.runColorsSide2 = 4; f.workAndTurn = false;
    f.wasteSheetsManual = mrWaste; f.runWastePct = wastePct; f.bindWasteSheets = 100;
    f.runSpeedSph = sph; f.baseMakereadyHrsPerPlate = 0.6 / 8;
    f.binderyHourlyRate = 35;   // FINDING: banding bills at $35/hr
    f.washupHrsPerUnit = 0.025;
    f.inkLbsManual = ink / 10.84;
    f.typeOutputHrs = 0.444; f.colorProofs = 1; f.colorProofCharge = 10.80;
    f.outsidePurchases = [{ description: "Score (outside)", amount: score }];
    f.freight = 0; f.deliveryHrs = 0.24;
    f.cutterLifts = cutterL; f.cuttingDiff = 1.6; f.trimHrs = trimH;
    f.binderyOperation = 3;
    f.foldSetupHrs = 0.375; f.foldRunHrs = foldRun; f.folderRatePerHr = 48;
    f.handOp1 = { description: "Score", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
    f.bandIn = "100"; f.bandHrs = bandH;
    f.packHrs = packH; f.cartons = cartons; f.cartonCost = 0.93;
    out.push(runQuote("349123", "insert booklet x" + qty / 1000 + "k", f, exp));
  };
  mk(10000, 4000, 800, (25 / 625) * 100, 46.56, 55.0, 7, 1.219, 0.823, 0.417, 0.225, 9,
    { letterPrice: 1419.0, internalTotal: 1419.66, paperCost: 240.91, outsideCost: 55.0, perBucket: { material: 217.73 } });
  mk(20000, 4600, 800, (50 / 1250) * 100, 53.68, 112.0, 8, 1.368, 1.647, 0.833, 0.3, 12,
    { letterPrice: 1744.0, internalTotal: 1744.02, paperCost: 309.74, outsideCost: 112.0, perBucket: { material: 227.64 } });
  mk(100000, 6640, 800, (250 / 6250) * 100, 128.50, 300.0, 27, 4.205, 8.233, 4.167, 0.975, 39,
    { letterPrice: 4430.0, internalTotal: 4430.21, paperCost: 1032.45, outsideCost: 300.0, perBucket: { material: 327.57 } });
}

report(out);
