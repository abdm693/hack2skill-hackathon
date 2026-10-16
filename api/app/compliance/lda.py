"""LDA compliance engine: envelope lookup and BuildingPlan checks.

Rules come from lda_rules.json, extracted from docs/research/lda-regulations.md (LDA Building & Zoning
Regulations 2019, consolidated text of 09-02-2026). All geometry is in plan feet, using the conventions
in contracts/plan.ts.
"""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path

MARLA_SQFT = 225.0  # Lahore District (LDA)
REF = "LDA B&ZR 2019 (consolidated 09-02-2026)"

OUTDOOR = {"lawn", "driveway", "open_space", "courtyard"}
OPEN_AIR = OUTDOOR | {"porch", "balcony", "terrace"}  # spaces that count as "outside" for windows
HABITABLE = {"drawing", "lounge", "dining", "bedroom", "master_bedroom", "guest_bedroom", "study", "servant", "prayer"}
KITCHENS = {"kitchen", "dirty_kitchen"}
WETS = {"bath", "powder"}
NOT_FAR = OUTDOOR | {"porch", "garage", "balcony", "terrace"}  # FAR excludes covered parking and open-to-sky areas
GLAZED = {"window", "corner_window", "sliding_door", "ventilator"}
EPS = 0.05


@lru_cache(maxsize=1)
def rules() -> dict:
    return json.loads((Path(__file__).with_name("lda_rules.json")).read_text())


def find_band(area_marla: float, zone: str = "approved_scheme") -> dict:
    bands = rules()["zones"][zone]["bands"]
    for b in bands:
        pb = b["plot_band"]
        lo_ok = area_marla >= pb["min_marla"] if pb.get("min_inclusive", True) else area_marla > pb["min_marla"]
        hi = pb.get("max_marla")
        hi_ok = True if hi is None else (area_marla <= hi if pb.get("max_inclusive") else area_marla < hi)
        if lo_ok and hi_ok:
            return b
    return bands[-1]


def _authority_overrides(authority: str) -> tuple[dict, list[str]]:
    """Other regulators: LDA bands as the baseline, plus known caps and a caveat."""
    if authority == "DHA":
        return {"max_height_ft": 39, "max_storeys": 2}, [
            "DHA Lahore applies its own construction bylaws (Aug 2026): max height 39 ft, basement + ground + first floor. "
            "Setbacks shown use the LDA baseline; confirm with DHA's approval branch."]
    if authority == "BAHRIA":
        return {}, ["Bahria Town Lahore uses its own SOPs (not published online). LDA baseline shown; confirm with the Bahria Design Wing."]
    if authority not in ("LDA", "OTHER"):
        return {}, [f"{authority} adopted the LDA 2020 text; LDA's current rules are shown as the baseline."]
    return {}, []


def envelope(width_ft: float, depth_ft: float, authority: str = "LDA", corner: bool = False, side_on: str = "right") -> dict:
    area = width_ft * depth_ft
    marla = area / MARLA_SQFT
    b = find_band(marla)
    over, notes = _authority_overrides(authority)
    sb = b["setbacks_ft"]
    side, count = float(sb.get("side") or 0), int(sb.get("side_count") or 0)
    left = side if count == 2 or (count == 1 and side_on == "left") else 0.0
    right = side if count == 2 or (count == 1 and side_on != "left") else 0.0
    setbacks = {"front": float(sb["front"]), "rear": float(sb["rear"]), "left": left, "right": right}
    cov = float(b["max_coverage_pct"])
    buildable = {"x": left, "y": setbacks["front"], "w": max(0.0, width_ft - left - right),
                 "d": max(0.0, depth_ft - setbacks["front"] - setbacks["rear"])}
    side_note = {0: "No side space required", 1: f"{side:g} ft side space on one side", 2: f"{side:g} ft side space on both sides"}[min(count, 2)]
    max_h = over.get("max_height_ft", b["max_height_ft"])
    max_st = over.get("max_storeys", b["max_storeys"])
    notes = [
        f"Plot {width_ft:g}×{depth_ft:g} ft = {area:,.0f} sq ft ≈ {marla:.1f} marla ({b['label']}).",
        f"Setbacks: front {setbacks['front']:g} ft, rear {setbacks['rear']:g} ft; {side_note.lower()}.",
        f"Ground coverage up to {cov:g}% ({area * cov / 100:,.0f} sq ft); FAR 1:{b['max_far']:g} (basement counts).",
        f"Height up to {max_h:g} ft to top of parapet (mumty ≤ 9′6″ excluded); max {max_st} storeys + basement.",
    ] + notes
    if corner:
        notes.append(f"Corner plot: keep a {b.get('corner_splay_ft') or 5:g} ft splay at the corner boundary wall.")
    return {
        "authority": authority, "band": b["label"], "setbacks_ft": setbacks, "side_space_note": side_note,
        "max_coverage_pct": cov, "max_far": float(b["max_far"]), "max_height_ft": float(max_h), "max_storeys": int(max_st),
        "buildable_rect": buildable, "max_ground_coverage_sqft": round(area * cov / 100, 1), "notes": notes,
        "_band": b,
    }


# ---------------------------------------------------------------------------------------------------
def _union_area(rects: list[dict]) -> float:
    """Exact area of a union of axis-aligned rects (coordinate compression)."""
    if not rects:
        return 0.0
    xs = sorted({r["x"] for r in rects} | {r["x"] + r["w"] for r in rects})
    ys = sorted({r["y"] for r in rects} | {r["y"] + r["d"] for r in rects})
    area = 0.0
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            cx, cy = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
            if any(r["x"] <= cx <= r["x"] + r["w"] and r["y"] <= cy <= r["y"] + r["d"] for r in rects):
                area += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j])
    return area


def _on_edge(pt, rect, tol=0.75) -> bool:
    x, y = pt
    x0, y0, x1, y1 = rect["x"], rect["y"], rect["x"] + rect["w"], rect["y"] + rect["d"]
    on_v = (abs(x - x0) <= tol or abs(x - x1) <= tol) and y0 - tol <= y <= y1 + tol
    on_h = (abs(y - y0) <= tol or abs(y - y1) <= tol) and x0 - tol <= x <= x1 + tol
    return on_v or on_h


def _overlap(a, b) -> bool:
    return a["x"] < b["x"] + b["w"] - EPS and b["x"] < a["x"] + a["w"] - EPS and a["y"] < b["y"] + b["d"] - EPS and b["y"] < a["y"] + a["d"] - EPS


def _fmt_ft(v: float) -> str:
    feet = int(v)
    inches = round((v - feet) * 12)
    if inches == 12:
        feet, inches = feet + 1, 0
    return f"{feet}′{inches}″" if inches else f"{feet}′"


def check(plan: dict) -> dict:
    site = plan.get("site", {})
    plot = site.get("plot", {})
    W, D = float(plot.get("width_ft", 0)), float(plot.get("depth_ft", 0))
    authority = site.get("authority", "LDA")
    applied = {**{"front": 0, "rear": 0, "left": 0, "right": 0}, **(site.get("setbacks_ft") or {})}
    side_on = "left" if applied.get("left", 0) > applied.get("right", 0) else "right"
    env = envelope(W, D, authority, bool(plot.get("corner")), side_on)
    band = env.pop("_band")
    plot_area = W * D

    levels = {lv["id"]: lv for lv in plan.get("levels", [])}
    rooms = plan.get("rooms", [])
    by_id = {r["id"]: r for r in rooms}
    openings = plan.get("openings", [])
    checks: list[dict] = []

    def add(cid, title, ok, message, value=None, limit=None, ref=None, ids=None, warn=False):
        checks.append({"id": cid, "title": title, "status": "pass" if ok else ("warn" if warn else "fail"),
                       "message": message, "value": value, "limit": limit, "rule_ref": ref or REF, "element_ids": ids or []})

    # --- Plan integrity -------------------------------------------------------------------------
    for lv in levels:
        lr = [r for r in rooms if r.get("level") == lv]
        for i, a in enumerate(lr):
            for b2 in lr[i + 1:]:
                if _overlap(a["rect"], b2["rect"]):
                    add(f"plan.overlap:{a['id']}:{b2['id']}", "Rooms overlap", False,
                        f"{a['name']} and {b2['name']} overlap on the {levels[lv]['name']}.", ids=[a["id"], b2["id"]])
    for o in openings:
        for rid in o.get("between", []):
            if rid == "exterior":
                continue
            r = by_id.get(rid)
            if not r or not _on_edge(o.get("at", [0, 0]), r["rect"]):
                add(f"plan.opening:{o['id']}", "Opening placement", False,
                    f"Opening {o['id']} is not on an edge of room {rid}.", ids=[o["id"]], warn=True)

    # --- Setbacks (required minimums vs. applied, and every building room inside the envelope) ------
    req = env["setbacks_ft"]
    sb_req = band["setbacks_ft"]
    side_needed, side_count = float(sb_req.get("side") or 0), int(sb_req.get("side_count") or 0)
    add("setback.front", "Front setback (building line)", applied["front"] + EPS >= req["front"],
        f"Front open space {_fmt_ft(applied['front'])} (minimum {_fmt_ft(req['front'])}).", applied["front"], req["front"])
    add("setback.rear", "Rear setback", applied["rear"] + EPS >= req["rear"],
        f"Rear open space {_fmt_ft(applied['rear'])} (minimum {_fmt_ft(req['rear'])}).", applied["rear"], req["rear"])
    if side_count:
        sides_ok = sum(1 for s in ("left", "right") if applied[s] + EPS >= side_needed)
        add("setback.side", "Side space", sides_ok >= side_count,
            f"{side_count} side space(s) of {_fmt_ft(side_needed)} required; {sides_ok} provided.", sides_ok, side_count)

    bx0, by0 = applied["left"], applied["front"]
    bx1, by1 = W - applied["right"], D - applied["rear"]
    outside = [r for r in rooms if r.get("type") not in OUTDOOR and (
        r["rect"]["x"] < bx0 - EPS or r["rect"]["y"] < by0 - EPS or
        r["rect"]["x"] + r["rect"]["w"] > bx1 + EPS or r["rect"]["y"] + r["rect"]["d"] > by1 + EPS)]
    add("setback.envelope", "Building within setbacks", not outside,
        "All rooms, porches and balconies sit inside the building line." if not outside else
        "Inside the mandatory open space: " + ", ".join(r["name"] for r in outside) +
        ". LDA does not allow rooms, porches or balconies to project into mandatory open spaces.",
        ids=[r["id"] for r in outside])

    # --- Coverage & FAR ----------------------------------------------------------------------------
    ground = [lv for lv in levels.values() if lv.get("index") == 0]
    gid = ground[0]["id"] if ground else "ground"
    covered = _union_area([r["rect"] for r in rooms if r.get("level") == gid and r.get("type") not in OUTDOOR])
    cov_pct = 100 * covered / plot_area if plot_area else 0
    add("coverage", "Ground coverage", cov_pct <= env["max_coverage_pct"] + 0.05,
        f"Covered {covered:,.0f} sq ft = {cov_pct:.1f}% of the plot (max {env['max_coverage_pct']:g}%).",
        round(cov_pct, 1), env["max_coverage_pct"], ids=[])

    storey_levels = [lv for lv in levels.values() if lv.get("index", 0) >= 0 and any(
        r.get("level") == lv["id"] and r.get("type") not in OPEN_AIR for r in rooms)]
    floor_area = 0.0
    for lv in levels.values():
        floor_area += _union_area([r["rect"] for r in rooms if r.get("level") == lv["id"] and r.get("type") not in NOT_FAR])
    far = floor_area / plot_area if plot_area else 0
    add("far", "Floor area ratio", far <= env["max_far"] + 0.01,
        f"Total floor area {floor_area:,.0f} sq ft → FAR 1:{far:.2f} (max 1:{env['max_far']:g}).", round(far, 2), env["max_far"])

    # --- Height & storeys -------------------------------------------------------------------------
    top = max((lv["elevation_ft"] + lv["height_ft"] for lv in levels.values()), default=0)
    add("height", "Building height", top <= env["max_height_ft"] + EPS,
        f"Top of parapet at {_fmt_ft(top)} above road crown (max {_fmt_ft(env['max_height_ft'])}).",
        round(top, 2), env["max_height_ft"])
    n_storeys = len([lv for lv in storey_levels if lv.get("index", 0) >= 0])
    add("storeys", "Number of storeys", n_storeys <= env["max_storeys"],
        f"{n_storeys} storey(s) above ground (max {env['max_storeys']}, basement excluded).", n_storeys, env["max_storeys"],
        ref=f"{REF} §2.7.1(a)")
    mumty = (plan.get("roof") or {}).get("mumty")
    if mumty:
        mh = float(mumty.get("height_ft", 0))
        add("mumty", "Mumty (stair tower) height", mh <= (band.get("mumty_max_height_ft") or 9.5) + EPS,
            f"Mumty {_fmt_ft(mh)} (max 9′6″, excluded from building height).", mh, 9.5)
    parapet = float((plan.get("roof") or {}).get("parapet_ft", 0))
    pmin = (band.get("parapet_height_ft") or {}).get("min") or 2.75
    add("parapet", "Roof parapet", parapet + EPS >= pmin, f"Parapet {_fmt_ft(parapet)} (minimum {_fmt_ft(pmin)} for safety).",
        parapet, pmin, warn=True)
    bw = site.get("boundary_wall") or {}
    bw_max = max(float(bw.get(k, 0)) for k in ("front_height_ft", "side_height_ft", "rear_height_ft")) if bw else 0
    add("boundary_wall", "Boundary wall height", bw_max <= 7 + EPS, f"Tallest boundary wall {_fmt_ft(bw_max)} (max 7′ above plinth).",
        bw_max, 7)

    # --- Rooms: sizes, clear height, light & ventilation ---------------------------------------------
    min_sizes = band.get("min_room_sizes") or {}
    hab = min_sizes.get("habitable_room") or {"min_area_sqft": 100, "min_width_ft": 8}
    kit = min_sizes.get("kitchen") or {"min_area_sqft": 50, "min_width_ft": 6}
    ceil_min = float(band.get("ceiling_height_ft_min") or 9.5)
    win_pct = float(band.get("window_area_pct_min") or 8)

    def glazing(room_id: str) -> float:
        total = 0.0
        for o in openings:
            if room_id not in o.get("between", []) or o.get("type") not in GLAZED:
                continue
            other = [x for x in o["between"] if x != room_id]
            other_type = by_id.get(other[0], {}).get("type") if other else None
            if (other and other[0] == "exterior") or other_type in OPEN_AIR:
                total += float(o.get("width_ft", 0)) * float(o.get("height_ft", 0))
        return total

    for r in rooms:
        t, rect = r.get("type"), r["rect"]
        area, width = rect["w"] * rect["d"], min(rect["w"], rect["d"])
        lv = levels.get(r.get("level"), {})
        if t in HABITABLE:
            ok = area + EPS >= hab["min_area_sqft"] and width + EPS >= hab["min_width_ft"]
            add(f"room.size:{r['id']}", f"{r['name']} size", ok,
                f"{r['name']} is {_fmt_ft(rect['w'])}×{_fmt_ft(rect['d'])} = {area:.0f} sq ft (min {hab['min_area_sqft']} sq ft, "
                f"{_fmt_ft(hab['min_width_ft'])} wide).", round(area), hab["min_area_sqft"], ids=[r["id"]])
        if t in KITCHENS:
            ok = area + EPS >= kit["min_area_sqft"] and width + EPS >= kit["min_width_ft"]
            add(f"room.size:{r['id']}", f"{r['name']} size", ok,
                f"{r['name']} is {area:.0f} sq ft (min {kit['min_area_sqft']} sq ft, {_fmt_ft(kit['min_width_ft'])} wide).",
                round(area), kit["min_area_sqft"], ids=[r["id"]])
        if t in HABITABLE | KITCHENS:
            clear = float(r.get("ceiling_height_ft") or (lv.get("height_ft", 0) - lv.get("slab_ft", 0.5)))
            if clear + EPS < ceil_min:
                add(f"room.ceiling:{r['id']}", f"{r['name']} clear height", False,
                    f"Clear height {_fmt_ft(clear)} is below {_fmt_ft(ceil_min)}.", round(clear, 2), ceil_min, ids=[r["id"]])
            g = glazing(r["id"])
            need = area * win_pct / 100
            add(f"room.light:{r['id']}", f"{r['name']} daylight", g + EPS >= need,
                f"Glazing {g:.0f} sq ft vs {need:.0f} sq ft needed ({win_pct:g}% of floor area)." if g + EPS >= need else
                f"{r['name']} has {g:.0f} sq ft of glazing to the outside; LDA needs {need:.0f} sq ft ({win_pct:g}% of floor area).",
                round(g, 1), round(need, 1), ids=[r["id"]])
        if t in WETS:
            g = glazing(r["id"])
            add(f"room.vent:{r['id']}", f"{r['name']} ventilation", g + EPS >= 2,
                "Has an external opening ≥ 2 sq ft." if g + EPS >= 2 else
                f"{r['name']} has no external opening; LDA asks for ≥ 2 sq ft (add a ventilator or a duct/shaft).",
                round(g, 1), 2, ids=[r["id"]], warn=True)
        if t not in OPEN_AIR and t not in ("stair",):
            has_door = any(r["id"] in o.get("between", []) and o.get("type") not in ("window", "corner_window", "ventilator")
                           for o in openings)
            if not has_door and not r.get("open_to"):
                add(f"room.access:{r['id']}", f"{r['name']} access", False, f"{r['name']} has no door or opening to enter it.",
                    ids=[r["id"]], warn=True)

    # --- Stairs -----------------------------------------------------------------------------------
    for st in plan.get("stairs", []):
        frm, to = levels.get(st.get("from_level")), levels.get(st.get("to_level"))
        rise_ft = (to["elevation_ft"] - frm["elevation_ft"]) if frm and to else 11
        riser = float(st.get("riser_in", 7))
        n_risers = math.ceil(rise_ft * 12 / riser - 1e-6) if riser else 0
        flights = 2 if st.get("kind") in ("dogleg", "l_shape") else 1
        per_flight = math.ceil(n_risers / flights) if flights else n_risers
        ok = st.get("width_ft", 0) + EPS >= 3.5 and riser <= 7.5 + EPS and st.get("tread_in", 0) + EPS >= 10 and per_flight <= 15
        add(f"stair:{st['id']}", "Staircase", ok,
            f"{flights} flight(s), {n_risers} risers of {riser:g}″ ({per_flight}/flight), treads {st.get('tread_in', 0):g}″, "
            f"width {_fmt_ft(st.get('width_ft', 0))} (LDA: width ≥ 3′6″, riser ≤ 7½″, tread ≥ 10″, ≤ 15 risers per flight).",
            per_flight, 15, ids=[st["id"]])

    # --- Services ---------------------------------------------------------------------------------
    marla = plot_area / MARLA_SQFT
    if marla >= 3:
        has_tank = bool((plan.get("roof") or {}).get("water_tank"))
        add("services.water_tank", "Overhead water tank", has_tank,
            "Overhead water tank on the roof." if has_tank else "Plots of 3 marla and above need overhead and underground water tanks.",
            warn=True)

    fails = [c for c in checks if c["status"] == "fail"]
    return {
        "authority": authority, "band": band["label"], "ok": not fails, "checks": checks,
        "envelope": {"setbacks_ft": env["setbacks_ft"], "max_coverage_pct": env["max_coverage_pct"],
                     "max_height_ft": env["max_height_ft"], "max_storeys": env["max_storeys"], "buildable_rect": env["buildable_rect"]},
        "metrics": {"plot_area_sqft": round(plot_area, 1), "covered_area_sqft": round(covered, 1), "coverage_pct": round(cov_pct, 1),
                    "total_floor_area_sqft": round(floor_area, 1), "far": round(far, 2), "height_ft": round(top, 2), "storeys": n_storeys},
    }


def violations_text(report: dict) -> str:
    """Compact list of failing/warning checks for feeding back to Argon."""
    lines = [f"- [{c['status'].upper()}] {c['title']}: {c['message']} (ids: {', '.join(c['element_ids']) or '-'})"
             for c in report["checks"] if c["status"] != "pass"]
    return "\n".join(lines) or "(none)"


def check_asbuilt(plan: dict, summary: dict) -> dict:
    """As-built checks on the 3D result: nothing built may project into a mandatory open space beyond what LDA allows
    for sunshades/chajjas (3 ft where that open space is ≥ 10 ft, otherwise 1.5 ft; 0 against a party wall).
    Light fixtures and glows are ignored; a 0.5 ft tolerance covers exterior wall thickness and finishes."""
    site = plan.get("site", {})
    W, D = site["plot"]["width_ft"], site["plot"]["depth_ft"]
    sb = {**{"front": 0, "rear": 0, "left": 0, "right": 0}, **(site.get("setbacks_ft") or {})}
    env = envelope(W, D, site.get("authority", "LDA"))
    band = env.pop("_band")

    def allow(space: float) -> float:
        return 0.0 if space <= 0 else (3.0 if space >= 10 else 1.5)

    tol = 0.5
    lim = {k: allow(v) + tol for k, v in sb.items()}
    x0, y0, x1, y1 = sb["left"], sb["front"], W - sb["right"], D - sb["rear"]
    skip = ("site", "boundary", "gate", "light", "glow", "facade:wall_light", "facade:led_strip", "lamp", "fixture", "street", "tree")
    checks = []
    for o in summary.get("objects", []):
        kind = (o.get("kind") or "").lower()
        if o.get("layer") not in ("facade", "structure", "custom") or kind.startswith(skip) or any(t in kind for t in ("light", "glow")):
            continue
        mn, mx = o["bbox_ft"]["min"], o["bbox_ft"]["max"]
        if mx[2] < 3:  # at ground level (plinth, paving), not a projection
            continue
        over = {"front": y0 - mn[1], "rear": mx[1] - y1, "left": x0 - mn[0], "right": mx[0] - x1}
        side, amount = max(over.items(), key=lambda kv: kv[1] - lim[kv[0]])
        if amount > lim[side]:
            what = (o.get("kind") or o.get("id") or "element").split(":")[-1].replace("_", " ")
            checks.append({"id": f"asbuilt.projection:{o['id']}", "title": "Projection into open space", "status": "fail",
                           "message": f"The {what} project{'' if what.endswith('s') else 's'} {amount:.1f} ft into the {side} open space (LDA allows "
                                      f"{allow(sb[side]):g} ft for sunshades there).",
                           "rule_ref": f"{REF} §2.7 (projections)", "element_ids": [o["id"]]})
    for e in summary.get("section_errors", []):
        checks.append({"id": f"asbuilt.section:{e['section']}", "title": "3D section error", "status": "warn",
                       "message": f"Section {e['section']} failed: {e['error'][:200]}", "element_ids": []})
    return {"authority": site.get("authority", "LDA"), "band": band["label"], "ok": not any(c["status"] == "fail" for c in checks),
            "checks": checks or [{"id": "asbuilt.ok", "title": "As-built projections", "status": "pass",
                                  "message": "Nothing projects into the mandatory open spaces beyond LDA's sunshade allowance.",
                                  "element_ids": []}],
            "envelope": {}, "metrics": {}}
