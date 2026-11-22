"""
C&D Flex — Flexible Packaging & Label Estimator
================================================
Port of the HP Indigo Wide Web Job Estimator v2.9.7.8 (C&D Printing copy,
Equipment Config as loaded Aug/Sep 2026) to a standalone Python module.

Validated: workbook default scenario (Shrink Label, 4" x 11" layflat, 5,000 pcs,
CMYOVG=3 + K + Premium White) -> workbook cost $442.97; this module $442.97.

Usage
-----
    from cd_flex_estimator import quote
    q = quote(product="stand_up_pouch", width_in=4.75, height_in=8.0,
              gusset_in=3.0, quantity=5000, skus=1, finish="matte")
    q["price_total"], q["price_per_unit"]

All money in USD. All dimensions in inches. See README.md for the rules
behind every number and what the website should/should not price online.
"""

from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional

# =============================================================================
# 1. PRICING POLICY  (owner-set; change here, nowhere else)
# =============================================================================
GROSS_MARGIN = 0.40            # price = cost / (1 - margin)
MIN_ORDER_PRICE = 250.00       # floor on any online order (covers makeready)
PER_SKU_CHARGE = 75.00         # per additional SKU/version on pouches & rollstock (bag-maker changeover)
PER_SKU_CHARGE_LABEL = 0.00    # labels gang in one frame; no changeover, art handling is free
RUSH_PREMIUMS = {              # flat $ added to price, from estimator Turn Time table
    "standard_15_day": 0,
    "rush_12_day": 200,
    "rush_10_day": 400,
    "rush_7_day": 600,
    "rush_5_day": 800,
    "rush_3_day": 1000,
}
LEAD_TIME_BUSINESS_DAYS = 15

# =============================================================================
# 2. EQUIPMENT CONFIG  (from 'Equipment Config' sheet)
# =============================================================================
# Budgeted hourly rates INCLUDING 15% overhead (row 25 "Machine Cost/Hour").
# Derived from: 72-mo FMV lease factor 0.01708, service $7,595/mo, operator
# rate, shifts, 22 days/mo, productivity factor.
BHR = {
    "press":      351.9436,   # HP Indigo 200K
    "lam":         97.8653,   # Lamination / OPV unit
    "slit":        42.7668,   # Slitter / rewinder
    "seam":        48.6790,   # Seaming (shrink sleeves) — NOT online
    "cut":         34.7287,   # Die cutting (labels)
    "inspect":     34.7287,   # Inspection
    "bag":         80.7352,   # Bag making
}

# Makeready minutes (row 28) and per-additional-SKU minutes (row 29)
MR_MIN     = {"press": 15, "lam": 15, "slit": 15, "seam": 30, "cut": 10, "inspect": 10, "bag": 90}
SKU_MR_MIN = {"press": 0,  "lam": 0,  "slit": 5,  "seam": 0,  "cut": 0,  "inspect": 0,  "bag": 20}

# Makeready linear feet consumed (row 30/31). Bag-making MR is 300 *bags*,
# converted to feet using the bag repeat.
MR_FT         = {"press": 30, "lam": 500, "slit": 200, "seam": 450, "cut": 100, "inspect": 100}
MR_BAGS_BAG   = 300
SKU_MR_FT_PRESS = 8

# Run speeds, ft/min (row 32). Press speed is computed from colors + repeat.
FPM = {"lam": 200, "slit": 500, "seam": 500, "cut": 130, "inspect": 800, "bag": 140}

RUN_WASTE = 0.04               # row 33

# Press geometry (Digital Job Estimator rows 68-70)
PRESS_MAX_WIDTH_IN   = 29.37
CCC_MARK_IN          = 0.354   # Continuous Color Calibration strip
CSC_MARK_IN          = 0.315   # Constant Scaling Calibration strip
MAX_USABLE_WIDTH_IN  = PRESS_MAX_WIDTH_IN - CCC_MARK_IN - CSC_MARK_IN   # 28.701
MAX_REPEAT_IN        = 44.0
FRAME_SECONDS_200K   = 0.4     # seconds per color separation per frame (200K)

# =============================================================================
# 3. CONSUMABLES  (Equipment Config rows 35-49)
# =============================================================================
CLICK = {
    "cmyovg": 0.04414,         # per color separation per frame (C, M, Y, O, V, G)
    "k":      0.02213,
    "w":      0.02213,         # white separation click
}
WHITE_INK = {                  # Premium White, 450 full frames per can, $113.48/can
    "cost_per_can": 113.48,
    "frames_per_can": 450,
}
WHITE_COST_PER_FULL_FRAME = WHITE_INK["cost_per_can"] / WHITE_INK["frames_per_can"]   # 0.2522
SPOT_INK_COST_PER_FRAME = 465 / 2020                                                     # 0.2302
PRIMER_COST_PER_MSI = 0.015    # DigiPrime 050

# Prepress
PREPRESS_RATE_PER_HR = 35
PREPRESS_MIN_FIRST   = 10
PREPRESS_MIN_PER_SKU = 5

# =============================================================================
# 4. MATERIALS  ($ per MSI = per 1,000 sq in)  (from 'Structure' sheet)
# =============================================================================
MATERIALS: Dict[str, float] = {
    # --- print webs / laminates (flexible) ---
    "pet_12u_corona":          0.030,
    "pet_pvdc":                0.060,
    "pet_metallized_12u":      0.030,
    "pet_matte_19u":           0.040,
    "bopp_heat_seal":          0.050,
    "bopp_metallized":         0.030,
    "bopp_matte":              0.045,
    "pe_sealant_100u":         0.018,
    "pe_evoh_sealant":         0.018,
    "soft_touch_pet_52g":      0.0930,   # $3.65/lb @ 39,231 in2/lb
    "met_pet_48g":             0.046,
    "ldpe_evoh_3mil":          0.1541,
    "ldpe_clear_3_5mil":       0.205,
    "ldpe_white_3mil":         0.1652,
    "stick_pack_easy_tear":    0.6797,
    "white_film_48pet_3ll":    0.26,     # pre-laminated 48g PET / 3 mil white LLDPE
    "metalized_48met_3ll":     0.39,     # pre-laminated 48g MET PET / 3 mil LLDPE
    "white_met_48met_3ll":     0.49,
    "matte_packready_eva":     0.129,
    "gloss_packready_eva":     0.118,
    "matte_pet_eva_1_2mil":    0.32,
    "gloss_pet_eva_1_2mil":    0.17,
    "pe_shrink_film":          0.20,
    # --- coatings / adhesives ---
    "opv_std":                 0.04,
    "opv_gloss":               0.08,
    "adhesive_std":            0.015,
    "adhesive_waterbased":     0.04,
    # --- pressure-sensitive label stocks (NOT in HP workbook; C&D assumptions,
    #     verify with label-stock vendor before go-live) ---
    "ps_white_bopp":           0.12,
    "ps_uncoated_paper":       0.09,
    "ps_uncoated_wetstrength": 0.11,
    "ps_matte_ps":             0.35,     # workbook "PS | Matte PS" line
    "ps_lam_gloss_pp":         0.10,
    "ps_lam_matte_pp":         0.10,
}

def ldpe_cost(mil: float) -> float:
    """Scale the 3.5 mil clear LDPE line to another gauge."""
    return MATERIALS["ldpe_clear_3_5mil"] * mil / 3.5

# Named structures the website can offer. Each is a list of (material, lam_pass)
# where lam_pass=True means that layer is added with a lamination pass.
STRUCTURES: Dict[str, dict] = {
    "matte_barrier": {
        "label": "Matte PET / metallized PET / PE sealant (approx. 4.7 mil)",
        "layers": [("matte_pet_eva_1_2mil", False), ("met_pet_48g", True), ("ldpe_clear_3_5mil", False)],
        "lam_passes": 1, "needs_white": True,
    },
    "gloss_barrier": {
        "label": "Gloss PET / metallized PET / PE sealant (approx. 4.7 mil)",
        "layers": [("gloss_pet_eva_1_2mil", False), ("met_pet_48g", True), ("ldpe_clear_3_5mil", False)],
        "lam_passes": 1, "needs_white": True,
    },
    "soft_touch_barrier": {
        "label": "Soft-touch PET / metallized PET / 4 mil LLDPE (approx. 5.5 mil)",
        "layers": [("soft_touch_pet_52g", False), ("adhesive_std", False), ("met_pet_48g", True),
                   ("adhesive_std", False), ("_ldpe_4mil", True)],
        "lam_passes": 2, "needs_white": True,
    },
    "clear_pe": {
        "label": "Clear PET / clear PE (window-capable, no metallized barrier)",
        "layers": [("gloss_pet_eva_1_2mil", False), ("ldpe_clear_3_5mil", True)],
        "lam_passes": 1, "needs_white": True,
    },
    "white_pe": {
        "label": "48g PET / 3 mil white LLDPE (pre-laminated)",
        "layers": [("white_film_48pet_3ll", False)],
        "lam_passes": 0, "needs_white": False,
    },
    "label_white_bopp": {
        "label": "White BOPP, permanent acrylic adhesive, paper liner",
        "layers": [("ps_white_bopp", False)], "lam_passes": 0, "needs_white": False,
    },
    "label_uncoated_paper": {
        "label": "Uncoated FSC paper, permanent adhesive, paper liner",
        "layers": [("ps_uncoated_paper", False)], "lam_passes": 0, "needs_white": False,
    },
    "label_wetstrength_paper": {
        "label": "Uncoated wet-strength paper (fridge-safe), permanent adhesive",
        "layers": [("ps_uncoated_wetstrength", False)], "lam_passes": 0, "needs_white": False,
    },
}

def structure_cost_per_msi(key: str) -> float:
    s = STRUCTURES[key]
    total = PRIMER_COST_PER_MSI
    for mat, _ in s["layers"]:
        total += ldpe_cost(4.0) if mat == "_ldpe_4mil" else MATERIALS[mat]
    return total

# Fitments
ZIPPER_COST_PER_INCH_WIDTH = 0.0065     # press-to-close; 4.75" bag -> $0.031, 7.5" -> $0.049
SLIDER_ZIPPER_ADDER = 0.04              # per bag, on top of PTC

# =============================================================================
# 5. CORE MODEL
# =============================================================================

@dataclass
class Layout:
    print_width_in: float      # across-web dimension of one unit incl. seals
    repeat_unit_in: float      # around-web dimension of one unit
    across: int
    around: int
    per_frame: int
    frame_repeat_in: float
    image_width_in: float
    web_width_in: int
    frame_efficiency: float

def _layout(print_width: float, repeat_unit: float, gap: float = 0.0,
            allow_rotate: bool = False) -> Layout:
    """Pack units across the 28.7" usable width and 44" max repeat.
    Returns the best orientation if rotation is allowed (labels only)."""
    def pack(pw, ru):
        across = int(MAX_USABLE_WIDTH_IN // (pw + gap))
        around = int(MAX_REPEAT_IN // (ru + gap))
        if across < 1 or around < 1:
            return None
        frame_repeat = around * (ru + gap)
        image_w = across * (pw + gap) + CCC_MARK_IN + CSC_MARK_IN
        return Layout(pw, ru, across, around, across * around, frame_repeat, image_w,
                      math.ceil(image_w), (frame_repeat * image_w) / (MAX_USABLE_WIDTH_IN * MAX_REPEAT_IN))
    options = [pack(print_width, repeat_unit)]
    if allow_rotate:
        options.append(pack(repeat_unit, print_width))
    options = [o for o in options if o]
    if not options:
        raise ValueError(f"Unit {print_width}\" x {repeat_unit}\" does not fit the press "
                         f"(max {MAX_USABLE_WIDTH_IN:.1f}\" wide x {MAX_REPEAT_IN}\" repeat)")
    return max(options, key=lambda o: o.per_frame)

def _press_speed_fpm(total_colors: int, frame_repeat_in: float) -> float:
    n = max(total_colors, 3)
    return 60 / (n * FRAME_SECONDS_200K) * frame_repeat_in / 12

def _cost(
    layout: Layout, quantity: int, skus: int,
    colors_cmyovg: int, colors_k: int, white: bool, spot_colors: int,
    struct_per_msi: float, lam_passes: int,
    post: List[str],                  # subset of ["lam","slit","seam","cut","inspect","bag"]
    extra_per_unit: float = 0.0,      # zipper etc.
    bag_repeat_in: Optional[float] = None,
) -> dict:
    """Replicates 'Digital Job Estimator' rows 102-293."""
    total_colors = colors_cmyovg + colors_k + (1 if white else 0) + spot_colors
    speed = _press_speed_fpm(total_colors, layout.frame_repeat_in)

    frames = math.ceil(quantity / layout.per_frame)
    prod_ft = frames * layout.frame_repeat_in / 12

    # Setup footage (rows 115-124)
    setup_ft = MR_FT["press"] + (skus - 1) * SKU_MR_FT_PRESS
    if "lam" in post:     setup_ft += MR_FT["lam"] * lam_passes
    if "slit" in post:    setup_ft += MR_FT["slit"]
    if "seam" in post:    setup_ft += MR_FT["seam"]
    if "cut" in post:     setup_ft += MR_FT["cut"]
    if "inspect" in post: setup_ft += MR_FT["inspect"]
    if "bag" in post:     setup_ft += MR_BAGS_BAG * (bag_repeat_in or layout.repeat_unit_in) / 12

    subtotal_ft = prod_ft + setup_ft
    waste_ft = subtotal_ft * RUN_WASTE
    total_ft = subtotal_ft + waste_ft
    msi = total_ft * 12 * layout.web_width_in / 1000

    # Time (minutes)
    prepress_min = PREPRESS_MIN_FIRST + (skus - 1) * PREPRESS_MIN_PER_SKU
    press_min = MR_MIN["press"] + total_ft / speed
    minutes = {"press": press_min}
    for unit in post:
        passes = lam_passes if unit == "lam" else 1
        minutes[unit] = passes * (MR_MIN[unit] + (skus - 1) * SKU_MR_MIN[unit] + total_ft / FPM[unit])

    # Costs
    c = {"Prepress": prepress_min / 60 * PREPRESS_RATE_PER_HR,
         "Press": press_min / 60 * BHR["press"]}
    names = {"lam": "Lamination/OPV", "slit": "Slit/Rewind", "seam": "Seaming",
             "cut": "Die Cutting", "inspect": "Inspection", "bag": "Bag Making"}
    for unit in post:
        c[names[unit]] = minutes[unit] / 60 * BHR[unit]

    # HP consumables (rows 244-256): clicks on production frames only
    post_setup_ft = sum(MR_FT[u] * (lam_passes if u == "lam" else 1) for u in post if u != "bag") \
                    + (MR_BAGS_BAG * (bag_repeat_in or layout.repeat_unit_in) / 12 if "bag" in post else 0)
    prod_frames = (total_ft - post_setup_ft) / (layout.frame_repeat_in / 12)
    ink = prod_frames * (colors_cmyovg * CLICK["cmyovg"] + colors_k * CLICK["k"])
    if white:
        ink += prod_frames * (CLICK["w"] + WHITE_COST_PER_FULL_FRAME * layout.frame_efficiency)
    if spot_colors:
        ink += prod_frames * spot_colors * SPOT_INK_COST_PER_FRAME * layout.frame_efficiency
    c["HP Ink / Clicks"] = ink

    c["Material"] = msi * struct_per_msi
    if extra_per_unit:
        c["Fitments"] = extra_per_unit * quantity

    total = sum(c.values())
    return {
        "cost_total": round(total, 2),
        "cost_per_unit": round(total / quantity, 4),
        "cost_breakdown": {k: round(v, 2) for k, v in c.items()},
        "frames": frames, "total_linear_ft": round(total_ft), "total_msi": round(msi),
        "press_minutes": round(press_min, 1),
        "post_minutes": {k: round(v, 1) for k, v in minutes.items() if k != "press"},
        "press_speed_fpm": round(speed),
        "layout": f"{layout.across} across x {layout.around} around = {layout.per_frame}/frame, "
                  f"{layout.frame_repeat_in:.2f}\" repeat on a {layout.web_width_in}\" web",
    }

# =============================================================================
# 6. PRODUCT DEFINITIONS  (what the website can price)
# =============================================================================

def _price_from_cost(cost_total: float, quantity: int, skus: int, rush: str, sku_charge: float = PER_SKU_CHARGE) -> dict:
    price = cost_total / (1 - GROSS_MARGIN)
    price += sku_charge * (skus - 1)
    price = max(price, MIN_ORDER_PRICE)
    price += RUSH_PREMIUMS[rush]
    return {"price_total": round(price, 2), "price_per_unit": round(price / quantity, 4),
            "margin": GROSS_MARGIN, "rush": rush, "lead_time_business_days": LEAD_TIME_BUSINESS_DAYS}

def quote_stand_up_pouch(width_in, height_in, gusset_in, quantity, skus=1,
                         structure="matte_barrier", zipper="ptc", colors="cmyk_w",
                         rush="standard_15_day") -> dict:
    """Bottom-gusset stand-up pouch. Print width = 2*H + gusset (across web), repeat = W."""
    print_w = 2 * height_in + gusset_in
    if print_w > MAX_USABLE_WIDTH_IN:
        raise ValueError(f"Pouch too tall for press: 2x{height_in}+{gusset_in} = {print_w:.1f}\" "
                         f"> {MAX_USABLE_WIDTH_IN:.1f}\". Max height with {gusset_in}\" gusset is "
                         f"{(MAX_USABLE_WIDTH_IN - gusset_in)/2:.1f}\". Route to quote request.")
    lay = _layout(print_w, width_in)
    s = STRUCTURES[structure]
    fit = {"none": 0.0, "ptc": ZIPPER_COST_PER_INCH_WIDTH * width_in,
           "slider": ZIPPER_COST_PER_INCH_WIDTH * width_in + SLIDER_ZIPPER_ADDER}[zipper]
    cmy, k, w = _colors(colors, s["needs_white"])
    res = _cost(lay, quantity, skus, cmy, k, w, 0, structure_cost_per_msi(structure),
                s["lam_passes"], ["lam", "slit", "bag"] if s["lam_passes"] else ["slit", "bag"],
                extra_per_unit=fit, bag_repeat_in=width_in)
    res.update(_price_from_cost(res["cost_total"], quantity, skus, rush))
    res.update(product="stand_up_pouch", structure=s["label"], zipper=zipper)
    return res

def quote_flat_pouch(width_in, height_in, quantity, skus=1, structure="matte_barrier",
                     zipper="none", colors="cmyk_w", rush="standard_15_day") -> dict:
    """3-side-seal flat pouch (single web folded). Print width = 2*H, repeat = W."""
    print_w = 2 * height_in
    if print_w > MAX_USABLE_WIDTH_IN:
        raise ValueError("Pouch too tall for press; route to quote request.")
    lay = _layout(print_w, width_in)
    s = STRUCTURES[structure]
    fit = {"none": 0.0, "ptc": ZIPPER_COST_PER_INCH_WIDTH * width_in}[zipper]
    cmy, k, w = _colors(colors, s["needs_white"])
    res = _cost(lay, quantity, skus, cmy, k, w, 0, structure_cost_per_msi(structure),
                s["lam_passes"], ["lam", "slit", "bag"] if s["lam_passes"] else ["slit", "bag"],
                extra_per_unit=fit, bag_repeat_in=width_in)
    res.update(_price_from_cost(res["cost_total"], quantity, skus, rush))
    res.update(product="flat_pouch", structure=s["label"], zipper=zipper)
    return res

def quote_rollstock(slit_width_in, cutoff_in, quantity, skus=1, structure="matte_barrier",
                    colors="cmyk_w", rush="standard_15_day") -> dict:
    """Printed, laminated, slit rollstock for the customer's own form-fill-seal line.
    quantity = number of impressions (cutoffs)."""
    lay = _layout(slit_width_in, cutoff_in)
    s = STRUCTURES[structure]
    cmy, k, w = _colors(colors, s["needs_white"])
    res = _cost(lay, quantity, skus, cmy, k, w, 0, structure_cost_per_msi(structure),
                s["lam_passes"], ["lam", "slit"] if s["lam_passes"] else ["slit"])
    res.update(_price_from_cost(res["cost_total"], quantity, skus, rush))
    res.update(product="rollstock", structure=s["label"])
    return res

def quote_roll_label(width_in, height_in, quantity, skus=1, structure="label_white_bopp",
                     finish="none", colors="cmyk", rush="standard_15_day") -> dict:
    """Pressure-sensitive roll labels. finish: none | gloss_opv | matte_opv | gloss_lam | matte_lam.
    Quantity = total labels across all SKUs (SKUs are ganged in one run)."""
    lay = _layout(width_in, height_in, gap=0.125, allow_rotate=True)
    s = STRUCTURES[structure]
    per_msi = structure_cost_per_msi(structure)
    post = ["slit", "cut"]
    lam_passes = 0
    if finish in ("gloss_opv", "matte_opv"):
        per_msi += MATERIALS["opv_gloss" if finish == "gloss_opv" else "opv_std"]
        post.insert(0, "lam"); lam_passes = 1
    elif finish in ("gloss_lam", "matte_lam"):
        per_msi += MATERIALS["ps_lam_gloss_pp" if finish == "gloss_lam" else "ps_lam_matte_pp"]
        post.insert(0, "lam"); lam_passes = 1
    cmy, k, w = _colors(colors, False)
    res = _cost(lay, quantity, skus, cmy, k, w, 0, per_msi, lam_passes, post)
    res.update(_price_from_cost(res["cost_total"], quantity, skus, rush, sku_charge=PER_SKU_CHARGE_LABEL))
    res.update(product="roll_label", structure=s["label"], finish=finish)
    return res

def _colors(spec: str, needs_white: bool):
    """Returns (cmyovg_count, k_count, white_bool)."""
    table = {"cmyk": (3, 1, False), "cmyk_w": (3, 1, True), "cmy_w": (3, 0, True),
             "cmyk_ovg_w": (6, 1, True), "k": (0, 1, False)}
    cmy, k, w = table[spec]
    return cmy, k, (w or needs_white)

PRODUCTS = {
    "stand_up_pouch": quote_stand_up_pouch,
    "flat_pouch": quote_flat_pouch,
    "rollstock": quote_rollstock,
    "roll_label": quote_roll_label,
}

def quote(product: str, **kwargs) -> dict:
    return PRODUCTS[product](**kwargs)

# =============================================================================
# 7. VALIDATION against the HP workbook default scenario
# =============================================================================
def _validate_against_workbook() -> float:
    """Workbook default: Shrink Label, Layflat 4" x 11", 5,000 pcs, 1 SKU,
    CMYOVG=3, K=1, Premium White, lam+slit on, structure DigiPrime + PE shrink $0.20,
    fitment $0.005/unit, substrate width 30". Expected cost $442.97."""
    lay = _layout(4, 11)
    lay.web_width_in = 30
    res = _cost(lay, 5000, 1, 3, 1, True, 0, PRIMER_COST_PER_MSI + MATERIALS["pe_shrink_film"],
                1, ["lam", "slit"], extra_per_unit=0.005)
    return res["cost_total"]

if __name__ == "__main__":
    v = _validate_against_workbook()
    print(f"Workbook validation: ${v:.2f} (expected $442.97) -> {'OK' if abs(v-442.97)<0.05 else 'MISMATCH'}")
    print()
    for q in (500, 1000, 2000, 5000, 10000, 25000):
        r = quote_stand_up_pouch(4.75, 8, 3, q)
        print(f"SUP 4.75x8x3  {q:>6,}: cost ${r['cost_total']:>8,.0f}  price ${r['price_total']:>8,.0f}  ${r['price_per_unit']:.3f}/bag")
    print()
    r = quote_roll_label(2.5, 2.5, 16000, skus=16, structure="label_uncoated_paper")
    print(f"Labels 2.5x2.5 x16 designs x1000: cost ${r['cost_total']:.0f}  price ${r['price_total']:.0f}  {r['layout']}")
