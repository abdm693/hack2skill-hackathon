# Round 3 re-test of the round 2 fixes

- **Date:** 17 Oct 2026, 08:10–09:05 PKT (03:10–04:05 UTC). The prototype is due 18 Oct.
- **Tester:** round 3 re-test agent. I used one tab of the built-in browser and changed no code.
- **Screenshots:** `docs/review/round3-retest/`

## Headline: the live app still runs the build from before round 1

| | Live: https://naqsha-242926648187.us-central1.run.app | `main` at d52d3f1 (round 2 merged 08:11 PKT) |
|---|---|---|
| Cloud Run revision | `naqsha-00006-zq7`, deployed **2026-10-16 21:41 UTC**. It is the only revision serving (100%). | never deployed |
| Bundle | `assets/index-CoebF8Ij.js` | `assets/index-CTugblQe.js` (my local `vite build`) |
| Sample data (production Firestore) | not promoted: both samples `updated_at` 2026-10-16 21:16, Concept A still `c_64fe9de92b13.png` (no `-r2`) | same data |

So **every round 1 and round 2 fix is still STILL BROKEN on the live URL**. The live app shows:

- the old landing ("42/42 LDA · 5/5 livable", "42 bylaw checks", hard-coded sample cards);
- the old status count ("v5 · 36/36 LDA · 9/9 livable") and the old plural ("1 note so far. I'll turn **them** into the next version.");
- A4 print that spills out of the sheet: 22 elements outside the cover, 14 outside A-102 and 61 outside the compliance sheet A-900;
- `POST /api/lda/check` with the old rules: `plan.privacy.wc_into_dining` is only a **warn**, there is no `dressing_size` rule, and Bath 2's 0 sq ft vent is a **warn**.

To judge the fixes I ran `main` the way round 2 did:

- `vite build` into the scratchpad, served by `uvicorn` from `main`'s `api/` on :8163 (production Firestore and Vertex, as a fresh guest);
- the engine harness (`web/dev/engine.html?src=`) on a vite dev server (:5293), on:
  - the saved 10 marla v2 and villa v2;
  - the staged BE2-03 versions (`AR_v_3b1ef8f2ac97`, `BR_v_c3e8c7f4a984`);
  - p_13230dfcc54c v1;
  - a fresh DHA design I made on `main`.
- `uv run pytest -q`: 85 passed. `npx tsc -b`: clean.

All servers are stopped and my tab is closed. While testing I created these, all owned by my test guest:

- clones `p_7680bfb3f2f4` (10 marla) and `p_84ee8c950f2e` (villa);
- a new home `p_66468c34425e` (1 kanal, DHA Phase 6, full design v1);
- an empty "start with questions" home `p_f171592e9801`;
- 3 client notes on `p_7680…`. Its client link is switched off again.

**Verdict on `main`:**
- Almost every round 2 fix works.
- Three new problems need a fix before the deploy:
  - 3D comment pins leak over the Plan, Concepts and Revisions views (a round 1 regression);
  - the default floor program fails DHA's storey rule on every fresh design;
  - a painting hangs over the villa lounge's window, in both the current villa and the staged BE2-03 villa.
- The samples (BE2-02, BE2-03) are prepared but still unpublished, so the flagship still shows a corner-plot concept.

## The user's own feedback

| Feedback | Live | `main` | Evidence |
|---|---|---|---|
| Stairs you can fall from; railings everywhere | old build (round 0 rails) | **FIXED** | Harness `guards` and `falls` pass on all 6 houses (10 marla 119 edge samples, villa 238, staged villa 166, p_1323 218, new DHA 107; 7/7 pushes held each). In the app I walked to the roof and ran W and W+D (with Shift) into the parapets for 6–8 s each. I stayed on the roof (`main-10marla-roof-front-parapet-holds.jpg`). |
| Bedrooms opening into other bedrooms | old rules | **FIXED** in rules and on fresh designs | The new DHA design has 5 bedrooms. Each opens onto the lounge or passage, plus its own bath or balcony, and `plan.rule.independence` passes. The villa sample still has the dressing off the lounge and joined balconies until BE2-03 is published. |
| Roof door suspended; no stair to the roof | reaches roof | **FIXED** | Harness `roof`: "sill +0.00 ft, on the top landing; walker climbed from the ground floor out onto the roof" on all 6 houses. In the app, key 3 glided the walker from the car porch, up the stair, out onto the roof. |
| TV in front of a door or in a doorway | old | **FIXED for TVs**; see issue 5 for a painting over a window | `door_clear` and `furniture_walls` pass on the 10 marla, p_1323, the new DHA design and the staged 10 marla. |
| Neighbours blocking the view | – | **FIXED** | In Orbit the right-hand neighbour ghosts and the house stays visible (`main-10marla-loading-card.jpg`, and later frames). |
| Concepts always a corner plot | **STILL BROKEN** on the flagship | New projects **FIXED**. Flagship **STILL BROKEN** (BE2-02 unpublished) | A fresh DHA brief gave 4 of 4 mid-row concepts (`main-new-dha-concepts-all-midrow.jpg`). The 10 marla sample's Concept A is still a corner plot by day and by night. The prepared replacement is mid-row (`conceptA-current-corner-vs-prepared-midrow.jpg`, bottom row). |
| Day/night comparison | works | **Works** | Night images load only when Night is chosen (4 × `-night.png?w=960`, 43–59 KB). |
| Per-floor program | works | **Works** | The "Rooms on each floor" dialog stays at top 96 px on the Ground, First and Roof tabs. See issue 4 for the roof laundry default. |
| Water tank and solar questions | works | **Works** | The tank and solar radiogroups are labelled "Water tank" and "Rooftop solar", with roving tabindex. The reply was "A concrete tank hidden in the stair tower, with the roof kept clear for solar panels." |
| Walk floor toggles | works | **Works**; key mapping is confusing (issue 8) | Keys 2 and 3 glide the walker and `?floor=` follows. |
| Walking space and cars blocking | – | **FIXED** | Harness `walkway` and `paths` pass on the new DHA design (2 cars in 2 bays, walkway 34 ft) and the staged houses. The 10 marla v2 keeps one tight spot in the Dirty Kitchen (sample data). |
| Room navigator | works | **FIXED** (AP2-16) | Lists "Stair" and "Roof" ("You're here"). Typing "stair" then Enter glided the walker to the ground-floor stair hall. |
| Print/PDF | **STILL BROKEN** (A4 overflows) | **FIXED** | A3: 5 sheets, 0 elements outside. A4: 7 sheets (A-000…A-902), 0 outside. |
| Mouse look like a game | – | **Works (fallback)** | Pointer lock is refused in the pane; "Drag to look around" appears and a drag turns the view. |
| Sign up/in, sharing, team comments | – | **Works** | See AP2-11 and BE2-05 below. |
| Modern minimal UI, no stage bar | – | **Works** | One accent button per screen. |
| Landing: construction animation, business features, Portal | old copy | **FIXED** | The pencil poster draws, then animates. One "Portal" label. "36 LDA checks · 8 livable" comes from `/api/samples`. |

## Round 2 fixes, one by one

**Status key:**
- **FIXED** means verified on `main`. Each item is also STILL BROKEN on live (not deployed).
- **NOT PUBLISHED** means the fix is prepared but the data is not live anywhere.

### Backend

| ID | Status | Evidence |
|---|---|---|
| BE2-01 (deploy) | **STILL BROKEN** | Live revision `naqsha-00006-zq7`, bundle `index-CoebF8Ij.js`. |
| BE2-02 (Concept A mid-row) | **NOT PUBLISHED** | Concept A is still the corner render on live and on `main` (same Firestore). The prepared `a_day_1.png` and `a_day_1-night.png` are mid-row, with neighbours on both sides and one straight road. I checked them by eye. `promote_round2.py concept … --apply` has not been run. |
| BE2-03 (sample plans) | **NOT PUBLISHED**; staged villa has a new defect | Staged 10 marla: `/api/lda/check` gives 36/36 LDA, 7/8 livable (1 warn, Bath 2 over drawing room). The harness passes every check, with 0 as-built notes. Staged villa: 44/44 LDA, 7/7 livable, 2 cars in 2 bays, 1 as-built note (`f_lounge_terrace_slide` not built, known). **But the harness fails `furniture_walls`: the lounge painting hangs over the front window** (issue 5). Today's samples still show Bath 2 with a 0 sq ft vent as "to check", from stale stored compliance. Under `main`'s rules that is a **fail**, and `plan.opening.clash:g_dirty_kitchen_w` is a fail too. |
| BE2-04 (setup card) | **FIXED, with one gap** (issue 6) | Brief "1 kanal plot in DHA Phase 6 Lahore, 3 storeys, 5 bedrooms": "You said" was 1 kanal, DHA Phase 6, 5 bedrooms; "I assumed" was Mid-row plot, "Kept to 2 storeys: DHA's limit", 6 baths. After the facing answer, "Corner or mid-row?" was still asked. After I answered "Mid-row", the server is right (`auto_filled` = bathrooms, storeys; `corner_stated` true), **but the card lists "Mid-row" under both You said and I assumed**. The completion card is correct. |
| BE2-05 (share meta, pin spacing) | **FIXED** | `GET /api/share/{token}/meta` returns `{"current_version_id":"v_49e64e194d41","versions":[{id,n}×2]}`. A client tab's `/meta` poll got 200. After switching the link off, `/meta` and `/api/share/{token}` return 404. Three general pins (2 notes and 1 approval) are 34 px each and far apart: centres 69–75 px apart at 1280 and 74–146 px at 390 (`main-client-link-3-general-pins-390.jpg`). |
| BE2-06 (WC into dining, dressing size) | **FIXED** | `POST /api/lda/check` on the 4-bed fixture gives `plan.privacy.wc_into_dining:g_powder` **fail**: "Powder Room opens straight into Dining Room…" (names, no ids). It also gives `plan.room.dressing_size:f_master_dress` **fail**: "only 4′6″ wide (5′6″ × 4′6″)…", value 4.5, limit 5.0, unit ft. Neither fails on the 10 marla v2 or the staged 10 marla. |
| Reviser stall guard (aff4a02) | **FIXED** (tests) | `pytest -k "stall or reviser"` gives 4 passed. The full suite gives 85 passed. I did not run a live 10-minute stall. |

### Engine (harness on `main`)

| ID | Status | Evidence |
|---|---|---|
| EN2-01 (under-stair storage, headroom) | **FIXED** | `headroom` passes on all 6 houses. The lowest standable cell is 7.23 ft under the ground-to-first flight and 10.05 ft under the roof flight. In the app, walnut cupboards box in the space under the 10 marla flight (`main-10marla-understair-storage.jpg`). |
| EN2-02 (wardrobes, windows, curtains) | **Partly FIXED** | `windows` passes everywhere (7, 8, 5, 5 and 11 pairs on glazing, nothing tall in front of a window). **Regression:** `furniture_walls` fails on the villa v2 and the staged villa because the lounge painting covers part of the window (issue 5). |
| EN2-03 (wet rooms) | **FIXED** | Every bath on all 6 houses has a WC, a basin and a shower. Powder rooms have a WC and a basin. No dressing room is empty. |
| EN2-04 (9 × 18 bays, car count) | **FIXED; one mismatch remains** (issue 9) | p_1323: the engine parks 1 of 2 and the note reads "Only 1 of 2 cars fits…", but the plan check says "**parks 0 of the 2 cars**". Villa v2: engine 1 of 2, plan check fails `porch_walkway`. New DHA design: 2 cars in 2 bays. |
| EN2-05 (plain names, fewer notes) | **FIXED** | No as-built note on the 6 houses matches the raw-id pattern. p_1323 has exactly 2 notes (roof guards, 1 of 2 cars). The 10 marla v2 has 1 (Dirty Kitchen path). |

### Viewer

| ID | Status | Evidence |
|---|---|---|
| VW2-01 (loading card) | **FIXED** | Desktop: "Assembling your home · Raising the walls and slabs · 1 of 29 layers 3%", centred. 390 × 844: the card sits at x 64–326, y 200–324, opacity 1 in 22 of 22 samples, and runs from 1 of 29 to 29 of 29 (`main-10marla-loading-card.jpg`). |

### App

| ID | Status | Evidence |
|---|---|---|
| AP2-01 (Revisions on phone) | **FIXED** | At 390, `scrollWidth` = `clientWidth` = 390 and the H1 sits at 16–374. **The 3D pins float over the H1** (issue 3). |
| AP2-02 (top row) | **FIXED** | Empty setup home at 1440: three cells; Share at 1324–1418; empty centre. |
| AP2-03 (Esc in compliance) | **FIXED** | Focus goes to H2 "Compliance" on open. The first Esc keeps the sheet open and clears the selected Bath 2 row. The second Esc closes it and returns focus to the compliance chip. |
| AP2-04 (top-anchored dialogs) | **FIXED** | The print dialog, the "Your name" prompt and "Rooms on each floor" all have top = 96. |
| AP2-05 (concept images) | **FIXED** | Tiles are `?w=960` at 46–66 KB. Night images are not requested until Night is chosen. |
| AP2-06 (landing on phone) | **FIXED** | `viewBox` 96 0 774 491. All 4 labels sit inside the frame. Sign in and Portal are 36 px. No horizontal scroll at 390. |
| AP2-07 (phone House HUD) | **FIXED at 390; overflows at 360** (issue 7) | At 390: one row (Orbit and Walk icons, View, v2, Rooms, Comment with count), and "1 note from the 3D model" moved into the title menu. |
| AP2-08 (copy) | **FIXED** | Chips "Make the kitchen bigger" and "Add a prayer room upstairs". "Cut away". "Revise with 2 comments", with the approval left out. Brief placeholder: "…a bigger kitchen…" on the DHA home (max 2) and "…a third storey…" on the 10 marla (max 3). |
| AP2-09 (radiogroups) | **FIXED** | Compass: ArrowRight moved both the check and the focus to North-east. Tank and solar groups are labelled with `aria-labelledby`. |
| AP2-10 (one summary) | **FIXED** | A fresh load straight into Plan shows the same counts in the chip, status line and dock: 35/36 LDA, 10/11 livable, 2 to check, 1 note from the 3D model. |
| AP2-11 (sign-in errors) | **FIXED** | Email "abc" with an empty password: both fields get `aria-invalid` and their own message, and focus goes to the email field. I did not create an account. |
| AP2-12 (Cars switch) | **FIXED** | In Walk it reads off. Toggling it gives `aria-checked` true. |
| AP2-13 (one accent) | **FIXED** | "Render this view" and Revisions "Walk through it" are secondary. |
| AP2-14 (plurals) | **FIXED** | "Building the house in 3D · 19 parts", "18 parts so far". There is a separate copy slip in the fix counter (issue 11). |
| AP2-15 (Concepts on phone) | **FIXED** | Placeholder "Ask for four more". |
| AP2-16 (navigator Roof and Stair) | **FIXED** | See the feedback table. |

## Fast regression of the core journey on `main`

1. **Landing → Portal:** Portal opens `/app` with the Samples tab. Thumbnails shimmer and then load.
2. **Sample:** the 10 marla card shows "Opening", clones to `p_7680bfb3f2f4` and opens House.
3. **Orbit:** the house builds in about 8 s, the neighbours ghost, and there are no console errors.
4. **Walk:** spawn in the car porch, facing the main door. Key 3 takes the walker up the stair to the roof. Pushing into the parapets does not let the walker fall. M opens the navigator, and "stair" then Enter returns to the ground stair hall.
5. **Plan:** the counts are consistent and the compliance sheet opens. Print preview has no overflow (A3: 5 sheets, A4: 7 sheets).
6. **New home:** a full DHA design ran in about 7.5 min. v1 scores 41/42 LDA, with storeys failing (issue 4).
   - The engine checks all pass: 2 cars, the roof is reachable, 0 tall pieces in front of windows.
   - The self-review was skipped for time (issue 12).

On live, the same journey still works at the round 0 level: the walker reaches the roof and the sample opens. It shows the old counts, the old landing and A4 print overflow.

## Issues

### 1. BLOCKER: the live app has none of the round 1 or round 2 fixes
- Cloud Run serves only `naqsha-00006-zq7` (16 Oct 21:41 UTC), with `index-CoebF8Ij.js`.
- **To do:**
  - deploy `main` (d52d3f1 or later, after the fixes below);
  - re-check this table on the live URL.

### 2. MAJOR: the sample fixes are prepared but not published (BE2-02, BE2-03)
- The flagship 10 marla still shows:
  - the corner-plot Concept A, by day and by night;
  - Bath 2 with a 0 sq ft vent, shown as "to check" from stale stored compliance (35/36 LDA, 10/11 livable). Under `main`'s rules it fails, along with the Dirty Kitchen door/window clash.
- The villa sample still has the dressing off the lounge, the joined balconies and a porch that is too small.
- **To do:**
  1. Fix issue 5 first.
  2. Run `promote_round2.py concept …`, `version …` and `chat … --apply`.
  3. Then run `verify`.

### 3. MAJOR (regression on `main`, not on live): 3D comment pins show through and block clicks on Plan, Concepts and Revisions
- **Repro:**
  1. Open a home that has comments in House.
  2. Switch to Plan, Concepts or Revisions with the view switch.
  3. The House pins stay on screen at opacity 0.32, in the same screen spots. `elementFromPoint` at each pin returns the pin, so it intercepts clicks on the plan or concept image.
- It happens at 1280 and at 390 (`main-pins-leak-over-plan-390.jpg`, `…-concepts-390.jpg`, `…-revisions-390.jpg`).
- **Cause:**
  - `ProjectShell.tsx:310` keeps House mounted with `invisible` (`visibility: hidden`);
  - `PinsLayer.tsx:111` sets `el.style.visibility = "visible"` on each pin wrapper, which overrides the inherited hidden state.
- Live does not keep House mounted, so live has 0 pins on Plan.

### 4. MAJOR: the default floor program puts a Laundry on the roof, so every DHA design fails "Number of storeys"
- **Repro on `main`:**
  1. New home with the brief "1 kanal plot in DHA Phase 6 Lahore, 3 storeys, 5 bedrooms".
  2. Answer north and mid-row.
  3. Choose "Use these floors" (default: Roof: Laundry).
  4. Choose "Decide everything for me".
- v1 `v_34c882acf255` scores **41/42 LDA**: `storeys` fails with "3 storeys above ground (max 2, basement excluded)". The 3 fix rounds ("Fixing 8 → 7 → 2") could not remove it, because the brief asks for the roof laundry.
- **Cause:**
  - `web/src/app/setup/catalogue.ts:271` sets `p.roof.laundry = 1` whenever the plot is 7 marla or more;
  - `api/app/compliance/lda.py:217` counts any level with a non-open-air room as a storey.
- The same default will also fail any 3-storey LDA brief.

### 5. MAJOR (engine regression): a painting is hung over the villa lounge window
- The harness `furniture_walls` **fails** on the villa v2 and on the staged BE2-03 villa: "1 wall items over an opening: g_lounge_painting".
- The painting spans x 8.7–11.9 at 3.6–6.0 ft above the floor. The window `g_lounge_porch_w` spans x 10–16, sill 2.5 ft, head 7.5 ft. The console table stands under the window.
- It is visible in 3D (`main-villa-lounge-painting-over-window.jpg`).
- Round 2's re-test had every villa wall item on solid wall, so this is likely from the EN2-02 path repair, which moves a piece together with its painting.

### 6. MINOR: the setup card says "Mid-row" under both "You said" and "I assumed"
- **Repro:**
  1. Give the brief from issue 4.
  2. Answer "Mid-row" to "Corner or mid-row?".
- The latest card still lists "Mid-row plot, neighbours on both sides" under I assumed until completion.
- **Cause:** `Understood.tsx` builds "You said" live (`saidFacts(brief)`) but "I assumed" from the stored `m.understood.assumptions` snapshot of the first message. The server's `auto_filled` is already correct.

### 7. MINOR: the phone House HUD overflows at 360 px when there are open comments
- At 360 × 740 in Walk, the Comment button with its count sits at x 300–378 and is clipped at the right edge (`main-walk-hud-360-comment-clipped.jpg`).
- At 320 it is mostly off screen.
- 360 is the most common Android width. It fits at 390.

### 8. MINOR: walk number keys don't match the floor stack labels
- The floor stack reads **G, 1, R**, and the help card says "Floors 1–3 or [ ]".
- Key **1** goes to Ground, key **2** to the floor labelled "1" (`?floor=first`), and key **3** to the roof (`controller.ts`, `levelsSorted[digit-1]`).
- A user who presses 1 for the first floor lands on the ground floor.

### 9. MINOR: the car count disagrees between the plan check and the 3D for porches under 18 ft deep
- On p_13230dfcc54c v1 (17′ × 16′ porch):
  - the compliance check says "parks **0** of the 2 cars";
  - the 3D parks 1 car (the tail may overhang up to 4 ft), and its note says "Only **1** of 2 cars fits".

### 10. POLISH: the compliance report repeats "Staircase" and uses Title Case room names
- Print sheet A-900 has two identical "Staircase" rows (2 flights, 19 risers…).
- Room names are in Title Case ("Upper Family Lounge daylight", "Drawing Room size").
- Design-critic M7 raised this, and round 2's triage dropped it as fixed by AP-09, but it is still on `main`.

### 11. POLISH: the first fix round reads "round 2 of 3"
- The run stream goes "Laying out the floors…", then "Fixing 8 problems (round **2** of 3)…", then round 3, so no round 1 is ever shown.
- **Cause:** `architect.py:256` counts the first layout as attempt 1.

### 12. MINOR: the architect's self-review never appears on fresh designs
- Both fresh designs on `main` (BE2-01's local 4-bed and my DHA home) used all 3 attempts, so the review was skipped: `review = {"verdict":"skipped","reason":"time"}`.
- **Cause:** `architect.py` skips it when `len(history) >= PLAN_MAX_ATTEMPTS` or after 360 s.
- As a result, the "Architect's review" rows promised in the journey never show.

### 13. POLISH: the client note box has the wrong accessible name
- On `/s/<token>` the composer's placeholder is "Leave a note for the owner", but its accessible name is "Ask Naqsha".
