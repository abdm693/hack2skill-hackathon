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
  input?: "text" | "number" | "plot" | "map" | "style" | "rooms" | null;
  field?: string;
  allow_skip?: boolean;
}

export interface Concept { id: string; url: string; prompt: string; model: string; created_at: string; parent_id?: string; instruction?: string }

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

export interface Project {
  id: string;
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
}

export interface AsBuiltSummary {
  objects: { id: string; layer: Layer; kind?: string; level?: string; room?: string; bbox_ft: { min: Vec3; max: Vec3 } }[];
  section_errors: { section: string; error: string }[];
  /**
   * What the engine repaired or could not repair while building (Naqsha "livable" rules enforced in 3D): ids are
   * "asbuilt.<rule>:<element>", e.g. asbuilt.stair_fit, asbuilt.roof_door_moved, asbuilt.guard_added,
   * asbuilt.opening_skipped, asbuilt.furniture_moved, asbuilt.furniture_dropped, asbuilt.path_blocked, asbuilt.car_dropped.
   */
  checks?: { id: string; title: string; status: "pass" | "warn" | "fail"; message: string; element_ids?: string[] }[];
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
