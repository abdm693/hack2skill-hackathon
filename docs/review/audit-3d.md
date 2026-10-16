# Naqsha 3D audit: Explore, Walk, Comments, Revise (live app)

Tester: QA / UX audit (customer exploring finished homes)
Date: 16 Oct 2026
Build: live Cloud Run `naqsha-00005-pd8`, https://naqsha-242926648187.us-central1.run.app
Browser: built-in Chromium pane (pointer lock denied, so the drag-to-look fallback was used). Desktop tests ran at 1366×820 and 1180×760. Phone tests ran at 375×812 with touch emulation.

Projects used. Every "Explore a sample home" click clones the sample:
- 10 marla modern (copy `p_b7d11e4bfea7`): v1, then v2 (the sample), then v3 (made by my revise run)
- 1 kanal Spanish villa (copy `p_020fd7521927`): v1

Method: real clicks, real typing and synthetic `KeyboardEvent`s go through the app's own handlers. I read the viewer state from the React fiber (`ViewerController`), because the production build does not expose `window.__viewerDebug`. Raycasts and bounding boxes were used to measure geometry, in plan feet (x across the plot, y away from the road, h height above datum). Every finding below was reproduced in the live app unless it says otherwise.

---

## Summary

The viewer is technically solid: 60 fps walking, smooth stairs, a good render-compare feature and a well-structured revise loop. **Both showcase homes still ship the user's most serious complaints:**

1. You can walk off the first-floor slab into the stairwell in **both** samples.
2. In the 1 kanal villa, bedrooms open into other bedrooms.
3. In the 1 kanal villa, the roof door hangs about 5 ft above the stair landing, at the opposite end from where the stair arrives.
4. In the 10 marla home, the TV sits inside the main entrance doorway.

The ground, first and roof floor toggles do not move you while walking. Neighbouring houses hide the house from the side views. The revise run marked all 3 of my comments "Resolved", but two of the fixes added new defects:
- The sofa now jams the main door.
- The TV now sits in front of a window.

A third fix was only partial: the railing still has a gap you can fall through.

Severity counts: **5 blocker, 17 major, 16 minor, 6 polish.**

---

## Blockers

### B1. No guard rail on the stairwell edge: you can walk off the first floor into the stairwell (both samples)
- **10 marla (v2):** walk to the Family Lounge (12, 36), face west and hold W. At about x 8 the walker drops from h 12.5 to h 9.2 and lands on the stair flight. Rays at knee and waist height along y 33.5 to 40.5 reach the far party wall (x 0.4) and hit no railing.
- **1 kanal villa:** in the first-floor stair hall (10.5, 52), face north and hold W. You fall from h 12.5 to h 8.4 into the stairwell.
- **v3 after revise (my comment asked for this):** a railing now covers y ≥ about 36.5, but you **still fall at y 33.4, 34 and 35.5** (h 12.5 to between 8.7 and 10.2). The revise summary claims railings "along the full open edge".
- **Probable root cause** (`web/src/engine/structure/stairs-geo.ts`):
  - Lines 116–131: the hole-railing loop **skips the whole edge run** when any point on it is within 2.6 ft of the arrival (`if (Math.hypot(...) < 2.6) continue;`). It should trim only the stretch at the arrival. For a dogleg, the long edge next to the lounge always passes near the arrival, so the whole side is dropped.
  - Lines 135–138: the stair group sets `collide = false`, and only `railing:glass` meshes are registered with `ctx.collider`. **Metal-bar and solid balustrades therefore have no collision at all**, so you walk through the villa's wrought-iron railings.
- **Fix:**
  - Trim the railing run around the arrival opening (keep about 3 ft clear), do not drop it.
  - Register every railing type with the collider.
  - Add a plan or engine check that every slab edge next to a void more than 1.5 ft deep gets a ≥ 3 ft guard.
  - Add a walk-mode safety net that stops the walker at slab edges with no guard, and log it as an as-built defect.

### B2. Bedrooms open into other bedrooms; a "terrace" door opens into a bedroom (1 kanal villa)
- From the plan JSON:
  - `f_bed4_d: f_bed4 <-> f_bed3` and `f_bed5_d: f_bed5 <-> f_bed3`. **Bedrooms 4 and 5 can only be reached through Bedroom 3.**
  - `f_bed3_w: f_bed3 <-> r_terrace` is a 5 ft sliding door at (22, 64) from a first-floor bedroom to a **roof-level** terrace. On the first floor that wall belongs to Bedroom 5, so in 3D it is a glass door from Bedroom 3 into Bedroom 5.
- Walk: stand in Bedroom 3 and you see a door into Bedroom 4 and a glass slider into Bedroom 5, both with beds behind them. This matches the user's screenshot 3 exactly.
- **Fix:**
  - Make it a hard rule in the LDA/fix loop, not a soft prompt: a bedroom door may only connect to a corridor, lobby, lounge, stair hall or balcony, or to its own en-suite.
  - Reject openings whose two rooms are on different levels.
  - Add a graph check: every bedroom must be reachable from the main door without passing through another bedroom or the drawing room.

### B3. Roof door hangs about 5 ft above the stair landing; the stair arrives at the opposite end (1 kanal villa)
- The mumty door is at x 15 (`door_side: right`, sill at h 23.5). The first-to-roof stair finishes at **x 3.8**, at the other end of the 15 ft mumty. The half-landing (h 18.0–18.3) sits directly under the door.
- Walk: from the roof terrace (18, 59), step west through the mumty door. At x 12.1 the walker **drops 5.2 ft** to the landing, then has to climb the last flight to reach a dead-end floor at x 2.3. Looking back from there reproduces the user's screenshot 5: a door hanging in the far wall above the stairwell.
- The 10 marla home works only by chance: its flight happens to arrive beside its door.
- **Fix:**
  - Derive the mumty door position from the stair layout (`lay.arrival` on the roof level) instead of `door_side`.
  - Or add a floor bridge or landing from the arrival to the door.
  - Validate in the plan check that the door sill touches a walkable surface at the same level.

### B4. TV mounted inside the main entrance doorway (10 marla v2 sample)
- The main door is 4 ft wide at x 18–22 on the lounge front wall (y 26). Raycasts at TV height (h 5.3) hit the TV screen across **x 20–24 at y 26.5**, so 2 ft of the screen sits inside the door opening.
- The "TV Lounge feature wall" cladding runs the full wall (x 8–29.6, h 1.5–11.4) across both doorways.
- From the porch you see a black panel filling the doorway. This matches the user's "TV in doorway" report.
- **Fix:**
  - Give furniture and media-wall placement a no-go zone in front of every opening (door width + 1.5 ft each side × 3 ft deep).
  - Run an as-built check that flags any furniture box intersecting an opening's clearance box.
  - Never let accent walls span openings.

### B5. The parked SUV blocks the main door; the walk starts outside and you cannot go in the front (10 marla)
- The SUV box spans x 19.2–25.8, **y 9.9–26.1**: it is parked flush against the house front and covers 2.8 ft of the 4 ft main door.
- The walk spawns in the porch facing the door, and the car fills the right half of the view. Holding W stops at (18.7, 25). With the open door leaf on one side and the car on the other, the gap is about 1.2 ft. The only way in is to find the drawing-room double door.
- **Fix:**
  - Park cars with ≥ 3 ft clear of any door and ≥ 2 ft from walls.
  - Spawn the walk on the lawn or driveway on the far side of the car.
  - Fade or hide cars inside the walker's view cone, as the user suggested.

---

## Major

### M1. Neighbouring houses hide the house in orbit
- Side views (azimuth ±90°, any height) show only the neighbour's roof and water tank. In one view the camera sits on top of the neighbour's roof.
- In the front three-quarter low view (az 45°, polar 1.45) the right neighbour fills half the frame.
- From the top, the neighbours are taller than the cut-away levels and cover the plan edges.
- The only workaround is the "Landscape" layer toggle. It hides the neighbours but also removes the lawn, trees and road, and nothing tells the user it hides neighbours.
- **Fix:**
  - Fade neighbours to about 15% opacity, or cut them away whenever they sit between the camera and the house's bounding box.
  - Add a separate "Neighbours" toggle.
  - Stop the camera from entering neighbour volumes.

### M2. Floor toggles in walk mode do not move you; they hide floors and leave you floating
- In walk mode on the roof, clicking **Ground** hides every level above ground. The walker stays at h 23.5, walks on an invisible roof and sees the neighbour's parapet.
- The number keys **do** work (1, 2 and 3 move the walker to each floor's stair hall).
- **Fix:** in walk mode, make Ground/First/Roof call `gotoLevel()`, the same as the number keys, and keep every level visible. Optionally relabel them "Go to: Ground / First / Roof".

### M3. Before/After and the version switcher rebuild the house and reset the camera
- Switching Before/After takes about 6 s to rebuild. The camera returns to the hero view: I tested az 0.2 / polar 1.3 / dist 22, and it reset to 0.52 / 1.03 / 30.
- The user cannot compare the same spot (for example "is the window bigger?").
- **Fix:**
  - Keep the camera pose across version swaps.
  - Keep both builds cached for an instant swap, or offer a split or wipe slider like the render dialog's.

### M4. The sample's built-in comments have fake anchors: pins float on the lawn or street, and fly-to lands inside walls
- The v1 comments of the 10 marla sample have hand-written anchors: `[3,5,4]`, `[2,0.5,5]` and `[7,1,3]`.
- All three share the same camera, `position [5,6,-8]`, `target [5,5,3]`.
- Pin 1 ("master bedroom window") sits on the front lawn. Pin 2 ("drawing room sofa") sits on the footpath. "Fly to" on comment 1 puts the camera inside the house, looking at an AC unit and stair glass.
- The thumbnails are empty grey squares (`snapshot_url: null`).
- This is the first "story" a judge sees.
- **Fix:** regenerate the seed comments from real picks: run `placeComment` in a script and store the anchor, camera and snapshot.

### M5. Revise takes 7–8 minutes with long silent gaps; quota retries are not shown
- 3 comments took about 7–8 minutes in total. The activity log stopped at 1:13 and showed nothing new until after 4:57.
- Cloud Run logs show `429 RESOURCE_EXHAUSTED ... Retrying in 32.9 seconds` from the Gemini client during that window.
- The UI says nothing while it waits. The elapsed timer keeps running and the run looks hung.
- **Fix:**
  - Emit a "Waiting for model capacity, retrying in 30 s" event from the retry hook.
  - Show which comment is being worked on (1 of 3).
  - Consider resolving comments in parallel.

### M6. Revise reports "Resolved" but adds new defects
On my v3:
- **Sofa jams the main door.** The L-sofa moved to x 15.5–20.5, y 28–35.6, which is 2 ft from the door wall and overlaps the door span. The open door leaf (x 18.2–18.9, y 26.9–29.4) **cuts into the sofa**, which you can see in walk. The resolution text says "leaving the main entrance doorway completely clear".
- **TV in front of a window.** The TV moved to the right-hand wall at x 29.5, y about 31–33. That is exactly where the lounge window is (`g_lounge_w1` at (30, 31), 6 ft wide, so y 28–34). The new feature wall (x 29.5, y 26.4–36) also covers the window.
- **Railing gap.** Only part of the railing was added; see B1.

The car still blocks the main door (B5). Revise does not re-check geometry against its own claims.

**Fix:** after the engine rebuild, run as-built checks (furniture versus openings, door swing, window obstruction, unguarded edges) and feed failures back into the agent loop before marking a comment resolved. Show "Partly resolved" when a check fails.

### M7. Furniture blocks doorways and circulation
- **1 kanal, Bedroom 3:**
  - The queen bed starts 4 ft inside the door (y 54.2).
  - A wardrobe or side unit stands at x 19.5, y 52.
  - The walker is boxed into a pocket of about 2×4 ft inside the door and **cannot get into the room**.
- **1 kanal, drawing room:**
  - Sofas sit right in front of the double door to the stair hall (x 1–3 and x 7–11 at y about 33).
  - Only a 3 ft gap is left, off to one side of the door.
- **10 marla, first floor:**
  - A tall freestanding "Family Lounge bookshelf" stands on the open passage-to-lounge threshold (x 10–14, y 31.2), placed against a wall that does not exist.
- **Fix:**
  - Enforce a 3 ft clear path from every door into the room's centre.
  - Never place "against-wall" furniture on open plan boundaries.

### M8. 1 kanal circulation: the family must walk through the formal drawing room to reach the stairs, lounge and bedrooms
- The lobby connects only to the porch, the drawing room and the outside.
- The stair hall is reached only through the drawing room's double door. The stair hall is open to the lounge.
- In Pakistani homes the drawing room is the guests' room, so this layout is unacceptable.
- **Fix:** add a reachability rule (the main door reaches the lounge and stairs without passing through the drawing room or any bedroom).

### M9. The showcase villa fails its own LDA rule, and the note is hard to find
- The pill says "1 as-built note". Its only content is a `title` tooltip: "The tile roof projects 3.6 ft into the front open space (LDA allows 3 ft for sunshades there)."
- The pill's container is `pointer-events-none`, so the tooltip may never show, and the pill does not respond to a click.
- A showcase home should pass its own rules.
- **Fix:** fix the sample. Make as-built notes a clickable popover with "Fly there" and "Ask Argon to fix".

### M10. 10 marla sample: "Master Bath" is not attached to the master bedroom
- `f_master_bath` opens onto the Upper Passage (`f_master_bath_door: f_master_bath <-> f_corr`), not into the master bedroom.
- My revise comment fixed this in v3 (door at (15, 22.5) into the master), which was a good fix. The sample still ships without it.
- **Fix:** make "master bedroom has an en-suite" a plan-check rule.

### M11. The F key starts a multi-minute revise instantly, with no confirmation
- F (next to D for strafe) calls `finish()`. With at least one open comment, that immediately starts `runRevise` and navigates away (`ExploreStep.tsx` lines 218–229).
- With no comments, F still drops you out of walk mode.
- **Fix:** require a confirm sheet ("Send 3 comments to Argon?"), or a long-press. Do not exit walk mode when there are no comments.

### M12. HUD elements overlap (desktop and phone)
- **At 1180 px wide:** the key-hint bar (x 313–867) and "Finish walkthrough" (x 818–1156) overlap by about 50 px on the same row. This matches the user's screenshots 1–3.
- **On the phone (375):** "Finish walkthrough (0 comments)", the "As built" pill and the touch "Finish" button stack on top of each other above the dock.
- During walk the dock (Render plus layer toggles) and the "As built" pill take space they don't need.
- **Fix:**
  - Use one bottom bar in walk mode (hints | comment | finish), and hide the hints after 5 s.
  - Hide the layer dock while walking.
  - Respect safe areas on the phone.

### M13. The minimap cannot be used to navigate; there is no room-to-room travel
- The minimap is `aria-hidden` with no click handling and no room labels.
- On the roof it is an empty outline: the mumty and tank are not drawn.
- There is no room list or "go to room", which the user asked for.
- **Fix:**
  - Clicking a room on the minimap should fly the walker there along the navigation graph.
  - Add a "Rooms" list.
  - Draw the mumty, tank and stair on every level.

### M14. Floor jumps put you in awkward spots
- **Key 3 (roof):** you land at (11, 33) facing straight into the mumty wall.
- **Key 1:** you land under the stair (4.8, 33) facing a blank wall.
- **Key 2 in the 10 marla home:** you land at (7.3, 35), at the edge of the stairwell.
- **Fix:** spawn at the stair arrival facing into the floor, or at the centre of the largest room facing its longest view.

### M15. You cannot print or export the plan as a PDF
- There is no print, PDF or export control on the plan, design or revisions pages; the page text contains no "print", "pdf", "download" or "export".
- The user asked for this specifically.
- **Fix:** add "Download plans (PDF)": one A3 sheet per floor with dimensions, the LDA summary and the version stamp, plus print CSS.

### M16. Each "Explore a sample home" click creates another copy with the same name
- The workspace now holds 2× "Sample · 10 marla modern home, Johar Town" and 2× "Sample · 1 kanal Spanish villa", with nothing to tell them apart.
- **Fix:**
  - Reopen the user's existing copy, or offer "Open your copy / Start fresh".
  - Name copies "My copy of …" with a date.

### M17. The 10 marla roof-stair landing has no headroom
- The mid-landing of the first-to-roof stair is at h 18.3. The roof slab edge sits at eye level, around 23 ft. The walker hits the slab at x 6.6 with about 4.7 ft of clearance under it.
- The crosshair reads "Slab edge (Roof)" at eye height.
- **Fix:** extend the mumty footprint, or the slab cut-out, over the whole first-to-roof stair, including the landing.

---

## Minor

1. **Mouse look:** pointer lock is refused in the embedded pane. The fallback works and says so ("Pointer lock unavailable here: drag to look around"). A 512-CSS-px drag turned only about 19° (about 90° expected), but this may be the automation tool's few mousemove events. Please verify in real Chrome. Also consider "hold right mouse to look" for desktop users who dislike pointer lock.
2. **Sun slider stops at 7 pm** and still looks like daylight (the sky stays bright). There is no dusk or night look with interior lights, so there is no 3D equivalent of the day/night concept comparison the user asked for.
3. **Version menu copy:** "v1: v1: 28 spaces, 23 code sections" repeats the version and uses developer language. The menu popover is translucent white over bright sky, which is low contrast.
4. **Revise activity log shows internal ids** (`g_lounge`, `furnish_g_lounge`, "Reading structure…"). "What changed" chips show section names (`interior_first`). Customers should see room names only, and the code view should sit behind a "Show technical details" link.
5. **The composer in orbit mode** says "Argon reads every comment when you finish the walkthrough", but there is no walkthrough in orbit. "Argon" is never explained to customers.
6. **Edit comment** puts the caret at the start of the text, so new text is prepended: "Keep the TV opposite the L-sofa.The TV is…". The caret should go to the end.
7. **Delete comment** happens immediately, with no confirm and no Undo toast.
8. **Picking in orbit anchors to light fixtures:** a click on the stone pier pinned "Wall wash" (a light). Exclude light helpers from picking, or prefer structure and facade.
9. **Quick chips insert their literal label** ("Change material"). Insert a sentence with the target's name ("Change the stone pier material to …") and place the cursor where the user types next.
10. **After reconnecting to a running revise,** the heading reads "Revising version" (no number) and the step timestamps are gone.
11. **Plan label bug:** the Powder Room is labelled just "ROOM" on the ground floor SVG.
12. **Leaving walk for orbit** parks the camera about 3 m above the roof, looking down at the water tank, not at a useful overview.
13. **WebGL console spam:** more than 196 × `GL_INVALID_OPERATION: glDrawElements: Mismatch between texture format and sampler type` warnings per session. Probably a depth or shadow texture bound to a float sampler in post-processing. Some draws may be silently dropped. There were no app JS errors and no failed app requests.
14. **Geometry audit flags (from bounding boxes; not all confirmed by eye):**
    - The 10 marla "Dining Room sideboard" is a 1 × 1.1 × 0.6 ft box floating at h 5.2–5.8 (3.7 ft above the floor).
    - The water dispenser starts 2.6 ft above the floor with nothing under it.
    - The "Laundry washing machine" box is 0.1 ft thick at h 15.0–15.3.
    - The "Front Balcony outdoor chair" is 0.5 ft tall at h 14.4–14.9.
    - The laundry is 4 ft wide but holds a washing machine plus a sink cabinet.
15. **A circular hole in the stair stringer wall** (10 marla, both v2 and v3) is visible from the first-floor landing.
16. **Accessibility:**
    - Orbit/Walk and the level chips have no `aria-pressed`.
    - The render dialog has no `aria-modal`, and focus stays on `<body>`.
    - The accessibility tree exposes several toolbar buttons (version, Before/After, comment, render) without names.
    - On the phone, the sun and section sliders sit off-screen in a horizontally scrolling dock (x 591 and 782 at a 375 px width).

## Polish

1. **The hero view is dominated by neighbours and power lines.** Utility wires cross the façade in every front view. The AI render gives the neighbours warm, lit windows, so they draw more attention than the client's house.
2. **The level chips' "Roof" and "All" look identical** in orbit when the roof has no rooms.
3. **The walk intro card** covers the main door at spawn. Fine, but the porch car fills the rest of the frame.
4. **"Before (v1) / After (v2)"** sits next to a "Version 2" dropdown, so two version controls compete. Merge them into one "Compare" control.
5. **The landing page at 280 px** overflows horizontally (scrollWidth 488). It is fine at 375.
6. **The as-built pill, hint bar and Finish CTA** all use different glass styles. Use one bar.

---

## What works well

- **Render this view** took about 45 s. The result is truly photoreal and keeps the geometry. The split before/after slider and Download are excellent; this is a demo highlight.
- **Revise loop structure:**
  - Each comment gets a plain-language resolution and a status.
  - "What changed" groups the edits by type (Code / Plan).
  - Changed rooms get dashed outlines on the plan.
  - "LDA re-check: all 42 rules pass" builds trust.
  - The run is detached, so leaving the page and coming back reconnects ("Reconnected", with the full log replayed).
  - The master-bath change was architecturally correct: the door is now inside the bedroom and Bedroom 2 keeps its balcony.
  - It is good at refusing requests it should refuse: the sample's "extend porch 4 ft" was rejected with a clear LDA reason and alternatives.
- **Walking feels good:**
  - About 60 fps while moving (quality auto-dropped to "performance", DPR 1; worst frame 19 ms).
  - Stairs climb smoothly with no bumps.
  - Number keys jump between floors.
  - The "You are in" label is accurate on every floor.
  - The minimap marker shows position and heading.
  - The fly-in from orbit into walk is nicely eased.
- **Comments:**
  - C pins at the crosshair with a snapshot thumbnail.
  - Typing in the composer never moves the walker.
  - Quick chips, the list panel, fly-to, edit and delete all work and save immediately.
  - The Finish CTA counts comments.
- **Orbit tools:**
  - The section cut also slices the neighbours, which incidentally shows the house unobstructed.
  - All six layer toggles work.
  - The sun slider moves the shadows.
  - The level chips give clean dollhouse cut-aways.
- **The samples open in one click** into a private copy, so a customer can revise without breaking the showcase.

---

## Appendix A: Plan audit (as shipped)

| Rule | 10 marla v2 | 1 kanal v1 |
|---|---|---|
| Bedroom opens only to a corridor, lounge, balcony or its own bath | Pass | **Fail**: Bed4→Bed3, Bed5→Bed3, Bed3 "terrace" slider into Bed5 |
| Master bedroom has an en-suite | **Fail**: Master Bath opens onto the passage | Pass |
| Bath opens only to its owner or a corridor | Pass (powder room opens onto the dining room) | Pass |
| Stairs reachable without passing through the drawing room | Pass (stair hall open to the lounge) | **Fail**: only via the drawing room |
| Roof door adjacent to the stair arrival | Pass | **Fail**: door at x 15, arrival at x 3.8, 5.2 ft drop |
| Stairwell edges guarded (walk test) | **Fail** | **Fail** (metal railings do not collide) |
| Furniture clear of openings | **Fail**: TV in the main door; SUV against the main door | **Fail**: Bed3 entry blocked; sofas in front of the stair-hall doors |
| LDA as-built | Pass | **Fail**: tile roof projects 3.6 ft (3 ft allowed) |

## Appendix B: Revise run (10 marla, my copy)

- Comments:
  1. TV in the doorway (walk, C key).
  2. Missing stairwell railing (walk, C key).
  3. Master bedroom has no attached bath (orbit pin).
- Time: Finish clicked at 18:20:17 UTC; v3 ready about 7–8 min later. The 429 retries were the main delay.
- Result: 3/3 marked "Resolved". In 3D, #3 is truly fixed, #2 is partly fixed (falls still possible at y 33–36), and #1 moved the TV but created two new defects (sofa jams the main door; TV covers the lounge window).

## Appendix C: Performance and console

- Walk: 60 fps average, worst frame 19 ms (1366×755 canvas, DPR 1, tier "performance" chosen automatically).
- First explore load of a sample is about 20 s (clone plus progressive build of 23–25 sections). A version swap takes about 6 s.
- Console: no JS errors from the app. More than 196 WebGL `GL_INVALID_OPERATION` sampler-mismatch warnings.
