# Naqsha demo footage: shot list

Captured on 17 Oct 2026 from the live app, https://naqsha-242926648187.us-central1.run.app (Cloud Run). Every frame is the real, deployed product. Nothing is mocked.

**Format.** MP4, H.264, 1920×1080, constant 30 fps, CRF 16. Recorded in headed Google Chrome with GPU WebGL (ANGLE Metal, Apple M2 Pro), viewport 1920×1080 at deviceScaleFactor 1, through CDP `Page.startScreencast` (JPEG q92), then resampled on the wall clock to a constant 30 fps. A drawn cursor (arrow plus click ripple) is overlaid; it is hidden for orbit and walk camera moves. Typing uses human-like delays.

**Timestamps** are seconds into each clip. Every clip also has a machine-readable `<clip>.marks.json` with the same marks.

**Jump cuts.** Clips marked "continuous" are single unbroken takes. In the others, the recorder paused while the next step was scripted, so a hard cut appears at a step boundary. Each clip notes where.

**"REAL / LIVE" chip.** Every clip is the working product. The strongest moments to label as live are the real AI runs: **b** (setup agent), **c** (image generation), **d1** (Argon design run, real time), **e** at 100.9 s (AI render), **h** (ADK revise agent) and **i** (typed change).

---

## a_landing_hero_to_portal.mp4: 51.7 s (continuous)
The landing page. Replays the house-under-construction animation, scrolls slowly through the page and clicks Portal.
| t | moment |
|---|---|
| 0.0 | Hero: "Walk through your home before the first brick." |
| 4.8 | The construction frame scrolls into view |
| 9.9 | Click **Replay**: plot and LDA envelope, plinth, columns, walls floor by floor, stair, railings, solar and tank, windows (about 10–15 s) |
| ≈16–19 | The drawing wipes into the rendered home, which turns to night |
| 21.7 | Benefits: "Everything between the plot and the contractor" (6 cards) |
| 28.4 | How it works: Brief · Concepts · Plan · House |
| 35.1 | Sample homes (10 marla, 1 kanal villa) |
| 41.3 | "For builders and architects" band |
| 47.9 | Click **Portal**, which opens Your homes |

## b_setup_one_message.mp4: 68.7 s (continuous) · LIVE: Google ADK setup agent on Gemini 3.8 Flash
A new home from ONE typed message (10 marla, Johar Town, mid-row, facing north, 2 storeys, 4 bedrooms…, blue plastic tank, roof ready for solar, modern contemporary).
| t | moment |
|---|---|
| 4.0 | Typing starts in "Start a home" |
| 18.4 | Enter; the Brief opens ("Reading what you said…") |
| 22.3 | **"Here's what I understood"** card, the brief and the **LDA buildable envelope** (agent reply about 3.6 s after send) |
| 29.4 | Conversation scrolled up to the one message |
| 33.8 | Back to the card: You said · Guaranteed (LDA setbacks, coverage, storeys, livable rules) · Preferences |
| 37.5 | Cursor on the plot to scale with the buildable rectangle (28′ × 48′, 1,440 sq ft a floor) |
| 41.2 | "Your brief": floors, roof (**blue plastic tank, roof kept clear for solar**), wishes |
| 44.9 | "What LDA lets you build": 70% coverage, FAR 1:2.8, setbacks |
| 49.8 | **Per-floor editor** ("Rooms on each floor") opens on First |
| 54.7 | Ground tab |
| 59.7 | Roof tab (stair tower) |
| 66.6 | Cursor on "Show me concepts" |

## c_concepts_day_night.mp4: 82.6 s (continuous) · LIVE: Gemini 3.1 Flash Image
The same project as b. Four concepts drawn in real time, Day/Night, and one opened.
| t | moment |
|---|---|
| 3.3 | Click "Show me concepts"; 4 shimmering tiles ("Drawing four exteriors…") |
| 16.4 | Concepts A and B arrive (about 13 s after the click) |
| 16.9 | Concept C arrives |
| 25.9 | Concept D arrives (all 4 in about 23 s, same camera and light) |
| 31.9 | Scroll to C and D |
| 39.5 | Toggle **Night**: "Turning the lights on: the same views, at night." |
| 47.7 | Night images crossfade in (all 4 together) |
| 54.5 | Night C and D |
| 62.1 | Back to Day |
| 67.0 | Open concept A ("Framed stone portals") in the lightbox |
| 71.7 | Lightbox Night |
| 76.4 | Lightbox Day |
| 81.5 | Cursor on "Plan this one" (continues in d1) |

## d1_design_run_realtime.mp4: 283.5 s (continuous, REAL TIME, uncut) · LIVE: Gemini 4 Argon architect
The whole design run, from the click to the saved version. The cursor is hidden. The run card at the top shows Plan · Check · Review · Build, a narration line and the clock; the fix loop counter sits under it. The plan sheet draws itself and highlights failing rooms in red while it fixes them. Speed it up 8–15×.
| t | moment (run card) |
|---|---|
| 0.7 | Click **Plan this one**: the run starts |
| 3.1 | "Laying out the floors" (Plan) |
| 54.1 | Plan drawn and checked: **"Fixing 15 issues"** (Check; failing rooms in red) |
| 104.6 | **"Fixing 5 issues · Fixing 15 → 5"** |
| 157.5 | **"Reviewing it like an architect · Fixed 15 → 5 → 0"** (Argon reviews a drawing of its own plan) |
| 178.1 | **"Building the house in 3D · 2 parts"**: design.js streams section by section |
| 196–270 | Parts climb 6 → 13 → 21 → 26 (28 sections in all; see assets) |
| 277.2 | Version saved: the dimensioned ground-floor plan, "36/36 LDA · 10/13 livable · 3 to check", and the "Walk through it" pill |

## d2_plan_compliance_print.mp4: 84.1 s (one jump cut at about 44.6 s)
The plan from the real run (d1): floors, the compliance panel and print.
| t | moment |
|---|---|
| 1.1 | Ground-floor plan, dimensioned, hover tooltip on the TV lounge |
| 6.5 | First floor |
| 11.4 | Roof (stair tower, blue plastic tank above, area clear for solar) |
| 16.2 | Ground floor again |
| 20.3 | **Compliance panel**: "Passes all 36 LDA checks. 3 livable points to check." Coverage 63.3%, FAR 1:1.05, height 27′, 2 storeys, "Fixed while drawing 15 → 5 → 0" |
| 25.8 | Expand **Setbacks and envelope 11/11** (front 10′, rear 7′, side space, coverage, FAR, height, mumty, parapet…) |
| 33.1 | Scroll to the **Livable home** group (rooms independent, stairs reach the roof, roof door at the stair top, railing at every drop, clear paths…) |
| 40.5 | Click a livable point; "Shown on the plan" highlights it |
| ≈44.6 | *(jump cut)* |
| 49.5 | **Print**: A3/A4, floors, cover and compliance report |
| 55.5 | **Print preview**: 6 sheets at 1:100 |
| 61–77 | Sheets 2–6 (floors with title block and room schedule, compliance report) |
| 82.2 | Close |

Note: the panel's first line reads "Approval-ready". The demo script asks not to zoom on that or read it out. This real run scored 36/36 LDA with 10/13 livable (3 advisory "to check": two bath shapes, roof clearance). Only the sample home shows 37/37 · 10/10.

## d3_live_house_first_look.mp4: 59.5 s (jump cuts at about 12.8 s and 34.6 s)
The house that Argon just wrote (from d1/d2) opened in 3D. The design.js layers assemble in the browser.
| t | moment |
|---|---|
| 3.3 | Click **House**: "Assembling your home · Dressing the facade · 3 of 28 layers" (house builds up layer by layer) |
| 12.6 | Built: blue tank, stair tower, wooden screens |
| ≈12.8 | *(jump cut)* |
| 13.0 | Slow orbit (neighbours ghost when in front) |
| ≈34.6 | *(jump cut)* |
| 35–57 | Orbit continues round to the front |

## e_sample_orbit_night_render.mp4: 138.0 s (continuous) · LIVE at 100.9 s: "Render this view" (AI)
On a copy of the **10 marla sample** (opened from Samples).
| t | moment |
|---|---|
| 0.4 | House view loads ("Assembling your home") |
| 9.2 | Built: day hero view |
| 11.0 | **Slow 360° orbit**: neighbours ghost as the camera passes them |
| 37.6 | Orbit complete |
| 42.2 | View menu (light, layers, cut away, Render this view) |
| 46.3 | **Night**: interiors, garden and street lights |
| 52.7 | Gentle night orbit (left, then right) |
| 76.6 | Back to Day |
| 81.5 | **Cut away**: see inside the ground floor |
| 87.7 | Cut height raised: first-floor interiors |
| 96.7 | Cut away off |
| 100.9 | **Render this view**: AI photoreal render of this exact viewport ("Rendering Ns") |
| 110.4 | **Render arrives** (about 9.5 s) |
| 115.3 | Drag the compare line: 3D view against the AI render, both ways |
| 136.2 | Close |

## e_alt_take1_night_orbit_render.mp4: 149.4 s (alternate take, several jump cuts)
The same beats, but the 360° orbit is **at night**. Its render comparison is framed more tightly on the porch and facade. Use it for b-roll or a night orbit. Marks are in its json.

## f_walk_like_a_game.mp4: 111.7 s (continuous)
First-person walk through the 10 marla sample. Pointer lock isn't granted to automation, so the app's drag-to-look fallback drives mouse look (the cursor is hidden). Movement uses W and the room navigator (M).
| t | moment |
|---|---|
| 4.6 | **Walk**: the camera flies down to the front door |
| 9.1 | Look around at the entrance (left, right) |
| 23.3 | Walk in (W) |
| 25.9 | Look around the TV lounge and dining |
| 48.9 | **Room navigator (M)**: type "master bed" |
| 51.4 | **Glide** up to the master bedroom (first floor) |
| 56.9 | Look around the master bedroom (balcony doors, wood panelling) |
| 72.8 | Navigator: "stair", glide to the foot of the stair |
| 79.7 | Stair with handrail and **glass guard (railing)**, tilt to see it |
| 85.7 | Navigator: "roof"; **climbs the stairs** (≈86–90) and **steps out of the roof door** (≈90–92) |
| 92.2 | On the roof: turn round to the roof door, stair tower and **parapet railings** |
| 107.1 | Walk out across the roof (W) |

## g1_owner_pin_comment_and_share.mp4: 64.7 s (jump cuts at step boundaries: ≈21, 28, 39, 51, 60 s)
The owner pins notes and shares the home.
| t | moment |
|---|---|
| 1.5 | Walk: navigator to Bedroom 3 |
| 9.3 | Look at the window |
| 13.2 | Press **C**: the note is anchored to "Window glass in bedroom 3, first floor", with a snapshot and suggestions |
| ≈14–17 | Types **"Make this window bigger"** |
| 17.7 | Note posted: pin 1 on the window |
| 24.6 | Back to Orbit |
| 32.1 | Comment mode in orbit |
| 38.6 | Click the porch: "Floor on the car porch, ground floor" |
| ≈39–43 | Types **"Extend the porch 4 ft into the front lawn"** |
| 43.0 | Porch note posted (pin 2) |
| 49.2 | **Share** dialog |
| 54.1 | **Client link** switched on ("Anyone with the link can view and comment") |
| 58.5 | **Copy link** ("Link copied") |

## g2_client_link_comment.mp4: 40.0 s (continuous, SECOND browser context, a different guest with no account)
The client opens the shared link and leaves a note with her name.
| t | moment |
|---|---|
| 0.3 | Client opens `/s/<token>`: "Shared with you · You can comment" (house assembles) |
| 10.2 | Client sees the house with the owner's 2 pins; "Approve v3" pill |
| 17.1 | Client switches to Walk |
| 23.7 | Navigator: "open kitchen", glides in |
| 29.7 | Press C: note on "Open kitchen walls"; **"Your name"** asked once and typed as **Ammi** |
| ≈33–35 | Types **"Can the kitchen be bigger?"** |
| 35.9 | Posted. The Comments sheet shows **Ammi · Client** next to the owner's notes |

## g3_owner_sees_client_comment.mp4: 22.5 s (one jump cut at about 19.5 s)
Back in the owner's window, the client's note has arrived without a reload.
| t | moment |
|---|---|
| 2.0 | Comments badge now **3**; pin 3 sits in the kitchen |
| 6.7 | Comments sheet: notes grouped by place, with names and roles |
| 12.9 | Filter **Client**: "Ammi · Client: Can the kitchen be bigger?" |
| ≈16 | Filter All |

## h_revise_from_comments.mp4: 416.5 s (the agent run 14.6–332.8 s is continuous REAL TIME; cuts before it and between the later steps) · LIVE: Google ADK reviser (Gemini 4 Argon, 9 tools)
| t | moment |
|---|---|
| 5.0 | **Revise with 3 comments**: "Choose what to change" lists all three, the client's included |
| 10.6 | All 3 ticked (window, porch, Ammi's kitchen) |
| 14.6 | **Revise**: the agent starts. The conversation sheet's "Your changes" feed and the top status narrate it ("Reading your 3 notes…", "Looking at Bedroom 3, Rear Terrace, Car Porch…", "Checking the change against the LDA and livability rules…", "All 47 checks pass", "Updating the furniture in…", "Saving the revised version…") |
| 332.8 | **Version 4 saved** (the run took about 5:18 on the agent clock); "Changes" summary in the feed |
| 342.0 | The feed and its 3 changes, close up |
| 349.8 | **What changed** opens the Version 4 page |
| 360.3 | "How Naqsha made it": the timed agent log, ending in "Make this window bigger": **Done** · "Extend the porch…": **Not possible** (red) · "Can the kitchen be bigger?": Done |
| 364.6 | **Wipe the plan before and after**: the Bedroom 3 window, first floor |
| 376.8 | Ground floor: open kitchen widened 7′6″ → 9′ (changed rooms outlined) |
| 391.0 | **What changed**: window 6′ → 9′ wide; "Kept the car porch behind the mandatory 10′ LDA front setback line…"; kitchen +23 sq ft with each room's delta |
| 399.6 | "Your comments": Naqsha's resolutions in each thread |
| 403.2 | **REFUSAL: "Not possible".** "…LDA regulations require a mandatory 10′ front open setback and do not allow porches to project into the front lawn… we can extend the porch inward into the Drawing Room instead…" |
| 411.0 | Ammi (Client): **Done**, kitchen 9′ × 15′3″ (137 sq ft) |

## i_ask_bar_typed_change.mp4: 239.3 s (one big cut at 48.0 → 53.1 s; the middle of the run removed) · LIVE: conversational revision
| t | moment |
|---|---|
| 4.1 | Click the Ask bar ("Tell Naqsha what to change…") |
| ≈4–7 | Types **"Make the kitchen bigger"** |
| 7.0 | Enter: "Working on 'Make the kitchen bigger'" and "What Naqsha is doing" (Version 5 · in progress) |
| 48.0 | *(cut: the run was 0:40 into the agent clock)* |
| 53.1 | Resumes about 7:40 into the agent clock: the timed log (looking at rooms, checking rules, "All 47 checks pass", redrawing furniture) |
| 206.5 | **Version 5 saved** (about 10 min end to end for this typed change) |
| 213.6 | "Version 5: make the kitchen bigger": Naqsha's answer (kitchen 9′ → 10′ × 15′3″, "37/37 LDA · 10/10 livable", and it says what it took from the parents' bedroom) |
| 219.6 | Wipe before and after on the ground floor |
| 231.4 | Scroll through "How Naqsha made it" |

## Bonus b-roll
- **x_bonus_villa_orbit_day_night.mp4: 70.0 s (continuous).** A copy of the **1 kanal Spanish villa** sample. 3.2 open · 14.7 built (tiled roofs, rooftop **solar panels**) · 16.7 slow 360° day orbit · 50.8 Night · 55.7 night orbit.
- **y_bonus_after_revision_walk.mp4: 32.7 s (continuous).** Walking Version 5 after the revisions. 3.3 glide to Bedroom 3 · 11.3 the enlarged window (9′ × 5′6″) · 17.9 glide to the widened open kitchen.

## assets/ (real outputs of this capture, for motion graphics)
- `live_run_concept_{A,B,C,D}_{day,night}.png`: the 8 concept images Gemini generated in clip c (A Framed stone portals, B Brick and screen, C Floating upper box, D Stepped garden terraces).
- `live_run_v1_design_sections.json`: the **28 design.js sections Argon wrote** in clip d1 (structure, facade_*, interior_main, furnish_* per room, landscape, lighting) with their code. Use it for an on-screen "3D written as code" graphic.
- `live_run_v1_compliance.json`: that run's compliance report.

## Timing facts seen in this capture (for captions)
- Setup agent reply: about 4 s. Four concepts: 13–23 s. Night set: about 8 s. AI render: about 9.5 s.
- Design run (10 marla, 2 storeys): **4 min 37 s** from the click to the saved version, with a fix loop of 15 → 5 → 0.
- Revise from 3 comments: **about 5 min 18 s** (not the 70 s quoted elsewhere). Typed "make the kitchen bigger": **about 10 min**.

## Cleanup done
The client link was switched off (the `/s/<token>` URL now returns 404). Every test project in the recording workspace was deleted through the API: the live-run project, the 10 marla and villa sample copies, and two discarded first takes. The two public samples are untouched.
