# Round 1 review: the setup agent's intelligence

**Tested:** live app at https://naqsha-242926648187.us-central1.run.app (revision `naqsha-00006-zq7`), 17 Oct 2026. I used the built-in browser at 1366×860 and at phone width (375×812), checked the console, network traffic and Cloud Run logs, and read the code to find root causes. I did not change any code.

**Projects created** (all on the shared guest id in this browser):

| Project | What it tested |
|---|---|
| `p_bde74bf6718d` | Rich message, then corrections, questions and direct edits |
| `p_b28b84e75a2e` | "5 marla", answered through the widgets |
| `p_156ca2b22f81` | "house for 5 people in Lahore" (crash) |
| `p_31c8fbda99d6` | 7 marla corner, rich message plus a question, with a second-floor program |
| `p_33f1ae9c1dd6` | 1 kanal DHA, Skip the pin, Triple storey, Decide everything |
| `p_0984a5b26e52` | Idioms: "ground + 1" and "road on the south side" |
| `p_d73807089ecc` | A question as the first message (crash) |

> **Heads-up for other testers.** Every tab in this browser shares one guest id (`naqsha.uid`). A home whose brief has no plot crashes `/app` for everyone on that id (issue 1). Both times I caused this, I fixed it straight away by sending "It is a 10 marla plot" to that project's intake endpoint. `/app` loads cleanly again: 17 homes, none broken.

## Verdict

The language understanding is strong:

- One long message fills the whole brief in about 2–5 s, and the agent asks nothing it already knows.
- Corrections land.
- LDA questions get correct answers: 45 ft for 10 marla and above and 38 ft below, both measured to the parapet with the mumty (up to 9′6″) excluded; a basement is allowed; a fourth storey is refused; DHA allows 39 ft (basement, ground and first floor).

The problems are in the plumbing around the agent:

- **Blocker:** a crash that takes down the whole portal when a brief has no plot.
- **"Decide everything for me" never gets past Concepts.**
- **Some controls throw away or invert what the user chose:** Skip the pin, "Don't assume", removing a wish, and saving the floors editor.
- **The per-floor program has gaps:** an extra storey gets no rooms, and the default program for a common 10 marla, 5-bedroom brief is over capacity.

## Issues

### Blocker

**1. A brief without a plot crashes both the project and the whole "Your homes" portal.**

*Repro:* In `/app`, send `house for 5 people in Lahore`, or a question such as `what is the max height I can build in Lahore?`.
- The agent replies correctly.
- The server then saves a brief with `plot: null`.
- The project shows **"This page didn't load"**, and reloading doesn't help.
- `/app` also shows "This page didn't load", so every home on that account becomes unreachable.

*Root cause:* code that assumes the plot is always there.
- `web/src/app/shell/DetailsDialog.tsx:13` reads `b.plot.area_marla` whenever there is a brief, even while the dialog is closed. Console: `TypeError: Cannot read properties of null (reading 'area_marla') at Hk`.
- `web/src/app/workspace/Workspace.tsx:258` uses `p.brief?.plot.width_ft`. Console: `reading 'width_ft' at xC`.

The other Brief components already use `plot?.`. "Start with questions" plus any answer that isn't a plot size will hit the same crash.

### Major

**2. "Decide everything for me" stops at Concepts.**
- The autopilot (`ConceptsView.tsx` around line 124) selects concept A 1.4 s after its image arrives.
- The server only saves concepts once all four are finished (`agents/concepts.py`, `generate()`, the final `db.update_project`).
- So `POST /concepts/c_…/select` returns **404 "concept not found"**.
- The banner "Choosing the strongest concept and drawing the plan for you…" then stays up for good, with no concept selected, no plan and no house.
- Reproduced on `p_33f1ae9c1dd6`.

**3. "Skip the pin" throws away the facing the user picked.**
- On the facing question, tap **E** on the compass. The widget confirms "The front, on the road, faces east."
- Then tap **Skip the pin**, the natural move when you have no map link.
- The widget sends `skip_question`, so Naqsha picks North and says "I've chosen n for the facing."
- The facing question has no plain "Decide for me" either.

**4. The storeys question ignores the authority, so a DHA brief can be 3 storeys.**
- For a 1 kanal plot in DHA Phase 6, the envelope correctly says "max 2 storeys + basement, 39 ft".
- The chips still offer "Triple storey · LDA allows up to 3", and choosing it is accepted ("Three storeys.").
- The brief then holds `storeys: 3` against `envelope.max_storeys: 2`.
- When asked "how many storeys can I build here?", the agent correctly answers basement, ground and first floor, but never flags the 3 it already recorded.
- The concepts then describe a "three-storey facade".

**5. Adding a storey leaves the new floor with no rooms.**
- In a complete 2-storey brief (ground and first floors defined), "actually make it 3 storeys" sets storeys to 3 and completes the setup.
- The second floor has no rooms, and the agent doesn't ask about it. It only offers chips such as "Add a bedroom and lounge on second floor".
- `to_ask` only checks whether `floors` is empty, not whether every storey is covered.

**6. The suggested per-floor program can exceed the floor, and an over-capacity program is accepted.**
- With 10 marla, "ground + 1" and 5 beds, the floors editor opens with all 5 bedrooms upstairs: **"First floor 1,663 of 1,440 sq ft — Too much for the first floor."**
- **Use these floors** stays enabled, and the over-full program is saved without a warning ("Got the rooms for each floor.").

**7. Wishes can be added but never removed.**
- The × on a wish in the brief panel sends a PATCH and gets 200, but the wish comes back.
- `PATCH /api/projects/{id}` runs the brief through `intake.merge_brief`, which appends preferences and never overwrites them.
- Contradictory wishes therefore stick. For example, "open kitchen with dirty kitchen downstairs" stays after "remove the dirty kitchen".
- Reproduced with both one wish and two.

**8. "Don't assume" confirms the assumption instead of dropping it.**
- On the card, under "I assumed · Front faces north", tap × (labelled "Don't assume Front faces north").
- This sends "Don't assume: front faces north."
- The agent replies "Noted, front faces north", the facing stays N, and the token moves to **You said**.

**9. The floors editor deletes rooms it doesn't list.**
- I asked for "Second floor: a gym, a study and an open terrace". The brief stores `second=[gym, study, terrace]`, but the panel shows "Second: Study, Terrace".
- Opening Floors and pressing **Save floors** without changes deletes `gym`.
- The editor's catalogue has no gym, powder room, dressing or kitchenette, although the agent is told it may record them.

**10. On a phone, the dock line covers the widget's last row of buttons.**
- At 375×812, scrolled to the bottom, the active question's **Decide for me** sits under Naqsha's duplicated dock line.
- `elementFromPoint` at the button's centre returns the dock line's span, so a tap opens the conversation sheet instead.

### Minor

11. **Corner versus mid-row is never asked.** Mid-row is assumed silently and shown under **You said**. "5 marla" and "1 kanal in DHA Phase 6" both list "Mid-row" as something the user said. Given the user's complaint about corner plots, it should be asked, or at least shown under "I assumed".
12. **The facing skip shows a raw code:** "I've chosen **n** for the facing." `_ack_skip` (`intake.py:741`) lower-cases the raw value.
13. **The rooms question needs "Decide for me" twice.** On "How many bedrooms, and which rooms do you need?", it only decides the bedroom count ("I've chosen 5 for the bedrooms"). The same floors editor then comes back and needs a second "Decide for me".
14. **Replies describe the next step wrongly:** "move to your initial floor plan concepts", "sketch four layout concepts next", "I will now prepare your initial concepts". The next step is four exteriors, and nothing starts until "Show me concepts" is tapped.
15. **"Make the kitchen open" is suggested after the user already asked for an open kitchen.** The suggestion list is static.
16. **A DHA plot is labelled with LDA:** "What LDA lets you build" and "The blue line is how far LDA lets you build" appear on a DHA Phase 6 plot.
17. **The full "understood" card is re-posted on every turn after completion.** That is about 25 lines per question; the conversation reached 4,400 px after 5 turns. Older cards also render differently, as a Preferences column listing every fact, with duplicates such as "Concrete water tank in the stair tower" next to "…hidden in stair tower".
18. **After a direct plot edit, the latest card mixes old and new data.** It shows "You said 10 marla · 35′ × 65′" next to the stale "Ground coverage within 70% (1,904 sq ft)", which is the 12 marla figure.
19. **The intake error toast shows raw HTML** from Google's 500 page, under "The AI architect couldn't reply". `sse.ts` `errorFromResponse` lacks the `<` guard that `client.ts` `readError` has, and "AI" breaks the voice rules. The 500 itself came from a revision being replaced (latency 0 s); it was not an app error.
20. **The conversation sheet in Brief doesn't show the active floors widget.** It opens from the dock line or ⌘J, and only the docked panel underneath has the widget.
21. **"Start with questions" doesn't ask questions.** It shows the same "One message is enough" prompt with example messages.

### Polish

22. **Accessibility:**
    - Every fact token is announced only as "Tap to correct", without the fact itself.
    - The rows in the brief panel are buttons with no names.
    - The third-storey radio is announced as "LDA allows up to three".
23. **The title doesn't follow the plot:** it still says "10 marla house, Johar Town" after the plot became 12 marla.
24. **Out-of-range sizes in the plot dialog disable Save** ("Pick a size") without saying the limits: 10–400 ft wide, 20–600 ft deep.
25. **The roof reply covers only the tank:** "A blue plastic tank on the stair tower." It doesn't mention the solar frame chosen with it.

## Speed (Cloud Run log, "setup turn …")

- Most turns took 1.4–5.5 s on the server, in one model step.
- Chip and widget answers took about 1.3 s end to end.
- The full rich message took about 5 s, including creating the project.
- One outlier: "make it 4 storeys" took **12.9 s**, also in one step. It was correct but slow. I saw it once, so it isn't in the issue list.

## What works

- **One message fills the brief.** The rich message (10 marla Johar Town, east-facing, mid-row, 2 storeys, parents' bed and bath downstairs, drawing, dining, open kitchen with a dirty kitchen, 3 bed+bath and TV lounge upstairs, concrete tank in the stair tower, roof clear for solar, Modern Contemporary, 2-car porch) went through in one turn with no follow-up questions. Every field and the per-floor program were captured correctly.
- **Corrections:**
  - "actually make it 3 storeys"
  - "change to corner plot": a second road and the splay appear
  - "the plot is actually 12 marla, 40 by 68 ft": new band, 10 ft splay and correct setbacks quoted
  - "remove the dirty kitchen and add a prayer room on the first floor": floors and spaces updated
  - the inline token correction "3 storeys → 2 storeys"
- **Questions:**
  - Max height: 45 ft, or 38 ft for 7 marla, with the mumty excluded
  - Basement: allowed
  - A fourth storey: refused, citing LDA's limit of 3 storeys plus a basement
  - DHA storeys: answered correctly
  - Setbacks for the new plot: answered correctly
  - A general question as the first message: answered correctly (although it then triggers issue 1)
- **Idioms:**
  - "ground + 1" became 2 storeys
  - "road on the south side" became south-facing
  - "neighbours on both sides" became mid-row
  - "plastic tank please, and no solar" filled the roof
- **Widgets:**
  - The floors editor has a storey toggle, a tab per floor including the roof, steppers, and the meter with "Move the study down? Move it to the ground floor".
  - The roof cards offer blue plastic or concrete (marked Recommended), solar kept clear with a panel and kW estimate, and "No domes, minarets or chhatris".
  - The style swatches work, and "Decide for me" on style shows the choice under "I assumed".
- **The understood card:** Guaranteed lists the LDA rules plus the 5 livable rules (bedroom access, a stair reaching the roof, railings, nothing blocking a door). Assumed tokens are dotted, and the latest card's tokens update live.
- **The brief panel:**
  - The plot dialog has presets, validated custom sizes, a corner or mid-row toggle and a live envelope preview.
  - Adding a wish works.
  - The Floors and plot edits save.
- **The envelope diagram:**
  - It is drawn to scale, with ghost neighbours on a mid-row plot.
  - A corner plot shows **Road + Side road + splay**.
  - The north arrow turns correctly with the facing: E to the right, W to the left, S pointing up.
  - DHA plots get DHA's bylaw note.
- **"Decide everything for me"** filled the remaining fields and opened Concepts. The concepts were mid-row with neighbours and showed the blue plastic tank, so the user's corner-plot complaint is fixed. It then stalls (issue 2).
- **Phone width:** no horizontal scroll, and the "Plot and brief" sheet works.
