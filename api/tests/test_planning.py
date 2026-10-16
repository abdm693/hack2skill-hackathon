"""Naqsha planning rules (Part A of docs/review/architecture-rules.md) against the audited houses.

The three audited plans must fail the rules that describe the defects the user reported; the corrected few-shot example
must pass every rule; and the deterministic repairs must clear what they claim to clear.
"""
import copy

import pytest

from app.compliance import lda, planning
from conftest import load


def fails(plan, brief=None):
    return {c["id"] for c in lda.check(plan, brief)["checks"] if c["status"] == "fail"}


def any_fail(ids, prefix):
    return any(i.startswith(prefix) for i in ids)


# --- the user's screenshots (1 kanal villa) --------------------------------------------------------------------------
def test_1_kanal_fails_the_rules_for_every_reported_defect(plans):
    f = fails(plans["1-kanal"])
    assert "plan.opening.same_level:f_bed3_w" in f            # P-01: "terrace" slider into a roof-level room
    assert "plan.opening.same_level:f_bath3_v" in f
    pair = lambda a, b: {f"plan.privacy.bedroom_door:{a}:{b}", f"plan.privacy.bedroom_door:{b}:{a}"}  # noqa: E731
    assert len(pair("f_bed4", "f_bed3") & f) == 1             # P-05: bedrooms open into bedrooms (one finding a pair)
    assert len(pair("f_bed5", "f_bed3") & f) == 1
    assert "plan.circulation.reach_through_private:f_bed4" in f  # P-08: reached only through Bedroom 3
    assert "plan.circulation.reach_through_private:f_bed5" in f
    assert "plan.circulation.family_route" in f               # P-10: family must cross the drawing room
    assert "plan.open_to:g_lobby:g_lounge" in f               # P-04: open_to between rooms that don't touch
    assert any_fail(f, "plan.roof.mumty")                     # P-23: roof door away from the stair arrival
    assert "room.light:f_bed3" in f                           # cross-level "daylight" no longer counts (A.0)


def test_1_kanal_door_wider_than_its_wall(plans):
    f = fails(plans["1-kanal"])
    assert "plan.opening.on_edge:f_master_d" in f             # 3.5 ft door on a 3 ft shared wall


# --- Argon v1 (real Argon output) ------------------------------------------------------------------------------------
def test_argon_v1_master_bath_and_mumty(plans):
    f = fails(plans["argon-v1"])
    assert "plan.privacy.master_bath:f_master_bath" in f      # P-06: master bath opens onto the passage
    assert any_fail(f, "plan.roof.mumty")                     # P-23: stair tower doesn't cover the stair + landing
    assert any_fail(f, "plan.stair.landing:stair_g_f")        # P-21: 0.5 ft at the foot


# --- the hand-made fixture (and old few-shot) -----------------------------------------------------------------------------
def test_contract_fixture_fails_landing_and_mumty(plans):
    if plans["fixture"] is None:
        pytest.skip("contract fixture missing")
    f = fails(plans["fixture"])
    assert any_fail(f, "plan.stair.landing")                  # P-21: 0.5 ft foot strip
    assert any_fail(f, "plan.roof.mumty")                     # P-23


# --- the journey audit's broken first floor (user's "bedrooms open into washrooms") ------------------------------------
def test_audit_v1_bedroom_through_baths_and_from_terrace(plans):
    f = fails(plans["audit-v1"])
    assert "plan.circulation.reach_through_private:f_bed3" in f   # D-1: Bedroom 3 only through baths
    assert "plan.privacy.bedroom_access:f_bed4" in f              # D-2: Bedroom 4 only from the open terrace
    assert "plan.privacy.bath_door:f_bath3" in f                  # D-3: bath with two doors (lounge + bedroom)
    assert "plan.privacy.bath_door:f_master_bath" in f            # master bath shared with Bedroom 3
    assert "plan.opening.on_edge:f_master_door" in f              # D-4: 3 ft door on a 2 ft wall
    assert "plan.opening.on_edge:g_guest_door" in f


def test_audit_v2_honours_the_brief(plans):
    brief = load("brief-audit.json")
    f = fails(plans["audit-v2"], brief)
    assert "plan.program.bedrooms" in f                          # D-9: 6 bedrooms for a brief of 5
    brief2 = {**brief, "floors": [{"level": "ground", "rooms": ["bedroom:2", "drawing"]},
                                  {"level": "first", "rooms": ["bedroom:3", "lounge", "kitchenette"]}]}
    f2 = fails(plans["audit-v2"], brief2)
    assert "plan.program.floor:first" in f2                      # 4 bedrooms upstairs instead of 3


# --- the corrected example passes everything ------------------------------------------------------------------------------
def test_example_plan_is_clean(plans):
    rep = lda.check(plans["example"], {"bedrooms": 4, "bathrooms": 4, "solar": "ready", "water_tank": "plastic",
                                       "spaces": ["drawing", "tv_lounge", "dining", "kitchen", "car_porch:1"],
                                       "preferences": ["attached baths"]})
    bad = [c for c in rep["checks"] if c["status"] == "fail"]
    assert rep["ok"], bad
    ids = {c["id"] for c in rep["checks"] if c["status"] == "pass"}
    for rule in ("plan.rule.independence", "plan.rule.circulation", "plan.rule.stairs", "plan.rule.roof_door",
                 "plan.rule.openings", "plan.rule.brief", "plan.roof.solar"):
        assert rule in ids


# --- individual rules ------------------------------------------------------------------------------------------------------
def test_bedroom_into_kitchen_and_bath_into_kitchen(plans):
    p = copy.deepcopy(plans["example"])
    p["openings"].append({"id": "x_bad", "level": "ground", "type": "door", "at": [12, 50], "width_ft": 3, "height_ft": 7,
                          "between": ["g_guest", "g_kitchen"]})
    assert "plan.privacy.bedroom_door:g_guest:g_kitchen" in fails(p)


def test_stair_continuity_requires_roof_stair(plans):
    p = copy.deepcopy(plans["example"])
    p["stairs"] = [s for s in p["stairs"] if s["to_level"] != "roof"]
    f = fails(p)
    assert "plan.stair.continuity:first:roof" in f


def test_mumty_door_must_face_the_landing(plans):
    p = copy.deepcopy(plans["example"])
    p["roof"]["mumty"]["door_side"] = "back"   # the far (mid-landing) end
    assert "plan.roof.mumty_door" in fails(p)


def test_repair_mumty_fixes_cover_and_door(plans):
    for name in ("argon-v1", "fixture"):
        p = copy.deepcopy(plans[name])
        if p is None:
            continue
        changed = planning.repair_mumty(p)
        assert changed
        f = fails(p)
        assert not any_fail(f, "plan.roof.mumty"), (name, sorted(x for x in f if "mumty" in x), p["roof"]["mumty"])


def test_repair_stairs_fits_code_flights_in_a_big_enough_hall(plans):
    p = copy.deepcopy(plans["argon-v1"])
    assert planning.repair_stairs(p) == ["stair_g_f", "stair_f_r"]
    planning.repair_mumty(p)
    f = fails(p)
    assert not any_fail(f, "plan.stair") and not any_fail(f, "plan.roof.mumty"), sorted(f)
    # a hall that is too short is left for the planner
    q = copy.deepcopy(plans["fixture"] or plans["1-kanal"])
    planning.repair_stairs(q)
    assert any_fail(fails(q), "plan.stair.landing")


def test_normalize_slides_door_into_its_wall(plans):
    p = copy.deepcopy(plans["example"])
    door = next(o for o in p["openings"] if o["id"] == "g_guest_door")
    door["at"] = [12.6, 42.9]    # off the wall line and tight to the corner
    changed = planning.normalize(p)
    assert "g_guest_door" in changed
    assert door["at"][1] == 42.75 and door["at"][0] >= 12 + 0.3 + 1.5
    assert not any_fail(fails(p), "plan.opening")


def test_prayer_room_is_not_habitable(plans):
    p = copy.deepcopy(plans["example"])
    # carve a 6 x 6 prayer room out of the first-floor terrace, opening off the lounge
    p["rooms"] = [r for r in p["rooms"] if r["id"] != "f_terrace"]
    p["rooms"] += [{"id": "f_prayer", "level": "first", "name": "Prayer Room", "type": "prayer", "rect": {"x": 6, "y": 42.75, "w": 6, "d": 6}},
                   {"id": "f_terrace", "level": "first", "name": "Rear Terrace", "type": "terrace", "rect": {"x": 0, "y": 48.75, "w": 12, "d": 9.25}}]
    p["openings"] = [o for o in p["openings"] if o["id"] != "f_terrace_slide"]
    p["openings"].append({"id": "f_prayer_door", "level": "first", "type": "door", "at": [10, 42.75], "width_ft": 3, "height_ft": 7,
                          "between": ["f_prayer", "f_lounge"]})
    rep = lda.check(p)
    assert not [c for c in rep["checks"] if c["id"].endswith(":f_prayer") and c["id"].startswith(("room.size", "room.light"))]


def test_every_check_has_a_category_and_lda_units(plans):
    rep = lda.check(plans["1-kanal"])
    assert all(c.get("category") in ("lda", "livable") for c in rep["checks"])
    by = {c["id"]: c for c in rep["checks"]}
    assert by["setback.front"]["unit"] == "ft"
    assert by["coverage"]["unit"] == "%"
    assert by["setback.side"]["unit"] == "sides"


def test_failing_dimension_is_reported():
    plan = copy.deepcopy(load("plan-10-marla.json"))
    plan["rooms"].append({"id": "f_kit2", "level": "first", "name": "Kitchenette", "type": "kitchen", "rect": {"x": 30, "y": 50, "w": 5, "d": 10}})
    c = next(c for c in lda.check(plan)["checks"] if c["id"] == "room.size:f_kit2")
    assert c["status"] == "fail" and "wide" in c["message"] and c["unit"] == "ft" and c["value"] == 5


def test_violations_text_puts_safety_first_with_hints(plans):
    txt = lda.violations_text(lda.check(plans["1-kanal"]))
    assert txt.splitlines()[0].startswith("SAFETY")
    assert "Fix:" in txt


def test_brief_floor_tokens():
    assert planning.parse_program(["drawing", "bedroom:2", "bed_bath:1", "bath:2"]) == {"drawing": 1, "bedroom": 3, "bath": 3}


def test_malformed_plan_does_not_crash():
    out = planning.check({"rooms": [{"id": "x"}], "openings": [{"id": "o", "at": None}], "levels": []})
    assert isinstance(out, list)
