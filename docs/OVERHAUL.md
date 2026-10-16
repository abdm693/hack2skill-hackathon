# Naqsha overhaul: build plan (2026-10-17)

## Inputs
- **User feedback.** The user's issue list and direction, summarised in `docs/review/*` and at the top of each audit.
- **`docs/design/DESIGN.md`:** the final design system and UX spec (Calm, with grafts from the other proposals). It is the **source of truth for every pixel**.
- **`docs/review/architecture-rules.md`:** root causes with lines, Part A (plan rules), Part B (engine invariants) and Part C (prompt ideas).
- **`docs/review/audit-journey.md` and `docs/review/audit-3d.md`:** 98 issues from using the live app as a customer.
- **`docs/research/maket-teardown.md`:** the competitor, and where we beat it.

## Non-negotiables from the user
1. **Think like an architect.** Every generated house must be livable:
   - rooms are independent (a bedroom opens to circulation, a lounge, a balcony or its own bath, never another bedroom);
   - a stair reaches the roof and the roof door is at its landing;
   - there are railings at every drop;
   - nothing blocks a door;
   - there is walking space everywhere;
   - cars don't block the way in.
2. **Agent philosophy.** Don't bury Argon in rulebooks. Objective safety and structure are enforced **deterministically**:
   - `api/app/compliance/planning.py` checks the plan and feeds the fix loop with specific failures and fix hints;
   - the engine guarantees railings, door keep-outs, the mumty door at the stair arrival, parking bays and walkways, whatever Argon writes.

   Everything else comes from **common-sense self-review**. Argon looks at a rendered image of its floor plan plus a room and area table, critiques it like an architect (circulation, privacy, proportions, daylight, the brief), and then revises.

   The planner prompt gains only a short "architect's common sense" paragraph and the objective stair geometry. Its creative brief stays open, so its artistic flair stays.
3. **UX.** Jony Ive-level calm.
   - No top stage bar.
   - Conversational and intelligent: one message can fill the whole brief, and it says "Here's what I understood".
   - It does more by itself.
4. **Collaboration that stays intuitive.** Sign up and sign in (Google Identity Platform, email and password, already enabled). One Share dialog: invite Team or Client by email, or turn on a client link. Comments carry their author, with replies. The owner picks which comments go into a revision.
5. **New requests:**
   - **Setup:** a per-floor room program; questions on the water tank (blue plastic or concrete) and rooftop solar (roof kept clear by default; no minarets or chhatris unless asked).
   - **Concepts:** day/night pairs, and mid-row vs corner plots (fixed).
   - **Plan:** print and save as PDF.
   - **Walk:** a room navigator, floor switching that moves you, mouse look, and cars that don't block.
   - **Orbit:** neighbours never block the view.
6. **Landing page.** A house-under-construction animation, a large heading, business-focused features, and a separate **Portal** button into the app at `/app`.

## Auth decision
- Google Identity Platform with email and password. The SPA calls the Identity Toolkit REST API using the browser key served by `GET /api/config`; the key is never committed.
- Google sign-in needs an OAuth client created in the console, so it's out of scope for now. Show only email sign-in, and design the dialog so a "Continue with Google" button can be added later.
- Guests still work with no account. Signing in claims the guest's projects.

## Tracks (each in its own worktree; only touch your paths)

| Track | Owns | Key sources |
|---|---|---|
| **BACKEND** | `api/**` | Collaboration/auth API (`contracts/api.md` "Accounts and collaboration"); ADK conversational setup agent; brief additions; `planning.py` rules + glazing fix; best-attempt fix loop; Argon self-review step (floor plan PNG via Pillow → critique → revise); concept night variants; conversational revise (`instruction`); revise using planning checks; sample clone de-dupe; stage-regression fix; prayer room not habitable; correct LDA height copy |
| **ENGINE** | `web/src/engine/**`, `contracts/house-sdk.d.ts`, `contracts/engine-notes.md`, `contracts/fixtures/design-*.js` | `architecture-rules.md` Part B (B.1–B.9) and section 1 root causes; solar-ready roof and tank material; `kind: "context"` for neighbours and `kind: "vehicle"` for cars |
| **VIEWER** | `web/src/viewer/**` | `DESIGN.md` "House: explore and walk HUD"; audit-3d walk, explore and version issues; new `ViewerHandle` and props below |
| **APP-SHELL** | `web/src/app/{App.tsx,routes/**,landing/**,auth/**,workspace/**,shell/**,share/**,comments/**,ui/**,lib/**,store/**}`, `web/src/api/**`, `web/index.html`, `web/src/index.css`, `web/public/**` | `DESIGN.md` tokens and components, landing, auth, workspace, project shell and navigation (no stage bar), bottom dock with Ask/command bar, Share dialog, client view `/s/:token`, comments UI with authors, threads and filters, mobile |
| **APP-FLOWS** | `web/src/app/{setup/**,concepts/**,plan/**,design/**,explore/**,revisions/**}` | `DESIGN.md` Brief, Concepts, Plan, House and Revisions screens; audit-journey setup, concepts, floor plan, design and revise issues; print to PDF |

**Shell ↔ flows boundary.** APP-SHELL owns the token CSS and `web/src/app/ui/*` primitives, and writes them **first**:
`Button`, `IconButton`, `Chip`, `Input`, `Textarea`, `Card`, `Sheet`, `Dialog`, `Toast`, `Segmented`, `Avatar`, `Tooltip`, `Spinner`, `Kbd`.

The shell renders project views by route:
- `/app/p/:id/brief` → `setup/BriefView`
- `/app/p/:id/concepts` → `concepts/ConceptsView`
- `/app/p/:id/plan` → `plan/PlanView`
- `/app/p/:id/house` → `explore/HouseView`
- `/app/p/:id/revisions` → `revisions/RevisionsView`

Each view is `export function XView({ project, onProjectChange }: { project: Project; onProjectChange(p: Project): void })`.
- APP-FLOWS imports `ui/*` (build against the existing primitives and update the imports at merge) and **does not** restyle globals.
- The dock's Ask field calls `useAsk()` from `shell/ask.ts`. Views register context with `useAskContext({ placeholder, onSubmit })`, so the dock does the right thing per view: in House it sends a conversational revise instruction; in Brief it sends a setup message.

## Contract changes (already written into `contracts/`)
- `api.md` / `api-types.ts`: the auth/collaboration endpoints; `Brief.floors`, `water_tank`, `solar` and `preferences`; `Concept.night_url`; `Comment.author` and `replies`; `Project.role`; `ComplianceCheck.category ("lda" | "livable")`; `revise {instruction}`; `POST /concepts/night`.
- `plan.ts`: `Roof.water_tank.material`; `Roof.solar`.
- `web-modules.md`: `ViewerHandle.goToRoom` / `setFloor` / `resetView`, plus the `ghostContext`, `hideVehicles`, `onRoomChange` and `night` props.

## Definition of done (every track)
- The track's `tsc -b` (or a Python import and run) is clean.
- Every feature is visually verified in the built-in browser on its own tab.
- Screenshots go in `docs/screens/v2-<track>-*.png`.
- Commits are on the track's branch with no pushes, followed by a final report: what's done, what isn't, and any contract deviations.
