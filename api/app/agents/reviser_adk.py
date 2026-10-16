"""Revision agent on Google ADK: a tool-using Argon agent that turns walkthrough comments into a new version.

Rather than receiving the whole design in one prompt, the agent works the way an architect would. It looks up the
rooms the comments point at, reads only the code sections it needs, dry-runs layout edits against the LDA engine until
they comply, writes the replacement sections, and records a resolution for every comment. Each tool call is streamed
to the browser as a progress event. If ADK fails, the caller falls back to the single-shot reviser.
"""
from __future__ import annotations

import copy
import json
from typing import AsyncIterator

from google.adk import Agent, Runner
from google.adk.models import Gemini
from google.adk.sessions import InMemorySessionService
from google.genai import types

from .. import config
from ..compliance import lda
from ..gemini import RETRY
from ..store import blobs, db
from .architect import BUILD_SYSTEM, CONTRACTS, _read
from .reviser import apply_ops, merge_sections

APP = "naqsha-reviser"

INSTRUCTION = """You are Naqsha's architect revising a house after the family's 3D walkthrough. Every comment is pinned to a
spot in the model (room, element, level) and has a snapshot of what they saw.

Work like this:
1. For each comment, call get_room for the room it points at (and read_section for the sections you may change).
2. Layout changes (room sizes or positions, adding or moving doors and windows, new rooms) go through check_plan_ops first. That
   is a dry run against the LDA Building & Zoning Regulations. Iterate until it reports ok, then call apply_plan_ops.
   If no compliant version exists, do not change the layout: resolve the comment as "rejected" or "partial", cite the rule and
   offer an alternative.
3. Visual changes (materials, colours, furniture, facade details, lighting) are made with write_section, which takes the
   FULL new code of that section. If a room changed size, rewrite its furnish_<room_id> section too.
4. Call resolve_comment exactly once per comment, with a friendly one- or two-sentence resolution.
5. Finish by calling finish with the list of changes.
Make the smallest change that satisfies each comment and keep everything else identical. The `structure` section rebuilds walls,
openings, stairs and slabs from the plan automatically. Only rewrite it to change structural materials.

design.js section rules (for write_section): """ + BUILD_SYSTEM.split("Rules:")[-1]


class Workspace:
    """Mutable working copy of the version that the agent's tools operate on."""

    def __init__(self, version: dict, comments: list[dict]):
        self.plan = copy.deepcopy(version["plan"])
        self.sections = copy.deepcopy(version["sections"])
        self.report = version.get("compliance")
        self.comments = {c["id"]: c for c in comments}
        self.resolutions: dict[str, dict] = {}
        self.written: list[dict] = []
        self.removed: list[str] = []
        self.changes: list[dict] = []
        self.plan_changed = False
        self.events: list[tuple[str, dict]] = []  # SSE events produced by tools, drained by the runner loop

    def tools(self):
        ws = self

        def list_sections() -> list[dict]:
            """List the design.js sections of the current design (name, layer, number of lines)."""
            return [{"name": s["name"], "layer": s["layer"], "lines": s["code"].count("\n")} for s in ws.sections]

        def read_section(name: str) -> dict:
            """Read the full code of one design.js section.

            Args:
              name: Section name, e.g. "furnish_f_master" or "facade_front".
            """
            s = next((s for s in ws.sections if s["name"] == name), None)
            ws.events.append(("stage", {"stage": "changes", "message": f"Reading {name}…"}))
            return {"name": name, "layer": s["layer"], "code": s["code"]} if s else {"error": f"no section {name}"}

        def get_room(room_id: str) -> dict:
            """Get a room from the plan (feet), with the openings on its edges and its neighbours.

            Args:
              room_id: Room id, e.g. "f_master".
            """
            r = next((r for r in ws.plan["rooms"] if r["id"] == room_id), None)
            if not r:
                return {"error": f"no room {room_id}", "rooms": [x["id"] for x in ws.plan["rooms"]]}
            ops = [o for o in ws.plan["openings"] if room_id in o.get("between", [])]
            return {"room": r, "openings": ops, "level": next((lv for lv in ws.plan["levels"] if lv["id"] == r["level"]), None)}

        def check_plan_ops(ops: list[dict]) -> dict:
            """Dry-run plan edits against the LDA compliance engine without applying them.

            Args:
              ops: List of operations. Each is {"op": "upsert", "collection": "rooms"|"openings"|"stairs"|"levels", "item": {...full object with id}},
                   {"op": "remove", "collection": ..., "id": "..."} or {"op": "set", "path": "roof.parapet_ft", "value": ...}.
            """
            ws.events.append(("stage", {"stage": "compliance", "message": "Checking proposed layout changes against LDA rules…"}))
            rep = lda.check(apply_ops(ws.plan, ops))
            return {"ok": rep["ok"], "problems": [f"[{c['status']}] {c['title']}: {c['message']}" for c in rep["checks"] if c["status"] != "pass"]}

        def apply_plan_ops(ops: list[dict]) -> dict:
            """Apply plan edits (only after check_plan_ops says ok). Same format as check_plan_ops.

            Args:
              ops: The operations to apply.
            """
            cand = apply_ops(ws.plan, ops)
            rep = lda.check(cand)
            if not rep["ok"]:
                return {"applied": False, "problems": [c["message"] for c in rep["checks"] if c["status"] == "fail"]}
            ws.plan, ws.report, ws.plan_changed = cand, rep, True
            ws.events += [("plan", {"plan": cand, "attempt": 1}), ("compliance", {"report": rep, "attempt": 1})]
            return {"applied": True}

        def write_section(name: str, layer: str, code: str) -> dict:
            """Add or replace a design.js section with its FULL new code.

            Args:
              name: Section name (existing to replace, or new).
              layer: One of structure, facade, interior, furniture, landscape, lighting, custom.
              code: The complete JavaScript body of the section (no // @section header).
            """
            sec = {"name": name, "layer": layer, "code": code if code.endswith("\n") else code + "\n"}
            ws.sections = merge_sections(ws.sections, [sec], [])
            ws.written.append(sec)
            idx = next(i for i, s in enumerate(ws.sections) if s["name"] == name)
            ws.events.append(("section", {"section": sec, "index": idx}))
            return {"ok": True}

        def remove_section(name: str) -> dict:
            """Remove a design.js section.

            Args:
              name: Section name.
            """
            ws.sections = [s for s in ws.sections if s["name"] != name]
            ws.removed.append(name)
            return {"ok": True}

        def resolve_comment(comment_id: str, status: str, resolution: str) -> dict:
            """Record how a walkthrough comment was handled.

            Args:
              comment_id: The comment id.
              status: "resolved", "partial" or "rejected".
              resolution: One or two friendly sentences for the family (what changed, or why not plus the alternative).
            """
            ws.resolutions[comment_id] = {"status": status if status in ("resolved", "partial", "rejected") else "partial",
                                          "resolution": resolution}
            return {"ok": True, "remaining": [c for c in ws.comments if c not in ws.resolutions]}

        def finish(changes: list[dict]) -> dict:
            """Finish the revision.

            Args:
              changes: [{"summary": "Enlarged the master bedroom window to 10 ft", "kind": "plan"|"section",
                         "targets": ["f_master_w1"], "comment_ids": ["..."]}]
            """
            ws.changes = [{"id": f"ch{i + 1}", **c} for i, c in enumerate(changes or [])]
            return {"ok": True}

        return [list_sections, read_section, get_room, check_plan_ops, apply_plan_ops, write_section, remove_section,
                resolve_comment, finish]


async def revise(project: dict, version: dict, comments: list[dict]) -> AsyncIterator[tuple[str, dict]]:
    pid = project["id"]
    await db.update_project(pid, stage="revising")
    yield "stage", {"stage": "changes", "message": f"Argon is reviewing your {len(comments)} comment(s)…"}
    ws = Workspace(version, comments)
    agent = Agent(name="reviser", model=Gemini(model=config.MODEL_ARCHITECT, retry_options=RETRY), instruction=INSTRUCTION, tools=ws.tools(),
                  generate_content_config=types.GenerateContentConfig(max_output_tokens=32768))
    sessions = InMemorySessionService()
    runner = Runner(app_name=APP, agent=agent, session_service=sessions)
    session = await sessions.create_session(app_name=APP, user_id=pid)

    parts: list = []
    for c in comments[:8]:
        if c.get("snapshot_url"):
            got = await blobs.get(c["snapshot_url"].removeprefix("/api/assets/"))
            if got:
                parts += [types.Part.from_text(text=f"Snapshot for comment {c['id']}:"), types.Part.from_bytes(data=got[0], mime_type=got[1])]
    brief = project.get("brief") or {}
    env = lda.envelope(brief["plot"]["width_ft"], brief["plot"]["depth_ft"], brief.get("authority") or "LDA") if brief.get("plot") else {}
    env.pop("_band", None)
    cm = [{"id": c["id"], "text": c["text"], "where": {k: c["anchor"].get(k) for k in ("level", "room", "element_id", "kind", "label")}}
          for c in comments]
    text = (f"HOUSE SDK REFERENCE:\n{_read(CONTRACTS / 'house-sdk.d.ts')}\n\nENGINE NOTES:\n{_read(CONTRACTS / 'engine-notes.md')}\n\n"
            f"LDA ENVELOPE: {json.dumps(env)}\n\n"
            f"ROOMS: {json.dumps([{k: r[k] for k in ('id', 'name', 'type', 'level', 'rect')} for r in ws.plan['rooms']])}\n\n"
            f"WALKTHROUGH COMMENTS:\n{json.dumps(cm, indent=1)}\n\nRevise the design now.")
    msg = types.Content(role="user", parts=parts + [types.Part.from_text(text=text)])

    async for event in runner.run_async(user_id=pid, session_id=session.id, new_message=msg):
        for call in event.get_function_calls() or []:
            label = {"get_room": "Looking at", "check_plan_ops": "Testing a layout change", "apply_plan_ops": "Applying layout change",
                     "write_section": "Rewriting", "resolve_comment": "Resolving comment"}.get(call.name)
            arg = (call.args or {}).get("room_id") or (call.args or {}).get("name") or ""
            if label:
                yield "stage", {"stage": "changes", "message": f"{label} {arg}".strip() + "…"}
        while ws.events:
            yield ws.events.pop(0)

    yield "changes", {"changes": ws.changes}
    yield "stage", {"stage": "save", "message": "Saving the revised version…"}
    fresh = await db.get_project(pid)
    n = len(fresh.get("versions") or []) + 1
    new_v = {"id": db.new_id("v_"), "n": n, "created_at": db.now(), "parent_id": version["id"], "plan": ws.plan,
             "sections": ws.sections, "compliance": ws.report, "changes": ws.changes, "status": "ready", "agent": "adk"}
    await db.save_version(pid, new_v)
    for c in comments:
        r = ws.resolutions.get(c["id"]) or {"status": "partial", "resolution": "Reviewed; no specific change was needed."}
        upd = await db.update_comment(pid, c["id"], status=r["status"], resolution=r["resolution"], resolved_in_version=new_v["id"])
        if upd:
            yield "comment", {"comment": upd}
    summary = "; ".join(ch.get("summary", "") for ch in ws.changes)[:200] or "Revision"
    await db.update_project(pid, versions=(fresh.get("versions") or []) + [{"id": new_v["id"], "n": n, "created_at": new_v["created_at"],
                                                                           "status": "ready", "summary": summary}],
                            current_version_id=new_v["id"], stage="ready")
    yield "version", {"version": new_v}
