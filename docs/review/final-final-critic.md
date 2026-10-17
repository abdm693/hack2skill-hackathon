# Final design critique: revision 8 (17 Oct 2026)

- **Build tested:** the live bundle `assets/index-BaiWuXqd.js` + `index-DL4JPf2l.css`. This is the same as the local `web/dist` (built 10:25), so this review covers the deployed code.
- **Scope:**
  - every screen at 1440×900 and 390×844 (mobile UA, 2× DPR);
  - the landing page, with its animation at normal and reduced motion;
  - sign-in and create account;
  - the workspace: Your homes, Samples, and the empty state;
  - Brief: new and filled, plus the floors and roof dialogs;
  - Concepts: Day, Night and the lightbox;
  - Plan: the compliance sheet, the print dialog, and A3 and A4 previews;
  - House: Orbit, Walk, the room navigator, the View popover, Night, pin mode, Versions, Details, Share, Comments and the command bar;
  - Revisions, the client view `/s/VPDXGqFJUG420qlq8YYjTOG-`, and the 404 and missing-home states.
- **Method:**
  - **Built-in browser:** one tab (`tab-48`), closed at the end, with the viewport reset.
  - **Headless Chrome over CDP:** a throwaway guest, for full-resolution captures.
  - **No accounts, comments or revisions.** I created no accounts and posted no comments. I asked for no revisions and turned on no share links.
  - **Guest clones:** opening each new sample made one guest copy each, `p_3d71a3fdc933` (10 marla) and `p_c17ec2b543f2` (villa). Starting a brief with questions made one empty brief, `p_b33098576e0e`.
- **Evidence:** screenshots are in `docs/review/final-final-critic/` (`NN-*.jpg`, referenced below as [NN]).

## Verdict

The chrome is very good:
- No stage bar, one accent and Geist throughout.
- HUD contrast now passes (glass .75, `#C9C9D1` at 12 px).
- Walk is clean: no key legend and no "YOU ARE IN" card.
- The room navigator is steady.
- Print fits on A3 and A4.
- Esc closes every sheet.

Three things keep it from feeling *impeccable*.

1. **The trust surface contradicts the claim.**
   - The brief says both new samples pass every LDA and livable check. On screen:
     - the 10 marla shows **"36/36 LDA · 10/15 livable · 5 to check"**;
     - the villa shows **"43/43 LDA · 10/18 livable · 8 to check · 7 notes from the 3D model"**.
   - The compliance sheets carry paragraphs headed "Architect's review: needs a change" that contradict rows marked as passing.
2. **The flagship sample's concepts are still corner plots.** Concept A, and Concept B (the Chosen one, also used on the landing card, the Samples card and the print cover), both show a side street beside the house. This is the user's own complaint.
3. **Collisions and label overlaps in the views judges see first:**
   - Brief: the Next pill covers the LDA facts.
   - Plan: room labels sit on door swings.
   - Phone Plan: the legend covers the lawn, gate, driveway and road.
   - Revisions: the Before/After pills sit on the dimensions.

## Verdicts

### Must-fix items

| Item | Verdict | Evidence |
|---|---|---|
| Live = deployed revision 8 | FIXED | Live `/` loads `index-BaiWuXqd.js` / `index-DL4JPf2l.css`, the same files as `web/dist` (10:25). |
| "Both new samples pass every LDA and livable check" | **NOT FIXED** | **10 marla** (`v_f881a067c573`): `compliance.checks` has 5 `warn`: `door_width:g_dirty_kitchen_door`, `wet_over_dry:f_bath2`, and `review.1`, `review.3`, `review.4`. Status: "10/15 livable · 5 to check" [19][21]. **Villa** (`v_7379f7e1ceb0`): 8 `warn`, such as "No way in: Light Court Void…", "Bath shape", and 3× "Architect's review: needs a change". It also shows "7 notes from the 3D model" [27][28]. |
| User's screenshots: key legend under the "Finish walkthrough" pill, overlapping HUD bars | FIXED | Walk at 1440: one bottom-left row, the room pill and Comment, plus the dock. No legend and no tool bar; the "?" help card opens on a real click [26]. |
| User's screenshots: all caps ("YOU ARE IN", "FIRST FLOOR") and raw mesh labels ("Stair Hall walls", "Family TV Lounge tv") | FIXED | Walk shows the room pill "Car porch · Ground", and the minimap caption is "Ground floor". Hovering furniture in Walk shows no mesh label. |
| User's screenshots: the "1 as-built note" chip | PARTLY | Gone from the 10 marla. The villa puts "· 7 notes from the 3D model" in the title capsule and the plan chip, with engine-log copy ("…is not on a wall between the Upper Passage and the Rear Sun Terrace, so it was not built") [28]. |
| User's screenshots: an "All" floor in Walk | FIXED | The Walk floor stack is R · 1 · G only. |
| User feedback: concepts show a corner plot | **NOT FIXED** | **10 marla Concept A:** the kerb curves round the lawn into a side street, with houses across it [14][16]. **Concept B (Chosen):** a lawn verge and a road run past the right boundary [15]. B is also the landing card, the Samples card and the print cover. |

### Round-3 carry-overs

| Item | Verdict | Evidence |
|---|---|---|
| R3 M1: landing 10 marla card opens the villa | FIXED | The card opened the existing 10 marla copy `p_3d71a3fdc933` (de-duped). |
| R3 M3: ghost loading card and raw ids | FIXED | The card is at opacity 1. Steps read "Furnishing the upper family lounge… bath 3… Lighting the house". |
| R3 M4: HUD contrast | FIXED | The status line is `rgb(201,201,209)` at 12 px on `rgba(24,24,27,.75)`. |
| R3 M4: HUD tab order | NOT FIXED | Tab order on House is: Close (help), R, 1, G, Orbit, Walk, View, v2, Rooms, Comment, *then* All homes and the title. |
| R3 M5: element ids in compliance | FIXED | It now reads "The door between Dirty Kitchen and Open Kitchen is 2′6″ wide". |
| R3 M8: A4/A3 print clipping | FIXED | A3 has 6 pages and A4 has 7, every one 1123×794 with 0 elements outside a sheet. |
| R3 M9: phone Revisions 848 px wide | FIXED | `scrollWidth` 390. |
| R3 M10: plan dock collisions at 1440 | FIXED | The scale bar ends at y 728 and the dock starts at 750. On phone the chip row still runs to x 394 (see the issues). |
| R3 M11: client view | PARTLY | Rooms is present, "Owner · Owner" is gone, and Approve is consistent. There is still no floor stack, and Rooms and Comment move to the bottom-left [38]. |
| R3 M12: navigator autofocus, input jump, pill flicker | FIXED | The input stays at y 226 while filtering. The pill goes "Car porch · Ground" → "Bedroom 3 · First" with no intermediate rooms. |
| Esc closes compliance | FIXED | After Esc, "Passes all 36" is no longer in the DOM. |
| View popover jumps on Night | FIXED | The Night button's top is 197 before and after. |
| Rooms dialog re-centres per tab | FIXED | The dialog top is 96 on Ground, First and Roof. |
| Plan room hover ("Opens to:") | NOT FIXED | Hovering a room shows nothing. Rooms carry only `aria-label`s and there is no `<title>` or tooltip. |
| Comments filter mixes author and status | NOT FIXED | It is still one row: All · Mine · Team · Client · Open · Resolved [32][39]. |
| Roof tab "111 of 317 sq ft" with no rooms | NOT FIXED | Rooms dialog, Roof tab [10]. |
| Concrete-tank option's name starts with "tank" | NOT FIXED | The dialog text reads "…tank \| Concrete tank in the stair tower". |
| Landing header sizes | FIXED | How it works, Samples, Sign in and Portal are all 36 px / 14 px / 500. |
| Auth errors under the wrong field | FIXED | The email and password errors each sit under their own field. |

### Per screen: is it impeccable?

| Screen | Verdict | Evidence |
|---|---|---|
| Landing, 1440 | PARTLY | The hero, animation and reduced motion are clean. Problems: "12 livable" against 15 in the product, the feature row's misaligned body text, the empty builder band, and floating CTAs [01–03]. |
| Landing, 390 | PARTLY | The drawing is cropped on the right (SVG content to x 416 in a 374 px frame), and the caption pill sits on the ground line. |
| Sign-in and create account, 1440 and 390 | PARTLY | The header gutter is 32 px against 112 px elsewhere. The card jumps from centred (sign-in) to top 96 (create account) [41]. |
| Workspace, 1440 | **NOT FIXED** | Two left edges (360 and 112). Mismatched thumbnails. Four identical "Sample · 10 marla…" cards. An empty third column. The empty state repeats the composer [04–06]. |
| Workspace, 390 | PARTLY | Clean apart from the "Your homes" heading over the Samples tab and "Modern Contemporary" [07]. |
| Brief, 1440 (filled and new) | **NOT FIXED** | The Next pill covers "Front · rear 10′" [08][09]. "Show me concepts" ×2. "Decide everything for me" ×3 on a new brief. Seven "Not yet" rows [11]. |
| Brief dialogs (floors, roof) | **NOT FIXED** | "Save floors" sits at y 941–981 in a 900 px viewport. "LDA allows up to 3" sits beside the bedroom count. "111 of 317 sq ft" [10]. |
| Brief, 390 | **NOT FIXED** | The Next pill covers "Add a prayer room · Add a study". The title is truncated to "Sample · 10 marl…". Targets are under 44 px [12]. |
| Concepts, 1440 | **NOT FIXED** | Corner plots in A and B. Architect's jargon and US spelling in the captions [13–15]. |
| Concepts lightbox, 1440 | **NOT FIXED** | The title and remix row start at x 24 while the image starts at x 170 (unchanged since round 3) [16]. |
| Concepts and lightbox, 390 | **NOT FIXED** | The lightbox title sits 4 px under the view switch, beside a 5-line, 190 px wide description. The narration reads "Chosen…." [17][18]. |
| Plan, 1440 | **NOT FIXED** | Labels sit on door swings. "5 to check" on a sample. No room hover. "Stair Hall" is in Title Case. "Design again" is an icon-only button [19][20]. |
| Compliance sheet | **NOT FIXED** | Bath 2 over the drawing room is counted twice. Nine-line review paragraphs. Rules that pass contradict the review and the as-built notes. "No way in" is raised for a void [21][28]. |
| Print dialog and preview | PARTLY | Both fit the page. Problems: "Print 5+ sheets" (the preview has 6 or 7), a sixth sheet holding 5 rows, overprinted dimensions on the A4 site plan, and "Dress" vs "Dressing" [22–24]. |
| Plan, 390 | **NOT FIXED** | The legend covers the lawn, gate, driveway and road. "D. kitchen", and "Bedroom" for "Parents' bedroom". The last chip is cut at x 394 [25]. |
| House orbit, 1440 | PARTLY | Problems: the ghosted neighbour fills 40% of the frame, the home menu is a white sheet over 3D, the composer's focus ring is square, and the tab order [26][27]. |
| House orbit, 390 | **NOT FIXED** | The house is cut off at the left edge. The View popover covers the floor stack's "All" [31][32]. |
| Walk, 1440 | PARTLY | Two different floor switchers with the same R/1/G labels. The minimap appears only after the mouse moves. |
| Walk, 390 | PARTLY | The joystick is invisible until touched. The room list has no close control, and the view switch shows through its top edge [33][34]. |
| Room navigator | PARTLY | Steady, filtered and autofocused. The 12 px-radius field draws a square HUD focus ring. |
| View popover | PARTLY | The "Cut away" row is inset about 7–9 px from the other rows. The 3D Night is murky next to the concept night renders. |
| Comments sheet | **NOT FIXED** | A white sheet over 3D. Mixed filters. Authors appear as "Owner" without a name or role. Long replies that say "We…" [32]. |
| Share dialog (guest) | FIXED | One client-link toggle and one invite row with "Create an account". The copy is clear, there is one secondary button, and Esc and Done both work. |
| Revisions, 1440 and 390 | **NOT FIXED** | The heading runs 4 lines on desktop and 6 on phone. "Walk through it" ×2. Before/After sit on the dimensions. The legend is numbered 7, 1, 8, 4, 3, 6, 2. No view is active in the switch [35–37]. |
| Client view, 1440 and 390 | PARTLY | No floor stack. A blank snapshot thumbnail. Client comments have no avatar. The phone copy says "Click" [38–40]. |
| 404 and missing home | FIXED | "Off the plan." with Home and Portal. "This home isn't here" with All homes and Sign in. |

## Issues (most severe first)

### Blocker

**B1. The samples' trust surface contradicts "passes every check".**
- **What judges see:**
  - **10 marla, everywhere:** the title capsule reads "36/36 LDA · 10/15 livable · 5 to check". The plan dock adds "5 livable points need a look".
  - **Villa:** "43/43 LDA · 10/18 livable · 8 to check · 7 notes from the 3D model".
  - **Landing chip:** promises "36 LDA checks · 12 livable" with a green dot.
- **10 marla sheet:** "Architect's review: needs a change" calls the kitchens "long, narrow tunnels", and "There is no powder room on the ground floor, so Drawing Room guests must walk through the family TV Lounge and into the Parents' Bedroom".
- **Villa sheet:**
  - The review says "The Entrance Lobby has no direct exterior door; … guests … must walk through the formal Drawing Room". It also says the dirty kitchen's "only indoor access is directly through the Prayer Room". Yet "Every room has a proper way in" passes.
  - As-built notes say "Tight walking path: Dirty Kitchen … less than 3 ft". Yet "A clear 3 ft path to every door" passes.
- **Fix:**
  - Re-promote samples whose stored report has 0 `warn`, or don't show a sample until it does.
  - Move "Architect's review" to Details, or show it only on homes the user made.
  - Hide as-built notes from the title capsule.
  - Make the landing chip read from `/api/samples`.

### Major

**M1. The flagship's concepts depict corner plots** [14][15].
- **10 marla Concept A, day and night:** a curved kerb wraps the lawn into a side street, with houses across it.
- **Concept B (Chosen):** a lawn verge and a road run past the right boundary wall.
- B also appears on the landing "Sample homes" card, the Samples tab card and the print cover.
- **Fix:** re-roll A and B with neighbours tight on both sides, keeping their ids and titles.

**M2. Compliance copy is long, duplicated, and in Title Case** [21].
- **Duplication:** "Bath over a dry room — Bath 2 sits over Drawing Room" is also "Architect's review — Bath 2 sits directly over the front-left corner of the Drawing Room…", so one problem counts twice in "5 to check".
- **Long, inconsistent notes:** review notes run to 9 lines and use decimal feet ("6 ft wide by 15.25 ft deep", "12 x 6.5 ft") next to the sheet's `2′6″`.
- **Title Case:** room names are in Title Case ("Dirty Kitchen", "TV Lounge & Dining", "Stair Hall").
- **False positive:** the villa raises "No way in — Light Court Void on the First Floor has no way in.", but a void needs no door.
- **Fix:**
  - One clause per row (DESIGN §8).
  - De-duplicate review items that repeat a rule.
  - Use sentence case with ′″ marks.
  - Exclude voids from the way-in rule.

**M3. Engine notes leak into the villa's chrome** [28].
- The title capsule reads "…· 7 notes from the 3D model", and the dock narration is truncated at 1440 ("…7 notes from the 3D model. Want to…").
- The sheet's "As built" list is a log. For example: "The sliding door between the Upper Passage and the Rear Sun Terrace is not on a wall between the Upper Passage and the Rear Sun Terrace, so it was not built."
- Another note says a 7 ft privacy screen was added between four named terrace pairs.
- **Fix:** keep these in Details for the owner. Never put them in the status line.

**M4. The Brief's Next pill covers content** [08][09][12].
- **At 1440×900:** "Show me concepts" (x 886–1079, y 832–884) covers the "Front · rear 10′" value in "What LDA lets you build" (x 1056+). The regulation footer is also cut by the viewport.
- **At 390:** the pill (y 726–770) covers the "Add a prayer room / Add a study" chips.
- **Fix:**
  - Give the right column bottom padding equal to the dock height (about 120 px).
  - On phone, put the chips above the dock's safe area.

**M5. Plan labels collide with door swings and dimensions** [20][24][36].
- **At 1440:**
  - The "Dirty kitchen 6′×15′3″" dimension runs through the kitchen-to-kitchen door arc.
  - The "Parents' bedroom" and "Parents' bath" labels start on their door arcs.
- **Revisions:** "Master bedroom" sits on its door arc.
- **Phone:** "Bedroom" sits on its door.
- **A4 cover site plan:** "35′" and "30′" overprint each other (reading as "38′"), and "Up" is clipped to "Jp".
- **Fix:**
  - Offset rotated labels away from the swing quadrant, or place them horizontally when the room is under 7 ft wide.
  - Scale the site-plan text, or drop the inner dimension row at small scales.

**M6. Phone Plan: the legend card covers the drawing** [25].
- At 390 the legend (Setback, Changed since version 1, and the ① ② ③ keys) sits over the front lawn, gate, driveway and "40′ road". Only "veway" and "gate" show.
- It also holds three Title Case keys: "Side Space", "Stair Hall" and "Parents' Dressing".
- **Fix:** collapse the legend behind a "Key" button on phone, or dock it under the plan.

**M7. Workspace thumbnails and names** [06].
- **Thumbnails:** they mix grey 3D aerial captures, a photoreal concept, and a cut-away interior (the villa copy shows floors with the roof removed). The 10 marla sample's card is a cropped close-up of a parapet.
- **Names:** four cards read "Sample · 10 marla modern home, Johar Town" with nothing to tell them apart.
- **Fix:**
  - Use the chosen concept's day image for every card that has one.
  - Name copies "10 marla modern home (copy 2)", or de-dupe across sample versions.

**M8. Revisions page** [35][37].
- **The H1 is a log line,** 4 lines at 1440 and 6 at 390: "Enlarged the master bedroom front glazed sliding door/window from 7 x 7.5 ft to 9 x 8.5 ft across nearly the full wall width, and 1 more change."
- **Two "Walk through it" buttons:** a secondary in the content and the primary Next pill.
- **The Before/After pills cover the "35′" and "30′" dimensions** [36].
- **Phone legend:** ordered 7, 1, 8, 4, 3, 6, 2, wrapping into ragged columns, with "Master Balcony" and "Master Bath" in Title Case.
- **The view switch shows no active item** on this route.
- **Mixed status line:** "36 of 36 LDA checks pass, 5 to check" mixes LDA and livable.
- **Fix:**
  - Use the H1 "Version 2: a bigger master bedroom window", with the detail under "What changed".
  - Drop the secondary button.
  - Place the wipe labels inside the drawing area.
  - Sort the legend.

**M9. Phone House framing** [31][32].
- At 390 the orbit camera keeps the desktop framing, so the house's left third is off-screen.
- The View popover's top edge covers the floor stack's "All" button, and the two glass layers overlap.
- **Fix:**
  - Fit the camera to the portrait aspect.
  - Anchor the View popover above the bottom row, inside the safe zone, or hide the floor stack while it is open.

### Minor

- **Concepts lightbox alignment, 1440:** "A · Cantilevered Monolith", its description and "Remix it:" start at x 24, while the image starts at x 170 and "Plan this one" ends at x 1416. They should align with the image [16].
  - **Phone:** the title sits 4 px under the view switch, beside a 5-line, 190 px wide description [17].
- **Concept captions** use architect's jargon and US spelling: "board-formed concrete", "wood-composite louvers", "champagne aluminum privacy fins", "charcoal powder-coated steel pergolas" and "timber vigas". The villa's A even says "corner mass". DESIGN §6 asks for "A · Stone and teak".
- **Comments sheet** [32][39][40]:
  - It is a white surface over 3D (DESIGN: `glass-hud` over 3D).
  - Its filters mix author and status.
  - The owner shows as "Owner" with an "O" avatar and no role caption, while clients show name and role but no avatar.
  - The client view shows an empty white snapshot box under "Design review: could the jaali screen be a shade warmer?".
  - Naqsha's replies run to three sentences in "We…" with decimal feet ("2.6 ft cantilevered canopy").
- **Home menu** (title chevron) is a white surface over 3D.
- **HUD focus ring:** the ring (`0 0 0 2px #18181B, 0 0 0 4px #7D93FF`) lands on radius-0 inner fields. It draws a square-cornered rectangle inside the 26 px dock composer and inside the 12 px room-navigator field. Put the ring on the wrapper with `:focus-within`.
- **Floors dialog** [10]:
  - At 1440×900 the dialog is clipped at y 876, and "Save floors" sits at y 941–981, so the user must scroll the dialog to find it. Make the footer sticky.
  - "4 bedrooms in all · LDA allows up to 3" reads as a bedroom limit; the 3 is storeys.
  - The First tab shows "Master bed + bath 0" although the sample has a master bedroom upstairs.
- **Print:**
  - "Print 5+ sheets" while the preview says "A-000 · 1 of 6" (A3) or "1 of 7" (A4).
  - Sheet 6 of A3 carries 5 rows and is otherwise empty [23].
  - "Dress" on screen, "Dressing" in print, "Parents' dressing" in the navigator.
- **Phone targets under 44 px with no `hit-44`:**
  - title button: 18 px tall;
  - Home menu: 32;
  - All homes, Share and the view-switch segments: 36;
  - Plot and brief, Pick a size, Decide for me and Decide everything for me: 32;
  - Before / Wipe / After: 26;
  - Revisions floor buttons: 32.
- **Phone Plan chip row:** "Add a prayer room upstairs" ends at x 394 > 390, with no end gutter (the row scrolls, but the cut looks broken).
- **Phone room list** [33]: a full sheet with no close control or grab handle. The view switch's white thumb shows through its top edge.
- **Walk, 1440:**
  - The left floor stack (go to that floor) and the minimap's R · 1 · G tabs (preview that map) sit on screen together, with identical labels and different behaviour.
  - The minimap appears only after the mouse moves.
- **View popover:** the "Cut away" row is inset about 7–9 px from the rows above, on both the label and the switch, at 1440 and 390.
- **Client view** [38]:
  - No floor stack.
  - Rooms and Comment sit bottom-left for clients but bottom-right for owners.
  - Only the client buttons show the M and C key hints.
  - The phone narration says "Click a spot…".
  - The capsule says "Shared with you" without naming who shared it (DESIGN: "Shared by Ahmed Builders").
- **Workspace** [04][05]:
  - "Your homes" and the composer start at x 360, while the tabs and grid start at x 112.
  - The Samples tab puts 2 cards in a 3-column grid, leaving the right third empty.
  - A new guest's "Your homes" shows a lone dashed "New home" tile that repeats the composer above it.
  - Abandoned drafts keep "Writing the brief · 8 hours ago".
- **New brief** [11]:
  - "Decide everything for me" appears three times: the sheet header, "Decide for me", and the dock chip.
  - The right column is seven "Not yet" rows.
  - On phone, "225 sq ft = 1 marla" wraps onto an orphan line.
- **Filled brief:**
  - The Understood card, the Your brief column and the canvas caption all repeat the same facts.
  - Wishes are lowercase chips ("parents' bedroom on the ground floor") that wrap to two lines, while the same items are sentence case in Preferences.
  - On a v2 sample the chat still says "I will sketch four exterior designs when you tap Show me concepts".
- **Pin mode** [29]:
  - Two accent buttons ("Click to pin" and the Next pill).
  - The dock still says "press C to pin a note" while pin mode is on.
  - The hover tag reads "Exterior walls (roof)".
- **Numbers that disagree:**
  - The landing says "12 livable rules", but the product shows 15 livable rows (10 marla) or 18 (villa).
  - The roof dialog says "About 18 panels, ~10 kW", but compliance says "roughly 11 kW".
  - Versions say "1 hour ago" while Details says "Started 20 minutes ago".
- **Title Case and abbreviation leaks:**
  - "Modern Contemporary" (workspace card, fact token, Concepts subtitle, Details);
  - "Ground 1 bed, Drawing, TV lounge, Kitchen, Dirty kitchen";
  - "Master Bedroom window, first floor";
  - "Parents bedroom" (villa, no apostrophe);
  - "D. kitchen".
- **Copy:**
  - The Versions popover header says "the camera stays put".
  - On phone the narration truncates to "…concept marked Chosen…." (a period followed by an ellipsis).
- **Sign-in / create account** [41]: the header gutter is 32 px against 112 px elsewhere, and the card moves from vertically centred (sign-in) to top 96 px (create account).
- **3D Night:** the house is barely lit, with almost no interior glow, next to the warm concept night renders and the landing.
- **"Design again" ↻** is an icon-only button beside Print. A one-click full regeneration needs a label.

### Polish

- **Landing** [01–03]:
  - The first feature title wraps ("Plot to approval-ready / plan the same afternoon"), so its body starts 26 px lower than its neighbours'.
  - "How it works" mixes "2 minutes / 1 minute / A few minutes / 5 minutes".
  - The right half of the builders band is empty.
  - The hero CTAs float at x 909, aligned to nothing above them.
- **Landing, 390:** the construction drawing is cropped on the right, and the caption pill sits on the ground line.
- **Selected floor:** a black thumb in Plan and Revisions, a white thumb in House.
- **"Recommended"** in the roof dialog is pass-green.
- **First move on a sample:** a freshly opened sample's first Next is "See what changed", for a revision the visitor never asked for. "Walk through it" is the better first move.
- **Phone walking:** the joystick has no resting affordance once the one-time hint has gone.

## What is genuinely good now

- **The original walk complaints are gone:** no key legend, no "YOU ARE IN", no mesh labels, no "All" in Walk, and the minimap caption is in sentence case. The spawn is at the main door facing in, and the room pill is correct.
- **The HUD reads well:** it passes AA, the idle fade works, the "?" help opens on a real click, and the View popover no longer jumps on Night.
- **Navigation is steady:** the navigator is steady, autofocused, filters as you type, and opens as a full sheet on phone with no M hint. The glide pill doesn't flicker.
- **Print is clean:** both sizes fit, with title blocks, a 1:100/1:150 scale (A3/A4) and no element ids.
- **The dialogs are calm:** the Print and Share dialogs, and the roof and floors dialogs no longer re-centre.
- **Phone Revisions** no longer overflows.
- **Landing card:** "10 marla" opens the 10 marla sample and de-dupes the copy.
