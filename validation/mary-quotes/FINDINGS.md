# What we derived from Mary's 36 quotes (no input from her required)

Method: E&M prints hours rounded to 0.1 but dollars EXACT. So for any line,
true_hours in [h-0.05, h+0.05] => rate in [cost/(h+0.05), cost/(h-0.05)].
Intersecting those intervals across every observation pins each rate down.

## SOLVED — rates (tight bounds, now in the engine)
| item | derived | note |
|---|---|---|
| Load Cutter | $45/hr | 21 obs, 44.87-45.00 |
| Trim to Size | $45/hr | 35 obs, 44.73-45.20 |
| Fold setup + run | $48/hr | 14 obs each |
| Saddle / stitch run | $95/hr | 7 obs |
| Stitch help | $20/hr | was 22.50 |
| Wrapping | $35/hr | 4 obs |
| Padding | $18/hr @ 500 pads/hr | 3 obs |
| Carton pack | $15/hr @ ~40 ctns/hr | fits 4 -> 2,735 cartons |
| Carton material | $0.93/carton | #348352: 396.18/426 |
| Black ink | $10.84/lb | 26 obs, 10.73-10.85 |
| Process ink | $10.84/lb | same cluster (was 8.50) |
| PMS / spot ink | $39.50/lb | separate cluster (was 19.50 - half) |
| Platemaking labor | $19.73/hr | NOT the $95 prepress rate |
| Plate hours | 0.075/plate | reproduces E&M's printed hours |
| KOMII 5C | $185/hr | derived 186-188 -> CONFIRMS the existing seed |
| Kom LED | $215/hr | derived 218 -> CONFIRMS the seed |

## SOLVED — rules
- **Plates = sides x ink colors.** #348472 7x4=28, #348228 54x4=216, #348440 6x4=24.
- **Spot vs flood coating.** SPOT carries an image so it takes a plate; FLOOD
  does not. Resolves the apparent contradiction between #348988 (4c+varnish =
  4 plates) and #348627 (1c+varnish = 2 plates).
- **Ink is per IMPRESSION**, not per sheet.
- **Signature runs scale PLATES, never run hours** (the sheet count already
  covers every signature).
- **Paper rounds up to the next 10** parent sheets (not 250).
- **Freight sits in the outside bucket but at COST**; only purchase rows take
  the 32%.
- **The $1 minimum markup applies even to zero-cost buckets.**
- **Parent vs press sheets are different units** - E&M prints "minimum count"
  (net press sheets) and sheets-out-of-parent to reconcile them.
- **Quantity tiers are not parts** - multi-quantity estimates repeat the same
  part once per price break.

## NOT SOLVABLE from the quotes — the only things worth asking Mary
1. **Makeready sheets.** No formula fits: at 8 washups we see 400, 800 and
   1,000 on comparable jobs; at 5 washups 560, 630 and 700. It varies with
   press config and stock in a way the printouts do not expose. Treat as a
   value she enters (the override field already exists).
2. **Ink coverage %** per ink configuration. We can derive lbs from her
   printed figures per quote, but not the standing assumption E&M uses.
3. **Digital click rate by stock.** Rates of .378 and .514 appear on
   nominally identical 4/4 jobs, so stock (not just size x ink) moves it.
   Deferred safely by letting a typed vendor amount win.
