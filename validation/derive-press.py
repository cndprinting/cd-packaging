# Derive PRESS hourly rates and INK $/lb from the 36 quotes, same interval
# method: printed hours are rounded to 0.1 but dollars are exact.
import json, re, collections
d = json.load(open("mary-quotes/catalog.json", encoding="utf-8"))

def press_key(p):
    c = str((p.get("press") or {}).get("config") or "").upper()
    if "LED" in c: return "Kom LED"
    if "KOM" in c: return "KOMII 5C"
    if "PHANTOM" in c: return "Phantom"
    if "MILLER" in c: return "Miller 1C"
    if "SMALL" in c: return "SMALL"
    return (c[:16] or "?")

# ---- press rate: sum the printed press hour-lines vs the press labor dollars
print("=" * 76)
print("PRESS $/hr  (setup + makeready + run hours vs their printed dollars)")
print("=" * 76)
buckets = collections.defaultdict(list)
for e in d:
    for p in (e.get("parts") or []):
        pr = p.get("press") or {}
        hrs = 0.0; got = False
        for k in ("setupHrs", "makereadyHrs", "runHrsSide1", "runHrsSide2", "washupHrs"):
            v = pr.get(k)
            try:
                hrs += float(v); got = True
            except (TypeError, ValueError): pass
        # printed press dollars, ink excluded
        tot = pr.get("pressLaborTotal") or pr.get("pressTotal")
        try: tot = float(tot)
        except (TypeError, ValueError): tot = None
        ink = pr.get("inkCost")
        try: tot = tot - float(ink) if tot is not None else None
        except (TypeError, ValueError): pass
        if got and hrs > 0.2 and tot and tot > 0:
            buckets[press_key(p)].append((hrs, tot, e.get("estimateNo")))
for k, v in sorted(buckets.items(), key=lambda kv: -len(kv[1])):
    lo, hi = 0.0, 1e9
    for h, c, _ in v:
        n = 5  # up to 5 rounded hour lines -> +/-0.05 each
        lo = max(lo, c / (h + 0.05 * n)); hi = min(hi, c / max(0.01, h - 0.05 * n))
    mid = (lo + hi) / 2
    print(f"{k:<12} n={len(v):<3} {lo:8.2f} - {hi:8.2f}   best ~{mid:.2f}")
    for h, c, est in sorted(v)[:4]:
        print(f"     {est}  {h:6.2f} hrs  ${c:9.2f}   -> {c/h:7.2f}/hr")

# ---- ink $/lb from printed lbs + printed ink cost
print()
print("=" * 76)
print("INK $/lb  (printed lbs vs printed ink dollars)")
print("=" * 76)
pts = []
for e in d:
    for p in (e.get("parts") or []):
        pr = p.get("press") or {}
        il, ic = pr.get("inkLbs"), pr.get("inkCost")
        if not il or not ic: continue
        nums = [float(x) for x in re.findall(r"(\d+(?:\.\d+)?)", str(il))]
        try: ic = float(ic)
        except (TypeError, ValueError): continue
        if not nums: continue
        pts.append((sum(nums), ic, str(il)[:26], e.get("estimateNo")))
for tot, ic, raw, est in sorted(pts)[:18]:
    print(f"{str(est):<9}{raw:<28}{tot:8.2f} lbs  ${ic:9.2f}  -> ${ic/tot:6.2f}/lb")
if pts:
    rates = [ic / t for t, ic, _, _ in pts if t > 0]
    rates.sort()
    print(f"\nn={len(rates)}  median ${rates[len(rates)//2]:.2f}/lb   min ${rates[0]:.2f}  max ${rates[-1]:.2f}")
