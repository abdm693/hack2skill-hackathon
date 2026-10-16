/**
 * Runs engine.buildHouse progressively and hands each section to the viewer as it lands.
 *
 * - The first section's root goes into the scene immediately and grows as sections run.
 * - The real engine is tried first; only an error containing "not implemented" falls back to dev/mockBuild.
 * - Rebuilds are incremental on screen: sections whose code (and plan) are unchanged since the last build are
 *   rebuilt silently off-screen, the new root is swapped in at the first changed section, and only changed
 *   sections animate. Streaming one more section therefore never flickers or replays the whole house.
 * - Stale builds (plan/sections changed mid-build) finish fast and are disposed.
 */
import * as THREE from "three";
import type { BuildingPlan } from "@contracts/plan";
import type { Layer } from "@contracts/house-sdk";
import { buildHouse, type BuildResult, type DesignSectionSrc, type SectionResult } from "@/engine";
import { easeOutCubic, prefersReducedMotion, sleep } from "./units";
import type { ViewerController } from "./controller";

function fnv(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

interface Displayed {
  result: BuildResult;
  keys: Map<string, string>;
  mock: boolean;
}

interface DropAnim {
  obj: THREE.Object3D;
  baseY: number;
  height: number;
  start: number;
  dur: number;
  revealed: boolean;
}

const KIND_RANK: [RegExp, number][] = [
  [/plinth|floor|slab|ground|driveway|footpath|road|lawn/, 0],
  [/wall|column|pier|parapet|mumty|boundary/, 1],
  [/stair|ramp/, 2],
  [/window|door|opening|frame|glass|railing|gate|arch|ventilator/, 3],
];

const PACE_MS: Record<Layer, number> = { structure: 1150, facade: 320, interior: 160, furniture: 150, landscape: 320, lighting: 160, custom: 220 };
const DROP_M: Record<Layer, number> = { structure: 0.85, facade: 0.6, interior: 0.3, furniture: 0.45, landscape: 0.35, lighting: 0.0, custom: 0.5 };

export class BuildManager {
  displayed: Displayed | null = null;
  private seq = 0;
  private lastSig = "";
  private anims: DropAnim[] = [];

  constructor(private ctrl: ViewerController) {}

  get animating() {
    return this.anims.length > 0;
  }

  /** Called whenever `plan` / `sections` change identity. Content-identical inputs are ignored. */
  request(plan: BuildingPlan, sections: DesignSectionSrc[]) {
    const planHash = fnv(JSON.stringify(plan));
    const keys = new Map<string, string>();
    for (const s of sections ?? []) keys.set(s.name, fnv(`${planHash}\u0000${s.layer}\u0000${s.body}`));
    const sig = `${planHash}|${[...keys].map(([n, k]) => `${n}:${k}`).join(",")}`;
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    void this.run(plan, sections ?? [], keys);
  }

  /** Forget the content signature so the next request rebuilds even if nothing changed (StrictMode remounts). */
  invalidate() {
    this.lastSig = "";
  }

  cancel() {
    this.seq++;
  }

  private async run(plan: BuildingPlan, sections: DesignSectionSrc[], keys: Map<string, string>) {
    const token = ++this.seq;
    const ctrl = this.ctrl;
    const prev = this.displayed;
    const prevKeys = prev?.keys ?? new Map<string, string>();
    const total = sections.length;
    const quiet = () => prefersReducedMotion() || document.hidden;
    // mutable build state shared with the callbacks below
    const st = { done: 0, failed: 0, swapped: false, attached: null as THREE.Group | null, seen: new WeakSet<THREE.Object3D>(), mock: false };
    const stale = () => token !== this.seq;

    ctrl.setBuildState({ phase: "building", done: 0, total, current: sections[0]?.name, error: undefined, failed: 0 });

    const swapIn = (root: THREE.Group) => {
      if (st.swapped || stale()) return;
      st.swapped = true;
      st.attached = root;
      this.clearAnims();
      for (const child of [...ctrl.holder.children]) child.removeFromParent();
      if (this.displayed) {
        try {
          this.displayed.result.dispose();
        } catch (e) {
          console.warn("[viewer] dispose failed", e);
        }
        this.displayed = null;
      }
      ctrl.holder.add(root);
      ctrl.onRootAttached(root);
    };

    const onSection = async (r: SectionResult, root: THREE.Group) => {
      if (stale()) return;
      st.done++;
      if (!r.ok) st.failed++;
      const key = keys.get(r.name);
      const known = !!prev && key !== undefined && prevKeys.get(r.name) === key;
      if (!known) swapIn(root);
      // mark everything that exists now; new objects become this section's animation units
      const units = collectNewUnits(root, st.seen);
      if (st.swapped) {
        const animate = !known && !quiet() && DROP_M[r.layer] > 0;
        if (animate) this.dropIn(units, r.layer);
        ctrl.onSectionApplied(root, r);
      }
      const totalNow = Math.max(total, st.done);
      ctrl.setBuildState({ done: st.done, total: totalNow, current: r.name, failed: st.failed, mock: st.mock });
      try {
        ctrl.props.onBuildProgress?.(r, st.done, totalNow);
      } catch (e) {
        console.warn("[viewer] onBuildProgress threw", e);
      }
      if (st.swapped && !known && !quiet()) await sleep(PACE_MS[r.layer] ?? 200);
    };

    let result: BuildResult;
    try {
      result = await buildHouse(plan, sections, { onSection, quality: ctrl.store.getState().quality === "performance" ? "medium" : "high" });
    } catch (err) {
      if (stale()) return;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/not implemented/i.test(msg)) {
        console.error("[viewer] buildHouse failed", err);
        ctrl.setBuildState({ phase: "error", error: msg });
        return;
      }
      // engine not there yet → dev mock (kept after the merge; harmless once the engine lands)
      st.attached?.removeFromParent();
      Object.assign(st, { swapped: false, attached: null, seen: new WeakSet(), done: 0, failed: 0, mock: true });
      try {
        const { mockBuild } = await import("../dev/mockBuild");
        if (stale()) return;
        result = await mockBuild(plan, sections, { onSection });
      } catch (e2) {
        if (stale()) return;
        console.error("[viewer] mock build failed", e2);
        ctrl.setBuildState({ phase: "error", error: e2 instanceof Error ? e2.message : String(e2) });
        return;
      }
    }

    if (stale()) {
      result.root.removeFromParent();
      try {
        result.dispose();
      } catch {
        /* ignore */
      }
      return;
    }
    if (!st.swapped) {
      // every section was unchanged: swap silently (no animation)
      swapIn(result.root);
      ctrl.onSectionApplied(result.root, null);
    }
    this.displayed = { result, keys, mock: st.mock };
    ctrl.onBuildComplete(result, st.mock);
    ctrl.setBuildState({ phase: "ready", done: st.done, total: Math.max(total, st.done), current: undefined, failed: st.failed, mock: st.mock, first: false });
    try {
      ctrl.props.onReady?.({ summary: result.summary, sections: result.sections });
    } catch (e) {
      console.warn("[viewer] onReady threw", e);
    }
  }

  private dropIn(units: THREE.Object3D[], layer: Layer) {
    const now = performance.now();
    const h = DROP_M[layer];
    const levelIndex = this.ctrl.levelIndexMap();
    const vis = this.ctrl.vis;
    units.forEach((obj, i) => {
      const u = obj.userData ?? {};
      let delay: number;
      if (layer === "structure") {
        const li = Math.max(0, levelIndex.get(u.level) ?? 0);
        const kind = String(u.kind ?? "");
        const rank = KIND_RANK.find(([re]) => re.test(kind))?.[1] ?? 2;
        delay = li * 300 + rank * 110 + Math.random() * 140;
      } else delay = Math.min(i * 28, 420) + Math.random() * 60;
      const baseY = obj.position.y;
      obj.position.y = baseY + h;
      if (!obj.matrixAutoUpdate) obj.updateMatrix();
      vis.remember(obj);
      vis.held.add(obj);
      obj.visible = false;
      this.anims.push({ obj, baseY, height: h, start: now + delay, dur: layer === "structure" ? 620 : 520, revealed: false });
    });
  }

  /** Advance drop-in animations. Returns true while any is running. */
  tick(now: number): boolean {
    if (!this.anims.length) return false;
    const vis = this.ctrl.vis;
    let w = 0;
    for (const a of this.anims) {
      if (now < a.start) {
        this.anims[w++] = a;
        continue;
      }
      if (!a.revealed) {
        a.revealed = true;
        vis.held.delete(a.obj);
        a.obj.visible = vis.baseVisible(a.obj) && !vis.hiddenByTags(a.obj);
      }
      const t = Math.min(1, (now - a.start) / a.dur);
      a.obj.position.y = a.baseY + a.height * (1 - easeOutCubic(t));
      if (!a.obj.matrixAutoUpdate) a.obj.updateMatrix();
      if (t < 1) this.anims[w++] = a;
    }
    this.anims.length = w;
    if (!w) this.ctrl.onAnimationsSettled();
    return true;
  }

  /** Snap every running animation to its end state (e.g. before building colliders or capturing). */
  finishAnims() {
    if (!this.anims.length) return;
    for (const a of this.anims) {
      a.obj.position.y = a.baseY;
      if (!a.obj.matrixAutoUpdate) a.obj.updateMatrix();
      this.ctrl.vis.held.delete(a.obj);
      a.obj.visible = this.ctrl.vis.baseVisible(a.obj) && !this.ctrl.vis.hiddenByTags(a.obj);
    }
    this.anims.length = 0;
    this.ctrl.onAnimationsSettled();
  }

  private clearAnims() {
    for (const a of this.anims) this.ctrl.vis.held.delete(a.obj);
    this.anims.length = 0;
  }
}

/** New objects under root since the last call (all marked as seen), split into animation units. */
function collectNewUnits(root: THREE.Object3D, seen: WeakSet<THREE.Object3D>): THREE.Object3D[] {
  const units: THREE.Object3D[] = [];
  const markAll = (o: THREE.Object3D) => o.traverse((c) => void seen.add(c));
  const unitsOf = (o: THREE.Object3D) => {
    if ((o as THREE.Light).isLight || o.type === "Object3D") return; // lights and light targets stay put
    const u = o.userData ?? {};
    const tagged = !!(u.id || u.kind);
    if (tagged || (o as THREE.Mesh).isMesh || !o.children.length) {
      if ((o as THREE.Mesh).isMesh || o.children.length) units.push(o);
      return;
    }
    for (const c of o.children) unitsOf(c);
  };
  const visit = (o: THREE.Object3D) => {
    for (const c of o.children) {
      if (!seen.has(c)) {
        markAll(c);
        unitsOf(c);
      } else visit(c);
    }
  };
  seen.add(root);
  visit(root);
  return units;
}
