"""Concept images: four photoreal exterior concepts from the brief (in parallel), remixes, night versions and viewport renders.

The four are genuinely different design takes within the chosen style (massing and materials), all shot with the SAME camera
and light (straight-on front elevation at golden hour; a corner plot uses one fixed corner three-quarter view), so the family
compares houses, not photographs. Night versions are edits of each day image with the same camera.
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
from typing import AsyncIterator

from google.genai import types

from .. import busy, config, llm
from ..gemini import client
from ..store import blobs, db

log = logging.getLogger("naqsha.concepts")

CAMERA_MIDROW = ("Camera: straight-on front elevation from across the road at eye level, 24mm lens, the whole house and its "
                 "boundary wall in frame, centred. Light: golden hour, low warm sun from the side, soft long shadows, clear sky.")
CAMERA_CORNER = ("Camera: three-quarter view from the street corner at eye level, 24mm lens, both road-facing facades in frame. "
                 "Light: golden hour, low warm sun, soft long shadows, clear sky.")

STYLE_HINTS = {
    "Modern Contemporary": "crisp white plaster volumes, grey stone cladding, vertical teak fins, black aluminium frames, cantilevered canopy",
    "Spanish": "white stucco walls, terracotta clay roof tiles, arched windows and porch arches, wrought-iron railings, wooden doors",
    "Classic": "symmetrical facade, cornices and mouldings, tall entrance columns, cream paint, balustrades",
    "Minimalist": "pure white cubic volumes, flush glazing, hidden frames, a single wood accent, very clean lines",
    "Mediterranean": "warm sand-coloured render, arched loggia, terracotta details, stone accents, bougainvillea",
    "Mughal Revival": "red sandstone-look cladding with white marble accents, cusped arches, jharokha balconies, jaali screens",
    "Industrial": "exposed brick, dark steel frames, concrete bands, large factory-style glazing",
}

# Fallback takes when the quick model call isn't available: four distinct directions per style family.
FALLBACK_TAKES = [
    {"title": "Stone and teak", "direction": "a crisp two-box massing: a white plaster upper volume floating over a grey stone base, "
                                             "vertical teak fins screening the upper bedroom windows"},
    {"title": "Brick and jaali", "direction": "warm exposed-brick facade with a full-height brick jaali screen over the stair and "
                                              "balcony, deep window reveals"},
    {"title": "Stepped terraces", "direction": "stepped massing with a planted first-floor terrace over the porch, horizontal white "
                                               "bands and slim black railings"},
    {"title": "Courtyard screen", "direction": "a tall perforated metal screen wrapping the first floor, a recessed glass entrance "
                                               "and a single sculptural canopy over the porch"},
]

TAKES_SYSTEM = """You are a Lahore architect proposing four genuinely different exterior design directions for one house, all within
the family's chosen style. Vary the massing and the material palette (not the camera or the light): e.g. a floating upper box, a
brick-and-jaali screen, stepped terraces, a courtyard screen. Each must be buildable on the plot and respect the brief (storeys,
porch, roof). Never add minarets, domes, chhatris or cupolas unless the brief asks for them.
Return JSON: {"takes": [{"title": "<2-3 word name, e.g. Stone and teak>", "direction": "<one sentence: massing + materials>"}] }
with exactly four takes."""


def _site_sentence(brief: dict) -> str:
    p = brief.get("plot") or {}
    if p.get("corner"):
        return ("It is a CORNER plot: two road-facing facades, both designed with care, a side road running along one side.")
    return ("It is a MID-ROW plot (NOT a corner): neighbouring houses stand directly against both side walls, there is no side "
            "street and no visible side facade; only the front facade faces the single road in front.")


def _roof_sentence(brief: dict) -> str:
    parts = ["Flat roof with a parapet and a compact stair tower (mumty)"]
    solar = brief.get("solar") or "ready"
    if solar == "panels":
        parts.append("rows of solar panels on a low steel frame over the roof")
    else:
        parts.append("the roof otherwise clean and clear (no domes, minarets, chhatris or pergolas)")
    tank = brief.get("water_tank")
    if tank == "plastic":
        parts.append("a small blue plastic water tank on top of the stair tower")
    elif tank == "concrete":
        parts.append("no visible water tank")
    return ", ".join(parts) + "."


def concept_prompt(brief: dict, take: dict | None = None, instruction: str | None = None) -> str:
    p = brief.get("plot") or {}
    style = brief.get("style") or "Modern Contemporary"
    hints = STYLE_HINTS.get(style, brief.get("style_notes") or "")
    storeys = {1: "single-storey", 2: "double-storey", 3: "triple-storey"}.get(brief.get("storeys") or 2, "double-storey")
    where = brief.get("scheme") or {"DHA": "DHA Lahore", "BAHRIA": "Bahria Town Lahore"}.get(brief.get("authority"), "a Lahore housing society")
    porch = next((s for s in brief.get("spaces", []) if s.startswith("car_porch")), "car_porch:1")
    cars = porch.split(":")[1] if ":" in porch else "1"
    direction = f" This design's direction: {take['direction']}." if take else ""
    extra = f" Additional direction: {instruction}." if instruction else ""
    camera = CAMERA_CORNER if p.get("corner") else CAMERA_MIDROW
    width = p.get("width_ft", 35)
    return (
        f"Photorealistic architectural photograph of a {style} {storeys} family house on a {width:g} ft wide plot in {where}, "
        f"Pakistan. Style language: {hints}.{direction} Typical Lahore layout: boundary wall with a sliding gate, a "
        f"{cars}-car porch within the building line, a small front lawn. {_roof_sentence(brief)} {_site_sentence(brief)} "
        f"{camera} High-end real-estate photography, realistic materials and proportions. No people. Absolutely no text, "
        f"numbers, signs, house plaques or watermarks anywhere in the image.{extra}"
    )


async def design_takes(brief: dict, n: int = 4, instruction: str | None = None) -> list[dict]:
    """Four distinct design directions within the style (quick model call, with a fallback)."""
    ask = {k: brief.get(k) for k in ("style", "style_notes", "storeys", "plot", "spaces", "solar", "water_tank", "preferences", "budget")
           if brief.get(k) not in (None, "", [], {})}
    try:
        out = None
        async for kind, val in llm.stream_json(config.MODEL_INTAKE, f"BRIEF: {json.dumps(ask)}\n"
                                               + (f"FAMILY'S DIRECTION: {instruction}\n" if instruction else "")
                                               + "Propose the four directions.", TAKES_SYSTEM, max_tokens=1200, attempts=1,
                                               thinking="LOW"):
            if kind == "result":
                out = val[0]
        takes = [t for t in (out or {}).get("takes", []) if isinstance(t, dict) and t.get("title") and t.get("direction")]
        if len(takes) >= n:
            return takes[:n]
    except Exception:
        log.exception("design takes failed; using the fallback set")
    return FALLBACK_TAKES[:n]


async def _image_call(contents, aspect: str | None = "16:9"):
    for attempt in range(5):  # back off on 429 / RESOURCE_EXHAUSTED (per-minute image quota with 4 in parallel)
        try:
            cfg = types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"],
                                              image_config=types.ImageConfig(aspect_ratio=aspect) if aspect else None)
            return await client().aio.models.generate_content(model=config.MODEL_IMAGE, contents=contents, config=cfg)
        except Exception as e:
            if attempt == 4 or not any(t in str(e) for t in ("429", "RESOURCE_EXHAUSTED", "503", "UNAVAILABLE")):
                raise
            wait = 3 * 2 ** attempt + random.random() * 2
            busy.notify(wait, "429")
            await asyncio.sleep(wait)


def _image_bytes(resp) -> tuple[bytes, str] | None:
    for part in (resp.candidates[0].content.parts if resp and resp.candidates else []) or []:
        if part.inline_data and part.inline_data.data:
            return part.inline_data.data, part.inline_data.mime_type or "image/png"
    return None


async def _generate_one(pid: str, prompt: str, ref: tuple[bytes, str] | None = None) -> dict:
    contents: list = [prompt]
    if ref:
        contents = [types.Part.from_bytes(data=ref[0], mime_type=ref[1]), prompt]
    got = _image_bytes(await _image_call(contents))
    if not got:
        raise RuntimeError("The image model returned no image")
    cid = db.new_id("c_")
    url = await blobs.put(f"projects/{pid}/concepts/{cid}.png", got[0], got[1])
    return {"id": cid, "url": url, "prompt": prompt, "model": config.MODEL_IMAGE, "created_at": db.now()}


async def generate(project: dict, count: int = 4, instruction: str | None = None, base_id: str | None = None) -> AsyncIterator[tuple[str, dict]]:
    pid, brief = project["id"], project.get("brief") or {}
    base = next((c for c in project.get("concepts", []) if c["id"] == base_id), None) if base_id else None
    ref = None
    if base:
        got = await blobs.get(base["url"].removeprefix("/api/assets/"))
        ref = got if got else None
    jobs: list[tuple[str, dict | None]] = []
    if base:
        for i in range(count):
            jobs.append((f"Edit this house design photo: {instruction or 'refine it'}. Keep the same house, plot, camera, light and "
                         f"composition; change only what the instruction asks. Photorealistic. No text, numbers or signs. "
                         f"Variation {i + 1} of {count}: make it visibly different from the others.",
                         {"title": f"{base.get('title') or 'Remix'} · {i + 1}", "direction": instruction or ""}))
    else:
        for take in await design_takes(brief, count, instruction):
            jobs.append((concept_prompt(brief, take, instruction), take))
    for i, (pr, _) in enumerate(jobs):
        yield "concept.started", {"index": i, "prompt": pr}

    async def one(i: int, pr: str, take: dict | None):
        try:
            c = await _generate_one(pid, pr, ref)
            if take:
                c.update(title=take["title"], summary=take.get("direction", ""))
            if base:
                c.update(parent_id=base["id"], instruction=instruction)
            return i, c, None
        except Exception as e:  # keep the other concepts going
            log.exception("concept %d failed", i)
            return i, None, str(e)

    tasks = [asyncio.create_task(one(i, pr, take)) for i, (pr, take) in enumerate(jobs)]
    made = []
    for fut in asyncio.as_completed(tasks):
        i, c, err = await fut
        if c:
            made.append(c)
            yield "concept", {"index": i, "concept": c}
        else:
            yield "concept.failed", {"index": i, "message": "This one didn't come through. Try again in a moment."}
    fresh = await db.get_project(pid)
    concepts = (fresh.get("concepts") or []) + made
    fields = {"concepts": concepts}
    if fresh.get("stage") in (None, "setup", "concepts"):
        fields["stage"] = "concepts"  # never move a designed project backwards
    if not fresh.get("thumbnail_url") and made:
        fields["thumbnail_url"] = made[0]["url"]
    await db.update_project(pid, **fields)


NIGHT_EDIT = ("Turn this photograph into the same scene at night, about an hour after sunset (blue hour). Keep EXACTLY the same "
              "house, plot, camera position, lens, framing and composition, and every architectural detail. Deep blue sky, warm "
              "interior lights glowing in the windows, subtle facade uplights and garden lights, the street lamps on, soft "
              "reflections. Photorealistic. No people, no text, no numbers, no signs.")


async def night(project: dict, ids: list[str] | None = None) -> AsyncIterator[tuple[str, dict]]:
    """Night versions of the day concepts (same camera, an edit of the day image). Emits `concept {index, concept}` with
    night_url filled; concepts that already have one are returned straight away."""
    pid = project["id"]
    concepts = project.get("concepts") or []
    if ids:
        targets = [(i, c) for i, c in enumerate(concepts) if c["id"] in set(ids)]
    else:  # the latest four day concepts (or the selected one and its siblings)
        targets = list(enumerate(concepts))[-4:]
    sem = asyncio.Semaphore(4)

    async def one(i: int, c: dict):
        if c.get("night_url"):
            return i, c, None
        async with sem:
            try:
                got = await blobs.get(c["url"].removeprefix("/api/assets/"))
                if not got:
                    raise RuntimeError("day image missing")
                resp = await _image_call([types.Part.from_bytes(data=got[0], mime_type=got[1]), NIGHT_EDIT], aspect=None)
                img = _image_bytes(resp)
                if not img:
                    raise RuntimeError("no image")
                url = await blobs.put(f"projects/{pid}/concepts/{c['id']}-night.png", img[0], img[1])
                return i, {**c, "night_url": url}, None
            except Exception as e:
                log.exception("night %s failed", c.get("id"))
                return i, None, str(e)

    tasks = [asyncio.create_task(one(i, c)) for i, c in targets]
    done: dict[str, str] = {}
    for fut in asyncio.as_completed(tasks):
        i, c, err = await fut
        if c:
            done[c["id"]] = c["night_url"]
            yield "concept", {"index": i, "concept": c}
        else:
            yield "concept.failed", {"index": i, "message": "The night view didn't come through. Try again in a moment."}
    if done:
        fresh = await db.get_project(pid)
        merged = [{**c, "night_url": done.get(c["id"], c.get("night_url"))} if c["id"] in done else c for c in fresh.get("concepts") or []]
        await db.update_project(pid, concepts=merged)


async def render_view(pid: str, image: bytes, mime: str, prompt: str | None) -> str:
    """Viewport screenshot → photoreal render that keeps the exact geometry and camera."""
    instr = ("Turn this 3D architectural viewport render into a photorealistic photograph. Keep EXACTLY the same building geometry, "
             "openings, camera angle, framing and material choices; upgrade lighting, textures, reflections, vegetation and sky to "
             "real-world photo quality. No added objects or people, no text." + (f" {prompt}" if prompt else ""))
    got = _image_bytes(await _image_call([types.Part.from_bytes(data=image, mime_type=mime), instr], aspect=None))
    if not got:
        raise RuntimeError("The image model returned no image")
    return await blobs.put(f"projects/{pid}/renders/{db.new_id('r_')}.png", got[0], got[1])
