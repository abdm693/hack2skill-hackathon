/**
 * B.1.4 catch-all fall protection: on every upper floor slab and roof, any edge of walkable floor with a drop of
 * more than 2.5 ft (30 in) and no wall, parapet or railing within 0.6 ft gets a 3.5 ft railing. Stair arrivals and
 * the bands of flights leaving a floor are the only openings left. Every rail added is reported.
 */
import * as THREE from "three";
import type { BuildCtx } from "../core/ctx";
import { Kit } from "../core/shapes";
import { rectContains } from "../core/grid";
import { railing, type RailMats, type RailType } from "./railings";
import { subtract, unguarded } from "./cover";
import { GUARD_H, openingsOnEdge } from "./stairs-geo";

export interface DropEdge {
  level: string;
  axis: "x" | "y";
  c: number;
  a: number;
  b: number;
  /** +1 when the floor is on the low-coordinate side of the line */
  floorSide: -1 | 1;
  drop: number;
}

/** Floor height (ft) below a plan point under level U: the stair or level beneath, or the ground. */
function floorBelow(ctx: BuildCtx, levelIdx: number, x: number, y: number): number {
  const plan = ctx.plan;
  for (let i = levelIdx - 1; i >= 0; i--) {
    const L = plan.levels[i];
    const inHole = ctx.model.stairs.some((s) => s.holeLevel === L.id && s.holes.some((h) => rectContains(h, x, y, -0.02)));
    if (inHole) continue;
    const r = plan.roomAt(L.id, x, y);
    if (r && r.cat !== "outdoor") return r.floorH;
    if (i === 0) return r ? r.floorH : plan.grade;
  }
  return plan.grade;
}

/** Edges of walkable floor on upper levels that drop more than 2.5 ft and that nothing guards yet. */
export function unguardedDrops(ctx: BuildCtx): DropEdge[] {
  const out: DropEdge[] = [];
  for (const s of ctx.model.slabs) {
    const U = s.level;
    if (s.top > U.elev + 1) continue; // the mumty's own roof: not reachable
    const er = s.grid.edgeRuns((n, p) => ((n === true) !== (p === true) ? (n === true ? "+" : "-") : null));
    for (const e of er) {
      const floorSide: -1 | 1 = e.key === "+" ? 1 : -1;
      const spans = subtract(unguarded(ctx, U.id, e.axis, e.c, e.a, e.b, 0.6, 0.3), openingsOnEdge(ctx, U.id, e.axis, e.c), 0.3);
      for (const [p, q] of spans) {
        // the drop on the open side, sampled along the span (worst case)
        let drop = 0;
        for (let k = 0; k <= 4; k++) {
          const u = p + ((q - p) * k) / 4;
          const off = e.c + floorSide * 0.3; // just past the edge, on the open side
          const [x, y] = e.axis === "x" ? [u, off] : [off, u];
          drop = Math.max(drop, U.elev - floorBelow(ctx, U.i, x, y));
        }
        if (drop > 2.5) out.push({ level: U.id, axis: e.axis, c: e.c, a: p, b: q, floorSide, drop });
      }
    }
  }
  return out;
}

export function buildDropGuards(ctx: BuildCtx, type: RailType, m: RailMats): void {
  const edges = unguardedDrops(ctx);
  if (!edges.length) return;
  const byLevel = new Map<string, { kit: Kit; glass: Kit }>();
  edges.forEach((e, n) => {
    let k = byLevel.get(e.level);
    if (!k) byLevel.set(e.level, (k = { kit: new Kit(), glass: new Kit() }));
    const lv = ctx.plan.levelById.get(e.level)!;
    const c = e.c - e.floorSide * 0.12;
    const [x0, y0, x1, y1] = e.axis === "x" ? [e.a - 0.1, c, e.b + 0.1, c] : [c, e.a - 0.1, c, e.b + 0.1];
    railing(k.kit, k.glass, type, x0, y0, lv.elev, x1, y1, lv.elev, GUARD_H, m, { handrailWood: true });
    ctx.guards.push({ level: e.level, axis: e.axis, c: e.c, a: e.a - 0.1, b: e.b + 0.1, h: GUARD_H });
    ctx.notes.add({
      id: `asbuilt.guard_added:${e.level}:${n + 1}`,
      title: "Guard rail added",
      status: "warn",
      message: `A ${(e.b - e.a).toFixed(1)} ft edge on the ${lv.name} with a ${e.drop.toFixed(1)} ft drop had no wall or railing; the engine added a 3.5 ft guard.`,
    });
  });
  for (const [lv, k] of byLevel) {
    if (!k.kit.empty) {
      const g = k.kit.build();
      ctx.add(g, { kind: "railing:guard", id: `drop_guards_${lv}`, label: "Guard rail", level: lv });
      g.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.userData.collide = true;
          ctx.collider(o as THREE.Mesh);
        }
      });
    }
    if (!k.glass.empty) {
      const gg = k.glass.build(new THREE.Group(), false);
      ctx.add(gg, { kind: "railing:glass", id: `drop_guards_glass_${lv}`, label: "Glass guard", level: lv });
      gg.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).renderOrder = 2;
          o.userData.collide = true;
          ctx.collider(o as THREE.Mesh);
        }
      });
    }
  }
}
