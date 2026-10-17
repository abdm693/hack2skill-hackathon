# Round 1 triage

- **Date:** 17 Oct 2026. The prototype is due 18 Oct.
- **Inputs:** the eight reports in `docs/review/round1-*.md` and the raw issue list. The SEEN list was empty, so nothing was dropped as already handled.
- **Method:**
  - Duplicates were merged; each task lists the reports it absorbs.
  - Every claim was checked against the code, and the file and line are cited in **Hints**.
  - Each task has one owner:
    - **backend:** `api/**` and the contracts
    - **engine:** `web/src/engine/**`
    - **viewer:** `web/src/viewer/**`
    - **app:** everything else under `web/`
  - A task that needs a small touch in another area says so in its hints.

## Status of the user's own feedback (re-checked)

| User feedback | Status after round 1 | Open task(s) |
|---|---|---|
| Stairs you can fall from, railings everywhere | Fixed on all three houses (80+ edge probes) | EN-06 (stair window glass below the flight) |
| Bedrooms opening into other bedrooms | Fixed for bedroom doors. Still broken through a **shared balcony** (villa) and a **dressing off the lounge** | BE-06, EN-05 |
| Roof door suspended in the wall, no stair to the roof | Fixed in 3D. The **2D roof plan hides the stair** | AP-10 |
| TV in front of a door or in a doorway | Fixed | EN-08 (polish: TV touches door frames) |
| Neighbours blocking the outside view | Fixed for the hero and dollhouse views. **Low street and side views** are still blocked or washed out | VW-01 |
| Concepts always showing a corner plot | Fixed for new projects. The **flagship 10 marla sample's concept A is still a corner** | BE-09 |
| Day/night comparison | Works | – |
| Per-floor program | The brief captures it. The **plan rule miscounts the master**, an extra storey gets no rooms, and the editor drops rooms and over-fills floors | BE-01, BE-13, AP-06, AP-07 |
| Water tank and solar questions | Work. The roof reply skips solar | BE-17 |
| Walk floor toggles | Work | – |
| Walking space and cars blocking | Cars no longer block. Furniture in doorways, dropped furniture and under-3 ft paths remain. **2-car porches park 1 or 0 cars** | EN-02, EN-03, EN-04, BE-05 |
| Room navigator | Works | AP-25 (overlap and focus) |
| Print/PDF | A3 works. **A4 clips the title blocks and the compliance sheet** | AP-09 |
| Mouse look like a game | Drag and hover fallback works. Pointer lock is untested in the pane (check in desktop Chrome) | VW-05 |
| Sign up/in, sharing with clients, team comments | Auth and comments work. **A guest cannot share**, guest ids leak, and comments are stranded on old versions | AP-03, BE-10, BE-11 |
| Modern minimal UI, no stage bar | Done. Contrast and collisions remain | AP-15, AP-11–AP-14 |
| Landing with construction animation, business features, Portal | Done. **Sample cards all open the villa** | AP-02 |

---

## BACKEND

### BE-01 · major · Per-floor program rule double-counts the master bedroom
- **Problem:**
  - `planning.py::_program` (L1402–1422) checks the floor program key `bedroom` with `_count(here, "bedroom")`, which counts every type in `BEDROOMS`, master included.
  - A first floor of `master_bedroom:1, bedroom:2` (3 bedrooms, as briefed) fails "should have 2 bedrooms (has 3)".
  - The fix loop then deletes a requested bedroom (fix history 5→2→1→4→1). The house ships at 8/9 livable, and "Ask Naqsha to fix this" would remove a bedroom.
  - The architect review was also rejected partly on this rule.
  - Source: architect-e2e #3.
- **Acceptance:**
  - On any floor, the total bedrooms compares with the sum of the bedroom-like keys. Master and guest rooms are checked by their own types.
  - The `p_cc0da837ae56` plan passes "Rooms per floor".
  - A new `api/tests/test_planning.py` case passes: floors `first=[master_bedroom:1,bedroom:2]` with a plan of 1 master and 2 bedrooms gives no `plan.program.floor` fail.
- **Hints:** in `_program`:
  - When `want` has any of `master_bedroom`/`guest_bedroom` and also `bedroom`, compare `sum(want[k] for k in BEDROOM_KEYS)` with `_count(here,"bedroom")`.
  - Check `master_bedroom` and `guest_bedroom` individually with exact type counts.
  - `_derive_from_floors` already sums correctly.

### BE-02 · major · A landlocked bath with 0 sq ft of ventilation is only a warning
- **Problem:**
  - `lda.py` L300–306 adds `room.vent` with `warn=True`. A bath with no opening at all (Bath 2 in both the 10 marla sample and `p_cc0da837ae56`) never reaches the fix loop.
  - The house is still reported as 36/36 or 37/37 LDA. The display side is AP-08.
  - Source: architect-e2e #5, concepts-plan P-4, design-critic.
- **Acceptance:**
  - A wet room with 0 sq ft of opening is `fail` ("needs a ventilator on an outside wall, or a duct").
  - 0 < g < 2 stays `warn`.
  - New plans come out with a ventilator, and the fix-loop feedback names it.
- **Hints:**
  - `status = "fail" if g <= EPS else ("warn" if g < 2 else "pass")`.
  - Make sure PLAN_SYSTEM in `architect.py` says that every bath or powder room has a `ventilator` on its own outside wall, or sits against the stair hall/shaft.

### BE-03 · major · No rule for a door under a stair flight or landing (you cannot leave the powder room)
- **Problem:**
  - Powder room door `g_powder_door` at (27,43) sits under the dog-leg's mid-landing, about 5.5 ft above the floor. In Walk you cannot step out.
  - `_stairs` (L940–959) only checks doors on the **upper** floor that open onto the void (`door_on_void`). Nothing checks doors on the lower floor inside the stair footprint.
  - This is the same class of problem as the user's "door suspended in the wall".
  - Source: architect-e2e #2.
- **Acceptance:**
  - New fail `plan.stair.door_under_flight:<door>` (family `plan.stair`). It fires when any door or arch on the stair's `from_level` has its opening, or its 2 ft approach zone, inside the stair rect, other than at the foot landing side.
  - The fix text: move the door, or flip the dog-leg so the landing is not over it.
  - The `p_cc0da837ae56` v1 plan fails it.
  - A unit test covers it.
- **Hints:**
  - Reuse the `zone` construction from `door_on_void` (L952–954), applied to `frm` and the stair `r`.
  - Exclude doors on the `e_side` (foot) strip.
  - Engine defence-in-depth is EN-06.

### BE-04 · minor · The plan check does not model the engine's opening spacing (the main door gets skipped in 3D)
- **Problem:** The engine skips an opening that cannot keep a 0.3 ft gap from a neighbour on the same wall run plus the wall-end margins (`model.ts` L319–337). The plan check passes such plans, as happened with `g_main_door` against `g_lounge_w`. EN-01 fixes the 3D side; this task catches the overlap at plan time.
- **Acceptance:**
  - Two openings on the same wall between the same rooms (or room and exterior) that overlap, or sit within 0.3 ft, give `plan.opening.clash:<id>`.
  - It is a `fail` when one of them is a door.
  - `p_cc0da837ae56` v1 is flagged.
- **Hints:** in `PlanIndex` opening info (L220–290), group openings by (level, wall line, axis) and compare `[at ± w/2]` intervals.

### BE-05 · major · Car porch is not sized for the briefed number of cars
- **Problem:**
  - `_porch` (L804–822) reads the car count only from the room **name** (`"(\d) car"`), and "too small for a car" is a `warn`.
  - The results:
    - a 12×12 porch ships for a 1-car brief;
    - a 16×18 porch for `car_porch:2` parks one car;
    - the villa's 18×18 porch for 2 cars parks none.
  - Source: architect-e2e #6, concepts-plan P-30.
- **Acceptance:**
  - `_porch` takes `brief` (like `_program`) and uses `cars = max(name count, brief spaces car_porch:N)`.
  - It fails `plan.circulation.porch` when the porch can't hold one 9×18 bay.
  - It fails `porch_walkway` when width < N×9 + 3.5 (side by side) and depth < 18 + 3.5.
  - Fresh plans for 1- and 2-car briefs park all cars (with EN-04).
- **Hints:**
  - Add `_porch` to the `brief` branch at L525.
  - Mention "9 ft × 18 ft per car plus a 3′6″ walkway" in PLAN_SYSTEM.

### BE-06 · major · A dressing room off the family lounge, and balconies that join bedrooms, pass the independence rule
- **Problem:**
  - **Villa master dressing:** `f_master_dress`'s only door opens to `f_lounge`, and Opens-to reads "Upper family lounge". `_privacy` only covers bedrooms and baths, so the dressing passes.
  - **Villa front balconies:** "Porch terrace", "Arched loggia" and "Master balcony" are separate rooms on the plan but one continuous strip. Bedroom 3 reaches the Master Bedroom without crossing any circulation.
    - `balcony_links_bedrooms` (L620–625) is only a `warn`, and only fires when **one** balcony room has two bedroom doors.
  - This is the user's "rooms must be independent" rule.
  - Source: concepts-plan P-5, architect-e2e (villa), walk #5.
- **Acceptance:**
  - **New fail `plan.privacy.dressing:<id>`:** a dressing or closet must open only to one bedroom and/or that bedroom's bath, never to circulation or living rooms.
  - **`balcony_links_bedrooms` becomes `fail`,** and it is evaluated over the union of adjacent outdoor rooms on the same level (shared edge ≥ 1 ft and no wall between them).
  - The villa v2 plan fails both.
  - New plans pass.
- **Hints:**
  - Both go inside `_privacy` (L590–625).
  - For the union, run a BFS over `ix.rooms` of type balcony or terrace whose rects touch.
  - EN-05 builds the physical divider.

### BE-07 · major · A covered "open space" counts as daylight (villa Kitchen Patio under the Roof Terrace slab)
- **Problem:**
  - `g_patio` (open_space, x12.5–17, y44–58) is the only light for the Kitchen and the Prayer Room, but the first-floor `f_roof_terrace` slab covers it. The two windows face each other across a roofed 4.5 ft slot.
  - `glazing()` treats any open_space as exterior.
  - Source: architect-e2e (villa).
- **Acceptance:**
  - An `open_space` room counts as exterior only where no room on any level above overlaps it.
  - A new fail `plan.open_space.covered:<id>` reads "Leave the courtyard open to the sky (no room or terrace over it), with a guard around the opening above".
  - The villa v2 plan fails Kitchen/Prayer daylight.
- **Hints:** `lda.py` `glazing()` and the `open_space` handling in `PlanIndex`. Compute the overlap with `overlap_area` against rooms on higher levels.

### BE-08 · major · The architect self-review's findings are discarded wholesale
- **Problem:**
  - The review found five real problems on `p_cc0da837ae56`:
    - an 8 ft dining room;
    - landlocked Bath 2;
    - the master bath over the drawing room;
    - a 6×15 "bowling alley" Bath 3;
    - the powder room door facing the lounge.
  - The revision was rejected (`rejected_because` included the false BE-01 rule), so none was applied.
  - `review.applied=false`, and the user is never told.
  - `architect.py` L362–381.
  - Source: architect-e2e #4.
- **Acceptance:**
  - (a) A rejected candidate gets one fix-loop round (`_feedback(cand_rep)`) before rejection. It is accepted when fails ≤ base and it fixes at least one major review issue.
  - (b) When the review is not applied, each unresolved major or minor issue is appended to the version's compliance report as `{id:"review.<n>", category:"livable", status:"warn", title, message}` in plain words, so the compliance sheet and dock (AP-08) show it.
  - (c) The dock line no longer implies all is well.
- **Hints:**
  - `_result` at L381: add the checks to `report["checks"]` before yielding.
  - Keep `rejected_because` for logs only.

### BE-09 · major · Refresh both samples with the fixed rules and engine (flagship content)
- **Depends on:** BE-01–BE-07, EN-01–EN-05 and AP-10.
- **Problem:** the samples carry most of the defects judges will see.

  | Sample | Defects |
  |---|---|
  | 10 marla | Concept A ("Grooved Travertine") shows a corner plot, the user's original complaint. Bath 2 has no ventilation and sits over the Drawing Room. 12 as-built notes, including the dropped dresser and paths under 3 ft. |
  | Villa | The dressing opens off the lounge. The patio is covered. The 2-car porch has no car. No fridge, no wardrobe. The front balconies are joined. "DHA / Johar Town" location. A 4′6″ × 16′ servant bath. |
- **Acceptance:**
  - All 4 concepts of the 10 marla sample show neighbours against both side walls in Day and Night. Re-roll A and inspect visually.
  - Both samples:
    - pass every LDA check with no warn on ventilation;
    - pass every livable rule;
    - carry ≤ 2 as-built notes, with no "left out" and no "less than 3 ft";
    - park every briefed car;
    - have `plan.site.scheme` empty or a real scheme.
  - They are promoted via `api/scripts/promote_samples.py`.
  - A guest who already has a stale copy gets the new one: `find_clone` ignores copies older than the sample's `updated_at` that have no messages, comments or versions of their own. Otherwise, document a "fresh" path.
- **Hints:**
  - `api/scripts/regen_samples.py`, `promote_samples.py`;
  - `db.find_clone` (`db.py` L233);
  - `agents/concepts.generate(..., base_id=…)` for a single re-roll.

### BE-10 · major (security) · The public client link leaks guests' raw ids, which are their credentials
- **Problem:**
  - `GET /api/share/{token}` (`main.py` L301–320) returns `comments[].author.id` and `replies[].author.id`. `author_of()` (L78) sets them to `me.author_id`, which is the raw guest UUID for guests.
  - That UUID is the whole identity (`X-Naqsha-User`; `owner_keys` includes `guest_id`). Anyone with the link can act as the guest owner or a client.
  - Source: collaboration #1.
- **Acceptance:**
  - No share payload contains any raw uid or guest id: author ids are opaque per-project handles, for example `"a_" + hmac(SECRET, pid + ":" + id)[:16]`.
  - Each comment and reply carries `mine: bool` computed for the caller. The share endpoints take `Depends(auth.identity_optional)`.
  - `contracts/api-types.ts` `Author`/`Comment` document `mine`.
  - The client view's "Mine" filter still works. App: `comments/model.ts isMine` should honour `c.mine` first; this one-line app touch is part of this task.
- **Hints:**
  - Apply the mapping in one helper used by `share_view`, `share_comments`, `share_comment`, `share_reply` and the owner's `/comments` responses for authors other than the caller.

### BE-11 · major · Unapplied and late comments are stranded on the old version
- **Problem:**
  - Comments are listed per `version_id`. After a revise, any comment the owner unticked, and any client note posted during the run, stays on the old version.
  - The owner's sheet then shows "No comments yet" and can't apply them: `revise` only reads `body.version_id`'s comments (`main.py` L618), and the app gates Apply on `isLatest`.
  - Source: collaboration #4.
- **Acceptance:**
  - When a design or revise run saves a new version and makes it current, every comment still `open` on its parent version is moved to the new version, keeping its anchor and adding `from_version_id`. This includes comments created while the run was in flight.
  - Resolved threads stay on the version they belong to.
  - Scenario: with 3 open comments, applying 2 leaves the third visible and applicable on v3.
- **Hints:** wherever `current_version_id` is updated after `db.save_version` (architect `design`, `reviser*.revise`). Add a `db.move_open_comments(pid, from_vid, to_vid)`.

### BE-12 · major · The storeys question ignores the authority (DHA accepts 3 storeys against its 2-storey limit)
- **Problem:**
  - `intake.question("storeys")` (L437–440) has static chips with "Triple storey · LDA allows up to 3".
  - `merge_brief` clamps storeys to 3 regardless of `envelope.max_storeys`.
  - For DHA Phase 6, the brief stored 3 against a maximum of 2, and the concepts said "three-storey".
  - Source: setup #4.
- **Acceptance:**
  - Storey chips go up to `envelope.max_storeys`, with a hint naming the authority ("DHA allows ground + first, plus a basement").
  - `merge_brief` (or the setup turn) clamps to the envelope's maximum once the plot and authority are known. The reply pushes back in one sentence.
  - A DHA brief can never hold storeys > 2.
  - The app side of the cap is in AP-06.
- **Hints:**
  - `question(field, brief)` already receives `brief`; call `envelope_for(brief)`.
  - Clamp in `setup_agent` after the patch, where `brief` and `env` are both known, and append the pushback to the reply text.

### BE-13 · major · Adding a storey leaves the new floor without rooms, and setup still completes
- **Problem:** `to_ask` (L377–379) treats `floors` as answered whenever the list is non-empty. "Make it 3 storeys" leaves second-floor rooms undefined, yet "Show me concepts" appears. Source: setup #5.
- **Acceptance:**
  - `floors` is asked (and the brief is not complete) whenever any storey in `ground..(storeys-1)` lacks a `floors` entry with rooms, unless `floors` is in `auto_filled`.
  - The reply asks what goes on the new floor, with the floors widget.
- **Hints:** in `to_ask`, compute `levels = ["ground","first","second"][:storeys]` and compare it with `{f["level"] for f in floors if f.get("rooms")}`. Do the same in `missing()`.

### BE-14 · major · Wishes cannot be removed (the PATCH unions preferences back)
- **Problem:**
  - The brief panel's × sends `PATCH {brief:{preferences: filtered}}`.
  - `merge_brief` appends preferences (L198–199) and skips `[]` entirely (L157–158), so removed wishes come back. Contradictions stick: "dirty kitchen" stays after "remove the dirty kitchen".
  - Source: setup #7.
- **Acceptance:**
  - A PATCH replaces `preferences` (an empty list included), and the removal persists after a reload.
  - The agent can drop a contradicted wish: add a `remove_preferences` argument to `update_brief`, mirroring `remove_spaces`.
- **Hints:** add `prefs_mode="replace"` to `merge_brief`, used by `patch_project` (`main.py` L170). Let `[]` through for `preferences` in replace mode.

### BE-15 · major · "Don't assume" confirms the assumption instead of dropping it
- **Problem:** The card's × sends the text "Don't assume: front faces north." (`Conversation.tsx` L112). The model answers "Noted, front faces north" and moves the fact to "You said", the opposite of the user's intent. Source: setup #8.
- **Acceptance:**
  - Removing an assumption clears that field (sets it to None and drops it from `auto_filled`) and asks its question again ("Which way does the front face?").
  - This is deterministic and does not depend on the model.
- **Hints:**
  - Add a chip `unset:<field>` to the intake chip parser (L247–300). In `setup_agent`, handle a message matching `^Don't assume:` by mapping the text to a field: use the same strings `understood()` builds (L515–550), for example "Front faces …" → facing, "… storeys" → storeys, tank/solar/style labels.
  - App: optionally send `chips:["unset:facing"]` instead of free text. The backend must handle both.

### BE-16 · minor · Corner or mid-row is never asked, and the default is shown as "You said"
- **Problem:**
  - `ASK_ORDER` has no corner question.
  - `understood()` always files "Mid-row plot…" under preferences (L520).
  - The app's `saidFacts` shows it as said unless `corner` is in `auto_filled`, which nothing adds.
  - Source: setup #11.
- **Acceptance:**
  - When the user never stated it, Naqsha asks "Corner or mid-row?" (chips `corner:true`/`corner:false`, one tap), or at least shows "Mid-row" under "I assumed".
  - Skipping or defaulting adds `corner` to `auto_filled`.
- **Hints:**
  - Add the question after `plot`.
  - Set an explicit `plot.corner_known` flag when the message or chip states it.

### BE-17 · minor · Setup copy: raw facing code, roof ack, wrong next step, static suggestions, stiff voice
- **Problem:**
  - `_ack_skip` (L733–741) prints "I've chosen n for the facing".
  - The roof ack mentions the tank but not solar.
  - Replies say "initial floor plan concepts", "sketch four layout concepts" or "I have recorded your…", although the next step is four exteriors on tap.
  - `COMPLETE_SUGGESTIONS` (L589) offers "Make the kitchen open" and "Add a prayer room" after the user asked for both.
  - Source: setup #12, #14, #15, #25; design-critic voice.
- **Acceptance:**
  - The reply reads "I've chosen north for the facing."
  - The roof ack names both the tank and the solar choice.
  - The INSTRUCTION states: "When the brief is complete, say 'Here's what I understood…' and that you'll sketch four exteriors when they tap Show me concepts. Never say 'initial', 'layout concepts' or 'recorded'."
  - Suggestions leave out anything already in `preferences`, `floors` or `spaces`.
- **Hints:**
  - Use `FACING_NAME` in `_ack_skip`.
  - Filter in `_complete_suggestions` (around L106).

### BE-18 · minor · The full understood card is re-posted on every turn after completion
- **Problem:** `setup_agent.py` L296 attaches `understood` whenever `complete`, so each question-only turn adds about 25 lines. The conversation reached 4,400 px after 5 turns. Source: setup #17.
- **Acceptance:**
  - The card attaches only when the brief changed this turn (`turn.patch_fields - {"notes"}` non-empty), on the first completion, or when the agent called `present_understanding`.
  - Questions get a plain answer.
- **Hints:** change the condition to `(turn.understood or (complete and (newly or turn.patch_fields)) or rich)`.

### BE-19 · minor · "Decide for me" on the rooms question decides only the bedroom count
- **Problem:** Skip on the `bedrooms` question (input `rooms`) replies "I've chosen 5 for the bedrooms. What goes on each floor?" and shows the same editor again. Source: setup #13.
- **Acceptance:** one "Decide for me" fills both the bedroom count and `floors` (auto), and moves on to the next question.
- **Hints:** in the `skip_question` path, when `field == "bedrooms"`, also add `floors` to `auto_filled`, using the defaults from `defaults_for`.

### BE-20 · minor · "Start with questions" shows the one-message greeting instead of a question
- **Problem:** The workspace promises "Naqsha will ask one at a time". `action=="start"` (`intake.py` L632–636) posts only `GREETING` with example messages. Source: setup #21.
- **Acceptance:** "Start with questions" shows "How big is the plot?" with the size chips and plot widget, plus a line that one message is also fine.
- **Hints:** on `start`, post the greeting merged with `question("plot", brief)` fields (`input`, `chips`, `field`, `allow_skip`).

### BE-21 · minor · Opening a sample concurrently creates duplicate copies
- **Problem:** `find_clone` and `clone_project` (`db.py` L233–251) are not atomic. Two parallel POSTs created `p_b611d47095d3` and `p_86d66538ca3a`. Source: landing-auth #3.
- **Acceptance:** two parallel `POST /clone` requests with the same owner and sample return the same id, and `GET /api/projects` lists one copy.
- **Hints:**
  - Deterministic id `p_ + sha1(owner + ":" + src)[:12]` for non-fresh sample clones.
  - Use `doc.create()` and catch AlreadyExists, then return the existing copy.
  - Copy the subcollections only on a successful create.

### BE-22 · minor · The JS bundle is uncompressed and privately cached, and thumbnails are 1.6 MB PNGs
- **Problem:**
  - `/assets/index-*.js` (937 KB) is served with no `content-encoding` and with `cache-control: private` (`main.py` L666–667, a plain StaticFiles mount).
  - Workspace cards load full concept PNGs of about 1.7 MB.
  - Source: landing-auth #7.
- **Acceptance:**
  - `/assets/*` is served gzip or br, with `Cache-Control: public, max-age=31536000, immutable`.
  - SSE endpoints are not compressed or buffered.
  - Card thumbnails are ≤ 150 KB (640 px WebP or JPEG).
- **Hints:**
  - Subclass `StaticFiles` and override `file_response` for the headers.
  - For compression, either serve pre-compressed files (a Vite compression plugin with `.gz`/`.br` siblings chosen by `Accept-Encoding`), or use GZipMiddleware with a path guard that skips `text/event-stream`.
  - When storing a concept or version image, also store a resized `thumb` and set `thumbnail_url` to it.

### BE-23 · minor · Rule messages leak element ids and lack names and units
- **Problem:**
  - Examples: "f_terrace_slide is 2′6″ wide" (door_width, L785–786); opening problems (L224–289) and stair rules (L884–902) also start with ids.
  - The two stair checks are both titled "Staircase", with no detail.
  - The solar check has no `%` and uses "limit" for a minimum.
  - Source: concepts-plan P-11, P-12; design-critic ids; architect-e2e solar.
- **Acceptance:**
  - No check `message` or `title` contains `[gfrs]_…` ids. They stay in `element_ids` and `fix`.
  - Stair checks are titled "Ground → first stair" and "First → roof stair", with a message like "19 risers of 6.95 in, 3′6″ wide".
  - The solar check reads "64% kept clear (min 55%)".
- **Hints:**
  - Add a helper `ix.oname(o)`: type word plus the room names, for example "Terrace door" or "Bath 2 window".
  - Stair names come from the level names.
  - App formatting is AP-22.

### BE-24 · minor · Wet over dry is never fixed
- **Problem:** "Bath over a dry room" (L1500–1513) is a `warn` that never reaches the fix loop. The Master Bath sits over the Drawing Room (`p_cc0da837ae56`), and Bath 2 over the Drawing Room (10 marla sample). Source: architect-e2e #8.
- **Acceptance:**
  - The first fix round includes wet-over-dry warns as "fix if you can without breaking a rule".
  - Fresh 10 marla plans stack baths over baths, the kitchen or service rooms in typical runs.
- **Hints:** `lda.violations_text(..., warns=True)` for ids starting with `plan.structure.wet_over_dry` in `_feedback`.

### BE-25 · minor · A client's approval is just an open comment
- **Problem:** "Approve vN" posts an open general comment "Approved version N." It counts toward "Revise with N comments", it is pre-ticked for the reviser, and its pin sits on top of other general notes. Source: collaboration #9.
- **Acceptance:**
  - `POST /api/share/{token}/comments` accepts `kind:"approval"`. That comment is stored `status:"resolved"`, `kind:"approval"`, and excluded from the revise and Apply lists.
  - The owner sees "✓ Approved by <name>". The app part is a small touch in `CommentItem`.
- **Hints:** `ShareComment` model (L323), `_new_comment`. Offset general pins via the anchor (a small jitter per general comment).

### BE-26 · minor · Plan generation takes 11–15 minutes
- **Problem:** A 5 marla plan took 14.5 min, about 7 min of it in "Laying out the floors"; the 10 marla took 11.5 min. That is too long for a judged demo. Source: concepts-plan P-32, architect-e2e.
- **Acceptance:** p50 ≤ 6 min for a 5–10 marla 2-storey plan, with no drop in pass rate on the samples.
- **Hints:**
  - `config.PLAN_MAX_ATTEMPTS` 4→3.
  - `REVIEW_BUDGET_S` 300→150.
  - Skip the review when the fix loop already used ≥ 3 rounds or the total time is over 6 min.
  - Lower `max_tokens`/thinking on fix rounds.
  - Start the 3D build on the checked plan while the optional review runs.

### BE-27 · polish (cheap) · Auto title follows plot changes; renders keep neighbours plain
- **Problem:**
  - The title stays "10 marla house" after the plot changes to 12 marla (`auto_name` only runs for "Untitled home").
  - "Render this view" adds solar panels to a neighbour's roof.
  - Source: setup #23, orbit p2.
- **Acceptance:**
  - An auto-generated title updates when the plot or scheme changes, unless the user renamed the project.
  - The render prompt says neighbours stay plain and muted, with no added roof equipment.
- **Hints:** store `auto_named: true` when `auto_name` sets the name, and clear it on a user rename in `patch_project`.

---

## ENGINE

### EN-01 · blocker · The main door is silently not built (a window placed first takes its slot)
- **Problem:**
  - `StructureModel.placeOpenings` (`structure/model.ts` L264–337) places openings in plan order. `g_lounge_w` (x 8.5–12.0) is placed before `g_main_door` (x 12.2–15.7). The door then can't keep the 0.3 ft gap and the end margin at x=16, so it is skipped with only `warn(…)`: no as-built note, and compliance still reads 37/37.
  - Walk spawns facing a blank wall, and the family enters through the drawing room.
  - Source: architect-e2e #1, evidence 01–04.
- **Acceptance:**
  - Doors are placed before windows, with `main_door` first.
  - When a window clashes with an already placed door, the window is narrowed (down to 1.5 ft) or shifted, and only then skipped.
  - A door is never skipped while a window on the same run could give way.
  - Every skip (overlap, wall too short, no height) goes through `skipOpening` and creates an as-built note. A skipped door or main door is `status:"fail"`.
  - `p_cc0da837ae56` builds a main door at about x 12.2–15.7 and Walk spawns facing in.
- **Hints:**
  - Sort `list` by `(type==="main_door" ? 0 : DOOR_TYPES.includes(type) ? 1 : 2)`.
  - In the clash branch, if `isDoor`, look for clashing windows on `run.openings` and shrink or shift them, recomputing `u0`/`u1`.
  - `skipOpening` (L376) should take a status.

### EN-02 · major · Fixtures block doorways and door swings
- **Problem:**
  - **Villa kitchen door** `g_kitchen_door` (x 9–12): the microwave counter (x 8.5–10.5, y 44.1–45.6) sits behind half the opening, and the leaf clips the counter.
  - **Villa kitchen–patio door:** the sink counter is 0.4 ft from it and covers 1 ft.
  - **10 marla dressing arches:** `g_dress1_dressing_table` and `f_dress3_dressing_table` sit 0.7 ft inside the 2.5 ft arches.
  - **10 marla Bath 2:** `f_bath2_shower` covers 1 ft of the door, inside its swing.
  - Source: walk #1, #6.
- **Acceptance:**
  - Every door, arch and sliding door keeps a clear zone `width × 3 ft` on each side it serves, plus the leaf-swing quarter circle on the swing side.
  - No furniture or fixture intersects it.
  - Re-running the samples shows no item inside any door zone. Add a `dev/checks.ts` check.
- **Hints:** `furniture/zones.ts` (keep-out zones) and `furniture/place.ts`. Counters and kitchen runs (`auto.ts`) must use the same zones; today they appear to skip arches and the kitchen's own door.

### EN-03 · major · Rooms ship without their defining furniture, and walkways under 3 ft
- **Problem:**
  - Notes across the three houses:
    - villa kitchen with no fridge;
    - dressing rooms with no wardrobe or dresser;
    - "less than 3 ft between some doors" in the Master Bedroom, Parents' Bedroom, Dirty Kitchen and Bedroom 3.
  - The status still claims "8/8 livable".
  - The notes are known at build time but are only warnings.
  - Source: house-orbit M5, architect-e2e #7, design-critic M3.
- **Acceptance:**
  - Before dropping a defining item (bed, wardrobe in a dressing room, fridge and hob in a kitchen, WC in a bath), the placer tries every free wall, both orientations and a smaller variant.
  - If it still fails, the note is `status:"fail"` with id `asbuilt.furniture_missing:<room>`, so the livable count shows it.
  - Paths under 3 ft stay `warn`, but at most one per room, with the floor name.
  - On the regenerated samples (BE-09), there are 0 defining items missing.
- **Hints:**
  - `furniture/place.ts` L240–265 (`furniture_dropped`), `furniture/paths.ts` L254, L394.
  - Define a `DEFINING` set per room type.

### EN-04 · major · Two-car porches park one car or none
- **Problem:**
  - My design (16×18 porch, `car_porch:2`) parks one car.
  - In the villa (18×18, `car_porch:2`) the note says "No parking bay is left that keeps the walkway… clear, so the car… was left out", and the porch is empty.
  - Source: architect-e2e #6, villa.
- **Acceptance:**
  - `parking()` tries side-by-side nose-in bays, a tandem layout and the driveway bays (front setback) before dropping a car.
  - A porch that fits one 6.1×15.8 bay plus the 3 ft walkway always gets one car.
  - When a briefed car is dropped, the note is `fail` (`asbuilt.car_dropped`) and names how many of N were parked.
  - The villa parks at least 1 car, and 2 after BE-05/BE-09.
- **Hints:**
  - `furniture/parking.ts`: bay derivation, around L240 for the driveway bays.
  - `place.ts` L264 for the note.
  - Try both walkway sides (left and right of the bays).

### EN-05 · major · Adjacent balconies join two bedrooms with no divider
- **Problem:** In the villa, the front "Porch terrace" (Bedroom 3), "Arched loggia" (lobby) and "Master balcony" (master) build as one continuous strip. You can walk from Bedroom 3 into the Master Bedroom. Source: walk #5.
- **Acceptance:**
  - Where two outdoor rooms on an upper level share an edge and are not `open_to` each other, the engine builds a full-height privacy screen (jaali or solid, 7 ft) along the shared edge.
  - Walk cannot pass it.
  - The villa reproduction path is blocked.
- **Hints:** `structure/model.ts` wall-run generation (outdoor edges are skipped today) or `structure/guards.ts`, plus a collider. BE-06 adds the matching plan rule.

### EN-06 · minor · Stairs vs openings: a landing over a lower-floor door, and glass below a flight
- **Problem:**
  - (a) The dog-leg mid-landing sits over `g_powder_door`, so you cannot exit; see BE-03 for the plan rule.
  - (b) The first flight climbs past `g_stair_w`: a 6 ft window with a 3 ft sill, so near the landing the glass is below foot level with no guard.
  - Source: architect-e2e #2, #9.
- **Acceptance:**
  - (a) When a flight or landing underside is below 7 ft over a door opening on the lower floor, the stair planner mirrors the dog-leg if that clears it. Otherwise it emits a `fail` as-built note "Stair landing blocks <door>".
  - (b) A window beside a flight has its sill raised to ≥ 3 ft above the pitch line, or a guard rail is added across the glazing, and an as-built note is emitted.
- **Hints:** `structure/stairs-plan.ts` (arrival-side choice, L128) and `structure/openings-geo.ts` / `guards.ts`.

### EN-07 · minor · As-built note copy: engine ids, duplicates, a contradiction
- **Problem:**
  - "the plant floor was left out" appears 4 times, from `type.replace(/_/g," ")`.
  - "Stair Hall: …" is listed twice with no floor named.
  - "the car in Car Porch was left out" shows while a car is visible.
  - Source: orbit m5, walk #18/#19.
- **Acceptance:**
  - Notes use human names ("floor plant", "TV", sentence case) and name the floor when the room name repeats.
  - Identical notes are merged.
  - The car note says "Only 1 of 2 cars fits…" when one is parked.
- **Hints:** add a `humanType()` map in `furniture/place.ts` L251 and `paths.ts` L394. `core/notes.ts` should de-duplicate by message.

### EN-08 · minor · TV and nightstand placement polish
- **Problem:**
  - 10 marla bedroom TV units sit 0.05 ft from the bath door frame, wedged between two openings.
  - The lounge TV is on the entrance wall, about 1 ft beside the main door.
  - Villa Bedroom 3 has both nightstands on one side of the bed and a table lamp on the floor.
  - Source: walk #15/#16, architect-e2e.
- **Acceptance:**
  - TV units keep ≥ 1.5 ft from any door or arch frame and avoid the wall that holds the room's entrance when another wall is available.
  - Nightstands flank the bed on both sides, and the lamps stand on them.
- **Hints:** `furniture/auto.ts` (TV wall choice, bed group).

### EN-09 · minor · The villa geometry is not consolidated, so it orbits at about 29 fps
- **Problem:** `renderer.info.memory.geometries` is 1090 for the villa against 251 for the 10 marla, and the villa orbits at 29 fps. Source: orbit m7.
- **Acceptance:** the villa has ≤ 400 geometries after the build and orbits at ≥ 45 fps on the same machine.
- **Hints:**
  - Use `core/consolidate.ts` to find which section (`facade spanish roofs`? the wrought-iron railings?) escapes merging, for example multi-material groups or InstancedMesh.

---

## VIEWER

### VW-01 · major · Orbit street and side views sit inside or just over the neighbours
- **Problem:**
  - Nothing keeps the orbit camera out of context buildings (the opposite row spans z 19.3–33.3 m).
    - **Front views at eye level:** the camera ends up inside the house opposite, with an opaque `neighbour_glass` panel over the road.
    - **Side views at default distance:** they look through stacked 15% ghost layers, or through a hole in a wall.
  - Leaving walk on the villa roof frames the house from over the left neighbour.
  - The ghost test misses fragments whose ray chord through the house box is < 0.35 m (`core/context.ts` L41–56).
  - Source: orbit M3, M4, walk #21.
- **Acceptance:**
  - For every azimuth, at polar 1.3–1.45 and the default distance on both samples, the house's ground floor and gate read clearly. There is no veil, no opaque panel and no wall filling more than 10% of the frame.
  - Whole context buildings containing the camera, or within 4 m of it, fade to ≤ 5%.
  - Stacked ghost layers never compound: draw each context building's ghost once, or cap the alpha.
  - The exit-walk framing avoids the neighbour.
- **Hints:**
  - Clamp the camera position against the context AABBs (push it out to the street centreline or raise it).
  - In `nqGhostAt`, add a camera-proximity term and ghost any fragment between the camera and the grown house box.
  - `core/framing.ts` handles the exit-walk view.

### VW-02 · major · The walker climbs furniture and solar panels; furniture collision is inconsistent
- **Problem:**
  - `STEP_UP` 0.36 m (`walk/WalkController.ts` L20) plus ground raycasts against every collider let the walker chain up an armchair until the eye is at chandelier height, and walk along the villa's tilted solar panels 1.3–2.5 ft above the roof.
  - Coffee tables and balcony chairs don't collide at all.
  - Source: walk #2, #17.
- **Acceptance:**
  - Only floors, stair treads, landings, ramps and thresholds are walkable.
  - Furniture, fixtures, roof equipment (solar, tank) and cars (when shown) are solid obstacles from the floor up.
  - The walker's feet never rise more than 0.36 m above the room's floor except on stairs.
  - The armchair and solar probes from the walk report fail to climb.
- **Hints:**
  - `groundAt` (L210, L494) should test only meshes tagged as floor, stair or ramp (`userData.layer`/`kind` from the engine tags).
  - The capsule for furniture should start at the feet, not at `STEP_UP`.
  - Also check `walk/navgrid.ts` (L75, L164) so routes don't go over furniture.

### VW-03 · major · Cancelling a walk comment leaves you frozen, says "Pinned", and leaves an orphan pin
- **Problem:**
  - Esc or × on the composer only clears the app's draft (`HouseView.tsx` L459 `onCancel={() => setDraft(null)}`).
  - The controller stays in `walk:"commenting"`: WASD is dead and the chip reads "Pinned. Add your note, then keep walking." The blue draft pin stays until a 60 s timer (`controller.ts` L1961–1967).
  - The same chip also appears after the note is saved, and the scene dims.
  - Source: walk #3, design-critic.
- **Acceptance:**
  - Cancel drops the draft pin and resumes free walking immediately.
  - Save shows "Note pinned" for about 2 s, then resumes.
  - "Pinned…" is never shown before a note is saved, and the scene doesn't stay dimmed.
- **Hints:**
  - Add `ViewerController.cancelDraft()`: clear `draftTimer`, `draft:null`, then `resumeWalk(false)`.
  - Expose it on the HouseViewer handle or as a prop.
  - The one-line app wiring in `HouseView.tsx` L459 is part of this task.
  - The Hud chip is at `hud/Hud.tsx` L100–103.

### VW-04 · major · The minimap fades out under the cursor, so "click to go" fails
- **Problem:** The idle fade (`controller.ts` L449, `IDLE_MS` 2.5 s) hides the minimap (opacity 0, `pointer-events:none`) while the pointer rests on it. A click after reading the caption does nothing. Source: walk #4.
- **Acceptance:** while the pointer is over the minimap, or it has focus, it never fades. Clicking a room after a 5 s hover glides there.
- **Hints:** in `hud/MiniMap.tsx`, set `pointerenter`/`pointerleave`, then call `ctrl.markActive()` or set a `hoverHud` flag that blocks `idle`.

### VW-05 · minor · Coachmarks and idle hiding, the doubled "Drag to look", edge-hover spin
- **Problem:**
  - The centre "Click / Drag to look around" pill never goes away when navigating by keys or glides.
  - After 2.5 s idle the minimap fades but the chips, buttons and Ask bar stay. That is the reverse of the spec ("only the crosshair and the room pill remain").
  - "Drag to look around" shows twice (a toast and a pill) when pointer lock is refused.
  - Edge-hover turning (`controller.ts` L1610–1630) keeps spinning while the cursor rests in the 90 px band beside the floor rail and bottom-left controls.
  - Source: walk #9, #10; design-critic.
- **Acceptance:**
  - The coachmark fades after 4 s or the first look input.
  - Only one "drag to look" message shows.
  - Edge-hover turning is disabled while the pointer is over any HUD element, or within 24 px of one.
  - Idle hides the HUD chips per DESIGN, or the spec is updated to say the minimap only.
- **Hints:** use `elementFromPoint` or a HUD-hover flag in the edge-look loop. `Hud.tsx` L132 holds the prompt condition.

### VW-06 · minor · The "Walking controls (?)" popover and help card
- **Problem:**
  - A real mouse click doesn't open it (`aria-expanded` flips back to false); a programmatic click does.
  - The copy reads "Finish F" and "Let go · leave Esc".
  - The keys disagree with the floor stack ("1…3" against "[ / ]").
  - M and `[` `]` are missing.
  - Source: design-critic, walk #20.
- **Acceptance:**
  - A mouse click toggles the popover.
  - The copy lists: Move WASD, Look mouse, Rooms M, Floors 1–3 or [ ], Comment C, Finish F, Leave Esc.
- **Hints:** likely a pointerdown handler on the canvas or document closing it before the click. Stop propagation on the HUD button in `hud/Hud.tsx`.

### VW-07 · minor · Human labels in the viewer (pin tags, composer chips, build card, room pill)
- **Problem:**
  - The pin tag reads "Upper Family Lounge tv, first floor".
  - The chips read "Move the drawing room plant floor".
  - The build card reads "Facade spanish roofs" (`prettySection`, `Hud.tsx` L17–22).
  - The room pill reads "Rooms" on the roof.
  - `?floor=` is not updated by walk or stairs, so orbit opens on the wrong floor.
  - Source: design-critic ids, walk #14, #18.
- **Acceptance:**
  - Labels read "TV in the upper family lounge", "Floor plant" and "Building the roof" (or "Furnishing the kitchen").
  - The room pill reads "Roof" on the roof.
  - The floor in the URL follows the walker's level.
- **Hints:**
  - Add one `humanLabel(kind,id,room)` in `core/tags.ts` that maps furniture types (`tv`→"TV", `plant_floor`→"floor plant") and sentence-cases room names.
  - `prettySection` maps section names to stage words.

### VW-08 · minor · WebGL INVALID_OPERATION warning spam
- **Problem:** `GL_INVALID_OPERATION: glDrawElements: Mismatch between texture format and sampler type` repeats until Chrome stops reporting (more than 500 warnings). Source: walk #12.
- **Acceptance:** no WebGL errors in a 5-minute orbit and walk session on both samples.
- **Hints:**
  - Usually a depth or integer texture sampled as float, for example in the N8AO/PostFX normal or depth input, or a `DataTexture` with an integer type.
  - Bisect by toggling PostFX (`scene/PostFX.tsx`) and the engine's generated textures (`engine/materials/texjob.ts`). An engine touch may be needed.

---

## APP

### AP-01 · blocker · A brief without a plot crashes the project and the whole workspace (lockout)
- **Problem:**
  - Any first message without a plot size saves `brief.plot = null`, which the backend does by design (`intake.empty_brief`).
  - Two reads crash on it:
    - `shell/DetailsDialog.tsx` L13 reads `b.plot.area_marla` even while the dialog is closed;
    - `workspace/Workspace.tsx` L258 reads `p.brief?.plot.width_ft`.
  - The project and `/app` then show "This page didn't load". "Try again" re-crashes, and there is no way back.
  - Source: landing-auth #1, setup #1, design-critic B1.
- **Acceptance:**
  - A project whose brief has `plot: null` opens on every view. Details shows "Plot · Not yet". The workspace card shows the empty plot sketch.
  - `ErrorBoundary` offers "Back to your homes" (`/app`).
  - `contracts/api-types.ts` types `plot` as `{…} | null`, and `npm run build` type-checks every use.
- **Hints:**
  - Guard both sites (`b.plot ? … : "Not yet"`, `p.brief?.plot?.width_ft`).
  - Grep `plot\.` for any other unguarded reads; the remaining ones already use `?.` or read `plan.site.plot`.
  - Add a third button in `ui/ErrorBoundary.tsx`.

### AP-02 · major · Every landing sample card opens the Spanish villa, not the home pictured
- **Problem:**
  - `landing/Landing.tsx` L32–54 hard-codes `SAMPLES` with stock images of homes that don't exist ("Courtyard frame house", "Corner home").
  - Every card, plus "Walk through one" and "Explore a sample home", calls `openSampleHome(navigate)` without an id, so they all open `samples[0]`, the villa.
  - Source: landing-auth #2, design-critic M1.
- **Acceptance:**
  - The cards are rendered from `GET /api/samples`, with the real name, thumbnail and caption, and open the clicked sample (`openSampleHome(navigate, id)`).
  - The hero CTA opens the 10 marla modern home, which matches the hero animation.
  - A fallback skeleton shows while loading.
- **Hints:** `lib/samples.ts` already accepts `sampleId`. Use `api.listSamples()`.

### AP-03 · major · A guest owner cannot share at all
- **Problem:**
  - Every Share entry point calls `requireAccount("share")` (`shell/next.ts` L38), which opens "Create an account to share" with no way past it.
  - "Keep going as a guest" is plain text, while the backend lets a guest owner create a link.
  - The whole collaboration story is invisible to judges.
  - Source: collaboration #2.
- **Acceptance:**
  - A guest owner opens the Share dialog, turns on the client link and copies it.
  - Only "Invite by email" or team roles ask for an account, inline inside the dialog.
- **Hints:** call `setShare(true)` directly in `startShare`, and gate the invite section in `share/ShareDialog.tsx` with `useAuth().user`.

### AP-04 · major · "Decide everything for me" stops at Concepts (select returns 404)
- **Problem:**
  - The autopilot (`concepts/ConceptsView.tsx` L118–131) calls `choose(roots[0])` 1.4 s after the first image arrives.
  - The server saves concepts only after all four finish (`agents/concepts.py` L216), so `/select` returns 404. `autoDone` is already true, so it never retries.
  - The banner then stays up for good, with no plan and no house.
  - Source: setup #2.
- **Acceptance:**
  - Autopilot selects only after the concepts run has finished and the project reloads with the concept saved.
  - On a failed select it retries once, then clears the banner with an error.
  - It goes on to Plan and builds the house without any user action.
- **Hints:**
  - Gate the effect on `!run?.running && project.concepts.some(c => c.id === first.concept.id)`.
  - Reset `autoDone` on error.
  - The backend alternative (save each concept as it lands) is optional.

### AP-05 · major · "Skip the pin" throws away the facing picked on the compass
- **Problem:**
  - `MapWidget` (`setup/widgets.tsx` L601–631) offers only "Skip the pin" as the secondary button, and it calls `onSkip`, which sends `skip_question`, so the server picks North.
  - A user who tapped E and has no map link loses the choice.
  - Source: setup #3.
- **Acceptance:**
  - With a facing chosen, "Skip the pin" submits the facing without coordinates.
  - "Decide for me" is offered only when nothing is chosen.
- **Hints:** make the secondary button `facing ? send : onSkip`, labelled "Skip the pin" or "Decide for me" accordingly.

### AP-06 · major · The floors editor deletes rooms it doesn't list, and ignores the storey limit
- **Problem:**
  - `CATALOGUE` (`setup/catalogue.ts` L30–46) has no gym, powder room, dressing or kitchenette.
  - `fromFloors` drops unknown tokens. Saving the editor without changes rewrites `second=[gym,study,terrace]` to `[study,terrace]`.
  - The storeys control always offers 3 ("LDA allows up to three"), even for DHA.
  - Source: setup #9, #4 (app part), #22.
- **Acceptance:**
  - Unknown room tokens are kept per floor and shown as read-only chips ("Gym") that survive Save.
  - The storey options go up to `envelope.max_storeys`, and the title names the authority.
  - The radio's accessible name is "3 storeys".
- **Hints:**
  - Keep an `extras: Record<LevelId,string[]>` alongside `Program` in `fromFloors`/`toFloors`.
  - Optionally add `gym`, `powder` and `dressing` to `CATALOGUE`.
  - Segmented options are at `widgets.tsx` around L240.

### AP-07 · major · The suggested per-floor program can over-fill a floor, and over-capacity is accepted
- **Problem:**
  - `defaultProgram` (`catalogue.ts` L164–210) puts all 5 bedrooms on the first floor of a 10 marla (1,663 of 1,440 sq ft). `fit` uses the 205 sq ft bed area but then adds the master (300), a lounge and a balcony.
  - "Use these floors" stays enabled while over capacity.
  - Source: setup #6.
- **Acceptance:**
  - The default program fits every floor: it moves bedrooms down, or one to the ground floor, until `used ≤ capacity`.
  - "Use these floors" asks "The first floor is over by 223 sq ft. Move the bed down, or keep it anyway?" before sending.
- **Hints:** after building `p`, loop `suggestMove` (L218) until `null` or 5 iterations. Gate `send` in `FloorsWidget` (`widgets.tsx` L330) on `levels.every(fits)`.

### AP-08 · major · Compliance claims "Approval-ready / Passes all" while showing warnings and as-built defects
- **Problem:**
  - `summarize` (`plan/compliance.ts` L56–68) and `complianceCounts` (`shell/narration.ts` L102–113) count `warn` as pass.
  - The panel header says "Approval-ready · Passes all 36 LDA checks" (`CompliancePanel.tsx` L79–85) next to "Bath 2: 0 sq ft opening".
  - The print says "36 of 36 pass" (`PrintDocument.tsx` L290).
  - The dock says "Your home passes all 31 LDA checks" (`ProjectShell.tsx` L197) while livable fails.
  - The as-built "notes" (missing fridge, paths under 3 ft) never touch the "8/8 livable" badge.
  - Source: concepts-plan P-4, P-30; architect-e2e #5; house-orbit M5; design-critic M3.
- **Acceptance:**
  - Counts read "35 pass · 1 to check" when there are warnings.
  - "Approval-ready" and "Passes all" appear only when there are 0 fails and 0 LDA warnings.
  - The dock line mentions remaining livable fails and warnings ("…passes all 31 LDA checks; 1 livable rule still needs work").
  - Once the house is built, livable as-built checks (category livable from `api.asBuilt`) are merged into the status line and the compliance sheet as "As built" rows.
  - Print marks warnings with an amber "Check" label.
- **Hints:**
  - Add `warn` counts to `summarize` and `complianceCounts`.
  - `HouseView.tsx` L190/L323 holds `asBuilt`. Lift it into the project store (`versions[vid].asBuilt`) so `useStatusLine` can include it.

### AP-09 · major · The print set doesn't fit A4, and the sheets carry wrong or duplicated data
- **Problem:**
  - On A4, `.page` is 297×210 mm with `overflow:hidden` and content up to 994 px. Title blocks are cut on the cover, ground and first-floor sheets, and the compliance sheet loses 29 rows, including the whole Livable section. On the 1 kanal set the 4th column runs off the page and the title block overlaps column 3.
  - On the A3 cover, the footnote overflows by 2.1 mm.
  - Each livable rule prints twice (`PrintDocument.tsx` L303–304).
  - The roof sheet shows an empty schedule and "0 sq ft covered".
  - The location reads "DHA / Johar Town, Lahore", taken from the model-written `plan.site.scheme`.
  - Source: concepts-plan P-3, P-13, P-14, P-18, P-26; design-critic M4–M6.
- **Acceptance:**
  - Every sheet fits A3 and A4 with no node outside the page box (measure in preview). The title block is pinned inside the 10 mm margin.
  - The compliance report paginates on A4, continuing on a second sheet with its own title block and sheet number.
  - Each rule message prints once.
  - The roof schedule lists the stair tower (its area, counted as covered), the tank and the solar area.
  - The location comes from `project.brief.scheme`/`city`.
- **Hints:**
  - Compute the A4 type scale and the column count from the paper size.
  - Split the compliance list into pages by measured height, using `useLayoutEffect` in the print root.
  - Drop the second `<span>` at L304 when `valueLine(c)` is null.
  - L86 and L336 for the location.

### AP-10 · major · The roof plan paints over the stair that reaches the roof; roof labels collide
- **Problem:**
  - In `plan/FloorPlan.tsx` `RoofExtras` (L514–566), the mumty `<rect … fill="#fff">` (L539) is drawn over the stair flights and the "Down" label, on screen and on print sheet A-103. The drawing shows a box with a door and no stair: the user's "no stair to the roof" complaint, in 2D.
  - "Stair tower" and "9′ high" sit on the mumty's top wall.
  - "Plastic tank" is wider than its box.
  - Source: concepts-plan P-2, P-15.
- **Acceptance:**
  - On R, the flights and "Down" are visible inside the mumty on both samples and in print.
  - The mumty walls are drawn as a thick outline with no fill.
  - The tank on the mumty roof is dashed.
  - Labels sit fully inside their shapes, or use a short leader.
- **Hints:**
  - `fill="none"`. Render the stair layer after `RoofExtras`, or move `RoofExtras` before the room layer.
  - Measure the text width with the existing `px()` scale and fall back to a leader line.

### AP-11 · major · Plan chrome sits under the dock (phone zoom and legend, pin popover, compliance sheet over the Next pill)
- **Problem:**
  - **Phone (375×812):** the zoom controls and the legend/room key sit under the dock narration and can't be tapped. `PlanView.tsx` L266 and L356 hard-code `bottom-[96px]`; the inset bottom is 100.
  - **Desktop:** a plan pin's comment popover renders at the bottom centre, under the narration.
  - **Desktop:** the compliance sheet covers the right ~70 px of "Walk through it".
  - **1000×622:** fit ignores the dock, so the road label and scale bar are hidden.
  - Source: concepts-plan P-6, P-7, P-8, P-20; design-critic M7.
- **Acceptance:**
  - At 375×812, 1000×622 and 1366×850, `elementFromPoint` at the centre of every plan control, the legend toggle, a pin popover and the Next pill returns that element.
  - The pin popover is anchored beside its pin.
  - Opening a sheet moves or hides the dock pieces it covers.
- **Hints:**
  - Use `calc(var(--dock-h) + 12px)` for the controls and legend bottom, and `inset.bottom = dockH + …` (read the CSS var, or the Dock height from the shell store).
  - The pin popover should be positioned from the pin's screen coordinates.
  - The Dock should accept a right inset while the compliance sheet is open, as the Comments sheet already does.

### AP-12 · major · Brief on phones: the dock line covers the active widget; the Conversation sheet lacks the widget
- **Problem:**
  - At 375×812 the active question's last row ("Decide for me") sits under Naqsha's duplicated dock line. A tap opens the Conversation sheet instead.
  - That sheet shows the question but not its widget (the floors editor), so it can't be answered there.
  - Source: setup #10, #20.
- **Acceptance:**
  - In Brief, the docked conversation leaves `var(--dock-h)` of bottom padding, and the dock's Naqsha line is hidden while the docked conversation is on screen.
  - Every widget button can be tapped at 375×812 and 320×640.
  - The Conversation sheet either renders the same active widget or isn't offered in Brief.
- **Hints:** `setup/BriefView.tsx`, `setup/Conversation.tsx`, `shell/Dock.tsx`, `shell/ConversationSheet.tsx`.

### AP-13 · major · Client view: the Ask dock covers Walk and Comment; the client walk lacks Rooms and Comment
- **Problem:**
  - At 1280×800, 1366×768 and 1024×768, the client's Orbit/Walk toggle and Comment button are under the dock. `share/HouseStage.tsx` L122: `hudBottom = phone ? calc(var(--dock-h)+12px) : var(--chrome)`.
  - The client walk has no room navigator and no Comment button.
  - Source: collaboration #3, #10.
- **Acceptance:**
  - At every desktop width from 1024 to 1440, the client controls sit above the dock, as in the owner's House view.
  - The client walk offers Rooms (M) and Comment (C) like the owner's.
- **Hints:** use `calc(var(--dock-h) + 12px)` on all widths. Reuse `RoomNavigator` from `explore/HouseView.tsx` (export it).

### AP-14 · major · Popovers open off-screen (View, as-built notes) and jump
- **Problem:**
  - `Popover.place()` (`design/kit.tsx` L419–433) flips a `side:"top"` panel below the anchor without checking that it fits:
    - the View panel spans y 549–1095 in a 657 px viewport, so the layers, the section cut and Render can't be reached (1366×768 laptops, iPhone SE/8);
    - the "12 notes" popover shows 2 of 12 and doesn't scroll.
  - Choosing Night removes the Sun row, so the bottom-anchored panel jumps 34–60 px under the cursor.
  - Source: orbit M1, M2, m4, p3; design-critic.
- **Acceptance:**
  - Every popover is clamped to `[8, vh − h − 8]`, with `max-height: calc(100dvh − 16px)` and internal scroll.
  - Below 640 px, View and Notes open as bottom sheets.
  - The Day/Dusk/Night control doesn't move when switching: keep the Sun row disabled, or anchor the panel's top.
  - Each as-built note offers "Show me", which flies to the room.
- **Hints:**
  - After the flip, `top = clamp(top, 8, vh - h - 8)`, and set `maxHeight` in `pos`.
  - `ViewPanel` and `AsBuiltNotes` are in `explore/HouseView.tsx` L581 and L781.

### AP-15 · major · HUD text contrast over the 3D scene fails AA
- **Problem:**
  - `glass-hud` (rgb(24 24 27/.58), `index.css` L91) over a pale sky or roofs gives an effective background of about rgb(101–110).
  - `--color-hud-ink-2` #A3A3AD (L34) on it is 2.0–2.3:1. This affects the floor stack, the 11 px status line, the inactive tabs, the key caps and the minimap labels.
  - The "Assembling your home" card is nearly invisible.
  - The HUD focus ring (accent at 20%) is barely visible.
  - Source: design-critic M2.
- **Acceptance:**
  - HUD secondary text is ≥ 4.5:1 over the brightest sky in both samples. Body text is ≥ 12 px.
  - The build card is legible.
  - Focus rings on HUD controls are ≥ 3:1.
- **Hints:**
  - glass-hud alpha to about .75.
  - `--color-hud-ink-2` to ≥ #C9C9D1.
  - A HUD-specific `--shadow-focus-hud` (2 px #7D93FF).
  - `viewer/viewer.css` reads these tokens.

### AP-16 · minor · The owner's comments sheet hides earlier threads; filters ignore "On earlier versions"
- **Problem:** "On earlier versions" exists only for `clientView` (`comments/CommentsSheet.tsx` L58–61) and ignores the active filter. After a revise, the owner sees "No comments yet" and loses Naqsha's answers. Source: collaboration #4 (app part), #8.
- **Acceptance:**
  - The owner's sheet shows resolved threads from earlier versions under "On earlier versions".
  - All/Mine/Team/Client/Open/Resolved apply to that section too.
  - Open comments from earlier versions are covered by BE-11.
- **Hints:** drop the `clientView &&` gate. Apply `matches(c, filter, me)` to `earlier`.

### AP-17 · minor · The client view never picks up a new version
- **Problem:**
  - The 10 s poll (`share/ClientView.tsx` L55) refreshes only the comments, and re-downloads the full 68 KB `/api/share/{token}`.
  - "Approve v4" stays after v5 exists.
  - Source: collaboration #5.
- **Acceptance:**
  - Poll `/api/share/{token}/comments`, plus a light `current_version_id` check.
  - When the version changes, show "Version N is ready · View" (or switch to it). Approve always targets the version shown.
- **Hints:** add a `?fields=meta` read, or compare `project.current_version_id` from a cheap share endpoint (a backend tweak if needed).

### AP-18 · minor · One colour per author; name and role shown twice
- **Problem:**
  - 3D and plan pins use `authorHue()` (`plan/model.ts` L239–243), while the sheet's avatar and number badge use `roleColor(role)` (`ui/Avatar.tsx` L19). Owner comment #1 is amber in 3D and teal in the sheet.
  - Guest authors read "Owner · Owner · just now".
  - Source: collaboration #6, #13; design-critic.
- **Acceptance:**
  - Pins, number badges and avatars use one hue per author (DESIGN.md).
  - The role caption is dropped when the name equals the role.
- **Hints:** use `hueColor(c)` in `CommentItem.tsx` L29 and Avatar, or move the role colour into the pins.

### AP-19 · minor · A client's first reply posts as anonymous "Client"; the client Ask says "Ask Naqsha"
- **Problem:** The name is asked only for a new comment or Ask note, so a first Reply posts "Client · Client" and splits the person into two authors. In the client view, the command popover says "Ask Naqsha · …" although Enter sends a note. Source: collaboration #7, #15.
- **Acceptance:**
  - The first write of any kind (reply included) asks for the name once.
  - The client popover reads "Send to the owner · …".
- **Hints:** `share/ClientView.tsx` name prompt; `comments/CommentItem.tsx` reply composer.

### AP-20 · minor · Revisions and compare: stale live mode, changed openings not outlined, raw ids, no key
- **Problem:**
  - **Live mode never ends:** after a run finishes on `/revisions`, the in-progress caption stays, Before/Wipe/After is missing and the deltas are missing.
  - **Replay timestamps:** replayed steps all show the re-attach time.
  - **Opening changes are ignored:** a change whose target is an opening (`f_master_w`) outlines no room, and Plan shows no "Changes since v1" for the villa.
  - **Raw id:** "(Master w)" appears in the summary.
  - **Wrong floor:** the compare opens on G when the change is on floor 1.
  - **Missing key:** numbered markers on the compare have no legend.
  - **Thin Plan compare:** it has no delta or summary on hover.
  - **Polish:** the H1 "From 2 comments · 44/44 LDA · 8/8 livable"; the "After" pill overlaps the north arrow.
  - Source: collaboration #11; concepts-plan P-9, P-10, P-19; design-critic.
- **Acceptance:**
  - On `done`, the view swaps to the finished compare, with deltas.
  - Event times are kept.
  - The targets of an opening map to the room(s) it belongs to, for the outline and the "Changes since" control.
  - The compare opens on the first changed floor.
  - Change summaries strip parenthesised ids.
  - The room key shows beside the compare.
  - Hovering a changed room in Plan shows its delta and change summary.
  - The H1 is a sentence, for example "Version 2 · from 2 comments".
- **Hints:** `revisions/RevisionsView.tsx` L95–102 (`changed`), L325+; `revisions/PlanCompare.tsx`; `plan/PlanView.tsx` changes toggle.

### AP-21 · minor · Plan room interaction and labels
- **Problem:**
  - The room card ("Opens to…") is hover-only. Room shapes have only `onPointerMove`/`onPointerLeave`, so nothing happens on tap or keyboard, and phones never see it.
  - A lounge reads "… own dressing …".
  - The ground-floor stair hall has no label or marker.
  - A compliance highlight stays after the sheet closes.
  - One wheel notch jumps 100% → 292%.
  - Source: concepts-plan P-17, P-21, P-25, P-27, P-31; design-critic hover.
- **Acceptance:**
  - Tap or Enter on a room selects it and shows its card. Tab moves between rooms.
  - "own" appears only when a bedroom's suite room is listed.
  - Every room has a label or a numbered marker, the stair hall included.
  - The highlight clears when the sheet closes.
  - A wheel notch zooms by ≤ 1.25×.
- **Hints:**
  - `plan/FloorPlan.tsx`: room shapes; the label placer skips `stair` rooms.
  - `plan/model.ts` `connections` for the "own" wording.

### AP-22 · minor · Compliance rows: units, empty stair and services rows, three livable checks missing
- **Problem:**
  - `valueLine` (`plan/compliance.ts` L35–53) falls back to "64 (limit 55)" and "5.5 (limit 8)".
  - The stair rows return null and show nothing collapsed.
  - The three DESIGN livable rules (railings, doors clear, 3 ft path) only exist in `livableChecks()`, which is used only when the report has no livable checks at all.
  - Source: concepts-plan P-11, P-12, P-22; design-critic.
- **Acceptance:**
  - Rows use `c.unit`, feet and inches ("5′6″ (min 8′)"), and min or max wording.
  - Stair and services rows show their message collapsed.
  - The three guaranteed livable rules are always listed (merged in when absent).
- **Hints:**
  - Use `c.unit` and a `kind: "min"|"max"` guess from the title, or have the backend send `bound` (BE-23 sends the unit).
  - Append missing `livable.railings`, `livable.doors` and `livable.paths` in `withLivable`.

### AP-23 · minor · The concepts lightbox stacks chrome
- **Problem:**
  - The dock narration covers the 4th "Remix it" chip.
  - The dock adds a second remix row, so "Darker glass" appears twice (`ProjectShell.tsx` L210).
  - There are two accent CTAs ("Plan this one" and "See the plan").
  - "Good choice. I'll plan the floors around it next." shows on a project that already has v2, even for a non-chosen concept.
  - Source: concepts-plan P-16; design-critic.
- **Acceptance:**
  - One remix row, not overlapped.
  - One accent CTA.
  - Narration that matches the state: "This is your chosen look; the plan is ready" or "Plan this one instead?".
- **Hints:** hide the dock suggestions while a lightbox is open, and add bottom padding of `var(--dock-h)` to the lightbox.

### AP-24 · minor · Version state: the status line shows the latest version, the old-version hint is wrong, `?v=2` hangs, camera and light reset
- **Problem:**
  - Viewing v1 still shows "v2 · 36/36 LDA" (`shell/TitleCapsule.tsx` L18–30 uses `current_version_id`).
  - The dock hint "press C to pin a note" shows on an old version where C is disabled (`ProjectShell.tsx` L201).
  - The DESIGN deep link `?v=2` leaves House stuck on "Opening the house…".
  - Plan → House rebuilds for 7 s, resets the camera and drops `?light=night`.
  - Source: orbit m1, m2, m3; architect-e2e.
- **Acceptance:**
  - The status line reflects the version shown.
  - The old-version hint reads "This is an earlier version. Switch to the latest to pin notes."
  - `?v=<n>` resolves by number, falling back to the current version with a toast.
  - Switching views keeps the camera pose and light.
- **Hints:** keep `HouseViewer` mounted (hidden) across view switches, or persist `{camera, light}` in the shell store and restore it on mount.

### AP-25 · minor · Room navigator and phone HUD collisions
- **Problem:**
  - At 1180 and 1366 px the navigator popover overlaps the minimap.
  - The search field isn't focused when the navigator opens from the room pill or after a floor-button click, so typed letters are lost.
  - On phones it is a 300 px popover, not the specced full sheet.
  - On phones the floor stack overlaps the "12 notes" pill (320×640), and the floor rail covers the "Assembling your home" card.
  - Source: walk #7, #8, #11, #22; orbit m6; design-critic.
- **Acceptance:**
  - The navigator never overlaps the minimap: anchor it left of the minimap, or hide the minimap while it is open.
  - Opening it always focuses the search on desktop.
  - On phones it is a full sheet.
  - There is ≥ 8 px between the HUD stacks on phones, and the build card is centred clear of the floor rail.
- **Hints:** `RoomNavigator` (`explore/HouseView.tsx` L701), the HUD rows at L324–326 and the CSS at L547–550.

### AP-26 · minor · Setup surfaces: DHA called LDA, raw HTML error toast, stale or duplicated understood cards, a11y names, plot range hint
- **Problem:**
  - A DHA plot says "What LDA lets you build" and "how far LDA lets you build" (`setup/BriefView.tsx` L110, BriefSheet).
  - The intake error toast shows Google's HTML 500 under "The AI architect couldn't reply" (`api/sse.ts` L127–137 has no `<` guard; `store/project.ts` L512).
  - The latest card mixes the new plot with a stale "Ground coverage … (1,904 sq ft)", and older cards render a different layout with duplicates.
  - The two-column card is cramped in the 420 px sheet.
  - Fact tokens are named "Tap to correct", the brief rows are unnamed buttons, and the plot dialog disables Save without saying the range.
  - Source: setup #16, #17 (app part), #18, #19, #22, #24; design-critic.
- **Acceptance:**
  - The authority is named from `brief.authority`.
  - Error toasts never show markup ("Naqsha couldn't reply. Try again."), and no "AI" appears in copy.
  - The latest card's guaranteed figures are computed from the current envelope.
  - Older cards collapse to one line ("Brief updated · show").
  - The card is one column under 480 px.
  - Accessible names read "Correct 3 storeys" and "Edit plot".
  - The plot editor shows "10–400 ft wide, 20–600 ft deep".
- **Hints:**
  - Copy `readError`'s guard from `api/client.ts`.
  - `setup/Understood.tsx`; `widgets.tsx` PlotEditor L80–180.

### AP-27 · minor · Auth errors show under the wrong field and don't clear
- **Problem:** `auth/AuthForm.tsx` renders one error paragraph below the last field. It isn't linked with `aria-describedby` and doesn't clear on edit. Source: landing-auth #4, design-critic.
- **Acceptance:** each field shows its own caption directly under the input with a fail border, linked with `aria-describedby`, and cleared when that field changes.
- **Hints:** keep a `errors: Partial<Record<"name"|"email"|"password", string>>` state and use the `ui/Input.tsx` error prop.

### AP-28 · minor · Focus is lost after the Rename or Delete dialog closes
- **Problem:** After the dialogs opened from a card's More menu close, `document.activeElement` is BODY. Source: landing-auth #5.
- **Acceptance:** on close (Esc, Cancel or Save), focus returns to that card's More button, or to the card when it was deleted.
- **Hints:** `workspace/Workspace.tsx` L245–246. Pass a `returnFocus` ref to `ui/Dialog.tsx`, or store the trigger element when the menu item fires.

### AP-29 · minor · Phone touch targets under 44 px; no Sign in in the phone landing header
- **Problem:**
  - At 375 px these are too small:
    - "Open portal" 32 px;
    - footer links 22 px;
    - workspace "Sign in" 32 px;
    - tabs 30 px;
    - card More 36 px;
    - "start with questions" 22 px;
    - Orbit/Walk toggle 30 px;
    - minimap floor buttons 22×20.
  - Sign in is `hidden sm:inline-flex` in the landing header (`Landing.tsx` L78).
  - Source: landing-auth #6; design-critic; architect-e2e.
- **Acceptance:**
  - Every interactive control is ≥ 44 px tall at < 640 px, or has a ≥ 44 px hit area.
  - Sign in is reachable from the phone header (an icon button or in the menu).
- **Hints:** use a `min-h-11` utility on touch, or a `::before` hit-area extension in `ui/Button.tsx` for `size="sm"` under `pointer: coarse`.

### AP-30 · minor · Next pill and Comment affordances; build-time copy
- **Problem:**
  - The Next pill keeps "See what changed" after a new pin until a reload.
  - The HUD "Comment" button in walk only toasts "Press C…".
  - On phones the dock says "press C to pin a note".
  - During "Building the 3D model", the compliance sheet says "1 rule to fix. I'm fixing these now.", and the step label goes back from Reviewing to Fixing.
  - Source: design-critic; architect-e2e.
- **Acceptance:**
  - The Next pill updates to "Revise with N comments" as soon as a comment is saved.
  - The Comment button pins at the crosshair in walk, the same as C.
  - Phone copy says "Tap Comment".
  - The compliance sheet copy follows the run stage: no "fixing now" once the build stage has started.
- **Hints:** `shell/next.ts`; `explore/HouseView.tsx` Comment button (call the controller method the C key uses); `plan/CompliancePanel.tsx` with `lib/fixloop.ts`.

### AP-31 · minor · Brief and Revisions content scrolls under the floating capsules
- **Problem:** On desktop, the right column of Brief and the Revisions page scroll under the title capsule, the view switch and the people capsule, with no band or fade. At rest, the last bullets of "What LDA lets you build" sit under the dock. Source: design-critic.
- **Acceptance:** scrolling content never sits under a capsule (top band plus fade, or `padding-top: var(--chrome-top)` with a sticky mask), and the bottom padding includes `var(--dock-h)`.
- **Hints:** `shell/ViewFrame.tsx` already provides both paddings. Brief and Revisions don't use it for their scroll containers.

### AP-32 · polish (cheap) · Landing, metadata and card copy
- **Problem:**
  - "How it works: Three places" omits Plan.
  - "in minutes" sits over "the same afternoon".
  - The Portal is labelled "Open portal", "Open the Portal" and "Portal".
  - The landing numbers ("42/42 LDA · 5/5 livable", "Print every floor at 1:100") disagree with the app.
  - `og:image` is relative.
  - Stale tab titles on `/s/<invalid>` and on project load.
  - The animation starts when only about 200 px of it is visible.
  - The animation chips cover about 40% of the frame on phones.
  - Sample cards say "Sample" twice, and copies keep the prefix.
  - The untitled placeholder looks like the New home tile.
  - More than one accent primary on screen in Brief and Revisions.
  - Plan suggestion chips offer "Add a prayer room upstairs" when one exists.
  - The comments sticky header lets content peek above it.
  - The phone Ask placeholder is clipped.
  - Source: landing-auth #8–#11, design-critic polish, concepts-plan P-28/P-29, collaboration #14.
- **Acceptance:**
  - "Four views" copy.
  - One "Portal" label.
  - The numbers match the samples, or are generic.
  - Absolute `og:image` (`https://…/og.jpg`).
  - `document.title` set on the client error and loading states.
  - The animation triggers at 50% visibility.
  - The LDA chip is hidden below `sm`.
  - The "Sample ·" prefix is stripped from card titles.
  - A neutral house glyph for untitled homes.
  - One accent per screen.
  - Plan suggestions skip rooms the plan already has.
  - The sticky header has a solid background.
  - The placeholder is shortened on phones.
- **Hints:** `landing/Landing.tsx`, `landing/Construction.tsx`, `web/index.html`, `workspace/Workspace.tsx`, `plan/PlanView.tsx` L178, `comments/CommentsSheet.tsx` L191.

---

## Won't fix (dropped, with reason)

- **"Plan room hover is missing"** (design-critic): a false alarm. Hover works on desktop; architect-e2e and concepts-plan both saw "Powder room · 6′ × 4′6″ · 27 sq ft · Opens to: Stair hall". The real gap, tap and keyboard, is AP-21.
- **"Opening a sample from the Samples tab creates a new clone each time"** (concepts-plan note): not reproduced. landing-auth verified that sequential opens and opens after a rename dedupe. The extra copies came from `{fresh:true}` testing and the concurrency race (BE-21).
- **280 px non-touch HUD collisions** (walk #23): narrower than any phone. At 320 and 375 px with touch, the layout is clean.
- **Pointer-lock "mouse look like a game"**: not testable in the embedded pane, and no defect was observed. Verify manually in desktop Chrome before the demo.
- **"make it 4 storeys" took 12.9 s once:** seen once, and the answer was correct.
- **The HTML 500 during a deploy** was a transient revision swap, not an app error. Only the toast is fixed (AP-26).
- **Section-cut caps** (orbit p4): a costly shader and geometry change; polish.
- **Sun slider dawn-to-night range** (orbit p1): a design change, not a defect; polish.
- **Remix variations look near-identical** (P-23): model variance; polish.
- **Mixed author and status filters in one control** (design-critic): a deliberate simplification; polish.
- **Revise progress-feed polish** (collaboration #12): duplicate step, status mismatch, clipped capsule, stale chips, both sheets open. Low value across many states before the deadline.
- **Workspace thumbnails mix photos and clay captures** (design-critic): intentional, since the card shows the latest version.
- **Unlabelled "Design again" icon**, **"Recommended" in pass-green**, **Share uses the ink variant**, **"Rooms on each floor" dialog re-centres**, **phone "Save your work" indent**, **Title Case in the command bar:** polish, deferred.
- **"A car is still parked although the note says it was left out" (villa):** not separate; it is the second car, covered by EN-04 and EN-07.
