---
workflow: general-video
flow: automation
storyboard: no
message: "Naqsha is an agentic home design studio on Google Cloud: agents turn one message into a plan checked against the building authority's bylaws, a furnished 3D home to walk through, and revisions from comments."
destination: hackathon-submission
aspect: 1920x1080
fps: 30
language: en
audience: "AI Builder Cup 2026 judges (Google Cloud), watching a 3–4 minute demo of a working prototype"
length: 3:15-3:59 (hard cap 4:00)
angle: product walkthrough, real footage first, motion graphics as connective tissue
track: "Future of Work & Enterprise Productivity"
---

## Intent

A professional SaaS walkthrough of Naqsha (نقشہ, "house plan") for hackathon judges. Real footage of the
deployed product dominates and proves it works; motion graphics carry the hook, the title, chapter cards,
AI attributions, stat hits, an architecture diagram and the outro. Confident, calm, premium; the brand is
the app's own "Calm" system: limestone #F6F6F3, ink #111113, one cobalt accent #2747F5, Geist.
Every real-footage segment carries "● LIVE · real product" top-left, plus "sped up N×" when time-lapsed.
Motion-graphic segments carry no chip.

The user's words: "make it like a proper SaaS walkthrough with very good editing and some motion graphics…
explicitly label actual solution working as a highlight / chip… covers all the main features — has the oompf
factor — and can win over the judges." Also: "highlight which track it is, and how we are disrupting work for
which industry."

## Assets

- ../footage/*.mp4 — 16 real 1920×1080/30 fps silent screen recordings of the live app (shotlist.md, *.marks.json).
- ../footage/assets/live_run_concept_{A..D}_{day,night}.png — the 8 real concept images from clip c.
- ../footage/assets/live_run_v1_design_sections.json — the 28 design.js sections Gemini 4 Argon wrote in clip d1.
- ../footage/assets/live_run_v1_compliance.json — that run's compliance report (36/36 LDA, 10/13 livable).
- web/public/favicon.svg (repo) — the Naqsha mark; wordmark = "Naqsha" Geist 600 −0.03em + نقشہ Nastaliq at 70%.

## Customizations

- Voiceover (v2): gemini-3.8-flash-tts on the Gemini Developer API, prebuilt persona voice hi-in-csagent-11 (chosen by
  the user from voice/audition/hi-in-csagent-11.mp3), one fixed Pakistani-English founder style for every line
  (scripts/gen_vo_v2.py). Music bed generated with Lyria 2 (lyria-002) on the Vertex project; carved under the voice.
- Speed ramps over waits, punch-ins on key UI moments, footage framed as a floating app window on limestone.
- Stat hits (truthful to the capture): 4 concepts in ~23 s; fix loop 15 → 5 → 0; 36/36 LDA on the live run;
  37/37 LDA · 10/10 livable on Version 5; AI render in ~9.5 s; design run 4 min 37 s.
- Track badge "Future of Work & Enterprise Productivity"; industry line "Residential design and bylaw compliance
  for Pakistan's construction industry, then worldwide"; outro with the live URL and github.com/abdm693/hack2skill-hackathon.

## Decisions made during the build

- Voice: gemini-2.5-pro-tts, prebuilt voice Charon, directed "warm, confident, brisk" delivery (Vertex, ADC);
  13 lines, loudness-normalised to −16 LUFS. gemini-3.8-flash-tts on Vertex speaks style directions aloud and its
  Interactions API is not enabled on Vertex, so 2.5 Pro was used. Script: scripts/vo_lines.json.
- Music: five Lyria 2 clips (lyria-002, Vertex) in related keys at 110 BPM (hook in C# minor → E major bed →
  B major → G# minor breakdown under the architecture → E major finale), bar-aligned loops (scripts/build_bed.py),
  carved under the voiceover group at strength 0.7. SFX: Pixabay-licensed set bundled with media-use.
- Stat hits changed for truth: "23 s" for four concepts (not "about a minute"); no "70 s" revision claim — the
  reviser time-lapse shows its real agent clock (5:18) and the typed change is labelled "agent run cut · ~10 min".
- >10× time-lapses (d1 design run, h revise run) use decimated proxies from scripts/prep_timelapse.py.

## Decisions made in the v2 re-edit (17 Oct 2026)

- Script v2 (scripts/vo_lines.json, 14 lines, user-approved) used verbatim; v1 kept in vo_lines.v1.json. No word changed.
- Voice v2: gemini-3.8-flash-tts + hi-in-csagent-11 via the Interactions API (key from clone_voice.py, never printed),
  24 kHz PCM, edge silence trimmed, loudnorm -16 LUFS / -1.5 dBTP, 48 kHz mono (assets/voice/vo01–vo14.wav; v1 Charon
  takes moved to assets/voice/v1/). Every take was listen-checked: a blind gemini-3.8-flash transcript plus the Whisper
  word timings (scripts/words/, `hyperframes transcribe`) must not both miss a script word; no spoken style direction;
  "Naqsha" judged NUK-shah. Re-synthesised: vo01, vo02, vo12 (judge rejects on first takes, e.g. an extra "A"), vo04
  (a filler "uh") and vo11 ("also on Argon" heard as "an"). Report: scripts/vo_check_v2.json.
- vo08 is placed in three parts and vo09 in three parts (cut at measured silences, 25 ms fades) so "orbit / night / cut
  away" and "lounge / master bedroom / stairs and roof" each sit on their own footage; this gives the furnished interiors
  ~6.7 s of cut-away and ~9 s of walked rooms. Words unchanged, only the pauses grow.
- Positioning: LDA appears only as "Prototype rules: LDA, Lahore" (setup callout, Argon rules panel, Rules-check card,
  compliance callout) and as the first row of the outro's "Bylaws as data" roadmap; headlines speak of the development
  authority and local bylaws. Hook: drafts → REJECTED → generic setback note; the "What if…" card is gone.
- Agentic emphasis: "Agent at work" lower-thirds name the Google ADK setup agent · Gemini 3.8 Flash, Gemini 4 Argon ·
  architect agent (+ self-review), and the Google ADK revision agent · Gemini 4 Argon · 9 tools; a live Rules-check card
  tracks 15 → 5 → 0 and the self-review through the real run; the refusal is called out as "Refused, with a reason".
- Time-lapse proxies are generated from scripts/timelapse_plan.json, which build.py writes from the voice timing
  (d1: 12×/61×/4.5×/71×/5.2× phases; h: 45×). Music bed re-fitted with scripts/bed_plan_v2.json (old bed in
  assets/music/v1/), re-carved at strength 0.7 against the voiceover group. Re-run carve.mjs after every build.py.
- Length 3:51.2 (231.22 s).

## Notes

- Truth over the brief's draft numbers: revise-from-comments took ~5:18 on the agent clock (not ~70 s); the
  typed Ask-bar change took ~10 min; the live d1 run is 36/36 LDA · 10/13 livable (3 advisory). Never put
  37/37 · 10/10 on d1/d2/d3. Do not zoom on or read out the "Approval-ready" line in d2.
- Mouse look in the walk is the app's drag-to-look fallback (pointer lock not granted to automation).
- Output: ../naqsha-demo.mp4, 1920×1080, 30 fps, H.264. Never exceed 4:00.

## Decisions made in the v3 re-edit (17 Oct 2026, from critique-v2-judge/editor/copy and the user's notes)

- Narration: eight lines rewritten in plain language and re-voiced with the same model, voice and style (scripts/gen_vo_v2.py,
  every take passed the judge and the two-transcriber consensus): vo01 (business problem: weeks of redraws by the architect,
  a plan returned by the development authority, nobody can walk the rooms before it is built), vo03 (agents design the
  home and check it against local building bylaws), vo07 (LDA as the prototype's rules, 36/36, Argon's 4 review notes,
  1:100 set), vo08 (night with the rooms lit inside, cut-away to furnished rooms), vo09 (first person, furnished lounge,
  bedrooms upstairs, stairs past the glass guard to the roof; "like a game" removed), vo12 (typed change: same agent, a
  foot from the parents' bedroom, explains why; Version 5 still passes every check), vo13 ("Both agents" replaced by "The
  setup agent and the revision agent"), vo14 (families / architects / builders, Pakistan's development authorities then
  other countries). v2 takes kept in assets/voice/v2/, v2 script in scripts/vo_lines.v2.json, v2 build in scripts/build_v2.py.
- Split lines (vo08 ×4, vo09 ×4, vo14 ×2) are cut into their own files in assets/voice/parts/ (cut 120 ms before the next
  word's measured onset, 25 ms fades), so the music carve measures what is placed; the v2 carve had stuck at -14 to -17 dB
  through 99-150 s. Bed re-fitted (scripts/bed_plan_v3.json) and re-carved at 0.7.
- Interiors: night 4.6 s at 3× punched in on the lit rooms; cut-away ground floor 2.6 s and first floor 2.2 s (0.3× over the
  lowest first-floor cut), 1.75× on the house; walk adds Bedroom 3 with its bed (g1 4.4-9.3) and a 0.4× slow-motion beat
  through the glass guard into the upstairs family lounge (labelled "slow motion 0.4×"); master bedroom captioned for what
  is seen (balcony doors, wood panelling).
- Agentic: Argon graphic lights Fix on "Argon fixes whatever fails" and runs the loop back to Check; a Plan/Check/Fix/
  Self-review/Build strip tracks the live run; Argon's real review note (review.3) is quoted during self-review and d2's
  "4 architect's notes" view is shown; the setup agent's tools, the revision agent's tool calls (get_rooms, check_plan_ops,
  apply_plan_ops, write_section, finish; verified in api/app/agents/reviser_adk.py) and "tests each edit with
  check_plan_ops" are on screen; the typed change is its own chapter (07) and confirmed to run the same ADK reviser
  (api/app/main.py /revise).
- Truth: sample-home footage (e, f, g1, g3, h, i, y) carries our own "Sample home · 10 marla" / "Sample home · Version 5" tag
  over the app's project header, which hides its v3/v4 "37/37 · 10/10" pill; the villa reads "Sample villa · 1 kanal". The
  landing construction replay (37-check pill, "LDA envelope") is cut; the hero's "LDA-ready" sub-copy sits under our
  callout; d2 opens already punched in below "Approval-ready". 37/37 · 10/10 is claimed only for Version 5.
- Copy fixes: "rules in code", "every room, sized", "Client link · anyone with it can view and comment", "share links for
  clients", "roles checked on Cloud Run", clocks read "elapsed", speed chips rounded (19×, 71×, "time cut · sped up 3×"),
  end-card tagline "Design agents that check their own work against local bylaws.", title industry line adds "then
  worldwide", roadmap row 3 "Other countries · after that" holds about 2 s.
- Length 3:56.9 (236.91 s).
