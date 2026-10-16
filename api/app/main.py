"""Naqsha API: FastAPI app that serves /api/* and the built SPA (web/dist) from one Cloud Run service.

The contract is in contracts/api.md.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, runs, sse
from .agents import architect, concepts, intake, reviser, reviser_adk
from .compliance import lda
from .store import blobs, db

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Naqsha API")

PUBLIC_FIELDS = ("id", "name", "created_at", "updated_at", "stage", "brief", "envelope", "concepts", "selected_concept_id",
                 "versions", "current_version_id", "thumbnail_url")


def public(p: dict) -> dict:
    return {k: p.get(k) for k in PUBLIC_FIELDS}


async def owned(pid: str, user: str | None) -> dict:
    p = await db.get_project(pid)
    if not p or (user and p.get("owner") != user):
        raise HTTPException(404, "project not found")
    return p


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception):
    logging.exception("unhandled")
    return JSONResponse({"detail": f"{type(exc).__name__}: {exc}"}, status_code=500)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "models": {"intake": config.MODEL_INTAKE, "architect": config.MODEL_ARCHITECT, "image": config.MODEL_IMAGE}}


# --- projects --------------------------------------------------------------------------------------------
class NewProject(BaseModel):
    name: str | None = None


class PatchProject(BaseModel):
    name: str | None = None
    brief: dict | None = None


@app.get("/api/projects")
async def list_projects(x_naqsha_user: str = Header("anon")):
    return {"projects": [public(p) for p in await db.list_projects(x_naqsha_user)]}


@app.post("/api/projects")
async def create_project(body: NewProject, x_naqsha_user: str = Header("anon")):
    return public(await db.create_project(x_naqsha_user, body.name))


@app.get("/api/projects/{pid}")
async def get_project(pid: str, x_naqsha_user: str = Header("anon")):
    return public(await owned(pid, x_naqsha_user))


@app.patch("/api/projects/{pid}")
async def patch_project(pid: str, body: PatchProject, x_naqsha_user: str = Header("anon")):
    p = await owned(pid, x_naqsha_user)
    fields: dict = {}
    if body.name is not None:
        fields["name"] = body.name
    if body.brief is not None:
        brief = intake.merge_brief(p.get("brief") or intake.empty_brief(), body.brief, [])
        fields.update(brief=brief, envelope=intake.envelope_for(brief))
    return public(await db.update_project(pid, **fields) if fields else p)


@app.delete("/api/projects/{pid}")
async def delete_project(pid: str, x_naqsha_user: str = Header("anon")):
    await owned(pid, x_naqsha_user)
    await db.delete_project(pid)
    return {"ok": True}


# --- setup agent -------------------------------------------------------------------------------------------
class IntakeBody(BaseModel):
    message: str | None = None
    action: str | None = None  # start | skip_question | skip_all
    chips: list[str] | None = None


@app.get("/api/projects/{pid}/messages")
async def messages(pid: str, x_naqsha_user: str = Header("anon")):
    await owned(pid, x_naqsha_user)
    return {"messages": await db.list_messages(pid)}


@app.post("/api/projects/{pid}/intake")
async def intake_turn(pid: str, body: IntakeBody, x_naqsha_user: str = Header("anon")):
    p = await owned(pid, x_naqsha_user)
    return sse.stream(intake.run_turn(p, body.message, body.action, body.chips))


# --- LDA --------------------------------------------------------------------------------------------------
@app.get("/api/lda/envelope")
def lda_envelope(width_ft: float, depth_ft: float, authority: str = "LDA", corner: bool = False):
    env = lda.envelope(width_ft, depth_ft, authority, corner)
    env.pop("_band", None)
    return env


class CheckBody(BaseModel):
    plan: dict


@app.post("/api/lda/check")
def lda_check(body: CheckBody):
    return lda.check(body.plan)


# --- concepts ---------------------------------------------------------------------------------------------
class ConceptBody(BaseModel):
    count: int = 4
    instruction: str | None = None
    base_concept_id: str | None = None


@app.post("/api/projects/{pid}/concepts")
async def make_concepts(pid: str, body: ConceptBody, x_naqsha_user: str = Header("anon")):
    p = await owned(pid, x_naqsha_user)
    if not p.get("brief"):
        raise HTTPException(400, "finish the setup first")
    return sse.stream(concepts.generate(p, max(1, min(4, body.count)), body.instruction, body.base_concept_id))


@app.post("/api/projects/{pid}/concepts/{cid}/select")
async def select_concept(pid: str, cid: str, x_naqsha_user: str = Header("anon")):
    p = await owned(pid, x_naqsha_user)
    c = next((c for c in p.get("concepts", []) if c["id"] == cid), None)
    if not c:
        raise HTTPException(404, "concept not found")
    return public(await db.update_project(pid, selected_concept_id=cid, thumbnail_url=c["url"]))


# --- design (Argon) ----------------------------------------------------------------------------------------
@app.post("/api/projects/{pid}/design")
async def design(pid: str, x_naqsha_user: str = Header("anon")):
    p = await owned(pid, x_naqsha_user)
    if not p.get("brief"):
        raise HTTPException(400, "finish the setup first")
    if (run := runs.active(pid, "design")):  # already designing: attach and replay instead of starting over
        return sse.stream(run.follow())
    if not (p.get("brief") or {}).get("plot"):
        brief, _ = intake.defaults_for(p["brief"])
        p = await db.update_project(pid, brief=brief, envelope=intake.envelope_for(brief))
    return sse.stream(runs.start(pid, "design", lambda: architect.design(p)).follow())


@app.get("/api/projects/{pid}/run")
async def attach_run(pid: str, x_naqsha_user: str = Header("anon")):
    """Re-attach to a running design/revise pipeline (replays all events so far). 204 when nothing is running."""
    await owned(pid, x_naqsha_user)
    run = runs.active(pid)
    if not run:
        return Response(status_code=204)
    return sse.stream(run.follow())


@app.get("/api/projects/{pid}/versions/{vid}")
async def get_version(pid: str, vid: str, x_naqsha_user: str = Header("anon")):
    await owned(pid, x_naqsha_user)
    v = await db.get_version(pid, vid)
    if not v:
        raise HTTPException(404, "version not found")
    return v


class RepairBody(BaseModel):
    section: str
    error: str


@app.post("/api/projects/{pid}/versions/{vid}/repair")
async def repair(pid: str, vid: str, body: RepairBody, x_naqsha_user: str = Header("anon")):
    p = await owned(pid, x_naqsha_user)
    v = await db.get_version(pid, vid)
    if not v:
        raise HTTPException(404, "version not found")

    async def gen():
        fixed = await architect.repair_section(p, v, body.section, body.error)
        v["sections"] = [fixed if s["name"] == body.section else s for s in v["sections"]]
        await db.save_version(pid, v)
        idx = next(i for i, s in enumerate(v["sections"]) if s["name"] == body.section)
        yield "section", {"section": fixed, "index": idx}
    return sse.stream(gen())


class ThumbBody(BaseModel):
    image_data_url: str


@app.post("/api/projects/{pid}/versions/{vid}/thumbnail")
async def version_thumbnail(pid: str, vid: str, body: ThumbBody, x_naqsha_user: str = Header("anon")):
    """Store a viewport capture as the version's (and project's) thumbnail."""
    await owned(pid, x_naqsha_user)
    v = await db.get_version(pid, vid)
    if not v:
        raise HTTPException(404, "version not found")
    data, mime = blobs.decode_data_url(body.image_data_url)
    url = await blobs.put(f"projects/{pid}/versions/{vid}.{'jpg' if 'jpeg' in mime else 'png'}", data, mime)
    v["thumbnail_url"] = url
    await db.save_version(pid, v)
    await db.update_project(pid, thumbnail_url=url)
    return {"url": url}


class AsBuiltBody(BaseModel):
    summary: dict


@app.post("/api/projects/{pid}/versions/{vid}/asbuilt")
async def asbuilt(pid: str, vid: str, body: AsBuiltBody, x_naqsha_user: str = Header("anon")):
    await owned(pid, x_naqsha_user)
    v = await db.get_version(pid, vid)
    if not v:
        raise HTTPException(404, "version not found")
    return lda.check_asbuilt(v["plan"], body.summary)


# --- comments -----------------------------------------------------------------------------------------------
class CommentBody(BaseModel):
    version_id: str
    text: str
    anchor: dict
    camera: dict
    snapshot_data_url: str | None = None


class CommentPatch(BaseModel):
    text: str | None = None
    status: str | None = None


@app.get("/api/projects/{pid}/comments")
async def list_comments(pid: str, version_id: str | None = None, x_naqsha_user: str = Header("anon")):
    await owned(pid, x_naqsha_user)
    return {"comments": await db.list_comments(pid, version_id)}


@app.post("/api/projects/{pid}/comments")
async def add_comment(pid: str, body: CommentBody, x_naqsha_user: str = Header("anon")):
    await owned(pid, x_naqsha_user)
    cid = db.new_id("cm_")
    snap = None
    if body.snapshot_data_url:
        data, mime = blobs.decode_data_url(body.snapshot_data_url)
        snap = await blobs.put(f"projects/{pid}/comments/{cid}.{'jpg' if 'jpeg' in mime else 'png'}", data, mime)
    return await db.add_comment(pid, {"id": cid, "version_id": body.version_id, "text": body.text, "anchor": body.anchor,
                                      "camera": body.camera, "snapshot_url": snap, "created_at": db.now(), "status": "open"})


@app.patch("/api/projects/{pid}/comments/{cid}")
async def patch_comment(pid: str, cid: str, body: CommentPatch, x_naqsha_user: str = Header("anon")):
    await owned(pid, x_naqsha_user)
    c = await db.update_comment(pid, cid, **body.model_dump(exclude_none=True))
    if not c:
        raise HTTPException(404, "comment not found")
    return c


@app.delete("/api/projects/{pid}/comments/{cid}")
async def delete_comment(pid: str, cid: str, x_naqsha_user: str = Header("anon")):
    await owned(pid, x_naqsha_user)
    await db.delete_comment(pid, cid)
    return {"ok": True}


# --- revise (walkthrough → new version) ----------------------------------------------------------------------
class ReviseBody(BaseModel):
    version_id: str
    comment_ids: list[str] | None = None


@app.post("/api/projects/{pid}/revise")
async def revise(pid: str, body: ReviseBody, x_naqsha_user: str = Header("anon")):
    p = await owned(pid, x_naqsha_user)
    v = await db.get_version(pid, body.version_id)
    if not v:
        raise HTTPException(404, "version not found")
    comments = [c for c in await db.list_comments(pid, body.version_id) if c.get("status") == "open"]
    if body.comment_ids:
        comments = [c for c in comments if c["id"] in set(body.comment_ids)]
    if not comments:
        raise HTTPException(400, "no open comments to address")
    if (run := runs.active(pid, "revise")):
        return sse.stream(run.follow())

    async def gen():
        try:  # agentic ADK reviser first; the single-shot reviser is the safety net (ADK writes nothing until it finishes)
            async for ev in reviser_adk.revise(p, v, comments):
                yield ev
        except Exception as e:
            logging.exception("ADK reviser failed; falling back")
            yield "stage", {"stage": "changes", "message": f"Retrying with the direct reviser ({type(e).__name__})…"}
            async for ev in reviser.revise(p, v, comments):
                yield ev
    return sse.stream(runs.start(pid, "revise", gen).follow())


# --- AI render of the current viewport -------------------------------------------------------------------------
class RenderBody(BaseModel):
    image_data_url: str
    prompt: str | None = None
    version_id: str | None = None


@app.post("/api/projects/{pid}/render")
async def render(pid: str, body: RenderBody, x_naqsha_user: str = Header("anon")):
    await owned(pid, x_naqsha_user)
    data, mime = blobs.decode_data_url(body.image_data_url)
    return {"url": await concepts.render_view(pid, data, mime, body.prompt)}


# --- assets (GCS proxy) ------------------------------------------------------------------------------------------
@app.get("/api/assets/{path:path}")
async def asset(path: str):
    got = await blobs.get(path)
    if not got:
        raise HTTPException(404, "not found")
    return Response(content=got[0], media_type=got[1], headers={"Cache-Control": "public, max-age=31536000, immutable"})


# --- SPA (built web app) -------------------------------------------------------------------------------------------
WEB_DIST = Path(os.environ.get("WEB_DIST", Path(__file__).resolve().parents[2] / "web" / "dist"))
if WEB_DIST.exists():
    if (WEB_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = WEB_DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(WEB_DIST / "index.html")
