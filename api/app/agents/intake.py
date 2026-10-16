"""Setup (intake): the conversation that fills the project Brief.

Free text goes to the conversational setup agent (setup_agent.py, Google ADK), which takes everything it can from one long
message and asks only what is missing. Widget answers (structured chips such as `plot:35x65`, `tank:concrete`,
`floor:ground=drawing,kitchen,bedroom:1`) are parsed deterministically and the next question is asked instantly from a fixed
bank, so one-tap answers never wait for a model. The LDA envelope is computed deterministically whenever the plot is known.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import AsyncIterator

from ..compliance import lda
from ..store import db

log = logging.getLogger("naqsha.intake")

PLOT_PRESETS = {  # typical Lahore scheme dimensions (docs/research/lda-regulations.md §1.2)
    3: (19, 35.5), 5: (25, 45), 7: (30, 52.5), 10: (35, 65), 20: (50, 90), 40: (75, 120),
}
AUTHORITIES = {"LDA", "DHA", "BAHRIA", "RDA", "FDA", "MDA", "GDA", "OTHER"}
STYLE_NAMES = ["Modern Contemporary", "Spanish", "Classic", "Minimalist", "Mediterranean", "Mughal Revival", "Industrial"]
FACINGS = {"N", "NE", "E", "SE", "S", "SW", "W", "NW"}
FACING_WORDS = {"north": "N", "northeast": "NE", "north-east": "NE", "east": "E", "southeast": "SE", "south-east": "SE",
                "south": "S", "southwest": "SW", "south-west": "SW", "west": "W", "northwest": "NW", "north-west": "NW"}
SPACE_IDS = {"drawing", "tv_lounge", "dining", "kitchen", "dirty_kitchen", "servant_quarter", "lawn", "prayer", "store",
             "laundry", "roof_terrace", "study", "gym"}
BUDGETS = ["economy", "standard", "premium", "luxury"]
ESSENTIAL = ["authority", "plot", "storeys", "bedrooms", "bathrooms", "style"]
# The order questions are asked in. Optional ones (facing, floors, water_tank, solar) are asked once, unless already known
# or skipped (a skipped field is recorded in auto_filled with Naqsha's choice).
ASK_ORDER = ["authority", "plot", "facing", "storeys", "bedrooms", "floors", "water_tank", "solar", "style"]
DEFAULT_SPACES = ["drawing", "tv_lounge", "dining", "kitchen", "car_porch:1", "lawn", "store"]
LEVEL_NAMES = ["ground", "first", "second", "third", "basement", "roof"]


# --- brief model ---------------------------------------------------------------------------------------------------
def empty_brief() -> dict:
    return {"city": "Lahore", "authority": None, "plot": None, "storeys": None, "basement": False, "bedrooms": None,
            "bathrooms": None, "spaces": [], "style": None, "auto_filled": [], "preferences": []}


def _normalize_plot(plot: dict | None) -> dict | None:
    if not plot:
        return None
    w, d, m = plot.get("width_ft"), plot.get("depth_ft"), plot.get("area_marla")
    if (not w or not d) and m:
        key = min(PLOT_PRESETS, key=lambda k: abs(k - m))
        w, d = PLOT_PRESETS[key] if abs(key - m) < 0.6 else (round((m * 225) ** 0.5 * 0.7, 1), round((m * 225) ** 0.5 / 0.7, 1))
    if not w or not d:
        return None
    return {"width_ft": float(w), "depth_ft": float(d), "area_marla": round(w * d / lda.MARLA_SQFT, 1), "corner": bool(plot.get("corner"))}


def norm_tank(v) -> str | None:
    s = str(v or "").strip().lower()
    if not s:
        return None
    if any(t in s for t in ("concrete", "rcc", "cement", "masonry", "underground")):
        return "concrete"
    if any(t in s for t in ("plastic", "pvc", "blue", "fibre", "fiber", "poly")):
        return "plastic"
    return None


def norm_solar(v) -> str | None:
    s = str(v or "").strip().lower()
    if not s:
        return None
    if s in ("none", "no", "not now", "false", "off") or "no solar" in s or "not now" in s:
        return "none"
    if any(t in s for t in ("ready", "provision", "clear", "later", "future")):
        return "ready"
    if any(t in s for t in ("panel", "install", "yes", "now", "frame", "true", "kw")):
        return "panels"
    return None


def norm_facing(v) -> str | None:
    s = str(v or "").strip()
    if s.upper() in FACINGS:
        return s.upper()
    return FACING_WORDS.get(s.lower().replace(" ", ""))


def norm_style(v) -> str | None:
    s = str(v or "").strip()
    if not s or s.upper() in AUTHORITIES:
        return None
    for name in STYLE_NAMES:
        if s.lower() == name.lower() or s.lower() in (name.split()[0].lower(),):
            return name
    if "modern" in s.lower() or "contemporary" in s.lower():
        return "Modern Contemporary"
    return s[:60]


def parse_floor_spec(spec: str) -> dict | None:
    """"ground=drawing,kitchen,bedroom:1,bath:2" -> {"level": "ground", "rooms": [...]}."""
    level, _, rooms = str(spec).partition("=")
    level = level.strip().lower()
    if level in ("g", "gf", "ground floor"):
        level = "ground"
    if level in ("1", "1st", "f", "ff", "first floor", "upper"):
        level = "first"
    if level in ("2", "2nd", "second floor"):
        level = "second"
    if level not in LEVEL_NAMES:
        return None
    toks = [t.strip().lower().replace(" ", "_") for t in re.split(r"[,;]", rooms) if t.strip()]
    return {"level": level, "rooms": toks}


def merge_floors(cur: list | None, new: list | None) -> list:
    by = {f["level"]: f for f in cur or [] if isinstance(f, dict) and f.get("level")}
    for f in new or []:
        if isinstance(f, str):
            f = parse_floor_spec(f)
        if isinstance(f, dict) and f.get("level"):
            by[f["level"]] = {"level": f["level"], "rooms": list(f.get("rooms") or [])}
    order = {n: i for i, n in enumerate(["basement", "ground", "first", "second", "third", "roof"])}
    return sorted(by.values(), key=lambda f: order.get(f["level"], 9))


def _append_unique(cur: list, items) -> list:
    out = list(cur or [])
    seen = {str(x).strip().lower() for x in out}
    for it in items or []:
        t = str(it).strip()
        if t and t.lower() not in seen:
            out.append(t)
            seen.add(t.lower())
    return out


def _merge_spaces(cur: list, add: list, remove: list | None = None) -> list:
    out = [s for s in cur or [] if s not in set(remove or [])]
    for s in add or []:
        s = str(s).strip().lower().replace(" ", "_")
        if s.startswith("car_porch"):
            out = [x for x in out if not x.startswith("car_porch")]
        if s and s not in out:
            out.append(s)
    return out


def merge_brief(brief: dict, patch: dict, auto: list[str] | None = None, spaces_mode: str = "replace") -> dict:
    """Merge a patch into the brief. notes and preferences are appended, never overwritten; floors merge per level;
    spaces replace (widgets send the whole set) or union (the agent adds what was mentioned)."""
    out = {**(brief or empty_brief())}
    patch = dict(patch or {})
    if str(patch.get("style", "")).upper() in AUTHORITIES:  # model slip: an authority answer filed under style
        patch.setdefault("authority", str(patch.pop("style")).upper())
    for k, v in patch.items():
        if v in (None, "", [], {}):
            continue
        if k == "plot":
            v = _normalize_plot({**(out.get("plot") or {}), **v})
            if not v:
                continue
        elif k == "authority":
            v = str(v).upper()
            if v not in AUTHORITIES:
                continue
        elif k == "storeys":
            v = max(1, min(3, int(v)))
        elif k in ("bedrooms", "bathrooms"):
            v = max(1, min(12, int(v)))
        elif k == "facing":
            v = norm_facing(v)
            if not v:
                continue
        elif k == "style":
            v = norm_style(v)
            if not v:
                continue
        elif k == "water_tank":
            v = norm_tank(v)
            if not v:
                continue
        elif k == "solar":
            v = norm_solar(v)
            if not v:
                continue
        elif k == "budget":
            v = str(v).lower()
            if v not in BUDGETS:
                continue
        elif k == "floors":
            v = merge_floors(out.get("floors"), v if isinstance(v, list) else [v])
        elif k == "spaces":
            v = list(v) if spaces_mode == "replace" else _merge_spaces(out.get("spaces") or [], v)
        elif k == "remove_spaces":
            out["spaces"] = _merge_spaces(out.get("spaces") or [], [], v)
            continue
        elif k == "preferences":
            v = _append_unique(out.get("preferences") or [], v if isinstance(v, list) else [v])
        elif k == "notes":
            prev = str(out.get("notes") or "").strip()
            add = str(v).strip()
            if add.lower() in prev.lower():
                continue
            v = f"{prev} {add}".strip() if prev else add
        out[k] = v
        if k in (out.get("auto_filled") or []) and k not in (auto or []):  # the family decided it now
            out["auto_filled"] = [x for x in out["auto_filled"] if x != k]
    if str(out.get("style") or "").upper() in AUTHORITIES:
        out["style"] = None
    if patch.get("floors"):
        _derive_from_floors(out, patch)
    out["auto_filled"] = sorted(set(out.get("auto_filled") or []) | set(auto or []))
    return out


FLOOR_SPACE = {"drawing": "drawing", "drawing_room": "drawing", "lounge": "tv_lounge", "tv_lounge": "tv_lounge",
               "family_lounge": "tv_lounge", "dining": "dining", "kitchen": "kitchen", "kitchenette": "kitchen",
               "dirty_kitchen": "dirty_kitchen", "prayer": "prayer", "prayer_room": "prayer", "study": "study", "office": "study",
               "store": "store", "laundry": "laundry", "servant": "servant_quarter", "servant_quarter": "servant_quarter",
               "terrace": "roof_terrace", "roof_terrace": "roof_terrace", "lawn": "lawn"}


def _derive_from_floors(out: dict, patch: dict) -> None:
    """The per-floor program implies totals and spaces: keep them consistent unless the family gave totals themselves."""
    from ..compliance.planning import parse_program
    beds = baths = 0
    spaces = []
    for f in out.get("floors") or []:
        prog = parse_program(f.get("rooms") or [])
        beds += sum(n for k, n in prog.items() if k in ("bedroom", "bed", "bedrooms", "master_bedroom", "guest_bedroom"))
        baths += sum(n for k, n in prog.items() if k in ("bath", "bathroom", "baths", "powder", "powder_room"))
        for tok in f.get("rooms") or []:
            name = str(tok).split(":")[0]
            if name in FLOOR_SPACE:
                spaces.append(FLOOR_SPACE[name])
    if beds and not patch.get("bedrooms"):
        out["bedrooms"] = beds
    if baths and not patch.get("bathrooms"):
        out["bathrooms"] = max(baths, int(out.get("bathrooms") or 0)) if "bathrooms" not in (out.get("auto_filled") or []) else baths
        out["auto_filled"] = [x for x in out.get("auto_filled") or [] if x != "bathrooms"]
    out["spaces"] = _merge_spaces(out.get("spaces") or [], spaces)


def parse_chips(chips: list[str] | None) -> tuple[dict, list[str]]:
    """Structured widget tokens → (brief patch, tokens not understood).
    plot:35x65 · corner:true · storeys:2 · bedrooms:4 · bathrooms:5 · coords:31.47,74.27 · facing:N (or N) · tank:concrete ·
    solar:ready · floor:ground=drawing,kitchen,bedroom:1 · floors:auto · style:Spanish (or a style name) · budget:premium ·
    authority (LDA, DHA, ...) · space ids and car_porch:N."""
    patch: dict = {}
    spaces: list[str] = []
    floors: list[dict] = []
    unknown: list[str] = []
    styles = {k.lower(): k for k in STYLE_NAMES}
    for raw in chips or []:
        c = str(raw).strip()
        key, _, val = c.partition(":")
        k = key.lower().strip()
        try:
            if k == "plot" and "x" in val.lower():
                w, d = (float(v) for v in val.lower().split("x", 1))
                patch.setdefault("plot", {}).update(width_ft=w, depth_ft=d)
            elif k == "marla":
                patch.setdefault("plot", {}).update(area_marla=float(val))
            elif k == "corner":
                patch.setdefault("plot", {})["corner"] = val.lower() in ("true", "yes", "1")
            elif k in ("storeys", "bedrooms", "bathrooms"):
                patch[k] = int(float(val))
            elif k == "basement":
                patch["basement"] = val.lower() in ("true", "yes", "1")
            elif k == "coords" and "," in val:
                lat, lng = (float(v) for v in val.split(",", 1))
                patch["coordinates"] = {"lat": lat, "lng": lng}
            elif k == "facing" and norm_facing(val):
                patch["facing"] = norm_facing(val)
            elif k == "tank" and norm_tank(val):
                patch["water_tank"] = norm_tank(val)
            elif k == "solar" and norm_solar(val):
                patch["solar"] = norm_solar(val)
            elif k == "floor" and parse_floor_spec(val):
                floors.append(parse_floor_spec(val))
            elif k == "floors" and val.lower() in ("auto", "decide", "skip"):
                patch["_floors_auto"] = True
            elif k == "style" and norm_style(val):
                patch["style"] = norm_style(val)
            elif k == "budget" and val.lower() in BUDGETS:
                patch["budget"] = val.lower()
            elif k == "authority" and val.upper() in AUTHORITIES:
                patch["authority"] = val.upper()
            elif k == "scheme" and val:
                patch["scheme"] = val.strip()
            elif k == "car_porch" or c in SPACE_IDS:
                spaces.append(c)
            elif c.lower() in styles:
                patch["style"] = styles[c.lower()]
            elif c.upper() in AUTHORITIES:
                patch["authority"] = c.upper()
            elif c.upper() in FACINGS:
                patch["facing"] = c.upper()
            elif c.lower() in BUDGETS:
                patch["budget"] = c.lower()
            else:
                unknown.append(c)
        except ValueError:
            unknown.append(c)
    if spaces:
        patch["spaces"] = spaces
    if floors:
        patch["floors"] = floors
    return patch, unknown


def defaults_for(brief: dict) -> tuple[dict, list[str]]:
    """Sensible defaults for anything missing (used by skip_all and before a design run)."""
    b, auto = {**brief}, []
    if str(b.get("style") or "").upper() in AUTHORITIES:
        b["style"] = None

    def put(k, v):
        if not b.get(k):
            b[k] = v
            auto.append(k)
    put("authority", "LDA")
    if not b.get("plot"):
        b["plot"] = _normalize_plot({"area_marla": 10})
        auto.append("plot")
    marla = b["plot"]["area_marla"]
    put("storeys", 1 if marla < 4 else 2)
    put("bedrooms", 2 if marla < 4 else 3 if marla < 7 else 4 if marla < 15 else 5)
    put("bathrooms", b["bedrooms"] + 1)
    spaces = list(DEFAULT_SPACES)
    if marla >= 10:
        spaces += ["dirty_kitchen", "laundry"]
    if marla >= 20:
        spaces += ["servant_quarter", "prayer", "roof_terrace"]
        spaces = [s if not s.startswith("car_porch") else "car_porch:2" for s in spaces]
    put("spaces", spaces)
    put("style", "Modern Contemporary")
    put("facing", "N")
    put("budget", "standard")
    put("water_tank", "concrete")
    put("solar", "ready")
    b["auto_filled"] = sorted(set(b.get("auto_filled") or []) | set(auto))
    return b, auto


DEFAULT_FOR_FIELD = {"authority": "LDA", "facing": "N", "water_tank": "concrete", "solar": "ready",
                     "style": "Modern Contemporary", "budget": "standard"}


def skip_field(brief: dict, field: str | None) -> dict:
    """The family said "you decide" for one question: choose for them and remember it was our choice."""
    if not field:
        return brief
    if field == "floors":
        return merge_brief(brief, {}, ["floors"])
    if field in DEFAULT_FOR_FIELD:
        return merge_brief(brief, {field: DEFAULT_FOR_FIELD[field]}, [field])
    filled, auto = defaults_for(brief)
    keep = {k: filled[k] for k in auto if k in (field, "plot", "storeys", "bedrooms", "bathrooms", "spaces") and
            (k == field or field in ("bedrooms", "rooms") and k in ("bathrooms", "spaces"))}
    return merge_brief(brief, keep, list(keep))


def missing(brief: dict) -> list[str]:
    return [k for k in ESSENTIAL if not brief.get(k)]


def to_ask(brief: dict) -> list[str]:
    """What to ask next, in order: missing essentials plus the optional questions not yet answered or skipped."""
    auto = set(brief.get("auto_filled") or [])
    out = []
    for k in ASK_ORDER:
        if k == "bedrooms":
            if not brief.get("bedrooms"):
                out.append(k)
        elif k == "floors":
            if (brief.get("storeys") or 1) >= 2 and not brief.get("floors") and "floors" not in auto:
                out.append(k)
        elif not brief.get(k) and k not in auto:
            out.append(k)
    return out


def envelope_for(brief: dict) -> dict | None:
    p = brief.get("plot")
    if not p:
        return None
    env = lda.envelope(p["width_ft"], p["depth_ft"], brief.get("authority") or "LDA", bool(p.get("corner")))
    env.pop("_band", None)
    return env


def lda_facts(brief: dict) -> str:
    """Plain facts the agent may quote (and nothing else) about the LDA envelope for this plot."""
    env = envelope_for(brief)
    if not env:
        return "Plot not known yet. LDA heights by band: under 10 marla 38 ft; 10 marla and above 45 ft; both measured to the top " \
               "of the parapet with the stair tower (mumty, up to 9'6\") excluded; max 3 storeys plus a basement."
    sb = env["setbacks_ft"]
    sides = env.get("side_space_note") or ""
    return (f"{env['band']} band. Open spaces: front {sb['front']:g} ft, rear {sb['rear']:g} ft; {sides.lower()}. "
            f"Ground coverage up to {env['max_coverage_pct']:g}% ({env['max_ground_coverage_sqft']:,.0f} sq ft). FAR up to "
            f"{env['max_far']:g}. Height up to {env['max_height_ft']:g} ft to the top of the parapet, stair tower (mumty, up to "
            f"9'6\") excluded. Max {env['max_storeys']} storeys plus a basement. " + " ".join(env["notes"][4:]))


# --- the question bank (instant, deterministic) ------------------------------------------------------------------------
def _solar_hint(brief: dict) -> str:
    env = envelope_for(brief)
    if not env:
        return "About 18 panels, ~10 kW"
    roof = env["max_ground_coverage_sqft"] * 0.55
    kw = max(2, round(roof / 70))
    return f"About {round(kw / 0.55)} panels, ~{kw} kW"


def question(field: str, brief: dict) -> dict:
    """The message for asking `field`, with its widget and one-tap chips."""
    if field == "authority":
        return {"text": "Where is the plot?", "field": "authority", "input": None, "allow_skip": True, "chips": [
            {"label": "Lahore · LDA scheme", "value": "LDA"}, {"label": "DHA Lahore", "value": "DHA"},
            {"label": "Bahria Town Lahore", "value": "BAHRIA"}, {"label": "Another Punjab city", "value": "OTHER"}]}
    if field == "plot":
        return {"text": "How big is the plot? Tap a size or enter the exact width and depth.", "field": "plot", "input": "plot",
                "allow_skip": True, "chips": [
                    {"label": "5 marla", "value": "plot:25x45", "hint": "25 × 45 ft"},
                    {"label": "7 marla", "value": "plot:30x52.5", "hint": "30 × 52.5 ft"},
                    {"label": "10 marla", "value": "plot:35x65", "hint": "35 × 65 ft · Most popular"},
                    {"label": "1 kanal", "value": "plot:50x90", "hint": "50 × 90 ft"},
                    {"label": "2 kanal", "value": "plot:75x120", "hint": "75 × 120 ft"}]}
    if field == "facing":
        return {"text": "Which way does the front of the plot face?", "field": "facing", "input": "map", "allow_skip": True,
                "chips": [{"label": n, "value": f"facing:{c}"} for n, c in (("North", "N"), ("North-east", "NE"), ("East", "E"),
                                                                           ("South-east", "SE"), ("South", "S"), ("South-west", "SW"),
                                                                           ("West", "W"), ("North-west", "NW"))]}
    if field == "storeys":
        return {"text": "How many floors?", "field": "storeys", "input": None, "allow_skip": True, "chips": [
            {"label": "Single storey", "value": "storeys:1"}, {"label": "Double storey", "value": "storeys:2"},
            {"label": "Triple storey", "value": "storeys:3", "hint": "LDA allows up to 3"}]}
    if field == "bedrooms":
        return {"text": "How many bedrooms, and which rooms do you need?", "field": "bedrooms", "input": "rooms", "allow_skip": True,
                "chips": [{"label": f"{n} bedrooms", "value": f"bedrooms:{n}"} for n in (3, 4, 5, 6)]}
    if field == "floors":
        return {"text": "What goes on each floor? Move rooms between floors, or let me decide.", "field": "floors",
                "input": "floors", "allow_skip": True, "chips": [{"label": "Decide for me", "value": "floors:auto"}]}
    if field == "water_tank":
        return {"text": "Which water tank should the roof have?", "field": "water_tank", "input": None, "allow_skip": True, "chips": [
            {"label": "Concrete tank in the stair tower", "value": "tank:concrete", "hint": "Hidden, lasts decades · Recommended"},
            {"label": "Blue plastic tank", "value": "tank:plastic", "hint": "Cheaper, visible on the roof"}]}
    if field == "solar":
        return {"text": "Shall I keep the roof clear for solar panels?", "field": "solar", "input": None, "allow_skip": True, "chips": [
            {"label": "Keep the roof clear for solar", "value": "solar:ready", "hint": _solar_hint(brief)},
            {"label": "Add the solar frame now", "value": "solar:panels"},
            {"label": "Not now", "value": "solar:none"}]}
    if field == "style":
        return {"text": "Which style feels like home?", "field": "style", "input": "style", "allow_skip": True,
                "chips": [{"label": s, "value": s} for s in STYLE_NAMES[:6]]}
    return {"text": "Anything else I should know?", "field": field, "input": "text", "allow_skip": True, "chips": []}


SPACE_LABEL = {"drawing": "drawing room", "tv_lounge": "TV lounge", "dining": "dining", "kitchen": "kitchen",
               "dirty_kitchen": "dirty kitchen", "servant_quarter": "servant quarter", "lawn": "lawn", "prayer": "prayer room",
               "store": "store", "laundry": "laundry", "roof_terrace": "roof terrace", "study": "study", "gym": "gym"}
TANK_LABEL = {"concrete": "Concrete water tank in the stair tower", "plastic": "Blue plastic water tank"}
SOLAR_LABEL = {"ready": "Roof kept clear for solar", "panels": "Solar frame on the roof", "none": "No solar for now"}
FIELD_LABEL = {"authority": "authority", "plot": "plot size", "facing": "facing", "storeys": "number of floors",
               "bedrooms": "bedrooms", "bathrooms": "bathrooms", "spaces": "rooms", "style": "style", "budget": "budget",
               "water_tank": "water tank", "solar": "solar", "floors": "rooms per floor"}


FACING_NAME = {"N": "north", "NE": "north-east", "E": "east", "SE": "south-east", "S": "south", "SW": "south-west",
               "W": "west", "NW": "north-west"}
ROOM_WORD = {"bedroom": ("bedroom", "bedrooms"), "master_bedroom": ("master bedroom", "master bedrooms"),
             "guest_bedroom": ("guest bedroom", "guest bedrooms"), "bath": ("bath", "baths"), "powder": ("powder room", "powder rooms"),
             "drawing": ("drawing room", "drawing rooms"), "lounge": ("lounge", "lounges"), "tv_lounge": ("TV lounge", "TV lounges"),
             "dining": ("dining", "dining"), "kitchen": ("kitchen", "kitchens"), "kitchenette": ("kitchenette", "kitchenettes"),
             "dirty_kitchen": ("dirty kitchen", "dirty kitchens"), "prayer": ("prayer room", "prayer rooms"), "study": ("study", "studies"),
             "store": ("store", "stores"), "laundry": ("laundry", "laundries"), "servant_quarter": ("servant quarter", "servant quarters"),
             "dressing": ("dressing", "dressings"), "terrace": ("terrace", "terraces"), "balcony": ("balcony", "balconies")}


def marla_label(m: float) -> str:
    if m >= 19.5 and abs(m / 20 - round(m / 20)) < 0.03:
        return f"{round(m / 20):g} kanal"
    return f"{round(m):g} marla" if abs(m - round(m)) < 0.2 else f"{m:g} marla"


def _floor_line(f: dict) -> str:
    from ..compliance.planning import parse_program
    parts = []
    for k, n in parse_program(f.get("rooms") or []).items():
        one, many = ROOM_WORD.get(k, (k.replace("_", " "), k.replace("_", " ") + "s"))
        parts.append(one if n == 1 else f"{n} {many}")
    return f"{f['level'].capitalize()} floor: " + ", ".join(parts)


def understood(brief: dict, agent: dict | None = None) -> dict:
    """The "Here's what I understood" card. Guaranteed facts are computed (never model-written numbers); preferences are
    what the family said; assumptions are what Naqsha chose."""
    env = envelope_for(brief)
    g = []
    if env:
        sb = env["setbacks_ft"]
        side = env.get("side_space_note") or ""
        g.append(f"LDA open spaces kept: {sb['front']:g} ft front, {sb['rear']:g} ft rear" + (f", {side.lower()}" if "no side" not in side.lower() else ""))
        g.append(f"Height within {env['max_height_ft']:g} ft (stair tower excluded), at most {env['max_storeys']} storeys")
        g.append(f"Ground coverage within {env['max_coverage_pct']:g}% ({env['max_ground_coverage_sqft']:,.0f} sq ft)")
    g += ["Every bedroom opens onto a corridor or lounge, never another bedroom",
          "A stair reaches every floor and the roof, with the roof door at its landing",
          "Railings at every drop, and nothing blocks a door"]
    auto = set(brief.get("auto_filled") or [])
    prefs, assumed = [], []
    p = brief.get("plot")
    if p:
        where = brief.get("scheme") or {"DHA": "DHA Lahore", "BAHRIA": "Bahria Town"}.get(brief.get("authority") or "", brief.get("city") or "")
        fact = f"{marla_label(p['area_marla'])}, {p['width_ft']:g} × {p['depth_ft']:g} ft" + (f", {where}" if where else "")
        (assumed if "plot" in auto else prefs).append(fact)
        prefs.append("Corner plot" if p.get("corner") else "Mid-row plot, neighbours on both sides")
    if brief.get("facing"):
        (assumed if "facing" in auto else prefs).append(f"Front faces {FACING_NAME.get(brief['facing'], brief['facing'])}")
    if brief.get("storeys"):
        s = {1: "Single storey", 2: "Two storeys", 3: "Three storeys"}[brief["storeys"]] + (" plus a basement" if brief.get("basement") else "")
        (assumed if "storeys" in auto else prefs).append(s)
    if brief.get("bedrooms"):
        (assumed if "bedrooms" in auto else prefs).append(f"{brief['bedrooms']} bedrooms")
    if brief.get("bathrooms"):
        (assumed if "bathrooms" in auto else prefs).append(f"{brief['bathrooms']} baths")
    for f in brief.get("floors") or []:
        prefs.append(_floor_line(f))
    on_floors = {FLOOR_SPACE.get(str(t).split(":")[0]) for f in brief.get("floors") or [] for t in f.get("rooms") or []}
    sp = [SPACE_LABEL.get(s.split(":")[0], s.replace("_", " ")) if not s.startswith("car_porch") else
          f"{s.split(':')[1] if ':' in s else 1}-car porch" for s in brief.get("spaces") or [] if s not in on_floors]
    if sp:
        line = ", ".join(sp)
        (assumed if "spaces" in auto else prefs).append(line[:1].upper() + line[1:])
    if brief.get("water_tank"):
        (assumed if "water_tank" in auto else prefs).append(TANK_LABEL[brief["water_tank"]])
    if brief.get("solar"):
        (assumed if "solar" in auto else prefs).append(SOLAR_LABEL[brief["solar"]])
    if brief.get("style"):
        (assumed if "style" in auto else prefs).append(f"{brief['style']} style")
    if brief.get("budget"):
        (assumed if "budget" in auto else prefs).append(f"{brief['budget'].capitalize()} budget")
    prefs += [str(x)[:1].upper() + str(x)[1:] for x in brief.get("preferences") or []]
    if "floors" in auto:
        assumed.append("I'll place the rooms on each floor")
    if agent:  # the family's own words are already in brief.preferences; the agent adds only its own assumptions
        assumed = _append_unique(assumed, agent.get("assumptions") or [])
    return {"guaranteed": g, "preferences": _append_unique([], prefs), "assumptions": _append_unique([], assumed)}


def summary(b: dict) -> str:
    p = b.get("plot") or {}
    return (f"{marla_label(p.get('area_marla') or 10)} ({p.get('width_ft', '?'):g} × {p.get('depth_ft', '?'):g} ft), "
            f"{b.get('storeys')}-storey, {b.get('bedrooms')} bedrooms and {b.get('bathrooms')} baths, {b.get('style')}")


def auto_name(project: dict, brief: dict) -> str | None:
    if project.get("name") not in (None, "", "Untitled home"):
        return None
    p = brief.get("plot")
    if not p:
        return None
    m = p["area_marla"]
    size = marla_label(m)
    where = brief.get("scheme") or {"DHA": "DHA Lahore", "BAHRIA": "Bahria Town"}.get(brief.get("authority") or "", brief.get("city") or "Lahore")
    return f"{size} home, {where}"


def next_stage(project: dict, complete: bool) -> str:
    """Never move a project backwards: editing the brief after a design keeps it at its design stage."""
    cur = project.get("stage") or "setup"
    if cur in ("planning", "building", "ready", "revising") or project.get("versions"):
        return cur if cur != "setup" else "ready"
    if cur == "concepts":
        return "concepts"
    return "concepts" if complete else "setup"


GREETING = "Tell me about the plot and who will live there. One message is enough."
GREETING_SUGGESTIONS = [
    "10 marla in Johar Town, mid-row, facing north. Two storeys, 5 bedrooms with attached baths, my parents' room on the "
    "ground floor, open kitchen with a dirty kitchen, 2-car porch, solar panels and a concrete water tank. Modern style.",
    "5 marla corner plot in DHA Lahore, east-facing, for a family of four",
    "1 kanal in Bahria Town with a servant quarter and a prayer room",
]
COMPLETE_SUGGESTIONS = ["Show me concepts", "Add a prayer room", "Make the kitchen open"]


# --- the turn ------------------------------------------------------------------------------------------------------------
async def _save(project: dict, brief: dict, complete: bool, before: dict | None) -> tuple[dict, dict | None, bool]:
    """Persist the brief + envelope + stage. Returns (brief, envelope, newly_complete)."""
    pid = project["id"]
    env = envelope_for(brief)
    was_complete = bool(project.get("intake_complete"))
    complete = complete and not missing(brief)
    fields = {"brief": brief, "envelope": env, "intake_complete": was_complete or complete,
              "stage": next_stage(project, was_complete or complete)}
    if project.get("versions") and before is not None and _design_fields(before) != _design_fields(brief):
        fields["brief_changed"] = True
    if (name := auto_name(project, brief)):
        fields["name"] = name
    project.update(await db.patch_project(pid, **fields))
    return brief, env, complete and not was_complete


def _design_fields(b: dict) -> dict:
    return {k: b.get(k) for k in ("plot", "storeys", "basement", "bedrooms", "bathrooms", "spaces", "floors", "water_tank",
                                  "solar", "preferences", "style", "facing")}


async def run_turn(project: dict, message: str | None, action: str | None, chips: list[str] | None) -> AsyncIterator[tuple[str, dict]]:
    pending: list[asyncio.Task] = []
    try:
        async for ev in _turn(project, message, action, chips, pending):
            yield ev
    finally:
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)


async def _turn(project: dict, message: str | None, action: str | None, chips: list[str] | None,
                pending: list) -> AsyncIterator[tuple[str, dict]]:
    pid = project["id"]
    brief = project.get("brief") or empty_brief()
    before = dict(brief)
    history = await db.list_messages(pid)
    last_q = next((m for m in reversed(history) if m["role"] == "assistant"), None)

    if action == "start":
        if not history:
            yield "message", await db.add_message(pid, {"role": "assistant", "text": GREETING, "chips": [], "input": "text",
                                                        "suggestions": GREETING_SUGGESTIONS, "allow_skip": False})
        return

    user_text = (message or "").strip() or (", ".join(chips) if chips else "")
    if action == "skip_question":
        user_text = "You decide."
    elif action == "skip_all":
        user_text = "Skip setup and design it for me."
    if user_text:  # shown at once; written while the turn runs
        um = db.make_message({"role": "user", "text": user_text})
        pending.append(asyncio.create_task(db.put_message(pid, um)))
        yield "message", um

    if action == "skip_all":
        brief, _ = defaults_for(brief)
        brief, env, _ = await _save(project, brief, True, before)
        yield "brief", {"brief": brief, "envelope": env}
        text = (f"Here's a starting brief: {summary(brief)}. Tap anything to change it; next I'll sketch four exteriors.")
        yield "message", await db.add_message(pid, {"role": "assistant", "text": text, "chips": [], "input": None,
                                                    "understood": understood(brief), "suggestions": COMPLETE_SUGGESTIONS})
        yield "intake.complete", {"brief": brief, "envelope": env}
        return

    structured, unknown = parse_chips(chips)
    floors_auto = structured.pop("_floors_auto", False)
    fast = action == "skip_question" or (bool(chips) and not unknown and (structured or floors_auto))
    if fast:  # widget answers: deterministic, instant
        if action == "skip_question":
            brief = skip_field(brief, (last_q or {}).get("field"))
        else:
            brief = merge_brief(brief, structured, ["floors"] if floors_auto else [], spaces_mode="replace")
            if structured.get("bedrooms") and not structured.get("bathrooms") and not brief.get("bathrooms"):
                brief = merge_brief(brief, {"bathrooms": structured["bedrooms"] + 1}, ["bathrooms"])
        nxt = to_ask(brief)
        complete = not nxt and not missing(brief)
        if complete and not brief.get("spaces"):
            brief = merge_brief(brief, {"spaces": defaults_for(brief)[0]["spaces"]}, ["spaces"])
        brief, env, newly = await _save(project, brief, complete, before)
        yield "brief", {"brief": brief, "envelope": env}
        if complete:
            msg = {"role": "assistant", "text": _complete_text(project, brief), "chips": [], "input": None,
                   "understood": understood(brief), "suggestions": _complete_suggestions(project)}
            yield "message", await db.add_message(pid, msg)
            if newly:
                yield "intake.complete", {"brief": brief, "envelope": env}
        else:
            q = question(nxt[0], brief)
            ack = _ack(structured, brief) if action != "skip_question" else _ack_skip((last_q or {}).get("field"), brief)
            msg = {"role": "assistant", "text": (ack + " " + q["text"]).strip(), "chips": q["chips"], "input": q["input"],
                   "field": q["field"], "allow_skip": q["allow_skip"], "multi": False}
            yield "message", await db.add_message(pid, msg)
        return

    # free text (or chips the bank doesn't know): the conversational agent
    from .setup_agent import agent_turn
    async for ev in agent_turn(project, brief, before, history, user_text, structured):
        yield ev


def _complete_text(project: dict, brief: dict) -> str:
    if project.get("versions"):
        return ("Noted. Your current design was made before this change; revise it or design again to bring it in.")
    return "Here's what I understood. Tap anything I got wrong; when you're happy, I'll sketch four exteriors."


def _complete_suggestions(project: dict) -> list[str]:
    return [] if project.get("versions") else COMPLETE_SUGGESTIONS


def _ack(patch: dict, brief: dict) -> str:
    """A short read-back of a widget answer."""
    if "plot" in patch and brief.get("plot"):
        p = brief["plot"]
        env = envelope_for(brief)
        extra = f" LDA needs {env['setbacks_ft']['front']:g} ft open at the front; I'll keep it." if env else ""
        return f"{marla_label(p['area_marla'])}, {p['width_ft']:g} × {p['depth_ft']:g} ft.{extra}"
    if "water_tank" in patch:
        return {"concrete": "A concrete tank, hidden in the stair tower.", "plastic": "A blue plastic tank on the stair tower."}[brief["water_tank"]]
    if "solar" in patch:
        return {"ready": "I'll keep the roof clear for panels.", "panels": "I'll add a solar frame on the roof.",
                "none": "No solar for now."}[brief["solar"]]
    if "floors" in patch:
        return "Got the rooms for each floor."
    if "style" in patch:
        return f"{brief['style']}, lovely."
    if "storeys" in patch:
        return {1: "Single storey.", 2: "Two storeys.", 3: "Three storeys."}[brief["storeys"]]
    if "bedrooms" in patch:
        return f"{brief['bedrooms']} bedrooms."
    return "Noted."


def _ack_skip(field: str | None, brief: dict) -> str:
    if field == "floors":
        return "I'll place the rooms on each floor."
    if field and brief.get(field) not in (None, "", []):
        v = brief[field]
        label = {"water_tank": TANK_LABEL, "solar": SOLAR_LABEL}.get(field, {}).get(v, v)
        return f"I've chosen {str(label).lower() if isinstance(label, str) else label} for the {FIELD_LABEL.get(field, field)}."
    return "I'll decide that."
