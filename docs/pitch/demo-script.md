# Demo video script (under 3 min). Draft for review

Kept consistent with the deck (docs/pitch/naqsha-deck.pdf): no "half rejected" or "approval-ready" claims, 42–50 checks, 12–17 s for concepts, about 7 min for a full design.

**Setup.** Screen-record at 1440×900, in a fresh guest workspace on the live URL. Use a sample home for the 3D steps, so nobody waits the ~7 minutes of a full design run on camera.

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:15 | Workspace hero | "In Lahore, building a house starts with a naqsha, the plan. Families wait weeks for drafts, and every resubmission to LDA pays the scrutiny fee again. Naqsha turns an idea into a walkable 3D home, checked against LDA rules before an architect stamps it." |
| 0:15–0:40 | New project → setup chat. Tap Lahore · LDA, then 10 marla; the **envelope diagram** appears. Tap "Skip — design it for me". | "Naqsha asks one-tap questions. The moment we pick the plot, it shows what LDA lets us build: setbacks, 70% coverage, 45 feet, 3 storeys. We can skip the rest, and it chooses sensible defaults." |
| 0:40–1:00 | Concepts stream in, then pick one and remix "more wood" | "Gemini 3.1 Flash Image paints four photoreal concepts in parallel, in twelve to seventeen seconds. Pick one, remix it in plain words." |
| 1:00–1:30 | Design timeline: plan, then **"Argon fixed 5 → 1 → 0 LDA violations"**; floor plan and compliance panel; code sections streaming | "Gemini 4 Argon lays out the floors. Our deterministic LDA engine runs 42 to 50 checks, from setbacks to the 8% daylight rule, and Argon fixes its own violations until everything passes. Then Argon writes the 3D model as code against our House SDK, section by section." |
| 1:30–2:05 | Explore: house assembles layer by layer; orbit, floor toggles, sun slider; **Render this view**, then walk mode through the porch into the lounge and up the stairs | "The model assembles layer by layer: structure, facade, interiors, furniture, landscape. Then walk through it like a game." |
| 2:05–2:35 | Press C on the master window: "make this bigger". On the porch: "extend 4 ft into the lawn". Press F to finish. | "Leave comments anywhere. When we finish the walkthrough, a Google ADK agent with nine tools reads only the rooms and code it needs, dry-runs each change against the LDA rules, and revises." |
| 2:35–2:55 | Revisions: window resolved; porch **Not possible** with the LDA reason and alternatives; before/after | "The window is enlarged and still compliant. The porch extension is refused: it would break the 10-foot front setback, and the agent suggests alternatives." |
| 2:55–3:00 | Architecture slide / logo | "Naqsha. Gemini 4 Argon, ADK, Cloud Run and Firestore on Google Cloud." |
