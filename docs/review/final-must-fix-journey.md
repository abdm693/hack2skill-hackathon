# Final must-fix journey: live revision 8

- **Date:** 17 Oct 2026, about 11:15–12:10 PKT. The prototype is due 18 Oct.
- **Tester:** final must-fix journey agent. I used one tab of the built-in browser (closed at the end, viewport reset) and headless Chrome over CDP for high-resolution captures and PDF output. I changed no code and created no accounts.
- **Build under test:** https://naqsha-242926648187.us-central1.run.app. `gcloud` shows `naqsha-00008-6qt` serving 100% of traffic, with bundle `assets/index-BaiWuXqd.js` and `index-DL4JPf2l.css`.
- **Screenshots and PDFs:** `docs/review/final-must-fix-journey/`

## Verdicts

| # | Must-fix | Verdict | Evidence |
|---|---|---|---|
| 1 | Landing: house-under-construction animation, large heading, business features, separate Portal button | **FIXED** | See 1 below. `landing-anim-1s/3s/5s/12s.png`, `landing-features.png`, `landing-bottom.png`, `mobile-landing-*.png` |
| 2 | No dated top stage bar anywhere; modern minimal design and a better colour theme | **FIXED** | See 2. `sample10-{brief,concepts,plan,house,walk,revisions-route}.png`, `mobile-plan.png` |
| 3 | Sign up and sign in exist (UI only) | **FIXED** | See 3. `auth-signin.png`, `auth-signup.png` |
| 4 | Setup understands one rich message, with a per-floor program and the tank and solar questions up front | **FIXED** | See 4. `setup-after-one-message*.png`, `setup-floors-editor.png`, `setup-short-msg-floors-question.png` |
| 5a | Concepts are not all corner plots on a mid-row plot | **FIXED for new briefs (7 of 8 mid-row); NOT FIXED on the flagship sample (2 of 4 corner, including the Chosen one)** | See 5. `new-midrow-concepts-day-grid.jpg`, `new-midrow-concepts-E-H-day-night.jpg`, `sample10-conceptA-B-corner-roads.jpg` |
| 5b | Day/Night toggle for a like-for-like comparison | **FIXED** | See 5. `new-midrow-concepts-day-night-pairs.jpg`, `new-concepts-night-ui.png` |
| 6 | The layout prints or saves as PDF (`?dialog=print`, sheets inspected) | **FIXED** | See 6. `print-dialog.png`, `print-preview-A3.png`, `print-pdf-a3-contact.jpg`, `print-pdf-a4-contact.jpg`, `sample10-A3.pdf`, `sample10-A4.pdf` |
| 7 | Autosave survives a reload mid-brief | **FIXED** | See 7 (three reloads, each restored completely) |

## 1. Landing page: FIXED

- **Heading:** "Walk through your home before the first brick." The computed `h1` is 108px at 1440 wide. It still dominates the screen at 390 wide (`mobile-landing-top.png`).
- **Portal:** a black pill, top right of the header, links to `/app`. Two more Portal links appear in the builders band ("For builders and architects: win the client in the first meeting.") and in the footer.
- **Construction animation:** an inline SVG elevation inside a `rounded-media` frame, with no three.js. The largest SVG on the page is about 39 KB. I sampled it in real time in headless Chrome:
  - 0.4–1.2 s: the plot chip counts "30′ × 56′", then "35′ × 65′ · mid-row".
  - About 3 s: the blue "LDA envelope · 45′ max" dashes in; the slab, columns and floors rise; hatched walls fill; the crane jib swings; the chip reads "Structure, floor by floor" (`landing-anim-3s.png`).
  - About 5 s: solar panels and the blue tank appear on the roof.
  - About 12 s: the frame wipes to the sample's night render with "By night" and "● 36 LDA checks · 12 livable" (`landing-anim-12s.png`).
  - Replay works.
- **Features:** a 3×2 grid, each with a heading, one line and no icons (`landing-features.png`). All six are business outcomes:
  - Plot to approval-ready plan the same afternoon
  - Checked against LDA, every time
  - Walk your home before you build it
  - Share with family and your architect
  - Revisions in minutes, not weeks
  - Drawings your contractor can use

  Then come "How it works" (Brief · Concepts · Plan · House), two sample cards and the builders band.
- **Phone width:** at 390 wide there's no horizontal scroll (`scrollWidth` 390).

## 2. No stage bar; modern theme: FIXED

- **No stage bar:** every project view is the floating layout from DESIGN.md:
  - top left, the title capsule (← name, "v2 · 36/36 LDA · 10/15 livable · 5 to check", menu);
  - top centre, the segmented view switch **Brief · Concepts · Plan · House**;
  - top right, Comments and Share;
  - bottom centre, the dock: Naqsha's line, then Ask with the Next pill.

  Brief, Concepts, Plan, House (Orbit and Walk) and Revisions all have no numbered steps and no "Step n of n". The old routes redirect: `/setup` → `/brief`, `/design` → `/plan`, `/explore` → `/house`. `/revisions` renders the Versions view without a bar.
- **New projects:** the view switch shows only the views that exist ("Brief" alone, then "Brief · Concepts").
- **Walk:** the old top "Orbit/Walk + Ground/First/Roof/All" pills from the user's screenshots 1–5 are gone. Orbit, Walk and View sit at bottom left, the floor stack R · 1 · G · All on the left edge, and Rooms and Comment at bottom right. After idling, only the room pill and Comment remain (`sample10-walk.png`). The key-legend strip and the red "Finish walkthrough" pill from the original screenshots are gone.
- **Theme:**
  - The live CSS tokens match DESIGN.md: `--color-canvas #f6f6f3`, `--color-accent #2747f5`, `--color-ink #111113`, `--color-hud #18181b`, `--font-sans "Geist"`.
  - There are no leftovers of Fraunces, `drafting` or `brick` in the CSS.
  - The UI is calm and light, with one cobalt accent button per screen.

## 3. Sign up and sign in: FIXED (UI checked; no account created)

- **Where:** "Sign in" appears in the landing header, the footer (`/app/signin`) and the workspace ("Guest · saved in this browser · Sign in", plus "Save your work to an account").
- **Sign in:** a 440px dialog with Email, Password (with a show/hide eye), the primary **Sign in** button, "New here? Create an account", "Forgot password?" and "Or keep going as a guest. Your homes stay in this browser."
- **Create account:** the same dialog with "Your name, as clients will see it", Email and Password ("At least 6 characters.", `autocomplete=new-password`) and the primary **Create account** button.
- **Backend config:** `GET /api/config` returns an `auth.api_key` and a `project_id`, so the dialog is wired to Identity Platform. I didn't submit either form.

## 4. Setup understands one message: FIXED

**Run A: one rich message.** I sent it from the workspace composer:

> 10 marla plot in Wapda Town, Lahore, 35 x 65 ft, mid-row with houses on both sides, the front faces east. We are a family of six: my wife and I, three kids and my mother. Ground floor: drawing room, kitchen plus a dirty kitchen, and a bedroom with attached bath for my mother so she avoids stairs. First floor: master bedroom with dressing, two kids' bedrooms with attached baths and a TV lounge. We would like a small prayer room and a one-car porch. Modern style.

The project is `p_f635a2870357`.
- **"You said" card, within about 6 s:** 10 marla · 35′ × 65′, Mid-row, Wapda Town, Faces east, 2 storeys, 4 bedrooms, 4 baths, 1-car porch, Modern Contemporary.
- **Guaranteed:** LDA plus the livable rules. **Preferences:** "Mother's bedroom on ground floor so she avoids stairs" and "Family of six".
- **Parsed per-floor program (API):**
  - Ground: drawing, kitchen, dirty_kitchen, bedroom:1, bath:1, prayer.
  - First: master_bedroom:1, dressing:1, bedroom:2, bath:3, lounge.
  - Car porch 1.
- **Plot canvas:** mid-row, with sides 0′ · 5′ and the north arrow rotated correctly for an east-facing front.
- **First question:** the **water tank** and **rooftop solar** were asked together, up front:
  - Tank picture cards: "Blue plastic tank" or "Concrete tank in the stair tower" (Recommended).
  - Solar: "Keep the roof clear for solar (about 18 panels, ~10 kW)", "Raised solar frame" or "Not now".
  - The note "No domes, minarets or chhatris unless you ask for them."
  - (`setup-after-one-message*.png`)
- **After answering:** I picked plastic plus a raised frame. Naqsha said "Here's what I understood. Tap anything I got wrong; when you tap Show me concepts…", and the brief shows Roof: "Plastic tank · Solar frame".
- **Per-floor editor:** Floors › Edit floors opens "Rooms on each floor". It has a storeys segmented control, Ground/First/Roof tabs, a meter ("1,235 of 1,440 sq ft") and steppers for 20 room types (`setup-floors-editor.png`).

**Run B: a short message**, to see whether the floors question is asked. I sent "1 kanal in DHA Phase 5 Lahore, mid-row, north facing, family of five with grandparents" (`p_0ad1e97f8170`).
1. Naqsha asked about storeys (DHA limits shown).
2. It asked "How many bedrooms, and which rooms do you need?" with the per-floor editor inline. The editor was prefilled with 5 bedrooms and 1 bed on the ground floor for the grandparents (`setup-short-msg-floors-question.png`).
3. After "Use these floors", it said "Got the rooms for each floor. Which water tank should the roof have?", with the tank and solar cards. The solar size scaled to the plot (about 37 panels, ~20 kW).

So tank and solar always come before style and concepts.

## 5. Concepts on a mid-row plot, and Day/Night

**New mid-row project (`p_f635a2870357`):**
- **The prompt:** "Show me concepts" built four concepts in about 30 s. Each prompt says "It is a MID-ROW plot (NOT a corner): neighbouring houses stand directly against both side walls, there is no side street… never a corner or three-quarter view."
- **First four:**
  - A, B and D are mid-row, with neighbours on both sides.
  - **C "Interlocking Frames" shows a side street curving away on the right, with the car porch open to it.** It reads as a corner or end plot (`new-midrow-concepts-day-grid.jpg`, bottom left).
- **Four more (E–H):** all four are mid-row (`new-midrow-concepts-E-H-day-night.jpg`).
- **Result:** 7 of 8 are mid-row. That clears the original complaint ("concepts always a corner plot") for new homes.

**The flagship 10 marla sample (`p_5a5893a2bcaa`, mid-row in its brief):**
- **Concept A ("Cantilevered Monolith") and Concept B ("Screened Travertine Courtyard")** both show a side road curving off to the right of the house. Each is visibly a corner plot (`sample10-conceptA-B-corner-roads.jpg`).
- **B is marked "Chosen"**, so the plan follows it, and it's the hero image on the printed cover sheet (`print-preview-A3.png`).
- C and D are mid-row.
- **Villa sample (`p_1a42e70989af`):** all four are mid-row.
- **Result:** anyone opening the sample sees the exact problem the user reported.

**Day/Night:**
- **Toggle:** the Concepts header has a **Day | Night** segmented control (`radio "Night (N)"`). It writes `?light=night`.
- **First toggle:** the four night images were generated lazily and in parallel. All four `-night.png` files were in place within about 20 s, and they are cached.
- **"Four more":** started while Night was on, it produced the night variants of E–H too.
- **Like-for-like:** every night image keeps the day image's camera, framing, house, neighbours, car and planting, changing only the light (`new-midrow-concepts-day-night-pairs.jpg`, `new-midrow-concepts-E-H-day-night.jpg`).

## 6. Print and save as PDF: FIXED

I ran these on a fresh clone of the 10 marla sample (`p_d7a9f16c8cca`).
- **The dialog:** `…/plan?dialog=print` opens "Print or save as PDF" (`print-dialog.png`) with:
  - Paper A3 or A4. The copy changes to "Floors print at 1:150" when A4 is chosen.
  - Floor toggles G, 1 and R.
  - "Cover with concept and areas" and "Compliance report".
  - Cancel, **Preview** and **Print 5+ sheets**.
- **Preview:** an in-page overlay of landscape sheets. None of the 6 A3 sheets has an element outside the sheet bounds. (The round 3 live build had 22, 14 and 61 elements spilling out.)
- **Real PDFs:** I let the app mount its print layer and called Chrome's `printToPDF` with the app's `@page` CSS.
  - **A3 PDF:** 6 pages, 1191 × 842 pt (A3 landscape): cover, ground, first, roof, compliance, compliance continued (`print-pdf-a3-contact.jpg`).
  - **A4 PDF:** 7 pages, 842 × 595 pt (A4 landscape) (`print-pdf-a4-contact.jpg`).
  - Both PDFs are saved next to the screenshots.
- **Every sheet has:**
  - the wordmark and sheet title;
  - a title block (project, plot, location, version and date, "Prepared by Naqsha, for the owner", sheet "A-101 · 2 of 6", scale);
  - a north arrow, a scale bar and a room schedule.
- **Scale:** the plot outline measured in the PDF is 198.1 × 106.7 mm on A3, exactly 65′ × 35′ at 1:100. On A4 it is 132.1 mm (1:150, as labelled). The A3 scale bar's 0–20 ft span measures about 60 mm (61 mm expected).

## 7. Autosave: FIXED

- **Reload 1:** with the tank and solar question unanswered, I reloaded. The message, the "You said" card, the per-floor program and the unanswered tank and solar question all came back.
- **Reload 2:** I clicked Continue on plastic plus a raised frame and reloaded 1.5 s later, mid-reply. After the reload, the brief had Roof: "Plastic tank · Solar frame", and Naqsha's "Here's what I understood…" reply was in the thread. The server finished the turn.
- **Reload 3:** I added the wish "Large windows facing east" and reloaded 300 ms later. The wish was still there.

## Other issues found

| # | Severity | Issue |
|---|---|---|
| 1 | **Major** | **The flagship 10 marla sample's concepts A and B are corner plots, and B is the Chosen one.** It also appears as the print cover. Regenerate A and B with the current mid-row prompt, or re-pick C or D, before the demo. Repro: Workspace › Samples › 10 marla › Concepts, or `GET /api/samples` and open `c_1f43b123ec11` and `c_0026dc7358eb`. |
| 2 | **Major** | **The samples don't show as passing every livable check.** The status line reads "v2 · 36/36 LDA · **10/15 livable · 5 to check**" for the 10 marla and "v2 · 43/43 LDA · **10/18 livable · 8 to check**" for the villa. The dock says "5 (or 8) livable points need a look". The API has no fails, but 5 and 8 `warn`s (door width 2′6″, wet-over-dry Bath 2, and architect-review notes such as "no powder room on the ground floor" and "Bath 3 is a 6 × 18 tunnel"). This contradicts "both pass every LDA and livable check", and it's the first line a judge reads. |
| 3 | Minor | **The mid-row prompt is not always obeyed:** 1 of 8 fresh concepts (C "Interlocking Frames", `p_f635a2870357`) shows a side street. There's no check after generation. |
| 4 | Minor | **The cover area schedule contradicts itself:** "Total covered 2,762" (1,440 + 1,203 + 119), but "Floor area ratio 1:1.05" (2,382 / 2,275). One of the two uses a different area basis. |
| 5 | Minor (copy) | **The floors editor reads "4 bedrooms in all · LDA allows up to 3"** (or "5 bedrooms in all · DHA allows up to 2"). The limit is storeys, but it reads as a bedroom limit. |
| 6 | Minor (copy) | **The solar and tank wording drifts:** "You said" shows "Solar panels" while the brief and the concepts subtitle say "Solar frame". The tank question's text says "underground and overhead concrete tank", but the card says "Concrete tank in the stair tower". The concept prompt for "Raised solar frame" says "a low steel frame". |
| 7 | Minor | **Opening a sample can land on a stale clone:** with a clone already in the workspace, the sample opens that clone even if it was renamed and changed. This guest landed on "Collab QA final · 10 marla" with 3 QA comments. That's per contract (no duplicate clones), but it's confusing. |
| 8 | Minor (a11y) | **The "Double storey" option's accessible name** is only its caption, "DHA allows ground + first, plus a basement". |
| 9 | Polish | **At 1440 × 900 only about a third of the animation frame is above the fold.** It waits until it's in view, so without scrolling the visitor sees an empty outline. |
| 10 | Polish | **On Replay, the plot chip flashes "Plot -2′ × -3′"** (spring overshoot below zero) before counting up. |
| 11 | Polish | **The inline per-floor editor makes the conversation 2,144px tall**, with "Use these floors" about 1,500px down. Collapsing the 0-count rooms would help. |
| 12 | Polish | **On a 390px plan, "Gate" overlaps "Lawn" and "Car gate" overlaps "Driveway"** (`mobile-plan.png`). |

There were no console errors in the tab during the journey.

## Test data I created

- **Built-in browser guest** `7c27b88c-…`, shared with earlier testers:
  - `p_f635a2870357`, "10 marla home, Wapda Town": the brief is complete, with 8 concepts and night variants, and no concept chosen.
  - `p_0ad1e97f8170`, "1 kanal home, DHA Phase 5": stopped at the tank and solar question.
- **Fresh headless guest** `3426a3d1-232c-4eb0-9125-9b49157210c9`:
  - clone `p_d7a9f16c8cca` (10 marla sample);
  - clone `p_9885dc8a6cc3` (villa).
