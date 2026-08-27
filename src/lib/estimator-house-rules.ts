// C&D house estimating rules -- shared by the estimator assistant and the
// save-time sanity checker so both explain the same engine behavior.
export const HOUSE_RULES = `
C&D house estimating rules (all already built into the engine):
- Makeready sheets: 100 per color and coating per side, plus 100 per machine
  the job passes through after the press (cutter, folder, die cutter, foil,
  emboss, gluer, stitcher/binder). Editable per job.
- Work & Turn: same plates print both sides, so plates/washups count once.
- Plates = sides x ink colors. SPOT coating needs a plate; flood does not.
- Ink: 6% black coverage, 12% per process color (36% for 4c), per side, on
  every sheet through the press including makeready.
- Folding: pick the Fold Type; run hours = pieces x (1 + waste%) / folder
  speed, plus setup. The Baum-26x40 runs ~6,500/hr.
- Load cutter is lifts-driven: lifts x 0.0146 hr x difficulty at $45/hr.
- Paper buy rounds up (usually to 10 sheets; some jobs 250).
- Die charges for NEW dies go under One-Time Charges (they print on the letter
  but stay out of the price). An existing die number pulls from the die
  inventory and needs no charge.
- Digital work is priced as clicks/outside purchase, not press hours.
- Freight sits in the outside bucket at cost (no markup on freight).
- Markups default Paper 33 / Material 18 / Outside 32 / Labor 40, commission
  10% — all editable per quote.
- Booklets: entering pages + finished size + sheet size + colors makes a
  green "Booklet plan" panel appear on Screen 7 that computes the signature
  breakdown itself (e.g. 12pg 8.5x11 on 19x25 = one 8pg sig sheetwise + one
  4pg sig W&T 2-out, 12 plates) — "Apply plan" fills the press runs.
- Press speed adjusts by stock automatically when a stock is picked from the
  caliper lookup: 12,000 standard, 9,000 on 50# uncoated, 11,500 on 18pt
  C1S, 9,500 on 24-32pt board (Darrin's numbers). Always editable.
- "No Cutting" and "No Cartons" checkboxes on Screen 8 mean NONE — typing 0
  in those boxes means AUTO, not none.
- Proof material is per part: part 1's proofs live on Screen 4/5, parts 2+
  each have their own proof lines on the Press screen.
- The only two offset presses are the Komori LSX629 LED UV #0172 and
  Conventional #0153; digital runs on the two Konica Minolta AccurioPress 7100s (C7100-1 / C7100-2), billed as clicks.
- Size fields accept E&M-style fractions ("8 7/16") or decimals.
- "Extra Plates" on the press screen = E&M's field for version plate
  changes/re-burns: adds plate material + platemaking labor, not makeready.
- Scans (8.5x11 / 11x17 / 20x25) are on the prepress screen; proofs are
  labeled with E&M's names (Sherpa2 = laser, Sherpa43 = color).
- Imposition: best number-up auto-computes on Screen 6 from flat size +
  press sheet + 1/16 bleed, deducting the Komori gripper (0.75, lead edge)
  and side guide (0.125): usable = (sheetW - 0.75) x (sheetH - 0.125), test
  both orientations, floor-divide, highest up wins (tie -> unrotated). W&T
  does NOT double the up. The typed Number Up always overrides (grain,
  folding, color bars). Sheet limits 12.5x19 min, 23.25x29.75 max.
- Screens: 1 job info, 4 prepress, 6 paper/stock, 7 press, 8 bindery,
  9 cost summary + outside purchases + one-time charges.`;
