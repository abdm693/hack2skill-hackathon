"""The architect's self-review bookkeeping (BE-08), the build that starts during the review (BE-26), and open comments that
follow a new version (BE-11). No model calls."""
import asyncio
import copy
import re

from app.agents import architect, reviser
from app.compliance import lda
from app.store import db


def test_review_issues_become_plain_warnings(plans):
    plan = plans["example"]
    issues = [{"severity": "major", "rooms": ["f_bath2", "f_bed2"], "problem": "f_bath2 is cramped next to f_bed2_door.",
               "fix": "Widen f_bath2 by 1 ft."},
              {"severity": "minor", "rooms": [], "problem": "The lounge could take a wider window."}]
    rep = architect.with_review(lda.check(plan), issues, plan)
    notes = [c for c in rep["checks"] if c["id"].startswith("review.")]
    assert [c["id"] for c in notes] == ["review.1", "review.2"]
    assert all(c["status"] == "warn" and c["category"] == "livable" for c in notes)
    assert not re.search(r"\b[gf]_[a-z0-9_]+", notes[0]["message"]), notes[0]["message"]
    assert "Bath 2" in notes[0]["message"] and notes[0]["element_ids"] == ["f_bath2", "f_bed2"]
    assert architect.review_note_count(rep) == 2
    assert rep["ok"] == lda.check(plan)["ok"]              # warnings never turn a passing plan into a failing one
    # applying the review again replaces the notes instead of piling them up
    assert architect.review_note_count(architect.with_review(rep, issues[:1], plan)) == 1


def test_a_revision_counts_only_if_it_touches_a_major_issue(plans):
    plan = plans["example"]
    same = copy.deepcopy(plan)
    assert architect.changed_rooms(plan, same) == set()
    moved = copy.deepcopy(plan)
    next(o for o in moved["openings"] if o["id"] == "f_bath2_v")["width_ft"] = 2.5
    changed = architect.changed_rooms(plan, moved)
    assert changed == {"f_bath2"}
    major = {"severity": "major", "rooms": ["f_bath2"], "problem": "x"}
    other = {"severity": "major", "rooms": ["g_kitchen"], "problem": "y"}
    assert architect.addresses(major, changed) and not architect.addresses(other, changed)
    assert architect.addresses({"severity": "major", "problem": "z"}, changed)        # no rooms named: any change
    assert not architect.addresses({"severity": "major", "problem": "z"}, set())


def test_background_buffers_events_until_followed():
    async def gen():
        yield "stage", {"stage": "build"}
        await asyncio.sleep(0)
        yield "section", {"index": 0}
        yield "_result", {"sections": [1]}

    async def go():
        bg = architect.Background(gen())
        await asyncio.sleep(0.01)            # it runs before anyone follows
        assert bg.task.done()
        return [ev async for ev in bg.follow()]
    evs = asyncio.run(go())
    assert [e for e, _ in evs] == ["stage", "section", "_result"]

    async def boom():
        yield "stage", {}
        raise RuntimeError("stalled")

    async def go2():
        out = []
        try:
            async for ev in architect.Background(boom()).follow():
                out.append(ev)
        except RuntimeError as e:
            out.append(str(e))
        return out
    assert asyncio.run(go2())[-1] == "stalled"


def test_finalize_moves_open_comments_to_the_new_version(monkeypatch):
    moved, comments = [], {"c1": {"id": "c1", "status": "open"}, "c2": {"id": "c2", "status": "open"}}

    async def get_project(pid):
        return {"id": pid, "versions": [{"id": "v1", "n": 1}], "current_version_id": "v1"}

    async def save_version(pid, v):
        return v

    async def update_comment(pid, cid, **f):
        comments[cid].update(f)
        return comments[cid]

    async def add_reply(pid, cid, r):
        return {**comments[cid], "replies": [r]}

    async def update_project(pid, **f):
        return f

    async def move_open_comments(pid, a, b):
        moved.append((a, b))
        return 1
    for name, fn in (("get_project", get_project), ("save_version", save_version), ("update_comment", update_comment),
                     ("add_reply", add_reply), ("update_project", update_project), ("move_open_comments", move_open_comments)):
        monkeypatch.setattr(db, name, fn)

    async def go():
        return [ev async for ev in reviser.finalize({"id": "p1"}, {"id": "v1", "plan": {}}, {}, [], {"checks": []}, [],
                                                     {"c1": {"status": "resolved", "resolution": "Done."}}, [comments["c1"]],
                                                     None, "adk")]
    evs = asyncio.run(go())
    new_vid = next(d["version"]["id"] for e, d in evs if e == "version")
    assert moved == [("v1", new_vid)]
    assert comments["c1"]["status"] == "resolved" and comments["c2"]["status"] == "open"


def test_revisions_keep_review_notes_about_untouched_rooms(plans):
    plan = plans["example"]
    issues = [{"severity": "major", "rooms": ["f_bath2"], "problem": "Bath 2 is cramped."},
              {"severity": "minor", "rooms": ["g_kitchen"], "problem": "The kitchen window is small."}]
    v = {"plan": plan, "compliance": architect.with_review(lda.check(plan), issues, plan)}
    moved = copy.deepcopy(plan)
    next(o for o in moved["openings"] if o["id"] == "f_bath2_v")["width_ft"] = 2.5
    rep = reviser.carry_review_notes(v, moved, lda.check(moved))
    notes = [c for c in rep["checks"] if c["id"].startswith("review.")]
    assert [c["element_ids"] for c in notes] == [["g_kitchen"]]


def test_example_is_what_the_planner_copies(plans):
    """The few-shot example every plan starts from: every bath has a ventilator on its own outside wall."""
    rep = lda.check(plans["example"])
    vents = [c for c in rep["checks"] if c["id"].startswith("room.vent")]
    assert vents and all(c["status"] == "pass" for c in vents)
