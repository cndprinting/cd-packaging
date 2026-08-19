# Derive E&M's rate table from Mary's 36 quotes WITHOUT asking her.
# E&M prints hours rounded to 0.1 but dollars exact, so for each line
#   true_hours in [h-0.05, h+0.05]  =>  rate in [cost/(h+0.05), cost/(h-0.05)]
# Intersecting those intervals over every observation of an operation pins the
# rate down hard. Same trick works for anything hours-based.
import json, re, collections

d = json.load(open("mary-quotes/catalog.json", encoding="utf-8"))

def norm_op(op):
    o = (op or "").lower()
    o = re.sub(r"\(.*?\)", "", o)
    o = re.sub(r"[0-9]+", "", o)
    if "load cutter" in o: return "Load Cutter"
    if "trim" in o: return "Trim to Size"
    if "fold setup" in o: return "Fold Setup"
    if "folding" in o: return "Folding (run)"
    if "saddle" in o and "setup" in o: return "Saddle Setup"
    if "saddle" in o or "mueller" in o or "stitch" in o: return "Saddle/Stitch run"
    if "perfect" in o: return "Perfect Bind"
    if "hand bind" in o: return "Hand Bind"
    if "ctn pack" in o or "carton" in o: return "Ctn Pack"
    if "pad" in o: return "Padding"
    if "wrap" in o: return "Wrapping"
    if "band" in o: return "Banding"
    if "deliver" in o: return "Delivery"
    if "drill" in o: return "Drilling"
    if "paper handling" in o: return "Paper handling"
    if "help" in o: return "Help"
    if "inkjet" in o or "sort" in o or "mail" in o: return "Inkjet/Sort/Mail"
    return op.strip()[:28] if op else "?"

obs = collections.defaultdict(list)   # op -> [(hrs, cost, est)]

def add(op, hrs, cost, est):
    try: hrs = float(hrs); cost = float(cost)
    except (TypeError, ValueError): return
    if cost <= 0: return
    obs[op].append((hrs, cost, est))

for e in d:
    est = e.get("estimateNo")
    for p in (e.get("parts") or []):
        for b in (p.get("bindery") or []):
            c = b.get("cost")
            m = b.get("material")
            # Ctn Pack prints labor+material together; strip the material
            if m:
                try: c = float(c) - float(m)
                except (TypeError, ValueError): pass
            add(norm_op(b.get("op")), b.get("hrs"), c, est)

print("=" * 78)
print("DERIVED RATE TABLE  (interval intersection over all observations)")
print("=" * 78)
print(f"{'operation':<22}{'n':>3}  {'rate range $/hr':<24}{'best':<9}status")
derived = {}
for op, rows in sorted(obs.items(), key=lambda kv: -len(kv[1])):
    lo, hi, used = 0.0, 1e9, 0
    for h, c, _ in rows:
        if h <= 0.05:      # 0.0-hr lines can't bound an upper limit
            lo = max(lo, c / 0.05001) if False else lo
            continue
        l = c / (h + 0.05)
        u = c / (h - 0.05) if h > 0.05 else 1e9
        if l > hi or u < lo:   # inconsistent -> not a single rate
            used = -1; break
        lo, hi, used = max(lo, l), min(hi, u), used + 1
    if used <= 0:
        print(f"{op:<22}{len(rows):>3}  {'-- inconsistent --':<24}{'':<9}mixed rates?")
        continue
    best = round((lo + hi) / 2, 2)
    # snap to a clean number when one sits inside the interval
    for cand in [round(best), round(best * 2) / 2, round(best, 1)]:
        if lo <= cand <= hi: best = cand; break
    derived[op] = best
    tight = (hi - lo) < 2
    print(f"{op:<22}{used:>3}  {f'{lo:8.2f} - {hi:8.2f}':<24}{best:<9}{'TIGHT' if tight else 'loose'}")

print()
print("=" * 78)
print("MAKEREADY SHEETS — is there a rule?")
print("=" * 78)
print(f"{'est':<9}{'part':<26}{'units':>6}{'plates':>7}{'wash':>6}{'mkrdy':>7}{'per-wash':>9}{'stock'}")
for e in d:
    for p in (e.get("parts") or []):
        rp = p.get("runPlan") or {}
        pr = p.get("press") or {}
        pa = p.get("paper") or {}
        mk, wash = rp.get("makeready"), rp.get("washMakereadys")
        if mk is None: continue
        plates = (p.get("prep") or {}).get("plates")
        stock = str(pa.get("lb") or "")[:22]
        try: per = f"{float(mk)/float(wash):.0f}" if wash else "-"
        except (TypeError, ValueError, ZeroDivisionError): per = "-"
        print(f"{str(e.get('estimateNo')):<9}{str(p.get('name'))[:25]:<26}{str(pr.get('colors') or '-'):>6}"
              f"{str(plates or '-'):>7}{str(wash or '-'):>6}{str(mk):>7}{per:>9}  {stock}")
