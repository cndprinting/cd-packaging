# Structural gap analysis — digital / mail / envelopes / forms / posters

Scope: 349104, 349105, 349106, 349107, 349109, 349110, 349111, 349112, 349113, 349114,
349115, 349095, 349096, 349100, 349101, 349099, 349098, 349097, 348598, 348597, 348519.

Engine reviewed: `src/lib/classic-estimate.ts` (`ClassicForm`, `ClassicPart`, `computePart`,
`computeClassic`, `computeQuantityBreaks`, `JOB_TYPES`) and `src/lib/digital-clicks.ts`.

---

## 0. The E&M summary model, now fully reverse-engineered

Before the gap table: this batch let me solve E&M's Screen 9 arithmetic exactly. The model is

```
outsideCost   = sum(outside purchase rows) + outsideFreight
outsideSell   = outsideCost + max(sum(purchase rows) * outsidePct/100, 1.00)   # freight is NOT marked up
lineSell(c,p) = c + max(c * p/100, 1.00)                                        # $1 min EVEN WHEN c == 0
totalCost     = paper + material + outsideCost + labor
total         = paperSell + materialSell + outsideSell + laborSell + totalCost * commissionPct/100
```

Verified to the penny against **ten** in-scope estimates spanning every product family:
349104 (122.11), 349107 (67.78), 349109 (69.31), 349115 (65.75), 349101 (236.66),
349096 (816.09), 349095 (230.48), 348519 (1536.18), 349099 (488.80), 349110 (1775.06).

Two of the three rules differ from `computeClassic()` today (see gaps G3 and G4). Fixing those
two lines alone moves a large share of this batch onto exact parity.

---

## 1. The central question: digital-as-outside-purchase vs the internal click engine

### What Mary actually does

Every digital job in this batch is estimated as an **offset-shaped estimate on a carrier press**:

| Estimate | Carrier press config | Press hrs | Actual print bought as |
|---|---|---|---|
| 349095, 349097, 349099, 349105, 349106, 349110, 349111, 349114, 349115 | `MILLE Configuration MILLER SHEETFED 1 COLOR` | 0.0 | `[Digital]` outside row |
| 349112 | `Press SMALL Configuration small` | 0.1–0.2 | `[Digital / VD]` outside row |
| 349113, 349100 | `Press 40 Configuration Phantom Press` | 0.0 | `[Digital]` outside row |

The carrier press contributes ~$0.00–0.06 of press cost. It exists only to hold the sheet layout,
the up-count, the makeready/waste sheet counts and the paper buy. Plates print as a **count with
$0.00 cost** (4 plates @ 0.00). Digital rows carry **0% outside markup**; a separate hand-typed
`[32%]` row uplifts only the *non-digital* vendor services in the same block.

### The decisive finding: the vendor amount IS the click calculation

`[Digital] N @ $X` is not an arbitrary vendor quote. It equals **(press sheets + overs) × Mary's
click rate**, exactly, on 10 of the 11 digital estimates:

| Est. | Vendor $ | Press sheets | Overs | Rate | Clicks × rate |
|---|---|---|---|---|---|
| 349111 | 277.83 | 1,420 | 50 | .189 | **277.83** |
| 349110 | 971.97 | 1,841 | 50 | .514 | **971.97** |
| 349097 | 822.40 | 1,550 | 50 | .514 | **822.40** |
| 349114 | 198.45 | 500 | 25 | .378 | **198.45** |
| 349099 | 198.45 | 500 | 25 | .378 | **198.45** |
| 349095 | 103.95 | 500 | 50 | .189 | **103.95** |
| 349106 | 18.90 | 25 | 25 | .378 | **18.90** |
| 349115 | 14.37 | 13 | 25 | .378 | **14.36** |
| 349113 | 14.62 | 22 | 50 | .203 | **14.62** |
| 349112 | 1,003.93 | 2,839 | 250 | .325 | **1,003.93** |
| 349105 | 265.36 | 488 | 5 | .538 | 265.23 (13¢ off) |

That is precisely `digitalClickSheets = pressSheets + digitalMakereadySheets` times
`getDigitalClickRate()`. The quote-note convention "50 overs .514" / "25 overs .378" is Mary
writing down the overs count and the click rate she used.

### Conclusion

**The click engine is not wrong — it is correct and already routed to the right bucket.**
`computePart()` computes `digitalClickCost` and `computeClassic()` adds `digitalClickTotal` into
`outsideCost` at Outside markup, which is what E&M does. The reconciliation problem is narrower
than it looks. Four concrete mismatches remain:

1. **No vendor-override.** Mary must be able to type the vendor's dollar figure and have the
   engine use it, with the click calc shown beside it as the suggestion. Some jobs will not
   match the table (349105 is 13¢ off; 349112's 250-sheet overs is not a standard overs count).
   Parity with a hand-typed system requires the hand-typed number to win.
2. **`digitalMakereadySheets` is doing double duty** as both "digital makeready" and "overs".
   E&M treats overs (25/50) as a *pricing* quantity on the click line and separately prints its
   own makeready (30/15/45/60) and press waste on the paper block. Today one field drives both,
   so paper and clicks cannot disagree — but in E&M they routinely do (349115: makeready 30,
   press waste 1, clicks priced on 13 + 25).
3. **One job-level `markupOutsidePct` cannot express 0% digital + 32% services** (gap G2).
4. **`jobType === "Digital Direct"` is an all-or-nothing switch.** It suppresses ink, plates,
   makeready, washup and run hours for the whole part. E&M's carrier-press jobs still carry ink
   ($5.41 on 349113, $39.50 on 349100/349101) and a small setup/run on the SMALL press (349112).

### Recommendation

**Keep the click engine. Reframe it as a priced outside row, not a job type.**

- Add `digitalVendorAmountOverride: number` (0 = use the computed clicks) alongside
  `digitalInkConfig` in `PART_FIELD_KEYS`. In `computePart()`, set
  `digitalClickCost = override > 0 ? override : digitalClickSheets * digitalClickRate`, and keep
  the computed figure in `PartCalc` as `digitalClickSuggested` so the UI shows
  "suggested $198.45 (525 × .378)" next to Mary's typed value.
- Split overs from makeready: add `digitalOversSheets` (pricing) and leave
  `digitalMakereadySheets` for the paper block. `digitalClickSheets = pressSheets + digitalOvers`.
- **Decouple the digital branch from `jobType`.** Replace `isDigital = f.jobType === "Digital Direct"`
  in `computeClassic()` with a per-part boolean `p.digitalPrintOutside`. That lets a part have a
  carrier press with real ink and a small setup (349112, 349100) *and* a digital outside line —
  which the current mutually-exclusive `if (isDigital) … else …` in `computePart()` forbids.
- Render the digital line in the outside block labelled `[Digital]` / `[Digital / VD]`, at its own
  row markup (default 0%), so the printed estimate reads like E&M's.

This preserves the engineering value of the click table (it is demonstrably Mary's own arithmetic)
while making the typed vendor number authoritative — which is what exact parity requires.

---

## 2. Gap table — blockers first

| Gap | What E&M does | Seen on (estimate #s) | Severity | Suggested implementation |
|---|---|---|---|---|
| **G1. No vendor-priced digital / digital tied to `jobType`** | Digital print is a typed outside row `[Digital] N @ $X`; the carrier press still carries ink and setup. Godzilla's `isDigital` branch is all-or-nothing and computes the amount internally with no override. | 349095, 349097, 349099, 349105, 349106, 349110, 349111, 349112, 349113, 349114, 349115 | **blocker** | `classic-estimate.ts`: add `digitalVendorAmountOverride` + `digitalOversSheets` to `ClassicForm`/`PART_FIELD_KEYS`; replace `isDigital = f.jobType === "Digital Direct"` in `computeClassic()` with per-part `p.digitalPrintOutside`; in `computePart()` stop making the digital branch exclusive of the ink/setup branch. |
| **G2. Single job-level outside markup — cannot mix 0% and 32%** | Digital rows take 0%; vendor services in the same block are uplifted by a hand-typed `[32%]` row: `[Wrap in sets] 34.50 → [32%] 11.04`; `[Insert/Sort] 188.88 → [32%] 60.44`; `[C&D 26 229-04] 89.00 → [32%] 28.48`. Fully brokered jobs use a flat 32%. | 349105, 349112, 349114 (mixed); 349104, 349107, 349109, 349096, 348597, 348598, 349100, 349101, 349098 (32%); 349095, 349097, 349099, 349110, 349111, 349113, 349115 (0%) | **blocker** | Add `markupPct?: number` to `OutsidePurchase` (undefined = fall back to `f.markupOutsidePct`). In `computeClassic()`'s `for (const p of f.outsidePurchases)` loop, accumulate marked-up-per-row instead of applying one `mk(outsideCost, f.markupOutsidePct)`. Keeps `amountsByTier` scaling intact, which a hand-typed uplift row does not. |
| **G3. Outside freight is in the wrong bucket and gets the wrong treatment** | Outside freight is added to **outside cost** and receives **no markup**; only the purchase rows are marked up. Godzilla puts `f.freight` in a separate `freightSelling = freight + 1` pass-through. | Every estimate in scope. Clearest: 348519 (no purchases, freight 44.61, outside sell 45.61 = min $1 only); 349096 (56.25 × 1.32 = 18.00 markup, freight 23.70 untouched); 349101, 349104, 349107, 349109 | **blocker** | In `computeClassic()`: introduce `outsideFreight` (rename/split from `f.freight`), fold it into `outsideCost`, and compute `outsideSelling = outsideCost + Math.max(outsidePurchaseMarkup, 1)` where the markup base excludes freight. Delete or repurpose the `freightSelling` line. Without this every job with both a purchase and freight is ~$1 high and every 32% job is materially wrong. |
| **G4. `$1` minimum is not applied to zero-cost lines** | E&M prints `Paper 0.00 → 1.00` and `Material 0.00 → 1.00`. Godzilla's `mk()` short-circuits: `cost > 0 ? … : 0`. | 349100, 349101 (paper 0.00 → 1.00 printed); reconstruction of 349104/349107/349109 needs +1.00 on both paper and material to land exactly | **blocker** | One character of intent in `computeClassic()`: change `const mk = (cost, pct) => cost > 0 ? cost + Math.max(...) : 0` to always return `cost + Math.max(cost*pct/100, 1)`. Guard only the buckets E&M genuinely omits (there appear to be none in this batch). |
| **G5. No phantom / carrier press concept** | A press config with 0.0 hrs, $0.00 plates and (sometimes) ink, existing only to hold the layout and the paper buy. Named `Phantom Press`, `SMALL`, `MILLER SHEETFED 1 COLOR`. | 349095, 349097, 349099, 349100, 349101, 349105, 349106, 349110, 349111, 349112, 349113, 349114, 349115 | **blocker** | Add `pressIsCarrier: boolean` to `PART_FIELD_KEYS`. When set, `computePart()` skips setup/makeready/washup/run hours and forces `plateMaterialsCost = 0`, but keeps `plates` as a printed count and keeps the paper block, ink and bindery live. Today Mary must manually zero `pressSetupHrs`, `baseMakereadyHrsPerPlate`, `washupHrsPerUnit`, `runSpeedSph`, `plateCostEach` and `helpers` on every digital job and fight the `defaultClassicForm()` prefills each time. |
| **G6. Ink pounds cannot be entered directly** | Phantom-press jobs carry flat, hand-set ink: `0.5 LBS Black + 0.5 LBS Color = $39.50` (envelopes, 0.0 press hrs), `0.5 LBS Black = $5.41` (digital shell imprint). Godzilla derives lbs only from `sheetArea × coverage% ÷ inkFactorMsqinPerLb`, and the digital branch computes **no ink at all**. | 349100 (all 4 tiers, $39.50 each), 349101 (all 4 tiers, $39.50 each), 349113 ($5.41) | **blocker** for envelopes — $39.50 is ~23% of the 500-qty cost | Add `inkLbsBlackManual` / `inkLbsColorManual` / `inkLbsPmsManual` to `PART_FIELD_KEYS` (0 = auto). In `computePart()`, let a manual value replace the `lbsFor()` result per type, and run the ink block for carrier/digital parts too, not just the offset `else` branch. |
| **G7. Padding is charged at the wrong rate on the wrong standard** | Padding is its own bindery line: `Padding — Pad in N Per Pad`. Rate is a consistent **500 pads/hr at $18.00/hr** across three independent jobs (2,000 pads → 4.0 hrs → $72.00; 600 pads → 1.2 hrs → $21.60; 1,000 pads → 2.0 hrs → $36.00). Godzilla charges `padHrsUsed` at `binderyHourlyRate` (65) on a shared `bundleRatePerHr` (200, flagged PLACEHOLDER). | 348597, 348598, 349096 | **major** — 3.6× overcharge on the pad line | Give padding its own rate pair: `padRatePerHr` (18) and `padUnitsPerHr` (500), separate from band/wrap. In `computePart()`, remove `padHrsUsed` from `binderyRateHrs` and add `padHrsUsed * padRatePerHr` to `binderyLabor` the way `foldLabor`/`stitchLabor` already work. The 500/hr figure retires the `bundleRatePerHr` PLACEHOLDER comment for pads at least. |
| **G8. Hand-bindery ops cannot take direct hours** | Every mail-shop operation is a `Hand Bind 1/2` line with flat token hours — `1.88` (≈0.083 hr @ 22.50) and `0.23` — labelled with the operation: *Inkjet addres*, *Address/Sort*, *Variable Data*, *Sort/Mail*, *Insert/sort*, *Mail*, *Score*, *Chipboard*, *Wrap in sets*, *Flood LED UV*. Godzilla's `HandOp` requires `piecesPerHour` + `pctOfQty`; there is no way to type "0.1 hr". | 349097, 349098, 349105, 349110, 349112, 349113, 349114, 349096, 348597, 348598 | **major** — every mail job in scope | Add `hours: number` to the `HandOp` interface (0 = derive from `piecesPerHour`). In `computePart()`: `handOp1Hrs = op1.hours > 0 ? op1.hours : (existing formula)`. Also confirm the hand rate — the evidence says $22.50/hr, not `binderyHourlyRate` 65, and `handOpNHrs` currently rides `binderyRateHrs` at 65. |
| **G9. No Delivery line (labor + outside freight)** | Every estimate ends with `Delivery — 0.1–0.3 hrs — Outside Freight $X`, carrying both a labor component (~$45–60/hr, e.g. 0.3 hrs → $15.00) and the freight dollars. Godzilla has `freight` (a bare number) and `deliveryZone` (unused in the math). | All 21 in scope | **major** | Add `deliveryHrs` + `deliveryRatePerHr` to the job level; feed hours into `binderyLabor` (or a `deliveryLabor` line) and freight into `outsideCost` per G3. On the fully-brokered posters this labor is 32% of total cost. |
| **G10. Carton-pack and skid-pack labor rates** | `Ctn Pack` and `Skid Pack` are separate hour lines at roughly $15–16/hr, and skid pack (0.5 hrs → $12.50 incl. $5.00 skid) has labor Godzilla does not model at all — `skids × skidCost` is material only. | 348597, 348598 (skid); 349095, 349105, 349106, 349111, 349113, 349114, 349096, 349097, 349099, 348519 (carton) | **major** | Add `skidPackHrs` to `PART_FIELD_KEYS`; give packing its own `packRatePerHr` (~15) instead of routing `packHrs` through `binderyHourlyRate` (65) inside `binderyRateHrs`. |
| **G11. `Load Cutter` is a separate per-lift line and is over-costed** | E&M bills `Load Cutter` per lift (2 lifts → $1.35, 4 → $2.70, 8 → $6.30, 32 → $29.40 ≈ $0.68–0.92/lift) *and then* `Trim to Size` separately with its difficulty in parentheses. Godzilla's `cutterHrs = pressSheets / cutterSheetsPerHr × cuttingDiff` at $65/hr gives ~$6.50 where E&M gives $1.35. | 349095, 349097, 349099, 349105, 349106, 349111, 349113, 349114, 349115, 349096, 348519, 348597, 348598 | **major** | Recast `cutterHrs` as `ceil(pressSheets / sheetsPerLift) × loadPerLiftHrs`, reusing the existing `sheetsPerLift` field, and give it a `loadCutterRatePerHr`. `trimHrsUsed` already models Trim to Size correctly. |
| **G12. Pads: quantity model and per-unit pricing** | E&M's quantity is the **sheet** count (100,000 / 30,000 / 10,000) while the customer buys **pads** (2,000 / 600 / 1,000 of 50/50/10). The quote letter prices per pad. Godzilla's `quantity` is finished pieces and `costPerUnit`/`costPerM` divide by it, so the quoted unit price is per sheet. | 348597, 348598, 349096 | **major** | Add `piecesPerUnit` + `unitLabel` ("pad") at job level; keep `quantity` as sheets for the paper/press math but report `costPerUnit = total / (quantity / piecesPerUnit)`. Note `padIn` already parses the per-pad count — reuse it rather than adding a parallel field. |
| **G13. Envelope stock at $0.00/M with a live sheet count** | Envelopes are the outside purchase, so `pricePerM = 0.00`, yet E&M still tracks 510 / 1,010 / 1,510 / 2,010 sheets (quantity + a flat 10 spoilage) and prints `Paper 0.00 → 1.00`. Godzilla's `paperBuyRounding` default of 250 would round 510 → 750, and there is no flat-spoilage input. | 349100, 349101; 349112 (priced at 28.01/M but same shape) | **major** | Mary must set `paperBuyRounding = 1` and `wasteSheetsManual = 10`, both of which fight the defaults. Add an `envelopeStock` / `noRounding` flag that flips `paperBuyRounding` to 1 and switches waste to a flat-sheet entry. G4 covers the $1 paper line. |
| **G14. Flat per-tier prepress fee alongside a scaling vendor price** | `CGI Prepress $30.00` is charged unchanged at every quantity while `GCI` envelopes scale non-linearly (80 / 90 / 123 / 140 and 180 / 250 / 334.50 / 400). | 349100, 349101 | **minor** — already supported | `OutsidePurchase.amountsByTier` handles this today: one row for GCI with four tier amounts, one flat $30 row. Verify the UI actually exposes four tiers; `additionalQuantities` caps at 3 extras, which is exactly enough for these two estimates and no more. |
| **G15. No `overs` concept outside the digital branch** | Quote notes carry an overs policy on every job: "50 overs .514", "25 overs .378", "5 overs .0378" — the count *and* the per-piece price for additional copies. | 349095, 349097, 349099, 349105, 349106, 349110, 349111, 349113, 349114, 349115 | **minor** | Add `oversQty` + `oversPricePerPiece` at job level and print them into the quote note automatically. Today Mary retypes them into `quoteNotes` free text. |
| **G16. Fold run hours are fully manual; no fold difficulty** | E&M prints `1 Fold Setup, Fold 2839` then `Folding (0.6) on the baum-26x40 Configuration Normal` — a difficulty factor in parentheses and an auto run derived from the piece count, at ~$40/hr. Godzilla has `foldSetupHrs`/`foldRunHrs` as raw numbers and `folderRatePerHr` defaulting to 48. | 349099, 349111, 349114, 348519 | **minor** | Add `foldDiff` and `folderSpeed` (pieces/hr) so `foldRunHrs` can auto-compute like `stitchRunAuto` already does; keep the typed value as override. |
| **G17. Digital click rate may depend on stock, not just size × ink config** | Two 4/4 jobs at nominally the same press size take different rates: 349115/349106/349114 = .378, 349097/349110 = .514. 349105 = .538, 349112 (envelopes) = .325, 349113 (1/0 shell) = .203. `getDigitalClickRate()` keys only on (tier, ink config). | 349097, 349105, 349110, 349112, 349113, 349114, 349115 | **minor** (G1's vendor override neutralises it) | Confirm with Mary whether .514 vs .378 is a size-tier boundary, a stock surcharge, or a different device. Until then the override in G1 is the safe path — do not widen the rate table on inference. |
| **G18. `JOB_TYPES` is decorative** | `"All Outside"`, `"Press Only"`, `"Bindery Only"` etc. are declared but only `"Digital Direct"` is ever read (`isDigital`). A fully-brokered poster with no paper and no press has no job type that changes behavior. | 349104, 349107, 349109 | **minor** | Either wire the enum to suppress the relevant screens/prefills, or drop the unused members. Fully-outsourced jobs otherwise compute correctly once G3, G4 and G9 land. |
| **G19. Postage / drops / list handling are unmodelled** | "3 drops", "postage NOT included", mailing list counts driving odd quantities (5,523 / 2,839 / 6,200). Sorting is bought outside at $20.00/M. | 349097, 349098, 349110, 349111, 349112, 349113 | **minor** | The money is all representable today (`per: "perM"` handles the $20/M sort exactly; odd quantities are fine). Missing is structured capture — add `mailDrops`, `postageIncluded: boolean`, `listCount` so the quote letter's standard language generates instead of being retyped into `quoteNotes`. |
| **G20. No estimator field** | E&M stamps `MARY BITTING` as estimator, distinct from `soldBy` (Lee Zerfass / Benjy Waxman / Suzanne Alvarez). | 349095, 349096, 349101 | **minor** | Add `estimatorName` alongside the existing customer fields in `ClassicForm`. |

---

## 3. Things that are already right — do not "fix" these

Worth recording so the next pass does not churn them:

- **Digital clicks already land in the outside bucket.** `computeClassic()` adds `digitalClickTotal`
  to `outsideCost`, and the comment on line ~610 of `computePart()` already documents that clicks
  are not press labor. This matches E&M exactly.
- **`digitalClickSheets = pressSheets + digitalMakereadySheets`** is E&M's own formula
  (see the 11-row table in §1).
- **Commission is a percentage of total cost, added on top** — confirmed again on 349101
  (17.06 = 10% × 170.60) and 349096 (56.72 = 10% × 567.28). The 15% variant on 349099 is just the
  `commissionPct` field doing its job; no gap.
- **Per-tier outside pricing** (`amountsByTier`) and **per-M outside rows** (`per: "perM"`) cover
  the envelope tier tables and the $20/M sort charge exactly.
- **`computeQuantityBreaks()`** correctly re-runs the whole estimate per tier, which is how E&M
  prints 349100/349101 (a separate cost sheet per quantity).
- **Markup defaults** 33 / 18 / 32 / 40 / 10 hold across this batch, with a paper-markup variant of
  32% on several digital jobs (349095, 349106, 349113, 349114, 349115) — a field value, not a gap.

---

## 4. Suggested order of work

1. **G3 + G4** together — two small edits inside `computeClassic()` that move ten verified
   estimates onto exact parity. Highest value per line changed in the whole list.
2. **G2** (per-row outside markup) — unblocks every mixed digital + services job.
3. **G5 + G6** (carrier press, manual ink) — unblocks envelopes and the phantom-press pattern.
4. **G1** (vendor-priced digital) — the structural reframe; safe to do after 1–3 since the click
   math is already correct.
5. **G7–G13** — the labor-rate and bindery-line corrections, each independently verifiable against
   the estimates listed in its row.
