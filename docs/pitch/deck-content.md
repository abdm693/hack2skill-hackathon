# Naqsha · نقشہ: pitch deck content

Google Cloud AI Builder Cup 2026 (Hack2skill, JAPAC working professionals). The prototype is due on 18 Oct 2026.
The deck is 15 slides at 16:9 and is exported to PDF. The built deck is `docs/pitch/deck/index.html`; its slide order differs from the numbering below (it has a Feasibility slide and no Why-now slide).

**Updated 17 Oct 2026 for live revision `naqsha-00009`, the shipped overhaul.** Every feature that was "in the 18 Oct build" is now live, and the screens are the v2 captures in `docs/screens/v2-live-*.png`.

Every number on a slide comes from `docs/pitch/deck/facts.json`. Each slide lists the fact IDs it uses under **Facts**. When a number changes, edit it in `facts.json` first, then search this file for the fact ID.

---

## How to use this file

### What the judges score, and where the deck answers it

| Criterion | Weight | Slides that carry it |
|---|---|---|
| Technical Merit & GenAI Implementation | 40% | 3, 6, 7, 8, 10, 11 |
| Problem Alignment & Impact | 25% | 2, 13 |
| Innovation & Creativity | 25% | 6, 8, 9, 12 |
| UX & Solution Design | 10% | 4, 5, 9 |

### Brand rules for every slide (from `docs/design/DESIGN.md`)

- **Canvas:** `#F6F6F3` (limestone) for slide backgrounds, `#FFFFFF` for cards, `#EEEEEA` for chips and tracks, and `#E4E4DF` hairlines.
- **Ink:** `#111113` for titles, `#46464B` for body and `#6E6E73` for captions. Nothing on a slide is lighter than `#6E6E73`.
- **One accent per slide:** cobalt `#2747F5` marks the single thing to look at, such as a key number, the current step or an arrow. Use `#EDF0FF` as its soft fill.
- **Compliance colours appear only on compliance content:** pass `#0E7A55` / `#E3F3EC`, warn `#A35A00` / `#FFF3DD`, fail `#C8281E` / `#FDECEA`.
- **Dark HUD for code and 3D overlays:** `#18181B`, with ink `#F5F5F7`, secondary text `#A3A3AD` and accent `#7D93FF`.
- **Type:**
  - **Geist** 600 for titles (tracking −0.03em) and Geist 400/500 for body, always in sentence case.
  - **Geist Mono** with tabular numerals for every dimension, count and time (`35′ × 65′`, `37/37`, `45–94 s`).
  - **Noto Nastaliq Urdu** only for نقشہ in the wordmark, at 70% opacity.
- **Shape:** images sit in 32px-radius frames, cards use a 20px radius, and chips a 10px radius. Leave generous white space and do not use drop-shadow stacks.
- **Never use** emoji, exclamation marks, all-caps, stock photos of people or icons in feature lists.
- **Voice:** a calm, experienced Lahore architect. Keep it warm and brief, and use marla and feet. Inside the product, the UI never says "Argon", "SDK" or "agent". The deck **does** name the models and tools, because 40% of the score is GenAI implementation.

### Before exporting the PDF

1. ~~Re-shoot the screens.~~ Done on 17 Oct: `docs/screens/v2-live-*.png` (revision `naqsha-00009`), wired through `docs/pitch/deck/assets.js`.
2. ~~Confirm what is live.~~ Done: collaboration, livable rules, self-review, day/night, per-floor program, solar and tank, print, accounts and the ADK setup agent are live. Their facts are no longer `in_progress`.
3. ~~Capture the spike.~~ Done (`assets/spike-oneshot-front.jpg`).
4. **Fill the placeholders:** the demo video URL, the team name and members, and the ask (slide 15). Make the GitHub repo public.
5. **Check the UI copy.** The live compliance panel says "Approval-ready" and the landing page says "approval-ready plan"; the deck says "pre-check". The deck's crops avoid those lines.

---

## Slide 1 · Cover

**Title:** Naqsha نقشہ

**Kicker:** Walk through your home before the first brick.

**Body:**
> From a rough idea to photoreal concepts, an LDA-checked floor plan and a 3D home you can walk, comment on and change. Gemini 4 Argon designs the house in code, a Google ADK agent revises it, and it all runs on Google Cloud.
>
> naqsha-242926648187.us-central1.run.app · [GitHub URL] · [Team name]
> Google Cloud AI Builder Cup 2026

**Visual direction:**
- Use `docs/screens/engine-argon-front.png` full-bleed. It shows the Argon-coded 10-marla house in its street, with neighbours, overhead wires, a stone pier and teak fins.
- Fade the left 40% into the canvas colour `#F6F6F3` and set the wordmark there: "Naqsha" in Geist 600 at about 96pt, then نقشہ in Nastaliq at 70% opacity.
- Set the kicker in Geist 500 at about 32pt in ink, and put the URL line in Geist Mono at 14pt in ink-3.
- The cobalt accent appears only as a 2px underline under the live URL.

**Speaker notes:**
"Naqsha is what Pakistani families call a house plan. Every house in Lahore begins with one, usually drawn on paper, then argued over for weeks. We built an agentic web app on Google Cloud that turns a family's idea into a house they can walk through before the first brick is laid. It's checked against Lahore Development Authority rules at every step. The house you see here wasn't modelled by a person. Gemini 4 Argon wrote it, as code."

**Facts:** `live_url`, `lda_text_version`

---

## Slide 2 · The problem

**Title:** In Lahore, a house starts as a sketch and a guess

**Kicker:** The rules are exact. The way families start is not.

**Body:**

*Left: the family*
> A family has a 10-marla plot in Johar Town. Six people, four bedrooms, one budget.
> They start with a sketch on paper and a contractor's guess. Then come weeks of back-and-forth with an architect before anyone sees the house. Nobody walks through it until it's built.

*Right: what that one plot must respect under LDA's current text (09-02-2026)*
- `10′` open at the front, `7′` at the rear and `5′` on one side
- `70%` ground coverage, `45′` to the top of the parapet, and `3` storeys (the 2020 text allowed `4`)
- Glazing of at least `8%` of each room's floor area; stairs at least `3′6″` wide, with risers of `7½″` or less
- Plans stamped by a PCATP-registered architect; LDA has `21` days to decide in an approved scheme
- A refusal must name the rule that was broken. A revised plan pays scrutiny again: `Rs 15` per sq ft
- Building into an open space on the ground floor: a `Rs 500` per sq ft penalty

*Bottom line, in ink:* The rules are written down. They just aren't in the room when the first sketch is drawn.

**Visual direction:**
- Use a two-column split on canvas.
- **Left:** a photograph of a real pencil sketch of a plan on lined paper, made by the team (no stock photos, no faces), slightly rotated, in a 32px frame.
- **Right:** a precise 35′ × 65′ plot drawing in ink hairlines, with the setback envelope as a cobalt dash and Geist Mono dimensions. The envelope on `v2-live-brief-understood.png` is a good reference.
- The rules list sits under the drawing in Geist with Mono numbers. Highlight one figure, `3` storeys, in cobalt, because it is the rule that changed.

**Speaker notes:**
"Picture a family in Johar Town with a 10-marla plot. Their house begins as a pencil sketch and a contractor's best guess. The rules for that plot are precise. Ten feet open at the front, seven at the rear, five on one side. Seventy percent coverage, forty-five feet, and now three storeys, not four. That changed in LDA's 2026 text, and memory doesn't update itself. A stamped plan is mandatory. When LDA refuses a plan, it has to cite the rule, and every resubmission pays the scrutiny fee again. The knowledge exists. It just isn't there when the family and their contractor start drawing."

**Facts:** `lda_setbacks_10_30_marla`, `lda_coverage_10m_1k`, `lda_height_10m_plus`, `lda_storeys_3`, `lda_storeys_2020_4`, `lda_glazing_8pct`, `lda_stairs`, `lda_pcatp_stamp`, `lda_decision_21_days`, `lda_refusal_names_rule`, `lda_scrutiny_fee`, `lda_penalty_open_space`, `problem_family_journey`, `lda_text_version`

---

## Slide 3 · Why now

**Title:** Why now: models that write buildings, agents that check them

**Kicker:** Gemini 4 Argon writes a house as working code. Google ADK gives it tools to keep that house legal.

**Body:**

**It writes working 3D code.**
In our first spike, Argon wrote `1,780` lines of three.js for a whole house in one pass, and it ran first time with no console errors.

**It acts through tools.**
ADK `2.12` lets Argon read the house, test a change against the rules and rewrite only what changed. It is an architect with a checklist, not a chatbot.

**The rules are now data.**
LDA publishes a consolidated text, dated 09-02-2026, and has accepted residential plans online since 2024. The rules also keep moving: storeys went from 4 to 3, and more amendments were approved in Aug 2026. Rules held as data mean one edit, not a retrain.

**Visual direction:**
- Three equal cards on canvas.
- **Card 1 ("Writes code"):** a dark HUD card with four real lines from `contracts/fixtures/argon-v1-design.js` in Geist Mono:
  `// @section facade_stone_pier [facade]` / `s.facade.cladding({ side: "front",` / `  from_x_ft: 12.2, to_x_ft: 16.5,` / `  material: { preset: "slate_cladding" } })`
- **Card 2 ("Uses tools"):** the 9 tool names as chips.
- **Card 3 ("Checks rules"):** the LDA PDF's title in ink-2, with a pass chip "● 37/37 · 10/10".
- The cobalt accent goes on the card 1 heading only.

**Speaker notes:**
"Two things changed this year. First, Gemini 4 Argon can write a building as working code. In our first spike it wrote almost eighteen hundred lines of three.js for a complete house, and it ran first time. Second, Google ADK turns that model into an agent with tools. It can look at a room, test a change against the rules and edit only what it must. Meanwhile the regulations themselves are changing. LDA's 2026 text cut the storey limit, and more amendments are approved but not yet published. We hold rules as data, so an update is one edit."

**Facts:** `spike_oneshot_lines`, `spike_oneshot_ran_first_time`, `adk_version`, `adk_tools_count`, `lda_text_version`, `lda_online_since_2024`, `lda_storeys_2020_4`, `lda_amendments_aug_2026`, `lda_checks_per_plan`

---

## Slide 4 · The journey in one glance

**Title:** One sitting, from an idea to a house you can walk through

**Kicker:** Brief, concepts, plan, 3D, walk and revise, each one a place you can come back to.

**Body:** six stops, each with one line and one engine.

| Stop | What the family gets | Engine | Time |
|---|---|---|---|
| **Brief** | One message. Naqsha shows "Here's what I understood" and asks only what's missing; the LDA envelope appears as soon as the plot is known. | Gemini 3.8 Flash on Google ADK + deterministic envelope | — |
| **Concepts** | Four distinct exteriors from the same camera and light, by day and by night | Gemini 3.1 Flash Image ×4, falling back to Nano Banana 2.1, then 3 Pro Image | `45–94 s` |
| **Plan** | A dimensioned *naqsha*, checked against LDA and livable-home rules, reviewed by Argon from a drawing, and fixed until it passes | Gemini 4 Argon + rules engine | inside `~5–6 min` |
| **3D** | The house: structure, facade, interiors, furniture, landscape and lights | Argon writing House SDK code, `23–25` sections | inside `~5–6 min` |
| **Walk** | Mouse look, floor moves, a room navigator, ghosted neighbours and night. Press C to pin a note on any surface | three.js r186 + three-mesh-bvh | live |
| **Revise** | v2 with "what changed", or the rule that says no, with an alternative. Requests typed in the Ask bar work too | Google ADK agent, 9 tools | `~70 s` |

**Visual direction:**
- Show a horizontal filmstrip of six frames in 32px frames: `v2-live-phone-brief.png`, the chosen concept (`c_0026dc7358eb-day`), `v2-live-plan-compliance-10marla.png`, `v2-live-house-orbit-10marla.png`, `v2-live-walk-lounge.png`, and the porch refusal quoted verbatim.
- Under each, put the stop name in Geist 600 and the time in a Geist Mono chip.
- Join the frames with a thin cobalt line. The one accent is the "~5–6 min" span bracket under Plan and 3D.
- Keep the engine column in ink-3 caption size, so judges can read it but families can ignore it.

**Speaker notes:**
"This is the whole journey in one sitting. The family describes the plot in one message, a setup agent on ADK says what it understood, and the LDA envelope appears at once. Four distinct concepts arrive in under a minute and a half, by day and by night. They pick one. Argon plans the floors, our engine checks them against LDA and livable-home rules, Argon reviews a drawing of its own plan and fixes what fails. Then Argon writes the 3D house as code. A 10 marla design takes five to six minutes. They walk through it, pin notes, and an ADK agent produces the next version in about seventy seconds."

**Facts:** `concepts_time`, `full_design_time`, `code_sections_count`, `adk_revision_time`, `adk_tools_count`, `model_setup`, `setup_one_message`, `model_concepts`, `concepts_day_night`, `model_architect`, `livable_rules`, `self_review`, `walk_features`, `adk_porch_rejected`, `stack_threejs`, `stack_bvh`

---

## Slide 5 · Live product

**Title:** It's live on Cloud Run today

**Kicker:** These are screens from the deployed app, not mockups.

**Body:** six captioned screens.
1. **House.** The 1 kanal villa in 3D: tiled roofs, rooftop solar and a two-car porch.
2. **Plan.** The 10 marla sample: 37/37 LDA and 10/10 livable, no warnings.
3. **Versions.** Version 2, from two comments: what changed, in feet.
4. **Phone.** The same house on a phone.

*Footer:* naqsha-242926648187.us-central1.run.app. Open a sample home and walk it in a minute.

**Visual direction:**
- Arrange a 3×2 grid of 32px-radius frames on canvas, with a Geist 500 caption in ink-2 under each.
- Use the v2 live captures: `v2-live-house-orbit-villa.png`, `v2-live-plan-compliance-10marla.png` (cropped below the panel's "Approval-ready" line), `v2-live-revisions-from-comments.png` and `v2-live-phone-house.png`.
- Put a QR code to the live URL bottom-right in ink on white. The cobalt accent is the URL.

**Speaker notes:**
"Everything in this deck runs at this URL, and these screens were captured from it today. Open a sample home to skip the design run. You can orbit, switch floors, walk in first person and switch to night. The plan screen shows the compliance panel: thirty-seven of thirty-seven LDA checks and all ten livable-home rules pass, with no warnings. Version two came from two comments left in 3D, and every change is listed in feet. And it works on a phone."

**Facts:** `live_url`, `live_revision`, `two_live_samples`, `lda_checks_per_plan`, `adk_window_enlarged`, `samples_endpoint`, `mobile_screens`

---

## Slide 6 · Argon designs in code

**Title:** Argon designs in code, not pixels

**Kicker:** First a plan small enough to check. Then a house written section by section against our House SDK.

**Body:**

*Three steps, left to right:*

**1 · Plan.**
Argon emits a schema-bound JSON plan in feet: levels, rooms, doors, windows, stairs, roof, mumty and boundary wall. The rules engine checks it against LDA and livable-home rules, and the failures go back to Argon with specifics (`3` rounds, up to `5` on big briefs). Argon then reviews a drawing of its own plan.

**2 · Build.**
Argon writes `design.js` as `23–25` named sections (`structure`, `facade_*`, `interior_*`, `furnish_<room>`, `landscape`, `lighting`) against our House SDK. The SDK provides real wall openings, `44` PBR material presets, `57` furniture types, landscape and lighting, plus raw three.js for bespoke facade pieces.

**3 · Stream.**
The viewer renders after every section, so the family watches the house assemble.

*Why code beats generating images or meshes:*
- **Exact.** Dimensions come from the plan, and windows are real openings in real walls.
- **Checkable.** Every object is tagged `{layer, level, room, kind}`, and an as-built check confirms nothing projects into a setback.
- **Editable.** A revision replaces one section, such as `furnish_g_lounge`, not the whole house.
- **Walkable.** Real geometry gives collisions, stairs, section cuts and comments pinned to the wall you clicked.

*Before and after:*
- **One shot, raw three.js:** `481 s`, `1,780` lines, and a blocky result.
- **House SDK in sections:** streamed, editable and far higher fidelity, with PBR materials, real furniture and landscape. The whole run, checks and self-review included, now takes `~5–6 min` for a 10 marla home.

**Visual direction:**
- Show the pipeline as three cards joined by cobalt arrows.
- **Plan card:** a small floor plan from `v2-live-plan-compliance-10marla.png` with Geist Mono dimensions.
- **Build card:** a dark HUD code card with the real `facade_stone_pier` section header and three lines below it.
- **Stream card:** a filmstrip of 4 thumbnails showing structure, then facade, then furniture, then landscape. Capture these from the viewer's layer toggles.
- **Bottom band, before and after:** on the left, `spike-oneshot.png` (to capture) with the caption "One shot: 481 s, blocky"; on the right, `engine-argon-front.png` with the caption "House SDK: 23 sections". Use the same frame size for both so the jump in fidelity speaks for itself.

**Speaker notes:**
"Our first spike asked Argon to write a whole house in raw three.js. It worked, but it took eight minutes and looked blocky. So we split the job. First Argon produces a plan as structured JSON, in feet, small enough for a deterministic engine to check. Then it writes the house as short, named sections against our own House SDK, which holds the hard parts: real openings, PBR materials, a furniture kit. Each section renders as it arrives. Because the house is code, it's exact, it's checkable, it's walkable, and a revision only touches the section that changed."

**Facts:** `spike_oneshot_time`, `spike_oneshot_lines`, `spike_oneshot_blocky`, `plan_max_attempts`, `code_sections_count`, `sdk_material_presets`, `sdk_furniture_types`, `sdk_object_tags`, `asbuilt_check`, `section_edits`, `stream_per_section`

---

## Slide 7 · Trust: compliance, livable rules, self-review

**Title:** Argon is creative. The rules are code.

**Kicker:** A deterministic engine checks every plan, the engine enforces safety itself, and Argon reviews its own drawing like an architect would.

**Body:**

**LDA engine (live).**
`18` check types from LDA's 09-02-2026 consolidated text, applied per room and per stair: `37` checks on the 10 marla sample and `43` on the 1 kanal villa. They cover setbacks, coverage, FAR, height, storeys, mumty, parapet, boundary wall, room sizes, clear height, `8%` daylight, ventilation, stairs and water tank.
Argon's adaptive fix loop, measured live on a big 1 kanal brief: `15 → 5 → 0` failures.

**Livable-home rules (live, 10 rules).**
- Roof kept clear for solar.
- Rooms are independent: bedrooms open only to circulation, a lounge, a balcony or their own bath.
- Every room has a proper way in, never through a bedroom or bath.
- Stairs reach every floor and the roof; the roof door is at the top of the stair.
- Doors and windows fit their walls; rooms match the brief.
- A railing on every stair edge and void; doors clear of furniture; a clear `3′` path to every door.

The engine guarantees railings, door keep-outs, walkways, parking and the roof door at the stair landing, whatever Argon writes. Both samples pass `37/37 · 10/10` and `43/43 · 10/10` with no warnings.

**Self-review (live).**
Argon looks at a drawn image of each of its own floors, with room names and sizes. It critiques circulation, privacy, proportions, daylight and the brief, then revises.

**Why we made safety deterministic.**
We audited three of our own houses the way a senior Lahore architect would. All three had stair-safety defects. One roof stairwell edge had a 22 ft drop and no railing. LDA doesn't define guards, so we apply IBC 2021: a guard where the drop is more than 30 in.

*Footnote, ink-3:* Naqsha is a pre-check, not an approval. A PCATP-registered architect still stamps the plan.

**Visual direction:**
- **Hero:** the compliance chip, large, in Geist Mono: "● 37/37 LDA · 10/10 livable", with the dot in pass green.
- **Under it:** a fix-loop bar labelled 15, 5 and 0, moving from fail red through to pass green.
- **Middle:** the live panel's livable-home list (`v2-live-plan-compliance-villa-livable.png`).
- **Right:** the drawing Argon reviews (`v2-backend-review-ground.png`), then the stairwell railings and the roof door from the walk (`v2-live-walk-stairwell-railings.png`, `v2-live-walk-roof-door.png`).

**Speaker notes:**
"Trust is the product. Every plan goes through a deterministic engine built from LDA's official 2026 text: eighteen kinds of check, applied per room and per stair. We also audited our own houses as a senior Lahore architect would, and found stair edges with no railing. So ten livable-home rules run in the same loop, and the engine guarantees railings, door clearances and the roof door at the landing. Both samples pass every rule with no warnings. On a big 1 kanal brief we watched fifteen failures become five, then zero. For everything subjective, Argon looks at a drawing of its own plan and critiques it before you see it."

**Facts:** `lda_check_types`, `lda_checks_per_plan`, `lda_text_version`, `fix_loop_15_5_0`, `plan_max_attempts`, `livable_rules`, `engine_invariants`, `self_review`, `two_live_samples`, `audit_stair_defects`, `audit_22ft_drop`, `ibc_guards`, `disclaimer_pcatp`

---

## Slide 8 · Agentic revisions with Google ADK

**Title:** Comment in 3D. The agent revises, or tells you which rule says no.

**Kicker:** A Google ADK agent with 9 tools works like an architect: it looks, tests, changes only what's needed and explains.

**Body:**

*The tools:*
`get_rooms` · `list_sections` · `read_sections` · `sdk_reference` · `check_plan_ops` · `apply_plan_ops` · `write_section` · `remove_section` · `finish`

*How it works:*
1. Each comment arrives pinned to a room, an element and a level, with a snapshot of what the family saw.
2. The agent reads only the room and code sections it needs.
3. It dry-runs layout edits against the LDA engine until they pass.
4. It rewrites only the affected sections.
5. It records a resolution for every comment.

*The 10 marla sample's v1 → v2 run, 2 comments, 70 s:*

| Comment (verbatim) | Result |
|---|---|
| "Please make the master bedroom window bigger, we want much more morning light." | **Done.** Front glass from 7 × 7.5 ft to 9 × 8.5 ft; balcony screen opened up |
| "Can we extend the car porch 4 ft forward into the front lawn?" | **Not possible.** It breaks the `10′` front setback; a deeper porch inside the building line was offered |

The same porch request on the 1 kanal villa was refused too, with a different alternative: a front canopy up to 3 ft past the setback line. Requests typed in the Ask bar go through the same agent (the 10 marla sample's v3).

*Safety net:* if the ADK run fails, a single-shot reviser takes over. ADK saves nothing until it finishes.

**Visual direction:**
- **Left (40%):** `v2-live-comments.png`: the comments sheet over the 3D house.
- **Centre:** a vertical tool trace in Geist Mono on a dark HUD card, using the app's own progress labels: "Looking at bedroom_2…", "Testing a layout change…", "Applying layout change…", "Rewriting furnish_g_lounge…", "Resolving comment…".
- **Right:** the three result rows as cards with status chips (Done in pass green, Not possible in fail red). Crop the porch reason from `app-revisions.png`.
- The cobalt accent goes on `check_plan_ops`, the tool that makes the refusal principled.

**Speaker notes:**
"This is the moment families love. They walk through the house, press C and leave notes where they stand. Then a Google ADK agent with nine tools takes over. It doesn't reread the whole house. It looks up the rooms, reads the sections it needs, and tests every layout change against the rules engine before applying it. On the 10 marla sample it enlarged the master bedroom window, and refused to push the porch four feet into the lawn: that would break the ten-foot front setback, so it said so and offered alternatives. It took seventy seconds."

**Facts:** `adk_tools_count`, `adk_tool_names`, `adk_revision_time`, `adk_window_enlarged`, `adk_porch_rejected`, `conversational_edits`, `lda_setbacks_10_30_marla`, `adk_fallback`, `comment_anchor`

---

## Slide 9 · Collaboration

**Title:** The family, the architect and the builder, in one home

**Kicker:** Owner, Team and Client roles, a link for the client, and comments with names and replies.

**Body:**
- **One Share dialog.** Turn on a client link (view and comment, no account needed), or invite Team or Client by email (invites need a free account).
- **Clients need no account.** At `/s/<token>` they see "Shared with you · You can comment", walk the house, pin notes and approve the version.
- **Every comment has an author.** It carries a name and a role, and replies thread underneath. Naqsha answers in the thread with what it changed (Done, or Not possible with the rule).
- **The owner decides what goes into the next revision.** Team comments go in by default. Client comments wait for the owner.
- **Accounts.** Accounts run on Google Identity Platform. A guest's homes move into the account when they sign in.

*Contrast line, in ink-3:* Maket.ai offers a view-only link and nothing else.

**Visual direction:**
- Three live captures side by side: `v2-live-share-dialog.png`, `v2-live-client-view.png` and `v2-live-comments.png` (the comments sheet).
- The client comment on the capture ("Ayesha") and the owner's reply were posted on a guest copy for the screenshot and deleted with it.

**Speaker notes:**
"A house is never one person's decision. The owner invites their architect or builder as Team, and their family or client by link. Clients don't need an account. They type a name, walk the house and pin comments. Every comment shows who said it, and Naqsha replies with whether it's feasible. The owner chooses which comments go into the next revision, so a cousin's wish doesn't silently move a wall. Maket, the best-known AI floor-plan tool, offers a view-only link and nothing else."

**Facts:** `collab_roles`, `collab_share`, `collab_client_link`, `collab_comment_authors`, `collab_owner_picks`, `auth_identity_platform`, `stack_identity_platform`, `maket_collab_view_only`

---

## Slide 10 · Architecture on Google Cloud

**Title:** One Cloud Run service, Gemini on Vertex AI, state in Firestore

**Kicker:** Simple to run, and built for long agent jobs.

**Body (diagram):**

```
Browser · React 19 + Vite · three.js r186 · react-three-fiber · three-mesh-bvh
        │  REST + Server-Sent Events
        ▼
Cloud Run "naqsha" · FastAPI · us-central1 · one service serves API + SPA
  ├─ Setup agent ...... Google ADK, gemini-3.8-flash (5 tools) + LDA envelope
  ├─ Concepts/renders . gemini-3.1-flash-image × 4 (day + night) → Nano Banana 2.1 → 3 Pro Image
  ├─ Architect ........ gemini-4-argon: plan JSON ⟲ rules engine (3, up to 5) → self-review → design.js
  ├─ Reviser .......... Google ADK 2.12 Agent (gemini-4-argon), 9 tools ⟲ LDA engine
  ├─ Rules engine ..... deterministic Python: lda_rules.json (from LDA's official PDF) + livable rules (planning.py)
  └─ Detached runs .... jobs outlive the tab; SSE replay on re-attach
        │
        ├─ Vertex AI · Gemini Enterprise Agent Platform · global endpoint
        ├─ Firestore ........ projects, messages, versions, comments
        ├─ Cloud Storage .... concepts, renders, comment snapshots
        └─ Identity Platform  email accounts; guests claim their homes
```

*Four callouts:*
- **One service, one URL.** There's no CORS, and deployment is a single `gcloud run deploy --source .`.
- **Long jobs run detached.** A design keeps going if the browser drops, and the browser re-attaches and replays every event.
- **The global endpoint.** The newest Gemini models are served only on `global`.
- **Generated code runs in the browser,** and is screened before it does.

**Visual direction:**
- Redraw the diagram as clean boxes on canvas. Google Cloud services sit in white cards with 20px radius; models sit in chips with a tiny Geist Mono model ID.
- The browser is at the top, Cloud Run is in the middle as one large card with the six modules inside, and the data and AI services form a row at the bottom.
- Draw arrows as 1.5px ink lines. Only one arrow is cobalt: the loop between Architect and the LDA engine.
- Use official Google Cloud product names, with no product logos unless the brand guidelines allow them.

**Speaker notes:**
"The architecture is deliberately simple. One Cloud Run service serves both the API and the app. Gemini runs through Vertex AI on the global endpoint, which is the only place the newest models are served. Firestore holds projects, versions and comments, and Cloud Storage holds images. The interesting part is the loops. Argon plans against the deterministic engine, and the ADK reviser tests every change against it too. Design runs take minutes, so they're detached. Close the tab, come back, and the stream replays from where you left."

**Facts:** `stack_cloud_run`, `stack_firestore`, `stack_gcs`, `stack_vertex_global`, `stack_identity_platform`, `adk_version`, `genai_version`, `stack_threejs`, `stack_r3f`, `stack_bvh`, `detached_runs`, `one_service`, `model_setup`, `model_concepts`, `model_architect`, `plan_max_attempts`, `self_review`, `live_revision`

---

## Slide 11 · Technical depth

**Title:** Built for real models on real quotas

**Kicker:** The numbers, and the guardrails that make them repeatable.

**Body:**

*Numbers row (large, in Geist Mono):*

| `45–94 s` | `37–43 + 10` | `15 → 5 → 0` | `~5–6 min` | `9 tools · ~70 s` | `~200 · 123` |
|---|---|---|---|---|---|
| four concepts, with fallbacks | LDA checks + livable rules per plan | failures, fixed by Argon (big brief) | one 10 marla design: plan, checks, review, 3D | one ADK revision | fixes from agent testing · API tests |

*Guardrails:*
- **Quota 429s and 5xx errors** are retried with exponential backoff and jitter: 6 attempts, from 4 s up to 60 s, on 408/429/500/502/503/504. google-genai and ADK share the same retry policy.
- **Degenerate decoding.** Streams are watched as they arrive. A runaway tail such as `35.0000000…` aborts the attempt and retries it, and prompts cap numbers at 2 decimals.
- **Detached runs.** Long jobs survive a closed tab, and the client re-attaches and replays every event.
- **Self-healing sections.** If a section throws in the browser, Argon rewrites only that section.
- **Code safety.** `21` banned patterns (network, `eval`, storage, timers, globals) are screened out before any section runs.
- **Fallbacks.** If ADK fails, a single-shot reviser takes over. If the code is missing, a default design is built from the plan.
- **As-built check.** Nothing in the 3D model may project into a setback beyond LDA's chajja allowance (3 ft where the open space is at least 10 ft, otherwise 1.5 ft).
- **Quality loop.** 8 tester agents per round used the live app over 3 rounds and a final verification: about 200 fixes, and every must-fix item confirmed on the deployed code. The API has 123 tests.

**Visual direction:**
- The top third is the numbers row: six Mono figures at about 44pt with ink-3 captions under them. Only `15 → 5 → 0` is cobalt.
- The bottom two thirds hold the guardrails in two columns, as plain text with a bold lead-in and no icons.
- Optionally, add a tiny sparkline-free "attempt timeline" for the fix loop: three ticks labelled 5, 1, 0.

**Speaker notes:**
"Here are the numbers we measured on the live service, and what keeps them repeatable. The global endpoint's shared quota returns 429s under load, so every call retries with exponential backoff and jitter, in both google-genai and ADK. Constrained decoding sometimes loops on digits, so we watch the stream and cut it off. Design jobs are detached from the browser. Generated code is screened before it runs, a broken section repairs itself, and the ADK agent has a fallback. None of this shows in the demo, which is the point."

**Facts:** `concepts_time`, `lda_checks_per_plan`, `livable_rules`, `fix_loop_15_5_0`, `full_design_time`, `adk_tools_count`, `adk_revision_time`, `retry_policy`, `model_concepts`, `degenerate_guard`, `detached_runs`, `section_repair`, `code_screen_patterns`, `adk_fallback`, `engine_invariants`, `asbuilt_check`, `quality_loop`, `api_tests`, `must_fix_verified`

---

## Slide 12 · Naqsha vs maket.ai vs the status quo

**Title:** Built for this plot, in this city

**Kicker:** Maket's own FAQ says its designs aren't ready to build. Ours are checked against LDA rules before you see them.

**Body:**

| | Sketch + contractor | maket.ai (tested 16 Oct 2026) | Naqsha |
|---|---|---|---|
| **Knows the plot** | From memory | No. It read a 50 ft plot as the house and drew a 59′6″-wide house on it | The LDA envelope comes first; LDA and livable-home rules on every plan |
| **Local rooms** | Yes | US-centric: a mudroom, but no drawing room, dirty kitchen or servant quarter | Drawing room, TV lounge, dirty kitchen, servant quarter, prayer room |
| **Floors and stairs** | On paper | Single floor on the free tier; no stairs anywhere | Up to 3 storeys, LDA-checked stairs and a roof mumty |
| **3D** | None until it's built | Massing and walk with no collision; the exterior is a white box | Facade, interiors and furniture written as code; walk with collisions and stairs |
| **Changes** | Redraw by hand | Chat edits at 5 credits each, on paid plans | Pin a comment in 3D; the agent revises it or cites the rule |
| **Collaboration** | In person | A view-only link | Owner, Team and Client roles, a client link and threaded comments |
| **Speed** | Weeks to a first drawing | About 6 min and 8 actions to a furnished 2D plan | 45–94 s to concepts; about 5–6 min to a walkable 3D house |

**Visual direction:**
- Use a full-width table on white, with 1px `#E4E4DF` row lines and no vertical rules.
- The Naqsha column has an `#EDF0FF` accent-soft fill with ink text. The other columns are ink-2.
- Above the table, show a small inset from `docs/research/maket/25-plan-result.png` captioned "Maket: 59′6″ house on a 50 ft plot", beside `v2-live-plan-compliance-villa.png` captioned "Naqsha: inside the 10′ / 7′ / 5′ envelope". Treat both screenshots the same way, so it reads as fair.

**Speaker notes:**
"We tested maket.ai on the sixteenth, briefing it as a Lahore family would. It's polished, and we borrowed its best ideas. But it read our plot as the house and drew a building wider than the land, with no warning, because it has no idea what a setback is. It has no drawing room, no stairs, and collaboration is a view-only link. It takes about six minutes to a 2D plan; we take five to six to a house that's local, legal, livable and walkable."

**Facts:** `maket_faq_not_ready`, `maket_plot_as_house`, `maket_us_centric`, `maket_single_floor_no_stairs`, `maket_walk_no_collision`, `maket_white_box`, `maket_edit_cost`, `maket_collab_view_only`, `maket_time_to_plan`, `lda_checks_per_plan`, `concepts_time`, `full_design_time`, `status_quo_qualitative`

---

## Slide 13 · Impact and business model

**Title:** Free to imagine. Paid to build. Ready for all of Punjab.

**Kicker:** One engine, four audiences, and a path across Punjab's development authorities.

**Body:**

*Who it serves:*
- **Families:** see, walk and agree on the house before paying for drawings.
- **Architects and builders:** win the client in the first meeting, with a walkable concept and an LDA pre-check in one sitting, and clients comment from a link.
- **Developers and housing schemes:** a sample home for every plot size in a scheme, to sell plots with.
- **PCATP architects as stamping partners:** they receive a pre-checked drawing set at 1:100, the scale LDA asks for. They review it, stamp it and submit it.

*Pricing idea (to test in pilots; no prices set yet):*
- **Free:** the brief, the LDA envelope and four concepts.
- **Per home:** the plan, 3D, walkthrough, revisions and a print set.
- **Pro seats** for architects and builders: client links, branded title blocks, many homes.
- **Partner referral:** a handoff to a stamping architect.

*For reference:* maket.ai charges $20 a month (Homeowner) and $100 a month (Pro).

*How it scales across Punjab:*
`LDA` → `RDA · FDA · GDA` (adopted LDA's 2020 text) → `MDA` (its own 2020 rules) → `DHA Lahore` (Aug 2026 bylaws, 39 ft cap) and `Bahria Town` → local-government areas.
Rules are data. The engine already carries DHA and Bahria overrides.

**Visual direction:**
- **Left half:** four audience rows, each with a bold lead and one line, with no icons.
- **Right half, top:** a simple Punjab expansion strip as Mono chips joined by hairline arrows. LDA is the only cobalt chip, and the others are outlined.
- **Right half, bottom:** a small three-tier pricing card set (Free, Per home, Pro), with "price to validate" in ink-3 where the price would go.
- Do not show a market-size number unless a sourced figure is added to `facts.json`.

**Speaker notes:**
"Families get to see and walk their home before paying for drawings. Architects and builders get a sales tool: a walkable, LDA-checked concept in the first meeting. Developers can show a home for every plot size. And because the law requires a PCATP-registered architect to stamp the plan, we see those architects as partners, not competitors. We hand them a pre-checked set at the scale LDA asks for. Pricing is a hypothesis we'll test in pilots. Expansion is mostly data work: three other authorities adopted LDA's 2020 text."

**Facts:** `lda_pcatp_stamp`, `lda_plan_scale_1_100`, `print_1_100`, `maket_pricing`, `punjab_rda_fda_gda`, `punjab_mda`, `punjab_dha`, `punjab_bahria`, `punjab_lgcd`, `engine_authority_overrides`, `pricing_proposal`, `impact_unmeasured`

---

## Slide 14 · Roadmap

**Title:** Roadmap

**Kicker:** From a Lahore pre-check to the front door for house design in Punjab.

**Body:**

**Now, live on revision `naqsha-00009` (17 Oct):**
- livable-home rules and Argon's self-review
- collaboration: roles, client links, threaded comments
- accounts on Identity Platform; guests claim their homes
- the one-message setup agent on Google ADK, with a per-floor program and tank and solar questions
- day and night concepts
- print or save as PDF at 1:100
- a landing page with a Portal into the app

**Next:**
- drag-to-swap rooms with an instant LDA re-check
- Google sign-in
- a sandboxed iframe for generated code
- glTF export
- rule packs for RDA, FDA and GDA, then DHA and Bahria Town

**Later (ideas, not yet specified):**
- pilots with LDA-enlisted PCATP architects
- submission-ready drawing sets for LDA's online system
- structural and services drafts
- an Urdu interface
- cost estimates

**Visual direction:**
- Three columns (Now, Next, Later) on canvas, each a white card with a Geist 600 heading. The "Now" heading is cobalt.
- Items are plain lines with no checkboxes. Use ink-3 for the "ideas" label under Later.

**Speaker notes:**
"Everything in the Now column is live today, and a final round of agent testing confirmed every must-fix item on the deployed code. Next is about depth: direct manipulation of the plan, Google sign-in, a sandbox for generated code, and the rule packs that take us beyond Lahore. Later is where the business is. We want to pilot with architects who stamp plans, and produce drawing sets ready for LDA's online submission. Those are ideas today, not commitments."

**Facts:** `overhaul_scope`, `must_fix_verified`, `roadmap_drag_swap`, `roadmap_google_signin`, `roadmap_sandbox_iframe`, `roadmap_gltf`, `roadmap_rule_packs`, `roadmap_later_ideas`, `lda_online_since_2024`

---

## Slide 15 · Close and ask

**Title:** Walk through your home before the first brick.

**Kicker:** Naqsha is live. Open a sample home in a minute, or design your own in about six.

**Body:**
- **Live:** naqsha-242926648187.us-central1.run.app
- **Code:** github.com/abdm693/hack2skill-hackathon (to be made public before submission)
- **Demo:** [video URL, under 3 min]

**Our ask** (team to confirm):
- [Introductions to LDA-enlisted PCATP architects and Lahore builders for a pilot]
- [Google Cloud credits to run the pilot]
- [Your feedback on the agent design]

**Team:** [Team name] · [Name, role] · [Name, role] · [Name, role] · [Contact]

**Visual direction:**
- Return to the cover house, ideally its night concept so the deck ends at dusk. Otherwise use `engine-argon-front.png` again with a warm overlay.
- The wordmark sits top-left. Put the links in Geist Mono and a QR code to the live URL bottom-right.
- Lay out the team as a simple row of names and roles, with no headshots unless the team supplies real ones.
- The cobalt accent is the live URL.

**Speaker notes:**
"Naqsha takes a family from an idea to a house they can walk through, checked against the rules of the city they're building in. It's live, the code is public, and the agents are real. Argon designs in code, the engine keeps it legal, and ADK revises on request. We'd love introductions to the architects and builders who'd pilot it with us. Thank you."

**Facts:** `live_url`, `full_design_time`, `samples_endpoint`

---

## Claims kept off the slides

These appear in earlier drafts but have no source, so the slides leave them out. `facts.json` lists them with `"status": "unverified"`.
- "Half of plans get rejected for breaking LDA bylaws", from `docs/pitch/demo-script.md` 0:00–0:15.
- "Approved-ready" or "approval-ready". Use "LDA-checked" or "LDA pre-check" instead. Approval needs a PCATP stamp and an LDA decision.
- Any market size, number of plots or houses built per year, or cost per design. Add these only with a source.
- "Seconds per section" as an exact figure. Per-section latency hasn't been logged separately, so the slides say "streamed section by section".
