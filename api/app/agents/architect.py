"""The architect: Gemini Argon designs the house in two stages.

Stage 1 (plan): a BuildingPlan JSON constrained by a schema. The LDA engine checks it, and the violations go back
to Argon until it complies (up to PLAN_MAX_ATTEMPTS).
Stage 2 (build): Argon writes design.js, sections of code against the House SDK, streamed to the browser one
section at a time so the user watches the house assemble.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import AsyncIterator

from google.genai import types

from .. import config, llm
from ..compliance import lda
from ..gemini import client
from ..store import blobs, db

ROOT = Path(__file__).resolve().parents[3]
CONTRACTS = ROOT / "contracts"


def _read(path: Path) -> str:
    return path.read_text() if path.exists() else ""


Pt = {"type": "array", "items": {"type": "number"}, "minItems": 2, "maxItems": 2}
RECT = {"type": "object", "properties": {k: {"type": "number"} for k in ("x", "y", "w", "d")}, "required": ["x", "y", "w", "d"]}
ROOM_TYPES = ["drawing", "lounge", "dining", "kitchen", "dirty_kitchen", "bedroom", "master_bedroom", "guest_bedroom", "bath", "powder",
              "dressing", "study", "prayer", "store", "laundry", "servant", "stair", "lobby", "corridor", "porch", "garage", "balcony",
              "terrace", "courtyard", "lawn", "driveway", "open_space"]
OPENING_TYPES = ["main_door", "door", "double_door", "sliding_door", "window", "corner_window", "ventilator", "arch", "garage_door"]
SIDES4 = ["front", "back", "left", "right"]

PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "schema": {"type": "string", "enum": ["naqsha.plan/1"]},
        "units": {"type": "string", "enum": ["ft"]},
        "site": {"type": "object", "properties": {
            "plot": {"type": "object", "properties": {"width_ft": {"type": "number"}, "depth_ft": {"type": "number"},
                                                       "area_marla": {"type": "number"}, "corner": {"type": "boolean"}},
                     "required": ["width_ft", "depth_ft", "area_marla", "corner"]},
            "facing": {"type": "string", "enum": ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]},
            "road_width_ft": {"type": "number"},
            "authority": {"type": "string"}, "scheme": {"type": "string"}, "city": {"type": "string"},
            "setbacks_ft": {"type": "object", "properties": {k: {"type": "number"} for k in ("front", "rear", "left", "right")},
                            "required": ["front", "rear", "left", "right"]},
            "boundary_wall": {"type": "object", "properties": {k: {"type": "number"} for k in ("front_height_ft", "side_height_ft", "rear_height_ft")},
                              "required": ["front_height_ft", "side_height_ft", "rear_height_ft"]},
            "gates": {"type": "array", "items": {"type": "object", "properties": {
                "id": {"type": "string"}, "at": Pt, "width_ft": {"type": "number"},
                "kind": {"type": "string", "enum": ["sliding", "swing", "pedestrian"]}}, "required": ["id", "at", "width_ft", "kind"]}},
        }, "required": ["plot", "facing", "authority", "city", "setbacks_ft", "boundary_wall", "gates"]},
        "levels": {"type": "array", "items": {"type": "object", "properties": {
            "id": {"type": "string"}, "name": {"type": "string"}, "index": {"type": "integer"},
            "elevation_ft": {"type": "number"}, "height_ft": {"type": "number"}, "slab_ft": {"type": "number"}},
            "required": ["id", "name", "index", "elevation_ft", "height_ft", "slab_ft"]}},
        "rooms": {"type": "array", "items": {"type": "object", "properties": {
            "id": {"type": "string"}, "level": {"type": "string"}, "name": {"type": "string"},
            "type": {"type": "string", "enum": ROOM_TYPES}, "rect": RECT,
            "open_to": {"type": "array", "items": {"type": "string"}},
            "floor_finish": {"type": "string", "enum": ["marble", "porcelain_tile", "terrazzo", "wood", "ceramic_tile", "concrete", "grass", "paving"]},
            "ceiling_height_ft": {"type": "number"}}, "required": ["id", "level", "name", "type", "rect"]}},
        "openings": {"type": "array", "items": {"type": "object", "properties": {
            "id": {"type": "string"}, "level": {"type": "string"}, "type": {"type": "string", "enum": OPENING_TYPES},
            "at": Pt, "width_ft": {"type": "number"}, "height_ft": {"type": "number"}, "sill_ft": {"type": "number"},
            "between": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 2},
            "swing": {"type": "string", "enum": ["in", "out"]}},
            "required": ["id", "level", "type", "at", "width_ft", "height_ft", "between"]}},
        "stairs": {"type": "array", "items": {"type": "object", "properties": {
            "id": {"type": "string"}, "from_level": {"type": "string"}, "to_level": {"type": "string"}, "rect": RECT,
            "kind": {"type": "string", "enum": ["dogleg", "straight", "l_shape"]}, "width_ft": {"type": "number"},
            "riser_in": {"type": "number"}, "tread_in": {"type": "number"},
            "start": {"type": "string", "enum": ["+x", "-x", "+y", "-y"]}},
            "required": ["id", "from_level", "to_level", "rect", "kind", "width_ft", "riser_in", "tread_in", "start"]}},
        "roof": {"type": "object", "properties": {
            "parapet_ft": {"type": "number"},
            "mumty": {"type": "object", "properties": {"rect": RECT, "height_ft": {"type": "number"},
                                                        "door_side": {"type": "string", "enum": SIDES4}}, "required": ["rect", "height_ft", "door_side"]},
            "water_tank": {"type": "object", "properties": {"rect": RECT, "height_ft": {"type": "number"}}, "required": ["rect", "height_ft"]}},
            "required": ["parapet_ft"]},
        "style": {"type": "object", "properties": {
            "name": {"type": "string"}, "summary": {"type": "string"},
            "palette": {"type": "array", "items": {"type": "string"}}, "materials": {"type": "array", "items": {"type": "string"}}},
            "required": ["name", "summary", "palette", "materials"]},
        "notes": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["schema", "units", "site", "levels", "rooms", "openings", "stairs", "roof", "style"],
}

PLAN_SYSTEM = """You are a senior Lahore architect and a precise space planner. You design single-family houses that comply with
the LDA Building & Zoning Regulations 2019 (consolidated 2026) and feel right for Pakistani family life.

Output ONE BuildingPlan JSON (schema enforced). Follow the conventions in the TypeScript reference exactly:
- FEET; origin at the plot's front-left corner; +x along the road, +y into the plot; the road is at y < 0.
- Rooms are axis-aligned rectangles. Rooms on the same level must NOT overlap; neighbouring rooms share edges exactly.
  Snap every coordinate to 0.5 ft. At ground level, tile the building envelope fully (no unexplained gaps).
- Every building room (all types except lawn/driveway/open_space/courtyard) must lie inside the setback lines:
  x ≥ left setback, x+w ≤ plot width − right setback, y ≥ front setback, y+d ≤ plot depth − rear setback.
  This includes porches and balconies (LDA forbids projections of rooms, porches or balconies into mandatory open spaces).
- Add outdoor rooms for the open spaces: driveway + lawn in the front setback, open_space for side/rear spaces.
- Openings: `at` is a point exactly ON a shared room edge (or on an exterior edge for "exterior"). Doors connect rooms that
  share that edge. Windows only on exterior edges, or onto porch/balcony/terrace/open_space. Never put windows on a party wall
  (a plot edge with zero setback: neighbours build right against it).
- Every enclosed room needs a door (or open_to). Bedrooms need attached baths where the brief asks.
- LDA minimums: habitable rooms ≥ 100 sq ft and ≥ 8 ft wide; kitchen ≥ 50 sq ft and ≥ 6 ft wide; clear height ≥ 9.5 ft
  (use 11 ft floor-to-floor, 0.5 ft slab); glazing to outside ≥ 8% of floor area for habitable rooms and kitchens;
  baths need an external opening ≥ 2 sq ft (a ventilator is fine); stairs: flight width ≥ 3.5 ft, riser ≤ 7.5 in,
  tread ≥ 10 in, ≤ 15 risers per flight; parapet ≥ 2.75 ft (use 3.5); mumty ≤ 9.5 ft; boundary walls ≤ 7 ft;
  height (top of parapet above the road) and storeys within the envelope given; ground coverage within the maximum.
- Levels: ground (index 0, elevation = plinth, e.g. 1.5), first, second as needed, then a final "roof" level whose height_ft
  equals the parapet height. Use one stair per level transition, stacked in the same stair hall, plus a roof mumty over it.
- Pakistani planning sense:
  - the drawing room near the entrance (guests enter it directly from the porch);
  - a family TV lounge as the heart of the home;
  - a kitchen next to dining, plus a dirty kitchen or service access at the rear;
  - a car porch at the front within the building line, usually under a first-floor room;
  - the master bedroom upstairs at the front with a balcony;
  - a servant quarter at the rear or on the roof for larger plots;
  - a prayer corner if requested.
- Style: palette (hex) and materials matching the brief and the chosen concept image.
- notes: 3–6 short sentences explaining key decisions and how LDA rules shaped the plan.
Write ids as <level-initial>_<name>, e.g. g_drawing, f_master, f_master_bath."""


def _plan_prompt(brief: dict, env: dict, concept_url: str | None) -> str:
    return (
        f"BRIEF:\n{json.dumps(brief, indent=1)}\n\n"
        f"LDA ENVELOPE (deterministic, from the regulations):\n{json.dumps({k: v for k, v in env.items() if k != '_band'}, indent=1)}\n\n"
        f"TYPESCRIPT REFERENCE for the plan (conventions + types):\n{_read(CONTRACTS / 'plan.ts')}\n\n"
        f"EXAMPLE of a good, compliant plan for a 10 marla LDA plot (style reference only; design for THIS brief):\n"
        f"{_read(CONTRACTS / 'fixtures' / 'plan-10-marla.json')}\n\n"
        + ("The attached image is the concept the family chose: match its massing (porch side, balcony, roof features, "
           "window rhythm) where the LDA rules allow.\n" if concept_url else "")
        + "Now produce the BuildingPlan JSON for this brief."
    )


async def _concept_part(project: dict) -> types.Part | None:
    cid = project.get("selected_concept_id")
    c = next((c for c in project.get("concepts", []) if c["id"] == cid), None)
    if not c:
        return None
    got = await blobs.get(c["url"].removeprefix("/api/assets/"))
    return types.Part.from_bytes(data=got[0], mime_type=got[1]) if got else None


def _clean_plan(plan: dict, brief: dict) -> dict:
    """Deterministic fixes for small Argon slips (ids, snapping, schema tags)."""
    plan["schema"], plan["units"] = "naqsha.plan/1", "ft"
    snap = lambda v: round(float(v) * 4) / 4  # noqa: E731
    for r in plan.get("rooms", []):
        r["rect"] = {k: snap(r["rect"][k]) for k in ("x", "y", "w", "d")}
    for o in plan.get("openings", []):
        o["at"] = [snap(o["at"][0]), snap(o["at"][1])]
    p = plan.setdefault("site", {}).setdefault("plot", {})
    if brief.get("plot"):
        p.update({k: brief["plot"][k] for k in ("width_ft", "depth_ft", "area_marla", "corner") if k in brief["plot"]})
    if brief.get("coordinates"):
        plan["site"]["coordinates"] = brief["coordinates"]
    return plan


async def make_plan(project: dict) -> AsyncIterator[tuple[str, dict]]:
    brief = project["brief"]
    env = lda.envelope(brief["plot"]["width_ft"], brief["plot"]["depth_ft"], brief.get("authority") or "LDA",
                       bool(brief["plot"].get("corner")))
    concept = await _concept_part(project)
    contents: list = [types.Content(role="user", parts=([concept] if concept else []) + [types.Part.from_text(text=_plan_prompt(brief, env, concept))])]
    plan, report = None, None
    for attempt in range(1, config.PLAN_MAX_ATTEMPTS + 1):
        yield "stage", {"stage": "plan" if attempt == 1 else "fix",
                        "message": "Argon is laying out the floors…" if attempt == 1 else f"Argon is fixing the plan (attempt {attempt})…"}
        text = ""
        async for kind, val in llm.stream_json(config.MODEL_ARCHITECT, contents, PLAN_SYSTEM, max_tokens=32768):
            if kind == "progress":
                yield "progress", {"chars": val}
            else:
                obj, text = val
        plan = _clean_plan(obj, brief)
        yield "plan", {"plan": plan, "attempt": attempt}
        yield "stage", {"stage": "compliance", "message": "Checking the plan against LDA regulations…"}
        report = lda.check(plan)
        yield "compliance", {"report": report, "attempt": attempt}
        if report["ok"]:
            break
        contents += [types.Content(role="model", parts=[types.Part.from_text(text=text)]),
                     types.Content(role="user", parts=[types.Part.from_text(text=(
                         "The LDA compliance engine reported these problems with your plan:\n" + lda.violations_text(report) +
                         "\n\nReturn the corrected COMPLETE BuildingPlan JSON. Fix every FAIL; fix WARNs where reasonable. "
                         "Keep everything else unchanged."))])]
    yield "_result", {"plan": plan, "report": report}


# --- Stage 2: design.js --------------------------------------------------------------------------------
BUILD_SYSTEM = """You are Naqsha's 3D design engineer. You write design.js: code that builds a high-fidelity, fully furnished 3D
model of a house with the House SDK (three.js underneath). The plan (structure) is already decided and LDA-checked; your job is
to make it look like a premium architectural visualization that matches the family's chosen concept image.

OUTPUT FORMAT: plain text only, no markdown fences. A sequence of sections, each exactly:
// @section <name> [<layer>]
<JavaScript statements using `s` (the HouseSDK) and `THREE`>
// @end

Order and naming:
1. `structure [structure]`: exactly one call to s.structure({...}) with materials chosen for the style (floors per room type).
2. `facade_<part> [facade]`: several sections building the facade from the concept image: cladding, fins, frames,
   canopies, screens, columns, wall lights and LED strips. Use s.face(side, level) for facade math. Every element must stay
   inside the plot. Canopies and chajjas may project at most 3 ft beyond the building line into a 10 ft+ open space, or 1.5 ft otherwise.
3. `interior_<room or theme> [interior]`: accent walls, false ceilings with cove lights and downlights for the main rooms
   (drawing, lounges, master bedroom).
4. `furnish_<room_id> [furniture]`: ONE section per enclosed room (and the porch: a car). Place key pieces explicitly with
   `against`/`along_ft` or `at`/`rot_deg` in room-local feet, sized to the room. Use s.auto_furnish(room) only for minor rooms.
   Include Pakistani touches: ceiling fans, split ACs in bedrooms and lounges, a prayer mat if there's a prayer room.
5. `landscape [landscape]`: lawn, paving, planters, trees (ashoka, palm), and s.landscape.street({ neighbours: true, streetlights: true }).
6. `lighting [lighting]`: s.lights.sun({ hour: 17.5 }) and s.lights.interior().

Rules: Only use APIs that exist in the SDK reference. Coordinates are plan FEET (x along the road, y into the plot, h above the
road crown). Keep each section under about 60 lines, self-contained, with const declarations local to it. Never use fetch, XMLHttpRequest,
WebSocket, import(), eval, Function, document, window or storage. Prefer clarity over cleverness. The code is shown to the
user, so add a brief comment at the top of each section saying what it builds."""


def _build_prompt(plan: dict, brief: dict) -> str:
    example = _read(CONTRACTS / "fixtures" / "design-10-marla.js")
    engine_notes = _read(ROOT / "web" / "src" / "engine" / "README.md")
    return (
        f"HOUSE SDK REFERENCE (TypeScript declarations; the API you can call):\n{_read(CONTRACTS / 'house-sdk.d.ts')}\n\n"
        + (f"ENGINE NOTES (behaviour details and gotchas):\n{engine_notes}\n\n" if engine_notes else "")
        + (f"EXAMPLE design.js for a different 10-marla plan (format and quality reference only):\n{example}\n\n" if example else "")
        + f"THE PLAN TO BUILD (BuildingPlan JSON, feet):\n{json.dumps(plan)}\n\n"
        f"FAMILY BRIEF: {json.dumps({k: brief.get(k) for k in ('style', 'style_notes', 'budget', 'notes', 'spaces')})}\n\n"
        "The attached image (if any) is the chosen exterior concept. Match its facade composition and materials.\n"
        "Write design.js now."
    )


SECTION_RE = re.compile(r"^\s*//\s*@section\s+([A-Za-z0-9_]+)\s*\[(\w+)\]\s*$")
END_RE = re.compile(r"^\s*//\s*@end\s*$")


class SectionStream:
    """Incremental parser: feed text chunks, get completed sections."""

    def __init__(self):
        self.buf, self.cur, self.done = "", None, []

    def feed(self, text: str) -> list[dict]:
        self.buf += text
        out = []
        while "\n" in self.buf:
            line, self.buf = self.buf.split("\n", 1)
            m = SECTION_RE.match(line)
            if m:
                if self.cur:
                    out.append(self.cur)
                self.cur = {"name": m.group(1), "layer": m.group(2), "code": ""}
            elif END_RE.match(line):
                if self.cur:
                    out.append(self.cur)
                self.cur = None
            elif self.cur is not None and not line.strip().startswith("```"):
                self.cur["code"] += line + "\n"
        self.done += out
        return out

    def flush(self) -> list[dict]:
        out = self.feed("\n")
        if self.cur and self.cur["code"].strip():
            out.append(self.cur)
            self.done.append(self.cur)
            self.cur = None
        return out


async def write_design(project: dict, plan: dict, extra_instruction: str | None = None) -> AsyncIterator[tuple[str, dict]]:
    concept = await _concept_part(project)
    text = _build_prompt(plan, project.get("brief") or {}) + (f"\n\nADDITIONAL INSTRUCTIONS:\n{extra_instruction}" if extra_instruction else "")
    contents = [types.Content(role="user", parts=([concept] if concept else []) + [types.Part.from_text(text=text)])]
    cfg = types.GenerateContentConfig(system_instruction=BUILD_SYSTEM, max_output_tokens=65536)
    yield "stage", {"stage": "build", "message": "Argon is writing the 3D model as code…"}
    parser, total = SectionStream(), 0
    async for chunk in await client().aio.models.generate_content_stream(model=config.MODEL_ARCHITECT, contents=contents, config=cfg):
        if not chunk.text:
            continue
        total += len(chunk.text)
        for sec in parser.feed(chunk.text):
            yield "section", {"section": sec, "index": len(parser.done) - 1}
        if total // 3000 != (total - len(chunk.text)) // 3000:
            yield "progress", {"chars": total}
    for sec in parser.flush():
        yield "section", {"section": sec, "index": len(parser.done) - 1}
    yield "_result", {"sections": parser.done}


async def repair_section(project: dict, version: dict, name: str, error: str) -> dict:
    sec = next((s for s in version["sections"] if s["name"] == name), None)
    if not sec:
        raise ValueError(f"no section {name}")
    prompt = (f"HOUSE SDK REFERENCE:\n{_read(CONTRACTS / 'house-sdk.d.ts')}\n\nPLAN:\n{json.dumps(version['plan'])}\n\n"
              f"This design.js section failed in the browser with: {error}\n\n// @section {sec['name']} [{sec['layer']}]\n{sec['code']}// @end\n\n"
              "Return the corrected section only, in the same // @section … // @end format.")
    resp = await client().aio.models.generate_content(model=config.MODEL_ARCHITECT, contents=prompt,
                                                      config=types.GenerateContentConfig(system_instruction=BUILD_SYSTEM))
    p = SectionStream()
    p.feed(resp.text or "")
    fixed = p.flush() or p.done
    return fixed[0] if fixed else sec


async def design(project: dict) -> AsyncIterator[tuple[str, dict]]:
    """Full pipeline: plan (+ compliance loop), then design.js, then save a Version."""
    pid = project["id"]
    await db.update_project(pid, stage="planning")
    plan = report = None
    async for ev, data in make_plan(project):
        if ev == "_result":
            plan, report = data["plan"], data["report"]
        else:
            yield ev, data
    await db.update_project(pid, stage="building")
    sections: list[dict] = []
    async for ev, data in write_design(project, plan):
        if ev == "_result":
            sections = data["sections"]
        else:
            yield ev, data
    yield "stage", {"stage": "save", "message": "Saving version…"}
    fresh = await db.get_project(pid)
    n = len(fresh.get("versions") or []) + 1
    version = {"id": db.new_id("v_"), "n": n, "created_at": db.now(), "parent_id": fresh.get("current_version_id"),
               "plan": plan, "sections": sections, "compliance": report, "changes": [], "status": "ready"}
    await db.save_version(pid, version)
    summary = f"v{n}: {len(plan['rooms'])} spaces, {len(sections)} code sections"
    await db.update_project(pid, versions=(fresh.get("versions") or []) + [{"id": version["id"], "n": n, "created_at": version["created_at"],
                                                                           "status": "ready", "summary": summary}],
                            current_version_id=version["id"], stage="ready")
    yield "version", {"version": version}
