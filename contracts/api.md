# Naqsha HTTP API (FastAPI, same origin as the SPA)

**Identity.** The MVP runs without auth. The client generates a UUID once, stores it in `localStorage["naqsha.uid"]` and sends it as `X-Naqsha-User` on every request. That UUID defines the workspace.

**Streaming.** Long operations stream **SSE over POST**. The response is `text/event-stream`, and each event has this form:

```
event: <name>
data: <json>
```

A blank line ends each event. The client reads it with `fetch()` plus a `ReadableStream` parser (see `web/src/api/sse.ts`). Every stream ends with `event: done` or `event: error` (`{message, recoverable}`). The server sends `event: ping` every 15 s as a keepalive.

TypeScript shapes come from `contracts/plan.ts` (`BuildingPlan`, `ComplianceReport`) and the shapes below.

## Types

```ts
type Stage = "setup" | "concepts" | "planning" | "building" | "ready" | "revising";

interface Brief {
  city: string;                 // "Lahore"
  authority: Authority;         // "LDA" (DHA/BAHRIA flagged: own bylaws)
  scheme?: string;              // "Johar Town"
  coordinates?: { lat: number; lng: number };
  plot: { width_ft: number; depth_ft: number; area_marla: number; corner: boolean };
  facing?: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
  storeys: number;              // 1..3 (LDA max 3)
  basement: boolean;
  bedrooms: number;
  bathrooms: number;
  spaces: string[];             // "drawing", "tv_lounge", "dining", "kitchen", "dirty_kitchen", "servant_quarter",
                                // "car_porch:2", "lawn", "prayer", "store", "laundry", "roof_terrace", "study", "gym"
  style: string;                // "Modern Contemporary" | "Spanish" | "Classic" | "Minimalist" | "Mediterranean" | "Mughal Revival" | "Industrial" | free text
  style_notes?: string;
  inspiration_image_url?: string;
  budget?: "economy" | "standard" | "premium" | "luxury";
  notes?: string;
  auto_filled: string[];        // fields the agent chose because the user skipped
}

interface Envelope {            // from the LDA engine, as soon as the plot is known
  authority: Authority; band: string;
  setbacks_ft: { front: number; rear: number; left: number; right: number };
  side_space_note?: string;     // e.g. "5 ft side space on one side"
  max_coverage_pct: number; max_far: number; max_height_ft: number; max_storeys: number;
  buildable_rect: Rect;         // plan ft
  max_ground_coverage_sqft: number;
  notes: string[];              // short plain-English bullets
}

interface Chip { label: string; value: string; image_url?: string; hint?: string }

interface ChatMessage {
  id: string; role: "user" | "assistant"; text: string; created_at: string;
  chips?: Chip[];               // one-tap answers for the current question
  multi?: boolean;              // chips are multi-select
  input?: "text" | "number" | "plot" | "map" | "style" | "rooms" | null;  // special widget to show
  field?: string;               // Brief field being asked about
  allow_skip?: boolean;
}

interface Concept { id: string; url: string; prompt: string; model: string; created_at: string; parent_id?: string; instruction?: string }

interface DesignSection { name: string; layer: Layer; code: string }   // Layer from house-sdk.d.ts

interface Change { id: string; summary: string; kind: "plan" | "section"; targets: string[]; comment_ids: string[] }

interface Version {
  id: string; n: number; created_at: string; parent_id?: string;
  plan: BuildingPlan; sections: DesignSection[]; compliance: ComplianceReport;
  changes?: Change[];           // vs the parent version (revisions)
  status: "building" | "ready" | "failed";
  thumbnail_url?: string;
}

interface Project {
  id: string; name: string; created_at: string; updated_at: string; stage: Stage;
  brief: Brief | null; envelope: Envelope | null;
  concepts: Concept[]; selected_concept_id: string | null;
  versions: { id: string; n: number; created_at: string; status: Version["status"]; summary?: string }[];
  current_version_id: string | null;
  thumbnail_url: string | null;
}

interface CommentAnchor {
  position: [number, number, number];  // world meters
  normal: [number, number, number];
  level?: string; room?: string; element_id?: string; kind?: string; label?: string;
}
interface Comment {
  id: string; version_id: string; text: string; anchor: CommentAnchor;
  camera: { position: [number, number, number]; target: [number, number, number] };
  snapshot_url?: string; created_at: string;
  status: "open" | "resolved" | "partial" | "rejected"; resolution?: string; resolved_in_version?: string;
}
```

## Endpoints

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/api/health` | | `{ok, models}` |
| GET | `/api/samples` | | `{projects: Project[]}`: finished example homes, shown in the workspace as "Explore a sample home" |
| POST | `/api/projects/{pid}/clone` | `{name?}` | `Project`: copies a sample (or your own project) into your workspace, including versions and comments |
| GET | `/api/projects` | | `{projects: Project[]}` (newest first) |
| POST | `/api/projects` | `{name?}` | `Project` |
| GET | `/api/projects/{pid}` | | `Project` |
| PATCH | `/api/projects/{pid}` | `{name?, brief?}` | `Project` (patching the brief recomputes the envelope) |
| DELETE | `/api/projects/{pid}` | | `{ok}` |
| GET | `/api/projects/{pid}/messages` | | `{messages: ChatMessage[]}` |
| POST | `/api/projects/{pid}/intake` | `{message?: string, action?: "start" \| "skip_question" \| "skip_all", chips?: string[]}` | **SSE**: `message.delta {text}` · `message {ChatMessage}` · `brief {brief, envelope}` · `intake.complete {brief, envelope}` · `done` |
| GET | `/api/lda/envelope` | `?width_ft&depth_ft&authority=LDA&corner=false` | `Envelope` |
| POST | `/api/lda/check` | `{plan}` | `ComplianceReport` |
| POST | `/api/projects/{pid}/concepts` | `{count?: 4, instruction?: string, base_concept_id?: string}` | **SSE**: `concept.started {index, prompt}` · `concept {index, concept}` · `concept.failed {index, message}` · `done` |
| POST | `/api/projects/{pid}/concepts/{cid}/select` | | `Project` |
| POST | `/api/projects/{pid}/design` | `{}` | **SSE**: `stage {stage: "plan" \| "compliance" \| "fix" \| "build" \| "save", message}` · `plan {plan, attempt}` · `compliance {report, attempt}` · `section {section: DesignSection, index}` · `progress {chars}` · `version {version: Version}` · `done` |
| GET | `/api/projects/{pid}/run` | | **SSE** replay of the running design/revise pipeline (all events so far, then live); **204** if none. Call on project load to resume after a refresh. POST /design and /revise also re-attach if a run is already active. |
| GET | `/api/projects/{pid}/versions/{vid}` | | `Version` |
| POST | `/api/projects/{pid}/versions/{vid}/repair` | `{section: string, error: string}` | **SSE**: `section {section, index}` · `done` (Argon fixes one failing section) |
| POST | `/api/projects/{pid}/versions/{vid}/thumbnail` | `{image_data_url}` | `{url}`: stores a viewport capture as the version and project thumbnail. Call it after the first build. |
| POST | `/api/projects/{pid}/versions/{vid}/asbuilt` | `{summary: AsBuiltSummary}` | `ComplianceReport` (as-built checks, e.g. facade projections) |
| GET | `/api/projects/{pid}/comments` | `?version_id` | `{comments: Comment[]}` |
| POST | `/api/projects/{pid}/comments` | `{version_id, text, anchor, camera, snapshot_data_url?}` | `Comment` |
| PATCH | `/api/projects/{pid}/comments/{cid}` | `{text?, status?}` | `Comment` |
| DELETE | `/api/projects/{pid}/comments/{cid}` | | `{ok}` |
| POST | `/api/projects/{pid}/revise` | `{version_id, comment_ids?: string[]}` | **SSE**: `stage` · `changes {changes: Change[]}` · `plan` · `compliance` · `section` (changed sections only) · `comment {comment}` (resolution) · `version {version}` · `done` |
| POST | `/api/projects/{pid}/render` | `{image_data_url, prompt?, version_id?}` | `{url}`: a photoreal AI render of that viewport |
| GET | `/api/assets/{path}` | | Image bytes, proxied from GCS (cacheable) |

`AsBuiltSummary` is produced by the engine (`web/src/engine`):

```ts
interface AsBuiltSummary {
  objects: { id: string; layer: Layer; kind?: string; level?: string; room?: string;
             bbox_ft: { min: [number, number, number]; max: [number, number, number] } }[];  // plan ft: [x, y, h]
  section_errors: { section: string; error: string }[];
}
```

## Accounts and collaboration (simple by default)

### Identity
- **Google Identity Platform**, email + password (already enabled). The SPA calls the Identity Toolkit REST API (`accounts:signUp`, `accounts:signInWithPassword`, `securetoken.googleapis.com/v1/token` to refresh) with the browser key from `GET /api/config`.
- The ID token goes in `Authorization: Bearer <idToken>`. The backend verifies it with `google.oauth2.id_token.verify_firebase_token(token, audience=PROJECT)`.
- **Guests still work.** With no token, `X-Naqsha-User: <guest uuid>` is used as today. Sign-in is offered, never forced. The prompts are "Save your work: create an account" and "Share".
- On the first sign-in, `POST /api/me/claim {guest_id}` moves the guest's projects to the account, so nothing is lost.

### Roles: three, named in plain words
| Role | Who | Can do |
|---|---|---|
| **Owner** | Creator | Everything: share, invite, design, revise, delete |
| **Team** | Architects and colleagues invited by email | Design, comment, run revisions |
| **Client** | Anyone with the client link, or invited as client | View the plan and 3D, walk, comment and reply. No editing or revising |

### Sharing UX: one "Share" button and one dialog
- **Invite by email**, with a role select (Team / Client) and an "Invite" button. People who already have access show as avatar rows with a role menu and Remove.
- **Client link**: a toggle labelled "Anyone with the link can view and comment", with Copy link. It opens `/s/<token>`, a calm read-only client view (plan, 3D and walk, comments). The visitor's name is asked once, on their first comment, if they aren't signed in.

### Comments become a conversation
- Every comment has an **author** `{id, name, role}` and an initials avatar coloured by role. Replies form a thread under it.
- Filter chips: All · Mine · Team · Client · Open · Resolved.
- **Revise uses the open comments.** The owner or team sees "Apply 5 open comments" and can untick any. The agent's resolution is posted as a reply from "Naqsha" in the thread, so clients see the answer where they asked.

### API additions
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/config` | | `{auth: {api_key, project_id}}` |
| GET | `/api/me` | | `{user: {uid, email, name}}` or 401 |
| POST | `/api/me/claim` | `{guest_id}` | `{moved: n}` |
| GET | `/api/projects/{pid}/members` | | `{members: [{uid?, email, name?, role, status: "active" \| "invited"}], share: {enabled, url?}}` |
| POST | `/api/projects/{pid}/members` | `{email, role: "team" \| "client"}` | member |
| PATCH / DELETE | `/api/projects/{pid}/members/{email}` | `{role}` | |
| POST | `/api/projects/{pid}/share` | `{enabled}` | `{enabled, token, url}` |
| GET | `/api/share/{token}` | | `{project (public fields), version, comments, role: "client"}` |
| POST | `/api/share/{token}/comments` | `{author_name, text, anchor, camera, snapshot_data_url?}` | Comment |
| POST | `/api/projects/{pid}/comments/{cid}/replies` (and `/api/share/{token}/comments/{cid}/replies`) | `{text, author_name?}` | Comment |
| POST | `/api/projects/{pid}/revise` | adds `{instruction?: string}` | Conversational edits without pins ("make the kitchen bigger") |

- `Comment` gains `author {id, name, role}` and `replies: [{id, author, text, created_at}]`.
- `Project` gains `role` (the caller's role) and `members_count`.

## Overhaul additions (2026-10-17)

### Brief additions
`floors` is the per-floor program, `water_tank` the tank type, `solar` the rooftop plan, and `preferences` the soft wishes, recorded verbatim. Example:

```json
{
  "floors": [{"level": "ground", "rooms": ["drawing", "kitchen", "dirty_kitchen", "bedroom:1", "bath:2"]},
             {"level": "first", "rooms": ["bedroom:3", "bath:3", "lounge"]}],
  "water_tank": "plastic | concrete",
  "solar": "none | ready | panels",
  "preferences": ["open kitchen", "parents' bedroom on ground floor"]
}
```

- `ready` means the roof is kept clear for panels later; `panels` means they are included now.
- `notes` are appended to, never overwritten.

### Concepts
- `Concept.night_url?`: the same image at night, with the same camera, made by editing the day image.
- `POST /api/projects/{pid}/concepts/night` `{ids?: string[]}` is an **SSE** stream: `concept {index, concept}` (with `night_url` filled in), then `done`. The UI's Day/Night toggle calls it once, lazily.

### Compliance
- `ComplianceCheck.category`: `"lda"` (regulation) or `"livable"` (Naqsha planning rules: room independence, reachability, stairs to the roof, guards, doors, walking space).
- The UI shows two groups: **LDA rules** and **Livable home**.

### Revise
`POST /api/projects/{pid}/revise` takes `{version_id, comment_ids?: string[], instruction?: string}`.
- With `instruction` and no comments, it runs a conversational edit, e.g. "make the kitchen bigger" typed into the Ask field.
- `comment_ids` lets the owner choose which comments are applied.
- The agent's resolutions are also added as a reply from `{id: "naqsha", name: "Naqsha", role: "agent"}`.

### Samples
`POST /api/projects/{sample}/clone` returns the caller's existing clone of that sample if one exists (no duplicates). Pass `{fresh: true}` to force a new copy.

### Setup messages
- `ChatMessage.understood?` is `{guaranteed[], preferences[], assumptions[]}`, the "Here's what I understood" card.
- `ChatMessage.suggestions?` holds what's-next prompt chips.
- `input: "floors"` opens the per-floor program editor. It sends chips such as `floor:ground=drawing,kitchen,dirty_kitchen,bedroom:1,bath:2` and `floor:first=bedroom:3,bath:3,lounge`.
- Tank and solar answers use chips: `tank:plastic` or `tank:concrete`, and `solar:none`, `solar:ready` or `solar:panels`.
