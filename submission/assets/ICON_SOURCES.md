# Icon and logo sources

These icons and logos are used in the architecture diagram (slide 7), the process flow (slide 5) and the technologies, brief and features slides (slides 8, 2 and 4) of `Naqsha_AI_Builder_Cup_Submission.pptx` and `.pdf`. Everything was downloaded on 17 Oct 2026. The originals are in `assets/icons/<source>/`.

`assets/src/make_icons.py` makes two derived sets from them:

- `assets/icons/derived/`: SVGs tinted for the HTML diagrams. The simple-icons get their brand colour. The Material Symbols get Google grey `#5F6368`.
- `assets/icons/png/`: 192 px PNGs for the PPTX, rasterised with `rsvg-convert`.

None of the downloads contained scripts or external references.

## Google brand assets

| Asset | Where it is used | Source | Licence / terms |
|---|---|---|---|
| **Google Cloud product icons:** Cloud Run, Firestore, Cloud Storage, Vertex AI, Cloud Build, Artifact Registry, Identity Platform (`icons/gcp/*.svg`) | Architecture diagram product cards; slide 8 Google Cloud card and Agent Platform card title; slide 2 cloud strip. Identity Platform is downloaded but no longer placed: the auth card carries the Firebase logomark only. Vertex AI is now Gemini Enterprise Agent Platform; the icon library still names its icon Vertex AI, so that icon is used. | The official icon library at https://cloud.google.com/icons. Zip: https://services.google.com/fh/files/misc/google-cloud-legacy-icons.zip (sha256 `a6d9d79217580425…`), files `<product>/<product>.svg` | Google provides these "for your diagrams, technical documentation, and more". No open-source licence is given. The product names and icons are Google trademarks; they are used only to name the Google Cloud products the app runs on. |
| **Google Cloud logo**, full colour (`icons/gcp/google-cloud-logo-fullcolor.svg`) | Architecture diagram project boundary; slide 8 Google Cloud card title | https://www.gstatic.com/cgc/google-cloud-logo-fullcolor.svg, the logo served on cloud.google.com/icons (sha256 `9579d2aca20e69e7…`) | Google trademark. No licence is given. Used to label the Google Cloud project boundary. |
| **Firebase logomark**, full colour (`icons/firebase/firebase-logomark-full-color.svg`) | Firebase Authentication card in the architecture diagram; slide 8 Firebase Authentication row; slide 2 cloud strip | The Firebase brand assets zip from https://firebase.google.com/brand-guidelines: https://firebase.google.com/static/downloads/brand-guidelines/firebase-brand-assets.zip (sha256 `ac17065f4790742b…`). File: `Firebase Logo/Primary Logomark/SVG/Logomark_Full Color.svg` | Firebase brand guidelines: the logo may be used in presentation slides. It must not be altered, must not be the most prominent element, and must not suggest Google endorses the product. It is used unaltered, at icon size, beside the product name. |
| **Gemini sparkle** (`icons/gemini/gemini-sparkle.svg`) | The cards that call Gemini in the architecture diagram (setup agent, revision agent, Architect pipeline, concepts and renders); the Gemini model rows on slide 8 | https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg, the mark served by gemini.google.com (sha256 `f56df33f86dc0c02…`) | Google trademark. No licence is given. Used only to mark Gemini models. |
| **Agent Development Kit (ADK) logo** (`icons/adk/agent-development-kit.png`, 512 px) | "Agentic harness: Google ADK" on slides 4, 5, 7 and 8 | The ADK docs repository, google/adk-docs, file `docs/assets/agent-development-kit.png` at commit `923938a4e49239f0a3f7c3d1f876fe9aac1e4d24`: https://raw.githubusercontent.com/google/adk-docs/923938a4e49239f0a3f7c3d1f876fe9aac1e4d24/docs/assets/agent-development-kit.png (sha256 `7b3a16ca4417a134…`) | The repository is Apache-2.0. The mark identifies Google's Agent Development Kit. |

### Which Google Cloud icon set we used

cloud.google.com/icons offers three zips:

- "Core product icons": core-products-icons.zip, sha256 `6531a10f58bc599c…`
- "Product category icons": category-icons.zip, sha256 `e5bc3abd3527dc25…`
- "Legacy console icons": google-cloud-legacy-icons.zip

The early-2025 core set has Cloud Run, Cloud Storage and Vertex AI, but not Firestore, Cloud Build, Artifact Registry or Identity Platform. We used the legacy console icons because they are the only set that covers all of these products in one style. They are also the icons Google Cloud Architecture Center diagrams use. The core and category zips were downloaded and checked, but none of their icons are used.

## Technology logos: simple-icons (CC0-1.0)

simple-icons `16.33.0`, published 27 Sep 2026, pinned. Each logo comes from `https://cdn.jsdelivr.net/npm/simple-icons@16.33.0/icons/<slug>.svg`. The brand colours come from `https://cdn.jsdelivr.net/npm/simple-icons@16.33.0/data/simple-icons.json`.

The icons are licensed CC0-1.0 (the package's `LICENSE.md`). The marks are still trademarks of their owners; see the simple-icons legal disclaimer.

| Logo | Slug | Colour | Used for (slide 8) |
|---|---|---|---|
| Python | `python` | `#3776AB` | Python 3.13 |
| FastAPI | `fastapi` | `#009688` | FastAPI |
| Pydantic | `pydantic` | `#E92063` | Pydantic |
| Pytest | `pytest` | `#0A9EDC` | pytest |
| uv | `uv` | `#DE5FE9` | uv |
| Docker | `docker` | `#2496ED` | Docker |
| React | `react` | `#61DAFB` | React 19 |
| TypeScript | `typescript` | `#3178C6` | TypeScript |
| Vite | `vite` | `#9135FF` | Vite |
| Three.js | `threedotjs` | `#000000` | three.js r186 |
| Tailwind CSS | `tailwindcss` | `#06B6D4` | Tailwind CSS 4 |
| Google Gemini | `googlegemini` | `#8E75B2` | Downloaded but no longer placed: the google-genai row on slide 8 now uses the Material `code` symbol, so the official sparkle is the only Gemini mark in the deck. |

## Generic icons: Material Symbols (Apache-2.0)

Material Symbols, Outlined, weight 400. Package `@material-symbols/svg-400@0.47.5` (published 22 Sep 2026), from `https://cdn.jsdelivr.net/npm/@material-symbols/svg-400@0.47.5/outlined/<name>.svg`. Licensed Apache-2.0 (the package's `LICENSE`).

| Icon | Used for |
|---|---|
| `family_restroom`, `engineering`, `person` | Personas in the architecture diagram: owner (the family), team (architect, builder), client (via share link). `handshake` is downloaded but no longer placed. |
| `web` | Browser card in the architecture diagram |
| `rule` | Rules engine (architecture diagram); rules check (tool) and LDA rules as data (slide 8) |
| `autorenew`, `visibility`, `replay` | Rules fix loop, multimodal review and resilience (slide 8) |
| `stream`, `image` | Server-Sent Events and Pillow (slide 8; neither has a simple-icons logo) |
| `view_in_ar`, `directions_walk`, `light_mode` | react-three-fiber + drei, three-mesh-bvh and N8AO (slide 8; none has a simple-icons logo) |
| `code` | google-genai 2.31, the Gen AI SDK row of the Architect pipeline card (slide 8) |
| `language` | Global endpoint row of the Agent Platform card (slide 8) |
| `home`, `print`, `fact_check`, `checklist`, `shield` | Built by us (slide 8): House SDK, 1:100 print sheets, as-built check, 10 livable rules, code screen. `gavel` is downloaded but no longer placed. |

