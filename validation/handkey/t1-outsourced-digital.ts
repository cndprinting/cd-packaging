// TRANCHE 1 — fully-outsourced posters + small digital jobs, keyed as Mary
// would key them from her own E&M printouts. npx tsx validation/handkey/t1-outsourced-digital.ts
import { defaultClassicForm, defaultClassicPart, type ClassicForm } from "../../src/lib/classic-estimate";
import { runQuote, report, type HandKeyResult } from "./runner";

const out: HandKeyResult[] = [];
const base = (): ClassicForm => {
  const f: any = defaultClassicForm();
  // Mary's screen: no press on these — she'd pick the Phantom/Miller carrier.
  f.pressHourlyRate = 0; f.pressSetupHrs = 0; f.runSpeedSph = 0;
  f.plateCostEach = 0; f.plateHrsPerPlate = 0;
  f.deliveryRatePerHr = 50;   // FINDING: E&M bills Delivery at $50/hr, not 45
  f.paperBuyRounding = 10;
  return f as ClassicForm;
};

{ // ── 349104 — Monin foamcore poster, fully outsourced ──
  const f: any = base();
  f.quantity = 2; f.jobTitle = "Poster 24x36 foamcore w/ grommets";
  f.outsidePurchases = [{ description: "Accurate", amount: 66.0 }];
  f.freight = 3.54; f.deliveryHrs = 0.3;
  out.push(runQuote("349104", "foamcore poster, outsourced", f, {
    letterPrice: 122.0, internalTotal: 122.11, outsideCost: 69.54,
    perBucket: { labor: 15.0 },
  }));
}
{ // ── 349107 — Achieva board-room posters ──
  const f: any = base();
  f.quantity = 2; f.jobTitle = "Board room posters 28.25x30";
  f.outsidePurchases = [{ description: "Accurate", amount: 28.0 }];
  f.freight = 3.20; f.deliveryHrs = 0.3;
  out.push(runQuote("349107", "board room posters, outsourced", f, {
    letterPrice: 67.0, internalTotal: 67.78, outsideCost: 31.20,
    perBucket: { labor: 15.0 },
  }));
}
{ // ── 349109 — FN Funding gatorboard check ──
  const f: any = base();
  f.quantity = 1; f.jobTitle = "Large check poster 36x18";
  f.outsidePurchases = [{ description: "Accurate", amount: 30.0 }];
  f.freight = 2.01; f.deliveryHrs = 0.3;
  out.push(runQuote("349109", "gatorboard check, outsourced", f, {
    letterPrice: 69.0, internalTotal: 69.31, outsideCost: 32.01,
    perBucket: { labor: 15.0 },
  }));
}
{ // ── 349106 — Nakery insert, digital 100 pcs ──
  const f: any = base();
  f.quantity = 100; f.jobTitle = "Liz Writing Card insert 7x5";
  f.markupPaperPct = 32;             // FINDING: digital quotes use 32% paper
  f.pricePerM = 481.93; f.numberUp = 5; f.sheetsOutOfParent = 1; // E&M: "Use 20 Sheets 26x40"
  f.weightPerMSheets = 480;
  f.runWastePct = 0; f.wastePerColorSheets = 0; f.wastePerEquipmentSheets = 0;
  f.outsidePurchases = [{ description: "Digital clicks", amount: 18.90, markupPct: 0 }];
  f.freight = 2.04; f.deliveryHrs = 0.18;   // E&M bills unrounded (displays 0.2)
  f.cutterLifts = 1; f.trimHrs = 0.158; f.packHrs = 0.083; f.cartonCost = 0.93; f.cartons = 1;
  // FINDING: E&M bills the digital carrier press ~5 min setup ($2.73 on the
  // Miller at $33.35/hr) even though the printing itself is bought as clicks.
  f.pressHourlyRate = 33.35; f.pressSetupHrs = 0.082;
  out.push(runQuote("349106", "digital insert x100", f, {
    letterPrice: 70.0, internalTotal: 70.89, paperCost: 9.64, outsideCost: 20.94,
    perBucket: { labor: 20.77 },
  }));
}
{ // ── 349115 — Nakery insert, digital 50 pcs (same job, half qty) ──
  const f: any = base();
  f.quantity = 50; f.jobTitle = "Make It Vanish insert 7x5";
  f.markupPaperPct = 32;
  f.pricePerM = 481.93; f.numberUp = 5; f.sheetsOutOfParent = 1; // "Use 20 Sheets" at half qty -> 10+10 spoil? E&M still 20
  f.weightPerMSheets = 480;
  f.runWastePct = 0; f.wastePerColorSheets = 0; f.wastePerEquipmentSheets = 0;
  f.cutsToFinalSize = 0; f.equipmentPassesManual = 0;
  (f as any).wasteSheetsManual = 10;  // E&M bought 20 sheets for 50 pcs 5-up = 10 + 10 overs
  f.outsidePurchases = [{ description: "Digital clicks", amount: 14.37, markupPct: 0 }];
  f.freight = 1.89; f.deliveryHrs = 0.18;
  f.cutterLifts = 1; f.trimHrs = 0.158; f.packHrs = 0.083; f.cartonCost = 0.93; f.cartons = 1;
  f.pressHourlyRate = 33.35; f.pressSetupHrs = 0.082;
  out.push(runQuote("349115", "digital insert x50", f, {
    letterPrice: 65.0, internalTotal: 65.75, paperCost: 9.64, outsideCost: 16.26,
    perBucket: { labor: 20.77 },
  }));
}
{ // ── 349105 — Jane Brookwell flash cards, digital + wrap vendor at 32% ──
  const f: any = base();
  f.quantity = 5850; f.jobTitle = "Letter flash cards 5x3, 39/deck";
  f.pricePerM = 146.58; f.numberUp = 11; f.sheetsOutOfParent = 1; // E&M "Use 530 Sheets"
  f.weightPerMSheets = 147;
  f.runWastePct = 0; f.wastePerColorSheets = 0; f.wastePerEquipmentSheets = 0;
  f.outsidePurchases = [
    { description: "Digital 4/4", amount: 265.36, markupPct: 0 },
    { description: "Wrap in sets", amount: 34.50 },   // job default 32% -> +11.04 (the [32%] row)
  ];
  f.markupOutsidePct = 32;
  f.freight = 14.28; f.deliveryHrs = 0;
  f.cutterLifts = 2; f.cuttingDiff = 1.2; f.trimHrs = 0.348;
  f.handOp1 = { description: "Wrap in sets", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.packHrs = 0.09; f.cartons = 3; f.cartonCost = 0.93;
  out.push(runQuote("349105", "flash cards, digital + wrap", f, {
    letterPrice: 508.0, internalTotal: 508.49, paperCost: 77.69, outsideCost: 339.46,
    perBucket: { labor: 23.09 },
  }));
}
{ // ── 349114 — Don Cesar key packet, digital + fold + outside die ──
  const f: any = base();
  f.quantity = 5000; f.jobTitle = "Key packet 7x2 folds 3.5x2";
  f.markupPaperPct = 32;
  f.pricePerM = 963.20; f.numberUp = 32; f.sheetsOutOfParent = 1; // E&M "Use 160 Sheets"
  f.weightPerMSheets = 480;
  f.runWastePct = 0; f.wastePerColorSheets = 0; f.wastePerEquipmentSheets = 0;
  f.outsidePurchases = [
    { description: "Digital clicks", amount: 198.45, markupPct: 0 },
    { description: "C&D 26 229-04 die", amount: 89.00 },  // 32% -> +28.48
  ];
  f.markupOutsidePct = 32;
  f.freight = 19.65; f.deliveryHrs = 0.3;
  f.cutterLifts = 2; f.trimHrs = 0.27;
  f.binderyOperation = 3; f.foldSetupHrs = 0.2; f.foldRunHrs = 0.25; f.folderRatePerHr = 48;
  f.foldTypeName = "Half fold";
  f.handOp1 = { description: "Score", piecesPerHour: 0, pctOfQty: 0, hours: 0.1 };
  f.packHrs = 0.09; f.cartons = 3; f.cartonCost = 0.93;
  out.push(runQuote("349114", "key packet, digital + fold + die", f, {
    letterPrice: 677.0, internalTotal: 677.59, paperCost: 154.11, outsideCost: 335.58,
    perBucket: { labor: 56.36 },
  }));
}

report(out);
