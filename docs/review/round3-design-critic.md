# Round 3 design critique (live app, 17 Oct 2026, 08:13–08:33 PKT)

**Scope.** I audited every screen of the live Cloud Run app at 1440×900 and 390×844 against `docs/design/DESIGN.md`:

- landing and auth (sign-in page, sign-in dialog, create-account gate)
- workspace: Your homes and Samples
- brief: rooms on each floor, roof dialog
- concepts: Day/Night and the lightbox
- plan: compliance sheet, print dialog, A3 and A4 preview
- house:
  - orbit
  - walk HUD
  - room navigator
  - View popover
  - Night
  - Render this view
  - comment pin flow
- the comments sheet
- the guest share gate
- the client view `/s/VPDXGqFJUG420qlq8YYjTOG-`
- revisions and the command bar

**Method.** I used one tab and stayed a guest. I created no accounts and typed no passwords. I sent no Ask requests and ran no revisions. I made one test comment ("Design review: could the jaali screen be a shade warmer?") on the QA clone `p_0dca02d101d0` and ran one "Render this view".

## Read first: the live site is still the round-2 bundle

- **Live:** `/` and `/app` still serve `assets/index-CoebF8Ij.js` + `index-BsNveUrL.css`. I checked at 08:13, 08:17, 08:28 and 08:33. This is the same hash round 2 audited.
- **Local:** a new build exists in `web/dist` (`index-CTugblQe.js`, built 08:11), but `/assets/index-CTugblQe.js` returns 404 on Cloud Run.
- **Consequence:** almost every round-2 finding still reproduces live. Some are already fixed in source. For example, `viewer/hud/Hud.tsx` now says the look prompt is "the only place that says how to look (no toast as well)", yet live still shows "Drag to look around" twice.
- **For the demo,** deploying is the single highest-leverage action. Everything below was reproduced on the **live** bundle.

## Verdict

**The structure is right:**
- No stage bar; floating capsules; one accent colour; Geist throughout.
- The construction animation now plays on the first fold.
- The room navigator glides through the stair.
- The print dialog is calm.

**It is still not impeccable.** Eight things break the spell:

1. **First impressions.**
   - The landing's "10 marla family home" card opens the Spanish villa.
   - Concept A of the flagship home is a corner plot (the user's own complaint).
   - Every House load shows a ghost card with ids ("Furnishing bed1", "dress1", "corr"), and sometimes a 4–5 s blank sky after it.
2. **The trust surface leaks code and contradicts itself.**
   - The compliance sheet and the printed compliance report both say "g_dirty_kitchen_door is 2′6″ wide".
   - "Approval-ready · passes all" sits beside a 0 sq ft bath vent.
   - "8 notes on the 3D model" sits beside "9/9 livable".
   - The livable list never shows "railings at every drop", which is the user's first complaint.
3. **HUD contrast fails AA everywhere over 3D,** and the HUD focus ring is invisible.
4. **Render this view turns a ghosted neighbour into a translucent glass building** in the photograph.
5. **Phone:**
   - Revisions is 848 px wide.
   - On Plan, the dock sits on the zoom controls.
   - House chrome takes 44% of the screen.
   - Targets are under 44 px.
6. **The client view** lacks the room navigator and floor stack. With Comments open, the dock covers the client's Comment button, and the owner appears as "Owner · Owner".
7. **Print:**
   - A4 clips the cover title block by 200 px.
   - The compliance report prints every livable description twice.
8. **Motion jank:**
   - Segmented thumbs paint over labels and fly between components.
   - The View popover jumps 33 px on Night.
   - The navigator input jumps 174 px while filtering.
   - The rooms dialog re-centres per tab.
   - The room pill flickers through every room on a glide.

## Blocker

| # | Where | Issue | Fix |
|---|---|---|---|
| B1 | Deploy | Live = round-2 bundle `index-CoebF8Ij.js`; local 08:11 build `index-CTugblQe.js` 404s on Cloud Run. None of the round-2 or round-3 fixes can reach the judges. | Deploy now, re-run this checklist against the new hash, and keep the hash in the title of each review file. |

## Major

| # | Where | Issue (evidence) | Fix |
|---|---|---|---|
| M1 | Landing → sample cards | `10 marla family home` card POSTs `/api/projects/p_f14122441822/clone` (= **Sample · 1 kanal Spanish villa**) and lands on the villa. "Corner home" still advertises the corner plot the user complained about. The cards use `/mock/concept-*.jpg`. | Map cards to `/api/samples` ids (`p_c31d6707b355` = 10 marla). Drop "Corner home". Use the samples' real day renders. |
| M2 | Concepts, 10 marla (A · Grooved Travertine) | Day and Night, desktop and phone: a road runs down the left flank with no left neighbour, so this is a corner plot. On phone it is the first and only fully visible card. | Re-roll A with "neighbours on both sides, single road frontage" and promote a mid-row concept to A. |
| M3 | House load (owner and client, desktop and phone) | **Card:** `.nq-build-card` keeps `nq-card-in` at `currentTime 0` and opacity 0 for 8 s+ (sampled every 500 ms), so the user sees a faint grey ghost card. **Step copy is raw ids:** "Furnishing bed1 / dress1 / bath1 / master dress / corr / bed3 / dress3". **Blank sky:** after the card hides, the canvas was empty sky for about 4–5 s before the house appeared. Reproduced twice: desktop owner `p_0dca02d101d0` and phone client `/s/VPDX…`. | Show the card without a CSS entrance, as solid `glass-hud` at about 0.8. Map ids to names ("Furnishing the master bedroom") (local `tags.ts:196` falls back to the id). Keep the card until the first frame of the finished scene has rendered. |
| M4 | All HUD over 3D | `glass-hud` is still `rgba(24,24,27,.58)` and `hud-ink-2` is `#A3A3AD`. **Status line:** "v5 · 36/36 LDA · 9/9 livable" at 11 px gives about **2.3:1** over the sky. **Also failing:** R/1/G, the inactive Brief/Concepts/Plan, Walk, ⌘K caps and the minimap labels. **Focus:** Tab to "Roof" shows no visible ring, because the 20% accent ring is invisible on dark glass. **Tab order:** it starts at the floor stack, not the title capsule. | Raise the glass to .75–.8 and `hud-ink-2` to ≥ #C9C9D1. Use 12 px minimum. Use a HUD focus ring of 2 px `hud-accent` plus a white 1 px inner ring. Order the DOM top-left → top-right → left → bottom. |
| M5 | Plan → compliance sheet **and** printed compliance report | **Internal id leak:** "Door width 2.5 (limit 3) · **g_dirty_kitchen_door** is 2′6″ wide". **Contradictions under "Approval-ready · Passes all 36 LDA checks and 9 livable rules":** "Bath 2 ventilation 0 sq ft opening (2 needed)", "Bath 2 sits over Drawing Room", and "Roof kept clear for solar 63 (limit 55)", which reads as a failure. **Missing livable rows:** the user's railing, door-clearance and 3 ft path complaints (DESIGN §Plan) are not in the list. | Name openings ("The dirty kitchen door"). Count warnings honestly ("36 pass · 2 to review"). Phrase solar as "736 sq ft clear for panels, about 11 kW". Add the railings, doors-clear-of-furniture and 3 ft path rows. |
| M6 | House: "8 notes on the 3D model" | The popover is an engine log: "Car Porch: the plant floor was left out because there is no place for it…" repeated. It also says "Parents' Bedroom: furniture leaves less than 3 ft between some doors or the stair", next to "9/9 livable". It covers the floor stack. | Hide furnishing omissions. Fold real clearance problems into compliance. Otherwise move it to Details. |
| M7 | Render this view | The photoreal result renders the ghosted right-hand neighbour as a **translucent glass volume**, with a tree visible through it and a floating tank. This is visible on the full render after dragging the compare line left. | Disable context ghosting (and pins/HUD) for the capture, or render neighbours solid and frame the shot so they don't lead. |
| M8 | Print A4 (and A3) | **A4** (`.page` 794 px, overflow hidden): cover `scrollHeight 994` (the "Cover and area schedule" title block is cut), first floor 895, compliance 831. **A3:** compliance 1160/1123. **Report text:** every livable description is printed twice, "Staircase" twice, and Title Case room names ("Upper Family Lounge daylight"). The internal id from M5 is printed too. | Scale or reflow to fit A4. De-duplicate. Sentence-case room names. |
| M9 | Phone Revisions (390) | The scroller has `scrollWidth 848` / `clientWidth 390`. The versions `<ol>` is 1372 px and inflates the grid, so the H1 and "What changed" are cut off and there is a horizontal scrollbar. | `min-w-0` on the grid child; a compact wipe under "What changed". |
| M10 | Plan dock collisions | **Phone:** Zoom out, Fit and Zoom in all hit-test to the dock narration, and the "Add a prayer room upstairs" chip ends at 395 > 390. **Desktop 1440×900:** the scale bar "0 5 10 20 ft" sits under the "Make the kitchen bigger" and "Add a prayer room upstairs" chips (`elementFromPoint`). | Reserve a 160 px bottom band in the plan canvas, or lift the zoom, legend and scale bar above the dock. Add a 16 px end gutter to the chip row. |
| M11 | Client view `/s/<token>` | **Missing controls:** no room navigator and no floor stack in Orbit or Walk. **Collision:** with Comments open, the dock slides left over the bottom-left **Comment** button (x 149–297), and clicks land on the textarea. **Author line:** "Owner · Owner · 2 minutes ago", so the name falls back to the role. **Next pill:** "Walk through it" in Plan but "Approve v5" in House. | Give clients the same room pill and floor stack. When a sheet is open, keep the dock clear of the bottom-left zone. Show the owner's display name or "You". Keep Approve as the client's Next in both views. |
| M12 | Room navigator (Walk) | **Opened by click:** focus stays on "Rooms (M)", and typing "master" moved the walker instead of filtering (M by keyboard does focus the input). **Input jump:** while filtering, the bottom-anchored popover shrinks and the input jumps from y 138 to y 312. **Pill flicker during a glide:** the pill shows the target, then every room passed, then the target again: "Drawing room · Ground → Upper family lounge → Stair hall · First → Stair hall · Ground → TV lounge → Drawing room". **Coverage:** no Stair hall or Roof terrace entries, and on the roof the pill reads a bare "Rooms". | Autofocus on open. Anchor the input at the top with a fixed max height. Update the pill only on arrival (DESIGN §7.8). List circulation and the roof terrace. |

## Minor

### Layout and collisions

- **Brief (desktop).**
  - At rest, the dock covers "What LDA lets you build". "Front · rear 10′ · 7′" sits under the narration, and the first LDA bullet sits under "Show me concepts".
  - The Understood card's Guaranteed column wraps every 2–3 words inside the 420 px sheet. Stack Guaranteed and Preferences vertically.
- **Concepts lightbox.**
  - The title block starts at x 24 while the image starts at x 170.
  - Both chip rows offer "Darker glass".
  - The dock narration covers the "Brick instead of plaster" chip (hit-test).
  - There are two primaries: "Open the plan" and "See the plan".
- **Compliance sheet.**
  - It covers the arrow of "Walk through it" (pill right edge 1080, sheet x 1048).
  - **Esc does not close it,** though Esc closes the comments sheet, the lightbox and the dialogs.
- **View popover.**
  - Choosing Night removes the Sun row, so the panel shrinks and Day/Dusk/Night jumps about 33 px under the cursor. The white thumb animates detached above the panel.
  - The popover covers the "8 notes on the 3D mode…" chip.
- **Segmented thumbs (layoutId).**
  - Mid-spring, the moving thumb paints over the outgoing label ("Your hon[…]" in the workspace, a blank white "Brief" in the view switch).
  - Switching Walk → Orbit sends two white thumbs flying between the floor stack and the Orbit/Walk control.
  - Fix: put labels above the thumb (z-index) and scope layoutIds per control.
- **"Rooms on each floor" dialog.** It re-centres on every tab. Its top moves 94 → 63 → 222 px across Ground, First and Roof. Pin the top, or give the dialog a fixed height.
- **Phone House.**
  - Chrome covers **44%** of an 844 px screen: 116 px at the top and 254 px at the bottom.
  - Targets are under 44 px: Orbit/Walk 30 px, floor buttons 36 px, home menu 32 px, title button 18 px.
- **Phone room list.**
  - It is a translucent popover through which the floor stack and "8 notes" chip show (glass on glass). DESIGN asks for a full-sheet list on phone.
  - It shows an "M" key hint on a touch phone.
- **Revisions (desktop).** The "After" pill overlaps the north arrow.
- **Phone landing.** The construction labels "+0′ / +11′ / +21′" are 6.5–7 px tall and start at x −6 inside the frame, so they are clipped.

### Behaviour and affordance

- **Walk "?" help.**
  - A real mouse click does nothing (`aria-expanded` stays false). The "?" lives in the minimap, which auto-hides when idle, so the click falls through to the canvas. `.click()` opens it.
  - The copy is still "Finish F", "Let go · leave Esc", "Change floor 1…3", and "Go to a room: Click the map" (no M).
- **Idle fade is the inverse of the spec.** After 2.5 s idle only the minimap fades; the title, view switch, floor stack, bottom row and dock all stay.
- **"Drag to look around"** still appears twice: a toast under the view switch and the centre pill.
- **Comment pins.**
  - The 3D pin is author-4 amber (`#A8641A`), but the sheet avatar and the "Pin 1" badge are author-1 teal (`#0D7C72`). One author should have one hue.
  - The avatar initial is "O" for "You".
  - Pin mode stays on after pinning, and the button reads "Click to pin ①".
- **Comments sheet.**
  - The filter row mixes author and status in one single-select (All · Mine · Team · Client · Open · Resolved).
  - The empty state says "Press C in the House view…" while you are in the House view.
- **Plan room hover** shows nothing: no "Opens to:" and no `<title>`.
- **Samples tab.** "Sample · 10 marla modern home" opens this guest's renamed copy, "Collab QA round 1 · 10 marla" (v5).
- **Concept images.**
  - Each is a 1376×768 PNG, with day and night stacked and both loaded.
  - The tiles sit flat grey (no shimmer) for 2–4 s on desktop and more than 4 s on phone.

### Copy, jargon and consistency

- **Numbers disagree.** The landing promises "42/42 LDA · 5/5 livable" and "42 bylaw checks and 5 livability rules". The 10 marla home shows 36/36 · 9/9, and the villa 44/44 · 8/8. The landing chip also shows "42/42…" over the empty plot at 0 s, before anything is built.
- **"How it works · Three places"** lists Brief, Concepts and House, and omits Plan.
- **Voice.**
  - "I have recorded your 10 marla, 4-bedroom Modern Contemporary layout in Johar Town, and we can now move to the design concepts."
  - "Good choice. I'll plan the floors around it next." on a v5 home.
  - "1 note so far. I'll turn **them** into the next version."
- **Jargon in Brief.**
  - "FAR 1:2.8 (basement counts)" and "mumty ≤ 9′6″ excluded".
  - The page gives two different "max per floor" figures: 1,440 sq ft (envelope) and 1,592 sq ft (coverage).
- **Revisions H1 is a data string:** `“make the front lawn planting a little greener” · 36/36…`.
- **Title Case leaks:**
  - "Parents' Bedroom" and "Master Bedroom" in the command bar
  - "Ground Floor plan" in the aria-label
  - "Parents' Bath ventilation"
  - "Ground: 1 bed, Drawing, TV lounge, Kitchen, Dirty kitchen"
- **Abbreviations:** "Pass." and "Dress 3" in the app, while print says "Dressing 3".
- **Mixed marks:** the brief canvas uses `30' × 48'`, the navigator uses `15' × 18'`, and the plan uses `35′`.
- **"Section cut"** uses a word DESIGN bans.
- **One action, two names:** "Apply 1 open comment…" and "Revise with 1 comment".
- **The client composer** has aria-label "Ask Naqsha" but the placeholder "Leave a note for the owner".

### Accessibility

- **Create-account gate (Share as guest).** The name error "Tell us your name…" renders under **Password**. The name field has `aria-invalid` but no `aria-describedby`.
- **Sign-in page.** The email error also renders under Password, and the card re-centres (moves up about 6 px) when it appears.
- **Roof dialog.** Exclusive choices are `aria-pressed` buttons, not a radiogroup. The concrete-tank option's name starts with "tank" (the SVG label leaks in).
- **Lingering tooltips.** "Comments C" stays visible over the sheet or dialog after the click.

## Polish

- **Duplicate accent primaries:**
  - Brief: "Show me concepts" ×2, 56 px apart on phone
  - Lightbox: "Open the plan" and "See the plan"
  - Revisions: "Walk through it" ×2
  - House: "Render this view" plus the Next pill
  - Pin mode: "Click to pin" plus the Next pill
- **Material language over 3D.** The comments sheet, comment composer and home menu are white surfaces, while every other overlay is dark glass (DESIGN: `glass-hud` over 3D).
- **Selected floor.** It is a black thumb in Plan and a white thumb in House.
- **Bottom-left row heights.** Orbit/Walk is 36 px beside View and v5 at 44 px.
- **Landing.**
  - The header nav is 38 px/14 px, but Sign in and Portal are 32 px/13 px.
  - The phone header has no Sign in.
  - The right half of the builder band is empty.
- **The `/app/signin` header** uses a 32 px gutter; every other page uses the 1280 px centred column.
- **"Recommended"** in the roof dialog uses pass-green.
- **The storey toggle** reads "1 storey | 2 | 3".
- **Phone workspace.**
  - "Save your work to an account" is indented 14 px from the column.
  - "New home" takes a full-height dashed tile directly under the composer that already does the same job.
- **Samples tab.** The card name says "Sample · …" and the image also carries a "Sample" chip.
- **Rooms dialog, Roof tab.** It shows "111 of 317 sq ft" used with zero rooms. Say what the stair tower takes.

## What works (verified live)

- **Chrome:** no stage bar. The floating title capsule, view switch and people capsule are clean. Geist and Geist Mono load. There were no console errors beyond my own 404 probe.
- **Landing:**
  - The construction animation runs on the first fold at 1440×900: the plot outline and "Plot 35′ × 65′ · mid-row" count-up, then structure floor by floor, "Stair to the roof · clear for solar", the render, then "By night", with Replay.
  - Features are a 3×2 grid with a staggered reveal.
  - The builder band links "Open the Portal".
  - There is no horizontal overflow at 390.
- **Auth:**
  - The sign-in and create-account dialogs have labelled fields and an eye toggle.
  - Esc closes them and focus returns to the trigger (Share).
  - `/app/signin` offers "Continue as a guest".
  - A guest who clicks Share is asked to create an account.
- **Brief:**
  - "Rooms on each floor" has Ground, First and Roof tabs, steppers and an "813 of 1,440 sq ft" meter.
  - The roof dialog has tank picture cards, "About 18 panels, ~10 kW" and "No domes, minarets or chhatris…".
  - Guaranteed lists independent bedrooms, a stair to the roof with the door at its landing, and railings at every drop.
- **Concepts:**
  - Day/Night crossfades all four with the same camera, and `?light=night` persists.
  - B, C and D are mid-row.
  - The lightbox has remix chips and arrows.
- **Plan and print:**
  - The floor stack and compliance groups work.
  - The print dialog is calm (A3/A4, floors, cover, compliance, Preview).
  - The A3 cover and floor sheets have a title block, schedule, scale bar and north arrow.
  - Esc closes the preview.
- **House:**
  - Neighbours ghost in orbit.
  - In Walk you spawn at the main door facing in.
  - Drag-to-look works when pointer lock is refused.
  - M plus the filter plus Enter glides through the stair to "Master bedroom · First".
  - The floor stack R moves you onto the roof terrace.
  - The lounge TVs sit clear of doors.
  - The View popover has layers and Day/Dusk/Night.
  - Night lighting works.
  - Render this view returns a before/after slider with Save.
- **Comments:**
  - C enters pin mode.
  - The composer carries a snapshot, an auto tag ("Jaali screen, first floor") and suggestions.
  - The pin appears in 3D and on the plan.
  - The sheet groups by floor and room, and Esc closes it.
  - Next becomes "Revise with 1 comment".
- **Client view:** "Shared with you · You can comment", Plan and House only, "Approve v5", and an "On earlier versions" group.
- **Revisions (desktop):** the version list, "What changed", and the Before/Wipe/After compare.
- **Command bar:** typing shows "Ask Naqsha · bed", then Go to, with the rooms by floor.
