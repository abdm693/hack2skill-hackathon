/** buildHouse: run design.js sections against the SDK and assemble the scene. */
import * as THREE from "three";
import type { BuildingPlan } from "@contracts/plan";
import type { Layer } from "@contracts/house-sdk";
import type { AsBuiltSummary } from "@contracts/api-types";
import type { BuildResult, DesignSectionSrc, SectionResult } from "./index";
import { BuildCtx } from "./core/ctx";
import { consolidate } from "./core/consolidate";
import { FT, smoothstep, warn } from "./core/util";
import { PlanModel } from "./plan/model";
import { StructureModel } from "./structure/model";
import { buildStructure } from "./structure";
import { createSDK, lenientThree } from "./sdk";
import { addSun, sunDirection } from "./lights";
import { floorBelow } from "./facade";

const LAYERS: Layer[] = ["structure", "facade", "interior", "furniture", "landscape", "lighting", "custom"];

export interface BuildStats {
  totalMs: number;
  sectionsMs: number;
  consolidateMs: number;
  meshesBefore: number;
  meshesAfter: number;
}

function inferLayer(name: string): Layer {
  const n = name.toLowerCase();
  if (n.startsWith("structure")) return "structure";
  if (n.startsWith("facade")) return "facade";
  if (n.startsWith("interior")) return "interior";
  if (n.startsWith("furnish")) return "furniture";
  if (n.startsWith("landscape")) return "landscape";
  if (n.startsWith("light")) return "lighting";
  return "custom";
}

const yieldNow = (): Promise<void> =>
  new Promise((res) => {
    if (typeof MessageChannel !== "undefined") {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => res();
      ch.port2.postMessage(0);
    } else setTimeout(res, 0);
  });

export async function buildHouseImpl(
  planIn: BuildingPlan,
  sectionsIn: DesignSectionSrc[],
  opts: { onSection?: (r: SectionResult, root: THREE.Group) => void | Promise<void>; quality?: "high" | "medium" } = {},
  screen: (body: string) => string[],
): Promise<BuildResult & { stats: BuildStats }> {
  const t0 = performance.now();
  const plan = new PlanModel(planIn);
  const ctx = new BuildCtx(plan, opts.quality === "medium" ? "medium" : "high");
  ctx.modelFactory = (c) => new StructureModel(c.plan);
  const sdk = createSDK(ctx);
  const THREE_L = lenientThree();
  const results: SectionResult[] = [];
  // accept {name, layer, body} and the API shape {name, layer, code}
  const sections: DesignSectionSrc[] = [];
  for (const raw of Array.isArray(sectionsIn) ? sectionsIn : []) {
    if (!raw || typeof raw !== "object") continue;
    const sec = raw as DesignSectionSrc & { code?: unknown };
    const body = typeof sec.body === "string" ? sec.body : typeof sec.code === "string" ? sec.code : null;
    if (body === null) continue;
    const name = typeof sec.name === "string" && sec.name ? sec.name : `section_${sections.length}`;
    sections.push({ name, layer: sec.layer, body });
  }

  const runSection = async (name: string, layerIn: string, body: string | (() => void)) => {
    const layer: Layer = LAYERS.includes(layerIn as Layer) ? (layerIn as Layer) : inferLayer(name);
    const group = new THREE.Group();
    group.name = `section:${name}`;
    group.userData = { layer, kind: "section", id: `section_${name}`, label: name, section: name };
    ctx.root.add(group);
    ctx.sectionGroup = group;
    ctx.layer = layer;
    ctx.section = name;
    ctx.objectsThisSection = 0;
    const t = performance.now();
    let ok = true;
    let error: string | undefined;
    if (typeof body === "string") {
      const reasons = screen(body);
      if (reasons.length) {
        ok = false;
        error = `rejected: ${reasons.join("; ")}`;
      } else {
        try {
          const fn = new Function("s", "THREE", '"use strict";\n' + body);
          fn(sdk, THREE_L);
        } catch (e) {
          ok = false;
          error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        }
      }
    } else {
      try {
        body();
      } catch (e) {
        ok = false;
        error = String(e);
      }
    }
    // deferred hooks (auto dining chairs etc.) always run
    while (ctx.endOfSection.length) {
      try {
        ctx.endOfSection.shift()!();
      } catch (e) {
        warn(`end-of-section hook failed: ${e}`);
      }
    }
    const r: SectionResult = { name, layer, ok, error, ms: Math.round((performance.now() - t) * 10) / 10, objects: ctx.objectsThisSection };
    results.push(r);
    if (error) console.warn(`[naqsha/engine] section ${name}: ${error}`);
    if (opts.onSection) {
      try {
        await opts.onSection(r, ctx.root);
      } catch (e) {
        warn(`onSection callback threw: ${e}`);
      }
    }
    await yieldNow();
  };

  // structure first even if Argon put it later; it must exist for everything else
  const ordered = [...sections].sort((a, b) => (a.name === "structure" ? -1 : b.name === "structure" ? 1 : 0));
  for (const s of ordered) {
    if (s.name !== "structure" && !ctx.structureBuilt && ordered[0]?.name !== "structure") {
      await runSection("structure_auto", "structure", () => buildStructure(ctx, {}));
    }
    await runSection(s.name, s.layer, s.body);
  }
  if (!ctx.structureBuilt) await runSection("structure_auto", "structure", () => buildStructure(ctx, {}));
  let hasSun = false;
  ctx.root.traverse((o) => {
    if (o.userData.kind === "sun") hasSun = true;
  });
  if (!hasSun) await runSection("lighting_auto", "lighting", () => addSun(ctx, { hour: 17.5 }));
  const tSections = performance.now();

  setTimeOfDay(ctx.root, planIn, ctx.sunHour);

  let meshesBefore = 0;
  ctx.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshesBefore++;
  });
  const tc = performance.now();
  const cons = consolidate(ctx.root, ctx.colliderGroup, new Set(ctx.colliders));
  const consolidateMs = performance.now() - tc;
  let meshesAfter = 0;
  ctx.root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o.visible) meshesAfter++;
  });

  const levels = plan.levels.map((l) => ({
    id: l.id,
    name: l.name,
    floor_y: Math.round(l.elev * FT * 1000) / 1000,
    top_y: Math.round((l.isRoof ? l.elev + Math.max(plan.parapet, plan.rooms.some((r) => r.lv.isRoof) ? plan.mumtyHeight : 0) : l.next) * FT * 1000) / 1000,
  }));

  const spawn = computeSpawn(ctx);
  const summary: AsBuiltSummary = {
    objects: cons.summary,
    section_errors: results.filter((r) => !r.ok).map((r) => ({ section: r.name, error: r.error ?? "error" })),
    checks: [...(ctx.structureBuilt ? ctx.model.notes.list : []), ...ctx.notes.list],
  };
  const root = ctx.root;
  root.userData.stats = { mergedMeshes: cons.mergedMeshes, meshesBefore, meshesAfter };
  const totalMs = performance.now() - t0;
  const result = {
    root,
    summary,
    sections: results,
    levels,
    colliders: cons.colliders,
    spawn,
    stats: { totalMs, sectionsMs: tSections - t0, consolidateMs, meshesBefore, meshesAfter },
    dispose() {
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry) m.geometry.dispose();
      });
      ctx.mats.dispose();
      root.removeFromParent();
    },
  };
  // the build context, for dev tools and checks (not part of the contract; not enumerable)
  Object.defineProperty(result, "ctx", { value: ctx, enumerable: false });
  return result;
}

function computeSpawn(ctx: BuildCtx): { position: THREE.Vector3; lookAt: THREE.Vector3 } {
  const plan = ctx.plan;
  const ops = ctx.structureBuilt ? ctx.model.openings : [];
  const main =
    ops.find((o) => o.op.type === "main_door") ??
    ops.find((o) => o.isDoor && o.run.out !== 0 && o.op.type !== "garage_door") ??
    ops.find((o) => o.isDoor);
  const eye = 1.6;
  if (main) {
    const run = main.run;
    const u = (main.u0 + main.u1) / 2;
    const outward = run.out !== 0 ? run.out : main.swingSide === -1 ? 1 : -1;
    // first free spot outside the door (avoid parked cars, planters, other furniture)
    const blocked = (x: number, y: number) =>
      ctx.items.some((it) => (it.cls === "floor" || it.cls === "top") && x > it.x0 - 1.3 && x < it.x1 + 1.3 && y > it.y0 - 1.3 && y < it.y1 + 1.3) ||
      x < 0.8 || y < -20 || x > plan.plotW - 0.8 || y > plan.plotD;
    let px = run.axis === "x" ? u : run.c + outward * 6.5;
    let py = run.axis === "x" ? run.c + outward * 6.5 : u;
    search: for (const dist of [6.5, 4.5, 8.5, 3.5, 10.5, 2.8])
      for (const lat of [0, 2.5, -2.5, 4.5, -4.5]) {
        const cx = run.axis === "x" ? u + lat : run.c + outward * dist;
        const cy = run.axis === "x" ? run.c + outward * dist : u + lat;
        if (!blocked(cx, cy)) {
          px = cx;
          py = cy;
          break search;
        }
      }
    const dx = run.axis === "x" ? u : run.c;
    const dy = run.axis === "x" ? run.c : u;
    const floor = floorBelow(ctx, px, py, main.bottom + 3);
    const doorFloor = main.bottom + 0.04;
    return {
      position: new THREE.Vector3(px * FT, floor * FT + eye, -py * FT),
      lookAt: new THREE.Vector3(dx * FT, doorFloor * FT + eye, -dy * FT),
    };
  }
  const x = plan.plotW / 2, y = 4;
  return {
    position: new THREE.Vector3(x * FT, plan.grade * FT + eye, -y * FT),
    lookAt: new THREE.Vector3(x * FT, plan.grade * FT + eye, -(y + 10) * FT),
  };
}

/**
 * Scale emissive fixtures and fake light pools for the time of day (lights read as "on" at dusk/night and
 * subtle at noon). Safe to call repeatedly (e.g. from a sun slider).
 */
export function setTimeOfDay(root: THREE.Object3D, plan: Pick<BuildingPlan, "site">, hour: number): void {
  const { altitude } = sunDirection(plan, hour);
  const a = altitude * (180 / Math.PI);
  const night = 1 - smoothstep(-2, 16, a);
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      const sm = mat as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
      if (sm.blending === THREE.AdditiveBlending) {
        sm.userData.baseOpacity ??= sm.opacity;
        sm.opacity = (sm.userData.baseOpacity as number) * (0.12 + 0.88 * night);
      } else if (sm.emissive && sm.emissiveIntensity > 0 && sm.emissive.getHex() !== 0) {
        sm.userData.baseEmissive ??= sm.emissiveIntensity;
        sm.emissiveIntensity = (sm.userData.baseEmissive as number) * (0.35 + 0.65 * night);
      }
    }
  });
}
