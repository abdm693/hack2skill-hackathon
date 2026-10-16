# Judge's critique: Naqsha deck (15 slides)

Reviewer stance: a Google Cloud AI Builder Cup judge on deck 201 of the day. Rubric: Technical Merit & GenAI 40%, Problem Alignment & Impact 25%, Innovation & Creativity 25%, UX & Solution Design 10%. Required topics: problem, vision, feasibility, scalability.

Inputs read: all 15 renders in `renders/`, `index.html`, `deck.css`, `facts.json`, `../deck-content.md`, `../demo-script.md`, README, ARCHITECTURE, OVERHAUL, DESIGN, the spikes README, the maket teardown, LDA research §(a), and the architecture-rules headline findings. I spot-checked the repo: the ADK tool names in `api/app/agents/reviser_adk.py` match the slides, the QR code on slides 5 and 15 decodes to `https://naqsha-242926648187.us-central1.run.app`, detached runs live in `api/app/runs.py`, and the authority overrides are in `api/app/compliance/lda.py`.

---

## Verdict

The deck is one of the better-crafted ones I would see today. The visual system is calm and consistent, every number has a source, and it avoids the usual "AI will revolutionise housing" filler. Three ideas will stay with me:

1. "Argon designs in code, not pixels" (slide 6).
2. "Argon is creative. The rules are code." (slide 7).
3. The agent that refused the porch and cited the 10′ front setback (slide 8).

Where I would mark it down:

- **Proof is anecdotal.** Every "measured live" number comes from one or two runs, with no n and no committed log. The same six numbers appear on four slides (4, 7, 11, 12) without adding evidence.
- **About a quarter of the deck shows features that are not live.** Slide 9 is entirely a mock. The hero chip on slide 7 depends on unshipped livable rules. Slides 10, 13 and 14 lean on the overhaul. As of this review, the main working tree has no `api/app/compliance/planning.py`, no `web/src/app/{share,auth,comments,landing}`, and no `docs/screens/v2-*`.
- **Two required topics are thin.** Vision is only implied. Scalability covers geography (Punjab authorities) but says nothing about load, cost or quota.
- **Impact has no number.** You were right not to publish unsourced market sizes, but the slide now has nothing to replace them.
- **The deck shows only one house.** The same Argon house appears on slides 1, 4, 6, 8, 9 and 15, so a judge will wonder whether it is cherry-picked.

**Rough scorecard (my read):**

| Criterion | Now | After the P0 and P1 fixes below |
|---|---|---|
| Technical & GenAI (40%) | 7.5 | 9 |
| Problem & Impact (25%) | 6 | 7.5 |
| Innovation (25%) | 8 | 8.5 |
| UX & Design (10%) | 7 | 8 |
| **Weighted** | **≈7.2** | **≈8.4** |

---

## P0: fix before exporting the PDF

1. **Fill the placeholders on slide 15:** GitHub URL, demo video URL, team name and members, and the asks. The repo and video are submission requirements, and the deck is the place judges look for them. Add the GitHub link to the cover meta line as well.
2. **Settle every `in_progress` claim on the live URL.** Then rewrite each "in the 18 Oct build" chip as "Live" or move the item to the roadmap. Judges read the PDF after 18 Oct, so a chip that promises the 18 Oct build reads as a hedge. Affected: slide 7 (the livable-rules chip "5/5", self-review), slide 9 (the whole slide), slide 10 (Identity Platform), slide 13 (1:100 print set), slide 14 (the Now column), and slide 4 (the "1 message" brief).
3. **Make one product appear on every slide.** Slides 4 and 5 show the v1 UI: brick accent, serif wordmark, and the numbered stage bar visible on the phone. Slide 9 shows the v2 cobalt UI. Re-shoot slides 4 and 5 in v2, or drop the v2 mock. Remove "v1 screens" from the slide 5 footer either way.
4. **Fix the demo script** (`docs/pitch/demo-script.md`), which contradicts the deck. Judges watch the video with the deck beside it.
   - 0:00–0:15 still says "half of them get rejected" and "approved-ready". The deck removed both as unverified.
   - It says "42 rules" where the deck says 42–50 checks.
   - It says "about fifteen seconds" where the deck says 12–17 s.
   - It says "nobody waits 8 minutes" where the deck says ~7 min.
5. **Commit evidence for the "measured live" numbers.** Add `docs/evidence/` with the raw SSE event logs or Cloud Logging exports for the 12–17 s, 42–50, 5→1→0, 4→0, 23–25, ~7 min and ~95 s figures, and cite it in the footers. `facts.json` says "No log of the run is committed to the repo." Without logs, a judge cannot check "Measured on the live service".

## P1: biggest score movers

1. **Run a small batch, say 10 designs on 3 plot sizes, and report distributions.** Report the share that passes all LDA checks within 3 attempts, median and p90 design time, violations per attempt, sections that self-healed, ADK tool calls per revision, and tokens and cost per design. Put these on slide 11 in place of the repeated numbers. Turning anecdotes into data is the largest single lever on the 40% criterion.
2. **Replace slide 3 (Why now) with "Feasibility & scalability".** Slide 3 repeats slide 6 (the spike), slide 8 (the 9 tool chips) and slide 7 (42/42). Put the words "Feasibility" and "Scalability" in the eyebrow so a judge working through a checklist finds them. The slide should cover:
   - what is live today, with evidence links;
   - cost per design;
   - how the service scales: Cloud Run autoscaling, Firestore, and the strategy for 429s on the shared global quota;
   - the plan for detached runs (see slide 10);
   - Punjab rule packs.
3. **Show three or four different generated houses.** Use different plot sizes and briefs, and label each with its brief, time and LDA result. This answers "is this the one good output?"
4. **Put the agent's real words on slide 8.** Use the actual porch refusal text and the actual tool-call trace in place of a paraphrase and a conceptual flow.
5. **Size the problem in rupees on slide 2,** using rules already on the slide (worked out under slide 2 below).

---

## Slide by slide

Sizes are on the 1920 × 1080 canvas. Viewed as a PDF on a laptop (about 1440 px wide), everything shrinks to about 0.75×, so 13.5 px displays at about 10 px.

### Slide 1 · Cover

**Works.** "Walk through your home before the first brick" is memorable. The drawing-to-render split is the best visual idea in the deck. The caption "The house Gemini 4 Argon wrote as code" sets up the technical story in three seconds.

**Fix:**
- **The left half is a front elevation, but it is labelled "The naqsha".** A naqsha is a plan, and the product is named after it. Relabel it "The drawing", or swap in a plan view.
- **No team or GitHub on the cover.** Append "[Team] · github.com/…" to the meta line (`.s-cover .sub`, 15 px mono).
- **The date "09-02-2026" is ambiguous** for JAPAC judges (9 Feb or 2 Sep?). Write "9 Feb 2026" here and on slides 2, 3, 6 and 7.
- **The scored sentence is buried.** "Gemini 4 Argon designs the house in code, a Google ADK agent revises it" sits as sentence 2 of a 4-line, 21 px paragraph. Give it its own line or set it in 500 weight.
- **The round "‹ ›" handle on the divider (x≈1245) is an interactive control that does nothing in a PDF.** Keep the line and drop the knob in the static render.

### Slide 2 · The problem

**Works.** The Johar Town persona, the dated official source, and the envelope drawing are all good, and 30′ × 48′ is correct for 35′ × 65′ with 10/7/5 setbacks. Dropping "half are rejected" was the right call.

**Fix:**
1. **The pain is asserted but never sized,** and this is your main Impact slide. Turn two rules you already list into money and label the results "derived from LDA Appendix C":
   - **Scrutiny fee.** Rs 15/sq ft × about 4,300 sq ft covered (3 storeys × 1,440 sq ft footprint) ≈ **Rs 65,000 every time a plan is submitted or resubmitted.** Check the covered area against `contracts/fixtures/argon-v1-plan.json`.
   - **The porch from slide 8.** 4 ft × 15 ft (the porch is 15 × 16 ft per the app's own revision text) = 60 sq ft into the front open space. That is **Rs 15,000–30,000** at Rs 250/sq ft (porch projection) or Rs 500/sq ft (ground-floor open-space violation). The range covers both lines of Appendix C, because which one LDA would apply is unclear. This also links slide 2 to slide 8.
2. **Ten rule rows make a wall.** Cut to six: setbacks, coverage, height, storeys (4 → 3, in cobalt), PCATP stamp, and the scrutiny fee on every resubmission or the open-space penalty. Move the 8% glazing and the 3′6″ / 7½″ stair rules to slide 7, where the engine enforces them. Drop "21 days for LDA to decide". It is not a pain point, though "a refusal must name the rule" can stay as the bridge to slide 8.
3. **The kicker and the bottom line say the same thing.** Keep the bottom line ("The rules are written down. They just aren't in the room…"), which is the better line. Replace the top-right kicker with the Rs 65,000 figure.
4. **Gloss the jargon at first use.** JAPAC judges will not know these terms:
   - "10 marla (≈2,250 sq ft / 209 m²)";
   - "LDA (Lahore Development Authority)", which today is expanded only in the footer;
   - "PCATP (Pakistan Council of Architects and Town Planners)".
5. **"Illustration: how *most* plans begin" is unsourced.** Change it to "how many plans begin".
6. **Raise the column header** "What that one plot must respect…" from 15 px to 17 px mono.

### Slide 3 · Why now (recommend replacing it, see P1.2)

If you keep it:
1. **The hero number works against you.** "1,780 lines, one pass" belongs to the approach slide 6 says you abandoned (blocky, 481 s). A skimming judge reads slide 3 as "our proof is 1,780 lines" and slide 6 as "that was bad". Reframe it as capability: "Argon read a concept image and wrote 1,780 lines of three.js that ran first time, so we built an SDK to make that fast and beautiful."
2. **Card 2 repeats slide 8,** with the same 9 chips.
3. **Card 3's "42/42 LDA checks" contradicts the "42–50" used everywhere else.** Label it "one plan: 42/42".
4. **"(both reported)" reads as a hedge.** Move the citations to the footer: "APP, 15 Aug 2024; APP / Business Recorder, 19 Aug 2026".
5. **Make the tool chips bigger.** Raise them from 14.5 px to 16 px (`.s-why .tools .chip`).

### Slide 4 · The journey

**Works.** This is the best single "what is it" slide. A time sits under each stop, and the dashed "v2, v3 …" loop is a nice touch.

**Fix:**
1. **The chip row mixes units:** `1 message` / `12–17 s` / `42–50 checks` / `23–25 sections` / `live` / `~95 s`. Make every chip a time (`—`, `12–17 s`, the `~7 min` bracket, `live`, `~95 s`) and move the counts into the description lines.
2. **The Brief thumbnail shows a 50′ × 90′ (1-kanal) envelope.** Slide 2, the plan thumbnail and the story are all 35′ × 65′ (10 marla). Re-capture `app-setup` on the 10-marla brief so one house runs through the deck.
3. **"1 message" is an overhaul (`in_progress`) feature.** Verify it or remove it.
4. **The engine lines are too small for what they carry.** They are 13.5 px mono in ink-3 (`.s-journey .stop .eng`) and display at about 10 px in a PDF, yet they carry your Technical score on this slide. Raise them to 16 px and to ink-2.
5. **The Revise thumbnail is a wall of roughly 8 px text.** Crop it to the "Not possible" chip and its first line, at 2× scale.
6. **Under the ~7 min bracket, add "sample homes open instantly".** It defuses the wait before a judge raises it.

### Slide 5 · Live product

**Works.** "Not mockups" is the right claim. The QR code is verified: it decodes to the live URL.

**Fix:**
1. **v1 versus v2** (P0.3). The phone even shows the numbered stage bar that DESIGN.md removes.
2. **The screens are about 415 × 230 px, and their UI is unreadable.** The caption "Fixed 5 → 1 → 0" cannot be seen in its screenshot. Crop each frame to the one element its caption names (the envelope, the fix-loop chip, the "Not possible" card) at about 2× zoom.
3. **The phone caption says "Brief, plan and 3D on a phone" but the image shows only 3D.** Show three small phones, or change the caption to "3D on a phone".
4. **Eight objects compete.** Go to four large frames (Plan, 3D interior, Walk, Revise) plus the phone and the QR card.

### Slide 6 · Argon designs in code, not pixels

**Works.** This is the deck's strongest technical idea: plan JSON, then a deterministic check, then sectioned code against your own SDK, then a streamed render. The before/after pair is the most persuasive image in the deck.

**Fix:**
1. **The before/after is lopsided.** The left side has numbers (`481 s · 1,780 lines · blocky`); the right side has adjectives (`streamed · editable · PBR`). Put numbers on the right, from facts you already have: "~7 min for plan + LDA checks + 3D · 23–25 sections".
   - **Say the punchline you are leaving out:** the whole pipeline (plan, checks and a high-fidelity house) now takes less time than the one-shot took to write blocky code alone (~7 min vs 481 s ≈ 8 min).
   - Add the n for both figures.
2. **Measure time to first section.** That is the moment the family first sees geometry. The one-shot showed nothing until 481 s (its first token arrived at 164 s). `facts.json` says per-section latency isn't logged, so take it from the SSE event timestamps before submission. That one number is the whole "8 min → streamed" story.
3. **The Stream card shows five identical full-width black bars.** They read as a chart with no data. Replace them with the 4-thumbnail filmstrip (structure → facade → furniture → landscape) captured from the layer toggles, as `deck-content.md` specified, or with real per-layer timestamps.
4. **The footer claims "same plot, same brief", but `docs/spikes/README.md` does not support it.** The spike used the flash-image concept and "a detailed brief" for a "10 marla DHA Lahore" house, while argon-v1 is a north-facing 35 × 65 LDA plot. Document it or remove it. Also match the cameras: the spike image is a warm three-quarter close-up and the SDK image is a straight-on daylight front. Use the same camera and light, or a judge will discount the comparison.
5. **Spell out the GenAI detail judges look for.** Argon receives the chosen concept image (multimodal input producing code, per ARCHITECTURE §1 step 5) and writes against a typed API (`contracts/house-sdk.d.ts`) placed in its context. Add one line to the Build card: "Inputs: plan JSON · concept image · house-sdk.d.ts".
6. **Too dense: 11 blocks.** Collapse the four Exact / Checkable / Editable / Walkable blocks into one line under the title. Give the space to the before/after photos, widening each from about 500 px to about 800 px.
7. **Raise the text in the dark Build card** (section chips and "each tagged {layer, level, room, kind}") from about 15 px to 16–17 px.

### Slide 7 · Trust

**Works.** "Argon is creative. The rules are code." is the best title in the deck. Splitting objective rules (deterministic) from subjective judgement (self-review) is a mature agent-design position. The story of the 22 ft drop with no railing is honest and memorable.

**Fix:**
1. **The hero chip "42/42 LDA · 5/5 livable" includes an `in_progress` number.** The livable rules have no `planning.py` in the main tree yet. If they are not live at submission, the biggest number on the slide is unverifiable. Make the hero "42/42 LDA" and move livable rules to the roadmap.
2. **The self-review panel is "an illustration of the step"**: an invented AI output in a deck scored on GenAI. Replace it with real Argon critique text from a live run, verbatim, with the run id, or shrink it to one line.
3. **Fix the status chips.** "in the 18 Oct build" uses the warn-orange dot, but DESIGN.md reserves pass/warn/fail colours for compliance content, so it reads as a warning. After verifying, change it to a neutral "Live" chip in ink, or remove it.
4. **The fix-loop labels are cryptic** ("check 1 · 5 violations / check 2 / 3", 14 px, `.s-trust .fixlbl`). Write "attempt 1: 5 · attempt 2: 1 · attempt 3: 0" at 16 px. Add n: "2 live runs: 5→1→0 and 4→0".
5. **42/42 versus 42–50 on the same slide.** Write "this plan: 42/42 · typical plan: 42–50 checks".
6. **"All three had stair-safety defects" needs one qualifier.** One of the three is the hand-made few-shot fixture (architecture-rules §0). Writing "three houses: two by Argon, one hand-made" protects you if a judge reads the repo.
7. **Raise the self-review note labels** from 12.5 px (`.s-trust .note b`) to 15 px or more.

### Slide 8 · Agentic revisions with Google ADK

**Works.** The refusal that cites the 10′ setback is the most memorable moment in the deck, and the clearest evidence of an agent rather than a chatbot. The Look → Test → Change → Explain loop, with the LDA engine at the side, reads instantly.

**Fix:**
1. **Show the refusal instead of paraphrasing it.** The app already wrote a great answer (visible in the revise screenshot on slides 4 and 5). It cites "a mandatory 10 ft front setback", says the 20 × 10 ft driveway already gives tandem parking, and offers to deepen the porch inward by reducing the TV lounge depth. Put that text in the porch card, verbatim. "Alternatives were offered instead" is the weakest sentence on your strongest slide.
2. **The left photo doesn't match the run.** Its pins and tooltip ("Make the stone pier full height", 4 pins) don't match the run on the right (window, sofa, porch). Use a capture of this run's three pins, numbered 1–3 to match the cards.
3. **A diagram is a claim; a trace is proof.** Add the real tool-call trace from the ~95 s run as a dark HUD strip: timestamp, tool and a short argument summary. For example: `get_room → check_plan_ops ✗ → check_plan_ops ✓ → apply_plan_ops → write_section furnish_g_lounge → resolve_comment ×3 → finish`. "N tool calls in 95 s" is a strong number.
4. **Change "~95 s" to "3 comments · ~95 s · 1 run".**
5. **Answer "why ADK and not one prompt?" in one line.** You already have all three facts, but they are scattered:
   - it reads only what it needs, which saves tokens;
   - it dry-runs every layout change before writing;
   - it saves atomically ("ADK saves nothing until it finishes").
6. **Set the "next comment" loop label horizontal at 16 px.** It is currently rotated and about 14 px.

### Slide 9 · Collaboration

**Works.** The mock is credible. Owner-curated revisions are a real insight: a cousin's wish doesn't silently move a wall. The Maket contrast is sourced.

**Fix:**
1. **The whole slide is a mock of a feature that is not live,** two slides after "screens from the deployed app, not mockups". If it isn't live at submission, cut it to half a slide or fold it into the roadmap. A full slide of unshipped work costs more credibility than it earns on a 10% criterion.
2. **If it is live:** use real screenshots, and put a real client link to a sample home on the slide. A judge who can open it without an account is getting a demo.
3. **The footer lists four roles** (Owner · Team · Client · Viewer); **the kicker and body list three.** Pick one.
4. **Make the feasibility chips the readable focal point.** "Breaks front setback" and "Feasible · daylight improves" link to the agent story, so set them at 16 px or more. The surrounding mock text (11.5–15 px) can stay small.

### Slide 10 · Architecture on Google Cloud

**Works.** The diagram is simple and honest, and the single cobalt loop (Architect ↔ LDA engine) is the right emphasis. Exact versions in the footer signal real engineering.

**Fix:**
1. **Detached runs are in-process.** `api/app/runs.py` keeps events in a module-level `RUNS` dict ("One active run per project per instance") and relies on session affinity. That is fine for a demo, but a Cloud judge will ask two questions:
   - What happens when the instance scales in or restarts?
   - Is CPU allocated while no request is open after the tab closes? The README deploy command sets `--timeout 3600` but not `--no-cpu-throttling`.

   Confirm the CPU setting. Then state the path on the slide: "Today: in-memory event log + session affinity. Next: event log in Firestore + Cloud Tasks / Cloud Run jobs, so any instance can resume and replay." That turns a weakness into your scalability answer.
2. **Raise the diagram text to 16 px.** It is currently 13.5–14 px: the model chips (`.dg .t-m`), the sub-labels (`.dg .t-s`), and the service-card bodies.
3. **Add a caveat to "Generated code is screened":** it runs in the user's browser, and a sandboxed iframe is next (as slide 14 already says). Judges respect a stated threat model.
4. **If Cloud Logging and Cloud Trace are actually wired in, add them** (SETUP lists the `logging.logWriter` and `cloudtrace.agent` roles). Observability counts toward Technical merit. Omit them if they are not wired.
5. **The "Identity Platform · in the 18 Oct build" chip falls under P0.2.**

### Slide 11 · Technical depth

**Works.** The guardrails are specific and real: 6 attempts at 4–60 s on 408/429/5xx shared by google-genai and ADK, the degenerate-decoding guard, and 21 banned patterns. This slide tells a judge you shipped against real quotas.

**Fix:**
1. **The numbers row repeats slides 4, 7 and 12.** Use it for new evidence instead (P1.1): pass rate over N designs, median and p90 time, tool calls per revision, sections self-healed, and tokens and cost per design.
2. **Delete or replace "Honest numbers. Per-section latency isn't logged separately yet…".** Don't put a missing measurement on a slide: measure it from the SSE timestamps or remove the row. A judge will remember "isn't logged".
3. **The title promises "real quotas" but the slide shows no quota number.** If the logs have them, add how many 429s a design run absorbs and how many retries succeed.
4. **Change the footer to name the evidence:** "Measured on the live service · logs in docs/evidence/" (P0.5).

### Slide 12 · Naqsha vs maket.ai vs the status quo

**Works.** The comparison is fair, specific, dated and sourced, and the speaker notes admit that Maket reaches a 2D plan faster.

**Fix:**
1. **The insets compare different plots.** Maket was given the 1-kanal (50 ft wide) brief; Naqsha's inset is a 10-marla (35 ft) plan. Use the live 1-kanal 50 × 90 Naqsha run so the brief matches. Without that, the content brief's own rule ("treat both the same so it reads as fair") isn't met.
2. **The insets are about 330 × 200 px, so the 59′6″-versus-50′ problem is invisible.** Enlarge them to about 520 px wide. Draw a fail-red dimension line on Maket's footprint ("59′6″ house" against "50′ plot") and the cobalt envelope on Naqsha's.
3. **Put the trade-off from the notes into the Speed row:** "Maket is faster to a 2D plan; we spend the extra minutes on 3D and LDA checks." Saying it on the slide earns trust.
4. **Optionally, add a "general chat or image model" column.** Every judge will be thinking "why not just ask Gemini for a floor plan?"

### Slide 13 · Impact and business model

**Works.** Treating PCATP architects as stamping partners rather than competitors is a sharp regulatory insight. The Punjab expansion strip is concrete.

**Fix:**
1. **Impact, worth 25%, has no number.** Add one officially sourced figure, such as LDA residential plan approvals per year or a government housing-backlog figure, plus the per-family cost of a resubmission from slide 2. The footer "Impact … to be measured in pilots" is honest, but a judge reads it as "no impact evidence".
2. **Add any user validation you have.** Even three dated, attributed quotes from Lahore families, architects or builders would lift this slide more than the pricing cards. If there are none, make two or three calls before submission.
3. **"Ready for all of Punjab" overclaims.** Only LDA rules are live, and the RDA/FDA/GDA rule packs are "Next" on slide 14. Use "Lahore first. Built to extend across Punjab."
4. **"The engine already carries DHA and Bahria overrides" overclaims.** In `api/app/compliance/lda.py`, DHA overrides only height (39 ft) and storeys and keeps LDA setbacks as the baseline. Bahria returns no overrides, only a caveat. Say "An authority switch is built in: DHA height and storey caps today; Bahria shows a caveat until its SOPs are obtained."
5. **Two of the three pricing cards say "price to validate", which reads as unfinished.** Either state a PKR hypothesis labelled "hypothesis", or collapse pricing to one line. Today Maket's USD prices are the only real numbers on the slide, so they become the anchor.
6. **Price the free tier.** It includes four photoreal concepts. Once measured, state the image-generation cost per free user. It is both a business number and a scalability number.

### Slide 14 · Roadmap

**Works.** Now / Next / Later is clear, and Later is honestly labelled "ideas".

**Fix:**
1. **Every Now item is `in_progress` today,** and the footer "If anything in Now misses the deadline, it moves to Next" must be resolved before export (P0.2).
2. **There is no vision sentence and no milestone.** Add a one-line vision as the kicker, for example "Every Punjab family walks through a legal home before paying for drawings." Add one measurable milestone per column, such as "Next: rule packs for 3 authorities" or "Later: pilot with N PCATP architects". Use quarters, not dates you can't keep.
3. **Cut "A landing page with a Portal into the app".** It is trivial to a judge, and "Portal" is internal jargon.
4. **Drop the decorative timeline** (the blue line and dots at y≈355), and use the 40 px for the vision line.

### Slide 15 · Close and ask

**Works.** The tagline returns, and the QR code is verified.

**Fix:**
1. **Placeholders** (P0.1).
2. **The text runs over the faded house.** The ask rows (x≈120–820) run into the faded tree and porch from x≈700, and contrast drops. Extend the canvas fade to about 55% of the width, or set the left column on a solid canvas panel.
3. **These judges are not investors.** Keep one specific ask, or replace the asks with "What we'd build next on Google Cloud": for example, an event log on Firestore plus Cloud Tasks, and a pilot with N architects.
4. **Echo the memorable moment in one line:** "It said no to the porch, and told us which rule."

---

## Global findings

### 1. Required topics

| Topic | Where it is now | Status | Fix |
|---|---|---|---|
| Problem | Slide 2 | Strong, but not sized | Add the Rs figures (slide 2, point 1) |
| Vision | Kicker on slide 14 only | Implicit | Add one vision sentence to slides 13 or 14, and repeat it on 15 |
| Feasibility | Spread across 5, 10 and 11 | Not named | A "Feasibility & scalability" slide (P1.2), with evidence links |
| Scalability | Geographic only (13) | Missing on load, cost and quota | Cloud Run scaling, the event-log path, the 429 strategy, cost per design |

### 2. Claims that a judge cannot verify, or that overreach

| Slide | Claim | Problem | Action |
|---|---|---|---|
| 4, 7, 11 | 5→1→0, 4→0, ~95 s, 23–25, 42–50, 12–17 s | n of 1–2, no committed log | `docs/evidence/` + n on the slide |
| 7 | "5/5 livable", self-review notes | `in_progress`; the notes are illustrated | Verify, or remove from the hero |
| 9 | Whole slide | Design mock | Verify and re-shoot, or cut to half a slide |
| 6 | "same plot, same brief" | Not in the spikes README | Document or delete |
| 13 | "Ready for all of Punjab", "carries DHA and Bahria overrides" | Overclaims (see the code) | Reword (slide 13, points 3 and 4) |
| 13 | 1:100 drawing set for PCATP | Print is `in_progress` | Verify or mark "next" |
| 2 | "how most plans begin" | Unsourced | Change "most" to "many" |
| 3, 7 | 42/42 next to 42–50 | Inconsistent | Label "this plan" vs "typical" |
| Demo video | "half rejected", "approved-ready", "42 rules", "8 minutes" | Contradicts the deck | Rewrite the script (P0.4) |

### 3. Repetition

- The six headline numbers appear on slides 4, 7, 11 and 12.
- The 9 ADK tool names appear on slides 3 and 8.
- The spike appears on slides 3 and 6.
- The same house image appears on slides 1, 4, 6, 8, 9 and 15.

Each repetition takes space that new evidence could use. Show each number once, where it is argued, and let slide 11 carry new data.

### 4. Make the GenAI story one table

Judges scoring 40% on GenAI want to see deliberate model use. Right now the deck scatters it. Add a compact "One model, four jobs" strip to slide 6 or 10:

| Model | Job | Mode | Why this model |
|---|---|---|---|
| gemini-3.8-flash | Brief | Structured turns | Fast and cheap |
| gemini-3.1-flash-image | Concepts | 4 in parallel, 12–17 s | Speed over hero quality |
| gemini-4-argon | Plan | Schema-bound JSON ⟲ LDA engine (≤3) | Reasoning on constraints |
| gemini-4-argon | Build | Code against the typed SDK, from the concept image | Long, correct code; multimodal input |
| gemini-4-argon | Self-review | Vision critique of its own plan *(only if live)* | Multimodal judgement |
| gemini-4-argon + ADK 2.12 | Revise | 9 tools, dry-run before write, atomic save | Tool use |

### 5. Jargon to gloss at first use

| Term | Gloss | First use |
|---|---|---|
| marla, kanal | 10 marla ≈ 2,250 sq ft; 1 kanal = 20 marla | Slide 1 or 2 |
| LDA | Lahore Development Authority | Slide 2 |
| PCATP | Pakistan Council of Architects and Town Planners | Slide 2 |
| mumty | Roof stair tower | Slides 6 and 12 |
| chajja | Sunshade projection | Slide 11 |
| FAR | Floor-area ratio | Slide 7 |
| House SDK | "our three.js library that Argon writes against" | Slide 6 |
| PBR, BVH, SSE | Fine on slides 10 and 11; avoid them elsewhere | — |

### 6. Type floor

Anything a judge must read to score you should be at least 16 px on the 1920 canvas, and any text carrying a claim at least 18 px. These elements are below that:

| Slide | Element | Size now |
|---|---|---|
| 3 | Tool chips (`.s-why .tools .chip`) | 14.5 px |
| 4 | Engine lines (`.s-journey .stop .eng`) | 13.5 px |
| 7 | Fix-loop labels (`.s-trust .fixlbl`) | 14 px |
| 7 | Note labels (`.s-trust .note b`) | 12.5 px |
| 9 | Mock UI text | 11.5–15 px (acceptable for a mock, except the feasibility chips) |
| 10 | Diagram mono and secondary text (`.dg .t-m`, `.dg .t-s`) | 13.5–14 px |
| 13 | Tier price line (`.s-impact .tier .p`) | 14 px |

The footers (15 px mono, ink-3) are fine as metadata.

### 7. Memorability

Build the deck around one image: **the rule that says no.**

- Slide 2 states the rule (10′ open at the front).
- Slide 2 also shows the cost of breaking it (Rs 15–30k for the porch).
- Slide 8 shows the agent refusing the porch, citing the rule and offering the driveway.
- Slide 15 echoes it in one line.

A judge who forgets everything else will remember an AI that said no, and why.

### 8. Suggested order (still 15 slides)

1. Cover
2. Problem, with the Rs figures
3. Journey (was 4)
4. Live product, re-shot in v2 (was 5)
5. Argon designs in code, with "one model, four jobs" (was 6)
6. Trust (was 7)
7. ADK revisions, with the real refusal text and trace (was 8)
8. Architecture, with the detached-runs scaling path (was 10)
9. Proof: N runs, distributions, cost (was 11, reworked)
10. **Feasibility & scalability** (new; replaces Why now)
11. Comparison, on the same brief (was 12)
12. Collaboration (was 9; half a slide if not live)
13. Impact & business (was 13)
14. Vision & roadmap (was 14)
15. Close (was 15)

### 9. Checklist before export

- [ ] Every placeholder on slide 15 is filled; GitHub is also on slide 1.
- [ ] Every `in_progress` fact is checked on the live URL; chips say "Live" or the item has moved to the roadmap.
- [ ] v2 screenshots appear on slides 4 and 5, and "v1 screens" is gone from the footer.
- [ ] `docs/evidence/` is committed, and the footers cite it with n.
- [ ] Time to first section and cost per design are measured, or their rows are gone.
- [ ] Slide 8 shows the verbatim refusal text and the real tool trace, and its pins match the cards.
- [ ] Slide 12 insets use the same 1-kanal brief and are annotated.
- [ ] Dates read "9 Feb 2026", not "09-02-2026".
- [ ] The demo script is consistent with the deck (no "half rejected", no "approved-ready", 42–50, 12–17 s, ~7 min).
- [ ] Re-render the PNGs and the PDF, then read the PDF at laptop width to confirm nothing is below about 12 px on screen.
