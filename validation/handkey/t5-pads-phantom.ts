// TRANCHE 5 — pads, big box, phantom, 2-part spot UV. npx tsx validation/handkey/t5-pads-phantom.ts
import { defaultClassicForm, defaultClassicPart, type ClassicForm } from "../../src/lib/classic-estimate";
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

{ // 348597 — TECO activity-report pads x100,000, WORK & TUMBLE 1/1
  const f: any = komori();
  f.quantity = 100000; f.jobTitle = "D-334 pads, 50 sheets";
  f.paperBuyRounding = 500;              // pads round to 500 (again)
  f.pricePerM = 85.32; f.numberUp = 6; f.weightPerMSheets = 71;
  f.runColorsSide1 = 1; f.runColorsSide2 = 1; f.workAndTurn = true; // work & tumble: one plate
  f.wasteSheetsManual = 240; f.runWastePct = (667 / 16667) * 100;
  f.runSpeedSph = 8500; f.baseMakereadyHrsPerPlate = 0.1;
  f.washupHrsPerUnit = 0;
  f.inkLbsManual = 99.79 / 10.84;
  f.typeOutputHrs = 0.269; f.colorProofs = 1; f.colorProofCharge = 3.52;
  f.outsidePurchases = [{ description: "Chipboard", amount: 269.25 }];
  f.freight = 119.63; f.deliveryHrs = 0.24;
  f.cutterLifts = 32; f.cuttingDiff = 1.4; f.trimHrs = 1.72;
  f.handOp1 = { description: "Chipboard", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.padIn = "50"; f.padRatePerHr = 18; f.padsPerHour = 500;   // 2,000 pads -> 4.0 hrs auto
  f.packHrs = 1.675;                     // ctn pack 1.175 + skid pack 0.5 (same $15 rate)
  f.cartons = 47; f.cartonCost = 0.93; f.skids = 1; f.skidCost = 5.0;
  out.push(runQuote("348597", "pads x100k, work & tumble", f, {
    letterPrice: 4514.0, internalTotal: 4514.50, paperCost: 1535.76, outsideCost: 388.88,
    perBucket: { labor: 1057.01, material: 171.02 },
  }));
}
{ // 348598 — TECO risk-briefing pads x30,000, sheetwise 4/4
  const f: any = komori();
  f.quantity = 30000; f.jobTitle = "Job Risk Briefing pads";
  f.paperBuyRounding = 500;
  f.pricePerM = 62.62; f.numberUp = 4; f.weightPerMSheets = 50;
  f.runColorsSide1 = 4; f.runColorsSide2 = 4; f.workAndTurn = false;
  f.wasteSheetsManual = 800; f.runWastePct = (300 / 7500) * 100;
  f.runSpeedSph = 7160; f.baseMakereadyHrsPerPlate = 0.6 / 8;
  f.washupHrsPerUnit = 0;
  f.inkLbsManual = 162.78 / 10.84;
  f.washupHrsPerUnit = 0.0094;
  f.typeOutputHrs = 0.269; f.colorProofs = 1; f.colorProofCharge = 35.20;
  f.outsidePurchases = [{ description: "Chipboard", amount: 66.0 }];
  f.freight = 65.66; f.deliveryHrs = 0.24;
  f.cutterLifts = 12; f.cuttingDiff = 1.4; f.trimHrs = 0.544;
  f.handOp1 = { description: "Chipboard", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.padIn = "50"; f.padRatePerHr = 18; f.padsPerHour = 500;   // 600 pads -> 1.2 hrs auto
  f.packHrs = 0.925;                     // 0.425 pack + 0.5 skid
  f.cartons = 17; f.cartonCost = 0.93; f.skids = 1; f.skidCost = 5.0;
  out.push(runQuote("348598", "pads x30k, sheetwise 4/4", f, {
    letterPrice: 2477.0, internalTotal: 2477.25, paperCost: 563.58, outsideCost: 131.66,
    perBucket: { labor: 687.18, material: 370.79 },
  }));
}
{ // 348352 — R&V Vitaworks ABTT box x116,000 (2 versions)
  const f: any = komori();
  f.quantity = 116000; f.jobTitle = "ABTT box 143x76x96mm";
  f.pricePerM = 181.24; f.numberUp = 2; f.weightPerMSheets = 198;
  f.runColorsSide1 = 2; f.runColorsSide2 = 0;    // plates 2 (K + PMS)
  f.wasteSheetsManual = 250; f.runWastePct = (1450 / 58000) * 100;
  f.runSpeedSph = 12500; f.baseMakereadyHrsPerPlate = 0.2 / 2;
  f.washupHrsPerUnit = 0.05;
  f.inkLbsManual = 1675.27 / 10.84;
  f.typeOutputHrs = 0.444; f.colorProofs = 1; f.colorProofCharge = 29.99;
  f.outsidePurchases = [{ description: "C&D 26 189-01 + AQu + ctns", amount: 5111.58 }];
  f.freight = 0; f.deliveryHrs = 0;
  f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
  f.handOp1 = { description: "DC/GL/Fold", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.packHrs = 10.65; f.cartons = 426; f.cartonCost = 0.93;
  out.push(runQuote("348352", "ABTT box x116k", f, {
    letterPrice: 27176.0, internalTotal: 27176.37, paperCost: 10821.84, outsideCost: 5111.58,
    perBucket: { material: 2139.43 },
  }));
}
{ // 348946 — Dixie BBQ unprinted box, Phantom press, TWO quantities
  const mk = (qty: number, wastePct: number, outside: number, packH: number,
              cartons: number, exp: any) => {
    const f: any = defaultClassicForm();
    f.quantity = qty; f.jobTitle = "Small box 5x5x3, no printing";
    f.deliveryRatePerHr = 50; f.paperBuyRounding = 10;
    f.pressHourlyRate = 33.35; f.pressSetupHrs = 0; f.runSpeedSph = 0;
    f.plateCostEach = 0; f.plateHrsPerPlate = 0;
    f.pricePerM = 285.76; f.numberUp = 2; f.weightPerMSheets = 306;
    f.wasteSheetsManual = 80; f.runWastePct = wastePct;
    f.wastePerColorSheets = 0; f.wastePerEquipmentSheets = 0;
    f.typeOutputHrs = 0.4; f.typeOutputRate = 45; f.prepressRate = 45;
    f.pressCheckHrs = 0.402;            // FINDING: Phantom bills ~$13.42 of setup
    f.outsidePurchases = [{ description: "C&D 26 218-02 diecut/glue", amount: outside }];
    f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
    f.handOp1 = { description: "Diecut/Strip", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
    f.handOp2 = { description: "Glue/Fold", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
    f.packHrs = packH; f.cartons = cartons; f.cartonCost = 0.93;
    out.push(runQuote("348946", "unprinted box x" + qty / 1000 + "k, Phantom", f, exp));
  };
  mk(10000, 3.4, 1495.0, 1.45, 58,
    { letterPrice: 4420.0, internalTotal: 4420.20, paperCost: 1500.24, outsideCost: 1495.0, perBucket: { labor: 55.28 } });
  mk(20000, 2.9, 2135.0, 2.875, 115,
    { letterPrice: 7521.0, internalTotal: 7521.14, paperCost: 2963.33, outsideCost: 2135.0, perBucket: { labor: 76.66 } });
}
{ // 349049 — BioThrive reverse tuck, TWO PARTS: 5/0 print + preprinted Spot LED UV
  const f: any = komori();
  f.quantity = 5000; f.numParts = 2; f.jobTitle = "Reverse tuck 1.55x1.55x4.72";
  // part 1 — the print pass
  f.pricePerM = 201.16; f.numberUp = 4; f.weightPerMSheets = 219;
  f.runColorsSide1 = 4; f.runColorsSide2 = 0;
  f.wasteSheetsManual = 630; f.runWastePct = (56 / 1250) * 100;
  f.runSpeedSph = 6000; f.baseMakereadyHrsPerPlate = 0.3 / 4;
  f.washupHrsPerUnit = 0;
  f.inkLbsManual = 40.88 / 10.84;
  f.typeOutputHrs = 0.169; f.colorProofs = 1; f.colorProofCharge = 13.50;
  f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
  f.cartonCost = 0; (f as any).cartonsPerHour = 100000;   // cartons ride part 2
  f.handOp1 = { description: "Spot LED UV", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  // part 2 — spot UV over the preprinted sheets
  const p2: any = defaultClassicPart();
  p2.partName = "Spot UV"; p2.preprintedPass = true;
  p2.pricePerM = 0; p2.numberUp = 4; p2.weightPerMSheets = 0;
  p2.runColorsSide1 = 1; p2.runColorsSide2 = 0;
  p2.wasteSheetsManual = 240; p2.runWastePct = (50 / 1250) * 100;
  p2.wastePerColorSheets = 0; p2.wastePerEquipmentSheets = 0;
  p2.runSpeedSph = 6000; p2.pressHourlyRate = 188.5; p2.pressSetupHrs = 0.081; p2.washupHrsPerUnit = 0;
  p2.plateCostEach = 0; p2.plateHrsPerPlate = 0; p2.baseMakereadyHrsPerPlate = 0.04;
  p2.cutterHrsManual = 0.001; p2.sheetsPerLift = 0;
  p2.handOp1 = { description: "Diecut/Glue", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  p2.handOp2 = { description: "Fold", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
  p2.packHrs = 0.25; p2.cartons = 10; p2.cartonCost = 0.93;
  p2.deliveryHrs = 0; p2.deliveryRatePerHr = 50;
  f.parts = [p2];
  f.outsidePurchases = [{ description: "C&D 26 225-01 + Aqu/LED UV + Blanket", amount: 1276.65 }];
  f.freight = 50.0; f.deliveryHrs = 0;
  out.push(runQuote("349049", "reverse tuck, 2-part spot UV", f, {
    letterPrice: 2965.0, internalTotal: 2965.85, paperCost: 390.25, outsideCost: 1326.65,
  }));
}

report(out);
