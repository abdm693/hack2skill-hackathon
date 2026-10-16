/**
 * Mock streams for concepts, design and revise. Event order and shapes follow the live API
 * (api/app/agents/*): design runs plan → LDA check → fix loop (5 → 1 → 0 failures) → 23 sections → save;
 * revise streams the ADK agent's tool activity as `stage` lines, then changes, comment resolutions and a version.
 * Timings are compressed versions of the real ones (scale with localStorage["naqsha.mock.speed"]).
 */
import type { Change, Comment, Concept, DesignSection, Version } from "@contracts/api-types";
import type { BuildingPlan, ComplianceReport } from "@contracts/plan";
import type { ConceptsBody } from "../client";
import { clone, db, findProject, now, save, touch, uid } from "./db";
import { ARGON_SECTIONS, CONCEPT_IMAGES, REMIX_IMAGES, clonePlan, revisedSection } from "./fixtures";
import { ARGON_REPORT, recheck } from "./lda";
import { ev, type Step } from "./stream";

// ── Concepts ────────────────────────────────────────────────────────────────────────────────────────

const VARIATIONS = [
  "white plaster volumes, a full-height grey stone pier, teak soffits and a cantilevered porch canopy",
  "a corner composition with stacked stone, timber cladding and a frameless glass balcony",
  "a deep white frame around the first floor with vertical teak battens and grey stone infill",
  "warm evening light, mirrored massing, teak bands and a stone-clad stair tower",
];

export async function* conceptsScript(pid: string, body: ConceptsBody): AsyncGenerator<Step> {
  const p = findProject(pid);
  const count = Math.max(1, Math.min(4, body.count ?? 4));
  const brief = p.brief;
  const styleName = brief?.style || "Modern Contemporary";
  const where = brief?.scheme ? `${brief.scheme}, Lahore` : "Lahore";
  const size = brief?.plot?.area_marla ? `${Math.round(brief.plot.area_marla)} marla` : "10 marla";
  const base = body.base_concept_id ? p.concepts.find((c) => c.id === body.base_concept_id) : undefined;
  const images = base ? REMIX_IMAGES : CONCEPT_IMAGES;
  const offset = base ? p.concepts.filter((c) => c.parent_id).length : p.concepts.filter((c) => !c.parent_id).length;

  if (p.stage === "setup") p.stage = "concepts";
  save();

  const prompts = Array.from({ length: count }, (_, i) =>
    base
      ? `Remix of the selected concept: ${body.instruction}. Keep the massing, camera and plot; golden hour, photoreal.`
      : `Photoreal golden-hour exterior of a ${size} ${styleName} house in ${where}: ${VARIATIONS[(i + offset) % VARIATIONS.length]}, 4 ft front boundary wall with a sliding gate.`,
  );

  // All four start at once (they run in parallel on the server)…
  for (let i = 0; i < count; i++) yield ev("concept.started", { index: i, prompt: prompts[i] });
  // …and land a few seconds apart (live: ~16–17 s each).
  const finishAt = [7200, 8100, 8900, 9800].slice(0, count);
  let elapsed = 0;
  for (let i = 0; i < count; i++) {
    const wait = Math.max(150, finishAt[i] - elapsed + Math.random() * 500);
    yield wait;
    elapsed += wait;
    const concept: Concept = {
      id: uid("c"),
      url: images[(i + offset) % images.length],
      prompt: prompts[i],
      model: "gemini-3.1-flash-image",
      created_at: now(),
      parent_id: base?.id,
      instruction: body.instruction,
    };
    const proj = findProject(pid);
    proj.concepts.push(concept);
    if (!proj.thumbnail_url) proj.thumbnail_url = concept.url;
    touch(proj);
    save();
    yield ev("concept", { index: i, concept });
  }
  yield ev("done", {});
}

// ── Design ──────────────────────────────────────────────────────────────────────────────────────────

/** Plans for the fix loop: attempt 1 has five under-glazed rooms, attempt 2 one, attempt 3 none. */
const UNDERSIZED: Record<string, number>[] = [
  { g_lounge_w1: 2, f_lounge_w: 3, f_bed3_w: 1.5, f_bed4_w: 1.5, g_guest_w: 1.5 },
  { f_lounge_w: 3 },
  {},
];

function attemptPlan(pid: string, attempt: number): BuildingPlan {
  const plan = clonePlan();
  const brief = findProject(pid).brief;
  if (brief) {
    if (brief.facing) plan.site.facing = brief.facing;
    if (brief.scheme) plan.site.scheme = brief.scheme;
    if (brief.coordinates) plan.site.coordinates = brief.coordinates;
  }
  const narrow = UNDERSIZED[attempt - 1] ?? {};
  for (const o of plan.openings) if (narrow[o.id] !== undefined) o.width_ft = narrow[o.id];
  return plan;
}

function* progressTicks(from: number, to: number, n: number, gap: number): Generator<Step> {
  for (let i = 1; i <= n; i++) {
    yield gap + Math.random() * 300;
    yield ev("progress", { chars: Math.round(from + ((to - from) * i) / n) });
  }
}

export async function* designScript(pid: string): AsyncGenerator<Step> {
  const p = findProject(pid);
  p.stage = "planning";
  touch(p);
  save();

  let plan: BuildingPlan = clonePlan();
  let report: ComplianceReport = ARGON_REPORT;
  // Like the live API, each attempt streams its own character count (a full plan is ~17k characters).
  const sizes = [17_400, 16_800, 17_100];
  for (let attempt = 1; attempt <= 3; attempt++) {
    yield ev("stage", attempt === 1
      ? { stage: "plan", message: "Argon is laying out the floors…" }
      : { stage: "fix", message: `Argon is fixing the plan (attempt ${attempt})…` });
    yield* progressTicks(0, sizes[attempt - 1], attempt === 1 ? 7 : 4, attempt === 1 ? 1150 : 1000);
    yield 500;
    plan = attemptPlan(pid, attempt);
    yield ev("plan", { plan, attempt });
    yield 350;
    yield ev("stage", { stage: "compliance", message: "Checking the plan against LDA regulations…" });
    yield 900;
    report = attempt === 3 ? structuredClone(ARGON_REPORT) : recheck(plan);
    yield ev("compliance", { report, attempt });
    yield 900;
    if (report.ok) break;
  }

  findProject(pid).stage = "building";
  save();
  yield ev("stage", { stage: "build", message: "Argon is writing the 3D model as code…" });
  yield 1200;

  let chars = 0;
  let lastTick = 0;
  const sections: DesignSection[] = [];
  for (let i = 0; i < ARGON_SECTIONS.length; i++) {
    const s = ARGON_SECTIONS[i];
    yield 450 + Math.random() * 900;
    chars += s.code.length + 40;
    if (Math.floor(chars / 3000) !== Math.floor(lastTick / 3000)) yield ev("progress", { chars });
    lastTick = chars;
    sections.push(s);
    yield ev("section", { section: s, index: i });
  }

  yield ev("stage", { stage: "save", message: "Saving version…" });
  yield 700;
  const version = saveVersion(pid, plan, sections, report, `v${findProject(pid).versions.length + 1}: ${plan.rooms.length} spaces, ${sections.length} code sections`);
  yield ev("version", { version });
  yield ev("done", {});
}

function saveVersion(
  pid: string,
  plan: BuildingPlan,
  sections: DesignSection[],
  compliance: ComplianceReport,
  summary: string,
  changes: Change[] = [],
): Version {
  const p = findProject(pid);
  const selected = p.concepts.find((c) => c.id === p.selected_concept_id) ?? p.concepts[0];
  const version: Version = {
    id: uid("v"),
    n: p.versions.length + 1,
    created_at: now(),
    parent_id: p.current_version_id ?? undefined,
    plan,
    sections,
    compliance,
    changes,
    status: "ready",
    thumbnail_url: selected?.url,
  };
  db().versions[version.id] = version;
  p.versions.push({ id: version.id, n: version.n, created_at: version.created_at, status: "ready", summary });
  p.current_version_id = version.id;
  p.stage = "ready";
  p.thumbnail_url = p.thumbnail_url ?? selected?.url ?? null;
  touch(p);
  save();
  return clone(version);
}

// ── Revise (ADK-style agent activity) ───────────────────────────────────────────────────────────────

type Kind = "projection" | "bigger" | "material" | "remove" | "general";

function classify(text: string): Kind {
  const t = text.toLowerCase();
  const outward = /\b(extend|forward|outward|project|cantilever|push (it )?out)|into the (front|lawn|setback|road)|another (floor|storey)|4th|fourth/.test(t);
  if (outward) return "projection";
  if (/bigger|larger|wider|deeper|more space|spacious|enlarge|cramped|small|tight/.test(t)) return "bigger";
  if (/material|wood|marble|stone|colou?r|paint|tile|glass|brick|finish|darker|lighter|louver|cladding/.test(t)) return "material";
  if (/remove|delete|get rid|no need|don't need/.test(t)) return "remove";
  return "general";
}

export const PORCH_REJECTION =
  "Under LDA Building & Zoning Regulations for a 10-marla plot, a mandatory 10 ft front setback is required and the car porch slab cannot project into the front open space. As an alternative, the 20×10 ft front driveway directly ahead of the 15×16 ft porch already provides extra tandem parking space, or we could deepen the porch inward if you are open to reducing the TV lounge depth.";

const BALCONY_REJECTION =
  "A balcony or extension here would project into the 10 ft front open space, which LDA doesn't allow for houses (B&ZR 2019 §5.1.8). As an alternative I can add a 3 ft sunshade (chajja), the most the front setback permits, or deepen the existing balcony inward.";

/** Deepen Bedroom 2 by 2 ft into the front balcony (110 → 130 sq ft). */
export function deepenBedroom2(plan: BuildingPlan): boolean {
  const bed = plan.rooms.find((r) => r.id === "f_bed2");
  const balcony = plan.rooms.find((r) => r.id === "f_balcony");
  const bath = plan.rooms.find((r) => r.id === "f_bath2");
  if (!bed || !balcony) return false;
  bed.rect = { ...bed.rect, y: bed.rect.y - 2, d: bed.rect.d + 2 };
  if (bath) bath.rect = { ...bath.rect, y: bath.rect.y - 2, d: bath.rect.d + 2 };
  balcony.rect = { ...balcony.rect, d: balcony.rect.d - 2 };
  for (const o of plan.openings) {
    if (o.id === "f_bed2_slide") o.at = [o.at[0], o.at[1] - 2];
  }
  return true;
}

const stage = (message: string, s: "changes" | "plan" | "compliance" | "fix" | "build" | "save" = "changes") => ev("stage", { stage: s, message });

export async function* reviseScript(pid: string, versionId: string, commentIds?: string[]): AsyncGenerator<Step> {
  const d = db();
  const p = findProject(pid);
  const base = d.versions[versionId];
  if (!base) {
    yield ev("error", { message: "That version no longer exists.", recoverable: false });
    return;
  }
  const open = (d.comments[pid] ?? []).filter((c) => c.version_id === versionId && c.status === "open");
  const comments = commentIds?.length ? open.filter((c) => commentIds.includes(c.id)) : open;
  if (!comments.length) {
    yield ev("error", { message: "There are no open comments to address.", recoverable: false });
    return;
  }

  p.stage = "revising";
  touch(p);
  save();

  yield stage(`Argon is reviewing your ${comments.length} comment(s)…`);
  yield 1400;

  const plan = clone(base.plan);
  let report = base.compliance;
  const changes: Change[] = [];
  const sections: DesignSection[] = [...base.sections];
  const resolutions = new Map<string, { status: Comment["status"]; resolution: string }>();
  const replace = (s: DesignSection | null) => {
    if (!s) return;
    const i = sections.findIndex((x) => x.name === s.name);
    if (i >= 0) sections[i] = s;
  };

  for (const c of comments) {
    const kind = classify(c.text);
    const where = c.anchor.room ?? c.anchor.element_id ?? c.anchor.label ?? "the view";
    yield stage(`Looking at ${where}…`);
    yield 1100;

    if (kind === "projection") {
      yield stage("Testing a layout change…");
      yield 900;
      yield stage("Checking proposed layout changes against LDA rules…");
      yield 1200;
      resolutions.set(c.id, { status: "rejected", resolution: /porch|car/.test(c.text.toLowerCase()) ? PORCH_REJECTION : BALCONY_REJECTION });
      yield stage("Resolving comment…");
      yield 600;
      continue;
    }

    if (kind === "bigger" && !changes.some((x) => x.kind === "plan")) {
      yield stage("Reading furnish_f_bed2…");
      yield 800;
      yield stage("Testing a layout change…");
      yield 900;
      yield stage("Checking proposed layout changes against LDA rules…");
      yield 1100;
      yield stage("Applying layout change…");
      deepenBedroom2(plan);
      report = recheck(plan);
      yield 700;
      yield ev("plan", { plan, attempt: 1 });
      yield ev("compliance", { report, attempt: 1 });
      yield 500;
      yield stage("Rewriting furnish_f_bed2…");
      yield 1400;
      const s = revisedSection("furnish_f_bed2", "Bedroom 2 is 2 ft deeper; the bed moves back and a study desk fits by the balcony door.");
      replace(s);
      if (s) yield ev("section", { section: s, index: sections.findIndex((x) => x.name === s.name) });
      changes.push({
        id: `ch${changes.length + 1}`,
        summary: "Deepened Bedroom 2 by 2 ft into the front balcony (110 → 130 sq ft)",
        kind: "plan",
        targets: ["f_bed2", "f_bath2", "f_balcony"],
        comment_ids: [c.id],
      });
      resolutions.set(c.id, {
        status: "resolved",
        resolution: "Bedroom 2 is now 10×13 ft (130 sq ft), up from 110, by taking 2 ft from the front balcony, which stays 3 ft deep. It still passes every LDA room-size and daylight check.",
      });
      yield stage("Resolving comment…");
      yield 600;
      continue;
    }

    if (kind === "material" || kind === "general") {
      yield stage("Reading facade_right_bay…");
      yield 900;
      yield stage("Rewriting facade_right_bay…");
      yield 1600;
      const s = revisedSection("facade_right_bay", "warmer teak louvers wrap the balcony; the stone pier now runs to the parapet.");
      replace(s);
      if (s) yield ev("section", { section: s, index: sections.findIndex((x) => x.name === s.name) });
      const existing = changes.find((x) => x.kind === "section");
      if (existing) existing.comment_ids.push(c.id);
      else changes.push({ id: `ch${changes.length + 1}`, summary: "Rewrote the right-bay facade: warmer teak louvers and a full-height stone pier", kind: "section", targets: ["facade_right_bay"], comment_ids: [c.id] });
      resolutions.set(c.id, {
        status: kind === "material" ? "resolved" : "partial",
        resolution: kind === "material"
          ? "Updated the facade here: the teak louvers are warmer and wrap the balcony, and the stone pier now runs up to the parapet."
          : "I read this as a facade note and refreshed the right bay. Tell me more if you meant something specific and I'll take it further.",
      });
      yield stage("Resolving comment…");
      yield 600;
      continue;
    }

    // remove, or a second "bigger" request
    yield stage("Testing a layout change…");
    yield 900;
    yield stage("Checking proposed layout changes against LDA rules…");
    yield 1000;
    resolutions.set(c.id, {
      status: "partial",
      resolution: kind === "remove"
        ? "Removing it would leave the room without its required daylight or access, so I kept it but simplified the furniture around it."
        : "Only one room could grow this round without breaking a setback; I prioritised Bedroom 2. Ask again and I'll try another trade-off.",
    });
    yield stage("Resolving comment…");
    yield 600;
  }

  yield ev("changes", { changes });
  yield stage("Saving the revised version…", "save");
  yield 900;

  const summary = changes.map((c) => c.summary).join("; ").slice(0, 200) || "Revision";
  const version = saveVersion(pid, plan, sections, report, summary, changes);
  for (const c of comments) {
    const r = resolutions.get(c.id) ?? { status: "partial" as const, resolution: "Reviewed; no specific change was needed." };
    c.status = r.status;
    c.resolution = r.resolution;
    c.resolved_in_version = version.id;
    save();
    yield 350;
    yield ev("comment", { comment: clone(c) });
  }
  yield ev("version", { version });
  yield ev("done", {});
}
