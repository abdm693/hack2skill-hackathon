/**
 * The open project: data, chat, and the long-running streams (concepts, design, revise).
 * Streams live here rather than in step components, so they keep running while the user moves
 * between steps, and a page reload re-attaches to an in-flight design/revise run (GET /run).
 */
import { create } from "zustand";
import type { Change, ChatMessage, Comment, Concept, DesignSection, Project, SSEEvents, Version } from "@contracts/api-types";
import type { BuildingPlan, ComplianceReport } from "@contracts/plan";
import {
  api,
  errorMessage,
  isAbortError,
  type ConceptsBody,
  type IntakeBody,
  type NewComment,
  type SSEHandlers,
  type StreamOptions,
} from "@/api/client";
import { plotLabel } from "@/api/domain";
import { saveFixLoop } from "@/app/lib/fixloop";
import { toast } from "./toast";

export interface ConceptSlot {
  key: string;
  index: number;
  status: "drawing" | "done" | "failed";
  prompt?: string;
  conceptId?: string;
  message?: string;
}

export interface ConceptRun {
  id: string;
  instruction?: string;
  baseId?: string;
  slots: ConceptSlot[];
  running: boolean;
  startedAt: number;
}

type StageName = SSEEvents["stage"]["stage"];

export type FeedItem =
  | { id: string; at: number; kind: "stage"; stage: StageName; message: string }
  | { id: string; at: number; kind: "plan"; attempt: number; plan: BuildingPlan }
  | { id: string; at: number; kind: "compliance"; attempt: number; report: ComplianceReport }
  | { id: string; at: number; kind: "section"; index: number; section: DesignSection }
  | { id: string; at: number; kind: "changes"; changes: Change[] }
  | { id: string; at: number; kind: "comment"; comment: Comment }
  | { id: string; at: number; kind: "version"; version: Version }
  | { id: string; at: number; kind: "error"; message: string };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewItem = DistributiveOmit<FeedItem, "id" | "at">;

export interface Run {
  status: "idle" | "running" | "done" | "error";
  items: FeedItem[];
  plan?: BuildingPlan;
  planAttempt?: number;
  compliance?: ComplianceReport;
  complianceAttempt?: number;
  /** Failures per compliance attempt, e.g. [5, 1, 0]. */
  failures: number[];
  sections: DesignSection[];
  chars: number;
  changes?: Change[];
  version?: Version;
  error?: string;
  startedAt?: number;
  resumed?: boolean;
  baseVersionId?: string;
}

const idleRun = (): Run => ({ status: "idle", items: [], sections: [], chars: 0, failures: [] });
type RunKey = "design" | "revise";

interface ProjectState {
  pid: string | null;
  project: Project | null;
  loadState: "idle" | "loading" | "ready" | "error";
  loadError?: string;

  messages: ChatMessage[];
  draft: string | null;
  intakeBusy: boolean;
  intakeFailed: IntakeBody | null;

  conceptRun: ConceptRun | null;
  design: Run;
  revise: Run;
  versions: Record<string, Version>;
  comments: Comment[];
  commentsFor: string | null;

  open(pid: string): Promise<void>;
  close(): void;
  refresh(): Promise<void>;
  rename(name: string): Promise<void>;
  patchProject(p: Partial<Project>): void;

  startIntake(): Promise<void>;
  sendIntake(body: IntakeBody, display?: string): Promise<void>;
  retryIntake(): Promise<void>;

  generateConcepts(body?: ConceptsBody): Promise<void>;
  selectConcept(cid: string): Promise<boolean>;

  runDesign(): Promise<void>;
  resumeRun(): Promise<void>;
  loadVersion(vid: string): Promise<Version | null>;
  cacheVersion(v: Version): void;

  loadComments(versionId: string): Promise<void>;
  addComment(body: NewComment): Promise<Comment | null>;
  updateComment(cid: string, patch: { text?: string; status?: Comment["status"] }): Promise<void>;
  deleteComment(cid: string): Promise<void>;

  runRevise(versionId: string, commentIds?: string[]): Promise<void>;
}

const controllers = new Map<string, AbortController>();
function controller(key: string): AbortController {
  controllers.get(key)?.abort();
  const c = new AbortController();
  controllers.set(key, c);
  return c;
}
function abortAll() {
  for (const c of controllers.values()) c.abort();
  controllers.clear();
}

let seq = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const failuresOf = (r: ComplianceReport) => r.checks.filter((c) => c.status === "fail").length;

export const useProject = create<ProjectState>((set, get) => {
  /** Ignore late events from a project the user already left. */
  const live = (pid: string) => get().pid === pid;

  const pushItem = (key: RunKey, item: NewItem) => {
    const run = get()[key];
    set({ [key]: { ...run, items: [...run.items, { ...item, id: nid("fi"), at: Date.now() } as FeedItem] } } as Partial<ProjectState>);
  };
  const patchRun = (key: RunKey, patch: Partial<Run>) => {
    set({ [key]: { ...get()[key], ...patch } } as Partial<ProjectState>);
  };

  /** Handlers shared by POST /design, POST /revise and GET /run. */
  const runHandlers = (pid: string, key: () => RunKey): SSEHandlers => ({
    stage: ({ stage, message }) => {
      if (!live(pid)) return;
      pushItem(key(), { kind: "stage", stage, message });
      if (key() === "design" && stage === "build") get().patchProject({ stage: "building" });
    },
    plan: ({ plan, attempt }) => {
      if (!live(pid)) return;
      patchRun(key(), { plan, planAttempt: attempt });
      pushItem(key(), { kind: "plan", plan, attempt });
    },
    compliance: ({ report, attempt }) => {
      if (!live(pid)) return;
      const k = key();
      patchRun(k, { compliance: report, complianceAttempt: attempt, failures: [...get()[k].failures, failuresOf(report)] });
      pushItem(k, { kind: "compliance", report, attempt });
    },
    section: ({ section, index }) => {
      if (!live(pid)) return;
      const k = key();
      const cur = get()[k].sections;
      const next = cur.some((s) => s.name === section.name) ? cur.map((s) => (s.name === section.name ? section : s)) : [...cur, section];
      patchRun(k, { sections: next });
      pushItem(k, { kind: "section", section, index });
    },
    progress: ({ chars }) => live(pid) && patchRun(key(), { chars }),
    changes: ({ changes }) => {
      if (!live(pid)) return;
      patchRun(key(), { changes });
      pushItem(key(), { kind: "changes", changes });
    },
    comment: ({ comment }) => {
      if (!live(pid)) return;
      const exists = get().comments.some((x) => x.id === comment.id);
      set({ comments: exists ? get().comments.map((x) => (x.id === comment.id ? comment : x)) : [...get().comments, comment] });
      pushItem(key(), { kind: "comment", comment });
    },
    version: ({ version }) => {
      if (!live(pid)) return;
      const k = key();
      if (k === "design") saveFixLoop(version.id, get().design.failures);
      set({ versions: { ...get().versions, [version.id]: version } });
      patchRun(k, k === "design" ? { version, plan: version.plan, compliance: version.compliance, sections: version.sections } : { version });
      pushItem(k, { kind: "version", version });
      const p = get().project;
      if (p && !p.versions.some((v) => v.id === version.id)) {
        get().patchProject({
          versions: [...p.versions, { id: version.id, n: version.n, created_at: version.created_at, status: version.status }],
          current_version_id: version.id,
          stage: "ready",
        });
      }
    },
  });

  /** Drive one design/revise stream into the run state, with error handling and retry. */
  const drive = async (
    pid: string,
    key: () => RunKey,
    open: (h: SSEHandlers, o: StreamOptions) => Promise<unknown>,
    retry: () => void,
  ): Promise<unknown> => {
    const c = controller("run");
    try {
      const result = await open(runHandlers(pid, key), { signal: c.signal });
      if (live(pid) && get()[key()].status === "running") patchRun(key(), { status: "done" });
      return result;
    } catch (e) {
      if (isAbortError(e) || !live(pid)) return undefined;
      const message = errorMessage(e);
      const k = key();
      pushItem(k, { kind: "error", message });
      patchRun(k, { status: "error", error: message });
      toast.error(k === "design" ? "The design run stopped" : "The revision stopped", e, { label: "Try again", run: retry });
      return undefined;
    } finally {
      if (live(pid)) void get().refresh();
    }
  };

  return {
    pid: null,
    project: null,
    loadState: "idle",
    messages: [],
    draft: null,
    intakeBusy: false,
    intakeFailed: null,
    conceptRun: null,
    design: idleRun(),
    revise: idleRun(),
    versions: {},
    comments: [],
    commentsFor: null,

    async open(pid) {
      if (get().pid === pid && get().loadState === "ready") {
        void get().refresh();
        return;
      }
      abortAll();
      set({
        pid,
        project: null,
        loadState: "loading",
        loadError: undefined,
        messages: [],
        draft: null,
        intakeBusy: false,
        intakeFailed: null,
        conceptRun: null,
        design: idleRun(),
        revise: idleRun(),
        versions: {},
        comments: [],
        commentsFor: null,
      });
      try {
        const [project, messages] = await Promise.all([api.getProject(pid), api.getMessages(pid)]);
        if (!live(pid)) return;
        set({ project, messages, loadState: "ready" });
        if (["planning", "building", "revising"].includes(project.stage)) void get().resumeRun();
      } catch (e) {
        if (!live(pid)) return;
        set({ loadState: "error", loadError: errorMessage(e) });
      }
    },

    close() {
      abortAll();
      set({ pid: null, project: null, loadState: "idle" });
    },

    async refresh() {
      const pid = get().pid;
      if (!pid) return;
      try {
        const project = await api.getProject(pid);
        if (live(pid)) set({ project });
      } catch (e) {
        if (!isAbortError(e)) console.warn("refresh failed", e);
      }
    },

    async rename(name) {
      const pid = get().pid;
      const p = get().project;
      if (!pid || !p || !name.trim() || name === p.name) return;
      set({ project: { ...p, name } });
      try {
        const project = await api.updateProject(pid, { name });
        if (live(pid)) set({ project });
      } catch (e) {
        toast.error("Couldn't rename the project", e);
        if (live(pid)) set({ project: p });
      }
    },

    patchProject(patch) {
      const p = get().project;
      if (p) set({ project: { ...p, ...patch } });
    },

    // ── Setup ───────────────────────────────────────────────────────────────────────────────────────
    async startIntake() {
      if (get().messages.length || get().intakeBusy) return;
      await get().sendIntake({ action: "start" });
    },

    async sendIntake(body, display) {
      const pid = get().pid;
      if (!pid || get().intakeBusy) return;
      const isRetry = get().intakeFailed === body;
      if (body.action !== "start" && !isRetry) {
        const text =
          display ?? (body.action === "skip_question" ? "Skip this one" : body.action === "skip_all" ? "Skip setup — design it for me" : body.message ?? "");
        set({ messages: [...get().messages, { id: nid("local"), role: "user", text, created_at: new Date().toISOString() }] });
      }
      set({ intakeBusy: true, draft: "", intakeFailed: null });
      const c = controller("intake");
      try {
        await api.intake(
          pid,
          body,
          {
            "message.delta": ({ text }) => live(pid) && set({ draft: (get().draft ?? "") + text }),
            message: (m) => {
              if (!live(pid)) return;
              if (m.role === "user") {
                // The server echoes the user's turn (its wording may differ, e.g. "Skip — you decide.").
                // Keep our optimistic text on screen, but adopt the server's id.
                const msgs = [...get().messages];
                let i = -1;
                for (let k = msgs.length - 1; k >= 0; k--) if (msgs[k].id.startsWith("local-")) { i = k; break; }
                if (i >= 0) msgs[i] = { ...m, text: msgs[i].text };
                else if (!msgs.some((x) => x.id === m.id)) msgs.push(m);
                set({ messages: msgs });
                return;
              }
              set({ messages: [...get().messages.filter((x) => x.id !== m.id), m], draft: null });
            },
            brief: ({ brief, envelope }) => live(pid) && get().patchProject({ brief, envelope }),
            "intake.complete": ({ brief, envelope }) => {
              if (!live(pid)) return;
              const p = get().project;
              get().patchProject({ brief, envelope, stage: p && p.stage === "setup" ? "concepts" : p?.stage });
              // Give "Untitled home" a name people recognise in the workspace, e.g. "10 marla house, Johar Town".
              if (p && /^untitled (home|project)$/i.test(p.name.trim()) && brief?.plot?.area_marla) {
                const size = plotLabel(brief.plot.area_marla).replace(/^\w/, (c) => c.toUpperCase());
                void get().rename(`${size} house, ${brief.scheme || brief.city || "Lahore"}`);
              }
            },
          },
          { signal: c.signal, idleTimeoutMs: 90_000 },
        );
      } catch (e) {
        if (isAbortError(e) || !live(pid)) return;
        set({ intakeFailed: body });
        toast.error("The AI architect couldn't reply", e, { label: "Try again", run: () => void get().retryIntake() });
      } finally {
        if (live(pid)) {
          const draft = get().draft;
          // If the stream ended mid-message, keep what was said rather than dropping it.
          if (draft && draft.trim()) {
            set({ messages: [...get().messages, { id: nid("partial"), role: "assistant", text: draft, created_at: new Date().toISOString() }] });
          }
          set({ intakeBusy: false, draft: null });
          void get().refresh();
        }
      }
    },

    async retryIntake() {
      const body = get().intakeFailed;
      if (body) await get().sendIntake(body);
    },

    // ── Concepts ────────────────────────────────────────────────────────────────────────────────────
    async generateConcepts(body = { count: 4 }) {
      const pid = get().pid;
      if (!pid || get().conceptRun?.running) return;
      const count = body.count ?? 4;
      const runId = nid("run");
      const run: ConceptRun = {
        id: runId,
        instruction: body.instruction,
        baseId: body.base_concept_id,
        running: true,
        startedAt: Date.now(),
        slots: Array.from({ length: count }, (_, i) => ({ key: `${runId}-${i}`, index: i, status: "drawing" })),
      };
      set({ conceptRun: run });
      const updateSlot = (index: number, patch: Partial<ConceptSlot>) => {
        const r = get().conceptRun;
        if (!r || r.id !== runId) return;
        set({ conceptRun: { ...r, slots: r.slots.map((s) => (s.index === index ? { ...s, ...patch } : s)) } });
      };
      const c = controller("concepts");
      try {
        await api.generateConcepts(
          pid,
          { ...body, count },
          {
            "concept.started": ({ index, prompt }) => live(pid) && updateSlot(index, { prompt }),
            concept: ({ index, concept }) => {
              if (!live(pid)) return;
              const p = get().project;
              if (p && !p.concepts.some((x) => x.id === concept.id)) {
                get().patchProject({ concepts: [...p.concepts, concept], thumbnail_url: p.thumbnail_url ?? concept.url });
              }
              updateSlot(index, { status: "done", conceptId: concept.id });
            },
            "concept.failed": ({ index, message }) => live(pid) && updateSlot(index, { status: "failed", message }),
          },
          { signal: c.signal, idleTimeoutMs: 120_000 },
        );
      } catch (e) {
        if (isAbortError(e) || !live(pid)) return;
        const r = get().conceptRun;
        if (r?.id === runId) set({ conceptRun: { ...r, slots: r.slots.map((s) => (s.status === "drawing" ? { ...s, status: "failed", message: errorMessage(e) } : s)) } });
        toast.error("Concept generation stopped", e, { label: "Try again", run: () => void get().generateConcepts(body) });
      } finally {
        const r = get().conceptRun;
        if (live(pid) && r?.id === runId) set({ conceptRun: { ...r, running: false } });
        if (live(pid)) void get().refresh();
      }
    },

    async selectConcept(cid) {
      const pid = get().pid;
      if (!pid) return false;
      try {
        const project = await api.selectConcept(pid, cid);
        if (live(pid)) set({ project });
        return true;
      } catch (e) {
        toast.error("Couldn't select that concept", e);
        return false;
      }
    },

    // ── Design ──────────────────────────────────────────────────────────────────────────────────────
    async runDesign() {
      const pid = get().pid;
      if (!pid || get().design.status === "running") return;
      set({ design: { ...idleRun(), status: "running", startedAt: Date.now() } });
      get().patchProject({ stage: "planning" });
      await drive(pid, () => "design", (h, o) => api.design(pid, h, o), () => void get().runDesign());
    },

    async resumeRun() {
      const pid = get().pid;
      const p = get().project;
      if (!pid || !p || get().design.status === "running" || get().revise.status === "running") return;
      // The project stage says which pipeline is running; the first stage event confirms it.
      let key: RunKey = p.stage === "revising" ? "revise" : "design";
      let decided = false;
      set({ [key]: { ...idleRun(), status: "running", startedAt: Date.now(), resumed: true } } as Partial<ProjectState>);
      const handlers = (h: SSEHandlers): SSEHandlers => ({
        ...h,
        stage: (data) => {
          if (!decided) {
            decided = true;
            const actual: RunKey = data.stage === "changes" ? "revise" : data.stage === "plan" || data.stage === "fix" ? "design" : key;
            if (actual !== key) {
              set({ [key]: idleRun(), [actual]: { ...get()[key], status: "running" } } as Partial<ProjectState>);
              key = actual;
            }
          }
          h.stage?.(data);
        },
      });
      const attached = await drive(
        pid,
        () => key,
        async (h, o) => api.resumeRun(pid, handlers(h), o),
        () => void get().resumeRun(),
      );
      if (attached === false && live(pid)) {
        // Nothing in flight (finished, or the server restarted): settle the UI on the saved state.
        set({ [key]: idleRun() } as Partial<ProjectState>);
      }
    },

    async loadVersion(vid) {
      const cached = get().versions[vid];
      if (cached) return cached;
      const pid = get().pid;
      if (!pid) return null;
      try {
        const v = await api.getVersion(pid, vid);
        if (live(pid)) set({ versions: { ...get().versions, [vid]: v } });
        return v;
      } catch (e) {
        toast.error("Couldn't load that version", e);
        return null;
      }
    },

    cacheVersion(v) {
      set({ versions: { ...get().versions, [v.id]: v } });
    },

    // ── Comments ────────────────────────────────────────────────────────────────────────────────────
    async loadComments(versionId) {
      const pid = get().pid;
      if (!pid) return;
      try {
        const comments = await api.listComments(pid, versionId);
        if (live(pid)) set({ comments, commentsFor: versionId });
      } catch (e) {
        toast.error("Couldn't load comments", e);
      }
    },

    async addComment(body) {
      const pid = get().pid;
      if (!pid) return null;
      try {
        const c = await api.createComment(pid, body);
        if (live(pid)) set({ comments: [...get().comments, c] });
        return c;
      } catch (e) {
        toast.error("Couldn't save the comment", e);
        return null;
      }
    },

    async updateComment(cid, patch) {
      const pid = get().pid;
      if (!pid) return;
      const before = get().comments;
      set({ comments: before.map((c) => (c.id === cid ? { ...c, ...patch } : c)) });
      try {
        const c = await api.updateComment(pid, cid, patch);
        if (live(pid)) set({ comments: get().comments.map((x) => (x.id === cid ? c : x)) });
      } catch (e) {
        if (live(pid)) set({ comments: before });
        toast.error("Couldn't update the comment", e);
      }
    },

    async deleteComment(cid) {
      const pid = get().pid;
      if (!pid) return;
      const before = get().comments;
      set({ comments: before.filter((c) => c.id !== cid) });
      try {
        await api.deleteComment(pid, cid);
      } catch (e) {
        if (live(pid)) set({ comments: before });
        toast.error("Couldn't delete the comment", e);
      }
    },

    // ── Revise ──────────────────────────────────────────────────────────────────────────────────────
    async runRevise(versionId, commentIds) {
      const pid = get().pid;
      if (!pid || get().revise.status === "running") return;
      set({ revise: { ...idleRun(), status: "running", startedAt: Date.now(), baseVersionId: versionId } });
      get().patchProject({ stage: "revising" });
      await drive(
        pid,
        () => "revise",
        (h, o) => api.revise(pid, { version_id: versionId, comment_ids: commentIds }, h, o),
        () => void get().runRevise(versionId, commentIds),
      );
    },
  };
});

export function conceptById(project: Project | null, id: string | null | undefined): Concept | undefined {
  return id ? project?.concepts.find((c) => c.id === id) : undefined;
}
