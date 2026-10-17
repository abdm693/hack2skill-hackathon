# Architecture and building-code rules for generated houses

Audit date: 16 Oct 2026. Reviewer stance: a senior Lahore architect plus a structural and egress reviewer.
This spec has three parts that can be implemented independently:

- **Part A. Plan rules.** Deterministic checks on the `BuildingPlan` that feed Argon's fix loop.
- **Part B. Engine invariants.** The House SDK enforces these whatever Argon writes.
- **Part C. Prompt changes.** Changes to the planner (`PLAN_SYSTEM`), the builder (`BUILD_SYSTEM`) and the fix-loop message.

Units are plan feet and the conventions of `contracts/plan.ts`. Metric equivalents: 900 mm = 2.95 ft (we use 3.0 ft), 750 mm = 2.46 ft, 1.07 m = 3.5 ft, 100 mm = 4 in = 0.33 ft, 760 mm = 2.5 ft.
LDA (B&ZR 2019, consolidated 2026) covers stair width, risers, treads and parapets. It does not specify guards or furniture, so for those we use IBC 2021 as the reference standard:
- §1015: guards are required where the drop is more than 30 in, they must be at least 42 in high, and openings must stop a 4 in sphere.
- §1011.6: a landing must be at least as deep as the stair is wide.
- §1014: handrails sit at 34 to 38 in.

Pakistani planning practice (privacy, drawing room and porch) is written as named *Naqsha planning rules*.

---

## 0. What was audited, and how

| House | Source | Plot |
|---|---|---|
| `argon-v1` | `contracts/fixtures/argon-v1-plan.json` + `argon-v1-design.js` (real Argon output) | 10 marla, 35×65, faces N |
| `fixture` | `contracts/fixtures/plan-10-marla.json` + `design-10-marla.js` (hand-made, and also the planner's few-shot example) | 10 marla, 35×65, faces N |
| `1-kanal` | live `p_b89033214fde / v_c7688880e2df` (this is the house in the user's screenshots 1 to 5) | 20 marla, 50×90, faces S |

The audit script `audit_plans.py` (in the session scratchpad, outside the repo) does two things.

First, it implements the Part A checks.

Second, it is a line-by-line Python port of the engine code that decides where things actually end up:
- `layoutStair`, which handles the stair shift and cut, tread compression, the arrival side, the holes and the arrival point;
- the mumty door placement in `placeOpenings`;
- the stair railing decisions in `buildStairs`;
- the choice of wall run that each opening is cut into;
- the wall-item snap in `furnishImpl`.

That way it reports what the user really walks through, not just what the plan says. Use it as the reference implementation for `api/app/compliance/planning.py` (Part A) and as the oracle for engine tests (Part B).

### Headline findings (FAIL counts and the worst items)

| Defect | argon-v1 | fixture | 1-kanal (user's house) |
|---|---|---|---|
| Stairwell edge with **no railing**: drop up to (ft) | 2 edges: 6.5 ft long, 5.2 ft drop (1st floor, open to the lounge); 3.5 ft long, 9.8 ft drop (roof) | 2 edges: 6 ft at 5.2 ft drop; 3.5 ft at 9.8 ft drop | 3 edges: 7.25 ft at 5.2 ft drop; 1 ft at 11 ft; 5 ft at **22 ft** (roof) |
| Balustrade gaps over a 1 ft stair well | – (well is only 0.15 ft) | – | 3 (drops of 10.4, 12.2 and 21.4 ft) |
| Stair railings are **not walk colliders** (`metal_bars` / `solid`) | glass (collides) | glass | **metal_bars: you walk through every stair railing** |
| Mumty door opens over the void | no | yes (32% of the threshold) | **yes (84% of the threshold, 5.2 ft above the mid-landing)** |
| Mumty does not cover the laid-out stair | yes (stair pokes 1.14 ft past the mumty) | top landing only 2 ft | no |
| Treads compressed below LDA 10 in | no | **9.5 in** (and foot landing only 1.25 ft) | no |
| Bedroom opens into a bedroom | 0 | 0 | **2**, plus a 5 ft glass slider Bed 3 ↔ Bed 5 that the engine cut into the wrong wall |
| Room reachable only through a bedroom | 0 | 0 | 2 (Bed 4 and Bed 5 through Bed 3) |
| Cross-level opening used to pass the daylight check | 0 | 0 | 2 (`f_bed3_w`, `f_bath3_v` → `r_terrace` on the roof; LDA check **passed**) |
| Family route from the main door goes only through the drawing room | no | no | **yes** (lobby `open_to` lounge, but they share no edge) |
| TV, mirror or AC mounted over a door or window | TV over the **main door**; mirror over a door; TV over a window; AC with no wall | AC over the drawing entry | TV snapped **onto the powder door** (screenshot 2); mirror over a door |
| Tall furniture across a door (Argon's positions) | 6 | 0 | 9 (wardrobes across every rear-bedroom door) |
| Car blocks a door approach or walkway | SUV parked across the **main door** | – | sedan in the porch → lobby door approach |
| Master bath not attached to the master bedroom | yes (it opens onto the passage) | no | no |

So all three houses, including the hand-made few-shot fixture, have life-safety defects on the stair. The 1-kanal house shows every complaint in the user's feedback.

---

## 1. Root causes in the engine (exact functions and lines)

### 1.1 Stair railing gaps ("places where you can fall from above")

1. **The stairwell rail is skipped for a whole edge near the arrival point.** See `web/src/engine/structure/stairs-geo.ts` L116 to L133, `buildStairs`, in the "railings around the hole" loop:
   ```ts
   if (Math.hypot(ax - tx, ay - ty) < 2.6) continue;   // L130
   ```
   Any edge run of the hole that passes within 2.6 ft of `lay.arrival` is dropped **in full**, not just the 4 ft arrival opening.
   - A dog-leg's arrival is beside two edges: the top-riser line and the long edge beside flight 2. So the long edge facing the stair hall loses its rail too.
   - In the 1-kanal house that edge is 10.75 ft long at y=54.5, as in screenshot 1 (bottom-left).
   - In argon-v1 it is the 9.8 ft edge at x=7.5, which is open to the corridor and the lounge.
2. **The balustrade stops two treads short at the top of the last flight.** See `stairs-geo.ts` L61 to L63:
   ```ts
   const gapStart = fi === 0 ? 2 * f.tread : 0;
   const gapEnd   = fi === lay.flights.length - 1 ? 2 * f.tread : 0;
   ```
   The gap is meant to let people "step on/off sideways". But:
   - on the **well side** it leaves a 1 ft slot 10 ft and more above the floor below (1-kanal);
   - on a **stacked** stair (first floor → roof) `gapStart` sits beside the void of the stair below, a drop of 12 ft.
3. **Stair railings do not collide in walk mode.** See `stairs-geo.ts` L136 to L138, which tag every mesh of the stair kit `collide = false`. Only the separate glass kit is registered with `ctx.collider` (L139 to L147). With `railing: "metal_bars"` or `"solid"`, the balustrades and hole rails can be walked through. Deck railings, by contrast, are colliders (`extras-geo.ts` L81).
4. Minor: `metal_bars` balusters are spaced every `0.38` ft (4.6 in) in `structure/railings.ts` L63. That is above the 4 in sphere rule.

### 1.2 Roof door suspended in the wall, and no stair reaching it

1. **The door ignores the arrival.** In `web/src/engine/structure/model.ts`, `placeOpenings` (L281 to L297) puts the synthetic mumty door on `roof.mumty.door_side` exactly as the plan states, at `stairStartPoint(stair)` projected onto that wall (L288 to L293, L653 to L662).
   - `stairStartPoint` only gives a position *along* the start edge.
   - When `door_side` is perpendicular to the start edge, the door lands on the far end wall. That is above the mid-landing and the void, not beside the top landing.
   - 1-kanal: the stair starts at +x and arrives at x≈3 by the left party wall, while `door_side: "right"` puts the door at x=15, 84% over the void and 5.2 ft above the mid-landing (screenshot 5).
   - fixture: the door straddles the top-riser line (32% over the void).
2. **The door is placed before the stair is laid out.** The engine then uses that door as the "access point" that decides which side flight 2 arrives on (`layoutStair` L720 to L735), so the reasoning is circular. Stacked stairs can also end up with different handedness, because each stair computes `arriveHigh` on its own.
3. **The mumty is never reconciled with the stair as laid out.** `layoutStair` shifts or shortens the stair to win a 2.95 ft clear strip at its foot (L680 to L709).
   - In argon-v1 that pushes the first-floor → roof stair 2.64 ft back, past the mumty's back wall (y 41.14 vs 40), so part of the roof hole and the landing are outside the mumty.
   - `plan/model.ts` L244 to L264 builds the mumty from the plan's `roof.mumty.rect` only.
4. **The synthetic door is suppressed** when the plan has *any* opening on the roof level (`model.ts` L294). The mumty is synthesised only when the roof has no enclosed room (`plan/model.ts` L248), so a plan with a roof servant room or store gets no stair tower door at all.
5. **The top flight can be missing.** Nothing checks that a stair from the top storey to the roof exists. The LDA check only looks at width, riser, tread and flight length.

### 1.3 TV in front of a door, and furniture in doorways

1. **Keep-out zones apply only to floor items.** `web/src/engine/furniture/place.ts` L142:
   ```ts
   const zones = def.cls === "floor" ? doorZones(ctx, room) : [];
   ```
   `tv`, `painting`, `mirror_wall`, `ac_split` and `towel_rail` are `cls: "wall"` (`items.ts` L1058, L1067, L1068, L1087, L1085), so they are never tested against doors or windows.
2. **Wall-item snapping lands on doors.** `place.ts` L177 to L185 slides a wall item that is not inside a wall run (with 0.3 ft margins) to the nearest wall *run*. A run includes its door and window holes.
   - 1-kanal ground lounge: Argon asked for u=27, which is exactly the junction of the powder wall (18 to 27) and the porch wall (27 to 45).
   - The snap moved the TV to u=24.25 (21.5 to 27), straight across the powder door (21.25 to 23.75). That is screenshot 2's "TV in doorway".
3. **The TV is not tied to its unit.** The `tv_unit` (a floor item) is nudged out of the door zone by L218 to L256, while the TV keeps its own `along_ft`. Its mount height then comes from whatever floor item sits below (L276 to L278).
4. **The nudge is single-wall and silent on failure.** It only slides along the requested wall (L226 to L237). If nothing is free (`best === null`, L250) the item stays where it was, across the door.
5. **`doorZones` (L47 to L69) leaves out several zones:**
   - open-plan boundaries (`open_to`), the only connection between the stair hall and the lounge in all three houses (screenshot 4);
   - the stair foot and arrival landings (only the stair rect ±0.3 ft);
   - windows, for tall items such as wardrobes.
6. Argon's intent is often wrong as well. Across the two Argon houses, wardrobes are drawn across a bedroom's door in 7 bedrooms: 5 entrance doors and 2 bath doors. The argon-v1 seating group's axis (TV, sofa, coffee table) is centred on the main door.

### 1.4 Cars blocking vision and the walkway

1. Cars are ordinary floor items with `collide: true` and are 4.8 to 6 ft tall (`items.ts` L1091 to L1092). Argon places them by `at`, with no notion of a parking bay or a pedestrian walkway. `auto.ts` L550 to L560 (`porch()`) simply centres the car in the porch.
2. Door zones are only 2.6 to 3.4 ft deep, so a car can sit right behind them. In argon-v1 the SUV, clamped inside the porch, fills y ≈ 10 to 26 directly in front of the 4 ft main door.
3. `computeSpawn` (`web/src/engine/build.ts` L191 to L227) starts the walk 6.5 ft outside the main door and then shifts sideways by up to ±4.5 ft to avoid furniture. It never checks the line of sight, so the walker starts with the car between the camera and the door.

### 1.5 Other engine and checker defects found

- **Openings cut into the wrong wall.** `model.ts` L298 to L316 accept a run that matches only *one* of the two `between` rooms within 2 ft (`lim = 2` for `miss === 1`).
  - 1-kanal `f_bed3_w` (Bed 3 → roof terrace, a cross-level opening) became a **5 ft glass sliding door between Bed 3 and Bed 5**. It is visible on the right of screenshot 3.
  - `f_bath3_v` became a ventilator from Bath 3 into the family lounge.
- **The LDA daylight check accepts impossible glazing.** `api/app/compliance/lda.py` L235 to L245 (`glazing`) counts any opening whose `between` names an open-air room, on any level, without checking that it sits on that room's edge. The positional check (L156 to L161) is only a WARN.
  - So the fix loop "fixed" `room.light:f_bed3` on attempt 2 by pointing a slider at the roof terrace (`fix_history` shows the fail on attempt 1).
  - The live checker reports `room.light:f_bed3 pass (38 sq ft)` and `room.vent:f_bath3 pass`, but the room has no exterior wall.
- **Treads are compressed below code.** `layoutStair` L741 to L746 lowers treads to `max(0.62 ft, …)` and warns only below 0.78 ft (9.4 in). The fixture is built with 9.5 in treads while the plan check passes it at 10 in.
- **Mid-landings are shallower than the flight.** Minimum landing depth is `Lmin = max(3.0, 0.86·wf)` (L740), which is below the flight width for 3.5 to 4 ft flights.
- **An upper-floor `open_space` becomes a floored deck** (`plan/model.ts` L224). The 1-kanal "Central Lightwell" is therefore a sealed 9×4 ft yard with no access.

---

## Part A: Deterministic plan rules (fix-loop checks)

### A.0 Integration

- Add a new module `api/app/compliance/planning.py` with `check(plan) -> list[ComplianceCheck]`. Call it from `lda.check()` and append its checks before computing `ok`.
  - Use ids `plan.<rule>:<element>`.
  - Use `rule_ref` `"Naqsha planning rule P-xx"`, or the IBC clause where one applies.
  - Fill `element_ids` so the 2D and 3D views can highlight the elements.
- In `lda.glazing()`, count an opening only if it passes **P-01** and **P-02**: same level, on the shared edge, and the other side is exterior or a same-level open-air room. Promote `plan.opening:*` from WARN to FAIL.
- `violations_text()`: sort the FAILs as *safety (stairs, mumty, guards)* → *privacy and circulation* → *LDA envelope* → *rooms*, and append each rule's **Fix hint** (below) to its line.
- Fix loop in `architect.make_plan`:
  - raise `PLAN_MAX_ATTEMPTS` to 4;
  - keep the **best** attempt (fewest FAILs, ties broken by fewest WARNs), not the last one;
  - after the last attempt, run the deterministic auto-repairs in B.3 (mumty) before saving.
- Run the same `planning.check` in the ADK revision agent's `check_compliance` tool, so revisions cannot reintroduce the defects.

### A.1 Shared definitions (implement once)

```
rect(r)          = (x0, y0, x1, y1)
shared_edge(a,b) = (axis, c, lo, hi) when a and b touch along a segment longer than 0.05 ft (tol 0.05); else None
                   axis "x": the edge runs along x at y=c; axis "y": it runs along y at x=c
room classes:
  PRIVATE = {bedroom, master_bedroom, guest_bedroom, servant}
  WET     = {bath, powder}
  ANNEX   = {bath, dressing}                 # entered only through the owning room
  CIRC    = {lobby, corridor, stair}
  LIVING  = {lounge, dining, drawing, prayer, study}
  SERVICE = {kitchen, dirty_kitchen, laundry, store}
  OPEN    = {porch, balcony, terrace, lawn, driveway, open_space, courtyard}
DOOR_TYPES = {main_door, door, double_door, sliding_door, arch, garage_door}
party_side(s) = the plot edge on side s has setback 0 (left/right/rear)
storeys = levels without the roof, ordered by index; top = storeys[-1]; roof = last level
graph G: nodes = rooms + EXT (outside at ground) + ROOF (open roof)
  edge for every VALID door-type opening (P-01/P-02);
  edge for every open_to pair that shares an edge (P-04);
  porch and outdoor rooms → EXT; roof-level decks → ROOF;
  stair s: room_at(from_level, centre(s.rect)) ↔ room_at(to_level, centre(s.rect)); mumty ↔ ROOF via its door
stair geometry (mirrors engine layoutStair; also defines the arrival zone):
  rise     = elev(to) - elev(from);  N = round(rise*12 / riser_in);  r = rise/N;  T = tread_in/12
  dogleg:  n1 = ceil(N/2), n2 = N - n1;  breadth = rect side ⟂ start;  length = rect side ∥ start
           flight width wf = min(width_ft, (breadth - 0.15)/2)
           start end E = the rect edge where the first riser is (+y: min-y edge, -y: max-y, +x: min-x, -x: max-x)
           a dogleg STARTS and ARRIVES at E
  straight: arrival at the opposite edge
  foot zone F(s)    = strip between the stair room's wall at E and the rect edge E, full breadth, ≥ 3.0 ft deep (from_level)
  arrival zone Z(s) = dogleg: the same strip on to_level (the engine's exact Z runs to the top-riser line, see B.3);
                      straight: 3.0 ft strip beyond the far edge, flight width (to_level)
```

Each rule is listed with an **ID**, a **status**, the **rule**, its **check**, a **message** and a **fix hint**. The message is the user-facing `message`; the hint is appended for Argon only.

#### Openings and connectivity

**P-01 `plan.opening.same_level`** (FAIL)
- Rule: every non-`exterior` room in `between` exists and is on `opening.level`.
- Check: `by_id[b].level == o.level` for each `b != "exterior"`.
- Message: `"{o.id} on {level} joins {room} on {room.level}. Openings can only join rooms on the same floor."`
- Fix hint: *"Delete it. If the room needs daylight, move it to an exterior wall or add a light well beside it."*

**P-02 `plan.opening.on_edge`** (FAIL)
- Rule: a two-room opening lies on their shared edge and fits inside it.
- Check:
  - `e = shared_edge(A, B)`; FAIL if `e is None`;
  - with `along/across = at` projected on `e`: FAIL if `|across - c| > 0.75` or `along ∉ [lo-0.25, hi+0.25]`;
  - FAIL if `hi - lo < width + 0.25`; WARN if `along - w/2 < lo + 0.3` or `along + w/2 > hi - 0.3` (jambs).
- For `exterior`: the point 0.3 ft outside the room edge at `at` must not be inside an enclosed room on that level.
- Message: `"{o.id} ({w} ft) doesn't fit the {hi-lo} ft wall between {A} and {B}."` or `"…is not on the wall between {A} and {B}."`
- Fix hint: *"Place doors 0.5 to 1 ft from a room corner, on a shared wall at least door width + 0.6 ft long."*

**P-03 `plan.opening.party_wall`** (FAIL)
- Rule: no window, ventilator, door or sliding door on a zero-setback plot edge.
- Check: for an exterior opening on room side `s` with `rect` on the plot line (`x0≤0.01`, `x1≥W-0.01`, `y1≥D-0.01`), FAIL if `party_side(s)`.
- Message: `"{o.id} is on the {s} party wall. The neighbour builds right against it."`

**P-04 `plan.open_to.valid`** (FAIL)
- Rule: `open_to` only joins rooms on the same level that share an edge at least 3 ft long, and never a PRIVATE or WET room.
- Message: `"{A} is open to {B} but they don't touch, so no connection is built."` or `"{A} can't be open-plan to {B}; bedrooms and baths need doors."`

#### Room independence (privacy)

**P-05 `plan.privacy.bedroom_door`** (FAIL)
- Rule: a PRIVATE room's doors may only lead to CIRC, LIVING (except `drawing` for family bedrooms; allowed for `guest_bedroom`), its **own** attached bath or dressing, or an open room (balcony or terrace).
- Never to another PRIVATE room, a SERVICE room, or a bath that has any other door.
- Check: for every G edge (A, B) with A in PRIVATE: FAIL if B is PRIVATE, or B is in SERVICE, or (B is in WET and degree(B, non-EXT) > 1).
- Message: `"{A} opens directly into {B}. Bedrooms must open onto a corridor, lobby, lounge or their own bath or balcony."`
- Fix hint: *"Give {A} a door onto circulation; if it touches none, add a corridor ≥ 4 ft (centre-line) along the bedrooms."*

**P-06 `plan.privacy.bath_door`** (FAIL)
- Rule: a WET room has **one** door.
  - Its target is either a single PRIVATE or dressing room (attached), or CIRC, `lounge` or `drawing` (powder only).
  - A powder room or common bath whose only door opens into the `dining` room FAILS `plan.privacy.wc_into_dining`: the WC door
    frames the dining table. Fix: *"open it off a lobby, passage or the lounge, or put a small lobby in front of its door"*.
  - Never `kitchen`, `dirty_kitchen`, `store`, `laundry` or another WET room.
- A bath whose id or name contains "master" must open into the `master_bedroom` or its dressing.
- Message: `"{bath} opens into {target}."`, `"{bath} has {n} doors; an attached bath opens only into its bedroom."` or `"Master Bath does not open into the master bedroom."` (argon-v1)

**P-06b `plan.privacy.wc_on_entry:<room>`** (FAIL; purdah)
- Rule: from the open main door, guests on the porch never look straight into a WC.
- Check: take the room the ground-floor main door opens into (lobby, lounge or drawing room) and the main door's line of sight,
  square to its wall and into that room. A powder room or common bath whose door opens into the same room FAILS when either:
  - its door is on the opposite, parallel wall and the two door spans overlap when projected across the room; or
  - its door lies within 30° of the main door's line and within 15 ft of the main door.
- Message: `"From the main door you look straight into the Powder Room: its door faces the main door across the Entrance Lobby, so guests at the door see the WC."` (architect-e2e p_cc2b1126c4d1 v_57f77f161634: main door at (13, 25.75), Powder Room door at (24, 25.75), across an 11 ft × 4′6″ lobby.)
- Fix hint: *"Move the Powder Room door to a side wall of the lobby, out of the main door's line of sight (or round a corner), or turn the lobby so the two doors don't face each other."*
- With it, **`plan.circulation.lobby_crowded:<lobby>`** (WARN): the lobby inside the main door is under 5 ft deep and 4 or
  more doors (the main door included) open off it.

**P-07 `plan.privacy.kitchen`** (FAIL)
- Rule: no door or `open_to` between {kitchen, dirty_kitchen} and PRIVATE or WET.

**P-08 `plan.circulation.reach_through_private`** (FAIL)
- Rule: every room is reachable from EXT without *passing through* a PRIVATE, WET or dressing room.
- Check:
  - BFS from EXT on G where PRIVATE ∪ WET ∪ {dressing} are terminal (they can be entered but not expanded);
  - a room missing from that set but reachable in an unrestricted BFS FAILs;
  - exemptions: a WET or dressing room whose only neighbour is one PRIVATE or dressing room (attached); a deck whose only neighbour is one PRIVATE room (private balcony).
- Message: `"{room} can only be reached through {via}."` (1-kanal: Bed 4 and Bed 5 through Bed 3.)

**P-09 `plan.circulation.balcony_links_bedrooms`** (WARN)
- Rule: a balcony or terrace with doors to two or more PRIVATE rooms makes them reachable from each other.

**P-10 `plan.circulation.family_route`** (FAIL)
- Rule: from the room inside the main door, a ground-floor `lounge` is reachable through interior rooms without entering drawing, PRIVATE, WET or SERVICE rooms.
- Check: BFS on G minus EXT, porch and outdoor nodes, with the terminal set as above.
- Message: `"From the main door the family lounge can only be reached through the drawing room."` (1-kanal)
- Fix hint: *"Join the entrance lobby to the lounge with a door or arch on a shared wall, or put the main door into the lounge."*

**P-11 `plan.circulation.guest_route`** (WARN)
- Rule: the drawing room is reachable from EXT or the entrance lobby without crossing lounge, dining, stair or kitchen.

**P-12 `plan.circulation.main_door`** (FAIL)
- Rule: exactly one `main_door`, on the ground level.
- The inside room is a lobby, lounge, corridor or drawing room (warn for drawing). The outside is exterior, porch, lawn or driveway.

**P-13 `plan.circulation.width`**
- Corridor or lobby clear width (`min(w,d) − 0.375`): FAIL below 3.0 ft, WARN below 3.5 ft.
- Door widths: main ≥ 3.5 ft; habitable doors ≥ 3.0 ft; bath, powder and store doors ≥ 2.5 ft. WARN when narrower.

**P-14 `plan.circulation.dead_end`**
- A corridor or lobby with fewer than 2 connections in G: FAIL.
- A corridor longer than 12 ft serving 2 or fewer openings: WARN.

**P-15 `plan.circulation.porch`** (FAIL; uses the optional schema field in A.3)
- Parking bays are `site.parking[i].rect`. They must be at least 9×18 ft each, inside porch ∪ driveway ∪ garage, and must not overlap.
- If the field is missing, derive one bay per 9.5 ft of porch width along its driveway edge, 18 ft deep from that edge.
- The checks:
  1. The car-gate interval `[at - w/2, at + w/2]` overlaps each bay's road-facing width by at least 8 ft, through driveway cells (a straight drive-in).
  2. Every door on a porch wall (main door included) has its 3 ft approach rectangle (width + 1 ft by 3 ft) outside every bay.
  3. A walkway 3 ft wide exists from the pedestrian gate (or the car gate) to the main door's approach, through porch ∪ driveway ∪ lawn minus the bays. Test it with a grid BFS at 0.5 ft, inflating the bays by 1.5 ft.
- Message: `"The car bay in {porch} blocks {door}."` or `"No 3 ft walkway from the gate to the main door past the parked car."`
- Fix hint: *"Make the porch ≥ 9 ft per car + 3.5 ft walkway wide, or put the porch door on the porch side wall beyond the bay."*
- As implemented (`planning._porch`, round 3): bays are counted as the engine lays them out (`parking.ts porchBays`). Cars
  drive in across one porch edge, chosen as the engine does (a driveway beyond it is best, then open ground, the front edge
  preferred; an enclosed room beyond rules an edge out). A bay is 9 ft wide and 18 ft deep, or at least 14 ft deep when that
  edge opens onto the driveway or the front open space, because the car's tail may stand up to 4 ft out over it
  (`contracts/engine-notes.md`). So a 17′ × 16′ porch parks 1 of 2 cars in both the plan check and the as-built note.
- **`plan.circulation.porch_bike:<porch>`** (WARN): when the brief mentions a motorbike (`motorbike` in brief.spaces, or
  "motorbike", "bike" or "scooter" in the preferences or notes), the porch also needs a 3 × 7 ft motorbike bay beside the cars
  and the walkway, or 3 ft deeper than the cars. Message: `"Car Porch (13′ × 18′) has no 3 × 7 ft space left for the motorbike once the car and the 3′6″ walkway to the door are in."`

**P-16 `plan.daylight.real`** (FAIL, replaces the LDA glazing count)
- Rule: habitable rooms and kitchens need valid outside glazing of at least 8% of the floor area.
- Valid means it passes P-01/P-02 and the other side is exterior or a same-level porch, balcony, terrace or open space.
- WET rooms need at least 2 sq ft (WARN, unchanged severity).

**P-17 `plan.room.solid_wall`**
- Rule: the room keeps one continuous wall stretch with no door or window (each opening ±0.5 ft):
  - lounge or drawing room: at least 8 ft (the TV or sofa wall);
  - bedroom or guest room: at least 9 ft (queen bed plus two side tables);
  - master bedroom: at least 10 ft.
- Wall stretches join across neighbouring wall segments; `open_to` edges are not walls.
- FAIL below 7 ft, WARN below the target.
- Message: `"{room}'s longest solid wall is {n} ft; the TV wall (or bed wall) needs {target} ft."`
- Fix hint: *"Move doors to room corners and put the windows on one wall."*

#### Stairs, voids and roof

**P-18 `plan.stair.continuity`** (FAIL)
- Rule: for each consecutive pair in `[storeys with enclosed rooms…, roof]` there is a stair from → to.
- All stairs are **stacked**: same rect (±0.25 ft), `kind` and `start`.
- Message: `"There is no stair from {A} to {B}."` or `"{s2} is not stacked on {s1}."`

**P-19 `plan.stair.containment`** (FAIL)
- `s.rect` lies inside one `stair` or `lobby` room on `from_level`.
- On `to_level` every room that overlaps `s.rect` by more than 0.5 sq ft is `stair`, `lobby` or `corridor`. On the roof it is the mumty.
- Message: `"The stairwell of {s} cuts into {room}."`

**P-20 `plan.stair.geometry`** (FAIL)
- Rule: the stair fits at code dimensions without the engine squeezing it.
- Check, with `N, n1, T` from A.1 and `T_min = 10/12`:
  - `riser = rise/N ≤ 7.5 in`; risers per flight ≤ 15;
  - dogleg: `breadth ≥ 2·width_ft + 0.15` and `length ≥ (n1-1)·max(T, T_min) + max(width_ft, 3.0)` (the mid-landing at least as deep as the flight, IBC §1011.6);
  - straight: `length ≥ (N-1)·max(T, T_min)`;
  - l_shape: `length ≥ (n1-1)·T + width_ft` and `breadth ≥ (n2-1)·T + width_ft`;
  - the kind must be supported at that breadth (dogleg needs `breadth ≥ 4.9`, otherwise the engine silently builds a straight flight).
- Message: `"Stair {id}: {length} ft is too short for {n1} treads of {T} in plus a {width} ft landing (needs {req} ft)."`
- Fix hint (for 11 ft floor-to-floor): *"19 risers of 6.95 in, 10 in treads, 3.5 ft flights → dog-leg rect 7.5 ft × 11 ft."*

**P-21 `plan.stair.landings`** (FAIL)
- Rule: the foot zone F(s) on `from_level` and the arrival zone Z(s) on `to_level` (A.1, 3.0 ft by the full stair breadth) lie inside the same stair, lobby or corridor room, or in a CIRC/LIVING room it is `open_to`.
- No door swing may enter them, except a door whose purpose is to leave the landing.
- Z(s) must connect to the rest of the floor: it touches a door or `open_to` edge of its room, or the room has one.
- For the top stair, Z(s) is inside the mumty (P-23).
- Message: `"Stair {id} has only {d} ft clear at its foot on {level}; it needs 3 ft."` (fixture: 0.5 ft in the plan, 1.25 ft as built after the engine squeezes the treads) or `"The top of stair {id} on {level} lands against a wall with no way out."`
- Fix hint: *"Make the stair room ≥ 3.5 ft longer than the stair at its start end (where a dog-leg starts and arrives)."*

**P-22 `plan.stair.void_edges`** (INFO; the engine guards these, see B.1, but the checker lists them for the plan view)
- For each upper level, compute the void as stair rect minus Z(s).
- Every void edge not on a wall line is reported as *"guard required, {len} ft"*.
- **FAIL** if a void edge is within 3 ft of a door on the stair room's walls, i.e. a door opening straight onto the void. Message: `"Door {id} opens onto the stairwell."`
- **FAIL** if the stair room on that level is PRIVATE.

**P-23 `plan.roof.mumty`** (FAIL)
- Rule:
  - if any stair reaches the roof, `roof.mumty` exists, or an enclosed roof room contains the top stair;
  - `mumty.rect ⊇ top stair room rect` (the stair and its Z on the roof);
  - `mumty.door_side` ∈ the allowed sides.
- Allowed sides are those whose wall line touches Z(top stair) along at least 3.6 ft (door + jambs), that are not `party_side`, and whose 3 ft strip outside lies over the top storey's enclosed or porch footprint (roof slab) and over no other hole.
- For a dog-leg that means the **start-end side**, plus a long side only if the top landing is at least 3.6 ft deep.
- The plan check approximates Z as the 3 ft strip beyond the stair rect's start edge. The engine uses the exact top-riser line (B.3).
- Message: `"The roof door is on the {side} side, away from the top of the stair. Use the {allowed} side."` (1-kanal: right → front; fixture: right → front.)
- Fix hint: *"door_side = the start-end side of the stair (front for +y, back for -y, left for +x, right for -x); if that is a party wall, use a long side and make the mumty ≥ 3.5 ft longer than the stair at the start end."*

**P-24 `plan.roof.services`** (WARN)
- Water tank:
  - `brief.roof.water_tank == "plastic"` → `roof.water_tank.rect` lies within the mumty rect (it is set on the mumty slab);
  - `"rcc"` → a rect at least 1.5 ft inside the parapet;
  - in both cases at least 3 ft from the mumty door strip.
- Solar (when `brief.roof.solar != "none"`):
  - free roof = top-storey footprint − mumty − tank − 2 ft parapet band − roof rooms;
  - WARN if free roof < 55% of the footprint;
  - INFO with the free area in sq ft, and kWp ≈ area/70.

**P-25 `plan.program.per_floor`** (FAIL, when `brief.floors` is given; see C.4)
- The counts per level of each requested type match `brief.floors[level]`: for example `{"first": {"kitchen": 1, "bedroom": 2, "drawing": 1}}`.

**P-26 `plan.structure.wet_over_dry`** (WARN)
- An upper-floor bath that overlaps by more than 50% a bedroom, kitchen or drawing room below. Message: *"Bath over {room}: leaks and drain pipes run through its ceiling."* Lahore practice is to stack wet over wet.

**P-27 `plan.room.upper_open_space`** (INFO)
- An `open_space` on an upper level is built as a floored deck. Ask for a balcony or terrace, or a true light well (schema extension in A.3).

**P-28 `plan.room.bath_size`** (FAIL) and **`plan.room.dressing_size`** (FAIL)
- A bath needs 30 sq ft and 4′6″ clear width (master 40 sq ft); a powder room 15 sq ft and 3 ft.
- A `dressing` needs a short side of at least 5 ft (a 2 ft wardrobe plus a 3 ft aisle) and at least 25 sq ft; smaller, the
  engine has nowhere to put the wardrobe. Fix: take the space from its bedroom, or drop it for a wardrobe wall.

### A.2 Checker bugs to fix alongside

- `lda.glazing()` must use P-01/P-02 validity (see A.0). `plan.opening:*` becomes a FAIL.
- `room.access`: a room with only an `open_to` to a non-adjacent room currently passes. Use G connectivity (P-08) instead.

### A.3 Schema additions (optional, backward compatible)

```ts
// contracts/plan.ts
export interface Site { /* … */ parking?: { id: string; rect: Rect; car: "sedan" | "suv" }[] }  // bays ≥ 9×18 ft
export interface Roof { /* … */ solar?: { rect: Rect }[]; water_tank?: { rect: Rect; height_ft: number; kind?: "plastic" | "rcc" } }
export type RoomType = /* … */ | "lightwell";   // void through the floor; engine guards it, roof open above
```

---

## Part B: Engine invariants (always enforced, whatever Argon writes)

Each invariant names the code to change, the algorithm and an acceptance test. Run the as-built results through `lda.check_asbuilt` (new check ids below), so the user sees anything the engine had to repair or could not repair.

### B.1 Fall protection: guards on every stair void edge and open landing edge

Replace the proximity heuristics with a rule based on **drop height and openings**.

**B.1.1 Stairwell rails.** Change `stairs-geo.ts` L116 to L133. For each edge run of `CellGrid(lay.holes)` on `holeLevel`:

1. `spans = openSpans(axis, c, a, b, upper.id)` (unchanged: parts with no wall within 0.6 ft).
2. Subtract **only** the arrival opening. That is the interval `[f2.c0, f2.c1]` on the edge line through the top riser of the last flight (`end2` for a dog-leg, `end` for a straight flight). For an L-shape it is the flight-2 width at its end.
3. Subtract the across-range `[F.c0, F.c1]` of any flight `F` that **starts on this level** and crosses the edge line (stacked stairs). A rail must not block the next flight up; that flight's balustrade continues the guard.
4. Draw a rail on every remaining sub-span at least 0.2 ft long. Height is 3.5 ft above `upper.elev` (IBC 42 in). Extend each end 0.15 ft so rails meet walls and balustrades with no gap.
5. Delete the `Math.hypot(...) < 2.6` skip.

**B.1.2 Flight balustrades.** Change `stairs-geo.ts` L58 to L85:
- `gapEnd = 0` always.
- `gapStart = 2·T` only if the strip 0.5 ft beside those treads on the flight's `from` level is solid slab, not a hole (`!inHole(fromLevel, pt)`). On a stacked stair it is a hole, so the gap is 0.
- If the well width `|f1c − f2c| ≥ 0.33 ft` (4 in), both well sides get a full-length balustrade and the landing's well edge gets a rail.
- Height is 3.0 ft above the nosing line (34 to 38 in), as today.

**B.1.3 Colliders.**
- Register every railing, balustrade and stringer mesh as a walk collider: `ctx.collider(mesh)` for the stair railing kit.
- Keep treads `collide=false`, since the ramp colliders do the walking.
- Split the stair `Kit` into a `treadKit` (non-colliding) and a `railKit` (colliding).
- Balusters at ≤ 0.33 ft centres (`railings.ts` L63: `len / 0.32`).

**B.1.4 Catch-all drop guard (new pass `buildDropGuards` after `buildStairs` and `buildDeckRailings`).**
1. For each level, build the walkable-surface grid: slab cells minus holes, plus landings and deck floors, each with its surface height.
2. For each boundary edge of a walkable region, find the surface across it: the floor below, the landing or flight below (via the hole chain), or the ground.
3. If the drop is more than 2.5 ft (30 in) and no wall, parapet or railing collider lies within 0.25 ft of the edge, add a 3.5 ft railing.
4. Emit `asbuilt.guard_added:<level>:<n>` (INFO) for each one.

This covers stair voids, roof edges without a parapet, deck-to-lower-roof steps and future light wells.

**Acceptance.** On all three audited houses, `audit_plans.py`'s `B1.*` findings drop to zero. Then, in walk mode on the 1-kanal house, walk from the first-floor arrival toward each void edge: the walker must be stopped by a collider and never fall more than `STEP_UP`.

### B.2 Stair layout: code-compliant geometry and stacked handedness

Change `structure/model.ts` `layoutStair` L664 to L802:
1. Never let `T < max(s.tread_in, 10)/12`. When the flight does not fit:
   - first shift the stair inside its room on **both** levels (the from room and the to room or mumty);
   - if it still does not fit, build at code-minimum `T` beyond the rect but within the stair room. If the stair room is too short, mark `lay.misfit` and emit `asbuilt.stair_fit:<id>` (FAIL, *"stair needs {req} ft, room gives {have} ft"*).
   - Remove the silent compression at L741 to L746.
2. Set `Lmin = max(3.0, wf)` (landing at least the flight width) at L740.
3. **Stacked handedness.** Compute `arriveHigh` once, for the lowest stair of a stack (stairs whose rects overlap by more than 80%), and reuse it for every stair above.
   - The roof stair must not derive it from the mumty door.
   - With the door placed after layout (B.3), this removes the circularity at L720 to L735.
4. The 2.95 ft foot strip (L680 to L709) is checked on the **to** level as well: the arrival zone Z must also be at least 3 ft inside the stair room or mumty.

### B.3 Mumty: covers the stair, has a top landing, has a door at the top landing, and a flight reaches it

Change `plan/model.ts` L244 to L264 and `structure/model.ts` `placeOpenings` L281 to L297. Move the mumty door placement to **after** `computeStairs()`.

1. **The top flight exists.** If storeys > 0 and no stair goes from the top storey to the roof, synthesise one: copy the topmost stair with `from = top`, `to = roof`. Warn `asbuilt.roof_stair_added`.
2. **The mumty exists and covers the stair.** `M = union(plan mumty rect, laidOutRect(topStair) ⊕ wall 0.375, Z(topStair))`, clipped to the top storey's enclosed footprint.
   - Treat an enclosed roof-level room that contains the top stair centre as the mumty (instead of skipping synthesis at L248).
   - Holes on the roof level never extend outside M.
3. **Door side.** Let `Z` = the top landing on the roof: from the inner face of M's start-end wall to the top-riser line of the last flight (`end2`), across the **full** stair breadth. This is solid roof slab, because the roof hole starts at `end2`. Z must be at least 3 ft deep; if it is shallower, apply the growth step below first.

   Candidate walls `S` are the walls of M:
   - whose centre line lies within `t/2 + 0.1` ft of Z's boundary;
   - whose contact length with Z is at least door width + 0.6 ft (3.6 ft);
   - that are not on a party plot edge;
   - whose outside strip (door width + 1 ft by 3 ft) lies on roof slab and outside every hole, the water tank and the parapet band.

   Choose:
   - `plan.door_side` if it is in S;
   - else the start-end side if it is in S;
   - else the side with the longest contact;
   - ties go to the side facing the larger open roof area.

   If S is empty, grow M by 3.5 ft at the start end (if that is not a party wall and the slab below exists), else along the last flight's outer side, then recompute.
4. **Door position.** Centre it on the contact interval between Z and the chosen wall, clamped to leave 0.3 ft jambs. Width 3 ft, sill 0 at the roof finished level, swinging out.
   - Add it even when other roof-level openings exist (remove the `!list.some(...)` guard at L294), unless a plan opening on M already touches Z.
5. **Threshold check.** The 3×3 ft inside the door must be walkable floor, not a hole. Otherwise emit `asbuilt.roof_door_over_void` (FAIL); this should never happen after steps 2 to 4.

**Acceptance.**
- 1-kanal: the left side is a party wall and the back strip hits the tank, so the door goes on the **front** wall (y=54), centred near x≈2.3. That is beside the arrival at (3, 56.5); Z is 3.8 ft deep.
- fixture: Z is only 2.05 ft deep. M grows 3.5 ft forward to y=24.5 (that roof slab sits over Bath 2 and the corridor), and the door goes on its front wall.
- argon-v1: M grows to y ≥ 41.5 to cover the shifted stair. The right side keeps the door: its contact is 3.6 ft and the door is at (8, 28.2).

### B.4 Furniture keep-out zones (doors, openings, windows, stairs)

Add `keepOut(ctx, room): Zone[]` in `furniture/place.ts`, cached per room and computed after the structure is built. Zones are rectangles in plan feet, each with a `kind`.

| Zone | Size | Applies to |
|---|---|---|
| Hinged door, swing side | (width + 1.0) × max(3.0, leaf + 0.5) | all floor items |
| Hinged door, other side; sliding door or arch, both sides | (width + 1.0) × 3.0 | all floor items |
| Door or window on the wall, along that wall | [u0 − 0.3, u1 + 0.3], full height | **all wall items** (tv, painting, mirror_wall, ac_split, towel_rail); curtains exempt |
| Window, against its wall | [u0 − 0.3, u1 + 0.3] × 2.0 ft | floor items taller than the sill − 0.1 ft (wardrobe, bookshelf, fridge, tv_unit with tv, sideboard, kitchen tall units) |
| `open_to` edge | 3.5 ft "gate" centred on the shared-edge midpoint (or on the line between the two rooms' main doors), 3.0 ft deep on both sides | floor items |
| `open_to` edge | the whole edge | wall items (there is no wall) |
| Stair | rect + 0.5 ft, plus F(s) on `from`, plus Z(s) on `to`, plus 1.0 ft along every void edge | floor items |
| Mumty door, roof tank | 3×3 ft each side of the door | floor items, tank |

Placement policy, which replaces `place.ts` L142 and L177 to L256:

1. **Wall items.** Use `solidIntervals(room, side)`: wall runs on that side minus the openings ±0.3 ft, minus gaps where no wall exists. Snap `u` to the nearest interval of length ≥ `w + 0.2`.
   - If there is none, try the opposite wall and then the adjacent walls.
   - If that fails, drop the item with a warning (`asbuilt.furniture_dropped`).
   - Never snap to a run that contains the opening.
2. **TV pairing.**
   - A `tv` in a room with a `tv_unit` against the same side takes `u = unit.u` (after the unit's own placement) and `mount = unit top + 0.9`.
   - The same applies to `mirror_wall` over a dresser, dressing table or vanity, and `painting` over a sofa, sideboard or console.
   - Defer paired wall items to `ctx.endOfSection`.
3. **Floor items.**
   1. On the requested wall, slide ±(wall length) in 0.25 ft steps.
   2. Then the opposite wall, then the adjacent walls, keeping the item's facing.
   3. Then shrink `w` by up to 15% for wardrobes, sideboards and kitchen counters.
   4. Else drop the item and warn.

   Never leave an item intersecting a keep-out zone; today `best === null` leaves it overlapping (L250).
4. **Free-standing items** (`at`) search a spiral up to 4 ft (today 3 ft) and then drop.
5. Wardrobes and TVs are **never** across a door or window. This follows from rows 3 and 4 of the zone table plus steps 1 to 3.

**Acceptance.** On all three houses: zero `F1`, `F2` (doors) and `F4` findings after the engine runs. Test this by reading `ctx.items` against the zones in a vitest using the three fixtures.

### B.5 900 mm walking paths

Add a new post-section pass `ensurePaths(ctx, room)`, run from `ctx.endOfSection` after each `furnish_*` section, on the open-plan cluster (rooms joined by `open_to`).

1. Build an occupancy grid at 0.25 ft. Obstacles are all floor items except rugs and prayer mats, with dining tables inflated by their chairs (+1.8 ft).
2. Inflate obstacles by **1.5 ft** (half of 900 mm) and walls by 0.6 ft.
3. Entries:
   - one point 1.5 ft inside each door;
   - each `open_to` gate;
   - each stair's F or Z inside the cluster;
   - the mumty door.
4. All entries must lie in one connected component.
   - In bedrooms, allow 1.25 ft inflation (750 mm) between a bed and a wall on the bed's non-entry side.
   - The bath door must be reachable at 900 mm.
5. If they do not:
   1. find the item whose removal reconnects the most entries (the smallest footprint wins ties);
   2. relocate it with B.4 step 3;
   3. else drop it.

   Repeat up to 4 times. Emit `asbuilt.path_blocked:<room>` (WARN) if it is still disconnected.

**Acceptance.** The `F5` findings in `audit_plans.py`, re-run against final positions, reach zero.

### B.6 Parking bays and the gate-to-door walkway (cars)

1. Bays come from `site.parking` if present. Otherwise derive them as in P-15: 9×18 ft, nose-in towards the house, beside the porch edge farthest from the doors that face the porch.
2. Any `car_sedan` or `car_suv` furnish call snaps to the nearest free bay (centre, rotation along the bay's long axis). If no bay is free, drop the car and warn. `auto.ts` `porch()` (L550 to L560) uses bays too.
3. The walkway from P-15 is a keep-out zone for all porch, driveway and lawn items: plants, swings, cars and motorbikes.
4. Spawn: `build.ts computeSpawn` (L191 to L227) starts **on the walkway**, 7 ft before the main door, facing along it. Accept a candidate only if a ray from eye height (1.6 m) to the door centre misses every furniture collider. Otherwise step back along the walkway.
5. Optional (viewer, walk mode): fade furniture and cars to 25% opacity while they sit within 1 m of the camera or between the camera and the HUD's target.

### B.7 Openings are cut only into the right wall

Change `structure/model.ts` `placeOpenings` L298 to L322:
- accept a run only if `miss === 0`: both named rooms match, or the named room plus `run.kind === "exterior"` for `exterior`;
- the distance limit is 1.5 ft;
- reject openings whose `between` rooms are on another level;
- skipped openings go to `asbuilt.opening_skipped:<id>` (WARN), shown in the as-built panel.

This stops the Bed 3 ↔ Bed 5 glass door and the bath ventilator opening into the lounge.

### B.8 Roof: solar-ready, tank and door clearances

1. Free-roof as-built check `asbuilt.roof_free_area`:
   - the area is the roof slab minus the mumty, tank and every facade or custom object whose bounding box on the roof level rises more than 1 ft above the slab and lies inside the parapet line;
   - WARN if below 55% when `brief.roof.solar != "none"`, or below 40% otherwise;
   - name the offending objects (for example the 1-kanal "cupola").
2. Domes, cupolas, minarets and pergolas on the roof are allowed only if `brief.roof.features` lists them; otherwise the as-built check flags them for removal.
3. The water tank follows `roof.water_tank.kind`:
   - `plastic`: a blue ribbed cylinder on the mumty roof (`buildWaterTank` already supports it);
   - `rcc`: a rendered concrete box on the roof slab;
   - either way, 3 ft clear of the mumty door strip.

### B.9 Upper-level open space

`open_space` above the ground floor stays a deck (today's behaviour) but is labelled "light court". The new `lightwell` type cuts a hole through the slab below it, down to the next floor that has a roof. B.1.4 guards it automatically.

---

## Part C: Prompt changes

### C.1 Planner (`api/app/agents/architect.py` `PLAN_SYSTEM`, L95 to L133)

Insert after the `Openings:` bullet (L106 to L108). The text is verbatim:

```
- OPENINGS (checked, FAIL): both rooms in `between` are on the opening's level and share the wall the opening sits
  on; the opening + 0.3 ft on each side fits inside that shared wall. Never point an opening at a room on another
  level (a roof terrace does not light a first-floor room). open_to only between rooms that share ≥ 3 ft of edge;
  never on a bedroom or bath. Put doors 0.5–1 ft from a room corner, not mid-wall.
- ROOM INDEPENDENCE (checked, FAIL):
  - A bedroom (any bedroom, guest room or servant room) has doors ONLY to: a corridor, lobby, stair hall, lounge or
    dining; its OWN attached bath; its OWN dressing; its OWN balcony/terrace. Never to another bedroom, a kitchen, or
    a bath that has another door.
  - An attached bath has exactly one door, into its own bedroom. The master bath opens into the master bedroom.
    A common bath/powder opens onto a corridor, lobby, lounge or the drawing room; never into a kitchen or dining.
  - Every room is reachable from the main door through circulation only (lobby, corridor, stair hall, lounge,
    dining). Never route through a bedroom, bath, kitchen or the drawing room. If a bedroom touches no circulation,
    add a corridor ≥ 4 ft wide (centre-line) that touches every such bedroom's wall.
  - The family enters by the main door into a lobby or the lounge and reaches the lounge without crossing the
    drawing room; guests reach the drawing room from the porch or lobby without crossing family rooms.
- KEEP ONE SOLID WALL per lounge/drawing (≥ 8 ft) and bedroom (≥ 9 ft; master ≥ 10 ft) with no door or window:
  it carries the TV/sofa or the bed headboard. Group doors at corners and windows on the outside wall.
```

Replace the `Levels:` bullet (L115 to L116) with:

```
- Levels: ground (index 0, elevation = plinth, e.g. 1.5), first, second as needed, then a final "roof" level whose
  height_ft equals the parapet height.
- STAIRS (checked, FAIL; these are life-safety rules):
  - One stair per level transition INCLUDING top storey → roof. All stairs stacked: identical rect, kind and start.
  - Size for 11 ft floor-to-floor: 19 risers of 6.95 in, treads 10 in, flights 3.5 ft. Dog-leg rect = 7.5 ft
    (2 × 3.5 + 0.5 well) × 11 ft along `start` ((10 − 1) × 10 in + a 3.5 ft mid-landing). Never smaller.
  - A dog-leg STARTS and ARRIVES at its start edge (the min-y edge for start "+y", max-y for "-y", min-x for "+x",
    max-x for "-x"). The stair room on EVERY level = the stair rect + ≥ 3.5 ft clear at that start edge across the
    full breadth (≥ 8 × 14.5 ft for the numbers above). That strip is the foot landing below and the arrival landing
    above: keep it free of doors that swing into it, and connect it to the floor (open_to a lounge/corridor or a
    door).
  - On upper floors the stair room is circulation (stair/lobby/corridor), never part of a bedroom. No door opens
    onto the stairwell itself; doors open onto the landing strip.
- ROOF (checked, FAIL):
  - roof.mumty.rect = the top-floor stair room rect (covers the stair AND its 3.5 ft top landing).
  - roof.mumty.door_side = the stair's START-END side (front for "+y", back for "-y", left for "+x", right for
    "-x"). If that side is a party wall (zero setback), use the long side the last flight arrives beside and keep
    the mumty ≥ 3.5 ft longer than the stair at the start end. Never a side that faces the far (mid-landing) end.
  - Water tank: follow brief.roof.water_tank ("plastic" → on the mumty roof, rect inside the mumty; "rcc" → on the
    roof slab next to the mumty), ≥ 3 ft from the mumty door.
  - Keep the roof clear for solar unless the brief asks otherwise: no domes, cupolas, minarets or pergolas; mumty and
    tank in one corner, ≥ 55% of the roof footprint free.
- PARKING: one 9 × 18 ft bay per car inside the porch (list them in site.parking), plus a ≥ 3.5 ft walkway from the
  pedestrian gate to the main door that no bay crosses. No porch door may open into a bay; put the family door on the
  porch side wall beyond the bay or widen the porch.
- PER-FLOOR PROGRAM: if brief.floors is given, put exactly those rooms on each floor (for example a second kitchen or a
  drawing room upstairs for a joint family).
```

Append to the `DAYLIGHT SELF-CHECK` (L125 to L132): *"Only openings on the room's OWN exterior wall on the SAME level count. An opening onto a roof terrace from the floor below is invalid."*

Replace the closing self-check (new last bullet):

```
- FINAL SELF-CHECK before answering, room by room: (1) every door's two rooms share the wall it sits on; (2) no
  bedroom opens into a bedroom, kitchen or another room's bath; (3) every room is reachable without crossing a bedroom,
  bath, kitchen or drawing room; (4) each stair has its 3.5 ft landing strip on both levels, the stairs stack, and one
  reaches the roof; (5) the mumty covers the top stair and its door is on the start-end side; (6) each lounge and
  bedroom keeps its solid wall; (7) daylight from same-level exterior walls only.
```

Few-shot fix: `contracts/fixtures/plan-10-marla.json` fails P-21 and P-23.
- P-21: the stair room is exactly 12 ft, leaving a 0.5 ft foot strip in the plan. As built, the engine squeezes the treads to 9.5 in to win 1.25 ft.
- P-23: the right-side door straddles the top riser.

The rect itself only just passes P-20 (11.0 ft needed, 11.0 ft given). Argon copies this fixture, so re-plan its stair core before relying on it as the example:
- the stair room must be ≥ 8×14.5 ft on both floors, with the 3.5 ft strip at the start edge;
- with start `"+y"` that strip eats into the porch below (leaving it too short for a car) and into Bath 2 and the corridor above;
- flipping to `"-y"` would put the mumty door over the first-floor terrace, which has no roof slab;
- so regenerate the fixture with the new rules and hand-check it;
- `mumty.rect` must equal the first-floor stair room, and `door_side` must be the start-end side (`"front"` for `"+y"`).

Also give the master bedroom its own bath in `argon-v1-plan.json` if it is kept as a fixture.

### C.2 Builder (`BUILD_SYSTEM`, L208 to L233, and `_build_prompt`, L236 to L247)

1. **Inject a ROOM SHEET** so Argon never has to work out wall geometry itself. `_build_prompt` appends `_room_sheet(plan)`, which shares the planning module's geometry. One block per furnished room:

```
ROOM g_lounge "Family TV Lounge" lounge 30×14 ft, level ground, floor 1.5   (1-kanal; real numbers)
  front (y=40; along_ft from x=45 → x=15): solid 0–5.7, 12.3–20.95, 24.05–30
        window g_lounge_w2 along 6–12 (to porch); door g_powder_d along 21.25–23.75 (keep-out 3 ft deep)
  back  (y=54; along_ft from x=15): OPEN to g_dining, no wall items; keep the gate along 13.25–16.75 clear
  left  (x=15): OPEN to g_stair, no wall items
  right (x=45; along_ft from y=54): solid 0–2.7, 11.3–14; sliding_door g_lounge_w1 along 3–11
```

   - `along_ft` intervals are given in the SDK's own convention (from the wall's left end as seen from inside), so Argon copies numbers instead of mirroring them.
   - Porches list their `site.parking` bays and the walkway.
   - The stair hall lists F and Z.

2. Add to `BUILD_SYSTEM` (after item 4):

```
FURNITURE CONTRACT (the engine enforces it; violations are moved or deleted):
- Use the ROOM SHEET. Put wall-hugging items only inside a listed "solid" interval on that wall, centred so the whole
  width fits. Never a TV, painting, mirror or AC over a door or window, and never on an OPEN side.
- TV + tv_unit: same `against` and the same along_ft, on the lounge's longest solid interval, facing the seating.
  Sofa faces the TV with ≥ 3 ft between the sofa front and the TV unit.
- Wardrobes, bookshelves, fridges and tall units: solid intervals only, never across a door or window.
- Bed: headboard on the longest solid wall, not under a window if avoidable; ≥ 2.5 ft on the entry side and at the
  foot; side tables inside the same interval.
- Keep every door's keep-out (3 ft deep, door width + 1 ft) and the stair foot/arrival zones empty. Leave a 3 ft path
  linking all doors of each room and across every open-plan gate.
- Cars: exactly one per listed parking bay, `at` = bay centre, rot along the bay; nothing on the walkway.
- Roof: keep it clear for solar. No domes, cupolas, minarets, chhatris or pergolas unless the brief lists them in
  roof.features; the water tank is built from the plan.
```

3. `_build_prompt` L244: add `roof`, `parking` and `floors` to the brief keys it forwards. Today it forwards only style, style_notes, budget, notes and spaces, so the builder never sees the roof or parking preferences.
4. Item 4 currently says *"Place key pieces explicitly with `against`/`along_ft` or `at`/`rot_deg` in room-local feet"*. Add: *"…using the ROOM SHEET numbers."*
5. Neighbours: the user reports neighbouring houses blocking the orbit view. Until the viewer fades occluders (B.6 step 5, applied to `landscape` neighbours too), change item 5 to `s.landscape.street({ neighbours: false, streetlights: true })`. After that, restore `neighbours: true`, because the context helps the render.

### C.3 Fix-loop message (`architect.make_plan`, L196 to L205)

Replace the user turn with grouped, actionable text:

```
The plan checker found these problems. Fix every FAIL; keep everything else unchanged.
SAFETY (stairs, roof, guards):
- [FAIL] plan.roof.mumty: The roof door is on the right side, away from the top of the stair. Use the front side.
  Fix: door_side = start-end side …
PRIVACY & CIRCULATION:
- [FAIL] plan.privacy.bedroom_door: Bedroom 4 opens directly into Bedroom 3. Fix: give Bedroom 4 a door onto a corridor …
LDA:
- …
Return the corrected COMPLETE BuildingPlan JSON.
```

Each line is `[STATUS] id: message Fix: hint (ids: …)`, with the hints from Part A.

### C.4 Brief fields the setup agent should collect (`api/app/agents/intake.py`)

These feed P-24, P-25 and B.8. Ask them as optional one-tap chips, with a "decide for me" default:
- `roof.water_tank`: `"plastic"` (blue PVC on the mumty, the default) or `"rcc"` (structural concrete).
- `roof.solar`: `"none" | "ready" | "install"`. The default is `"ready"`, which keeps 55% of the roof free.
- `roof.features`: `[]` by default. Domes and minarets only when asked.
- `floors`: an optional per-floor program, for example `{"ground": {"drawing": 1, "kitchen": 1, "bedroom": 1}, "first": {"kitchen": 1, "bedroom": 3}}`.
- `parking.cars` (1 to 3) and `parking.suv` (bool).

---

## 2. Implementation order and tests

1. **B.1 guards and colliders, plus B.3 mumty door and cover.** These are life safety and the most visible in the walkthrough.
2. **B.7 strict opening placement**, plus P-01/P-02 and the `lda.glazing` fix. These stop cross-level "daylight" and the doors cut into the wrong wall.
3. **P-05 to P-10 privacy and circulation**, plus the C.1 prompt and the C.3 loop message.
4. **B.4 keep-outs, B.5 paths, B.6 parking**, plus the C.2 room sheet and the furniture contract.
5. **P-17, P-20, P-21, P-23 to P-25**, plus fixing the few-shot fixture (C.1).

Tests:
- `api/tests/test_planning.py`: the three plans in this audit, asserting the rule ids listed in §0. The 1-kanal plan must FAIL P-01, P-05, P-08, P-10, P-04 and P-23; argon-v1 must FAIL P-06 (master bath) and P-23 (the mumty does not cover the 18 ft stair room); the fixture must FAIL P-21 and P-23.
- `web/src/engine/**/*.test.ts`: build each fixture headless and assert:
  1. no walkable edge with a drop over 2.5 ft lacks a collider within 0.25 ft;
  2. the mumty door's inside 3×3 ft is floor;
  3. no wall item's u-interval overlaps an opening on its wall;
  4. no floor item intersects a door keep-out;
  5. one connected 900 mm component per room;
  6. cars inside bays, with a line of sight from spawn to the main door.
