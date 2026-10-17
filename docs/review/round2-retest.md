# Round 2 re-test of the round 1 fixes

- **Date:** 17 Oct 2026, 05:40–06:10 PKT. The prototype is due 18 Oct.
- **Tester:** round 2 re-test agent, using the built-in browser. I changed no code.
- **Screenshots:** `docs/review/round2-retest/`

## Headline: the live app does not have the round 1 fixes

The live URL still serves the build that round 1 tested.

| | Live: https://naqsha-242926648187.us-central1.run.app | `main` at d94eccd (round 1 merged) |
|---|---|---|
| Cloud Run revision | `naqsha-00006-zq7`, created **2026-10-16 21:41 UTC** (02:41 PKT, before any fix) | none; never deployed |
| Bundle | `assets/index-CoebF8Ij.js` | `assets/index-Dijrjh3k.js` |

I checked twice: at 00:40 UTC, and again at 01:05 UTC, after testing.

Every fix in the round 1 list is therefore **STILL BROKEN on the live app**. Here is what that looks like on the live URL:

- **AP-02:** the landing still shows hard-coded cards ("10 marla family home", "Courtyard frame house", "Corner home"). Clicking "10 marla family home" opens **the Spanish villa** (`live-10marla-card-opens-villa.jpg`).
- **AP-32:** the landing still says "42/42 LDA · 5/5 livable" and "42 bylaw checks", and still has both "Open portal" and "Open the Portal".
- **AP-08:** the villa status reads "v2 · 44/44 LDA · 8/8 livable", the old count, in which a warning counts as a pass.
- **EN-03 and EN-04:** the villa's as-built notes on live still say:
  - "No parking bay is left … the car in Car Porch was left out"
  - "Kitchen: the fridge was left out"
  - "Master Dressing: the wardrobe was left out"
  - Screenshot: `live-villa-asbuilt-car-fridge-wardrobe-dropped.jpg`.
- **BE-22:** a live JS asset is served with `cache-control: private` and no gzip. Local main serves `public, max-age=31536000, immutable` with `content-encoding: gzip`.
- **BE-01 to BE-07:** I posted the same plan and brief to `POST /api/lda/check` on both servers. The results are in the next table.

| Plan | Live (old rules) | Local main (new rules) |
|---|---|---|
| p_cc0da837ae56 | `plan.program.floor:first` **fail** "should have 2 bedrooms (has 3)" (the BE-01 bug); Bath 2 vent only **warn**; no clash, porch or door-under-stair rule | Rooms per floor passes. `room.vent:f_bath2` **fail**. `plan.opening.clash:g_main_door` **fail**. `plan.circulation.porch` **fail** ("parks 1 of the 2 cars"). `plan.stair.door_under_flight:g_powder_door` **fail** |
| 10 marla sample | 2 warns only | `room.vent:f_bath2` **fail**; new `plan.opening.clash:g_dirty_kitchen_w` **fail** |
| Villa sample | 1 warn only (servant bath shape) | `room.light:g_kitchen` fail, `plan.privacy.dressing` fail, `balcony_links_bedrooms` fail, `porch_walkway` fail, `plan.open_space.covered:g_patio` fail |

So that the fixes could still be judged, I re-tested everything below against `main`. I built it locally and served it with the real API:

- `vite build` into the scratchpad;
- `uvicorn` on :8131, on the production Firestore and Vertex, as a fresh guest;
- the engine dev harness (`web/dev/engine.html?src=`) on the saved versions of both samples and of p_cc0da837ae56.

**Verdict on main:**
- Almost every fix I could reach is **FIXED**.
- The user-visible content of the two samples was not refreshed (BE-09), so the flagship still shows two of the user's complaints:
  - a corner-plot concept;
  - an out-of-date compliance score.
- **Deploying main and refreshing the samples are the two things that matter before the deadline.**

## The user's own feedback (re-checked on main; live has none of the round 1 work)

| Feedback | Status on main | Evidence |
|---|---|---|
| Stairs you can fall from; railings everywhere | **FIXED** | Harness: every edge sample guarded (119 on the 10 marla, 238 on the villa, 118 on p_cc0), and 7 of 7 pushes toward the stairwell held on each house. In the app I held W into the first-floor stairwell guard for 3.5 s and stayed on floor 1 (`main-10marla-first-floor-stair-guards.jpg`). |
| Bedrooms opening into other bedrooms | **FIXED** in the rules and the engine | The villa gets 7 ft privacy screens between the Porch Terrace, the Arched Loggia and the Master Balcony (as-built note). The new rules fail the villa's dressing off the lounge and its joined balconies. The **villa sample's stored plan still has both defects**: it was never regenerated (BE-09). |
| Roof door suspended; no stair to the roof | **FIXED** | Harness on all three houses: "sill +0.00 ft, on the top landing; walker climbed from the ground floor out onto the roof". In the app, R glided the walker from the car porch to the roof. The roof door sits at floor level (`main-10marla-roof-door-at-floor-level.jpg`). The roof plan draws the stair tower with its flights and "Down". |
| TV in front of or in a doorway | **FIXED** | Harness: "No TV, art, mirror or AC over a door or window" (20, 25 and 16 wall items, all on solid wall), and every door's clear zone is empty. |
| Neighbours blocking the view | **FIXED** | Orbit hero, low rear and side views on the 10 marla: a blocking neighbour ghosts or fades, and the house stays visible (`main-10marla-orbit-neighbour-ghosted.jpg`, `main-10marla-side-view-neighbour-faded.jpg`). |
| Concepts always a corner plot | **FIXED for new projects, STILL BROKEN on the flagship sample** | A new DHA mid-row brief gave 4 of 4 concepts with neighbours on both sides, Day and Night (`main-new-concepts-midrow-*.jpg`). The 10 marla sample's **Concept A "Grooved Travertine" is still a corner/detached house**, Day and Night (`main-10marla-conceptA-still-corner-*.jpg`). |
| Day/night comparison | **Works** | Concepts: Night re-renders the same four views. House: Day/Dusk/Night, and the Sun slider stays put and is disabled at Night. |
| Per-floor program | **Works** | The floors widget shows per-floor rooms and sq ft against the floor limit, and storeys are capped at 2 for DHA. |
| Water tank and solar questions | **Works** | The tank and solar cards appear. The reply names both ("A blue plastic tank on the stair tower, with a solar frame on the roof"). |
| Walk floor toggles | **Works** | R, 1 and G glide the walker between floors, and `?floor=` follows. |
| Walking space and cars blocking | **Mostly FIXED** | The villa parks 2 cars in 2 bays with a clear walkway, and I saw both cars in 3D. One under-3 ft spot remains per house (10 marla Dirty Kitchen back door; villa Bedroom 3). |
| Room navigator | **Works** | M or Rooms opens it beside the Rooms pill with search focused. Note: there is no Roof or Stair entry, so "roof" finds nothing. |
| Print/PDF | **FIXED** | A4: 7 sheets (A-000 to A-902), no element outside any sheet, the compliance report runs over 3 sheets. |
| Mouse look like a game | **Works (fallback)** | Pointer lock is refused in the pane. "Drag to look around" appears with no toast, and a drag turns the view the game way. |
| Sign up/in, sharing, team comments | **Works** | Sign-in: field error, red border, `aria-invalid` and `aria-describedby`, cleared on edit. A guest can turn on the client link. The client gets a name prompt once, a note, and an approval ("✓ Approved by Test Client"). The owner's pill reads "Revise with 2 comments", with the approval left out. |
| Modern minimal UI, no stage bar | **Works** | |
| Landing: construction animation, business features, Portal | **FIXED on main** (live is still the old copy) | The animation plays. One "Portal" label. "36 LDA checks on a 10 marla". Sample cards come from `/api/samples`, and the 10 marla card opens its own clone. |

## Round 1 fixes, one by one (on main)

**Status key:**
- FIXED means verified on main.
- STILL BROKEN means I reproduced the problem.
- NOT VERIFIED means I could not exercise it within this session's limits. Most of these need a full Argon design or revise run, or a signed-in account.

All of these items are also STILL BROKEN on the live URL, because it was never redeployed.

### Engine

| ID | Status | Evidence |
|---|---|---|
| EN-01 | **FIXED** | p_cc0 harness: 33 openings built, "walk starts on it at (13.7, 18.8) with the door in view", and no "Door not built" note. 10 marla walk spawns in the Car Porch facing the open main door (`main-10marla-walk-spawn-facing-main-door.jpg`). |
| EN-02 | **FIXED** | "Doorways keep 3 ft clear on each side" passes on all three houses (21, 29 and 18 doors). |
| EN-03 | **FIXED** | The villa no longer drops its fridge or wardrobes (2 notes, against 6 on live). The **10 marla still drops the Bath 2 shower, two TV units, the dresser and two coffee tables** (8 notes). That is a sample-content problem (see issue 3). |
| EN-04 | **FIXED** | Villa: "2 car(s) in 2 bay(s); walkway … clear". See issue 4 for the mismatch between the engine and the plan rule. |
| EN-05 | **FIXED** | The villa note "a 7 ft screen now separates the Porch Terrace and the Arched Loggia, and the Arched Loggia and the Master Balcony". |
| EN-06 | **FIXED** | p_cc0: "Stair stair_g_f was turned around…", plus guard rails across the ground- and first-floor Stair Hall windows. "Stairs at code" passes. |
| EN-07 | **Partly FIXED** | Notes read well for furniture. **Stair notes still print raw ids** (issue 6). |
| EN-08 | **FIXED** | Wall items are on solid wall. TV units that don't fit are left out, with a note. |
| EN-09 | NOT VERIFIED | No production debug handle exposes the renderer stats. |

### Viewer

| ID | Status | Evidence |
|---|---|---|
| VW-01 | **FIXED** | See the neighbours row in the feedback table. |
| VW-02 | NOT VERIFIED in detail | Walking into the stair guard held. I did not probe furniture collisions. |
| VW-03 | **FIXED** | C in walk opens the composer ("TV lounge walls, ground floor"). × drops the draft and shows "Drag to look around" again. |
| VW-04 | Partly verified | The minimap stays visible while hovered. |
| VW-05 | **FIXED** | The refused pointer lock shows only the drag prompt. Idle chrome fades and comes back on hover. |
| VW-06 | **FIXED** | "Walking controls": Move WASD · Look: drag the mouse · Run Shift · Rooms M or the map · Floors 1–3 or [ ] · Comment C · Finish F · Leave Esc (`main-walking-controls-card.jpg`). |
| VW-07 | **FIXED** | The pill reads "Roof" on the roof, the build card reads "Furnishing the open kitchen", and the composer reads "Floor in the drawing room, ground floor". |
| VW-08 | **FIXED** | 0 console errors in owner tabs across orbit, walk, night and floors. |

### Backend

| ID | Status | Evidence |
|---|---|---|
| BE-01 to BE-07 | **FIXED** | See the `/api/lda/check` table above. |
| BE-08 | NOT VERIFIED | Needs a live design run. |
| BE-09 | **STILL OPEN** (it was not in the fixed list) | See issues 2 and 3. |
| BE-10 | **FIXED** | The share payload and the `/comments` handles are `a_<16 hex>`, the guest uid does not appear, and `mine` is present. |
| BE-11, BE-13, BE-14, BE-15, BE-18, BE-21, BE-24 | NOT VERIFIED | |
| BE-12 | **FIXED** | "DHA allows ground + first, plus a basement, so I've kept it to 2 storeys." |
| BE-16 | **Partly FIXED** | "Corner or mid-row?" is asked with chips, and the default appears under "I assumed". **"You said" also lists Mid-row** (issue 5). |
| BE-17 | **FIXED** | "I've chosen north for the facing." The roof ack names the tank and the solar. The completion reads "Here's what I understood … four exteriors". |
| BE-19 | **FIXED** | One "Decide for me" on floors moves on to the roof. |
| BE-20 | **FIXED** | Plot chips, plot widget, and "Plots run 10–400 ft wide and 20–600 ft deep". |
| BE-22 | **FIXED** | See the cache and gzip check above. |
| BE-23 | **FIXED** | No `[gfrs]_` ids in any check title or message on the 3 plans. |
| BE-25 | **FIXED** | The approval is stored as done and left out of "Revise with N". General pins still overlap slightly (issue 10). |
| BE-27 | **FIXED** | New concepts are mid-row 4 of 4 in Day and Night. The auto name became "1 kanal home, DHA Phase 6". |

### App

| ID | Status | Evidence |
|---|---|---|
| AP-01 | **FIXED** | "Start with questions" made a project with no plot. Its card shows the neutral house mark and Plot reads "Not yet". No crash. |
| AP-02 | **FIXED** | Cards are named "10 marla modern home, Johar Town" and "1 kanal Spanish villa". The 10 marla card cloned p_c31d → p_560190a6e5b9 and opened House. |
| AP-03 | **FIXED** | A guest turns on the client link and copies `/s/<token>`. Email invites ask for an account. |
| AP-08 | **FIXED** | "v2 · 35/36 LDA · 10/11 livable · 10 to check". The sheet reads "35 pass · 1 to check", with an "As built" section. |
| AP-09 | **FIXED** | A4, 7 sheets, 0 elements outside a sheet. |
| AP-10 | **FIXED** | The roof plan draws the stair tower as an outline with flights, "Down", "Plastic tank above" and "Stair tower 9′ high" (`main-roof-plan-stair-tower.jpg`). |
| AP-11 | **FIXED** | The compliance sheet moves the dock aside on desktop and hides it at 375 px. |
| AP-13 | **FIXED** | The client view has Rooms (M) and Comment (C) above the Ask bar. |
| AP-14 | **FIXED** | The Day/Dusk/Night group stays at y=94 before and after the switch, and the slider is disabled. |
| AP-16 | **Partly FIXED** | The client sheet shows "On earlier versions". |
| AP-17 | **Partly FIXED** | Polling works, but the client calls `/api/share/{token}/meta`, which returns **404** every 30 s (issue 7). |
| AP-18 | **FIXED** | "Owner · just now", with no "Owner · Owner". |
| AP-19 | **FIXED** | "Your name" prompt before the first note, and "Sent to the owner". |
| AP-24 | **FIXED** | `?v=99` toasts "There's no version 99 of this home. Showing the latest." |
| AP-25 | **FIXED** on desktop | |
| AP-27 | **FIXED** | Email error with a red border (rgb 200,40,30), `aria-invalid`, `aria-describedby`, cleared on edit. |
| AP-29 | **FIXED** | Sign in and Portal are in the 375 px landing header, with no horizontal scroll. |
| AP-30 | **FIXED** | The pill becomes "Revise with 1 comment" as soon as a comment is saved. |
| AP-32 | **FIXED** | |
| AP-04 to AP-07, AP-12, AP-15, AP-20 to AP-23, AP-26, AP-28, AP-31 | NOT VERIFIED, or only partly seen | |

## Core journey regression (on main)

Every step worked, with no console errors in owner tabs and no API 5xx:

1. Landing.
2. Portal.
3. Open the sample.
4. House orbit.
5. Walk:
   - roof via R;
   - roof door at floor level;
   - first-floor stairwell, where I tried to fall and could not;
   - Esc back to orbit.
6. Plan, including the compliance sheet.
7. Print on A4.

## Issues found

1. **BLOCKER: live is not redeployed.**
   - The live revision is from 2026-10-16 21:41 UTC, and live runs the old bundle `index-CoebF8Ij.js`.
   - Judges see none of the round 1 work:
     - the 10 marla card opens the villa;
     - the villa drops its car, fridge and wardrobe;
     - the counts are old;
     - the compliance rules are old;
     - there is no gzip or caching.
   - Fix: deploy `main` (d94eccd) to the `naqsha` service.
2. **MAJOR: the flagship 10 marla sample's Concept A is still a corner/detached house, Day and Night (BE-09 not done).**
   - The header above it says "Mid-row". This is the user's own complaint.
   - To fix: re-roll Concept A and promote it.
3. **MAJOR: the samples' compliance and content are stale under the new rules.**
   - **Villa:** shows "44/44 LDA · 10/11 livable". The current checker gives 5 fails:
     - Kitchen daylight 0 sq ft;
     - dressing off the lounge;
     - joined balconies;
     - porch walkway;
     - covered courtyard.
   - **10 marla:** shows 35/36 with Bath 2 at "0 sq ft" listed only as "to check", and prints that way. The current checker fails it, plus a new opening clash.
   - **10 marla as-built:** still 8 notes, including:
     - **"Bath 2: the shower was left out"** (a bath with no shower);
     - two TV units, the dresser and two coffee tables left out.
   - **Chat history:** the sample chat still uses the phrasing BE-17 banned ("I have recorded…", "Show me layout concepts").
4. **MINOR: the engine and the plan rule disagree about parking.**
   - **Villa:** the engine parks 2 cars in the 18′ × 18′ porch (bays down to 6.1 ft wide, too narrow to open a car door). Meanwhile `plan.circulation.porch_walkway` fails it ("2 cars plus a 3′6″ walkway need 21′6″ × 18′").
   - **p_cc0:** the brief asks for 2 cars. The plan rule says 1 of 2 fits, and the 3D quietly parks 1, with no "Only 1 of 2 cars fit" note.
5. **MINOR: "You said" lists facts the user never said.**
   - Brief: "1 kanal plot in DHA Phase 6 Lahore, 3 storeys, 5 bedrooms". "You said" then shows:
     - "Mid-row", which also appears under "I assumed: Mid-row plot";
     - "2 storeys", although the user said 3 and it was clamped;
     - later, "2-car porch", which also appears under "I assumed".
   - Screenshot: `main-setup-you-said-midrow-and-assumed-midrow.jpg`.
6. **MINOR: raw stair ids in user-facing as-built notes.**
   - Example: "Stair stair_g_f was turned around so that no flight or landing passes over a door below it." (p_cc0).
   - Sources: `web/src/engine/structure/stairs-plan.ts` lines 95, 180, 284 and 435 interpolate `${…id}`.
7. **MINOR: the client view's `/meta` call returns 404 every 30 s.**
   - `client.ts:287` calls `GET /api/share/{token}/meta`. The API has no such route, so every poll logs a console error, then refetches the full share payload.
8. **POLISH:** the composer's suggestion chips lowercase "TV": "Make the tv lounge bigger", "More light in the tv lounge", "Move the tv lounge walls".
9. **POLISH:** on a DHA brief capped at 2 storeys, the Ask placeholder reads "Anything to add or change? A prayer room, a third storey…".
10. **POLISH:** the client's general note pin and the approval pin overlap by about 7 px at the default view. The pins are at x=662 and x=679 and each is 24 px wide.
11. **POLISH:** the counts use different words in different places.
    - On the 10 marla, the dock says "9 livable points need a look" while the sheet says "Livable home 10 pass · 1 to check", because as-built notes are counted as livable in one and not the other.
    - "Look at the 10 marked below" turns into "2" after a fresh load on Plan, because as-built results are only computed once House has been built in that session.
12. **POLISH:** the Sign in dialog shows only the email error when the email is invalid and the password is empty. AP-27 expected each field to show its own error.

## How I tested

| What | Path |
|---|---|
| Local main build | `/private/tmp/claude-501/…/scratchpad/r2/dist`, served by `uvicorn app.main:app --port 8131` |
| Saved versions for the harness | `scratchpad/r2/data/{marla,villa,cc0}.json` |
| Comparison script | `scratchpad/r2/cmp_check.py` |

I created this test data, all as a fresh guest:
- clones of both samples (p_560190a6e5b9 and p_ed77bfbc72b8);
- one client link on the villa clone;
- one owner comment, one client note and one approval on that clone;
- a DHA test project (p_675a22d50bf6) with 4 concepts and their night versions;
- one empty "Untitled home" (p_d172fb0e8a97).

I created no accounts, and wrote nothing to the user's own projects.
