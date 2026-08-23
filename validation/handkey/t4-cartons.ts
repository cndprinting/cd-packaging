// TRANCHE 4 — folding cartons. npx tsx validation/handkey/t4-cartons.ts
import { defaultClassicForm, type ClassicForm } from "../../src/lib/classic-estimate";
import { runQuote, report, type HandKeyResult } from "./runner";

const out: HandKeyResult[] = [];
const komori = (): ClassicForm => {
  const f: any = defaultClassicForm();
  f.pressHourlyRate = 188.5; f.useSpeedCurve = false;
  f.deliveryRatePerHr = 50; f.paperBuyRounding = 10;
  f.plateCostEach = 19; f.plateHrsPerPlate = 0.075; f.plateLaborRate = 45;
  f.prepressRate = 45; f.typeOutputRate = 45;
  f.makereadyDiff = 1; f.pressSetupHrs = 0.081;
  return f as ClassicForm;
};

{ // 348484 — Aruba Aloe candle tuck box 4/0 + LED UV outside, x6100
  const f: any = komori();
  f.quantity = 6100; f.jobTitle = "Candle box tuck 3.375x1.75x5.9";
  f.pricePerM = 614.0; f.numberUp = 2; f.sheetsOutOfParent = 2; f.weightPerMSheets = 560;
  f.runColorsSide1 = 4; f.runColorsSide2 = 0;
  f.wasteSheetsManual = 420; f.runWastePct = (107 / 3050) * 100;
  f.runSpeedSph = 8000; f.baseMakereadyHrsPerPlate = 0.2 / 3;
  f.washupHrsPerUnit = 0.05;
  f.inkLbsManual = 268.66 / 10.84;
  f.typeOutputHrs = 0.469; f.colorProofs = 1; f.colorProofCharge = 8.80;
  f.plateCostEach = 19; // printed 3 plates @ 57 -> key colors for 3? use override below
  (f as any).overridePlates = 0;
  f.outsidePurchases = [{ description: "C&D 26 166-06 + LED UV + ctns", amount: 909.38 }];
  f.freight = 0; f.deliveryHrs = 0;
  f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
  f.handOp1 = { description: "DC/GL/Fold", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.packHrs = 0.925; f.cartons = 37; f.cartonCost = 0.93;
  out.push(runQuote("348484", "candle tuck box x6100", f, {
    letterPrice: 3689.0, internalTotal: 3689.55, paperCost: 1099.06, outsideCost: 909.38,
    perBucket: { material: 368.87 },
  }));
}
{ // 348627 — SCAR HEAL 10ml boxes, 2 versions, foil/diecut outside, x50,000
  const f: any = komori();
  f.quantity = 50000; f.jobTitle = "10ml boxes, 2 versions";
  f.pricePerM = 231.48; f.numberUp = 16; f.weightPerMSheets = 198;
  f.runColorsSide1 = 1; f.runColorsSide2 = 0; f.coatingType = "Varnish"; f.coatingDollarsPerLb = 0;
  f.wasteSheetsManual = 720; f.runWastePct = (281 / 3125) * 100;
  f.runSpeedSph = 5400; f.baseMakereadyHrsPerPlate = 0.2 / 2;
  f.washupHrsPerUnit = 0.1;
  f.inkLbsManual = 103.37 / 10.84;
  f.typeOutputHrs = 0.469; f.colorProofs = 1; f.colorProofCharge = 1.92;
  f.versions = 2;
  f.outsidePurchases = [{ description: "C&D 26 08-01 foil/diecut + Aqu + Ctn", amount: 3322.68 }];
  f.freight = 188.12; f.deliveryHrs = 0.18;
  f.cutterLifts = 21; f.cuttingDiff = 1.0; f.trimHrs = 2.068;
  f.handOp1 = { description: "Diecut/Foil", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.packHrs = 0.75; f.cartons = 30; f.cartonCost = 0.93;
  out.push(runQuote("348627", "10ml boxes x50k", f, {
    letterPrice: 7098.0, internalTotal: 7098.24, paperCost: 956.01, outsideCost: 3510.80,
    perBucket: { labor: 391.25, material: 171.19 },
  }));
}
{ // 348317 — GlowNest SET box 2 PMS + Matte AQ, x300
  const f: any = komori();
  f.quantity = 300; f.jobTitle = "SET box 4x4x5";
  f.pricePerM = 285.76; f.numberUp = 1; f.sheetsOutOfParent = 2; f.weightPerMSheets = 306;
  f.runColorsSide1 = 2; f.runColorsSide2 = 0;
  f.wasteSheetsManual = 350; f.runWastePct = (11 / 300) * 100;
  f.runSpeedSph = 2500; f.baseMakereadyHrsPerPlate = 0.2 / 2;
  f.washupHrsPerUnit = 0.05;
  f.inkLbsManual = 68.41 / 39.5; f.inkCoveragePmsPct = 1; f.inkCoverageColorPct = 0; f.inkCoverageBlackPct = 0;
  f.inkPmsDollarsPerLb = 39.5;
  f.typeOutputHrs = 0.291; f.colorProofs = 1; f.colorProofCharge = 14.92;
  f.outsidePurchases = [{ description: "C&D 26 183-02 + Aqu/Blanket", amount: 450.0 }];
  f.freight = 0; f.deliveryHrs = 0;
  f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
  f.handOp1 = { description: "DC/GL/Fold", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.packHrs = 0.1; f.cartons = 4; f.cartonCost = 0.93;
  out.push(runQuote("348317", "SET box x300, PMS", f, {
    letterPrice: 1153.0, internalTotal: 1153.63, paperCost: 97.16, outsideCost: 450.0,
    perBucket: { material: 125.05 },
  }));
}
{ // 349119 — Simply Vital 1.7oz box x100,000 — the big carton
  const f: any = komori();
  f.quantity = 100000; f.jobTitle = "Collagen Cream 1.7oz box";
  f.pricePerM = 204.37; f.numberUp = 4; f.weightPerMSheets = 219;
  f.runColorsSide1 = 5; f.runColorsSide2 = 0;
  f.wasteSheetsManual = 480; f.runWastePct = (750 / 25000) * 100;
  f.runSpeedSph = 12500; f.baseMakereadyHrsPerPlate = 0.4 / 5;
  f.washupHrsPerUnit = 0.06;
  f.inkLbsManual = 1779.79 / 10.84;
  f.typeOutputHrs = 0.291; f.colorProofs = 1; f.colorProofCharge = 27.0;
  f.outsidePurchases = [{ description: "C&D 26 149-02 + STAQ + ctns", amount: 5985.98 }];
  f.freight = 0; f.deliveryHrs = 0.24;
  f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
  f.handOp1 = { description: "Emboss", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.handOp2 = { description: "DC/GL/Fold", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
  f.packHrs = 5.175; f.cartons = 207; f.cartonCost = 0.93;
  out.push(runQuote("349119", "1.7oz box x100k", f, {
    letterPrice: 19800.0, internalTotal: 19800.66, paperCost: 5362.67, outsideCost: 5985.98,
    perBucket: { material: 2094.30 },
  }));
}
{ // 349120 — Simply Vital 3.4oz box x10,000
  const f: any = komori();
  f.quantity = 10000; f.jobTitle = "Collagen Cream 3.4oz box";
  f.pricePerM = 204.37; f.numberUp = 4; f.weightPerMSheets = 219;
  f.runColorsSide1 = 5; f.runColorsSide2 = 0;
  f.wasteSheetsManual = 640; f.runWastePct = (100 / 2500) * 100;
  f.runSpeedSph = 6480; f.baseMakereadyHrsPerPlate = 0.4 / 5;
  f.washupHrsPerUnit = 0.06;
  f.inkLbsManual = 324.26 / 10.84;
  f.typeOutputHrs = 0.291; f.colorProofs = 1; f.colorProofCharge = 27.0;
  f.outsidePurchases = [{ description: "C&D 25 282-02 + STAQ + ctns", amount: 2252.11 }];
  f.freight = 0; f.deliveryHrs = 0.24;
  f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
  f.handOp1 = { description: "Emboss", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.handOp2 = { description: "DC/GL/Fold", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
  f.packHrs = 0.65; f.cartons = 26; f.cartonCost = 0.93;
  out.push(runQuote("349120", "3.4oz box x10k", f, {
    letterPrice: 5153.0, internalTotal: 5153.0, paperCost: 664.20, outsideCost: 2252.11,
    perBucket: { material: 470.44 },
  }));
}
{ // 349122 — Simply Vital 1oz serum box x20,000
  const f: any = komori();
  f.quantity = 20000; f.jobTitle = "Collagen Serum 1oz box";
  f.pricePerM = 317.06; f.numberUp = 4; f.sheetsOutOfParent = 2; f.weightPerMSheets = 339;
  f.runColorsSide1 = 5; f.runColorsSide2 = 0;
  f.wasteSheetsManual = 560; f.runWastePct = (175 / 5000) * 100;
  f.runSpeedSph = 7180; f.baseMakereadyHrsPerPlate = 0.4 / 5;
  f.washupHrsPerUnit = 0.06;
  f.inkLbsManual = 399.79 / 10.84;
  f.typeOutputHrs = 0.291; f.colorProofs = 1; f.colorProofCharge = 16.80;
  f.outsidePurchases = [{ description: "C&D 25 20-02 + STAQ", amount: 2277.58 }];
  f.freight = 0; f.deliveryHrs = 0.24;
  f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
  f.handOp1 = { description: "Emboss", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.handOp2 = { description: "DC/GL/Fold", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
  f.packHrs = 0.9; f.cartons = 36; f.cartonCost = 0.93;
  out.push(runQuote("349122", "1oz serum box x20k", f, {
    letterPrice: 5737.0, internalTotal: 5737.32, paperCost: 909.96, outsideCost: 2277.58,
    perBucket: { material: 545.07 },
  }));
}

report(out);
