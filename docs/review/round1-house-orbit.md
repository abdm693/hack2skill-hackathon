# Round 1: House orbit review (live app)

- **Tester:** QA agent, House orbit focus
- **Date:** 17 Oct 2026
- **Build:** https://naqsha-242926648187.us-central1.run.app (live Cloud Run)
- **Browser:** built-in Chromium pane, one tab of my own.
- **Viewports:**
  - desktop 1366×820, plus the short-laptop case 1366×657;
  - phone 375×812, 375×667 and 320×640 with touch emulation.
- **Projects** (fresh clones made through Samples → "Explore the sample"):
  - 10 marla modern: `p_8d8010bb3391` (v1 and v2);
  - 1 kanal Spanish villa: `p_4e01a962c3ae` (v1 and v2).

  I left one test comment on my 10 marla clone ("QA orbit test: could the jaali be a lighter stone colour?").
- **Method:**
  - Real clicks, keys, drags and wheel events in the pane.
  - The camera was driven through the React fiber's `ViewerController` (`controls.rotateTo / dollyTo`). The prod build has no `__viewerDebug`.
  - Occlusion was measured with raycasts and a CPU copy of the ghost shader's `nqGhostAt` test. Each finding was then checked visually on screenshots.
  - Evidence images are in `docs/review/round1-house-orbit/`.

## Summary

The orbit view is in good shape:
- Neighbour ghosting works. In 360 sampled views on the two samples (12 azimuths × 5 tilts × 3 distances), no neighbour ever covered the house with solid pixels.
- The floor stack, its second tap to show all, the layers, the section cut, Day/Dusk/Night (with warm window glow) and the comment pins all work.
- The version switcher keeps the camera and the floor.
- "Render this view" returns a photoreal render, true to the geometry, in about 20–27 s.

**What's left is mostly about what the neighbours do to the picture, and about HUD popovers that run off-screen:**

1. **View popover off-screen (major).** On a common laptop viewport (1366×768 screen, about 657 px tall) and on an iPhone SE or iPhone 8 (375×667), the **View popover runs off the bottom of the screen**. Layers, the section cut and "Render this view" can't be reached.
2. **As-built notes list off-screen (major).** The **as-built notes list (12 notes on the 10 marla) also runs off-screen**: only 2 of the 12 are visible, and the list does not scroll.
3. **Street views inside the house opposite (major).** **Low street views put the camera inside the houses across the road.** Each sample shows it differently:
   - **Villa** (az 0, tilt 1.45, distance 40): an opaque dark glass panel from the house opposite covers the road and part of the gate.
   - **10 marla** (default distance): a dark band crosses the bottom of the frame.
   - **Both**, at a slightly lower tilt (1.3) and default distance: the whole ground floor is seen through a milky veil.
4. **Side views washed out (major).** **At default distance, side views wash the house out.** The camera sits just above or beside the end neighbour, and stacked 15% ghost layers turn the house into a faint outline. At low tilt it is instead seen through a rectangular hole in a beige wall that fills 60% of the frame.
5. **Notes contradict "8/8 livable" (major).** **The as-built notes contradict the "8/8 livable" badge.** Four rooms are reported with under 3 ft between doors, and key furniture was dropped: the villa kitchen has no fridge, and the dressing room has no wardrobe.

Several smaller issues follow: the status line says v2 while you are viewing v1, the hint offers C on an old version where C is disabled, and the Day/Night control jumps.

---

## Issues

### Major

#### M1. The View popover opens off-screen on short viewports (laptops 1366×768 and phones 375×667)
- **Repro:**
  1. Open a sample's House view.
  2. Set the viewport to 1366×657 (a 1366×768 laptop after browser chrome).
  3. Click **View**.
- **Measured:**
  - The View anchor's top is at 497 px and the panel is 546 px tall.
  - `Popover.place()` (`web/src/app/design/kit.tsx`, around line 418) computes `top = a.top - h - 8 < 8` and flips the panel *below* the anchor without checking that it fits there. The panel ends up spanning y 549–1095 in a 657 px viewport.
  - Only Day/Dusk/Night and the Sun slider show. Every layer toggle, the section cut and **Render this view** are off-screen, and there is no scroll (`01-view-popover-offscreen-1366x657.jpg`).
- **Same on phone:**
  - At 375×667 (iPhone SE/8) the panel spans y 559–1157 (`02-…375x667.jpg`).
  - On desktop the panel needs at least about 722 px of viewport height, or about 758 px with the section cut on.
- **Expected:**
  - Clamp the panel to `[8, vh − h − 8]`.
  - Give it `max-height: calc(100dvh − 16px)` with `overflow-y: auto`.
  - Or, on phones, render it as the bottom sheet DESIGN.md asks for.

#### M2. The as-built notes popover runs off the bottom and can't be scrolled
- **Repro:**
  1. Open the 10 marla sample's House view at 1366×820.
  2. Click **12 notes on the 3D model**.
- **Measured:**
  - The pill sits at y 635 and the list is 650 px tall.
  - The same Popover flip puts the panel at `top: 660px`, so it spans y 668–1318 in an 820 px viewport.
  - Only 2 of the 12 notes are fully visible. The panel covers Orbit/Walk/View/Versions and there's no scroll (`03-asbuilt-notes-offscreen.jpg`).
  - On a 375×812 phone about 4 of the 12 are visible.
- **Expected:**
  - Use the same clamp, max-height and scroll as M1.
  - Each note would be far more useful with "Show me" (fly to the room) and "Ask Naqsha to fix".

#### M3. Street-side views put the camera inside the houses across the road (both samples)
- **Cause:** nothing keeps the orbit camera out of context volumes. The row across the road spans z 19.3–33.3 m.
- **Repro, villa** (`p_4e01a962c3ae`):
  - **Front, low:** rotate to the front (az 0), tilt to eye level (polar 1.45) and zoom to 40 m. The camera is at (7.6, 8.0, 27.6), inside the house opposite (`04-villa-front-camera-inside-opposite-house.jpg`):
    - beige walls 7–8 m away fill both sides of the frame;
    - an **opaque dark "neighbour_glass" panel** covers the road and the right end of the villa's front boundary wall and gate;
    - the ghost test gives that panel `nqGhost` of only 0.25–0.75, because its rays only graze the house box.
  - **Front, default distance:** az 0, polar 1.3, distance 39.7 (the default hero distance, just rotated to face front). The camera sits 2.7 m above the opposite roof. That roof fills the lower 40% of the frame, and the whole **ground floor, gate and entrance are seen through a milky white veil** (`06-villa-front-ground-floor-washed-out.jpg`).
- **Repro, 10 marla** (`p_8d8010bb3391`): az 0, polar 1.45, default distance 30.2. The camera is at z 21.3, inside the house opposite. A dark navy band crosses the bottom third of the frame, and a translucent slab band crosses the top (`05-10marla-front-camera-inside-opposite-house.jpg`).
- **Expected:**
  - Neighbours never get in the way of the street view, the most important angle.
  - Clamp or push the camera out of context volumes, or hide whole context buildings that contain the camera or sit within a few metres of it.
  - Ghost every context fragment between the camera and the house's grown box, not just those whose ray chord through the box is longer than 0.35 m.

#### M4. Side views at default distance show the house through a stack of ghost layers or a hole in a wall
- **Repro, 10 marla:**
  - **Moderate tilt:** az +90°, polar 1.3, distance 30.2 (default). The camera at (34.4, 11.2, −8.7) is 0.4 m above the end neighbour's roof. That roof fills the bottom half of the frame, and the whole east side of the house is a faint outline behind several 15%-clay layers. A neighbour's water tank shows translucent in front of the middle of the house (`07-10marla-side-milky-veil.jpg`).
  - **Low tilt:** az ±90°, polar 1.45, distance 30. The camera is 3.2–4 m from the blank side wall of the last house in the row. About 60% of the frame is plaster wall, with the house showing through a rectangular cut-out (`08-10marla-side-hole-in-wall.jpg`).
- **Repro, villa:** az −90°, polar 1.3, distance 39.7 gives the same frosted look.
- **Expected:**
  - The house is readable from every side.
  - Cap the stacked ghost opacity, for example by drawing each context building's ghost only once.
  - Fade context to near zero within a few metres of the camera.
  - Or keep the orbit radius outside the neighbour row at low tilts.

#### M5. As-built notes contradict the "8/8 livable" status, and the samples ship with essential furniture missing
- **What you see:** the title capsule and the Versions list say "36/36 LDA · 8/8 livable" (10 marla) and "44/44 LDA · 8/8 livable" (villa). The as-built notes on the same versions say:
  - **10 marla:**
    - "Dirty Kitchen: furniture leaves less than 3 ft between some doors or the stair."
    - The same message for **Parents' Bedroom** and **Master Bedroom**.
    - The TV Lounge coffee table, the Open Kitchen water dispenser, the master armchair and the dresser in the dressing room were left out.
  - **Villa:**
    - "Bedroom 3: furniture leaves less than 3 ft between some doors or the stair."
    - "Kitchen: the fridge was left out…"
    - "Master Dressing: the wardrobe was left out…"
    - "…so the car in Car Porch was left out." A car is still parked in the porch, so presumably this means a second car.
- **Why it matters:** the user asked specifically for walking space, and the badge claims it is met while the model says it isn't.
- **Expected:** either the livable count reflects the as-built clearance failures ("7/8 livable · 4 tight spots"), or the engine fixes them. A kitchen without a fridge, or a dressing room without a wardrobe, should be fixed in the sample or flagged as a defect, not as a quiet note.

### Minor

#### m1. The status line shows the latest version's number and checks while you view an older version
- **Repro:** House, then **v2 ▾**, then "v1 First design". The version button reads "v1 · not the latest", but the title capsule still reads "**v2** · 36/36 LDA · 8/8 livable" (villa: "v2 · 44/44 LDA · 8/8 livable").
- **Cause:** `useStatusLine` (`web/src/app/shell/TitleCapsule.tsx`, line 18 onward) always uses `project.current_version_id`.
- **Expected:** the status line shows the version on screen and its own counts.

#### m2. On an older version, the hint still says "press C to pin a note", but C and Comment are disabled
- **Repro:** switch to v1. The dock hint reads "Look around, then press C to pin a note anywhere." (`web/src/app/shell/ProjectShell.tsx:201`).
  - The Comment button is gone and **C does nothing**: `HouseView` gates it with `isLatest`.
- **Expected:** "This is an earlier version. Switch to the latest to pin notes."

#### m3. Leaving House and coming back rebuilds the house (about 7 s) and resets the camera and light
- **Repro:**
  1. In House, set az 0.9, polar 1.2, distance 22, and Night.
  2. Click **Plan**, then **House**. "See what changed" goes to `/revisions` and back the same way.
- **Measured:**
  - The viewer remounts and spends **7.1 s** on "Assembling your home".
  - The camera is back at the hero (0.52 / 1.03 / 30.23).
  - `?light=night` is dropped.
- **Contrast:** inside House, the version switcher keeps the pose (verified).
- **Expected:** keep the built scene, or at least the camera pose and light, across view switches.

#### m4. The Day/Dusk/Night control jumps about 60 px when you change it
- **Cause:** the View popover is anchored at its bottom (side "top"), and the Sun row appears or disappears with Day vs Dusk/Night.
- **Measured:** the segmented control's top moves between 181 px (Night) and 121 px (Day), so a second click in the same place misses or closes the popover.
- **Expected:** keep the segmented control fixed. Keep the Sun row (disabled at Dusk/Night) or anchor the panel's top.

#### m5. As-built note copy reads like engine ids and is ambiguous
- "the plant floor was left out" appears 4 times on the 10 marla. It is `plant_floor`, which should read "a floor plant" or "a potted plant".
- "Stair Hall: the plant floor was left out…" is listed twice with no floor name to tell them apart.
- "the car in Car Porch was left out" while a car is visible (see M5).

#### m6. On phones, the floor stack collides with the as-built pill
- **320×640:** the stack ends at y 399 and the "12 notes" pill starts at y 386, so the **All** chip (359–395) overlaps the pill by 9 px.
- **375×667:** they touch with no gap (413 vs 413).
- **Expected:** a minimum 8 px gap. Move the pill into the bottom bar on phones.

#### m7. The villa orbits at about 29 fps against about 43–58 fps for the 10 marla on the same machine
- **Measured** with the tab fronted, at high quality and DPR 1.5, during a continuous orbit:
  - **Villa:** 28.9–29.7 fps, p95 50 ms, worst 117–135 ms.
  - **10 marla:** 42.6 fps (57.6 fps earlier in the session), p95 33 ms.
- **Likely cause:** `renderer.info.memory.geometries` is **1090 for the villa against 251 for the 10 marla**, so the villa is far less consolidated.
- **Frame cost (10 marla):** about 31 `render()` passes, 357 draw calls and 287k triangles per frame.
- **Caveat:** other WebGL tabs were open in the same browser, so absolute fps is pessimistic. The 4× geometry gap is real either way.
- **Also:** the perf monitor never stepped quality down at 29 fps.

### Polish

#### p1. The Sun slider runs only from 7:00 to 17:30
- There is no dawn.
- Dusk and Night are separate presets that hide the slider, so there is no continuous "dawn to night" sweep.
- **Suggestion:** a 5:30–19:30 range, with Dusk and Night as snap points on it.

#### p2. "Render this view" invents neighbour details
In the villa day render, solar panels appear on the right-hand neighbour's roof, which has none in 3D (`12-render-villa-day.jpg`). Ask the model to keep neighbours plain and muted.

#### p3. The View popover covers part of the HUD on desktop
- It covers the as-built pill: "12 notes on the 3D mod…" is clipped behind it.
- With the section cut on at 1366×820, its top edge (62 px) touches the title capsule's bottom (64 px).

#### p4. The section cut has no caps
Cut solids show their open insides. The porch SUV becomes a hollow black box at a 5 ft cut. A light poché fill on the cut plane would read as an architectural section.

---

## Verified OK

- **Neighbour ghosting, 10 marla:**
  - 180 sampled views (azimuth every 30°; polar 1.5, 1.3, 1.0, 0.6 and 0.2; distance 15, 30 and 60 m).
  - Zero views have a solid neighbour pixel over the house. The only hits were paving at ground level, a false positive.
  - Visually confirmed on all 8 compass points, low and high.
- **Neighbour ghosting, villa:** the same 180-view sweep, with zero solid occlusions.
- **Ghost window:** soft-edged, follows the camera, and lowers to the shown floors in the dollhouse.
- **"See through the neighbours" toggle:** off makes neighbours solid (they then hide the porch), and on restores ghosting.
- **Floor stack:**
  - R, 1 and G show the dollhouse.
  - Tapping the active floor again returns to **All**, with the URL `?floor=` cleared and `aria-checked` updated.
  - `[` and `]` step floors.
  - Floor switches are smooth: worst frame 19–33 ms after the first switch.
- **Layers:** Walls and slabs, Facade, Interiors, Furniture (furniture disappears in the ground-floor dollhouse), Garden and street (hides context and road), Cars, and Lights all toggle.
- **Section cut:**
  - The toggle reveals a "Cut at" slider (1–29 ft).
  - At 5 ft the plan reads well with furniture.
  - It also slices the neighbours.
- **Sun:**
  - 7:00 gives long east shadows and 17:30 gives warm west light.
  - Dusk lights the porch.
  - **Night:** a starry sky, dark neighbours (no competing glow), and warm **window glow** from the interiors on both samples (`09-…`, `10-…`).
- **Render this view:**
  - About 20 s (10 marla, night) and about 27 s (villa, day). The output is 1365×768.
  - Photoreal, true to the geometry, and it keeps night mode (`11-…`).
  - The before/after wipe slider works, Esc closes, and Save is an anchor to the render asset.
- **Version switcher:**
  - v2 to v1 to v2 keeps the exact camera pose (0.2 / 1.3 / 22, and 0.4 / 0.9 / 30) **and** the selected floor.
  - The swap is near-instant.
  - "Versions · the camera stays put" is honest.
- **Comment mode in orbit:**
  - C or the Comment button enters it, with the banner "Click anything to pin a note".
  - A click on the jaali auto-tags "Jaali screen, first floor" and shows a snapshot thumbnail and suggestion chips.
  - Clicking through a ghosted neighbour correctly picks the house's own boundary wall.
  - **Pin it** saves pin 1 with the author "Owner · just now". The badge and the "Revise with 1 comment" CTA update.
  - **Look at it** flies to the pin.
  - Esc drops the draft.
  - Pins seen from behind are dimmed.
  - The v1 sample pins sit on the façade, not on the lawn.
- **As-built notes:** present on both samples (12 and 6), with plain-language text. The 6 villa notes fit on screen.
- **Phone, 375×812:** orbit drag works, the hero framing fits, the HUD doesn't overlap, and the View popover fits at this height.
- **Console:** no errors during the whole session. Engine warnings only, such as "no place for it…".
