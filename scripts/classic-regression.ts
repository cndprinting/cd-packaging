// Regression harness: Mary's real E&M quotes through computeClassic().
// Run with: npx tsx scripts/classic-regression.ts
import {
  PART_FIELD_KEYS,
  computeClassic,
  computeQuantityBreaks,
  defaultClassicForm,
  smallRunSpeedFactor,
  type ClassicPart,
} from "../src/lib/classic-estimate";

const digitalStd = {
  digitalClickT1_1_0: 0.06825, digitalClickT1_1_1: 0.084, digitalClickT1_4_0: 0.189,
  digitalClickT1_4_1: 0.265, digitalClickT1_4_4: 0.378, digitalClickT1_VD: 0.13545,
  digitalClickT2_1_0: 0.1024, digitalClickT2_1_1: 0.126, digitalClickT2_4_0: 0.2835,
  digitalClickT2_4_1: 0.386, digitalClickT2_4_4: 0.567, digitalClickT2_VD: 0.203175,
  digitalClickT3_1_0: 0.137, digitalClickT3_1_1: 0.168, digitalClickT3_4_0: 0.378,
  digitalClickT3_4_1: 0.515, digitalClickT3_4_4: 0.756, digitalClickT3_VD: 0.2709,
  digitalVDSetupRate: 65, digitalTier1MaxLength: 19, digitalTier2MaxLength: 30, digitalTier3MaxLength: 35.4,
};

let pass = 0, fail = 0;
const check = (name: string, got: number, want: number, tol = 0.01) => {
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: got ${got.toFixed(2)}, want ${want}`);
  ok ? pass++ : fail++;
};

// ══ CYBAKE #347528 (Mary Bitting, 5/29/26) — 500 × 16pg self-cover booklet,
// 8 9/32 x 11 11/16, 4/4 digital, saddlestitched. E&M total $1,411.24. ══
{
  const f = defaultClassicForm();
  f.jobType = "Digital Direct";
  f.quantity = 500;
  f.sheetsPerPiece = 4;      // 16pg, 4pp/side on 12.5x19 → 4 press sheets per book
  f.numberUp = 1;
  f.sheetWidthRun = 12.5; f.sheetHeightRun = 19;
  f.digitalInkConfig = "4/4";
  f.digitalMakereadySheets = 100;   // "25 overs" × 4 sheets
  // Paper: E&M buys 19x25 parents at $140.70/M, 2 press sheets out, 120 bind-waste sheets
  f.pricePerM = 140.70; f.sheetsOutOfParent = 2; f.bindWasteSheets = 120;
  f.markupPaperPct = 33;
  // Bindery: E&M 2.8 total labor hrs (paper handling .1 + press .2 + bind 2.6, net of rounding)
  f.trimHrs = 2.6; f.packHrs = 0.2;
  f.cutterSheetsPerHr = 0;          // load cutter 0.0 hrs on this job
  f.binderyHourlyRate = 59.9;       // E&M effective: 167.73 / 2.8
  f.markupLaborPct = 40;
  f.cartons = 6; f.cartonCost = 0.93; f.markupMaterialPct = 18;
  // Score $50 was outside; digital clicks auto-join outside; E&M used 0% outside markup here
  f.outsidePurchases = [{ description: "Score", amount: 50 }];
  f.markupOutsidePct = 0;
  f.commissionPct = 10;

  const c = computeClassic(f, digitalStd);
  console.log("── Cybake #347528 side-by-side (ours vs E&M) ──");
  check("press sheets (500 books × 4)", c.pressSheets, 2000, 0);
  check("click sheets (2,000 + 100 overs)", c.digitalClickSheets, 2100, 0);
  check("digital clicks (E&M 793.80)", c.digitalClickCost, 793.80);
  check("outside cost = clicks + score (E&M 843.80)", c.outsideCost, 843.80);
  check("outside selling (E&M 844.80 — 0% + $1 min)", c.outsideSelling, 844.80);
  check("carton materials (E&M 5.58)", c.cartonSkidCost, 5.58);
  check("material selling (E&M 6.58: 5.58 @18% w/ $1 min)", c.prepSelling, 6.58);
  check("bindery selling ~ E&M labor 234.82", c.binderySelling, 234.82, 0.1);
  check("parent sheets bought (E&M 1,110)", c.orderSheets, 1110, 0);
  check("paper cost (E&M 156.18)", c.paperCost, 156.18);
  check("paper selling (E&M 207.72)", c.paperSelling, 207.72, 0.05);
  check("commission (E&M 117.33 = 10% of cost)", c.commission, 117.33, 0.05);
  check("TOTAL vs E&M 1,411.24", c.total, 1411.24, 0.25);
  console.log(`   ours: total ${c.total.toFixed(2)} | cost ${c.totalCost.toFixed(2)} (E&M 1,173.28)`);
}

// ══ Re-checks after commission/markup change ══
{
  // markup+commission arithmetic: paper $1000 → 33%+; outside $1000 → 24%;
  // freight 100 pass-through; commission now 10% of COST (2100) = 210
  const f = defaultClassicForm();
  f.quantity = 1000; f.numberUp = 1; f.wasteFactorPct = 0; f.pricePerM = 1000;
  f.cutterSheetsPerHr = 0; // isolate: no auto cutter
  f.outsidePurchases = [{ description: "Finish out", amount: 1000 }];
  f.freight = 100;
  const c = computeClassic(f, digitalStd);
  check("selling subtotal (1330+1240+100)", c.sellingSubtotal, 2670);
  check("commission 10% of COST 2100", c.commission, 210);
  check("total", c.total, 2880);
}
{
  // $1 minimum markup: $5 outside at 0% → sells $6
  const f = defaultClassicForm();
  f.quantity = 0; f.cutterSheetsPerHr = 0;
  f.outsidePurchases = [{ description: "x", amount: 5 }];
  f.markupOutsidePct = 0;
  const c = computeClassic(f, digitalStd);
  check("$1 min markup on nonzero line", c.outsideSelling, 6);
}
{
  // Mary's digital worked example still exact
  const f = defaultClassicForm();
  f.jobType = "Digital Direct"; f.quantity = 1000; f.numberUp = 2;
  f.sheetWidthRun = 12.5; f.sheetHeightRun = 19;
  f.digitalInkConfig = "4/4"; f.digitalMakereadySheets = 25;
  const c = computeClassic(f, digitalStd);
  check("Mary worked example clicks $198.45", c.digitalClickCost, 198.45);
}

// ══ Quantity tiers — re-run the whole estimate per quantity ══
{
  const f = defaultClassicForm();
  f.quantity = 1000; f.numberUp = 1; f.wasteFactorPct = 0; f.pricePerM = 100;
  f.cutterSheetsPerHr = 0; f.freight = 50;
  f.additionalQuantities = [2000, 0, 0]; // blank tiers ignored
  const breaks = computeQuantityBreaks(f, digitalStd);
  console.log("\n── Quantity tiers ──");
  check("tier rows (primary + 1 valid, blanks dropped)", breaks.length, 2, 0);
  check("tier[0] quantity is primary", breaks[0].quantity, 1000, 0);
  const c1 = computeClassic(f, digitalStd);
  check("tier[0] total = primary calc total", breaks[0].total, c1.total, 1e-9);
  const c2 = computeClassic({ ...f, quantity: 2000 }, digitalStd);
  check("tier[1] total = full re-run at 2000", breaks[1].total, c2.total, 1e-9);
  // Paper-only job with no fixed costs: paper cost scales exactly 2x
  check("tier paper cost scales 2x", c2.paperCost, c1.paperCost * 2);
  check("tier[1] price/unit", breaks[1].costPerUnit, c2.total / 2000, 1e-9);
}

// ══ Multi-part — two identical parts double paper/press/bindery; prep,
//    outside and commission stay job-level ══
{
  const f = defaultClassicForm();
  f.quantity = 1000; f.numberUp = 2; f.wasteFactorPct = 5; f.pricePerM = 120;
  f.sheetWidthRun = 25; f.sheetHeightRun = 38;
  f.runColorsSide1 = 2; f.runColorsSide2 = 1;
  f.runSpeedSph = 10000; f.pressHourlyRate = 150;
  f.inkCoverageColorPct = 30;
  f.trimHrs = 1; f.cartons = 4;
  f.designHours = 2; // job-level prep: 2 × $95
  f.outsidePurchases = [{ description: "Foil", amount: 200 }];
  const single = computeClassic(f, digitalStd);

  // Part 2 = exact copy of part 1's Screen 6-8 fields
  const partCopy = {} as Record<string, unknown>;
  for (const k of PART_FIELD_KEYS) partCopy[k] = (f as unknown as Record<string, unknown>)[k];
  const g = { ...f, numParts: 2, parts: [partCopy as unknown as ClassicPart] };
  const dbl = computeClassic(g, digitalStd);

  console.log("\n── Multi-part (2 identical parts) ──");
  check("partCalcs length", dbl.partCalcs.length, 2, 0);
  check("paper cost 2x", dbl.paperCost, single.paperCost * 2, 1e-9);
  check("press cost 2x", dbl.pressCost, single.pressCost * 2, 1e-9);
  check("bindery cost 2x", dbl.binderyCost, single.binderyCost * 2, 1e-9);
  check("cartons (material bucket) 2x", dbl.cartonSkidCost, single.cartonSkidCost * 2, 1e-9);
  check("prep labor unchanged (job-level)", dbl.prepLabor, single.prepLabor, 1e-9);
  check("outside unchanged (job-level)", dbl.outsideCost, single.outsideCost, 1e-9);
  check("commission = 10% of summed cost", dbl.commission, dbl.totalCost * 0.10, 1e-9);
  // Sanity: numParts=1 with a stale parts[] entry must be ignored
  const stale = computeClassic({ ...g, numParts: 1 }, digitalStd);
  check("numParts=1 ignores parts[] leftovers", stale.total, single.total, 1e-9);
}

// ══ Cartons auto from paper weight — Mary's 35-lb max rule (7/20) ══
{
  const f = defaultClassicForm();
  f.quantity = 1110; f.numberUp = 1; f.wasteFactorPct = 0;
  f.pricePerM = 140.70; f.weightPerMSheets = 147; // Cybake stock: "80 LB 147M"
  f.cutterSheetsPerHr = 0;
  const c = computeClassic(f, digitalStd);
  console.log("\n── Cartons @ 35 lb max ──");
  check("paper lbs (1,110 shts × 147/M)", c.partCalcs[0].paperLbs, 163.17);
  check("cartons auto = ceil(163.17/35)", c.partCalcs[0].cartonsAuto, 5, 0);
  check("cartons used (no override)", c.partCalcs[0].cartonsUsed, 5, 0);
  const manual = computeClassic({ ...f, cartons: 6 }, digitalStd);
  check("manual carton count overrides auto", manual.partCalcs[0].cartonsUsed, 6, 0);
  check("carton cost uses effective count", manual.cartonSkidCost, 6 * 0.93);
}

// ══ Band/Pad/Wrap auto hours — bundles ÷ bundle rate, manual override ══
{
  const f = defaultClassicForm();
  f.quantity = 10000; f.numberUp = 1; f.cutterSheetsPerHr = 0;
  f.wrapIn = "100 kraft"; // 100 pcs/bundle → 100 bundles ÷ 200/hr = 0.5 hr
  f.binderyHourlyRate = 65;
  const c = computeClassic(f, digitalStd);
  console.log("\n── Band/Pad/Wrap auto hours ──");
  check("wrap auto hrs (100 bundles ÷ 200/hr)", c.partCalcs[0].wrapHrsUsed, 0.5);
  check("wrap hrs in bindery labor", c.binderyCost, 0.5 * 65);
  const manual = computeClassic({ ...f, wrapHrs: 2 }, digitalStd);
  check("manual wrap hrs override", manual.partCalcs[0].wrapHrsUsed, 2);
}

// ══ Mary's press-waste rule + trim-from-difficulty (7/20) ══
{
  // 4/4 job that cuts and folds: waste = 8 colors × 100 + 2 passes × 100 = 1,000
  const f = defaultClassicForm();
  f.quantity = 20000; f.numberUp = 2; f.pricePerM = 100;
  f.runColorsSide1 = 4; f.runColorsSide2 = 4;
  f.cutsToFinalSize = 4; // cutting pass + enables auto trim
  f.folderConfig = "Baum 26x40"; // folding pass
  const c = computeClassic(f, digitalStd);
  console.log("\n── Waste rule + auto trim ──");
  check("equipment passes (cut + fold)", c.partCalcs[0].equipmentPasses, 2, 0);
  check("waste sheets (800 + 200)", c.partCalcs[0].mrWasteSheets, 1000, 0);
  // trim auto: 10,000 press sheets / 500 per lift = 20 lifts × 4 cuts × 8s = 640s
  // = 0.1778 hr × 0.5 diff (Mary's default) = 0.0889
  check("trim hrs auto from difficulty", c.partCalcs[0].trimHrsUsed, 0.0889, 0.0005);
  check("cutting diff default is 0.5", defaultClassicForm().cuttingDiff, 0.5, 0);
  const manual = computeClassic({ ...f, wasteSheetsManual: 350 }, digitalStd);
  check("manual waste sheets override", manual.partCalcs[0].mrWasteSheets, 350, 0);
  const manualTrim = computeClassic({ ...f, trimHrs: 3 }, digitalStd);
  check("manual trim hrs override", manualTrim.partCalcs[0].trimHrsUsed, 3, 0);
}

// ══ Cuts auto-derived from Screen 6 sheet info (Mary 7/20) ══
{
  // 8-up from a 2-out parent: cuts = (2-1) + 8 + 3 = 12; trim + waste follow
  const f = defaultClassicForm();
  f.quantity = 8000; f.numberUp = 8; f.sheetsOutOfParent = 2; f.pricePerM = 100;
  const c = computeClassic(f, digitalStd);
  console.log("\n── Cuts from sheet info ──");
  check("cuts auto (1 + 8 + 3)", c.partCalcs[0].cutsUsed, 12, 0);
  // trim auto: 1,000 press sheets / 500 = 2 lifts × 12 cuts × 8s = 192s = 0.0533hr × 0.5 diff
  check("trim hrs from derived cuts", c.partCalcs[0].trimHrsUsed, 0.0267, 0.0005);
  check("cutting counts as waste pass", c.partCalcs[0].equipmentPasses, 1, 0);
  const noCut = computeClassic({ ...f, numberUp: 1, sheetsOutOfParent: 1 }, digitalStd);
  check("1-up 1-out = no cutting", noCut.partCalcs[0].cutsUsed, 0, 0);
  const manual = computeClassic({ ...f, cutsToFinalSize: 9 }, digitalStd);
  check("typed cut count overrides auto", manual.partCalcs[0].cutsUsed, 9, 0);
}

// ══ Small-run speed curve (Mary 7/21 — PLACEHOLDER factors) ══
{
  console.log("\n── Small-run speed curve ──");
  check("factor <1,000 shts", smallRunSpeedFactor(500), 0.5, 0);
  check("factor <2,500 shts", smallRunSpeedFactor(1500), 0.65, 0);
  check("factor <5,000 shts", smallRunSpeedFactor(3000), 0.8, 0);
  check("factor <10,000 shts", smallRunSpeedFactor(9999), 0.9, 0);
  check("factor at 10,000+ shts", smallRunSpeedFactor(10000), 1, 0);
  const f = defaultClassicForm();
  f.quantity = 500; f.numberUp = 1; f.runSpeedSph = 10000; f.pressHourlyRate = 100;
  f.cutterSheetsPerHr = 0;
  const c = computeClassic(f, digitalStd);
  // 500 sheets at 10,000 rated × 0.5 = 5,000 effective → 0.1 hr
  check("effective SPH (10,000 × 0.5)", c.partCalcs[0].effectiveSph, 5000, 0);
  check("run hrs use effective SPH", c.partCalcs[0].runHrs, 0.1, 1e-9);
  const off = computeClassic({ ...f, useSpeedCurve: false }, digitalStd);
  check("curve off → rated speed", off.partCalcs[0].runHrs, 0.05, 1e-9);
  check("curve off factor is 1", off.partCalcs[0].speedFactor, 1, 0);
}

// ══ Coatings / Aqueous (Mary 7/21) ══
{
  const f = defaultClassicForm();
  f.quantity = 10000; f.numberUp = 1; f.sheetWidthRun = 25; f.sheetHeightRun = 38;
  f.cutterSheetsPerHr = 0;
  f.coatingType = "Gloss AQ"; f.coatingCoveragePct = 100; f.coatingDollarsPerLb = 18;
  const c = computeClassic(f, digitalStd);
  console.log("\n── Coatings / Aqueous ──");
  // 10,000 shts × 950 sq-in × 100% ÷ (425 × 1000) = 22.3529 lbs × $18 = $402.35
  check("coating lbs", c.partCalcs[0].coatingLbs, 22.3529, 0.001);
  check("coating $", c.partCalcs[0].coatingCost, 402.35, 0.01);
  check("coating rides press cost", c.pressCost, 402.35, 0.01);
  check("job-level coating sum exposed", c.coatingCost, 402.35, 0.01);
  const none = computeClassic({ ...f, coatingType: "" }, digitalStd);
  check("no coating type → $0", none.coatingCost, 0, 0);
}

// ══ Outside services: $/M scaling + 3% upcharge (Mary 7/21) ══
{
  const f = defaultClassicForm();
  f.quantity = 10000; f.numberUp = 1; f.cutterSheetsPerHr = 0;
  f.markupOutsidePct = 0;
  f.outsidePurchases = [
    { description: "Legacy row (no keys)", amount: 100 },                       // flat, no 3%
    { description: "UV coat", amount: 50, per: "perM", plus3: true },           // 50 × 10 × 1.03 = 515
    { description: "Insert flat +3%", amount: 200, per: "job", plus3: true },   // 206
  ];
  const c = computeClassic(f, digitalStd);
  console.log("\n── Outside services $/M + 3% ──");
  check("outside cost (100 + 515 + 206)", c.outsideCost, 821);
  // Per-M rows scale to each tier quantity automatically
  const tiers = computeQuantityBreaks({ ...f, additionalQuantities: [20000, 0, 0] }, digitalStd);
  const t2 = computeClassic({ ...f, quantity: 20000 }, digitalStd);
  check("tier 2 outside (100 + 1030 + 206)", t2.outsideCost, 1336);
  check("tier table re-runs outside per qty", tiers[1].total, t2.total, 1e-9);
  // Digital clicks join outside WITHOUT the 3% (Cybake exactness re-proved)
  const d = defaultClassicForm();
  d.jobType = "Digital Direct"; d.quantity = 1000; d.numberUp = 2;
  d.sheetWidthRun = 12.5; d.sheetHeightRun = 19; d.digitalInkConfig = "4/4";
  d.digitalMakereadySheets = 25; d.cutterSheetsPerHr = 0;
  d.outsidePurchases = [{ description: "Score", amount: 100, plus3: true }];
  const dc = computeClassic(d, digitalStd);
  check("clicks never get the 3% (198.45 + 103)", dc.outsideCost, 301.45);
}

// ══ Speed suggestion from sheets + inks + paper weight (Mary 7/21) ══
{
  const base = () => {
    const f = defaultClassicForm();
    f.quantity = 20000; f.numberUp = 1; f.pricePerM = 100; // 20k sheets → factor 1.0
    f.sheetWidthRun = 23; f.sheetHeightRun = 29;
    f.runSpeedSph = 10000; f.pressHourlyRate = 200;
    return f;
  };
  console.log("\n── Speed caps (coverage + board) ──");
  const light = computeClassic(base(), digitalStd);
  check("light coverage, thin board: rated speed", light.partCalcs[0].effectiveSph, 10000, 0);
  const heavy = base(); heavy.inkCoverageColorPct = 70; // ≥60% → solid-coverage cap
  const h = computeClassic(heavy, digitalStd);
  check("heavy coverage caps at 8,500", h.partCalcs[0].effectiveSph, 8500, 0);
  const board = base(); board.caliperBasisWeight = "28pt C1S"; // 0.028 ≥ cap
  const b = computeClassic(board, digitalStd);
  check("28pt board caps at 4,100", b.partCalcs[0].effectiveSph, 4100, 0);
  const thin = base(); thin.caliperBasisWeight = "18pt C1S"; // 0.018 < cap
  check("18pt board keeps rated", computeClassic(thin, digitalStd).partCalcs[0].effectiveSph, 10000, 0);
  const both = base(); both.inkCoverageColorPct = 70; both.caliperBasisWeight = ".030";
  check("both caps → lower (board) wins", computeClassic(both, digitalStd).partCalcs[0].effectiveSph, 4100, 0);
  const short = base(); short.quantity = 800; short.caliperBasisWeight = "28pt"; // board cap × 0.5 small-run
  check("board cap × small-run factor", computeClassic(short, digitalStd).partCalcs[0].effectiveSph, 2050, 0);
  const coated = base(); coated.coatingType = "Gloss AQ"; coated.coatingCoveragePct = 100; // coating counts toward coverage
  check("coating coverage triggers solid cap", computeClassic(coated, digitalStd).partCalcs[0].effectiveSph, 8500, 0);
}

// ══ Per-type ink split — varnish at its own $/lb (Mary 7/21) ══
{
  const f = defaultClassicForm();
  f.quantity = 2000; f.numberUp = 1; f.pricePerM = 100;
  f.sheetWidthRun = 20; f.sheetHeightRun = 20; // 400 sq in
  f.runSpeedSph = 10000; f.pressHourlyRate = 200;
  f.inkCoverageBlackPct = 10; f.inkCoverageColorPct = 12; f.inkCoverageVarnishPct = 12;
  // lbs per coverage point: 2000 x 400 x 0.01 / 425,000 = 0.018824
  const c = computeClassic(f, digitalStd);
  console.log("\n── Ink per-type split ──");
  check("black+color lbs (22%)", c.partCalcs[0].inkLbsBlackColor, 0.4141, 0.001);
  check("varnish lbs (12%)", c.partCalcs[0].inkLbsVarnish, 0.2259, 0.001);
  // Per-type rates (Mary 7/21): black $10.81 / process $8.50 default / varnish $5.50
  check("ink cost: blk@10.81 + proc@8.50 + varn@5.50", c.partCalcs[0].inkCost, 0.18824 * 10.81 + 0.22588 * 8.5 + 0.22588 * 5.5, 0.01);
  check("black lbs (10%)", c.partCalcs[0].inkLbsBlack, 0.18824, 0.001);
  check("process lbs (12%)", c.partCalcs[0].inkLbsProcess, 0.22588, 0.001);
  const led = computeClassic({ ...f, inkCoverageLedPct: 10, inkCoveragePmsPct: 5 }, digitalStd);
  check("LED lbs price at LED rate", led.partCalcs[0].inkLbsLed * 10.81, 0.18824 * 10.81, 0.01);
  check("PMS lbs price at 19.50", led.partCalcs[0].inkLbsPms * 19.5, 0.09412 * 19.5, 0.01);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
