# Journey audit: landing → setup → concepts → design (live app)

Tested: 16 Oct 2026, 22:55–23:45 PKT, on the live build at https://naqsha-242926648187.us-central1.run.app (built-in browser, 1440×900 desktop, plus 375×812 phone).
Stance: a brand-new Lahore homeowner, with a demanding UX critic and QA engineer looking over their shoulder. I edited no code.

## Reusable test projects

Projects belong to the guest UUID that created them. Opening a URL from another browser returns **404 "project not found"** (see W-6). To reuse one, set `localStorage["naqsha.uid"] = "7c27b88c-26bb-43ef-b90a-cbadfcae4ffd"` (or send the header `X-Naqsha-User: 7c27b88c-26bb-43ef-b90a-cbadfcae4ffd`), then open the URL.

| Project | URL | State |
|---|---|---|
| **Main audit house.** 10 marla Johar Town, mid-row, faces north, 2 storeys, 5 bedrooms (2 on the ground floor, 3 on the first). Brief also asks for parents on the ground floor, an open kitchen, a dirty kitchen, a kitchenette and lounge upstairs, a double-height lounge, solar and a concrete tank, plus a prayer room added after v1. | https://naqsha-242926648187.us-central1.run.app/p/p_7c7155bd46bd/design | **v1** `v_14fc3f797c8c` (42/42 LDA, broken first floor) and **v2** `v_e1308f4a4094` (from "Design again", 47/47 LDA, current). Both are ready. Concept A1 remix selected. 10 concepts. |
| Widget test house. 5 marla corner plot, faces east, finished with "Skip setup". | https://naqsha-242926648187.us-central1.run.app/p/p_6f2f5a63b6a5/concepts | 4 concepts, none selected |

The main house's selected concept is `c_3d9d0c1ac30f`. To pull a plan: `GET /api/projects/p_7c7155bd46bd/versions/{vid}` with the header above.

## Severity scale

- **Blocker:** the result is wrong in a way the user has already called out, or it breaks trust in the core promise ("an LDA-compliant, sensible house").
- **Major:** a clear defect or missing capability that a judge or customer will notice.
- **Minor:** friction or rough edges.
- **Polish:** copy, visual or consistency nits.

---

## 1. Verdict in ten lines

1. **Blocker: the first-floor layout in v1 is not architecturally sound, yet LDA says "42/42 pass".** Bedroom 3 can only be entered through Bath 3 or through the Master Bath. Bedroom 4 can only be entered from an open-air terrace. One bath opens straight into the family lounge. The compliance engine has no circulation or privacy rules, so the panel shows a confident all-green result (D-1…D-4). A re-run (v2) happened to be mostly sound, so quality is a lottery. In run 2's first attempt the master bedroom was reachable only through the prayer room.
2. **Blocker: concepts show corner plots for a mid-row plot.** In 5 of the first 6 images the street wraps around the house. The live prompt is identical for corner and non-corner plots, and one of the 4 camera variants is literally "three-quarter view from the street corner" (C-1).
3. **Major: the setup agent stated a wrong LDA fact.** It said "maximum height of 38 feet (including mumty)", while the panel beside it says 45 ft with the mumty excluded (S-6).
4. **Major: adding a prayer room after the design was built silently regressed the project.** The stage went from ready to "concepts", the workspace card now says "Concept chosen" and the agent says "we're set to begin generating concepts". Nothing tells the user that v1 no longer matches the brief (X-1).
5. **Major: the landing page overflows on phones.** At 375 px the headline, the body copy, the "Start" CTA and the sample cards are cut off at the right edge (L-1).
6. **Major: the user cannot choose rooms per floor, and the planner does not honour it when told.** Run 2 put 4 bedrooms upstairs and 6 in total, against a brief of 5 with 3 upstairs (S-9, D-9).
7. **Major: the "Four directions" are one design.** All 4 prompts share the same design language and differ only in camera and light (golden hour, overcast, dusk, afternoon). That makes the comparison non-apples-to-apples, and it is the root of the user's day/night request (C-2, C-3).
8. **Major: the design screen reads as a developer console.** It shows raw `s.furnish(...)` code, "15,054 chars", model names and section ids, which works against the business-focused, Jony-Ive-minimal direction (G-1). The floor plan cannot be zoomed and its labels are about 6–7 px (P-1).
9. **Major: there is no print or PDF, no share, no sign-in.** A project link only works in the browser that created it (W-6, P-6).
10. **Works well:** one-shot parsing of a long brief, the instant LDA envelope, the plot, rooms and style widgets, the photoreal concept quality, an excellent remix, a visible LDA fix loop (4 → 0), resume after refresh, and click-a-check-to-highlight-the-room. Build time was **4 min 25 s** (faster than the 7 min estimate).

---

## 2. Timings observed

| Step | Time |
|---|---|
| New project → greeting with chips | ~4 s |
| Long free-form brief → parsed and the next question asked | ~8–10 s |
| Each later chat turn (typed or chip) | **18–40 s** ("Choosing the next question… 25s", and "No, let's design!" took about 40 s) |
| "Skip setup — design it for me" | ~10 s |
| 4 concepts | ~20 s, all 4 in parallel |
| Remix (2 variations) | first at ~10 s, second at ~40 s |
| "Four more" | E and F at ~25 s; G and H at **~150 s**, with only a fake progress bar |
| Design run 1: plan attempt 1 | 1:31 (4 LDA violations) |
| Design run 1: plan attempt 2 | 2:30 (42/42 pass) |
| Design run 1: 3D code (20 sections) and save | 2:31 → **4:25 total** |
| Design run 2 ("Design again", brief now includes a prayer room) | attempt 1 at about 1:35 (5 violations); the fix attempt took about 4 min; **about 7–8 min in total** (47/47 pass, 18 sections) |

Console: no app errors. The only 404 in the log came from my own unauthenticated fetch. Every SSE request (`/intake`, `/concepts`, `/design`, `/run`) is logged as `net::ERR_ABORTED` even when it succeeds, which is noisy (X-9).

---

## 3. Landing and workspace

| ID | Sev | Finding | Evidence / repro | Suggested fix |
|---|---|---|---|---|
| L-1 | **Major** | The landing page overflows horizontally on phones. The headline ("From idea to a walkabl…"), the body copy, the **Start** button and both sample cards are clipped at 375 px. | Resize to 375×812 and load `/`; `scrollWidth` = 488. Root cause: the hero grid has no mobile column template, so the implicit track grows to the min-content of the sample card button. Measured min-content: **472 px** (`Workspace.tsx` `SampleCard`; the `flex` button and the third line are not truncatable). The h1 then stretches to 472 px. | Give the grid `grid-cols-1` / `minmax(0,1fr)` on mobile and `min-w-0` on its children. Also `truncate` the "Walkable in 3D…" line. Re-check at 320/375/414. |
| L-2 | Major | There is no real landing page. `/` is the workspace with a hero bolted on. There is no house-under-construction animation, no business-value list and no separate **Portal** button, all of which the user asked for. The five-step strip ("Brief, Concepts, Naqsha, Walk, Revise") and the hero copy ("dimensioned naqsha", "LDA envelope", "pin comments") describe the pipeline, not outcomes. | First load of `/`. | Split `/` (marketing) from `/app` (portal). Lead with outcomes: "Approval-ready plans in an afternoon", "See your home before you pour concrete", "Every room checked against LDA". Add a line-drawn house that assembles (plinth → columns → slabs → facade → stamp). |
| L-3 | Major | The project card's "…" menu is clipped by the card (`overflow-hidden` on the `<article>`), so **Delete is unreachable**. You can only see Open and half of Rename. | Workspace → "…" on any card. Menu bottom = 855 px, card bottom = 802 px. | Render the menu in a portal (Radix `DropdownMenu`/`Popover`), or drop `overflow-hidden` from the card and clip only the thumbnail. |
| L-4 | Minor | Each click on "Explore a sample home" **clones** the sample into "Your projects", so repeat visits create duplicate cards with identical names. Two "Sample · 10 marla modern home, Johar Town" cards were already in this workspace. | `Workspace.tsx` `openSample → api.cloneProject` | Reuse an existing clone (same `source_id`), or open samples read-only and clone only on the first edit. |
| L-5 | Minor | "Guest workspace" is static text. There is no sign-in, no account, and no hint that projects live only in this browser. | Header top-right. | Make it a menu: "Saved in this browser · Sign in to keep and share". |
| L-6 | Polish | Escape does not close the project actions menu. | Open "…", press Esc. | Close on Escape and return focus. |
| L-7 | Polish | The sample cards and the hero "New project" card are `<button>`s with no accessible name in the a11y tree. | `read_page` lists `button [ref_1..3]` with no names. | Add `aria-label`. |
| L-8 | Polish | No `og:title` or `og:image` meta tags, so shared links render bare in WhatsApp and Slack. | `<head>` | Add Open Graph tags with a hero render. |

## 4. Setup agent (conversation and brief)

The test message was: "We have a 10 marla plot in Johar Town, not a corner, facing north. Two storeys, 5 bedrooms with attached baths, my parents need their bedroom on the ground floor, drawing room near the entrance, open kitchen plus a dirty kitchen, car porch for 2 cars, solar panels on the roof, and a concrete water tank. Modern style please."

**What it captured in one turn (good):** scheme, LDA authority, 35×65 plot, `corner:false`, facing N, 2 storeys, 5 beds, 6 baths (inferred, flagged "AI-chosen"), drawing room, TV lounge, kitchen, dirty kitchen, 2-car porch, laundry, powder room and Modern Contemporary style. The notes field held: parents on the ground floor, drawing room near the entrance, solar provision, concrete overhead tank. It then asked only for the budget, which was the right question.

| ID | Sev | Finding | Evidence / repro | Suggested fix |
|---|---|---|---|---|
| S-1 | **Major** | **The brief panel hides half of what was captured.** Notes (parents on the ground floor, solar, concrete tank, per-floor split) are never shown, nor is "Not a corner plot". The user cannot verify that the agent listened. The reply "Zabardast! I have captured all your requirements" does not play anything back either. | Compare the Brief panel with `GET /api/projects/{id}` → `brief.notes`. `BriefPanel.tsx` renders no `notes` row; the Corner pill only appears when the value is true. | Add a "Your notes" row with bullet chips, and an explicit "Corner: No". Make the agent's first reply a one-line read-back: "Got it: parents' suite downstairs, open kitchen + dirty kitchen, solar and a concrete tank." |
| S-2 | **Major** | **"Open kitchen" was silently dropped**, and the notes are overwritten on each turn. The first-turn notes lost "open" kitchen. The later notes were rewritten from scratch. The v1 plan has a closed kitchen with a door. | `brief.notes` after turns 1, 2 and 3; plan room `g_kitchen` has `door:g_kitchen<>g_lounge`. | Treat `notes` as an append-only list (or structured `requirements[]`) and merge server-side instead of replacing. Add `kitchen: "open" \| "closed"` to the brief. |
| S-3 | **Major** | **Spaces become raw, invented slugs.** The brief panel shows `kitchenette first floor`, `tv lounge first floor`, `double height lounge` and `powder room` in lowercase. The `kitchen` slug is present in the data but missing from the panel. | Brief panel after turn 2. | Constrain `spaces` to an enum (schema), and put per-floor placement in a separate structured field (see S-9). Map every slug to a label, and fall back to Title Case. |
| S-4 | Major | **Latency kills the "conversation".** Each turn after the first took 18–40 s, with "Choosing the next question… 25s" and "No, let's design!" taking ~40 s. maket.ai-class competitors answer in 2–5 s. | Timings in §2. | Stream `message.delta` first and compute chips afterwards. Use a smaller or faster model for chip turns. Answer fixed-choice chips (budget, storeys) locally with no LLM round trip. |
| S-5 | Minor | It ignored a direct question. I asked "And did you note it's not a corner plot?" and got no acknowledgement. | Turn 2 reply. | The prompt should say: answer the user's questions first, then ask the next question. |
| S-6 | **Major** | **The agent states wrong LDA facts.** Asked "What is the maximum height LDA allows for us?", it said "**38 feet (including mumty)**". The envelope on the same screen says **45 ft to the parapet, mumty ≤ 9′6″ excluded**, which is the correct band for 10 marla to 1 kanal. A compliance product cannot do this. | Post-design turn on `p_7c7155bd46bd`. `intake.py` gives the model no envelope facts and no tool to look them up. | Inject the computed envelope and notes into every intake turn, and instruct it to quote only those numbers. Better still, answer rule questions with a deterministic tool (`lda_envelope`, `lda_rule(topic)`). |
| S-7 | Minor | The agent says "I'll generate your concept designs right away" but nothing happens until you click "Generate concepts". | Final setup turn. | Either auto-start (with an undo) or change the copy to "Tap Generate when you're ready." |
| S-8 | Minor | After the brief was complete, the composer placeholder still suggests "Anything else? e.g. elderly parents on the ground floor", which the user had already said. | Composer placeholder. | Rotate the suggestions based on what is not in the brief yet (water tank, solar, basement, servant quarter). |
| S-9 | **Major** | **There is no per-floor control.** The rooms widget only offers totals (bedrooms, baths, storeys, porch) and a flat checklist. The user explicitly wants "how many rooms on each floor and what goes on each floor". The agent did capture my free-text split into notes, but there is no structured field, so the planner can ignore it (see D-9). | Rooms widget on `p_6f2f5a63b6a5`. | Add a "Floors" widget: one column per floor with steppers (bedrooms, baths) and toggles (kitchen, drawing, lounge, dining), plus a structured `brief.floors[]` that the planner and the compliance engine both enforce. |
| S-10 | Major | **The water tank and the roof are never asked about.** Nothing asks about the tank type (blue plastic or concrete) or rooftop solar, and there is no "keep the roof clear" option. The `BuildingPlan` roof schema has no solar element, so solar exists only as a facade code section (`facade_boundary_and_solar`) and never appears on the roof plan. | `architect.py` roof schema: `parapet_ft`, `mumty`, `water_tank` only. | Add an optional "Roof" step (tank: plastic / RCC; solar: none / provision / array kW; roof use: terrace / clear). Add `roof.solar {rect, kw}` to the plan schema, and show it on the roof plan. |
| S-11 | Minor | The brief panel cannot be edited directly. To fix one value (for example facing) you must chat. The "Everything is editable" claim after Skip is not true in the UI. | Click any brief row: nothing happens. | Make rows inline-editable (popover with the same widget), and post a system line into the chat. |
| S-12 | Polish | The budget chips are ordered Standard, Premium, Luxury, Economy. | Budget turn. | Order them by price. |
| S-13 | Polish | The user bubble after the map widget reads "Front faces East facing". | `p_6f2f5a63b6a5`. | "Front faces east". |
| S-14 | Polish | The facing chips offer only N/E/S/W, although the schema supports 8 directions. Lahore plots are often NE or SW. | Map widget. | Add a compass with 8 directions. |
| S-15 | Minor | The project name stays "Untitled home" after a fully conversational setup, but Skip auto-names it ("5 marla house, Lahore"). | Both projects. | Auto-name whenever plot and location are known. |
| S-16 | Minor | For a corner plot, the envelope note "Corner plot: keep a 5 ft splay…" is computed but never shown, because the panel renders `env.notes.slice(0, 4)` and the corner note is the 5th. The diagram also draws only one road. | `BriefPanel.tsx:237`; `lda.py envelope()` appends the corner note last. | Show all notes, or prioritise the corner note. Draw the second road on the corner side. |
| S-17 | Minor | The double-height lounge was added without the agent mentioning the trade-off (it costs first-floor area on a 10 marla plot) or the safety implication (a guarded void). | Turn 3. | A "smart architect" should push back briefly: "That uses ~150 sq ft of the first floor; still want it?" |

## 5. Concepts

| ID | Sev | Finding | Evidence / repro | Suggested fix |
|---|---|---|---|---|
| C-1 | **Blocker** | **Corner plots shown for a mid-row plot (confirms the user's report).** For `corner:false`: Concept B has a curving kerb and side road on the right, C is a full street-corner three-quarter view, D has a side street at left, E has a curving kerb at left, F and G are corner views. Only A and H read as mid-row. For the 5-marla `corner:true` project, the **prompts were byte-for-byte the same** except "1-car porch", so the corner flag is not used at all. | Live prompts (shown in each concept's detail panel) all include "three-quarter view from the street corner…" as variant B, plus "Neighbouring houses and a residential street are visible." The repo's `api/app/agents/concepts.py` (modified 23:04 today) now has a `MID-ROW` sentence and a `CORNER_VARIANT`, but **this is not deployed**. | Deploy the repo change. For mid-row, also add negative cues ("houses attached on both sides, no side street, no visible side facade") and use only straight-on or slight-angle cameras. Consider an automated check: ask a cheap vision call "is this a corner plot?" and regenerate on a mismatch. |
| C-2 | **Major** | **Lighting differs by design** (golden hour, overcast morning, dusk, sunny afternoon), so the four are not comparable. The user asked for day/night modes for an apples-to-apples comparison. | Prompt suffixes. | Generate all 4 at the same time of day and camera, with a **Day / Night** toggle that runs the remix "same house, night, warm interior lights" on demand (it is cached per concept). |
| C-3 | **Major** | **The "Four directions" are one direction.** Every prompt has the same design language ("crisp white plaster volumes, grey stone cladding pier, vertical teak fins…"). Only camera and light change, so the user picks a photo, not a massing. The page copy says "Pick the massing you like". | All 8 non-remix prompts. | Have the LLM write 4 genuinely different massing and material directions from the brief (for example a cantilevered box, a courtyard screen, a brick-and-jaali modern, a stepped terrace), each named ("Jaali Court", "Floating Box"). |
| C-4 | Major | The roof brief is ignored. Every original concept shows a mumty and none shows the requested solar panels. (A remix added them nicely.) | Concepts A–H. | Feed the solar, tank and roof-use fields into the prompt. |
| C-5 | Minor | The concept detail shows the **raw image prompt** and "Rendered by gemini-3.1-flash-image". That is engineering detail on a customer screen. | Concept detail panel. | Show a 1-line human summary ("White plaster and teak fins, 2-car porch, golden hour"). Put the prompt behind "Details". |
| C-6 | Minor | Text leaks into an image. Concept B shows a "10.1" sign on the gate pillar and a house-number plaque, despite "no text" in the prompt. The prompt contains "10.1 marla". | `c_7fb251072a08.png`. | Drop the numeric area from the image prompt; say "a 35 ft wide plot". |
| C-7 | Minor | "Four more" appends its placeholders **below the fold** with no scroll or toast, so nothing visible happens after the click. G and H then took ~150 s with no explanation. | Click "Four more" at the top. | Scroll to or highlight the new row and show "4 more on the way". After ~45 s, say "taking longer than usual" and offer a retry. |
| C-8 | Minor | **A double-click hazard.** "All concepts" (detail view) and "Four more" (grid view) are the same button in the same spot. A double-click on "All concepts" starts an expensive generation. | Concept detail → All concepts. | Put the two actions in different positions, or ignore clicks for 400 ms after the view switch. |
| C-9 | Polish | The remix label does not match the variation. "Concept A1" is "Variation 2" in its prompt. One of the two remixes ignored "no stair tower". | `c_3d9d0c1ac30f`. | Number them consistently. The second variation needs a meaningful difference anyway. |
| C-10 | Polish | The heading stays "Four directions for your home" with 10 concepts on the page. | Concepts page. | "Your concepts" plus a count. |
| C-11 | Polish | The "Drawn from your brief" card leaves out corner and roof data, which would let the user spot C-1 themselves. | Right rail. | Add "Plot: mid-row / corner". |

## 6. Design step: timeline and UI

| ID | Sev | Finding | Evidence / repro | Suggested fix |
|---|---|---|---|---|
| G-1 | **Major** | The timeline is a **developer console**: 20 rows of `structure`, `facade_stone_pier`, `furnish_g_bed1`, expandable raw JS (`s.furnish("bed_king", …)`), "2,030 characters written" and "15,054 chars". This runs against the user's "business-focused, minimal, Jony Ive" direction. | `/design` during and after the build. | Default to human milestones: "Laying out rooms", "Checking 42 LDA rules", "Fixed 4 issues", "Building walls", "Furnishing 9 rooms", "Landscaping". Show a **live 3D preview** that assembles. Keep the code behind a "For nerds" toggle (judges like it; homeowners don't). |
| G-2 | Major | **"Design again" starts a 4–7 min re-run with no confirmation.** It doesn't say whether v1 is kept, and it doesn't say that the brief has changed. During the re-run, the **old v1 plan and the old "All 42 checks pass / Fixed 4 → 0" cards stay on screen** next to the new run's "LDA check 1: 5 violations". | Click "Design again". | Show a confirm sheet ("Start a fresh design? v1 stays in history. ~5 min"). Clear or grey out the stale plan and compliance, or label them "v1 (previous)". |
| G-3 | Minor | The run timer resets on reconnect. After a refresh at about 0:40 it showed "0:03" (with "Reconnected to the run in progress", which is good). | Refresh mid-run. | Send `started_at` in the `run` event and compute elapsed time from it. |
| G-4 | Minor | There is no cancel or stop for a running design. | Design page. | Add a Stop button (server-side cancel). |
| G-5 | Polish | Space counts disagree: "Plan drafted: 24 spaces" against the header's "28 spaces". | Run 1. | Use one definition (rooms only, or rooms plus outdoor). |
| G-6 | Polish | "Argon, the AI architect" and "Argon is laying out…" expose an internal model codename to customers. | Header. | "Your architect is laying out the floors…". |
| G-7 | Minor | After "Design again", v2 has no "what changed vs v1" summary (for example "+ Prayer room, + Dining, layout re-planned") and no side-by-side. The user can't tell why v2 differs. | v2 header: "Version 2: your naqsha · 38 spaces, 18 code sections". | Reuse the revision "what changed" card for redesigns too. |

## 7. Floor plan: architectural review of v1 (`v_14fc3f797c8c`)

Method: the final `BuildingPlan` was read from the `/run` SSE replay. I walked every door (`openings` minus windows) and `open_to`, then checked the result visually at 3× zoom.

**Ground floor (mostly sound).** The drawing room has its own door from the porch, and the main door opens from the porch into the TV lounge. The parents' bedroom and the guest bedroom each open off the lounge, and each has its own bath. The kitchen, dirty kitchen (with a side exit) and powder room open off the lounge. The stair hall is open to the lounge.

**First floor (broken).**

```
door f_bed3        <> f_master_bath     ← Bedroom 3 is entered through the Master Bath
door f_bath3       <> f_lounge          ← a bathroom opening straight into the family lounge
door f_bath3       <> f_bed3            ← …and into Bedroom 3: the lounge → Bath 3 → Bedroom 3 "corridor"
door f_master_bath <> f_master          (the master's bath is therefore shared with Bedroom 3)
door f_bed4        <> f_terrace         ← Bedroom 4's only door is from the open-air rear terrace
sliding f_corr     <> f_terrace         (reach Bed 4: stair → gallery → outdoors → bedroom)
door f_master      <> f_lounge @ x=11 on a 2 ft shared edge (x 10–12), but the door is 3 ft wide
```

| ID | Sev | Finding | Suggested fix |
|---|---|---|---|
| D-1 | **Blocker** | **A bedroom reached only through bathrooms.** Front Bedroom 3 has no door to any circulation space. Its two doors lead to Bath 3 (which also opens to the lounge) and to the Master Bath. Privacy and code sense both fail. This is the "bedrooms open into other bedrooms / washrooms" class the user reported. In run 2's first attempt it recurred in another form: **the Master Bedroom could only be entered through the Prayer Room.** | Add a deterministic circulation check to `lda.py` (or a `naqsha_rules` pass) that feeds the fix loop. Every bedroom must have a door to `{lounge, corridor, stair, lobby, dining}`. A bath/powder may have exactly one door, to its own bedroom or to circulation, and never to a kitchen or drawing room. Never route bedroom-to-bedroom or room-through-bath. Add the rule in plain words to `PLAN_SYSTEM`. (`docs/review/architecture-rules.md` Part A covers this; it needs wiring into the live check.) |
| D-2 | **Blocker** | **A bedroom accessible only from outdoors.** Rear Bedroom 4's only door opens to the rear terrace. In Lahore's summer and monsoon that is unacceptable, and the room counts as an outbuilding. | Same rule: bedrooms need an indoor circulation door. |
| D-3 | Major | **A bath opening into the family lounge** (Bath 3 → First Floor Family Lounge). | Same rule. |
| D-4 | Major | **Doors wider than the wall they sit in.** The Master Bedroom door is 3 ft wide at x=11 on a 2 ft shared edge, so it overlaps the Laundry. The Guest Bedroom door is 3 ft at x=11 on a 2 ft shared edge with the lounge, so its swing lands over the stair hall. The plan visibly draws both door arcs at wall junctions. The engine's `_on_edge` only checks that the centre point is on the edge. | Reject or snap any door whose `[at − w/2, at + w/2]` does not fit inside the shared segment minus 0.5 ft returns. |
| D-5 | Major | **The double-height void is drawn as an unlabeled walled box**, with no "open to below", no railing or guard line and no label. On the first floor it reads as a mystery closet. The lounge's 21.5 ft ceiling also applies to its whole footprint, although half of it sits under the first-floor lounge. Unless the engine adds guards, this is the "you can fall from above" risk the user hit. | Model voids explicitly (`type: "void"`, `guard: true`), draw them dashed with "Open to below", and have the SDK emit a 3′6″ balustrade on every void and stair-well edge. Limit the double height to the void footprint. |
| D-6 | Major | **The brief is not honoured.** The open kitchen became a closed one. There is **no dining** anywhere in a 5-bed house (attempt 2 of run 2 added a 2×8.5 ft "Dining Area", which failed LDA). The kitchenette upstairs is open to the lounge with a laundry also open to the lounge. | Add brief-adherence checks (counts per type and per floor, required spaces) to the fix loop, not just LDA. |
| D-7 | Minor | The main door opens directly into the family TV lounge, with no foyer or lobby screen. In Pakistani practice (purdah) guests should not see the family lounge from the door. The drawing room's separate porch door helps, but the main door still exposes the family lounge. | Prefer a small lobby or a screen wall at the main door. Add it to the planning sense list. |
| D-8 | Minor | The kitchen's daylight comes from a window onto the car porch (allowed by the rule, but it means fumes and a dark kitchen). | Prefer a side or rear exterior wall for kitchens. |
| D-9 | **Major** | **The bedroom count drifted in run 2**, both in attempt 1 and in the final v2: 6 bedrooms (4 upstairs) against a brief of 5 (3 upstairs). See §7b. | Same as D-6: enforce the counts per floor from a structured `brief.floors[]`. |
| D-10 | Good | **Stairs reach the roof in this plan.** `stair_f_r` (first → roof) is stacked in the same hall, the mumty sits over it and its door faces the roof. The user's "rooftop door suspended in the wall, no stairs" did not reproduce in **2D** here. Verify it in 3D (out of my scope). | Keep it, but add an invariant: the top stair's landing must sit inside the mumty rect, and the mumty door must be on the landing side. |

### 7b. Run 2 re-check (v2 `v_e1308f4a4094`, "Design again" after adding a prayer room)

The final v2 plan's first-floor circulation is **much better**. Every bedroom now opens off a corridor or lobby, every bath belongs to its own bedroom, and the powder room opens off a rear lobby. That makes plan quality a **lottery**: the same brief produced a broken v1 and a mostly sound v2, and the compliance panel showed all-green for both. Problems that remain in v2:

| ID | Sev | Finding | Evidence |
|---|---|---|---|
| D-9 (detail) | **Major** | **6 bedrooms instead of 5.** The brief says 5 bedrooms (2 down, 3 up) and v2 has Parents and Guest downstairs plus **Bedroom 3, Bedroom 4, Bedroom 5 and Master upstairs**. Nothing flags it, and the header just says "38 spaces, 47/47 LDA checks passed". | `rooms` of v2 |
| D-11 | Minor | Bedroom 5's only door opens into the **"Kitchenette Hall"**, so the bedroom opens onto a cooking area. | `door:f_bed5<>f_kit_lobby` |
| D-12 | Minor | The Prayer Room is a through-route: Gallery Bridge → Prayer Room → (arch) → Upper Family Lounge. People walk through the prayer space. | `door:f_prayer<>f_bridge`, `arch:f_prayer<>f_lounge` |
| D-13 | Major | There is still **no dining** and the kitchen is still closed (it has 2 doors). The "double-height" lounge shrank to 14×13, the void above it is an 8×9 walled box with no label, and the Prayer Room sits over part of the "double-height" lounge. | v2 rooms; first-floor plan |
| D-14 | Good | The stair from the first floor to the roof is present, with the mumty (8×13) over the stair hall. Run 2 attempt 1 had the **Master Bedroom reachable only through the Prayer Room**, and attempt 2 fixed it. That fix came from luck, not from a rule. | `stairs`, run-2 replay |

### Plan rendering (FloorPlan.tsx)

| ID | Sev | Finding | Suggested fix |
|---|---|---|---|
| P-1 | **Major** | **The plan can't be zoomed, panned or clicked, and its labels are tiny** (about 6–7 px at 1440×900). Room names and dimensions are unreadable without browser zoom. | Add zoom and pan (wheel, pinch, +/−), a "fit" button and a click-room popover (size, doors, LDA checks). Open the plan full-screen on mobile. |
| P-2 | Major | **Label shortening produces nonsense.** "Powder Room" → "**ROOM**", "Prayer Room" → "**ROOM**", "Car Porch (2 Cars)" → "**CARS)**" (mobile), "Double-Height TV Lounge" → "D. TV LOUNGE", "Laundry & Utility" → "L. & UTILITY", "Upper Hall" → "UPPER", "Guest Bedroom" and "Parents Bedroom" both → "BEDROOM" on mobile. In v2 the **Dirty Kitchen is labelled "KITCHEN"** while the Main Kitchen is "M. KITCHEN", and "Kitchenette Hall" → "HALL". The Kitchenette (v1 and v2), the Master Dressing and the Front Passage (v2) have **no label at all**. | `nameCandidates()` (`FloorPlan.tsx:519`) has a last-resort branch `words[words.length-1]`. Remove it. Prefer type-based short names (Powder, Prayer, Porch, Kitchenette, Guest Bed, Parents' Bed), and if nothing fits, use a numbered key with a legend. |
| P-3 | Minor | **Labels collide.** "BUILDING LINE" overprints "FRONT BALCONY" (first floor). "ROOF" and "Parapet 3′6″" overprint the water tank box. Vertical "MASTER BATH" / "GUEST BATH" overprint door swings. "MUMTY 9′6″" and "DN" are clipped at the left edge. On mobile, "Car gate" and "Gate" overprint "40′ WIDE ROAD". | Collision-aware label placement. Offset the building-line label outside the building footprint. |
| P-4 | Minor | The roof plan stacks overlapping outlines (first-floor footprint, terrace and void), and there's no solar array (S-10). | Draw one roof outline, hatch the open-to-sky parts and show the solar rect. |
| P-5 | Minor | The first-floor plan repeats the ground-level gate swing, "Car gate" and driveway. | Ghost them at 20% opacity, or hide them above the ground floor. |
| P-6 | **Major** | **No print, PDF or download** for the plan or the compliance report. The user asked for it explicitly. | Add an "Export" button: an A3 PDF with all levels, a dimension chain, a room schedule, the compliance summary and the project block. A browser `@media print` stylesheet is the quickest win. |

## 8. Compliance panel

| ID | Sev | Finding | Suggested fix |
|---|---|---|---|
| K-1 | **Blocker** | "**All 42 checks pass**" is shown for a plan with a bedroom entered through two bathrooms and a bedroom entered from outdoors. The panel implies the design is good when it is only LDA-envelope compliant. | Add a "Livability" group (circulation, privacy, door fit, guards, brief adherence) beside the LDA groups. Use separate headings: "LDA bylaws" and "Architect's checks". |
| K-2 | Minor | Messages can mislead. "Kitchenette size **50 / 50**", marked failed, with the message "Kitchenette is 50 sq ft (min 50 sq ft, 6′ wide)". The real failure is width, which the message never states. | Report the failing dimension: "5′ wide (min 6′)". |
| K-3 | Polish | The values have no units or meaning: "Side space 1 / 1", "Front setback 10 / 10", "FAR 1:1.01". | "10 ft (min 10 ft)", "1 side (1 required)", "FAR 1.01 (max 2.8)". |
| K-4 | Question | A Prayer Room of 6×6 fails as a habitable room (min 100 sq ft). In Lahore homes a prayer room is commonly small. Check whether LDA classifies it as habitable. Forcing 100 sq ft costs ~64 sq ft. | Verify against the B&ZR. If it isn't habitable, classify it with store or utility rooms. |
| K-5 | Good | Clicking a check switches the floor and highlights the room. The fix-loop card (Check 1 → Check 2, "Fixed 4 → 0") explains the AI's work in one glance. | Keep. |

## 9. Cross-cutting

| ID | Sev | Finding | Evidence | Suggested fix |
|---|---|---|---|---|
| X-1 | **Major** | **A brief edit after design silently regresses the project.** After v1 was built, one chat turn ("…add a small prayer room") set `stage` to `concepts`. The workspace card changed from "Ready" to "**Concept chosen**". The stepper unticked Concepts while Design stayed ticked. The agent said "we're set to begin generating your concept designs". There is no prompt to "apply to v1 as a revision" or "redesign". | `intake.py:260` unconditionally writes `stage="concepts" if complete else "setup"`. | Never move the stage backwards automatically. If a version exists, offer: "Apply as a revision to v1 (fast)" or "Start a new design". Mark the brief as changed since v1. |
| X-2 | **Major** | **The top stage bar** (Setup / Concepts / Design / Explore & Walk / Revisions) is still present. The user said it "makes the app look dated" and must go. On mobile it also overflows sideways with no affordance. | All project pages. | Replace it with a single project header (name and status pill) and contextual next-step CTAs. Navigate via a compact segmented "Brief · Concepts · Plan · 3D" in the project header, or a left rail. |
| X-3 | Major | The visual theme is warm beige with terracotta, serif headings and dense small grey text. It is tasteful, but not "super modern, minimal, Jony-Ive-level". Low-contrast muted text (rgb 141,135,125 on the sheet = **3.1–3.6:1** at 11.5–12 px) fails WCAG AA. | Contrast script on `/design`. | Raise muted text to at least 4.5:1, cut the number of type sizes, and cut the chrome (borders, pills, cards inside cards). A neutral near-white with a single accent would read more modern. |
| X-4 | Minor | **Phone layouts** (375 px): setup with a bottom-sheet brief and design with Progress / Drawing / LDA check tabs are good. The plan labels degrade badly (P-2). The LDA tab opens scrolled to the middle of the list. The stepper overflows. | Mobile pass. | See P-1, P-2, X-2. Reset the scroll position on tab change. |
| X-5 | Major | **No sharing, roles or accounts.** Projects are keyed to a localStorage UUID, so a project URL 404s for anyone else. The user wants client view and comment, and team comments. | `GET /api/projects/{id}` without the header → 404. | Short-term: a read-only share link (`/s/{token}`) that allows comments. Then Google sign-in (Firebase Auth) with owner, editor and commenter roles. |
| X-6 | Minor | **Many unnamed buttons** (timeline row expanders, compliance rows, sample cards). | `read_page` interactive tree. | Add `aria-label`s. |
| X-7 | Minor | Clicks during view transitions are swallowed (concept grid ↔ detail, drawer close → stepper). | Concepts page. | Shorten exit animations, or let pointer events through to the incoming view. |
| X-8 | Info | **The live deploy lags the repo.** `concepts.py` (mid-row prompt) was modified at 23:04, but the live prompts are still the old ones. Re-test C-1 after deploying. | Live prompts vs repo. | Deploy, then regenerate. |
| X-9 | Polish | Every SSE request ends as `net::ERR_ABORTED` in DevTools, because the client aborts on `done`. | Network log. | Let the server close the stream after `done`, and release the reader instead of aborting. |

## 10. User feedback cross-check (this audit's scope: landing → design)

| User feedback | Status in this audit |
|---|---|
| Stairwells always need railings | Stair railings are 3D, not checked here. **But the plan has a double-height void with no guard representation (D-5)**, which is the same risk. |
| Bedrooms open into other bedrooms / washrooms | **Confirmed in a new form**: a bedroom entered via 2 baths, a bedroom entered from outdoors, a bath into the lounge, and (run 2) the master entered via the prayer room (D-1…D-3). |
| Rooftop door suspended, no stairs to roof | **Not reproduced in 2D.** This plan has a first→roof stair and a mumty over it (D-10). Needs a 3D check. |
| TV in front of a door | 3D furniture is out of scope. Note that the furnish sections have no door-clearance input (G-1 code shows absolute furniture placement). |
| Neighbouring buildings obstruct the outside view | Out of scope (Explore). |
| All concepts show a corner plot | **Confirmed** (C-1). |
| Day/night concept modes | **Missing.** Lighting is random per concept (C-2). |
| Rooms per floor | **Missing in the UI.** It was captured in free text but **not honoured** (S-9, D-9). |
| Ask about the water tank | **Missing** (S-10). The plan always places a tank, and the type isn't asked. |
| Rooftop solar, no roof clutter | **Missing** from setup and the plan schema. Concepts add a mumty and no solar (S-10, C-4). |
| Walk view issues / mouse look / room selector | Out of scope. |
| Print / PDF | **Missing** (P-6). |
| Sign-in, sharing, team comments | **Missing.** URLs aren't shareable (X-5). |
| Modern minimal design; remove the stage bar | **Not done** (X-2, X-3). |
| Landing page with construction animation, business features, Portal button | **Not done** (L-2), and mobile is broken (L-1). |
| Beat maket.ai: more conversational and intelligent | Parsing is strong. Latency (S-4), wrong facts (S-6), ignored questions (S-5) and the lack of read-back (S-1) undercut it. |

## 11. What works well (keep)

- **One-shot understanding of a long brief.** One paragraph filled almost the whole brief and the next question was the right one (budget). The parsing quality is real.
- **The instant LDA envelope** is clear and correct: buildable 30×48, coverage 70%, 45 ft, FAR 1:2.8, with plain-English notes. The north arrow rotates with facing.
- **The setup widgets are excellent**: plot tiles with real dimensions and a "Most popular" hint, exact W×D with a live marla conversion, a corner toggle, rooms steppers plus storeys, porch and space toggles, and illustrated style cards.
- **"Skip setup — design it for me"** works in about 10 s and auto-names the project.
- **Concept image quality** is high and feels like Lahore (poles, wires, boundary walls, porches). **Remix is excellent**: it kept the exact composition and switched to daylight with solar panels.
- **The design pipeline is transparent**: the plan appears at ~1.5 min, the LDA fix loop is visible (4 violations → 0), the total is 4 min 25 s, and the page **resumes after a refresh** ("Reconnected to the run in progress").
- **Compliance ↔ plan linking**: clicking a check highlights the room on the right floor.
- **No console errors** across the whole journey. Autosave works: names, chat, concepts and versions all persist.
- **The mobile setup and design tabs** are well adapted. Apart from the landing page, nothing overflows the page width.
