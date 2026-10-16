# Naqsha (working name): from an idea to a walkable, LDA-compliant 3D home

*naqsha* (نقشہ) is what Pakistani families call a house plan.

## 1. Customer journey: what makes it better than maket.ai

| # | Step | What the user sees | Engine |
|---|---|---|---|
| 1 | **Workspace** | A projects grid with live thumbnails and status chips (Setup, Concepts, Design, Walkthrough, Revised). A guest workspace is the default; Google sign-in is a stretch. | Firestore |
| 2 | **Setup agent** | A chat with one-tap chips for city/scheme, plot (5/7/10 marla, 1/2 kanal or custom W×D), corner plot, floors, bedrooms, baths, drawing room, TV lounge, kitchen and dirty kitchen, servant quarter, car porch, style and budget. A **map pin is optional**. A **"Skip — design it for me"** button is on every step. Once the plot is known, the **LDA buildable envelope** shows immediately. | ADK `intake_agent` (gemini-3.8-flash) + `lda_envelope` tool |
| 3 | **Concepts** | 4 photoreal exterior concepts appear in parallel (about 11 s each). The user picks one and can remix it. | `gemini-3.1-flash-image` (hero shots: `gemini-3-pro-image`) |
| 4 | **Plan (naqsha)** | Argon lays out levels, rooms, doors, windows and stairs. The LDA engine checks the layout and Argon fixes it in a loop. The user sees **2D floor plans with dimensions** and a **compliance report**. | `gemini-4-argon` structured output + Python LDA engine |
| 5 | **Build** | Argon writes the 3D model **as code** against the House SDK, guided by the chosen concept image. It streams in **layers**: structure → facade → interiors → furniture → landscape. | `gemini-4-argon` code generation + House SDK (three.js) |
| 6 | **Explore** | Orbit view, floor toggles, layer toggles, section cut and a sun/time slider. **"Render this view"** turns a screenshot into a photoreal image. | three.js + gemini image model (image to image) |
| 7 | **Walkthrough** | First-person WASD and mouse, with collision and stairs. Press **C** to pin a comment on any surface; it is auto-tagged with room, element and level, plus a screenshot crop. | three-mesh-bvh |
| 8 | **Revise** | "Finish walkthrough" makes Argon turn the comments into a change list. It patches the plan and the code sections, the LDA engine re-checks, and the user gets **v2** with "what changed", a before/after view and a per-comment resolution. If a comment would break LDA rules, the user gets an explanation and a compliant alternative. | ADK `revision_agent` (`gemini-4-argon`) |
| 9 | Stretch | A compliance report PDF, floor plan export, glTF download and a share link so family can comment. | — |

Maket's own FAQ says its designs are not ready to build and must be checked against local requirements. Built-in LDA compliance is our wedge.

## 2. How Argon designs in code

The spike (`docs/spikes/`) showed that Argon can write a whole three.js house in one pass, but the result was blocky and took 8 minutes. We therefore split the work into two stages.

**Stage 1: Plan.** Argon emits a `BuildingPlan` JSON constrained by a schema (`contracts/plan.ts`). It is small and checkable:
- Levels, room rectangles in **feet** (plot-local coordinates), openings as points on room edges, stairs, roof, mumty, boundary wall and gate.
- The LDA engine checks: setbacks/envelope, coverage, FAR, height (≤38/45 ft), storeys (≤3), room ≥100 sq ft and ≥8 ft wide, kitchen ≥50 sq ft and ≥6 ft wide, clear height ≥9'6", glazing ≥8%, stairs ≥3'6" wide with risers ≤7.5" and treads ≥10", baths with an external opening, and projections.
- On failure, the violations go back to Argon, and the loop stops after 3 tries.

**Stage 2: Build.** Argon writes `design.js`: an object of **named sections** that call the House SDK (`contracts/house-sdk.d.ts`).
- The SDK builds the structure from the plan: walls with real openings, frames, glass, slabs, stairs, parapets, mumty and boundary wall.
- It also provides PBR materials, a parametric furniture kit, landscape and lighting, plus raw `THREE` for bespoke facade pieces.
- Every object is tagged `{layer, level, room, kind, id}`. That drives layer toggles, comment anchors, and the as-built check (no facade element may project into a setback).
- Sections run in order, and the viewer renders after each one, so the user watches the house assemble.
- **Edits replace whole sections** (for example `furnish_g_lounge` or `facade_front`), which keeps revisions fast and low-risk.

## 3. System on Google Cloud

```
Browser (React SPA: Vite + TS + Tailwind + react-three-fiber)
   │  REST + SSE (/api/*)
   ▼
Cloud Run "naqsha" (FastAPI; serves the SPA and the API)
   ├─ Google ADK agents
   │   ├─ intake_agent    (gemini-3.8-flash)       tools: lda_envelope, update_brief
   │   ├─ concept step    (gemini-3.1-flash-image, 4 in parallel)
   │   ├─ planner         (gemini-4-argon, JSON schema)  ⟲ check_compliance (≤3)
   │   ├─ builder         (gemini-4-argon, streamed design.js sections)
   │   └─ revision_agent  (gemini-4-argon)          tools: check_compliance
   ├─ LDA compliance engine (pure Python; rules JSON from docs/research)
   ├─ Firestore: projects, messages, concepts, versions, comments
   └─ Cloud Storage: concept images, renders, snapshots
Vertex AI: Gemini on the `global` location (the newest models are only served there)
Service account: agent-runtime@…  (aiplatform.user, datastore.user, storage.objectAdmin)
```

- **One service, one URL.** There is no CORS to manage, and deployment is a single `gcloud run deploy --source .`.
- **Streaming.** SSE events are typed (see `contracts/api.md`).
- **Code safety.** `design.js` runs in the user's own browser. Before execution it is statically screened: no `fetch`, `XMLHttpRequest`, `WebSocket`, `import()`, `eval`, `document.cookie` or storage APIs. Hardening it into a sandboxed iframe is a stretch item.

## 4. Repo layout

```
contracts/      plan.ts (source of truth), house-sdk.d.ts, api.md, fixtures/
web/            Vite React app
  src/engine/   House SDK implementation + materials/furniture/structure builders
  src/viewer/   Scene host, orbit/levels/layers/section, walkthrough, comment pins
  src/app/      Workspace, setup chat, concepts, plan view (2D SVG), compliance panel, revisions
  src/api/      API client + SSE helpers
api/            FastAPI + ADK
  app/agents/   intake, concepts, planner, builder, reviser
  app/compliance/  lda.py + lda_rules.json
  app/store/    firestore.py, gcs.py
Dockerfile      multi-stage: build web, then a Python runtime serving the API and static files
docs/           ARCHITECTURE.md, research/, spikes/
```

## 5. Build order (deadline: prototype submission on 18 Oct)

1. Contracts + scaffold. **Then in parallel:**
   - **Engine:** the House SDK and its fidelity.
   - **Viewer:** walkthrough and comments.
   - **App shell:** the UI.
   - **Backend:** agents, compliance and storage.
2. Integrate, run end to end on a 10-marla brief, then deploy to Cloud Run.
3. Polish the journey (informed by the maket.ai teardown), the demo video (under 3 min), the deck, and make the repo public.
