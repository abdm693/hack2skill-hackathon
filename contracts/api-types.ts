/** TypeScript mirror of contracts/api.md (shared by web/src/api, app and viewer). */
import type { Authority, BuildingPlan, ComplianceReport, Rect } from "./plan";
import type { Layer } from "./house-sdk";

export type Stage = "setup" | "concepts" | "planning" | "building" | "ready" | "revising";

export interface Brief {
  city: string;
  authority: Authority;
  scheme?: string;
  coordinates?: { lat: number; lng: number };
  plot: { width_ft: number; depth_ft: number; area_marla: number; corner: boolean };
  facing?: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
  storeys: number;
  basement: boolean;
  bedrooms: number;
  bathrooms: number;
  spaces: string[];
  style: string;
  style_notes?: string;
  inspiration_image_url?: string;
  budget?: "economy" | "standard" | "premium" | "luxury";
  notes?: string;
  auto_filled: string[];
  /** Per-floor program, e.g. [{level:"ground", rooms:["drawing","kitchen","bedroom:1","bath:2"]}]. */
  floors?: { level: string; rooms: string[] }[];
  water_tank?: "plastic" | "concrete";
  /** "ready" = keep the roof clear for panels later; "panels" = include panels now. */
  solar?: "none" | "ready" | "panels";
  /** Soft wishes captured verbatim from the conversation. */
  preferences?: string[];
}

export interface Envelope {
  authority: Authority;
  band: string;
  setbacks_ft: { front: number; rear: number; left: number; right: number };
  side_space_note?: string;
  max_coverage_pct: number;
  max_far: number;
  max_height_ft: number;
  max_storeys: number;
  buildable_rect: Rect;
  max_ground_coverage_sqft: number;
  notes: string[];
}

export interface Chip { label: string; value: string; image_url?: string; hint?: string }

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  created_at: string;
  chips?: Chip[];
  multi?: boolean;
  input?: "text" | "number" | "plot" | "map" | "style" | "rooms" | "floors" | null;
  /** "Here's what I understood" card: guaranteed = hard rules we will meet (LDA + livable), preferences = wishes we will
   *  try to honour, assumptions = things the agent decided itself (editable). Sent after a rich message and at completion. */
  understood?: { guaranteed: string[]; preferences: string[]; assumptions: string[] };
  /** Suggested next prompts shown as chips under the message ("What's next"). */
  suggestions?: string[];
  field?: string;
  allow_skip?: boolean;
}

export interface Concept { id: string; url: string; night_url?: string; prompt: string; model: string; created_at: string; parent_id?: string; instruction?: string }

export interface DesignSection { name: string; layer: Layer; code: string }

export interface Change { id: string; summary: string; kind: "plan" | "section"; targets: string[]; comment_ids: string[] }

export interface Version {
  id: string;
  n: number;
  created_at: string;
  parent_id?: string;
  plan: BuildingPlan;
  sections: DesignSection[];
  compliance: ComplianceReport;
  changes?: Change[];
  status: "building" | "ready" | "failed";
  thumbnail_url?: string;
}

export interface VersionSummary { id: string; n: number; created_at: string; status: Version["status"]; summary?: string }

export type Role = "owner" | "team" | "client";

export interface Author { id: string; name: string; role: Role | "agent" | "guest" }

export interface Member { uid?: string; email: string; name?: string; role: Role; status: "active" | "invited" }

export interface Project {
  id: string;
  /** The caller's role on this project. */
  role?: Role;
  members_count?: number;
  name: string;
  created_at: string;
  updated_at: string;
  stage: Stage;
  brief: Brief | null;
  envelope: Envelope | null;
  concepts: Concept[];
  selected_concept_id: string | null;
  versions: VersionSummary[];
  current_version_id: string | null;
  thumbnail_url: string | null;
}

export type Vec3 = [number, number, number];

export interface CommentAnchor {
  position: Vec3;
  normal: Vec3;
  level?: string;
  room?: string;
  element_id?: string;
  kind?: string;
  label?: string;
}

export interface Comment {
  id: string;
  version_id: string;
  text: string;
  anchor: CommentAnchor;
  camera: { position: Vec3; target: Vec3 };
  snapshot_url?: string;
  created_at: string;
  status: "open" | "resolved" | "partial" | "rejected";
  resolution?: string;
  resolved_in_version?: string;
  author?: Author;
  replies?: { id: string; author: Author; text: string; created_at: string }[];
}

export interface Me { uid: string; email: string; name?: string }

export interface AsBuiltSummary {
  objects: { id: string; layer: Layer; kind?: string; level?: string; room?: string; bbox_ft: { min: Vec3; max: Vec3 } }[];
  section_errors: { section: string; error: string }[];
}

/** SSE event payloads by event name. */
export interface SSEEvents {
  "message.delta": { text: string };
  message: ChatMessage;
  brief: { brief: Brief; envelope: Envelope | null };
  "intake.complete": { brief: Brief; envelope: Envelope | null };
  "concept.started": { index: number; prompt: string };
  concept: { index: number; concept: Concept };
  "concept.failed": { index: number; message: string };
  stage: { stage: "plan" | "compliance" | "fix" | "build" | "save" | "changes"; message: string };
  plan: { plan: BuildingPlan; attempt: number };
  compliance: { report: ComplianceReport; attempt: number };
  section: { section: DesignSection; index: number };
  progress: { chars: number };
  version: { version: Version };
  changes: { changes: Change[] };
  comment: { comment: Comment };
  ping: Record<string, never>;
  done: Record<string, unknown>;
  error: { message: string; recoverable?: boolean };
}
