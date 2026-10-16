# Maket.ai teardown

Tested on 16 Oct 2026 on the free tier, briefed as a Lahore family would brief it. The free tier's 30 credits paid for one plan and one render. Screenshots are in `docs/research/maket/` (numbers in brackets).

## 1. Journey map

| # | Step | What the user inputs | AI time / cost |
|---|---|---|---|
| 1 | **Dashboard** [01] | 4 cards: Generate a plan, Draw from scratch, Upload (locked), Explore images (locked). One click creates a project. | instant |
| 2 | **Chat intake** [03, 05] | Free text. One paragraph (floors, area, plot, rooms, carport) ticked 2 of the 5 checklist items at once. 2–4 floors are locked. | 20–40 s per turn |
| 3 | **Confirm shape** modal [07–11] | Edit the footprint size or area, pick 1 of 8 shapes, place the front door, garage and porch. It read the **plot** as the **house** (4,500 ft²), so I typed 2,200 and it rescaled. | instant |
| 4 | **Confirm rooms** modal [14, 15] | Per-floor tabs with room steppers and a searchable "Add room". Pre-filled from my text, plus a pantry, laundry and walk-in I hadn't asked for; "drawing room" became "Living Room". | ~20 s |
| 5 | **Summary + extras** [18–20] | A card splits **"should be able to do"** (green) from **"best effort"** (amber). Optional extra requirements. | ~30 s |
| 6 | **Generate** [22, 23] | Nothing. Four named stages, from "Drawing plan outline" to "Finalizing layout". | **~2 min, 20 credits** |
| 7 | **Plan canvas** [25, 26] | A furnished 2D plan, an inspector, "What's next" cards and 2 suggested prompts. | — |
| 8 | **3D** [36–44] | Three modes: Isometric, Walkthrough and Massing. | instant, free |
| 9 | **Render scene** [47] | A prompt bar under the 3D view; renders the **current camera**. | **~50 s, 10 credits** |
| 10 | **Export / share** [49, 50] | PDF/DXF and high-res images are paid; a view-only link is free. | — |

From a blank dashboard to a furnished plan took **about 6 minutes and about 8 user actions**, and almost half of that time was spent waiting on chat turns.

## 2. Feature inventory

- **Intake:** chat plus inline structured modals (shape, rooms), a progress checklist on the canvas, and auto-naming ("1-Story Home", "4 beds, 4 baths — 2,200 sqft").
- **2D editor:** furniture clearance dimensions [31]; a room inspector with area, dimensions, room type and "Furnish room" [32]; **Move mode**, a labelled room-bubble diagram where dragging one room onto another **swaps** them and re-furnishes both [62, 64], with a red banner for invalid moves [58]; draw walls, palettes, wall thickness, units, snap, undo/redo and **autosave**.
- **Style:** 9 Western presets as image cards (one listed twice) and per-floor finishes [55, 56].
- **3D:** Isometric, Massing (white boxes) and Walkthrough with drag-look, keyboard movement and a **minimap with a view cone** [38, 39].
- **AI edits by chat:** it breaks a request into steps and **quotes the cost first** ("2 steps, 5 credits each. Should I proceed?"). Editing is paid only [52, 53].
- **Projects:** a project page with sections, floor plans and renders, with rename and delete.
- **Collaboration:** a **view-only public link and nothing else**. No comments, no team members or roles, no client view. Account settings cover only profile, password and billing.
- **Exports:** PDF, DXF and high-res renders, all paid. No glTF, no print layout and no compliance report.
- **Pricing:** Free (30 one-time credits, single floor); Homeowner $20/mo or $17 annual (300 credits, multi-floor, AI editing, upload, exports); Pro $100/mo or $83 annual (3,000 credits, human-validated upload, custom templates); Scale (custom, API). A plan or upload costs 20 credits, a render 10, an edit 5; top-ups exist.

## 3. What they do genuinely well (match or beat)

1. **Two panes, and the canvas is never empty.** Chat on the left; the right shows the checklist, then the generation stages, then the plan. There is **no stage bar**, only a breadcrumb (`Project / Plan`).
2. **One message can answer several questions;** the checklist ticks everything your paragraph covered.
3. **Structured editors inside the conversation:** shape and rooms are direct-manipulation modals, not Q&A.
4. **Honest expectations.** The "should be able to do" vs "best effort" card is the best pattern in the product.
5. **Costs are clear before you act:** credits in the header, and the agent quotes the cost and waits for a yes.
6. **Named progress stages** make the 2-minute wait feel shorter.
7. **"What's next" cards and suggested prompts** after every result, so there is never a dead end.
8. **Drag-to-swap rooms with automatic re-furnishing.**
9. **The walk minimap with a view cone.**
10. **Renders start from your own camera,** so they stay faithful to the geometry.
11. **Calm visuals:** warm off-white, a dotted canvas, one blue accent, pill controls and lots of white space.

## 4. Weaknesses and friction

- **No idea of the plot.** It took the plot size as the house size. The house plus its garage is **59'6" wide on a 50 ft plot**, and the total is **2,843 ft² (with garage and porch) against the 2,200 I asked for**, with no warning. There are no setbacks or by-laws, and its own FAQ says designs are not ready to build.
- **"Best effort" mostly meant ignored:** the kitchen is open-plan, the "Formal Drawing Room" is an unwalled zone, the guest bath is among the bedrooms, one bedroom has no attached bath, and the garage is detached.
- **No room labels on the default plan.** They appear only in Move mode, where raw IDs leak ("front_porch").
- **US-centric:** mudroom and mechanical room, but no drawing room, servant quarter, store, prayer room or dirty kitchen; imperial units and Western styles.
- **Slow, slightly incoherent chat** (20–40 s a turn). It said "let's generate" and then asked for the shape.
- **The chat dies at 0 credits.** Even "will it fit my plot?" gets an upgrade prompt, shown only *after* it asks me to confirm the cost.
- **The walk is rough:** it spawns in the garage with cars blocking the view, there is no collision (I walked through a wall), and clicking the minimap only turns you.
- **Single floor on free, and no stairs anywhere.** "Add floor" gives an empty canvas.
- **Small manual moves often fail** with a vague error.
- **The exterior is a white box;** facades exist only in renders.
- **No collaboration** beyond a view-only link.

## 5. Recommendations for Naqsha (prioritised)

**P0: before the 18 Oct demo**

1. **Read the brief once, then confirm it visually.** One message fills the whole brief (plot, corner, facing, floors, rooms per floor, tank, solar), followed by a **"Here's what I understood" card** with *Guaranteed* (LDA and layout rules) and *Preferences* columns. Maket promises "best effort"; we **guarantee and prove it**.
2. **Add hard layout rules to the LDA fix loop and show them passing:** bedrooms open only to a corridor, lounge, balcony or their own bath; stairs run continuously to the roof mumty; every stairwell edge has a railing; no furniture in a door swing. Show a "14/14 checks passed" list beside the plan, which turns the user's top three bugs into a selling point.
3. **Draw the plot first.** The LDA envelope appears before any layout and the plan can never exceed it. Maket put a 59.5 ft-wide footprint on a 50 ft plot.
4. **Put editors inside the chat, not only questions:** a plot card; **per-floor tabs with room steppers** using a Pakistani catalogue (drawing room, TV lounge, dirty kitchen, servant quarter, store, prayer room), which answers "what goes on each floor"; and chips for the tank (plastic or concrete) and rooftop solar, with the roof kept clear by default.
5. **Remove the stage bar.** Use a two-pane shell (conversation plus an always-live canvas), a project/version breadcrumb, "What's next" cards after every agent turn, and one accent colour on warm neutrals.
6. **Make the walkthrough feel like a game:** spawn at the front door facing in; collision and pointer-lock mouse look; a minimap with a view cone; a **room selector that glides you** from where you stand to the chosen room; a hide-cars toggle; floor toggles that move you to that floor's stair landing.
7. **Stream named stages** (Reading the plot → Laying out floors → Checking LDA → Building 3D → Furnishing) with partial results.

**P1: right after**

8. **Revise is our edge.** Before applying, show what will change and which comments it resolves; afterwards, show before/after. Never let the conversation dead-end.
9. **Drag-to-swap rooms in 2D** with an automatic LDA re-check and re-furnish; explain rejections with room names, never IDs.
10. **Collaboration that Maket lacks entirely:** a share link with a role (*View* or *Comment*) where clients comment with just a name; team members sign in with Google; comments are pinned in 2D and 3D and can be resolved.
11. **Print / Save as PDF:** dimensioned plans per floor, a room schedule, the LDA report and the chosen concept.
12. **Concepts:** a day/night pair per concept, a corner plot only when selected, and a minimal roof.

**P2**

13. **Landing page:** a large headline, a house-under-construction animation, business outcomes (LDA-approved first time, walkable in minutes, family signs off by phone) and a **Portal** button.
14. **Auto-name projects and versions** ("1 kanal, 5 bed, v2 — kitchen enclosed"), as Maket does.
