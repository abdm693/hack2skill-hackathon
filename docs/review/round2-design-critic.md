# Round 2 design critique (live app, 17 Oct 2026)

**Scope.** I audited every screen of the live Cloud Run app at 1440×900 and 390×844 against `docs/design/DESIGN.md`:

- landing and auth
- workspace
- brief: the setup stage and the ready stage
- concepts, including the lightbox
- plan, with the compliance sheet and print in A3 and A4
- house: the orbit HUD, the walk HUD, the room navigator, the View popover, the command bar and the home menu
- the comments sheet and "Choose what to change"
- the guest share gate
- the client view at `/s/VPDXGqFJUG420qlq8YYjTOG-`
- revisions

I used one tab of my own and stayed a guest. I created no accounts, sent no Ask requests and ran no revisions.

**Projects used:**

| Project | Id |
|---|---|
| Sample 10 marla | `p_8d8010bb3391` |
| Villa | `p_4e01a962c3ae` |
| Collab QA round 1 | `p_0dca02d101d0` |
| Setup-stage "10 marla home, Lahore" | `p_d73807089ecc` |

> **Deploy note (read first).** The live site serves `assets/index-CoebF8Ij.js`. The local build in `web/dist` is `index-Dijrjh3k.js` (05:35), and the local `Landing.tsx` already fetches real samples. So some round-1 fixes exist in source but are **not live**. Everything below was reproduced on the **live** bundle. Re-check after the next deploy.

## Verdict

The bones are right:

- There is no stage bar. The interface is a calm set of floating capsules with one accent.
- Geist is used throughout, and the dialogs are well made.
- Walk with the room navigator is close to premium.
- The HUD "Comment" button now enters pin mode.

It is not impeccable. Five things undermine it:

1. **The first moments are broken.**
   - The landing sample cards all open the villa.
   - Every House load shows an empty pale sky with an invisible "Assembling your home" card for several seconds.
   - Concept A of the flagship sample is still a corner plot, which is the user's own complaint.
2. **Trust signals contradict each other.**
   - "Approval-ready · Passes all 36 LDA checks" sits beside a bath with 0 sq ft of ventilation.
   - A green "8/8 livable" sits beside a "12 notes on the 3D model" popover of engine diagnostics.
   - The landing promises "42/42 · 5/5".
3. **HUD contrast fails AA** across the whole House view.
4. **Phone layouts collide.** On Plan the dock sits on the zoom and room key; Revisions is 848px wide in a 390px viewport; the House chrome takes 43% of the screen.
5. **Print clips its own title blocks** on A4, and the compliance sheet reads as a debug dump.

## Major

| # | Where | Issue | Fix |
|---|---|---|---|
| M1 | Landing samples (live bundle) | "Explore a sample home" and **all three** sample cards ("10 marla family home", "Courtyard frame house", "Corner home") open `p_4e01a962c3ae` **Sample · 1 kanal Spanish villa**. The cards show mock images (`/mock/concept-1.jpg`, `/landing/home-day.jpg`, `/mock/concept-2.jpg`). The hero animation shows the 10 marla modern home, and "Corner home" advertises the corner plot the user complained about. | Deploy the local `Landing.tsx`, which maps `/api/samples`. Make "Explore a sample home" open the hero's 10 marla home. Drop "Corner home". |
| M2 | Concepts, 10 marla sample | Concept **A · Grooved Travertine** still shows a **corner plot**: a road runs down the left flank and there is no left neighbour, in Day and in Night. B, C and D, and all of the villa's concepts, are mid-row. | Re-roll A with "neighbours on both sides, single road frontage" (BE-09) and promote it. |
| M3 | House loading | The `.nq-build-card` entrance animation `nq-card-in` stays at `currentTime 0` with **opacity 0** for the whole ~6s load (sampled every 300ms from "1 of 24 layers" to "18 of 24"). Users see an empty pale-blue sky and a ghost card. On phone the card is clipped by the floor stack, and its step text is a layer id ("Facade ground", "Furnishing kitchen"). | Render the card at full opacity without a CSS entrance, or start it after the first frame. Use a solid `glass-hud` at about 0.8. Use plain step words ("Walls", "Furniture"). Keep it clear of the floor-stack zone. |
| M4 | House HUD contrast (all views over 3D) | `glass-hud` is still `rgba(24,24,27,.58)` and `hud-ink-2` is still #A3A3AD. Over the bright sky or roofs this gives about **2:1** for: the 11px status line "v2 · 36/36 LDA · 8/8 livable"; the floor stack R/1/G; the inactive Brief/Concepts/Plan tabs; the ⌘K caps; the walk-help legend; the minimap labels. Over a tree, R/1/G vanish. | Raise the HUD alpha to about .75–.8. Set `hud-ink-2` to ≥ #C9C9D1. Use 12px minimum for the status line. |
| M5 | House: "12 notes on the 3D model" (flagship sample) | The popover is an engine log: "Car Porch: the plant floor was left out because there is no place for it…", the same sentence 7 times, and "Stair Hall: the plant floor" twice. It also says "Parents' Bedroom: furniture leaves less than 3 ft between some doors or the stair". It contradicts the green "8/8 livable" and covers the floor stack. The console confirms the same ids (`plant_floor in g_stair`, `opening g_dirty_kitchen_w … skipped`). | Hide furnishing omissions from users. Group what's left into one plain line per room. Fix the sample so the count is 0, or demote it to the Details dialog. |
| M6 | Plan compliance sheet, and print | The sheet's headline says "Approval-ready · Passes all 36 LDA checks and 8 livable rules", but it also contains warnings in amber: Ventilation 4/4 shows "Bath 2 ventilation · 0 sq ft opening (2 needed)", and Livable 8/8 shows "Bath over a dry room · Bath 2 sits over Drawing Room". "Roof kept clear for solar · 64 (limit 55)" reads as a failure. DESIGN's livable rules for railings, doors clear of furniture and the 3 ft path (the user's own complaints) are absent. | Count warnings honestly ("36 pass · 1 to review"). Phrase solar as "754 sq ft clear for panels (~11 kW)". Add the three missing livable rows. |
| M7 | Print (A4 and A3) | **A4:** the `.page` is 794px with `overflow:hidden`. The cover is 1023px, so its **title block is cut** after "Cover and area schedule". The first floor is 895px and the compliance sheet 831px. **A3:** the cover overflows by 11px and the compliance sheet by 37px. The compliance sheet prints every livable description **twice**, prints "Staircase" twice, and uses internal Title Case ("Upper Family Lounge daylight", "Drawing Room size"). It also lists the 0 sq ft Bath 2 under "36 of 36 pass" on a document meant for the LDA file. | Fit A4 by scaling the drawing or reflowing into two columns. De-duplicate the descriptions. Use sentence-case room names. |
| M8 | Phone Revisions (390px) | The scroll container is **848px wide** (`scrollWidth 848`, `clientWidth 390`). The horizontal versions `<ol>` (1372px) inflates the grid column, so the H1, "What changed" card and buttons run off-screen and the page scrolls sideways. The before/after compare is not rendered on phone at all. | Add `min-w-0` to the grid child that holds the versions row. Show a compact wipe below "What changed". |
| M9 | Phone Plan | The dock covers the **zoom controls** (`elementFromPoint` on Zoom out/Fit/Zoom in returns the dock line) and the legend/room key ("① Parents' Dressing"). The suggestion chips run to x=395 in a 390 viewport. | Reserve the bottom 160px of the plan canvas, or move the zoom and legend above the dock. Give the chip row a 16px end gutter. |
| M10 | Client view walk (`/s/<token>?mode=walk`) | There is no room navigator, no floor stack and no Comment button. The only floor controls are 22×20 minimap buttons that "Show the roof map" rather than go there. The narration still says "walk through it room by room". | Give clients the same room pill (M) and floor stack. Keep "Comment" in walk. |

## Minor

### Layout and collisions

- **Brief, ready stage (desktop).**
  - The right column (`left-[444px]` scroller) runs under the title capsule, view switch and Comments/Share with no band or fade. "Comments 1 / Share" sits over the "Floors" text when scrolled.
  - At rest, the dock narration pill and the Next pill sit on "What LDA lets you build". `elementFromPoint` on the "Ground coverage up to 70%" and "Height up to 45 ft" bullets returns the dock (setup stage `p_d73807089ecc`).
  - Fix: add a top fade under the capsules and ~180px of bottom padding.
- **Brief, setup stage.** With only Brief available, **Share floats alone at top-centre** (674–768px) in the view-switch slot, and Comments is missing. Keep Share in the top-right people zone.
- **Concepts lightbox.**
  - The dock line "Good choice…" covers the right half of the "Brick instead of plaster" remix chip (`elementFromPoint` hits the dock).
  - There are two chip rows, and both offer "Darker glass".
  - The title and description block starts at x=14 while the image starts at x=95, so they are misaligned.
- **Compliance sheet.**
  - It covers the right 32px of the "Walk through it" Next pill, including the arrow (sheet x 1048, pill right edge 1080).
  - **Esc does not close it**, and focus stays on `<body>`.
  - The Comments sheet shifts the dock; this sheet doesn't.
- **Plan.**
  - Roof plan: the tank circle is drawn over the stair inside the stair tower. The "Down" (711–737, 442–455) and "Plastic tank" (679–741, 448–462) labels overlap.
  - With the sheet open, the zoom controls sit on the scale bar.
- **Revisions (desktop).** The "After" pill (1335–1384, 144–174) overlaps the north arrow.
- **View popover.** Choosing Night removes the Sun slider, so the bottom-anchored panel shrinks. The Day/Dusk/Night control jumps about 33px under the cursor, and the white thumb animates detached outside the panel.
- **Phone House.**
  - The bottom chrome stacks five rows ("12 notes", Rooms+comment, Orbit/Walk+layers+v2, narration+Next, composer), about 254px. With the 110px top, **43% of the screen is chrome**.
  - The house is framed under the floor stack.
  - Orbit/Walk is 30px tall, against a 44px spec.
- **Phone Concepts.** The composer placeholder wraps to two lines inside a one-line field, so it is clipped and shows a scrollbar.
- **Rooms on each floor.** The dialog re-centres on each tab: its top moves 62 → 93 → 221px across First, Ground and Roof.
- **Phone landing.**
  - The construction SVG labels are 6.5–7px tall.
  - The level labels "+0′ / +11′ / +21′" sit at x=10–22, outside the 16px frame edge, and are clipped.

### Behaviour and affordance

- **Room navigator focus.** Opening it by click or `M` leaves focus on the trigger or `<body>`. Typing "master" drove WASD (the walker moved) instead of filtering. Autofocus the filter.
  - The navigator also overlaps the minimap's left edge.
- **Walk help.** The "?" (Walking controls) does not open on a real mouse click (`aria-expanded` stays `false`), though `.click()` opens it.
  - Its copy is odd: "Finish F", "Let go · leave Esc", "Change floor 1…3" against "[ / ]" elsewhere, and "Go to a room: Click the map" (no mention of M).
- **"Drag to look around" appears twice** (a toast and a centre pill) when pointer lock is refused.
- **Deep link.** `?mode=walk&floor=roof` is ignored and opens the Ground floor.
- **Plan room hover or click** shows nothing. There is no "Opens to:" and the SVG has no `<title>`.
- **Samples tab clone.** Clicking "Sample · 10 marla modern home" opened `p_0dca02d101d0` "Collab QA round 1 · 10 marla" (v5), a renamed copy. It should open a pristine copy or say "Opening your copy".
- **Workspace thumbnails mix** photos, clay 3D captures and plot sketches. Opening House POSTs `/versions/<v>/thumbnail`, which replaces the photoreal concept.
- **Concept images** are 1.6–1.8 MB PNGs, 8 per view (about 13 MB, day and night eagerly). Tiles sit flat grey for 2–6s with no shimmer. Serve WebP/AVIF at about 150 KB, lazy-load night, and shimmer.

### Consistency, copy and jargon

- **The numbers disagree.**

  | Topic | Landing says | App says |
  |---|---|---|
  | Checks | "42/42 LDA · 5/5 livable", "42 bylaw checks and 5 livability rules" | 10 marla: 36/36 · 8/8. Villa: 44/44 · 8/8. Collab: 36/36 · 9/9. Version 2: 8/8, version 3: 9/9. |
  | Print scale | "Print every floor at 1:100" | A4 prints at 1:150 |

- **Missing view:** "How it works · Three places" lists Brief, Concepts and House but omits Plan.
- **Stiff or stale voice.**
  - "I have recorded your 10 marla, 4-bedroom Modern Contemporary layout in Johar Town, and we can now move to the design concepts."
  - "Good choice. I'll plan the floors around it next." on a home that already has v2.
  - "1 note so far. I'll turn them into the next version." (singular "note", plural "them").
- **Revisions H1 is a data string:** `“make the front lawn planting a little greener” · 36/36…`. The ellipsis is in the string itself, the request starts lowercase, and the version cards repeat it.
- **Title Case leaks:**
  - "Parents' Bedroom" and "Master Bedroom" in the command bar
  - "Ground Floor" on the minimap and in its tooltip
  - "Ground Floor plan" in the aria-label
  - "Parents' Dressing" in the phone room key
  - "Bath 2 sits over Drawing Room"
  - "Parents' Bath ventilation"
- **Abbreviations:** "Pass.", "Dress 3".
- **Lowercase wishes** in Your brief and Details: "parents' bedroom on the ground floor".
- **Mixed marks:** prime and apostrophe are mixed: `35′ × 65′` beside `35' × 65'`, and `22'×14'9"`. Use ′ ″ everywhere.
- **"Section cut"** uses a word DESIGN §8 bans. Use "Cut away".
- **Portal naming:** "Open portal", "Open the Portal" and "Portal".
- **Two names for one action:** "Apply 1 open comment…" in the sheet and "Revise with 1 comment" in the Next pill.
- **Two comment buttons with counts:** "Comment ①" and "Comments ①".

### Accessibility

- **Auth.**
  - The email error ("Enter your email address…") renders under **Password**, and the email field has no `aria-describedby`.
  - The dialog re-centres when the error appears.
  - "Create an account" and "Forgot password?" are 22px tall.
  - "Or keep going as a guest" isn't actionable in the dialog.
- **HUD focus ring.** The accent-at-20% 4px ring is invisible on dark glass and on the white selected thumb (Tab to "Whole house").
- **Tab order** starts at the 3D pin and floor stack, then the bottom bar, then the title capsule. It should follow the visual order.
- **Roof dialog.** Exclusive choices are `aria-pressed` buttons, not a radiogroup. The concrete tank button's name starts with "tank" (the SVG label leaks in).
- **Brief rows** put `<dt>` inside a `<button>`, which is invalid `dl` semantics.
- **Small targets:** minimap floor buttons are 22×20, the walk "?" is 24×24, phone footer links are 22px tall, and "start with questions" is 22px tall.

## Polish

- **Desktop landing.** The first fold ends on a **blank white 246px slab**: the construction frame before it reaches 50% visibility. Show the plot outline or the line elevation as a poster frame.
- **Builder band.** The right half of the dark panel is empty.
- **Header.** Nav items are 38px/14px while Sign in and Portal are 32px/13px.
- **Phone header** has no Sign in.
- **Mixed material language over 3D.** The Comments sheet and the home menu are white surfaces, while every other popover is dark glass.
- **Selected floor.** It is a black thumb in Plan and a white thumb in House.
- **Night in 3D** reads flat grey-lavender with few glowing windows, much weaker than the concept night renders.
- **Phone workspace.**
  - "Save your work to an account" is indented 12px from the column.
  - "New home" takes a full 268px tile directly under the composer.
- **Samples tab.** The name says "Sample · …" and the image carries a "Sample" chip too.
- **Duplicate primaries** (DESIGN §1, one accent button):
  - Brief: "Show me concepts" ×2, 64px apart on phone.
  - Revisions: "Walk through it" ×2.
  - Lightbox: "Plan this one" plus "See the plan".
  - House: "Render this view" plus the Next pill.
- **"Recommended"** uses pass-green, which DESIGN keeps for compliance. The storey toggle reads "1 storey | 2 | 3".
- **Wrap breaks** at "approval-/ready" and "LDA-/ready". Use non-breaking hyphens.
- **Tab title** stays "Naqsha · Walk through your home before the first brick" while a project loads.

## What works (verified live)

- **Chrome:** no stage bar. The floating title capsule, segmented view switch and people capsule are clean. Geist and Geist Mono are used. There were no console errors, only engine warnings.
- **Landing:**
  - The construction animation now starts only at 50% visibility, plots through the night render and has Replay.
  - Features are a 3×2 grid.
  - The builder band carries the Portal, and there is no horizontal overflow at 390px.
- **Auth:**
  - The sign-in and create-account dialogs are well built: labelled inputs, autocomplete, the password error placed correctly, Esc closes, and focus returns to the trigger with the keyboard.
  - `/app/signin` works as a page with "Continue as a guest".
  - Share as a guest asks you to create an account.
- **Workspace:** it loads all 18 homes (the round-1 crash is fixed). The composer's send button scales in.
- **Brief:**
  - The plot canvas shows the road, neighbours, the envelope and a north arrow consistent with "faces north".
  - "Rooms on each floor" has steppers and a meter.
  - The roof dialog has tank picture cards, "About 18 panels, ~10 kW" and "No domes, minarets or chhatris…".
- **Concepts:**
  - The Day/Night crossfade keeps the same camera and `?light=night` persists.
  - B, C and D and all of the villa's concepts are mid-row.
  - The lightbox has remix chips.
- **Plan and print:**
  - The floor stack, the compliance groups and the print dialog all work. The dialog's scale copy is now correct (A3 1:100, A4 1:150).
  - The A3 floor sheets have a title block, scale bar and north arrow.
- **House:**
  - Neighbours ghost in orbit.
  - The HUD "Comment" enters pin mode.
  - The Next pill reads "Revise with 1 comment".
  - The View popover covers layers and Day/Dusk/Night.
  - The command bar shows Ask, Go to and Do (Night).
- **Walk:**
  - You spawn at the main door facing in.
  - Drag-to-look works when pointer lock is refused.
  - The minimap appears.
  - The navigator's filter plus Enter glides via the stair to "Master bedroom · First".
  - The floor stack R glides to the roof terrace.
  - The bedroom window view is clear.
- **Comments:**
  - The sheet is grouped by floor and room, with snapshots.
  - "Choose what to change" has per-comment checkboxes and hides the Next pill.
  - On phone the sheet becomes a bottom sheet.
- **Client view:** "Shared with you · You can comment", "Approve v5" and "Leave a note for the owner".
- **Revisions (desktop):** the version list, "What changed", and the Before/Wipe/After compare.
