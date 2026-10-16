"""Setup (intake) agent: a short, chip-driven conversation that fills the project Brief.

One structured Gemini call per turn (fast, reliable UI): the model returns a brief patch plus the next question
with one-tap chips. The LDA envelope is computed deterministically whenever the plot is known.
`skip_all` (or a skipped question) lets the agent decide sensible defaults itself, marked as `auto_filled`.
"""
from __future__ import annotations

import json
from typing import AsyncIterator

from google.genai import types

from .. import config, llm
from ..compliance import lda
from ..gemini import client
from ..store import db

PLOT_PRESETS = {  # typical Lahore scheme dimensions (docs/research/lda-regulations.md §1.2)
    3: (19, 35.5), 5: (25, 45), 7: (30, 52.5), 10: (35, 65), 20: (50, 90), 40: (75, 120),
}

AUTHORITIES = {"LDA", "DHA", "BAHRIA", "RDA", "FDA", "MDA", "GDA", "OTHER"}
ESSENTIAL = ["authority", "plot", "storeys", "bedrooms", "bathrooms", "spaces", "style"]

SYSTEM = """You are "Naqsha", a warm, expert Lahore architect running a quick project setup chat for a family designing a house
in Punjab, Pakistan. Your goal: fill a design brief with as FEW questions as possible, one question per turn, each answerable
with one tap. Use Pakistani terms naturally (marla, kanal, drawing room, TV lounge, dirty kitchen, servant quarter, car porch,
mumty). Keep messages to 1–2 short sentences. Never ask for something already in the brief.

Ask in roughly this order, skipping anything already known:
1. location (field "authority"): city + scheme/authority (chips: "Lahore · LDA scheme" (value LDA), "DHA Lahore" (DHA), "Bahria Town Lahore" (BAHRIA),
   "Other Punjab city" (OTHER)). input = null.
2. plot size: input = "plot" (the UI shows plot presets) with chips 5 marla, 7 marla, 10 marla, 1 kanal, 2 kanal.
3. optional map pin + which way the front faces: input = "map", chips N/E/S/W facing, allow_skip true.
4. floors: chips "Single storey", "Double storey", "Double + basement", "Triple storey" (LDA allows max 3 storeys).
5. rooms: input = "rooms"; chips for bedrooms (3/4/5/6); also infer bathrooms (usually bedrooms + 1 for a powder room)
   and spaces (drawing, tv_lounge, dining, kitchen, dirty_kitchen, servant_quarter, car_porch:N, lawn, prayer, store,
   laundry, roof_terrace, study, gym).
6. style: input = "style"; chips "Modern Contemporary", "Spanish", "Classic", "Minimalist", "Mediterranean", "Mughal Revival".
7. budget (optional): chips economy / standard / premium / luxury, allow_skip true.
8. last: "Anything else? (e.g. elderly parents on ground floor, home office)" with chips like "Elderly-friendly ground floor",
   "Home office", "Double-height lounge", "No, let's design!". Then set complete = true.

If the user answers several things at once, record them all and move on. If the user skips a question or says "you decide",
choose a sensible value yourself, put it in brief_patch and list the field in auto_filled. Set complete = true when all of
authority, plot, storeys, bedrooms, bathrooms, spaces and style are known (the optional ones may stay empty) and the user has
nothing to add. When complete, the message summarises the brief in one line and says you'll generate concept images next.

brief_patch uses these fields: city, authority (LDA|DHA|BAHRIA|RDA|FDA|MDA|GDA|OTHER), scheme, coordinates {lat,lng},
plot {width_ft, depth_ft, area_marla, corner}, facing (N|NE|E|SE|S|SW|W|NW), storeys (1-3), basement (bool), bedrooms,
bathrooms, spaces (list of strings), style, style_notes, budget (economy|standard|premium|luxury), notes.
For plot sizes use typical Lahore dimensions: 3 marla 19x35.5, 5 marla 25x45, 7 marla 30x52.5, 10 marla 35x65,
1 kanal (20 marla) 50x90, 2 kanal 75x120 (1 marla = 225 sq ft)."""

TURN_SCHEMA = {
    "type": "object",
    "properties": {
        "brief_patch": {
            "type": "object",
            "properties": {
                "city": {"type": "string"}, "authority": {"type": "string"}, "scheme": {"type": "string"},
                "coordinates": {"type": "object", "properties": {"lat": {"type": "number"}, "lng": {"type": "number"}}},
                "plot": {"type": "object", "properties": {"width_ft": {"type": "number"}, "depth_ft": {"type": "number"},
                                                           "area_marla": {"type": "number"}, "corner": {"type": "boolean"}}},
                "facing": {"type": "string"}, "storeys": {"type": "integer"}, "basement": {"type": "boolean"},
                "bedrooms": {"type": "integer"}, "bathrooms": {"type": "integer"},
                "spaces": {"type": "array", "items": {"type": "string"}},
                "style": {"type": "string"}, "style_notes": {"type": "string"}, "budget": {"type": "string"}, "notes": {"type": "string"},
            },
        },
        "auto_filled": {"type": "array", "items": {"type": "string"}},
        "message": {"type": "string"},
        "chips": {"type": "array", "items": {"type": "object", "properties": {
            "label": {"type": "string"}, "value": {"type": "string"}, "hint": {"type": "string"}}, "required": ["label", "value"]}},
        "multi": {"type": "boolean"},
        "input": {"type": "string", "enum": ["text", "number", "plot", "map", "style", "rooms", "none"]},
        "field": {"type": "string"},
        "allow_skip": {"type": "boolean"},
        "complete": {"type": "boolean"},
    },
    "required": ["brief_patch", "message", "chips", "input", "complete"],
}

DEFAULT_SPACES = ["drawing", "tv_lounge", "dining", "kitchen", "car_porch:1", "lawn", "store"]


def empty_brief() -> dict:
    return {"city": "Lahore", "authority": None, "plot": None, "storeys": None, "basement": False, "bedrooms": None,
            "bathrooms": None, "spaces": [], "style": None, "auto_filled": []}


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


def merge_brief(brief: dict, patch: dict, auto: list[str]) -> dict:
    out = {**brief}
    patch = dict(patch or {})
    if str(patch.get("style", "")).upper() in AUTHORITIES:  # model slip: an authority answer filed under style
        patch.setdefault("authority", str(patch.pop("style")).upper())
    for k, v in patch.items():
        if v in (None, "", [], {}):
            continue
        if k == "plot":
            v = _normalize_plot({**(brief.get("plot") or {}), **v})
            if not v:
                continue
        if k == "authority":
            v = str(v).upper()
        if k == "storeys":
            v = max(1, min(3, int(v)))
        out[k] = v
    if str(out.get("style") or "").upper() in AUTHORITIES:
        out["style"] = None
    out["auto_filled"] = sorted(set(out.get("auto_filled") or []) | set(auto or []))
    return out


def defaults_for(brief: dict) -> tuple[dict, list[str]]:
    """Sensible defaults for anything missing (used by skip_all)."""
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
    b["auto_filled"] = sorted(set(b.get("auto_filled") or []) | set(auto))
    return b, auto


def missing(brief: dict) -> list[str]:
    return [k for k in ESSENTIAL if not brief.get(k)]


def envelope_for(brief: dict) -> dict | None:
    p = brief.get("plot")
    if not p:
        return None
    env = lda.envelope(p["width_ft"], p["depth_ft"], brief.get("authority") or "LDA", bool(p.get("corner")))
    env.pop("_band", None)
    return env


async def run_turn(project: dict, message: str | None, action: str | None, chips: list[str] | None) -> AsyncIterator[tuple[str, dict]]:
    pid = project["id"]
    brief = project.get("brief") or empty_brief()

    # Record the user's input
    user_text = message or (", ".join(chips) if chips else None)
    if action == "skip_question":
        user_text = "Skip — you decide."
    elif action == "skip_all":
        user_text = "Skip setup — design it for me."
    if user_text and action != "start":
        yield "message", await db.add_message(pid, {"role": "user", "text": user_text})

    if action == "skip_all":
        brief, auto = defaults_for(brief)
        env = envelope_for(brief)
        await db.update_project(pid, brief=brief, envelope=env, intake_complete=True, stage="concepts")
        yield "brief", {"brief": brief, "envelope": env}
        summary = _summary(brief)
        text = (f"Done — I've prepared a starting brief: {summary}. Everything is editable. Next I'll sketch four concept "
                f"exteriors for you.")
        yield "message", await db.add_message(pid, {"role": "assistant", "text": text, "chips": [], "input": None})
        yield "intake.complete", {"brief": brief, "envelope": env}
        return

    history = await db.list_messages(pid)
    convo = "\n".join(f"{m['role'].upper()}: {m['text']}" for m in history[-14:])
    last_q = next((m for m in reversed(history) if m["role"] == "assistant"), None)
    prompt = (f"CURRENT BRIEF (JSON): {json.dumps(brief)}\n"
              f"THE USER IS ANSWERING THE QUESTION ABOUT: {(last_q or {}).get('field') or 'n/a'} "
              f"(chips offered: {[c.get('value') for c in (last_q or {}).get('chips', [])]})\n"
              f"MISSING ESSENTIALS: {missing(brief)}\n"
              f"CONVERSATION SO FAR:\n{convo or '(none — this is the opening message; greet briefly and ask question 1)'}\n"
              f"LATEST ACTION: {action or 'answer'}")
    turn = None
    async for kind, val in llm.stream_json(config.MODEL_INTAKE, prompt, SYSTEM + "\n\nRESPONSE FORMAT (JSON Schema):\n" +
                                           json.dumps(TURN_SCHEMA), max_tokens=2048, attempts=3):
        if kind == "result":
            turn = val[0]
    assert isinstance(turn, dict)
    brief = merge_brief(brief, turn.get("brief_patch") or {}, turn.get("auto_filled") or [])
    env = envelope_for(brief)
    complete = bool(turn.get("complete")) and not missing(brief)
    await db.update_project(pid, brief=brief, envelope=env, intake_complete=complete, stage="concepts" if complete else "setup")
    yield "brief", {"brief": brief, "envelope": env}

    inp = turn.get("input")
    msg = {"role": "assistant", "text": turn["message"], "chips": turn.get("chips") or [], "multi": bool(turn.get("multi")),
           "input": None if inp in (None, "none") else inp, "field": turn.get("field"), "allow_skip": turn.get("allow_skip", True)}
    if complete:
        msg["chips"], msg["input"] = [], None
    yield "message", await db.add_message(pid, msg)
    if complete:
        yield "intake.complete", {"brief": brief, "envelope": env}


def _summary(b: dict) -> str:
    p = b.get("plot") or {}
    return (f"{p.get('area_marla', '?'):g} marla ({p.get('width_ft', '?'):g}×{p.get('depth_ft', '?'):g} ft) "
            f"{b.get('authority')}, {b.get('storeys')}-storey, {b.get('bedrooms')} bedrooms / {b.get('bathrooms')} baths, "
            f"{b.get('style')}")
