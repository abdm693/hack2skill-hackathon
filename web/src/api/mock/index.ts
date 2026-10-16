/** Mock implementation of the Api interface (VITE_MOCK=1). */
import type { Comment, Project } from "@contracts/api-types";
import type { Api } from "../client";
import { ApiError } from "../errors";
import { clone, db, findProject, latency, now, save, sleep, touch, uid } from "./db";
import { RENDER_IMAGE } from "./fixtures";
import { intakeScript } from "./intake";
import { envelopeFor, recheck } from "./lda";
import { conceptsScript, designScript, reviseScript } from "./scripts";
import { seedIfEmpty } from "./seed";
import { play } from "./stream";

function wrap<T>(fn: () => T): T {
  try {
    return fn();
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    throw new ApiError(e instanceof Error ? e.message : "Mock error", status);
  }
}

function newProject(name?: string): Project {
  const t = now();
  return {
    id: uid("p"),
    name: name?.trim() || "Untitled home",
    created_at: t,
    updated_at: t,
    stage: "setup",
    brief: null,
    envelope: null,
    concepts: [],
    selected_concept_id: null,
    versions: [],
    current_version_id: null,
    thumbnail_url: null,
  };
}

/** Shrink a PNG data URL to a small JPEG so snapshots fit in localStorage. */
async function thumbnail(dataUrl: string, maxW = 480): Promise<string> {
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const scale = Math.min(1, maxW / img.naturalWidth);
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.72);
  } catch {
    return dataUrl;
  }
}

export const mockApi: Api = {
  mock: true,

  async health() {
    await latency(60);
    return { ok: true, models: { mode: "mock" } };
  },

  async listProjects() {
    await latency();
    seedIfEmpty();
    return clone([...db().projects].sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  },

  async createProject(name) {
    await latency(260);
    const p = newProject(name);
    db().projects.push(p);
    save();
    return clone(p);
  },

  async getProject(pid) {
    await latency(120);
    seedIfEmpty();
    return wrap(() => clone(findProject(pid)));
  },

  async updateProject(pid, patch) {
    await latency();
    return wrap(() => {
      const p = findProject(pid);
      if (patch.name !== undefined) p.name = patch.name.trim() || p.name;
      if (patch.brief) {
        p.brief = clone(patch.brief);
        const { width_ft, depth_ft, corner } = patch.brief.plot;
        p.envelope = width_ft && depth_ft ? envelopeFor(width_ft, depth_ft, corner, patch.brief.authority) : null;
        const st = db().intake[pid];
        if (st) st.brief = clone(patch.brief);
      }
      touch(p);
      save();
      return clone(p);
    });
  },

  async deleteProject(pid) {
    await latency();
    const d = db();
    const p = d.projects.find((x) => x.id === pid);
    d.projects = d.projects.filter((x) => x.id !== pid);
    delete d.messages[pid];
    delete d.comments[pid];
    delete d.intake[pid];
    for (const v of p?.versions ?? []) delete d.versions[v.id];
    save();
  },

  async getMessages(pid) {
    await latency(120);
    return clone(db().messages[pid] ?? []);
  },

  intake(pid, body, handlers, opts) {
    return play(intakeScript(pid, body), handlers, opts?.signal);
  },

  async getEnvelope(q) {
    await sleep(60);
    return envelopeFor(q.width_ft, q.depth_ft, q.corner, q.authority);
  },

  async checkPlan(plan) {
    await latency(400);
    return recheck(plan);
  },

  generateConcepts(pid, body, handlers, opts) {
    return play(conceptsScript(pid, body), handlers, opts?.signal);
  },

  async selectConcept(pid, cid) {
    await latency(220);
    return wrap(() => {
      const p = findProject(pid);
      const c = p.concepts.find((x) => x.id === cid);
      if (!c) throw Object.assign(new Error("Concept not found."), { status: 404 });
      p.selected_concept_id = cid;
      p.thumbnail_url = c.url;
      if (p.stage === "setup") p.stage = "concepts";
      touch(p);
      save();
      return clone(p);
    });
  },

  design(pid, handlers, opts) {
    return play(designScript(pid), handlers, opts?.signal);
  },

  async getVersion(pid, vid) {
    await latency(150);
    return wrap(() => {
      const v = db().versions[vid];
      if (!v) throw Object.assign(new Error("Version not found."), { status: 404 });
      return clone(v);
    });
  },

  async repairSection(pid, vid, body, handlers, opts) {
    const v = db().versions[vid];
    const index = v?.sections.findIndex((s) => s.name === body.section) ?? -1;
    async function* script() {
      yield 1200;
      if (v && index >= 0) yield { event: "section" as const, data: { section: v.sections[index], index } };
      yield { event: "done" as const, data: {} };
    }
    return play(script(), handlers, opts?.signal);
  },

  async asBuilt(pid, vid) {
    await latency(300);
    return wrap(() => {
      const v = db().versions[vid];
      if (!v) throw Object.assign(new Error("Version not found."), { status: 404 });
      return clone(v.compliance);
    });
  },

  async listComments(pid, versionId) {
    await latency(120);
    const list = db().comments[pid] ?? [];
    return clone(versionId ? list.filter((c) => c.version_id === versionId) : list);
  },

  async createComment(pid, body) {
    await latency(240);
    const snapshot = body.snapshot_data_url ? await thumbnail(body.snapshot_data_url) : undefined;
    const c: Comment = {
      id: uid("cm"),
      version_id: body.version_id,
      text: body.text,
      anchor: body.anchor,
      camera: body.camera,
      snapshot_url: snapshot,
      created_at: now(),
      status: "open",
    };
    (db().comments[pid] ??= []).push(c);
    const p = db().projects.find((x) => x.id === pid);
    if (p) touch(p);
    save();
    return clone(c);
  },

  async updateComment(pid, cid, patch) {
    await latency();
    return wrap(() => {
      const c = (db().comments[pid] ?? []).find((x) => x.id === cid);
      if (!c) throw Object.assign(new Error("Comment not found."), { status: 404 });
      if (patch.text !== undefined) c.text = patch.text;
      if (patch.status) c.status = patch.status;
      save();
      return clone(c);
    });
  },

  async deleteComment(pid, cid) {
    await latency();
    const d = db();
    d.comments[pid] = (d.comments[pid] ?? []).filter((c) => c.id !== cid);
    save();
  },

  revise(pid, body, handlers, opts) {
    return play(reviseScript(pid, body.version_id, body.comment_ids), handlers, opts?.signal);
  },

  async resumeRun() {
    // Mock runs live in the page that started them; after a reload there is nothing to re-attach to.
    await latency(80);
    return false;
  },

  async render() {
    await sleep(6500);
    return { url: RENDER_IMAGE };
  },

  async saveThumbnail(pid, vid, imageDataUrl) {
    const url = await thumbnail(imageDataUrl, 640);
    const d = db();
    const v = d.versions[vid];
    if (v) v.thumbnail_url = url;
    const p = d.projects.find((x) => x.id === pid);
    if (p) { p.thumbnail_url = url; touch(p); }
    save();
    return { url };
  },
};
