# Final must-fix check: 3D (live revision 8, both new samples)

- **Date:** 17 Oct 2026, 06:20–07:20 UTC. The prototype is due 18 Oct.
- **Tester:** final 3D must-fix agent. I used one tab of the built-in browser, set to 1440 × 900, and changed no code. The tab is closed and the viewport is reset.
- **Build under test:** the live URL https://naqsha-242926648187.us-central1.run.app (deployed revision 8).
- **Screenshots:** `docs/review/final-must-fix-3d/`

## How I tested

**Samples**
- **10 marla:** "Sample · 10 marla modern home, Johar Town" (`p_5a5893a2bcaa`). This guest already had a copy, `p_c870411a38db`, at the sample's current version `v_f881a067c573`.
- **Villa:** "Sample · 1 kanal Spanish villa" (`p_1a42e70989af`). I opened it from **Samples**, which made the copy `p_65188e37ce19` at 06:38 UTC, at the sample's current version `v_7379f7e1ceb0`. That copy is the only thing I created.

**Real input**
- Mouse: I clicked Orbit, Walk, the floor stack, the room pill, the navigator rows and the canvas, and dragged in Orbit and in Walk.
- Keyboard: M, V, 1, 2, G and R, and typing in the navigator filter.
- Movement: I held WASD and Shift as `keydown`/`keyup` events on `window`. These go through the app's own key handler.

**Inspection**
- I read the viewer controller through React state, for the walker's feet and the store.
- I read the engine's build summary, which gives a bounding box for every object before merging.
- I also used the nav grid, which is built from the same collision mesh the walker uses.
- For the fall tests I placed the walker at a spot, then ran (W+Shift) toward the edge for 1.8–2.5 s and recorded its lowest feet height.

**Limits**
- The built-in browser never grants real pointer lock, so on item 9 only the fallback could be checked.
- Screenshots of the 3D canvas are canvas snapshots shown four to a frame.

## Verdicts

| # | Must-fix | 10 marla | 1 kanal villa |
|---|---|---|---|
| 1 | No falls from stairs or landings; railings on every stairwell edge | **FIXED** | **FIXED** |
| 2 | A stair reaches the roof; the roof door is on the top landing, at floor level, and you can walk out | **FIXED** | **FIXED** |
| 3 | No bedroom opens into another bedroom; no bath opens into a room that isn't its own (plan and walk) | **FIXED** | **FIXED** |
| 4 | No TV in front of a door or in a doorway; no furniture blocks a door | **FIXED** (trees: see 5) | **FIXED** (trees: see 5) |
| 5 | Walking space between rooms; porch cars don't block vision or the way in | **NOT FIXED** (cars FIXED) | **NOT FIXED** (cars FIXED) |
| 6 | Neighbours never obstruct the outside view from any orbit angle | **FIXED** | **FIXED** |
| 7 | Walk floor toggles (G/1/R, 1–9) move you to that floor | **FIXED** | **FIXED** |
| 8 | The room-by-room navigator glides you to the chosen room | **FIXED** | **NOT FIXED** for 2 listed rooms |
| 9 | Mouse look like a game (pointer capture, or the fallback) | **FIXED** (fallback verified) | **FIXED** (fallback verified) |

**The new must-fix:**
- Argon's landscape code plants a row of trees down the 5 ft side passage in both houses. The engine lets those trees fill the only route to the back of the plot and blocks two exterior doors with them.
- In the villa, the door to the Rear Sun Terrace appears in the 2D plan but is not built in 3D.

Both are in "New issues" below.

---

## 1. Falls from stairs and landings, and railings: FIXED on both

**10 marla**

The stair is a dogleg at x 0.4–7.6, y 31–42.5 ft. Flight 0 is on the left wall, flight 1 is on the lounge side, and the mid-landing is at 7.3 ft.

Each push was blocked by a rail or wall, never by the edge guard alone. The stopping distance equals the rail position minus the 0.92 ft walker radius.

| Start (x, y, h ft) | Direction | Result |
|---|---|---|
| 1F lounge (9.5, 34 / 40.5, 12.5) | into the well | Stopped at x 8.72, the guard at x 7.66–7.84 |
| 1F arrival (5.6, 29.6, 12.5) | 12 directions | Lowest feet 12.5, except when it walked down the flight (7.29, the landing) or up the next flight (18.29) |
| Up-flight to the roof, side (2, 35, 15.2) | toward the down-flight's hole | Stopped at x 2.85 by the rail at 3.77 |
| Roof-stair landing (6, 40.5, 18.3) | toward the lounge drop | Stopped at x 6.65 |
| Roof-stair flight 1 (5.9, 35, 21) | toward the lounge drop | Stopped at x 6.6 |
| Ground-stair flight 1 (5.9, 35, 10.2) | toward the lounge drop | Stopped at x 6.6 |
| Ground-stair landing (4, 40.5, 7.3) | outward | Stopped at x 6.65 / y 41.41 |
| Roof top landing (2, 30, 23.5) | into the well | Stopped at y 31.06 by the well guard at y 31.95 |
| 1F terrace | into the stair hall | Stopped by the wall at y 44.04 |

I also pushed toward the balcony, terrace and roof parapets. Every push held and the walker never dropped.

**Villa**

The stair is a dogleg at x 37–44.5, y 31–42.5. Flight 0 runs along the exterior wall and flight 1 along the lounge side.

| Start | Result |
|---|---|
| 1F lounge into the well | Stopped at x 35.88 by the guard at 36.8 |
| 1F arrival, 10 directions | Never below 12.5, except normal descents to the landing (7.29) |
| Ground-stair flight 1 and landing, toward the lounge | Stopped at x 38.0 |
| Up-flight to the roof, side | Stopped at x 42.05 |
| Up-flight toward the stair window | Held by the added window guard at x 44.4 |
| Roof-stair landing and flight 1, toward the lounge | Stopped at x 38.0 |
| Roof top landing into the well | Stopped at y 31.04 |

- **Other drops:** the void edge of the West Terrace, the South Deck and Rear Sun Terrace rear edges, the East Terrace side and the front veranda edge all held.
- **What you see:**
  - **10 marla:** glass guards with timber handrails and black base shoes, around the 1F well, between the flights, and across the roof well. See `10m-first-floor-arrival-4-ways.jpg` and `10m-stairwell-guards-roof-and-1F.jpg`.
  - **Villa:** wrought-iron balusters on every flight, on the 1F lounge side and across the roof well. See `villa-stairwell-railings.jpg`.
- **The user's screenshot 1 is no longer true.** That was the 1F stair hall with an open landing edge.

## 2. Stair to the roof, roof door at the landing: FIXED on both

**10 marla**
- From the ground lounge, **R** glides you up both flights, through the roof door at y 28, and out to (4.27, 25.68) on the roof.
- The feet read 23.50 the whole way.
- The door is at x 2.3–5.7 on the tower's front wall. Its sill is at 23.46 ft and the landing floor at 23.44–23.5 ft.
- See `10m-roof-door-flush-landing.jpg`.

**Villa**
- **R**, the **R** button in the floor stack and the navigator's "Roof terrace" all glide to the top landing at (39.0, 29.65, 23.5), facing the door.
- From the landing I held W through the door (x 39.0–42.5). Feet stayed between 23.50 and 23.52 ft (a 0.02 ft threshold) out to the front parapet at y 12.7.
- See `villa-roof-door-flush-landing.jpg`.
- **The user's screenshot 5 (door raised off the landing) is fixed.**

## 3. Bedrooms and baths are independent: FIXED on both

**The plan**
- **10 marla:** every bedroom door opens to the lounge or passage. Every bath and dressing room opens only into its own bedroom.
- **Villa:** the same holds. The Guest and Parents bedrooms use the Bedroom Hall, the Rear Bedroom uses the Upper Passage, and the Master and Front Right bedrooms use the lounge.
- `plan.rule.independence` and `plan.rule.circulation` pass on both houses.

**The walk**

I traced walkable routes, built from the collision mesh, between every pair of bedrooms and from every bath and dressing room outward:
- **10 marla:** `f_bed2 > f_corr > f_lounge > f_bed3`; `f_bed3 > f_lounge > f_master`; every bath goes first into its own bedroom (for example `f_bath2 > f_bed2 > f_corr`).
- **Villa:** `g_bed1 > g_rear_corr > g_bed2`; `f_master > f_lounge > f_bed3`; `f_bed3 > f_lounge > f_corr > f_bed4`; every bath and dressing room goes first into its own bedroom.

No route crosses a bedroom.

**The user's screenshot 3 (Bedroom 3 opening into a bedroom) does not occur.**

## 4. TVs and furniture at doors: FIXED on both

I checked a 3 ft zone on each side of every door, arch and slider against every furniture bounding box, and every TV, painting, mirror and wardrobe against every opening.

**TVs**

No TV touches a door in either house:
- **10 marla:**
  - The ground-floor TV is 2.35 ft clear of the Parents' door.
  - The 1F lounge TV sits between the passage arch and the master door, about 1.8 ft clear of each.
  - The master TV is 1.65 ft clear of the bath door and 1.6 ft clear of the dressing arch.
- **Villa:** the TVs are on the 1F lounge wall and the master's x 23.5 wall, with no openings near.

See `10m-tv-walls-clear-of-doors-and-slider-tree.jpg` and `villa-tv-walls-and-kitchen-door.jpg`.

**The user's screenshot 2 (TV across a doorway) does not occur.**

**Furniture**

No furniture stands in a doorway. Tight spots that are still passable:
- **10 marla:** the dining table is 1.8 ft from the lounge's 8 ft slider (only the front 2 ft of the slider is clear of it).
- **Villa:**
  - The 8-seat dining table is 1.9 ft from the kitchen door. The walker passes, from (4, 40) into the kitchen.
  - A floor plant is 0.6 ft in front of the South Deck slider and covers 0.8 ft of its 5 ft width.

**Trees** block two exterior doors. They are counted under item 5.

## 5. Walking space and porch cars: NOT FIXED on both (cars FIXED)

**Porch cars: FIXED**
- **In Walk:** cars are hidden everywhere (opacity 0) and left out of the collider. I walked straight through the 10 marla sedan's footprint at (25, 16.9).
- **In Orbit, 10 marla:** the sedan is at x 22.3–28.7. That leaves a 6.8 ft walkway from the car gate to the 4 ft main door at x 16–20.
- **In Orbit, villa:** the SUV is at x 28.1–34.9, leaving a 4.6 ft strip in front of the main door at x 23.8–27.3.
- From the street at eye level, the cars sit low behind the gate (`villa-orbit-front-porch-cars.jpg`).

**Walking space: NOT FIXED.** Inside the houses every room is reachable, except one villa terrace (see below). The 5 ft side passage, the only way to the back of either plot, is planted shut:

- **10 marla**
  - An ashoka tree's canopy, 4.6 ft across from 2.1 ft up, sits at y 35.6–40.2 in the 5 ft side space (x 30.5–35). It is 0.6 ft outside the lounge's 8 ft slider (y 31–39) and covers its rear half.
  - Walking toward the rear from the slider, the walker stops at y 35.2. More trees follow at y 45.6–50.3.
  - The Rear Space can't be reached on foot. Asking the viewer to go to the Rear Space shows "Furniture blocks the way into the rear space, so I've brought you straight in". It then puts you inside the **Parents' Bedroom** at (16.05, 55.78).
  - See `10m-side-passage-tree-blocks-at-lounge-slider.jpg` and `10m-tv-walls-clear-of-doors-and-slider-tree.jpg` (bottom right).
- **Villa**
  - Four ashoka trees stand down the middle of the east passage (x 45–50), at y about 18, 32, 46 and 60.
  - Walking toward the rear, the walker stops at y 16.0, 29.3 and 57.2.
  - The tree at y 43.8–48.3 is 0.6 ft outside the **Dirty Kitchen's only exterior door**, at (45, 45).
  - The **Servant Quarter**, whose only door opens to the Rear Service Yard, and the yard itself can't be reached on foot.
  - See `villa-side-passage-trees-block-kitchen-door.jpg` and `villa-rear-terrace-door-missing-servant-trapped.jpg`.
- **Villa: the door to the Rear Sun Terrace is not built**
  - The Rear Sun Terrace (10 × 22 ft) has its sliding door in the 2D plan, and `plan.rule.openings` passes.
  - The engine skipped it: "is not on a wall between the Upper Passage and the Rear Sun Terrace, so it was not built" (as-built **fail**).
  - The walker hits a solid wall at x 15.4.
  - See `villa-plan-1F-passage-to-rear-terrace-door-drawn.jpg` and `villa-rear-terrace-door-missing-servant-trapped.jpg`.
- **Source**
  - The trees come from Argon's `landscape` section: `s.landscape.tree([33.2, y], { kind: "ashoka" })` (10 marla) and `s.landscape.tree([48.2, y], …)` "ashoka trees along the east passage" (villa).
  - `web/src/engine/landscape.ts:114` `tree()` has no walkway keep-out.
  - The skipped door is decided in `web/src/engine/structure/model.ts:303-334`.

## 6. Neighbours don't block the orbit view: FIXED on both

- **Angles:** eight orbit angles (0–315°, polar 1.35 rad), plus four near-eye-level side angles (polar 1.52 rad, 20–24 m).
- **10 marla:** the house stays visible at every angle. Neighbours in front of it fade to a faint clay veil (45°, 90°, 270°, 315°, and the eye-level side views). See `10m-orbit-az000-135.jpg`, `10m-orbit-az180-315.jpg` and `10m-orbit-eyelevel-sides.jpg`.
- **Villa:** the same. See `villa-orbit-az000-135.jpg`, `villa-orbit-az180-315.jpg`, `villa-orbit-eyelevel-sides.jpg`, and the default view `villa-orbit-default-left-neighbour-ghosted.jpg`.
- **A real mouse drag** to the rear of the 10 marla also ghosted the neighbour (`10m-orbit-mouse-drag-rear.jpg`).

## 7. Walk floor toggles: FIXED on both

**10 marla**
- Key **1** from the side space: through the slider, across the lounge, up both flights, arriving at (5.58, 29.58, 12.5) on 1F.
- Key **R** from the lounge: up and out onto the roof.
- Floor stack **G**: down both flights to (2.3, 29.6, 1.5).

**Villa**
- Key **1** from the roof: back through the tower door and down to (42.45, 29.38, 12.5).
- Key **G**: down to (42.45, 29.38, 1.5).
- Floor stack **R**: up to the top landing.

In every case the `?floor=` parameter updates. The walker never ends mid-air, and every glide follows the stair.

**Note:** both houses are G + 1 + R, so **2–9** have no floor. Pressing **2** silently does nothing (issue 7 below).

## 8. Room navigator glides: FIXED on the 10 marla, NOT FIXED on the villa

**10 marla**
- Through M, a click on the room pill and filtered typing ("stair", Enter), every navigator entry glides through the doors and faces the room. That is all 22 rooms plus **Roof**.
- **Parents' bedroom from the side space:** porch → main door → lounge → bedroom door → bedroom, about 1.6 s (`10m-navigator-glide-parents-bedroom.jpg`).
- **Roof from the lounge:** up both flights and out of the door.

**Villa**
- 37 of the plan's 42 rooms glide correctly when you start from a connected room, including the Entrance Veranda, the Parents Dressing and the Roof Terrace.
- The five that don't:
  - Servant Quarter, Rear Sun Terrace and Light Court Void, covered below.
  - Rear Service Yard, which crossfades.
  - West Light Court, which glides you to the kitchen next to it.
- **Servant quarter** and **Rear sun terrace** are in the list but never glide. They crossfade with "Furniture blocks the way into the servant quarter / rear sun terrace, so I've brought you straight in". The real causes are the passage trees and the unbuilt door (item 5).
- **Light court void** also crossfades you onto the enclosed deck (issue 6 below).
- **Once you're in the Servant Quarter you're trapped.** Every later pick also crossfades, for example "Furniture blocks the way into the family tv lounge". Walking out only reaches the rear yard, which the trees close off at y 62.2.

The glide itself works; these failures come from the item 5 geometry and from a fallback message that is wrong for them.

## 9. Mouse look: FIXED (fallback verified)

**10 marla**
- Clicking the canvas in Walk requests pointer lock. The built-in browser refuses it, `lockRefused` becomes true, and the centre prompt changes from "Click to look around" to "Drag to look around".
- A real 520 px mouse drag turned the view 177° (yaw 0 → 176.9°). See `10m-walk-drag-look-180-porch-no-car.jpg`.

**Villa**
- The same prompt change.
- A real drag turned yaw 0 → 126.5° and pitch to +14.6°. Dragging up looks up, so it matches pointer-lock direction.

True pointer lock can't be granted in this browser, so it is unverified here.

---

## New issues (most severe first)

1. **Major: trees block the side passage and exterior doors on both samples.**
   - The back of each plot is cut off.
   - On the villa, the Dirty Kitchen's exterior door is blocked and the Servant Quarter is unreachable on foot.
   - On the 10 marla, half of the lounge slider is blocked.
   - **Fix:** keep a 3 ft walkway clear in side and rear setbacks and outside every exterior door, whatever the landscape code asks for. Or drop trees whose canopy enters that strip.
2. **Major (villa): the Rear Sun Terrace's door is in the plan but not in 3D.**
   - The plan check passes; the engine skips the door, and its own note is a **fail**.
   - The plan check and the engine's wall-run test disagree on the passage↔terrace edge.
3. **Major (villa): the navigator traps you.**
   - Choosing the Servant Quarter crossfades you in.
   - Every later choice then crossfades too, with "Furniture blocks the way into the …".
4. **Minor: the navigator's fallback message always blames furniture.**
   - The real cause can be a tree, a missing door, or the walker's own sealed-off start. DESIGN asks for "No door reaches … yet. I've flagged it."
   - The 10 marla's Rear Space (reached through the viewer's `goToRoom`, which the navigator and minimap use; it is not in the navigator list) lands you inside the Parents' Bedroom.
   - The message is at `web/src/viewer/core/controller.ts:1445`.
5. **Minor (villa): the ground-floor "Family TV Lounge" has a TV unit but no TV.**
   - The unit stands in the open-plan gap to the lobby at x 23.6–25.1 (`villa-tv-walls-and-kitchen-door.jpg`, top left).
6. **Minor (villa): the "Light Court Void" is built as a closed, door-less first-floor deck.**
   - It has a floor at 12.5 ft, screens on its sides, and the ground "West Light Court" has a roof over it.
   - The navigator drops you onto it. The plan itself warns "has no way in".
7. **Polish: the walk floor key 2 (and 3–9) does nothing, with no hint, on G + 1 + R houses.**
   - Round 3 had 2/3 gliding, so people may still press 2 for the roof.
8. **Polish: in Walk, cars are hidden completely rather than "fade within 2 m" (DESIGN).**
   - The porch looks empty from the driveway (`10m-walk-driveway-way-in-clear.jpg`).
   - The villa SUV also sticks 2.6 ft out of the porch into the driveway (y 7.4).
9. **Polish: wardrobes stand in front of the only window of both 10 marla dressing rooms.**
   - Ground floor: x 27.7–29.6 over the 2 ft window at (30, 45.25).
   - First floor: x 27.7–29.6 over the window at (30, 25.25).
10. **Polish: leaving Walk keeps Orbit isolated on the floor you were on.**
    - The villa showed only its ground floor until I pressed "Whole house" (`villa-orbit-after-walk-ground-only.jpg`).
11. **Note (villa architecture): the plan's own review warnings, not bedroom or bath rule breaks.**
    - The Dirty Kitchen's only indoor access is through the Prayer Room.
    - The Servant Quarter has no bathroom.
    - There is no direct door to the Entrance Lobby.
    - The villa reads "10/18 livable · 8 to check": all hard rules pass, and the 8 are review warnings.
