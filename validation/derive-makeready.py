# Crack E&M's makeready-sheet rule. Hypothesis from the plant-standards seed:
#   makeready = setupWaste + plateChangeWaste x washups
# Fit A + B*washes per press config, and check whether sheet size explains the
# rest. Also derives the plate-counting rule and ink coverage standards.
import json, re, collections

d = json.load(open("mary-quotes/catalog.json", encoding="utf-8"))

def press_key(p):
    cfg = str((p.get("press") or {}).get("config") or "")
    c = cfg.upper()
    if "LED" in c: return "Kom LED"
    if "KOM" in c: return "KOMII 5C"
    if "PHANTOM" in c: return "Phantom"
    if "MILLER" in c or "SMALL" in c: return "Small/Miller"
    return cfg[:18] or "?"

def area(p):
    pa = p.get("paper") or {}
    m = re.findall(r"(\d+(?:\.\d+)?)", str(pa.get("parentSize") or ""))
    return (float(m[0]) * float(m[1])) if len(m) >= 2 else None

rows = collections.defaultdict(list)
for e in d:
    for p in (e.get("parts") or []):
        rp = p.get("runPlan") or {}
        mk, wash = rp.get("makeready"), rp.get("washMakereadys")
        if mk is None or not wash: continue
        try: mk, wash = float(mk), float(wash)
        except (TypeError, ValueError): continue
        rows[press_key(p)].append((wash, mk, area(p), e.get("estimateNo"), str(p.get("name"))[:18]))

print("=" * 84)
print("MAKEREADY RULE:  sheets = A + B x washups   (least squares per press config)")
print("=" * 84)
for k, v in sorted(rows.items(), key=lambda kv: -len(kv[1])):
    if len(v) < 2:
        print(f"\n{k}: only {len(v)} observation(s) — {v}")
        continue
    n = len(v)
    sx = sum(w for w, _, _, _, _ in v); sy = sum(m for _, m, _, _, _ in v)
    sxx = sum(w * w for w, _, _, _, _ in v); sxy = sum(w * m for w, m, _, _, _ in v)
    den = n * sxx - sx * sx
    if den == 0:
        print(f"\n{k}: all washups identical ({v[0][0]})"); continue
    B = (n * sxy - sx * sy) / den
    A = (sy - B * sx) / n
    print(f"\n{k}   n={n}   ==>  makeready = {A:.0f} + {B:.1f} x washups")
    print(f"   {'est':<9}{'part':<20}{'wash':>5}{'actual':>8}{'fit':>7}{'err':>7}{'area':>8}{'per-sqin':>10}")
    for w, m, ar, est, nm in sorted(v, key=lambda r: r[0]):
        fit = A + B * w
        pa = f"{m/ar:.2f}" if ar else "-"
        print(f"   {str(est):<9}{nm:<20}{w:>5.0f}{m:>8.0f}{fit:>7.0f}{m-fit:>7.0f}{(ar or 0):>8.0f}{pa:>10}")

# ── plate rule ──
print()
print("=" * 84)
print("PLATE RULE:  printed plates vs colors / signature runs / versions")
print("=" * 84)
print(f"{'est':<9}{'part':<20}{'colors':<26}{'plates':>7}{'wash':>6}{'style'}")
for e in d:
    for p in (e.get("parts") or []):
        pr = p.get("press") or {}; rp = p.get("runPlan") or {}
        pl = (p.get("prep") or {}).get("plates")
        if pl in (None, "?"): continue
        print(f"{str(e.get('estimateNo')):<9}{str(p.get('name'))[:19]:<20}{str(pr.get('colors'))[:25]:<26}"
              f"{str(pl):>7}{str(rp.get('washMakereadys') or '-'):>6}  {str(rp.get('workStyle'))[:34]}")

# ── ink coverage standard ──
print()
print("=" * 84)
print("INK:  printed lbs vs impressions x area  ->  implied coverage standard")
print("=" * 84)
print(f"{'est':<9}{'part':<18}{'inkLbs':<22}{'sheets':>8}{'area':>7}{'cost':>9}")
for e in d:
    for p in (e.get("parts") or []):
        pr = p.get("press") or {}
        il = pr.get("inkLbs")
        if not il: continue
        pa = p.get("paper") or {}
        print(f"{str(e.get('estimateNo')):<9}{str(p.get('name'))[:17]:<18}{str(il)[:21]:<22}"
              f"{str(pa.get('sheets') or '-'):>8}{(area(p) or 0):>7.0f}{str(pr.get('inkCost') or '-'):>9}")
