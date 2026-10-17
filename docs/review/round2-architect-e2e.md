# Round 2: end-to-end design and senior architect review

- **Tester:** round-2 architect E2E agent
- **Date:** 17 Oct 2026
- **App:** https://naqsha-242926648187.us-central1.run.app (`/app`)
- **My design:** `p_13230dfcc54c`, version `v_8b24c71d0a58`. House: https://naqsha-242926648187.us-central1.run.app/app/p/p_13230dfcc54c/house
- **Samples walked:**
  - **10 marla:** `v_49e64e194d41`. This guest's copy is `p_0dca02d101d0`, which another tester renamed "Collab QA round 1". I opened it with `?v=v_49e64e194d41`.
  - **1 kanal:** `v_1c5e1f09b906`, in copy `p_4e01a962c3ae`.
  - Both sample versions are the same as in round 1. Only the engine and UI could have changed.

## How this was tested

### The run

I used one browser-pane tab at a 1280×800 emulated viewport, as a guest. I started from `/app` with a single message:

> 10 marla plot, 35 x 65 ft, in Wapda Town Lahore, south-facing, mid-row with houses on both sides. Family of five … elderly mother who can't climb stairs. Double storey plus a mumty with a stair to the roof. 4 bedrooms in total, every bedroom with an attached bath. Ground floor: car porch for 2 cars, drawing room near the gate with its own guest entry, dining, family TV lounge, open kitchen, my mother's bedroom with attached bath, and a powder room for guests. First floor: master bedroom with attached bath and walk-in dressing, 2 kids' bedrooms each with attached bath, a small family lounge and a front balcony. … Overhead water tank on the roof and 5 kW rooftop solar panels. Budget around 1.5 crore.

From there I went through Concepts (Day and then Night), chose concept A with "Plan this one", watched the pipeline, and opened the House in both Orbit and Walk.

### Plan analysis

- I read the plans from `GET /api/projects/{pid}/versions/{vid}`.
- I read the live run stream from `GET /api/projects/{pid}/run`, which replays every draft plan and compliance report.
- An in-page script checked every door's walls, the bedroom adjacency, the bath attachments and reachability from the main door.

### Walking the houses

- **Pointer lock:** the pane refused it, so the app fell back to "Drag to look around". I tested that fallback with real drags.
- **Movement and position:** I moved with synthetic WASD and drag events. I read my position from the minimap marker.
- **Railings:** I tested each guard by walking into it and recording where I stopped. My body is a 0.92 ft radius capsule, so a stop at 8.85 means a guard at about 7.9.
- **Captures:** I took full-resolution WebGL frames into an overlay for the evidence views. All of that was removed afterwards.
- **Phone width:** I checked the House at 375 px, then reset the viewport. My tab is closed.

## The run: timings and narration

| t (s) | Stage shown | Compliance chip |
|---|---|---|
| 0 | Setup: brief filled from one message in ~10 s. It showed the per-floor program, "Concrete tank in the stair tower", "Solar frame" and the six "Guaranteed" promises | |
| ~25 | Concepts: 4/4 mid-row with neighbours on both sides. Night versions took ~40 s, with the same cameras | |
| 4 | Plan: "Laying out the floors…" | |
| 71 | "Fixing 13 problems (round 2 of 4)…" | 34/37 LDA · **10/20** livable |
| 123 | "Fixing 4 problems (round 3 of 4)…" | 36/37 · **12/15** |
| 198 | "Fixing 1 problem (round 4 of 4)…" | 37/37 · **12/13** |
| 251 | "Reviewing the drawings like an architect…" (history "13 → 4 → 1 → 8 → 1") | |
| 272 | "Improving the plan: … provide the fourth bedroom requested in the brief, widen the cramped dining room …" | |
| 440 | "Re-checking the improved plan…". The step label falls back from **Review** to "Fixing 1 issue" | |
| 496 | **"Kept the checked plan; the suggested changes would have broken a rule."** | |
| 497–617 | "Building your home in 3D, **1 parts** so far" … 22 parts | |
| 617 | Done. Dock: "Your home passes all 37 LDA checks. Want to walk through it?" | 37/37 · 12/13 |

Total time from "Plan this one" to a walkable house: about **10 min 17 s**.

## My design (`p_13230dfcc54c` v1): what was built

Plan coordinates are in feet: x runs from the left party wall (0) to the 5 ft side space (30–35), and y runs from the road (0) to the rear (65).

| Floor | Rooms (x / y) | Doors |
|---|---|---|
| Ground | Drawing 0–13/10–26 · Car Porch 13–30/10–26 · Stair Hall 0–8/26–41 · TV Lounge 8–22/26–41 · Dining 22–30/26–41 · Open Kitchen 0–12/41–58 · Mother's Bedroom 12–24/41–58 · Powder 24–30/41–46.5 · Attached Bath 24–30/46.5–58 | Main door Porch→Lounge (15, 26); guest door Porch→Drawing (13, 21); Powder→**Dining** (26, 41); Bath→Mother's Bedroom |
| First | **Study Room** 0–13/10–21 · Bath 2 0–8/21–26 (door to Passage) · Passage 8–13/21–26 · Front Balcony 13–30/10–14 · Master 13–24.5/14–26 · Master Bath · Walk-in Dressing 24.5–30/21.5–26 · Upper Lounge 8–30/26–41 · Rear Terrace 0–12/41–58 · Rear Bedroom 12–24/41–58 · Bath 3 24–30/41–58 | Master→Lounge; Rear Bedroom→Lounge; Study→Passage |
| Roof | Mumty 0–8.1/26–41.1, door on the front wall at the top landing · concrete tank 0.5–6.5/41.5–47.5 · solar 10–28/14–30 | |

### What is right (verified in the plan and by walking)

- **Bedroom independence.** No bedroom opens into another bedroom. Every attached bath opens only into its own bedroom. The Bath 2 door opens to the Passage, as a common bath.
- **Main door and entrance.** The main door is built. Walk spawns in the porch, 6.5 ft in front of it and facing it.
- **Car.** With Cars shown, the car sits on the east side of the porch. I walked unobstructed from the pedestrian gate (15, 5) straight through the main door to (15, 30).
- **Stair guards on the first floor.** Pushing west from the Upper Family Lounge toward the void, I stopped at x = 8.85 at y = 33.1, 36.1 and 39.1, and at 9.46 at y = 40.3.
- **Stair to the roof.** The "Roof terrace" glide climbs both dog-legs: x = 2 up, landing, x = 6 up. It then leaves the mumty through a door on its front wall, at the top landing, flush with the roof.
- **Guard at the roof landing.** On the roof landing, walking north into the well beside the top landing stops at y = 29.31.
- **Other guards.** The Front Balcony guard stops you at y = 10.78 and x = 29.22. The Rear Terrace has a glass guard with a cap rail. The engine also added 3.5 ft guards on four roof edges that the plan left open, and said so in its notes.
- **TV placement.**
  - The TV Lounge TV sits on the east wall at y ≈ 31–36, beside the 4 ft dining arch at y 26.5–30.5. It is not across any door.
  - The Master TV sits on the north wall beside the entry door. It is not across a door, but it faces away from the bed.
- **Kitchen and passage connections.** The kitchen is reachable from the lounge through the open edge at x 8–12. Walking north at x = 10 reached (9.95, 44). The Passage, Study and Bath 2 are reachable from the Upper Lounge.
- **Room navigator.** It now lists the Roof terrace. Floor buttons glide you up the stair.

## Defects in my design (`p_13230dfcc54c`)

### 1. Only 3 bedrooms: the 4th became a "Study Room" (blocker)

The brief says 4 bedrooms (Ground: `bedroom:1`; First: `master_bedroom:1, bedroom:2`), every one with an attached bath. The shipped plan has the **Mother's Bedroom, the Master and the Rear Bedroom, plus a Study Room**.

- **The Study Room is furnished as a bedroom.** In Walk it has a queen bed, a wardrobe and bedside tables. It has no attached bath: it uses Bath 2 across the Passage.
- **The compliance sheet reports it.** It shows "Bedrooms as briefed · 3 (limit 4) · The plan has 3 bedrooms; the brief asks for 4". The chip reads 12/13 livable.
- **But the dock reports success.** It says "Your home passes all 37 LDA checks".

**Cause (from the live run stream).** The per-floor rule still counts the master as an ordinary bedroom:

| Attempt | Rule result | What the planner did |
|---|---|---|
| 1 and 2 | "The First Floor should have 2 bedrooms (has 3)" | Made the Front Left Bedroom a **Study** |
| 3 | "The plan has 3 bedrooms; the brief asks for 4" | |
| 4 | "5 bedrooms … First Floor should have 2 bedrooms (has 4)" | Added a 4th bedroom |

The loop kept attempt 3. The architect review then asked to "Convert f_bed2 from a Study Room into Bedroom 4". That was rejected, again on `plan.program.floor:first` and `plan.program.attached_bath:f_bed2`.

This is round-1 defect #3, still live. The repo's `api/app/compliance/planning.py` `_program` now sums bedroom keys (`want_beds`), but the deployed message format shows the old code. **The fix looks undeployed.**

### 2. The architect review was thrown away and hidden from the user (major)

`version.review` lists 7 issues, 4 of them major:

- the 4th bedroom is missing;
- the **Dining Room** is 8 ft wide for six, and the kitchen is cut off from it;
- the **Powder Room** opens straight onto the dining table;
- **Bath 2** is landlocked, over the **Drawing Room**.

Its minor issues are:

- the **Master Bedroom** is 11′6″ × 12′, smaller than the secondary bedrooms (12 × 17);
- the porch is 2 ft short;
- the roof door is on the wrong side.

`applied: false`. None of this appears in the compliance sheet or the Plan. The only trace is the line "Kept the checked plan; the suggested changes would have broken a rule." This is round-1 #4, unchanged.

### 3. The 2-car porch holds one car (major)

The brief says `car_porch:2`. The porch is 17′ × 16′. The plan only warns: "a car needs a 9 × 18 ft bay". The builder placed a sedan and an SUV, but the engine dropped the SUV: "No parking bay is left that keeps the walkway from the gate to the main door clear". Nothing tells the family their 2-car porch fits one car. This is round-1 #6, unchanged.

### 4. A wardrobe stands in front of the Mother's Bedroom window (major)

The bedroom's only window, `g_bed1_w`, is on the rear wall at x 15–21 and is 6 ft wide. A full-height 3-door wardrobe stands centred in front of it. The curtain rod and curtains frame the wardrobe, and only a sliver of glass shows at its right.

- In Walk, from (16.1, 45.3) facing north, the wardrobe fills the window bay.
- From (21.1, 53) the window glass is visible only beside it.

For an elderly mother's room this removes most of the daylight and the cross-ventilation. No as-built note mentions it, and the plan's daylight check passes.

### 5. Head-strike zone under the ground-floor stair (major, safety)

The Stair Hall is open to the TV Lounge along x = 8.

- **Under the mid-landing** (y ≥ 37.6) the engine blocks you at x ≈ 8.5.
- **Under the lowest part of the upper flight** it does not. At y = 36.4 I walked from the lounge to x = 5.25, under the first treads above the landing.

**Estimate.** Risers are 6.95 in and treads 10 in, with the landing about 5.8 ft up. The soffit there is roughly 6–6.5 ft above the floor, well under the 80 in (6′8″) clear headroom that IBC §1011.3 requires over walkways. Looking up from that spot, the stepped soffit fills the view. The strip is about 1.5–2 ft deep, is open to the lounge, and has no enclosure, rail or furniture to keep anyone out.

### 6. Bath 2 has no ventilation, but the headline still reads LDA 37/37 (major)

Bath 2 (8 × 5) sits against the left party wall. It has 0 sq ft of opening and no duct; in Walk it has no window. The sheet shows "Ventilation **5/5**", with Bath 2 only as a warning, and the headline still claims full LDA compliance. The same applies to the 10 marla sample's Bath 2. This is round-1 #5, unchanged.

### 7. The Powder Room opens onto the dining table and has no wash basin (minor)

From inside the Powder Room, the open door frames the dining table about 3 ft away. A pitched-down look around the 6 × 5′6″ room shows a WC on the east wall and **no basin**. The room is auto-furnished by `furnish_other_rooms` (`auto_furnish("g_powder")`), and no note mentions it.

### 8. The walk-in dressing is an empty 5′6″ × 4′6″ closet (minor)

The brief asked for a master "walk-in dressing". The room is 5′6″ × 4′6″. The engine dropped its wardrobe ("left out because there is no place for it…"). In Walk it is four bare walls, a window and a mirror.

### 9. Walkways under 3 ft on the elderly mother's route (minor)

The engine's own notes say:

- "TV Lounge + Stair Hall + Open Kitchen: furniture leaves less than 3 ft between some doors or the stair";
- "Master Bedroom: furniture leaves less than 3 ft …";
- the dresser and the sideboard were left out.

The L-sofa (x ≈ 11.4–17, y ≈ 31–38.7) leaves about 2.3 ft to the Mother's Bedroom door wall (y = 41), on the route that a walker or wheelchair would use.

### 10. The lounge curtains hang around the Drawing Room door (minor)

The TV Lounge curtains (`against: "front", along_ft: 11.5`) were meant for the lounge window at x = 19.5. In Walk they hang either side of the **Drawing Room door** at x = 10.5: facing south-west from (12.8, 29.6) you see the door framed by curtains.

### 11. As-built notes that alarm the user but are false (minor)

Of the 15 notes:

- "g_kitchen_open is not on the wall between Open Kitchen and TV Lounge, so it was not built" and "f_corr_arch … not built" both appear, yet both edges are fully open and walkable.
- "No wall of the stair tower touching the top landing opens onto clear roof … the door was put at the top landing anyway" appears, yet the door opens onto clear, flat roof.
- The notes also use internal ids (`g_kitchen_open`).

### 12. Pipeline narration inconsistencies (polish)

- The livable denominator changes during the run: 20 → 15 → 13.
- The fix history shows five rounds ("13 → 4 → 1 → 8 → 1"), but the label said "round 4 of 4".
- The step label goes back from Review to "Fixing 1 issue".
- The build message reads "Building your home in 3D, **1 parts** so far".

### 13. The View › Cars switch shows ON in Walk while cars are hidden (polish)

In Walk, cars are hidden by default (`auto`), but the switch shows on. Turning it off and on again shows the car ghosted and walk-through: I walked from x 17.4 to 24.8 straight through it.

## Sample · 10 marla modern home (v2)

### What is right

- **Rooms and baths.** No bedroom opens into another bedroom, and every attached bath is correct.
- **Stair to the roof.** The R glide climbs to the roof and leaves through the mumty door on its front wall at the top landing. Inside, the well beside the landing has a guard with a handrail.
- **Under-stair guard.** The engine stops you at x ≈ 8.3 for y = 38.5–40.5. At y = 36 you can pass under the upper flight, where the soffit is ≈ 7+ ft. So this sample is fine on the headroom point (#5).
- **Main door.** The main door opens from the porch into the TV Lounge.

### Defects

- **Bath 2 is landlocked** and sits over the Drawing Room. It is only a warning; the headline still reads LDA 37/37. Same as my #6.
- **The TV is beside the main door.** In the TV Lounge, the TV hangs on the entrance wall about 1 ft from the main-door frame, so the sofa faces the front door. Polish, persisting.
- **12 as-built notes, including:**
  - walkways under 3 ft in the **Dirty Kitchen**, **Parents' Bedroom** and **Master Bedroom**;
  - the **Master Dressing** dresser left out;
  - the coffee table and water dispenser left out.

## Sample · 1 kanal Spanish villa (v2)

### What is right

- **Rooms and baths.** No bedroom opens into another bedroom, and every attached bath is correct.
- **Stair to the roof.** The roof door is on the mumty's east side, at the top landing. Looking back in, a metal-bar guard protects the well.
- **Guards.** The roof parapet guards the drop to the first-floor terrace. The first-floor Roof Terrace has a metal railing at its rear edge (I stopped at the swing at y 68.7), and its east side stops you at x = 23.2.
- **Under-landing guard.** The engine blocks walking under the mid-landing (y 29.5–31): you stop at x 8.72.

### Defects (all still present from round 1, except the stair one)

- **The Master Dressing opens onto the Upper Family Lounge (major).** Its only door is at (36, 41). In Walk the dressing room is empty, and its door looks straight out onto the lounge and stair. The dressing room sits outside the master suite.
- **The Kitchen Patio is covered (major).** It is "open space" at x 12.5–17, y 44–58, but standing in it and looking up shows the first-floor Roof Terrace slab overhead. The Kitchen and the Prayer Room take their light from this covered slot.
- **There is no car in the 18′ × 18′ 2-car porch (major).** The note says "No parking bay is left that keeps the walkway from the gate to the main door clear". But the main door is in the Entrance Lobby's front wall, facing the lawn. The gate-to-door walk never crosses the porch.
- **Head-strike zone under the stair (major).** From the TV Lounge at y = 33 I reached x = 4.92. That is under the first treads of the upper flight, 1.5 ft past the landing edge (y 31.5); the soffit there is about 6.3 ft. Looking up, the stepped soffit is just overhead. Same as my #5.
- **Minor items:**
  - the Kitchen has no fridge ("left out");
  - the Master Dressing has no wardrobe;
  - Bedroom 3 has a walkway under 3 ft.

## User feedback checklist (architecture items)

| Feedback | Status in round 2 |
|---|---|
| Stairs where you can fall: railings everywhere | **Fixed** on all 3 houses: void edges, roof landings, balcony and terraces. **New:** low headroom under the upper flight in my design and in the 1 kanal sample (#5) |
| Bedrooms opening into bedrooms; rooms independent | **Fixed** on all 3 houses. The 1 kanal dressing still opens onto the lounge |
| Roof door suspended; no stair to the roof | **Fixed** on all 3 houses: the stair continues and the door is at the landing, at floor level |
| TV in front of a door or in a doorway | **Fixed** on all 3. The sample TV sits beside the main door (polish) |
| Neighbours blocking the view | The Orbit view ghosts the near neighbour |
| Concepts always a corner plot | **Fixed**: 4/4 mid-row |
| Day/night comparison | **Works** (Night toggle, `?light=night`) |
| Per-floor program | Captured and shown in the brief, but **the live rule miscounts the master and cost the family a bedroom** (#1) |
| Water tank and solar | Captured; the tank and 7 rows of panels are on the roof |
| Walk floor toggles | **Work**: they glide up and down the stair |
| Walking space; cars blocking | Cars no longer block the entrance (hidden in Walk; when shown, ghosted). **But** 2-car porches show one car or none, and the walkway notes persist |
| Room navigator | **Works**, now including the Roof terrace |
| Mouse look | Pointer lock was refused in this pane, and the drag-to-look fallback works |

## Verified OK

- One-message setup: the per-floor program, tank, solar and "Guaranteed" list, in about 10 s.
- Four mid-row concepts with Day and Night pairs.
- Pipeline narration, including the review stage messages.
- Main door built, with the walk spawning facing it.
- No bedroom-to-bedroom doors and correct attached baths in all three houses.
- Stair to the roof with the door at the landing, and guards at every drop, in all three houses.
- TV never across a door.
- Car not blocking the gate-to-door path in my design.
- Room navigator glides.
- Floor buttons climb the stair.
- Drag-to-look fallback.
- No horizontal overflow at 375 px.
