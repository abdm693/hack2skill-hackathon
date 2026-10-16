"""Naqsha planning rules: deterministic livability checks on a BuildingPlan.

These are the objective rules from docs/review/architecture-rules.md Part A (P-01 to P-26): openings that really sit on
the wall they claim, rooms that are independent (a bedroom never opens into another bedroom), every room reachable through
circulation, stairs that reach the roof under a stair tower whose door is at the top landing, and adherence to the brief
(bedroom count, rooms per floor, attached baths, solar-ready roof). Every check has category "livable", a plain-English
`message` for the family and a `fix` hint that the fix loop feeds back to the planner.

Units are plan feet and the conventions of contracts/plan.ts. The module is standalone (no I/O), so lda.check() and the
revision agent's tools can both call it.
"""
from __future__ import annotations

import logging
import math
import re
from collections import defaultdict, deque
from typing import Iterable

log = logging.getLogger("naqsha.planning")

EPS = 0.05
PRIVATE = {"bedroom", "master_bedroom", "guest_bedroom", "servant"}
BEDROOMS = {"bedroom", "master_bedroom", "guest_bedroom"}
WET = {"bath", "powder"}
CIRC = {"lobby", "corridor", "stair"}
LIVING = {"lounge", "dining", "drawing", "prayer", "study"}
SERVICE = {"kitchen", "dirty_kitchen", "laundry", "store"}
KITCHENS = {"kitchen", "dirty_kitchen"}
OPEN = {"porch", "balcony", "terrace", "lawn", "driveway", "open_space", "courtyard"}
GROUND_OUT = {"porch", "lawn", "driveway", "open_space", "courtyard"}  # connect to the street at ground level
DOORS = {"main_door", "door", "double_door", "sliding_door", "arch", "garage_door"}
HINGED = {"main_door", "door", "double_door"}
GLAZED = {"window", "corner_window", "sliding_door", "ventilator"}
HABITABLE = {"drawing", "lounge", "dining", "bedroom", "master_bedroom", "guest_bedroom", "study", "servant"}

REF = "Naqsha planning rule"
IBC = "IBC 2021"
EXT, ROOF, MUMTY = "EXT", "ROOF", "MUMTY"

Rect = tuple[float, float, float, float]  # x0, y0, x1, y1


# --- geometry -----------------------------------------------------------------------------------------------------
def rect_of(r: dict) -> Rect:
    q = r["rect"] if "rect" in r else r
    x, y, w, d = float(q["x"]), float(q["y"]), float(q["w"]), float(q["d"])
    return (x, y, x + w, y + d)


def area(a: Rect) -> float:
    return max(0.0, a[2] - a[0]) * max(0.0, a[3] - a[1])


def inter(a: Rect, b: Rect) -> Rect | None:
    r = (max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3]))
    return r if r[2] > r[0] + 1e-9 and r[3] > r[1] + 1e-9 else None


def overlap_area(a: Rect, b: Rect) -> float:
    i = inter(a, b)
    return area(i) if i else 0.0


def within(a: Rect, b: Rect, tol: float = 0.1) -> bool:
    """a lies inside b."""
    return a[0] >= b[0] - tol and a[1] >= b[1] - tol and a[2] <= b[2] + tol and a[3] <= b[3] + tol


def contains(a: Rect, x: float, y: float, tol: float = 0.0) -> bool:
    return a[0] - tol <= x <= a[2] + tol and a[1] - tol <= y <= a[3] + tol


def union_rect(*rs: Rect) -> Rect:
    return (min(r[0] for r in rs), min(r[1] for r in rs), max(r[2] for r in rs), max(r[3] for r in rs))


def union_area(rects: list[Rect]) -> float:
    """Exact area of a union of axis-aligned rects (coordinate compression)."""
    if not rects:
        return 0.0
    xs = sorted({r[0] for r in rects} | {r[2] for r in rects})
    ys = sorted({r[1] for r in rects} | {r[3] for r in rects})
    total = 0.0
    for i in range(len(xs) - 1):
        for j in range(len(ys) - 1):
            cx, cy = (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2
            if any(r[0] <= cx <= r[2] and r[1] <= cy <= r[3] for r in rects):
                total += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j])
    return total


def shared_edge(a: Rect, b: Rect, tol: float = 0.05):
    """(axis, c, lo, hi) when rects a and b touch along a segment longer than tol. axis "x": the edge runs along x at
    y=c; axis "y": it runs along y at x=c."""
    for ca, cb in ((a[2], b[0]), (a[0], b[2])):
        if abs(ca - cb) <= tol:
            lo, hi = max(a[1], b[1]), min(a[3], b[3])
            if hi - lo > tol:
                return ("y", (ca + cb) / 2, lo, hi)
    for ca, cb in ((a[3], b[1]), (a[1], b[3])):
        if abs(ca - cb) <= tol:
            lo, hi = max(a[0], b[0]), min(a[2], b[2])
            if hi - lo > tol:
                return ("x", (ca + cb) / 2, lo, hi)
    return None


def sides(a: Rect) -> dict[str, tuple[str, float, float, float, tuple[int, int]]]:
    """side -> (axis, c, lo, hi, outward normal)."""
    return {"front": ("x", a[1], a[0], a[2], (0, -1)), "back": ("x", a[3], a[0], a[2], (0, 1)),
            "left": ("y", a[0], a[1], a[3], (-1, 0)), "right": ("y", a[2], a[1], a[3], (1, 0))}


def fmt(v: float) -> str:
    """Feet and inches: 3′6″."""
    v = max(0.0, float(v))
    feet = int(v + 1e-9)
    inches = round((v - feet) * 12)
    if inches == 12:
        feet, inches = feet + 1, 0
    return f"{feet}′{inches}″" if inches else f"{feet}′"


def ft(v: float) -> str:
    return f"{v:.1f}".rstrip("0").rstrip(".") + " ft"


# --- the plan, indexed -------------------------------------------------------------------------------------------
class PlanIndex:
    """Indexes a BuildingPlan once: levels, rooms, opening validity, the circulation graph and stair geometry."""

    def __init__(self, plan: dict):
        self.plan = plan
        site = plan.get("site") or {}
        plot = site.get("plot") or {}
        self.W, self.D = float(plot.get("width_ft") or 0), float(plot.get("depth_ft") or 0)
        self.sb = {"front": 0.0, "rear": 0.0, "left": 0.0, "right": 0.0,
                   **{k: float(v or 0) for k, v in (site.get("setbacks_ft") or {}).items()}}
        self.levels = sorted([lv for lv in plan.get("levels") or [] if lv.get("id")], key=lambda lv: lv.get("index", 0))
        self.lv = {lv["id"]: lv for lv in self.levels}
        self.rooms = [r for r in plan.get("rooms") or [] if r.get("id") and _rect_ok(r.get("rect"))]
        self.by_id = {r["id"]: r for r in self.rooms}
        self.R = {r["id"]: rect_of(r) for r in self.rooms}
        self.openings = [o for o in plan.get("openings") or [] if o.get("id") and _pt_ok(o.get("at"))
                         and isinstance(o.get("between"), list) and len(o["between"]) == 2]
        self.stairs = [s for s in plan.get("stairs") or [] if s.get("id") and _rect_ok(s.get("rect"))]
        self.roof = plan.get("roof") or {}
        self.roof_id = self._roof_level()
        self.storeys = [lv["id"] for lv in self.levels if lv["id"] != self.roof_id and any(
            r.get("level") == lv["id"] and r.get("type") not in OPEN for r in self.rooms)]
        self.top = self.storeys[-1] if self.storeys else None
        self.ground = next((lv["id"] for lv in self.levels if lv.get("index") == 0), self.storeys[0] if self.storeys else "ground")
        m = self.roof.get("mumty")
        self.mumty: Rect | None = rect_of(m) if m and _rect_ok(m.get("rect")) else None
        self.info = {o["id"]: self._opening_info(o) for o in self.openings}
        self.open_pairs = self._open_to_pairs()
        self._graph()

    # levels ---------------------------------------------------------------------------------
    def _roof_level(self) -> str | None:
        for lv in self.levels:
            if lv["id"] == "roof" or "roof" in str(lv.get("name", "")).lower():
                return lv["id"]
        return self.levels[-1]["id"] if len(self.levels) > 1 else None

    def lname(self, lid: str | None) -> str:
        lv = self.lv.get(lid or "")
        return (lv or {}).get("name") or (lid or "?")

    def name(self, rid: str) -> str:
        if rid == EXT:
            return "outside"
        if rid == ROOF:
            return "the roof"
        if rid == MUMTY:
            return "the stair tower"
        return (self.by_id.get(rid) or {}).get("name") or rid

    def type(self, rid: str) -> str:
        return (self.by_id.get(rid) or {}).get("type", "")

    def level_rooms(self, lid: str) -> list[dict]:
        return [r for r in self.rooms if r.get("level") == lid]

    def room_at(self, lid: str, x: float, y: float, exclude: Iterable[str] = (), enclosed: bool | None = None) -> str | None:
        best = None
        for r in self.level_rooms(lid):
            if r["id"] in exclude:
                continue
            if enclosed is True and r.get("type") in OPEN:
                continue
            if contains(self.R[r["id"]], x, y, 1e-6):
                a = area(self.R[r["id"]])
                key = (r.get("type") in OPEN, a)  # prefer enclosed, then the smallest
                if best is None or key < best[0]:
                    best = (key, r["id"])
        return best[1] if best else None

    def on_party_line(self, axis: str, c: float, lo: float, hi: float) -> str | None:
        """The plot side whose boundary this edge lies on, when that side has a zero setback (a party wall)."""
        if axis == "y":
            if abs(c) <= 0.4 and self.sb["left"] <= EPS:
                return "left"
            if abs(c - self.W) <= 0.4 and self.sb["right"] <= EPS:
                return "right"
        else:
            if abs(c - self.D) <= 0.4 and self.sb["rear"] <= EPS:
                return "rear"
        return None

    # openings ---------------------------------------------------------------------------------
    def _opening_info(self, o: dict) -> dict:
        """Validity of an opening (P-01, P-02, P-03): which rooms it really joins, on which wall."""
        lid = o.get("level")
        a_id, b_id = o["between"]
        x, y = float(o["at"][0]), float(o["at"][1])
        w = float(o.get("width_ft") or 0)
        info = {"valid": False, "kind": "pair", "rooms": [], "problems": [], "warns": [], "outside": None}
        named = [b for b in (a_id, b_id) if b != "exterior"]
        for rid in named:
            r = self.by_id.get(rid)
            if not r:
                info["problems"].append(("same_level", f"{o['id']} joins a room that does not exist ({rid})."))
                return info
            if r.get("level") != lid:
                info["problems"].append(("same_level", f"{o['id']} on the {self.lname(lid)} joins {r.get('name', rid)}, which is on "
                                         f"the {self.lname(r.get('level'))}. Openings can only join rooms on the same floor."))
                return info
        if not named:
            info["problems"].append(("on_edge", f"{o['id']} does not name a room."))
            return info
        if len(named) == 2:
            A, B = self.by_id[a_id], self.by_id[b_id]
            e = shared_edge(self.R[a_id], self.R[b_id])
            info["rooms"] = [a_id, b_id]
            if not e:
                info["problems"].append(("on_edge", f"{A['name']} and {B['name']} don't share a wall, so {o['id']} between them "
                                                    f"can't be built."))
                return info
            axis, c, lo, hi = e
            across, along = (abs(y - c), x) if axis == "x" else (abs(x - c), y)
            info["edge"] = e
            if across > 0.75 or not (lo - 0.25 <= along <= hi + 0.25):
                info["problems"].append(("on_edge", f"{o['id']} is not on the wall between {A['name']} and {B['name']}."))
                return info
            if o.get("type") != "corner_window" and hi - lo < w + 0.25:
                info["problems"].append(("on_edge", f"{o['id']} ({fmt(w)}) doesn't fit the {fmt(hi - lo)} wall between "
                                                    f"{A['name']} and {B['name']}."))
                return info
            if along - w / 2 < lo - 0.25 or along + w / 2 > hi + 0.25:
                info["problems"].append(("on_edge", f"{o['id']} runs past the end of the wall between {A['name']} and {B['name']}."))
                return info
            if along - w / 2 < lo + 0.3 - 1e-6 or along + w / 2 > hi - 0.3 + 1e-6:
                info["warns"].append(f"{o['id']} sits tight against a corner; leave about 4 in for the frame.")
            info["valid"] = True
            return info
        # one room + exterior
        info["kind"] = "ext"
        rid = named[0]
        A = self.by_id[rid]
        info["rooms"] = [rid]
        best = None
        for side, (axis, c, lo, hi, n) in sides(self.R[rid]).items():
            across, along = (abs(y - c), x) if axis == "x" else (abs(x - c), y)
            if across <= 0.75 and lo - 0.25 <= along <= hi + 0.25 and (best is None or across < best[0]):
                best = (across, side, axis, c, lo, hi, n, along)
        if not best:
            info["problems"].append(("on_edge", f"{o['id']} is not on an outside wall of {A['name']}."))
            return info
        _, side, axis, c, lo, hi, n, along = best
        info["side"] = side
        px, py = (along, c) if axis == "x" else (c, along)
        ox, oy = px + n[0] * 0.4, py + n[1] * 0.4
        out = self.room_at(lid, ox, oy, exclude=[rid])
        if out and self.type(out) not in OPEN:
            info["problems"].append(("on_edge", f"{o['id']} is drawn to the outside but {A['name']}'s {side} wall faces "
                                                f"{self.name(out)}."))
            return info
        party = self.on_party_line(axis, c, lo, hi)
        if party and not out and o.get("type") != "arch":
            info["problems"].append(("party_wall", f"{o['id']} is on the {party} party wall. The neighbour builds right against it."))
            return info
        if lid not in (self.ground, self.roof_id) and o.get("type") in DOORS and not out:
            info["problems"].append(("door_to_drop", f"{o['id']} is a door from {A['name']} straight out of the "
                                                     f"{self.lname(lid)} with nothing to step onto."))
            return info
        if w > 0 and o.get("type") != "corner_window" and hi - lo < w - 0.25:
            info["problems"].append(("on_edge", f"{o['id']} ({fmt(w)}) is wider than {A['name']}'s {fmt(hi - lo)} {side} wall."))
            return info
        info["outside"] = out
        info["valid"] = True
        return info

    def _open_to_pairs(self) -> dict[tuple[str, str], dict]:
        pairs: dict[tuple[str, str], dict] = {}
        for r in self.rooms:
            for other in r.get("open_to") or []:
                key = tuple(sorted((r["id"], other)))
                if key in pairs:
                    continue
                b = self.by_id.get(other)
                res = {"valid": False, "problem": None, "edge": None}
                if not b or b.get("level") != r.get("level"):
                    res["problem"] = f"{r['name']} is open to {other}, which is not on the same floor."
                else:
                    e = shared_edge(self.R[r["id"]], self.R[other])
                    if not e or e[3] - e[2] < 3.0:
                        res["problem"] = (f"{r['name']} is open to {b['name']} but they don't share a wall at least 3 ft long, "
                                          f"so no connection is built.")
                    elif r.get("type") in PRIVATE | WET or b.get("type") in PRIVATE | WET:
                        res["problem"] = f"{r['name']} can't be open-plan to {b['name']}; bedrooms and baths need doors."
                        res["edge"] = e
                    elif {r.get("type"), b.get("type")} & KITCHENS and {r.get("type"), b.get("type")} & (PRIVATE | WET):
                        res["problem"] = f"{r['name']} can't be open to {b['name']}."
                    else:
                        res["valid"], res["edge"] = True, e
                pairs[key] = res
        return pairs

    # graph ------------------------------------------------------------------------------------
    def _graph(self) -> None:
        self.adj: dict[str, set[str]] = defaultdict(set)       # every connection, incl. stairs
        self.door_adj: dict[str, set[str]] = defaultdict(set)  # doors and open_to only
        self.door_ops: dict[str, list[dict]] = defaultdict(list)

        def link(a, b, door=True):
            if not a or not b or a == b:
                return
            self.adj[a].add(b)
            self.adj[b].add(a)
            if door:
                self.door_adj[a].add(b)
                self.door_adj[b].add(a)

        for o in self.openings:
            inf = self.info[o["id"]]
            if not inf["valid"] or o.get("type") not in DOORS:
                continue
            if inf["kind"] == "pair":
                a, b = inf["rooms"]
                link(a, b)
                self.door_ops[a].append(o)
                self.door_ops[b].append(o)
            else:
                a = inf["rooms"][0]
                tgt = inf["outside"] or (EXT if o.get("level") == self.ground else ROOF if o.get("level") == self.roof_id else None)
                link(a, tgt)
                self.door_ops[a].append(o)
        for (a, b), res in self.open_pairs.items():
            if res["valid"]:
                link(a, b)
        for r in self.rooms:
            if r.get("level") == self.ground and r.get("type") in GROUND_OUT:
                link(r["id"], EXT)
            if r.get("level") == self.roof_id and r.get("type") in OPEN:
                link(r["id"], ROOF)
        self.stair_nodes: dict[str, tuple[str | None, str | None]] = {}
        for s in self.stairs:
            sr = rect_of(s)
            cx, cy = (sr[0] + sr[2]) / 2, (sr[1] + sr[3]) / 2
            a = self.room_at(s.get("from_level"), cx, cy, enclosed=True)
            b = None
            if s.get("to_level") == self.roof_id:
                b = self.room_at(self.roof_id, cx, cy, enclosed=True) if self.roof_id else None
                if not b:
                    b = MUMTY if self.mumty and contains(self.mumty, cx, cy) else ROOF
            else:
                b = self.room_at(s.get("to_level"), cx, cy, enclosed=True)
            self.stair_nodes[s["id"]] = (a, b)
            link(a, b, door=False)
        if self.mumty:
            link(MUMTY, ROOF, door=False)

    def bfs(self, starts: Iterable[str], terminal: set[str] | None = None, blocked: set[str] | None = None,
            adj: dict | None = None) -> dict[str, str | None]:
        """Breadth-first search; returns node -> parent. Terminal nodes are entered but not expanded."""
        adj = adj or self.adj
        terminal, blocked = terminal or set(), blocked or set()
        par: dict[str, str | None] = {}
        q = deque()
        for s in starts:
            if s and s not in par:
                par[s] = None
                q.append(s)
        while q:
            u = q.popleft()
            if u in terminal and par[u] is not None:
                continue
            for v in adj.get(u, ()):
                if v in par or v in blocked:
                    continue
                par[v] = u
                q.append(v)
        return par

    # stairs -----------------------------------------------------------------------------------
    def stair_geo(self, s: dict) -> dict:
        """Mirror of the engine's layoutStair (docs/review/architecture-rules.md A.1)."""
        r = rect_of(s)
        frm, to = self.lv.get(s.get("from_level")), self.lv.get(s.get("to_level"))
        rise = (float(to["elevation_ft"]) - float(frm["elevation_ft"])) if frm and to else 11.0
        riser = float(s.get("riser_in") or 7)
        n = max(1, round(rise * 12 / riser)) if riser > 0 else 1
        start = s.get("start", "+y")
        along_y = start in ("+y", "-y")
        length = (r[3] - r[1]) if along_y else (r[2] - r[0])
        breadth = (r[2] - r[0]) if along_y else (r[3] - r[1])
        kind = s.get("kind", "dogleg")
        # E = the edge where the first riser is; a dog-leg starts AND arrives there, a straight flight arrives opposite.
        e_side = {"+y": "front", "-y": "back", "+x": "left", "-x": "right"}[start] if start in ("+y", "-y", "+x", "-x") else "front"
        far_side = {"front": "back", "back": "front", "left": "right", "right": "left"}[e_side]
        return {"rect": r, "rise": rise, "N": n, "riser_in": rise * 12 / n, "T": max(float(s.get("tread_in") or 10), 10) / 12,
                "tread_in": float(s.get("tread_in") or 0), "length": length, "breadth": breadth, "kind": kind, "start": start,
                "e_side": e_side, "arrive_side": e_side if kind == "dogleg" else far_side, "width": float(s.get("width_ft") or 0)}

    def strip(self, r: Rect, side: str, depth: float) -> Rect:
        """The strip of `depth` ft just outside rect r on `side`."""
        x0, y0, x1, y1 = r
        return {"front": (x0, y0 - depth, x1, y0), "back": (x0, y1, x1, y1 + depth),
                "left": (x0 - depth, y0, x0, y1), "right": (x1, y0, x1 + depth, y1)}[side]


def _rect_ok(r) -> bool:
    try:
        return r is not None and float(r["w"]) > 0 and float(r["d"]) > 0 and math.isfinite(float(r["x"])) and math.isfinite(float(r["y"]))
    except (KeyError, TypeError, ValueError):
        return False


def _pt_ok(p) -> bool:
    try:
        return len(p) == 2 and all(math.isfinite(float(v)) for v in p)
    except (TypeError, ValueError):
        return False


# --- daylight (used by lda.glazing) -----------------------------------------------------------------------------------
def valid_glazing(ix: PlanIndex, room_id: str) -> float:
    """Glazing (sq ft) that really lights the room: a valid opening on the room's own wall, same level, to the outside or
    to a same-level porch, balcony, terrace or open space (P-01, P-02, P-03, P-16)."""
    total = 0.0
    for o in ix.openings:
        if room_id not in o["between"] or o.get("type") not in GLAZED:
            continue
        inf = ix.info[o["id"]]
        if not inf["valid"]:
            continue
        if inf["kind"] == "pair":
            other = next(r for r in inf["rooms"] if r != room_id) if len(set(inf["rooms"])) > 1 else None
            if not other or ix.type(other) not in OPEN:
                continue
        total += float(o.get("width_ft") or 0) * float(o.get("height_ft") or 0)
    return total


# --- normalisation (deterministic repairs before checking) ---------------------------------------------------------
def normalize(plan: dict) -> list[str]:
    """Deterministic repairs of small slips that don't change the design: snap each opening onto the wall it names and
    slide it along that wall so it fits with jambs. Returns a list of what was changed."""
    ix = PlanIndex(plan)
    changed = []
    for o in ix.openings:
        a_id, b_id = o["between"]
        if "exterior" in (a_id, b_id) or a_id not in ix.R or b_id not in ix.R:
            continue
        if ix.by_id[a_id].get("level") != o.get("level") or ix.by_id[b_id].get("level") != o.get("level"):
            continue
        e = shared_edge(ix.R[a_id], ix.R[b_id])
        if not e:
            continue
        axis, c, lo, hi = e
        w = float(o.get("width_ft") or 0)
        x, y = float(o["at"][0]), float(o["at"][1])
        along = x if axis == "x" else y
        if hi - lo >= w + 0.6:
            along2 = min(max(along, lo + 0.3 + w / 2), hi - 0.3 - w / 2)
        elif hi - lo >= w:
            along2 = (lo + hi) / 2
        else:
            along2 = along
        new = [round(along2, 2), round(c, 2)] if axis == "x" else [round(c, 2), round(along2, 2)]
        if abs(new[0] - x) > 0.01 or abs(new[1] - y) > 0.01:
            o["at"] = new
            changed.append(o["id"])
    return changed


# --- the checks ------------------------------------------------------------------------------------------------------
class _Out:
    def __init__(self):
        self.checks: list[dict] = []
        self.seen: set[str] = set()

    def add(self, cid: str, title: str, status: str, message: str, ids=(), fix: str | None = None, ref: str | None = None,
            value=None, limit=None, unit: str | None = None):
        if cid in self.seen:
            return
        self.seen.add(cid)
        c = {"id": cid, "title": title, "status": status, "message": message, "category": "livable",
             "rule_ref": ref or REF, "element_ids": [i for i in ids if i and i not in (EXT, ROOF, MUMTY)]}
        if value is not None:
            c["value"] = value
        if limit is not None:
            c["limit"] = limit
        if unit:
            c["unit"] = unit
        if fix:
            c["fix"] = fix
        self.checks.append(c)


def check(plan: dict, brief: dict | None = None) -> list[dict]:
    """All Naqsha planning rules for a plan (and optionally the brief it should honour)."""
    out = _Out()
    try:
        ix = PlanIndex(plan)
    except Exception as e:  # malformed plan: report it rather than crash the pipeline
        log.exception("planning index failed")
        out.add("plan.malformed", "Plan structure", "fail", f"The plan could not be read ({type(e).__name__}).")
        return out.checks
    for rule in (_openings, _open_to, _privacy, _baths, _reach, _routes, _main_door, _widths, _dead_ends, _porch,
                 _solid_walls, _bath_sizes, _stairs, _mumty, _roof_services, _program, _wet_over_dry):
        try:
            if rule in (_roof_services, _program):
                rule(ix, out, brief or {})
            else:
                rule(ix, out)
        except Exception:  # one broken rule must not hide the others
            log.exception("planning rule %s failed", rule.__name__)
    # One named rule per family, shown as a pass when none of its detailed checks failed (the failures speak for themselves).
    families = [
        ("plan.rule.independence", "Rooms are independent", ("plan.privacy",),
         "Bedrooms open only onto a corridor, lobby, lounge, balcony or their own bath; baths have one door."),
        ("plan.rule.circulation", "Every room has a proper way in", ("plan.circulation", "plan.open_to"),
         "Every room is reached through circulation, never through a bedroom or bath, and the family reaches the lounge "
         "without crossing the drawing room."),
        ("plan.rule.stairs", "Stairs reach every floor and the roof", ("plan.stair",),
         "One stacked stair climbs to every floor and the roof, with a 3 ft landing at the foot and the top."),
        ("plan.rule.roof_door", "The roof door is at the top of the stair", ("plan.roof.mumty",),
         "The stair tower covers the stair and its top landing, and its door opens beside that landing."),
        ("plan.rule.openings", "Doors and windows fit their walls", ("plan.opening",),
         "Every door and window sits on a wall the two rooms share, on the same floor, and fits inside it."),
    ]
    if brief:
        families.append(("plan.rule.brief", "Rooms match your brief", ("plan.program",),
                         "The bedrooms, baths and rooms on each floor follow the brief."))
    failed = [c["id"] for c in out.checks if c["status"] == "fail"]
    for cid, title, prefixes, msg in families:
        if not any(f.startswith(prefixes) for f in failed):
            out.add(cid, title, "pass", msg)
    return out.checks


# P-01 .. P-03 ---------------------------------------------------------------------------------------------------------
def _openings(ix: PlanIndex, out: _Out) -> None:
    hints = {
        "same_level": "Delete it. If the room needs daylight, put a window on its own outside wall or add a light well beside it.",
        "on_edge": "Put every door and window on a wall the two rooms really share, 0.5 to 1 ft from a corner; the wall must be "
                   "at least the opening width + 0.6 ft long.",
        "party_wall": "Move it to a wall that faces the front, the rear or the side open space.",
        "door_to_drop": "Add a balcony or terrace room outside it, or turn it into a window.",
    }
    titles = {"same_level": "Opening on the wrong floor", "on_edge": "Opening placement", "party_wall": "Opening on a party wall",
              "door_to_drop": "Door to nowhere"}
    for o in ix.openings:
        inf = ix.info[o["id"]]
        for code, msg in inf["problems"]:
            rid = f"plan.opening.{code}:{o['id']}"
            out.add(rid, titles[code], "fail", msg, ids=[o["id"], *inf.get("rooms", [])], fix=hints[code],
                    ref=f"{REF} P-0{'1' if code == 'same_level' else '3' if code == 'party_wall' else '2'}")


# P-04 ----------------------------------------------------------------------------------------------------------------
def _open_to(ix: PlanIndex, out: _Out) -> None:
    for (a, b), res in ix.open_pairs.items():
        if not res["valid"]:
            out.add(f"plan.open_to:{a}:{b}", "Open-plan link", "fail", res["problem"], ids=[a, b],
                    fix="Use open_to only between living rooms or circulation on the same floor that share a wall at least 3 ft "
                        "long; bedrooms and baths get doors.", ref=f"{REF} P-04")


# P-05, P-09 ---------------------------------------------------------------------------------------------------------
def _privacy(ix: PlanIndex, out: _Out) -> None:
    for r in ix.rooms:
        t = r.get("type")
        if t not in PRIVATE:
            continue
        rid = r["id"]
        for nb in sorted(ix.door_adj.get(rid, ())):
            nt = ix.type(nb)
            bad = None
            if nt in PRIVATE:
                bad = f"{r['name']} opens directly into {ix.name(nb)}. Bedrooms must open onto a corridor, lobby, lounge or their own bath or balcony."
            elif nt in SERVICE:
                bad = f"{r['name']} opens into the {ix.name(nb).lower()}. A bedroom never opens into a kitchen, laundry or store."
            elif nt in WET and len([x for x in ix.door_adj.get(nb, ()) if x != EXT]) > 1:
                bad = f"{r['name']} shares {ix.name(nb)} with another room. An attached bath opens only into its own bedroom."
            elif nt == "drawing" and t not in ("guest_bedroom", "servant"):
                bad = f"{r['name']} opens into the drawing room, where guests sit."
            elif nt == "prayer":
                bad = f"{r['name']} opens through the prayer room. Keep the prayer room off the way into a bedroom."
            if bad and nt in PRIVATE and f"plan.privacy.bedroom_door:{nb}:{rid}" in out.seen:
                continue  # one finding per pair of bedrooms
            if bad:
                out.add(f"plan.privacy.bedroom_door:{rid}:{nb}", "Bedroom privacy", "fail", bad, ids=[rid, nb],
                        fix=f"Give {r['name']} its own door onto a corridor, lobby or lounge; if it touches none, add a corridor "
                            f"at least 4 ft wide along the bedrooms.", ref=f"{REF} P-05")
        if t == "servant":
            continue
        ok_targets = CIRC | {"lounge", "dining"} | ({"drawing"} if t == "guest_bedroom" else set())
        if not any(ix.type(nb) in ok_targets for nb in ix.door_adj.get(rid, ())):
            via = sorted({ix.name(nb) for nb in ix.door_adj.get(rid, ()) if ix.type(nb) not in WET | {"dressing"}})
            msg = (f"{r['name']} has no door to a corridor, lobby or lounge" +
                   (f"; it is entered only from {', '.join(via)}." if via else "."))
            out.add(f"plan.privacy.bedroom_access:{rid}", "Bedroom entrance", "fail", msg, ids=[rid],
                    fix=f"Give {r['name']} a door onto circulation (corridor, lobby, stair hall) or the family lounge.",
                    ref=f"{REF} P-05")
    for r in ix.rooms:
        if r.get("type") in ("balcony", "terrace"):
            beds = [nb for nb in ix.door_adj.get(r["id"], ()) if ix.type(nb) in PRIVATE]
            if len(beds) >= 2:
                out.add(f"plan.circulation.balcony_links_bedrooms:{r['id']}", "Shared balcony", "warn",
                        f"{r['name']} connects {', '.join(ix.name(b) for b in beds)}, so one bedroom can be entered from another.",
                        ids=[r["id"], *beds], fix="Split the balcony with a screen wall or give it one bedroom.", ref=f"{REF} P-09")


# P-06 ----------------------------------------------------------------------------------------------------------------
def _baths(ix: PlanIndex, out: _Out) -> None:
    for r in ix.rooms:
        if r.get("type") not in WET:
            continue
        rid, t = r["id"], r.get("type")
        nbs = [nb for nb in ix.door_adj.get(rid, ()) if nb != EXT]
        if not nbs:
            if not ix.door_adj.get(rid):
                out.add(f"plan.privacy.bath_door:{rid}", "Bath door", "fail", f"{r['name']} has no door.", ids=[rid],
                        fix="Give it one door into its bedroom or onto circulation.", ref=f"{REF} P-06")
            continue
        if len(nbs) > 1:
            out.add(f"plan.privacy.bath_door:{rid}", "Bath door", "fail",
                    f"{r['name']} has {len(nbs)} doors ({', '.join(ix.name(n) for n in nbs)}). A bath opens into one room only.",
                    ids=[rid, *nbs], fix="Keep one door: into its own bedroom, or onto a corridor or lobby for a common bath.",
                    ref=f"{REF} P-06")
            continue
        nb = nbs[0]
        nt = ix.type(nb)
        allowed = PRIVATE | {"dressing"} | CIRC | {"lounge"} | ({"drawing"} if t == "powder" else set())
        if nt == "dining":
            out.add(f"plan.privacy.wc_into_dining:{rid}", "Toilet off the dining", "warn",
                    f"{r['name']} opens straight into the dining room.", ids=[rid, nb],
                    fix="Add a small lobby in front of it or move its door to a corridor.", ref=f"{REF} P-06")
        elif nt not in allowed:
            out.add(f"plan.privacy.bath_door:{rid}", "Bath door", "fail", f"{r['name']} opens into {ix.name(nb)}.",
                    ids=[rid, nb], fix="Open it into its own bedroom, a corridor, a lobby or the lounge; never a kitchen, store, "
                                       "prayer room or another bath.", ref=f"{REF} P-06")
        if "master" in (rid + " " + r.get("name", "")).lower() and nt not in ("master_bedroom", "dressing"):
            out.add(f"plan.privacy.master_bath:{rid}", "Master bath", "fail",
                    f"{r['name']} does not open into the master bedroom.", ids=[rid, nb],
                    fix="Put the master bath's only door on the wall it shares with the master bedroom (or its dressing).",
                    ref=f"{REF} P-06")


# P-08 ----------------------------------------------------------------------------------------------------------------
def _reach(ix: PlanIndex, out: _Out) -> None:
    terminal = {r["id"] for r in ix.rooms if r.get("type") in PRIVATE | WET | {"dressing"}}
    free = ix.bfs([EXT], terminal=terminal)
    anyway = ix.bfs([EXT])
    for r in ix.rooms:
        rid, t = r["id"], r.get("type")
        if rid in free:
            continue
        if r.get("level") == ix.roof_id and t in OPEN:
            continue  # roof decks: covered by the stair checks
        nbs = [n for n in ix.door_adj.get(rid, ()) if n != EXT]
        if t in WET | {"dressing"} and len(nbs) == 1 and ix.type(nbs[0]) in PRIVATE | {"dressing"}:
            continue  # attached bath / dressing
        if t in ("balcony", "terrace") and len(nbs) == 1 and ix.type(nbs[0]) in PRIVATE:
            continue  # a bedroom's own balcony
        if t in OPEN and r.get("level") == ix.ground:
            continue
        if rid in anyway:
            path, cur = [], anyway[rid]
            while cur and cur != EXT:
                if cur in terminal:
                    path.append(ix.name(cur))
                cur = anyway.get(cur)
            via = ", ".join(reversed(path)) or "another private room"
            out.add(f"plan.circulation.reach_through_private:{rid}", "Reached through a private room", "fail",
                    f"{r['name']} can only be reached through {via}.", ids=[rid],
                    fix=f"Give {r['name']} a door onto circulation (corridor, lobby, stair hall or lounge).", ref=f"{REF} P-08")
        else:
            status = "warn" if t in OPEN else "fail"
            out.add(f"plan.circulation.unreachable:{rid}", "No way in", status,
                    f"{r['name']} on the {ix.lname(r.get('level'))} has no way in.", ids=[rid],
                    fix=f"Add a door from {r['name']} to the room next to it, on a wall they share.", ref=f"{REF} P-08")


# P-10, P-11 ---------------------------------------------------------------------------------------------------------------
def _main_doors(ix: PlanIndex) -> list[dict]:
    return [o for o in ix.openings if o.get("type") == "main_door"]


def _inside_of(ix: PlanIndex, o: dict) -> str | None:
    inf = ix.info[o["id"]]
    if not inf["valid"]:
        return None
    cands = [r for r in inf["rooms"] if ix.type(r) not in OPEN]
    return cands[0] if cands else None


def _routes(ix: PlanIndex, out: _Out) -> None:
    mains = [o for o in _main_doors(ix) if o.get("level") == ix.ground]
    inside = next((x for x in (_inside_of(ix, o) for o in mains) if x), None)
    lounges = {r["id"] for r in ix.level_rooms(ix.ground) if r.get("type") == "lounge"}
    if inside and lounges and inside not in lounges:
        outdoor = {r["id"] for r in ix.rooms if r.get("type") in OPEN} | {EXT, ROOF, MUMTY}
        terminal = {r["id"] for r in ix.rooms if r.get("type") in PRIVATE | WET | SERVICE | {"drawing"}}
        seen = ix.bfs([inside], terminal=terminal, blocked=outdoor)
        if not (set(seen) & lounges):
            through = "the drawing room" if any(ix.type(n) == "drawing" for n in ix.bfs([inside], blocked=outdoor)) else "other rooms"
            out.add("plan.circulation.family_route", "Family route", "fail",
                    f"From the main door the family lounge can only be reached through {through}.", ids=[inside, *lounges],
                    fix="Join the entrance lobby to the lounge with a door or arch on a wall they share, or put the main door into "
                        "the lounge.", ref=f"{REF} P-10")
    drawings = [r["id"] for r in ix.level_rooms(ix.ground) if r.get("type") == "drawing"]
    if drawings:
        allowed = {r["id"] for r in ix.rooms if r.get("type") in GROUND_OUT | {"lobby", "corridor"} and r.get("level") == ix.ground}
        terminal = set(drawings)
        seen = ix.bfs([EXT], terminal=terminal, blocked={r["id"] for r in ix.rooms if r["id"] not in allowed | terminal})
        if not set(seen) & terminal:
            out.add("plan.circulation.guest_route", "Guest route", "warn",
                    "Guests can't reach the drawing room without walking through the family's rooms.", ids=drawings,
                    fix="Give the drawing room a door from the porch or the entrance lobby.", ref=f"{REF} P-11")


# P-12 ----------------------------------------------------------------------------------------------------------------
def _main_door(ix: PlanIndex, out: _Out) -> None:
    mains = _main_doors(ix)
    if not mains:
        out.add("plan.circulation.main_door", "Main door", "fail", "The house has no main door.",
                fix="Add one main_door on the ground floor from the porch (or outside) into a lobby or the lounge.", ref=f"{REF} P-12")
        return
    if len(mains) > 1:
        out.add("plan.circulation.main_door", "Main door", "fail", f"The plan has {len(mains)} main doors; a house has one.",
                ids=[o["id"] for o in mains], fix="Keep one main_door; make the others ordinary doors.", ref=f"{REF} P-12")
    o = mains[0]
    if o.get("level") != ix.ground:
        out.add("plan.circulation.main_door", "Main door", "fail", f"The main door is on the {ix.lname(o.get('level'))}.",
                ids=[o["id"]], fix="Put the main door on the ground floor.", ref=f"{REF} P-12")
        return
    inside = _inside_of(ix, o)
    if inside and ix.type(inside) == "drawing":
        out.add("plan.circulation.main_door_room", "Main door", "warn",
                "The main door opens into the drawing room, so the family passes through the guests' room.", ids=[o["id"], inside],
                fix="Open the main door into a lobby or the lounge; give the drawing room its own door.", ref=f"{REF} P-12")
    elif inside and ix.type(inside) not in CIRC | {"lounge"}:
        out.add("plan.circulation.main_door_room", "Main door", "fail", f"The main door opens into {ix.name(inside)}.",
                ids=[o["id"], inside], fix="Open the main door into a lobby, corridor, stair hall or the lounge.", ref=f"{REF} P-12")


# P-13 ----------------------------------------------------------------------------------------------------------------
def _widths(ix: PlanIndex, out: _Out) -> None:
    for r in ix.rooms:
        if r.get("type") in ("corridor", "lobby"):
            x0, y0, x1, y1 = ix.R[r["id"]]
            clear = min(x1 - x0, y1 - y0) - 0.375
            if clear < 3.0 - 1e-6:
                out.add(f"plan.circulation.width:{r['id']}", "Passage width", "fail",
                        f"{r['name']} is only {fmt(clear)} clear; people need at least 3 ft to pass.", ids=[r["id"]],
                        fix="Make corridors and lobbies at least 4 ft wide (centre-line).", ref=f"{REF} P-13", value=round(clear, 2),
                        limit=3.0, unit="ft")
            elif clear < 3.5 - 1e-6:
                out.add(f"plan.circulation.width:{r['id']}", "Passage width", "warn",
                        f"{r['name']} is {fmt(clear)} clear; 3′6″ is comfortable.", ids=[r["id"]], ref=f"{REF} P-13",
                        value=round(clear, 2), limit=3.5, unit="ft")
    for o in ix.openings:
        if o.get("type") not in HINGED | {"sliding_door", "arch"}:
            continue
        w = float(o.get("width_ft") or 0)
        rooms = [ix.type(r) for r in o["between"] if r in ix.by_id]
        need = 3.5 if o.get("type") == "main_door" else 2.5 if set(rooms) & (WET | {"store", "dressing"}) else 3.0 \
            if set(rooms) & (HABITABLE | {"kitchen"}) else 2.5
        if w + 1e-6 < need:
            out.add(f"plan.circulation.door_width:{o['id']}", "Door width", "warn",
                    f"{o['id']} is {fmt(w)} wide; {fmt(need)} is the comfortable minimum here.", ids=[o["id"]],
                    ref=f"{REF} P-13", value=w, limit=need, unit="ft")


# P-14 ----------------------------------------------------------------------------------------------------------------
def _dead_ends(ix: PlanIndex, out: _Out) -> None:
    for r in ix.rooms:
        if r.get("type") not in ("corridor", "lobby"):
            continue
        n = len(ix.adj.get(r["id"], ()))
        if n < 2:
            out.add(f"plan.circulation.dead_end:{r['id']}", "Dead-end passage", "fail",
                    f"{r['name']} leads nowhere ({n} connection{'s' if n != 1 else ''}).", ids=[r["id"]],
                    fix="A corridor or lobby joins at least two rooms; merge it into a room or add the missing doors.",
                    ref=f"{REF} P-14")


# P-15 (lite) ---------------------------------------------------------------------------------------------------------
def _porch(ix: PlanIndex, out: _Out) -> None:
    for r in ix.level_rooms(ix.ground):
        if r.get("type") != "porch":
            continue
        doors = [o for o in ix.door_ops.get(r["id"], []) if o.get("type") in HINGED]
        if not doors:
            continue
        x0, y0, x1, y1 = ix.R[r["id"]]
        m = re.search(r"(\d)\s*car", r.get("name", "").lower())
        cars = int(m.group(1)) if m else 1
        width, depth = x1 - x0, y1 - y0
        if min(width, depth) < 9 or max(width, depth) < 18:
            out.add(f"plan.circulation.porch:{r['id']}", "Car porch", "warn",
                    f"{r['name']} is {fmt(width)} × {fmt(depth)}; a car needs a 9 × 18 ft bay.", ids=[r["id"]],
                    fix="Make the porch at least 9 ft wide per car and 18 ft deep.", ref=f"{REF} P-15")
        elif width < cars * 9 + 3.5 and depth < 18 + 3.5:
            out.add(f"plan.circulation.porch_walkway:{r['id']}", "Walkway past the car", "warn",
                    f"{r['name']} is {fmt(width)} wide: {cars} car{'s' if cars > 1 else ''} plus a 3′6″ walkway to "
                    f"{doors[0]['id']} need {fmt(cars * 9 + 3.5)}.", ids=[r["id"], doors[0]["id"]],
                    fix="Widen the porch, or put its doors on the side wall beyond the parking bay.", ref=f"{REF} P-15")


# P-17 ----------------------------------------------------------------------------------------------------------------
SOLID_TARGET = {"lounge": 8.0, "drawing": 8.0, "bedroom": 9.0, "guest_bedroom": 9.0, "master_bedroom": 10.0}


def _solid_walls(ix: PlanIndex, out: _Out) -> None:
    for r in ix.rooms:
        target = SOLID_TARGET.get(r.get("type", ""))
        if not target:
            continue
        rid = r["id"]
        best = 0.0
        for side, (axis, c, lo, hi, _) in sides(ix.R[rid]).items():
            cuts = []
            for o in ix.openings:
                if rid not in o["between"] or o.get("level") != r.get("level"):
                    continue
                x, y = float(o["at"][0]), float(o["at"][1])
                across, along = (abs(y - c), x) if axis == "x" else (abs(x - c), y)
                if across <= 0.75 and lo - 0.5 <= along <= hi + 0.5:
                    w = float(o.get("width_ft") or 0)
                    cuts.append((along - w / 2 - 0.5, along + w / 2 + 0.5))
            for (a, b), res in ix.open_pairs.items():
                if rid in (a, b) and res.get("edge") and res["valid"]:
                    eax, ec, elo, ehi = res["edge"]
                    if eax == axis and abs(ec - c) < 0.1:
                        cuts.append((elo, ehi))
            cur = lo
            for a, b in sorted(cuts):
                if a > cur:
                    best = max(best, min(a, hi) - cur)
                cur = max(cur, b)
            if hi > cur:
                best = max(best, hi - cur)
        if best + 1e-6 < target:
            out.add(f"plan.room.solid_wall:{rid}", "Wall for the bed or TV", "fail" if best < 7 - 1e-6 else "warn",
                    f"{r['name']}'s longest solid wall is {fmt(best)}; the {'bed' if 'bed' in r['type'] else 'TV and sofa'} "
                    f"wall needs {fmt(target)}.", ids=[rid], fix="Move doors to the room's corners and put the windows on one wall.",
                    ref=f"{REF} P-17", value=round(best, 1), limit=target, unit="ft")


# P-18 .. P-22 -------------------------------------------------------------------------------------------------------------
def _stairs(ix: PlanIndex, out: _Out) -> None:
    seq = list(ix.storeys) + ([ix.roof_id] if ix.roof_id else [])
    by_pair: dict[tuple[str, str], dict] = {}
    for s in ix.stairs:
        by_pair.setdefault((s.get("from_level"), s.get("to_level")), s)
    for a, b in zip(seq, seq[1:]):
        if (a, b) not in by_pair:
            out.add(f"plan.stair.continuity:{a}:{b}", "Stair to every floor", "fail",
                    f"There is no stair from the {ix.lname(a)} to the {ix.lname(b) if b != ix.roof_id else 'roof'}.",
                    fix=f"Add a stair from {a} to {b}, stacked exactly on the stair below (same rect, kind and start).",
                    ref=f"{REF} P-18")
    if ix.stairs:
        s0 = ix.stairs[0]
        r0 = rect_of(s0)
        for s in ix.stairs[1:]:
            r = rect_of(s)
            if max(abs(r[i] - r0[i]) for i in range(4)) > 0.25 or s.get("kind") != s0.get("kind") or s.get("start") != s0.get("start"):
                out.add(f"plan.stair.stacked:{s['id']}", "Stairs stacked", "fail", f"{s['id']} is not stacked on {s0['id']}.",
                        ids=[s["id"], s0["id"]], fix="Give every stair the same rect, kind and start so they stack in one stair hall.",
                        ref=f"{REF} P-18")
    for s in ix.stairs:
        g = ix.stair_geo(s)
        r = g["rect"]
        frm, to = s.get("from_level"), s.get("to_level")
        # P-19 containment
        home = [x for x in ix.level_rooms(frm) if x.get("type") in ("stair", "lobby") and within(r, ix.R[x["id"]], 0.15)]
        if not home:
            hit = [x["name"] for x in ix.level_rooms(frm) if overlap_area(r, ix.R[x["id"]]) > 0.5 and x.get("type") not in ("stair", "lobby")]
            out.add(f"plan.stair.containment:{s['id']}", "Stair inside its hall", "fail",
                    f"The stair {s['id']} on the {ix.lname(frm)} is not inside a stair hall" + (f"; it cuts into {', '.join(hit)}." if hit else "."),
                    ids=[s["id"]], fix="Put the stair rect fully inside a room of type stair (or lobby) on its from_level.",
                    ref=f"{REF} P-19")
        if to != ix.roof_id:
            for x in ix.level_rooms(to):
                if overlap_area(r, ix.R[x["id"]]) > 0.5 and x.get("type") not in CIRC:
                    out.add(f"plan.stair.containment:{s['id']}:{x['id']}", "Stair inside its hall", "fail",
                            f"The stairwell of {s['id']} cuts into {x['name']} on the {ix.lname(to)}.", ids=[s["id"], x["id"]],
                            fix="Upstairs, the stair rect must sit inside the stair hall too; keep bedrooms off the stairwell.",
                            ref=f"{REF} P-19")
        # P-20 geometry
        T, n = g["T"], g["N"]
        problems = []
        if g["riser_in"] > 7.5 + 1e-6:
            problems.append(f"risers of {g['riser_in']:.2f} in are steeper than 7.5 in")
        need_len = None
        if g["kind"] == "dogleg":
            n1 = math.ceil(n / 2)
            if n1 > 15:
                problems.append(f"{n1} risers in one flight (max 15)")
            if g["breadth"] < 4.9:
                problems.append(f"{fmt(g['breadth'])} is too narrow for a dog-leg")
            elif g["breadth"] + 1e-6 < 2 * g["width"] + 0.15:
                problems.append(f"{fmt(g['breadth'])} wide can't fit two {fmt(g['width'])} flights")
            need_len = (n1 - 1) * T + max(g["width"], 3.0)
        elif g["kind"] == "straight":
            if n > 15:
                problems.append(f"{n} risers in one straight flight (max 15); use a dog-leg")
            need_len = (n - 1) * T
        else:  # l_shape
            n1 = math.ceil(n / 2)
            need_len = (n1 - 1) * T + g["width"]
            need_b = (n - n1 - 1) * T + g["width"]
            if g["breadth"] + 1e-6 < need_b:
                problems.append(f"the second flight needs {fmt(need_b)} of breadth, the rect gives {fmt(g['breadth'])}")
        if need_len and g["length"] + 0.05 < need_len:
            problems.append(f"{fmt(g['length'])} is too short for the treads plus a {fmt(max(g['width'], 3.0))} mid-landing "
                            f"(needs {fmt(need_len)})")
        if problems:
            out.add(f"plan.stair.geometry:{s['id']}", "Stair geometry", "fail", f"Stair {s['id']}: " + "; ".join(problems) + ".",
                    ids=[s["id"]], fix="For 11 ft floor-to-floor: 19 risers of 6.95 in, 10 in treads, 3.5 ft flights, so a "
                                       "dog-leg rect of 7.5 ft × 11 ft along `start`.", ref=f"{REF} P-20 / {IBC} §1011.6",
                    value=round(g["length"], 2), limit=round(need_len or 0, 2), unit="ft")
        # P-21 landings
        _landing(ix, out, s, g, frm, "foot")
        if to != ix.roof_id:
            _landing(ix, out, s, g, to, "arrival")
        # P-22 doors opening onto the stairwell, private stair rooms
        for lid in {frm, to} - {ix.roof_id}:
            for x in ix.level_rooms(lid):
                if x.get("type") in PRIVATE and overlap_area(r, ix.R[x["id"]]) > 0.5:
                    out.add(f"plan.stair.private:{s['id']}:{x['id']}", "Stair in a bedroom", "fail",
                            f"The stair {s['id']} runs through {x['name']}.", ids=[s["id"], x["id"]],
                            fix="Stairs live in a stair hall that is circulation, never inside a bedroom.", ref=f"{REF} P-22")
        if to != ix.roof_id:
            void = r  # the arriving stair's rect on the upper floor is treads or void
            for o in ix.openings:
                if o.get("level") != to or o.get("type") not in DOORS:
                    continue
                w = float(o.get("width_ft") or 0)
                x0, y0 = float(o["at"][0]), float(o["at"][1])
                zone = (x0 - w / 2, y0 - 2.0, x0 + w / 2, y0 + 2.0) if _horizontal(ix, o) else (x0 - 2.0, y0 - w / 2, x0 + 2.0, y0 + w / 2)
                if overlap_area(zone, void) > 1.0:
                    out.add(f"plan.stair.door_on_void:{o['id']}", "Door onto the stairwell", "fail",
                            f"{o['id']} on the {ix.lname(to)} opens straight onto the stairwell.", ids=[o["id"], s["id"]],
                            fix="Move the door so it opens onto the 3.5 ft landing strip, not over the flights.", ref=f"{REF} P-22")


def _horizontal(ix: PlanIndex, o: dict) -> bool:
    """True when the opening sits on a wall that runs along x."""
    inf = ix.info.get(o["id"]) or {}
    if inf.get("edge"):
        return inf["edge"][0] == "x"
    if inf.get("side"):
        return inf["side"] in ("front", "back")
    return True


def _landing(ix: PlanIndex, out: _Out, s: dict, g: dict, lid: str, which: str) -> None:
    side = g["e_side"] if which == "foot" else g["arrive_side"]
    r = g["rect"]
    key = (lid, side, tuple(round(v, 1) for v in r))
    done = out.__dict__.setdefault("landings", set())
    if key in done:  # stacked stairs share one landing strip per floor: report it once
        return
    done.add(key)
    hall = ix.room_at(lid, (r[0] + r[2]) / 2, (r[1] + r[3]) / 2, enclosed=True)
    ok_rooms = {x["id"] for x in ix.level_rooms(lid) if x.get("type") in CIRC}
    if hall:
        ok_rooms.add(hall)
        for (a, b), res in ix.open_pairs.items():
            if res["valid"] and hall in (a, b):
                other = b if a == hall else a
                if ix.type(other) in CIRC | LIVING:
                    ok_rooms.add(other)
    # clear depth: how far beyond the edge every sample point stays inside an allowed room
    depth = 0.0
    step = 0.25
    while depth < 3.0 - 1e-9:
        strip = ix.strip(r, side, depth + step)
        band = strip
        xs = _samples(band[0], band[2])
        ys = _samples(band[1], band[3])
        if side in ("front", "back"):
            yy = band[1] if side == "front" else band[3]
            pts = [(x, yy) for x in xs]
        else:
            xx = band[0] if side == "left" else band[2]
            pts = [(xx, y) for y in ys]
        if all((ix.room_at(lid, px, py, enclosed=True) or "") in ok_rooms for px, py in pts):
            depth += step
        else:
            break
    if depth + 1e-6 < 3.0:
        what = "at its foot" if which == "foot" else "where it arrives"
        out.add(f"plan.stair.landing:{s['id']}:{lid}", "Stair landing", "fail",
                f"Stair {s['id']} has only {fmt(depth)} clear {what} on the {ix.lname(lid)}; it needs 3 ft.",
                ids=[s["id"], *([hall] if hall else [])],
                fix=f"Make the stair hall at least 3.5 ft longer than the stair at its {side} edge, where a dog-leg starts and "
                    f"arrives, on every floor.", ref=f"{REF} P-21 / {IBC} §1011.6", value=round(depth, 2), limit=3.0, unit="ft")
    if which == "arrival" and hall and not [n for n in ix.door_adj.get(hall, ())]:
        out.add(f"plan.stair.landing_exit:{s['id']}:{lid}", "Way off the landing", "fail",
                f"The top of stair {s['id']} on the {ix.lname(lid)} lands in a hall with no way out.", ids=[s["id"], hall],
                fix="Connect the stair hall to the floor with a door or an open_to onto a corridor or lounge.", ref=f"{REF} P-21")


def _samples(a: float, b: float) -> list[float]:
    if b - a <= 0.6:
        return [(a + b) / 2]
    n = max(2, int((b - a) / 0.5))
    return [a + 0.2 + (b - a - 0.4) * i / (n - 1) for i in range(n)]


# P-23 ----------------------------------------------------------------------------------------------------------------
SIDE_FOR_START = {"+y": "front", "-y": "back", "+x": "left", "-x": "right"}


def top_stair(ix: PlanIndex) -> dict | None:
    return next((s for s in ix.stairs if s.get("to_level") == ix.roof_id), None)


def mumty_need(ix: PlanIndex, s: dict) -> Rect:
    """The stair tower must cover the top stair and its 3 ft top landing (wall included)."""
    g = ix.stair_geo(s)
    landing = ix.strip(g["rect"], g["arrive_side"], 3.0)
    return union_rect(g["rect"], landing)


def slab_cover(ix: PlanIndex) -> list[Rect]:
    """Where the roof slab is: over the top storey's enclosed rooms and porches."""
    if not ix.top:
        return []
    return [ix.R[r["id"]] for r in ix.level_rooms(ix.top) if r.get("type") not in OPEN - {"porch"}]


def door_sides(ix: PlanIndex, s: dict, m: Rect) -> dict[str, float]:
    """Allowed mumty door sides -> contact length with the top landing (A.0 P-23 / B.3)."""
    g = ix.stair_geo(s)
    e = g["arrive_side"]
    r = g["rect"]
    # the landing region inside the mumty: from the mumty's wall on side e to the stair edge e, across its full width
    if e == "front":
        land = (m[0], m[1], m[2], r[1])
    elif e == "back":
        land = (m[0], r[3], m[2], m[3])
    elif e == "left":
        land = (m[0], m[1], r[0], m[3])
    else:
        land = (r[2], m[1], m[2], m[3])
    depth = (land[3] - land[1]) if e in ("front", "back") else (land[2] - land[0])
    breadth = (land[2] - land[0]) if e in ("front", "back") else (land[3] - land[1])
    slabs = slab_cover(ix)
    tank = rect_of(ix.roof["water_tank"]) if (ix.roof.get("water_tank") or {}).get("rect") else None
    allowed: dict[str, float] = {}
    for side, (axis, c, lo, hi, n) in sides(m).items():
        if side == e:
            contact = breadth
            mid = ((land[0] + land[2]) / 2, c) if axis == "x" else (c, (land[1] + land[3]) / 2)
        elif side == {"front": "back", "back": "front", "left": "right", "right": "left"}[e]:
            continue
        else:
            contact = depth
            mid = ((land[0] + land[2]) / 2, c) if axis == "x" else (c, (land[1] + land[3]) / 2)
        if contact < 3.6 - 1e-6:
            continue
        if ix.on_party_line(axis, c, lo, hi):
            continue
        ox, oy = mid[0] + n[0] * 1.5, mid[1] + n[1] * 1.5
        if not any(contains(sl, ox, oy) for sl in slabs):
            continue
        if tank and contains(tank, ox, oy, 0.5):
            continue
        allowed[side] = contact
    return allowed


def _mumty(ix: PlanIndex, out: _Out) -> None:
    s = top_stair(ix)
    if not s:
        return
    m_roof_room = ix.room_at(ix.roof_id, *_centre(rect_of(s)), enclosed=True) if ix.roof_id else None
    if not ix.mumty and not m_roof_room:
        out.add("plan.roof.mumty", "Stair tower", "fail", "A stair reaches the roof but there is no stair tower (mumty) over it.",
                ids=[s["id"]], fix="Add roof.mumty with rect = the top-floor stair hall and door_side = the stair's start-end side.",
                ref=f"{REF} P-23")
        return
    m = ix.mumty or ix.R[m_roof_room]
    need = mumty_need(ix, s)
    if not within(need, m, 0.2):
        out.add("plan.roof.mumty_cover", "Stair tower covers the stair", "fail",
                f"The stair tower ({fmt(m[2] - m[0])} × {fmt(m[3] - m[1])}) doesn't cover the stair and its 3 ft top landing "
                f"({fmt(need[2] - need[0])} × {fmt(need[3] - need[1])}), so the roof door can't sit at the top of the stair.",
                ids=[s["id"]], fix="Set roof.mumty.rect to the top-floor stair hall: the stair rect plus at least 3.5 ft at its "
                                   "start edge.", ref=f"{REF} P-23")
        return
    if not ix.mumty:
        return
    side = (ix.roof.get("mumty") or {}).get("door_side")
    allowed = door_sides(ix, s, m)
    if side not in allowed:
        g = ix.stair_geo(s)
        if allowed:
            pick = max(allowed, key=lambda k: (k == g["arrive_side"], allowed[k]))
            msg = f"The roof door is on the {side} side, away from the top of the stair. Use the {pick} side."
        else:
            msg = ("No side of the stair tower can take the roof door beside the top landing (party wall, open sky or a short "
                   "landing).")
        out.add("plan.roof.mumty_door", "Roof door at the top landing", "fail", msg, ids=[s["id"]],
                fix="door_side = the stair's start-end side (front for +y, back for -y, left for +x, right for -x); if that is a "
                    "party wall, use a long side and make the stair tower at least 3.5 ft longer than the stair at its start end.",
                ref=f"{REF} P-23")


def _centre(r: Rect) -> tuple[float, float]:
    return (r[0] + r[2]) / 2, (r[1] + r[3]) / 2


def repair_mumty(plan: dict) -> list[str]:
    """Deterministic stair-tower repair (B.3 at plan level): cover the top stair and its landing, put the door on the best
    side beside the landing, and keep a plastic tank on the tower. Returns what changed."""
    ix = PlanIndex(plan)
    s = top_stair(ix)
    if not s:
        return []
    changed: list[str] = []
    roof = plan.setdefault("roof", {})
    if ix.room_at(ix.roof_id, *_centre(rect_of(s)), enclosed=True) if ix.roof_id else False:
        return []  # an enclosed roof room acts as the stair tower
    g0 = ix.stair_geo(s)
    need = mumty_need(ix, s)
    pad = {k: (0.0 if k == g0["arrive_side"] else 0.375) for k in ("front", "back", "left", "right")}
    need = (need[0] - pad["left"], need[1] - pad["front"], need[2] + pad["right"], need[3] + pad["back"])
    m = ix.mumty
    hall = ix.room_at(ix.top, *_centre(rect_of(s)), enclosed=True) if ix.top else None
    if m:
        base = union_rect(m, need)
    elif hall and ix.type(hall) in ("stair", "lobby") and within(need, ix.R[hall], 0.2):
        base = ix.R[hall]
    else:
        base = need
    base = (max(0.0, base[0]), max(0.0, base[1]), min(ix.W or base[2], base[2]), min(ix.D or base[3], base[3]))
    mum = roof.setdefault("mumty", {"height_ft": 9.0, "door_side": "front"})
    old = mum.get("rect")
    newr = {"x": round(base[0], 2), "y": round(base[1], 2), "w": round(base[2] - base[0], 2), "d": round(base[3] - base[1], 2)}
    if old != newr:
        mum["rect"] = newr
        changed.append("mumty.rect")
    mum["height_ft"] = min(float(mum.get("height_ft") or 9.0), 9.5)
    ix = PlanIndex(plan)
    m = ix.mumty
    allowed = door_sides(ix, s, m)
    g = ix.stair_geo(s)
    if not allowed:  # grow the tower 3.5 ft at the landing end when the slab allows, then retry
        grown = ix.strip(m, g["arrive_side"], 3.5)
        cx, cy = _centre(grown)
        if any(contains(sl, cx, cy) for sl in slab_cover(ix)) and not ix.on_party_line(*_side_line(grown, g["arrive_side"])):
            u = union_rect(m, grown)
            mum["rect"] = {"x": round(u[0], 2), "y": round(u[1], 2), "w": round(u[2] - u[0], 2), "d": round(u[3] - u[1], 2)}
            changed.append("mumty.grown")
            ix = PlanIndex(plan)
            allowed = door_sides(ix, s, ix.mumty)
    if allowed and mum.get("door_side") not in allowed:
        mum["door_side"] = max(allowed, key=lambda k: (k == g["arrive_side"], allowed[k]))
        changed.append("mumty.door_side")
    tank = roof.get("water_tank")
    if tank and tank.get("material") == "plastic" and tank.get("rect"):
        mr = rect_of(mum)
        t = tank["rect"]
        if not within(rect_of(tank), mr, 0.05):
            w, d = min(float(t["w"]), mr[2] - mr[0] - 1), min(float(t["d"]), mr[3] - mr[1] - 1)
            tank["rect"] = {"x": round((mr[0] + mr[2] - w) / 2, 2), "y": round((mr[1] + mr[3] - d) / 2, 2), "w": round(w, 2), "d": round(d, 2)}
            changed.append("water_tank.on_mumty")
    return changed


def repair_stairs(plan: dict) -> list[str]:
    """Deterministic stair fit: when a stair stack lacks its 3 ft landing (P-21) or code length/breadth (P-20) but its stair
    halls are big enough, move and resize the flights inside the halls (same rect for the whole stack). Returns stair ids."""
    ix = PlanIndex(plan)
    if not ix.stairs:
        return []
    bad = {c["id"].split(":")[1] for c in check(plan) if c["status"] == "fail"
           and c["id"].startswith(("plan.stair.landing", "plan.stair.geometry"))}
    changed: list[str] = []
    stacks: dict[tuple, list[dict]] = defaultdict(list)
    for s in ix.stairs:
        stacks[tuple(round(v, 1) for v in rect_of(s))].append(s)
    for _, stack in stacks.items():
        if not any(s["id"] in bad for s in stack):
            continue
        halls = []
        for s in stack:
            c = _centre(rect_of(s))
            for lid in (s.get("from_level"), s.get("to_level")):
                if lid == ix.roof_id:
                    continue
                h = ix.room_at(lid, *c, enclosed=True)
                if not h or ix.type(h) not in ("stair", "lobby"):
                    halls = []
                    break
                halls.append(ix.R[h])
            else:
                continue
            break
        if not halls:
            continue
        H = (max(h[0] for h in halls), max(h[1] for h in halls), min(h[2] for h in halls), min(h[3] for h in halls))
        g = ix.stair_geo(stack[0])
        T, n, w = g["T"], g["N"], max(g["width"], 3.5)
        if g["kind"] == "dogleg":
            need_len, need_b = (math.ceil(n / 2) - 1) * T + max(w, 3.0), 2 * w + 0.25
        elif g["kind"] == "straight":
            need_len, need_b = (n - 1) * T, w
        else:
            continue
        along_y = g["start"] in ("+y", "-y")
        h_len = (H[3] - H[1]) if along_y else (H[2] - H[0])
        h_b = (H[2] - H[0]) if along_y else (H[3] - H[1])
        if need_len + 3.0 > h_len + 1e-6 or need_b > h_b - 0.5 + 1e-6:
            continue  # the hall is too small: only the planner can fix it
        landing = min(3.5, h_len - need_len)
        length = max(need_len, min(g["length"], h_len - landing))
        breadth = min(max(g["breadth"], need_b), h_b - 0.75)
        r = g["rect"]
        if along_y:
            cx = min(max((r[0] + r[2]) / 2, H[0] + 0.375 + breadth / 2), H[2] - 0.375 - breadth / 2)
            x0, x1 = cx - breadth / 2, cx + breadth / 2
            y0 = H[1] + landing if g["start"] == "+y" else H[3] - landing - length
            y1 = y0 + length
        else:
            cy = min(max((r[1] + r[3]) / 2, H[1] + 0.375 + breadth / 2), H[3] - 0.375 - breadth / 2)
            y0, y1 = cy - breadth / 2, cy + breadth / 2
            x0 = H[0] + landing if g["start"] == "+x" else H[2] - landing - length
            x1 = x0 + length
        new = {"x": round(x0, 3), "y": round(y0, 3), "w": round(x1 - x0, 3), "d": round(y1 - y0, 3)}
        for s in stack:
            s["rect"] = dict(new)
            s["width_ft"] = max(float(s.get("width_ft") or 0), 3.5)
            s["tread_in"] = max(float(s.get("tread_in") or 0), 10)
            changed.append(s["id"])
    return changed


def _side_line(r: Rect, side: str):
    axis, c, lo, hi, _ = sides(r)[side]
    return axis, c, lo, hi


# P-24 ----------------------------------------------------------------------------------------------------------------
def roof_free_area(ix: PlanIndex) -> tuple[float, float]:
    """(free sq ft, footprint sq ft) of the roof for solar: top-storey slab minus a 2 ft parapet band, the stair tower,
    the tank and any roof rooms."""
    slabs = slab_cover(ix)
    if not slabs:
        return 0.0, 0.0
    fp = union_area(slabs)
    bx = union_rect(*slabs)
    band = 2.0 * 2 * ((bx[2] - bx[0]) + (bx[3] - bx[1]))
    taken = band
    if ix.mumty:
        taken += area(ix.mumty)
    t = ix.roof.get("water_tank")
    if t and t.get("rect") and not (ix.mumty and within(rect_of(t), ix.mumty, 0.1)):
        taken += area(rect_of(t))
    for r in ix.level_rooms(ix.roof_id or ""):
        if r.get("type") not in OPEN:
            taken += area(ix.R[r["id"]])
    return max(0.0, fp - taken), fp


def _roof_services(ix: PlanIndex, out: _Out, brief: dict) -> None:
    tank = ix.roof.get("water_tank")
    want_tank = brief.get("water_tank")
    if tank and tank.get("rect") and want_tank:
        tr = rect_of(tank)
        if want_tank == "plastic" and ix.mumty and not within(tr, ix.mumty, 0.1):
            out.add("plan.roof.tank", "Water tank", "warn", "The blue plastic tank should sit on the stair tower's roof.",
                    fix="Put roof.water_tank.rect inside roof.mumty.rect (material plastic).", ref=f"{REF} P-24")
        if want_tank == "concrete" and ix.mumty and overlap_area(tr, ix.mumty) > 0.5:
            out.add("plan.roof.tank", "Water tank", "warn", "The concrete tank overlaps the stair tower.",
                    fix="Put the concrete tank on the roof slab next to the stair tower, 3 ft clear of its door.", ref=f"{REF} P-24")
    solar = brief.get("solar")
    free, fp = roof_free_area(ix)
    if fp > 0:
        kwp = free / 70
        pct = 100 * free / fp
        if solar in ("ready", "panels"):
            st = "pass" if pct >= 55 - 1e-6 else "warn"
            out.add("plan.roof.solar", "Roof kept clear for solar", st,
                    f"About {free:,.0f} sq ft of the roof ({pct:.0f}%) is clear for panels, roughly {kwp:.0f} kW."
                    + ("" if st == "pass" else " Aim for at least 55%."), fix="Keep the stair tower and tank in one corner and "
                    "the rest of the roof clear: no domes, minarets or pergolas.", ref=f"{REF} P-24", value=round(pct), limit=55, unit="%")


# P-25 ----------------------------------------------------------------------------------------------------------------
PROGRAM_TYPES = {
    "bedroom": BEDROOMS, "bed": BEDROOMS, "bedrooms": BEDROOMS, "master_bedroom": {"master_bedroom"}, "master": {"master_bedroom"},
    "guest_bedroom": {"guest_bedroom"}, "guest": {"guest_bedroom"}, "bath": {"bath"}, "bathroom": {"bath"}, "baths": {"bath"},
    "powder": {"powder"}, "powder_room": {"powder"}, "drawing": {"drawing"}, "drawing_room": {"drawing"}, "lounge": {"lounge"},
    "tv_lounge": {"lounge"}, "family_lounge": {"lounge"}, "dining": {"dining"}, "kitchen": {"kitchen"}, "kitchenette": {"kitchen"},
    "dirty_kitchen": {"dirty_kitchen"}, "prayer": {"prayer"}, "prayer_room": {"prayer"}, "study": {"study"}, "office": {"study"},
    "store": {"store"}, "laundry": {"laundry"}, "servant": {"servant"}, "servant_quarter": {"servant"}, "dressing": {"dressing"},
    "terrace": {"terrace"}, "roof_terrace": {"terrace"}, "balcony": {"balcony"}, "porch": {"porch", "garage"},
    "car_porch": {"porch", "garage"}, "garage": {"garage", "porch"}, "lawn": {"lawn"},
}
SUITES = {"bed_bath": ("bedroom", "bath"), "bedroom_bath": ("bedroom", "bath"), "suite": ("bedroom", "bath"),
          "master_suite": ("master_bedroom", "bath"), "master_bed_bath": ("master_bedroom", "bath")}
LEVEL_INDEX = {"basement": -1, "ground": 0, "first": 1, "second": 2, "third": 3}
NAME_MATCH = {"dining": "dining", "lounge": "lounge", "prayer": "prayer", "kitchen": "kitchen", "study": "study"}


def parse_program(rooms: list[str]) -> dict[str, int]:
    """["drawing", "bedroom:2", "bed_bath:1"] -> {"drawing": 1, "bedroom": 3, "bath": 1}."""
    counts: dict[str, int] = defaultdict(int)
    for tok in rooms or []:
        name, _, n = str(tok).strip().lower().replace(" ", "_").replace("-", "_").partition(":")
        try:
            k = max(0, int(float(n))) if n else 1
        except ValueError:
            k = 1
        if name in SUITES:
            a, b = SUITES[name]
            counts[a] += k
            counts[b] += k
        elif name in PROGRAM_TYPES:
            counts[name] += k
    return dict(counts)


def _count(rooms: list[dict], key: str) -> int:
    types = PROGRAM_TYPES[key]
    if key in ("bedroom", "bed", "bedrooms"):
        return sum(1 for r in rooms if r.get("type") in BEDROOMS)
    n = sum(1 for r in rooms if r.get("type") in types)
    if not n and key in NAME_MATCH:
        n = sum(1 for r in rooms if NAME_MATCH[key] in str(r.get("name", "")).lower())
    return n


def _level_for(ix: PlanIndex, name: str) -> str | None:
    name = str(name).strip().lower()
    if name == "roof":
        return ix.roof_id
    if name in ix.lv:
        return name
    idx = LEVEL_INDEX.get(name)
    return next((lv["id"] for lv in ix.levels if lv.get("index") == idx), None) if idx is not None else None


SPACE_REQ = {  # brief.spaces id -> (program key, severity)
    "drawing": ("drawing", "fail"), "tv_lounge": ("lounge", "fail"), "dining": ("dining", "fail"), "kitchen": ("kitchen", "fail"),
    "dirty_kitchen": ("dirty_kitchen", "fail"), "servant_quarter": ("servant", "fail"), "prayer": ("prayer", "fail"),
    "study": ("study", "fail"), "store": ("store", "warn"), "laundry": ("laundry", "warn"), "lawn": ("lawn", "warn"),
    "roof_terrace": ("terrace", "warn"),
}


def _program(ix: PlanIndex, out: _Out, brief: dict) -> None:
    if not brief:
        return
    beds = brief.get("bedrooms")
    have_beds = _count(ix.rooms, "bedroom")
    if isinstance(beds, (int, float)) and beds > 0 and have_beds != int(beds):
        out.add("plan.program.bedrooms", "Bedrooms as briefed", "fail",
                f"The plan has {have_beds} bedroom{'s' if have_beds != 1 else ''}; the brief asks for {int(beds)}.",
                fix=f"Plan exactly {int(beds)} bedrooms (bedroom, master_bedroom or guest_bedroom types; servant rooms don't count).",
                ref=f"{REF} P-25", value=have_beds, limit=int(beds), unit="bedrooms")
    baths = brief.get("bathrooms")
    have_baths = sum(1 for r in ix.rooms if r.get("type") in WET)
    if isinstance(baths, (int, float)) and baths > 0 and have_baths < int(baths):
        out.add("plan.program.bathrooms", "Bathrooms as briefed", "warn",
                f"The plan has {have_baths} bathroom{'s' if have_baths != 1 else ''}; the brief asks for {int(baths)}.",
                fix=f"Plan {int(baths)} baths or powder rooms.", ref=f"{REF} P-25", value=have_baths, limit=int(baths), unit="baths")
    for sp in brief.get("spaces") or []:
        key = str(sp).split(":")[0]
        if key == "car_porch":
            if not any(r.get("type") in ("porch", "garage") for r in ix.rooms):
                out.add("plan.program.space:car_porch", "Car porch", "fail", "The brief asks for a car porch; the plan has none.",
                        fix="Add a porch room inside the building line at the front.", ref=f"{REF} P-25")
            continue
        if key in SPACE_REQ:
            prog, sev = SPACE_REQ[key]
            if _count(ix.rooms, prog) == 0:
                label = key.replace("_", " ")
                out.add(f"plan.program.space:{key}", "Requested room", sev, f"The brief asks for a {label}; the plan has none.",
                        fix=f"Add a {label} ({prog} type).", ref=f"{REF} P-25")
    for fl in brief.get("floors") or []:
        lid = _level_for(ix, fl.get("level", ""))
        want = parse_program(fl.get("rooms") or [])
        if not want:
            continue
        if not lid:
            out.add(f"plan.program.floor:{fl.get('level')}", "Rooms per floor", "fail",
                    f"The brief puts rooms on the {fl.get('level')} floor, but the plan has no such floor.",
                    fix=f"Add the {fl.get('level')} level.", ref=f"{REF} P-25")
            continue
        here = ix.level_rooms(lid)
        wrong = []
        for key, n in want.items():
            have = _count(here, key)
            exact = key in ("bedroom", "bed", "bedrooms", "master_bedroom", "guest_bedroom")
            if (exact and have != n) or (not exact and have < n):
                wrong.append(f"{n} {key.replace('_', ' ')}{'' if n == 1 or key.endswith('s') else 's'} (has {have})")
        if wrong:
            out.add(f"plan.program.floor:{lid}", "Rooms per floor", "fail",
                    f"The {ix.lname(lid)} should have " + ", ".join(wrong) + ".", ids=[r["id"] for r in here if r.get("type") in BEDROOMS][:6],
                    fix=f"Follow brief.floors for the {ix.lname(lid)} exactly.", ref=f"{REF} P-25")
    prefs = " ".join([str(p) for p in brief.get("preferences") or []] + [str(brief.get("notes") or "")]).lower()
    attached_asked = bool(re.search(r"attach|en.?suite", prefs))
    # one bath per bedroom (or more) means attached baths: across the brief, or on a floor of the per-floor program
    beds_n, baths_n = int(brief.get("bedrooms") or 0), int(brief.get("bathrooms") or 0)
    attached_levels: set[str] = set()
    if beds_n and baths_n >= beds_n + 1:
        attached_asked = True
    for fl in brief.get("floors") or []:
        prog = parse_program(fl.get("rooms") or [])
        b = sum(n for k, n in prog.items() if k in ("bedroom", "bed", "bedrooms", "master_bedroom", "guest_bedroom"))
        w = sum(n for k, n in prog.items() if k in ("bath", "bathroom", "baths"))
        if b and w >= b and (lid := _level_for(ix, fl.get("level", ""))):
            attached_levels.add(lid)
    for r in ix.rooms:
        if r.get("type") not in BEDROOMS:
            continue
        own = [nb for nb in ix.door_adj.get(r["id"], ()) if ix.type(nb) in WET | {"dressing"}
               and [x for x in ix.door_adj.get(nb, ()) if x != EXT] == [r["id"]]]
        own += [b for d in own if ix.type(d) == "dressing" for b in ix.door_adj.get(d, ()) if ix.type(b) in WET]
        if not any(ix.type(x) in WET for x in own):
            if r.get("type") == "master_bedroom":
                out.add(f"plan.program.attached_bath:{r['id']}", "Master en-suite", "fail", f"{r['name']} has no bath of its own.",
                        ids=[r["id"]], fix="Give the master bedroom an attached bath whose only door opens into it.", ref=f"{REF} P-25")
            elif attached_asked or r.get("level") in attached_levels:
                out.add(f"plan.program.attached_bath:{r['id']}", "Attached bath", "fail",
                        f"The brief asks for attached baths; {r['name']} has none.", ids=[r["id"]],
                        fix=f"Give {r['name']} its own bath whose only door opens into it.", ref=f"{REF} P-25")
    if re.search(r"open(-|\s)?(plan )?kitchen", prefs):
        kits = [r for r in ix.rooms if r.get("type") == "kitchen"]
        def is_open(k):
            if any(ix.open_pairs.get(tuple(sorted((k["id"], o))), {}).get("valid") for o in k.get("open_to") or []):
                return True
            for (a, b), res in ix.open_pairs.items():
                if res["valid"] and k["id"] in (a, b):
                    return True
            return any(o.get("type") == "arch" and float(o.get("width_ft") or 0) >= 5 for o in ix.door_ops.get(k["id"], []))
        if kits and not any(is_open(k) for k in kits):
            out.add("plan.program.open_kitchen", "Open kitchen", "fail", "The family asked for an open kitchen; the plan's kitchen "
                    "is closed.", ids=[k["id"] for k in kits], fix="Make the kitchen open_to the lounge or dining (no wall between).",
                    ref=f"{REF} P-25")
    if re.search(r"(parent|elder|old|senior|grand)", prefs) and re.search(r"ground", prefs):
        if not any(r.get("type") in BEDROOMS and r.get("level") == ix.ground for r in ix.rooms):
            out.add("plan.program.parents_ground", "Bedroom downstairs", "fail",
                    "The family asked for a bedroom on the ground floor (for the parents); the plan has none.",
                    fix="Put a bedroom with an attached bath on the ground floor.", ref=f"{REF} P-25")


# P-28 (Naqsha): baths you can actually use -------------------------------------------------------------------------------------
BATH_MIN = {"bath": (30.0, 4.5), "powder": (15.0, 3.0)}  # sq ft, clear width (WC + basin; a bath adds a shower)


def _bath_sizes(ix: PlanIndex, out: _Out) -> None:
    for r in ix.rooms:
        t = r.get("type")
        if t not in BATH_MIN:
            continue
        x0, y0, x1, y1 = ix.R[r["id"]]
        w, d = x1 - x0, y1 - y0
        a, narrow = w * d, min(w, d)
        need_a, need_w = BATH_MIN[t]
        if "master" in (r["id"] + r.get("name", "")).lower() and t == "bath":
            need_a = 40.0
        if a + 1e-6 < need_a or narrow + 1e-6 < need_w:
            what = f"{fmt(narrow)} wide" if narrow + 1e-6 < need_w else f"{a:.0f} sq ft"
            out.add(f"plan.room.bath_size:{r['id']}", "Bath size", "fail",
                    f"{r['name']} is only {what} ({fmt(w)} × {fmt(d)}); a usable {('master ' if need_a > 30 else '')}"
                    f"{'bath' if t == 'bath' else 'powder room'} needs {need_a:g} sq ft and {fmt(need_w)} width.", ids=[r["id"]],
                    fix=f"Make {r['name']} at least {need_a:g} sq ft and {need_w:g} ft wide, e.g. 5 × 8 ft (master 6 × 8 ft).",
                    ref=f"{REF} P-28", value=round(a), limit=need_a, unit="sq ft")
        elif t == "bath" and max(w, d) / max(narrow, 0.1) > 2.4:
            out.add(f"plan.room.bath_shape:{r['id']}", "Bath shape", "warn",
                    f"{r['name']} is a long, narrow {fmt(w)} × {fmt(d)}; part of it is wasted corridor.", ids=[r["id"]],
                    fix="Keep baths roughly 5 × 8 to 6 × 10 ft and give the spare length to a wardrobe or the bedroom.",
                    ref=f"{REF} P-28")


# P-26 ----------------------------------------------------------------------------------------------------------------
def _wet_over_dry(ix: PlanIndex, out: _Out) -> None:
    order = [lv["id"] for lv in ix.levels]
    for r in ix.rooms:
        if r.get("type") not in WET or r.get("level") not in order:
            continue
        i = order.index(r["level"])
        if i == 0:
            continue
        below = order[i - 1]
        ra = ix.R[r["id"]]
        for x in ix.level_rooms(below):
            if x.get("type") in BEDROOMS | {"kitchen", "drawing"} and overlap_area(ra, ix.R[x["id"]]) > 0.5 * area(ra):
                out.add(f"plan.structure.wet_over_dry:{r['id']}", "Bath over a dry room", "warn",
                        f"{r['name']} sits over {x['name']}: leaks and drain pipes would run through its ceiling.",
                        ids=[r["id"], x["id"]], fix="Stack baths over baths, kitchens or stores.", ref=f"{REF} P-26")
                break
