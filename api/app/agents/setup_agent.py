"""The conversational setup agent (Google ADK, Gemini Flash with low thinking).

One long message can fill the whole brief: the agent records everything it heard with update_brief (deterministic merge:
notes and preferences are appended, never overwritten), answers any direct question from the LDA facts it is given, then
asks only what is still missing (ask) or wraps up (complete_setup), optionally with the "Here's what I understood" card
(present_understanding). A turn is at most two short model steps; the tool that replies ends the turn without another model
call (skip_summarization).

History is replayed from the project's messages collection on every turn, so any Cloud Run instance can serve the next turn.
"""
from __future__ import annotations

import json
import re
import logging
import time
from typing import AsyncIterator, Optional

from google.adk import Agent, Runner
from google.adk.models import Gemini
from google.adk.sessions import InMemorySessionService
from google.adk.tools.tool_context import ToolContext
from google.genai import types

from .. import config
from ..compliance import lda
from ..gemini import RETRY
from ..store import db
from . import intake

log = logging.getLogger("naqsha.setup")
APP = "naqsha-setup"
KNOWN_FIELDS = set(intake.ASK_ORDER) | {"budget", "bathrooms", "spaces", "rooms"}

INSTRUCTION = """You are Naqsha, a calm, experienced Lahore architect setting up a new home with a family in Punjab, Pakistan.
You speak like a warm professional: brief, second person, in marla and feet. One to three short sentences. Never say Argon,
agent, AI, model or SDK. No emoji, no exclamation marks.

Every turn:
1. If the user told you anything about the home, record ALL of it with ONE update_brief call: location, plot (marla or width ×
   depth, corner or mid-row, facing), floors, rooms per floor, bedroom and bath totals, spaces, water tank, solar, style,
   budget, and every soft wish as a short preference in the family's own words ("parents' bedroom on the ground floor",
   "open kitchen", "double-height lounge"). Never invent what they didn't say.
   Rooms per floor go in `floors` as "level=room,room:count", e.g. ["ground=drawing,kitchen,dirty_kitchen,bedroom:1,bath:2",
   "first=bedroom:3,bath:3,lounge"]. Use bedroom (or master_bedroom / guest_bedroom), bath, powder, drawing, lounge, dining,
   kitchen, kitchenette, dirty_kitchen, prayer, study, store, laundry, servant_quarter, dressing, terrace, balcony.
   "Attached baths" means one bath per bedroom: set bathrooms accordingly (plus a powder room if they mention one).
2. If they asked a question, answer it first, using ONLY the LDA FACTS you are given (never other numbers). Push back gently on
   choices with a real trade-off (a double-height lounge costs first-floor area; a fourth storey isn't allowed).
3. In the SAME step, reply with ask() for the first field in STILL MISSING that they haven't just answered, or with
   complete_setup() when nothing will be missing after your update. Never ask about the budget. Put your whole reply
   (a short acknowledgement or answer, then the question) in that call's text; write nothing else.
   The app shows the family a card of everything you recorded, so don't repeat the brief back. Call present_understanding()
   only to list assumptions you made yourself (e.g. a plot size you inferred).
Call update_brief together with ask or complete_setup in ONE step."""


class Turn:
    """Per-turn state the tools write into."""

    def __init__(self, brief: dict, before: dict):
        self.brief = brief
        self.before = before
        self.reply: dict | None = None
        self.understood: dict | None = None
        self.complete = False
        self.updated = False
        self.patch_fields: set[str] = set()

    def tools(self):
        t = self

        def update_brief(city: Optional[str] = None, authority: Optional[str] = None, scheme: Optional[str] = None,
                         plot_marla: Optional[float] = None, plot_width_ft: Optional[float] = None,
                         plot_depth_ft: Optional[float] = None, corner: Optional[bool] = None, facing: Optional[str] = None,
                         storeys: Optional[int] = None, basement: Optional[bool] = None, bedrooms: Optional[int] = None,
                         bathrooms: Optional[int] = None, spaces: Optional[list[str]] = None,
                         remove_spaces: Optional[list[str]] = None, floors: Optional[list[str]] = None,
                         water_tank: Optional[str] = None, solar: Optional[str] = None, style: Optional[str] = None,
                         style_notes: Optional[str] = None, budget: Optional[str] = None,
                         preferences: Optional[list[str]] = None, note: Optional[str] = None,
                         decided_for_them: Optional[list[str]] = None) -> dict:
            """Record what the family told you in the design brief. Pass only what they said (or what you decided because they
            asked you to, listed in decided_for_them).

            Args:
              city: City, e.g. "Lahore".
              authority: LDA, DHA, BAHRIA, RDA, FDA, MDA, GDA or OTHER (LDA for ordinary Lahore schemes such as Johar Town).
              scheme: Housing scheme or society, e.g. "Johar Town", "DHA Phase 6".
              plot_marla: Plot area in marla (1 kanal = 20 marla).
              plot_width_ft: Plot frontage in feet, if given.
              plot_depth_ft: Plot depth in feet, if given.
              corner: True for a corner plot, False for mid-row ("not a corner").
              facing: Which way the front faces: N, NE, E, SE, S, SW, W or NW.
              storeys: Floors above ground, 1 to 3.
              basement: True if they want a basement.
              bedrooms: Total bedrooms (servant quarters excluded).
              bathrooms: Total baths including any powder room.
              spaces: Spaces to add: drawing, tv_lounge, dining, kitchen, dirty_kitchen, servant_quarter, car_porch:N (N cars),
                lawn, prayer, store, laundry, roof_terrace, study, gym.
              remove_spaces: Spaces they no longer want.
              floors: Rooms per floor, each "level=room,room:count", e.g. "ground=drawing,kitchen,bedroom:1,bath:2".
              water_tank: "plastic" or "concrete".
              solar: "none", "ready" (roof kept clear for panels later) or "panels" (panels now).
              style: Modern Contemporary, Spanish, Classic, Minimalist, Mediterranean, Mughal Revival, Industrial or free text.
              style_notes: Extra style direction in their words.
              budget: economy, standard, premium or luxury.
              preferences: Soft wishes in their own words, each short.
              note: Anything else worth remembering, one sentence.
              decided_for_them: Fields you chose yourself because they asked you to decide.
            """
            patch: dict = {}
            cur = t.brief.get("plot") or {}
            plot: dict = {}
            if plot_width_ft and plot_depth_ft:
                plot = {"width_ft": plot_width_ft, "depth_ft": plot_depth_ft}
            elif plot_marla and not (cur and abs((cur.get("area_marla") or 0) - plot_marla) < 0.6):
                plot = {"area_marla": plot_marla, "corner": cur.get("corner", False)}
                t.brief = {**t.brief, "plot": None}  # a new size: don't keep the old width and depth
            if corner is not None:
                plot["corner"] = bool(corner)
            if plot:
                patch["plot"] = plot
            for k, v in (("city", city), ("authority", authority), ("scheme", scheme), ("facing", facing),
                         ("storeys", storeys), ("basement", basement), ("bedrooms", bedrooms), ("bathrooms", bathrooms),
                         ("spaces", spaces), ("remove_spaces", remove_spaces), ("floors", floors), ("water_tank", water_tank),
                         ("solar", solar), ("style", style), ("style_notes", style_notes), ("budget", budget),
                         ("preferences", preferences), ("notes", note)):
                if v not in (None, "", []):
                    patch[k] = v
            if patch.get("bedrooms") and not patch.get("bathrooms") and not t.brief.get("bathrooms"):
                patch["bathrooms"] = int(patch["bedrooms"]) + 1
                decided_for_them = list(decided_for_them or []) + ["bathrooms"]
            t.brief = intake.merge_brief(t.brief, patch, list(decided_for_them or []), spaces_mode="union")
            t.updated = True
            t.patch_fields |= set(patch)
            return {"ok": True, "still_missing": intake.to_ask(t.brief) or ["nothing: call complete_setup"],
                    "lda_facts": intake.lda_facts(t.brief), "brief": _compact(t.brief)}

        def get_lda_envelope(width_ft: float, depth_ft: float, corner: bool = False, authority: str = "LDA") -> dict:
            """LDA facts for any plot size (for "what if" questions about another plot).

            Args:
              width_ft: Plot width in feet.
              depth_ft: Plot depth in feet.
              corner: Corner plot.
              authority: LDA, DHA, BAHRIA or OTHER.
            """
            env = lda.envelope(width_ft, depth_ft, authority.upper(), corner)
            env.pop("_band", None)
            return {k: env[k] for k in ("band", "setbacks_ft", "max_coverage_pct", "max_far", "max_height_ft", "max_storeys", "notes")}

        def ask(question: str, field: str, tool_context: ToolContext, chips: Optional[list[str]] = None,
                input: Optional[str] = None, multi: bool = False, allow_skip: bool = True,
                suggestions: Optional[list[str]] = None) -> dict:
            """Send your reply and ask ONE question. Ends your turn.

            Args:
              question: Your whole reply: a short acknowledgement or answer, then the question.
              field: The brief field you are asking about: authority, plot, facing, storeys, bedrooms, floors, water_tank,
                solar, style, budget, or "other" for anything else.
              chips: Optional one-tap answers for an "other" question (the app supplies them for known fields).
              input: Optional widget: text, number, plot, map, style, rooms or floors.
              multi: True if several chips may be chosen.
              allow_skip: True to offer "Decide for me".
              suggestions: Optional follow-up prompts the family might send next.
            """
            t.reply = {"text": question, "field": field, "chips": chips or [], "input": input, "multi": multi,
                       "allow_skip": allow_skip, "suggestions": suggestions or []}
            tool_context.actions.skip_summarization = True
            return {"ok": True}

        def present_understanding(preferences: list[str], assumptions: list[str], guaranteed: Optional[list[str]] = None) -> dict:
            """Show the "Here's what I understood" card with your reply.

            Args:
              preferences: What the family asked for, short and in their words.
              assumptions: What you chose yourself and they can change.
              guaranteed: Optional; the app adds the LDA and livability guarantees itself.
            """
            t.understood = {"preferences": preferences or [], "assumptions": assumptions or [], "guaranteed": guaranteed or []}
            return {"ok": True}

        def complete_setup(message: str, tool_context: ToolContext, suggestions: Optional[list[str]] = None) -> dict:
            """Wrap up the setup when nothing is missing. Ends your turn.

            Args:
              message: Your reply: one sentence that reads the brief back and says concepts come next.
              suggestions: Optional follow-up prompts.
            """
            # update_brief may run after this in the same step, so the app decides after the turn whether anything is missing
            t.complete = True
            t.reply = {"text": message, "field": None, "chips": [], "input": None, "multi": False, "allow_skip": False,
                       "suggestions": suggestions or [], "complete": True}
            tool_context.actions.skip_summarization = True
            return {"ok": True}

        return [update_brief, get_lda_envelope, ask, present_understanding, complete_setup]


def _compact(b: dict) -> dict:
    return {k: v for k, v in b.items() if v not in (None, "", [], {}, False) and k != "auto_filled"} | (
        {"decided_by_naqsha": b["auto_filled"]} if b.get("auto_filled") else {})


def _context(project: dict, brief: dict, history: list[dict], user_text: str, widget_patch: dict) -> str:
    convo = []
    for m in history[-8:]:
        who = "FAMILY" if m["role"] == "user" else "NAQSHA"
        convo.append(f"{who}: {str(m.get('text', ''))[:600]}")
    last_q = next((m for m in reversed(history) if m["role"] == "assistant"), None)
    design = ""
    if project.get("versions"):
        design = (f"\nA DESIGN ALREADY EXISTS (version {len(project['versions'])}). Record changes as usual, then tell them the "
                  f"change applies when they revise the design or design again; don't restart the setup.")
    return (f"BRIEF NOW: {json.dumps(_compact(brief))}\n"
            + (f"THE APP ALREADY APPLIED FROM THE WIDGET: {json.dumps(widget_patch)}\n" if widget_patch else "")
            + f"STILL MISSING (ask in this order): {intake.to_ask(brief) or 'nothing'}\n"
            f"LDA FACTS: {intake.lda_facts(brief)}\n"
            f"LAST QUESTION ASKED: {(last_q or {}).get('field') or 'none'}{design}\n"
            f"CONVERSATION SO FAR:\n" + ("\n".join(convo[:-1] if convo and convo[-1].startswith('FAMILY') else convo) or "(none)")
            + f"\n\nTHE FAMILY NOW SAYS: {user_text}")


async def agent_turn(project: dict, brief: dict, before: dict, history: list[dict], user_text: str,
                     widget_patch: dict) -> AsyncIterator[tuple[str, dict]]:
    pid = project["id"]
    t0 = time.monotonic()
    if widget_patch:
        brief = intake.merge_brief(brief, widget_patch, [], spaces_mode="replace")
    turn = Turn(brief, before)
    agent = Agent(name="naqsha_setup", model=Gemini(model=config.MODEL_SETUP, retry_options=RETRY), instruction=INSTRUCTION,
                  tools=turn.tools(), generate_content_config=types.GenerateContentConfig(
                      temperature=0.4, max_output_tokens=2048,
                      thinking_config=types.ThinkingConfig(thinking_level="LOW")))
    sessions = InMemorySessionService()
    runner = Runner(app_name=APP, agent=agent, session_service=sessions)
    session = await sessions.create_session(app_name=APP, user_id=pid)
    msg = types.Content(role="user", parts=[types.Part.from_text(text=_context(project, brief, history, user_text, widget_patch))])
    final_text = ""
    steps = 0
    try:
        async for event in runner.run_async(user_id=pid, session_id=session.id, new_message=msg):
            if event.get_function_calls():
                steps += 1
            if event.content and event.content.parts and not event.get_function_calls() and not event.get_function_responses():
                final_text += "".join(p.text or "" for p in event.content.parts if not getattr(p, "thought", False))
            if turn.reply or steps > 4:
                break
    except Exception:
        log.exception("setup agent failed; falling back to the question bank")
    brief = turn.brief
    gaps = intake.to_ask(brief)
    done = not gaps and not intake.missing(brief)
    asked = (turn.reply or {}).get("field")
    # complete when the agent says so and nothing is missing, or when it asks about a brief field nothing needs any more
    complete = done and (turn.complete or turn.reply is None or (asked in KNOWN_FIELDS and asked not in gaps))
    if turn.complete and not done:  # it wrapped up too early: ask the first real gap instead
        q = intake.question(gaps[0] if gaps else intake.missing(brief)[0], brief)
        turn.reply = {"text": "Noted. " + q["text"], "suggestions": [], "multi": False, **{k: q[k] for k in ("field", "chips", "input", "allow_skip")}}
    elif complete and turn.reply and not turn.reply.get("complete"):  # keep its answer, drop the needless question
        kept = _strip_question(turn.reply.get("text", ""))
        turn.reply = {"text": (kept + " " + intake._complete_text(project, brief)).strip(), "complete": True,
                      "suggestions": turn.reply.get("suggestions") or []}
    if complete and not brief.get("spaces"):
        brief = intake.merge_brief(brief, {"spaces": intake.defaults_for(brief)[0]["spaces"]}, ["spaces"])
    brief, env, newly = await intake._save(project, brief, complete, before)
    yield "brief", {"brief": brief, "envelope": env}

    reply = turn.reply or {"text": final_text.strip(), "field": None, "chips": [], "input": None, "multi": False,
                           "allow_skip": True, "suggestions": []}
    if not complete:
        field = reply.get("field")
        # the app owns the widgets and canonical chips for known fields; a stale question becomes the next real one
        if field in intake.ASK_ORDER and field not in gaps and gaps:
            q = intake.question(gaps[0], brief)
            reply = {**reply, "text": (_strip_question(reply["text"]) + " " + q["text"]).strip(), **{k: q[k] for k in ("field", "chips", "input", "allow_skip")}}
        elif field in intake.ASK_ORDER:
            q = intake.question(field, brief)
            reply = {**reply, "chips": q["chips"], "input": q["input"] or reply.get("input"), "allow_skip": True}
        elif not reply.get("text") and gaps:
            q = intake.question(gaps[0], brief)
            reply = {**reply, **{k: q[k] for k in ("field", "chips", "input", "allow_skip")}, "text": q["text"]}
        else:
            reply["chips"] = [c if isinstance(c, dict) else {"label": str(c), "value": str(c)} for c in reply.get("chips") or []]
            if reply.get("input") not in (None, "text", "number", "plot", "map", "style", "rooms", "floors"):
                reply["input"] = None
    else:
        if not reply.get("text"):
            reply["text"] = intake._complete_text(project, brief)
        reply.update(field=None, chips=[], input=None, allow_skip=False)
        reply["suggestions"] = reply.get("suggestions") or intake._complete_suggestions(project)
    out = {"role": "assistant", "text": reply["text"], "chips": reply.get("chips") or [], "multi": bool(reply.get("multi")),
           "input": reply.get("input"), "field": reply.get("field"), "allow_skip": bool(reply.get("allow_skip"))}
    rich = len(turn.patch_fields - {"notes"}) >= 3
    if turn.understood or complete or rich:
        out["understood"] = intake.understood(brief, turn.understood)
    if reply.get("suggestions"):
        out["suggestions"] = [str(s) for s in reply["suggestions"]][:3]
    yield "message", await db.add_message(pid, out)
    if complete and newly:
        yield "intake.complete", {"brief": brief, "envelope": env}
    log.info("setup turn %s: %.1fs, %d steps, fields %s", pid, time.monotonic() - t0, steps, sorted(turn.patch_fields))


def _strip_question(text: str) -> str:
    parts = re.split(r"(?<=[.!?])\s+", (text or "").strip())
    while parts and parts[-1].endswith("?"):
        parts.pop()
    return " ".join(parts)

