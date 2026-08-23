// TRANCHE 7 — the digital twin + multi-quantity envelopes and cartons.
// npx tsx validation/handkey/t7-multiqty.ts
import { defaultClassicForm, type ClassicForm } from "../../src/lib/classic-estimate";
import { runQuote, report, type HandKeyResult } from "./runner";

const out: HandKeyResult[] = [];

{ // 349097 — RJ postcard mailing, DIGITAL twin of 349098, x6200
  const f: any = defaultClassicForm();
  f.quantity = 6200; f.jobTitle = "Postcard mailing digital, 3 drops";
  f.deliveryRatePerHr = 50; f.paperBuyRounding = 50; f.markupPaperPct = 33;
  f.pressHourlyRate = 33.35; f.pressSetupHrs = 0.082; f.runSpeedSph = 0;
  f.plateCostEach = 0; f.plateHrsPerPlate = 0;
  f.pricePerM = 183.73; f.numberUp = 8; f.weightPerMSheets = 183;
  f.wasteSheetsManual = 45; f.runWastePct = 0;
  f.wastePerColorSheets = 0; f.wastePerEquipmentSheets = 0;
  f.outsidePurchases = [
    { description: "Digital clicks + VD", amount: 822.40, markupPct: 0 },
    { description: "Variable data", amount: 65.0, markupPct: 0 },
    { description: "Sort", amount: 124.0, markupPct: 0 },
  ];
  f.freight = 42.03; f.deliveryHrs = 0.36;
  f.cutterLifts = 4; f.cuttingDiff = 1.03; f.trimHrs = 0.242;
  f.handOp1 = { description: "Address/Sort", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.packHrs = 0.15; f.cartons = 6; f.cartonCost = 0.93;
  out.push(runQuote("349097", "digital postcard twin x6200", f, {
    letterPrice: 1447.0, internalTotal: 1447.91, paperCost: 156.17, outsideCost: 1053.43,
    perBucket: { labor: 38.45 },
  }));
}
{ // 349100 — RJ 10x13 booklet envelopes, GCI blanks, TWO of four tiers
  const mk = (qty: number, gci: number, freight: number, exp: any) => {
    const f: any = defaultClassicForm();
    f.quantity = qty; f.jobTitle = "10x13 booklet envelope 2/0 K+PMS";
    f.deliveryRatePerHr = 50; f.paperBuyRounding = 10;
    f.pressHourlyRate = 33.35; f.pressSetupHrs = 0.082; f.runSpeedSph = 0;
    f.plateCostEach = 0; f.plateHrsPerPlate = 0;
    f.pricePerM = 0; f.numberUp = 1; f.weightPerMSheets = 17;   // envelope blanks: $0 stock
    f.wasteSheetsManual = 10; f.runWastePct = 0;
    f.wastePerColorSheets = 0; f.wastePerEquipmentSheets = 0;
    f.inkLbsManual = 1; f.inkDollarsPerLb = 39.50;             // flat PMS ink line
    f.outsidePurchases = [
      { description: "GCI envelope blanks", amount: gci },
      { description: "CGI Prepress", amount: 30.0 },
    ];
    f.freight = freight; f.deliveryHrs = 0.12;
    f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
    f.cartonCost = 0; (f as any).cartonsPerHour = 100000;
    out.push(runQuote("349100", "booklet envelopes x" + qty, f, exp));
  };
  mk(500, 180.0, 10.86,
    { letterPrice: 374.0, internalTotal: 374.72, outsideCost: 220.86, perBucket: { material: 39.50 } });
  mk(1500, 334.50, 17.46,
    { letterPrice: 601.0, internalTotal: 601.37, outsideCost: 381.96, perBucket: { material: 39.50 } });
}
{ // 349101 — RJ #10 reg envelopes, SMALL press token run, TWO of four tiers
  const mk = (qty: number, gci: number, freight: number, exp: any) => {
    const f: any = defaultClassicForm();
    f.quantity = qty; f.jobTitle = "#10 reg envelopes 2/0 K+PMS";
    f.deliveryRatePerHr = 50; f.paperBuyRounding = 10;
    f.pressHourlyRate = 33.35; f.pressSetupHrs = 0.2; f.runSpeedSph = 0;
    f.plateCostEach = 0; f.plateHrsPerPlate = 0;
    f.pricePerM = 0; f.numberUp = 1; f.weightPerMSheets = 5;
    f.wasteSheetsManual = 10; f.runWastePct = 0;
    f.wastePerColorSheets = 0; f.wastePerEquipmentSheets = 0;
    f.inkLbsManual = 1; f.inkDollarsPerLb = 39.50;
    f.pressCheckHrs = 0.047;   // the recurring ~$1.56 SMALL-press remainder
    f.outsidePurchases = [
      { description: "GCI envelope blanks", amount: gci },
      { description: "CGI Prepress", amount: 30.0 },
    ];
    f.freight = freight; f.deliveryHrs = 0.12;
    f.cutterHrsManual = 0.001; f.sheetsPerLift = 0;
    f.cartonCost = 0; (f as any).cartonsPerHour = 100000;
    out.push(runQuote("349101", "#10 envelopes x" + qty, f, exp));
  };
  mk(500, 80.0, 6.87,
    { letterPrice: 236.0, internalTotal: 236.66, outsideCost: 116.87, perBucket: { material: 39.50 } });
  mk(1500, 123.0, 8.70,
    { letterPrice: 299.0, internalTotal: 299.73, outsideCost: 161.70, perBucket: { material: 39.50 } });
}
{ // 348747 — Madico Protection Pro box 5/0 + flood matte, TWO of five tiers
  const mk = (qty: number, sph: number, ink: number, outside: number, freight: number,
              lifts: number, trimH: number, packH: number, cartons: number,
              wastePct: number, exp: any) => {
    const f: any = defaultClassicForm();
    f.quantity = qty; f.jobTitle = "Protection Pro box 5/0 + matte AQ";
    f.pressHourlyRate = 188.5; f.useSpeedCurve = false;
    f.deliveryRatePerHr = 50; f.paperBuyRounding = 10;
    f.plateCostEach = 19; f.plateHrsPerPlate = 0.075; f.plateLaborRate = 45;
    f.prepressRate = 45; f.typeOutputRate = 45;
    f.makereadyDiff = 1; f.pressSetupHrs = 0.081; f.washupHrsPerUnit = 0;
    f.pricePerM = 220.78; f.numberUp = 1; f.sheetsOutOfParent = 2; f.weightPerMSheets = 480;
    f.runColorsSide1 = 4; f.runColorsSide2 = 0;   // 4 plates for the 5/0 (again)
    f.wasteSheetsManual = 560; f.runWastePct = wastePct;
    // E&M prints run 0.2 at EVERY tier — a minimum form time, keyed via sph
    f.runSpeedSph = sph; f.baseMakereadyHrsPerPlate = 0.3 / 4;
    f.washupHrsPerUnit = 0.006;
    f.inkLbsManual = ink / 10.84;
    f.typeOutputHrs = 0.291; f.colorProofs = 1; f.colorProofCharge = 32.08;
    f.outsidePurchases = [{ description: "C&D 26 209-04 + Aqu/Blanket", amount: outside }];
    f.freight = freight; f.deliveryHrs = 0.24;
    f.cutterLifts = lifts; f.cuttingDiff = 0.85; f.trimHrs = trimH;
    f.handOp1 = { description: "Diecut/Glue", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
    f.handOp2 = { description: "& Fold", piecesPerHour: 0, pctOfQty: 0, hours: 0.001 };
    f.packHrs = packH; f.cartons = cartons; f.cartonCost = 0.93;
    out.push(runQuote("348747", "Protection Pro box x" + qty, f, exp));
  };
  mk(50, 3060, 31.45, 548.23, 35.30, 4, 0.132, 0.15, 6, (2 / 50) * 100,
    { letterPrice: 1322.0, internalTotal: 1322.59, paperCost: 68.44, outsideCost: 583.53, perBucket: { material: 145.11 } });
  mk(250, 4150, 33.02, 548.68, 36.18, 5, 0.138, 0.2, 8, (30 / 250) * 100,
    { letterPrice: 1365.0, internalTotal: 1365.67, paperCost: 92.73, outsideCost: 584.86, perBucket: { material: 148.54 } });
}

report(out);
