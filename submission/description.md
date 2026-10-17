# Brief description (submission form field)

## Form field: "Brief Description of Your Solution" (1,024 characters max; this is 1010)

Paste exactly this:

```text
Naqsha (Urdu for "house plan") turns a simple conversation into a bylaw-compliant 3D home you can walk through, in minutes. A design takes weeks of manual drafting, compliance checks need scarce experts, and most families never see their home in 3D. It fits Theme 5, Future of Work: it changes how architects and residential construction companies work, and how homeowners experience home design. Families walk every room, pin comments that the agents address, collaborate with architects and builders, and make changes in plain language.

Google services: Gemini 4 Argon acts as the architect. It plans every floor, fixes what our bylaw engine flags (LDA in the prototype), reviews its own drawings and writes the furnished 3D home as code. Gemini 3.8 Flash runs the setup agent and Gemini 3.1 Flash Image paints concepts, all on Vertex AI. Google ADK is the agentic harness. Cloud Run hosts the app and agents, Firestore and Cloud Storage keep projects and images, and Firebase Authentication signs users in.
```

---

## Longer version (for README and reference)

**Tagline:** Naqsha: from a conversation to a bylaw-compliant 3D home you can walk through, in minutes. Built on Google Cloud.

---

Naqsha (نقشہ, "house plan") is an agentic home-design studio, built for Pakistan's construction industry first, then worldwide. **Track:** Theme 5, Future of Work & Enterprise Productivity. **Industry:** architecture, engineering and construction (AEC) and residential real estate. Naqsha is set to transform how architects and residential construction companies work, and how families decide what to build.

**The problem.** Designing a home takes weeks of manual drafting, and every draft and every change is drawn by hand. Checking it against building bylaws is done by hand, by experts in short supply, so bylaw mistakes often show up only when the authority refuses the plan. Most families never see their home in 3D, let alone walk through it: they commit to building from flat drawings they can't picture. And feedback is scattered. Owners, family, architects and builders give it in different places, so every round of changes is slow.

**The solution.** Naqsha's AI agents act as an experienced architect you can talk to. No product today takes families and their architects from a conversation to a compliant 3D home they can walk through, comment on and change; we are redefining how families and architects design a home. Describe the plot and the family in plain words, and in minutes the agents draft the concepts, the floor plans and the full 3D home. Every plan is checked against the local authority's bylaws, and the agents fix what fails. The home is immersive, high-fidelity 3D, furnished inside and finished outside: walk through it room by room, or view it from any angle, by day or night. Pin a comment anywhere as you walk, and the AI architect makes the change, or names the rule that stops it. Owners, family, architects and builders review and comment together on one project; client links need no account. To change anything, you ask in plain language: "Make the kitchen bigger" gives you a new, checked version. Every version is kept, with a 1:100 print set and a compliance report for the architect who stamps it.

**Proof from the live service.** A 10 marla home takes about 5 minutes of AI time from the first message to a walkable 3D home. Rule failures fell from a median of 8 on the first try to 0 delivered, fixed by the AI architect; on a 1 kanal brief they went 15 → 5 → 0. A revision from comments takes about 70 seconds (median).

**Business model.** About $2.65 of cloud and AI per new home (estimate), so one avoided Lahore resubmission fee pays for about 55 homes. Free, Family, Professional and stamping-partner tiers, with prices set in pilots.

**Scope.** Any authority's bylaws load as data. The prototype runs the Lahore Development Authority (LDA) bylaws, with DHA, Bahria, RDA, FDA, MDA and GDA rule sets on the LDA baseline. Adding a city starts with adding its rules.

How it runs on Google Cloud:

- **Agentic harness: Google ADK** (Agent Development Kit 2.12) runs two agents with 14 tools: the setup agent (Gemini 3.8 Flash, 5 tools) and the revision agent (Gemini 4 Argon, 9 tools), which dry-runs every edit against the rules.
- **Gemini:** Gemini 4 Argon runs the Architect pipeline. It plans every floor in JSON, fixes the plan against our deterministic rules engine, critiques a drawing of it, then writes the 3D house as code (google-genai). Gemini 3.1 Flash Image paints the concepts and photoreal renders of any 3D view (fallbacks: Nano Banana 2.1, Gemini 3 Pro Image). All models run on Gemini Enterprise Agent Platform (Vertex AI).
- **Cloud Run:** one service runs the ADK agents, the FastAPI API and the React app; long design runs survive a closed tab and stream over Server-Sent Events. Cloud Build builds each deploy.
- **Firestore and Cloud Storage:** Firestore holds projects, chat, versions, comments, members and share links, saved at every step; Cloud Storage holds images and drawings.
- **Firebase:** Firebase Authentication (Identity Platform) signs users in; Cloud Run verifies their ID tokens for Owner, Team and Client roles.

**Team:** Pivot Analytix (Abdullah Moazzam, team leader; Saad Wali Muhammad Joiya; Usama Bin Maalik).

Live: https://naqsha-242926648187.us-central1.run.app · Code (public): https://github.com/abdm693/hack2skill-hackathon
