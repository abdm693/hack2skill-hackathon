# Naqsha deck: design critique

I reviewed the 15 renders in `renders/` (1920 × 1080, `?static=1`), `index.html`, `deck.css`, `assets.js` and `../deck-content.md`, and checked them against `docs/design/DESIGN.md`. All pixel values below are at the 1920 × 1080 design size. Nothing in the deck was edited.

## Verdict

This is well above hackathon level. The palette is disciplined, the chrome is consistent, the product imagery is real, the "in the 18 Oct build" labels are honest, and the drawing-to-render cover has a genuine idea behind it. What holds it back from keynote quality comes down to five things:

1. **Two products on screen.** v1 screenshots (brick accent, serif headings, numbered stage bar) sit beside the v2 cobalt/Geist brand. You can see it on 4, 5, 7, 8 and 12, against the v2 mock on 9.
2. **Text that dies in a PDF.** Diagram labels, chips and captions are 12.7–15 px. Judges will read this PDF on a laptop at roughly 0.7×, where 13.5 px becomes about 9.6 px.
3. **Template monotony and repetition.** 13 of the 15 slides share one skeleton (title left, grey kicker right, mono footer). The same numbers and images keep coming back: `5 → 1 → 0` three times, `42–50` five times, the front render four times, the same plan crop four times.
4. **Density.** Slides 2, 7, 9, 11 and 12 carry 240–300 visible words each. Even for a deck read as a PDF, about 150 is the ceiling.
5. **A handful of alignment and registration misses**, listed per slide below.

---

## Priority list

### P0: fix before the PDF is exported

1. **Slide 15 placeholders.** Five bracketed placeholders are visible: GitHub, demo, the three ask lines, and the team. A judge reads this as unfinished. Fill them, or delete the rows.
2. **Mixed v1/v2 UI.** Re-shoot every app screen after the overhaul lands (`docs/screens/v2-*.png`) and swap them in through `assets.js`. If v2 isn't live by export, crop the v1 screens to content only, with no brick buttons, serif titles or stage bar, so the clash is hidden.
3. **Legibility floor.** Raise every label to at least 16 px, diagram body text to at least 18 px and slide body text to at least 20 px. Selectors are in the Global section.
4. **Slide 4, wrong plot.** The Brief thumbnail shows a 50′ × 90′ plot (1-kanal, buildable 45′ × 73′). Slides 1 and 2 tell the 10-marla, 35′ × 65′ story. Re-capture the Brief envelope for 35′ × 65′.
5. **Slide 7, mixed status.** The hero chip "42/42 LDA · 5/5 livable" sits under the label "LDA engine · live", but the livable rules are tagged "in the 18 Oct build" in the next column. Split the chip, or move "5/5 livable" under the livable column, so the slide doesn't claim as live something that isn't yet.
6. **Slide 1, wrong word.** The chip "The naqsha" labels an elevation. Naqsha means *plan*, and the product is named after it. Either relabel it "The drawing", or make the left half a plan.

### P1: biggest lift in perceived quality

7. **Slide 6, Stream card.** Five identical full-width black bars carry no information. Replace them with a four-frame filmstrip (structure → facade → furniture → landscape), or use the unused `renderDollhouse`.
8. **Slide 7, too dense.** It has four zones and about 300 words. Merge the stair strip into the livable column and add leader lines to the self-review notes (details below).
9. **Slide 11.** The numbers row repeats slides 4, 7 and 8, and the guardrails are eight paragraphs of text. Turn it into a request-lifecycle diagram with each guardrail placed where it acts.
10. **Slide 12, insets.** At 330 × 200 the maket overflow, the whole point, can't be seen. Enlarge and annotate them.
11. **Title anchoring.** One-line titles (5, 6, 14) sink to y ≈ 220 because `.head` is bottom-anchored. Slide 12 uses a different head layout again. Anchor every title at the same top.
12. **No shared column axis.** The kicker at x = 1300 aligns with nothing below it on most slides. Put the deck on a 12-column grid.
13. **Slide 9.** Two modal surfaces cover about 80% of the house, and the pins sit in illogical places.
14. **Slide 10.** Service arrows drop from arbitrary modules, so the LDA engine appears to call Identity Platform. The Reviser↔LDA loop is two 14 px stubs.
15. **Slide 3.** Body paragraphs start at three different y positions, and the mono comma in "1,780" opens a visible gap.
16. **Slide 13.** Two captions collide ("its own 2020 rules" and "Aug 2026 bylaws,"), and "price to validate" appears twice.

### P2: polish

17. Use typographic primes (′ ″), not straight quotes, everywhere.
18. The Nastaliq in the slide mark is too small to read.
19. Hairline contrast on the canvas is 1.18:1.
20. The accent colour sprawls on slides 6 and 13.
21. Footers cite repo paths.
22. Frame radii vary (20, 22, 24, 28 and 32 px).
23. The roadmap title is generic.
24. The slide 15 tint makes the render look jaundiced.

---

## Slide by slide

### 01 · Cover

**What works:** a 150 px wordmark, a 48 px tagline and a 19 px mono URL with the 2 px cobalt underline make a clear three-step hierarchy. The drawing-to-render seam is registered: the pier and the overhead wires line up across it. This is the best idea in the deck.

- **Too much neighbour.** The hero frame shows about SVG x 248–1351, so roughly 45% of the render half is the neighbouring house (SVG x 1068+). Crop to the house: set the `viewBox` to `290 30 980 888`, a 1:1 scale with the 980 × 888 frame, so the house fills about 68% of the width and the seam sits near the frame's centre.
- **Placeholder-looking fills.** The ghosted neighbour windows are flat grey squares (`#2A2D35` at 10%) at the left edge, and they read as missing images. Drop the fills (lines 70–73) and keep only the dashed `.nb` outlines.
- **Tree over window.** The tree outline crosses the first-floor window and the porch glass, which makes the drawing look messy. Move it about 120 SVG units left so it sits clear of the window, or delete it. The render already carries the planting.
- **Drawing half is too empty.** The drawn half is about 80% white and the render half about 90% filled, so the composition tips right. Add the 35′ frontage dimension line and a level line (+0′, +10′, +21′) in mono to the drawn half. That gives it density and makes it read as an architect's drawing.
- **Urdu too small.** نقشہ at 64 px beside 150 px Latin reads small, because Nastaliq needs roughly 1.3× the Latin cap height to feel equal. Set `.s-cover .wordmark .ur` to 84 px.
- **Long description.** At 4 lines × 21 px it's long for a cover. Cut to two lines, for example: "An LDA-checked plan and a walkable 3D home, designed in code by Gemini 4 Argon and revised by a Google ADK agent, on Google Cloud."
- **Label (P0 #6).** See above.

### 02 · The problem

**What works:** the sketch, the plot drawing and the rules make a strong three-part argument, and the single cobalt row (3 storeys) is exactly how the accent should be used.

- **Too many rules.** Ten rule rows at 18.5 px read like a legal appendix. Cut to six: setbacks, coverage, height, storeys, the PCATP stamp, and "21 days; a refusal must name the rule". Glazing, stairs and the penalty reappear as engine checks on slide 7. Then raise `.s-problem .rules li` to 20 px and the values to 21 px.
- **Said twice.** The kicker ("The rules are exact. The way families start is not.") and the bottom line ("The rules are written down…") make the same point. Keep the bottom line, which is the stronger close. Drop the kicker and let the title run in one 1100 px measure.
- **Kicker floats.** The kicker starts at x = 1300 while the rules column starts at x = 1148. If you keep it, start it at 1148.
- **Sketch clipped.** "4 beds upstairs?" is cut at the top and the dashed boundary is lost at the bottom. Set `.s-problem .sketch` height to 300 px (the viewBox is 520 × 300). If that crowds the bottom line (at y ≈ 944), keep 252 px and change the SVG's `scale(1.02)` to `scale(.86)`.
- **Captions on different baselines:** the sketch caption at y ≈ 860, the plot caption at y ≈ 881. Put both on one baseline. If the sketch grows to 300 px, its caption lands near y ≈ 908, so add about 27 px of `margin-top` to the plot caption. If it stays at 252 px, raise the plot caption by 21 px instead.
- **Hatch too faint.** The open-space hatch `#CFCFC8` on the canvas is 1.45:1 and vanishes in a PDF. Use `#B5B5AE`, or ink-3 at 40%.

### 03 · Why now

**What works:** three equal cards, the one dark HUD card for code, and big mono stats sitting on a shared baseline (y ≈ 900).

- **Bodies misaligned.** Body paragraphs start at y ≈ 641, 622 and 654, because the inner panels (code box, chip cloud, PDF box) have different heights. Give all three a fixed height, for example `min-height: 150px`, so the bodies share one top line.
- **Comma gap.** "1,780" in Geist Mono at 64 px gets a full-cell comma, so it reads "1 ,780". For display stats, use Geist 600 with `font-variant-numeric: tabular-nums`, or write "1780". The same applies to the other big stats.
- **Redundant label.** "Why now" is both the eyebrow and the start of the title. Drop "Why now:" from the title: "Models that write buildings, agents that check them".
- **Story conflict.** This slide celebrates the 1,780-line one-shot, and slide 6 shows the same spike as the blocky "before". Reword card 1's stat so the story is consistent, for example "Ran first time, no console errors", with "1,780 lines" as the caption. Let slide 6 deliver the twist.
- **Small chips.** The chips are 14.5 px. Raise to 16 px; the cloud still fits in three rows.

### 04 · The journey

**What works:** six stops, a track, timing chips and the cobalt "~7 min" bracket give a clear one-glance overview.

- **Plot mismatch (P0 #4).** The Brief thumbnail is a 50′ × 90′ plot.
- **Dots and headings disagree.** The track dots are centred under each thumbnail (x = 248, 533, 817…) while the stop names are left-aligned to the column, so the dots belong to nothing. Either move the dots to each column's left edge (x = 120, 405, 689, 974, 1259, 1543) to match the headings, or centre the headings and chips.
- **Bracket overshoots.** The "~7 min, plan to 3D" bracket runs from x = 689 to 1261, which is the left edge of Walk, not the right edge of 3D (1231). Set `width: 542px` on the bracket SVG and scale its path to match.
- **Arrowhead hits the dot.** The return loop "v2, v3 …" ends in a caret touching the 3D dot. End the path at y = 34 (an 8 px gap), and raise the label from 13.5 to 15 px.
- **Unreadable Revise thumbnail.** Its paragraph is about 8 px on screen, so it reads as grey noise. Crop to the "Not possible" chip and the first line at 2× zoom, or draw a mini result card in the deck's own styles, like slide 8's.
- **Tone jumps.** The thumbnails go white diagram, golden-hour photo, beige plan, day render, interior, dark panel. Pick one rule: all product UI on white with a 1 px ring, or all full-bleed imagery. Avoid the dark panel at the end; it is the heaviest thumbnail and it lands on the least important stop.
- **Engine lines too small.** The engine lines (`.s-journey .stop .eng`) are 13.5 px. Raise to 15 px.

### 05 · Live product

**What works:** "not mockups" is the right claim, and the QR card is a strong call to action.

- **v1 UI (P0 #2).** The Brief and Plan screens show brick-red buttons, serif headings and a dark compliance panel, which contradicts the deck's own brand.
- **Illegible screens.** The Brief and Plan thumbnails show whole screens at about 25%, with 5–6 px text. Crop to one hero element each: Brief shows the envelope panel only; Plan shows the plan plus the "Fixed 5 → 1 → 0" banner.
- **Cut-off heading.** The Brief crop slices its heading to "…t about your home" at the left edge. Change the left inset in `object-view-box` from 10% to about 8.5%, or crop the heading out entirely.
- **Phone misaligned.** The phone's bottom is at y ≈ 890 and the row-2 frames end at y ≈ 918, so the phone caption sits about 25 px above the row-2 captions. Set `.s-live .phone { height: 576px; }`.
- **Phone caption overclaims.** The caption says "Brief, plan and 3D on a phone" but the phone shows only 3D. Fan three phones (`appMobileSetup`, `appMobileDesign` and `appMobileExplore` are already in `assets.js`, unused), or change the caption to "3D on a phone".
- **Two near-identical frames.** "3D" (`engine-interior`) and "Walk" (`viewer-walk-hud`) show the same lounge and stair from similar angles. Swap 3D for `renderDollhouse`, which is unused and shows every room furnished.
- **One-line title** floats at y ≈ 220 (see Global: title anchoring).

### 06 · Argon designs in code, not pixels

**What works:** this is the most important slide for the 40% Technical Merit criterion, and the plan, build and stream pipeline is clear.

- **Arrow lands on a corner.** The Brief → Plan arrow sits at SVG y = 150, the Plan box's bottom edge, so it points at the corner between Plan and the LDA engine. Centre the Brief box on Plan (`y = 29`, height 92) and draw the arrow at `M200 75H262`.
- **Cramped LDA engine box.** Its third line is 12 px from the bottom edge, against 24 px side padding. Grow the box to 116 px tall, or drop the third line (the date is already in the footer of slide 2).
- **Stream card (P1 #7).** Five full black bars at 100% say "done" five times. Replace them with four 150 × 90 thumbnails captured from the viewer's layer toggles, labelled in 15 px mono. That card is the visual proof of "streamed".
- **Accent sprawl.** Cobalt appears on step "1", step "3", the fix arrow, the `facade_stone_pier` chip (in HUD accent) and the "streamed · editable · PBR" caption. Keep it on the fix loop only, and set the step numbers to ink-3.
- **Unmatched before/after.** The spike crop is tight, warm-skied and angled, while the SDK render is frontal and cool, so the "jump in fidelity" also looks like a change of camera. Re-capture the spike from the same camera and crop as `engine-argon-front`. Make the captions parallel: "One block · 1,780 lines · 481 s" against "23–25 sections · streamed · PBR".
- **Missed moment.** Slide 3 shows the real `facade_stone_pier` code, and this render shows that pier. Outline the pier in the render with a 2 px cobalt stroke and run a leader to a one-line code tag: "this section → this pier". That single device sells "code, not pixels" better than the four-item list.
- **Three bands.** Diagram, before/after and four benefits use three visual languages. If space is needed for the above, fold the four benefits into the speaker notes or into one 18 px line.

### 07 · Trust

**What works:** the compliance colours are used exactly where the brand allows them, and the 5 → 1 → 0 hero is memorable.

- **Density.** The slide has four zones (engine, livable rules, self-review, stair strip) and about 300 words. Move the stair before/after into the livable column as the illustration for "A railing at every drop". Cut "Why safety is deterministic" to one sentence: "We audited three of our own houses. All three had stair-safety defects, one a 22 ft drop with no railing." That deletes the bottom band and frees about 200 px.
- **Notes have no anchors.** The three self-review notes float with no leader lines, and they hide room labels ("DINING", "TV LO…", "…ce Space"). Put 24 px numbered markers on the rooms (the brand's pin style), move the notes into a 220 px column beside the plan, and connect them with 1 px ink-3 leaders. Alternatively, keep them as overlays but place them over hatching or open space, never over labels.
- **Zero is drawn as a bar.** The fix bar gives "0" a 0.25fr green pill, so zero violations gets a visible length. Replace it with a 12 px green dot or a tick, and change the label "3" to "check 3 · 0".
- **Mixed status (P0 #5).** "5/5 livable" sits under "LDA engine · live".
- **Stair diagram too small.** The diagram is 420 × 170 with 13.5 px labels. Scale it to 1.3× and set the labels to 16 px.
- **Small notes.** `.s-trust .note` is 15 px with a 12.5 px title. Raise to 17 px and 14 px.

### 08 · Agentic revisions

**What works:** this is the best-composed technical slide. A clear loop, one accent box on `check_plan_ops`, and three result cards with honest status chips.

- **Pins too small.** In the screenshot the pins are about 16 px and the tooltip text about 10 px, so the slide's subject ("comment in 3D") is the least legible thing on it. Re-crop `viewer-comment-pins` tighter on pins 1 and 4 (about 1.5×), or overlay pins drawn in the deck at 28 px with white rings, the same component as slide 9.
- **Murky image.** The screenshot is darker and lower-contrast than every other image. Lift the exposure about 10% at re-capture.
- **Small diagram text.** Tool names, "ops", "pass/fail" and "next comment" are 13.5 px mono. Raise to 16 px. At that size, "apply_plan_ops · write_section · remove_section" overflows its 412 px box. Break it onto two lines, grow the four step boxes from 78 to 92 px, and grow the loop SVG from 600 to 660 px tall; there is room above the footer.
- **Small result text.** `.s-adk .res .a` is 16.5 px. Raise to 18 px.

### 09 · Collaboration

**What works:** the v2 brand is applied correctly (author hues, 28 px avatars, feasibility chips, segmented control). This is how slides 4, 5 and 8 should look after the re-shoot.

- **The house is hidden.** The Share dialog and the Comments sheet are open together over a 30% scrim and cover about 80% of the house. DESIGN.md says surfaces never stack. Show the client view, with the comment sheet and pins over an un-scrimmed house. Shrink the Share dialog to 380 px and dock it bottom-left, overlapping the frame edge by 40 px so it reads as an inset, not a modal.
- **Pins don't match their comments.** Pin 3 (Hira, "Lounge") sits on the street, and pin 1 (Sana, "Porch") sits high on the stone pier. Put pin 1 on the porch roof and pin 2 on a first-floor window. Re-anchor Hira's comment to "Facade · Louvers" (it is about the louvers) and pin it on the teak fins.
- **Inconsistent status marker.** Here it is a dark HUD chip ("Design · ships in the 18 Oct build"). Slide 7 uses the outlined amber-dot `.soon` chip, and slide 10 uses bare amber text. Use one component everywhere (see Global).
- **Kicker repeats the list.** It restates the five-row list, and the mock shows it a third time. Drop the kicker.
- **Floating contrast line.** "For contrast: Maket…" sits about 150 px below the list. Hang it 24 px under the last list rule, or align its baseline with the mock's bottom (y = 984).

### 10 · Architecture on Google Cloud

**What works:** browser on top, one Cloud Run box with six modules, and a services row: the right structure. The single cobalt loop is good accent discipline.

- **Text shrinks.** The SVG `viewBox` is 1180 × 700, drawn into 1112 × 660, a scale of 0.942. So `.t-m` renders at 12.7 px, the model chips at 12.2 px and `.t-s` at 13.2 px. Either set the viewBox to 1112 × 660 and re-lay it out at 1:1, or raise the sizes (`.t-m` 17, `.t-s` 17, chip text 16) to land at 16 px after scaling.
- **Misleading arrows.** The four arrows to services drop from fixed x positions under modules, so Identity Platform hangs off the LDA engine. Replace them with one 1.5 px bus line under the Cloud Run box at y = 548, with four drops to the services. Or draw true edges: Setup, Concepts, Architect and Reviser to Vertex AI; Concepts to Cloud Storage.
- **Invisible second loop.** The Reviser↔LDA arrows are 14 px long (`M774 426H788`). The speaker notes call the loops "the interesting part", so draw this one at the same cobalt weight as the Architect loop.
- **Callouts repeat the diagram.** Three of the four right-hand callouts (detached runs, the global endpoint, screening) say again what the boxes say. Keep "One service, one URL" and replace the others with rationale that isn't in the diagram, or cut the column and widen the diagram to 1680 px, where the text can run at 18 px.
- **GenAI backbone underplayed.** Vertex AI has the same weight as Firestore. Give it the accent-soft fill, or list the three model IDs inside the Vertex AI card, so the Gemini story reads at a glance. Optionally, use official Google Cloud architecture icons for the four services, after checking Google's icon guidelines.

### 11 · Technical depth

- **Repeated numbers.** Every figure in the numbers row already appeared on slides 4, 7 and 8. `5 → 1 → 0` now appears three times and `42–50` five times. Delete the row, or make this the single numbers slide and remove the numbers from the others.
- **Wall of text.** Eight paragraphs at 18.5 px (about 250 words). Redraw it as one horizontal request lifecycle, with each guardrail as a tag where it acts:
  - Vertex AI call: retries, 6 attempts, 4–60 s
  - Stream: degenerate-decoding watch
  - Section screen: 21 banned patterns
  - Browser run: self-healing section
  - As-built check: chajja allowance
  - ADK: fallback reviser

  Draw "Detached runs" as a bracket under the whole lane. Every fact is already on the slide. This is the diagram that earns Technical Merit.
- **"Honest numbers" is an internal note.** Move it to the speaker notes.
- **Empty bottom.** The band from y ≈ 910 to 1010 is empty while the text above is cramped. Spread the content out.

### 12 · Naqsha vs maket.ai

**What works:** the accent-soft Naqsha column, the fair "tested 16 Oct" framing, and the honest Speed row.

- **Insets prove nothing (P1 #10).** At 330 × 200 you can't see that the house is wider than the plot. Enlarge them to 380 × 240. On the maket crop, draw a 2 px fail-red bracket across the house ("59′6″ house") and a dashed ink line at the plot width ("50′ plot"). On the Naqsha crop, make sure the setback dash is visible at that size. Use the same frame, crop logic and caption style for both.
- **Different head layout.** The title top is at y = 132 with the kicker under it, unlike every other slide. Use the shared top anchor (see Global).
- **Unbalanced columns.** "Sketch + contractor" is 330 px wide for answers of one to three words, while the maket column wraps to two lines. Change the col widths to 260 / 620.
- **Invisible row rules.** `#E4E4DF` on the canvas is 1.18:1. Use `--line-strong` for table rules.
- **Duplicate crop.** The Naqsha inset is almost the same as slide 5's Plan crop. Use `appDesignLive` (unused), or the v2 plan.

### 13 · Impact and business model

- **Caption collision.** Under the expansion chips, "its own 2020 rules" ends at x ≈ 1456 and "Aug 2026 bylaws," starts at 1464, so they read as one run. Break the MDA caption onto two lines ("its own / 2020 rules"), as the DHA and Bahria captions already are. Hold every caption to its chip's width plus 16 px. There is no horizontal room to widen the gaps, because the strip already spans the 820 px viewBox.
- **Two accents.** The solid LDA chip and the "Per home" heading and border are both cobalt. Keep the LDA chip, and make "Per home" ink with an `--accent-line` border only.
- **Unfinished-looking pricing.** "price to validate" appears twice. Without inventing prices, say who pays and for what unit: "per home, paid by the family" and "per seat, paid by the firm". Keep "no prices set yet" once, in the label above.
- **Dead space.** The left column ends at y ≈ 760 and the right at y ≈ 850, leaving about 170 px empty above the footer. Either pull the footer content up or give the audience rows 28 px vertical padding.
- **Overclaiming title.** "Ready for all of Punjab" says more than the slide shows, which is a path. Try: "Free to imagine. Paid to build. A path across Punjab."

### 14 · Roadmap

- **Generic title.** "Roadmap" is the only headline in the deck that isn't an assertion. Try: "Livable, shareable and printable on 18 Oct. Punjab next."
- **Empty card bottoms.** The cards stretch to y = 968, leaving about 130 px of white under Next and about 180 px under Later, a template look. Set `.s-road .cols { bottom: auto; align-items: start; }` so the cards hug their content, or give all three equal content.
- **Decorative timeline.** The dots carry no labels, and they sit 8 px into the first card but 13 px into the other two. Label them ("18 Oct build", "Next", "Later") and put each one exactly 34 px in, matching the card padding, or delete the timeline.
- **No status in "Now".** Mark each item with the shared status component (live vs shipping 18 Oct). Judges will test the live URL against this list.

### 15 · Close

- **Placeholders (P0 #1).**
- **Text over architecture.** The gradient goes from 100% to 25% between x = 576 and 1152, so window frames and the tree show through behind the links and the "Our ask" list. The hairlines under the ask run to x = 1020, into the tree. Move `.s-close .bgimg` to `left: 760px`, end the solid canvas at 50% with a fade to 0 by 62%, and cap `.s-close .content` at 760 px.
- **Jaundiced render.** The `sepia(.10)` filter plus the multiply "dusk" layer makes the render look jaundiced rather than dusk-lit. Use the night concept once day/night ships. Until then, drop both and use the clean render.
- The 86 px headline bookending the cover tagline is right. Keep it.

---

## Global

### 1. Legibility floor (P0)

When a 1920 px slide is viewed in a PDF on a 1366 px laptop, it renders at 0.71×: 13.5 px becomes 9.6 px, 16 px becomes 11.4 px and 20 px becomes 14.2 px. Set these minimums:

| Element | Selector | Now | Set to |
|---|---|---|---|
| Diagram mono labels | `.dg .t-m` | 13.5 px (12.7 on slide 10) | 16 px |
| Diagram captions | `.dg .t-s` | 14 | 16 |
| Diagram body | `.dg .t-b` | 16 | 18 |
| Diagram model chips | inline `font-size:13px` on slide 10 | 13 (12.2 after scale) | 16 |
| Labels and eyebrows in content | `.label` | 15 | 16 |
| Footer | `.foot` | 15 | 16 |
| Journey engine line | `.s-journey .stop .eng` | 13.5 | 15 |
| Fix-loop labels | `.s-trust .fixlbl` | 14 | 16 |
| Self-review notes | `.s-trust .note` / `b` | 15 / 12.5 | 17 / 14 |
| Result and benefit body | `.s-adk .res .a`, `.s-code .why .small`, `.s-impact .tier .small` | 16–16.5 | 18 |
| List and table body | `.s-problem .rules li`, `.s-trust .liv li`, `.s-depth .guards p`, `.s-vs table` | 18–18.5 | 20 |
| Chips | `.chip`, `.s-why .tools .chip` | 14.5–16 | 16 |

UI mocks (slide 9) can stay at UI scale, since they depict an interface, but nothing that carries the argument should be under 16 px.

### 2. Grid and alignment (P1)

- **Adopt a 12-column grid:** 120 px margins, 1680 px content, 24 px gutters, giving 118 px columns. Columns start at 120, 262, 404, 546, 688, 830, 972, 1114, **1256**, 1398, 1540.
- **Put the kicker on column 9** (x = 1256, 4 columns = 544 px), and start every right-hand block there too. Today's right-hand blocks start at 1148, 1261, 1290, 1300 and 1310 on slides 2, 3, 7, 8 and 10, close to each other but never equal. On slide 3, three 4-column cards would start at 120, 688 and 1256.
- **Title anchoring.** Change `.head` from `bottom: 790px; align-items: end` to `top: 140px; align-items: start`. Every title's cap line then sits at the same y. One-line titles get their air below, where it reads as a pause, instead of above, where it reads as the title sinking. Slide 12 should use the same anchor.
- **Use 24 px or 32 px for every frame radius.** Today there are five radii: 20 (slide 12 insets), 22 (slide 5), 24 (slides 4, 6, 7, 8), 28 (slide 9) and 32 (cover). Use 24 px for thumbnails up to 300 px tall and 32 px (`--r-media`) for hero media.

### 3. Colour discipline

- **Accent.** One accent per slide holds on 1, 2, 4, 8, 10, 11, 12, 14 and 15, but breaks on 6 (five cobalt uses) and 13 (two). Fixes are listed per slide.
- **Hairlines.** `--line` `#E4E4DF` on the canvas is 1.18:1, and row rules on slides 2, 9, 11, 12, 13 and 14 will vanish in a compressed PDF. On the canvas use `--line-strong` `#CFCFC8`, and keep `--line` for inside white cards.
- **Ink-3.** `#6E6E73` on the canvas is 4.68:1, which is fine at 16 px and up and marginal below. That is another reason for the floor above.
- **Ink-4.** The dashed underline on the slide 15 placeholders uses ink-4 (2.38:1). That goes away once the placeholders are filled.

### 4. Imagery (P0/P1)

- **v1 vs v2.** Re-shoot slides 4 (Brief, Plan, Revise), 5 (all), 7 (plan), 8 (pins HUD) and 12 (Naqsha inset) from v2. `assets.js` is already set up for a one-line swap per asset.
- **Over-used images.** `renderFront` is used 4 times (1, 4, 6, 15) and `appDesign` 4 times (4, 5, 7, 12). Seven strong assets are unused:
  - `renderDollhouse`: the stream filmstrip on 6, or 3D on 5
  - `appConcepts`: the Concepts stop on 4
  - `appDesignLive`: check 1 failing, the natural "before" for slide 7's fix loop
  - `appMobileSetup` and `appMobileDesign`: the phone fan on 5
  - `conceptPro` and `conceptNano`
- **Crop to the claim.** Every screenshot should be cropped so the thing in the caption is at least 30% of the frame. Slides 5 (Brief, Plan) and 12 (insets) fail this.

### 5. Diagram craft

- **Diagrams are consistent.** Slides 6, 8 and 10 share box radii, stroke weights and markers. Keep that.
- **Arrowheads are too small.** The markers are 9 px chevrons on 1.5 px lines. At PDF scale, use `markerWidth`/`markerHeight` 12 and a 1.75 px stroke.
- **Arrows must start and end on box edges at their centre lines.** Failures: slide 6 (Brief → Plan, which hits a corner), slide 4 (the return loop touching a dot), and slide 10 (service drops that aren't tied to modules).
- **Labels belong next to their marks.** Slide 13's captions are wider than their chips and collide. Slide 7's notes have no leaders.

### 6. Consistency

- **One status component.** "In the 18 Oct build" appears three ways: the outlined `.soon` chip with an amber dot (slide 7), a dark HUD chip (slide 9) and bare amber text (slide 10). Use `.soon` everywhere, including on roadmap items and the slide 7 hero chip.
- **Typographic primes.** DESIGN.md specifies `35′ × 65′`, but the HTML uses `&#39;` and `&quot;` (straight marks) on slides 1, 2, 7, 8, 12 and 13. Replace them with U+2032 ′ and U+2033 ″.
- **Nastaliq in the mark.** `.mark .ur` is 17 px beside 22 px Latin, and it reads as a squiggle. Set it to 26 px with a `translateY(-1px)` adjustment.
- **Footers.** Repo paths ("docs/spikes/README.md", "docs/research/maket-teardown.md") read like internal notes in a PDF. Write "Source: spike log, public repo" or "Source: maket.ai teardown, 16 Oct 2026", and keep the paths in the speaker notes. Fill in the GitHub URL once it exists.

### 7. Density and repetition

| Slide | Visible words | Target |
|---|---|---|
| 1 | about 90 | fine |
| 2 | about 240 | 150 (cut 4 rules and the duplicate kicker) |
| 3 | about 200 | 160 |
| 4 | about 170 | fine |
| 5 | about 105 | fine |
| 6 | about 220 | 160 (fold the four benefits) |
| 7 | about 300 | 170 (merge the stair band) |
| 8 | about 175 | fine |
| 9 | about 260 | 170 (drop the kicker, trim the list) |
| 10 | about 230 | 170 (cut duplicate callouts) |
| 11 | about 250 | 120 (as a lifecycle diagram) |
| 12 | about 255 | 200 |
| 13 | about 230 | 170 |
| 14 | about 135 | fine |
| 15 | about 85 | fine |

Kickers that restate the title or the body (slides 2, 9, 11) should go. A kicker earns its place only when it adds a fact or a stance.

### 8. Rhythm across the deck

Thirteen consecutive slides share the same head and footer skeleton, and only 1 and 15 break it. Add one or two full-bleed "breather" moments in the middle so the deck has pacing. Two good candidates:
- **Slide 5** as a single full-bleed walk frame with three callouts, instead of a seven-up contact sheet.
- **Slide 8,** with the 3D pin image running the full height on the left half.

Optionally, move slide 12 (the comparison) to directly after slide 5, so "why us" lands before six slides of engineering.

---

## Pre-export checklist

- [ ] Slide 15 placeholders filled (GitHub, demo, ask, team).
- [ ] All app screens are v2, or cropped free of v1 chrome.
- [ ] Slide 4 Brief shows a 35′ × 65′ plot.
- [ ] Slide 7 chip no longer presents "5/5 livable" as live, unless it is.
- [ ] Every "in the 18 Oct build" item has been checked on the live URL and uses the `.soon` component.
- [ ] Type floor applied: no argument-carrying text under 16 px.
- [ ] Primes (′ ″) everywhere.
- [ ] Re-render with `?static=1` and check slides 4, 6, 10 and 13 for collisions after the size changes; the SVG boxes will need widening.
