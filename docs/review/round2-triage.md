# Round 2 triage

- **Date:** 17 Oct 2026. The prototype is due 18 Oct.
- **Inputs:** `docs/review/round2-retest.md`, `round2-architect-e2e.md`, `round2-design-critic.md` and the 59 raw issues.
- **Read this first.** Two of the three testers (architect-e2e and design-critic) tested the **live URL**, which still runs a build from before round 1 (revision `naqsha-00006-zq7`, 16 Oct 21:41 UTC, bundle `index-CoebF8Ij.js`). Only the re-test ran `main` (d94eccd). So every raw issue was checked against `main`'s code:
  - an issue that a round 1 task fixed on `main`, and that the re-test did not reproduce there, is dropped (it is folded into the deploy task, BE2-01);
  - an issue reproduced on `main`, or confirmed in `main`'s code, is kept.
- **Method:** duplicates merged (each task lists what it absorbs), every claim checked against the code (file and line in **Hints**), one owner per task:
  - **backend:** `api/**`, contracts/api*
  - **engine:** `web/src/engine/**`, contracts/house-sdk.d.ts, engine-notes.md
  - **viewer:** `web/src/viewer/**`
  - **app:** everything else under `web/`
  - A task that needs a one-line touch in another area says so in its hints.
- **Counts:** 59 raw issues → 28 tasks (1 blocker, 7 major, 13 minor, 7 polish). 19 raw issues were round 1 items that are fixed on `main` but not deployed.

## Order of work

1. **BE2-01 now:** deploy `main` as it is, so the live app stops showing round 0. Then deploy again after this round merges.
2. Engine, viewer, app and backend tasks in parallel.
3. **BE2-02** (re-roll the 10 marla Concept A) can run at any time; it touches only the sample's concepts.
4. **BE2-03** (regenerate the sample plans) runs last: after the engine tasks EN2-01 to EN2-05 and BE2-06 have merged, so the samples are judged by the final rules and engine.
5. Final deploy, then re-check the table below on the live URL.

## Status of the user's own feedback (re-checked)

| User feedback | Status on `main` | Live | Open task(s) |
|---|---|---|---|
| Stairs you can fall from, railings everywhere | Fixed: every edge guarded on 3 houses, stairwell pushes held. **New: you can walk under the low end of a dog-leg's upper flight (≈6–6.5 ft headroom)** | Old build | EN2-01 |
| Bedrooms opening into other bedrooms | Fixed in the rules and the engine. **The villa sample's stored plan still has a dressing off the lounge and joined balconies** | Old build | BE2-03 |
| Roof door suspended, no stair to the roof | Fixed in 3D and on the roof plan. A false "no clear roof outside" note remains | Old build | EN2-05 |
| TV in front of a door or in a doorway | Fixed. **Curtains can hang around a door; a wardrobe can stand across the only window** | Old build | EN2-02 |
| Neighbours blocking the outside view | Fixed | Old build | – |
| Concepts always showing a corner plot | Fixed for new projects. **The flagship 10 marla sample's Concept A is still a corner house, Day and Night** | Same | BE2-02 |
| Day/night comparison | Works | Works | – |
| Per-floor program | Fixed on `main` (master counted with the bedrooms). **Live still miscounts it and cost a family a bedroom** | **Broken** | BE2-01 |
| Water tank and solar questions | Work | Work | – |
| Walk floor toggles | Work | Work | – |
| Walking space and cars blocking | Mostly fixed. **The engine parks cars in 6.1 ft bays the plan rule rejects, and a missing second car gets no note** | Old build | EN2-04, EN2-03 |
| Room navigator | Works. No "Roof" entry on homes without a roof room | Works | AP2-16 |
| Print/PDF | Fixed (A4 and A3 fit) | **Clips on A4** | BE2-01 |
| Mouse look like a game | Drag fallback works; pointer lock untested in the pane | Same | – |
| Sign up/in, sharing with clients, team comments | Work. The client's version poll hits a missing route every 30 s | Partly | BE2-05 |
| Modern minimal UI, no stage bar | Done. The house loading card can stay invisible; phone Revisions scrolls sideways | Same | VW2-01, AP2-01 |
| Landing: construction animation, business features, Portal | Fixed on `main`. Phone labels clipped | **Every sample card opens the villa** | BE2-01, AP2-06 |

---

## BACKEND

### BE2-01 · blocker · Deploy `main`: the live app has none of the round 1 fixes
- **Problem:**
  - Cloud Run service `naqsha` still runs revision `naqsha-00006-zq7` (16 Oct 21:41 UTC), built before round 1. Live serves `assets/index-CoebF8Ij.js`; `main` builds `index-Dijrjh3k.js`.
  - What judges see on live because of it:
    - every landing sample card opens the Spanish villa;
    - "42/42 LDA · 5/5 livable", and "Approval-ready" beside a 0 sq ft bath;
    - the old per-floor rule turned a briefed 4th bedroom into a "Study Room" (architect-e2e #1, p_13230dfcc54c);
    - the architect's review is thrown away silently (architect-e2e #2);
    - Bath 2 with no ventilation passes;
    - A4 print clips its title blocks;
    - HUD text at about 2:1 contrast;
    - the client walk has no rooms, floors or Comment;
    - the villa drops its car, fridge and wardrobe;
    - assets served `cache-control: private`, no gzip.
  - Absorbs: retest #1; architect-e2e "3 bedrooms + Study", "review discarded", "landlocked Bath 2 37/37"; design-critic M1, M4, M6, M7, M9, M10, and the minors on brief scroll, lightbox chrome, roof plan, plan hover, navigator focus, walk help, View popover jump, author hues, auth errors and landing counts.
- **Acceptance:**
  - `gcloud run revisions list --service=naqsha --region=us-central1` shows a new revision serving 100% of traffic.
  - The bundle named in the live `/` equals the local `web/dist` build of the deployed commit.
  - `curl -sI <live>/assets/<bundle>.js -H 'Accept-Encoding: gzip'` shows `cache-control: public, max-age=31536000, immutable` and `content-encoding: gzip`.
  - `POST /api/lda/check` with p_cc0da837ae56's plan and brief returns the round 1 rules (`room.vent:f_bath2` fail, `plan.stair.door_under_flight:g_powder_door`, no `plan.program.floor:first` fail).
  - On live, the landing's 10 marla card opens a 10 marla copy, and the villa status no longer reads 44/44.
  - A fresh run of architect-e2e's 4-bedroom brief ships 4 bedrooms, each with its own bath. "Rooms per floor" passes. Open review issues appear as "Architect's review" rows in the compliance sheet.
  - The service is deployed again after round 2 merges, and the same checks pass.
- **Hints:**
  - Before deploying, run `cd api && uv run pytest -q` and `cd web && npm run build`.
  - Deploy with the `hack2skill` gcloud config (`CLOUDSDK_ACTIVE_CONFIG_NAME=hack2skill`): `gcloud run deploy naqsha --source . --region us-central1 --timeout 3600 --service-account agent-runtime@project-d5fe6dd3-2b61-40b3-932.iam.gserviceaccount.com --allow-unauthenticated`.
  - **Do not pass `--set-env-vars`.** It replaces every variable on the service. Keep the existing ones, or use `--update-env-vars`.
  - Deploying changes the public app. Get the user's go-ahead if the workflow requires it, and avoid deploying in the middle of a judge-facing design run.

### BE2-02 · major · Re-roll the 10 marla sample's Concept A as a mid-row house (Day and Night)
- **Problem:** Concept A "Grooved Travertine" shows a road down the left flank and no left neighbour, by Day and Night, under a header that says "Mid-row · Faces north". B, C and D are mid-row, and new projects come out 4 of 4 mid-row (BE-27). This is the user's own complaint, on the home judges open first. Absorbs retest #2 and design-critic M2.
  - Screenshots: `docs/review/round2-retest/main-10marla-conceptA-still-corner-{day,night}.jpg`.
- **Acceptance:**
  - All four concepts of the sample in the `samples` workspace show neighbours against both side walls and one road frontage, by Day and by Night. Check visually.
  - The sample's chosen concept and its plan stay the same, unless A was the chosen one; then re-select it.
  - A guest's untouched copy picks up the new images (stale copies are refreshed in place).
- **Hints:**
  - Use `agents/concepts.generate(..., base_id=…)` to re-roll one concept, then the night pass for it.
  - Replace A's `url` and `night_url` on the sample project in place (keep its id), or promote with `api/scripts/promote_samples.py`.
  - Prompt: "mid-row plot, neighbours' houses built against both side walls, a single road in front".

### BE2-03 · major · Regenerate both samples with the round 1 and round 2 rules and engine
- **Depends on:** BE2-01, EN2-01 to EN2-05, BE2-06 (and BE2-02 for the 10 marla concepts).
- **Problem:** the samples still carry their round 0 plans and stored compliance reports. The new checker fails both.
  - **Villa:** shows "44/44 LDA · 10/11 livable". Current checker: 5 fails:
    - `room.light:g_kitchen` (0 sq ft);
    - `plan.privacy.dressing:f_master_dress` (the Master Dressing's only door opens to the Upper Family Lounge);
    - `balcony_links_bedrooms`;
    - `porch_walkway`;
    - `plan.open_space.covered:g_patio` (the Kitchen Patio sits under the Roof Terrace slab).
  - **10 marla:** shows 35/36, with Bath 2 at 0 sq ft only "to check" (and printed that way). Current checker fails `room.vent:f_bath2` and `plan.opening.clash:g_dirty_kitchen_w`. 8 as-built notes, including "Bath 2: the shower was left out", two TV units, the dresser and two coffee tables. The lounge TV sits on the entrance wall, 1 ft from the main door.
  - **Chat history:** still uses phrasing BE-17 removed ("I have recorded…", "Show me layout concepts").
  - Absorbs: retest #3; architect-e2e "Master Dressing opens onto the lounge", "Kitchen Patio covered", "landlocked Bath 2" (sample part), "10 marla TV beside the main door"; design-critic M5 (the "12 notes" popover on the sample).
- **Acceptance:**
  - Both samples:
    - pass every LDA check and every livable rule under the current `lda.check`;
    - have stored compliance equal to `promote_samples.py verify`'s recheck;
    - show at most 2 as-built notes in House, with no "left out" and no "less than 3 ft";
    - have a shower and a basin in every bath;
    - park every briefed car;
    - have no TV on a wall that holds the room's entrance;
    - use chat lines in the current voice.
  - The villa's dressing opens only into the master suite, the patio is open to the sky (or no longer counted as daylight), and the front balconies are separate.
  - The landing's hard-coded counts match the new 10 marla (see AP2-08).
- **Hints:**
  - **Full path:** `api/scripts/regen_samples.py setup|design A|B` against a local API on production Firestore (≈10–15 min a design), then `promote_samples.py clone/verify/archive`.
  - **Faster path** if a full run fails twice: revise the current sample version with the failing rules as the instruction (`POST /revise {instruction}`), which keeps the concept. Then promote the new version and rewrite the two stale chat lines in the sample's messages.
  - Check the as-built notes in `web/dev/engine.html?src=` on the new version before promoting.

### BE2-04 · minor · "You said" lists things the user never said (Mid-row, a clamped storey count, a 2-car porch)
- **Problem:**
  - Brief: "1 kanal plot in DHA Phase 6 Lahore, 3 storeys, 5 bedrooms". The card shows **You said:** "Mid-row", "2 storeys". It also shows **I assumed:** "Mid-row plot". After completion, "2-car porch" appears under both.
  - **Causes:**
    - `web/src/app/setup/Understood.tsx` `saidFacts` (L37–56) lists a fact unless its key is in `auto_filled`.
    - `intake.py` adds `corner` to `auto_filled` only at completion (L368), so before that "Mid-row" counts as said.
    - `clamp_storeys` (L465–490) changes `storeys` without recording that Naqsha changed it.
    - The defaults put `spaces` (not `porch`) in `auto`, and the card checks `porch`.
  - Absorbs retest #5.
- **Acceptance:**
  - Corner or mid-row shows under "You said" only when the family said it (`corner_stated === true`); otherwise it shows only under "I assumed".
  - A clamped storey count shows as Naqsha's change ("Kept to 2 storeys: DHA's limit"), never as "You said: 2 storeys".
  - A default porch never shows under "You said".
  - A test in `api/tests/test_intake.py` covers the clamp and the corner cases.
- **Hints:**
  - `clamp_storeys` adds `"storeys"` to `auto_filled`.
  - Expose `corner_stated` on the Brief (`contracts/api-types.ts`, optional).
  - **App touch** in `saidFacts`: corner requires `b.corner_stated === true`; porch checks `auto.has("spaces")`.

### BE2-05 · minor · Client link: `/api/share/{token}/meta` is a 404 every 30 s, and general pins still overlap
- **Problem:**
  - `web/src/api/client.ts` L285–293 polls `GET /api/share/{token}/meta`. `api/app/main.py` has only `/api/share/{token}` (L382) and `/versions/{vid}` (L390). Each poll logs a console 404, then downloads the full share payload with the plan.
  - `_spread` (main.py L427–445) nudges general notes 0.9 m apart. At the default view that is about 17 px for a 24 px pin, so the client's note and approval pins overlap by about 7 px.
  - Absorbs retest #7 and #10.
- **Acceptance:**
  - `GET /api/share/{token}/meta` returns `{current_version_id, versions:[{id,n}]}` with no plan or comments. The client view shows no 404 in the console over 2 minutes.
  - Two or three general pins on a client link don't overlap at the default hero view.
  - The route is documented in `contracts/api.md`, and a test is added.
- **Hints:**
  - Reuse `_shared(token)`.
  - Set the spread step to about 1.6 m. After 4 pins, start a second row (y + 0.6 m).

### BE2-06 · minor · Plan rules: a powder room opening onto the dining table, and a walk-in dressing too small to use
- **Problem:**
  - **Powder room:** `_baths` (planning.py L852–855) only **warns** `plan.privacy.wc_into_dining`. The architect-e2e design shipped a powder room whose only door frames the dining table, and the review's complaint about it was discarded.
  - **Dressing:** there is no minimum size. A 5′6″ × 4′6″ "walk-in dressing" (wardrobe 2 ft + 3 ft aisle needs 5 ft) passes, and the engine has nowhere to put the wardrobe.
  - Absorbs the plan half of architect-e2e #7 and #8.
- **Acceptance:**
  - A powder room or common bath whose only door opens into a dining room fails `plan.privacy.wc_into_dining` (fix text: open it off a lobby, passage or lounge, or add a small lobby).
  - A new fail `plan.room.dressing_size:<id>` fires when a dressing's short side is < 5 ft or its area is < 25 sq ft.
  - `PLAN_SYSTEM` (agents/architect.py) states both rules, so the first draft avoids them.
  - Both samples pass after BE2-03. Tests are added in `api/tests/test_planning.py`.
- **Hints:**
  - Update `docs/review/architecture-rules.md` L229, which lists `dining` as an allowed target for a WET room.
  - Keep messages free of ids (BE-23 style).

---

## ENGINE

### EN2-01 · major · Head-strike zone: you can walk under the low end of a dog-leg's upper flight
- **Problem:**
  - Where the stair hall is open to the lounge, the walker passes under the first treads of the upper flight beside the mid-landing. Seen at (5.25, 36.4) in p_13230dfcc54c, and at (4.92, 33) in the 1 kanal sample. The soffit there is ≈ 6–6.5 ft, below the 6′8″ (80 in) needed over a walkway.
  - **Why the code allows it:**
    - The mid-landing blocks you only because its 0.55 ft body (`stairs-geo.ts` L70–73) sits below the walker's 1.78 m head (`WalkController.ts` L19).
    - Nothing encloses the part of a flight whose underside is between 5.84 and 6.67 ft.
    - L84–85 deliberately leaves the first treads open beside solid floor ("step on sideways… from under the upper flight").
  - Safety, and the user's "stairs where you can fall" area. Absorbs architect-e2e #5 (both houses).
- **Acceptance:**
  - Under every flight and landing, any floor area where the clear height to the soffit is < 6′8″ and > 0 is closed off by a visible element: built-in under-stair storage, a low wall, or a balustrade along the open edge. It has a walk collider.
  - In Walk on p_13230dfcc54c and the 1 kanal sample, pushing west from the lounge at the reported y stops before the soffit drops below 6′8″.
  - The 10 marla (soffit above 7 ft at y=36) is unchanged.
  - The first-tread sideways step-on still works where headroom is fine.
  - A `dev/checks.ts` probe reports the minimum headroom over every walkable cell inside a stair rect.
- **Hints:**
  - In `stairs-geo.ts`, after the flights loop (L74–117): for each flight, compute the soffit `hAt(a) − waist` along `s`. Where it is < 6.67 ft, add a solid box from the floor to the soffit (a cupboard: `m.body` or a joinery material) into `railKit` (walk colliders). Clip it to cells where `floorAt(from, x, y)` is true and the lower flight isn't.
  - Do the same under landings below 6.67 ft.
  - Document the behaviour in `engine-notes.md`.

### EN2-02 · major · Furniture against windows: a wardrobe stands across the only window, and curtains hang around a door
- **Problem:**
  - **Wardrobe.** In the Mother's Bedroom (p_13230dfcc54c) a full-height wardrobe stands centred across the room's only window (`g_bed1_w`, 6 ft). The curtains frame the wardrobe, and no note says so.
    - `place.ts` tier 2 lets an ESSENTIAL tall piece ignore window zones ("a tall piece may stand in front of a window", L604–611). The search reaches tier 2 (L783–786) before trying a narrower wardrobe at tier 1 on every wall, and without a note.
  - **Curtains.** In the lounge, curtains hang either side of the Drawing Room door.
    - When `along_ft` is given (Argon always gives it; see the curtain calls in all three saved versions), curtains are placed at that position, even over a door. Snapping to a window happens only when `along_ft` is missing (L478–487).
    - On the `front` wall the along convention is mirrored (`u = r.x + r.w − along`, L490), so 11.5 ft landed on the door at x 10.5 instead of the window at x 19.5.
  - Absorbs architect-e2e #4 and #10. This is the same class of problem as the user's "TV in front of a door".
- **Acceptance:**
  - In habitable rooms, no item taller than a window's sill + 0.5 ft overlaps that window's zone. Before giving up, the placer tries every wall at tiers 0–1, then the 0.85/0.75/0.6-width wardrobe.
  - If the only remaining spot blocks a window, the wardrobe goes in front of the **smallest** window that isn't the room's only one. Otherwise it is left out with a note in plain words ("The wardrobe was left out to keep the window clear").
  - Curtains always centre on a window or sliding door: the nearest one to the asked position on that wall, else the largest in the room. They are never placed over a door. A room with no window gets no curtains (quietly).
  - Re-running the harness on p_13230dfcc54c, the 10 marla and the villa shows every curtain pair centred on glazing, and no tall piece across a window.
  - A check is added in `dev/checks.ts`.
- **Hints:**
  - `place.ts` L64 `TALL_EXEMPT`, L601–611 `free(..., tier)`, L774–786 the tier ladder, L476–491 the curtains branch.
  - `auto.ts` `curtainsOnWindows()` already finds windows; reuse it for explicit calls.

### EN2-03 · minor · Wet rooms and small dressings: a powder room with no basin, a bath with no shower, an empty walk-in dressing
- **Problem:**
  - **Powder room.** `auto.ts` `bath()` (L461–494) places the vanity only on a free stretch ≥ 2.2 ft at 3 ft depth. The 6′ × 5′6″ powder room got a WC and no basin, silently. `DEFINING` (place.ts L87–100) lists only the WC for `bath` and `powder`.
  - **Bath 2.** The 10 marla sample's Bath 2 dropped its shower.
  - **Dressing.** `dressing()` (L496–500) needs a 2.5 ft span with full wardrobe depth. A 5′6″ × 4′6″ dressing stayed empty.
  - Absorbs the fixture half of architect-e2e #7 and #8, and retest #3's "shower left out".
- **Acceptance:**
  - Every bath and powder room gets a basin, falling back to a 1.5 × 1.2 ft wall-hung basin on any free wall. Every bath gets a shower (or a tub), falling back to a 2.6 × 2.6 ft shower tray or a wet-area shower on the far wall.
  - A missing basin or shower is an `asbuilt.furniture_missing` fail note.
  - A dressing gets at least one wardrobe or a 1.6 ft deep hanging unit along its longest free wall.
  - The harness on p_13230dfcc54c and both samples shows a basin in every wet room and no empty dressing.
- **Hints:**
  - Add `{label:"basin", types:["vanity"], add:"vanity"}` to `DEFINING.bath/powder`, and `{label:"shower", types:["shower","bathtub"], add:"shower"}` to `bath`.
  - Add a shallow wardrobe to `SMALLER` (L74–82).

### EN2-04 · minor · Parking: one bay standard with the plan rule, and a note whenever fewer cars park than the brief asks
- **Problem:**
  - The engine's bays can be as narrow as the car itself (`parking.ts` L36 `CAR.w = 6.1`, L290 `[9, …, 6.6, CAR.w]`), so the villa's 18′ × 18′ porch parks 2 cars that cannot open their doors. Meanwhile `planning.py` (`CAR_W = 9`, L1008) fails the same porch.
  - The engine counts the cars to park from furnish calls and porch names (`build.ts` L144–151). When the brief asks for 2 (p_cc0, `car_porch:2`) but the design code furnishes 1, it parks 1 and says nothing.
  - Absorbs retest #4 and architect-e2e #3 (the main-side remainder).
- **Acceptance:**
  - Engine bays are at least 8.5 ft wide (9 ft preferred) and 18 ft deep, matching the plan rule's standard. Document it in `engine-notes.md`.
  - The car count comes from the plan. When fewer cars park than the plan's porch asks for, the engine adds a car if a bay is free; otherwise it notes "Only 1 of 2 cars fits in the car porch…" (`asbuilt.car_dropped`, fail).
  - On p_cc0 and the villa v2, the 3D, the note and `plan.circulation.porch*` agree.
- **Hints:**
  - **Backend touch** (one line in the architect's plan repairs): when the brief has `car_porch:N` with N ≥ 2, name the porch "Car porch (N cars)". `build.ts` already reads `(\d)\s*car` from porch names, and `planning.py` `_named_cars` does too.
  - After the furnishing sections, compare `ctx.carsParked` with `ctx.carsWanted`, and `furnish('car_sedan')` into the free bays before writing the note (`place.ts` L445–466).

### EN2-05 · major · As-built notes: false alarms, raw ids and furnishing chatter undermine "8/8 livable"
- **Problem:**
  - **False alarms** on p_13230dfcc54c:
    - "`g_kitchen_open` is not on the wall between Open Kitchen and TV Lounge, so it was not built", and the same for `f_corr_arch`. Both edges are open-plan and walkable (`model.ts` L327–330 reports any opening with no wall run).
    - "No wall of the stair tower touching the top landing opens onto clear roof…; the door was put at the top landing anyway". The door opens onto clear, flat roof (`stairs-plan.ts` L652–660: the fallback always adds a fail).
  - **Raw ids** in user notes:
    - "Stair `stair_g_f` was turned around…" (`stairs-plan.ts` L95, L180, L189–190, L284, L435);
    - "`${op.id}` joins …" and "`${op.id}` is not on the wall" (`model.ts` L307, L329).
  - **Furnishing chatter.** Every non-decor, non-defining drop (dresser, coffee table, TV unit, sideboard, water dispenser) becomes a "Furniture left out" note (`place.ts` L429). The flagship shows 12 notes beside a green "8/8 livable".
  - Absorbs retest #6, architect-e2e #11 and design-critic M5.
- **Acceptance:**
  - No as-built message contains an id (`/[gfrb]_[a-z0-9_]+|stair_[a-z_]+/`).
  - Stairs are named "the ground-to-first stair", and so on.
  - An opening between two rooms that are `open_to` each other (no wall built) is skipped quietly.
  - The roof-door note appears only when the chosen door's 3 ft outside strip is actually blocked.
  - Optional furniture that doesn't fit is left out quietly (logged with `warn()` only). Notes remain for defining items, cars, blocked windows (EN2-02) and walkways under 3 ft (at most one a room).
  - Identical messages are merged (`core/notes.ts`).
  - The harness shows ≤ 3 notes on p_13230dfcc54c, each describing a real deviation.
- **Hints:**
  - Add a `stairLabel(s)` beside `openingLabel` (`model.ts` L535).
  - For the open-plan test: `plan.room(a).open_to?.includes(b) || plan.room(b).open_to?.includes(a)`.
  - In the roof-door fallback, re-test the strip in front of the chosen end with `pointOK` before adding the note.

---

## VIEWER

### VW2-01 · major · The House loading card can stay invisible: an empty sky for several seconds
- **Problem:**
  - `.nq-build-card` enters with `animation: nq-card-in 420ms … both` (`viewer.css` L88–92). The keyframe starts at `opacity: 0` (L300).
  - The first build yields through a `MessageChannel` macrotask (`engine/build.ts` L44–51), which does not guarantee a rendering opportunity. The critic sampled the animation at `currentTime 0`, `opacity 0` from "1 of 24" to "18 of 24" layers. The user sees a pale sky with a ghost card.
  - On phone the card sits under the floor stack.
  - (The step text is already plain on `main`, VW-07.)
  - Absorbs design-critic M3.
- **Acceptance:**
  - The card is legible from the first frame of every House load, even if the animation never runs: it never depends on an animation to become visible.
  - The progress bar visibly advances during the build on a mid-range laptop.
  - On a 390 px phone the card sits clear of the floor stack and the top chrome.
- **Hints:**
  - Drop opacity from `nq-card-in` (transform only), or use `animation-fill-mode: none`.
  - In `viewer/core/build.ts` `onSection` (around L219), `await` a real frame (`requestAnimationFrame` then `setTimeout 0`) at least every ~50 ms during the first build, so the browser paints. This stays in the viewer.
  - On phone, position the card at `top: calc(var(--chrome-top) + 72px)`, or centre it in the free area.

---

## APP

### AP2-01 · major · Phone Revisions is 848 px wide and scrolls sideways; compare is missing on phone
- **Problem:**
  - Below `lg`, the Revisions grid (`RevisionsView.tsx` L82) has no explicit column. Its single `auto` track takes the min-content width of the horizontal versions `<ol>` (L122, 1372 px), so the H1, "What changed" and the buttons run off a 390 px screen.
  - The before/after compare renders only when `wide` (L94, `hidden xl:block`).
  - Absorbs design-critic M8.
- **Acceptance:**
  - At 390 × 844 the page has `scrollWidth === clientWidth`, with 16 px gutters. The versions row scrolls inside its own strip.
  - A compact before/after compare (the existing `PlanCompare`, about 280 px tall) appears below "What changed" on phone and tablet.
- **Hints:**
  - Add `grid-cols-[minmax(0,1fr)]` to the base grid, and `min-w-0` to the `VersionRail` `<nav>` (L120).

### AP2-02 · minor · Setup stage: Share floats alone at top-centre
- **Problem:** on desktop the top row is a 3-column grid (`ProjectShell.tsx` L328–336). When `ViewSwitch` returns `null` (fewer than 2 views, `ViewSwitch.tsx` L29), `People` drops into the middle column, so Share sits at top-centre. Absorbs the design-critic minor.
- **Acceptance:** on a setup-stage project at 1440, Share sits in the top-right capsule, and the centre slot is empty.
- **Hints:** wrap `<ViewSwitch>` in a `<div className="flex justify-center">` (or render a placeholder), so the grid always has 3 children.

### AP2-03 · minor · The compliance sheet ignores Esc and doesn't take focus
- **Problem:** `PlanView.tsx` L172 maps Escape only to clearing the selected check and pin. The sheet (`motion.aside`, L476–508) stays open, and focus stays on `<body>`. Absorbs the design-critic minor (the Next-pill overlap is fixed on `main` by AP-11).
- **Acceptance:**
  - Esc closes the sheet when it is open (a selected check clears first).
  - Opening it moves focus to the sheet's heading or its Close button.
  - Closing it returns focus to the compliance chip.
- **Hints:** in the Escape handler, `if (sheet) setSheet(false)`. Use a ref with `tabIndex={-1}` on the heading.

### AP2-04 · minor · Dialogs re-centre and jump under the cursor (Rooms on each floor, auth errors)
- **Problem:**
  - `ui/Dialog.tsx` L61 centres dialogs vertically (`items-center`). When the content height changes, the dialog moves:
    - "Rooms on each floor" moves its top 62 → 93 → 221 px across tabs;
    - the sign-in dialog shifts when an error appears.
  - The storey toggle reads "1 storey | 2 | 3" (`widgets.tsx` L241–243).
  - Deferred as polish in round 1; it is cheap and two testers hit it.
- **Acceptance:**
  - Non-sheet dialogs are top-anchored (`items-start`, `pt-[min(12vh,96px)]`). Switching floor tabs and showing a field error don't move the dialog's top edge.
  - The storey options read "1 storey · 2 storeys · 3 storeys".

### AP2-05 · minor · Concept images: 1.6–1.8 MB PNGs, night loaded eagerly, no shimmer
- **Problem:**
  - `ConceptsView.tsx` `ConceptImage` (L340–373) loads the full PNG for every tile. The night `<img>` is in the viewport at `opacity: 0`, so `loading="lazy"` still fetches it: about 13 MB a view.
  - Tiles sit flat grey for 2–6 s.
  - `/api/assets` already serves WebP at `?w=320|640|960` (`main.py` L776–787).
- **Acceptance:**
  - Tiles load `?w=960` WebP (≤ 200 KB each). The lightbox loads a larger size. Night images are requested only after Night is first chosen.
  - Unloaded tiles show a shimmer.
  - Day/Night crossfade behaviour is unchanged.
- **Hints:**
  - **Backend touch:** allow `1600` in the `w` whitelist (`main.py` L780) for the lightbox.
  - Keep the original URL as a fallback `onError`.

### AP2-06 · minor · Landing construction: phone labels clipped and ~5 px tall; a blank first fold on desktop
- **Problem:**
  - On phone the SVG is cropped to `viewBox 150 0 720 H` (`Construction.tsx` L104–106). The level labels "+0′", "+11′" and "+21′" at x = 138 (L292–302) fall outside and are clipped. The 10–11 px font in a 720-unit box renders at ≈ 5–7 px.
  - On desktop the frame is blank until it reaches 50% visibility, leaving a white 246 px slab at the end of the first fold.
  - Header items are 38 px/14 px (nav) against 32 px/13 px (Sign in, Portal).
  - "approval-ready" breaks at the hyphen.
- **Acceptance:**
  - At 390 px every label sits inside the frame at ≥ 11 px rendered.
  - Before playing, the frame shows a poster state (the plot outline and line elevation).
  - Header controls share one height and size.
  - Hyphenated compounds use a non-breaking hyphen (U+2011).
- **Hints:** use phone-only label positions and font sizes (×2) inside `Drawing`, and keep the `nqc-wait` state drawing the plot lines.

### AP2-07 · minor · Phone House: five rows of chrome (about 43% of the screen)
- **Problem:**
  - At 390 × 844, `HouseView.tsx` stacks:
    - row 0: Orbit/Walk, View, version (L430–451);
    - row 1: Rooms and Comment (L455–468, `row(phone ? 1 : 0)`);
    - row 2: the as-built chip (L470–481);
    - then the dock's narration with Next, and Ask.
  - Orbit/Walk is 30 px tall, and Comment is an unlabelled icon.
- **Acceptance:**
  - At 390 × 844, at most two HUD rows sit above the dock. Rooms and Comment share row 0 with the mode switch (icons with `aria-label`s). The as-built chip moves into the title capsule's menu or Details.
  - Touch targets are ≥ 44 px.
  - The house's front isn't hidden under the floor stack at the default framing.
- **Hints:**
  - `row()` helper; Segmented `size="lg"` on phone.
  - **Viewer touch:** if a framing offset is needed, `viewer/core/framing.ts` takes a padding.

### AP2-08 · minor · Copy leftovers
- **Problem** (each confirmed on `main`):
  - Composer chips lowercase the room: "Make the tv lounge bigger" (`explore/Composer.tsx` L18–24, `toLowerCase()`).
  - The Ask placeholder suggests "a third storey" on a DHA brief capped at 2 (`setup/BriefView.tsx` L76).
  - "Section cut" (`HouseView.tsx` L722) uses a word DESIGN §8 bans.
  - "1 note so far. I'll turn them…" (`ProjectShell.tsx` L207).
  - One action has two names: "Apply 1 open comment…" (`CommentsSheet.tsx` L126) and "Revise with 1 comment" (`shell/next.ts` L104).
  - The Revisions H1 shows the raw summary `“request” · 36/36…` when a version has no `changes` (`RevisionsView.tsx` `storyTitle`, L335–341).
  - The landing hard-codes "36 checks on a 10 marla" and "36 LDA checks · 8 livable" (`Landing.tsx` L21, L144). These will drift after BE2-03.
  - Title Case room names ("Master Bedroom", "Ground Floor") in the command bar and the minimap.
  - Absorbs retest #8 and #9, and the design-critic copy and consistency minors.
- **Acceptance:**
  - Chips read "Make the TV lounge bigger": the first letter is lowered only when the second isn't a capital.
  - The placeholder's examples respect the envelope (no "third storey" when `max_storeys` ≤ storeys).
  - "Cut away" replaces "Section cut".
  - Singular agreement is right.
  - One name for applying comments, "Revise with N comments".
  - The Revisions H1 is a sentence ("Made the front lawn greener."), with no status suffix or quotes.
  - Landing counts come from the 10 marla sample's stored counts via `/api/samples`, or say "every LDA check".
  - Room and floor names go through `sentenceCase` in the command bar and the minimap.
- **Hints:**
  - **Viewer touch:** `viewer/hud/MiniMap.tsx` floor title.
  - Strip `/ · \d+\/\d+.*$/` and the curly quotes from `versionLine` output.

### AP2-09 · minor · Accessibility: exclusive choices as `aria-pressed`, a tank button named "tank…", `<dt>` inside `<button>`
- **Problem:**
  - The roof dialog's tank and solar choices are `aria-pressed` buttons (`setup/widgets.tsx` L495, L509), not a radiogroup.
  - The concrete tank button's accessible name starts with the SVG's text.
  - Brief rows put `<dt>` inside a `<button>` (`BriefSheet.tsx` L157), which is invalid `dl` content.
- **Acceptance:**
  - Single-choice groups are `role="radiogroup"` with `role="radio"` and `aria-checked`, and arrow keys move between options.
  - Picture cards have explicit `aria-label`s, and their SVGs are `aria-hidden`.
  - Brief rows are valid: the button sits inside `<dd>`, or the row is not a `dl`.
  - axe reports no violations for these three.

### AP2-10 · polish · "To check" counts differ between the dock, the sheet and a reload
- **Problem:**
  - The dock says "9 livable points need a look" (it counts as-built notes as livable: `compliance.ts` `livableIssues`), while the sheet says "Livable 10 pass · 1 to check" with as-built rows apart.
  - As-built results exist only after House is built in that session (`POST /asbuilt` is not stored, `main.py` L647–653), so a fresh load on Plan shows "2 to check" for the same home.
  - Absorbs retest #11.
- **Acceptance:**
  - The dock, chip and sheet use one definition and the same numbers, with as-built shown as "N notes from the 3D model".
  - The numbers are the same after a reload straight into Plan.
- **Hints:** **backend touch:** store the as-built report on the version (`as_built`), and return it with the version.

### AP2-11 · polish · Sign in shows only the first field error
- **Problem:** `AuthForm.tsx` `submit` (L106–113) returns on the first invalid field. Absorbs retest #12.
- **Acceptance:** an invalid email with an empty password marks both fields at once, each with its own message and `aria-describedby`. Focus goes to the first invalid field.

### AP2-12 · polish · View › Cars shows ON in Walk while the cars are hidden
- **Problem:** `HouseView.tsx` L716: `<Toggle on={cars !== "hide"}>` reads ON for `"auto"`, but `"auto"` hides cars in Walk (`controller.ts` `vehicleTarget`, L961–965). (Walking through a shown car is fixed on `main` by VW-02.) Absorbs architect-e2e #13.
- **Acceptance:** the switch shows what's on screen in each mode. Toggling it in Walk shows a solid car.
- **Hints:** pass `mode` to `ViewPanel`: `on = cars === "show" || (cars === "auto" && mode === "orbit")`.

### AP2-13 · polish · More than one accent primary on a screen
- **Problem:**
  - Revisions has a primary "Walk through it" (`RevisionsView.tsx` L273) beside the Next pill that says the same.
  - The House View popover's "Render this view" is primary (`HouseView.tsx` L734) beside the Next pill.
  - (Brief's in-content button is already secondary on `main`.)
- **Acceptance:** one accent button per screen. The in-content twins use `variant="secondary"`.

### AP2-14 · polish · Run narration: "1 parts", and the step label falls back from Review to Fixing
- **Problem:**
  - `shell/narration.ts` L69 reads "Building your home in 3D, 1 parts so far".
  - The review's re-check emits `stage: "fix"` (`agents/architect.py` L486), so the step label regresses from Review to "Fixing 1 issue".
  - Absorbs architect-e2e #12. (The livable denominator changing between rounds is inherent; dropped.)
- **Acceptance:** correct plurals ("1 part"), and the step indicator never moves backwards during a run.
- **Hints:** **backend touch:** emit `stage: "review"` for "Re-checking the improved plan…".

### AP2-15 · polish · Phone polish: the Concepts placeholder is clipped
- **Problem:** at 390 px the placeholder "Ask for four more, like more brick and deeper shade" (`ConceptsView.tsx` L179) wraps inside a one-line composer and shows a scrollbar.
- **Acceptance:** the phone placeholder fits one line ("Ask for four more"), or the composer grows to fit it.

### AP2-16 · polish · Room navigator: no "Roof" entry on homes without a roof room
- **Problem:** `RoomNavigator.tsx` L30 lists plan rooms only, so on the 10 marla (roof has only the mumty) typing "roof" finds nothing, although R glides there.
- **Acceptance:** when the plan has a roof level, the navigator lists "Roof" (and "Stair" if it is cheap). Choosing it glides there like R.

---

## Won't fix (dropped, with reason)

**Round 1 fixes that are on `main` but not live** (folded into BE2-01, re-check after the deploy):
- **"House ships with 3 bedrooms + a Study Room"** (architect-e2e #1): BE-01 is on `main`. `_program` sums the bedroom keys, and the re-test's `/api/lda/check` on `main` passes "Rooms per floor".
- **"Architect self-review discarded"** (architect-e2e #2): BE-08 is on `main`. `architect.py` L380–408 turns open issues into "Architect's review" livable rows (`with_review`), and a rejected candidate gets a fix round.
- **"Landlocked Bath 2 yet LDA 37/37"** (architect-e2e #6): BE-02 is on `main` (`room.vent` fails at 0 sq ft; re-test confirmed). The sample part is BE2-03.
- **Landing sample cards open the villa** (critic M1): AP-02 is on `main` (`Landing.tsx` maps `/api/samples`; re-test confirmed).
- **HUD contrast about 2:1** (critic M4): AP-15 is on `main` (`index.css` L33–35 `#C9C9D1`, L92 glass at .75). The two-tone HUD focus ring is also on `main` (L177–185).
- **"Approval-ready" with warnings; livable rules missing** (critic M6): AP-08 and AP-22 are on `main`. `compliance.ts` `summarize` is honest; `ALWAYS_LIVABLE` adds railings, doors and paths; solar reads "% kept clear (min 55%), about N sq ft, ~k kW".
- **A4 print clips; duplicated rows** (critic M7): AP-09 is on `main`, and the re-test confirmed 7 A4 sheets with nothing outside a sheet.
- **Phone Plan dock covers zoom and legend** (critic M9): AP-11 is on `main` (`PlanView.tsx` L299, L389 sit above `--dock-h`). The phone chip row scrolls in its own strip.
- **Client walk lacks rooms, floors and Comment** (critic M10): AP-13 is on `main` (re-test confirmed).
- **Brief content under capsules; dock over "What LDA lets you build"**: AP-31 is on `main` (`scroll-clear-chrome` with dock padding).
- **Concepts lightbox chrome**: AP-23 is on `main` (`ConceptsView.tsx` L165: the dock adds no chips or primary in the lightbox).
- **Roof plan hides the stair**: AP-10 is on `main` (re-test confirmed).
- **Plan rooms have no hover info**: on `main`, `FloorPlan.tsx` L1096–1225 shows the room card with "Opens to", on hover, tap and keyboard.
- **Room navigator doesn't focus its filter**: AP-25 is on `main` (re-test: "search focused").
- **Walk help "?" won't open; doubled "Drag to look"**: VW-05 and VW-06 are on `main` (re-test confirmed). The `?floor=roof` deep link into Walk is low value; R works.
- **View popover jumps at Night**: AP-14 is on `main` (re-test: the group stays at y=94).
- **One author, two hues**: on `main` the pins (`PinsLayer.tsx` L11), the plan (`plan/model.ts` L292) and the avatars (`Avatar.tsx` L27) all hash the same author key into the same 6 hues.
- **Auth email error under the password field**: AP-27 is on `main` (re-test confirmed). The remaining two-errors point is AP2-11.
- **Landing "42/42 · 5/5", "1:100", "Three places"**: AP-32 is on `main`. The remaining drift risk is in AP2-08.

**Merged into other tasks:**
- **"Flagship 10 marla concept A is still a corner plot"** (critic): duplicate of retest #2 → BE2-02.
- **"2-car porches hold one car or none"** (architect-e2e #3): on `main` the villa parks 2 (EN-04). The rest (bay width, no note for a missing second car) is EN2-04.
- **"View › Cars: the car is ghosted and walk-through"**: fixed on `main` (87d197c, `controller.ts` L978–990: shown cars are solid). Only the switch state remains (AP2-12).

**Not doing:**
- **Workspace thumbnails mix photos and clay captures**: round 1 kept this on purpose (the card shows the latest version). Duplicate sample cards came from copies made before BE-21's deterministic clone. Opening the Samples tab reopens your own (renamed, commented) copy by design: one copy per owner keeps your edits.
- **"Sample" appears in both the chip and the name**: the names are the user's own sample titles.
- **Tab order doesn't follow the visual layout** (critic a11y): needs a DOM reorder across the shell and HUD; low impact before the deadline.
- **Flat night in 3D, white Comments sheet over 3D, black vs white selected-floor thumb, the revisions "After" pill over the north arrow, the empty half of the builder band**: design polish that isn't cheap (night lighting) or not worth the risk now.
- **Concepts lightbox title misaligned with the image**: cosmetic; the lightbox was reworked on `main` (AP-23). Re-check after the deploy.
- **Phone workspace indent and full-size "New home" tile**: round 1 deferred it as polish; still deferred.
- **The livable denominator changes between fix rounds**: inherent; the rule set grows as the plan gains rooms.
