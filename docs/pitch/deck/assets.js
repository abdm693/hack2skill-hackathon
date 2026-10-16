/*
 * Naqsha deck: the ONE place that maps image slots to files.
 *
 * Every <img data-asset="key"> and SVG <image data-asset="key"> in index.html
 * is resolved from this table by deck.js at load time. To swap a screenshot
 * (for example a v2 capture after the UI overhaul), drop the new file into
 * assets/ and change `src` here. Nothing in index.html needs to change, but
 * check the crop (object-view-box) on the slide that uses it.
 *
 * `source` records where each file came from, so it can be re-captured.
 * `alt` is the accessible description used on the slide.
 *
 * "live-*" files were captured on 17 Oct 2026 from the deployed Cloud Run app
 * (https://naqsha-242926648187.us-central1.run.app) after opening the two
 * sample homes as a fresh guest. They show real data, not the in-browser
 * demo mode. Numbers on them are listed in docs/evidence/live-samples-2026-10-17.json.
 */

/* Set to true once the 18 Oct build is verified on the live URL: every "In the 18 Oct build" chip then reads "Live". */
window.DECK_SHIPPED = false;

window.DECK_ASSETS = {
  // ---- Live service captures (17 Oct 2026) ----
  liveSetup10m: {
    src: "assets/live-setup-10m.jpg",
    source: "live app, sample '10 marla modern home, Johar Town' (clone p_784bb1c08d36), /setup at 1600x1180 @2x",
    alt: "Setup chat and the brief, with the LDA buildable envelope for a 35 by 65 foot plot: 30 by 48 feet buildable",
  },
  liveDesign10m: {
    src: "assets/live-design-10m.jpg",
    source: "live app, 10-marla sample, /design at 1600x1000 @2x",
    alt: "The 10-marla ground-floor plan with the LDA compliance panel: all 42 checks pass",
  },
  liveDesign1k: {
    src: "assets/live-design-1k.jpg",
    source: "live app, sample '1 kanal Spanish villa' (clone p_4f6c3f5edb3d), /design at 1600x1180 @2x",
    alt: "The 1-kanal ground-floor plan on a 50 by 90 foot plot, inside its setbacks",
  },
  liveRevisions10m: {
    src: "assets/live-revisions-10m.jpg",
    source: "live app, 10-marla sample, /revisions, scrolled to the comments",
    alt: "Version 2: what changed, and the porch request marked Not possible with the LDA reason",
  },
  liveExplore10m: {
    src: "assets/live-explore-10m.jpg",
    source: "live app, 10-marla sample, /explore (orbit), headless Chrome",
    alt: "The 10-marla house in 3D in its street",
  },
  liveExplore1k: {
    src: "assets/live-explore-1k.jpg",
    source: "live app, 1-kanal sample, /explore (orbit), headless Chrome",
    alt: "The 1-kanal Spanish villa in 3D: terracotta roofs, arches, a roof terrace and a two-car porch",
  },
  liveMobileExplore: {
    src: "assets/live-mobile-explore.jpg",
    source: "live app, 10-marla sample, /explore at 390x844 @3x, mobile emulation",
    alt: "The 3D house on a phone",
  },
  liveLayer1: {
    src: "assets/live-layer-1.jpg",
    source: "live app, 10-marla sample, /explore with only the Structure layer on",
    alt: "Structure only: walls, slabs, openings and the boundary wall",
  },
  liveLayer2: {
    src: "assets/live-layer-2.jpg",
    source: "live app, 10-marla sample, /explore with Structure and Facade on",
    alt: "Structure plus facade: the stone pier and teak fins appear",
  },
  liveLayer4: {
    src: "assets/live-layer-4.jpg",
    source: "live app, 10-marla sample, /explore with every layer on",
    alt: "Every layer on: landscape, lighting and the street",
  },
  concept10m: {
    src: "assets/concept-10m-live.jpg",
    source: "live assets API, 10-marla sample, selected concept c_aef3642395f8 (gemini-3.1-flash-image)",
    alt: "The chosen photoreal concept for the 10-marla brief: white, stone and teak, with a carport",
  },
  concept1k: {
    src: "assets/concept-1k-live.jpg",
    source: "live assets API, 1-kanal sample, selected concept c_34bfc387ce72 (gemini-3.1-flash-image)",
    alt: "The chosen photoreal concept for the 1-kanal Spanish brief",
  },

  // ---- Engine renders of the 10-marla house (Argon's House SDK code) ----
  renderFront: {
    src: "assets/engine-argon-front.jpg",
    source: "docs/screens/engine-argon-front.png",
    alt: "The Argon-coded 10-marla house in its street: stone pier, teak fins, glass balcony and gate",
  },
  renderInterior: {
    src: "assets/engine-interior.jpg",
    source: "docs/screens/engine-interior.png",
    alt: "Ground-floor lounge and dining from the same code: marble, joinery, false ceiling and a ceiling fan",
  },
  renderAerial: {
    src: "assets/engine-aerial.jpg",
    source: "docs/screens/engine-aerial.png",
    alt: "Aerial view of the house with its roof, mumty, water tank and neighbours",
  },
  renderDollhouse: {
    src: "assets/engine-dollhouse.jpg",
    source: "docs/screens/engine-dollhouse.png",
    alt: "Dollhouse cut of the ground floor with furniture in every room",
  },
  viewerWalkHud: {
    src: "assets/viewer-walk-hud.jpg",
    source: "docs/screens/viewer-walk-hud.png",
    alt: "Walk mode in the dining room with the minimap and a door label",
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
