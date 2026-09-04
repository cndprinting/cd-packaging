// TRANCHE 2 — digital/mail cluster + the Komori notepads. Keyed as Mary would.
// npx tsx validation/handkey/t2-digital-komori.ts
import { defaultClassicForm, type ClassicForm } from "../../src/lib/classic-estimate";
import { runQuote, report, type HandKeyResult } from "./runner";

const out: HandKeyResult[] = [];
// Digital carrier template — the pattern every digital job shares:
// Miller/Phantom at $33.35/hr with ~5 min setup (bills ~$2.73), delivery $50/hr,
// clicks as an outside row at 0%, paper markup 32%.
const digital = (): ClassicForm => {
  const f: any = defaultClassicForm();
  f.pressHourlyRate = 33.35; f.pressSetupHrs = 0.082; f.runSpeedSph = 0;
  f.plateCostEach = 0; f.plateHrsPerPlate = 0;
  f.deliveryRatePerHr = 50; f.markupPaperPct = 32; f.paperBuyRounding = 10;
  f.runWastePct = 0; f.wastePerColorSheets = 0; f.wastePerEquipmentSheets = 0;
  return f as ClassicForm;
};

{ // ── 349095 — Eckerd info sheet, digital x2000 ──
  const f: any = digital();
  f.quantity = 2000; f.jobTitle = "Scholarship info sheet 8.5x11 4/0";
  f.pricePerM = 98.33; f.numberUp = 4; f.weightPerMSheets = 100;
  f.wasteSheetsManual = 20;                    // E&M "Use 520 Sheets"
  f.outsidePurchases = [{ description: "Digital clicks", amount: 103.95, markupPct: 0 }];
  f.freight = 6.69; f.deliveryHrs = 0.18;
  f.cutterLifts = 2; f.trimHrs = 0.158; f.packHrs = 0.083; f.cartons = 2; f.cartonCost = 0.93;
  out.push(runQuote("349095", "digital info sheet x2000", f, {
    letterPrice: 230.0, internalTotal: 230.48, paperCost: 51.13, outsideCost: 110.64,
    perBucket: { labor: 21.42 },
  }));
}
{ // ── 349099 — All Children's tri-fold, digital x1000 + fold + outside score ──
  const f: any = digital();
  f.quantity = 1000; f.jobTitle = "GI Gastro tri-fold 10.806x8.5";
  f.markupPaperPct = 33;
  f.pricePerM = 183.73; f.numberUp = 3; f.weightPerMSheets = 183;
  f.wasteSheetsManual = 26;                    // E&M "Use 360 Sheets" (334+26)
  f.outsidePurchases = [
    { description: "Digital clicks", amount: 198.45, markupPct: 0 },
    { description: "Score (outside)", amount: 45.0, markupPct: 0 },
  ];
  f.freight = 14.16; f.deliveryHrs = 0.3;
  f.commissionPct = 15;                        // All Children's runs 15%
  f.cutterLifts = 2; f.trimHrs = 0.158;
  f.binderyOperation = 3; f.foldSetupHrs = 0.25; f.foldRunHrs = 0.25; f.folderRatePerHr = 48;
  f.handOp1 = { description: "Score", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.packHrs = 0.2; f.cartons = 12; f.cartonCost = 0.52;
  out.push(runQuote("349099", "digital tri-fold x1000", f, {
    letterPrice: 488.0, internalTotal: 488.80, paperCost: 66.14, outsideCost: 257.61,
    perBucket: { labor: 55.07 },
  }));
}
{ // ── 349111 — MGE letter 8.5x11 4/0, digital x2839 + letter fold ──
  const f: any = digital();
  f.quantity = 2839; f.jobTitle = "Letter 8.5x11 4/0, folded for inserting";
  f.markupPaperPct = 33;
  f.pricePerM = 86.27; f.numberUp = 4; f.weightPerMSheets = 70;
  f.wasteSheetsManual = 90;                    // "Use 800 Sheets" (710+90)
  f.outsidePurchases = [{ description: "Digital clicks", amount: 277.83, markupPct: 0 }];
  f.freight = 14.04; f.deliveryHrs = 0.06;
  f.cutterLifts = 2; f.trimHrs = 0.158;
  f.binderyOperation = 3; f.foldSetupHrs = 0.25; f.foldRunHrs = 0.25; f.folderRatePerHr = 48;
  f.packHrs = 0.083; f.cartons = 3; f.cartonCost = 0.93;
  out.push(runQuote("349111", "digital letter x2839", f, {
    letterPrice: 483.0, internalTotal: 483.95, paperCost: 69.02, outsideCost: 291.87,
    perBucket: { labor: 39.42 },
  }));
}
{ // ── 349110 — MGE postcards 11x6 4/4 VD/sort/mail, digital x5523 ──
  const f: any = digital();
  f.quantity = 5523; f.jobTitle = "Postcards 11x6 4/4 w/ VD, sort + mail";
  f.markupPaperPct = 33;
  f.pricePerM = 131.86; f.numberUp = 3; f.weightPerMSheets = 95;
  f.wasteSheetsManual = 159;                   // "Use 2,000 Sheets" (1841+159)
  f.outsidePurchases = [
    { description: "Digital clicks + VD", amount: 971.97, markupPct: 0 },
    { description: "Variable", amount: 65.0, markupPct: 0 },
    { description: "Sort", amount: 110.46, markupPct: 0 },
  ];
  f.freight = 86.89; f.deliveryHrs = 0.18;
  f.cutterLifts = 5; f.cuttingDiff = 0.85; f.trimHrs = 0.196;
  f.handOp1 = { description: "Variable Data", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.handOp2 = { description: "Sort/Mail", piecesPerHour: 0, pctOfQty: 0, hours: 0.012 };
  f.cartons = 0; f.cartonCost = 0; (f as any).cartonsPerHour = 0;
  f.weightPerMSheets = 0;   // E&M shows NO carton line on this mailer
  out.push(runQuote("349110", "digital postcards x5523", f, {
    letterPrice: 1775.0, internalTotal: 1775.06, paperCost: 263.72, outsideCost: 1234.32,
    perBucket: { labor: 25.46 },
  }));
}
{ // ── 349113 — Bloomin Brands imprint shells x85, Phantom + real ink ──
  const f: any = digital();
  f.quantity = 85; f.jobTitle = "Imprint preprinted shells 1/0 + stamps";
  f.pricePerM = 0;                             // customer's shells — no paper cost
  f.numberUp = 3; f.weightPerMSheets = 0;
  f.wasteSheetsManual = 11;                    // "Use 40 Sheets" (29+11)
  f.inkLbsManual = 0.5; f.inkDollarsPerLb = 10.82;   // E&M bills 0.5 lb black on the Phantom
  f.outsidePurchases = [
    { description: "Digital clicks", amount: 14.62, markupPct: 0 },
    { description: "VD", amount: 10.0, markupPct: 0 },
    { description: "Apply Stamp", amount: 8.5, markupPct: 0 },
  ];
  f.freight = 4.79; f.deliveryHrs = 0;
  f.cutterLifts = 1; f.trimHrs = 0.158;
  f.handOp1 = { description: "Variable data", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.packHrs = 0.083; f.cartons = 1; f.cartonCost = 0.93;
  out.push(runQuote("349113", "imprint shells x85", f, {
    letterPrice: 72.0, internalTotal: 72.20, outsideCost: 37.91,
    perBucket: { labor: 13.59, material: 6.34 },
  }));
}
{ // ── 349096 — Don Cesar notepads x10,000 sheets — REAL KOMORI RUN ──
  const f: any = defaultClassicForm();
  f.quantity = 10000; f.jobTitle = "Notepads 5.5x8 1/0, 10 sheets/pad";
  f.deliveryRatePerHr = 50;
  f.paperBuyRounding = 500;   // FINDING: E&M "Use 2,000" = 1,613 rounded to 500s (lot varies per quote: 10/250/500)
  f.pricePerM = 94.80; f.numberUp = 8; f.weightPerMSheets = 60;
  f.runColorsSide1 = 1; f.runColorsSide2 = 0;
  f.wasteSheetsManual = 300;                  // E&M printed makeready 300
  f.runWastePct = (63 / 1250) * 100;          // press waste 63 on 1,250 min count
  f.runSpeedSph = 2400; f.useSpeedCurve = false;
  f.inkLbsManual = 0.843;    // E&M bills $9.14 of black — forms run heavier than the 6% standard
  f.pressHourlyRate = 188.5; f.pressSetupHrs = 0.081; f.makereadyDiff = 0.19;
  f.washupHrsPerUnit = 0.25;   // E&M printed ~0.25 hr washup on this 1-unit run (was riding the old default)
  f.plateCostEach = 19; f.plateHrsPerPlate = 0.075; f.plateLaborRate = 45;
  f.prepressRate = 45; f.designHours = 0;
  f.colorProofs = 1; f.colorProofCharge = 1.60; f.typeOutputHrs = 0.069; f.typeOutputRate = 45;
  f.outsidePurchases = [{ description: "Chipboard", amount: 56.25 }];  // 32% default
  f.freight = 23.70; f.deliveryHrs = 0.3;
  f.cutterLifts = 3; f.cuttingDiff = 1.4; f.trimHrs = 0.292;
  f.handOp1 = { description: "Chipboard", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.padIn = "10"; f.padRatePerHr = 18; f.padsPerHour = 500;
  f.packHrs = 0.125; f.cartons = 5; f.cartonCost = 0.93;
  out.push(runQuote("349096", "notepads, Komori 1-color", f, {
    letterPrice: 816.0, internalTotal: 816.09, paperCost: 189.60, outsideCost: 79.95,
    perBucket: { labor: 263.34, material: 34.39 },
  }));
}

report(out);
