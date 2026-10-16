/**
 * API client (track: APP). Same-origin /api; identity via X-Naqsha-User (see contracts/api.md).
 *
 * `api` is the single entry point for the UI. With VITE_MOCK=1 (or localStorage["naqsha.mock"]="1")
 * it is backed by an in-browser mock that persists to localStorage and simulates SSE timing,
 * so the whole journey is clickable without the backend.
 */
import type {
  AsBuiltSummary,
  Brief,
  ChatMessage,
  Comment,
  CommentAnchor,
  Envelope,
  Project,
  Version,
} from "@contracts/api-types";
import type { Authority, BuildingPlan, ComplianceReport } from "@contracts/plan";
import { openSSE, StreamError, type SSEHandlers, type StreamOptions } from "./sse";
import { ApiError } from "./errors";
import { mockApi } from "./mock";

export type { SSEHandlers, StreamOptions } from "./sse";
export { StreamError, isAbortError } from "./sse";
export { ApiError } from "./errors";

export function userId(): string {
  let id: string | null = null;
  try { id = localStorage.getItem("naqsha.uid"); } catch { /* private mode */ }
  if (!id) {
    id = crypto.randomUUID();
    try { localStorage.setItem("naqsha.uid", id); } catch { /* ignore */ }
  }
  return id;
}

export interface IntakeBody {
  message?: string;
  action?: "start" | "skip_question" | "skip_all";
  chips?: string[];
}
export interface ConceptsBody { count?: number; instruction?: string; base_concept_id?: string }
export interface NewComment {
  version_id: string;
  text: string;
  anchor: CommentAnchor;
  camera: Comment["camera"];
  snapshot_data_url?: string;
}
export interface EnvelopeQuery { width_ft: number; depth_ft: number; authority?: Authority; corner?: boolean }

/** Every endpoint in contracts/api.md, typed. Streams resolve on `done` and reject on `error`. */
export interface Api {
  readonly mock: boolean;
  health(): Promise<{ ok: boolean; models?: Record<string, string> }>;

  listProjects(): Promise<Project[]>;
  createProject(name?: string): Promise<Project>;
  /** Finished example homes anyone can open (GET /samples). */
  listSamples(): Promise<Project[]>;
  /** Copy a sample (or one of your projects) into your workspace, with versions and comments. */
  cloneProject(pid: string, name?: string): Promise<Project>;
  getProject(pid: string): Promise<Project>;
  updateProject(pid: string, patch: { name?: string; brief?: Brief }): Promise<Project>;
  deleteProject(pid: string): Promise<void>;

  getMessages(pid: string): Promise<ChatMessage[]>;
  intake(pid: string, body: IntakeBody, handlers: SSEHandlers, opts?: StreamOptions): Promise<void>;

  getEnvelope(q: EnvelopeQuery, opts?: { signal?: AbortSignal }): Promise<Envelope>;
  checkPlan(plan: BuildingPlan): Promise<ComplianceReport>;

  generateConcepts(pid: string, body: ConceptsBody, handlers: SSEHandlers, opts?: StreamOptions): Promise<void>;
  selectConcept(pid: string, cid: string): Promise<Project>;

  design(pid: string, handlers: SSEHandlers, opts?: StreamOptions): Promise<void>;
  getVersion(pid: string, vid: string): Promise<Version>;
  repairSection(pid: string, vid: string, body: { section: string; error: string }, handlers: SSEHandlers, opts?: StreamOptions): Promise<void>;
  asBuilt(pid: string, vid: string, summary: AsBuiltSummary): Promise<ComplianceReport>;

  listComments(pid: string, versionId?: string): Promise<Comment[]>;
  createComment(pid: string, body: NewComment): Promise<Comment>;
  updateComment(pid: string, cid: string, patch: { text?: string; status?: Comment["status"] }): Promise<Comment>;
  deleteComment(pid: string, cid: string): Promise<void>;

  revise(pid: string, body: { version_id: string; comment_ids?: string[] }, handlers: SSEHandlers, opts?: StreamOptions): Promise<void>;
  /**
   * Re-attach to the project's in-flight design or revise run (GET /run): replays every event so far,
   * then follows it live. Resolves false when nothing is running (204).
   */
  resumeRun(pid: string, handlers: SSEHandlers, opts?: StreamOptions): Promise<boolean>;
  render(pid: string, body: { image_data_url: string; prompt?: string; version_id?: string }): Promise<{ url: string }>;
  /** Store a viewport capture as the version's (and the project's) thumbnail. */
  saveThumbnail(pid: string, vid: string, imageDataUrl: string): Promise<{ url: string }>;
}

// ── Real implementation ────────────────────────────────────────────────────────────────────────────

const BASE = "/api";

function headers(): Record<string, string> {
  return { "X-Naqsha-User": userId() };
}

async function readError(res: Response): Promise<ApiError> {
  let msg = "";
  try {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { detail?: unknown; message?: unknown };
      if (typeof j.detail === "string") msg = j.detail;
      else if (Array.isArray(j.detail)) msg = "The request was not valid.";
      else if (typeof j.message === "string") msg = j.message;
      else msg = text;
    } catch { msg = text; }
  } catch { /* ignore */ }
  if (!msg) msg = res.status === 404 ? "Not found." : `The server returned ${res.status}.`;
  return new ApiError(msg.slice(0, 300), res.status);
}

async function http<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...headers() },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new ApiError("Can't reach the Naqsha server. Check your connection and try again.", 0);
  }
  if (!res.ok) throw await readError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

async function stream(path: string, body: unknown, handlers: SSEHandlers, opts?: StreamOptions): Promise<void> {
  await openSSE(`${BASE}${path}`, { method: "POST", body, headers: headers() }, handlers, opts);
}

const p = (pid: string) => `/projects/${encodeURIComponent(pid)}`;

const realApi: Api = {
  mock: false,
  health: () => http("GET", "/health"),

  listProjects: async () => (await http<{ projects: Project[] }>("GET", "/projects")).projects,
  createProject: (name) => http("POST", "/projects", name ? { name } : {}),
  listSamples: async () => (await http<{ projects: Project[] }>("GET", "/samples")).projects ?? [],
  cloneProject: (pid, name) => http("POST", `${p(pid)}/clone`, name ? { name } : {}),
  getProject: (pid) => http("GET", p(pid)),
  updateProject: (pid, patch) => http("PATCH", p(pid), patch),
  deleteProject: async (pid) => { await http("DELETE", p(pid)); },

  getMessages: async (pid) => (await http<{ messages: ChatMessage[] }>("GET", `${p(pid)}/messages`)).messages,
  intake: (pid, body, handlers, opts) => stream(`${p(pid)}/intake`, body, handlers, opts),

  getEnvelope: (q, opts) => {
    const qs = new URLSearchParams({
      width_ft: String(q.width_ft),
      depth_ft: String(q.depth_ft),
      authority: q.authority ?? "LDA",
      corner: String(!!q.corner),
    });
    return http("GET", `/lda/envelope?${qs}`, undefined, opts?.signal);
  },
  checkPlan: (plan) => http("POST", "/lda/check", { plan }),

  generateConcepts: (pid, body, handlers, opts) => stream(`${p(pid)}/concepts`, body, handlers, opts),
  selectConcept: (pid, cid) => http("POST", `${p(pid)}/concepts/${encodeURIComponent(cid)}/select`),

  design: (pid, handlers, opts) => stream(`${p(pid)}/design`, {}, handlers, { idleTimeoutMs: 120_000, ...opts }),
  getVersion: (pid, vid) => http("GET", `${p(pid)}/versions/${encodeURIComponent(vid)}`),
  repairSection: (pid, vid, body, handlers, opts) =>
    stream(`${p(pid)}/versions/${encodeURIComponent(vid)}/repair`, body, handlers, opts),
  asBuilt: (pid, vid, summary) => http("POST", `${p(pid)}/versions/${encodeURIComponent(vid)}/asbuilt`, { summary }),

  listComments: async (pid, versionId) => {
    const qs = versionId ? `?version_id=${encodeURIComponent(versionId)}` : "";
    return (await http<{ comments: Comment[] }>("GET", `${p(pid)}/comments${qs}`)).comments;
  },
  createComment: (pid, body) => http("POST", `${p(pid)}/comments`, body),
  updateComment: (pid, cid, patch) => http("PATCH", `${p(pid)}/comments/${encodeURIComponent(cid)}`, patch),
  deleteComment: async (pid, cid) => { await http("DELETE", `${p(pid)}/comments/${encodeURIComponent(cid)}`); },

  revise: (pid, body, handlers, opts) => stream(`${p(pid)}/revise`, body, handlers, { idleTimeoutMs: 120_000, ...opts }),
  resumeRun: async (pid, handlers, opts) =>
    (await openSSE(`${BASE}${p(pid)}/run`, { method: "GET", headers: headers() }, handlers, { idleTimeoutMs: 120_000, ...opts })) === "done",
  render: (pid, body) => http("POST", `${p(pid)}/render`, body),
  saveThumbnail: (pid, vid, image_data_url) => http("POST", `${p(pid)}/versions/${encodeURIComponent(vid)}/thumbnail`, { image_data_url }),
};

function mockEnabled(): boolean {
  if (import.meta.env.VITE_MOCK === "1") return true;
  try { return localStorage.getItem("naqsha.mock") === "1"; } catch { return false; }
}

export const api: Api = mockEnabled() ? mockApi : realApi;

/** Resolve an asset URL from the API (absolute, data:, /api/assets/... or /mock/...). */
export function assetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:|\/)/.test(url)) return url;
  return `${BASE}/assets/${url}`;
}

/** Turn provider errors ("429 RESOURCE_EXHAUSTED {…}") into a sentence people can act on. */
export function friendlyError(message: string): string {
  if (/\b429\b|RESOURCE_EXHAUSTED|quota|rate limit/i.test(message)) return "The AI models are busy right now. Try again in a minute.";
  if (/\b50[34]\b|UNAVAILABLE|overloaded/i.test(message)) return "The AI service is briefly unavailable. Try again shortly.";
  if (/DEADLINE_EXCEEDED|timed? ?out|timeout/i.test(message)) return "The AI took too long to answer. Try again.";
  return message;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError || e instanceof StreamError) return friendlyError(e.message);
  if (e instanceof Error) return friendlyError(e.message || "Something went wrong.");
  return "Something went wrong.";
}
