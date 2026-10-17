"""Revision: walkthrough comments and/or a typed request → plan edits + code-section edits → checks → new Version.

reviser_adk.py (an ADK tool-using agent) is the main path; `revise` here is the single-shot safety net. Both share
`finalize`, which saves the version, records each comment's resolution and posts it as a reply from Naqsha in the thread.
Plan edits must not add any LDA or livability failure that the version didn't already have.
"""
from __future__ import annotations

import copy
import json
import logging
from typing import AsyncIterator

from google.genai import types

from .. import config, llm
from ..compliance import lda
from ..store import blobs, db
from .architect import BUILD_SYSTEM, CONTRACTS, _read, _status, changed_rooms, prepare, review_note_count

log = logging.getLogger("naqsha.reviser")
NAQSHA = {"id": "naqsha", "name": "Naqsha", "role": "agent"}

REVISE_SYSTEM = """You are Naqsha's architect, revising a house design after the family's 3D walkthrough. Each comment is pinned
to a spot in the 3D model (room, element, level) and comes with a snapshot of what they were looking at. A REQUEST is a change
the family typed without a pin.

Return ONE JSON object:
{
  "changes": [{"id": "ch1", "summary": "Enlarged the master bedroom window to 10 ft", "kind": "plan" | "section",
               "targets": ["f_master_w1"], "comment_ids": ["..."]}],
  "plan_ops": [ // edits to the BuildingPlan (feet, same conventions); omit or [] when the layout doesn't change
     {"op": "upsert", "collection": "rooms" | "openings" | "stairs" | "levels", "item": { ...full object with id... }},
     {"op": "remove", "collection": "rooms" | "openings" | "stairs" | "levels", "id": "..."},
     {"op": "set", "path": "roof.parapet_ft" | "site.boundary_wall.front_height_ft" | "style.palette" | ..., "value": ...}
  ],
  "sections": [ // design.js sections to ADD or REPLACE (full code of each), same rules as the original design.js
     {"name": "furnish_f_master", "layer": "furniture", "code": "..."}
  ],
  "remove_sections": ["custom_old_pergola"],
  "resolutions": [{"comment_id": "...", "status": "resolved" | "partial" | "rejected",
                   "resolution": "One or two friendly sentences: what changed, or why not (cite the rule) and the alternative."}]
}

Rules:
- Address EVERY comment with exactly one resolution (the REQUEST has comment_id "request").
- Prefer the smallest change that satisfies the comment. Keep everything else identical.
- Layout changes are plan_ops and must keep every LDA rule and livability rule (bedrooms open onto circulation, one door per
  bath, stairs with landings reaching the roof under the stair tower). If a request would break a rule, don't do it: mark it
  "rejected" (or "partial" with a compliant alternative) and name the rule in plain words.
- Visual changes (materials, colours, furniture, facade details, lighting) replace the relevant design.js sections.
- If you change a room's size or position, also replace its furnish_<room_id> section so the furniture fits.
- The `structure` section rebuilds walls, openings, stairs and slabs from the plan automatically."""


def apply_ops(plan: dict, ops: list[dict]) -> dict:
    p = copy.deepcopy(plan)
    for op in ops or []:
        kind = op.get("op")
        if kind in ("upsert", "remove"):
            col = p.setdefault(op.get("collection", "rooms"), [])
            oid = (op.get("item") or {}).get("id") if kind == "upsert" else op.get("id")
            idx = next((i for i, x in enumerate(col) if x.get("id") == oid), None)
            if kind == "remove":
                if idx is not None:
                    col.pop(idx)
            elif idx is not None:
                col[idx] = {**col[idx], **op["item"]}
            else:
                col.append(op["item"])
        elif kind == "set" and op.get("path"):
            cur, keys = p, op["path"].split(".")
            for k in keys[:-1]:
                cur = cur.setdefault(k, {})
            cur[keys[-1]] = op.get("value")
    return p


def merge_sections(old: list[dict], new: list[dict], remove: list[str]) -> list[dict]:
    out = [s for s in old if s["name"] not in set(remove or [])]
    order = {s["name"]: i for i, s in enumerate(out)}
    for s in new or []:
        s = {"name": s["name"], "layer": s.get("layer", "custom"), "code": s.get("code", "")}
        if s["name"] in order:
            out[order[s["name"]]] = s
        else:
            # keep canonical ordering: insert before landscape/lighting for furniture/facade/interior/custom
            tail = next((i for i, x in enumerate(out) if x["name"] in ("landscape", "lighting")), len(out))
            out.insert(tail, s)
            order = {x["name"]: i for i, x in enumerate(out)}
    return out


def fail_ids(report: dict) -> set[str]:
    return {c["id"] for c in (report or {}).get("checks", []) if c["status"] == "fail"}


def new_failures(base: dict, cand: dict) -> list[dict]:
    """Failures in `cand` that the base version didn't have (a revision may never add one)."""
    old = fail_ids(base)
    return [c for c in cand.get("checks", []) if c["status"] == "fail" and c["id"] not in old]


def reading_line(comments: list[dict], instruction: str | None) -> str:
    """The first narration line: "Reading your request…", "Reading your 2 notes…", "Reading your note and your request…"."""
    n = len(comments)
    notes = (f"your {n} notes" if n > 1 else "your note") if n else ""
    what = " and ".join(x for x in (notes, "your request" if instruction else "") if x)
    return f"Reading {what or 'the design'}…"


def pseudo_request(instruction: str) -> dict:
    return {"id": "request", "text": instruction, "anchor": {}, "status": "open"}


async def snapshot_parts(comments: list[dict]) -> list:
    parts: list = []
    for c in comments[:8]:  # snapshots give the architect the view the family had
        if c.get("snapshot_url"):
            got = await blobs.get(c["snapshot_url"].removeprefix("/api/assets/"))
            if got:
                parts += [types.Part.from_text(text=f"Snapshot for comment {c['id']}:"), types.Part.from_bytes(data=got[0], mime_type=got[1])]
    return parts


def comment_brief(comments: list[dict]) -> list[dict]:
    return [{"id": c["id"], "text": c["text"], "where": {k: (c.get("anchor") or {}).get(k) for k in ("level", "room", "element_id", "kind", "label")
                                                         if (c.get("anchor") or {}).get(k)},
             **({"replies": [r.get("text") for r in c.get("replies") or []][-3:]} if c.get("replies") else {})} for c in comments]


def carry_review_notes(version: dict, plan: dict, report: dict) -> dict:
    """The architect's open review notes (review.<n> warnings) stay on the revised version unless the revision changed the
    rooms they are about, so the house never looks all-clear while they are still open."""
    notes = [c for c in (version.get("compliance") or {}).get("checks", []) if str(c.get("id", "")).startswith("review.")]
    if not notes:
        return report
    changed = changed_rooms(version.get("plan") or {}, plan)
    keep = [c for c in notes if not (changed and (not c.get("element_ids") or set(c["element_ids"]) & changed))]
    rest = [c for c in report.get("checks", []) if not str(c.get("id", "")).startswith("review.")]
    return {**report, "checks": rest + keep}


async def finalize(project: dict, version: dict, plan: dict, sections: list[dict], report: dict, changes: list[dict],
                   resolutions: dict[str, dict], comments: list[dict], instruction: str | None,
                   agent: str) -> AsyncIterator[tuple[str, dict]]:
    """Save the revised version, resolve each comment and post the resolution as a reply from Naqsha."""
    pid = project["id"]
    real = {c["id"] for c in comments}
    for ch in changes:  # the typed request isn't a comment: flag it instead of counting it
        ids = list(ch.get("comment_ids") or [])
        if "request" in ids or (instruction and not ids):
            ch["from_request"] = True
        ch["comment_ids"] = [i for i in ids if i in real]
    yield "changes", {"changes": changes}
    report = carry_review_notes(version, plan, report)
    yield "stage", {"stage": "save", "message": "Saving the revised version…"}
    fresh = await db.get_project(pid)
    n = len(fresh.get("versions") or []) + 1
    new_v = {"id": db.new_id("v_"), "n": n, "created_at": db.now(), "parent_id": version["id"], "plan": plan, "sections": sections,
             "compliance": report, "changes": changes, "status": "ready", "agent": agent,
             "source": {"comment_ids": [c["id"] for c in comments], "instruction": instruction}}
    await db.save_version(pid, new_v)
    for c in comments:
        r = resolutions.get(c["id"]) or {"status": "partial", "resolution": "I looked at this; no change was needed."}
        status = r.get("status") if r.get("status") in ("resolved", "partial", "rejected") else "partial"
        reply = {"id": db.new_id("rp_"), "author": NAQSHA, "text": r.get("resolution") or "", "created_at": db.now(),
                 "status": status, "version_id": new_v["id"]}
        await db.update_comment(pid, c["id"], status=status, resolution=r.get("resolution"), resolved_in_version=new_v["id"])
        upd = await db.add_reply(pid, c["id"], reply)
        if upd:
            yield "comment", {"comment": upd}
    req = resolutions.get("request")
    if instruction and req:
        yield "stage", {"stage": "changes", "message": req.get("resolution") or "Done."}
    src = (f"From {len(comments)} comment{'s' if len(comments) != 1 else ''}" if comments else "") + \
          ((" and your request" if comments else f"“{instruction[:60]}”") if instruction else "")
    summary = f"{src} · {_status(report)}" if src else _status(report)
    if (notes := review_note_count(report)):
        summary += f" · {notes} review note{'s' if notes != 1 else ''}"
    await db.update_project(pid, versions=(fresh.get("versions") or []) + [{"id": new_v["id"], "n": n, "created_at": new_v["created_at"],
                                                                           "status": "ready", "summary": summary}],
                            current_version_id=new_v["id"], stage="ready", brief_changed=False)
    # Comments left out of this revision (unticked, or posted while it ran) stay open: they follow the new version so they
    # can still be seen and applied. The current version moves first, so a note posted now lands on the new one anyway.
    parents = {version["id"], fresh.get("current_version_id")} - {None, new_v["id"]}
    for vid in parents:
        try:
            await db.move_open_comments(pid, vid, new_v["id"])
        except Exception:
            log.exception("moving open comments from %s failed", vid)
    yield "version", {"version": new_v}


async def revise(project: dict, version: dict, comments: list[dict], instruction: str | None = None) -> AsyncIterator[tuple[str, dict]]:
    """Single-shot revision (the safety net when the ADK agent fails)."""
    pid = project["id"]
    brief = project.get("brief") or {}
    await db.update_project(pid, stage="revising")
    yield "stage", {"stage": "changes", "message": reading_line(comments, instruction)}
    parts = await snapshot_parts(comments)
    env = lda.envelope(brief["plot"]["width_ft"], brief["plot"]["depth_ft"], brief.get("authority") or "LDA") if brief.get("plot") else {}
    env.pop("_band", None)
    sections_txt = "\n".join(f"// @section {s['name']} [{s['layer']}]\n{s['code']}// @end" for s in version["sections"])
    cm = comment_brief(comments)
    prompt = (f"HOUSE SDK REFERENCE:\n{_read(CONTRACTS / 'house-sdk.d.ts')}\n\nLDA ENVELOPE: {json.dumps(env)}\n\n"
              f"CURRENT PLAN:\n{json.dumps(version['plan'], separators=(',', ':'))}\n\nCURRENT design.js:\n{sections_txt}\n\n"
              + (f"WALKTHROUGH COMMENTS:\n{json.dumps(cm, indent=1)}\n\n" if cm else "")
              + (f"REQUEST (comment_id \"request\"): {instruction}\n\n" if instruction else "") + "Return the revision JSON now.")
    system = REVISE_SYSTEM + "\n\n" + BUILD_SYSTEM.split("Rules:")[-1]
    rev: dict = {}
    async for kind, val in llm.stream_json(config.MODEL_ARCHITECT, [types.Content(role="user", parts=parts + [types.Part.from_text(text=prompt)])],
                                           system, max_tokens=65536):
        if kind == "progress":
            yield "progress", {"chars": val}
        else:
            rev = val[0]
    changes = rev.get("changes") or []
    plan = version["plan"]
    base = lda.check(plan, brief)
    report = base
    resolutions = {r["comment_id"]: r for r in rev.get("resolutions") or [] if r.get("comment_id")}
    if rev.get("plan_ops"):
        yield "stage", {"stage": "compliance", "message": "Checking the changed layout against the LDA and livability rules…"}
        candidate, _ = prepare(apply_ops(plan, rev["plan_ops"]), brief)
        cand_report = lda.check(candidate, brief)
        broken = new_failures(base, cand_report)
        if not broken:
            plan, report = candidate, cand_report
        else:  # roll back plan edits and explain
            why = "; ".join(c["message"] for c in broken)[:400]
            for ch in changes:
                if ch.get("kind") == "plan":
                    for cid in ch.get("comment_ids", []) or ["request"]:
                        resolutions[cid] = {"comment_id": cid, "status": "rejected",
                                            "resolution": f"I couldn't make this layout change without breaking a rule: {why}"}
            changes = [ch for ch in changes if ch.get("kind") != "plan"]
        yield "plan", {"plan": plan, "attempt": 1}
        yield "compliance", {"report": report, "attempt": 1}
    sections = merge_sections(version["sections"], rev.get("sections") or [], rev.get("remove_sections") or [])
    changed = {s["name"] for s in rev.get("sections") or []}
    for i, s in enumerate(sections):
        if s["name"] in changed:
            yield "section", {"section": s, "index": i}
    async for ev in finalize(project, version, plan, sections, report, changes, resolutions, comments, instruction, "single"):
        yield ev
