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
