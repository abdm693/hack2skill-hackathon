# Round 1: Walk mode on both samples

- **Tester:** QA (walk mode focus)
- **Date:** 17 Oct 2026
- **Build:** live Cloud Run, https://naqsha-242926648187.us-central1.run.app

**Projects** (the workspace is a shared guest workspace, so other testers' comments show up in both):

| Sample | Project | Version |
|---|---|---|
| 10 marla | `p_8d8010bb3391` | v2 |
| 1 kanal villa | `p_4e01a962c3ae` | v2 |

**Browser:** built-in Chromium pane. Pointer lock is refused here, so I tested the drag/hover fallback.

**Sizes tested:**
- 1366×820
- 1180×760
- 375×812 (mobile preset, touch)
- 320×700 (touch)
- 280 px (the pane's own width)

**Method:**
- Real clicks and key presses where the automation allowed it. For held keys I used synthetic `KeyboardEvent`s on `window`, which go through the app's own handlers.
- The production build has no `window.__viewerDebug`. I read the viewer state from the React fiber (`ViewerController`): feet position, `grounded`, store, and `nav.route`.
- Geometry was measured from merged-mesh part ranges and raycasts.
- Coordinates are plan feet: x across the plot, y away from the road, h above datum.
- Screenshots are in `docs/review/round1-walk-shots/`.

## Summary

The user's headline walk complaints are fixed on both samples:
- I could not fall anywhere.
- Every stairwell edge has a guard.
- Both houses have a stair to the roof, and the roof door sits at floor level beside the stair arrival.
- No TV sits in or in front of a doorway.
- Cars hide in walk and never collide.
- Floor buttons and the 1–3 keys glide you up the real stairs to the landing.
- The room navigator and the minimap glide you through doorways.
- F asks before revising.

What is still wrong:
- **Villa:** the kitchen door is half blocked by a microwave counter.
- **Both:** the walker can climb onto armchairs and the villa's solar panels.
- **Comments:** cancelling a walk comment leaves you frozen with a false "Pinned" message and an orphan pin.
- **Minimap:** it fades out under your cursor while you read it, so the click does nothing.
- **Villa:** Bedroom 3 and the Master Bedroom are joined by one continuous front balcony.

The remaining findings are small HUD and polish items.

Severity counts: **0 blocker, 6 major, 6 minor, 11 polish**.

## Verified working

**Stair and edge safety ("try to fall")**
- I ran more than 80 edge probes on both samples: walking, Shift-running, diagonals (W+A, W+D) and strafing (A, D).
- Locations covered: every stairwell edge, first-floor landing, half landing, roof landing, balcony, rear terrace and roof parapet.
- The walker was grounded on every frame; it was never airborne.
- 10 marla: a glass guard with a timber handrail runs the full lounge–stairwell edge (x ≈ 7.7, y 32–42.5). A roof-level well guard covers y 32.
- Villa: a wrought-iron guard runs the full edge (x ≈ 8.2). These iron railings now collide; yesterday they did not.
- Screenshots: `marla-first-floor-stair-glass-guard.jpg`, `villa-first-floor-stair-guard.jpg`.

**Stair to the roof and the roof door**
- Both houses have a full dogleg from the first floor to the roof.
- 10 marla: the door is at (2.5–5.5, 28) and the arrival at (6.6, 29.3).
- Villa: the door is at (8.5, 39.5–42.5) and the arrival at (6.95, 42.7).
- Both sills are at h 23.5 (the mumty floor), and I walked out onto the roof in both.
- Screenshots: `marla-roof-door-from-terrace.jpg`, `villa-roof-door-from-landing.jpg`.

**TV placement**
- No TV or TV unit sits in or in front of any opening on either sample. The closest are 0.5 ft beside an arch or door.
- 10 marla lounge: the TV is at x 21.3–25.9 and the main door at x 16–20.
- Screenshot: `marla-lounge-tv-beside-main-door.jpg`.

**Cars**
- With Cars on "auto", cars are hidden in walk (opacity 0), and I walked straight through the 10 marla SUV footprint.
- With Cars switched to "show", the car fades as you approach (within about 2 m) and never collides.

**Mouse look (fallback)**
- Clicking the canvas shows a "Drag to look around" toast.
- A 512 CSS px horizontal drag turned the view 97°, game-style: drag right turns right, drag up looks up.
- Hover-at-edge turning also works.

**WASD and Shift**
- Walking speed is about 4.9 ft/s (1.5 m/s).
- Shift roughly doubles it to about 10 ft/s.

**Floor rail, number keys and `]`**
- They glide you along the route (through the main door, up the stairs) to the landing, facing into the floor.
- 10 marla: G→1 took about 4.5 s; key 3 took you out of the mumty onto the terrace. Key 1 on the ground floor faces the lounge and dining.
- Villa: lawn→roof took 4.6 s.

**Room navigator**
- M opens it, with a "You're here" marker.
- Typing "bedroom 3" and pressing Enter glided me from the ground lounge, up the stair and through the lounge, into Bedroom 3 through its door.
- Esc closes it without leaving walk.

**Minimap**
- Clicking Drawing Room glided me through the drawing–lounge door.
- The minimap's floor tab (1), followed by Master Bedroom, glided me up to the first floor.
- The route draws on the map.

**Room pill**
- It was correct for 26/26 rooms (10 marla) and 33/33 rooms (villa) in a teleport sweep.
- The only exception is the stairwell centre, which lands you on the lower flight.

**C to comment**
- C pins at the crosshair and opens the composer with a snapshot and room-aware chips.
- Typing W, A, S, D, M, F, C, V and 1–3 in the composer neither moves the walker nor fires a shortcut.

**F to finish**
- F opens "Revise with 1 comment?" with a checklist and Not yet / Revise buttons.
- Not yet returns you to walking. I did not click Revise, because the project is shared.
- Screenshot: `marla-F-confirm-dialog.jpg`.

**Leaving walk**
- Esc gives a three-quarter aerial orbit of the 10 marla house with the right neighbour ghosted (`marla-orbit-after-leaving-walk.jpg`).

**HUD layout**
- 1180×760: no overlapping controls apart from the navigator popover (see issue 7). Screenshot: `villa-1180-walk-hud.jpg`.
- 375×812 and 320×700 (touch): no overlaps once the house has built. The touch joystick moves you (full push runs) and a right-side drag turns the view. Screenshot: `villa-phone-walk-hud.jpg`.

**Spawn**
- Both samples spawn you at the main door, facing in.

## Issues

### Major

**1. Villa kitchen door is half blocked by the microwave counter, and the door leaf passes through it**
- The door `g_kitchen_door` is at (10.5, 44), 3 ft wide (x 9–12).
- The "Kitchen microwave" box (x 8.5–10.5, y 44.1–45.6, h 1.5–5.4) sits directly behind the left half of the opening. The open door leaf clips through the counter's marble top.
- The kitchen–patio door (x 12.5, y 53.5–56.5) has the same problem: the sink counter (x 10–12.1, y 51.5–54.5) is 0.4 ft from the door line and covers 1 ft of the opening.
- Repro: Villa → Walk → stand in the TV lounge at about (11.5, 38.5) and face north toward the kitchen door. Screenshot: `villa-kitchen-door-microwave.jpg`.
- Expected: a clear 3 ft path through every door, with no fixture inside the leaf's swing. DESIGN lists "A clear 3 ft path to every door".

**2. The walker climbs onto armchairs and the villa's solar panels**
- **10 marla drawing room:** stand at (12.5, 22.2), face west and hold W. The feet go 1.5 → 2.75 → 3.07 → 3.58 → 4.44 → 4.55 ft as you climb over `g_drawing_armchair_2`. The eye ends level with the chandelier, then you drop off the far side. Screenshots: `marla-standing-on-armchair.jpg`, `marla-armchair-eye-at-chandelier.jpg`.
- **Villa roof:** from (24, 36) or (24, 31), face east and hold W. You walk up onto the solar array and along it at h 24.8–26.0, which is 1.3–2.5 ft above the roof slab. Screenshot: `villa-standing-on-solar-panels.jpg`.
- Cause: STEP_UP (0.36 m) lets the walker chain up seat → arm → back, and the tilted panels act as ramps.
- Expected: furniture and roof equipment should be solid obstacles. Only floors, stairs and ramps should be walkable.

**3. Cancelling a walk comment leaves you frozen with a false "Pinned" message and an orphan pin**
- Repro:
  1. In Walk, press C.
  2. Type something.
  3. Press Esc, or click the composer's ×.
- The composer closes, but the walk state stays `commenting`. The centre chip still reads "Pinned. Add your note, then keep walking." and W/A/S/D do nothing.
- A blue "New comment" pin stays on the target, even after you click Keep walking or press Esc a second time. It clears only when the comments change or a 60 s timer runs out (`controller.ts` `draftTimer`).
- Screenshots: `marla-cancelled-comment-still-pinned.jpg`, `marla-orphan-draft-pin-after-resume.jpg`.
- Expected: cancelling should drop the draft pin and return to free walking immediately. Nothing should say "Pinned" for a note that was never saved.

**4. The minimap fades out under the cursor, so "click to go" silently fails**
- The minimap hides after 2.5 s without input (opacity 0, `pointer-events: none`), even while the pointer rests on it.
- Repro:
  1. Move the mouse onto a room on the minimap. The caption reads e.g. "Drawing Room · Click to go".
  2. Read it for about 2 s.
  3. Click. Nothing happens: no route, and the walker does not move.
- Measured: opacity was 1 at 0.5 s and 0 from 1.0 s onwards while the cursor stayed on the map.
- Expected: hovering or focusing the minimap should count as activity, or the minimap should be exempt from the idle fade while the pointer is over it.

**5. Villa: Bedroom 3 and the Master Bedroom share one continuous front balcony (a bedroom-to-bedroom path)**
- The plan lists three separate outdoor rooms:
  - Porch Terrace, x 0–18, reached from Bedroom 3's slider.
  - Arched Loggia, x 18–29, reached from the Lobby/Sitting.
  - Master Balcony, x 29–45, reached from the master's 8 ft slider.
- In 3D they are one strip with no divider.
- Repro: Bedroom 3 at (12, 16), face south and walk out through the slider. Turn east and walk 5.5 s along y ≈ 12.7, then turn north. You arrive inside the Master Bedroom at (35.2, 16.5) without passing any circulation. Screenshot: `villa-shared-front-balcony.jpg`.
- Expected: per the user's rule, a bedroom may open onto a balcony, but a balcony should not join two bedrooms. Add a divider or planter wall at the room boundaries, or make the master balcony private.

**6. Furniture blocks doorways in the 10 marla dressing rooms and Bath 2 (partial)**
- `g_dress1_dressing_table` and `f_dress3_dressing_table` (x 24.7–27.8, y 42.9–45.8) sit 0.7 ft inside the 2.5 ft dressing arches (y 44.75–47.25). Each covers 1 ft of the opening.
- The `f_bath2_shower` (x 3.8–6.8, y 24.7–27.2) is 1.7 ft behind the Bath 2 door (x 2.25–4.75). It covers 1 ft of the door and sits inside the door's swing in a 5 ft deep bath.
- Repro: Parents' Bedroom, stand at (20.8, 46) facing east.
- Expected: a clear 3 ft path through every opening, plus door-swing clearance.

### Minor

**7. The room navigator popover overlaps the minimap at 1180 px (and at 1366 px)**
- At 1180×760, with the navigator open (M) and the minimap awake:
  - the popover spans x 713–1013, y 152–592;
  - the minimap spans x 996–1164, y 80–364.
- The popover covers the minimap's lower-left corner and its floor caption.
- At 1366 the overlap is about 17 px, at x 1182–1199.
- Screenshot: `villa-1180-navigator-over-minimap.png`.
- Expected: DESIGN says the HUD zones "never overlap". Hide the minimap while the navigator is open, or anchor the popover clear of it.

**8. Typing to filter after opening the navigator only works if nothing else had focus**
- If focus is on a HUD button (after clicking a floor button, or when you open the navigator by clicking the room pill), the search field is not focused.
- Typed letters are swallowed: "bed" filtered nothing and the walker did not move.
- Pressing M with focus on the canvas does focus the search.
- Expected: opening the navigator should always focus its search on desktop.

**9. The centre "Click / Drag to look around" prompt never goes away; idle-hiding does the reverse of the spec**
- If you navigate only with keys, glides and the navigator, the centre pill stays over the crosshair for the whole walk.
- After 2.5 s idle, the minimap fades. These all stay:
  - the notes chip;
  - Orbit/Walk, View and the version switcher;
  - the hint chip;
  - the Ask bar;
  - the Revise CTA.
- DESIGN says the coachmark "fades after 4s" and that "after 2.5s idle, only the crosshair and the room pill remain".

**10. Edge-hover look keeps spinning while the cursor rests near the floor rail and bottom-left controls**
- When pointer lock is refused, resting the cursor in the left or right 90 px band turns the view at about 65°/s after a 260 ms dwell. It keeps turning until the mouse moves away.
- I measured more than 600° of spin while the cursor sat at (17, 240) CSS px, in the gap beside the floor rail.
- The band includes the gaps between the floor rail, the notes chip and Orbit/Walk.

**11. Phone: while the house is building, the floor rail covers the left of the "Assembling your home" card**
- At 375×812 during the build, the floor rail (x 12–56) sits on top of the card.
- The card reads "ssembling your home", "hting", "of 24 layers".
- Screenshot: `phone-build-card-under-floor-rail.jpg`.

**12. WebGL warning spam continues**
- `GL_INVALID_OPERATION: glDrawElements: Mismatch between texture format and sampler type` repeats until Chrome stops reporting: "WebGL: too many errors, no more errors will be reported".
- More than 500 console warnings in one session. This was carried over from the 16 Oct audit.

### Polish

**13. The Cars toggle reads ON in walk while cars are hidden**
- In "auto" mode the switch shows `aria-checked=true`, but in walk the car is at opacity 0.
- The first click sets "hide" (no visible change) and the second sets "show".

**14. Room pill and URL go stale on the roof**
- On the roof the room pill reads "Rooms" instead of "Roof".
- `?floor=` is not updated by keys, glides or the stairs. It said `floor=first` while I stood on the roof, and orbit then opened with the first-floor cut-away.

**15. Bedroom TVs are wedged between two openings with almost no clearance (10 marla)**
- Parents' Bedroom: the TV unit (y 48–52.2) sits between the dressing arch (ends at y 47.25) and the bath door (starts at y 52.25), 0.05 ft from the bath door frame.
- The Master Bedroom is the same: 0.05 ft from the bath door, 0.65 ft from the dressing arch.
- These are not in a doorway, but the TV touches the frames. Screenshot: `marla-master-tv-between-two-openings.jpg`.

**16. Villa Bedroom 3 nightstands are misplaced**
- Both side tables sit on the same side of the bed, at x 16.1–17.6, y 14.7–16.4 and y 16.4–18.2.
- A table lamp stands on the floor at (17.1, 25) where the second nightstand should be.

**17. Walk-through furniture**
- Coffee tables and outdoor chairs/tables do not collide:
  - the 10 marla drawing-room coffee table: walked through its middle at x 6.8, y 14 → 19;
  - the villa lounge coffee table;
  - the balcony chairs.
- Meanwhile armchairs are climbable (issue 2), so furniture collision is inconsistent.

**18. Composer label is reversed**
- The composer and chips say "Drawing Room plant floor" and "Move the drawing room plant floor". It should read "floor plant".

**19. The sample ships with 12 as-built notes, including duplicates**
- The 10 marla sample shows 12 notes (furniture left out, "less than 3 ft between some doors").
- "Stair Hall: the plant floor was left out…" appears twice, with no floor named.
- A showcase sample should be clean.

**20. The ? help card omits M and `[` `]`**
- It lists "Go to a room: Click the map" but not the M room list or the `[` `]` floor keys.

**21. Leaving walk on the villa roof frames the house from over the left neighbour**
- An un-ghosted part of that neighbour, about 33 ft from the camera, shows as a dark blob in the bottom-left corner.
- The ghosted neighbour also covers about a third of the frame. Screenshot: `villa-orbit-after-leaving-walk-on-roof.jpg`.

**22. Phone navigator is a popover, not the spec's full sheet**
- On the phone it is a 300 px popover over the floor rail. DESIGN calls for a "full-sheet room list".

**23. At a 280 px wide window (non-touch), the bottom HUD rows collide**
- The pane's own narrow width reproduced it:
  - Orbit/Walk sits under the Rooms pill;
  - View sits under Comment;
  - the Rooms pill starts at x −8.
- This width is narrower than any phone. At 320 px and 375 px with touch, the layout is clean.

## Not tested

- **Real pointer lock** ("mouse look like a game"): the embedded pane refuses it. The code requests `requestPointerLock({unadjustedMovement:true})` at 0.0022 rad/px. Check in desktop Chrome.
- **F with zero comments:** both shared projects already held another tester's comment, so I only saw the "Revise with N comments?" dialog.
- **Revise:** I did not click Revise, because the projects are shared.
