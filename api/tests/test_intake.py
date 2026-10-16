"""The setup conversation's deterministic parts: the question bank, widget answers, "Don't assume", storeys within the
authority, rooms on every floor, preferences that can be removed, and the auto name. The model is never called here."""
import asyncio

import pytest

from app.agents import intake
from app.store import db


def run(coro):
    return asyncio.run(coro)


class Msgs:
    """messages + project patching, in memory."""

    def __init__(self, monkeypatch):
        self.msgs, self.patched = [], {}
        monkeypatch.setattr(db, "list_messages", self.list_messages)
        monkeypatch.setattr(db, "add_message", self.add_message)
        monkeypatch.setattr(db, "put_message", self.put_message)
        monkeypatch.setattr(db, "patch_project", self.patch_project)

    async def list_messages(self, pid):
        return list(self.msgs)

    async def add_message(self, pid, m):
        m = db.make_message(m)
        self.msgs.append(m)
        return m

    async def put_message(self, pid, m):
        self.msgs.append(m)
        return m

    async def patch_project(self, pid, **f):
        self.patched.update(f)
        return f


def turn(project, message=None, action=None, chips=None):
    async def go():
        return [ev async for ev in intake.run_turn(project, message, action, chips)]
    return run(go())


def last_msg(evs):
    return [d for e, d in evs if e == "message" and d.get("role") == "assistant"][-1]


def brief_of(evs):
    return [d for e, d in evs if e == "brief"][-1]["brief"]


def full_brief(**kw):
    b = intake.empty_brief()
    b.update(authority="LDA", plot={"width_ft": 35, "depth_ft": 65, "area_marla": 10.1, "corner": False}, corner_stated=True,
             facing="N", storeys=2, bedrooms=4, bathrooms=5, spaces=["drawing", "kitchen"], style="Modern Contemporary",
             water_tank="concrete", solar="ready", floors=[{"level": "ground", "rooms": ["drawing", "kitchen"]},
                                                           {"level": "first", "rooms": ["bedroom:3", "bath:3"]}])
    b.update(kw)
    return b


# --- BE-12: storeys within the authority ------------------------------------------------------------------------------------------
def test_dha_storeys_are_capped_with_a_reason():
    q = intake.question("storeys", {"authority": "DHA"})
    assert [c["value"] for c in q["chips"]] == ["storeys:1", "storeys:2"]
    assert q["chips"][-1]["hint"] == "DHA allows ground + first, plus a basement"
    lq = intake.question("storeys", {"authority": "LDA", "plot": {"width_ft": 35, "depth_ft": 65, "area_marla": 10.1}})
    assert [c["value"] for c in lq["chips"]][-1] == "storeys:3" and "LDA" in lq["chips"][-1]["hint"]
    b, said = intake.clamp_storeys({"authority": "DHA", "storeys": 3, "floors": [
        {"level": "ground", "rooms": ["drawing"]}, {"level": "first", "rooms": ["bedroom:2"]}, {"level": "second", "rooms": ["bedroom:1"]}]})
    assert b["storeys"] == 2 and said.startswith("DHA allows ground + first, plus a basement, so I've kept it to 2 storeys.")
    assert [f["level"] for f in b["floors"]] == ["ground", "first"] and "bedroom:1" in b["floors"][1]["rooms"]
    assert intake.clamp_storeys({"authority": "LDA", "storeys": 3, "plot": {"width_ft": 35, "depth_ft": 65, "area_marla": 10.1}})[1] is None


def test_dha_storeys_chip_is_clamped_in_the_turn(monkeypatch):
    m = Msgs(monkeypatch)
    p = {"id": "p1", "name": "Untitled home", "brief": {**intake.empty_brief(), "authority": "DHA",
                                                        "plot": {"width_ft": 35, "depth_ft": 65, "area_marla": 10.1, "corner": False}}}
    evs = turn(p, chips=["storeys:3"])
    assert brief_of(evs)["storeys"] == 2
    assert last_msg(evs)["text"].startswith("DHA allows ground + first")
    assert m.patched["brief"]["storeys"] == 2


# --- BE-13: an added storey needs its rooms -----------------------------------------------------------------------------------------
def test_new_storey_without_rooms_keeps_setup_open():
    b = full_brief(storeys=3)
    assert intake.floors_missing(b) == ["second"]
    assert "floors" in intake.to_ask(b) and "floors" in intake.missing(b)
    q = intake.question("floors", b)
    assert q["text"].startswith("What goes on the second floor?") and q["input"] == "floors"
    assert "floors" not in intake.to_ask({**b, "auto_filled": ["floors"]})
    assert not intake.floors_missing(full_brief()) and not intake.to_ask(full_brief())


# --- BE-14: preferences can be removed ---------------------------------------------------------------------------------------------
def test_patch_replaces_preferences_and_agent_can_drop_one():
    b = {**intake.empty_brief(), "preferences": ["open kitchen", "a separate dirty kitchen", "parents downstairs"]}
    assert intake.merge_brief(b, {"preferences": ["open kitchen"]}, prefs_mode="replace")["preferences"] == ["open kitchen"]
    assert intake.merge_brief(b, {"preferences": []}, prefs_mode="replace")["preferences"] == []
    assert intake.merge_brief(b, {"preferences": ["x"]})["preferences"][-1] == "x"          # the agent still appends
    out = intake.merge_brief(b, {"remove_preferences": ["dirty kitchen"]})
    assert out["preferences"] == ["open kitchen", "parents downstairs"]


# --- BE-15: "Don't assume" clears the field and asks again -----------------------------------------------------------------------------
def test_dont_assume_clears_and_asks(monkeypatch):
    Msgs(monkeypatch)
    b = full_brief(auto_filled=["facing"])
    assert intake.fact_field(b, "front faces north.") == "facing"
    evs = turn({"id": "p1", "name": "x", "brief": b, "intake_complete": True}, message="Don't assume: front faces north.")
    nb = brief_of(evs)
    assert nb["facing"] is None and "facing" not in nb["auto_filled"]
    m = last_msg(evs)
    assert m["field"] == "facing" and "Which way does the front" in m["text"] and m["chips"]
    # the chip form does the same
    evs = turn({"id": "p1", "name": "x", "brief": b, "intake_complete": True}, chips=["unset:facing"])
    assert brief_of(evs)["facing"] is None and last_msg(evs)["field"] == "facing"


# --- BE-16: corner or mid-row ----------------------------------------------------------------------------------------------------
def test_corner_is_asked_unless_stated():
    b = intake.merge_brief(intake.empty_brief(), {"plot": {"width_ft": 35, "depth_ft": 65}})
    assert b["corner_stated"] is False and intake.to_ask(b)[:2] == ["authority", "corner"]
    q = intake.question("corner", b)
    assert q["text"] == "Corner or mid-row?" and {c["value"] for c in q["chips"]} == {"corner:true", "corner:false"}
    said = intake.merge_brief(b, {"plot": {"corner": False}})
    assert said["corner_stated"] is True and "corner" not in intake.to_ask(said)
    assert "Mid-row plot, neighbours on both sides" in intake.understood(said)["preferences"]
    skipped = intake.skip_field(b, "corner")
    assert "corner" in skipped["auto_filled"] and "corner" not in intake.to_ask(skipped)
    assert "Mid-row plot, neighbours on both sides" in intake.understood(skipped)["assumptions"]
    d, _ = intake.defaults_for(b)
    assert "corner" in d["auto_filled"]


# --- BE-17: copy -------------------------------------------------------------------------------------------------------------------
def test_skip_ack_and_roof_ack_and_suggestions():
    b = full_brief(facing="N")
    assert intake._ack_skip("facing", b) == "I've chosen north for the facing."
    ack = intake._ack({"solar": "ready"}, b)
    assert "concrete tank" in ack and "solar" in ack
    s = intake._complete_suggestions({}, full_brief(spaces=["prayer"], preferences=["open kitchen"]))
    assert "Add a prayer room" not in s and "Make the kitchen open" not in s and s[0] == "Show me concepts"
    assert "Here's what I understood" in intake._complete_text({}, b) and "Show me concepts" in intake._complete_text({}, b)


# --- BE-19: one "Decide for me" on the rooms question -----------------------------------------------------------------------------------
def test_skip_rooms_decides_floors_too(monkeypatch):
    Msgs(monkeypatch)
    b = full_brief(bedrooms=None, bathrooms=None, floors=[], spaces=[], water_tank=None, solar=None)
    p = {"id": "p1", "name": "x", "brief": b}
    m = Msgs(monkeypatch)
    m.msgs.append(db.make_message({"role": "assistant", "text": "How many bedrooms?", "field": "bedrooms"}))
    evs = turn(p, action="skip_question")
    nb = brief_of(evs)
    assert nb["bedrooms"] and "floors" in nb["auto_filled"]
    msg = last_msg(evs)
    assert msg["field"] == "water_tank" and "place the rooms on each floor" in msg["text"]


# --- BE-20: Start with questions ------------------------------------------------------------------------------------------------
def test_start_asks_the_plot(monkeypatch):
    Msgs(monkeypatch)
    evs = turn({"id": "p1", "name": "Untitled home", "brief": None}, action="start")
    m = last_msg(evs)
    assert m["text"].startswith("How big is the plot?") and "one message" in m["text"]
    assert m["input"] == "plot" and m["field"] == "plot" and m["chips"]


# --- BE-27: the auto name follows the plot ---------------------------------------------------------------------------------------------
def test_auto_name_follows_plot_until_renamed():
    b12 = {"plot": {"width_ft": 40, "depth_ft": 68, "area_marla": 12.1}, "scheme": "Johar Town"}
    assert intake.auto_name({"name": "10 marla home, Johar Town", "auto_named": True}, b12) == "12 marla home, Johar Town"
    assert intake.auto_name({"name": "10 marla house, Johar Town"}, b12) == "12 marla home, Johar Town"   # older auto names
    assert intake.auto_name({"name": "Our home", "auto_named": False}, b12) is None
    assert intake.auto_name({"name": "Sample · 10 marla modern home, Johar Town", "auto_named": False}, b12) is None
    assert intake.auto_name({"name": "12 marla home, Johar Town", "auto_named": True}, b12) is None


@pytest.mark.parametrize("text,field", [("Two storeys", "storeys"), ("4 bedrooms", "bedrooms"), ("Concrete water tank in the stair tower", "water_tank"),
                                        ("Mid-row plot, neighbours on both sides", "corner"), ("I'll place the rooms on each floor", "floors")])
def test_fact_field_maps_card_lines(text, field):
    assert intake.fact_field(full_brief(), text) == field
