# C&D Flex Estimator — handoff for Godzilla / website instant quote

**File:** `cd_flex_estimator.py` — single Python module, no dependencies.
**Source:** HP Indigo Wide Web Job Estimator v2.9.7.8 (C&D copy, Equipment Config as loaded).
**Validation:** reproduces the workbook's default scenario to the cent ($442.97). Run `python3 cd_flex_estimator.py`.

This supersedes the August build. Differences from August: label products added, structure library
from the Structure sheet, zipper priced by bag width, 40% margin and minimum order built in,
per-SKU charge, rush table, and press-fit checks that reject jobs the 200K can't run.

---

## 1. Pricing rule (owner decision, 2026-11-22)

| Rule | Value | Where |
|---|---|---|
| Gross margin | **40%** → `price = cost / 0.60` | `GROSS_MARGIN` |
| Minimum order | **$250** per order (covers makeready) | `MIN_ORDER_PRICE` |
| Additional SKU/version — pouches & rollstock | **$75 each** | `PER_SKU_CHARGE` |
| Additional SKU/version — labels | **$0** (ganged in one frame) | `PER_SKU_CHARGE_LABEL` |
| Rush | 12 day +$200 · 10 day +$400 · 7 day +$600 · 5 day +$800 · 3 day +$1,000 | `RUSH_PREMIUMS` |
| Standard lead time | 15 business days from proof approval | `LEAD_TIME_BUSINESS_DAYS` |
| Plates / cylinders / tooling | $0 (digital). Dies for labels and shaped pouches are **not** in the price — see §4 | — |
| Freight | Not included. Quote FOB St. Petersburg, FL | — |

Change any of these in the constants block at the top of the module. Nothing else needs to change.

---

## 2. Products the website can price instantly

| Product | Function | Inputs | Limits enforced in code |
|---|---|---|---|
| **Stand-up pouch** (bottom gusset) | `quote_stand_up_pouch` | width, height, gusset, qty, skus, structure, zipper (none/ptc/slider), colors, rush | `2×height + gusset ≤ 28.7"` → max ~12.3" tall with 4" gusset. Taller → quote request |
| **Flat pouch** (3-side seal) | `quote_flat_pouch` | width, height, qty, skus, structure, zipper, colors, rush | `2×height ≤ 28.7"` |
| **Rollstock** (printed, laminated, slit) | `quote_rollstock` | slit width, cutoff/repeat, qty (impressions), skus, structure, colors, rush | slit width ≤ 28.7", cutoff ≤ 44" |
| **Roll labels** (pressure-sensitive) | `quote_roll_label` | width, height, qty (total across SKUs), skus, stock, finish, colors, rush | auto-rotates for best fit; square/rectangle/round only |

Quantity guards to put in the website (not enforced in code):
- Pouches: **min 500, max 25,000 per SKU** online. Above 25K the margin should be a conversation, not a form.
- Labels: **min 250 per design**, the $250 order minimum does the rest.
- Rollstock: min 5,000 impressions.

### Send to quote request (do NOT price online)
- **Shrink sleeves** — the estimator can model them (seaming unit exists in config) but we have no run history on seaming or inspection yet. Revisit after the first few jobs.
- Stand-up pouches taller than the press limit (5 lb pet bags, most 16 oz coffee bags with 4"+ gusset)
- Anything with **foil** (no in-house foil; outsourced pass)
- **Shaped / contour die-cut** pouches or sachets (die + shape station)
- Spouts, valves, hang holes beyond standard, windows on metallized structures (window needs `clear_pe` structure — the form should force that)
- Expanded gamut / Pantone-critical work (`cmyk_ovg_w` is supported in code but adds 7-color press time; keep it off the public form)
- Quantities above the caps, or more than 6 SKUs in one order
- Customer-supplied film

---

## 3. Structures offered on the form

| Key | Description | $/MSI (incl. primer) | Use for |
|---|---|---|---|
| `matte_barrier` | Matte PET / met PET / 3.5 mil PE | 0.586 | Default pouch. Snacks, jerky, supplements, coffee |
| `gloss_barrier` | Gloss PET / met PET / 3.5 mil PE | 0.436 | Same, gloss look |
| `soft_touch_barrier` | Soft-touch PET / met PET / 4 mil LLDPE | 0.418 | Premium CPG (Casa Manchas spec) |
| `clear_pe` | Clear PET / clear PE | 0.390 | **Only option when a window is requested** |
| `white_pe` | 48g PET / 3 mil white LLDPE (pre-lam) | 0.275 | Budget, non-barrier |
| `label_white_bopp` | White BOPP PS | 0.135 | Cosmetics, beverage, anything wet |
| `label_uncoated_paper` | Uncoated FSC paper PS | 0.105 | Eco / craft look, dry goods |
| `label_wetstrength_paper` | Uncoated wet-strength paper PS | 0.125 | Eco look on refrigerated items |

Label finishes: `none`, `gloss_opv`, `matte_opv`, `gloss_lam`, `matte_lam`.

> **Verify before go-live:** the four `ps_*` label stock costs and `soft_touch_pet_52g` are C&D
> assumptions, not HP workbook values. Confirm with the film/label-stock vendor and update `MATERIALS`.

---

## 4. One-time charges the website should add as separate line items

| Item | Charge | When |
|---|---|---|
| Label die (flexible, standard shapes) | $100 per size | First order of any new label size. Waive on reorders |
| Shaped pouch / sachet die | $400–600 | Quote request only |
| Printed, formed press proof (pouch) | $350, credited on first order | Optional checkbox |
| PDF proof | $0 | Always |
| Art handling / file fixes | $15 per SKU | If customer files aren't print-ready |

---

## 5. Sanity table (40% margin, 1 SKU) for QA-ing the site

| Product | Spec | 1,000 | 5,000 | 10,000 | 25,000 |
|---|---|---|---|---|---|
| SUP | 4.75×8×3, matte barrier, PTC zip | $1.01 | $0.41 | $0.34 | $0.30 |
| SUP | 7.5×9×4.5, soft-touch, PTC zip | — | $0.58 | $0.49 | $0.44 |
| Flat pouch | 4.72×5.98, matte barrier, no zip | $0.78 | $0.22 | $0.15 | $0.11 |
| Roll label | 2.5×2.5 uncoated paper, 16 designs ganged | $502 / 16K total | | | |
| Roll label | 4×11 white BOPP gloss OPV | $0.33 @1,500 | $0.14 | | |

If the site returns numbers far from these, something is wired wrong.

---

## 6. Login gate
Prices show **only after login**. Public pages show "from $X per unit at 10,000" teaser copy at most.
Rationale: competitors (ePac, PPC Flex, Pouch.com) will scrape a public calculator, and the
per-unit numbers at low quantities look high out of context.

---

## 7. How the model works (for whoever maintains it)

1. **Layout** — units packed across the 200K's usable image width (29.37" − 0.669" calibration marks = 28.701") and 44" max repeat. Pouches lay flat as `2×height + gusset` across the web, `width` around. Labels try both orientations.
2. **Footage** — production frames × repeat, plus makeready footage per unit in the chain (press 30 ft, lam 500 ft/pass, slitter 200 ft, die cutter 100 ft, bag maker 300 bags), plus 4% run waste.
3. **Time** — press speed = `60 / (colors × 0.4 s) × repeat / 12` ft/min (min 3 colors). Each post unit: makeready minutes + footage / fpm. SKU changeovers add minutes on slitter and bag maker.
4. **Cost** — minutes × budgeted hourly rate (lease + service + operator + 15% overhead), HP clicks per color separation per production frame, white ink per full frame × frame efficiency, material $/MSI × total MSI, fitments per unit, prepress at $35/hr.
5. **Price** — cost ÷ 0.60, + $75 per extra SKU (pouches), floor $250, + rush.

Equipment rates come from the Equipment Config sheet: 200K at $351.94/hr, lam $97.87, slitter $42.77, die cutter $34.73, bag maker $80.74. If the lease, service contract or shifts change, update `BHR`.
