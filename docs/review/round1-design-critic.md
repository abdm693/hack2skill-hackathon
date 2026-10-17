# Round 1 design critique (live app, 17 Oct 2026)

**Scope:** I audited every screen on the live Cloud Run build at 1440×900 and 390×844 against `docs/design/DESIGN.md`. The screens were the landing, auth, workspace, brief, concepts, plan, house (orbit and walk HUD), comments, revisions, print preview and the client-link error page. I used my own browser tab and stayed a guest, so no accounts were created.

**Not verified live:**
- The Share dialog and the client view at `/s/<token>`. Both need a signed-in owner.
- A full Ask or "Apply comments" revision run. The sample clone is shared by every tester using this browser.
- The touch joystick. My clicks reach the page as mouse events.

## Verdict

The overhaul has done its job. The stage bar is gone, and the chrome is a calm set of floating capsules. Geist is used throughout, there is one accent and sheets are restrained. Walk, the room navigator and the A3 drawings are close to premium.

What stops it being impeccable:

1. A workspace crash (blocker).
2. Landing sample cards that all open the same, unpictured Spanish villa.
3. HUD secondary text at about 2:1 contrast over the bright 3D scene.
4. Print sheets on A4 that clip their own title block.
5. Engine diagnostics and internal ids shown to the user, including on the showcase sample, which contradict its green "8/8 livable".
6. Floating chrome that collides with content: the dock over chips, the plan controls and the room key; content scrolling under the capsules; sheets covering the Next pill.

## Blocker

**B1. The workspace crashes when any home has no plot yet.**
- **What happens:** `/app` shows "This page didn't load". "Try again" crashes again, and the page has no link out.
- **Console:** `TypeError: Cannot read properties of null (reading 'width_ft')`.
- **Cause:** `web/src/app/workspace/Workspace.tsx:258` reads `p.brief?.plot.width_ft`, and `brief.plot` is `null` for a project at the setup stage created from a message with no plot size. I saw this with "Untitled home" (`p_156ca2b22f81`, "Family of 5 people").
- **Same bug:** `web/src/app/shell/DetailsDialog.tsx:13` reads `b.plot.*` without a guard.

## Major

| # | Where | Issue |
|---|---|---|
| M1 | Landing samples | "10 marla family home · Johar Town", "Courtyard frame house · Mid-row" and "Corner home · 1 kanal" all open **Sample · 1 kanal Spanish villa**. They call `openSampleHome()`, which picks `samples[0]`, and their images are static mocks (`/mock/concept-1.jpg`, `/landing/home-day.jpg`, `/mock/concept-2.jpg`) of homes the product doesn't have. "Explore a sample home" also lands on the Spanish villa, while the hero animation shows the modern 10 marla. |
| M2 | House HUD (all over 3D) | **Contrast.** `glass-hud` (rgba(24,24,27,.58)) over the pale sky or roofs gives an effective background of about rgb(101–110). `hud-ink-2` #A3A3AD on that is **2.0–2.3:1**, which fails AA. It affects the floor stack R/1/G, the 11px status line "v2 · 44/44 LDA · 8/8 livable", the inactive view-switch tabs, the ⌘K key caps and the minimap labels. The "Assembling your home" loading card, light glass over a light sky, is nearly invisible. Fix: raise the alpha to about .75, set `hud-ink-2` to ≥ #C9C9D1 and use 12px minimum. |
| M3 | House: "6 notes on the 3D model" | On the showcase sample, this amber-icon popover lists engine diagnostics. Examples: "the **plant floor** was left out", "Kitchen: the fridge was left out…", "the car in **Car Porch** was left out", "Bedroom 3: furniture leaves less than 3 ft between some doors or the stair". They contradict the green "8/8 livable", leak ids, and the popover covers the floor stack. |
| M4 | Print (A4) | `.page` is 794px tall with `overflow:hidden`, but the content is 831–994px. **4 of 5 sheets clip**, including the title block (Plot, Location, Version, Prepared by, Sheet) on the cover, ground and first floor. On A3 the compliance sheet still overflows by 37px. |
| M5 | Print title block | The block says "Location: **DHA / Johar Town**, Lahore" (and "1 kanal · DHA / Johar Town · Lahore" on the cover) for the Spanish villa, whose brief and Details say only "Lahore". That is wrong data on a document meant for the LDA file. |
| M6 | Print compliance sheet | Every livable rule's description is printed **twice**. The LDA list reads as a debug dump: internal room names ("Upper Family Lounge daylight"), mono everywhere, and "Roof kept clear for solar · 66 (limit 55)". |
| M7 | Phone Plan | The dock covers the **zoom controls** and the **"Room key · 5 rooms"**, so `elementFromPoint` hits the dock. The numbered rooms ①–⑤ can't be decoded on a phone. |

## Minor

### Layout, collision and zones

- **Brief and Revisions (desktop):** the right column and the revisions page scroll **under** the floating title capsule, view switch and people capsule, with no protective band or fade. "Facing", "2 storeys…" and "Before/Wipe/After" collide with Comments/Share. At rest, the last bullets of "What LDA lets you build" sit under the dock because the scroll area has no bottom padding.
- **Concepts lightbox:** the dock's Naqsha line ("Good choice…") sits on top of the "Brick instead of plaster" remix chip.
  - There are two chip rows (Remix it + dock suggestions), both with "Darker glass".
  - There are two primary buttons ("Plan this one" and "See the plan").
- **Plan:** the compliance sheet covers the right third of the "Walk through it" Next pill, including its arrow. The Comments sheet shifts the dock; this sheet doesn't.
- **Phone House:** the "Assembling your home" card sits under the floor stack, which clips "Assembling", "Furnishing…" and "1 of 24 layers".
- **More than one accent primary on screen** (DESIGN §1, "one accent button at most"):
  - Brief: "Show me concepts" in the sheet and in the dock. On phone they are stacked 90px apart.
  - Revisions: "Walk through it" twice.
  - House: "Render this view" plus the Next pill.

### Behaviour and affordance

- **The HUD "Comment" button doesn't comment.** It shows the toast "Press C to pin a comment where you stand", so the visible button is only a keyboard tip. It should enter pin mode.
- **The Next pill doesn't react to new comments.** It still read "See what changed" after I pinned a note, and only became "Revise with 1 comment" after a reload. On phone it was already "Revise with 1 comment".
- **One author, two colours.** My comment's 3D pin and popover badge are author-4 amber (#A8641A), but its avatar and number in the sheet are author-1 teal (#0D7C72). DESIGN asks for one hue per author, with matching numbers.
- **"Walking controls (?)" doesn't open with a real mouse click.** `aria-expanded` flips back to false; a programmatic `.click()` does open it.
  - Its copy is odd: "Finish F", "Let go · leave Esc".
  - "Change floor 1…3" disagrees with the floor stack's tooltip "([ / ])".
- **"Drag to look around" appears twice at once** (a top toast and a centre pill) when pointer lock is refused.
- **Wrong copy after pinning:** "Pinned. Add your note, then keep walking." appears after the note was already written, and the whole scene dims.
- **Unlabelled "Design again":** the ↺ icon next to Print regenerates the plan and has only a tooltip.
- **Plan room hover is missing.** DESIGN asks for "Bedroom 2 · 14′ × 12′ · Opens to: Corridor, own bath", but there is nothing on hover or click (no `<title>`, no popover).
- **Missing livable checks.** The compliance sheet's livable list lacks DESIGN's "Every stair edge and void has a railing", "Doors are clear of furniture" and "A clear 3 ft path to every door". These are exactly the user's complaints.
- **Mixed filters:** the comments row mixes author scope (All/Mine/Team/Client) and status (Open/Resolved) in one single-select control.

### Motion and jank

- **Landing animation plays mostly unseen.** At 1440×900 it starts when only the top ~200px of the frame is visible, so most of the 8s timeline plays below the fold and visitors scroll down to a finished night render. Trigger it at about 50% visibility.
- **View popover jumps:** choosing Night removes the Sun slider. The bottom-anchored popover's segmented control then jumps 34px under the cursor, and the thumb animates detached outside the panel.
- **"Rooms on each floor" jumps:** the dialog re-centres when you switch the Ground/First/Roof tabs, moving the tab row about 88px.

### Copy, jargon and consistency

- **Internal ids in the UI:**
  - Loading card: "Facade spanish roofs", "24 layers" (from `Hud.tsx prettySection`).
  - Pin tag: "Upper Family Lounge tv, first floor".
  - Suggestion chips: "Move the upper family lounge tv", "Change the upper family lounge tv to".
  - Revisions: "(Master w)".
  - Compliance: "66 (limit 55)".
- **Numbers that disagree:**

  | Topic | Landing says | App says |
  |---|---|---|
  | Checks | "42/42 LDA · 5/5 livable", "42 bylaw checks and 5 livability rules" | "44/44 · 8/8" and "36/36 · 9/9" |
  | Print scale | "Print every floor at 1:100" | Print dialog: 1:150 (A3), 1:200 (A4) |

  Solar also disagrees inside the app: the roof dialog says "About 37 panels, ~20 kW" and compliance says "roughly 16 kW".
- **Missing view:** "How it works: Three places" lists Brief, Concepts and House but omits Plan.
- **Error caption in the wrong place:** auth errors ("Enter your email address…", "Tell us your name…") render in one slot under Password, not under the field in error, and have no `aria-describedby`.
- **Stiff voice:** "I have recorded your … we are ready to move on to initial layout concepts" doesn't match the "Here's what I understood" voice.

### Brief, workspace and phone

- **Cramped two columns:** the Understood card's Guaranteed and Preferences columns inside the 420px sheet leave the rules column about 170px wide, at three words per line.
- **Clipped placeholder on phone:** the composer placeholder wraps to two lines inside a 36px textarea, so it is clipped and shows a scrollbar (Brief, Concepts).
- **Workspace thumbnails:** a planned home's card drops its photoreal concept for a grey clay 3D capture, so the grid mixes photos, clay captures and line sketches.
- **Small targets:**
  - Phone landing footer links are 22px tall, under the WCAG 2.2 24px minimum.
  - Minimap floor buttons are 22×20.
  - Landing "Sign in" is hidden on phone.
- **Weak HUD focus ring:** the focus ring on HUD controls (accent at 20%) is barely visible on dark glass.

## Polish

- **Inconsistent wording:**
  - Portal links read "Open portal", "Open the Portal" and "Portal".
  - Title Case leaks: "Arcaded Villa", "Guest Bedroom" (command bar) against "Guest bedroom" (plan), "Ground Floor" (minimap), "Car Porch slab".
- **Workspace (Samples tab):** names say "Sample · …" and the image also carries a "Sample" chip.
- **Phone workspace:** "Save your work to an account" is indented 12px from the column edge, because a quiet button's padding isn't compensated.
- **Revisions:**
  - The H1 is a data string: "From 2 comments · 44/44 LDA · 8/8 livable".
  - The "After" pill overlaps the north arrow.
- **Labels and tokens:**
  - The storey toggle reads "1 storey | 2 | 3".
  - "Recommended" uses pass-green (DESIGN keeps pass/warn/fail for compliance).
  - Share uses the `ink` variant (DESIGN reserves it for the landing Portal).
- **Invalid `/s/` link:** it keeps the landing's tab title, and says "no longer shared" for a link that never existed.

## What works (verified)

- **Chrome:** there is no stage bar. The title capsule, segmented Brief · Concepts · Plan · House and the people capsule float cleanly, and Geist and Geist Mono are used correctly.
- **Landing:** a 12ch hero, a construction animation (plot → envelope → frame → walls → solar → render → night) with Replay, six business features, a builders band and a Portal button. There is no horizontal overflow at 390px.
- **Auth dialogs:** sign in, create account and forgot password. The 440px dialog has validation, Escape closes it, focus returns to the trigger, and focus rings show on the landing. Share as a guest asks you to create an account. The guest flows work.
- **Concepts:** the plots are mid-row with neighbours on both sides. The Day/Night crossfade keeps the same camera. There is a lightbox with remix chips and a phone carousel.
- **Brief editors:** a per-floor program dialog with steppers and an area meter, and a roof dialog with tank picture cards (Recommended), solar options and "No domes, minarets or chhatris unless you ask for them."
- **Walk:**
  - You spawn at the main door facing in, with railings on the stair.
  - When pointer lock is refused, drag-to-look works.
  - The room navigator offers type-to-filter, then glides to the room.
  - The floor switch glides up the stair to the landing, and the minimap highlights the current room.
- **Orbit:** neighbours between the camera and the house are ghosted.
- **Comments:**
  - Pins take a snapshot.
  - Threaded replies work.
  - The bottom sheet works on phone.
  - "Choose what to change" lets you include comments one by one.
- **Command bar:** typing shows "Ask Naqsha" plus "Go to" rooms.
- **Print:** the dialog offers A3/A4, floors and sections. The A3 sheets have a title block, scale bar, north arrow and area schedule.
- **Revisions:** a "What changed" delta, per-comment Done / Not possible with reasons, and a before/after wipe.
