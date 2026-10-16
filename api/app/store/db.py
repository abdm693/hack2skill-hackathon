"""Firestore persistence: projects and their messages, concepts, versions and comments (subcollections)."""
from __future__ import annotations

import datetime as dt
import uuid
from functools import lru_cache
from typing import Any

from google.cloud import firestore

from .. import config


@lru_cache(maxsize=1)
def fs() -> firestore.AsyncClient:
    return firestore.AsyncClient(project=config.PROJECT)


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str = "") -> str:
    return prefix + uuid.uuid4().hex[:12]


def _p(pid: str):
    return fs().collection("projects").document(pid)


async def list_projects(owner: str) -> list[dict]:
    q = fs().collection("projects").where(filter=firestore.FieldFilter("owner", "==", owner))
    docs = [d.to_dict() async for d in q.stream()]
    return sorted(docs, key=lambda d: d.get("updated_at", ""), reverse=True)


async def create_project(owner: str, name: str | None) -> dict:
    pid = new_id("p_")
    doc = {"id": pid, "owner": owner, "name": name or "Untitled home", "created_at": now(), "updated_at": now(),
           "stage": "setup", "brief": None, "envelope": None, "concepts": [], "selected_concept_id": None,
           "versions": [], "current_version_id": None, "thumbnail_url": None, "intake_complete": False}
    await _p(pid).set(doc)
    return doc


async def get_project(pid: str) -> dict | None:
    snap = await _p(pid).get()
    return snap.to_dict() if snap.exists else None


async def update_project(pid: str, **fields: Any) -> dict:
    fields["updated_at"] = now()
    await _p(pid).update(fields)
    return await get_project(pid)  # type: ignore[return-value]


async def delete_project(pid: str) -> None:
    for sub in ("messages", "versions", "comments"):
        async for d in _p(pid).collection(sub).stream():
            await d.reference.delete()
    await _p(pid).delete()


# --- messages ---------------------------------------------------------------------------------------
async def add_message(pid: str, msg: dict) -> dict:
    msg = {"id": new_id("m_"), "created_at": now(), **msg}
    await _p(pid).collection("messages").document(msg["id"]).set(msg)
    return msg


async def list_messages(pid: str) -> list[dict]:
    docs = [d.to_dict() async for d in _p(pid).collection("messages").stream()]
    return sorted(docs, key=lambda d: (d.get("created_at", ""), d.get("seq", 0)))


# --- versions -----------------------------------------------------------------------------------------
async def save_version(pid: str, version: dict) -> dict:
    await _p(pid).collection("versions").document(version["id"]).set(version)
    return version


async def get_version(pid: str, vid: str) -> dict | None:
    snap = await _p(pid).collection("versions").document(vid).get()
    return snap.to_dict() if snap.exists else None


# --- comments -----------------------------------------------------------------------------------------
async def add_comment(pid: str, comment: dict) -> dict:
    await _p(pid).collection("comments").document(comment["id"]).set(comment)
    return comment


async def list_comments(pid: str, version_id: str | None = None) -> list[dict]:
    col = _p(pid).collection("comments")
    q = col.where(filter=firestore.FieldFilter("version_id", "==", version_id)) if version_id else col
    docs = [d.to_dict() async for d in q.stream()]
    return sorted(docs, key=lambda d: d.get("created_at", ""))


async def update_comment(pid: str, cid: str, **fields: Any) -> dict | None:
    ref = _p(pid).collection("comments").document(cid)
    await ref.update(fields)
    snap = await ref.get()
    return snap.to_dict() if snap.exists else None


async def delete_comment(pid: str, cid: str) -> None:
    await _p(pid).collection("comments").document(cid).delete()


# --- samples & cloning ------------------------------------------------------------------------------
SAMPLES_OWNER = "samples"


async def clone_project(src_pid: str, owner: str, name: str | None = None) -> dict:
    """Copy a project (and its messages, versions, comments) into another workspace. Assets stay shared (read-only)."""
    src = await get_project(src_pid)
    if not src:
        raise KeyError(src_pid)
    pid = new_id("p_")
    doc = {**src, "id": pid, "owner": owner, "name": name or src["name"], "created_at": now(), "updated_at": now(),
           "cloned_from": src_pid}
    await _p(pid).set(doc)
    for sub in ("messages", "versions", "comments"):
        async for d in _p(src_pid).collection(sub).stream():
            await _p(pid).collection(sub).document(d.id).set(d.to_dict())
    return doc
