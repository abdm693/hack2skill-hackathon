"""Floor plans as images, for the architect's self-review (and for anyone who wants to see what was checked).

Each level of a BuildingPlan is drawn the way an architect's sketch reads: the plot and setback line, rooms with names and
sizes, walls, doors with their swings, windows, stairs with treads and an UP arrow, the stair tower and tank on the roof.
The road is at the bottom of the sheet. Pure Pillow, no I/O.
"""
from __future__ import annotations

import io
import math
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFont

from ..compliance.planning import CIRC, DOORS, HINGED, OPEN, PRIVATE, SERVICE, WET, PlanIndex, rect_of, sides

INK = (29, 29, 31)
INK2 = (90, 90, 96)
INK3 = (150, 150, 156)
WALL = (40, 40, 44)
PAPER = (255, 255, 255)
ACCENT = (196, 92, 52)
GLASS = (60, 130, 200)
FILL = {
    "private": (232, 238, 250), "wet": (222, 242, 246), "circ": (246, 243, 236), "living": (250, 241, 228),
    "service": (238, 244, 232), "open": (241, 247, 238), "other": (244, 244, 246),
}


@lru_cache(maxsize=8)
def _font(size: int, bold: bool = False):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:  # very old Pillow
        return ImageFont.load_default()


def _cls(t: str) -> str:
    if t in PRIVATE:
        return "private"
    if t in WET:
        return "wet"
    if t in CIRC:
        return "circ"
    if t in SERVICE:
        return "service"
    if t in OPEN:
        return "open"
    if t in {"lounge", "dining", "drawing", "prayer", "study", "dressing"}:
        return "living"
    return "other"


def _fmt(v: float) -> str:
    feet = int(v + 1e-9)
    inch = round((v - feet) * 12)
    if inch == 12:
        feet, inch = feet + 1, 0
    return f"{feet}'{inch}\"" if inch else f"{feet}'"


def render_level(plan: dict, level_id: str, px_per_ft: float | None = None) -> bytes:
    ix = PlanIndex(plan)
    W, D = ix.W or 35, ix.D or 65
    s = px_per_ft or max(10.0, min(20.0, 1150.0 / max(W, D)))
    m, top, bottom = 56, 70, 70
    img = Image.new("RGB", (int(W * s + 2 * m), int(D * s + top + bottom)), PAPER)
    dr = ImageDraw.Draw(img)

    def P(x, y):
        return (m + x * s, top + (D - y) * s)

    def box(r):
        x0, y0, x1, y1 = r
        a, b = P(x0, y1), P(x1, y0)
        return [a[0], a[1], b[0], b[1]]

    lv = ix.lv.get(level_id, {})
    is_roof = level_id == ix.roof_id
    f_title, f_room, f_small = _font(22), _font(max(12, int(s * 0.8))), _font(max(10, int(s * 0.62)))
    title = f"{lv.get('name') or level_id}  ·  plot {W:g} x {D:g} ft  ·  road at the bottom"
    dr.text((m, 20), title, fill=INK, font=f_title)

    # plot, setback line, road
    dr.rectangle(box((0, 0, W, D)), outline=INK3, width=1)
    sb = ix.sb
    _dashed_rect(dr, box((sb["left"], sb["front"], W - sb["right"], D - sb["rear"])), ACCENT, 6, 5)
    dr.text((m, top + D * s + 12), "ROAD", fill=INK2, font=f_small)

    # a faint ghost of the floor below helps read what sits over what
    order = [x["id"] for x in ix.levels]
    if level_id in order and order.index(level_id) > 0:
        below = order[order.index(level_id) - 1]
        for r in ix.level_rooms(below):
            if r.get("type") not in OPEN:
                dr.rectangle(box(ix.R[r["id"]]), outline=(225, 225, 230), width=1)

    rooms = ix.level_rooms(level_id)
    for r in sorted(rooms, key=lambda r: r.get("type") not in OPEN):
        rr = ix.R[r["id"]]
        dr.rectangle(box(rr), fill=FILL[_cls(r.get("type", ""))])
    # walls: enclosed room edges in ink, open-air edges dashed
    for r in rooms:
        rr = ix.R[r["id"]]
        if r.get("type") in OPEN:
            _dashed_rect(dr, box(rr), INK3, 5, 4)
        else:
            dr.rectangle(box(rr), outline=WALL, width=max(2, int(s * 0.28)))
    # open_to edges: erase the wall and dash it
    for (a, b), res in ix.open_pairs.items():
        e = res.get("edge")
        if not e or ix.by_id.get(a, {}).get("level") != level_id:
            continue
        axis, c, lo, hi = e
        p0, p1 = (P(lo, c), P(hi, c)) if axis == "x" else (P(c, lo), P(c, hi))
        dr.line([p0, p1], fill=FILL["living"], width=max(3, int(s * 0.35)))
        _dashed_line(dr, p0, p1, INK3 if res["valid"] else ACCENT, 4, 4, 1)

    # stairs
    departing = [st for st in ix.stairs if st.get("from_level") == level_id]
    for st in departing or [st for st in ix.stairs if st.get("to_level") == level_id][:1]:
        _draw_stair(dr, P, s, ix.stair_geo(st), up=bool(departing), font=f_small)

    # roof furniture
    if is_roof:
        if ix.mumty:
            dr.rectangle(box(ix.mumty), fill=(236, 232, 224), outline=WALL, width=max(2, int(s * 0.28)))
            ds = (ix.roof.get("mumty") or {}).get("door_side")
            if ds:
                axis, c, lo, hi, n = sides(ix.mumty)[ds]
                mid = (lo + hi) / 2
                p0, p1 = (P(mid - 1.5, c), P(mid + 1.5, c)) if axis == "x" else (P(c, mid - 1.5), P(c, mid + 1.5))
                dr.line([p0, p1], fill=ACCENT, width=max(4, int(s * 0.4)))
            cx, cy = (ix.mumty[0] + ix.mumty[2]) / 2, (ix.mumty[1] + ix.mumty[3]) / 2
            _label(dr, P(cx, cy), ["Stair tower", f"door: {ds or '?'}"], f_small, INK)
        t = ix.roof.get("water_tank")
        if t and t.get("rect"):
            tr = rect_of(t)
            dr.rectangle(box(tr), outline=GLASS, width=2)
            _label(dr, P((tr[0] + tr[2]) / 2, (tr[1] + tr[3]) / 2), [f"Tank ({t.get('material') or 'tank'})"], f_small, GLASS)
        if ix.top:
            for r in ix.level_rooms(ix.top):
                if r.get("type") not in OPEN:
                    dr.rectangle(box(ix.R[r["id"]]), outline=(200, 200, 206), width=1)

    # openings
    for o in ix.openings:
        if o.get("level") != level_id:
            continue
        _draw_opening(dr, P, s, ix, o)

    # labels last so nothing covers them
    for r in rooms:
        rr = ix.R[r["id"]]
        w, d = rr[2] - rr[0], rr[3] - rr[1]
        cx, cy = (rr[0] + rr[2]) / 2, (rr[1] + rr[3]) / 2
        lines = [r.get("name") or r["id"], f"{_fmt(w)} x {_fmt(d)}"]
        if r.get("type") not in OPEN and w * d >= 30:
            lines.append(f"{w * d:.0f} sq ft")
        _label(dr, P(cx, cy), lines, f_room if min(w, d) * s >= 70 else f_small, INK2 if r.get("type") in OPEN else INK)

    # north arrow from the facing
    _north(dr, (img.width - m - 10, 34), plan.get("site", {}).get("facing") or "N", f_small)
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def render_all(plan: dict) -> list[tuple[str, str, bytes]]:
    """[(level_id, level_name, png)] for every level that has rooms, stairs or roof furniture."""
    ix = PlanIndex(plan)
    out = []
    for lv in ix.levels:
        lid = lv["id"]
        if ix.level_rooms(lid) or lid == ix.roof_id or any(s.get("from_level") == lid for s in ix.stairs):
            out.append((lid, lv.get("name") or lid, render_level(plan, lid)))
    return out


# --- primitives ---------------------------------------------------------------------------------------------------------
def _label(dr, xy, lines, font, color):
    x, y = xy
    hs = [dr.textbbox((0, 0), t, font=font) for t in lines]
    total = sum(b[3] - b[1] + 3 for b in hs)
    cy = y - total / 2
    for t, b in zip(lines, hs):
        tw = b[2] - b[0]
        dr.text((x - tw / 2, cy), t, fill=color, font=font)
        cy += b[3] - b[1] + 3


def _dashed_line(dr, p0, p1, color, dash, gap, width=1):
    x0, y0 = p0
    x1, y1 = p1
    L = math.hypot(x1 - x0, y1 - y0)
    if L < 1:
        return
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    t = 0.0
    while t < L:
        e = min(L, t + dash)
        dr.line([(x0 + ux * t, y0 + uy * t), (x0 + ux * e, y0 + uy * e)], fill=color, width=width)
        t = e + gap


def _dashed_rect(dr, b, color, dash, gap):
    x0, y0, x1, y1 = b
    for p, q in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0))):
        _dashed_line(dr, p, q, color, dash, gap, 1)


def _draw_opening(dr, P, s, ix: PlanIndex, o: dict):
    inf = ix.info.get(o["id"]) or {}
    x, y = float(o["at"][0]), float(o["at"][1])
    w = float(o.get("width_ft") or 3)
    axis = None
    if inf.get("edge"):
        axis = inf["edge"][0]
    elif inf.get("side"):
        axis = "x" if inf["side"] in ("front", "back") else "y"
    else:
        axis = "x"
    a0, a1 = ((x - w / 2, y), (x + w / 2, y)) if axis == "x" else ((x, y - w / 2), (x, y + w / 2))
    p0, p1 = P(*a0), P(*a1)
    t = o.get("type")
    bad = not inf.get("valid", False)
    if t in DOORS:
        dr.line([p0, p1], fill=PAPER, width=max(4, int(s * 0.36)))  # the gap in the wall
        if t in HINGED:
            # swing into between[0] (or out of it), quarter circle from the hinge
            into = o["between"][0] if o.get("swing") != "out" else o["between"][1]
            r = ix.R.get(into)
            sign = 1
            if r:
                if axis == "x":
                    sign = 1 if (r[1] + r[3]) / 2 > y else -1
                else:
                    sign = 1 if (r[0] + r[2]) / 2 > x else -1
            hinge = a0
            leaf_end = (hinge[0], hinge[1] + sign * w) if axis == "x" else (hinge[0] + sign * w, hinge[1])
            col = ACCENT if bad else (ACCENT if t == "main_door" else INK)
            dr.line([P(*hinge), P(*leaf_end)], fill=col, width=2)
            steps = 10
            pts = []
            for k in range(steps + 1):
                ang = (math.pi / 2) * k / steps
                if axis == "x":
                    pts.append(P(hinge[0] + w * math.cos(ang), hinge[1] + sign * w * math.sin(ang)))
                else:
                    pts.append(P(hinge[0] + sign * w * math.sin(ang), hinge[1] + w * math.cos(ang)))
            dr.line(pts, fill=col, width=1)
        else:  # arch, sliding or garage: a dashed gap
            _dashed_line(dr, p0, p1, ACCENT if bad else INK2, 3, 3, 2)
    else:  # windows and ventilators: a double glass line
        col = ACCENT if bad else GLASS
        off = max(2, int(s * 0.12))
        if axis == "x":
            dr.line([(p0[0], p0[1] - off), (p1[0], p1[1] - off)], fill=col, width=2)
            dr.line([(p0[0], p0[1] + off), (p1[0], p1[1] + off)], fill=col, width=2)
        else:
            dr.line([(p0[0] - off, p0[1]), (p1[0] - off, p1[1])], fill=col, width=2)
            dr.line([(p0[0] + off, p0[1]), (p1[0] + off, p1[1])], fill=col, width=2)


def _draw_stair(dr, P, s, g: dict, up: bool, font):
    x0, y0, x1, y1 = g["rect"]
    a, b = P(x0, y1), P(x1, y0)
    dr.rectangle([a[0], a[1], b[0], b[1]], outline=INK, width=1)
    along_y = g["start"] in ("+y", "-y")
    T = g["T"]
    n1 = max(1, math.ceil(g["N"] / 2)) if g["kind"] == "dogleg" else g["N"]
    # tread lines over the flight length (the far end of a dog-leg is the mid-landing)
    flight_len = (n1 - 1) * T
    start_edge = {"+y": y0, "-y": y1, "+x": x0, "-x": x1}[g["start"]]
    sign = 1 if g["start"] in ("+y", "+x") else -1
    half = (x0 + x1) / 2 if along_y else (y0 + y1) / 2
    for k in range(n1):
        c = start_edge + sign * k * T
        if along_y:
            dr.line([P(x0, c), P(x1 if g["kind"] != "dogleg" else x1, c)], fill=INK3, width=1)
        else:
            dr.line([P(c, y0), P(c, y1)], fill=INK3, width=1)
    if g["kind"] == "dogleg":  # the well between the two flights
        if along_y:
            dr.line([P(half, start_edge), P(half, start_edge + sign * flight_len)], fill=INK, width=2)
        else:
            dr.line([P(start_edge, half), P(start_edge + sign * flight_len, half)], fill=INK, width=2)
    # UP arrow on the first flight
    q = (x0 + half) / 2 if along_y else (y0 + half) / 2
    if along_y:
        p_from, p_to = P(q, start_edge + sign * 0.6), P(q, start_edge + sign * min(flight_len, 6))
    else:
        p_from, p_to = P(start_edge + sign * 0.6, q), P(start_edge + sign * min(flight_len, 6), q)
    dr.line([p_from, p_to], fill=ACCENT, width=2)
    ang = math.atan2(p_to[1] - p_from[1], p_to[0] - p_from[0])
    for d in (2.6, -2.6):
        dr.line([p_to, (p_to[0] - 9 * math.cos(ang + d / 2.2), p_to[1] - 9 * math.sin(ang + d / 2.2))], fill=ACCENT, width=2)
    dr.text((p_from[0] + 4, p_from[1] + 2), "UP" if up else "DN", fill=ACCENT, font=font)


def _north(dr, xy, facing: str, font):
    """Arrow pointing to true north given that the road side (bottom of the sheet) faces `facing`."""
    deg = {"N": 0, "NE": 45, "E": 90, "SE": 135, "S": 180, "SW": 225, "W": 270, "NW": 315}.get(facing, 0)
    # the road (bottom of the sheet, screen +y) faces `facing`; north is `deg` degrees anticlockwise from it... rotate
    ang = math.radians(90 - deg)  # screen angle of north: down when the front faces north, right when it faces east
    cx, cy = xy
    L = 16
    tip = (cx + L * math.cos(ang), cy + L * math.sin(ang))
    tail = (cx - L * math.cos(ang), cy - L * math.sin(ang))
    dr.line([tail, tip], fill=INK, width=2)
    dr.ellipse([tip[0] - 3, tip[1] - 3, tip[0] + 3, tip[1] + 3], fill=INK)
    dr.text((tip[0] + 5, tip[1] - 6), "N", fill=INK, font=font)
