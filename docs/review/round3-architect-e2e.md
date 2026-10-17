# Round 3: end-to-end design and senior-architect review

- **Tester:** round-3 architect E2E agent (guest, built-in browser, one tab, 1280×800 emulated; phone checks at 375×812)
- **Date:** 17 Oct 2026, 08:13–09:05 PKT
- **App:** https://naqsha-242926648187.us-central1.run.app (`/app`)
- **My design:** `p_cc2b1126c4d1`, version `v_57f77f161634`. House: `/app/p/p_cc2b1126c4d1/house`
- **Samples walked** (untouched guest copies of the live sample versions):
  - 10 marla: `p_8d8010bb3391` at `v_49e64e194d41`
  - 1 kanal villa: `p_4e01a962c3ae` at `v_1c5e1f09b906`
- **Evidence:** `docs/review/round3-architect-e2e/01…17-*.jpg`

## Read this first: the live URL is still the pre-round-1 build

The live service has not been redeployed since round 0, so **BE2-01 is still open**.

- Cloud Run serves revision **`naqsha-00006-zq7`** (deployed 16 Oct 21:41 UTC). `gcloud builds list` shows no build after it.
- The live HTML loads **`assets/index-CoebF8Ij.js`**, the same bundle the round-2 triage called "before round 1". The local `web/dist` build is `index-CTugblQe.js`, built 08:11 today.
- I polled the revision every 30 s from 08:13 to 09:02 PKT. It never changed.

So everything below is what a judge sees today. Several items, marked **(persisting)**, are already listed in `round2-triage.md` and are probably fixed on `main`. The new findings (#2, #3, #6) come from this run's fresh plan, and need to be re-checked on `main`.

## How this was tested

- **The run.** One message from `/app`, then Concepts (Day and Night), "Plan this one" on concept B, and the full pipeline watched live. I logged every `[aria-live]` and `role=status` change and replayed `GET /api/projects/{pid}/run` for each draft plan and compliance report.
- **Plan analysis.** An in-page script read `GET /versions/{vid}`. It built the door and open-to graph, then checked:
  - doors between bedrooms;
  - which room each bath door opens into;
  - reachability from the exterior through non-private rooms.
- **Walking.**
  - Pointer lock is refused in the pane, so the app falls back to "Drag to look around". I used that fallback.
  - I moved with synthetic WASD and turned with synthetic pointer drags. Position and heading came from the minimap marker (plan feet: x from the left party wall, y from the road).
  - A "probe" holds W in one heading and records where the 0.92 ft capsule stops. A stop at *s* means an obstacle at about *s* + 0.9 ft.
- **Comparison.** I walked both samples with the same probes.
- **Not done.** I did not press "Fix the rules that still fail". The permission system blocked that click, because it would make a new revision. That risk is described from the plan data instead (#2).

## The run: timings and narration (t = seconds after "Plan this one")

| t | Stage shown | Chip / notes |
|---|---|---|
| −95 | Setup from one message: about 12 s. It showed the per-floor program, "Concrete tank in the stair tower", "Clear for solar" and the six "Guaranteed" promises. The compass correctly points to the road for a north-facing plot | |
| −80 | Concepts: 4/4 mid-row with neighbours on both sides, in about 20 s. Night took about 25 s and kept the same cameras | |
| 0–193 | "Laying out the floors…": a single Gemini call of more than 3 min | |
| 194 | "Fixing 3 problems (round 2 of 4)…" | 37/37 LDA · **13/16** livable |
| 309 | "Fixing 2 problems (round 3 of 4)…" | **34/34** · **8/10** |
| 389 | "Fixing 1 problem (round 4 of 4)…" | 37/37 · 9/10 |
| 454 | "Reviewing the drawings like an architect…". History shows "3 → 2 → 1 → 2 → 1": five values for "4 rounds" | |
| 471 | "Improving the plan: …Father's ground-floor bedroom and Bedroom 2 upstairs are too cramped at 10x10 ft, the dining room is too narrow at 8 ft, and Bath 3 is an awkward 15.5 ft tunnel…" | |
| 589 | "Re-checking the improved plan…". The stepper **falls back from Review to Plan**, labelled "Fixing 1 issue" (evidence 15) | |
| 736 | **"Kept the checked plan; the suggested changes would have broken a rule."** | |
| 737–845 | "Building your home in 3D, **1 parts** so far" … 19 parts | |
| 846 | Done. Dock: "Your home passes all 37 LDA checks. Want to walk through it?" plus the chip "Fix the rules that still fail" | 37/37 · 9/10 |

The total is **14 min 6 s** from "Plan this one" to a walkable house, longer than the 7–10 min promised.

## My design (`v_57f77f161634`): what was built

The plot is 35 × 65 ft, mid-row, with the road on the north. The 5 ft side space is on the right (x 30–35).

| Floor | Rooms (x / y, ft) | Doors |
|---|---|---|
| Ground | Car Porch 0–13/10–28 · Drawing 13–30/10–23.5 · Entrance Lobby 13–24/23.5–28 · Powder 24–30/23.5–28 · Stair Hall 0–8/28–42.5 (open to the lounge) · TV Lounge 8–30/28–42.5 · Kitchen 0–12/42.5–58 · Dining 12–20/42.5–58 (open to the lounge) · **Father's Bedroom 20–30/42.5–52.5 (10×10)** · Attached Bath 20–30/52.5–58 | **Main door Porch→Lobby (13, 25.75)** · guest double door Porch→Drawing (13, 16.5) · Lobby→Lounge (15, 28) · **Powder→Lobby (24, 25.75)** · Kitchen→Lounge (10, 42.5) · Kitchen back door · Father's→Lounge (22, 42.5) · Bath→Father's (22, 52.5) |
| First | Front Balcony 0–24/10–14 · Master 0–24/14–28 · Master Dressing 24–30/10–20 · Master Bath 24–30/20–28 · Stair Hall · Family Lounge 8–30/28–42.5 · Bath 3 0–6/42.5–58 (6 × 15′6″) · Bedroom 3 6–20/42.5–58 · **Bedroom 2 20–30/42.5–52.5 (10×10)** · Bath 2 20–30/52.5–58 | Every bedroom opens onto the Family Lounge. Every bath opens only into its own bedroom |
| Roof | Mumty 0–8/28–42.9, door on the front wall at the top landing · concrete tank 0.5–7.5/43–49 · solar zone 10–28/15–53 | |

The four briefed bedrooms are all there, each with its own bath. Attempt 3 was kept; attempts 2 and 4 had dropped a bedroom (see #2).

## Architect's verdict: defects in my design

### 1. The Father's Bedroom and Bedroom 2 are walled off by their own furniture; the attached baths can't be reached (blocker)

Both rooms are 10 × 10 ft. The engine furnished each with a queen bed and a full wardrobe:

- the bed runs almost the full room width, with its headboard on the west wall (x = 20) and its foot near the window;
- the wardrobe stands on the front wall, east of the door.

Probing from the doorway in the **Father's Bedroom**:

- going east, I'm stopped at x = 23.8–24.0 for every y from 43.6 to 45.1;
- going north (+y), I'm stopped at y = 45.1–45.3 for every x from 21.1 to 24.0.

The whole walkable part of the room is a **≈ 2.8 × 1.8 ft pocket behind the door**. The **attached bath door (22, 52.5)** stands directly behind the bed, and the window is behind the wardrobe and bed. Neither can be reached (evidence 02, 03).

**Bedroom 2** on the first floor is the same: stops at y = 45.29, x = 23.78 and x = 21.11, and the **Bath 2** door sits behind the bed (evidence 04).

This is the room briefed for an elderly father "who uses a walking stick". Against that:

- the as-built notes say only "furniture leaves less than 3 ft between some doors";
- the compliance sheet shows "Every room has a proper way in" and "Rooms are independent" as passing;
- the plan has "Father's Bedroom size 100 sq ft (min 100)", exactly at the limit.

The architect review flagged both 10 × 10 rooms as too cramped and proposed a fix, but the fix was thrown away (#2).

### 2. The per-floor rule still counts the master as a bedroom: the loop oscillates, good review fixes are discarded, and a false failure is printed (major; persisting cause)

The brief asks for: Ground `bedroom:1`; First `master_bedroom:1, bedroom:2` (4 bedrooms).

| Attempt | Failing rule | What the planner did |
|---|---|---|
| 1 | "The First Floor should have **2 bedrooms (has 3)**" | |
| 2 | "The plan has 3 bedrooms; the brief asks for 4" | **deleted Bedroom 3** |
| 3 | "First Floor should have 2 bedrooms (has 3)" | added the bedroom back |
| 4 | "3 bedrooms; the brief asks for 4" | deleted it again |

The loop kept attempt 3, so the family got 4 bedrooms this time, but only by luck of which attempt was kept.

The architect review was then **rejected because of** `plan.program.floor:first` and `plan.program.bedrooms` (plus `plan.room.solid_wall:f_master`; see `version.review.rejected_because`). Its `applied` flag is `false`. The rejected fixes were:

- widen the Father's Bedroom to 12 × 10 and the Dining Room to 9 ft;
- split the Bath 3 tunnel into a bath and a store;
- widen Bedroom 2.

The shipped plan therefore shows a **false "1 rule to fix: Rooms per floor"** in four places:

- the compliance sheet;
- the printed A3 compliance report: "Rooms per floor · The First Floor should have 2 bedrooms (has 3)", printed twice;
- the "Ask Naqsha to fix this" link;
- the dock chip "Fix the rules that still fail".

Following that advice would make Argon delete a bedroom, as it did in attempts 2 and 4. Round 2 triage says `main` already sums the master into the bedroom count, so this is fixed by deploying (BE2-01). It should be re-run on `main` with this brief.

### 3. The porch's black facade frame has a bottom beam across the whole porch opening; no car can drive in and nobody can walk from the gate to the main door (major)

Concept B's dark "grooved" portal frame was built as a **closed rectangle**: its bottom member lies on the ground across the full 13 ft porch mouth at y ≈ 9.3 (evidence 06, 07).

- **Walk.** From inside the porch I'm stopped at y = 10.2–10.4 for x = 1.7, 5, 8 and 11.7, with Cars on or off.
- **Only entrance.** The main door is the only house door and it opens off the porch: Porch→Lobby at (13, 25.75). So the **gate→main door route is impossible** and the car bay can't be entered.
- **Control.** In the 10 marla sample the same walk from the porch reaches the gate (y = 1.08) and the pedestrian gate.
- **Not caught.** No as-built note mentions it.

### 4. Head-strike zone under the upper flight, open to the TV Lounge (major; persisting EN2-01)

In the Stair Hall the dog-leg runs flight 1 along the party wall and flight 2 on the lounge side (x 4.1–7.6), with a mid-landing at y 39.1–42.5.

- **Where you can walk.** Walking west from the TV Lounge, I'm blocked under the mid-landing only (stop x = 8.35 at y = 40). At y = 36 and y = 38.1 I walk to **x = 4.79**, under the lowest treads of flight 2.
- **Headroom.** With risers of 6.95 in and treads of 10 in, the landing is at 5.79 ft, so the soffit at y ≈ 38 is **≈ 6.0 ft**. That is below 6′8″ (IBC §1011.3).
- **Evidence.** Looking up from (5.97, 37.95), the stringer and soffit fill the view just overhead (evidence 05).
- **Villa sample.** The same holds: x = 4.92 at y = 33.05 and 36.1.

### 5. The main entrance looks straight into the Powder Room WC (major, privacy)

The main door (13, 25.75) and the Powder Room door (24, 25.75) sit on the **same axis**, 11 ft apart, across a 4′6″-deep Entrance Lobby.

- **From outside.** From the porch, the open main door frames the powder room's WC and ventilator dead centre (evidence 01).
- **From inside.** Standing in the lobby, the WC is the first thing you see.

A guest toilet must be off-axis from the entry, or screened.

The lobby is also only 4′6″ deep and serves four doors: main, Drawing, Lounge and Powder. That leaves room for one person at a time, with the console table and vase in it.

### 6. The architect's review is thrown away and hidden (major; persisting)

`version.review` holds 4 issues (2 major): cramped bedrooms, the 8 ft dining, the Bath 3 tunnel, and the master bath door. The review shows **none** of them in:

- the compliance sheet;
- the Plan;
- the printed report.

The only trace is the toast "Kept the checked plan; the suggested changes would have broken a rule."

The review also contradicts the site: it says the mumty door "opens south" and suggests a terrace "south of the mumty", but the plot faces north and the door is on the north (front) side.

### 7. The setup agent invented a "roof terrace" the user never asked for (minor)

`brief.spaces` contains `roof_terrace`, though the message only asked for "a stair going all the way up to the roof". The Brief panel never shows it, but:

- the plan is graded "Requested room · The brief asks for a roof terrace; the plan has none" (warn, also printed);
- attempt 2 added a "Rear Terrace" over the kitchen to satisfy it;
- the review asks for a tiled roof terrace.

Also, the Brief's per-floor summary reads "Ground 1 bed, Drawing, Dining, TV lounge, Kitchen", which leaves out the **powder room** that is in `floors[0].rooms`.

### 8. The briefed motorbike was dropped silently (minor)

The brief says "porch for 1 car plus a motorbike". As-built note: "Car Porch: the motorbike was left out because there is no place for it…". Nothing in the Plan or the compliance sheet tells the family.

### 9. As-built notes: a real stair defect behind raw ids (minor)

The 6 notes are:

- **"Stair stair_g_f: the mid-landing is 3.4 ft deep, less than the 3.5 ft flight width; the stair room is 0.1 ft too short."** This is a real landing-width defect, yet LDA "Staircase" passes twice and the note shows a raw id.
- "Kitchen / Father's Bedroom / Bedroom 2: furniture leaves less than 3 ft…": the bedroom items are #1. The kitchen route from the lounge door to the back door walked fine.
- The Front Balcony plant was left out.
- The motorbike (#8).

### 10. The TV Lounge TV is on the entrance wall (polish)

The TV hangs on the Lobby wall, about 2 ft from the Lobby→Lounge door, so the L-sofa faces the door (evidence 10). It is not across a door, so the user's rule holds, but the sofa has its back to the dining room and kitchen.

### What is right in my design (verified by walking)

- **Bedrooms and baths.** No bedroom opens into another bedroom. Every attached bath opens only into its own bedroom. The Powder opens off the Lobby.
- **Stairs.**
  - The stair continues to the roof.
  - The **R** button glides from the Front Balcony through the Master to the stair, up both flights, and out through the **mumty door on the front wall at the top landing, flush with the roof**. It ends on the roof at (4.27, 25.65) (evidence 08).
- **Guards at every drop** (stop positions):
  - first-floor stair void along x ≈ 7.8 for y 32–41.4 (stopped at x = 8.72);
  - flight 2's open side has a glass guard with a timber cap rail (stopped at x = 6.6, evidence 09);
  - mid-landing east edge (stopped at x = 6.65);
  - roof landing beside the well (stopped at y ≈ 31.06);
  - Front Balcony glass guard (stopped at y = 11.02, x = 22.71).
- **Reachable rooms.** The Master Bath, Master Dressing, Bath 3, Kitchen and back door are reachable. The floor buttons glide up and down the stair.
- **Brief honoured.** The concrete tank is on the roof behind the mumty and the roof is kept clear for solar (684 sq ft zone).

## Sample · 10 marla modern home (`v_49e64e194d41`, unchanged since round 2)

- **Reachability.**
  - Every bath is reachable: Parents', Bath 2 via Bedroom 2, Master, Master Dressing, Bath 3.
  - The gate→porch→main door→TV Lounge route walks clean (cars hidden in Walk).
  - The **R** glide exits the mumty's front door at the landing.
- **Narrow route to the Parents' Bath (minor).**
  - In the Parents' Bedroom, the only way to the bath door (24, 53.5) is a **≈ 2.5 ft slot** between the bed (side at x ≈ 20.1) and the TV console against the east wall.
  - The TV hangs beside the bath door (evidence 13).
  - That is below 0.9 m.
- **Upper Family Lounge.** Furniture blocks the direct line from the Master door to the Bedroom 3 door (stop at y = 35.84). A detour along x = 10.5 works.
- **Persisting from round 2.**
  - **Bath 2** is landlocked with no window, yet shows "37/37".
  - The TV Lounge TV is beside the main door.
  - The sample shows **12** as-built notes, including walkways under 3 ft.

## Sample · 1 kanal Spanish villa (`v_1c5e1f09b906`, unchanged since round 2)

- **Reachability.** Every bath is reachable: Bath 1, Guest Bath, Bath 3, Master Bath and Bath 4. The lawn → Entrance Lobby → stair route works.
- **Master Dressing (persisting).** Its only door opens onto the **Upper Family Lounge** at (36, 41), outside the master suite (evidence 11). Standing at (32.5, 41) facing east, the open dressing room is in full view.
- **Head-strike (persisting).** Under the upper flight: x = 4.92 at y = 33–36.
- **Other persisting items from round 2, not re-walked:**
  - the Kitchen Patio sits under the Roof Terrace slab;
  - there is no car in the 2-car porch.

## The user's feedback, re-checked on live

| Feedback | Status today |
|---|---|
| Stairs you can fall from | Guards hold at every edge I pushed. **But** the head-strike under the upper flight persists (#4), and the landing is 3.4 ft for a 3.5 ft flight (#9) |
| Bedrooms opening into bedrooms | **Holds** in the plan and the walk on all three houses. The villa dressing opens onto the lounge |
| Roof door suspended; no stair to the roof | **Fixed**: the door is at the landing, at floor level |
| TV in front of a door | Not across a door anywhere. It sits on the entrance wall in my lounge and beside the bath door in the sample |
| Neighbours blocking the view | Ghosted in Orbit |
| Concepts always a corner plot | **Fixed**: 4/4 mid-row |
| Day/night comparison | **Works**, with the same cameras |
| Per-floor program | Captured, but **the live rule miscounts the master** (#2) |
| Water tank and solar questions | Captured. The concrete tank and solar zone are on the roof plan |
| Walk floor toggles | **Work**: they glide along the stair |
| Walking space and cars blocking | **Broken in my design**: the bedrooms are walled off (#1) and the porch is closed by the frame beam (#3). The sample has under-3 ft slots |
| Room navigator | **Works**: search, then fly to the room |
| Print/PDF | Preview is 5 A3 sheets, but it prints the false "Rooms per floor" fail and every livable message twice |
| Mouse look | Pointer lock refused in the pane; the drag fallback works |
| Modern UI, no stage bar | Yes. At 560 px the Walk room chip overlaps the Orbit/Walk and View row (evidence 16). At 375 px there is no overflow |

## Smaller UI findings from this run

- **Pipeline narration.**
  - The denominators change mid-run: "Checking 37 LDA rules and 16 livability rules" → 34/10 → 37/10 → 34/9, and the chip goes 13/16 → 8/10 → 9/10.
  - "Round 4 of 4" sits next to a five-value history.
  - The stepper falls back from Review to Plan.
  - The build message reads "1 parts so far".
- **Roof plan labels.** "Stair tower 9′ high" is drawn over the tank's hatched box, and "Concrete tank" sits inside the mumty outline (evidence 17).
- **Printed compliance report.**
  - Every livable warning is printed twice.
  - "Staircase" is listed twice.
  - The roof sheet says "0 sq ft covered".
- **Cars switch.** View › Cars shows ON in Walk while the cars are hidden (persisting AP2-12).
- **Project chip.** During the run, the project chip under the title still said "Concepts" while the Plan was drawing.

## Verified OK

- **Setup.** One-message setup in about 12 s: per-floor program, concrete tank, solar-ready roof and the "Guaranteed" list. The north arrow is correctly rotated for a north-facing plot.
- **Concepts.** 4/4 mid-row concepts in about 20 s, and Night versions with the same cameras in about 25 s.
- **Plan and checks.** The pipeline shows every stage, including the review message. It ends with Plan, Check, Review and Build done.
- **Bedrooms and baths.**
  - No bedroom-to-bedroom door in any of the 3 houses.
  - Attached baths open only into their own bedroom.
  - All sample baths are reachable on foot.
- **Stair to the roof.** The stair reaches the roof, with the mumty door at the top landing, at floor level, in my design and the 10 marla sample.
- **Guards.** Guards at the stair void, the flight's open side, the mid-landing, the roof well and the balcony.
- **Walk controls.**
  - Floor buttons glide up and down the stair.
  - The room navigator searches and flies to the room.
  - The drag-to-look fallback works.
- **Print and phone.**
  - Print preview: A3, 5 sheets, cover with the concept image and area schedule.
  - No horizontal overflow at 375 px on House and Plan.
