# Judge's critique, round 2: Naqsha deck (15 slides, revision naqsha-00009)

Reviewer stance: a Google Cloud AI Builder Cup judge. Rubric: Technical Merit & GenAI 40%, Problem Alignment & Impact 25%, Innovation & Creativity 25%, UX & Solution Design 10%. Required topics: problem, vision, feasibility, scalability.

Inputs: all 15 renders in `renders/`, `index.html` (slides and speaker notes), `deck.css`, `facts.json`, `docs/evidence/live-samples-2026-10-17.json`, `docs/pitch/demo-script.md`, and spot checks in `api/` and `web/`. I also checked the live service, GitHub, and the QR code (see "Verification log" at the end).

---

## Verdict

This deck is much stronger than round 1. Most of the round-1 P0 and P1 items landed:

- There is a real Feasibility and scalability slide (10), with Cloud Run settings and the event-log path.
- The agent's answers are quoted verbatim (7), and the porch refusal now runs through slides 2, 3, 7 and 15 as the deck's motif.
- Slide 2 states the cost in rupees, worked from Appendix C.
- Slide 8 has a "Gemini, matched to each job" table.
- The deck shows two houses instead of one.
- Every screenshot is from the v2 UI.
- The vision is the headline of slide 14.
- No `in_progress` chips remain, and the type floor is fixed. Only screenshot-internal text is still below 16 px.
- The demo script now matches the deck.

What still costs points, in order of weight:

1. **The evidence trail is broken.** The GitHub repo returns 404. `docs/evidence/` describes the *previous* samples, and its numbers contradict slide 7. The live UI says "Approval-ready", and the deck's QR code sends judges straight to that screen.
2. **Every performance number has n = 1.** The deck never measures the system's output quality across runs. Slide 9's hero stats measure the team's process (fixes merged, tests), not the product.
3. **Impact has no human evidence.** There are no user or architect conversations and no sourced market figure, and pricing is "no prices set yet". All the testing was done by AI tester agents.
4. **Some comparisons are not like-for-like.** Slide 11 compares Maket's end-to-end time with Naqsha's design-run-only time, on a different plot size. Slide 10 puts a run that was not the villa's in the villa's table.

**Rough scorecard (my read):**

| Criterion | Round 1 | Now | After the P0 and P1 fixes below |
|---|---|---|---|
| Technical & GenAI (40%) | 7.5 | 8.5 | 9.2 |
| Problem & Impact (25%) | 6 | 6.5 | 7.8 |
| Innovation (25%) | 8 | 8.5 | 8.8 |
| UX & Design (10%) | 7 | 8.5 | 9 |
| **Weighted** | **≈7.2** | **≈8.0** | **≈8.7** |

---

## P0: fix before submission

These cost credibility the moment a judge clicks a link.

### P0.1 Make the GitHub repo public
`https://github.com/abdm693/hack2skill-hackathon` returned **HTTP 404** on 17 Oct. Slides 1 and 15 both cite it, and the slide 15 speaker note says "Make the GitHub repo public before submission". A 404 on the code link is the most expensive single defect in the submission. After you flip it, open the link in a logged-out browser to confirm.

### P0.2 Fill the placeholders
- Slide 1: `[Team name]`.
- Slide 15: `[video URL, under 3 min]`, `[Team name]`, three `[Name, role]` fields and three "photo" circles.

Dashed placeholder boxes in an exported PDF read as an unfinished submission.

### P0.3 Change "Approval-ready" in the live UI, not just in the deck
- The deck says "Naqsha is a pre-check, not an approval" (slide 6 footer).
- The live UI says otherwise:
  - `web/src/app/plan/CompliancePanel.tsx:87` renders **"Approval-ready · 37/37 LDA · 10/10 livable"**;
  - `web/src/app/landing/Landing.tsx:21` reads "Plot to approval‑ready plan the same afternoon";
  - `Landing.tsx:129` reads "an LDA‑ready design".
- The QR code on slides 4 and 15 sends judges straight to those screens.
- The slide 4 note says the crop was chosen to hide that line, and the demo script says "Don't zoom on it". A judge who notices will read that as concealment.

Change the UI to "LDA pre-check passed · 37/37 · 10/10" (keep the `approvalReady` logic and change only the copy), then redeploy. It is a three-string change that removes the deck's only honesty gap.

### P0.4 Regenerate `docs/evidence/` for revision naqsha-00009 and cite it on the slides
`docs/evidence/live-samples-2026-10-17.json` (written 01:11, before the v3 samples) contradicts the deck:

| | Evidence file | Deck |
|---|---|---|
| Sample IDs | `p_8bf503d8a2c4`, `p_19a4237e1c61` | `p_5a5893a2bcaa`, `p_1a42e70989af` (slide 7 and 10 notes) |
| v2 window change | "13×8.5 ft with a 0.5 ft sill", plus a sofa restyle | "9 × 8.5 ft" plus balcony louvers (slide 7) |
| `_meta.not_here` cites | "12–17 s, ~7 min, ~95 s, 5 → 1 → 0" | 45–94 s, 5–6 min, 70 s, 15 → 5 → 0 |

A judge who opens the evidence file finds numbers the deck no longer uses and a v2 the deck does not show. To fix it:

1. Re-run the same `GET /api/samples` / clone / `gcloud run services describe` capture against the current samples.
2. Add the v1 → v2 timestamps (05:38:04 → 05:39:14 UTC), the comment IDs quoted on slide 7, and the 15 → 5 → 0 run's failure counts.
3. Cite the file in the footers of slides 3, 6, 7 and 10. Today no slide names `docs/evidence/`.

### P0.5 Resolve the "livable" denominator on slide 7
- Slides 4, 6, 10 and 14 say "10 livable-home rules" and "10/10 livable".
- Slide 7's change log says **"36/36 LDA · 12/12 livable · still pass"**.
- A judge sees a fixed rule set of 10 pass "12/12".

Pick one fix:
- label the row "v2 at the time: 36/36 LDA · 12/12 livable checks (livable checks repeat per stair and room)" and say the same once on slide 6; or
- write "every LDA and livable check still passes" and drop the counts from that row.

### P0.6 Stop attributing runs to the wrong house
- **Slide 10, villa column:** "Big briefs: ~6.5 min · fails 15 → 5 → 0" sits in the villa's table. The slide 10 note says that run was "not necessarily the sample's own run". Either move the row under "How it scales" as "A separate big 1 kanal brief: ~6.5 min, failures 15 → 5 → 0", or measure the villa brief itself.
- **Slide 11, Speed row:** the subtitle says "the same 1-kanal brief", but Naqsha's figure ("About 5–6 min") is the 10 marla design-run time. Maket's "About 6 min" is blank dashboard to plan, with about 8 user actions; its plan generation alone took about 2 min (`facts.json: maket_time_to_plan`). The like-for-like versions are:
  - generation only: Maket about 2 min to a 2D plan; Naqsha about 6.5 min to a checked, walkable 3D house for this brief;
  - end to end: Maket about 6 min; Naqsha about 8 min (concepts 45–94 s plus design about 6.5 min).

  Being slower but doing far more is still a win, and it is the version that survives a judge who reads the teardown.

---

## P1: the biggest score movers

### P1.1 Show output quality across runs, not one run (Technical, 40%)
Every system number is still a single observation: 45–94 s, 5–6 min, 70 s, 15 → 5 → 0, 37/37 and 43/43. The two houses are the two public samples, which a judge will assume were chosen.

Run a small batch: 8–10 briefs across 5 marla, 10 marla and 1 kanal, at least one corner plot, and at least one deliberately illegal request. Report:

- the share of plans that pass every LDA and livable check after round 1, round 3 and round 5;
- failures per round (median), to generalise 15 → 5 → 0;
- design time, median and p90;
- sections that self-healed per house;
- ADK tool calls per revision, and whether each illegal request was refused with the right rule;
- tokens and Vertex AI cost per design (see P1.2).

Put the result on slide 9 in place of "~200 fixes merged / 123 API tests / All". Those stats describe the team's effort. A judge scoring GenAI wants the model's hit rate. Log the batch to `docs/evidence/` (or to Cloud Logging and BigQuery, which also adds an observability line to slide 8).

### P1.2 Measure cost per design
`facts.json: cost_per_design` is "unverified", and slide 10's "Cost follows intent" is qualitative. Feasibility, scalability and the business model on slide 13 all hinge on this one number. To get it:

1. Sum the input and output tokens for one 10 marla run: setup, plan with its fix rounds, self-review, build sections and section repair.
2. Add the image calls. The Free tier as described generates **8 images per user**: four concepts, each with a night version. Price that tier explicitly.
3. Multiply by the Vertex AI list prices.

Then state it on slide 10 ("≈ $X per 10 marla design; ≈ $Y per free user") and on slide 13 next to the pricing idea.

### P1.3 Put one human voice and one sourced number on the Impact slide (Impact, 25%)
- Today all validation comes from AI tester agents (slide 9).
- Pricing is "no prices set yet".
- The only hard numbers on slide 13 are Maket's USD prices, which become the anchor.
- `market_size` is "unverified".

Before submission:
- **Three dated conversations:** one Lahore family planning a build, one PCATP architect and one builder. A single sentence each, with first name and role, is enough. Put them on slide 13.
- **One official figure,** such as LDA residential plan approvals per year or new housing units in Lahore, with its source. If none can be sourced, leave it out, as you did in round 1.
- **A sourced number you already have but don't use:** `lda_decision_21_days` (regulation_verified). LDA must decide within 21 days, so every resubmission costs about Rs 41,000 *and* another 21-day wait. Add that to slide 2's cost block and to the Families row on slide 13. On a house budget, Rs 41,000 is small. A month's delay per mistake is the pain families feel.
- **A pricing hypothesis in PKR,** labelled "hypothesis", for example "Per home: Rs X". Then drop or demote the Maket line.

### P1.4 State the code-execution threat model on the slide
- Slide 8 says "design.js runs here, after a code screen", and slide 9 says "21 banned patterns … screened out of generated code before it runs".
- That is a static regex screen (`web/src/engine/index.ts:125`) followed by `new Function` (`web/src/engine/build.ts:99`). String concatenation such as `x['constr'+'uctor']` passes all 21 patterns.
- The client link lets anyone comment, and the agent turns comments into code that runs in the owner's browser and in every viewer's. A technical judge will ask about prompt injection leading to code execution. The owner choosing which comments reach the agent is a real mitigation, but no slide says so.

Either:
- ship the sandbox now. It is on slide 14's Next list. One way: run `design.js` in an opaque-origin `sandbox="allow-scripts"` iframe or a Worker, then post the built scene back as JSON. This takes more than a line, because the code builds THREE objects today; or
- add one honest line on slide 9: "A screen, not a sandbox. Only comments the owner picks reach the agent. Sandboxed iframe next."

Judges reward a stated threat model and penalise a discovered one.

### P1.5 Keep the live service warm during judging
The first request to the live URL on 17 Oct took **17.3 s**; the next ones took 0.45 s. Judges scan the QR code once, so set `--min-instances 1` for the judging window. It also protects the in-memory event log that slide 10 relies on. Then add the real bottleneck to slide 10: say whether it is the shared Vertex AI quota or CPU, and how many designs can run at once at maxScale 5 × concurrency 40.

### P1.6 Show multimodality where it already exists (GenAI)
Two strong multimodal facts are true in the code but missing from the slides:

- **The ADK reviser sees what the family saw.** It receives up to 8 comment snapshots as images (`api/app/agents/reviser.py:129–132`, used in `reviser_adk.py:242`). Add a line to slide 7, under the Look step: "sees each comment's snapshot".
- **Self-review produces real text, but the deck never shows it.** Slide 6 shows the drawing Argon looks at (and `facts.json` notes it is of an earlier plan), not what Argon said. The v2 summary records "3 review notes" and the villa "2 architect's notes". Quote one verbatim, with its version ID. A real critique, such as "Bedroom 3 is reached through the lounge…", is worth more than the image.

### P1.7 Label the photoreal images that are not the 3D output
- **Slide 15:** the hero is a Gemini 3.1 Flash Image concept (note: `c_0026dc7358eb`), unlabelled, next to "Walk through your home before the first brick." Judges will assume that is what they get to walk through. When they open the app they find three.js, which is good but clearly CG. Add a small caption ("Concept by Gemini 3.1 Flash Image, at night"), or use the 3D night view.
- **Slide 1:** the house is Argon's first 10 marla house of 16 Oct, not a live sample. Add "Argon's first house, 16 Oct" to the caption chip so a judge who looks for it in the app isn't confused.

### P1.8 Make the before/after on slide 5 prove itself without its caption
- The "Before" (one-shot) image has warm golden-hour light, an orange accent and a cartoon tree. At thumbnail size it looks *more* inviting than the flat, grey daylight "After".
- The pier outline down the middle of "After" reads as a seam or render glitch.
- The camera matches now, but the light does not.

Re-render "After" in the spike's golden-hour light, or "Before" in daylight. Add two small callouts per image, for example "box windows, flat colour" against "real openings, PBR stone, furnished rooms". Make the pier outline a visible cobalt stroke so it reads as "one section". This is the deck's best technical argument, so it must not depend on reading the caption.

---

## P2: polish, slide by slide

### Slide 1 · Cover
- Works. The headline and the drawing-to-house split are memorable, and the scored sentence ("Gemini 4 Argon designs the house in code… Google ADK agents…") now has its own weight.
- Fix: P0.2 (team name) and P1.7 (date the house).

### Slide 2 · Problem
- Works. The worked rupee figures from Appendix C, the glossed acronyms, "how many plans begin" and the cobalt "3 storeys, down from 4" row are all good.
- Fix "penalty for **its** 14′6″ porch pushed 4 ft…". It reads as if Naqsha's own design breaks the rule. Write "if its 14′6″ porch were pushed 4 ft…".
- Add USD equivalents at a dated rate for non-Pakistani judges, for example "≈ Rs 41,000 (≈ $X at the 17 Oct rate)".
- Add the 21-day decision period (P1.3).

### Slide 3 · Journey
- Works. It is the clearest "what is it" slide, and the bracket with "sample homes open instantly" defuses the wait.
- The chips still mix units: "1 message", "45–94 s", "live", "~70 s", with no chip on Plan or House. That is acceptable because the bracket covers them. If you measure how long the brief step takes, put that time on the Brief chip so every chip is a time.
- Does the setup agent accept a Roman-Urdu brief, for example "10 marla Johar Town, 4 kamray, north facing"? If it does, show that brief here. It is a cheap, memorable Impact and UX point for Lahore families, and "An Urdu interface" is already on slide 14's Later list.

### Slide 4 · Live product
- Works. Real v2 captures, captions that each name one claim, and a phone.
- The QR code is about 128 px on the 1920 canvas, roughly 3.5 px per module. The SVG source decodes to the live URL, but OpenCV could not decode it from the rendered PNG. Enlarge it to about 200 px here and on slide 15 so it scans from a projector or a laptop showing the PDF.
- The plan crop hides "Approval-ready" (see P0.3). Once the UI copy changes, show the full panel header. It becomes a trust signal instead of a hidden line.

### Slide 5 · Argon designs in code
- Works. The Plan → Rules engine → Build → Stream flow, the stream filmstrip, "Inputs: plan JSON · concept image · SDK types", and the punchline "The whole pipeline now finishes sooner than the one shot took to write blocky code alone."
- Fix: P1.8.
- Add "23–25 sections" only after recounting it on the v3 samples (`facts.json` discrepancy 3). Otherwise leave it out, as now.

### Slide 6 · Trust
- Works. It is still the best title in the deck. 15 → 5 → 0 is now labelled honestly ("a big 1 kanal brief"), and the IBC rationale is a mature touch.
- Fix: P1.6 (a verbatim self-review note).
- Give "18 LDA check types" its denominator logic once: "37 checks on this house: 18 types, applied per room and stair". Then 36, 37 and 43 never look inconsistent.

### Slide 7 · ADK revisions
- Works. It is the strongest slide. It has the verbatim answers, the two different refusals for two houses, the change log, "why an agent, not one prompt" in the kicker, and the disclosure that the client note was added for the capture.
- Fix: P0.5 (12/12).
- The Look → Test → Change → Explain loop is still a diagram, not a trace. ADK records every tool call in the session. Paste the real ordered calls from the 70 s run under the loop, for example `get_rooms → read_sections ×2 → check_plan_ops ✗ → check_plan_ops ✓ → apply_plan_ops → write_section ×2 → finish`, with a count ("N tool calls in 70 s"). A trace is proof; a loop is a claim.
- Add "sees each comment's snapshot" (P1.6).

### Slide 8 · Architecture
- Works. The model-to-job table answers "why these models" in one glance. "One service, one URL" is persuasive.
- The diagram says "Vertex AI" and its subtitle says "Gemini Enterprise Agent Platform" for the same thing. Pick one name, or write "Vertex AI (Gemini Enterprise Agent Platform)" once.
- The image fallbacks mix IDs and marketing names: "gemini-3.1-flash-image… falls back to Nano Banana 2.1, then 3 Pro Image". Use model IDs throughout here and on slides 9 and 10.
- Add observability if it is wired in: Cloud Logging for run timings and tokens. That also produces P1.1 and P1.2.

### Slide 9 · Engineering
- Works. The six guardrails map to pipeline steps, each with a specific mechanism. "Built for real quotas" is earned.
- Replace the hero stats with system-quality numbers (P1.1).
  - If you keep process stats, use countable ones: `facts.json` records 160 triaged tasks against "~200 fixes".
  - "All must-fix items confirmed" is not a number. Write "N/N".
  - "Tested by agents" is a fine headline, but add one sentence on what those agents could not judge, and point to P1.3's human conversations.
- Add the threat-model line (P1.4).

### Slide 10 · Feasibility and scalability
- Works. It answers both required topics by name, with real Cloud Run settings and an honest "Today / Next" for long jobs.
- Fix: P0.6 (the villa row), P1.2 (cost) and P1.5 (warm instance and bottleneck).
- "Autoscales to 5 instances today… The cap is one flag." Add the obvious next sentence: what limits you at 10× load. It is almost certainly the shared Gemini quota, so say how many concurrent designs one quota sustains.

### Slide 11 · Comparison
- Works. It uses the same 50 ft brief, with an annotated 59′6″-versus-50′ failure, and it is dated and sourced.
- Fix: P0.6 (the Speed row).
- Optional: a "Gemini chat alone" column. Every Google judge will think "why not just ask Gemini for a plan?" Slide 5's one-shot answers it partly, and one row here ("Knows the plot: no envelope, no checks") would close it.

### Slide 12 · Collaboration
- Works. The screens are real, the roles are consistent (Owner, Team, Client), "Clients need no account" is clear, and "the owner picks which comments go into the next version" is the key insight.
- The client-view screenshot's UI text is too small to read. Crop tighter on "Shared with you · You can comment" and the "Approve v3" button, at about 1.5×.

### Slide 13 · Impact and business model
- Works. The four audiences, PCATP architects as partners, and the honest authority strip ("bylaws not published") are all good.
- Fix: P1.3. This slide carries the 25% criterion and today has no human or market evidence.
- Move "Pilot metrics to track" from the footer into the body, with a target per metric (for example "first-submission acceptance: baseline vs pilot"). A metric with a target reads as a plan; a footer reads as an afterthought.

### Slide 14 · Vision and roadmap
- Works. The vision as headline, the Live chips verified on the service, and a milestone per column.
- The Now milestone ("Every must-fix item confirmed on the deployed code") is internal. Make it user-facing, for example "Two briefs, two houses, every rule passing, live".
- "Google sign-in" is too small to be a Next item. Fold it into "Accounts". Promote the sandboxed iframe if it is not shipped by then (P1.4).
- Put a quarter on Next and Later ("Q1 2027", "2027") so the milestones can be checked.

### Slide 15 · Close
- Works. The tagline returns, it ends on the porch, and "What we'd build next on Google Cloud" is the right ask for this jury.
- Fix: P0.1, P0.2, P1.7, and the QR size (slide 4 note).
- The left column now sits on a solid canvas, which fixes the round-1 contrast issue.

---

## Required topics

| Topic | Where | Status now | Remaining gap |
|---|---|---|---|
| Problem | Slide 2 | Strong, sourced and costed | Add the 21-day delay and USD equivalents |
| Vision | Slide 14 headline, echoed on 1 and 15 | Clear | None |
| Feasibility | Slides 4 and 10 (live, two houses) | Good | n = 1 per number; cost per design missing; the evidence file is stale |
| Scalability | Slide 10 (Cloud Run, quota, long jobs, cost), slide 13 (authorities) | Good structure | No load number, no cost number, no named bottleneck |

## Claims a judge can falsify today

| Slide | Claim | What a judge finds | Action |
|---|---|---|---|
| 1, 15 | github.com/abdm693/hack2skill-hackathon | HTTP 404 | P0.1 |
| 6 footer | "a pre-check, not an approval" | The live UI says "Approval-ready" and "approval‑ready plan" | P0.3 |
| 7 | 9 × 8.5 ft window, 70 s | The evidence file says 13 × 8.5 ft and a sofa change, for other sample IDs | P0.4 |
| 7 | 12/12 livable | Slides 6 and 10 say there are 10 livable rules | P0.5 |
| 10 | Villa: ~6.5 min, 15 → 5 → 0 | The note says it was not the villa's run | P0.6 |
| 11 | Speed: 5–6 min vs Maket's 6 min, "same 1-kanal brief" | The 10 marla design-run time vs Maket's end-to-end time | P0.6 |
| 8, 9 | Generated code is "screened" before it runs | The regex screen is bypassable by string concatenation | P1.4 |
| 15 | Photoreal hero beside "Walk through your home" | It is a 2D concept image, not the walkable 3D house | P1.7 |

## Verification log (17 Oct 2026)

- `curl https://github.com/abdm693/hack2skill-hackathon` returned **404**.
- `curl https://naqsha-242926648187.us-central1.run.app/` returned 200 in **17.3 s** cold, then 0.45 s and 0.45 s. `/api/samples` returned 200 in 0.8 s.
- The QR code: the `#qr-live` SVG path in `index.html`, rasterised, decodes to `https://naqsha-242926648187.us-central1.run.app`. OpenCV could not decode it from `slide-04.png` or `slide-15.png` at render size.
- "Approval" wording: `web/src/app/plan/CompliancePanel.tsx:87`, `web/src/app/landing/Landing.tsx:21` and `:129`.
- `docs/evidence/live-samples-2026-10-17.json` (mtime 01:11 on 17 Oct) contains samples `p_8bf503d8a2c4` and `p_19a4237e1c61`, does not mention `p_5a5893a2bcaa` or `p_1a42e70989af`, and its `_meta` cites 12–17 s, ~7 min, ~95 s and 5 → 1 → 0.
- The banned-pattern list is 21 entries (`web/src/engine/index.ts:125`), and the screened code runs via `new Function` (`web/src/engine/build.ts:99`).
- The reviser sends up to 8 comment snapshots as images (`api/app/agents/reviser.py:129–132`, `reviser_adk.py:242`).
- `docs/pitch/demo-script.md` is consistent with the deck: 45–94 s, 5–6 min, 70 s, 37/37 and 10/10, and no "approval-ready" claim.
- CSS type floor: only `.s-journey .revcard` (14–14.5 px), the 15 px captions and log heads, and the avatar labels on slide 15 are below 16 px. All of these are acceptable.
