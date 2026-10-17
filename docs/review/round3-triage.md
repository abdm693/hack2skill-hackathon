# Round 3 triage

- **Date:** 17 Oct 2026. The prototype is due 18 Oct.
- **Inputs:** `round3-retest.md`, `round3-architect-e2e.md`, `round3-design-critic.md` and 59 raw issues.
- **Read this first.** Two of the three testers (architect-e2e and design-critic) tested the **live URL**. It still serves revision `naqsha-00006-zq7` (16 Oct 21:41 UTC, `index-CoebF8Ij.js`), which is older than round 1. Only the re-test ran `main` (d52d3f1).
  - Every raw issue was checked against `main`'s code.
  - An issue that an earlier round fixed on `main`, and that the re-test did not reproduce there, is dropped. Its check is folded into the deploy task, BE3-01.
  - An issue reproduced on `main`, or confirmed in `main`'s code, is kept.
- **Method:**
  - Duplicates are merged; each task lists what it absorbs.
  - Each claim was checked against the code (file and line under **Hints**).
  - Each task has one owner:
    - **backend:** `api/**` and contracts/api*;
    - **engine:** `web/src/engine/**` and contracts/house-sdk.d.ts;
    - **viewer:** `web/src/viewer/**`;
    - **app:** everything else under `web/`.
  - Where a task needs a one-line change in another area, its hints say so.
- **Counts:** 59 raw issues became 21 tasks: 2 blockers, 8 majors, 7 minors and 4 polish. 42 raw issues repeat items already seen in earlier rounds; most are fixed on `main` but not deployed.

## Order of work

1. **BE3-01 part 1, now:** deploy `main` as it is (d52d3f1). Every round 1 and round 2 fix is verified on `main`, and the judges still see round 0. Only VW3-01 (pins leaking over Plan) is a regression on `main`. It is small, so fix it first if the deploy can wait about 30 minutes.
2. Engine, viewer, app and backend tasks run in parallel.
3. **BE3-02** (publish the samples) runs once EN3-03 has merged and the new plan rules (BE3-03, BE3-05, BE3-06) are in. That way the promotion recheck uses the final rules, and the engine harness passes on the staged villa.
4. **BE3-01 part 2:** deploy again. Then re-check the table below on the live URL, and write the bundle hash at the top of every review file.

## Status of the user's own feedback (re-checked)

| User feedback | `main` | Live | Open task(s) |
|---|---|---|---|
| Stairs where you can fall; railings everywhere | Fixed: guards, falls and headroom pass on 6 houses | Old build (head-strike under the upper flight) | BE3-01 |
| Bedrooms opening into other bedrooms | Fixed in the rules and on fresh designs. The villa sample's dressing still opens off the lounge until it is published | Old | BE3-02 |
| Roof door suspended; no stair to the roof | Fixed (door at the top landing, at floor level, on 6 houses) | Fixed | – |
| TV in front of a door, or in a doorway | Fixed for doorways. A TV can still sit on the wall a lounge is entered through | Old | EN3-04 (polish) |
| Neighbours blocking the outside view | Fixed in orbit. **"Render this view" turns a ghosted neighbour into a glass building** | Same | VW3-02 |
| Concepts always showing a corner plot | Fixed for new homes (4/4 mid-row). **The flagship's Concept A is still a corner plot** | Same | BE3-02 |
| Day/night comparison | Works | Works | – |
| Per-floor program | The master is now counted with the bedrooms. **The default "Roof: Laundry" fails DHA's storey limit on every fresh design** | The master is miscounted | BE3-03, BE3-01 |
| Water tank and solar questions | Work | Work | – |
| Walk floor toggles | Work. **Number keys don't match the G / 1 / R labels** | Work | VW3-03 |
| Walking space and cars blocking | **A 10×10 bedroom is walled off by its bed and wardrobe. A facade frame's bottom beam closes the porch mouth.** The plan check and the 3D disagree on the car count | Same | EN3-01, EN3-02, BE3-06 |
| Room navigator | Works. The pill flickers through rooms during a glide, and the input jumps while filtering | Works | VW3-04, AP3-03 |
| Print/PDF | Fixed (A3 and A4 fit). The sample's stored report repeats "Staircase"; room names are in Title Case | A4 clips | BE3-02, AP3-04 |
| Mouse look like a game | Drag fallback works | Same | – |
| Sign up/in, sharing with clients, team comments | Work. **3D comment pins leak over Plan, Concepts and Revisions** | Partly | VW3-01 |
| Modern minimal UI, no stage bar | Done. The phone HUD clips at 360 px | Old | AP3-02 |
| Landing: construction animation, business features, Portal | Fixed | Every sample card opens the villa | BE3-01 |

---

## BACKEND

### BE3-01 · blocker · Deploy `main`: the live app still runs the build from before round 1
- **Problem:** Cloud Run serves only `naqsha-00006-zq7` (16 Oct 21:41 UTC). `gcloud builds list` shows no build after it.
  - Live `/` and `/app` load `assets/index-CoebF8Ij.js`. `main` builds `index-CTugblQe.js`, and `/assets/index-CTugblQe.js` is a 404 on live.
  - What judges see because of it:
    - every landing sample card opens the villa;
    - "42/42 LDA · 5/5 livable";
    - A4 print spills out of its sheets (22, 14 and 61 elements outside);
    - the old rules (`wc_into_dining` only warns, no `dressing_size`, a 0 sq ft bath vent only warns);
    - the per-floor rule miscounts the master, so the fix loop deletes a bedroom;
    - the head-strike zone under the upper flight;
    - raw ids in the compliance sheet and as-built notes;
    - HUD contrast of about 2.3:1;
    - the walk help won't open;
    - "Drag to look around" twice.
  - Absorbs: retest #1, architect-e2e "read this first", critic B1, and the 3 deploy raw issues. It also covers every raw issue dropped below as "fixed on `main`".
- **Acceptance:**
  - `CLOUDSDK_ACTIVE_CONFIG_NAME=hack2skill gcloud run revisions list --service=naqsha --region=us-central1` shows a new revision serving 100%. The bundle named in live `/` equals the local `web/dist` build of the deployed commit.
  - `curl -sI <live>/assets/<bundle>.js -H 'Accept-Encoding: gzip'` shows `content-encoding: gzip` and `cache-control: public, max-age=31536000, immutable`.
  - `POST /api/lda/check` on live with `api/tests/fixtures/plan-e2e-4bed-v1.json` and `brief-e2e-4bed.json` returns:
    - `plan.privacy.wc_into_dining:g_powder` as a fail;
    - `plan.room.dressing_size:f_master_dress` as a fail;
    - no `plan.program.floor:*` fail.
  - On live:
    - the landing's 10 marla card opens a 10 marla copy;
    - A4 print preview has 0 elements outside any sheet;
    - in Walk, "Drag to look around" appears once.
  - After round 3 merges, deploy again and repeat these checks.
  - Each re-test file names the bundle hash it tested.
- **Hints:**
  - Before deploying, run `cd api && uv run pytest -q` and `cd web && npm run build`. Then deploy:
    `gcloud run deploy naqsha --source . --region us-central1 --timeout 3600 --service-account agent-runtime@project-d5fe6dd3-2b61-40b3-932.iam.gserviceaccount.com --allow-unauthenticated`.
  - **Never pass `--set-env-vars`.** It replaces every variable on the service. Use `--update-env-vars` if a variable must change.
  - Deploying changes the public app. Get the user's go-ahead if the workflow requires it, and don't deploy while a judge-facing design run is in progress.

### BE3-02 · major · Publish the prepared samples: the flagship still shows a corner-plot Concept A and stale compliance
- **Depends on:** EN3-03 (the villa painting), and BE3-03, BE3-05 and BE3-06 merged (the promotion rechecks with today's rules).
- **Problem:** the BE2-02 and BE2-03 fixes are staged but were never promoted. `/api/samples` on live and on `main` (same Firestore) still returns:
  - **Concept A `c_64fe9de92b13`** of the 10 marla (`p_c31d6707b355`) as a corner plot, by day and by night (no `-r2` file);
  - **the 10 marla** with its round 0 plan and stored compliance:
    - Bath 2 with a 0 sq ft vent shown as "to check" (`main` fails it, and also fails `plan.opening.clash:g_dirty_kitchen_w`);
    - two identical "Staircase" rows and Title Case titles in the stored report, printed on A-900;
    - a ≈2.5 ft slot between the bed and the TV console to the Parents' bath;
  - **the villa** (`p_f14122441822`):
    - the Master Dressing's only door opens onto the Upper Family Lounge;
    - joined balconies;
    - `porch_walkway` fails;
    - the Kitchen Patio sits under the Roof Terrace slab;
    - the kitchen has no daylight.
  - Absorbs: retest #2, critic M2 (Concept A), architect-e2e "Villa sample: Master Dressing", "10 marla sample: Parents' Bath slot", the persisting "TV beside the bath door", and the stale-report part of retest #10.
- **Acceptance:**
  - In the samples workspace, the 10 marla's four concepts all show neighbours against both side walls and one road frontage, by day and by night (check by eye on desktop and on a 390 px phone). Concept A keeps its id and title.
  - Both samples:
    - point at the staged versions;
    - pass `promote_round2.py verify` (stored compliance equals the recheck);
    - have no LDA or livable fail, no element id in any message, and one row per stair, named by its run;
    - carry chat messages in the current voice.
  - The engine harness (`web/dev/engine.html?src=`) on both promoted versions passes every check, including `furniture_walls`, `windows`, `paths`, `walkway`, `guards` and `headroom`, with at most 2 as-built notes.
  - In Walk on a fresh copy of the 10 marla, the route from the Parents' Bedroom door to its bath door is at least 3 ft wide. The villa's Master Dressing opens only from the master suite.
  - A guest's untouched copy picks up the new version and images. The landing counts come from `/api/samples`.
- **Hints:**
  - Run from `api/` with the production credentials. Dry-run each step first, then add `--apply`.
    - `uv run python scripts/promote_round2.py concept p_c31d6707b355 c_64fe9de92b13 <scratchpad>/be2/a/a_day_1.png <scratchpad>/be2/a/a_day_1-night.png`
    - `… version p_c31d6707b355 p_294388d1f050 v_3b1ef8f2ac97 --summary="…"` (staging AR)
    - `… version p_f14122441822 p_e8c63467e77d v_c3e8c7f4a984 --summary="…"` (staging BR)
    - `… chat p_c31d6707b355`, `… chat p_f14122441822`, then `… verify` on each.
    - `<scratchpad>` = `/private/tmp/claude-501/-Users-abdullahmoazzam-Code-hack2skill-hackathon/3f97cdb0-18fb-4a80-95cb-77e3c9cc83f6/scratchpad`. The staged JSON is in `be2/stage/AR_v_3b1ef8f2ac97.json` and `BR_v_c3e8c7f4a984.json`.
  - Neither staged sample has a powder room or common bath opening off the entry, so BE3-05's rule will not block them.
  - Furniture is placed in the browser at view time, so EN3-01, EN3-03 and EN3-04 apply to the samples once deployed. Re-run the harness on `main` after those merge.
  - This writes production sample data. Nothing is deleted; old images and versions stay for rollback.

### BE3-03 · major · The default floor program puts a Laundry on the roof, so every DHA design fails "Number of storeys"
- **Problem:**
  - `web/src/app/setup/catalogue.ts:271` sets `p.roof.laundry = 1` whenever the plot is 7 marla or more, whatever the storey limit.
  - `api/app/compliance/lda.py:217-235` counts any level with a non-open-air room as a storey.
  - So "1 kanal DHA Phase 6, 3 storeys" (clamped to 2) → "Use these floors" → "Decide everything for me" ships v1 at **41/42 LDA**, with "3 storeys above ground (max 2)".
  - The fix loop can't remove the laundry: `plan.program.floor:roof` asks for it, so the two rules fight for 3 rounds.
  - `clamp_storeys` (`agents/intake.py:514-545`) keeps the `roof` floor's rooms. Nothing tells the architect that an enclosed roof room is a storey.
  - Any 3-storey LDA brief fails the same way.
  - Absorbs retest #4.
- **Acceptance:**
  - A brief that is at its authority's storey cap never ends up with an enclosed room (laundry, store, servant, gym, kitchenette) on the roof:
    - in the default program, the laundry goes to the ground floor's service area, or is left out;
    - a roof room the family asked for is moved down. Naqsha says so in one sentence, for example "DHA counts a roof room as a storey, so I've put the laundry by the dirty kitchen."
  - The retest's DHA repro finishes with no `storeys` fail.
  - A 10 marla LDA 2-storey brief, which is under its cap, still gets its roof laundry.
  - `PLAN_SYSTEM` says that when storeys equal the cap, the roof holds only the stair tower, the tank, solar and open terraces.
  - Tests in `api/tests/test_intake.py` cover the capped and uncapped cases.
- **Hints:**
  - Normalise in `intake.py`, wherever floors are written (`merge_brief`, `_derive_from_floors`, `clamp_storeys`): `storey_cap(brief)` vs `brief.storeys`. Move enclosed roof tokens to the ground floor (laundry, store) or to the top floor (gym, kitchenette).
  - **App touch** (one line): in `catalogue.ts:271`, add the laundry to the roof only when `storeys < env.max_storeys` (the envelope is already passed to `defaultProgram`). Otherwise use `g.laundry = 1`.
  - Don't change `lda.py`'s storey count. LDA does count enclosed roof rooms; only the mumty is excluded.

### BE3-04 · major · The architect's self-review never runs on fresh designs, never sees the plot's orientation, and fix rounds start at "round 2"
- **Problem:**
  - `agents/architect.py:699` skips the review when `len(history) >= PLAN_MAX_ATTEMPTS` or after `REVIEW_SKIP_AFTER_S` (360 s).
    - Both fresh designs on `main` used all 3 attempts, so `review = {verdict: skipped, reason: time}`.
    - The "Architect's review" rows promised in the journey ("checked … with a self-review") never appear. When the review does run, `main` already lists its open issues (`with_review`, L496-503).
  - The review prompt (`REVIEW_SYSTEM`, L296-312, and `review()`, L327-343) gives no facing. Argon wrote that the mumty door "opens south" on a north-facing plot whose door is on the front.
  - L256 labels the first fix round "round 2 of 3", because the layout pass is attempt 1.
  - Absorbs: retest #11 and #12; architect-e2e #6, with the review "thrown away" (fixed on `main` whenever the review runs) and the orientation error.
- **Acceptance:**
  - Every design run stores a review with `verdict` approve or revise. When planning ran long, it is a critique without the revision: `applied: false, revision: "skipped_time"`.
  - Its open issues appear as "Architect's review" rows in the compliance sheet and the print.
  - The critique runs while the 3D build is under way and adds at most about 60 s to a run (it has its own budget; on timeout the run continues).
  - The review text names sides as front, back, left and right (the road side is the front), never as compass points. The prompt states the facing.
  - Fix rounds read "Fixing N problems (round 1 of 2)…", and so on.
  - A test covers the late path: no revision, and the issues land in the report.
- **Hints:**
  - In `design()` at L698-702: when `late`, `crit = await asyncio.wait_for(review(project, plan, report), REVIEW_CRITIQUE_S)` (new config, default 90). Then `report = with_review(report, crit["issues"], plan)` and `rev = {**crit, "applied": False, "open_issues": n, "revision": "skipped_time"}`. The `Background(write_design(...))` build has already started (L695), so this overlaps it.
  - Add to `review()`'s text: `The road (front) is at the bottom of every sheet; the plot faces {facing}. Say front/back/left/right, never north/south.`
  - L256: `round {attempt - 1} of {config.PLAN_MAX_ATTEMPTS - 1}`.

### BE3-05 · major · The main entrance looks straight into the powder room's WC
- **Problem:**
  - In `p_cc2b1126c4d1` v_57f77f161634, the main door (13, 25.75) and the Powder Room door (24, 25.75) sit on one axis, 11 ft apart, across a 4′6″ Entrance Lobby. From the porch, the open main door frames the WC dead centre.
  - No rule covers this. `_baths` (`compliance/planning.py:832-860`) checks only bath doors and WC-into-dining.
  - The same 4′6″ lobby serves four doors, plus a console table.
  - New finding (architect-e2e #5). It is a privacy (purdah) defect a Lahore family notices at once.
- **Acceptance:**
  - A new fail, `plan.privacy.wc_on_entry:<room>`. It fires when a powder room's or common bath's door opens into the room the main door opens into (lobby, lounge or drawing) and either:
    - it faces the main door from the opposite wall, with their spans overlapping when projected across the room; or
    - it lies within about 30° of the main door's axis and 15 ft of it.
  - The message is plain words: "From the main door you look straight into the Powder Room." Fix: move the powder room door to a side wall of the lobby, or turn the lobby so the WC door is out of the line of sight.
  - `PLAN_SYSTEM` states the rule, so the first draft avoids it.
  - The rule fails on v_57f77f161634's plan. It passes:
    - the staged 10 marla and villa (`be2/stage/AR_v_3b1ef8f2ac97.json`, `BR_v_c3e8c7f4a984.json`);
    - the 4-bed fixture.
  - A test is added in `api/tests/test_planning.py`. The rule is listed in `docs/review/architecture-rules.md`.
- **Hints:**
  - Use `ix.info[door_id]` for each door's side and wall line, as `_door_reachable` does at L1036-1060.
  - Optional warn, if cheap: a lobby less than 5 ft deep that serves 3 or more doors.

### BE3-06 · minor · Porch: the plan check and the 3D count cars differently, and a briefed motorbike is dropped silently
- **Problem:**
  - **Car count.**
    - `planning.py:1010-1016` `bays()` counts only full 9 × 18 ft bays inside the porch.
    - The engine (`web/src/engine/furniture/parking.ts:235-237`) lets a car's tail stand up to 4 ft past an open front edge into the driveway.
    - On p_13230dfcc54c v1 (a 17′ × 16′ porch, 2 cars asked), compliance says "parks **0** of the 2 cars", while the 3D parks 1 and its note says "Only **1** of 2 cars fits".
  - **Motorbike.**
    - "Porch for 1 car plus a motorbike" is never sized. No rule or prompt mentions a bike.
    - The engine places one only on a porch at least 13.5 ft deep (`furniture/auto.ts:592`), and otherwise leaves it out.
  - Absorbs retest #9 and architect-e2e #8.
- **Acceptance:**
  - The plan rule counts a bay the way the engine does: 9 ft wide, and 18 ft deep, or at least 14 ft when the porch's car edge opens onto the front open space or the driveway. On p_13230dfcc54c v1, the compliance row and the as-built note both say 1 of 2.
  - When the brief mentions a motorbike, the porch rule needs a 3 × 7 ft bike bay clear of the cars and the walkway. A shortfall is a warn with plain words. `PLAN_SYSTEM` asks for that bay.
  - Tests cover both cases.
- **Hints:**
  - `bays()` and `_door_reachable` need to know the porch's open edge. Reuse the setback test from `_porch` (L1062+).
  - Detect the bike with `brief.spaces` (add `motorbike` to `intake.py` SPACES and the setup agent's `spaces` docstring), or `/motor ?bike|bike/` in preferences and notes.
  - Keep the engine unchanged. Its 4 ft overhang is documented in `engine-notes.md`; cite it in the rule's docstring.

### BE3-07 · minor · The setup agent adds a "roof terrace" the user never asked for
- **Problem:**
  - "A stair going all the way up to the roof" produced `roof_terrace` in `brief.spaces`.
  - The plan is then graded "The brief asks for a roof terrace; the plan has none" (a warn, also printed). A fix round added a Rear Terrace, and the review asked for a tiled roof terrace.
  - **Cause:** `FLOOR_SPACE` (`agents/intake.py:283-287`) maps any `terrace` floor token, on any floor, to `roof_terrace`, and `_derive_from_floors` (L290+) adds it to `spaces`. The agent's docstring (`setup_agent.py:105`) doesn't say that roof access is standard and is not a terrace.
  - The other half of the raw issue, the powder room missing from the Brief's floor line, is fixed on `main` (dropped).
  - Absorbs architect-e2e #7.
- **Acceptance:**
  - A message that only asks for roof access, or a stair to the roof, records no `roof_terrace`.
  - A `terrace` token on the first or second floor maps to a terrace on that floor, not to `roof_terrace`.
  - `roof_terrace` appears only when the family asks for a terrace or sitting area on the roof.
  - A test is added in `api/tests/test_intake.py`.
- **Hints:**
  - In `_derive_from_floors`, map `terrace` → `roof_terrace` only when `f["level"] == "roof"`.
  - Add one line to the `spaces` docstring: "Reaching the roof by stair is standard (never a terrace)."

---

## ENGINE

### EN3-01 · blocker · A small bedroom is walled off by its own bed and wardrobe: the attached bath and the window can't be reached
- **Problem:**
  - In `p_cc2b1126c4d1` v_57f77f161634, the Father's Bedroom (`g_bed1`, 10 × 10 ft at x 20-30, y 42.5-52.5) and Bedroom 2 (`f_bed2`, the same on the first floor) each got a queen bed with its headboard on the west wall, plus a wardrobe on the front wall.
  - The walker is stuck in a ≈2.8 × 1.8 ft pocket behind the room door (22, 42.5). The attached bath door (22, 52.5) stands behind the bed, and the window is unreachable.
  - The brief says the father uses a walking stick.
  - **Why `main` still allows it:**
    - `furniture/paths.ts` L18 `KEEP` (beds, wardrobe, sofas, dining) are never left out.
    - When a KEEP piece can't be relocated, it is only marked `stuck` (L253-257). The repair then ends with a "Tight walking path" **warn** note (L262-269), and the doors stay cut off.
    - Path repair never tries the smaller variant that `place.ts` L73 `SMALLER` offers (queen → single, the shallow wardrobe).
    - The bed placer (`furniture/auto.ts` L199-230) picks the headboard wall without checking that a 3 ft route remains between the room's doors. Headboard on the east wall leaves a 3.3 ft strip at x 20-23.3, joining both doors.
  - Absorbs architect-e2e #1, and the engine side of the 10 marla Parents' Bath slot.
- **Acceptance:**
  - In every room, every door (entry, attached bath, dressing, balcony) is joined to every other door by a path at least 3 ft wide. At least one side of each bed, and the approach to each window, is reachable.
  - When that can't be done with the pieces as asked, the engine works through these in order:
    1. moves them;
    2. swaps in the smaller variant (queen → single; wardrobe → narrower → shallow);
    3. leaves out the least-needed piece. A wardrobe that is left out gets a plain note: "The wardrobe was left out to keep the way to the bath clear."
  - An entry that still can't be reached is a **fail** note (`asbuilt.door_unreachable`) naming the room and the door ("You can't reach the Attached Bath from the Father's Bedroom door"). It never only says "tight".
  - The harness on v_57f77f161634 shows both rooms walkable from the room door to the bath door and the window.
  - The 10 marla, the villa and the staged samples gain no new notes.
  - A `doorReach` probe is added to `dev/checks.ts`: for each room, BFS between its door cells on the furnished grid, using `pathMask` (`paths.ts` L506).
- **Hints:**
  - **Export the design:** with production credentials, read `p_cc2b1126c4d1` (owned by a tester guest) through `app.store.db.get_project` / `get_version`. Read it only.
  - **Or build a fixture:** a 10 × 10 bedroom with the room door at (22, 42.5) on its front wall, a bath door at (22, 52.5) on its back wall, a window on the east wall, and `furnish('bed')` + `furnish('wardrobe')`.
  - In `repairCluster`, before `stuck.add`, try `SMALLER[it.type]` through a small helper exported from `place.ts`. It should place the replacement at the old anchor or along the same wall, then re-score.
  - In `auto.ts` `bed()`, score candidate walls by `joined(...)` on the room's entries.

### EN3-02 · major · A facade frame's bottom beam closes the car porch: no car can enter, and there is no way from the gate to the main door
- **Problem:**
  - Concept B's dark portal frame in `p_cc2b1126c4d1` was built as a closed rectangle. Its bottom member lies on the ground across the full 13 ft porch mouth at y ≈ 9.3.
  - Walking out of the porch stops at y ≈ 10.2 for every x, with cars on or off. The only house door opens off this porch.
  - **Cause:** `facade.ts` L160-175 `frame()` always builds the bottom member (`fbox(... r.h0, r.h0 + t)`), and `finish()` (L74-80) makes every member a walk collider. No check looks at facade elements across a porch's car edge or the gate → main door route. The parking and walkway checks see only the plan and the furniture.
  - New (architect-e2e #3).
- **Acceptance:**
  - A frame, fin rail or louvre post is never built below 7 ft across:
    - a porch's open car edge;
    - a door or gate opening;
    - the walkway from the pedestrian or car gate to the main door.
  - A frame whose bottom sits within 1 ft of grade is built as a U (no bottom member).
  - On v_57f77f161634, the walker goes from the porch spawn (6.5, 25.75) to the gate (y < 2), and the car's bay is clear.
  - The `walkway` and `parking` checks in `dev/checks.ts` count `facade:*` colliders as obstacles.
  - The 10 marla and the villa are unchanged.
- **Hints:**
  - In `frame()`: skip the bottom box when `r.h0 <= groundTop + 1` (the ground floor's plinth top, from `ctx.model`) and the region spans a porch or garage edge, or any door on that side (`openingsOn`, L82-89). Apply the same test to the bottom rail in `fins()` (L131) and the posts in `louvers()`.
  - Note it with `warn()` only. It is a quiet repair.

### EN3-03 · major · A painting is hung over the villa's lounge window (regression from EN2-02's path repair)
- **Problem:**
  - The harness's `furniture_walls` check fails on the villa v2 and on the staged BE2-03 villa (`BR_v_c3e8c7f4a984`): `g_lounge_painting` spans x 8.7-11.9, at 3.6-6.0 ft, over `g_lounge_porch_w` (x 10-16, sill 2.5, head 7.5).
  - **Cause:** `paths.ts` L417-440 `rehang()` slides a painting or mirror along with the piece it hangs over (the console table, moved off the walkway), without testing the openings on that wall.
  - It blocks BE3-02's verification. Absorbs retest #5.
- **Acceptance:**
  - After every repair, no wall decor (painting, mirror, wall TV) overlaps any opening's zone (its span ± 0.3 ft, from its sill to its head).
  - A moved picture that would overlap one is re-centred on solid wall over its piece, or taken down quietly.
  - `furniture_walls` passes on the villa v2, the staged villa, the 10 marla and the staged 10 marla.
- **Hints:**
  - In `rehang()`, after moving `q`, test it against `ctx.model.roomWalls(room, side)` openings, or reuse `zones.ts` `blocksWindow` / `keepOut`, and `take(q)` on overlap.
  - Add the same final sweep at the end of `ensurePaths`.

### EN3-04 · polish · A lounge TV sits on the wall the room is entered through
- **Problem:** `place.ts` L205-213 `entranceWall()` only treats the wall holding the house's `main_door` as the entrance wall. In `p_cc2b1126c4d1`, the TV Lounge is entered from the Entrance Lobby (door at (15, 28)). The TV hangs on that wall, 2 ft from the door, and the L-sofa faces the door with its back to the dining room. Absorbs architect-e2e #10, the follow-up to round 1's "TV and nightstand placement".
- **Acceptance:**
  - In a lounge, drawing or dining room, the TV wall is never the wall holding the door from the entrance side: the main door, or the door from the lobby, porch or entrance passage on the route from the main door.
  - The existing `mirrorMedia` moves the group. If it can't, the TV stays, and nothing else changes.
  - The samples gain no new notes.
- **Hints:** in `entranceWall()`, fall back to the room's door whose other side is a lobby, porch or corridor (the first room on the route from the main door).

---

## VIEWER

### VW3-01 · major · 3D comment pins leak over Plan, Concepts and Revisions and block clicks (regression on `main`)
- **Problem:**
  - `app/shell/ProjectShell.tsx:310` keeps House mounted, but hidden (`invisible`), once it has been opened.
  - `viewer/comments/PinsLayer.tsx:111` sets `el.style.visibility = "visible"` on each `.nq-pin-wrap`. The inline value overrides the inherited `hidden`.
  - So the House pins float over the plan, the concept images and the Revisions H1, at the same screen positions. `elementFromPoint` returns the pin, so clicks never reach the drawing (1280 and 390).
  - Live doesn't keep House mounted. Absorbs retest #3.
- **Acceptance:**
  - Open a home with 2 or more comments in House, then switch to Plan, Concepts and Revisions. No `.nq-pin-wrap` is visible (computed `visibility: hidden`), and `elementFromPoint` at the old pin positions returns the view's own content.
  - Back in House, the pins show at once in the right places, with no rebuild. Hover tips and selection still work.
- **Hints:**
  - At L111, set `el.style.visibility = ""` (inherit), so the hidden parent wins. Keep `"hidden"` at L103 and L176.
  - Optional: give `HouseViewer` an `active` prop and use `frameloop="never"` while hidden. In Walk it is otherwise `"always"` (L178), which keeps rendering the hidden House on Plan.

### VW3-02 · major · "Render this view" turns the ghosted neighbour into a see-through glass building
- **Problem:**
  - `core/controller.ts:2357` `capture()` calls `snapshot()` (L2337), which hides pins and outlines but leaves the neighbour ghosting (`GHOST.nqGhost`) on.
  - The AI render is told to keep neighbours "exactly as massed in the viewport" (`api/app/agents/concepts.py:276`), so it reproduces the 15% clay ghost as a translucent glass volume, with a tree and a floating tank visible through it.
  - Critic M7.
- **Acceptance:**
  - The image sent by "Render this view" shows the neighbours solid, with no ghosting, pins or outline.
  - The returned render has no glass building.
  - Orbit ghosting is back on the next frame.
- **Hints:** in `capture()`, save `GHOST.nqGhost.value` and set it to 0 (and switch off the near-ghost in `ctxfx.updateNear`). Then `renderNow()` / `snapshot()`, restore it, and `invalidate()`.

### VW3-03 · minor · Walk number keys don't match the floor stack's labels
- **Problem:**
  - The floor stack reads G, 1, R (`viewer/hud/MiniMap.tsx:21` `levelShort`), and the help says "Floors 1–3 or [ ]" (`hud/Hud.tsx:189-195`).
  - But `controller.ts:1649` maps `Digit N` to `levelsSorted[N-1]`. Key 1 goes to Ground, key 2 to the floor labelled "1", key 3 to the roof.
  - Retest #8.
- **Acceptance:**
  - In Walk:
    - G (or 0) goes to the ground floor;
    - 1 and 2 go to the floors labelled 1 and 2;
    - R goes to the roof;
    - B goes to the basement;
    - a key with no matching floor does nothing.
  - The help card lists the keys from the same labels, for example "G, 1, R or [ ]".
  - `[` and `]` are unchanged.
- **Hints:** move `levelShort` into `core/floors.ts` and match the key against it. KeyG and KeyR aren't bound elsewhere.

### VW3-04 · minor · The room pill flickers through every room passed during a glide
- **Problem:**
  - `controller.ts:479-482` calls `updateRoomLabel()` every 160 ms, gliding included, and it fires `onRoomChange` (L1966-1967).
  - So the app's room pill reads target → each room passed → target ("Drawing room → Upper family lounge → Stair hall · First → Stair hall · Ground → TV lounge → Drawing room").
  - Critic M12, the part not fixed on `main`.
- **Acceptance:**
  - From the start of a navigator or minimap glide until arrival, the pill shows the destination. On arrival it shows the room the walker is actually in.
  - Free walking still updates the pill live.
- **Hints:**
  - Skip `fireRoomChange` and the store's `room` update while `this.walk.glide` is set.
  - At glide start (L1430), set the store's room to the route's target. L1446 already calls `updateRoomLabel()` at the end.

---

## APP

### AP3-01 · minor · The setup card shows "Mid-row" under both "You said" and "I assumed"
- **Problem:**
  - `setup/Understood.tsx` L79 builds "You said" live (`saidFacts(brief)`), but "I assumed" (L114-123) from `m.understood.assumptions`, a snapshot taken when the message was sent.
  - After the family answers "Mid-row", the server is right (`corner_stated: true`, and `corner` is no longer in `auto_filled`), yet the latest card lists "Mid-row plot, neighbours on both sides" under both headings until the completion card replaces it.
  - Retest #6.
- **Acceptance:** on the interactive (latest) card, a fact appears under "I assumed" only while its field is still in `brief.auto_filled`. Once the family states it, it shows only under "You said". Earlier, folded cards keep their snapshot.
- **Hints:**
  - Map each snapshot assumption to its field with the same lines the server uses (`intake.py:676-700` `_fact_items`: "Corner plot" / "Mid-row plot…" → `corner`, and so on).
  - In interactive mode, drop the ones whose field is in `saidFacts(brief)`, or no longer in `auto_filled`.
  - Agent-added free-text assumptions that match no field stay.

### AP3-02 · minor · Phone House HUD: the Comment button is clipped at 360 px, and HUD rows overlap at mid widths
- **Problem:**
  - At 360 × 740 in Walk with open comments, the one-row HUD (`explore/HouseView.tsx` L458+, `phone` = max-width 767) puts Comment and its count badge at x 300-378. 18 px are clipped; at 320 it is mostly off screen.
  - On live at 560 px, the viewer's room chip (`.nq-room`, top `var(--chrome-top)`) sat over the Orbit/Walk and View row. Re-check on `main` across the whole phone range.
  - Absorbs retest #7, and the 560 px half of the architect-e2e "View › Cars / 560 px" issue. The Cars half is fixed on `main`.
- **Acceptance:**
  - At 320, 360, 390, 560 and 767 px wide, in Orbit and in Walk:
    - every HUD control sits inside a 12-16 px gutter;
    - no two controls overlap (hit-test each);
    - nothing scrolls sideways;
    - targets stay at least 44 px.
- **Hints:**
  - Below 380 px: show the comment count as a dot, use `gap-1.5`, and let the row `min-w-0` with the version chip shrinking first.
  - Keep `.nq-room` clear of the floor stack and the top capsules (HouseView.tsx L656 sets its top).

### AP3-03 · minor · Room navigator: the input jumps while filtering, and a phone shows the "M" key hint
- **Problem:**
  - The navigator popover is anchored to the top of the room pill (`explore/HouseView.tsx:584-596`, `side="top"`) and its list is `max-h-[50vh]` (`RoomNavigator.tsx:98`). As the list shrinks while filtering, the panel shrinks downward and the input jumps (y 138 → 312).
  - `RoomNavigator.tsx:96` always shows `<Kbd>M</Kbd>`, also on touch phones.
  - The focus half of critic M12 is fixed on `main`.
- **Acceptance:**
  - Typing into the filter never moves the input. The panel keeps its height while open, or is anchored by its top edge.
  - No key hint is shown when `(pointer: coarse)`.
- **Hints:** give the list a fixed `h-[min(50vh,420px)]` (keep `max-md:max-h-none` for the full sheet). Use `[@media(pointer:coarse)]:hidden` on the Kbd.

### AP3-04 · polish · Copy and labels: the client note box, Title Case check titles, a House empty state and the Brief's LDA notes
- **Problem** (each confirmed on `main`):
  - **Client composer.** `shell/Dock.tsx:322` passes `label="Ask Naqsha"` whatever the `askLabel`, so on `/s/<token>` the box placeholdered "Leave a note for the owner" is announced as "Ask Naqsha" (retest #13).
  - **Check titles.** Compliance titles print room names in Title Case ("Upper Family Lounge daylight", "Parents' Bath ventilation"), in the sheet (`plan/CompliancePanel.tsx:266`) and in print (`plan/PrintDocument.tsx:505`). Part of retest #10.
  - **House empty state.** The owner's Comments sheet says "Press C in the House view…" while you are in the House view (`comments/CommentsSheet.tsx:166`, no `emptyHint` from House).
  - **Brief LDA notes.** The Brief lists the envelope's generic notes ("FAR 1:2.8 (basement counts)", "mumty ≤ 9′6″ excluded", "Ground coverage up to 70% (1,592 sq ft)") under a header that already says "Up to 1,440 sq ft a floor" (`setup/BriefSheet.tsx:227-249`). That gives two per-floor maxima, plus jargon.
- **Acceptance:**
  - The client's composer is named "Note for the owner".
  - Check titles are sentence case in the sheet and in print ("Upper family lounge daylight"; "LDA" and "TV" kept).
  - In House, the empty sheet says "Click Comment (or press C), then click the house to pin a note."
  - The Brief shows one per-floor figure, plus only the notes the facts grid doesn't already cover (the corner splay, authority overrides).
- **Hints:**
  - `label={askLabel === "Ask Naqsha" ? "Ask Naqsha" : "Note for the owner"}`.
  - `sentenceCase(c.title)` (`plan/model.ts:102`).
  - Filter the notes that start with `Plot `, `Setbacks:`, `Ground coverage` and `Height up to`, which come from `api/app/compliance/lda.py:91-95`.

### AP3-05 · polish · Run narration: a five-value history for four rounds, and the project chip says "Concepts" while the plan is drawing
- **Problem:**
  - `design/flow.ts` appends one failure count per `compliance` event. `architect.py` (L289-291) re-emits the best attempt's compliance at the end, so four rounds show "3 → 2 → 1 → 2 → 1".
  - During the run, the title capsule's stage chip (`lib/views.ts` `stageLabel`) reads the project's stored stage, which isn't refreshed, so it says "Concepts".
  - Absorbs the history and chip parts of architect-e2e's narration findings. The rest is fixed on `main` (AP2-14) or is inherent (dropped).
- **Acceptance:**
  - The history has one value per attempt; the re-emitted best attempt replaces its own entry.
  - While a design run is running, the chip reads "Planning", then "Building in 3D", from the run's stage.
- **Hints:**
  - Compliance events carry `attempt`, so key `failures` by attempt.
  - In `TitleCapsule`, prefer `useFlow(s => s.design)?.stage` while `status === "running"`.

### AP3-06 · polish · Segmented thumbs paint over the outgoing label and fly between controls
- **Problem:**
  - `ui/Segmented.tsx` L99-104 renders the moving thumb inside the active button (`-z-10` in a `z-0` button). Mid-spring it paints over the neighbouring label (a blank "Brief" in the view switch, "Your hon…" in the workspace).
  - Controls that remount, such as Walk → Orbit, animate their thumb in from another control.
  - Critic minor (motion jank). The View popover and rooms dialog jumps are fixed on `main`.
- **Acceptance:**
  - Labels stay readable during every thumb animation.
  - A thumb only ever moves within its own control.
- **Hints:** wrap each control in `<LayoutGroup id={auto}>`. Render labels in a `relative z-10` span and the thumb at `z-0`.

---

## Won't fix (dropped, with reason)

**Fixed on `main` but not live** (folded into BE3-01; re-check after the deploy):
- **Per-floor rule counts the master as an ordinary bedroom** (architect-e2e #2): `planning.py` L1745-1751 sums `BED_KEYS` per floor. The re-test's `/api/lda/check` on `main` passes "Rooms per floor".
- **Head-strike zone under the upper flight** (architect-e2e #4, both houses): EN2-01's under-stair storage is on `main`. The harness `headroom` check passes on 6 houses, including the villa; the lowest standable point is 7.23 ft.
- **Architect review thrown away** (architect-e2e #6): on `main`, a rejected or partial review's open issues become "Architect's review" rows (`architect.py` L496-503). The remaining gap, a review that is skipped, is BE3-04.
- **Landing "10 marla" card opens the villa; "Corner home" card** (critic M1): AP-02 maps the cards to `/api/samples`. The re-test opened a 10 marla copy.
- **Loading card ghost, raw ids, blank sky** (critic M3): VW2-01 and VW-07. The re-test saw opacity 1 in 22 of 22 samples, with plain step copy. `viewer/core/build.ts` swaps sections in as they build, so the sky isn't empty after the card.
- **HUD contrast and focus ring** (critic M4): AP-15. Tab order was deferred in round 2.
- **Compliance id leak, "Approval-ready", missing livable rows** (critic M5): `planning.py:990` names openings in words (`oname`), the summary is honest, and the railings, doors and paths rows are on `main`. The sample's stale stored report is BE3-02.
- **"8 notes on the 3D model"** (critic M6): EN2-05. The re-test saw at most 2 notes per house.
- **A4 print clipping; every livable message printed twice; roof "0 sq ft covered"; roof labels** (critic M8; architect-e2e print findings): the re-test found 0 elements outside any sheet on A3 and A4.
  - `PrintDocument.tsx` L497-510 prints each message once.
  - The roof sheet uses the mumty area (L218).
  - The roof labels were fixed in 1b6ebb0.
  - The duplicate "Staircase" rows come from the sample's stale report (`main` names stairs "Ground → first stair", `planning.py:209`), so they belong to BE3-02.
- **Phone Revisions 848 px** (critic M9): AP2-01, confirmed by the re-test.
- **Plan dock over the zoom controls and scale bar** (critic M10): AP-11 (`PlanView.tsx:324, 414`).
- **Client view: missing navigation, dock over Comment, "Owner · Owner"** (critic M11): AP-13 and the author fixes are on `main`. "Walk through it" in Plan and "Approve" in House is the intended client journey (`ClientView.tsx:323-328`).
- **Walk "?" help, idle fade, "Drag to look around" twice**: VW-05 and VW-06 are on `main`; the re-test confirmed them.
- **Auth errors under the wrong field**: AP-27 and AP2-11, confirmed.
- **Brief: dock over the LDA facts, duplicate primaries**: AP-31 and AP2-13. The jargon is AP3-04.
- **Concepts lightbox**: AP-23. The title alignment was deferred in round 2.
- **Compliance sheet Esc and the Next pill**: AP2-03, confirmed.
- **View popover jump on Night; rooms dialog re-centring**: AP-14 and AP2-04, confirmed. The segmented thumbs are AP3-06.
- **One author, two hues**: pins, plan and avatars share one hash on `main`.
- **Phone House chrome 44%, small targets**: AP2-07 (one row at 390, confirmed). 360 px is AP3-02.
- **View › Cars ON in Walk**: AP2-12, confirmed. The 560 px overlap is AP3-02.
- **Copy, numbers, Title Case in the command bar, "Section cut", two names for one action**: AP2-08 and AP-32, confirmed. The client label and check titles are AP3-04.
- **Plan room hover; phone landing labels; roof dialog radiogroup; heavy concept tiles; duplicate accent primaries; header sizing; phone Sign in**: round 1's app fixes, AP2-06, AP2-09, AP2-05 and AP2-13 are on `main`, and the re-test confirmed them.
- **Brief floor line omits the powder room** (architect-e2e #7, second half): the round 1 catalogue added `powder` (`catalogue.ts:44`), and `roomsLine` lists it.
- **Pipeline narration: "1 parts", stepper falling back to Plan**: AP2-14 is on `main`; "Re-checking the improved plan" emits `stage: review`.

**Not doing:**
- **Stair mid-landing 3.4 ft vs a 3.5 ft flight** (architect-e2e #9): `main` names the stair in words (`stairs-plan.ts:344` `stairLabel`). The 0.1 ft (1.2 in) shortfall comes from wall thickness. The engine reports it as a "Stair landing tight" warn, counted with the 3D notes (AP2-10). Tightening the plan's stair-hall rule a day before the deadline would add fix-loop churn for an inch.
- **Livable denominators changing between fix rounds**: inherent; the rule set grows as the plan gains rooms (as in round 2).
- **Pin mode staying on after a pin; one filter row for author and status; the avatar initial for "You"**: design choices; DESIGN.md has no rule. The House empty state is AP3-04.
- **The Samples tab reopens your own renamed copy**: by design (one copy per owner keeps your edits).
- **"Pass." and "Dress 3" on the plan**: these are the plan's short forms for rooms too small for the full name (`plan/model.ts` SHORT). Print uses full names.
- **White comment surfaces over 3D, the black vs white selected-floor thumb, the empty half of the builder band, the phone workspace indent, the 32 px sign-in gutter, "Recommended" in pass-green, "1 storey | 2 | 3"**: visual polish that isn't cheap enough, or not worth the risk now (deferred in rounds 1 and 2).

**Merged into other tasks:**
- The 3 deploy raw issues → BE3-01.
- "Concept A of the 10 marla is still a corner plot" (critic) and the villa dressing, the 10 marla Parents' bath slot and the stale-report rows → BE3-02.
- "Architect progress 'round 2 of 3'" and "self-review never runs" → BE3-04.
- "Motorbike dropped" and "car count disagrees" → BE3-06.
- "Compliance report repeats 'Staircase', Title Case" → BE3-02 (stale rows) and AP3-04 (titles).
- "Pipeline narration" → BE3-04 (round numbers) and AP3-05 (history, chip).
- "Room navigator" (critic M12) → VW3-04 (pill flicker) and AP3-03 (input jump, key hint).
- "Motion jank" → AP3-06.
- "Client note box named 'Ask Naqsha'" and the copy leftovers → AP3-04.
