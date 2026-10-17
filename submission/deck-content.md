# Naqsha · نقشہ: submission deck content

Copy for every slide of the official **Submission Template _ AI Builder Cup.pptx** (16 slides, 16:9), in template order. The final submission is a PDF; build the deck in HTML on the template's look (black header bar, black footer bar, Google Sans Flex) and export it.

- **Product:** Naqsha (نقشہ, "house plan"). Live: https://naqsha-242926648187.us-central1.run.app (Cloud Run service `naqsha`; the screens were captured from revision `naqsha-00009`).
- **Track:** Theme 5, Future of Work & Enterprise Productivity.
- **Industry disrupted:** Architecture, Engineering & Construction (AEC) and residential real estate. Pakistan first, then worldwide.
- **Scope and the prototype:** any development or land authority's bylaws load as data. The prototype ships Punjab's LDA (Lahore) rules, plus DHA, Bahria, RDA, FDA, MDA and GDA on the LDA baseline. Adding a city starts with adding its rules. Present LDA as the prototype's first rule set, never as the product.
- **Team:** Pivot Analytix. Team leader: Abdullah Moazzam. Members: Saad Wali Muhammad Joiya, Usama Bin Maalik.
- **Agentic harness: Google ADK** (Agent Development Kit 2.12): 2 agents, 14 tools. The setup agent (Gemini 3.8 Flash, 5 tools) and the revision agent (Gemini 4 Argon, 9 tools) run on ADK; the Gemini 4 Argon architect pipeline (plan → rules fix loop → multimodal self-review → design.js) runs on google-genai. Name ADK as the agentic harness wherever the agents appear.
- **Placeholder still to fill:** `{{VIDEO_URL}}` (slide 14), with `python3 submission/fill_tokens.py --video-url "https://..."`. The GitHub repo is public.

---

## Build notes (all slides)

**Template geometry.** The slide is 9144000 × 5143500 EMU (10 × 5.625 in). For an HTML build at 1920 × 1080 px, 1 px = 4762.5 EMU.

| Element | EMU | 1920 × 1080 px |
|---|---|---|
| Header bar image (Google Cloud · AI Builder Cup · H2S) | y 0–507359, full width | y 0–107 |
| Slide heading text box | x 265350, y 663825; 16 pt Google Sans Flex Medium | x 56, y 139; about 43 px |
| Content area (use this for every body) | x 265350–8879000, y ≈ 1.03M–4.98M | x 56–1864, y 215–1045 (1808 × 830) |
| Footer bar | y 5071875 to the bottom | y 1065–1080 |

Take the bar artwork from the template itself (`ppt/media/image2.png` is the header bar; slides 1 and 16 use `image3/4.png` and `image5.png`).

**Type.** Google Sans Flex, as in the template: Medium for slide headings (keep the template's heading text verbatim), 600 for our headlines, 400 for body. Google Sans Code for model IDs and code names only. Body text at least 20 px on a 1920 canvas; captions at least 18 px. Sentence case; no exclamation marks, no emoji.

**Colour.** Ink `#111113`, secondary `#46464B`, muted `#6E6E73`, hairlines `#E4E4E7`, chips `#EEEEF0`. One accent, cobalt `#2747F5` (soft fill `#EDF0FF`), for the single thing to look at on each slide. Green `#0E7A55` / `#E3F3EC` only on compliance results.

**Assets** (all in `submission/assets/`):

| File | Size (CSS px, rendered at 2×) | Slide |
|---|---|---|
| `process-flow.png` | 1280 × 580 | 6 |
| `architecture.png` (Google Cloud reference-architecture style) | 1280 × 580 | 8 |
| `icons/` (official Google Cloud, Firebase, Gemini and ADK marks; simple-icons; Material Symbols; see `ICON_SOURCES.md`) | PNG rasters in `icons/png/` | 3, 5, 8, 9 |
| `benchmark.png` | 1280 × 580 | 12 |
| `use-case.png` | 1600 × 580 | 15 |
| `qr-live.png` / `qr-live.svg` (decodes to the live URL) | 820 × 820 | 14 |
| `screens/s03-*.jpg`, `screens/s07-*.jpg`, `screens/s11-*.jpg` | cropped, 1600 px wide | 3, 7, 11 |
| `walk/walk-lounge-39.jpg` (walk mode, the furnished TV lounge and dining room with the open door through to the bedroom, from `video/footage/f_walk_like_a_game.mp4` at 39.0 s, top app bar cropped; the build crops away the floor switcher, mini-map, hint and bottom bar) | 1920 × 1008 | 3 |
| `walk/walk-lounge-41.jpg` (walk mode, TV lounge and dining, at 41.5 s, full frame; spare) | 1920 × 1080 | spare |
| `personas.png` (roles today and with Naqsha) | 1280 × 290 | 15 |

A 1600 × 720 diagram placed across the content width (1808 px) is 814 px tall and fits the 830 px content area exactly. Diagram sources are in `assets/src/*.html`; edit the text there and run `assets/src/render.sh` to re-render.

**Wording rules.**
- Say "bylaw-checked" or "pre-check" in headline copy, and "LDA" only where it is evidence or the prototype's rule set (37/37 LDA, "Prototype: Lahore (LDA) bylaws"). Never say "approval-ready" or "passes the bylaws": approval needs a PCATP-registered architect's stamp and the authority's decision. (The live compliance panel still says "Approval-ready" in small type; the `s07-3` screen shows it. Change the UI copy, or accept it.)
- Label every photoreal concept image as an AI concept ("Concept by Gemini 3.1 Flash Image"), so nobody mistakes it for the 3D model.
- Label real product screens with a small chip: **Live screen**.
- Copy rules: plain, specific sentences a founder would say. Never "not X but Y", "X, not Y", "minutes, not months", "What if…", "Imagine…", "Meet X", "game-changer", "seamless", "unlock", "revolutionize", "supercharge", rhetorical triplets or dramatic em-dash reveals.
- Name no competitor. Where the comparison matters, say "AI floor-plan tools we tested".
- Make the agents visible: they plan, check against the rules, fix their own mistakes, review their own drawing, act on comments, and explain a refusal with a compliant alternative.
- Every number below comes from `docs/pitch/deck/facts.json` (measured on the live service on 17 Oct 2026, read from the code, or read from LDA's official text). Cost figures on slide 10 are estimates and are marked as such.

---

## Slide 1 · Team Details

Keep the template layout. Fill four lines (the template has three; the members line is added after the leader):

- **a. Team name:** Pivot Analytix
- **b. Team leader name:** Abdullah Moazzam
- **c. Team members:** Saad Wali Muhammad Joiya, Usama Bin Maalik
- **d. Problem Statement:** **Theme 5 · Future of Work & Enterprise Productivity.** (cobalt) Designing a home takes weeks of manual drafting. Checking it against building bylaws is done by hand, by experts in short supply. And most families commit to building from 2D drawings they can't picture. Naqsha's AI agents turn a simple conversation into a bylaw-compliant 3D home you can walk through, in minutes. No product does this today. Naqsha is set to transform how architects and residential construction companies work, and how families decide what to build.

Lines a to c at 16 pt with 90% line spacing; the problem statement body at 12.5 pt (6 lines) so all four fit above the footer bar.

---

## Slide 2 · Template instructions

**Delete this slide** in the final deck. It only tells entrants how to download the template.

---

## Slide 3 · Brief about the idea

(Deck slide 2.) A calm slide: one headline, two clean columns, one image. No proof chips, no tech line, no sources line.

**Heading (template):** Brief about the idea. **Head chip (the only one):** `Theme 5 · Future of Work & Enterprise Productivity` (cobalt).

**Headline (16 pt, one line; "in minutes." in cobalt):** From a conversation to a bylaw-compliant 3D home you can walk through, in minutes.

**Sub-line (one line):** No product offers this today: we are redefining how families and architects design a home. (10.5 pt, secondary ink) Naqsha (نقشہ) is Urdu for "house plan". (10 pt, muted; the Urdu word at 12 pt)

**Left column: The problem** (cobalt bullets, as in the right column)
- **Design takes weeks.** Every draft and every change is drawn by hand.
- **Most families never see their home in 3D,** let alone walk through it. They commit to building from flat drawings.
- **Compliance needs scarce experts.** They check every bylaw by hand, and mistakes often show up only when the authority refuses the plan.
- **Feedback is scattered.** Owners, family, architects and builders give it in different places, so every round of changes is slow.

**Under it, the one image:** `walk/walk-lounge-39.jpg`, walk mode in the furnished TV lounge and dining room, with the open door through to the bedroom on the left, cropped to a wide band (the floor switcher, mini-map, hint and bottom bar are cropped away). Caption chip, top left inside the image: "Walking through a design in the live app". The picture links to the live app.

**Right column: The solution**
- **Lead (cobalt, one line):** Naqsha's AI agents: an experienced architect you can talk to.
- **Designs in minutes, by conversation.** Describe the plot and the family in plain words. Naqsha drafts the concepts, the floor plans and the full 3D home.
- **Compliant from the start.** Every plan is checked against the local authority's bylaws, and Naqsha fixes what fails.
- **Immersive, high-fidelity 3D.** Walk through the furnished, finished home, or view it from any angle, by day or night.
- **Comments that get addressed.** Pin a note anywhere as you walk. Naqsha makes the change, or names the rule that stops it.
- **One project for everyone.** Owners, family, architects and builders review and comment together.
- **Change it by asking.** "Make the kitchen bigger" gives you a new, checked version.

**Footer line (small, under the solution):** Prototype: Lahore (LDA) bylaws. Other authorities' rules load the same way.

Body text 11 pt. Columns 4.24 in and 4.58 in with a 0.40 in gutter.

---

## Slide 4 · Opportunities

(Deck slide 3.) **Heading (template):** Opportunities (Google Sans Flex Medium, like every other section title). Keep the three template questions as the three column heads (13 pt). **Head chip:** Compared with how homes are designed today.

**Column 1. How different is it from any of the other existing ideas?**
- **Lead (bold):** No product today takes families and their architects from a conversation to a compliant 3D home they can walk through, comment on and change.
- **Architect or draftsman:** weeks per design, in 2D, with every change redrawn by hand.
- **3D renders:** ordered separately, they take days and are still pictures you can't walk through.
- **AI image and floor-plan tools:** a picture or a 2D layout, with no bylaw checks, no walkthrough and no shared project.

**Column 2. How will it be able to solve the problem?**
- **Weeks of drafting:** a complete design in minutes, from one conversation.
- **Never seen in 3D:** every design is a high-fidelity 3D home you can walk through.
- **Scarce compliance experts:** bylaw checks are built in, so the architect stamps a set that is already checked.
- **Scattered feedback:** comments pinned in the model and addressed by the AI architect, one shared project, and changes made by asking.

**Column 3. USP of the proposed solution**
- **Big line (cobalt):** An experienced architect you can talk to.
- AI agents that design the whole home in minutes, check their own work against the bylaws and fix it.
- Immersive, high-fidelity 3D, inside and out, in the browser.
- Comments pinned where you stand, and addressed for you.
- Collaboration and changes in plain language, all in one place.
- Rules as data: LDA in the prototype, and any authority's bylaws can be added.

Body text 11 pt, one text colour (secondary ink) for the bullets in all three columns. Comparison source for AI tools: our test of an AI floor-plan tool on its free tier, 16 Oct 2026 (`docs/research/`). The deck does not name it.

---

## Slide 5 · List of features offered by the solution

(Deck slide 4.) **Heading (template):** List of features offered by the solution. No technology names on this slide; it is written for the people who buy and use Naqsha.

**Hero banner across the top (cobalt, the most important feature, two balanced lines at 13 pt):** From your requirements to a complete, high-fidelity, bylaw-compliant 3D walkthrough of your home, in minutes.

**Feature grid: 12 cards, three per row, in the order a family uses them** (design, see, change, work together). Each card: a small cobalt icon, a short title, then one line (9.5 pt). One 0.08 in gutter between rows, columns, the banner and the band.

| # | Title | Line |
|---|---|---|
| 1 | Design with an AI architect | Describe your plot, family and wishes in plain words; Naqsha asks only for what's missing. |
| 2 | Concepts by day and night | Four photoreal exterior options for your plot, each also shown at night. |
| 3 | Compliant floor plans | Every floor is checked against the authority's bylaws and livable-home rules; Naqsha fixes what fails and reviews its own drawing. |
| 4 | High-fidelity 3D, inside and out | Furnished rooms, finished facades, any angle, and cut-away floors. |
| 5 | Immersive walkthrough | Walk room to room, jump to any room, and take the stairs up to the roof. |
| 6 | Night lighting and photoreal renders | Light the house at night, or turn any view into a photoreal image in seconds. |
| 7 | Comments where you stand | Pin a note on any wall, window or room as you walk; everyone on the project sees it. |
| 8 | Comments addressed for you | The AI architect makes each change, or names the rule that stops it and offers another way. |
| 9 | Change it by asking | Type a request in plain language and get a new, checked version. |
| 10 | Collaborate on one project | Owners, family, architects and builders together; client links need no account. |
| 11 | Versions and drawings | Every version is kept with its changes in feet, plus a 1:100 print set and a compliance report. |
| 12 | Bylaws for your area | LDA in the prototype; other authorities' rules load as data. |

**Bottom band: Who it helps**
- **Families** see, walk and shape their home before they build.
- **Architects** deliver a checked design in the first meeting.
- **Construction companies** sell and build from designs buyers can walk through.

---

## Slide 6 · Process flow diagram or Use-case diagram

**Heading (template):** Process flow diagram or Use-case diagram

**Visual:** `assets/process-flow.png`, full content width (1808 × 814 px). No other body copy is needed; the diagram carries its own labels.

It shows the six steps (Brief, Concepts, Plan, 3D house, Walk & share, Revise) with live timings (step 3 reads "A plan the agent checks and fixes."), then the two agent loops. The rules check reads "a tool call: 36–43 LDA + 10 livable" (36 on the v2 sample, 37 and 43 on the v3 samples), and the rules-engine band reads "each authority's bylaws as deterministic code (LDA 2026 in the prototype), plus 10 livable-home rules". Steps 1 and 6 are labelled "Google ADK agent". Loop A is the **Architect pipeline** on Gemini 4 Argon (plan as JSON, rules check as a tool call, fix and re-check, multimodal self-review, write design.js, as-built check). Loop B is the revision agent; its header carries an ADK-logo pill, **Agentic harness: Google ADK**, in the Google platform style (Google Blue on #E8F0FE), with step 6 · 9 tools. Numbered steps are accent-blue circles, as on the wireframes and the architecture slide.

The actor view (`assets/use-case.png`) is on slide 15, where it shows how each role's work changes.

---

## Slide 7 · Wireframes/Mock diagrams of the proposed solution (optional)

**Heading (template):** Wireframes/Mock diagrams of the proposed solution (optional)

**Kicker:** Real screens from the live app, in the order a family uses them.

**Layout:** a 3 × 2 grid of 16:10 frames (about 580 × 362 px each at 1920), each with a number, a one-line caption and a **Live screen** chip.

| # | Crop (`v2deck/img/`) | Caption |
|---|---|---|
| 1 | `w1-brief.png` | **Brief:** agent asks what's missing |
| 2 | `w2-concepts.png` | **Concepts:** 4 looks, day or night |
| 3 | `w3-plan.png` | **Plan:** agent-checked, 37/37 LDA |
| 4 | `w4-house.png` | **House:** coded by Gemini 4 Argon |
| 5 | `w5-walk.png` | **Walk:** first person, room finder |
| 6 | `w6-revisions.png` | **Revise:** agent lists changes in feet |

The plan crop still shows the live panel's small green line "Approval-ready · 37/37 LDA · 10/10 livable". Change the UI copy and recapture, or accept it.

**Footer:** All six are live screens captured from the deployed app on Cloud Run (revision `naqsha-00009`, 17 Oct 2026); the slide does not name the revision, because the live one moves on.

---

## Slide 8 · Architecture diagram of the proposed solution

**Heading (template):** Architecture diagram of the proposed solution

**Visual:** `assets/architecture.png`, full content width, drawn in the style of Google's own Google Cloud reference-architecture diagrams (source `assets/src/architecture.html`, 1280 × 580 CSS px rendered at 2x; type no smaller than 18 px = 9.3 pt, product names 21 px). Head chip: **Live on Cloud Run · us-central1** (green dot). In the PDF the diagram is lossless (see `fill_tokens.py`).

- **Colour has a meaning.** Google Blue marks Google products and the numbered data flow. The Naqsha accent (#2747F5 titles on #EDF0FF cards) marks code we wrote, keyed in the legend as "Built by us", as on slide 9. All connectors are Google grey.
- **Left:** the users in one bracket, role first (Owner · the family, Team · architect, builder, Client · via share link), with one arrow to the Browser card (React 19 · three.js; runs screened code), then the data-flow legend.
- **Google Cloud boundary:** the Google Cloud logo and "Project Hack2skill-global-hackathon" (the project's display name; `naqsha` is only the Cloud Run service).
- **Region us-central1** (dashed zone): Cloud Run, Firestore, Cloud Storage, Artifact Registry and Cloud Build, as deployed.
- **Inside Cloud Run** (service naqsha · FastAPI · verifies ID tokens): the dashed **Agentic harness: Google ADK 2.12** group with the setup agent (Gemini 3.8 Flash · 5 tools) and the revision agent (Gemini 4 Argon · 9 tools); a "brief" arrow from the setup agent to the **Architect pipeline** (Gemini 4 Argon · Gen AI SDK: Plan JSON → Rules fix loop → Self-review → design.js); the **Rules engine** beside it (LDA 2026 rules + 10 livable rules, pure Python, no AI), called by the Architect (4) and by the revision agent (5); and **Concepts and renders** (Gemini 3.1 Flash Image, falling back to Nano Banana 2.1, then Gemini 3 Pro Image). The Gemini sparkle marks only these four Gemini callers.
- **Global services, outside the region:** Firebase Authentication (Firebase logomark only; "Identity Platform · sign-in, ID tokens, roles") and Gemini Enterprise Agent Platform (Vertex AI icon; "Vertex AI · global endpoint"; Gemini 4 Argon, 3.8 Flash, 3 image models).
- **Numbered steps, each badge centred on its line:** 1 sign in, ID token · 2 HTTPS API + SSE · 3 calls to Gemini · 4 rules check (tool) · 5 edits dry-run first · 6 projects, versions · 7 images, drawings · 8 build the image (Cloud Build → Artifact Registry) · 9 deploy a revision (Artifact Registry → Cloud Run).

**Optional one-line footnote (18 px, muted):** Model-written code never runs on the server: design.js runs in the user's browser after a screen for 21 banned patterns (network, eval, storage, timers).

---

## Slide 9 · Technologies to be used in the solution

**Heading (template):** Technologies to be used in the solution

**Visual:** native slide content (editable text), all on one page, with a real logo on every entry. Every card is one column of six rows (icon, name, a note in Google Grey 700, #5F6368). Three card styles, named by legend chips in the title row: **Google platform** (Google tint #E8F0FE), **Open source** (white, grey border), **Built by us** (white, accent border).

- **Harness row across the top (ADK logo, Google platform style):** "Agentic harness: Google ADK 2.12 · 2 agents, 14 tools". Setup agent Gemini 3.8 Flash · 5 tools; Revision agent Gemini 4 Argon · 9 tools; both run in the Cloud Run service.
- **Agent Platform** (Vertex AI icon, "Vertex AI"; Gemini sparkle per model row): Gemini 4 Argon (plan, 3D code, revise), Gemini 3.8 Flash (setup agent), Gemini 3.1 Flash Image (concepts), Nano Banana 2.1 (image fallback 1), Gemini 3 Pro Image (image fallback 2), global endpoint (newest models only).
- **Google Cloud** (Google Cloud logo; official product icons): Cloud Run, Firestore, Cloud Storage, Firebase Authentication, Cloud Build, Artifact Registry.
- **Architect pipeline** (Gemini 4 Argon; built by us): google-genai 2.31 (Gen AI SDK, Material `code` icon), rules check (tool), rules fix loop, multimodal review, resilience (6 tries, 4–60 s backoff), and the line "Fixed-step agent loop: ADK not needed."
- **Backend:** Python 3.13 (uv), FastAPI (Server-Sent Events), Pydantic, Pillow (plan drawings), pytest (123 tests), Docker.
- **Frontend and 3D:** React 19 (TypeScript, Vite), Tailwind CSS 4, three.js r186, react-three-fiber + drei, three-mesh-bvh, N8AO.
- **Built by us** (Material Symbols): House SDK (44 materials), LDA rules as data, 10 livable rules, as-built check, 1:100 print sheets, code screen (21 banned patterns).

**Optional caption:** Firebase, Firestore, Cloud Run and Gemini are the core. Everything else is open source, plus our own House SDK and rules engine.

---

## Slide 10 · Estimated implementation cost (optional)

**Heading (template):** Estimated implementation cost (optional)

**Headline:** About $2.65 of cloud and AI per home. All figures are estimates.

**Left (about 55%): cost per new home, 10 marla, at list prices.**

| Step | Runs on | Estimate |
|---|---|---|
| Setup chat, about 6 turns | Gemini 3.8 Flash, ~60k tokens in / 6k out | $0.14 |
| 4 concepts + 4 night versions | Gemini 3.1 Flash Image, 8 images at 1K | $0.54 |
| Plan, fix loop and self-review | Gemini 4 Argon, ~60k in / 50k out | $1.24 |
| 3D house as code | Gemini 4 Argon, ~25k in / 30k out | $0.70 |
| Hosting and storage | Cloud Run (about 6 min of a shared 2 vCPU instance), Firestore, Cloud Storage | $0.03 |
| **Total per home** | | **≈ $2.65 (≈ Rs 740)** |
| Each revision | Gemini 4 Argon on the Google ADK harness, ~120k in / 15k out | ≈ $0.78 (≈ Rs 220) |

**Footnote (muted, 18 px):** Estimates from list prices; usage is unmetered. Token counts are estimated from prompt and output sizes (a plan is about 16 KB of JSON, a design.js 23–32 KB, plus thinking, which bills as output). List prices: Gemini 4 Argon $4 in / $20 out per 1M tokens from 1 Dec 2026 (half that today); Gemini 3.8 Flash $1.50 / $7.50; Gemini 3.1 Flash Image $0.067 per 1K image; Cloud Run $0.000018 per vCPU-second and $0.000002 per GiB-second. At today's promotional prices a home costs about $1.60. Rs 280 = $1.

**Right (about 45%):**

*Pilot month (estimate):* 1,000 homes and 3,000 revisions ≈ $5,000 of Gemini; one always-warm Cloud Run instance ≈ $105; Firestore and Cloud Storage under $50. **About $5,200 a month.**

*Head chip:* All figures are estimates from list prices.

*Callout (cobalt):* One avoided LDA resubmission (Rs 41,430 scrutiny fee for our 10 marla sample) pays for about 55 AI-designed homes.

*Pricing tiers (hypotheses to test in pilots):*
- **Free:** one home: brief, concepts, plan and 3D walk. Samples open with no account.
- **Family:** per home: unlimited revisions, client links, the 1:100 print set.
- **Professional:** architects, builders and developers: many homes, team seats, client links, branded title blocks.
- **Stamping partners:** PCATP-registered architects receive pre-checked sets; a referral fee per stamped submission.

---

## Slide 11 · Snapshots of the prototype

**Heading (template):** Snapshots of the prototype

**Kicker:** All captured from the live service. Open a sample home in a minute, no account needed.

**Layout:** one hero frame on the left (about 60% of the width), a 2 × 2 grid on the right. Every frame gets a **Live screen** chip.

| Position | File | Caption |
|---|---|---|
| Hero | `screens/s11-house-orbit-villa.jpg` | **The 1 kanal Spanish villa** (43/43 LDA · 10/10 livable), written as 3D code by the AI architect (Gemini 4 Argon): tiled roofs, rooftop solar, a two-car porch. |
| Top left | `screens/s11-house-night-10marla.jpg` | **Night lighting** on the 10 marla home. |
| Top right | `screens/s11-walk-lounge.jpg` | **Walk mode:** the TV lounge at eye level. |
| Bottom left | `screens/s11-client-view-comments.jpg` | **The client's view** from a share link: comments with names, and Naqsha's answers. |
| Bottom right | `screens/s11-print-sheet-cover.jpg` | **Print set:** the concept, the area schedule, and every floor at 1:100. |

**Spares** if a frame needs swapping: `s11-share-dialog.jpg` (Share dialog), `s11-comments.jpg` (comments over the 3D house), `s11-phone-house.jpg` (the house on a phone, portrait), `s11-concept-night.jpg` (an AI concept at night; label it "AI concept by Gemini 3.1 Flash Image" so it reads apart from the 3D model).

---

## Slide 12 · Prototype Performance report/Benchmarking

**Heading (template):** Prototype Performance report/Benchmarking

**Visual:** `assets/benchmark.png` (source `assets/src/benchmark.html`), full content width. It shows:
- **Time to result (Cloud Run request logs, revisions 00007–00009, 17 Oct 2026):** setup agent turn median 2.6 s (n 9); four concepts median 17 s (n 6); night versions of all four median 18 s (n 6); "Render this view" 9–10 s (n 2); a revision from comments median 71 s (69–138 s, n 4; the 3-comment revision in the demo took about 5 min); full design, plan to walkable 3D: 10 marla 4.6–5.2 min (n 2), 1 kanal median 8.2 min (6.4–10.1, n 6). End to end, 10 marla: 5.3 min of AI time.
- **Rules passed:** 10 marla modern home v3, 37/37 LDA and 10/10 livable with 0 warnings; 1 kanal Spanish villa v3, 43/43 LDA and 10/10 livable with 0 warnings; rule failures fell from a median of 8 on the first try to 0 delivered, fixed by the AI architect (all first designs saved in Firestore, 16–17 Oct). "Loop A at work": rule failures per try on a 1 kanal brief (not the villa sample's own run), 15 → 5 → 0; the AI architect fixed them.
- **Quality and resilience:** ~200 issues found and fixed in development by 8 AI tester agents over 3 rounds; 123 API tests; 6 retries with exponential backoff on 429/5xx; a 3-model image fallback chain.
- **For scale:** an AI floor-plan tool we tested took ~6 min and 8 actions to draw one floor in 2D, with no stairs and no rule checks. (No competitor is named.)

**Optional method line (muted, 18 px):** Single measured runs on the deployed service (us-central1, Gemini on the global endpoint) on 17 Oct 2026. The final verification confirmed every must-fix item on the deployed code.

---

## Slide 13 · Additional Details/Future Development (if any)

**Heading (template):** Additional Details/Future Development (if any)

**Three columns:**

**Next (weeks)**
- Drag rooms with an instant bylaw re-check
- Google sign-in
- Generated code in a sandboxed iframe
- glTF export
- Per-run token metering and a cost dashboard

**Scale (months)**
- Full rule packs for DHA, Bahria, RDA, FDA, MDA and GDA (on the LDA baseline today), then authorities beyond Punjab
- Pilots with PCATP architects and Lahore builders
- Sets ready for online submission, starting with LDA's

**Later (ideas)**
- An Urdu interface
- Cost and material estimates
- Structural and services drafts
- Rule packs for cities outside Pakistan

**Band across the bottom: trust and responsibility.** **Pre-check only:** a PCATP-registered architect stamps every plan. **Deterministic rules:** each authority's official bylaws, written as code and tested; the prototype uses LDA's 2026 regulations. **Safe code:** model-written code is screened and runs only in the viewer's browser. **People decide:** the owner picks which comments become changes.

---

## Slide 14 · Provide links to your

Keep the template's three bullets and fill them:

- **GitHub Public Repository:** https://github.com/abdm693/hack2skill-hackathon
- **Demo Video Link (3 Minutes):** {{VIDEO_URL}}
- **Final Product Link:** https://naqsha-242926648187.us-central1.run.app

**Under the links:** Try it in a minute: open a sample home, no account. The card and the QR code both link to the live app in the PDF.

**Repo guide (muted, 18 px):** README (run and deploy) · `docs/ARCHITECTURE.md` · `contracts/` (plan schema, House SDK, API) · `api/tests` (123 tests)

**Right side:** `assets/qr-live.png` at about 240 × 240 px, captioned "Scan to open the live app".

---

## Slide 15 · Track and industry impact (spare content slide)

The template's slide 15 has no heading. Add one in the same position and style as the other slide headings.

**Heading:** Track and industry impact

**Headline:** Future of Work in AEC: weeks of redrawing become one agentic session

**Chips:** `Track · Theme 5 · Future of Work & Enterprise Productivity` (cobalt) · `Industry · Architecture, Engineering & Construction (AEC) + residential real estate` · `Pakistan first, then worldwide · Lahore prototype`

**Four stat tiles (one row):**
- **Speed** ~5–6 min: of AI time, first message to a walkable, bylaw-checked home.
- **Cost today** Rs 41,430: fee paid again when a 10 marla plan is refused in Lahore.
- **Iteration** ~70 s: median, from comments to a checked version, with reasons.
- **Market** ≈10 M: homes short in Pakistan; first city, Lahore, has 13.0 M people (Lahore district: Census 2023, PBS).

**Visual:** `assets/personas.png` (source `assets/src/personas.html`) across the content width, under the tiles. It shows the four roles, how each works today and with Naqsha:
- **Family** (Owner): describe the plot once; pick a look, by day or night; walk the house before it is built; choose which comments go in.
- **Architect, builder** (Team): a checked, walkable design at the first meeting; agents revise from comments, ~70 s; print the 1:100 set + compliance.
- **Client, relatives** (Share link): open a link, no account needed; walk the house on a phone; comment by name, the agent answers; approve a version.
- **PCATP architect** (Partner · next): receives a bylaw pre-checked 1:100 set; reviews, stamps and submits to the authority; fewer refusals and repeat fees.

**Footer:** terms (LDA, PCATP, marla and kanal in sq ft, Rs 280 ≈ US$1) and sources (fee: LDA Building & Zoning Regulations, App. C; Lahore district: Census 2023; housing shortfall: World Bank estimate).

---

## Slide 16 · Thank you

Keep the template slide. Beside "Thank you": Naqsha نقشہ · Walk through your home before the first brick. · **Pivot Analytix** · AI Builder Cup 2026, then link pills for the live app and the public code repository.

---

## Before exporting the PDF

1. Team name, leader and members are filled in the build. Fill `{{VIDEO_URL}}` with `fill_tokens.py --video-url`.
2. The GitHub repository is public; open the link in a signed-out window to confirm it loads.
3. Delete slide 2.
4. Check every slide at 100% zoom: no text under 18 px, nothing overlapping the header or footer bars.
5. Keep the live service warm during judging (for example, one minimum instance), so the first visit doesn't hit a cold start.
