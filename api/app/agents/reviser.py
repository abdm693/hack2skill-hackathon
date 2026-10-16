"""Revision agent: walkthrough comments → plan edits + code-section edits → LDA re-check → new Version.

Argon receives the current plan, the design.js sections, every comment (text + 3D anchor: room/element/level + snapshot
image) and the LDA envelope. It returns a change list, plan operations, replaced sections and a per-comment resolution.
Plan edits are re-checked; if they break LDA rules Argon gets one repair round, otherwise the plan edits are rolled back and
the affected comments are explained as rejected with the rule they would break.
"""
from __future__ import annotations

import copy
import json
from typing import AsyncIterator

from google.genai import types

from .. import config, llm
from ..compliance import lda
from ..gemini import client
from ..store import blobs, db
from .architect import BUILD_SYSTEM, CONTRACTS, SectionStream, _read

REVISE_SYSTEM = """You are Naqsha's architect, revising a house design after the family's 3D walkthrough. Each comment is pinned
to a spot in the 3D model (room, element, level) and comes with a snapshot of what they were looking at.

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
                   "resolution": "One or two friendly sentences: what changed, or why not (cite the LDA rule) and the alternative."}]
}

Rules:
- Address EVERY comment with exactly one resolution.
- Prefer the smallest change that satisfies the comment. Keep everything else identical.
- Layout changes (room sizes, adding or moving doors and windows, new rooms) are plan_ops. Plan changes must keep LDA compliance:
  setbacks/envelope, coverage, height, storeys, room minimums, daylight 8%, stairs. If a request would break a rule, do NOT do it.
  Mark it "rejected" (or "partial" with a compliant alternative) and name the rule.
- Visual changes (materials, colours, furniture, facade details, lighting) replace the relevant design.js sections.
- If you change a room's size or position, also replace its furnish_<room_id> section so the furniture fits.
- The `structure` section rebuilds walls, openings, stairs and slabs from the plan automatically. Only replace it to change
  structural materials.
- Section code follows the design.js rules (House SDK only, plan feet, no forbidden APIs)."""


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


async def revise(project: dict, version: dict, comments: list[dict]) -> AsyncIterator[tuple[str, dict]]:
    pid = project["id"]
    await db.update_project(pid, stage="revising")
    yield "stage", {"stage": "changes", "message": f"Argon is reading your {len(comments)} comment(s)…"}

    parts: list = []
    for c in comments[:8]:  # snapshots give Argon the view the family had
        if c.get("snapshot_url"):
            got = await blobs.get(c["snapshot_url"].removeprefix("/api/assets/"))
            if got:
                parts += [types.Part.from_text(text=f"Snapshot for comment {c['id']}:"), types.Part.from_bytes(data=got[0], mime_type=got[1])]
    brief = project.get("brief") or {}
    env = lda.envelope(brief["plot"]["width_ft"], brief["plot"]["depth_ft"], brief.get("authority") or "LDA") if brief.get("plot") else {}
    env.pop("_band", None)
    sections_txt = "\n".join(f"// @section {s['name']} [{s['layer']}]\n{s['code']}// @end" for s in version["sections"])
    cm = [{"id": c["id"], "text": c["text"], "where": {k: c["anchor"].get(k) for k in ("level", "room", "element_id", "kind", "label")}}
          for c in comments]
    prompt = (f"HOUSE SDK REFERENCE:\n{_read(CONTRACTS / 'house-sdk.d.ts')}\n\nPLAN TYPES:\n{_read(CONTRACTS / 'plan.ts')}\n\n"
              f"LDA ENVELOPE: {json.dumps(env)}\n\nCURRENT PLAN:\n{json.dumps(version['plan'])}\n\n"
              f"CURRENT design.js:\n{sections_txt}\n\nWALKTHROUGH COMMENTS:\n{json.dumps(cm, indent=1)}\n\nReturn the revision JSON now.")
    system = REVISE_SYSTEM + "\n\n" + BUILD_SYSTEM.split("Rules:")[-1]
    rev: dict = {}
    async for kind, val in llm.stream_json(config.MODEL_ARCHITECT, [types.Content(role="user", parts=parts + [types.Part.from_text(text=prompt)])],
                                           system, max_tokens=65536):
        if kind == "progress":
            yield "progress", {"chars": val}
        else:
            rev = val[0]
    changes = rev.get("changes") or []
    yield "changes", {"changes": changes}

    plan, report = version["plan"], version.get("compliance")
    resolutions = {r["comment_id"]: r for r in rev.get("resolutions") or []}
    if rev.get("plan_ops"):
        yield "stage", {"stage": "compliance", "message": "Re-checking the revised plan against LDA rules…"}
        candidate = apply_ops(plan, rev["plan_ops"])
        cand_report = lda.check(candidate)
        if not cand_report["ok"]:
            yield "stage", {"stage": "fix", "message": "A change broke an LDA rule; Argon is repairing it…"}
            fix_prompt = ("Your plan edits produced these LDA problems:\n" + lda.violations_text(cand_report) +
                          "\n\nReturn the corrected COMPLETE BuildingPlan JSON (keep the family's intent where the rules allow).\n"
                          f"PLAN:\n{json.dumps(candidate)}")
            try:
                async for kind, val in llm.stream_json(config.MODEL_ARCHITECT, fix_prompt, REVISE_SYSTEM, max_tokens=32768):
                    if kind == "result":
                        candidate = val[0]
                cand_report = lda.check(candidate)
            except Exception:
                pass
        if cand_report["ok"]:
            plan, report = candidate, cand_report
        else:  # roll back plan edits and explain
            for ch in changes:
                if ch.get("kind") == "plan":
                    for cid in ch.get("comment_ids", []):
                        resolutions[cid] = {"comment_id": cid, "status": "rejected",
                                            "resolution": "This layout change would break LDA rules: " + "; ".join(
                                                c["message"] for c in cand_report["checks"] if c["status"] == "fail")[:400]}
        yield "plan", {"plan": plan, "attempt": 1}
        yield "compliance", {"report": report, "attempt": 1}

    sections = merge_sections(version["sections"], rev.get("sections") or [], rev.get("remove_sections") or [])
    changed = {s["name"] for s in rev.get("sections") or []}
    for i, s in enumerate(sections):
        if s["name"] in changed:
            yield "section", {"section": s, "index": i}

    yield "stage", {"stage": "save", "message": "Saving the revised version…"}
    fresh = await db.get_project(pid)
    n = len(fresh.get("versions") or []) + 1
    new_v = {"id": db.new_id("v_"), "n": n, "created_at": db.now(), "parent_id": version["id"], "plan": plan, "sections": sections,
             "compliance": report, "changes": changes, "status": "ready"}
    await db.save_version(pid, new_v)
    for c in comments:
        r = resolutions.get(c["id"]) or {"status": "partial", "resolution": "Reviewed; no specific change was needed."}
        upd = await db.update_comment(pid, c["id"], status=r.get("status", "resolved"), resolution=r.get("resolution"),
                                      resolved_in_version=new_v["id"])
        if upd:
            yield "comment", {"comment": upd}
    summary = "; ".join(ch.get("summary", "") for ch in changes)[:200] or "Revision"
    await db.update_project(pid, versions=(fresh.get("versions") or []) + [{"id": new_v["id"], "n": n, "created_at": new_v["created_at"],
                                                                           "status": "ready", "summary": summary}],
                            current_version_id=new_v["id"], stage="ready")
    yield "version", {"version": new_v}
