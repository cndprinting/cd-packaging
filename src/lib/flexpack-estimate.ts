// FLEXIBLE PACKAGING ESTIMATOR — ported from HP's Indigo Wide Web Job
// Estimator v2.9.7.8 (the workbook HP supplied with C&D's own spec loaded).
//
// Entirely separate from Mary's E&M/classic estimator: this world runs on
// LINEAR FEET and MSI (thousand square inches), not sheets and signatures.
// A pouch is a stack of film layers, colour is a click charge, and every
// process is "setup feet + run at N feet per minute".
//
// Validated against HP's own modelled scenario — 5,000 4x6x2 gloss pouches:
//   press 169.29 + lam 36.90 + bag 135.76 + prepress 5.83
//   + clicks 108.08 + material 239.31 + zipper 25.00  =  $720.16 total.

// ── Reference data lifted from the workbook ──────────────────────────────

/** One film layer in a structure. Cost is per MSI (thousand square inches). */
export interface FilmLayer {
  name: string;          // "Gloss PET/ EVA Laminate | 1.2 Mil Pet"
  costPerMsi: number;    // 0.17
  yieldIn2PerLb?: number; // for per-pound stocks, to estimate weight
}

/** Click charges per impression, by ink type (HP Consumables block). */
export interface ClickRates {
  cmyovg: number;        // 0.04414 per colour per impression
  k: number;             // 0.02213
  white: number;         // 0.02213
  premiumWhite: number;  // 0.2518966137455528
  spot: number;          // 0.22994136196310128
}
export const DEFAULT_CLICK_RATES: ClickRates = {
  cmyovg: 0.04414, k: 0.02213, white: 0.02213,
  premiumWhite: 0.2518966137455528, spot: 0.22994136196310128,
};

/** A post-press process. Each is optional and priced setup + run. */
export interface ProcessConfig {
  enabled: boolean;
  costPerHour: number;   // derived on the Equipment Config sheet
  setupMinutes: number;  // MR Minutes
  setupMinutesPerSku: number;
  setupLinFt: number;    // MR Lin Ft — material burned getting it running
  speedFpm: number;      // run speed, feet per minute
  passes: number;        // lamination can run more than once
}
const proc = (o: Partial<ProcessConfig> = {}): ProcessConfig => ({
  enabled: false, costPerHour: 0, setupMinutes: 0, setupMinutesPerSku: 0,
  setupLinFt: 0, speedFpm: 0, passes: 1, ...o,
});

/** Outsourced pouching: cost per 1,000 by format, stepped by volume. */
export interface OutsourcedPouch {
  format: string;              // "SUP Pouch | 8.1\" - 12\" | Zipper: Yes"
  breaks: { qty: number; costPerM: number }[];
  zipperCostPerM: number;
  skuCost: number;
  minimumOrder: number;
  upliftPct: number;
}

export type PricingMode = "markup" | "margin" | "pricePerM";

export interface FlexPackForm {
  // ── Job ──
  customerName: string;
  jobTitle: string;
  quantity: number;
  skus: number;

  // ── Structure (the film stack) ──
  structureName: string;
  primerCostPerMsi: number;   // DigiPrime 050 = 0.015
  layers: FilmLayer[];

  // ── Pouch calculator ──
  bagWidthIn: number;
  bagLengthIn: number;
  gussetIn: number;
  gussetLocation: "Bottom" | "Side" | "None";
  headerIn: number;

  // ── Imposition ──
  // HP derives the layout from the bag itself. Verified against their sheet:
  // a 4x6 bag with a 2" bottom gusset gives Print Width 14 (= length x2 +
  // gusset) and Repeat 4 (= bag width), which lands 2 across x 11 around = 22
  // per frame on a 30" web with a 44" cylinder. Overrides win when set.
  substrateWidthIn: number;   // 30 — the roll we buy
  usableWebWidthIn: number;   // 28.669 — after press marks (CCC/CSC)
  maxRepeatLengthIn: number;  // 44 — imaging cylinder limit
  repeatLengthIn: number;     // computed, or overridden
  numberAcross: number;       // computed, or overridden
  numberAround: number;       // computed, or overridden
  overrideAcross: number;     // 0 = use the calculated value
  overrideAround: number;
  overrideRepeat: number;

  // ── Colour ──
  colorsCmyovg: number;       // 3
  colorsK: number;            // 1
  colorsWhite: number;
  colorsPremiumWhite: number; // 1
  colorsSpot: number;
  clickRates: ClickRates;

  // ── Press ──
  pressCostPerHour: number;   // 351.9435606060606
  pressSetupMinutes: number;  // 15
  pressSetupLinFt: number;    // 30
  pressSetupLinFtPerSku: number; // 8
  pressSpeedFpm: number;      // 110
  runningWastePct: number;    // 4

  // ── Prepress ──
  prepressRatePerHour: number;   // 35
  prepressMinutesFirstSku: number; // 10
  prepressMinutesPerSku: number;   // 5

  // ── Post-press ──
  lamination: ProcessConfig;
  slitRewind: ProcessConfig;
  seaming: ProcessConfig;
  cutting: ProcessConfig;
  inspection: ProcessConfig;
  bagMaking: ProcessConfig;

  // ── Bag extras ──
  zipperCostPerBag: number;      // 0.005
  bagConsumablesPer1000LinFt: number;

  // ── Outsourced bag making (instead of in-house) ──
  outsourceBags: boolean;
  outsourced: OutsourcedPouch | null;

  // ── Money ──
  fixedSetupCharge: number;
  otherCosts: number;
  overheadCost: number;
  pricingMode: PricingMode;
  markupPct: number;      // 40
  marginPct: number;      // 40
  pricePerM: number;      // 300
  turnTimePremiumPct: number;
  commissionPct: number;
}

export function defaultFlexPackForm(): FlexPackForm {
  return {
    customerName: "", jobTitle: "", quantity: 0, skus: 1,
    structureName: "", primerCostPerMsi: 0.015, layers: [],
    bagWidthIn: 0, bagLengthIn: 0, gussetIn: 0, gussetLocation: "Bottom", headerIn: 0,
    substrateWidthIn: 30, usableWebWidthIn: 28.669, maxRepeatLengthIn: 44,
    repeatLengthIn: 44, numberAcross: 1, numberAround: 1,
    overrideAcross: 0, overrideAround: 0, overrideRepeat: 0,
    colorsCmyovg: 0, colorsK: 0, colorsWhite: 0, colorsPremiumWhite: 0, colorsSpot: 0,
    clickRates: { ...DEFAULT_CLICK_RATES },
    pressCostPerHour: 351.9435606060606,
    pressSetupMinutes: 15, pressSetupLinFt: 30, pressSetupLinFtPerSku: 8,
    pressSpeedFpm: 110, runningWastePct: 4,
    prepressRatePerHour: 35, prepressMinutesFirstSku: 10, prepressMinutesPerSku: 5,
    lamination: proc({ costPerHour: 97.8652904040404, setupMinutes: 15, setupLinFt: 500, speedFpm: 200 }),
    slitRewind: proc({ costPerHour: 42.76683501683501, setupMinutes: 15, setupMinutesPerSku: 5, setupLinFt: 200, speedFpm: 500 }),
    seaming: proc({ costPerHour: 48.678977272727266, setupMinutes: 30, setupLinFt: 450, speedFpm: 500 }),
    cutting: proc({ costPerHour: 34.72869318181818, setupMinutes: 10, setupLinFt: 100, speedFpm: 130 }),
    inspection: proc({ costPerHour: 34.72869318181818, setupMinutes: 10, setupLinFt: 100, speedFpm: 800 }),
    bagMaking: proc({ costPerHour: 80.73522727272729, setupMinutes: 90, setupMinutesPerSku: 20, setupLinFt: 100, speedFpm: 140 }),
    zipperCostPerBag: 0, bagConsumablesPer1000LinFt: 0,
    outsourceBags: false, outsourced: null,
    fixedSetupCharge: 0, otherCosts: 0, overheadCost: 0,
    pricingMode: "pricePerM", markupPct: 40, marginPct: 40, pricePerM: 300,
    turnTimePremiumPct: 0, commissionPct: 0,
  };
}

export interface FlexPackCalc {
  printWidthIn: number;   // web width one pouch occupies
  repeatIn: number;       // web length one pouch occupies
  perFrame: number;
  productionFrames: number;
  productionLinFt: number;
  setupLinFt: number;
  runningWasteLinFt: number;
  totalLinFt: number;
  totalMsi: number;
  wasteFactor: number;
  // time (minutes)
  prepressMinutes: number;
  pressMinutes: number;
  laminationMinutes: number;
  slitRewindMinutes: number;
  seamingMinutes: number;
  cuttingMinutes: number;
  inspectionMinutes: number;
  bagMakingMinutes: number;
  totalMinutes: number;
  // cost
  prepressCost: number;
  pressCost: number;
  laminationCost: number;
  slitRewindCost: number;
  seamingCost: number;
  cuttingCost: number;
  inspectionCost: number;
  bagMakingCost: number;
  outsourcedBagCost: number;
  clickCost: number;
  materialCost: number;
  materialCostPerMsi: number;
  zipperCost: number;
  bagConsumablesCost: number;
  totalCost: number;
  costPerM: number;
  costPerUnit: number;
  costPerMsi: number;
  // price
  sellingPrice: number;
  pricePerMOut: number;
  pricePerUnit: number;
  commission: number;
  marginDollars: number;
  marginPct: number;
}

const mins = (m: number, ratePerHour: number) => (m / 60) * ratePerHour;

/** Setup feet + run time for one post-press process, over the whole web. */
function runProcess(p: ProcessConfig, totalLinFt: number, skus: number) {
  if (!p.enabled) return { minutes: 0, cost: 0, setupLinFt: 0 };
  const passes = Math.max(1, p.passes || 1);
  const setup = (p.setupMinutes || 0) + (p.setupMinutesPerSku || 0) * Math.max(0, skus - 1);
  const run = (p.speedFpm || 0) > 0 ? (totalLinFt / p.speedFpm) * passes : 0;
  const minutes = setup * passes + run;
  return { minutes, cost: mins(minutes, p.costPerHour || 0), setupLinFt: (p.setupLinFt || 0) * passes };
}

export function computeFlexPack(f: FlexPackForm): FlexPackCalc {
  const qty = Math.max(0, f.quantity || 0);
  const skus = Math.max(1, f.skus || 1);

  // ── Material: the film stack, priced per MSI ──
  const materialCostPerMsi = (f.primerCostPerMsi || 0)
    + (f.layers || []).reduce((t, l) => t + (l.costPerMsi || 0), 0);

  // ── Pouch calculator → imposition (HP's own derivation) ──
  // Across the web a pouch needs front + back, plus the gusset panel; around
  // the web it needs its width. A header adds to the length.
  const gusset = f.gussetLocation === "None" ? 0 : (f.gussetIn || 0);
  const lengthWithHeader = (f.bagLengthIn || 0) + (f.headerIn || 0);
  const printWidthIn = f.gussetLocation === "Side"
    ? lengthWithHeader * 2 + gusset * 2       // gussets on both edges
    : lengthWithHeader * 2 + gusset;          // bottom gusset (or none)
  const repeatIn = f.bagWidthIn || 0;

  const acrossCalc = printWidthIn > 0 && (f.usableWebWidthIn || 0) > 0
    ? Math.max(1, Math.floor(f.usableWebWidthIn / printWidthIn)) : 0;
  const aroundCalc = repeatIn > 0 && (f.maxRepeatLengthIn || 0) > 0
    ? Math.max(1, Math.floor(f.maxRepeatLengthIn / repeatIn)) : 0;

  const numberAcross = (f.overrideAcross || 0) > 0 ? f.overrideAcross
    : (acrossCalc || f.numberAcross || 1);
  const numberAround = (f.overrideAround || 0) > 0 ? f.overrideAround
    : (aroundCalc || f.numberAround || 1);
  const repeatLengthIn = (f.overrideRepeat || 0) > 0 ? f.overrideRepeat
    : (repeatIn > 0 ? numberAround * repeatIn : (f.repeatLengthIn || 0));

  const perFrame = Math.max(1, numberAcross * numberAround);
  const productionFrames = qty > 0 ? Math.ceil(qty / perFrame) : 0;
  const repeatFt = repeatLengthIn / 12;
  const productionLinFt = productionFrames * repeatFt;

  // ── Setup material: every process burns feet before it runs clean ──
  const procs = [f.lamination, f.slitRewind, f.seaming, f.cutting, f.inspection, f.bagMaking];
  const postSetupLinFt = procs.reduce(
    (t, p) => t + (p.enabled ? (p.setupLinFt || 0) * Math.max(1, p.passes || 1) : 0), 0);
  const pressSetupLinFt = (f.pressSetupLinFt || 0) + (f.pressSetupLinFtPerSku || 0) * Math.max(0, skus - 1);
  const setupLinFt = pressSetupLinFt + postSetupLinFt;

  const subtotalLinFt = productionLinFt + setupLinFt;
  const runningWasteLinFt = subtotalLinFt * ((f.runningWastePct || 0) / 100);
  const totalLinFt = subtotalLinFt + runningWasteLinFt;
  // MSI = linear feet x 12 in/ft x web width / 1000
  const totalMsi = (totalLinFt * 12 * (f.substrateWidthIn || 0)) / 1000;
  const wasteFactor = productionLinFt > 0 ? (totalLinFt - productionLinFt) / totalLinFt : 0;

  // ── Time ──
  const prepressMinutes = (f.prepressMinutesFirstSku || 0) + (f.prepressMinutesPerSku || 0) * Math.max(0, skus - 1);
  const pressRunMinutes = (f.pressSpeedFpm || 0) > 0 ? totalLinFt / f.pressSpeedFpm : 0;
  const pressMinutes = (f.pressSetupMinutes || 0) + pressRunMinutes;

  const lam = runProcess(f.lamination, totalLinFt, skus);
  const slit = runProcess(f.slitRewind, totalLinFt, skus);
  const seam = runProcess(f.seaming, totalLinFt, skus);
  const cut = runProcess(f.cutting, totalLinFt, skus);
  const insp = runProcess(f.inspection, totalLinFt, skus);
  const bag = f.outsourceBags ? { minutes: 0, cost: 0, setupLinFt: 0 } : runProcess(f.bagMaking, totalLinFt, skus);

  const totalMinutes = prepressMinutes + pressMinutes + lam.minutes + slit.minutes
    + seam.minutes + cut.minutes + insp.minutes + bag.minutes;

  // ── Clicks: charged on PRODUCTION frames only, not post-press setup ──
  const productionFramesForClicks = Math.max(0, (totalLinFt - postSetupLinFt) / repeatFt);
  const r = f.clickRates || DEFAULT_CLICK_RATES;
  const clickCost =
    (f.colorsCmyovg || 0) * productionFramesForClicks * r.cmyovg +
    (f.colorsK || 0) * productionFramesForClicks * r.k +
    // Premium White lays down a white ink station AND burns the premium
    // consumable, so HP charges BOTH a white click and the premium rate.
    // (Their sheet shows a W line at 0.02213 even when only Premium White is
    // selected -- exactly the $5.58 we were short.)
    ((f.colorsWhite || 0) + (f.colorsPremiumWhite || 0)) * productionFramesForClicks * r.white +
    (f.colorsPremiumWhite || 0) * productionFramesForClicks * r.premiumWhite +
    (f.colorsSpot || 0) * productionFramesForClicks * r.spot;

  const materialCost = materialCostPerMsi * totalMsi;

  // ── Bag extras ──
  const zipperCost = (f.zipperCostPerBag || 0) * qty;
  const bagConsumablesCost = ((f.bagConsumablesPer1000LinFt || 0) / 1000) * totalLinFt;

  // ── Outsourced pouching, stepped by volume ──
  let outsourcedBagCost = 0;
  if (f.outsourceBags && f.outsourced) {
    const o = f.outsourced;
    const sorted = [...(o.breaks || [])].sort((a, b) => a.qty - b.qty);
    let rate = sorted.length ? sorted[0].costPerM : 0;
    for (const b of sorted) if (qty >= b.qty) rate = b.costPerM;
    const billQty = Math.max(qty, o.minimumOrder || 0);
    outsourcedBagCost = ((rate + (o.zipperCostPerM || 0)) * billQty) / 1000 + (o.skuCost || 0) * skus;
    outsourcedBagCost *= 1 + (o.upliftPct || 0) / 100;
  }

  const prepressCost = mins(prepressMinutes, f.prepressRatePerHour || 0);
  const pressCost = mins(pressMinutes, f.pressCostPerHour || 0);

  // Nothing quoted yet -> no cost. Setup time is real, but a blank form
  // showing ~$96 of press setup and a -100% margin is just noise.
  if (qty <= 0) {
    return {
      printWidthIn, repeatIn, perFrame, productionFrames: 0, productionLinFt: 0,
      setupLinFt: 0, runningWasteLinFt: 0, totalLinFt: 0, totalMsi: 0, wasteFactor: 0,
      prepressMinutes: 0, pressMinutes: 0, laminationMinutes: 0, slitRewindMinutes: 0,
      seamingMinutes: 0, cuttingMinutes: 0, inspectionMinutes: 0, bagMakingMinutes: 0,
      totalMinutes: 0,
      prepressCost: 0, pressCost: 0, laminationCost: 0, slitRewindCost: 0, seamingCost: 0,
      cuttingCost: 0, inspectionCost: 0, bagMakingCost: 0, outsourcedBagCost: 0,
      clickCost: 0, materialCost: 0, materialCostPerMsi, zipperCost: 0, bagConsumablesCost: 0,
      totalCost: 0, costPerM: 0, costPerUnit: 0, costPerMsi: 0,
      sellingPrice: 0, pricePerMOut: 0, pricePerUnit: 0,
      commission: 0, marginDollars: 0, marginPct: 0,
    };
  }

  const totalDirect = (f.fixedSetupCharge || 0) + prepressCost + pressCost
    + lam.cost + slit.cost + seam.cost + cut.cost + insp.cost + bag.cost
    + outsourcedBagCost + clickCost + materialCost + zipperCost + bagConsumablesCost;
  const totalCost = totalDirect + (f.otherCosts || 0) + (f.overheadCost || 0);

  // ── Price ──
  let sellingPrice = 0;
  if (f.pricingMode === "markup") sellingPrice = totalCost * (1 + (f.markupPct || 0) / 100);
  else if (f.pricingMode === "margin") {
    const m = Math.min(99.9, f.marginPct || 0) / 100;
    sellingPrice = m < 1 ? totalCost / (1 - m) : totalCost;
  } else sellingPrice = ((f.pricePerM || 0) * qty) / 1000;
  sellingPrice *= 1 + (f.turnTimePremiumPct || 0) / 100;

  const commission = sellingPrice * ((f.commissionPct || 0) / 100);
  const marginDollars = sellingPrice - totalCost - commission;

  return {
    printWidthIn, repeatIn, perFrame, productionFrames, productionLinFt, setupLinFt, runningWasteLinFt,
    totalLinFt, totalMsi, wasteFactor,
    prepressMinutes, pressMinutes,
    laminationMinutes: lam.minutes, slitRewindMinutes: slit.minutes,
    seamingMinutes: seam.minutes, cuttingMinutes: cut.minutes,
    inspectionMinutes: insp.minutes, bagMakingMinutes: bag.minutes, totalMinutes,
    prepressCost, pressCost,
    laminationCost: lam.cost, slitRewindCost: slit.cost, seamingCost: seam.cost,
    cuttingCost: cut.cost, inspectionCost: insp.cost, bagMakingCost: bag.cost,
    outsourcedBagCost, clickCost, materialCost, materialCostPerMsi,
    zipperCost, bagConsumablesCost,
    totalCost,
    costPerM: qty > 0 ? (totalCost / qty) * 1000 : 0,
    costPerUnit: qty > 0 ? totalCost / qty : 0,
    costPerMsi: totalMsi > 0 ? totalCost / totalMsi : 0,
    sellingPrice,
    pricePerMOut: qty > 0 ? (sellingPrice / qty) * 1000 : 0,
    pricePerUnit: qty > 0 ? sellingPrice / qty : 0,
    commission, marginDollars,
    marginPct: sellingPrice > 0 ? marginDollars / sellingPrice : 0,
  };
}
