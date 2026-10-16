/**
 * Flow state (track: APP-FLOWS): the long-running streams behind the views — concepts, night variants,
 * the design run and revisions — plus small caches (versions, comments). Streams live here, not in a view,
 * so they keep running while people move between Brief, Concepts, Plan, House and Revisions, and a reload
 * re-attaches to an in-flight design or revision (GET /run).
 *
 * Views stay pure `{ project, onProjectChange }`: each mounted view binds itself with `useFlowBinding`, and
 * the flow pushes project changes (new concepts, a new version, the stage) through it.
 *
 * For the shell's dock: `useNaqshaActivity()` says whether Naqsha is working and the line to narrate.
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import { create } from "zustand";
import type { Change, Comment, Concept, DesignSection, Project, Version } from "@contracts/api-types";
import type { BuildingPlan, ComplianceReport } from "@contracts/plan";
import { api, errorMessage, isAbortError, type ConceptsBody, type NewComment, type SSEHandlers } from "@/api/client";
import { conceptsNight, revise as reviseApi, type ReviseBody } from "./endpoints";
import { notify } from "./kit";
import { failures, humanize, namedStage, plural, sectionPhrase, type NamedStage } from "./words";

// ── Types ───────────────────────────────────────────────────────────────────────────────────────────

export interface Activity {
  id: string;
  at: number;
  text: string;
  tone: "default" | "pass" | "warn" | "fail";
  kind: "stage" | "plan" | "check" | "section" | "changes" | "comment" | "version" | "error";
}

export interface Run {
  kind: "design" | "revise";
  pid: string;
  status: "running" | "done" | "error";
  startedAt: number;
  resumed: boolean;
  /** Last raw pipeline stage ("plan", "fix", "compliance", "review", "build", "save", "changes"). */
  stage: string | null;
  reached: NamedStage[];
  plan?: BuildingPlan;
  planAttempt?: number;
  compliance?: ComplianceReport;
  complianceAttempt?: number;
  /** Failures per compliance attempt, e.g. [5, 1, 0]. */
  failures: number[];
  sections: DesignSection[];
  changes?: Change[];
  resolved: Comment[];
  version?: Version;
  error?: string;
  activity: Activity[];
  baseVersionId?: string;
  instruction?: string;
  commentIds?: string[];
}

export interface ConceptSlot { key: string; index: number; status: "drawing" | "done" | "failed"; conceptId?: string; message?: string }
export interface ConceptRun { id: string; pid: string; instruction?: string; baseId?: string; slots: ConceptSlot[]; running: boolean; startedAt: number }
export interface NightRun { pid: string; ids: string[]; done: string[]; failed: string[]; running: boolean; startedAt: number }

interface FlowState {
  pid: string | null;
  design: Run | null;
  revise: Run | null;
  concepts: ConceptRun | null;
  night: NightRun | null;
  /** Night images by concept id (also merged into project.concepts when a view is bound). */
  nightUrls: Record<string, string>;
  versions: Record<string, Version>;
  comments: Record<string, Comment[]>;
}

export const useFlow = create<FlowState>(() => ({
  pid: null,
  design: null,
  revise: null,
  concepts: null,
  night: null,
  nightUrls: {},
  versions: {},
  comments: {},
}));

// ── Binding to the mounted view ─────────────────────────────────────────────────────────────────────

let sink: { get: () => Project; set: (p: Project) => void } | null = null;
const controllers = new Map<string, AbortController>();

function controller(key: string) {
  controllers.get(key)?.abort();
  const c = new AbortController();
  controllers.set(key, c);
  return c;
}

function bind(pid: string) {
  if (useFlow.getState().pid === pid) return;
  for (const c of controllers.values()) c.abort();
  controllers.clear();
  useFlow.setState({ pid, design: null, revise: null, concepts: null, night: null, nightUrls: {}, versions: {}, comments: {} });
}

const live = (pid: string) => useFlow.getState().pid === pid;

export function patchProject(pid: string, patch: Partial<Project> | ((p: Project) => Partial<Project>)) {
  if (!sink || !live(pid)) return;
  const cur = sink.get();
  if (cur.id !== pid) return;
  const next = typeof patch === "function" ? patch(cur) : patch;
  sink.set({ ...cur, ...next });
}

export async function refreshProject(pid: string) {
  try {
    const p = await api.getProject(pid);
    if (sink && live(pid) && sink.get().id === pid) sink.set(p);
  } catch (e) {
    if (!isAbortError(e)) console.warn("[flow] refresh failed", e);
  }
}

/**
 * Every view calls this with its props: it binds the flow to the project and lets streams that outlive
 * the view push project changes into whichever view is on screen.
 */
export function useFlowBinding(project: Project, onProjectChange: (p: Project) => void) {
  const ref = useRef({ project, onProjectChange });
  ref.current = { project, onProjectChange };
  useLayoutEffect(() => bind(project.id), [project.id]);
  useEffect(() => {
    const mine = { get: () => ref.current.project, set: (p: Project) => ref.current.onProjectChange(p) };
    sink = mine;
    return () => {
      if (sink === mine) sink = null;
    };
  }, []);
}

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────

let seq = 0;
const nid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

function newRun(kind: Run["kind"], pid: string, extra: Partial<Run> = {}): Run {
  return { kind, pid, status: "running", startedAt: Date.now(), resumed: false, stage: null, reached: [], failures: [], sections: [], resolved: [], activity: [], ...extra };
}

type RunKey = "design" | "revise";

function patchRun(key: RunKey, pid: string, patch: Partial<Run> | ((r: Run) => Partial<Run>)) {
  const r = useFlow.getState()[key];
  if (!r || r.pid !== pid || !live(pid)) return;
  const next = typeof patch === "function" ? patch(r) : patch;
  useFlow.setState({ [key]: { ...r, ...next } } as Partial<FlowState>);
}

function pushActivity(key: RunKey, pid: string, a: Omit<Activity, "id" | "at">) {
  patchRun(key, pid, (r) => {
    const last = r.activity[r.activity.length - 1];
    if (last && last.text === a.text && last.kind === a.kind) return {};
    return { activity: [...r.activity, { ...a, id: nid("a"), at: Date.now() }] };
  });
}

const STATUS_WORD: Record<Comment["status"], string> = { open: "Open", resolved: "Done", partial: "Alternative offered", rejected: "Not possible" };

function basePlan(key: RunKey): BuildingPlan | undefined {
  const s = useFlow.getState();
  const r = s[key];
  const base = r?.baseVersionId ? s.versions[r.baseVersionId] : undefined;
  return r?.plan ?? base?.plan;
}

/** What a design-run stage says to people. */
function designStageLine(stage: string, r: Run): string {
  switch (stage) {
    case "plan":
      return "Laying out the floors";
    case "fix": {
      const n = r.failures[r.failures.length - 1] ?? 0;
      return n ? `Fixing ${plural(n, "issue")}` : "Refining the plan";
    }
    case "compliance":
      return "Checking LDA and livability rules";
    case "review":
    case "critique":
    case "self_review":
      return "Reviewing it like an architect";
    case "build":
      return "Building the house in 3D";
    case "save":
      return "Saving the new version";
    default:
      return humanize(stage);
  }
}

/** Handlers shared by POST /design, POST /revise and GET /run. */
function runHandlers(pid: string, key: () => RunKey): SSEHandlers {
  return {
    stage: ({ stage, message }) => {
      const k = key();
      const named = namedStage(stage);
      patchRun(k, pid, (r) => ({ stage, reached: named && !r.reached.includes(named) ? [...r.reached, named] : r.reached }));
      const r = useFlow.getState()[k];
      if (!r) return;
      const text = k === "design" ? designStageLine(stage, r) : humanize(message || designStageLine(stage, r), basePlan(k));
      pushActivity(k, pid, { kind: "stage", text, tone: "default" });
      if (k === "design" && stage === "build") patchProject(pid, { stage: "building" });
    },
    plan: ({ plan, attempt }) => {
      const k = key();
      patchRun(k, pid, { plan, planAttempt: attempt });
      if (k === "revise") pushActivity(k, pid, { kind: "plan", text: "Updated the plan", tone: "default" });
    },
    compliance: ({ report, attempt }) => {
      const k = key();
      const n = failures(report);
      patchRun(k, pid, (r) => ({ compliance: report, complianceAttempt: attempt, failures: [...r.failures, n] }));
      const total = report.checks.length;
      pushActivity(k, pid, n
        ? { kind: "check", text: `${plural(n, "rule")} to fix: ${report.checks.filter((c) => c.status === "fail").slice(0, 2).map((c) => c.title.toLowerCase()).join(", ")}`, tone: "warn" }
        : { kind: "check", text: `All ${total} checks pass`, tone: "pass" });
    },
    section: ({ section }) => {
      const k = key();
      patchRun(k, pid, (r) => ({
        sections: r.sections.some((s) => s.name === section.name) ? r.sections.map((s) => (s.name === section.name ? section : s)) : [...r.sections, section],
      }));
      if (k === "revise") {
        const phrase = sectionPhrase(section.name, basePlan(k));
        pushActivity(k, pid, { kind: "section", text: `Redrew ${phrase}`, tone: "default" });
      }
    },
    changes: ({ changes }) => {
      const k = key();
      patchRun(k, pid, { changes });
      if (changes.length) pushActivity(k, pid, { kind: "changes", text: `Planned ${plural(changes.length, "change")}`, tone: "default" });
    },
    comment: ({ comment }) => {
      const k = key();
      patchRun(k, pid, (r) => ({ resolved: [...r.resolved.filter((c) => c.id !== comment.id), comment] }));
      const s = useFlow.getState();
      const list = s.comments[comment.version_id];
      if (list) useFlow.setState({ comments: { ...s.comments, [comment.version_id]: list.map((c) => (c.id === comment.id ? comment : c)) } });
      const quote = comment.text.length > 60 ? `${comment.text.slice(0, 58).trim()}…` : comment.text;
      pushActivity(k, pid, {
        kind: "comment",
        text: `“${quote}”: ${STATUS_WORD[comment.status]}`,
        tone: comment.status === "resolved" ? "pass" : comment.status === "rejected" ? "fail" : comment.status === "partial" ? "warn" : "default",
      });
    },
    version: ({ version }) => {
      const k = key();
      useFlow.setState((s) => ({ versions: { ...s.versions, [version.id]: version } }));
      if (k === "design") saveFixLoop(version.id, useFlow.getState().design?.failures ?? []);
      patchRun(k, pid, k === "design" ? { version, plan: version.plan, compliance: version.compliance, sections: version.sections } : { version });
      pushActivity(k, pid, { kind: "version", text: `Saved version ${version.n}`, tone: "pass" });
      patchProject(pid, (p) => ({
        versions: p.versions.some((v) => v.id === version.id)
          ? p.versions
          : [...p.versions, { id: version.id, n: version.n, created_at: version.created_at, status: version.status }],
        current_version_id: version.id,
        stage: "ready",
      }));
    },
  };
}

async function drive(pid: string, key: () => RunKey, open: (h: SSEHandlers, signal: AbortSignal) => Promise<unknown>, retry: () => void) {
  const c = controller(`run-${key()}`);
  try {
    const result = await open(runHandlers(pid, key), c.signal);
    const k = key();
    if (live(pid) && useFlow.getState()[k]?.status === "running") patchRun(k, pid, { status: "done" });
    return result;
  } catch (e) {
    if (isAbortError(e) || !live(pid)) return undefined;
    const k = key();
    const message = errorMessage(e);
    pushActivity(k, pid, { kind: "error", text: message, tone: "fail" });
    patchRun(k, pid, { status: "error", error: message });
    notify.error(k === "design" ? "The design stopped" : "The revision stopped", e, { label: "Try again", run: retry });
    return undefined;
  } finally {
    if (live(pid)) void refreshProject(pid);
  }
}

// ── Actions ─────────────────────────────────────────────────────────────────────────────────────────

export const flow = {
  /** Start a design run (plan → check → review → build). */
  async design(pid: string) {
    bind(pid);
    if (useFlow.getState().design?.status === "running") return;
    useFlow.setState({ design: newRun("design", pid) });
    patchProject(pid, { stage: "planning" });
    await drive(pid, () => "design", (h, signal) => api.design(pid, h, { signal }), () => void flow.design(pid));
  },

  /** Revise a version from comments, a typed instruction, or both. */
  async revise(pid: string, body: ReviseBody) {
    bind(pid);
    if (useFlow.getState().revise?.status === "running") {
      notify.info("Naqsha is still working on the last change", "I'll take this one when it's done.");
      return;
    }
    useFlow.setState({ revise: newRun("revise", pid, { baseVersionId: body.version_id, instruction: body.instruction, commentIds: body.comment_ids }) });
    void flow.loadVersion(pid, body.version_id);
    patchProject(pid, { stage: "revising" });
    await drive(pid, () => "revise", (h, signal) => reviseApi(pid, body, h, { signal }), () => void flow.revise(pid, body));
  },

  /** Re-attach to the project's in-flight design or revision after a reload (GET /run). */
  async resume(project: Project) {
    const pid = project.id;
    bind(pid);
    const s = useFlow.getState();
    if (s.design?.status === "running" || s.revise?.status === "running") return;
    if (!["planning", "building", "revising"].includes(project.stage)) return;
    let key: RunKey = project.stage === "revising" ? "revise" : "design";
    let decided = false;
    useFlow.setState({ [key]: newRun(key, pid, { resumed: true, baseVersionId: key === "revise" ? project.current_version_id ?? undefined : undefined }) } as Partial<FlowState>);
    const attached = await drive(
      pid,
      () => key,
      (h, signal) =>
        api.resumeRun(
          pid,
          {
            ...h,
            stage: (data) => {
              if (!decided) {
                decided = true;
                const actual: RunKey = data.stage === "changes" ? "revise" : data.stage === "plan" ? "design" : key;
                if (actual !== key) {
                  const cur = useFlow.getState()[key];
                  useFlow.setState({ [key]: null, [actual]: cur ? { ...cur, kind: actual } : newRun(actual, pid, { resumed: true }) } as Partial<FlowState>);
                  key = actual;
                }
              }
              h.stage?.(data);
            },
          },
          { signal },
        ),
      () => void flow.resume(project),
    );
    if (attached === false && live(pid)) useFlow.setState({ [key]: null } as Partial<FlowState>);
  },

  async concepts(pid: string, body: ConceptsBody = { count: 4 }) {
    bind(pid);
    if (useFlow.getState().concepts?.running) return;
    const count = body.count ?? 4;
    const id = nid("cr");
    const run: ConceptRun = {
      id,
      pid,
      instruction: body.instruction,
      baseId: body.base_concept_id,
      running: true,
      startedAt: Date.now(),
      slots: Array.from({ length: count }, (_, i) => ({ key: `${id}-${i}`, index: i, status: "drawing" })),
    };
    useFlow.setState({ concepts: run });
    const slot = (index: number, patch: Partial<ConceptSlot>) => {
      const r = useFlow.getState().concepts;
      if (!r || r.id !== id) return;
      useFlow.setState({ concepts: { ...r, slots: r.slots.map((s) => (s.index === index ? { ...s, ...patch } : s)) } });
    };
    const c = controller("concepts");
    try {
      await api.generateConcepts(
        pid,
        { ...body, count },
        {
          concept: ({ index, concept }) => {
            if (!live(pid)) return;
            patchProject(pid, (p) => ({
              concepts: p.concepts.some((x) => x.id === concept.id) ? p.concepts : [...p.concepts, concept],
              thumbnail_url: p.thumbnail_url ?? concept.url,
              stage: p.stage === "setup" ? "concepts" : p.stage,
            }));
            slot(index, { status: "done", conceptId: concept.id });
          },
          "concept.failed": ({ index, message }) => live(pid) && slot(index, { status: "failed", message }),
        },
        { signal: c.signal, idleTimeoutMs: 120_000 },
      );
    } catch (e) {
      if (isAbortError(e) || !live(pid)) return;
      const r = useFlow.getState().concepts;
      if (r?.id === id) useFlow.setState({ concepts: { ...r, slots: r.slots.map((s) => (s.status === "drawing" ? { ...s, status: "failed", message: errorMessage(e) } : s)) } });
      notify.error("The concepts stopped", e, { label: "Try again", run: () => void flow.concepts(pid, body) });
    } finally {
      const r = useFlow.getState().concepts;
      if (live(pid) && r?.id === id) useFlow.setState({ concepts: { ...r, running: false } });
      if (live(pid)) void refreshProject(pid);
    }
  },

  /** Night images for these concepts (lazy, the first time someone switches to Night). */
  async night(pid: string, ids: string[]) {
    bind(pid);
    const s = useFlow.getState();
    const todo = ids.filter((id) => !s.nightUrls[id]);
    if (!todo.length || s.night?.running) return;
    useFlow.setState({ night: { pid, ids: todo, done: [], failed: [], running: true, startedAt: Date.now() } });
    const c = controller("night");
    const mark = (field: "done" | "failed", id: string) => {
      const n = useFlow.getState().night;
      if (n && n.pid === pid && !n[field].includes(id)) useFlow.setState({ night: { ...n, [field]: [...n[field], id] } });
    };
    try {
      await conceptsNight(
        pid,
        todo,
        {
          concept: ({ concept }) => {
            if (!live(pid) || !concept.night_url) return;
            useFlow.setState((st) => ({ nightUrls: { ...st.nightUrls, [concept.id]: concept.night_url! } }));
            patchProject(pid, (p) => ({ concepts: p.concepts.map((x) => (x.id === concept.id ? { ...x, night_url: concept.night_url } : x)) }));
            mark("done", concept.id);
          },
          "concept.failed": ({ index }) => {
            const id = todo[index];
            if (id) mark("failed", id);
          },
        },
        { signal: c.signal },
      );
    } catch (e) {
      if (isAbortError(e) || !live(pid)) return;
      const n = useFlow.getState().night;
      if (n) useFlow.setState({ night: { ...n, failed: n.ids.filter((id) => !n.done.includes(id)) } });
      const status = (e as { status?: number }).status;
      if (status === 404 || status === 405) notify.info("Night views aren't ready on this server yet", "The day views are shown instead.");
      else notify.error("The night views didn't come back", e, { label: "Try again", run: () => void flow.night(pid, ids) });
    } finally {
      const n = useFlow.getState().night;
      if (n && n.pid === pid) {
        const missing = n.ids.filter((id) => !n.done.includes(id) && !n.failed.includes(id));
        useFlow.setState({ night: { ...n, running: false, failed: [...n.failed, ...missing] } });
      }
    }
  },

  async loadVersion(pid: string, vid: string): Promise<Version | null> {
    const cached = useFlow.getState().versions[vid];
    if (cached) return cached;
    try {
      const v = await api.getVersion(pid, vid);
      if (live(pid)) useFlow.setState((s) => ({ versions: { ...s.versions, [vid]: v } }));
      return v;
    } catch (e) {
      notify.error("Couldn't open that version", e);
      return null;
    }
  },

  cacheVersion(v: Version) {
    useFlow.setState((s) => ({ versions: { ...s.versions, [v.id]: v } }));
  },

  async loadComments(pid: string, vid: string, force = false): Promise<Comment[]> {
    const cached = useFlow.getState().comments[vid];
    if (cached && !force) return cached;
    try {
      const list = await api.listComments(pid, vid);
      if (live(pid)) useFlow.setState((s) => ({ comments: { ...s.comments, [vid]: list } }));
      return list;
    } catch (e) {
      if (!isAbortError(e)) console.warn("[flow] comments failed", e);
      return cached ?? [];
    }
  },

  async addComment(pid: string, body: NewComment): Promise<Comment | null> {
    try {
      const c = await api.createComment(pid, body);
      if (live(pid)) useFlow.setState((s) => ({ comments: { ...s.comments, [body.version_id]: [...(s.comments[body.version_id] ?? []), c] } }));
      return c;
    } catch (e) {
      notify.error("Couldn't save the comment", e);
      return null;
    }
  },

  /** Clear a finished run (e.g. after the person has seen its outcome). */
  clear(key: RunKey) {
    const r = useFlow.getState()[key];
    if (r && r.status !== "running") useFlow.setState({ [key]: null } as Partial<FlowState>);
  },
};

// ── Fix loop memory ─────────────────────────────────────────────────────────────────────────────────

/** The fix loop is only streamed live; remember it per version in this browser (same key as before the overhaul). */
const loopKey = (vid: string) => `naqsha.fixloop.${vid}`;

function saveFixLoop(vid: string, fails: number[]) {
  if (fails.length < 2) return;
  try { localStorage.setItem(loopKey(vid), JSON.stringify(fails)); } catch { /* private mode */ }
}

export function fixLoopOf(vid: string | null | undefined): number[] | undefined {
  if (!vid) return undefined;
  const run = useFlow.getState().design;
  if (run?.version?.id === vid && run.failures.length > 1) return run.failures;
  try {
    const v = JSON.parse(localStorage.getItem(loopKey(vid)) ?? "null") as unknown;
    return Array.isArray(v) && v.every((n) => typeof n === "number") ? (v as number[]) : undefined;
  } catch {
    return undefined;
  }
}

// ── Selectors ───────────────────────────────────────────────────────────────────────────────────────

/** The line the dock narrates while Naqsha works ("Fixing 2 issues", "Building the house in 3D · 14 parts"). */
export function narration(run: Run | null | undefined): string | null {
  if (!run || run.status !== "running") return null;
  if (run.kind === "revise") return run.activity[run.activity.length - 1]?.text ?? "Reading your changes";
  const stage = run.stage;
  if (!stage) return run.resumed ? "Picking up where I left off" : "Reading the brief";
  if (stage === "build") return run.sections.length ? `Building the house in 3D · ${plural(run.sections.length, "part")}` : "Building the house in 3D";
  return designStageLine(stage, run);
}

/** For the shell's dock: is Naqsha working, and what to say while it does. */
export function useNaqshaActivity(): { busy: boolean; line: string | null } {
  const design = useFlow((s) => s.design);
  const revise = useFlow((s) => s.revise);
  const concepts = useFlow((s) => s.concepts);
  const night = useFlow((s) => s.night);
  if (revise?.status === "running") return { busy: true, line: narration(revise) };
  if (design?.status === "running") return { busy: true, line: narration(design) };
  if (concepts?.running) {
    const done = concepts.slots.filter((s) => s.status === "done").length;
    return { busy: true, line: concepts.baseId ? "Remixing the concept" : `Drawing concepts · ${done} of ${concepts.slots.length}` };
  }
  if (night?.running) return { busy: true, line: "Turning the lights on" };
  return { busy: false, line: null };
}

/** Concepts with any night image the flow fetched merged in. */
export function withNight(concepts: Concept[], nightUrls: Record<string, string>): Concept[] {
  return concepts.map((c) => (c.night_url || !nightUrls[c.id] ? c : { ...c, night_url: nightUrls[c.id] }));
}
