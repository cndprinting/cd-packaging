// TRANCHE 3 — Komori singles, envelopes, mail. npx tsx validation/handkey/t3-komori-envelopes.ts
import { defaultClassicForm, type ClassicForm } from "../../src/lib/classic-estimate";
import { runQuote, report, type HandKeyResult } from "./runner";

const out: HandKeyResult[] = [];
const komori = (): ClassicForm => {
  const f: any = defaultClassicForm();
  f.pressHourlyRate = 188.5; f.useSpeedCurve = false;
  f.deliveryRatePerHr = 50; f.paperBuyRounding = 250;
  f.plateCostEach = 19; f.plateHrsPerPlate = 0.075; f.plateLaborRate = 45;
  f.prepressRate = 45; f.typeOutputRate = 45;
  f.makereadyDiff = 1; f.washupHrsPerUnit = 0.019; f.washupDiff = 1; f.pressSetupHrs = 0.081;
  return f as ClassicForm;
};

{ // 348519 — JWB Water Smart tri-fold brochure, Komori 4/4 x10,000
  const f: any = komori();
  f.quantity = 10000; f.jobTitle = "Water Smart brochure";
  f.pricePerM = 75.10; f.numberUp = 4; f.weightPerMSheets = 80;
  f.runColorsSide1 = 4; f.runColorsSide2 = 4; f.workAndTurn = false;
  f.wasteSheetsManual = 1000; f.runWastePct = 5; f.bindWasteSheets = 100;
  f.runSpeedSph = 5300; f.baseMakereadyHrsPerPlate = 0.6 / 8;
  f.inkLbsManual = 59.68 / 10.84;      // printed ink line — coverage is Mary's call
  f.typeOutputHrs = 0.369; f.colorProofs = 1; f.colorProofCharge = 35.20;
  f.freight = 44.61; f.deliveryHrs = 0.18;
  f.cutterLifts = 8; f.cuttingDiff = 1.0; f.trimHrs = 0.354;
  f.binderyOperation = 3; f.foldSetupHrs = 0.25; f.foldRunHrs = 0.607; f.folderRatePerHr = 48;
  f.packHrs = 0.275; f.cartons = 11; f.cartonCost = 0.93;
  out.push(runQuote("348519", "tri-fold brochure, Komori 4/4", f, {
    letterPrice: 1536.0, internalTotal: 1536.18, paperCost: 281.63, outsideCost: 44.61,
    perBucket: { labor: 502.86, material: 257.11 },
  }));
}
{ // 349116 — All Childrens invite, Komori + foil die outside x760
  const f: any = komori();
  f.quantity = 760; f.jobTitle = "Evening At invite + foil";
  f.pricePerM = 963.20; f.numberUp = 2; f.sheetsOutOfParent = 4; f.weightPerMSheets = 480;
  f.paperBuyRounding = 10;
  f.runColorsSide1 = 4; f.runColorsSide2 = 4; f.workAndTurn = false;
  f.wasteSheetsManual = 900; f.runWastePct = (15 / 380) * 100;
  f.runSpeedSph = 4650; f.baseMakereadyHrsPerPlate = 0.6 / 8;
  f.inkLbsManual = 42.67 / 10.84;
  f.typeOutputHrs = 0.444; f.colorProofs = 1; f.colorProofCharge = 24.0;
  f.commissionPct = 15;
  f.outsidePurchases = [{ description: "C&D 26 230-01 foil die", amount: 374.0 }];
  f.freight = 49.47; f.deliveryHrs = 0;
  f.cutterLifts = 4; f.cuttingDiff = 1.07; f.trimHrs = 0.217;
  f.binderyOperation = 3; f.foldSetupHrs = 0.2; f.foldRunHrs = 0.25; f.folderRatePerHr = 48;
  f.handOp1 = { description: "Foil Stamp", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.handOp2 = { description: "Score", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
  f.packHrs = 0.483; f.cartons = 29; f.cartonCost = 0.52;
  out.push(runQuote("349116", "foil invite, Komori", f, {
    letterPrice: 1869.0, internalTotal: 1869.35, paperCost: 317.86, outsideCost: 423.47,
    perBucket: { labor: 310.60, material: 233.75 },
  }));
}
{ // 349098 — Raymond James postcard mailing, Komori 4/4 W&T + Seacap x6200
  const f: any = komori();
  f.quantity = 6200; f.jobTitle = "Postcard mailing, 3 drops";
  f.pricePerM = 183.73; f.numberUp = 8; f.weightPerMSheets = 183;
  f.runColorsSide1 = 4; f.runColorsSide2 = 4; f.workAndTurn = true;
  f.wasteSheetsManual = 720; f.runWastePct = (47 / 775) * 100;
  f.runSpeedSph = 4400; f.baseMakereadyHrsPerPlate = 0.4 / 4;
  f.inkLbsManual = 39.38 / 10.84;
  f.typeOutputHrs = 0.1; f.colorProofs = 1; f.colorProofCharge = 16.0;
  f.outsidePurchases = [{ description: "Seacap inkjet/sort/mail", amount: 277.80 }];
  f.freight = 44.16; f.deliveryHrs = 0.36;
  f.cutterLifts = 8; f.cuttingDiff = 1.4; f.trimHrs = 0.674;
  f.handOp1 = { description: "Inkjet address", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.cartonCost = 0; (f as any).cartonsPerHour = 100000;   // FINDING: cannot key "no cartons" — 0 = auto
  out.push(runQuote("349098", "postcard mailing, Komori", f, {
    letterPrice: 1521.0, internalTotal: 1521.53, paperCost: 321.53, outsideCost: 321.96,
    perBucket: { labor: 300.35, material: 131.38 },
  }));
}
{ // 349112 — MGE #10 envelopes 4/0 VD, SMALL press x2839
  const f: any = defaultClassicForm();
  f.quantity = 2839; f.jobTitle = "#10 envelopes w/ VD";
  f.deliveryRatePerHr = 50; f.paperBuyRounding = 10; f.markupPaperPct = 33;
  f.pricePerM = 28.01; f.numberUp = 1; f.weightPerMSheets = 5;
  f.pressHourlyRate = 33.35; f.pressSetupHrs = 0.2; f.runSpeedSph = 0; f.useSpeedCurve = false;
  f.plateCostEach = 0; f.plateHrsPerPlate = 0; f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
  f.wasteSheetsManual = 60; f.runWastePct = (14 / 2839) * 100;
  f.wastePerColorSheets = 0; f.wastePerEquipmentSheets = 0;
  f.outsidePurchases = [
    { description: "Digital / VD", amount: 1003.93, markupPct: 0 },
    { description: "Insert/Sort", amount: 188.88 },
  ];
  f.freight = 45.87; f.deliveryHrs = 0.18;
  f.handOp1 = { description: "Insert/sort", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.handOp2 = { description: "Mail", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
  out.push(runQuote("349112", "#10 envelopes, VD + mail", f, {
    letterPrice: 1580.0, internalTotal: 1580.20, paperCost: 84.03,
    perBucket: { labor: 19.34 },
  }));
}
{ // 349124 — SUPERFRIDGE cards 5/0 w/ Aqu, 3 versions, 5% commission
  const f: any = komori();
  f.quantity = 1010; f.jobTitle = "Cards 7x18.5, 3 versions";
  f.pricePerM = 245.88; f.numberUp = 3; f.weightPerMSheets = 263;
  f.paperBuyRounding = 10;
  f.runColorsSide1 = 4; f.runColorsSide2 = 0;
  f.wasteSheetsManual = 945; f.runWastePct = (23 / 337) * 100;
  f.runSpeedSph = 6500; f.baseMakereadyHrsPerPlate = 0.3 / 4;
  f.inkLbsManual = 36.38 / 10.84;
  f.typeOutputHrs = 0.611; f.colorProofs = 1; f.colorProofCharge = 33.18;
  f.commissionPct = 5;
  f.outsidePurchases = [
    { description: "Addl ctns", amount: 5.20 },
    { description: "Aqu", amount: 5.81 },
  ];
  f.freight = 0; f.deliveryHrs = 0.24;
  f.cutterLifts = 9; f.cuttingDiff = 1.4; f.trimHrs = 0.372;
  f.packHrs = 0.325; f.cartons = 13; f.cartonCost = 0.93;
  out.push(runQuote("349124", "versioned cards, 5% commission", f, {
    letterPrice: 932.0, internalTotal: 932.51, paperCost: 322.10, outsideCost: 11.01,
    perBucket: { labor: 192.43, material: 157.65 },
  }));
}
{ // 349117 — All Childrens 6.25 sq envelope, digital + foil x760
  const f: any = defaultClassicForm();
  f.quantity = 760; f.jobTitle = "6.25 sq envelope, foil + mail";
  f.deliveryRatePerHr = 50; f.paperBuyRounding = 10; f.markupPaperPct = 33;
  f.pricePerM = 238.0; f.numberUp = 1; f.weightPerMSheets = 15;
  f.pressHourlyRate = 33.35; f.pressSetupHrs = 0.2; f.runSpeedSph = 0; f.useSpeedCurve = false;
  f.plateCostEach = 0; f.plateHrsPerPlate = 0; f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
  f.wasteSheetsManual = 340; f.runWastePct = 0;
  f.wastePerColorSheets = 0; f.wastePerEquipmentSheets = 0;
  f.commissionPct = 15;
  f.outsidePurchases = [
    { description: "C&D 23 230-02 foil die", amount: 235.0, markupPct: 0 },
    { description: "Digital w/ VD", amount: 344.50, markupPct: 0 },
    { description: "insert/sort", amount: 156.95, markupPct: 0 },
  ];
  f.freight = 163.78; f.deliveryHrs = 0.3;
  f.handOp1 = { description: "Foil Stamp", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.handOp2 = { description: "Address", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
  // FINDING (unresolved): E&M labor bucket 64.92 but only ~23.80 decomposes
  // from printed lines. Residual ~41 keyed as press-check; flagged for Mary.
  f.pressCheckHrs = 0.03;
  out.push(runQuote("349117", "sq envelope digital + foil", f, {
    letterPrice: 1464.0, internalTotal: 1464.0, paperCost: 261.80, outsideCost: 900.23,
    perBucket: { labor: 25.34 },
  }));
}

report(out);
