# Final triage (live revision 8)

- **Date:** 17 Oct 2026, about 12:30 PKT. The prototype is due 18 Oct.
- **Build triaged:** Cloud Run `naqsha-00008-6qt` (bundle `index-BaiWuXqd.js` / `index-DL4JPf2l.css`). The critic confirmed the live files equal the local `web/dist`. The code read is the repo HEAD, `963a461`.
- **Inputs:**
  - `final-must-fix-3d.md` [3D], `final-must-fix-journey.md` [J], `final-must-fix-collab.md` [C] and `final-final-critic.md` [K];
  - 41 "not fixed / partly" verdicts and 69 raw issues: 110 items in all.
- **Method:**
  - Every item was checked against the code at HEAD. The file and line are under **Hints**.
  - The data items were checked against the live API. I read the two sample versions (`v_f881a067c573`, `v_7379f7e1ceb0`) through the journey tester's copies (`p_d7a9f16c8cca`, `p_9885dc8a6cc3`) and downloaded the 10 marla's concept images A and B. Nothing was written.
  - Duplicates are merged, and each task lists what it **absorbs**.
  - Each task has **one owner**:
    - **backend:** `api/**` (and `contracts/api*.{md,ts}`);
    - **engine:** `web/src/engine/**`, `contracts/house-sdk.d.ts`, `contracts/engine-notes.md`;
    - **viewer:** `web/src/viewer/**`;
    - **app:** `web/src/app/**`, `web/src/api/**`, `web/src/index.css`, `web/index.html`, `web/public/**`.
- **Result:** 110 items became **35 tasks**:
  - 5 blockers: EN-F4, BE-F4, BE-F5, AP-F1, and the deploy BE-F10;
  - 14 majors, 6 of them on the user's own must-fix list: EN-F1, EN-F2, EN-F3, VW-F1, BE-F1, BE-F2;
  - 13 minors;
  - 3 polish.

  Five items are not scheduled; the reasons are at the end.

## Read this first: what the code says

1. **Trees close the side passages** (must-fix 5 and 8).
   - Argon's landscape code plants ashoka trees down the 5 ft side passage:
     - 10 marla: `s.landscape.tree([33.2, y], {kind: "ashoka", height_ft: 15})`;
     - villa: `s.landscape.tree([48.2, y], {kind: "ashoka", height_ft: 14})`.
   - `landscape.ts:114` `tree()` plants wherever it is told. Room furniture has keep-outs (`furniture/zones.ts:42`); landscape has none.
   - The walker treats a tree's whole bounding box, canopy included, as solid from the ground up (`viewer/core/controller.ts:2091`, the `tree` kind in `EQUIPMENT`). A 4.6 ft canopy therefore shuts the passage.
2. **The villa's Rear Sun Terrace door isn't built.**
   - `structure/model.ts:176-178` keys an exterior wall run only by `ext|<enclosed room>|<side>`. So the Upper Passage's west wall at x 15 (y 42.5–65) is one run, and its `neg` is the room at the run's first cell, the **West Terrace**.
   - `placeOpenings` (`model.ts:321-322`) needs both named rooms in `[run.neg, run.pos]`. `f_corr_rear_terrace` (15, 59) therefore never matches and is skipped as "not on a wall between…".
   - The swing side (`model.ts:441-449`) and `openingsOf` (`model.ts:753`) read the same wrong `neg`/`pos`.
3. **The villa's "Light Court Void" is a floored deck.**
   - `plan/model.ts:226` turns every upper-floor `open_space` into a deck, with a floor and privacy screens.
   - `planning.py:967` skips open spaces only on the ground floor, so the void also gets a "No way in" warning.
4. **Three tallies for one version.**
   - **Backend** `_status` (`architect.py:258`, `lda.py:386`): a warn counts as a pass, and "· N review notes" is appended. Result: "36/36 LDA · 12/12 livable · 3 review notes". This summary feeds the version rail and the landing's "12 livable".
   - **App** `summarize` (`plan/compliance.ts:108`):
     - counts the `review.*` rows as livable warns;
     - adds three derived livable rows (`compliance.ts:148-160`);
     - puts as-built notes in the capsule (`shell/narration.ts:120-130`) and the dock (`ProjectShell.tsx:392`).

     Result: "10/15 livable · 5 to check · N notes from the 3D model".
   - **Run log** (`design/flow.ts:171`): "All 45 checks pass" whenever nothing fails.
5. **Why the samples aren't clean.**
   - **10 marla, 5 warns:**
     - `door_width:g_dirty_kitchen_door` (2′6″);
     - `wet_over_dry:f_bath2` (Bath 2 over the Drawing Room);
     - `review.1` (kitchens are 6 ft tunnels);
     - `review.3`, which repeats `wet_over_dry`;
     - `review.4` (no powder room).
   - **Villa, 8 warns:**
     - `unreachable:f_patio_void`, a false positive (see 3);
     - `bath_shape:f_bath3` (6′ × 18′);
     - `review.1`–`review.3`, marked "needs a change": the dirty kitchen is reached only through the prayer room, the lobby has no outside door, and the central rooms are landlocked;
     - `review.4`–`review.6`.
   - **"N notes from the 3D model":** the engine reports things it *added on purpose* as warnings: "Privacy screen added" (`structure/extras-geo.ts:135`) and "Guard rail added" (`structure/guards.ts:108`).
6. **A typed change sweeps in every open comment.**
   - `main.py:783-787` reads a missing `comment_ids` as "every open comment".
   - Every instruction-only caller omits it:
     - House Ask (`HouseView.tsx:311` → `:265`);
     - Plan Ask (`PlanView.tsx:232`);
     - the compliance sheet's Fix (`PlanView.tsx:534`);
     - Revisions Ask and "Use the alternative" (`RevisionsView.tsx:61`, `:429`).
   - So it isn't only House: every Ask and Fix applies held comments.
7. **The reviser forgets.**
   - It is given only the chosen comments and the request (`reviser_adk.py:220-258`, `reviser.py:187`). Nothing about earlier "Done" answers reaches it.
   - The request's answer is streamed as a stage line (`reviser.py:166-168`) and never stored.
   - The `version` event adds a project entry with no `summary` (`store/project.ts:318-323`), so the rail reads "A revision" (`design/words.ts:135`) until a reload.
   - "What changed" lists only each change's declared `targets` (`RevisionsView.tsx:362-372`), so a door that shrank as a side effect is invisible.

## Decisions taken in this triage

- **Architect's review notes are advice, not checks.**
  - They leave every tally and "to check" count.
  - They are listed in their own "Architect's notes" group in the compliance sheet, one sentence each (AP-F1, BE-F4).
  - The samples must still not carry "needs a change" notes (BE-F5).
- **As-built notes never appear in the status line or the dock.** They live in the compliance sheet's "As built" group and in Details. The engine stops reporting its own additions as notes (EN-F4).
- **Server and app count the same livable rows.** The server adds the three engine-guaranteed rows (railings, doors, paths) to every report, so the landing, the version rail and the capsule quote one number (BE-F4, AP-F1).
- **A typed instruction applies no comments unless the caller names them** (BE-F2).
- **Fix the samples' plans rather than hide their warnings** (BE-F5), with the fallback stated there.
- **Cars stay hidden in Walk.** The user's complaint was cars blocking the view, and hiding them passes. DESIGN's "fade within 2 m" should be amended rather than built.

## Order of work

1. **Start now, in parallel.** Every task below may start at once, in priority order within each owner. The user's must-fix tasks come first: EN-F1, EN-F2, EN-F3, VW-F1, BE-F1, BE-F2, then BE-F3 and the blockers EN-F4, BE-F4 and AP-F1.
2. **Then BE-F5 (re-stage the samples).** Start it once EN-F1–F4 and BE-F4 are merged on `main`. Furniture and landscape are built in the browser at view time, so the engine fixes apply to the stored samples. Check the staged versions in the engine harness, and in Walk on a local build, before promoting. AP-F1 is needed to read the final capsule.
3. **Finally, BE-F10 (deploy).** Deploy after everything is merged, with the user's go-ahead. Then re-run the four final reports' must-fix tables on live.

## The user's must-fix items: where they stand

| Must-fix | 10 marla | Villa | Open task(s) |
|---|---|---|---|
| No falls from stairs; railings at every drop | Fixed | Fixed | – |
| Stair reaches the roof; roof door on the landing | Fixed | Fixed | – |
| Bedrooms and baths independent | Fixed | Fixed | – |
| No TV or furniture blocking a door | Fixed | Fixed (trees: next row) | EN-F1 |
| Walking space; porch cars don't block | Cars fixed. **Trees shut the side passage and half the lounge slider; the Rear Space can't be reached** | Cars fixed. **Trees shut the passage and the Dirty Kitchen's outside door; the Servant Quarter can't be reached; the Rear Sun Terrace door isn't built** | EN-F1, EN-F2, EN-F3, VW-F1 |
| Neighbours never block the orbit view | Fixed | Fixed | – |
| Walk floor toggles move you | Fixed (keys 2–9 do nothing: polish) | Fixed | VW-F3 |
| Room navigator glides | Fixed (`goToRoom('g_rear')` lands in the wrong room) | **Servant quarter and Rear sun terrace crossfade; you are then trapped** | EN-F1, EN-F2, VW-F1 |
| Mouse look | Fixed (fallback) | Fixed (fallback) | – |
| Concepts not all corner plots | **Flagship A and B (Chosen) are corner plots**; new briefs 7 of 8 | Fixed | BE-F1, BE-F6 |
| Landing, no stage bar, auth, setup, day/night, print, autosave | Fixed | Fixed | – |
| A typed change in Ask runs a revise | Partly: it also applies held comments | | BE-F2 |
| The Revisions page is clear | Partly: counts contradict; the typed request vanishes | | AP-F1, AP-F2, BE-F3 |
| Collaboration stays intuitive | Partly: issues A and B | | BE-F2, BE-F3, AP-F9 |
| "Both samples pass every LDA and livable check" | **No:** 5 warns | **No:** 8 warns, 7 notes from the 3D model | BE-F4, BE-F5, AP-F1, EN-F4 |
| The "1 as-built note" chip (user screenshot 1) | Gone | **"7 notes from the 3D model"** in the capsule | AP-F1, EN-F4 |

---

## ENGINE

### EN-F1 · must-fix (major) · Keep side passages and the ground in front of outside doors clear of planting
- **Absorbs:**
  - 3D item 5, NOT FIXED on both houses (walking space);
  - 3D new issue 1;
  - the tree half of 3D item 8 (villa navigator);
  - the issue "Side-passage trees block the only route…";
  - the cause of the villa's Servant Quarter trap.
- **Problem:** see "Read this first", point 1.
  - **10 marla:** the canopy (y 35.6–40.2) stands 0.6 ft outside the lounge's 8 ft slider (y 31–39) and covers its rear half. The walker stops at y 35.2, and more trees follow at y 45.6–50.3.
  - **Villa:** four trees stop the walker at y 16.0, 29.3 and 57.2. One stands 0.6 ft outside `g_dirty_kitchen_ext` (45, 45).
  - Confirmed in `villa-side-passage-trees-block-kitchen-door.jpg`.
- **Acceptance:**
  - **The rule, whatever the landscape code asks for:**
    - In any outdoor room narrower than 8 ft (a side or rear passage), no tree, planter or hedge brings the clear walking width below **3 ft**, anywhere between 0 and 7 ft above the ground.
    - Nothing planted stands within **3 ft outside any exterior door, sliding door, arch or gate**, across the door's width plus 1 ft each side.
    - An offending item is moved along the passage or into a wider space, or made a slim columnar form against the boundary wall, or left out.
    - Each such change is a `warn()` in the build log, not an as-built note.
  - **10 marla:**
    - The slider at x 30, y 31–39 is clear across its full width.
    - In Walk, from the slider, holding W toward the rear reaches the Rear Space (feet y ≥ 60) without stopping.
  - **Villa:**
    - From the driveway, holding W down the east passage reaches the Rear Service Yard (y ≥ 76) without stopping.
    - Nothing stands within 3 ft outside (45, 45).
    - The Servant Quarter is reached on foot from the main door.
  - Both gardens still have trees (front lawn, rear yard, a light court).
  - **New harness check "Outdoor reach"** (`engine/dev/checks.ts`): a 3 ft route from the gate reaches every exterior door and every outdoor room. It passes on both samples and on `contracts/fixtures/design-*.js`.
  - `contracts/house-sdk.d.ts` documents the clearances for `landscape.tree`, `planter` and `hedge`.
- **Hints:**
  - Build the keep-out once, from `ctx.plan` (outdoor rooms, exterior openings and gates), in `landscapeAPI` (`landscape.ts:24`). Test it in `tree()` (L114), `planter()` (L89) and `hedge()` (L124).
  - Use the canopy radius each `TreeKind` actually builds (see `plantTree`, L396), not the trunk.
  - The viewer needs no change: its solid box is the element's box, so a tree that isn't in the strip doesn't block.
  - A guest walking the passage proves it. The nav grid (`viewer/walk/navgrid.ts`) is built from the same collider.

### EN-F2 · must-fix (major) · Build openings on exterior walls that face more than one outdoor room (villa Rear Sun Terrace)
- **Absorbs:**
  - 3D item 5 (villa): "Rear Sun Terrace door drawn but not built";
  - 3D new issue 2;
  - the issue "Villa: Rear Sun Terrace door is in the 2D plan but not built in 3D";
  - the critic's engine-log note "…is not on a wall between the Upper Passage and the Rear Sun Terrace, so it was not built".
- **Problem:** see "Read this first", point 2. The plan check passes (`plan.rule.openings`) while the engine skips the door (`asbuilt.opening_skipped`, fail). The walker hits a wall at x 15.4.
- **Acceptance:**
  - **Villa:**
    - `f_corr_rear_terrace` is built as a 5 ft slider in the Upper Passage's west wall at y ≈ 59.
    - The as-built report has no `asbuilt.opening_skipped`.
    - In Walk, from Rooms > Upper passage, facing west at y 59 and holding W puts the walker on the Rear Sun Terrace (x < 15).
    - The West Terrace stretch of that wall (y 42.5–53) is unchanged.
  - **The other samples and fixtures:**
    - The leaf or panel sits correctly; swing sides are right on every door of both samples and of `contracts/fixtures/design-*.js`.
    - No other opening on them is newly skipped, narrowed or moved.
  - **The harness:**
    - Check 6 (openings) passes.
    - A plan door or slider that the engine skips is now a harness **fail**.
- **Hints:**
  - **Lowest risk:** resolve the two rooms at the opening's own position, not from the run. Take the plan rooms just either side of `run.c` at `along`, using `plan.roomAt(level, …)`. Use that pair in the match (L321-322), in the swing side (L441-449) and in `openingsOf` (L753).
  - **Alternative:** add the outdoor neighbour to the exterior key at L178, so runs split where the neighbour changes. Check `resolveJunctions` leaves no seam at the split.

### EN-F3 · must-fix (major) · An upper-floor open space over a ground court is a void, not a deck
- **Absorbs:**
  - 3D new issue 6 / the issue "Villa 'Light Court Void' is built as a closed, door-less first-floor deck";
  - the void half of 3D item 8 (the navigator drops you onto it);
  - the engine side of the critic's "No way in" false positive (the backend side is BE-F4).
- **Problem:**
  - `plan/model.ts:226`: `if (cat === "outdoor" && p.lv !== this.ground) cat = "deck"`.
  - `f_patio_void` (x 0–5, y 42.5–65, first floor) sits over the ground-floor `g_patio`, "West Light Court".
  - Result: the void is floored at 12.5 ft, has privacy screens, and roofs over the court below.
- **Acceptance:**
  - **The rule:** an `open_space` on an upper floor that overlaps a ground-floor `open_space` or `courtyard` by more than 50% of its area is a **void**:
    - no floor, no slab and no privacy screens;
    - the court below is open to the sky;
    - its edges against decks or floors get the standard 3′6″ guard.
  - An upper `open_space` over enclosed rooms keeps today's floored light court (B.9).
  - **Villa:**
    - There is no `floor_f_patio_void` and no slab over `g_patio`.
    - The West Terrace and Rear Sun Terrace edges along x 5 are guarded.
    - The harness guards check passes: a walker pushed west off either terrace is stopped.
  - The rule is written in `contracts/engine-notes.md` so that BE-F4 and VW-F1 use the same definition.
- **Hints:**
  - The drop guards come from `structure/guards.ts` once the void cells are not walkable floor.
  - Screens (`model.ts:179-181`) only form between two decks, so they go away by themselves.

### EN-F4 · blocker (part of the samples' trust surface) · Engine notes report problems only, in one plain sentence
- **Absorbs:**
  - critic M3 ("Engine as-built notes leak into the villa's title capsule and dock") and the "As built" log copy;
  - the villa part of "User screenshots: '1 as-built note' chip";
  - "Tight walking path <3 ft" while "A clear 3 ft path…" passes (with AP-F1).
- **Problem:**
  - The villa shows "7 notes from the 3D model".
  - Some are the engine reporting its own safety work as `warn`:
    - `asbuilt.privacy_screen:*` (`structure/extras-geo.ts:135-141`);
    - `asbuilt.guard_added:*` (`structure/guards.ts:108-116`).
  - Others read like a log: "The sliding door between the Upper Passage and the Rear Sun Terrace is not on a wall between the Upper Passage and the Rear Sun Terrace, so it was not built."
- **Acceptance:**
  - "Privacy screen added" and "Guard rail added" have status `pass`, so they are never counted or listed as notes.
  - Every remaining note is one sentence of at most about 140 characters. It uses sentence-case room names and names each room once. For example: "The sliding door from the upper passage to the rear sun terrace couldn't be built: those rooms don't share a wall."
  - With EN-F1–F3 merged, both sample versions build with **0 warn and 0 fail as-built notes** in the harness.
  - If a "Tight walking path" (`furniture/paths.ts:571`) note remains on the villa's dirty kitchen, fix the furniture placement that causes it. Don't fix it by silencing the note.
- **Hints:**
  - `asBuiltIssues` (`app/plan/compliance.ts:98`) already drops `pass` rows.
  - Look for `skipOpening` messages at `model.ts:308`, `:334`, `:346`, `:410`, `:418` and `:434` (the helper is at `:533`).

### EN-F5 · polish · Furniture: windows, the villa lounge TV, the SUV
- **Absorbs:**
  - 3D new issue 9 / "Wardrobes stand in front of both 10 marla dressing-room windows";
  - 3D new issue 5 / "Villa ground 'Family TV Lounge' has a TV unit but no TV…";
  - the SUV part of 3D new issue 8.
- **Acceptance:**
  - **The 10 marla's dressing windows** (`g_parents_dress_w` at (30, 45.25) and `f_dress_w` at (30, 25.25)) are not covered by a wardrobe.
    - Use the other walls, or shorten the wardrobe.
    - Harness check 9 now applies to the only window of any room, dressing rooms included (`zones.HABITABLE` leaves them out today).
  - **Villa ground "Family TV Lounge":** it has a TV on its unit, against a wall. Or it has neither. A unit never stands free in the open edge to the lobby.
  - **The villa SUV** stays inside the porch (y ≥ 10). It doesn't poke 2.6 ft into the driveway.
- **Hints:**
  - `furniture/place.ts:1060` keeps an item across a window when it finds no other spot. For wardrobes in dressing rooms, prefer a narrower piece.
  - Parking bays are in `furniture/parking.ts:205`.

---

## VIEWER

### VW-F1 · must-fix (major) · Room navigator: honest fallback, the right room, no trap
- **Absorbs:**
  - 3D item 8 (villa), NOT FIXED;
  - 3D new issues 3 and 4;
  - "Villa: navigator traps you in the Servant Quarter";
  - "Navigator fallback message always blames furniture and can drop you in the wrong room".
- **Problem:**
  - **Wrong cause and spot:** when the grid finds no path, `route()` falls back to the room graph and marks the route `blocked` (`walk/route.ts:426`). `walkToRoom` then always says "Furniture blocks the way into the …" and jumps to `route.end` (`core/controller.ts:1438-1443`), even when:
    - a tree is in the way;
    - a door is missing;
    - the walker's own start is sealed off.
  - **The trap:** from the Servant Quarter, every later pick is "blocked".
  - **The wrong room:** `goToRoom('g_rear')` on the 10 marla lands in the Parents' Bedroom at (16.05, 55.78), because `roomStand` picks a spot reachable from the wrong side.
- **Acceptance:**
  - **The message names the real cause:**
    - planting (a landscape solid) on the rough route: "Planting blocks the way into the X, so I've brought you straight in";
    - no opening joins the room to the rest: "No door reaches the X yet, so I've brought you straight in";
    - furniture only when a furniture box is what blocks.
  - **A crossfade always ends inside the target room's rect.** On the 10 marla, `goToRoom('g_rear')` ends with feet at y 58–65.
  - **No trap:**
    - When the walker's spot has no clean grid path to the main door, the next pick says "Taking you to the X". It crossfades, or glides from the nearest connected cell.
    - It never says "Furniture blocks the way into the family tv lounge".
  - **Voids:** a room with no floor (EN-F3) is never a target. `goToRoom` on one toasts "That's open to the floor below" and doesn't move you.
  - **With EN-F1–F3 merged, on the villa:**
    - starting from the main door, every room the navigator lists glides, Servant quarter and Rear sun terrace included;
    - `goToRoom` on the Rear Service Yard and the West Light Court glides to that court, not to the kitchen.
- **Hints:**
  - Tell planting from furniture by the solid box's layer. `solidBoxes` (`controller.ts:2086-2108`) keeps `layer`.
  - For the start check, run `nearestReachable` from the main door's approach (`nav`) and compare the components.

### VW-F2 · major · Phone orbit: frame the whole house in portrait
- **Absorbs:**
  - critic M9, framing half ("Phone House: the house is cropped…");
  - Screen: House orbit 390 ("The house is cut off at the left edge").
- **Acceptance:**
  - **Framing:** at 390 × 844 and 360 × 780, the default orbit of both samples shows the whole house, with at least 12 px to spare on both sides and clear of the top chrome and the dock.
  - **Re-framing:** rotating or resizing re-frames it while the user hasn't moved the camera.
  - **Desktop:** 1440 framing is unchanged.
- **Hints:**
  - `core/framing.ts` fits points against `mx`/`my` margins.
  - Make sure `camera.aspect` is updated before the first hero fit on a phone, and give the fit the HUD's safe area (top about 120 px, bottom the dock).
  - The View-popover overlap in the same report is app (AP-F7).

### VW-F3 · minor · Walk HUD details
- **Absorbs:**
  - critic Walk 1440 ("two floor switchers with identical labels; minimap only after the mouse moves");
  - Walk 390 ("joystick invisible until touched");
  - 3D new issue 7 / "Walk floor keys 2–9 silently do nothing";
  - the hover tag "Exterior walls (roof)" from critic Pin mode.
- **Acceptance:**
  - **Minimap tabs:** the minimap's own R · 1 · G tabs (`hud/MiniMap.tsx`) are removed. If kept, they read as map previews ("Map: 1") and are styled unlike the floor stack.
  - **Minimap visibility:** the minimap shows on entering Walk and follows the same idle fade as the rest of the HUD. It doesn't wait for a mouse move.
  - **Joystick:** on touch, it has a resting ring at about 30% opacity after the one-time hint.
  - **Keys 2–9:** a key that names no floor toasts "This home has G, 1 and R" (`core/floors.ts:31`; the caller in the controller).
  - **Hover and pick labels** never carry a "(level)" suffix: "Exterior walls", "Roof" (`core/tags.ts:224` `displayLabel`/`humanLabel`).

### VW-F4 · minor (if time) · House Night reads as night
- **Absorbs:** critic minor "3D Night is murky next to the concept nights"; Screen: View popover (Night).
- **Acceptance:**
  - At View > Night, interior rooms glow warm through every window, and the house reads clearly against the sky.
  - Compare it side by side with the sample's concept night: the facade's mean luminance is within about 25% of it.
  - Day and Dusk are unchanged.
- **Hints:**
  - Exposure and ambient are in `core/sun.ts:73`.
  - Make sure the engine's `setTimeOfDay` night factor reaches the fixtures (`engine/lights.ts:132`, emissive 2.2·k).
  - Raising window-glass emissive at night is an engine change. Ask the engine owner only if needed.

---

## BACKEND

### BE-F1 · must-fix (major) · Re-roll the flagship 10 marla's Concepts A and B as mid-row
- **Absorbs:**
  - journey 5a (flagship) and its issue 1;
  - critic M1 / "Flagship 10 marla concepts A and B depict corner plots";
  - "User feedback: concepts show a corner plot";
  - "Screen: Concepts 1440" (corner plots, jargon captions);
  - the sample half of the critic's "Concept captions".
- **Problem:**
  - Sample `p_5a5893a2bcaa`:
    - `c_1f43b123ec11` (A, "Cantilevered Monolith");
    - `c_0026dc7358eb` (B, "Screened Travertine Courtyard", **Chosen**).
  - Both images (`/api/assets/projects/p_36cf8a7ec043/concepts/…png`) show a road curving away past the right boundary. I downloaded both and confirmed it.
  - B is also `thumbnail_url` (the landing and Samples card) and the print cover.
  - The captions (`concept.summary`) use jargon and US spelling, for example "board-formed concrete and warm wood-composite louvers".
- **Acceptance:**
  - **The images:**
    - A and B, by day and by night, show neighbours against both side walls and one road in front: no side street, no kerb curving away, no side lawn.
    - Judge by eye at 1440 and 390, and with the BE-F6 check if it has landed.
    - Each night image is an edit of its new day image (same camera).
  - **What stays:** ids, titles and the Chosen concept (B) are unchanged. C, D and the villa's concepts are untouched.
  - **Where B shows:** `thumbnail_url` points at the new B. The landing card, the Samples card and the print cover show it.
  - **Copies:** an untouched guest copy picks up the new images on its next open.
  - **Captions:** all eight sample captions are plain British English of about 12 words, for example "A white upper floor over grey stone, with teak screens".
  - **Rollback:** old files stay for it.
- **Hints:**
  - `cd api && uv run python scripts/promote_round2.py concept p_5a5893a2bcaa c_0026dc7358eb <day.png> <night.png>`. Dry run first, then `--apply`. Repeat for A.
  - It uploads `-r2` files, keeps the id and title, and moves `thumbnail_url` when it pointed at the old image (`promote_round2.py:44-64`).
  - Generate candidates with `concepts.concept_prompt(sample_brief, take={"title": …, "direction": …})`. The brief is mid-row, so `CAMERA_MIDROW` and `_site_sentence` apply.
    - Keep B's direction (travertine, vertical teak screen) so the 3D facade still matches the Chosen look.
    - Make 3–4 day candidates each and pick by eye. Then make the night with the same edit path as `concepts.night`.
  - Captions: a small `db.update_project(pid, concepts=…)` on `summary`. This writes production sample data.

### BE-F2 · must-fix (major) · An instruction applies no comments unless they are named
- **Absorbs:**
  - collab item 4 (PARTLY) and issue A / "A typed change in Ask silently applies every open comment…";
  - collab item 6 (PARTLY, the issue A part).
- **Problem:** see "Read this first", point 6. In the test, `v4.source.comment_ids = [cm_5c16634466ec]`, Bilal's held comment. Its thread now reads the owner's "Let me hold this one…" followed by Naqsha's "Done".
- **Acceptance:**
  - **The rule** in `POST /revise` (`main.py:783-787`):
    - `comment_ids` given: exactly those (as today; `[]` means none);
    - `comment_ids` missing **with** an instruction: **no comments**;
    - missing **without** an instruction: every open comment on the version (the Next pill's path).
  - **The repro:** with 2 open comments, apply 1 through the chooser, then type a change in House Ask.
    - The new version's `source.comment_ids == []`.
    - The held comment stays open, with no Naqsha reply.
    - The run narration says "Reading your request…".
  - **Every caller:** the same holds for Plan Ask, the compliance sheet's Fix and Revisions Ask.
  - `contracts/api.md` (L130, L215-217) says so.
  - `api/tests` covers the three cases (no Gemini call: stub `reviser_adk.revise`).

### BE-F3 · major · A revision keeps earlier "Done" answers and stores its answer to the request
- **Absorbs:**
  - collab issue B / "A later revision silently undoes a client's 'Done' request";
  - collab issue E, backend half (the request answer is lost after a reload; "A revision" until a reload);
  - collab item 6 (the issue B part).
- **Problem:**
  - Master glass `f_master_slide`: 9 ft (v2), then 10 ft (v3, Sana's thread "Done… a full 10 ft"), then **8 ft** (v4, after a typed wardrobe request). Nothing said so.
  - See "Read this first", point 7.
- **Acceptance:**
  - **Constraints:** the reviser's context lists every comment resolved (`resolved` or `partial`) in the version's lineage, with its answer, under "Keep these unless the new request conflicts. If it does, say which one and why."
  - **A deterministic guard after the plan is revised** (`reviser.finalize` or the ADK tool layer):
    - **The trigger:** an opening or room that an earlier resolved comment's change targeted is now smaller than in the parent version, and this run's comments or request did not target it.
    - **If restoring keeps every check passing:** restore it from the parent and re-check.
    - **If it doesn't:** keep the change and add a Naqsha reply to that earlier thread, for example "Version 4 narrowed the master window to 8 ft to fit the wardrobe."
  - **The repro:** v3 has the wider master window; v4 is the typed "make the master dressing room big enough for a proper wardrobe". In v4, either `f_master_slide` stays ≥ 10 ft, or Sana's thread has the reply above and the request answer names it.
  - **The version's source** gains `answer`, the request's resolution text. `contracts/api-types.ts` `Version.source` and `api.md` are updated.
  - **The summary:** the `version` SSE payload carries the version's `summary`, so the app can label the rail without a reload (AP-F2).
- **Hints:**
  - Lineage: walk `parent_id`. The comments come from `db.list_comments(pid)` filtered by `resolved_in_version` ∈ lineage. Earlier versions' `changes[].targets` + `comment_ids` give the protected ids.
  - Keep the guard to opening `width_ft` and room `rect` area. Don't try to protect furniture.

### BE-F4 · blocker · One honest compliance report on the server
- **Absorbs:**
  - critic M2, server half ("Compliance copy is duplicated, overlong… false positive");
  - "Screen: Compliance sheet";
  - the server half of collab issue D and of "Numbers disagree" (landing "12 livable" against 15);
  - the planning side of EN-F3's void.
- **Problem:** see "Read this first", points 3–5.
- **Acceptance:**
  - **Voids:** `planning.py` (the unreachable rule, about L967) treats an upper `open_space` over a ground court as a void (EN-F3's definition). The villa has no `plan.circulation.unreachable:f_patio_void`.
  - **The three rows:** `lda.check` adds `livable.railings`, `livable.doors` and `livable.paths`, with the same ids and titles as `app/plan/compliance.ts`, so server and app count the same livable rows.
  - **Review notes:**
    - A note that names the same rooms as an existing rule warning or failure is dropped. On the 10 marla, `review.3` (Bath 2 over the Drawing Room) goes.
    - The prompt also gets the open rule results and is told not to repeat them.
    - Each `message` is one sentence of at most 160 characters. The suggestion is only in `fix`.
    - Decimal feet become ′″: "15.25 ft" → "15′3″", "12 x 6.5 ft" → "12′ × 6′6″". Room names are in sentence case.
  - **Status lines:**
    - The rule: `_status` and the version summaries (`architect.py:258`, `:810`; `reviser.py:168-172`) read "A/B LDA · C/D livable", where a warn is **not** a pass and `review.*` rows are left out.
    - Review notes are appended as "· N architect's notes".
    - The 10 marla today: "36/36 LDA · 10/12 livable · 2 architect's notes".
    - The villa today: "43/43 LDA · M/N livable" (1 rule warning left: Bath 3's shape).
  - **Tests:** `api/tests/test_planning.py` and `test_review.py` cover the void, the dedupe, the units and `_status`.
- **Hints:**
  - `review_checks`/`plain` is at `architect.py:424-446`; `counts` at `lda.py:386`.
  - Keep `lda.counts()`'s shape. Add `review` to it rather than changing `livable`.

### BE-F5 · blocker · Re-stage both samples clean
- **Depends on:** EN-F1–F4 and BE-F4 merged. BE-F1 can land first or in parallel. AP-F1 is needed to read the capsule.
- **Absorbs:**
  - "Claim: both new samples pass every LDA and livable check" (NOT FIXED);
  - critic B1 / "Samples show unresolved livable checks and 'needs a change' reviews";
  - journey issue 2 / "Samples show '10/15 livable · 5 to check'…";
  - the data half of "Screen: Plan 1440" ("5 to check");
  - the villa's "Parents bedroom" with no apostrophe;
  - the floors dialog showing "Master bed + bath 0" on First for the 10 marla.
- **Acceptance:**
  - **Both samples' new current versions:**
    - `lda.check` gives 0 fails and 0 warnings;
    - no review note has `severity: major`, and any minor note left is still true;
    - the engine harness on the staged version passes every check with **0 as-built notes**.
  - **10 marla:**
    - the dirty kitchen door is 3 ft;
    - Bath 2 is not over the Drawing Room.
  - **Villa:**
    - Bath 3 is not a 6′ × 18′ strip;
    - the Entrance Lobby is reached from the veranda without crossing the Drawing Room;
    - the dirty kitchen is reached from the kitchen side, not only through the Prayer Room;
    - "Parents' bedroom" has its apostrophe.
  - **The must-fix 3D items still hold on the staged versions:**
    - harness guards, roof, independence, doors, walkway and outdoor reach (EN-F1) pass;
    - in Walk, the navigator glides from the main door to every listed room.
  - **On a fresh guest copy:**
    - the capsule reads "v3 · 36/36 LDA · N/N livable", with no "to check" and no notes;
    - the landing chip quotes the same numbers;
    - the Brief's floors list the upstairs master (First: master 1, bedrooms 2).
  - **What stays:** the concepts (after BE-F1) and the sample ids are unchanged. An untouched guest copy refreshes.
  - **Fallback:** if a staged revise can't reach 0 warnings in about 2 hours, promote the best staged version with 0 fails, and report exactly which warnings remain. AP-F1 then shows them honestly. Don't hide them.
- **Hints:**
  - Stage on a copy: `POST /api/projects/<sample>/clone {fresh:true}` as a service guest.
    - Small fixes (the door width, the name) can go straight into the plan JSON.
    - For the others, `POST /revise` with one instruction that lists the warnings and the major review points. Iterate up to 3 times.
  - Promote with `promote_round2.py version <sample> <staging> <vid> --summary=… --apply`, then `… verify`.
  - `version()` refuses fails only (`promote_round2.py:75-79`). Make it refuse warnings too, behind a flag.
  - The harness is `web/dev/engine.html?src=<version json>`.
  - This writes production sample data. Nothing is deleted.

### BE-F6 · minor · Concept takes in plain words, and every mid-row image actually mid-row
- **Absorbs:**
  - journey issue 3 / "The mid-row prompt is not always obeyed: 1 of 8 new concepts…";
  - the code half of the critic's "Concept captions… jargon and US spelling";
  - the wording half of journey issue 6 (the raised-frame prompt says "low steel frame").
- **Acceptance:**
  - **Wording:**
    - `TAKES_SYSTEM` (`agents/concepts.py:51-56`) asks for British English, plain words and a direction of at most 14 words.
    - It names what to avoid: "board-formed", "louvers", "aluminum", "vigas", "corner".
    - Ten generated takes contain none of these.
  - **The solar frame:** with `solar == "panels"`, the prompt says "rows of solar panels on a raised steel frame" (`concepts.py:73`).
  - **The mid-row check:**
    - After each day image on a mid-row plot, a quick vision call asks whether a road or street runs beside the house. A yes regenerates the image once, with the site sentence repeated, and is logged.
    - Two rounds on a new mid-row brief (Show me concepts, then Four more) give 8 of 8 mid-row images.
    - Each concept takes at most 10 s longer on average.
- **Hints:**
  - `_generate_one` is at `concepts.py:158`.
  - Use `MODEL_INTAKE` with the image part and a yes/no JSON answer. On error, skip the check rather than fail the concept.

### BE-F7 · polish · An author's pin colour is the same for everyone
- **Absorbs:** collab issue I.
- **Problem:** `comment_out` keeps the owner's raw id for the owner (`keep_own`, `main.py:91-109`), while clients get the hashed handle. The hue is a hash of the id, so the owner's pin is amber `#A8641A` for the owner and green `#2F7A3A` for a client.
- **Acceptance:**
  - Every caller gets the author's handle (`author_handle(pid, raw)`); `mine` still marks one's own comments.
  - The owner's pergola pin, badge and avatar show the same hue in the owner's tab and on `/s/<token>`.
  - Mine, Team and Client filters still work for the owner.
- **Hints:** the app uses `mine` (`app/comments/model.ts:43`), not the raw id. Keep the `keep_own` parameter or drop it, whichever is simpler.

### BE-F8 · minor · Naqsha's answers say what changed, never what it didn't check
- **Absorbs:** collab issue C / "A revise from comments added a livability failure and told the client the opposite".
- **Problem:**
  - v3's pergola answer told the client the roof stays "completely clear for your solar panels".
  - The 3D model then flagged "Pergola stands in the roof area kept clear for solar panels".
  - The bedroom grew into the dressing room, and that left "No wardrobe in the Master Dressing".
- **Acceptance:**
  - **The reviser prompt:**
    - gives the solar keep-clear rect (`plan.roof.solar.rect`) and the dressing-room minimums (one solid wall of at least 4 ft for a wardrobe);
    - says to describe the change in one or two sentences, in feet and inches;
    - says never to claim a check it didn't run.
  - **The repro**, a pergola request on a solar-ready roof, gives one of:
    - a pergola outside the solar rect, with an answer saying where it stands;
    - an answer saying it takes N sq ft of the solar area.
  - **The dressing room:** `planning.py`'s `_dressing_sizes` warns when a revised dressing room has no 4 ft solid wall.

### BE-F9 · minor · Opening a sample: a fresh copy when yours has changed, and copies you can tell apart
- **Absorbs:**
  - journey issue 7 / "Opening a sample lands on an existing renamed and modified clone";
  - the naming half of critic M7 (four identical "Sample · 10 marla…" cards);
  - the Brief 390 title "Sample · 10 marl…".
- **Acceptance:**
  - **Reuse:** `POST /clone` (no `fresh`) reuses a copy only while it is untouched: same name, no comments, no versions beyond the sample's. Otherwise it makes a new copy.
  - **Names:**
    - New copies drop the "Sample · " prefix: "10 marla modern home, Johar Town".
    - A second copy of the same sample in the same workspace is named "… (2)".
    - `cloned_from` is kept, so the app can caption it (AP-F8).
  - **Tests:** `api/tests` covers untouched reuse, renamed → new copy, and naming.
- **Hints:** `db.find_clone` / `refresh_clone`, used at `main.py:266-284`, and `clone_project` (`store/db.py:304`).

### BE-F10 · blocker (last) · Deploy and re-verify
- **Depends on:** everything above that is merged.
- **Acceptance:**
  - **Before deploying:** `cd api && uv run pytest -q` and `cd web && npm run build` are clean.
  - **The revision:** a new Cloud Run revision serves 100% of traffic, and live `/` names the bundle built from the deployed commit.
  - **Re-checks on live:**
    - the 3D must-fix table: items 5 and 8 on both samples;
    - journey 5a;
    - collab items 4–6;
    - the trust surface: a fresh copy of each sample shows a clean capsule.
  - Each re-test file names the bundle it tested.
- **Hints:**
  - Run `CLOUDSDK_ACTIVE_CONFIG_NAME=hack2skill gcloud run deploy naqsha --source . --region us-central1 --timeout 3600 --service-account agent-runtime@project-d5fe6dd3-2b61-40b3-932.iam.gserviceaccount.com --allow-unauthenticated`.
  - **Never pass `--set-env-vars`.**
  - Deploying changes the public app: get the user's go-ahead first.

---

## APP

### AP-F1 · blocker · One tally everywhere; review notes and 3D notes out of the counts
- **Absorbs:**
  - critic B1 (app half) and M3 (capsule and dock);
  - collab item 5 (counts) and issue D;
  - round-1 #12 (contradicting tallies);
  - "User screenshots: '1 as-built note' chip" (PARTLY);
  - the critic's "'Every room has a proper way in' / 'A clear 3 ft path' pass while notes say otherwise";
  - the landing's "12 livable" against the product's 15.
- **Acceptance:**
  - **`summarize`** (`plan/compliance.ts:108`) never counts a `review.*` row in the LDA or livable tallies, `warns`, `fails` or "to check". It returns those rows as `review`.
  - **The capsule and the dock** never mention as-built notes: `countsLine` (`shell/narration.ts:120`) and `planLine` (`shell/ProjectShell.tsx:392`).
  - **The compliance sheet groups:**
    - LDA rules;
    - Livable home;
    - **Architect's notes**: collapsed, with the header "N architect's notes". Each row is the note's first sentence, with "Suggested: …" on expand.
    - **As built**: only when there are non-pass notes.
  - **The derived rows read the as-built report.** `livable.doors` and `livable.paths` turn warn with the note's sentence when there is a door or path note (for example "Tight walking path"). No passing row contradicts a note.
  - **The run log** (`design/flow.ts:171`) says "All N checks pass" only with 0 fails and 0 warnings. Otherwise it says "N pass · M to check".
  - **One phrasing helper** feeds the capsule, the Plan chip, the sheet header, the dock line, the Revisions header (`RevisionsView.tsx:236-247`), the print cover (`PrintDocument.tsx:429-430`) and the run log.
    - For today's 10 marla version (`v_f881a067c573`), every one of them says 36/36 LDA, 10/12 livable and 2 to check.
    - None says "notes from the 3D model".
  - **Once BE-F4 adds the three livable rows server-side,** the app adds none (`withLivable` already skips ids it has). The landing chip (`landing/Construction.tsx:155`) and the features copy (`Landing.tsx:26`) then quote the same numbers as the capsule. Check this after BE-F5.
- **Hints:**
  - `withLivable`/`ALWAYS_LIVABLE` is at `compliance.ts:148-160`.
  - The as-built notes come from `asBuiltIssues(asBuilt)`. Pass them into `livableChecks`, or patch the two rows in `summarize`.

### AP-F2 · major · Revisions: a short headline, your request, a correct rail, everything that changed
- **Absorbs:**
  - collab item 5 (PARTLY) and issue E (app half);
  - collab issue N (numbered keys look like pins);
  - critic M8 / "Revisions heading is a run-on log line…";
  - "Screen: Revisions 1440 and 390".
- **Acceptance:**
  - **The H1** is at most 60 characters: one line at 1440, at most 2 lines at 390. Example: "Version 4: a bigger master dressing room". When the version has a typed request, the H1 leads with it. The detail stays under "What changed" (`storyTitle`, `RevisionsView.tsx:341`).
  - **A "Your request" card** appears when `version.source.instruction` is set. It shows the text and Naqsha's answer (`version.source.answer`, from BE-F3), and is still there after a reload.
  - **The version rail** labels a new version correctly without a reload:
    - patch the `project.versions` entry with the event's `summary` (`store/project.ts:318-323`);
    - or refetch the project when the run ends.
  - **"What changed"** lists every room whose rect changed and every opening whose width changed between parent and version, not only declared targets (`BeforeAfter`, `RevisionsView.tsx:361`). A door that went from 10 ft to 8 ft shows as "Door 10′ → 8′ wide".
  - **"Walk through it"** appears once: drop the secondary button when the Next pill says it.
  - **The Before · Wipe · After control** sits outside the drawing's dimension band, so 35′ and 30′ are visible (`revisions/PlanCompare.tsx:82`).
  - **The plan legend** is sorted, in sentence case, and keyed with letters (A, B, …), not circled numbers.
  - **The view switch** shows an active item on `/revisions`.
  - **The status line** uses AP-F1's helper.

### AP-F3 · major · Brief: nothing under the Next pill, one of each action
- **Absorbs:**
  - critic M4 / "Brief Next pill covers the LDA facts (1440) and the suggestion chips (390)";
  - "Screen: Brief 1440", "Screen: Brief 390";
  - critic minor "New brief: 'Decide everything for me' appears three times…".
- **Acceptance:**
  - **At 1440 × 900:**
    - The right column and the chat scroll with bottom padding of `var(--dock-h)` + 16 px.
    - "Front · rear 10′" and the regulation footer show above the dock.
    - `document.elementsFromPoint` at the Next pill's four corners returns no text node of the brief.
  - **At 390 × 844:** the suggestion chips sit above the dock's safe area, and the Next pill never covers them.
  - **"Show me concepts"** appears once on a filled brief. Hide the chat chip when the Next pill says it.
  - **On a new brief:**
    - "Decide everything for me" appears once (the dock chip). The widget keeps "Decide for me" for its own question.
    - The right column shows only known rows, plus one line "Naqsha will ask about the rest", instead of seven "Not yet" rows.
    - At 390, "225 sq ft = 1 marla" doesn't wrap onto an orphan line.
  - **The title** at 390 shows at least the first three words of the home's name.
- **Hints:**
  - `setup/BriefView.tsx:143` already uses `--dock-h` for one element. The right column is `setup/BriefSheet.tsx`.
  - The chat chips are filtered at `setup/Conversation.tsx:138`.

### AP-F4 · minor · Floors and roof dialogs, and the setup wording
- **Absorbs:**
  - "Screen: Brief dialogs";
  - critic minor "Floors dialog hides its footer below a 900px viewport";
  - "Rooms dialog Roof tab '111 of 317 sq ft'…; 'tank' leaks into the roof option's name";
  - journey issues 5, 6 (app half), 8 and 11;
  - critic polish "'Recommended' uses pass-green";
  - the kW mismatch in "Numbers disagree".
- **Acceptance:**
  - **The floors dialog:**
    - At 1440 × 900 the footer is sticky, and "Save floors" is visible without scrolling.
    - The header reads "4 bedrooms in all · LDA allows up to 3 storeys" (`setup/widgets.tsx:262`).
    - The Roof tab shows the stair tower as a fixed line ("Stair tower · 111 sq ft"). Its meter counts only the rooms the family adds, so 0 rooms never reads "111 of 317 sq ft".
  - **The roof question:**
    - The concrete-tank option's accessible name starts with "Concrete tank in the stair tower".
    - "Recommended" is ink-2 or accent, not `text-pass` (`widgets.tsx:522-531`).
  - **The storey options' accessible names** start with their label, for example "Double storey. DHA allows ground + first, plus a basement".
  - **The inline per-floor editor** collapses zero-count room types behind "More rooms", so "Use these floors" is within 600 px of the question.
  - **One label map for solar and tank**, used by:
    - "You said" (`setup/Understood.tsx:52`);
    - the brief row (`BriefSheet.tsx:76`);
    - the Concepts subtitle (`concepts/ConceptsView.tsx:198`);
    - Details (`shell/DetailsDialog.tsx:26`);
    - Plan (`plan/FloorPlan.tsx:669`);
    - Print (`plan/PrintDocument.tsx:216`).

    The labels are "Roof kept clear for solar", "Raised solar frame", "No solar", "Blue plastic tank" and "Concrete tank in the stair tower".
  - **The solar size** in the roof question equals the number the compliance sheet quotes (one formula; `widgets.tsx:567`).

### AP-F5 · major · Plan labels clear of door swings, at every size and in print
- **Absorbs:**
  - critic M5 / "Plan labels sit on door swings; the A4 site plan overprints its dimensions";
  - journey issue 12 / "Plan labels overlap on mobile";
  - "Screen: Plan 1440" (labels on arcs, Title Case);
  - "Screen: Plan 390" (abbreviations);
  - the A4 part of "Screen: Print dialog and preview".
- **Acceptance:**
  - **At 1440, on both samples:**
    - No room label or dimension text intersects a door-swing arc: the Dirty kitchen dimension, the Parents' bedroom and bath labels.
    - The same holds on the Revisions compare.
  - **At 390:**
    - "Gate"/"Lawn" and "Car gate"/"Driveway" don't overlap.
    - Labels never abbreviate ("D. kitchen") or drop the owner ("Bedroom" for "Parents' bedroom"). They wrap to two lines or step down a size (`plan/model.ts:93`, `:125`).
  - **On the A4 cover site plan:**
    - Dimension texts don't overprint: "35′" and "30′" are separate, or the inner row is dropped at that scale.
    - "Up" isn't clipped.
  - **Room names** in plan labels and legends are sentence case: "Stair hall", "Side space", "Parents' dressing".

### AP-F6 · major · Phone Plan: legend, chip row, and room hover on desktop
- **Absorbs:**
  - critic M6 / "Phone Plan legend covers the front of the drawing";
  - "R3 M10: plan dock collisions" (PARTLY) / "Phone Plan chip row has no end gutter";
  - "Plan room hover 'Opens to'" (NOT FIXED).
- **Acceptance:**
  - **At 390:**
    - The legend is collapsed behind a "Key" button, or docked under the plan. The front lawn, gate, driveway and "40′ road" are visible.
    - The chip scroller has 16 px end padding: scrolled to the end, the last chip stops 16 px from the edge.
  - **At 1440:** moving a real mouse over a room shows "Bedroom 2 · 14′ × 12′ · Opens to: …" within 100 ms. Leaving the room hides it.
- **Hints:**
  - The hover is wired (`plan/FloorPlan.tsx:174`, `:187`, `:1205`) but nothing shows on live.
  - Check what swallows `pointermove` above the room rects (a pan or gesture layer, or the labels `<g>`). Check also the `pointers.current.size` guard in `onHover` (L1127-1128): a mouse pointer that was never removed keeps it non-zero.

### AP-F7 · major · House on phone, and the HUD's details
- **Absorbs:**
  - critic M9, popover half;
  - "Screen: House orbit 390" (the View popover covers "All");
  - critic minor "Phone room list has no close control…";
  - "Screen: Walk 390" (room list);
  - "View popover 'Cut away' row is misaligned";
  - critic polish "Selected-floor thumb differs between views".
- **Acceptance:**
  - **At 390, the View popover** never overlaps the floor stack: anchor it above the bottom-left row, or hide the stack while it is open. There is one glass layer, not two.
  - **At 390, the room list sheet:**
    - has a grab handle and a 44 px Close;
    - closes with Escape and with the back gesture;
    - hides the view switch while open.
  - **The "Cut away" row** lines up with the rows above, label and switch (`explore/HouseView.tsx:794`: the extra `px-2` wrapper).
  - **The floor stack's selected thumb** looks the same in Plan, Revisions and House.

### AP-F8 · major · Workspace: one look per card, one left edge
- **Absorbs:**
  - critic M7 / "Workspace thumbnails are inconsistent…";
  - critic minor "Workspace: two left edges, an unbalanced Samples grid, a redundant empty state";
  - "Screen: Workspace 1440" and "Workspace 390".
- **Acceptance:**
  - **Card images:**
    - A card shows the selected concept's day image (card size) when there is one, and `thumbnail_url` otherwise (`workspace/Workspace.tsx:260`).
    - No grey aerial or cut-away capture appears where a concept exists.
  - **One left edge at 1440:** "Your homes", the composer, the tabs and the grid all start at the same x.
  - **The Samples tab** lays its 2 cards in a 2-column grid.
  - **A new guest's "Your homes"** has no dashed "New home" tile repeating the composer.
  - **Drafts:** a home with no version reads "Draft · 8 hours ago".
  - **Sample copies** carry the caption "From the samples" (`cloned_from`). Names come from BE-F9.
  - **At 390:** the "Your homes" heading doesn't show over the Samples tab, and the style reads "Modern contemporary".

### AP-F9 · minor · House comments and the revise flow
- **Absorbs:**
  - collab issues F, G, H, J and M;
  - round-1 #12 (stale chips);
  - critic minor "Pin mode shows two accent buttons and a stale hint".
- **Acceptance:**
  - **Leaving pin mode:** after "Pin it", pin mode ends. `saveDraft` (`explore/HouseView.tsx:247`) clears `commentMode`, as the client does (`share/HouseStage.tsx:124`).
  - **A typed change in House Ask** opens the Conversation ("Your changes"), as a comment revise does (`HouseView.tsx:306-312`; `toggleChat(true)`).
  - **In pin mode:**
    - the Next pill is hidden, so there is one accent;
    - the dock narration reads "Click the house to pin a note · Esc to stop" (`shell/ProjectShell.tsx:209`).
  - **The roof pin's labels:**
    - The composer tag reads "Roof", not "Roof (roof), roof".
    - The chips read "Move the roof" and "Change the roof to".
    - The sheet group reads "Roof".

    `anchorLabel` (`explore/snapshot.ts:66`) and `quickStarts` (`explore/Composer.tsx:18-28`) strip a trailing "(…)" and drop the level when the label already names it.
  - **Conversation suggestion chips** show only on the latest Naqsha message, and never once the home has a version (`shell/ConversationSheet.tsx:133`). Nothing stale appears during or after a revise.
  - **Pin numbers** are stable across versions. Number by `created_at` across **all** the project's comments, not the version's open ones (`comments/model.ts:63` and its callers). A pin numbered 3 on v2 is still 3 on v4.

### AP-F10 · minor · Comments sheet and sharing
- **Absorbs:**
  - "Comments filter mixes author and status" (NOT FIXED);
  - "Screen: Comments sheet" and the critic's minor "Comments sheet…" (without the glass restyle: see Not scheduled);
  - collab issues K and L.
- **Acceptance:**
  - **Filters** come in two groups that combine: Who (All · Mine · Team · Client) and Status (Open · Resolved) (`comments/CommentsSheet.tsx:145`).
  - **Authors:** every author has an avatar, a name and a role caption. The owner shows by name when known, otherwise "Owner". Client comments in the owner's sheet have avatars.
  - **Snapshots:** no empty snapshot box. The thumbnail renders only once its image loads (`comments/CommentItem.tsx:208-216`).
  - **A revoked client link:** the open client page notices on its next 10 s poll and shows "This link is no longer shared". A failed send keeps the typed text.
  - **The Share dialog**, while `/members` loads, shows a loading state rather than "off" (`share/ShareDialog.tsx:150`).

### AP-F11 · minor · Keyboard and touch: tab order, focus ring, 44 px targets
- **Absorbs:**
  - "R3 M4: HUD tab order" (NOT FIXED);
  - "HUD focus ring draws square corners inside rounded fields";
  - "Screen: Room navigator" (focus ring) and "Screen: House orbit 1440" (focus ring, tab order);
  - "Phone tap targets under 44px without hit-44".
- **Acceptance:**
  - **Tab order on House:**
    1. All homes, the title, the view switch, Comments, Share;
    2. then the view's HUD;
    3. then the dock.

    Render the shell chrome before the view in the DOM: the view is at `shell/ProjectShell.tsx:307`, the chrome at `:323-338`. Visual stacking stays the same.
  - **The HUD focus ring** follows the control's radius. Inputs and textareas inside rounded wrappers (the dock composer, the navigator field) get the ring on the wrapper through `:focus-within` (`index.css:179-184`).
  - **At 390**, these all have a hit area of at least 44 px (`hit-44`):
    - the title button and Home menu;
    - All homes and Share;
    - the view-switch segments;
    - "Plot and brief", "Pick a size", "Decide for me", "Decide everything for me";
    - Before/Wipe/After;
    - the Revisions floor buttons.

### AP-F12 · minor · Concepts lightbox alignment
- **Absorbs:**
  - "Concepts lightbox title column is misaligned with the image";
  - "Screen: Concepts lightbox 1440";
  - "Screen: Concepts and lightbox 390".
- **Acceptance:**
  - **At 1440:** the title, description and "Remix it:" align with the image's left edge (about x 170), and the action row with its right edge.
  - **At 390:**
    - Day/Night and Close sit above the title, at least 8 px from the view switch.
    - The description runs full width.
  - **The narration** never ends in "…." or doubles its punctuation.

### AP-F13 · minor · Print: the exact sheet count, one name per room, consistent areas
- **Absorbs:**
  - "Print dialog sheet count is vague and wrong";
  - "Screen: Print dialog and preview" (count, sheet 6, "Dress");
  - journey issue 4 / "The cover area schedule's total covered area and floor area ratio disagree".
- **Acceptance:**
  - **The button** states the exact count: "Print 6 sheets" on A3, "Print 7 sheets" on A4 (`plan/PrintDialog.tsx:116`).
  - **No compliance sheet** holds less than a third of a page. Re-flow, or merge the tail into the previous sheet.
  - **One label per room** across Plan, print and the navigator ("Parents' dressing").
  - **The area schedule** (`PrintDocument.tsx:310-345`) adds "Floor area for FAR" = `metrics.total_floor_area_sqft`. It captions "Total covered" as including the porch, balconies and stair tower. The FAR row then matches the line above it.

### AP-F14 · minor · Copy: sentence case, plain words, the same numbers
- **Absorbs:**
  - critic "Title Case, abbreviations and mixed units leak into copy" (app half);
  - critic minors "Icon-only 'Design again'" and "Numbers disagree" (the time half);
  - critic polish "First Next on a fresh sample is 'See what changed'";
  - the client's phone copy "Click a spot".
- **Acceptance:**
  - **Display text is sentence case:**
    - "Modern contemporary" (cards, fact tokens, Concepts subtitle, Details);
    - "Ground: 1 bed, drawing, TV lounge, kitchen, dirty kitchen";
    - "Master bedroom window, first floor";
    - wish chips in sentence case.
  - **"Design again"** is a labelled button with its existing confirm (`plan/PlanView.tsx:384`).
  - **Touch copy:** on touch devices it says "Tap", not "Click" (`share/ClientView.tsx:334`; the owner's narration too).
  - **Times:** the Versions popover and Details give the same age for the same version.
  - **The first Next** on a sample copy whose revision the user hasn't seen is "Walk through it" (`shell/next.ts:109`).
  - **The Brief chat** of a home that already has a version doesn't say "when you tap Show me concepts".
  - **The Versions popover header** loses "the camera stays put".

### AP-F15 · minor · Client view: the owner's layout
- **Absorbs:**
  - "R3 M11: client view controls" (PARTLY);
  - "Client view lacks the floor stack and moves controls to the bottom-left";
  - "Screen: Client view 1440 and 390".
- **Acceptance:**
  - **Controls:**
    - The client's House has the floor stack (R · 1 · G · All).
    - Rooms and Comment sit bottom-right, as for the owner, with the same key hints.
  - **The capsule** reads "Shared by <owner name>" when the owner has a name, otherwise "Shared with you".
  - **Phone copy** says "Tap".
  - The blank snapshot box is fixed by AP-F10.

### AP-F16 · polish · Landing and sign-in polish
- **Absorbs:**
  - journey issues 9 and 10;
  - critic polish "Landing feature row baselines…" and "Landing phone drawing is cropped…";
  - "Screen: Landing 1440", "Landing 390", "Sign-in / create account";
  - critic minor "Sign-in and create-account layout shifts".
- **Acceptance:**
  - **The landing at 1440 × 900:**
    - The animation frame's top sits inside the first viewport, and the timeline starts at 25% visibility. A visitor who doesn't scroll still sees it play.
    - On Replay, the plot count never shows a negative value (clamp the spring).
    - The feature titles are one line, or the bodies share a baseline.
    - "How it works" uses one duration style.
    - The hero CTAs align to the subhead.
  - **The landing at 390:**
    - The construction SVG fits its frame (viewBox or `preserveAspectRatio`).
    - The caption pill sits above the ground line.
  - **Sign-in:**
    - The header uses the landing's 1280 container.
    - The sign-in and create-account cards sit at the same top.

---

## Not scheduled

| Item | Why |
|---|---|
| Cars hidden in Walk instead of "fade within 2 m" (3D new issue 8) | Hiding them passes the user's must-fix: cars no longer block the view or the way in. Showing them again risks that. Amend DESIGN instead. The SUV poking into the driveway is in EN-F5. |
| Leaving Walk keeps Orbit isolated on that floor (3D new issue 10) | Intended. The floor stack shows the isolated floor, and "Whole house" restores the rest. |
| The Comments sheet and Home menu as `glass-hud` over 3D | `ui/Sheet.tsx` supports `tone="hud"`, but the comment items are styled for light surfaces. A restyle is a day's work for little gain. The white sheet reads fine. |
| A filled brief repeats the same facts in the Understood card, the brief column and the canvas caption | A content-design change across three components. AP-F3 already cuts the worst duplicates. |
| The builders band's empty right half (landing) | Needs a new asset or layout. Ship as is. |

Not tested by the reviewers, so there are no tasks: the Team role with real accounts, the client walk itself, and the 1280 client layout.
