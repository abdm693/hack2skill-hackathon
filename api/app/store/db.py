"""Firestore persistence: projects and their messages, concepts, versions and comments (subcollections).

Collaboration lives on the project document:
- `owner`: a guest id or "user:<uid>";
- `members`: [{email, uid?, name?, role: "team" | "client", status: "active" | "invited", invited_at}];
- `member_uids` / `member_emails`: flat copies for array-contains queries (the workspace, invite resolution);
- `share_enabled` / `share_token`: the client link.
"""
from __future__ import annotations

import datetime as dt
import secrets
import time
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


async def _query(field: str, op: str, value) -> list[dict]:
    q = fs().collection("projects").where(filter=firestore.FieldFilter(field, op, value))
    return [d.to_dict() async for d in q.stream()]


async def list_projects(owner: str) -> list[dict]:
    docs = await _query("owner", "==", owner)
    return sorted(docs, key=lambda d: d.get("updated_at", ""), reverse=True)


async def list_member_projects(uid: str) -> list[dict]:
    return await _query("member_uids", "array_contains", uid)


async def create_project(owner: str, name: str | None) -> dict:
    pid = new_id("p_")
    doc = {"id": pid, "owner": owner, "name": name or "Untitled home", "created_at": now(), "updated_at": now(),
           "stage": "setup", "brief": None, "envelope": None, "concepts": [], "selected_concept_id": None,
           "versions": [], "current_version_id": None, "thumbnail_url": None, "intake_complete": False,
           "members": [], "member_uids": [], "member_emails": [], "share_enabled": False, "share_token": None}
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


# --- members, invites, sharing ----------------------------------------------------------------------------------------
def _flat(members: list[dict]) -> dict:
    return {"members": members, "member_uids": sorted({m["uid"] for m in members if m.get("uid") and m.get("status") == "active"}),
            "member_emails": sorted({m["email"] for m in members if m.get("email")})}


async def set_members(pid: str, members: list[dict]) -> dict:
    return await update_project(pid, **_flat(members))


async def resolve_invites(email: str | None, uid: str, name: str | None = None) -> int:
    """When someone signs in, every invite to their email becomes an active membership."""
    if not email:
        return 0
    n = 0
    for p in await _query("member_emails", "array_contains", email.lower()):
        members = p.get("members") or []
        changed = False
        for m in members:
            if m.get("email") == email.lower() and (m.get("status") != "active" or m.get("uid") != uid):
                m.update(status="active", uid=uid, name=m.get("name") or name, joined_at=m.get("joined_at") or now())
                changed = True
        if changed:
            await _p(p["id"]).update(_flat(members))
            n += 1
    return n


async def find_by_share_token(token: str) -> dict | None:
    if not token or len(token) < 12:
        return None
    docs = await _query("share_token", "==", token)
    return next((d for d in docs if d.get("share_enabled")), None)


def new_share_token() -> str:
    return secrets.token_urlsafe(18)


async def claim_projects(guest_id: str, owner_key: str, uid: str) -> int:
    """Move a guest's projects (and their comment authorship) to a signed-in account."""
    moved = 0
    for p in await _query("owner", "==", guest_id):
        await _p(p["id"]).update({"owner": owner_key, "claimed_from": guest_id, "updated_at": now()})
        async for d in _p(p["id"]).collection("comments").stream():
            c = d.to_dict()
            changed = False
            if (c.get("author") or {}).get("id") == guest_id:
                c["author"]["id"] = uid
                changed = True
            for r in c.get("replies") or []:
                if (r.get("author") or {}).get("id") == guest_id:
                    r["author"]["id"] = uid
                    changed = True
            if changed:
                await d.reference.set(c)
        moved += 1
    return moved


# --- messages ---------------------------------------------------------------------------------------
async def add_message(pid: str, msg: dict) -> dict:
    msg = {"id": new_id("m_"), "created_at": now(), "seq": time.time_ns(), **msg}
    msg = {k: v for k, v in msg.items() if v is not None}
    await _p(pid).collection("messages").document(msg["id"]).set(msg)
    return msg


async def list_messages(pid: str) -> list[dict]:
    docs = [d.to_dict() async for d in _p(pid).collection("messages").stream()]
    return sorted(docs, key=lambda d: (d.get("seq") or 0, d.get("created_at", ""), d.get("role") != "user")
                  if all(x.get("seq") for x in docs) else (d.get("created_at", ""), d.get("role") != "user"))


# --- versions -----------------------------------------------------------------------------------------
async def save_version(pid: str, version: dict) -> dict:
    await _p(pid).collection("versions").document(version["id"]).set(version)
    return version


async def get_version(pid: str, vid: str) -> dict | None:
    snap = await _p(pid).collection("versions").document(vid).get()
    return snap.to_dict() if snap.exists else None


# --- comments -----------------------------------------------------------------------------------------
async def add_comment(pid: str, comment: dict) -> dict:
    comment.setdefault("replies", [])
    await _p(pid).collection("comments").document(comment["id"]).set(comment)
    return comment


async def get_comment(pid: str, cid: str) -> dict | None:
    snap = await _p(pid).collection("comments").document(cid).get()
    return snap.to_dict() if snap.exists else None


async def list_comments(pid: str, version_id: str | None = None) -> list[dict]:
    col = _p(pid).collection("comments")
    q = col.where(filter=firestore.FieldFilter("version_id", "==", version_id)) if version_id else col
    docs = [d.to_dict() async for d in q.stream()]
    for d in docs:
        d.setdefault("replies", [])
    return sorted(docs, key=lambda d: d.get("created_at", ""))


async def update_comment(pid: str, cid: str, **fields: Any) -> dict | None:
    ref = _p(pid).collection("comments").document(cid)
    snap = await ref.get()
    if not snap.exists:
        return None
    await ref.update(fields)
    snap = await ref.get()
    d = snap.to_dict()
    d.setdefault("replies", [])
    return d


async def add_reply(pid: str, cid: str, reply: dict) -> dict | None:
    ref = _p(pid).collection("comments").document(cid)
    snap = await ref.get()
    if not snap.exists:
        return None
    await ref.update({"replies": firestore.ArrayUnion([reply])})
    d = (await ref.get()).to_dict()
    d.setdefault("replies", [])
    return d


async def delete_comment(pid: str, cid: str) -> None:
    await _p(pid).collection("comments").document(cid).delete()


# --- samples & cloning ------------------------------------------------------------------------------
SAMPLES_OWNER = "samples"


async def find_clone(owner: str, src_pid: str) -> dict | None:
    """The caller's existing copy of a project (samples are copied once, not on every visit)."""
    return next((p for p in await list_projects(owner) if p.get("cloned_from") == src_pid), None)


async def clone_project(src_pid: str, owner: str, name: str | None = None) -> dict:
    """Copy a project (and its messages, versions, comments) into another workspace. Assets stay shared (read-only)."""
    src = await get_project(src_pid)
    if not src:
        raise KeyError(src_pid)
    pid = new_id("p_")
    doc = {**src, "id": pid, "owner": owner, "name": name or src["name"], "created_at": now(), "updated_at": now(),
           "cloned_from": src_pid, "members": [], "member_uids": [], "member_emails": [], "share_enabled": False,
           "share_token": None}
    await _p(pid).set(doc)
    for sub in ("messages", "versions", "comments"):
        async for d in _p(src_pid).collection(sub).stream():
            await _p(pid).collection(sub).document(d.id).set(d.to_dict())
    return doc
