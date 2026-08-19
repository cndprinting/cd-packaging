# Mary: standard coverage = 6% black, 12% EACH of C/M/Y (36% process), per side.
# Solve for E&M's ink factor (thousand sq-in of coverage per lb) from every
# quote that prints both ink pounds and a sheet size.
import json, re
d = json.load(open("mary-quotes/catalog.json", encoding="utf-8"))
rows = []
for e in d:
    for p in (e.get("parts") or []):
        pr = p.get("press") or {}; pa = p.get("paper") or {}; rp = p.get("runPlan") or {}
        il, sz = pr.get("inkLbs"), pa.get("parentSize")
        if not il or not sz: continue
        m = re.findall(r"(\d+(?:\.\d+)?)", str(sz))
        if len(m) < 2: continue
        area = float(m[0]) * float(m[1])
        nums = [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)", str(il))]
        if len(nums) < 2: continue
        black, color = nums[0], nums[1]
        sheets = 0
        for k in ("minimumCount",):
            if rp.get(k): sheets = float(rp[k])
        if not sheets and pa.get("sheets"): sheets = float(pa["sheets"])
        if not sheets: continue
        mk = float(rp.get("makeready") or 0); wst = float(rp.get("pressWaste") or 0)
        thru = sheets + mk + wst
        colors = str(pr.get("colors") or "")
        sides = 2 if re.search(r"(\d+)\s*/\s*[1-9]", colors) else 1
        # colour pounds use 36% per side; black uses 6%
        if color > 0:
            f = (thru * area * 0.36 * sides) / (color * 1000)
            rows.append(("color", e.get("estimateNo"), round(f, 1), color, sides))
        if black > 0:
            f = (thru * area * 0.06 * sides) / (black * 1000)
            rows.append(("black", e.get("estimateNo"), round(f, 1), black, sides))
for r in sorted(rows, key=lambda x: x[2])[:26]:
    print(f"  {r[0]:<6}{str(r[1]):<9}factor {r[2]:>8}   lbs {r[3]:<6} sides {r[4]}")
fs = sorted(r[2] for r in rows)
if fs:
    mid = fs[len(fs)//2]
    print(f"\nn={len(fs)}  median factor {mid}   (engine currently 425 -- PLACEHOLDER)")
