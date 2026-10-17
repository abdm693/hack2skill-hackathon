# Round 1 review: Concepts and Plan (live app)

- **Tested:** 17 Oct 2026, on the live build at https://naqsha-242926648187.us-central1.run.app, using the built-in browser. Viewports were 1366×850 (main), 1000×622 (small laptop) and 375×812 (phone).
- **Stance:** a tester. I edited no code and created no accounts. The guest uid is `7c27b88c-…` (shared with the other round-1 testers).
- **Scope:** Concepts covers mid-row versus corner framing, the four takes, Day/Night with lazy night generation, remix, selection, captions and prompt leakage. Plan was tested on both samples and covers floor drawings, labels, zoom and pan, "Opens to…", pins, the compliance panel, print to PDF through `?dialog=print`, and version compare.

## Test projects (guest workspace)

| Project | Id | Notes |
|---|---|---|
| Sample · 10 marla modern home, Johar Town (my clone) | `p_8d8010bb3391` | Mid-row, faces N; v1 and v2, where v2 came from 2 comments and enlarged the master window. 36/36 LDA, 8/8 livable. |
| Sample · 1 kanal Spanish villa (my clone) | `p_4e01a962c3ae` | Mid-row, faces S; v1 and v2. 44/44 LDA, 8/8 livable. It has 1 open comment pin. |
| 5 marla house, Lahore (older audit project) | `p_6f2f5a63b6a5` | Corner plot. I used it to test lazy night generation and remix. I also chose concept B and started "Plan this one" (see section 4). |

Severity follows `audit-journey.md`: **blocker**, **major**, **minor** and **polish**.

---

## 1. Summary

The concepts screen is in good shape. It shows four distinct titled takes with one-line captions and brief chips, and no raw prompts appear anywhere. Day/Night works by key, on the grid and in the lightbox, and the light setting persists in the URL. Lazy night generation works (about 25 s). Remix produces a "Remixes" row that keeps the framing. Corner plots show a side road, and three of the four mid-row 10-marla images and all four Spanish images show neighbours on both sides.

The Plan view is much stronger than before:
- Every room is labelled. Labels shorten at fit zoom, and a room too small for its label gets a numbered marker plus a legend entry.
- "Opens to…" is accurate.
- Bedrooms in both samples open only to a lounge, passage, balcony or their own bath.
- The compliance panel has LDA and Livable groups with units. Clicking a rule jumps to the right floor and highlights the geometry.
- The print set is real: the cover, one sheet per floor at a **true** 1:100 (I measured the SVG at 164.592 mm for 54 ft), a north arrow, a scale bar, a room schedule, a title block and a compliance sheet.

What still fails:

1. **Major, concepts:** concept A of the 10-marla sample, "Grooved Travertine", still shows a freestanding or corner house on a mid-row brief. The prompt is correct; the model ignored it and nothing caught it.
2. **Major, roof plan:** the stair that reaches the roof is invisible. The white fill of the stair-tower box is painted over the stair flights and the "Down" label. This happens on both samples and on a freshly generated plan, on screen and in print. It is the user's "no stair to the roof" complaint, now in 2D.
3. **Major, print on A4:** title blocks and half of the compliance report fall off the page on both samples.
4. **Major, compliance honesty:** warnings are counted as passes. The 10-marla sample says "Passes all 36 LDA checks" and "Ventilation 4/4" while listing "Bath 2 ventilation: 0 sq ft opening (2 needed) … LDA asks for at least 2 sq ft". The printed report says "36 of 36 pass".
5. **Major, Spanish sample plan:** the master dressing opens only onto the upper family lounge, not into the master bedroom.
6. **Major, overlap:**
   - At phone width the Plan zoom controls and legend sit under the dock and cannot be clicked.
   - On desktop, a pin's comment popover renders under the dock narration and cannot be read.
7. **Major, fresh plan quality:** I generated a new corner 5-marla plan in this session. It ships a 12′ × 12′ car porch for a 1-car brief and a TV lounge with 5′6″ of wall, and the dock reports only "passes all 31 LDA checks".

---

## 2. Issues

### Major

**P-1. Mid-row sample concept A shows a corner or freestanding plot.**
- **Where:** Samples → "Sample · 10 marla modern home, Johar Town" → Concepts → A "Grooved Travertine". The same happens in the lightbox, in the Day and Night views, and on phone.
- **What:** the brief chip reads "Mid-row". The image shows open streets on both sides of the house, with curved kerbs at both front corners and neighbours set far back. B, C and D are correctly mid-row.
- **Cause:** the stored prompt does say "It is a MID-ROW plot (NOT a corner): neighbouring houses stand directly against both side walls…", so the image model ignored it and no check or regeneration happened.
- **Why it matters:** this is the user's original complaint, and it ships in the flagship sample.
- **Expected:**
  - A mid-row concept shows neighbours against both side walls.
  - Ship a sample whose four images all conform. The tile could also be regenerated, or failed images detected and re-rolled.

**P-2. The roof plan hides the stair that reaches the roof.**
- **Where:** Plan → R, on both samples, on screen and on the print sheet "A-103 Roof plan".
- **What:** the plan group draws the stair hall (`rect 0.38,22.5 7.25×11`) with its flights and the label "Down". A later group then draws the stair-tower box (`rect x=0 y=22.12 8×14.88 fill="#fff" stroke=…`) **on top**, which covers the flights and "Down" completely. On the 1-kanal sample the covering rect is `x=0 y=46 8.5×16.38 fill #fff`. All that is visible inside the mumty is the plastic tank (10 marla) or nothing (1 kanal).
- **Why it matters:** the drawing shows a box with a door but no stair arriving. This is exactly the user's "no stair to the roof" complaint, in 2D.
- **Expected:** draw the mumty walls without an opaque fill, or paint the stair and "Down" above them. Show the tank on the mumty roof as dashed, not over the stair.

**P-3. Print on A4 cuts content off the page (both samples).**
- **Repro:** Plan → Print → A4 → Preview (or "Print or save as PDF"). I measured the off-screen print root, with each page at 297×210 mm and `overflow:hidden`:
  - **10 marla:** the cover has 14 text nodes outside the page, including the whole title block. The first-floor sheet loses 7: Version, Prepared by, Sheet A-102, Scale. The compliance sheet loses **29**: the Staircase rows, the Overhead water tank and the **entire "Livable home · 8 of 8" section**.
  - **1 kanal:** the cover and ground-floor sheets lose their title-block fields (Plot, Location, Version). The first floor loses Version, Prepared by and Sheet. On the compliance sheet the 4th column runs off the right edge ("Upper Fa…", "Master B…"), and the title block is drawn over the 3rd column's text.
- **Expected:** every sheet fits its page. Paginate the compliance report, flow it into fewer columns, or shrink type at A4. Keep the title block pinned inside the margin.

**P-4. Compliance counts warnings as passes and still claims "approval-ready".**
- **Where:** 10 marla → the "36/36 LDA · 8/8 livable" chip.
- **What:**
  - The header reads "Approval-ready · Passes all 36 LDA checks and 8 livable rules", and the Ventilation group shows **4/4**.
  - Inside that group, "Bath 2 ventilation" (amber icon) reads "0 sq ft opening (2 needed). Bath 2 has no opening to the outside; LDA asks for at least 2 sq ft (a ventilator or a duct)". The API returns `status: "warn"`, `value: 0`, `limit: 2`.
  - "Livable 8/8" includes "Bath over a dry room" as a warning.
  - The printed compliance sheet says "LDA rules · 36 of 36 pass" and lists the 0-sq-ft item without any flag.
- **Expected:**
  - Either count warnings separately ("35 pass · 1 to check"), or fix the plan so it passes.
  - Never say "approval-ready" or "passes all" while showing an LDA shortfall.
  - The printed report should carry the warning icon or wording.

**P-5. Spanish sample: the master dressing opens onto the family lounge, not the master bedroom.**
- **Where:** 1 kanal → Plan → First floor. "Opens to" on Master dressing reads "Upper family lounge". On Upper family lounge it reads "… own dressing …", which is wrong because a lounge has no "own dressing". At 468% zoom the dressing's only door swings into the lounge.
- **What:** the master suite's dressing is reached by walking out through the family lounge. The livable rules pass because "Rooms are independent" only covers bedrooms and baths.
- **Expected:**
  - A dressing that belongs to a bedroom opens only from that bedroom.
  - Add "dressing/closet opens from its bedroom" to the independence rule.
  - Fix the "own dressing" wording for non-bedroom rooms.

**P-6. Phone (375×812) Plan: the zoom controls and legend are under the dock and cannot be clicked.**
- **Repro:** open any sample → Plan at the mobile preset.
- **What:** the zoom-out, fit and zoom-in buttons sit at (243–359, 680–712). `elementFromPoint` at each button's centre returns the dock's narration ("Your home passes all 36 L…"). The legend card (Setback, Changed since version 1, numbered-room key) sits under the narration and the "Walk through it" button.
- **Expected:** on phones, lift the plan chrome above the dock (or into the top row), or hide the narration while the plan is shown.

**P-30. A freshly generated plan ships a car porch that cannot hold a car, and the dock reports only LDA.**
- **Where:** corner 5-marla project `p_6f2f5a63b6a5`, v1, made in this session through "Plan this one". It took about 14.5 min (22:03:24 → 22:17:52 UTC).
- **What:**
  - The result is "31/31 LDA · 11/12 livable".
  - The car porch is **12′ × 12′**, but the brief asks for a 1-car porch. The panel itself says "a car needs a 9 × 18 ft bay"; this is only a warning.
  - The TV lounge has 5′6″ of solid wall (the failing rule).
  - All three bedrooms are short of a bed wall: 8′8″ against 9′, 8′6″ against 10′, and 8′8″ against 9′.
  - The dock narration says only "Your home passes all 31 LDA checks. Want to walk through it?" and gives the livable shortfall no mention. The "Fix the rules that still fail" chip is the only hint.
- **Expected:**
  - A porch that cannot fit the car should be a fail that the fix loop resolves.
  - The narration should say what is still wrong.

**P-7. Plan pins: the comment popover opens underneath the dock narration.**
- **Repro:** 1 kanal → Plan → First floor → click pin ①.
- **What:** the pin gets its accent ring. The popover ("Owner · 18 minutes ago / Can the TV wall get a wooden panel?") renders at the bottom centre (525–837, 684–730), where `elementFromPoint` returns "Your home passes all 44 LDA checks…". Only the first line peeks out.
- **Expected:** anchor the popover next to the pin, or hide the dock narration while a pin is open.

### Minor

**P-8. The compliance sheet covers the dock's primary button.**
- **Where:** desktop at 1366 width.
- **What:** the sheet spans x 974–1354. "Walk through it" spans x 876–1043, so its right ~70 px are under the sheet. While the sheet is open, the zoom controls are pushed left into the suggestion-chip area.
- **Spec:** "an open sheet hides the HUD zones it covers, so nothing ever stacks."

**P-9. Version compare is missing on the Spanish sample, and the Plan compare is thin.**
- 1 kanal v2 changed the master bedroom window (change target `f_master_w`), but Plan shows **no** "Changes since v1" control. The Versions page outlines no room ("Changed rooms are outlined", yet none is).
- On 10 marla, "Changes since v1" outlines the Master bedroom only. There is no delta and no note of what changed: the hover shows the plain room card. The "What changed" text lives only on `/revisions`.
- The spec asks for a dashed outline **plus a delta** and a wipe in Plan.
- **Expected:**
  - Outline the room that owns a changed window or door.
  - Show the change summary on hover in Plan.

**P-10. The Versions page leaks a raw element id and opens on the wrong floor.**
- "Enlarged the master bedroom window (Master w) from 5x5 ft…": `(Master w)` is the id `f_master_w`, humanised.
- The compare opens on G, but the change is on the first floor.

**P-11. Livable rows drop their units and show raw ids.**
- The compliance panel and print show "Roof kept clear for solar: **64 (limit 55)**". The data has `unit: "%"` and the limit is a minimum. Every LDA row says "(min …)" or "(max …)".
- On the fresh 5-marla plan the same formatter prints decimal feet: "Wall for the bed or TV **5.5 (limit 8)**" and "Door width **2.5 (limit 3)**".
- One message leaks an element id: "**f_terrace_slide** is 2′6″ wide".
- **Expected:**
  - "64% clear (min 55%)", "5′6″ (min 8′)" and "Terrace door is 2′6″ wide".
  - Never show element ids.

**P-12. The Stairs and Services rows are empty in the panel.**
- "Stairs 2/2" lists "Staircase" and "Staircase" with no value. The data has "2 flights, 19 risers of 6.95 in … width 3′6″", value 10 and limit 15 risers per flight.
- "Overhead water tank" has no detail.
- Both flights carry the same name.
- **Expected:** name them "Ground → first" and "First → roof", and show the riser and width values.

**P-13. The printed compliance report duplicates every livable rule's text.**
- Each livable rule prints its message twice: once in mono as the "value" line and once in grey. For example, "Bath 2 sits over Drawing Room: leaks…" appears twice. This happens on both samples.

**P-14. The roof print sheet says "0 sq ft covered" and has an empty room schedule.**
- On both samples, A-103 shows the "Room / Size / Area" header with no rows and "0 sq ft covered".
- The mumty (about 8′×15′, roughly 118 sq ft) and the tank or solar area are not listed.

**P-15. Roof labels collide with walls.**
- **10 marla:**
  - "Stair tower" and "9′ high" are drawn on top of the mumty's top wall, so "9′ high" is unreadable at fit and at 292%.
  - "Plastic tank" (x 650–711) is wider than the box (654–709), so the wall clips the "P" and "k".
- **1 kanal:** "Stair tower" pokes out past the plot line.

**P-16. Lightbox chrome stacks up.**
- **Where:** Concepts → open any concept.
- **What:**
  - The "Remix it:" row (Darker glass, More timber, Add a jaali screen, **Brick instead of plaster**) collides with the dock narration bubble, which covers the 4th chip.
  - The dock shows a second, different remix row (Darker glass, More greenery, Add solar panels), so "Darker glass" appears twice.
  - There are two accent CTAs at once: "Plan this one" and "See the plan".
  - The narration reads "Good choice. I'll plan the floors around it next." on a project that already has v2, even while you look at a concept that is **not** the chosen one.

**P-17. "Opens to…" is hover-only.**
- Room shapes only have `onPointerMove` and `onPointerLeave` handlers.
- A tap or click on a room shows nothing, on desktop and at the phone preset, and there is no keyboard route.
- Phone users never see "Opens to".
- **Expected:** a tap selects the room and shows its card.

**P-18. The A3 cover's title block runs past the page edge.**
- On the 10 marla cover, the footnote "Design drawing for discussion and approval…" ends 2.1 mm **below the page edge**, so it is clipped in the PDF.
- The title block also ignores the 10 mm padding.

**P-19. Numbered room markers have no key on the Versions compare.**
- `/revisions` on 1 kanal, first floor, shows markers ① and ② (Porch terrace and Master balcony) with no legend beside the compare.

**P-20. On a small laptop (1000×622), fit ignores the dock.**
- The plan's road label and scale bar sit behind the dock narration.
- Fit should reserve the dock's height.

**P-21. The compliance highlight sticks.**
- Clicking "Bath 2 ventilation" correctly jumps to the first floor and highlights Bath 2 in amber.
- The highlight stays after the sheet is closed, and after switching floors and back.

**P-22. Livable checks are missing three rules.**
- The spec lists three livable rules that never appear as checks:
  - "Every stair edge and void has a railing"
  - "Doors are clear of furniture"
  - "A clear 3 ft path to every door"
- Even if the engine guarantees these, users can't see that they were checked.

**P-31. The ground-floor stair hall is never labelled.**
- On the 10-marla sample and on the fresh 5-marla plan, the ground-floor stair hall (8′ × 14′9″, 118 sq ft) shows only "Up", at fit and at every zoom I tried.
- It has no name, no dimensions and no numbered marker, but it does appear in the room schedule and in "Opens to".
- The Spanish sample labels it "Stair" correctly.

**P-32. Plan generation is slow.**
- For a 5-marla, 2-storey corner plot, "Plan this one" took about 14.5 minutes before the plan was ready: 3 fix rounds, the architect review, then the 3D build. Most of that time was spent in "Laying out the floors" (about 7 min).
- The live progress card and the draft plan with its issue highlights make the wait legible, but it is long for a demo.

### Polish

- **P-23. Remix variations look the same.** A1 and A2 ("Darker glass") are near-identical, with A2 slightly darker.
- **P-24. Areas round differently.** The TV lounge is 325 sq ft on the plan card and the room schedule, but 324 sq ft in the compliance report of the same printed set.
- **P-25. Room names change between views.**
  - At fit zoom, "Arched loggia" is labelled "Balcony", "Lobby / sitting" is labelled "Lobby" and "Parents' bedroom" is labelled "Bedroom".
  - The legend says "Parents' Dressing" while the card says "Parents' dressing".
  - Compliance uses Title Case ("TV Lounge size") while the plan uses sentence case.
- **P-26. The Spanish location is wrong.** The cover and title block read "DHA / Johar Town, Lahore", which is two different societies. The brief has no scheme.
- **P-27. Wheel zoom is coarse.** One wheel notch jumps from 100% to 292%, and five notches reach the 800% cap.
- **P-28. The phone placeholder is clipped.** At phone width, the Ask placeholder "Ask for four more, like more brick and deeper shade" wraps onto a second line that is cut off.
- **P-29. Suggestion chips ignore the plan.** Both samples suggest "Add a prayer room upstairs", even though the Spanish villa already has a prayer room.

---

## 3. Verified working

**Concepts**
- **Captions:** there are four distinct takes with a title ("A · Grooved Travertine") and a one-line caption, and brief chips at the top ("Mid-row · Faces north · Solar-ready roof · Plastic tank · Modern Contemporary").
- **No raw prompts:** the image alt and title attributes are empty, and only the API carries the prompt.
- **Framing:**
  - On the Spanish sample, all four concepts are mid-row with neighbours on both sides.
  - On the 10-marla sample, B, C and D are correct.
  - The 5-marla **corner** concepts show the side road and corner.
  - Remixes keep the framing.
- **Day/Night:**
  - It works from the segmented control, the `N` key and the lightbox toggle.
  - `?light=night` is written to the URL.
  - All four tiles switch together, and the night images use the same camera as the day ones.
- **Lazy night generation:** on a project without night images, choosing Night calls `POST /concepts/night`. The tiles dim, a "Turning the lights on" line appears, and all four arrive in about 25 s. Remix tiles then get their own night images.
- **Remix:** a lightbox chip creates a "Remixes · From A …" row with A1 and A2 "Drawing" placeholders, filled in about 20 s.
- **Lightbox:** ←/→ steps through the concepts and Esc closes it.
- **Selection:**
  - "Chosen" marks the selected concept.
  - "Plan this one" moves to Plan with a Plan · Check · Review · Build progress card and a timer.
  - It also shows a to-scale envelope with the side road, a 5′ splay and the buildable area (corner 5 marla).
- **Phone:**
  - Concepts become a swipe carousel.
  - There is no horizontal page overflow.

**Plan, on both samples**
- **Labels:**
  - Every room has a label and dimensions.
  - Labels shorten at fit zoom and stay a constant size on screen as you zoom.
  - Rooms too small for a label get a numbered marker with a legend entry ("① Dressing 3 6′ × 6′3″"), so no room is left blank.
- **Drawing furniture:** north arrow, scale bar, 40′ road, setback dashes in accent, plot dimensions, gate and car gate.
- **Floors:** the R / 1 / G stack, the `]` and `[` keys, and `?floor=` in the URL all work. Zoom −, + and fit work, and so do wheel zoom and drag-pan.
- **"Opens to…"** content is correct and readable, for example "Parents' bedroom · 11′ × 15′3″ · 168 sq ft · Opens to: TV lounge, own dressing, own bath".
- **Room independence:** every bedroom on both samples opens only to a lounge, passage, balcony or its own bath or dressing. Each bath opens only to its bedroom, or to the servant quarter for the servant bath.
- **Pins:** the comment pin ① shows in the author's hue on the Spanish first floor and gets an accent ring when selected.
- **Compliance panel:**
  - The LDA group has meters with units: coverage 63.3% (max 70%), height 27′ (max 45′), FAR 1:1.04 (max 1:2.8) and storeys 2 (max 3).
  - Below the meters are the sub-groups (Setbacks, Room sizes, Daylight, Ventilation, Stairs, Services).
  - The Livable group follows, and its rule copy matches the user's asks: independence, stairs to roof, and roof door at the top of the stair.
  - Clicking a rule jumps to its floor and highlights the room ("Shown on the plan").

**Print**
- **The dialog** (`?dialog=print`, also a bottom sheet on phone) offers:
  - A3 or A4 paper.
  - The G, 1 and R floors.
  - Cover and compliance sheets.
  - A sheet count, with the buttons disabled at 0 sheets.
- **Scale adapts to the plot:** 10 marla prints at 1:100 on A3 and 1:150 on A4. The 1 kanal prints at 1:150 on A3 and 1:200 on A4.
- **Printing:** the "Print or save as PDF" button injects `@page { size: 420mm 297mm }` (or `297mm 210mm` for A4). It sets the document title to "… — version 2" so the PDF gets a good file name, and prints from an isolated root.
- **The sheets:**
  - **Cover:** the chosen concept, a site plan, and an area schedule (GF, FF, total, plot, coverage, FAR and height).
  - **Floor sheets:** at a true scale; the 10-marla SVG is 164.592 mm wide for 54 ft at 1:100. Each has a north arrow, a scale bar, a room schedule (room, size and area) and a title block (project, plot, location, version and date, prepared by, sheet number such as "A-101 · 2 of 5", and scale).
  - **Compliance sheet.**
- **A3 output:** the 1 kanal set fits with no clipping.

**Version compare**
- On 10 marla, "Changes since v1" toggles a dashed outline on the changed room and adds a legend entry.
- The Versions page (`/revisions`) has Before / Wipe / After, a draggable wipe and floor tabs. Its "What changed" card reads "Window 5′ wide → 9′ wide", and the comments thread shows a "Done" reply.

**A fresh plan made in this session (corner 5 marla, `p_6f2f5a63b6a5` v1)**
- **Progress:** the card read Plan → Check → Review → Build, with the narration "Fixing 2 problems (round 3 of 4)", "Reviewing it like an architect" and "Building the house in 3D · 14 parts".
- **Draft:** a draft plan showed while it worked, with failing rooms hatched red and a red dot on the floor that had issues.
- **Fixing:** the panel showed "Fixed while drawing 3 → 2 → 2 → 1" and "I'm fixing these now".
- **Room independence:** it holds on the fresh plan. The guest bedroom opens to the TV lounge and its own bath. The master bedroom opens to the lounge, the balcony and its own dressing and bath. Bedroom 2 opens to the lounge and its own bath.
- **Roof stair:** the stair-hiding bug (P-2) reproduces here too: a white rect at `x=0 y=13.12 8×14.88` covers "Down".

## 4. Notes

- I chose concept B on the corner project `p_6f2f5a63b6a5` and ran "Plan this one". It produced v1 (31/31 LDA · 11/12 livable) in about 14.5 min; see P-30 and P-32.
- Opening a sample from the Samples tab creates a new clone each time. The guest list already holds three 10-marla and two Spanish clones. This is outside my focus, so I have only noted it.
