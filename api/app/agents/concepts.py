"""Concept images: four photoreal exterior concepts from the brief (in parallel), remixes, and viewport AI renders."""
from __future__ import annotations

import asyncio
import random
from typing import AsyncIterator

from google.genai import types

from .. import config
from ..gemini import client
from ..store import blobs, db

VARIANTS = [
    "street-level front elevation at golden hour, 24mm lens, eye level from across the road",
    "three-quarter view from the street corner in soft overcast morning light, 28mm lens",
    "dusk shot with warm interior lights glowing and facade uplights on, slight low angle, 24mm lens",
    "sunny afternoon front view with crisp shadows, a family car in the porch, 35mm lens",
]

STYLE_HINTS = {
    "Modern Contemporary": "crisp white plaster volumes, grey stone cladding pier, vertical teak fins, black aluminium frames, cantilevered canopy, frameless glass balcony",
    "Spanish": "white stucco walls, terracotta clay roof tiles, arched windows and porch arches, wrought-iron balcony railings, wooden doors",
    "Classic": "symmetrical facade, cornices and mouldings, tall columns at the entrance, cream paint, ornate balcony balustrades",
    "Minimalist": "pure white cubic volumes, flush glazing, hidden frames, a single wood accent, very clean lines",
    "Mediterranean": "warm sand-coloured render, arched loggia, terracotta details, stone accents, bougainvillea",
    "Mughal Revival": "red sandstone-look cladding with white marble accents, cusped arches, jharokha balconies, jaali screens, chhatri on the roof",
}


def concept_prompt(brief: dict, variant: str, instruction: str | None = None) -> str:
    p = brief.get("plot") or {}
    style = brief.get("style") or "Modern Contemporary"
    hints = STYLE_HINTS.get(style, brief.get("style_notes") or "")
    storeys = {1: "single-storey", 2: "double-storey", 3: "triple-storey"}.get(brief.get("storeys") or 2, "double-storey")
    where = brief.get("scheme") or {"DHA": "DHA Lahore", "BAHRIA": "Bahria Town Lahore"}.get(brief.get("authority"), "a Lahore housing society")
    porch = next((s for s in brief.get("spaces", []) if s.startswith("car_porch")), "car_porch:1")
    cars = porch.split(":")[1] if ":" in porch else "1"
    extra = f" Additional direction: {instruction}." if instruction else ""
    return (
        f"Photorealistic architectural photograph of a {style} {storeys} house on a {p.get('area_marla', 10):g} marla plot "
        f"({p.get('width_ft', 35):g} ft wide street frontage) in {where}, Pakistan. Design language: {hints}. "
        f"Typical Lahore layout: boundary wall with a sliding gate, a {cars}-car porch within the building line, a small front lawn, "
        f"flat roof with parapet and a mumty (stair tower). Neighbouring houses and a residential street are visible. "
        f"{variant}. High-end real-estate photography, realistic materials and proportions, no people, no text, no watermark.{extra}"
    )


async def _generate_one(pid: str, prompt: str, ref: tuple[bytes, str] | None = None, model: str | None = None) -> dict:
    contents: list = [prompt]
    if ref:
        contents = [types.Part.from_bytes(data=ref[0], mime_type=ref[1]), prompt]
    for attempt in range(4):  # back off on 429 / RESOURCE_EXHAUSTED (per-minute image quota with 4 in parallel)
        try:
            resp = await client().aio.models.generate_content(
                model=model or config.MODEL_IMAGE, contents=contents,
                config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"],
                                                   image_config=types.ImageConfig(aspect_ratio="16:9")))
            break
        except Exception as e:
            if attempt == 3 or not any(t in str(e) for t in ("429", "RESOURCE_EXHAUSTED", "503", "UNAVAILABLE")):
                raise
            await asyncio.sleep(3 * 2 ** attempt + random.random() * 2)
    for part in resp.candidates[0].content.parts:
        if part.inline_data and part.inline_data.data:
            cid = db.new_id("c_")
            url = await blobs.put(f"projects/{pid}/concepts/{cid}.png", part.inline_data.data, part.inline_data.mime_type or "image/png")
            return {"id": cid, "url": url, "prompt": prompt, "model": model or config.MODEL_IMAGE, "created_at": db.now()}
    raise RuntimeError("The image model returned no image")


async def generate(project: dict, count: int = 4, instruction: str | None = None, base_id: str | None = None) -> AsyncIterator[tuple[str, dict]]:
    pid, brief = project["id"], project.get("brief") or {}
    base = next((c for c in project.get("concepts", []) if c["id"] == base_id), None) if base_id else None
    ref = None
    if base:
        got = await blobs.get(base["url"].removeprefix("/api/assets/"))
        ref = got if got else None
    prompts = []
    for i in range(count):
        if base:
            prompts.append(f"Edit this house design photo: {instruction or 'refine it'}. Keep the same house, plot, camera and "
                           f"composition; change only what the instruction asks. Photorealistic, no text. Variation {i + 1}.")
        else:
            prompts.append(concept_prompt(brief, VARIANTS[i % len(VARIANTS)], instruction))
    for i, pr in enumerate(prompts):
        yield "concept.started", {"index": i, "prompt": pr}

    async def one(i: int, pr: str):
        try:
            c = await _generate_one(pid, pr, ref)
            if base:
                c.update(parent_id=base["id"], instruction=instruction)
            return i, c, None
        except Exception as e:  # keep the other concepts going
            return i, None, str(e)

    tasks = [asyncio.create_task(one(i, pr)) for i, pr in enumerate(prompts)]
    made = []
    for fut in asyncio.as_completed(tasks):
        i, c, err = await fut
        if c:
            made.append(c)
            yield "concept", {"index": i, "concept": c}
        else:
            yield "concept.failed", {"index": i, "message": err}
    fresh = await db.get_project(pid)
    concepts = (fresh.get("concepts") or []) + made
    fields = {"concepts": concepts, "stage": "concepts"}
    if not fresh.get("thumbnail_url") and made:
        fields["thumbnail_url"] = made[0]["url"]
    await db.update_project(pid, **fields)


async def render_view(pid: str, image: bytes, mime: str, prompt: str | None) -> str:
    """Viewport screenshot → photoreal render that keeps the exact geometry and camera."""
    instr = ("Turn this 3D architectural viewport render into a photorealistic photograph. Keep EXACTLY the same building geometry, "
             "openings, camera angle, framing and material choices; upgrade lighting, textures, reflections, vegetation and sky to "
             "real-world photo quality. No added objects or people, no text." + (f" {prompt}" if prompt else ""))
    resp = await client().aio.models.generate_content(
        model=config.MODEL_IMAGE, contents=[types.Part.from_bytes(data=image, mime_type=mime), instr],
        config=types.GenerateContentConfig(response_modalities=["IMAGE", "TEXT"]))
    for part in resp.candidates[0].content.parts:
        if part.inline_data and part.inline_data.data:
            return await blobs.put(f"projects/{pid}/renders/{db.new_id('r_')}.png", part.inline_data.data,
                                   part.inline_data.mime_type or "image/png")
    raise RuntimeError("The image model returned no image")
