# Round 1: end-to-end design and senior architect review

- **Tester:** round-1 architect E2E agent
- **Date:** 17 Oct 2026
- **App:** https://naqsha-242926648187.us-central1.run.app (`/app`)
- **Evidence:** `docs/review/round1-architect-e2e/` (numbered JPG/PNG captures referenced below)

## How this was tested

I ran one new design end to end as a guest. The first message was:

> 10 marla plot (35x65 ft) in Johar Town Lahore, north-facing, mid-row with neighbours on both sides. Family of six … 2 storeys plus a roof mumty. 4 bedrooms total. Ground floor: drawing room near the gate, dining, family TV lounge, kitchen, parents' bedroom with attached bath (parents can't climb stairs), powder room, porch for 2 cars. First floor: master bedroom with attached bath and dressing, 2 kids' bedrooms each with attached bath, a small upper lounge and a front balcony. Modern minimal … Concrete water tank on the roof and rooftop solar for 5 kW …

From there the run went through Brief, Concepts (Day and Night), "Plan this one" with concept B, the Plan, and finally the House, where I used both Orbit and Walk.

- **Project:** `p_cc0da837ae56`, version `v_13073711d71e`.
- **Samples:** I walked both of them at the version users see:
  - the 10 marla sample at `v_49e64e194d41`, through clone `p_0dca02d101d0`;
  - the 1 kanal sample at `v_1c5e1f09b906`, through clone `p_4e01a962c3ae`.
- **Plans:** each plan was also read from `GET /api/projects/{pid}/versions/{vid}`, so I could check doors, `open_to` and stairs against the walk.

**Harness limitation.** The browser pane's window was covered by the other testers' tabs, so `computer.screenshot` timed out, and coordinate clicks landed at the wrong scale. I drove the app in three ways instead:
- DOM `click()`;
- synthetic `PointerEvent`/`KeyboardEvent`. Walk was driven with WASD plus drag-to-look; position was read from the minimap marker's `translate(x, D−y) rotate(yaw)`;
- WebGL canvas captures. Each capture was uploaded as my own test project's version thumbnail and downloaded again. At the end I restored that thumbnail to an exterior view.

Pointer lock could not be exercised; I tested the drag-to-look fallback instead. Every finding below was reproduced, and none of them depends on this harness.

## The run: timings and narration

| Stage | Time | What I saw |
|---|---|---|
| Setup | ~10 s | The brief was fully understood from one message: mid-row, faces N, 2 storeys, 4 beds, a 2-car porch, a concrete tank and solar panels. It produced a per-floor program (Ground: 1 bed, drawing, dining, TV lounge, kitchen; First: master, 2 beds, TV lounge, balcony) and a "Guaranteed" list with the 3 livable promises. The reply reads "I have recorded your 10 marla brief…", not the spec's "Here's what I understood". |
| Concepts | ~25 s | All 4 concepts are **mid-row with neighbours on both sides**. Night versions arrived ~25 s after the toggle, with the same camera and lights on. `?light=night` persists. |
| Plan → Check → Review → Build | **694 s (11.5 min)** | The narration was clear: "Laying out the floors", "Fixing 5 problems (round 2 of 4)", "Reviewing the drawings like an architect", "Improving the plan: …", "Re-checking the improved plan…", "Kept the checked plan; the suggested changes would have broken a rule.", "Building the 3D model · n parts". Fix history: 5 → 2 → 1 → 4 → 1. |

The result is v1 at **37/37 LDA · 8/9 livable**, with one rule still failing and five as-built notes.

## My design (`p_cc0da837ae56` v1): architect's review

Plan as drawn (feet, y measured from the road):

| Floor | Room | x0–x1 | y0–y1 | Door(s) |
|---|---|---|---|---|
| Ground | Car Porch 16×18 | 0–16 | 10–28 | Main door to the TV Lounge at (13.95, 28); drawing room double door at (16, 20) |
| Ground | Drawing Room 14×18 | 16–30 | 10–28 | Porch, and the TV Lounge at (20, 28) |
| Ground | Dining 8×15 / TV Lounge 14×15 / Stair Hall 8×15 | 0–8 / 8–22 / 22–30 | 28–43 | Open to each other |
| Ground | Kitchen / Parents' Bedroom / Powder + Parents' Bath | 0–11 / 11–24 / 24–30 | 43–58 | Powder door **on the stair hall's rear wall at (27, 43)** |
| First | Bedroom 2 + Bath 2 + Passage / Master + Master Bath + Dressing / Front Balcony | front band | 10–28 | Bed 2 opens to the Passage, the Master to the Lounge |
| First | Family Lounge 22×15 / Stair Hall | 0–22 / 22–30 | 28–43 | |
| First | Rear Terrace / Bedroom 3 / Bath 3 6×15 | 0–11 / 11–24 / 24–30 | 43–58 | |
| Roof | Mumty 22–30 × 28–43, door on the front side; concrete tank behind it; solar 18×26 | | | |

### What is right
- **Bedroom privacy.** No bedroom opens into another bedroom. Every bath opens only into its own bedroom: Bath 2 to Bedroom 2, Bath 3 to Bedroom 3, the Master Bath to the Master, the Parents' Bath to the Parents' Bedroom. The powder room opens onto the stair hall.
- **Stair void guards on the first floor.** The edge facing the Family Lounge (x = 22) is guarded. In the walk I pushed toward the void at y ≈ 34, 38, 40 and 42 and was stopped at x ≈ 21.3 every time. The roof flight's inner edge is also guarded with glass and a handrail.
- **Stair to the roof.** The stair reaches the roof, and the mumty door is at its top landing at roof-floor level (evidence 13). The floor stack's **R** button glides you up the stair to that door.
- **Guards at drops.** The front balcony has a glass guard with a cap rail (11). The rear terrace has a glass guard (12). The roof parapet is 3.5 ft.
- **TV placement.** No TV is across a door. In the ground TV Lounge, the TV sits beside the Parents' Bedroom door (10). In the master bedroom, it sits between the dressing arch and the bath door (09).
- **Roof.** Solar panels on tilted frames are present (14).

### Defects (with room names)
1. **The main door was never built (blocker).** The plan, the PDF and the room hover all show a main door from the **Car Porch to the TV Lounge** at x 12.2–15.7.
   - The 3D wall there is solid (01–04). The engine logged `opening g_main_door: overlaps another opening, skipped`. The cause: the lounge window `g_lounge_w` (x 8.5–12.0) is placed first, and the door then can't keep the 0.3 ft gap and still clear the corner of the drawing room wall at x = 16.
   - **Consequences:**
     - Walk spawns facing a blank wall.
     - The only way in is through the **Drawing Room**, which breaks the "family route" rule the plan passed.
     - No as-built note mentions it, and compliance still reads 37/37.
2. **The Powder Room door opens under the stair's mid-landing (major, life-safety and usability).**
   - The dogleg's first flight runs up the east half and lands across the back wall of the Stair Hall, about 5.5 ft above the floor. The **Powder Room** door at (27, 43) is directly beneath that landing (05, 07).
   - In Walk you **cannot leave the powder room**: you stop at the threshold with your face against the underside of the landing (06).
   - The plan rules ("Doors and windows fit their walls", "Every room has a proper way in") both pass.
3. **The per-floor program rule gives a false failure (major).**
   - The brief's first floor is `master_bedroom:1, bedroom:2`: three bedrooms, which is exactly what was asked.
   - `planning.py::_program` compares `want["bedroom"] = 2` with `_count(here, "bedroom")`, which counts **every** bedroom type including the master, and gets 3. It reports "The First Floor should have 2 bedrooms (has 3)".
   - This burned fix rounds. Attempt 2 dropped a bedroom and then failed "Bedrooms as briefed".
   - The house ships at 8/9 livable. Its "Ask Naqsha to fix this" button would delete a bedroom the family asked for.
4. **The architect self-review was thrown away (major).** The review correctly found five real problems:
   - the **Dining** is 8 ft wide, too narrow for six with a 3 ft path;
   - **Bath 2** is landlocked with no ventilation;
   - the **Master Bath** sits over the **Drawing Room**;
   - **Bath 3** is a 6×15 "bowling alley";
   - the **Powder Room** door faces the lounge.

   The revision was rejected (`rejected_because`: `plan.program.floor:first`, `plan.program.bedrooms`, …), and the dock said "Kept the checked plan". None of the five was applied, and none is shown to the user as an open item.
5. **Bath 2 has no ventilation, yet LDA reads 37/37 (major).** Bath 2 (first floor, 7×5) has 0 sq ft of opening.
   - The sheet shows it as a warning inside "Ventilation **5/5**".
   - The headline claims full LDA compliance.
   - The 10 marla sample has the same Bath 2.
6. **The 2-car porch fits one car (major).** The brief asked for a 2-car porch. The porch is 16 ft wide, and the 3D parks **one** car (08). Nothing in the compliance sheet or the as-built notes says the brief was not met.
7. **Furniture and walkways (minor).**
   - The **Dressing** room has no wardrobe ("left out").
   - **Master Bedroom:** "furniture leaves less than 3 ft between some doors".
   - **TV Lounge:** the armchair and plant were dropped.
   - The rear terrace swing was dropped.
8. **Wet over dry (minor).** The Master Bath sits over the Drawing Room; it is only a warning.
9. **Stair window (minor).** The east flight climbs across the 6 ft stair window, whose sill is 3 ft above the ground floor. Near the landing, the glass sits below the stair user's feet, with no guard or safety-glazing note (07).
10. **Spawn faces a wall (follows from #1).** The walk starts in the Car Porch, facing a blank wall.

## Sample · 10 marla modern home (v2, the version users see)

What is right:
- **Main door and car.** The main door (Porch to TV Lounge) is built. Walk spawns at it, facing in (15). The one car leaves about 5 ft clear to the main door.
- **Stair guards.** The first-floor stair void is guarded: Walk stopped at x ≈ 8.7 at y 33, 36.5, 40 and 42.
- **Stair to the roof.** The stair reaches the roof, and the mumty door is at the top landing, with glass guards around the void (16).
- **Rooms and baths.** No bedroom opens into another bedroom, and the attached baths are correct.

Defects:
- **Bath 2 (first floor) is landlocked:** a 0 sq ft opening, shown only as a warning. **Bath 2 also sits over the Drawing Room.**
- **Twelve as-built notes**, including:
  - walkways under 3 ft in the **Dirty Kitchen**, **Parents' Bedroom** and **Master Bedroom**;
  - **Master Dressing** with no dresser;
  - the coffee table and water dispenser left out.
- **The TV Lounge TV is on the entrance wall,** about 1 ft beside the main door frame (17). It is not across the door, but everyone entering walks through the viewing line. This is polish.

## Sample · 1 kanal Spanish villa (v2, the version users see)

What is right:
- **Rooms and baths.** No bedroom opens into another bedroom. Every attached bath is correct: Bath 1, the Guest Bath, Bath 3, the Master Bath, Bath 4 and the Servant Bath.
- **Stair guards.** The first-floor stair void is guarded: Walk stopped at x ≈ 9.1 at y 30 and 34.6.
- **Stair to the roof.** The roof door on the right side of the mumty is at the top landing.
- **Roof terrace.** It has railings on its open edges (18).

Defects:
- **The covered "Kitchen Patio" (major).**
  - The Kitchen Patio (x 12.5–17, y 44–58) is labelled open space, but the first-floor **Roof Terrace** slab runs right over it (18).
  - The **Kitchen**'s only window and the **Prayer Room**'s only window face each other across this roofed 4.5 ft slot (19).
  - The daylight checks still pass.
- **The Master Dressing opens onto the Upper Family Lounge (major).**
  - Its only door is `f_master_dress_door` at (36, 41), so the dressing room is outside the master suite (20).
  - It is also empty: the wardrobe was "left out".
- **No car at all in a 2-car porch (major).** The brief says `car_porch:2`. The as-built note reads: "No parking bay is left that keeps the walkway from the gate to the main door clear, so the car in Car Porch was left out." The porch is empty.
- **Kitchen without a fridge (minor).** "The fridge was left out because there is no place for it."
- **Other notes (minor).** **Bedroom 3** has a walkway under 3 ft. The **Servant Bath** is 4′6″ × 16′, wasted corridor.

## User feedback checklist (architecture items)

| Feedback | Status |
|---|---|
| Stairs where you can fall: railings everywhere | **Fixed** on all three houses: void edges, roof flight, mumty landing, balcony and terraces |
| A bedroom opening into another bedroom | **Fixed** on all three houses |
| Roof door suspended in the wall; no stair to the roof | **Fixed**: the stair reaches the roof and the door sits at the landing. **But** a ground-floor door, the Powder Room's, is now blocked by the stair landing (new defect #2) |
| TV in front of a door or in a doorway | **Fixed** in every room I checked |
| Neighbours blocking the view | **Fixed**: they ghost in Orbit |
| Concepts always showing a corner plot | **Fixed**: 4/4 are mid-row |
| Day/night | **Works** |
| Per-floor program | The Brief shows it, but **the plan rule miscounts the master** (#3) |
| Water tank and solar | Captured from the message. Panels are on the roof; a concrete tank sits behind the mumty |
| Walk floor toggles | **Work**: they glide you up the stair |
| Walking space; cars blocking | Cars no longer block the door. **But** 2-car porches get one car or none, and seven rooms across the three houses still carry "less than 3 ft" or "left out" notes |
| Room navigator | **Works**: glides between rooms. Stair hall and Roof are not listed |
| Print/PDF | **Works**: A3/A4, floors, cover and compliance; 5-sheet preview with title blocks |
| Mouse look | Drag-to-look and WASD work. Pointer lock could not be tested in this pane |

## Other issues seen along the way
- **Misleading copy during the build.** While it was "Building the 3D model", the compliance sheet said "1 rule to fix. I'm fixing these now." The step label also went from "Reviewing" back to "Fixing 1 issue", and the livable total jumped from 9 to 10 to 9.
- **Bad version links hang the House view.** `?v=2`, the deep-link format written in DESIGN.md, leaves House stuck forever on "Opening the house…" with "Couldn't load that version / version not found". The app expects a version id and has no fallback to the current version.
- **Mobile walk copy and target size.** On a phone the dock says "press C to pin a note". The Orbit/Walk toggle is 30 px tall, under the 44 px target.
- **Ambiguous solar rule.** "Roof kept clear for solar · 60 (limit 55)" reads like a failure, but it is a pass.

## Verified OK
- One-message setup that fills the whole brief, including the per-floor program, tank, solar and the "Guaranteed" rules.
- Concepts: four mid-row concepts with neighbours on both sides, and lazy day/night pairs from the same camera.
- Plan pipeline narration: stages, fix history and review messages.
- Plan room hover, for example "Powder room · 6′ × 4′6″ · 27 sq ft · Opens to: Stair hall".
- Print dialog and a 5-sheet preview.
- Stair guards, the roof stair and the mumty door at the landing, plus balcony and terrace guards, on all three houses.
- No bedroom opens into another bedroom, and every attached bath opens only into its own bedroom, on all three houses.
- No TV across a door in the rooms checked.
- Neighbour ghosting in Orbit.
- The room navigator glide; floor buttons that take you up the stair.
- Drag-to-look and WASD movement.
- The 10 marla sample's main door, and its car leaving the entrance clear.
- No horizontal overflow at 375 px. The touch comment button and floor stack are present.
