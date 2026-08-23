// Classic (E&M Parsec-style) estimator math — shared by
// /dashboard/quotes/estimate-classic. Pure functions over one big form
// object so every number recomputes live as Mary types.
//
// All rates/diffs arrive as editable form fields (prefilled with defaults
// or PlantStandard values) — nothing here reads the database directly.
//
// Multi-part jobs (E&M "No. of Parts"): part 1 lives in the flat Screen 6-8
// fields (unchanged shape — old drafts keep working); parts 2..N live in
// `parts[]`. Each part gets its own paper+press+bindery pass at the job
// quantity; prep/outside/freight/markups/commission stay job-level.

import {
  DigitalClickStandards,
  InkConfig,
  getDigitalSizeTier,
  getDigitalClickRate,
  getDigitalVDRate,
} from "@/lib/digital-clicks";

export const JOB_TYPES = [
  "New With Pre-Press",
  "New w/o Pre-Press",
  "Exact Reprint",
  "Reprint w/Changes",
  "Pre-Press Only",
  "Bindery Only",
  "Press Only",
  "Custom Only",
  "All Outside",
  "Digital Direct",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export interface OutsidePurchase {
  description: string;
  amount: number;
  // Mary 7/21 (QT-2026-067): outside services can be priced per M pieces so
  // they scale with each quoted quantity, and carry a +3% handling upcharge.
  // Old saved rows lack these keys → behave as { per: "job", plus3: false }.
  per?: "job" | "perM";
  plus3?: boolean;
  // Mary 7/21: vendors quote outside services per quantity break and prices
  // don't scale linearly. amountsByTier[i] is the price at additional
  // quantity i+1 (tier 0 = the primary `amount`); 0/missing falls back to
  // the primary amount.
  amountsByTier?: number[];
  // Benjy 7/21: C&D calls Todd's IN-HOUSE finishing "outside service" for
  // historical reasons, but it's a real C&D cost, not a buyout. The tag
  // routes Todd rows into the finishing cost bucket for reports; missing
  // tag = vendor (true outsourced), matching all old rows.
  source?: "todd" | "vendor";
  // Per-row markup. Mary routinely mixes buckets on ONE quote: bought-out
  // DIGITAL rides at 0% while die/glue/foil services ride at 32%. A single
  // job-level outside % cannot express that. undefined/null = use the job
  // default; 0 = carry this row at cost (still gets E&M's $1 minimum).
  markupPct?: number | null;
}

// ── Small-run speed curve (Mary 7/21: "not going to hit 10,000/hr on smaller
// runs"). Effective SPH = rated SPH × factor(press sheets). PLACEHOLDER
// thresholds/factors pending Mary's real observed speeds — tune here only.
// Recalibrated 7/21 against E&M #348538: a 3,750-sheet coated-text run went
// 5,400 SPH on a 10,000-rated KOMII (×0.54) — old factors were too fast.
// Anchored to that one observation; still PLACEHOLDER pending Mary's rate card.
export const SMALL_RUN_SPEED_CURVE: { maxSheets: number; factor: number }[] = [
  { maxSheets: 1000, factor: 0.4 },
  { maxSheets: 2500, factor: 0.5 },
  { maxSheets: 5000, factor: 0.55 },
  { maxSheets: 10000, factor: 0.7 },
];
// Even long runs rarely sustain the rated sheet count (E&M evidence).
export const SPEED_CURVE_LONG_RUN_FACTOR = 0.85;

/** Speed factor for a run length (long runs get SPEED_CURVE_LONG_RUN_FACTOR). */
export function smallRunSpeedFactor(pressSheets: number): number {
  for (const t of SMALL_RUN_SPEED_CURVE) {
    if (pressSheets < t.maxSheets) return t.factor;
  }
  return SPEED_CURVE_LONG_RUN_FACTOR;
}

// ── Press speed caps (Mary 7/21: E&M auto-calculated run speed from sheets,
// inks, and paper weight). Rules seeded from PlantStandard: heavy ink coverage
// caps the press at solidCoverageSpeed; thick board caps it at boardCapSpeed.
// Suggested SPH = min(rated, applicable caps) × small-run factor.
export interface SpeedRules {
  solidCoverageSpeed: number;   // SPH cap when coverage is heavy (std: 8500)
  heavyCoveragePct: number;     // total ink coverage % that counts as heavy (std: 60)
  boardCapInches: number;       // caliper at/above which the board cap applies (std: 0.028)
  boardCapSpeed: number;        // SPH cap for thick board (std: 4100)
}
export const DEFAULT_SPEED_RULES: SpeedRules = {
  solidCoverageSpeed: 8500, heavyCoveragePct: 60, boardCapInches: 0.028, boardCapSpeed: 4100,
};

/** Parse a caliper in inches out of the free-text stock weight ("18pt C1S",
 *  "24 pt", ".028", "0.030 in") — 0 when nothing parseable. */
export function parseCaliperInches(caliperBasisWeight: string): number {
  const s = String(caliperBasisWeight || "");
  const pt = s.match(/(\d+(?:\.\d+)?)\s*(?:pt|point)/i);
  if (pt) return parseFloat(pt[1]) / 1000;
  const inches = s.match(/(?:^|[^\d])(0?\.\d{2,3})(?:\s*(?:in|"|inch))?/i);
  if (inches) return parseFloat(inches[1]);
  return 0;
}

// Coating/Aqueous types Mary quotes (Screen 7 offset branch). $/lb prefills
// from PlantStandard: AQ types → inkAqueousPerLb, Varnish → inkVarnishPerLb.
export const COATING_TYPES = ["", "Gloss AQ", "Matte AQ", "Satin AQ", "UV", "Varnish"] as const;
export type CoatingType = (typeof COATING_TYPES)[number];

// ── One press RUN inside a part ─────────────────────────────────────────
// E&M prints a separate run block per signature group, each with its own work
// style, sheet count, plate count, makeready and waste — and they can differ
// WITHIN one part (#348472: a 3-sig SHEETWISE run plus a 2-sig WORK & TURN run;
// #348228: 27 runs / 216 plates in a single part). A part with an empty runs[]
// behaves exactly as before, using the flat single-run fields.
export interface PressRun {
  label: string;              // "Run 3: 3 8-page sigs SHEETWISE"
  sheets: number;             // NET press sheets for this run
  workAndTurn: boolean;
  runColorsSide1: number;
  runColorsSide2: number;
  // E&M prints a plate/washup count per run, and it depends on the signature
  // layout (#348472 Run 3 = 3 8-pg sigs sheetwise -> 24; Run 1 = 2 4-pg sigs
  // W&T -> 4), which colors alone cannot express. 0 = derive from colors.
  plates: number;
  makereadySheets: number;    // E&M prints it per run
  runWastePct: number;        // running spoilage on this run's sheets
  bindWasteSheets: number;
  runSpeedSph: number;
  runDiff: number;
}

export function defaultPressRun(): PressRun {
  return {
    label: "", sheets: 0, workAndTurn: false,
    runColorsSide1: 4, runColorsSide2: 4, plates: 0,
    makereadySheets: 0, runWastePct: 5, bindWasteSheets: 0,
    runSpeedSph: 0, runDiff: 1,
  };
}

export interface HandOp {
  description: string;
  piecesPerHour: number;
  pctOfQty: number; // % of quantity that goes through this op
  // E&M's "Hand Bind 1 - Diecut/Strip" lines are flat hour tokens (0.1 hr,
  // $1.88) naming the real operation, not qty-driven. 0 = derive from rate.
  hours?: number;
  ratePerHr?: number; // 0/undefined = the part's hand-bindery rate
}

// ── Per-part field set (Screens 6 + 7 + 8) ──────────────────────────────
// Part 1 IS the flat fields on ClassicForm; additional parts are Picks of
// exactly these keys stored in `parts[]`.
export const PART_FIELD_KEYS = [
  // Screen 6 — Paper/Stock
  "sheetWidthRun", "sheetHeightRun", "sheetWidthOrder", "sheetHeightOrder",
  "numPages", "stockDescription", "caliperBasisWeight", "pricePerM", "weightPerMSheets",
  "numberUp", "sheetsPerPiece", "sheetsOutOfParent", "bindWasteSheets",
  "bleedAllowance", "brandColorFinish",
  // Screen 7 — Press
  "pressId", "pressConfigId", "pressHourlyRate", "helperHourlyRate",
  "productKind", "finishedWidthIn", "finishedHeightIn", "flatWidthIn", "flatHeightIn",
  "boxWidthIn", "boxDepthIn", "boxHeightIn",
  "partName", "paperHandlingHrs", "paperHandlingRate", "signatureRuns", "runs",
  "plateHrsPerPlate", "plateHrsDiff", "plateLaborRate", "preprintedPass", "versions",
  "cutterRatePerHr", "trimRatePerHr", "handBindRatePerHr", "packRatePerHr",
  "wrapRatePerHr", "deliveryHrs", "deliveryRatePerHr", "cartonsPerHour",
  "runColorsSide1", "runColorsSide2", "workAndTurn", "plateCostEach",
  "pressSetupHrs", "pressSetupDiff", "baseMakereadyHrsPerPlate",
  "makereadyDiff", "washupHrsPerUnit", "washupDiff", "runSpeedSph",
  "runWastePct", "paperBuyRounding",
  "useSpeedCurve",
  "runDiff", "wasteFactorPct", "helpers",
  "coatingType", "coatingCoveragePct", "coatingDollarsPerLb", "coatingIsSpot",
  "padRatePerHr", "padsPerHour",
  "wasteSheetsManual", "wastePerColorSheets", "wastePerEquipmentSheets", "equipmentPassesManual",
  "inkCoverageBlackPct", "inkCoverageColorPct", "inkCoverageLedPct", "inkCoveragePmsPct", "inkCoverageVarnishPct",
  "inkFactorMsqinPerLb", "inkBlackDollarsPerLb", "inkDollarsPerLb", "inkLedDollarsPerLb", "inkPmsDollarsPerLb", "varnishDollarsPerLb",
  "dieCutHrs", "scorePerfHrs", "dieCost", "dieNumber", "pressCheckHrs",
  "digitalInkConfig", "digitalMakereadySheets", "digitalVariableData", "digitalVDSetupHrs",
  "digitalOversSheets", "digitalVendorAmount", "digitalOnPart",
  "inkLbsManual",
  // Screen 8 — Bindery
  "binderyOperation", "cuttingDiff", "cutterSheetsPerHr", "trimHrs",
  "cutsToFinalSize", "sheetsPerLift", "cutSecPerCut", "cutterHrsManual", "cutterLifts", "cutterHrsPerLift", "cutterDiff",
  "drillHoles", "drillDiff", "drillHrsPerHole", "folderConfig",
  "foldSetupHrs", "foldRunHrs", "folderRatePerHr", "foldCount", "folderSpeedPerHr", "foldDiff", "foldWastePct", "foldTypeName",
  "stitcherName", "stitchSetupHrs", "stitchRunHrs", "stitchHelpHrs", "stitchSpeed", "stitchRatePerHr", "stitchHelpRatePerHr",
  "handOp1", "handOp2", "cartons", "cartonCost", "skids", "skidCost",
  "packHrs", "binderyHourlyRate",
  "bandIn", "bandHrs", "padIn", "padHrs", "wrapIn", "wrapHrs", "bundleRatePerHr",
] as const;

export type ClassicPart = Pick<ClassicForm, (typeof PART_FIELD_KEYS)[number]>;

export interface ClassicForm {
  // ── Screen 1 — Main Entry ──
  customerName: string;
  customerNumber: string;
  address: string;
  jobTitle: string;
  quantity: number;
  // Up to 3 additional quantities (E&M quotes multiple quantities per
  // estimate). 0/blank entries are ignored.
  additionalQuantities: number[];
  // Transient: which quantity tier this calc run represents (0 = primary).
  // Set by computeQuantityBreaks so per-tier outside prices resolve.
  activeTierIndex?: number;
  numParts: number;
  markupPaperPct: number;
  markupMaterialPct: number;
  markupOutsidePct: number;
  markupLaborPct: number;
  commissionPct: number;

  // ── Screen 2 — Additional Instructions ──
  instructions: string;

  // ── Screen 3 — Job Type ──
  jobType: JobType;

  // ── Screen 4 — Electronic Prepress ──
  designHours: number;
  photoshopHours: number;
  prepressRate: number; // $/hr
  // E&M bills "Type/Output" as its own prep line, separate from Design and
  // from Proofs (0.1 hr/$10, 0.3 hr/$20, 0.4, 0.7 across the batch).
  typeOutputHrs: number;
  typeOutputRate: number;
  // Proof material scales PER PLATE, not as a flat count x charge: #348988 and
  // #347866 both land on exactly $19.19/plate (4 -> 76.76, 16 -> 307.05,
  // 24 -> 460.58). 0 = use the flat proof counts below.
  proofMaterialPerPlate: number;
  scans85x11: number;
  scans11x17: number;
  scans20x25: number;
  scanCharge85x11: number;
  scanCharge11x17: number;
  scanCharge20x25: number;
  furnishedDisks: number;
  furnishedDiskCharge: number;
  laserProofs: number;
  laserProofCharge: number;
  colorProofs: number;
  colorProofCharge: number;

  // ── Screen 5 — Camera / Stripping / Platemaking ──
  plateDiffFactor: number;
  dyluxProofs: number;
  dyluxCharge: number;
  matchprintProofs: number;
  matchprintCharge: number;
  separations: number;
  separationCharge: number;

  // ── Screen 6 — Paper / Stock (part 1) ──
  sheetWidthRun: number;
  sheetHeightRun: number;
  sheetWidthOrder: number;
  sheetHeightOrder: number;
  numPages: number;
  stockDescription: string;
  caliperBasisWeight: string;
  pricePerM: number; // $ per 1000 sheets
  weightPerMSheets: number; // lbs per 1000 parent sheets (E&M "147M" notation) — drives auto cartons
  numberUp: number;
  sheetsPerPiece: number; // press sheets per finished piece (booklets: 16pg on 4pp/side = 4) — Cybake #347528
  sheetsOutOfParent: number; // press sheets cut from each parent sheet bought (E&M "out of parent"); pricePerM is per PARENT
  bindWasteSheets: number;   // extra press sheets bought for bindery spoilage — paper only, never clicked/printed
  bleedAllowance: string;
  brandColorFinish: string;

  // Paper handling — E&M prints a "Paper handling 0.1 Hrs" line that rides
  // with the paper block (#348988: paper 337.50 → 340.17 with handling).
  // Missing before the 8/18 validation batch.
  paperHandlingHrs: number;
  paperHandlingRate: number;

  // ── Screen 7 — Press (part 1, offset) ──
  pressId: string;
  pressConfigId: string;
  pressHourlyRate: number;
  helperHourlyRate: number;
  runColorsSide1: number;
  runColorsSide2: number;
  // WORK & TURN (E&M #348538): same plates print both sides — plates,
  // washups and makereadys count max(side1, side2) instead of the sum.
  workAndTurn: boolean;
  // Plate materials (E&M #348538: 4 plates @ $19 = $76 in the MATERIAL
  // bucket). Prefills from the selected press config's plateCost; editable.
  plateCostEach: number;
  // Plate-MAKING labor — E&M bills a "Plates" line with hours and a diff
  // paren (0.3 hr for 4 plates, 10.9 hrs for 216) at ~$95/hr, separate from
  // the plate material. No field existed before 8/18.
  plateHrsPerPlate: number;   // 0.075/plate reproduces E&M's printed hours
  plateHrsDiff: number;
  // Plate-making labor rate DERIVED from #348988: 4 plates print "0.3 Hrs"
  // and $81.92 against $76.00 of plate material -> $5.92 / 0.3 = $19.73/hr.
  // (Not the $95 prepress rate -- platemaking bills lower.)
  plateLaborRate: number;
  // Second pass over PREPRINTED sheets (LED-UV spot/flood re-pass, #348478
  // p2 / #349049 p2): paper is already in-house, so no paper cost and no
  // auto-cartons — but the pass still has its own makeready, waste and hours.
  preprintedPass: boolean;
  // Two versions of one product on a single layout (#348627 2x25,000;
  // #348352 2x58,000) — scales plates/proofs, not sheet math.
  versions: number;
  // Per-operation bindery rates — E&M runs each machine at its own rate
  // (Load Cutter $46, Trim $44, Ctn Pack $15, Wrap $35, Hand Bind $18.80,
  // Delivery $45). The engine lumped them all at binderyHourlyRate.
  cutterRatePerHr: number;
  trimRatePerHr: number;
  handBindRatePerHr: number;
  packRatePerHr: number;
  wrapRatePerHr: number;
  deliveryHrs: number;
  deliveryRatePerHr: number;
  // Carton packing auto-derives at ~40 cartons/hr (clean fit from 4 to 2,735
  // cartons across 13 estimates). packHrs typed = override.
  cartonsPerHour: number;
  // FINISHED SIZE as real numbers (Mary 8/21). E&M prints "FINAL TRIM SIZE"
  // per part on the letter, and it was free text here. Numeric so the engine
  // can sanity-check imposition and the letter can render it consistently.
  productKind: "flat" | "box";
  finishedWidthIn: number;
  finishedHeightIn: number;
  // FLAT size of the PRODUCED PIECE — e.g. an 11x17 flat that folds to
  // 8.5x11. Mary 8/21 corrected me on this: "Size To Run" and "Size To Order"
  // are the PAPER we buy and run, not the piece. Different thing entirely,
  // and this is what folding, cutting and ink coverage should key off.
  flatWidthIn: number;
  flatHeightIn: number;
  // Boxes are three-dimensional: W x D x H (Mary 8/21). The flat BLANK still
  // comes from the die, not from these — see the die-inventory lookup.
  boxWidthIn: number;
  boxDepthIn: number;
  boxHeightIn: number;
  // What this part IS — E&M prints "Part 1 of 5 End sheet", "Fold out",
  // "6 inserts". A five-part case-bound book is unreadable without it.
  partName: string;
  // Explicit per-run breakdown. When non-empty this REPLACES the flat
  // single-run press fields for sheets/plates/makeready/waste/run hours.
  runs: PressRun[];
  // Signature runs inside ONE part — E&M prints "Run 2 ... 2 12-Page Sigs"
  // (#348988 part 2: 24pp text = 2 sig runs, 20 wash/makereadys, 24 plates).
  // Multiplies plates, press units and run passes for the part. 1 = single run.
  signatureRuns: number;
  // Press SETUP line — E&M prints "Setup 0.1 Hrs ( 0.8 )" above Makeready
  // (#348988). Flat per-run hours × its own difficulty factor; missing
  // entirely before the 8/18 validation batch.
  pressSetupHrs: number;
  pressSetupDiff: number;
  baseMakereadyHrsPerPlate: number;
  makereadyDiff: number;
  washupHrsPerUnit: number;
  washupDiff: number;
  runSpeedSph: number; // RATED speed — small-run curve derates it when enabled
  useSpeedCurve: boolean; // apply the small-run speed curve (Mary 7/21)
  // Speed-cap rules (job-level, prefilled from PlantStandard; Mary 7/21:
  // E&M auto-suggested run speed from sheets, inks and paper weight).
  solidCoverageSpeed: number; // SPH cap when ink+coating coverage is heavy
  heavyCoveragePct: number;   // coverage % threshold that counts as heavy
  boardCapInches: number;     // caliper (in) at/above which board cap applies
  boardCapSpeed: number;      // SPH cap for thick board
  runDiff: number;
  wasteFactorPct: number; // LEGACY — superseded by Mary's sheet-based waste rule below (7/20)
  // Press waste, Mary's actual E&M rule (7/20): 100 sheets per color per side
  // + 100 sheets per piece of equipment the job passes through (cut/fold/
  // die/score/stitch). All knobs editable; manual sheets override wins.
  wasteSheetsManual: number;       // 0 = auto formula
  wastePerColorSheets: number;     // default 100
  wastePerEquipmentSheets: number; // default 100
  // Running spoilage % on top of makeready (E&M "Press waste"; #348988: 56 =
  // 5% of 1,125 net press sheets). Validation batch 8/18.
  runWastePct: number;             // default 5
  // Paper is bought in whole increments — E&M rounds the parent-sheet buy up
  // to the next 250 (#348988: 1,881 → 2,000; 6,640 → 6,750). 0/1 = no rounding.
  paperBuyRounding: number;        // default 250
  equipmentPassesManual: number;   // 0 = auto-count from the job's operations
  helpers: number;
  inkCoverageBlackPct: number;
  inkCoverageColorPct: number;   // process (CMYK) coverage
  inkCoverageLedPct: number;     // LED-cured process coverage (Mary 7/21)
  inkCoveragePmsPct: number;     // PMS/spot coverage
  inkCoverageVarnishPct: number;
  // Directly entered ink pounds -- overrides the coverage model. E&M prints a
  // flat ink figure on carrier-press jobs (#349100 envelopes: $39.50 on a
  // 0-hour press = 23% of cost) that no coverage calc can produce.
  inkLbsManual: number;
  inkFactorMsqinPerLb: number; // thousand sq-in of coverage per lb of ink
  inkBlackDollarsPerLb: number; // black ink $/lb (std 10.81)
  inkDollarsPerLb: number; // PROCESS ink $/lb (std 10.81)
  inkLedDollarsPerLb: number;   // LED process ink $/lb — NO plant standard, PLACEHOLDER pending Mary
  inkPmsDollarsPerLb: number;   // PMS ink $/lb (std 19.50)
  varnishDollarsPerLb: number; // varnish prices at its own rate ($5.50 std), not ink money
  // Coating/Aqueous (offset — Mary 7/21). Lbs use the same coverage model as
  // ink; $/lb prefills by type from PlantStandard, always hand-editable.
  coatingType: string;          // "" = none; see COATING_TYPES
  coatingCoveragePct: number;   // default 100 (flood)
  // SPOT coating carries an image so it needs its own plate; FLOOD does not.
  // Resolves E&M's apparent contradiction (#348988 4c+varnish = 4 plates
  // flood; #348627 1c+varnish = 2 plates spot). Derived 8/18.
  coatingIsSpot: boolean;
  // Padding (notepads/forms): E&M runs a clean 500 pads/hr at $18/hr.
  padRatePerHr: number;
  padsPerHour: number;
  coatingDollarsPerLb: number;  // prefilled by type, editable
  dieCutHrs: number;
  scorePerfHrs: number;
  dieCost: number;
  dieNumber: string; // existing die # from the die inventory (blank = new die)
  pressCheckHrs: number;

  // ── Screen 7 — Digital branch (part 1) ──
  digitalInkConfig: InkConfig;
  digitalMakereadySheets: number;
  // Sheets used for CLICK PRICING. E&M routinely disagrees with the paper
  // makeready count, so keep them separate (0 = fall back to makeready).
  digitalOversSheets: number;
  // A typed vendor price WINS over the computed click cost -- the click calc
  // becomes a suggestion. Mary quotes digital off the vendor's actual number.
  digitalVendorAmount: number;
  // Run the digital click engine on THIS part regardless of the job-level
  // jobType. Mary's carrier-press jobs mix bought-out digital with real ink
  // and setup, which the all-or-nothing job type forbids.
  digitalOnPart: boolean;
  digitalVariableData: boolean;
  digitalVDSetupHrs: number;

  // ── Screen 8 — Bindery (part 1) ──
  binderyOperation: number; // 1 Flat / 2 Saddle / 3 Folded / 4 Perfect / 5 Multibind / 6 Plastic
  cuttingDiff: number;       // Mary eyeballs .5/.6/.7 — more cuts to final size = higher (7/20)
  // DEAD since 8/19 -- the lifts model replaced it. Kept so saved drafts
  // still parse; no longer read by the math and no longer on screen.
  cutterSheetsPerHr: number;
  trimHrs: number;           // 0 = auto from cuts × sec/cut × diff (E&M computed trim from difficulty)
  cutsToFinalSize: number;   // cuts to get a lift to final size (0 = auto trim off)
  // E&M prints "Load Cutter (N lifts)" with its own hours; 0 = auto from
  // sheets/cutterSheetsPerHr. Added 8/18 -- no manual override existed.
  cutterHrsManual: number;
  // E&M's Load Cutter is LIFTS-driven, not sheets-per-hour: hours = lifts x
  // 0.0146 x difficulty. Verified to the cent on 7 quotes (10 lifts -> $7.88,
  // 94 -> $74.03, 32 -> $29.40 ...). Mary enters lifts, we compute the hours.
  cutterLifts: number;      // 0 = auto from sheets / sheetsPerLift
  // The cutter has its OWN difficulty (E&M prints 1.0 / 1.2 / 1.4), separate
  // from the trim difficulty (0.6 / 0.8). Sharing one broke both.
  cutterDiff: number;
  cutterHrsPerLift: number; // 0.0146 at difficulty 1.0
  sheetsPerLift: number;     // sheets the cutter takes per lift (default 500)
  cutSecPerCut: number;      // seconds per cut (plant standard: 8)
  drillHoles: number;
  drillDiff: number;
  drillHrsPerHole: number;
  folderConfig: string;
  // Folding as its own machine line (E&M #348538: 0.6 setup + 1.4 run @ ~$48).
  foldSetupHrs: number;
  // Fold RUN hours auto-compute like E&M did: pieces to fold / folder speed x
  // difficulty. Mary never knew the hours -- E&M told HER (8/19: "folding I
  // have no clue how to even put this in"). 0 = auto; a typed value overrides.
  foldRunHrs: number;
  foldCount: number;        // pieces to fold (0 = job qty x sheets per piece)
  folderSpeedPerHr: number; // baum-26x40 runs ~6,500/hr across her quotes
  foldDiff: number;         // E&M's parenthesised difficulty, e.g. (0.9)
  // Fold waste %, from the Fold Types table. Mary 8/20: 25,000 x 1.02 / 8,000
  // = 3.19 run hrs, so waste lifts the sheets fed BEFORE the speed divide.
  foldWastePct: number;
  foldTypeName: string;     // the row chosen from the Fold Types table
  folderRatePerHr: number; // prefills PlantStandard.folder1Rate ($48)
  // Saddle stitching as its own machine line (E&M #348975: Saddlebind Setup
  // 0.5hr @ $95 + Mueller run + Help). Missing entirely before — selecting
  // "Saddle" as the operation did nothing (Mary 8/10). Auto run = books ÷
  // stitcher speed; a typed Run value (0 = auto) overrides. Help runs at the
  // hand-bindery rate.
  stitcherName: string;      // E&M names the machine: "Saddlebind on the Mueller"
  stitchSetupHrs: number;    // prefill 0.5 (E&M setup)
  stitchRunHrs: number;      // 0 = auto from qty / stitchSpeed
  stitchHelpHrs: number;
  stitchSpeed: number;       // books/hr, prefills PlantStandard.saddleStitch1Speed (8000)
  stitchRatePerHr: number;   // prefills PlantStandard.saddleStitch1Rate ($95)
  stitchHelpRatePerHr: number; // prefills handBinderyRate ($22.50)
  handOp1: HandOp;
  handOp2: HandOp;
  cartons: number;
  cartonCost: number;
  skids: number;
  skidCost: number;
  packHrs: number;
  binderyHourlyRate: number;
  // Band / Pad / Wrap (E&M Screen 8 trio — Mary 7/20). The "In" value is the
  // pieces-per-bundle count; hours AUTO-compute (bundles ÷ bundle rate) with
  // the Hrs field as a manual override (0 = auto), like E&M.
  bandIn: string;  // pieces per band, e.g. "50" (extra text tolerated)
  bandHrs: number; // 0 = auto
  padIn: string;   // pieces per pad, e.g. "100"
  padHrs: number;  // 0 = auto
  wrapIn: string;  // pieces per wrap, e.g. "100 kraft"
  wrapHrs: number; // 0 = auto
  bundleRatePerHr: number; // bundles processed per hour (shared band/pad/wrap standard)

  // ── Multi-part: parts 2..N (Screen 6-8 field subset each) ──
  parts: ClassicPart[];

  // ── Screen 9 — Cost Summary ──
  additionalCosts: number;
  freight: number;
  // Freight rides the OUTSIDE bucket and takes outside markup in E&M
  // (#348747 qty 50: outside base 583.53 = Finish Out 548.23 + freight 35.30).
  freightInOutside: boolean;
  // Plate discount — E&M subtracts it from the OUTSIDE base before markup
  // (#348472 -252.00, #348228 -1,980.00, both confirmed to the cent).
  plateDiscount: number;
  // One-time die / cutting / stripping-board fees. These print on the letter
  // ("Includes 1 time new die fee of $X") but are deliberately EXCLUDED from
  // the priced buildup (#348484 $602, #348478 $1,382, #349049 $1,205).
  oneTimeCharges: { description: string; amount: number }[];
  // Commission: E&M sometimes bills a flat dollar amount (#348440 "$500.00
  // commission for Lee") or none at all on broker jobs (#347866).
  commissionMode: "pct" | "flat" | "none";
  commissionFlat: number;
  // A bindery VENDOR can require extra copies to run their line -- E&M
  // #343786: "5 overs in Bindtech price / see overs needed for bindtech on
  // thier quote". Those overs must be PRINTED, so they lift the press
  // quantity without changing what the customer is billed for.
  binderyOvers: number;
  // "Mill Item Stock — allow time for delivery": a special-order stock not on
  // the floor. Prints as a lead-time warning on the letter.
  millItemStock: boolean;
  // "3% Surcharge added if paying by Credit Card" boilerplate (0 = none;
  // #348440 says "NO 3%").
  cardSurchargePct: number;
  outsidePurchases: OutsidePurchase[];
  deliveryZone: string;
  quoteNotes: string;
}

export const BINDERY_OPERATIONS = [
  "1 Flat",
  "2 Saddle",
  "3 Folded",
  "4 Perfect",
  "5 Multibind",
  "6 Plastic",
  // Case (hardcover) binding — E&M #343786 "Perfect Bound with Case Cover",
  // a 250-copy Kolter book with end sheets, a fold-out and 7 inserts. The
  // case work itself is bought out (BindTech); this drives the equipment
  // pass and the bindery description.
  "7 Case Bound",
] as const;

export function defaultClassicForm(): ClassicForm {
  return {
    customerName: "", customerNumber: "", address: "", jobTitle: "",
    quantity: 0, additionalQuantities: [], numParts: 1,
    // Markup defaults confirmed against Mary's 36-quote E&M validation batch
    // (8/18): Paper 33 / Material 18 / Outside 32 / Labor 40 / Commission 10
    // held on nearly every estimate. (Material was 16, Outside 24 before.)
    markupPaperPct: 33, markupMaterialPct: 18, markupOutsidePct: 32,
    markupLaborPct: 40, commissionPct: 10,
    instructions: "",
    jobType: "New With Pre-Press",
    designHours: 0, photoshopHours: 0, prepressRate: 95,
    typeOutputHrs: 0, typeOutputRate: 60, proofMaterialPerPlate: 0,
    scans85x11: 0, scans11x17: 0, scans20x25: 0,
    scanCharge85x11: 15, scanCharge11x17: 25, scanCharge20x25: 40,
    furnishedDisks: 0, furnishedDiskCharge: 10,
    laserProofs: 0, laserProofCharge: 12,
    colorProofs: 0, colorProofCharge: 30,
    plateDiffFactor: 1, dyluxProofs: 0, dyluxCharge: 15,
    matchprintProofs: 0, matchprintCharge: 45,
    separations: 0, separationCharge: 20,
    sheetWidthRun: 0, sheetHeightRun: 0, sheetWidthOrder: 0, sheetHeightOrder: 0,
    numPages: 0, stockDescription: "", caliperBasisWeight: "",
    pricePerM: 0, weightPerMSheets: 0, numberUp: 1, sheetsPerPiece: 1, sheetsOutOfParent: 1, bindWasteSheets: 0, bleedAllowance: "", brandColorFinish: "",
    pressId: "", pressConfigId: "", pressHourlyRate: 0, helperHourlyRate: 0,
    runColorsSide1: 0, runColorsSide2: 0,
    workAndTurn: false, plateCostEach: 0,
    productKind: "flat", finishedWidthIn: 0, finishedHeightIn: 0,
    flatWidthIn: 0, flatHeightIn: 0,
    boxWidthIn: 0, boxDepthIn: 0, boxHeightIn: 0,
    partName: "", paperHandlingHrs: 0, paperHandlingRate: 22.5, signatureRuns: 1, runs: [],
    plateHrsPerPlate: 0.075, plateHrsDiff: 1, plateLaborRate: 19.73,
    padRatePerHr: 18, padsPerHour: 500,
    preprintedPass: false, versions: 1,
    cutterRatePerHr: 45, trimRatePerHr: 45, handBindRatePerHr: 18.8,
    packRatePerHr: 15, wrapRatePerHr: 35, deliveryHrs: 0, deliveryRatePerHr: 45,
    cartonsPerHour: 40,
    pressSetupHrs: 0.125, pressSetupDiff: 0.8,
    baseMakereadyHrsPerPlate: 0.25, makereadyDiff: 1,
    washupHrsPerUnit: 0.25, washupDiff: 1,
    runWastePct: 5, paperBuyRounding: 10,
    runSpeedSph: 0, useSpeedCurve: true, runDiff: 1, wasteFactorPct: 0, helpers: 0,
    solidCoverageSpeed: 8500, heavyCoveragePct: 60, boardCapInches: 0.028, boardCapSpeed: 4100,
    wasteSheetsManual: 0, wastePerColorSheets: 100, wastePerEquipmentSheets: 100, equipmentPassesManual: 0,
    // Mary 8/19: standard 4-color coverage is 6% black and 12% for EACH of
    // C/M/Y (= 36% process), per side. She raises them for heavy coverage.
    inkCoverageBlackPct: 6, inkCoverageColorPct: 36, inkCoverageLedPct: 0, inkCoveragePmsPct: 0, inkCoverageVarnishPct: 0,
    // Ink $/lb DERIVED from Mary's 36 quotes (8/18): black and process both
    // land on $10.84 (26 observations, 10.73-10.85). PMS/spot is a separate
    // cluster at $39.50 -- the old 19.50 default was less than half.
    // Calibrated against #348988's cover at Mary's stated 6%/36% coverage
    // (E&M printed 0.8 lb black + 4.1 lb colour, $53.12). Was a 425 placeholder.
    inkLbsManual: 0, inkFactorMsqinPerLb: 153, inkBlackDollarsPerLb: 10.84, inkDollarsPerLb: 10.84, inkLedDollarsPerLb: 10.84, inkPmsDollarsPerLb: 39.5, varnishDollarsPerLb: 5.5,
    coatingType: "", coatingCoveragePct: 100, coatingIsSpot: false, coatingDollarsPerLb: 0,
    dieCutHrs: 0, scorePerfHrs: 0, dieCost: 0, dieNumber: "", pressCheckHrs: 0,
    digitalInkConfig: "4/4", digitalMakereadySheets: 25,
    digitalOversSheets: 0, digitalVendorAmount: 0, digitalOnPart: false,
    digitalVariableData: false, digitalVDSetupHrs: 0.5,
    binderyOperation: 1, cuttingDiff: 0.5, cutterSheetsPerHr: 5000,
    trimHrs: 0, cutsToFinalSize: 0, cutterHrsManual: 0, cutterLifts: 0, cutterHrsPerLift: 0.0146, cutterDiff: 1.2,
    sheetsPerLift: 500, cutSecPerCut: 8,
    drillHoles: 0, drillDiff: 1, drillHrsPerHole: 0.1,
    folderConfig: "",
    foldSetupHrs: 0, foldRunHrs: 0, folderRatePerHr: 48,
    foldCount: 0, folderSpeedPerHr: 6500, foldDiff: 1, foldWastePct: 0, foldTypeName: "",
    stitcherName: "", stitchSetupHrs: 0, stitchRunHrs: 0, stitchHelpHrs: 0,
    stitchSpeed: 8000, stitchRatePerHr: 95, stitchHelpRatePerHr: 20,
    handOp1: { description: "", piecesPerHour: 0, pctOfQty: 0 },
    handOp2: { description: "", piecesPerHour: 0, pctOfQty: 0 },
    cartons: 0, cartonCost: 0.93, skids: 0, skidCost: 5, packHrs: 0,
    binderyHourlyRate: 65,
    bandIn: "", bandHrs: 0, padIn: "", padHrs: 0, wrapIn: "", wrapHrs: 0,
    bundleRatePerHr: 200, // PLACEHOLDER standard — awaiting Mary's E&M figure

    parts: [],
    additionalCosts: 0, freight: 0, outsidePurchases: [],
    freightInOutside: true, plateDiscount: 0, oneTimeCharges: [],
    binderyOvers: 0, millItemStock: false,
    commissionMode: "pct", commissionFlat: 0, cardSurchargePct: 3,
    deliveryZone: "", quoteNotes: "",
  };
}

/** Fresh part with the same defaults as the flat Screen 6-8 fields. */
export function defaultClassicPart(): ClassicPart {
  const d = defaultClassicForm();
  const part = {} as Record<string, unknown>;
  for (const k of PART_FIELD_KEYS) part[k] = d[k];
  return part as unknown as ClassicPart;
}

// ── Per-part computed detail ─────────────────────────────────────────────
export interface PartCalc {
  pressSheets: number;
  mrWasteSheets: number;
  runWasteSheets: number; // running spoilage (E&M "Press waste") — 5% of net
  orderSheets: number;
  paperCost: number;
  plates: number;
  makereadyHrs: number;
  washupHrs: number;
  runHrs: number;
  dieScoreHrs: number;
  pressCheckHrs: number;
  pressHrs: number;
  inkLbs: number;
  inkCost: number;
  inkLbsBlackColor: number; // black + process (legacy display bucket)
  inkLbsVarnish: number;
  inkLbsBlack: number;
  inkLbsProcess: number;
  inkLbsLed: number;
  inkLbsPms: number;
  coatingLbs: number;
  coatingCost: number;
  speedFactor: number;   // small-run curve factor applied (1 = full rated speed)
  effectiveSph: number;  // min(rated, coverage/board caps) × factor (0 when no speed entered)
  speedCapReason: string; // "" | "solid coverage" | "board thickness" — which cap bound the speed
  plateMaterialsCost: number; // platesUsed × plateCostEach → MATERIAL bucket
  foldHrs: number;            // fold setup + run hours
  foldPieces: number;         // pieces folded (auto or typed)
  foldRunUsed: number;        // run hours actually used
  foldLabor: number;          // fold hrs × folder rate → bindery labor
  stitchRunUsed: number;      // saddle-stitch run hours actually used (auto or typed)
  stitchHrs: number;          // stitch setup + run + help hours
  stitchLabor: number;        // stitch labor → bindery labor
  pressLaborCost: number;     // HOURS × rates only (ink/coating are MATERIAL now)
  pressMaterialsCost: number; // die cost
  pressCost: number;
  digitalTier: 1 | 2 | 3;
  digitalClickRate: number;
  digitalVDRate: number;
  digitalClickSheets: number;
  digitalClickCost: number;
  digitalVDCost: number;
  digitalVDSetupCost: number;
  cutterHrs: number;
  liftsUsed: number;
  drillHrs: number;
  handOp1Hrs: number;
  handOp2Hrs: number;
  binderyHrs: number;
  binderyLabor: number;
  cartonSkidCost: number;
  binderyCost: number;
  paperLbs: number;     // order sheets × lbs-per-M
  cartonsAuto: number;  // ceil(paperLbs / 35) — Mary's 35-lb max rule
  cartonsUsed: number;  // manual override if cartons > 0, else auto
  bandHrsUsed: number;  // auto (bundles ÷ rate) unless manually overridden
  padHrsUsed: number;
  wrapHrsUsed: number;
  trimHrsUsed: number;      // auto from cuts × sec/cut × diff unless overridden
  equipmentPasses: number;  // waste-formula equipment pass count in effect
  cutsAuto: number;         // cuts derived from Screen 6 sheet info (out-of-parent + number-up)
  cutsUsed: number;         // Mary's typed cut count overrides the auto
}

/** Paper + press + bindery math for ONE part at the job quantity.
 *  Formulas identical to the original single-part computeClassic. */
function computePart(
  p: ClassicPart,
  qty: number,
  isDigital: boolean,
  digitalStd: DigitalClickStandards | null,
  speedRules: SpeedRules = DEFAULT_SPEED_RULES
): PartCalc {
  const numberUp = Math.max(1, p.numberUp || 1);

  // ── Paper (Screen 6, waste from Screen 7) ──
  const sheetsPerPiece = Math.max(1, p.sheetsPerPiece || 1);
  // Multi-run part: E&M gives each run its own net sheet count, so the part's
  // press sheets are their sum rather than a single qty-derived figure.
  const runList: PressRun[] = Array.isArray(p.runs) ? p.runs.filter((r) => r && (r.sheets || 0) > 0) : [];
  const multiRun = runList.length > 0;
  const pressSheets = multiRun
    ? runList.reduce((t, r) => t + Math.ceil(r.sheets || 0), 0)
    : Math.ceil((qty * sheetsPerPiece) / numberUp);
  // Cuts to final size — auto-derived from Screen 6's sheet info (Mary 7/20:
  // "cutting should get summed based on the sheet info"). Guillotine cuts for
  // an N-up layout ≈ N + 3 (4 edge trims + strip/cross cuts), plus parent→press
  // separation cuts (out - 1). 1-up straight from a 1-out sheet = no cutting.
  const outOfParentForCuts = Math.max(1, p.sheetsOutOfParent || 1);
  const cutsAuto = (numberUp > 1 || outOfParentForCuts > 1)
    ? (outOfParentForCuts - 1) + numberUp + 3
    : 0;
  const cutsUsed = (p.cutsToFinalSize || 0) > 0 ? p.cutsToFinalSize : cutsAuto;

  // Press waste — Mary's E&M rule (7/20): 100 sheets per color per side +
  // 100 per piece of equipment the job passes through. Passes auto-count from
  // the operations on the job; every knob is editable and a typed waste-sheet
  // count overrides the whole formula.
  const passesAuto =
    ((p.trimHrs || 0) > 0 || cutsUsed > 0 ? 1 : 0) + // cutting
    ((p.dieCutHrs || 0) > 0 ? 1 : 0) +
    ((p.scorePerfHrs || 0) > 0 ? 1 : 0) +
    (p.folderConfig || (p.foldRunHrs || 0) > 0 || p.binderyOperation === 3 ? 1 : 0) + // folding
    ([2, 4, 5, 7].includes(p.binderyOperation) ? 1 : 0) +            // stitch / perfect / multi / CASE bind
    // Mary 8/19: "100 sheets per machine it has to go on after that" — she
    // counts foil, emboss, die cutter and folder/gluer each as a machine. Those
    // ride the hand-bindery op lines, so pick them up by name.
    [p.handOp1, p.handOp2].filter((o) =>
      o && /foil|emboss|glue|glu|diecut|die cut|dc\/|score|crease|laminat|drill|round ?corner/i
        .test(String(o.description || ""))).length;
  const equipmentPasses = (p.equipmentPassesManual || 0) > 0 ? p.equipmentPassesManual : passesAuto;
  const sigRuns = Math.max(1, p.signatureRuns || 1);
  // Press UNITS (validation batch 8/18, #348988 Cover): WORK & TURN runs the
  // same units on both sides, so units count ONCE (max, not side1+side2) —
  // and a coating (varnish/AQ) occupies a press unit that washes up and
  // wastes makeready sheets like ink but needs NO plate. E&M printed
  // "5 Color(s)" and "Wash and Makereadys 5" with only 4 plates, and its 700
  // makeready sheets = 5 units × 100 + 2 equipment passes × 100.
  const unitsForRun = (wt: boolean, c1: number, c2: number) =>
    (wt ? Math.max(c1 || 0, c2 || 0) : (c1 || 0) + (c2 || 0)) + (p.coatingType ? 1 : 0);
  const pressUnits = multiRun
    ? runList.reduce((t, r) => t + ((r.plates || 0) > 0
        ? r.plates + (p.coatingType ? 1 : 0)
        : unitsForRun(r.workAndTurn, r.runColorsSide1, r.runColorsSide2)), 0)
    : unitsForRun(p.workAndTurn, p.runColorsSide1, p.runColorsSide2) * sigRuns;
  const wasteColors = pressUnits;
  const mrWasteSheets = isDigital
    ? Math.ceil(p.digitalMakereadySheets || 0)
    : multiRun
      ? runList.reduce((t, r) => t + Math.ceil(r.makereadySheets || 0), 0)
      : (p.wasteSheetsManual || 0) > 0
        ? Math.ceil(p.wasteSheetsManual)
        : wasteColors * (p.wastePerColorSheets || 0) + equipmentPasses * (p.wastePerEquipmentSheets || 0);
  // Running spoilage — separate from makeready (validation 8/18, #348988):
  // E&M printed "Make ready 700  Press waste 56" where 56 = 5% of the 1,125
  // net press sheets. Makeready is the setup burn; press waste is the running
  // spoilage percentage on top of it.
  // A typed makeready count overrides only the MAKEREADY formula — running
  // spoilage still applies on top, because E&M prints BOTH ("Make ready 1760
  // Press waste 180" on #348988 part 2).
  const runWasteSheets = multiRun
    ? runList.reduce((t, r) => t + Math.ceil((r.sheets || 0) * ((r.runWastePct ?? 5) / 100)), 0)
    : Math.ceil(pressSheets * ((p.runWastePct ?? 5) / 100));

  // Paper buy: press sheets + MR/overs + running spoilage + bindery spoilage,
  // converted to PARENT sheets, then rounded UP to the next 250-sheet
  // increment — E&M never buys an odd count (#348988: 1,881 → 2,000 on the
  // cover, 6,640 → 6,750 on the text). pricePerM is per parent sheet.
  const outOfParent = Math.max(1, p.sheetsOutOfParent || 1);
  const bindWasteTotal = multiRun
    ? runList.reduce((t, r) => t + Math.ceil(r.bindWasteSheets || 0), 0)
    : Math.ceil(p.bindWasteSheets || 0);
  const sheetsToBuy = pressSheets + mrWasteSheets + runWasteSheets + bindWasteTotal;
  const parentSheets = Math.ceil(sheetsToBuy / outOfParent);
  const buyRound = p.paperBuyRounding ?? 250;
  const orderSheets = buyRound > 1 ? Math.ceil(parentSheets / buyRound) * buyRound : parentSheets;
  // A preprinted second pass buys no paper — the sheets are already in-house.
  const paperCost = p.preprintedPass ? 0 : (orderSheets / 1000) * (p.pricePerM || 0);

  // ── Press (Screen 7) ──
  // WORK & TURN (E&M #348538): the same plates print both sides, so plates /
  // washups / makereadys = max(side1, side2). Sheet-wise: 4/4 W&T showed
  // "No. of Wash and Makereadys 4" and 4 plates ($76 @ $19).
  // Plates = INK units only. A coating unit runs on press (see pressUnits
  // above) but carries no plate — #348988 printed 5 units / 4 plates.
  const versionMult = Math.max(1, p.versions || 1);
  const platesForRun = (wt: boolean, c1: number, c2: number) =>
    wt ? Math.max(c1 || 0, c2 || 0) : (c1 || 0) + (c2 || 0);
  const plates = multiRun
    ? runList.reduce((t, r) => t + ((r.plates || 0) > 0
        ? r.plates
        : platesForRun(r.workAndTurn, r.runColorsSide1, r.runColorsSide2)), 0) * versionMult
      + (p.coatingType && p.coatingIsSpot ? runList.length * versionMult : 0)
    : platesForRun(p.workAndTurn, p.runColorsSide1, p.runColorsSide2) * sigRuns * versionMult
      + (p.coatingType && p.coatingIsSpot ? sigRuns * versionMult : 0);
  const plateLaborHrs = plates * (p.plateHrsPerPlate || 0) * (p.plateHrsDiff || 1);
  const plateLaborCost = plateLaborHrs * (p.plateLaborRate || 0);
  const sheetArea = (p.sheetWidthRun || 0) * (p.sheetHeightRun || 0); // sq in

  let makereadyHrs = 0, washupHrs = 0, runHrs = 0, setupHrs = 0;
  let inkLbs = 0, inkCost = 0, inkLbsBlackColor = 0, inkLbsVarnish = 0;
  let inkLbsBlack = 0, inkLbsProcess = 0, inkLbsLed = 0, inkLbsPms = 0;
  let coatingLbs = 0, coatingCost = 0;
  let speedFactor = 1, effectiveSph = 0;
  let speedCapReason = "";
  let pressLaborCost = 0;
  let digitalTier: 1 | 2 | 3 = 1;
  let digitalClickRate = 0, digitalVDRate = 0, digitalClickSheets = 0;
  let digitalClickCost = 0, digitalVDCost = 0, digitalVDSetupCost = 0;
  const dieScoreHrs = (p.dieCutHrs || 0) + (p.scorePerfHrs || 0);
  const pressCheckHrs = p.pressCheckHrs || 0;
  let pressHrs = 0;

  const partDigital = isDigital || !!p.digitalOnPart;
  if (partDigital && digitalStd) {
    // Digital click engine (Mary's tier × ink-config table).
    digitalTier = getDigitalSizeTier(p.sheetWidthRun || 0, p.sheetHeightRun || 0, digitalStd);
    digitalClickRate = getDigitalClickRate(digitalTier, p.digitalInkConfig, digitalStd);
    digitalVDRate = getDigitalVDRate(digitalTier, digitalStd);
    const overs = (p.digitalOversSheets || 0) > 0 ? p.digitalOversSheets : (p.digitalMakereadySheets || 0);
    digitalClickSheets = pressSheets + overs;
    digitalClickCost = (p.digitalVendorAmount || 0) > 0
      ? p.digitalVendorAmount              // vendor's real price wins
      : digitalClickSheets * digitalClickRate;
    if (p.digitalVariableData) {
      digitalVDCost = digitalClickSheets * digitalVDRate;
      digitalVDSetupCost = (p.digitalVDSetupHrs || 0) * (digitalStd.digitalVDSetupRate || 0);
    }
    pressHrs = dieScoreHrs + pressCheckHrs;
    // Carrier-press jobs can still carry a flat ink charge (#349100 envelopes).
    if ((p.inkLbsManual || 0) > 0) {
      inkLbs = p.inkLbsManual;
      inkLbsProcess = inkLbs; inkLbsBlackColor = inkLbs;
      inkCost = inkLbs * (p.inkDollarsPerLb || 0);
    }
    // Clicks are NOT press labor — E&M books digital as an outside purchase
    // (Cybake #347528: Digital 793.80 under Outside at 0%). They land in the
    // outside bucket in computeClassic; press labor is only die/score/check hrs.
    pressLaborCost = pressHrs * (p.pressHourlyRate || 0) + plateLaborCost;
  } else {
    // Makeready/washup follow press UNITS, not plates — the coating unit gets
    // washed and made ready like an ink unit (#348988: "Wash and Makereadys 5"
    // against 4 plates).
    makereadyHrs = (p.baseMakereadyHrsPerPlate || 0) * (p.makereadyDiff || 1) * pressUnits;
    washupHrs = (p.washupHrsPerUnit || 0) * (p.washupDiff || 1) * pressUnits;
    // Small-run speed curve (Mary 7/21): rated SPH derates on short runs —
    // she never hits 10,000/hr on a 500-sheet run. Factors are PLACEHOLDER
    // (see SMALL_RUN_SPEED_CURVE) pending her real speeds.
    speedFactor = p.useSpeedCurve !== false ? smallRunSpeedFactor(pressSheets) : 1;
    // Suggested speed (Mary 7/21): E&M derived run speed from sheets, inks and
    // paper weight. Base = rated, capped by heavy ink coverage and by board
    // thickness (caliper parsed from the stock weight text), then the
    // small-run factor derates short runs.
    const coveragePctForSpeed =
      (p.inkCoverageBlackPct || 0) + (p.inkCoverageColorPct || 0) + (p.inkCoverageLedPct || 0) +
      (p.inkCoveragePmsPct || 0) + (p.inkCoverageVarnishPct || 0) +
      (p.coatingType ? (p.coatingCoveragePct || 0) : 0);
    let baseSph = p.runSpeedSph || 0;
    if (baseSph > 0 && coveragePctForSpeed >= (speedRules.heavyCoveragePct || Infinity) && speedRules.solidCoverageSpeed > 0) {
      if (speedRules.solidCoverageSpeed < baseSph) { baseSph = speedRules.solidCoverageSpeed; speedCapReason = "solid coverage"; }
    }
    const caliperIn = parseCaliperInches(p.caliperBasisWeight);
    if (baseSph > 0 && caliperIn >= (speedRules.boardCapInches || Infinity) && speedRules.boardCapSpeed > 0) {
      if (speedRules.boardCapSpeed < baseSph) { baseSph = speedRules.boardCapSpeed; speedCapReason = "board thickness"; }
    }
    effectiveSph = baseSph * speedFactor;
    // Sheets that actually go THROUGH the press = net + makeready + running
    // spoilage, and every unit-side is a pass (validation 8/18, #348988:
    // 1,125 + 700 + 56 = 1,881; 1,881/6,500 = 0.29 → E&M's printed 0.3 hrs
    // per side, twice for the two W&T sides).
    const sheetsThroughPress = pressSheets + mrWasteSheets + runWasteSheets;
    // Passes = SIDES only. Signature runs must NOT multiply here: the sheet
    // count (qty x sheetsPerPiece / numberUp) already covers every signature,
    // so scaling by sigRuns again double-counts the run (caught on #348228,
    // the 216-page 27-run magazine). sigRuns still scales PLATES.
    const runPasses =
      (((p.runColorsSide1 || 0) > 0 ? 1 : 0) + ((p.runColorsSide2 || 0) > 0 ? 1 : 0)) || 1;
    if (multiRun) {
      // Each run carries its own sheets, speed, sides and difficulty.
      const passesFor = (_wt: boolean, c1: number, c2: number) =>
        (((c1 || 0) > 0 ? 1 : 0) + ((c2 || 0) > 0 ? 1 : 0)) || 1;
      runHrs = runList.reduce((t, r) => {
        const thru = Math.ceil(r.sheets || 0)
          + Math.ceil(r.makereadySheets || 0)
          + Math.ceil((r.sheets || 0) * ((r.runWastePct ?? 5) / 100));
        const sph = (r.runSpeedSph || 0) > 0 ? r.runSpeedSph : effectiveSph;
        if (!sph) return t;
        return t + ((thru * passesFor(r.workAndTurn, r.runColorsSide1, r.runColorsSide2)) / sph) * (r.runDiff || 1);
      }, 0);
    } else {
      runHrs = effectiveSph > 0 ? ((sheetsThroughPress * runPasses) / effectiveSph) * (p.runDiff || 1) : 0;
    }
    setupHrs = (p.pressSetupHrs || 0) * (p.pressSetupDiff ?? 1);
    pressHrs = setupHrs + makereadyHrs + washupHrs + runHrs + dieScoreHrs + pressCheckHrs;
    // Ink: press sheets × sheet area × coverage% ÷ (thousand sq-in per lb),
    // PER TYPE like E&M ("7.3 lbs black + 56.5 lbs color") — varnish prices at
    // its own $/lb ($5.50 std), not ink money (Mary 7/21).
    // Ink is consumed per IMPRESSION — a sheet printed both sides takes twice
    // the ink of a 1-sided one (validation 8/18, #348988: our 1-sided figure
    // came out at exactly half E&M's printed 0.8 lb black / 4.1 lb color).
    // Every sheet that goes through the press takes ink -- makeready and
    // spoilage included, not just the good sheets (Mary 8/19).
    const inkImpressions = (pressSheets + mrWasteSheets + runWasteSheets) * Math.max(1, runPasses);
    const lbsFor = (pct: number) => p.inkFactorMsqinPerLb > 0
      ? (inkImpressions * sheetArea * ((pct || 0) / 100)) / (p.inkFactorMsqinPerLb * 1000)
      : 0;
    inkLbsBlack = lbsFor(p.inkCoverageBlackPct || 0);
    inkLbsProcess = lbsFor(p.inkCoverageColorPct || 0);
    inkLbsLed = lbsFor(p.inkCoverageLedPct || 0);
    inkLbsPms = lbsFor(p.inkCoveragePmsPct || 0);
    inkLbsBlackColor = inkLbsBlack + inkLbsProcess; // legacy display bucket
    inkLbsVarnish = lbsFor(p.inkCoverageVarnishPct || 0);
    inkLbs = inkLbsBlack + inkLbsProcess + inkLbsLed + inkLbsPms + inkLbsVarnish;
    if ((p.inkLbsManual || 0) > 0) {
      // Typed pounds replace the coverage model entirely; price them as
      // process ink unless PMS coverage was the only thing entered.
      const onlyPms = (p.inkCoveragePmsPct || 0) > 0 && (p.inkCoverageColorPct || 0) === 0 && (p.inkCoverageBlackPct || 0) === 0;
      inkLbs = p.inkLbsManual;
      inkLbsBlack = 0; inkLbsProcess = onlyPms ? 0 : inkLbs; inkLbsPms = onlyPms ? inkLbs : 0;
      inkLbsLed = 0; inkLbsVarnish = 0; inkLbsBlackColor = inkLbsProcess;
    }
    inkCost =
      inkLbsBlack * (p.inkBlackDollarsPerLb || 0) +
      inkLbsProcess * (p.inkDollarsPerLb || 0) +
      inkLbsLed * (p.inkLedDollarsPerLb || 0) +
      inkLbsPms * (p.inkPmsDollarsPerLb || 0) +
      inkLbsVarnish * (p.varnishDollarsPerLb || 0);
    // Coating/Aqueous (Mary 7/21): same coverage model as ink, its own $/lb.
    if (p.coatingType && p.inkFactorMsqinPerLb > 0) {
      coatingLbs = (pressSheets * sheetArea * ((p.coatingCoveragePct || 0) / 100)) / (p.inkFactorMsqinPerLb * 1000);
      coatingCost = coatingLbs * (p.coatingDollarsPerLb || 0);
    }
    // BUCKET RESTRUCTURE (E&M #348538): press labor is HOURS × rates only.
    // Ink and coating are MATERIALS — they ride the Material bucket at
    // Material markup in computeClassic, not the Labor line.
    pressLaborCost =
      pressHrs * (p.pressHourlyRate || 0) +
      pressHrs * (p.helpers || 0) * (p.helperHourlyRate || 0);
  }
  // Plate materials (offset only): W&T-aware plate count × $/plate → MATERIAL.
  const plateMaterialsCost = isDigital ? 0 : plates * (p.plateCostEach || 0);
  const pressMaterialsCost = p.dieCost || 0;
  const pressCost = pressLaborCost + pressMaterialsCost;

  // ── Bindery (Screen 8) ──
  // Lifts-driven, the way E&M did it (validated to the cent on 7 quotes).
  // No paper bought (all-outside job, phantom carrier) -> nothing to cut.
  // Without this the 1-lift minimum billed ~$0.79 of cutter on every fully
  // outsourced poster (hand-key tranche 1).
  const liftsAuto = (p.sheetsPerLift || 0) > 0 && (p.pricePerM || 0) > 0
    ? Math.ceil(orderSheets / p.sheetsPerLift) : 0;
  const liftsUsed = (p.cutterLifts || 0) > 0 ? p.cutterLifts : liftsAuto;
  const cutterHrs = liftsUsed * (p.cutterHrsPerLift || 0) * (p.cutterDiff || 1);
  const cutterHrsUsed = (p.cutterHrsManual || 0) > 0 ? p.cutterHrsManual : cutterHrs;
  const drillHrs = (p.drillHoles || 0) * (p.drillHrsPerHole || 0) * (p.drillDiff || 1);
  const op1 = p.handOp1, op2 = p.handOp2;
  // A typed hours value wins over the qty/rate derivation — E&M's hand-bindery
  // lines are flat 0.1-hr tokens naming the operation (validation 8/18).
  const handOp1Hrs = (op1.hours || 0) > 0 ? (op1.hours as number)
    : (op1.piecesPerHour > 0 ? (qty * (op1.pctOfQty || 0)) / 100 / op1.piecesPerHour : 0);
  const handOp2Hrs = (op2.hours || 0) > 0 ? (op2.hours as number)
    : (op2.piecesPerHour > 0 ? (qty * (op2.pctOfQty || 0)) / 100 / op2.piecesPerHour : 0);
  // Band/Pad/Wrap: "In" = pieces per bundle → bundles = ceil(qty / in);
  // auto hrs = bundles ÷ bundle rate; a typed Hrs value overrides (0 = auto).
  const perBundle = (s: string) => parseFloat(String(s || "").replace(/[^0-9.]/g, "")) || 0;
  const rate = p.bundleRatePerHr || 0;
  const opHrs = (inStr: string, manual: number) => {
    if (manual > 0) return manual;
    const size = perBundle(inStr);
    return size > 0 && rate > 0 ? Math.ceil(qty / size) / rate : 0;
  };
  const bandHrsUsed = opHrs(p.bandIn, p.bandHrs || 0);
  // Padding runs on its OWN standard, not the generic bundle rate: E&M is a
  // clean 500 pads/hr at $18/hr across the forms/notepad quotes (derived 8/18).
  const padHrsUsed = (() => {
    if ((p.padHrs || 0) > 0) return p.padHrs;
    const perPad = perBundle(p.padIn);
    const padRate = (p.padsPerHour || 0) > 0 ? p.padsPerHour : rate;
    return perPad > 0 && padRate > 0 ? Math.ceil(qty / perPad) / padRate : 0;
  })();
  const wrapHrsUsed = opHrs(p.wrapIn, p.wrapHrs || 0);
  // Trim-to-size: E&M computed it once the difficulty was entered (Mary 7/20).
  // Auto = lifts × cuts (from Screen 6 sheet info, or her override) × sec/cut
  // × cutting diff; typed hours override everything.
  const trimAuto = cutsUsed > 0
    ? (Math.ceil(pressSheets / Math.max(1, p.sheetsPerLift || 500)) * cutsUsed * (p.cutSecPerCut || 8) / 3600) * (p.cuttingDiff || 1)
    : 0;
  const trimHrsUsed = (p.trimHrs || 0) > 0 ? p.trimHrs : trimAuto;
  // Folding is its own machine line at the folder rate (E&M #348538:
  // 0.6 setup + 1.4 run @ ~$48 = 30.00 + 67.25).
  // Folding: E&M prints "1 Fold Setup (Fold 10000)" then "Folding 0.8 Hrs
  // (0.9) on the baum-26x40" -- it computed the run from the piece count and
  // the folder's speed. Do the same so Mary enters the JOB, not the hours.
  const foldPieces = (p.foldCount || 0) > 0
    ? p.foldCount
    : qty * Math.max(1, p.sheetsPerPiece || 1);
  const foldRunAuto = (p.folderSpeedPerHr || 0) > 0
    ? ((foldPieces * (1 + (p.foldWastePct || 0) / 100)) / p.folderSpeedPerHr) * (p.foldDiff || 1)
    : 0;
  const foldRunUsed = (p.foldRunHrs || 0) > 0 ? p.foldRunHrs : foldRunAuto;
  const foldActive = (p.foldSetupHrs || 0) > 0 || (p.foldRunHrs || 0) > 0
    || !!p.folderConfig || p.binderyOperation === 3;
  const foldHrs = foldActive ? (p.foldSetupHrs || 0) + foldRunUsed : 0;
  const foldLabor = foldHrs * (p.folderRatePerHr || 0);
  // Saddle stitching (Mueller) as its own machine line — E&M #348975 charges
  // Setup + Mueller run + Help. Run auto-computes from the finished piece
  // count and the stitcher speed; a typed Run value overrides. Setup + run at
  // the stitcher rate ($95), help at the hand-bindery rate. Missing before, so
  // picking "Saddle" as the operation added nothing (Mary 8/10).
  // Stitch is only "on" when the operation actually stitches (Saddle / Perfect
  // / Multibind) OR Mary has typed any stitch hours. Otherwise a flat job would
  // silently pick up auto run hours from qty ÷ speed and be charged phantom
  // stitch labor.
  const stitchActive = [2, 4, 5].includes(p.binderyOperation)
    || (p.stitchSetupHrs || 0) > 0 || (p.stitchRunHrs || 0) > 0 || (p.stitchHelpHrs || 0) > 0;
  const stitchRunAuto = (p.stitchSpeed || 0) > 0 ? qty / p.stitchSpeed : 0;
  const stitchRunUsed = !stitchActive ? 0 : ((p.stitchRunHrs || 0) > 0 ? p.stitchRunHrs : stitchRunAuto);
  const stitchMachineHrs = stitchActive ? (p.stitchSetupHrs || 0) + stitchRunUsed : 0;
  const stitchHelpHrs = stitchActive ? (p.stitchHelpHrs || 0) : 0;
  const stitchHrs = stitchMachineHrs + stitchHelpHrs;
  const stitchLabor = stitchMachineHrs * (p.stitchRatePerHr || 0) + stitchHelpHrs * (p.stitchHelpRatePerHr || 0);
  // Paper handling rides with the paper block on E&M's sheet but is LABOR
  // (#348988: "Paper handling 0.1 Hrs" turns paper 337.50 into 340.17).
  // Cartons/skids are E&M MATERIAL (18% line on Cybake #347528), not bindery
  // labor. Cartons auto-compute from paper weight at Mary's 35-lb rule; a
  // preprinted re-pass boxes nothing (the paper was already counted).
  const paperLbs = p.preprintedPass ? 0 : (orderSheets / 1000) * (p.weightPerMSheets || 0);
  const cartonsAuto = paperLbs > 0 ? Math.ceil(paperLbs / 35) : 0;
  const cartonsUsed = (p.cartons || 0) > 0 ? p.cartons : cartonsAuto;
  const cartonSkidCost = cartonsUsed * (p.cartonCost || 0) + (p.skids || 0) * (p.skidCost || 0);
  // Carton PACKING labor auto-derives at ~40 cartons/hr (clean fit across 13
  // estimates, 4 to 2,735 cartons); a typed packHrs overrides.
  const packHrsUsed = (p.packHrs || 0) > 0
    ? p.packHrs
    : ((p.cartonsPerHour || 0) > 0 ? cartonsUsed / p.cartonsPerHour : 0);
  const paperHandlingCost = (p.paperHandlingHrs || 0) * (p.paperHandlingRate || 0);
  const deliveryHrs = p.deliveryHrs || 0;
  // Each bindery machine bills at its OWN rate in E&M (validation 8/18):
  // Load Cutter $46, Trim $44, Ctn Pack $15, Wrap $35, Hand Bind $18.80,
  // Delivery $45. Anything without a specific rate falls back to the part's
  // general bindery rate.
  const opRate = (r: number | undefined) => (r && r > 0 ? r : (p.binderyHourlyRate || 0));
  const opLabor =
    cutterHrsUsed * opRate(p.cutterRatePerHr) +
    trimHrsUsed * opRate(p.trimRatePerHr) +
    drillHrs * (p.binderyHourlyRate || 0) +
    handOp1Hrs * opRate(p.handOp1?.ratePerHr ?? p.handBindRatePerHr) +
    handOp2Hrs * opRate(p.handOp2?.ratePerHr ?? p.handBindRatePerHr) +
    packHrsUsed * opRate(p.packRatePerHr) +
    bandHrsUsed * (p.binderyHourlyRate || 0) +
    padHrsUsed * opRate(p.padRatePerHr) +
    wrapHrsUsed * opRate(p.wrapRatePerHr) +
    deliveryHrs * opRate(p.deliveryRatePerHr);
  const binderyHrs = cutterHrsUsed + trimHrsUsed + drillHrs + handOp1Hrs + handOp2Hrs
    + packHrsUsed + bandHrsUsed + padHrsUsed + wrapHrsUsed + deliveryHrs
    + foldHrs + stitchHrs + (p.paperHandlingHrs || 0);
  const binderyLabor = opLabor + foldLabor + stitchLabor + paperHandlingCost;
  const binderyCost = binderyLabor;

  return {
    pressSheets, mrWasteSheets, runWasteSheets, orderSheets, paperCost,
    plates, makereadyHrs, washupHrs, runHrs, dieScoreHrs, pressCheckHrs, pressHrs,
    inkLbs, inkCost, inkLbsBlackColor, inkLbsVarnish, inkLbsBlack, inkLbsProcess, inkLbsLed, inkLbsPms, coatingLbs, coatingCost, speedFactor, effectiveSph, speedCapReason,
    plateMaterialsCost, foldHrs, foldPieces, foldRunUsed, foldLabor, stitchRunUsed, stitchHrs, stitchLabor,
    pressLaborCost, pressMaterialsCost, pressCost,
    digitalTier, digitalClickRate, digitalVDRate, digitalClickSheets,
    digitalClickCost, digitalVDCost, digitalVDSetupCost,
    cutterHrs, liftsUsed, drillHrs, handOp1Hrs, handOp2Hrs, binderyHrs, binderyLabor,
    cartonSkidCost, binderyCost,
    paperLbs, cartonsAuto, cartonsUsed,
    bandHrsUsed, padHrsUsed, wrapHrsUsed,
    trimHrsUsed, equipmentPasses,
    cutsAuto, cutsUsed,
  };
}

export interface ClassicCalc {
  isDigital: boolean;

  // Per-part detail (index 0 = part 1 / flat fields)
  partCalcs: PartCalc[];

  // Paper (sums across parts)
  pressSheets: number;
  mrWasteSheets: number;
  orderSheets: number;
  paperCost: number;
  paperSelling: number;

  // MATERIAL bucket (E&M #348538 restructure): prep materials (proofs/scans)
  // + cartons/skids + INK + COATING + PLATES — sold at Material markup.
  // prepCost/prepSelling are kept as aliases of the material bucket so older
  // callers keep working. Prep LABOR sells at Labor markup (own line).
  prepHours: number;
  prepLabor: number;
  prepLaborSelling: number;
  prepMaterials: number;       // Screen 4/5 materials + cartons (no ink/coating/plates)
  materialCost: number;        // full material bucket
  materialSelling: number;
  plateMaterialsCost: number;  // plates portion of the material bucket
  prepCost: number;            // alias of materialCost
  prepSelling: number;         // alias of materialSelling

  // Press (sums across parts) — sold at Labor markup
  plates: number;
  makereadyHrs: number;
  washupHrs: number;
  runHrs: number;
  dieScoreHrs: number;
  pressCheckHrs: number;
  pressHrs: number;
  inkLbs: number;
  inkCost: number;
  coatingLbs: number;
  coatingCost: number;
  pressLaborCost: number;
  pressMaterialsCost: number; // die cost
  pressCost: number;
  pressSelling: number;
  // digital detail (rate/tier from part 1; sheet/cost figures summed)
  digitalTier: 1 | 2 | 3;
  digitalClickRate: number;
  digitalVDRate: number;
  digitalClickSheets: number;
  digitalClickCost: number;
  digitalVDCost: number;
  digitalVDSetupCost: number;

  // Bindery (sums across parts) — sold at Labor markup
  cutterHrs: number;
  drillHrs: number;
  handOp1Hrs: number;
  handOp2Hrs: number;
  foldHrs: number;
  foldLabor: number;
  stitchRunUsed: number;
  stitchHrs: number;
  stitchLabor: number;
  binderyHrs: number;
  binderyLabor: number;
  cartonSkidCost: number;
  binderyCost: number;
  binderySelling: number;

  // Outside — sold at Outside markup
  outsideCost: number;
  outsideSelling: number;
  outsideToddCost: number;   // in-house finishing (Todd) portion — real C&D cost
  outsideVendorCost: number; // true outsourced portion (incl. digital clicks)

  // Pass-through (+$1 minimum on the selling side when nonzero — E&M
  // #348538: freight 46.17 → 47.17)
  freightAndAdditional: number;
  freightSelling: number;

  totalCost: number;
  sellingSubtotal: number;
  commission: number;
  total: number;
  costPerUnit: number;
  costPerM: number;
}

/** Resolve the effective part list: part 1 = flat fields, parts 2..N merged
 *  over part defaults (so partially-filled or legacy data can't crash). */
export function effectiveParts(f: ClassicForm): ClassicPart[] {
  const numParts = Math.max(1, Math.floor(f.numParts || 1));
  const extras = Array.isArray(f.parts) ? f.parts : [];
  const list: ClassicPart[] = [f];
  for (let i = 1; i < numParts; i++) {
    list.push({ ...defaultClassicPart(), ...(extras[i - 1] || {}) });
  }
  return list;
}

export function computeClassic(
  f: ClassicForm,
  digitalStd: DigitalClickStandards | null
): ClassicCalc {
  const isDigital = f.jobType === "Digital Direct";
  // A bindery vendor's required overs get PRINTED but are not billed as extra
  // pieces (E&M #343786: "5 overs in Bindtech price"). They lift the press
  // quantity only; per-unit pricing still divides by the customer's quantity.
  const billQty = Math.max(0, f.quantity || 0);
  const qty = billQty + Math.max(0, f.binderyOvers || 0);

  const speedRules: SpeedRules = {
    solidCoverageSpeed: f.solidCoverageSpeed ?? DEFAULT_SPEED_RULES.solidCoverageSpeed,
    heavyCoveragePct: f.heavyCoveragePct ?? DEFAULT_SPEED_RULES.heavyCoveragePct,
    boardCapInches: f.boardCapInches ?? DEFAULT_SPEED_RULES.boardCapInches,
    boardCapSpeed: f.boardCapSpeed ?? DEFAULT_SPEED_RULES.boardCapSpeed,
  };
  const partCalcs = effectiveParts(f).map((p) => computePart(p, qty, isDigital, digitalStd, speedRules));
  const sum = (get: (c: PartCalc) => number) => partCalcs.reduce((s, c) => s + get(c), 0);
  const p1 = partCalcs[0];

  // ── Paper (summed across parts) ──
  const pressSheets = sum((c) => c.pressSheets);
  const mrWasteSheets = sum((c) => c.mrWasteSheets);
  const orderSheets = sum((c) => c.orderSheets);
  const paperCost = sum((c) => c.paperCost);

  // ── Prep = Electronic Prepress (4) + Camera/Stripping/Platemaking (5) — job-level ──
  const prepHours = (f.designHours || 0) + (f.photoshopHours || 0) + (f.typeOutputHrs || 0);
  // Type/Output can bill at its own rate; the rest ride the prepress rate.
  const prepLabor =
    ((f.designHours || 0) + (f.photoshopHours || 0)) * (f.prepressRate || 0)
    + (f.typeOutputHrs || 0) * (f.typeOutputRate || f.prepressRate || 0);
  const totalPlates = partCalcs.reduce((t, c) => t + (c.plates || 0), 0);
  const proofByPlate = (f.proofMaterialPerPlate || 0) > 0
    ? totalPlates * f.proofMaterialPerPlate
    : 0;
  const prepMaterials =
    proofByPlate +
    (f.scans85x11 || 0) * (f.scanCharge85x11 || 0) +
    (f.scans11x17 || 0) * (f.scanCharge11x17 || 0) +
    (f.scans20x25 || 0) * (f.scanCharge20x25 || 0) +
    (f.furnishedDisks || 0) * (f.furnishedDiskCharge || 0) +
    (f.laserProofs || 0) * (f.laserProofCharge || 0) +
    (f.colorProofs || 0) * (f.colorProofCharge || 0) +
    ((f.dyluxProofs || 0) * (f.dyluxCharge || 0) +
      (f.matchprintProofs || 0) * (f.matchprintCharge || 0) +
      (f.separations || 0) * (f.separationCharge || 0)) *
      (f.plateDiffFactor || 1);

  // ── Press (summed) ──
  const pressLaborCost = sum((c) => c.pressLaborCost);
  const pressMaterialsCost = sum((c) => c.pressMaterialsCost);
  const pressCost = pressLaborCost + pressMaterialsCost;
  const inkCost = sum((c) => c.inkCost);

  // ── Bindery (summed) ──
  const binderyLabor = sum((c) => c.binderyLabor);
  const cartonSkidCost = sum((c) => c.cartonSkidCost);
  const binderyCost = binderyLabor;

  // ── MATERIAL bucket (E&M #348538): prep materials + cartons + ink +
  // coating + plates. Labor (prep/press/bindery hours) sells separately. ──
  const coatingCost = sum((c) => c.coatingCost);
  const plateMaterialsCost = sum((c) => c.plateMaterialsCost);
  const materialCost = prepMaterials + cartonSkidCost + inkCost + coatingCost + plateMaterialsCost;

  // ── Outside / pass-through (Screen 9) ──
  const digitalClickTotal = sum((c) => c.digitalClickCost + c.digitalVDCost + c.digitalVDSetupCost);
  // Outside services (Mary 7/21): per-M rows scale with the quoted quantity
  // (so quantity tiers each get their own outside cost) and +3% adds her
  // handling upcharge. Legacy rows without the keys = flat, no upcharge.
  // Digital clicks are added AFTER this reduce — they never get the 3%.
  const tierIdx = f.activeTierIndex || 0;
  let outsideToddCost = 0, outsideVendorCost = 0;
  // rows carrying their own markup %, grouped so each group marks up separately
  const rowGroups = new Map<number, number>();
  for (const p of f.outsidePurchases) {
    // Per-tier vendor price when one is entered for this tier; else primary.
    const tierAmt = tierIdx > 0 && Array.isArray(p.amountsByTier) && (Number(p.amountsByTier[tierIdx - 1]) || 0) > 0
      ? Number(p.amountsByTier[tierIdx - 1])
      : Number(p.amount) || 0;
    const base = p.per === "perM" ? (tierAmt * qty) / 1000 : tierAmt;
    const rowCost = base * (p.plus3 ? 1.03 : 1);
    if (p.source === "todd") outsideToddCost += rowCost; else outsideVendorCost += rowCost;
    if (p.markupPct !== undefined && p.markupPct !== null) {
      rowGroups.set(p.markupPct, (rowGroups.get(p.markupPct) || 0) + rowCost);
    }
  }
  // Cost sitting in an explicit per-row group is billed by that group, so it
  // must not also ride the job-default outside markup.
  const rowGroupCost = Array.from(rowGroups.values()).reduce((t, v) => t + v, 0);
  const outsidePurchaseCost = outsideToddCost + outsideVendorCost;
  // Freight rides the OUTSIDE bucket (and takes outside markup) unless turned
  // off; the plate discount comes off the outside base BEFORE markup.
  const freightInOutside = f.freightInOutside !== false;
  const outsideFreight = freightInOutside ? (f.freight || 0) : 0;
  // Marked-up portion of the outside bucket: purchase rows and clicks, less
  // the plate discount. FREIGHT sits in the bucket but rides at COST — E&M
  // marks up only the purchase rows (verified on 10 estimates, 8/18).
  const outsideMarkable = Math.max(0,
    outsidePurchaseCost - rowGroupCost + digitalClickTotal - (f.plateDiscount || 0));
  // COST carries every outside dollar — including rows with their own markup
  // %. (Hand-key tranche 1 caught rowGroupCost silently dropping out of total
  // cost and the commission base on every digital job.)
  const outsideCost = outsideMarkable + rowGroupCost + outsideFreight;
  const freightAndAdditional = (freightInOutside ? 0 : (f.freight || 0)) + (f.additionalCosts || 0);

  // ── Sellings (E&M cost sheet) ──
  // E&M charges a $1 minimum markup on any nonzero cost line (Cybake #347528:
  // Outside 843.80 at 0% still shows +1.00).
  // E&M applies the $1 floor even to a ZERO-cost bucket — #348988's cover
  // prints Outside 0.00 with a 1.00 markup (validation 8/18).
  // Applied only once the job actually has cost — E&M charges the $1 floor on
  // a zero bucket INSIDE a real quote (#348988 prints Outside 0.00 -> 1.00),
  // but a blank estimate is $0.00, not $5.00 worth of minimums.
  const anyCost =
    paperCost + materialCost + prepLabor + pressCost + binderyCost + outsideCost + freightAndAdditional > 0;
  const mk = (cost: number, pct: number) =>
    anyCost ? cost + Math.max((cost * (pct || 0)) / 100, 1) : 0;
  const paperSelling = mk(paperCost, f.markupPaperPct);
  const materialSelling = mk(materialCost, f.markupMaterialPct);
  // Prep LABOR sells at the Labor markup (E&M #348538: all hours ride the
  // 40% labor line, not the material line).
  // E&M sells FOUR buckets: Paper, Material, Outside, Labor — prep, press and
  // bindery are all one LABOR line. Selling them separately triple-charged the
  // $1 zero-bucket minimum (+$2 flat on every all-outside poster, hand-key
  // tranche 1). One mk() over the summed labor cost, split back pro-rata for
  // display.
  const laborCost = prepLabor + pressCost + binderyCost;
  const laborSelling = mk(laborCost, f.markupLaborPct);
  const laborShare = (part: number) => (laborCost > 0 ? laborSelling * (part / laborCost) : (part === 0 ? 0 : part));
  const prepLaborSelling = laborCost > 0 ? laborShare(prepLabor) : laborSelling; // zero labor -> the $1 min rides prep's line
  const pressSelling = laborShare(pressCost);
  const binderySelling = laborShare(binderyCost);
  const outsideSelling =
    mk(outsideMarkable, f.markupOutsidePct)
    + Array.from(rowGroups.entries()).reduce((t, [pct, cost]) => t + mk(cost, pct), 0)
    + outsideFreight;
  // Freight/additional: pass-through plus E&M's $1 minimum when nonzero
  // (#348538: 46.17 → 47.17).
  const freightSelling = freightAndAdditional > 0 ? freightAndAdditional + 1 : 0;

  const totalCost = paperCost + materialCost + prepLabor + pressCost + binderyCost + outsideCost + freightAndAdditional;
  // Commission is % of total COST, not of selling — verified against Cybake
  // #347528 (117.33 = 10% × 1,173.28) — added on top like a markup line.
  const commission =
    f.commissionMode === "none" ? 0
    : f.commissionMode === "flat" ? (f.commissionFlat || 0)
    : totalCost * ((f.commissionPct || 0) / 100);
  const sellingSubtotal =
    paperSelling + materialSelling + laborSelling + outsideSelling + freightSelling;
  const total = sellingSubtotal + commission;

  return {
    isDigital,
    partCalcs,
    pressSheets, mrWasteSheets, orderSheets, paperCost, paperSelling,
    prepHours, prepLabor, prepLaborSelling,
    prepMaterials: prepMaterials + cartonSkidCost,
    materialCost, materialSelling, plateMaterialsCost,
    prepCost: materialCost,
    prepSelling: materialSelling,
    plates: sum((c) => c.plates),
    makereadyHrs: sum((c) => c.makereadyHrs),
    washupHrs: sum((c) => c.washupHrs),
    runHrs: sum((c) => c.runHrs),
    dieScoreHrs: sum((c) => c.dieScoreHrs),
    pressCheckHrs: sum((c) => c.pressCheckHrs),
    pressHrs: sum((c) => c.pressHrs),
    inkLbs: sum((c) => c.inkLbs),
    inkCost,
    coatingLbs: sum((c) => c.coatingLbs),
    coatingCost,
    pressLaborCost, pressMaterialsCost, pressCost, pressSelling,
    digitalTier: p1.digitalTier,
    digitalClickRate: p1.digitalClickRate,
    digitalVDRate: p1.digitalVDRate,
    digitalClickSheets: sum((c) => c.digitalClickSheets),
    digitalClickCost: sum((c) => c.digitalClickCost),
    digitalVDCost: sum((c) => c.digitalVDCost),
    digitalVDSetupCost: sum((c) => c.digitalVDSetupCost),
    cutterHrs: sum((c) => c.cutterHrs),
    drillHrs: sum((c) => c.drillHrs),
    handOp1Hrs: sum((c) => c.handOp1Hrs),
    handOp2Hrs: sum((c) => c.handOp2Hrs),
    foldHrs: sum((c) => c.foldHrs),
    foldLabor: sum((c) => c.foldLabor),
    stitchRunUsed: sum((c) => c.stitchRunUsed),
    stitchHrs: sum((c) => c.stitchHrs),
    stitchLabor: sum((c) => c.stitchLabor),
    binderyHrs: sum((c) => c.binderyHrs),
    binderyLabor, cartonSkidCost, binderyCost, binderySelling,
    outsideCost, outsideSelling,
    outsideToddCost,
    outsideVendorCost: outsideVendorCost + digitalClickTotal,
    freightAndAdditional, freightSelling,
    totalCost, sellingSubtotal, commission, total,
    costPerUnit: billQty > 0 ? total / billQty : 0,
    costPerM: billQty > 0 ? (total / billQty) * 1000 : 0,
  };
}

// ── Quantity tiers (E&M quotes multiple quantities per estimate) ─────────
export interface QuantityBreak {
  quantity: number;
  total: number;
  costPerUnit: number;
  costPer1000: number;
}

/** Re-run the whole estimate at each quantity (primary first). Everything
 *  else stays as entered — fixed MR/overs sheets stay fixed; %-driven waste
 *  and per-piece sheets scale naturally. */
export function computeQuantityBreaks(
  f: ClassicForm,
  digitalStd: DigitalClickStandards | null
): QuantityBreak[] {
  const qtys = [
    f.quantity || 0,
    ...(Array.isArray(f.additionalQuantities) ? f.additionalQuantities : []).map((q) => Number(q) || 0).filter((q) => q > 0),
  ];
  return qtys.map((q, i) => {
    const c = computeClassic({ ...f, quantity: q, activeTierIndex: i }, digitalStd);
    return { quantity: q, total: c.total, costPerUnit: c.costPerUnit, costPer1000: c.costPerM };
  });
}
