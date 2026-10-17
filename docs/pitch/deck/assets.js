/*
 * Naqsha deck: the ONE place that maps image slots to files.
 *
 * Every <img data-asset="key"> and SVG <image data-asset="key"> in index.html
 * is resolved from this table by deck.js at load time. To swap a screenshot,
 * drop the new file into assets/ and change `src` here. Nothing in index.html
 * needs to change, but check the crop (object-view-box) on the slide that uses it.
 *
 * `source` records where each file came from, so it can be re-captured.
 * `alt` is the accessible description used on the slide.
 *
 * "v2-*" files are the v2 (Calm) UI, captured on 17 Oct 2026 from the deployed Cloud Run app,
 * revision naqsha-00009 (https://naqsha-242926648187.us-central1.run.app), on guest copies of the two
 * public sample homes: 10 marla modern (p_5a5893a2bcaa, v3) and 1 kanal Spanish villa (p_1a42e70989af, v3).
 * Desktop shots are 2880 x 1800 (1440 x 900 at 2x); phone shots are 780 x 1688 (390 x 844 at 2x).
 * The originals (PNG) are in docs/screens/; these are JPEG copies at quality 84.
 */

window.DECK_ASSETS = {
  // ---- v2 live captures (17 Oct 2026, revision naqsha-00009) ----
  v2BriefPhone: {
    src: "assets/v2-brief-phone.jpg",
    source: "docs/screens/v2-live-phone-brief.png (390 x 844 @2x)",
    alt: "On a phone: the end of the family's one-message brief, and Naqsha's 'Here's what I understood' card",
  },
  v2PhoneHouse: {
    src: "assets/v2-phone-house.jpg",
    source: "docs/screens/v2-live-phone-house.png (390 x 844 @2x)",
    alt: "On a phone: the 10 marla house in 3D with the floor stack, the controls and 'Revise with 1 comment'",
  },
  v2Plan10m: {
    src: "assets/v2-plan-10m.jpg",
    source: "docs/screens/v2-live-plan-compliance-10marla.png",
    alt: "The 10 marla ground-floor plan with the compliance panel: all 37 LDA checks and 10 livable rules pass",
  },
  v2PlanVilla: {
    src: "assets/v2-plan-villa.jpg",
    source: "docs/screens/v2-live-plan-compliance-villa.png",
    alt: "The 1 kanal villa's ground-floor plan on a 50 by 90 foot plot, inside its setbacks",
  },
  v2PlanVillaLivable: {
    src: "assets/v2-plan-villa-livable.jpg",
    source: "docs/screens/v2-live-plan-compliance-villa-livable.png",
    alt: "The live compliance panel's livable-home rules: every room reached properly, stairs to the roof, the roof door at the top landing",
  },
  v2House10m: {
    src: "assets/v2-house-10m.jpg",
    source: "docs/screens/v2-live-house-orbit-10marla.png",
    alt: "The 10 marla house in 3D among its neighbours, with the blue water tank and the roof door",
  },
  v2HouseVilla: {
    src: "assets/v2-house-villa.jpg",
    source: "docs/screens/v2-live-house-orbit-villa.png",
    alt: "The 1 kanal Spanish villa in 3D: terracotta roofs, rooftop solar panels and a two-car porch",
  },
  v2WalkLounge: {
    src: "assets/v2-walk-lounge.jpg",
    source: "docs/screens/v2-live-walk-lounge.png",
    alt: "Walking through the TV lounge and dining room in first person",
  },
  v2WalkRailings: {
    src: "assets/v2-walk-railings.jpg",
    source: "docs/screens/v2-live-walk-stairwell-railings.png",
    alt: "The first-floor stairwell: glass and timber railings on every edge",
  },
  v2WalkRoofDoor: {
    src: "assets/v2-walk-roof-door.jpg",
    source: "docs/screens/v2-live-walk-roof-door.png",
    alt: "From the top landing, the open roof door looks out onto the roof",
  },
  v2Comments: {
    src: "assets/v2-comments.jpg",
    source: "docs/screens/v2-live-comments.png (one client comment and an owner reply were posted on a guest copy for the capture, then deleted with it)",
    alt: "The comments sheet over the house: a client's comment with the owner's reply, and earlier comments with Naqsha's replies",
  },
  v2Share: {
    src: "assets/v2-share.jpg",
    source: "docs/screens/v2-live-share-dialog.png",
    alt: "The Share dialog: a client link with Copy link, and invite by email",
  },
  v2ClientView: {
    src: "assets/v2-client-view.jpg",
    source: "docs/screens/v2-live-client-view.png (/s/<token>)",
    alt: "The client's view of a shared home: 'Shared with you, you can comment', a pinned note and Approve v3",
  },
  v2RevisionsFromComments: {
    src: "assets/v2-revisions-from-comments.jpg",
    source: "docs/screens/v2-live-revisions-from-comments.png",
    alt: "Version 2, from two comments: what changed, in feet",
  },
  v2ReviewGround: {
    src: "assets/v2-review-ground.png",
    source: "docs/screens/v2-backend-review-ground.png, drawn by api/app/agents/drawing.py for Argon's self-review",
    alt: "The drawing Argon reviews: its own ground-floor plan with room names, sizes, walls, doors and windows",
  },
  concept10mDay: {
    src: "assets/v2-concept-10m-day.jpg",
    source: "api/scripts/round4/c_0026dc7358eb-day.png: the 10 marla sample's chosen concept B (Screened Travertine Courtyard), as promoted to the live sample",
    alt: "The chosen concept for the 10 marla brief: travertine, glass and a vertical teak screen",
  },
  concept10mNight: {
    src: "assets/v2-concept-10m-night.jpg",
    source: "api/scripts/round4/c_0026dc7358eb-night.png: the same concept by night, same camera",
    alt: "The same concept by night, with lit windows",
  },

  // ---- Live captures from 17 Oct 2026, v1 UI (3D only; used for the layer-by-layer stream on slide 5) ----
  liveLayer1: {
    src: "assets/live-layer-1.jpg",
    source: "live app (v1), 10-marla sample, /explore with only the Structure layer on",
    alt: "Structure only: walls, slabs, openings and the boundary wall",
  },
  liveLayer2: {
    src: "assets/live-layer-2.jpg",
    source: "live app (v1), 10-marla sample, /explore with Structure and Facade on",
    alt: "Structure plus facade: the stone pier and teak fins appear",
  },
  liveLayer4: {
    src: "assets/live-layer-4.jpg",
    source: "live app (v1), 10-marla sample, /explore with every layer on",
    alt: "Every layer on: landscape, lighting and the street",
  },

  // ---- Engine renders of the first 10-marla house (Argon's House SDK code, 16 Oct) ----
  renderFront: {
    src: "assets/engine-argon-front.jpg",
    source: "docs/screens/engine-argon-front.png",
    alt: "The Argon-coded 10-marla house in its street: stone pier, teak fins, glass balcony and gate",
  },
  renderDollhouse: {
    src: "assets/engine-dollhouse.jpg",
    source: "docs/screens/engine-dollhouse.png",
    alt: "Dollhouse cut of the ground floor with furniture in every room",
  },

  // ---- The one-shot spike: Argon's raw three.js from 16 Oct, re-shot from a front camera matching the SDK render ----
  spikeOneshot: {
    src: "assets/spike-oneshot-front.jpg",
    source: "docs/spikes/argon-oneshot-threejs.html, camera moved to a straight-on street view (17 ft, 9.5 ft, -58 ft), HUD hidden; Argon's code unchanged",
    alt: "The one-shot spike: Argon's raw three.js house, flat colours and blocky plants",
  },

  // ---- Competitor teardown (maket.ai free tier, 16 Oct 2026) ----
  maketPlan: {
    src: "assets/maket-plan-result.jpg",
    source: "docs/research/maket/25-plan-result.png",
    alt: "Maket's plan result for a 50 by 90 foot brief: a house 59 ft 6 in wide",
  },
};
