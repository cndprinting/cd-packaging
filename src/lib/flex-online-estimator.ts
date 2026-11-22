// ONLINE PRICING for flexible packaging and roll labels (the website's instant price).
//
// This is a line-for-line port of Nitay's cd_flex_estimator.py (handed over 22 Nov 2026), which is
// itself a port of the HP Indigo Wide Web Job Estimator v2.9.7.8 with C&D's equipment loaded.
// Constant names, input names and output names are kept IDENTICAL to the Python file on purpose,
// so when Nitay changes a number there, the same line changes here.
//
// Proven equal to the Python file to the cent: `npx tsx scripts/flex-online-parity.ts`
// (HP workbook default scenario = $442.97, plus a fixed set of cases generated from the Python).
//
// NOT the same thing as src/lib/flexpack-estimate.ts. That one is the staff calculator on
// /dashboard/flexpack (any structure, any process, markup of your choice). This one is the
// customer price: fixed products, fixed structures, owner-set margin and minimums.
//
// SERVER ONLY. This file holds C&D's costs (hourly rates, click charges, film cost, margin).
// Never import it into a page or component that ships to a browser; send customerView() instead.

// =============================================================================
// 1. PRICING POLICY  (owner-set; change here, nowhere else)
// =============================================================================
export const GROSS_MARGIN = 0.40;            // price = cost / (1 - margin)
export const MIN_ORDER_PRICE = 250.0;        // floor on any online order (covers makeready)
export const PER_SKU_CHARGE = 75.0;          // per additional SKU/version on pouches & rollstock (bag-maker changeover)
export const PER_SKU_CHARGE_LABEL = 0.0;     // labels gang in one frame; no changeover, art handling is free
export const RUSH_PREMIUMS = {               // flat $ added to price, from estimator Turn Time table
  standard_15_day: 0,
  rush_12_day: 200,
  rush_10_day: 400,
  rush_7_day: 600,
  rush_5_day: 800,
  rush_3_day: 1000,
} as const;
export type Rush = keyof typeof RUSH_PREMIUMS;
export const LEAD_TIME_BUSINESS_DAYS = 15;

// One-time charges the website adds as SEPARATE line items (README section 4). Not in the unit price.
export const LABEL_DIE_CHARGE = 100;         // per new label size, first order only; waived on reorders
export const PRESS_PROOF_CHARGE = 350;       // printed, formed pouch proof; credited on the first order
export const ART_FIX_PER_SKU = 15;           // when customer files are not print-ready

// Quantity guards for the website (README section 2). The Python does not enforce these; checkOnline() does.
export const ONLINE_LIMITS = {
  stand_up_pouch: { minPerSku: 500, maxPerSku: 25000 },
  flat_pouch: { minPerSku: 500, maxPerSku: 25000 },
  rollstock: { minTotal: 5000 },
  roll_label: { minPerSku: 250 },
  maxSkus: 6,
} as const;

// =============================================================================
// 2. EQUIPMENT CONFIG  (from 'Equipment Config' sheet)
// =============================================================================
// Budgeted hourly rates INCLUDING 15% overhead (row 25 "Machine Cost/Hour").
type Unit = "lam" | "slit" | "seam" | "cut" | "inspect" | "bag";
export const BHR: Record<"press" | Unit, number> = {
  press: 351.9436,   // HP Indigo 200K
  lam: 97.8653,      // Lamination / OPV unit
  slit: 42.7668,     // Slitter / rewinder
  seam: 48.679,      // Seaming (shrink sleeves) — NOT online
  cut: 34.7287,      // Die cutting (labels)
  inspect: 34.7287,  // Inspection
  bag: 80.7352,      // Bag making
};

// Makeready minutes (row 28) and per-additional-SKU minutes (row 29)
const MR_MIN: Record<"press" | Unit, number> = { press: 15, lam: 15, slit: 15, seam: 30, cut: 10, inspect: 10, bag: 90 };
const SKU_MR_MIN: Record<"press" | Unit, number> = { press: 0, lam: 0, slit: 5, seam: 0, cut: 0, inspect: 0, bag: 20 };

// Makeready linear feet consumed (row 30/31). Bag-making MR is 300 *bags*, converted to feet using the bag repeat.
const MR_FT: Record<"press" | Exclude<Unit, "bag">, number> = { press: 30, lam: 500, slit: 200, seam: 450, cut: 100, inspect: 100 };
const MR_BAGS_BAG = 300;
const SKU_MR_FT_PRESS = 8;

// Run speeds, ft/min (row 32). Press speed is computed from colors + repeat.
const FPM: Record<Unit, number> = { lam: 200, slit: 500, seam: 500, cut: 130, inspect: 800, bag: 140 };

const RUN_WASTE = 0.04;                // row 33

// Press geometry (Digital Job Estimator rows 68-70)
const PRESS_MAX_WIDTH_IN = 29.37;
const CCC_MARK_IN = 0.354;             // Continuous Color Calibration strip
const CSC_MARK_IN = 0.315;             // Constant Scaling Calibration strip
export const MAX_USABLE_WIDTH_IN = PRESS_MAX_WIDTH_IN - CCC_MARK_IN - CSC_MARK_IN;   // 28.701
export const MAX_REPEAT_IN = 44.0;
const FRAME_SECONDS_200K = 0.4;        // seconds per color separation per frame (200K)

// =============================================================================
// 3. CONSUMABLES  (Equipment Config rows 35-49)
// =============================================================================
const CLICK = {
  cmyovg: 0.04414,                     // per color separation per frame (C, M, Y, O, V, G)
  k: 0.02213,
  w: 0.02213,                          // white separation click
};
const WHITE_INK = { cost_per_can: 113.48, frames_per_can: 450 };   // Premium White
const WHITE_COST_PER_FULL_FRAME = WHITE_INK.cost_per_can / WHITE_INK.frames_per_can;   // 0.2522
const SPOT_INK_COST_PER_FRAME = 465 / 2020;                                              // 0.2302
const PRIMER_COST_PER_MSI = 0.015;     // DigiPrime 050

// Prepress
const PREPRESS_RATE_PER_HR = 35;
const PREPRESS_MIN_FIRST = 10;
const PREPRESS_MIN_PER_SKU = 5;

// =============================================================================
// 4. MATERIALS  ($ per MSI = per 1,000 sq in)  (from 'Structure' sheet)
// =============================================================================
export const MATERIALS: Record<string, number> = {
  // --- print webs / laminates (flexible) ---
  pet_12u_corona: 0.030,
  pet_pvdc: 0.060,
  pet_metallized_12u: 0.030,
  pet_matte_19u: 0.040,
  bopp_heat_seal: 0.050,
  bopp_metallized: 0.030,
  bopp_matte: 0.045,
  pe_sealant_100u: 0.018,
  pe_evoh_sealant: 0.018,
  soft_touch_pet_52g: 0.0930,          // $3.65/lb @ 39,231 in2/lb — C&D ASSUMPTION, confirm with vendor
  met_pet_48g: 0.046,
  ldpe_evoh_3mil: 0.1541,
  ldpe_clear_3_5mil: 0.205,
  ldpe_white_3mil: 0.1652,
  stick_pack_easy_tear: 0.6797,
  white_film_48pet_3ll: 0.26,          // pre-laminated 48g PET / 3 mil white LLDPE
  metalized_48met_3ll: 0.39,           // pre-laminated 48g MET PET / 3 mil LLDPE
  white_met_48met_3ll: 0.49,
  matte_packready_eva: 0.129,
  gloss_packready_eva: 0.118,
  matte_pet_eva_1_2mil: 0.32,
  gloss_pet_eva_1_2mil: 0.17,
  pe_shrink_film: 0.20,
  // --- coatings / adhesives ---
  opv_std: 0.04,
  opv_gloss: 0.08,
  adhesive_std: 0.015,
  adhesive_waterbased: 0.04,
  // --- pressure-sensitive label stocks (NOT in HP workbook; C&D ASSUMPTIONS,
  //     verify with label-stock vendor before go-live) ---
  ps_white_bopp: 0.12,
  ps_uncoated_paper: 0.09,
  ps_uncoated_wetstrength: 0.11,
  ps_matte_ps: 0.35,                   // workbook "PS | Matte PS" line
  ps_lam_gloss_pp: 0.10,
  ps_lam_matte_pp: 0.10,
};

/** Scale the 3.5 mil clear LDPE line to another gauge. */
function ldpe_cost(mil: number): number {
  return (MATERIALS.ldpe_clear_3_5mil * mil) / 3.5;
}

// Named structures the website can offer. Each layer is [material, lam_pass].
export interface Structure { label: string; layers: [string, boolean][]; lam_passes: number; needs_white: boolean }
export const STRUCTURES: Record<string, Structure> = {
  matte_barrier: {
    label: "Matte PET / metallized PET / PE sealant (approx. 4.7 mil)",
    layers: [["matte_pet_eva_1_2mil", false], ["met_pet_48g", true], ["ldpe_clear_3_5mil", false]],
    lam_passes: 1, needs_white: true,
  },
  gloss_barrier: {
    label: "Gloss PET / metallized PET / PE sealant (approx. 4.7 mil)",
    layers: [["gloss_pet_eva_1_2mil", false], ["met_pet_48g", true], ["ldpe_clear_3_5mil", false]],
    lam_passes: 1, needs_white: true,
  },
  soft_touch_barrier: {
    label: "Soft-touch PET / metallized PET / 4 mil LLDPE (approx. 5.5 mil)",
    layers: [["soft_touch_pet_52g", false], ["adhesive_std", false], ["met_pet_48g", true], ["adhesive_std", false], ["_ldpe_4mil", true]],
    lam_passes: 2, needs_white: true,
  },
  clear_pe: {
    label: "Clear PET / clear PE (window-capable, no metallized barrier)",
    layers: [["gloss_pet_eva_1_2mil", false], ["ldpe_clear_3_5mil", true]],
    lam_passes: 1, needs_white: true,
  },
  white_pe: {
    label: "48g PET / 3 mil white LLDPE (pre-laminated)",
    layers: [["white_film_48pet_3ll", false]],
    lam_passes: 0, needs_white: false,
  },
  label_white_bopp: {
    label: "White BOPP, permanent acrylic adhesive, paper liner",
    layers: [["ps_white_bopp", false]], lam_passes: 0, needs_white: false,
  },
  label_uncoated_paper: {
    label: "Uncoated FSC paper, permanent adhesive, paper liner",
    layers: [["ps_uncoated_paper", false]], lam_passes: 0, needs_white: false,
  },
  label_wetstrength_paper: {
    label: "Uncoated wet-strength paper (fridge-safe), permanent adhesive",
    layers: [["ps_uncoated_wetstrength", false]], lam_passes: 0, needs_white: false,
  },
};
export const POUCH_STRUCTURES = ["matte_barrier", "gloss_barrier", "soft_touch_barrier", "clear_pe", "white_pe"] as const;
export const LABEL_STRUCTURES = ["label_white_bopp", "label_uncoated_paper", "label_wetstrength_paper"] as const;
export const LABEL_FINISHES = ["none", "gloss_opv", "matte_opv", "gloss_lam", "matte_lam"] as const;

export function structure_cost_per_msi(key: string): number {
  const s = STRUCTURES[key];
  let total = PRIMER_COST_PER_MSI;
  for (const [mat] of s.layers) total += mat === "_ldpe_4mil" ? ldpe_cost(4.0) : MATERIALS[mat];
  return total;
}

// Fitments
const ZIPPER_COST_PER_INCH_WIDTH = 0.0065;     // press-to-close; 4.75" bag -> $0.031, 7.5" -> $0.049
const SLIDER_ZIPPER_ADDER = 0.04;              // per bag, on top of PTC

// =============================================================================
// 5. CORE MODEL
// =============================================================================

/** A job the press or the online rules cannot take. `route` says what the website should do with it. */
export class FlexQuoteError extends Error {
  route: "quote_request" | "bad_input";
  constructor(message: string, route: "quote_request" | "bad_input" = "quote_request") {
    super(message);
    this.name = "FlexQuoteError";
    this.route = route;
  }
}

// Python's round(): correctly rounded on the number's exact value, ties to even.
function pyRound(x: number, n = 0): number {
  if (!Number.isFinite(x)) return x;
  const exact = Math.abs(x).toFixed(80);                    // the exact decimal value of the float
  const dot = exact.indexOf(".");
  const tail = exact.slice(dot + 1 + n);
  if (tail[0] === "5" && /^0*$/.test(tail.slice(1))) {      // an exact tie: go to the even neighbour
    const down = Number(exact.slice(0, dot + 1 + n));
    const last = Number((n === 0 ? exact[dot - 1] : exact[dot + n]));
    const r = last % 2 === 0 ? down : Number((down + 10 ** -n).toFixed(n));
    return x < 0 ? -r : r;
  }
  return Number(x.toFixed(n));
}
// Python's a // b for positive floats: the floor of the true quotient (not of the rounded one).
function floorDiv(a: number, b: number): number {
  return Math.round((a - (a % b)) / b);
}

interface Layout {
  print_width_in: number;      // across-web dimension of one unit incl. seals
  repeat_unit_in: number;      // around-web dimension of one unit
  across: number;
  around: number;
  per_frame: number;
  frame_repeat_in: number;
  image_width_in: number;
  web_width_in: number;
  frame_efficiency: number;
}

/** Pack units across the 28.7" usable width and 44" max repeat. Returns the best orientation if rotation is allowed (labels only). */
function _layout(print_width: number, repeat_unit: number, gap = 0.0, allow_rotate = false): Layout {
  const pack = (pw: number, ru: number): Layout | null => {
    const across = floorDiv(MAX_USABLE_WIDTH_IN, pw + gap);
    const around = floorDiv(MAX_REPEAT_IN, ru + gap);
    if (across < 1 || around < 1) return null;
    const frame_repeat = around * (ru + gap);
    const image_w = across * (pw + gap) + CCC_MARK_IN + CSC_MARK_IN;
    return {
      print_width_in: pw, repeat_unit_in: ru, across, around, per_frame: across * around, frame_repeat_in: frame_repeat,
      image_width_in: image_w, web_width_in: Math.ceil(image_w), frame_efficiency: (frame_repeat * image_w) / (MAX_USABLE_WIDTH_IN * MAX_REPEAT_IN),
    };
  };
  const options = [pack(print_width, repeat_unit)];
  if (allow_rotate) options.push(pack(repeat_unit, print_width));
  const ok = options.filter((o): o is Layout => !!o);
  if (!ok.length) {
    throw new FlexQuoteError(`Unit ${print_width}" x ${repeat_unit}" does not fit the press (max ${MAX_USABLE_WIDTH_IN.toFixed(1)}" wide x ${MAX_REPEAT_IN}" repeat)`);
  }
  return ok.reduce((best, o) => (o.per_frame > best.per_frame ? o : best), ok[0]);   // first wins a tie, like Python's max()
}

function _press_speed_fpm(total_colors: number, frame_repeat_in: number): number {
  const n = Math.max(total_colors, 3);
  return ((60 / (n * FRAME_SECONDS_200K)) * frame_repeat_in) / 12;
}

export interface FlexCost {
  cost_total: number;
  cost_per_unit: number;
  cost_breakdown: Record<string, number>;
  frames: number;
  total_linear_ft: number;
  total_msi: number;
  press_minutes: number;
  post_minutes: Record<string, number>;
  press_speed_fpm: number;
  layout: string;
}

/** Replicates 'Digital Job Estimator' rows 102-293. */
function _cost(
  layout: Layout, quantity: number, skus: number,
  colors_cmyovg: number, colors_k: number, white: boolean, spot_colors: number,
  struct_per_msi: number, lam_passes: number,
  post: Unit[],                       // subset of lam, slit, seam, cut, inspect, bag
  extra_per_unit = 0.0,               // zipper etc.
  bag_repeat_in: number | null = null,
): FlexCost {
  const total_colors = colors_cmyovg + colors_k + (white ? 1 : 0) + spot_colors;
  const speed = _press_speed_fpm(total_colors, layout.frame_repeat_in);

  const frames = Math.ceil(quantity / layout.per_frame);
  const prod_ft = (frames * layout.frame_repeat_in) / 12;
  const bagFt = (MR_BAGS_BAG * (bag_repeat_in || layout.repeat_unit_in)) / 12;

  // Setup footage (rows 115-124)
  let setup_ft = MR_FT.press + (skus - 1) * SKU_MR_FT_PRESS;
  if (post.includes("lam")) setup_ft += MR_FT.lam * lam_passes;
  if (post.includes("slit")) setup_ft += MR_FT.slit;
  if (post.includes("seam")) setup_ft += MR_FT.seam;
  if (post.includes("cut")) setup_ft += MR_FT.cut;
  if (post.includes("inspect")) setup_ft += MR_FT.inspect;
  if (post.includes("bag")) setup_ft += bagFt;

  const subtotal_ft = prod_ft + setup_ft;
  const waste_ft = subtotal_ft * RUN_WASTE;
  const total_ft = subtotal_ft + waste_ft;
  const msi = (total_ft * 12 * layout.web_width_in) / 1000;

  // Time (minutes)
  const prepress_min = PREPRESS_MIN_FIRST + (skus - 1) * PREPRESS_MIN_PER_SKU;
  const press_min = MR_MIN.press + total_ft / speed;
  const minutes: Record<string, number> = { press: press_min };
  for (const unit of post) {
    const passes = unit === "lam" ? lam_passes : 1;
    minutes[unit] = passes * (MR_MIN[unit] + (skus - 1) * SKU_MR_MIN[unit] + total_ft / FPM[unit]);
  }

  // Costs (kept in this order: the total is the sum in this order)
  const c: Record<string, number> = { Prepress: (prepress_min / 60) * PREPRESS_RATE_PER_HR, Press: (press_min / 60) * BHR.press };
  const names: Record<Unit, string> = { lam: "Lamination/OPV", slit: "Slit/Rewind", seam: "Seaming", cut: "Die Cutting", inspect: "Inspection", bag: "Bag Making" };
  for (const unit of post) c[names[unit]] = (minutes[unit] / 60) * BHR[unit];

  // HP consumables (rows 244-256): clicks on production frames only
  let post_setup_ft = 0;
  for (const u of post) if (u !== "bag") post_setup_ft += MR_FT[u] * (u === "lam" ? lam_passes : 1);
  post_setup_ft += post.includes("bag") ? bagFt : 0;
  const prod_frames = (total_ft - post_setup_ft) / (layout.frame_repeat_in / 12);
  let ink = prod_frames * (colors_cmyovg * CLICK.cmyovg + colors_k * CLICK.k);
  if (white) ink += prod_frames * (CLICK.w + WHITE_COST_PER_FULL_FRAME * layout.frame_efficiency);
  if (spot_colors) ink += prod_frames * spot_colors * SPOT_INK_COST_PER_FRAME * layout.frame_efficiency;
  c["HP Ink / Clicks"] = ink;

  c["Material"] = msi * struct_per_msi;
  if (extra_per_unit) c["Fitments"] = extra_per_unit * quantity;

  let total = 0;
  for (const v of Object.values(c)) total += v;
  const cost_breakdown: Record<string, number> = {};
  for (const [k, v] of Object.entries(c)) cost_breakdown[k] = pyRound(v, 2);
  const post_minutes: Record<string, number> = {};
  for (const [k, v] of Object.entries(minutes)) if (k !== "press") post_minutes[k] = pyRound(v, 1);
  return {
    cost_total: pyRound(total, 2),
    cost_per_unit: pyRound(total / quantity, 4),
    cost_breakdown,
    frames, total_linear_ft: pyRound(total_ft), total_msi: pyRound(msi),
    press_minutes: pyRound(press_min, 1),
    post_minutes,
    press_speed_fpm: pyRound(speed),
    layout: `${layout.across} across x ${layout.around} around = ${layout.per_frame}/frame, ${pyRound(layout.frame_repeat_in, 2).toFixed(2)}" repeat on a ${layout.web_width_in}" web`,
  };
}

// =============================================================================
// 6. PRODUCT DEFINITIONS  (what the website can price)
// =============================================================================
export interface FlexPrice {
  price_total: number;
  price_per_unit: number;
  margin: number;
  rush: Rush;
  lead_time_business_days: number;
}
export type FlexQuote = FlexCost & FlexPrice & { product: Product; structure: string; zipper?: string; finish?: string };

function _price_from_cost(cost_total: number, quantity: number, skus: number, rush: Rush, sku_charge = PER_SKU_CHARGE): FlexPrice {
  let price = cost_total / (1 - GROSS_MARGIN);
  price += sku_charge * (skus - 1);
  price = Math.max(price, MIN_ORDER_PRICE);
  price += RUSH_PREMIUMS[rush];
  return { price_total: pyRound(price, 2), price_per_unit: pyRound(price / quantity, 4), margin: GROSS_MARGIN, rush, lead_time_business_days: LEAD_TIME_BUSINESS_DAYS };
}

export type Colors = "cmyk" | "cmyk_w" | "cmy_w" | "cmyk_ovg_w" | "k";
/** Returns [cmyovg_count, k_count, white]. */
function _colors(spec: Colors, needs_white: boolean): [number, number, boolean] {
  const table: Record<Colors, [number, number, boolean]> = { cmyk: [3, 1, false], cmyk_w: [3, 1, true], cmy_w: [3, 0, true], cmyk_ovg_w: [6, 1, true], k: [0, 1, false] };
  const t = table[spec];
  if (!t) throw new FlexQuoteError(`Unknown colors "${spec}"`, "bad_input");
  return [t[0], t[1], t[2] || needs_white];
}
function need<T>(table: Record<string, T>, key: string, what: string): T {
  if (!Object.prototype.hasOwnProperty.call(table, key)) throw new FlexQuoteError(`Unknown ${what} "${key}"`, "bad_input");
  return table[key];
}
const postFor = (lam_passes: number, tail: Unit[]): Unit[] => (lam_passes ? ["lam", ...tail] : tail);

export interface StandUpPouchInput { width_in: number; height_in: number; gusset_in: number; quantity: number; skus?: number; structure?: string; zipper?: "none" | "ptc" | "slider"; colors?: Colors; rush?: Rush }
/** Bottom-gusset stand-up pouch. Print width = 2*H + gusset (across web), repeat = W. */
export function quote_stand_up_pouch(i: StandUpPouchInput): FlexQuote {
  const { width_in, height_in, gusset_in, quantity, skus = 1, structure = "matte_barrier", zipper = "ptc", colors = "cmyk_w", rush = "standard_15_day" } = i;
  const print_w = 2 * height_in + gusset_in;
  if (print_w > MAX_USABLE_WIDTH_IN) {
    throw new FlexQuoteError(`Pouch too tall for press: 2x${height_in}+${gusset_in} = ${print_w.toFixed(1)}" > ${MAX_USABLE_WIDTH_IN.toFixed(1)}". Max height with ${gusset_in}" gusset is ${((MAX_USABLE_WIDTH_IN - gusset_in) / 2).toFixed(1)}". Route to quote request.`);
  }
  const lay = _layout(print_w, width_in);
  const s = need(STRUCTURES, structure, "structure");
  const fit = need({ none: 0.0, ptc: ZIPPER_COST_PER_INCH_WIDTH * width_in, slider: ZIPPER_COST_PER_INCH_WIDTH * width_in + SLIDER_ZIPPER_ADDER }, zipper, "zipper");
  const [cmy, k, w] = _colors(colors, s.needs_white);
  need(RUSH_PREMIUMS, rush, "rush");
  const res = _cost(lay, quantity, skus, cmy, k, w, 0, structure_cost_per_msi(structure), s.lam_passes, postFor(s.lam_passes, ["slit", "bag"]), fit, width_in);
  return { ...res, ..._price_from_cost(res.cost_total, quantity, skus, rush), product: "stand_up_pouch", structure: s.label, zipper };
}

export interface FlatPouchInput { width_in: number; height_in: number; quantity: number; skus?: number; structure?: string; zipper?: "none" | "ptc"; colors?: Colors; rush?: Rush }
/** 3-side-seal flat pouch (single web folded). Print width = 2*H, repeat = W. */
export function quote_flat_pouch(i: FlatPouchInput): FlexQuote {
  const { width_in, height_in, quantity, skus = 1, structure = "matte_barrier", zipper = "none", colors = "cmyk_w", rush = "standard_15_day" } = i;
  const print_w = 2 * height_in;
  if (print_w > MAX_USABLE_WIDTH_IN) throw new FlexQuoteError("Pouch too tall for press; route to quote request.");
  const lay = _layout(print_w, width_in);
  const s = need(STRUCTURES, structure, "structure");
  const fit = need({ none: 0.0, ptc: ZIPPER_COST_PER_INCH_WIDTH * width_in }, zipper, "zipper");
  const [cmy, k, w] = _colors(colors, s.needs_white);
  need(RUSH_PREMIUMS, rush, "rush");
  const res = _cost(lay, quantity, skus, cmy, k, w, 0, structure_cost_per_msi(structure), s.lam_passes, postFor(s.lam_passes, ["slit", "bag"]), fit, width_in);
  return { ...res, ..._price_from_cost(res.cost_total, quantity, skus, rush), product: "flat_pouch", structure: s.label, zipper };
}

export interface RollstockInput { slit_width_in: number; cutoff_in: number; quantity: number; skus?: number; structure?: string; colors?: Colors; rush?: Rush }
/** Printed, laminated, slit rollstock for the customer's own form-fill-seal line. quantity = number of impressions (cutoffs). */
export function quote_rollstock(i: RollstockInput): FlexQuote {
  const { slit_width_in, cutoff_in, quantity, skus = 1, structure = "matte_barrier", colors = "cmyk_w", rush = "standard_15_day" } = i;
  const lay = _layout(slit_width_in, cutoff_in);
  const s = need(STRUCTURES, structure, "structure");
  const [cmy, k, w] = _colors(colors, s.needs_white);
  need(RUSH_PREMIUMS, rush, "rush");
  const res = _cost(lay, quantity, skus, cmy, k, w, 0, structure_cost_per_msi(structure), s.lam_passes, postFor(s.lam_passes, ["slit"]));
  return { ...res, ..._price_from_cost(res.cost_total, quantity, skus, rush), product: "rollstock", structure: s.label };
}

export interface RollLabelInput { width_in: number; height_in: number; quantity: number; skus?: number; structure?: string; finish?: (typeof LABEL_FINISHES)[number]; colors?: Colors; rush?: Rush }
/** Pressure-sensitive roll labels. Quantity = total labels across all SKUs (SKUs are ganged in one run). */
export function quote_roll_label(i: RollLabelInput): FlexQuote {
  const { width_in, height_in, quantity, skus = 1, structure = "label_white_bopp", finish = "none", colors = "cmyk", rush = "standard_15_day" } = i;
  const lay = _layout(width_in, height_in, 0.125, true);
  const s = need(STRUCTURES, structure, "structure");
  let per_msi = structure_cost_per_msi(structure);
  const post: Unit[] = ["slit", "cut"];
  let lam_passes = 0;
  if (finish === "gloss_opv" || finish === "matte_opv") {
    per_msi += MATERIALS[finish === "gloss_opv" ? "opv_gloss" : "opv_std"];
    post.unshift("lam"); lam_passes = 1;
  } else if (finish === "gloss_lam" || finish === "matte_lam") {
    per_msi += MATERIALS[finish === "gloss_lam" ? "ps_lam_gloss_pp" : "ps_lam_matte_pp"];
    post.unshift("lam"); lam_passes = 1;
  }
  const [cmy, k, w] = _colors(colors, false);
  need(RUSH_PREMIUMS, rush, "rush");
  const res = _cost(lay, quantity, skus, cmy, k, w, 0, per_msi, lam_passes, post);
  return { ...res, ..._price_from_cost(res.cost_total, quantity, skus, rush, PER_SKU_CHARGE_LABEL), product: "roll_label", structure: s.label, finish };
}

export const PRODUCTS = {
  stand_up_pouch: quote_stand_up_pouch,
  flat_pouch: quote_flat_pouch,
  rollstock: quote_rollstock,
  roll_label: quote_roll_label,
} as const;
export type Product = keyof typeof PRODUCTS;

/** The Python entry point: quote(product, **kwargs). */
export function quote(product: Product, args: Record<string, unknown>): FlexQuote {
  const fn = PRODUCTS[product] as ((a: never) => FlexQuote) | undefined;
  if (!fn) throw new FlexQuoteError(`"${product}" is not priced online. Route to quote request.`);
  return fn(args as never);
}

// =============================================================================
// 7. VALIDATION against the HP workbook default scenario
// =============================================================================
/** Workbook default: Shrink Label, layflat 4" x 11", 5,000 pcs, 1 SKU, CMYOVG=3, K=1, Premium White,
 *  lam+slit on, structure DigiPrime + PE shrink $0.20, fitment $0.005/unit, substrate width 30". Expected cost $442.97. */
export function _validate_against_workbook(): number {
  const lay = _layout(4, 11);
  lay.web_width_in = 30;
  return _cost(lay, 5000, 1, 3, 1, true, 0, PRIMER_COST_PER_MSI + MATERIALS.pe_shrink_film, 1, ["lam", "slit"], 0.005).cost_total;
}

// =============================================================================
// 8. FOR THE WEBSITE  (not in the Python file; the rules are from Nitay's README)
// =============================================================================

/** README section 2 guards. Throws FlexQuoteError (route "quote_request") when the job should go to a person. */
export function checkOnline(product: string, args: { quantity?: unknown; skus?: unknown; colors?: unknown }): void {
  if (!Object.prototype.hasOwnProperty.call(PRODUCTS, product)) throw new FlexQuoteError("This product is quoted by a C&D specialist.");
  const quantity = Number(args.quantity), skus = args.skus == null ? 1 : Number(args.skus);
  if (!Number.isInteger(quantity) || quantity < 1) throw new FlexQuoteError("Quantity must be a whole number.", "bad_input");
  if (!Number.isInteger(skus) || skus < 1) throw new FlexQuoteError("Number of designs must be a whole number.", "bad_input");
  if (skus > ONLINE_LIMITS.maxSkus) throw new FlexQuoteError(`Orders with more than ${ONLINE_LIMITS.maxSkus} designs are quoted by a C&D specialist.`);
  if (args.colors === "cmyk_ovg_w") throw new FlexQuoteError("Expanded gamut and Pantone-critical work is quoted by a C&D specialist.");
  if (product === "stand_up_pouch" || product === "flat_pouch") {
    const L = ONLINE_LIMITS[product], each = quantity / skus;
    if (each < L.minPerSku) throw new FlexQuoteError(`Online pouch orders start at ${L.minPerSku.toLocaleString("en-US")} per design.`, "bad_input");
    if (each > L.maxPerSku) throw new FlexQuoteError(`Over ${L.maxPerSku.toLocaleString("en-US")} per design is quoted by a C&D specialist.`);
  } else if (product === "rollstock") {
    if (quantity < ONLINE_LIMITS.rollstock.minTotal) throw new FlexQuoteError(`Rollstock orders start at ${ONLINE_LIMITS.rollstock.minTotal.toLocaleString("en-US")} impressions.`, "bad_input");
  } else if (product === "roll_label") {
    if (quantity / skus < ONLINE_LIMITS.roll_label.minPerSku) throw new FlexQuoteError(`Label orders start at ${ONLINE_LIMITS.roll_label.minPerSku} per design.`, "bad_input");
  }
}

/** What a customer may see. No cost, no margin, no press data. */
export interface CustomerFlexQuote {
  product: Product;
  structure: string;
  zipper?: string;
  finish?: string;
  quantity: number;
  skus: number;
  price_total: number;
  price_per_unit: number;
  rush: Rush;
  lead_time_business_days: number;
  one_time: { item: string; amount: number; note: string }[];
}
export function customerView(q: FlexQuote, quantity: number, skus = 1, opts: { newLabelSize?: boolean; pressProof?: boolean } = {}): CustomerFlexQuote {
  const one_time: CustomerFlexQuote["one_time"] = [];
  if (q.product === "roll_label" && opts.newLabelSize) one_time.push({ item: "Label die", amount: LABEL_DIE_CHARGE, note: "One time, for a new label size. No charge on reorders." });
  if ((q.product === "stand_up_pouch" || q.product === "flat_pouch") && opts.pressProof) one_time.push({ item: "Printed, formed press proof", amount: PRESS_PROOF_CHARGE, note: "Credited on your first order." });
  return {
    product: q.product, structure: q.structure, zipper: q.zipper, finish: q.finish, quantity, skus,
    price_total: q.price_total, price_per_unit: q.price_per_unit, rush: q.rush, lead_time_business_days: q.lead_time_business_days, one_time,
  };
}
