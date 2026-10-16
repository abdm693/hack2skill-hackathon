/**
 * Stairs: marble treads/risers on a concrete waist, landings, stringers, balustrades, stairwell guards and ramp
 * colliders. Fall protection (B.1): every open flight side and landing edge has a balustrade, every stairwell
 * edge on the upper floor a 3.5 ft guard except exactly where the top flight arrives (and where the next flight up
 * leaves), and every railing, balustrade and stringer is a walk collider.
 */
import * as THREE from "three";
import { CellGrid, rectContains } from "../core/grid";
import { MeshBuilder } from "../core/meshbuilder";
import { Kit } from "../core/shapes";
import { FT } from "../core/util";
import type { BuildCtx } from "../core/ctx";
import type { RoomM } from "../plan/model";
import { FINISH, type Flight, type StairLayout } from "./model";
import { P3, railing, skewBox, type RailMats, type RailType } from "./railings";
import { subtract, unguarded, type Span } from "./cover";

export interface StairMats {
  tread: (room: RoomM | null) => THREE.Material;
  body: THREE.Material;
  stringer: THREE.Material;
  rail: RailMats;
  railType: RailType;
}

/** guard height on level floors (IBC 1015: 42 in) and on flights (handrail 34–38 in above the nosing line) */
export const GUARD_H = 3.5;
const FLIGHT_H = 3.0;

const pt = (f: { axis: "x" | "y" }, along: number, across: number): [number, number] => (f.axis === "x" ? [along, across] : [across, along]);
const sEndOf = (f: Flight) => f.s0 + f.sign * (f.n - 1) * f.tread;

/** Where the hole edge on `level` must stay open: the top-riser line of a flight arriving there, and the band of any flight leaving from there. */
export function openingsOnEdge(ctx: BuildCtx, level: string, axis: "x" | "y", c: number): Span[] {
  const cuts: Span[] = [];
  for (const lay of ctx.model.stairs) {
    if (lay.holeLevel === level) {
      const t = lay.topRiser;
      if (t.axis === axis && Math.abs(t.c - c) < 0.08) cuts.push([t.a, t.b]);
    }
    if (lay.stair.from.id === level) {
      const f = lay.flights[0];
      if (!f || f.axis === axis) continue;
      const lo = Math.min(f.s0, sEndOf(f)) - f.tread, hi = Math.max(f.s0, sEndOf(f)) + f.tread;
      if (c > lo && c < hi) cuts.push([f.c0, f.c1]);
    }
  }
  return cuts;
}

export function buildStairs(ctx: BuildCtx, m: StairMats): void {
  const plan = ctx.plan;
  const holesOn = (lv: string) => ctx.model.stairs.filter((s) => s.holeLevel === lv).flatMap((s) => s.holes);
  /** a walkable floor point on a level: inside a room (not outdoor) and not in a stairwell */
  const floorAt = (lv: string, x: number, y: number) => {
    const r = plan.roomAt(lv, x, y);
    return !!r && r.cat !== "outdoor" && !holesOn(lv).some((h) => rectContains(h, x, y, -0.02));
  };

  for (const lay of ctx.model.stairs) {
    const s = lay.stair;
    const room = plan.roomAt(s.from.id, lay.rect.x + lay.rect.w / 2, lay.rect.y + lay.rect.d / 2);
    const tread = m.tread(room);
    const kit = new Kit(); // treads, risers, waist, landings: walked on via the ramp colliders
    const railKit = new Kit(); // stringers, balustrades, guards: walk colliders
    const glassKit = new Kit();
    for (const f of lay.flights) flightGeo(kit, f, tread, m.body);
    for (const L of lay.landings) {
      const r = L.rect;
      kit.mb(m.body).box(r.x * FT, (L.h - 0.55) * FT, r.y * FT, (r.x + r.w) * FT, (L.h - FINISH) * FT, (r.y + r.d) * FT);
      kit.mb(tread).box(r.x * FT, (L.h - FINISH) * FT, r.y * FT, (r.x + r.w) * FT, L.h * FT, (r.y + r.d) * FT);
    }
    // flights: stringer + balustrade on every open side; the well sides always get a full balustrade. The
    // first two treads may be left open on a side only when there is solid floor beside them (step on sideways).
    lay.flights.forEach((f, fi) => {
      const sEnd = sEndOf(f);
      const lo0 = Math.min(f.s0, sEnd), hi0 = Math.max(f.s0, sEnd);
      const hAt = (a: number) => f.h0 + f.riser + (f.n - 1) * f.riser * ((a - f.s0) / (sEnd - f.s0 || 1));
      for (const [c, out] of [[f.c0, -1], [f.c1, 1]] as const) {
        const isWell = lay.flights.some((o) => o !== f && o.axis === f.axis && (out > 0 ? o.c0 > c - 0.05 && o.c0 - c < 1.5 : c > o.c1 - 0.05 && c - o.c1 < 1.5));
        const fullSpans: Span[] = isWell ? [[lo0, hi0]] : unguarded(ctx, s.from.id, f.axis, c, lo0, hi0, 0.6, 0.5, false);
        let gapStart = 0;
        if (fi === 0 && !isWell) {
          let solid = true;
          for (let k = 0; k <= 4; k++) {
            const a = f.s0 + f.sign * (k / 4) * 2 * f.tread;
            const [x, y] = pt(f, a, c + out * 0.6);
            if (!floorAt(s.from.id, x, y)) solid = false;
          }
          if (solid) gapStart = 2 * f.tread;
        }
        const lo = lo0 + (f.sign > 0 ? gapStart : 0), hi = hi0 - (f.sign > 0 ? 0 : gapStart);
        for (const [p, q] of fullSpans) {
          // stringer plate along the whole open side
          const cs = c + out * 0.04;
          const startEnd = f.sign > 0 ? p : q, endEnd = f.sign > 0 ? q : p;
          const [ax, ay] = pt(f, startEnd - (Math.abs(startEnd - f.s0) < 1e-3 ? f.sign * 0.05 : 0), cs);
          const [bx, by] = pt(f, endEnd, cs);
          const hA = hAt(startEnd), hB = hAt(endEnd);
          skewBox(railKit.mb(m.stringer), P3(ax, ay, hA - 0.66), P3(bx - ax, by - ay, hB - hA), new THREE.Vector3(0, 0.78 * FT, 0), side(f, out, 0.06));
          const p2 = Math.max(p, lo), q2 = Math.min(q, hi);
          if (q2 - p2 < 0.6) continue;
          // run the balustrade on past the last nosing so it meets the landing / floor guard without a gap
          const ext = (a: number) => (Math.abs(a - sEnd) < 1e-3 ? f.tread * 0.5 : 0);
          const sa = f.sign > 0 ? p2 : q2, sb = f.sign > 0 ? q2 : p2;
          const sbx = sb + f.sign * ext(sb);
          const [rx0, ry0] = pt(f, sa, c - out * 0.05);
          const [rx1, ry1] = pt(f, sbx, c - out * 0.05);
          railing(railKit, glassKit, m.railType, rx0, ry0, hAt(sa) + 0.12, rx1, ry1, hAt(sb) + 0.12, FLIGHT_H, m.rail, { shoe: false, handrailWood: true });
        }
      }
    });
    // landings: guard every edge where no flight connects and no wall stands
    for (const L of lay.landings) {
      const r = L.rect;
      const edges: ["x" | "y", number, number, number][] = [
        ["x", r.y, r.x, r.x + r.w],
        ["x", r.y + r.d, r.x, r.x + r.w],
        ["y", r.x, r.y, r.y + r.d],
        ["y", r.x + r.w, r.y, r.y + r.d],
      ];
      for (const [axis, c, a, b] of edges) {
        const cover = lay.flights
          .filter((f) => f.axis !== axis && (Math.abs(f.s0 - c) < 0.3 || Math.abs(sEndOf(f) - c) < 0.3))
          .map((f) => [f.c0, f.c1] as Span);
        const free = subtract([[a, b]], cover, 0.3);
        for (const [p0, q0] of free)
          for (const [p, q] of unguarded(ctx, s.from.id, axis, c, p0, q0, 0.6, 0.3, false)) {
            const [x0, y0] = axis === "x" ? [p - 0.1, c] : [c, p - 0.1];
            const [x1, y1] = axis === "x" ? [q + 0.1, c] : [c, q + 0.1];
            railing(railKit, glassKit, m.railType, x0, y0, L.h, x1, y1, L.h, GUARD_H, m.rail, { handrailWood: true });
          }
      }
    }
    // stairwell guards on the upper floor: every edge, except the arrival opening and the band of a flight
    // leaving from that floor (its own balustrade continues the guard)
    const holeG = CellGrid.fromRects(lay.holes.map((h) => ({ rect: h, val: true })));
    const upper = plan.levelById.get(lay.holeLevel)!;
    const er = holeG.edgeRuns((n, p) => (n && !p ? "+" : p && !n ? "-" : null));
    for (const e of er) {
      const dir = e.key === "+" ? 1 : -1; // the floor is on this side of the line
      // guards of other stairs' holes on the same line count too, but not this stair's own (built below)
      const spans = unguarded(ctx, upper.id, e.axis, e.c, e.a, e.b, 0.6, 0.2);
      const keep = subtract(spans, openingsOnEdge(ctx, upper.id, e.axis, e.c), 0.2);
      const c = e.c + dir * 0.12;
      for (const [p, q] of keep) {
        // reach into the walls / neighbouring guards at the ends, but not into an opening left for walking
        const openAt = (u: number) => openingsOnEdge(ctx, upper.id, e.axis, e.c).some(([a, b]) => u >= a - 0.05 && u <= b + 0.05);
        const p1 = openAt(p) ? p : p - 0.15, q1 = openAt(q) ? q : q + 0.15;
        const [x0, y0] = e.axis === "x" ? [p1, c] : [c, p1];
        const [x1, y1] = e.axis === "x" ? [q1, c] : [c, q1];
        railing(railKit, glassKit, m.railType, x0, y0, upper.elev, x1, y1, upper.elev, GUARD_H, m.rail, { handrailWood: true });
        ctx.guards.push({ level: upper.id, axis: e.axis, c: e.c, a: p1, b: q1, h: GUARD_H });
      }
    }
    const g = kit.build();
    ctx.add(g, { kind: "stair", level: s.from.id, room: room?.id, id: s.id, label: `Stair ${s.from.name} → ${s.to.name}` });
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.userData.collide = false;
    });
    if (!railKit.empty) {
      const rg = railKit.build();
      ctx.add(rg, { kind: "railing:stair", level: s.from.id, room: room?.id, id: `${s.id}_rails`, label: "Stair balustrade" });
      rg.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.userData.collide = true;
          ctx.collider(o as THREE.Mesh);
        }
      });
    }
    if (!glassKit.empty) {
      const gg = glassKit.build(new THREE.Group(), false);
      ctx.add(gg, { kind: "railing:glass", level: s.from.id, room: room?.id, id: `${s.id}_glass`, label: "Stair glass balustrade" });
      gg.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).renderOrder = 2;
          o.userData.collide = true;
          ctx.collider(o as THREE.Mesh);
        }
      });
    }
    rampColliders(ctx, lay);
  }
}

/** invisible ramp colliders so the walkthrough glides up the flights, plus landing slabs */
function rampColliders(ctx: BuildCtx, lay: StairLayout): void {
  const s = lay.stair;
  lay.flights.forEach((f, i) => {
    // ramp through the riser midpoints: meets the lower floor/landing at s0 - T/2 and the upper one at end + T/2
    const mb = new MeshBuilder();
    const s0 = f.s0 - f.sign * f.tread * 0.5;
    const s1 = f.s0 + f.sign * (f.n - 0.5) * f.tread;
    const [ax, ay] = pt(f, s0, f.c0);
    const [bx, by] = pt(f, s1, f.c0);
    const o = P3(ax, ay, f.h0);
    const along = P3(bx - ax, by - ay, f.n * f.riser);
    const across = f.axis === "x" ? new THREE.Vector3(0, 0, (f.c1 - f.c0) * FT) : new THREE.Vector3((f.c1 - f.c0) * FT, 0, 0);
    skewBox(mb, o.clone().add(new THREE.Vector3(0, -0.1, 0)), along, new THREE.Vector3(0, 0.1, 0), across);
    const geo = mb.build();
    if (geo) ctx.addColliderOnly(geo, { kind: "stair:ramp", level: s.from.id, id: `${s.id}_ramp_${i}` });
  });
  for (const L of lay.landings) {
    const mb = new MeshBuilder();
    const r = L.rect;
    mb.box(r.x * FT, (L.h - 0.3) * FT, r.y * FT, (r.x + r.w) * FT, L.h * FT, (r.y + r.d) * FT);
    const geo = mb.build();
    if (geo) ctx.addColliderOnly(geo, { kind: "stair:landing", level: s.from.id, id: ctx.uid(`${s.id}_landing`) });
  }
}

function side(f: Flight, out: number, w: number): THREE.Vector3 {
  return f.axis === "x" ? new THREE.Vector3(0, 0, out * w * FT) : new THREE.Vector3(out * w * FT, 0, 0);
}

function flightGeo(kit: Kit, f: Flight, tread: THREE.Material, body: THREE.Material): void {
  const nos = 0.08;
  const tt = 0.13;
  for (let k = 1; k <= f.n; k++) {
    const a0 = f.s0 + f.sign * (k - 1) * f.tread;
    const a1 = f.s0 + f.sign * k * f.tread;
    const htop = f.h0 + k * f.riser;
    const hbot = f.h0 + (k - 1) * f.riser;
    if (k < f.n) {
      box(kit, tread, f, a0 - f.sign * nos, a1, f.c0, f.c1, htop - tt, htop);
      box(kit, body, f, a0 + f.sign * 0.05, a1, f.c0 + 0.01, f.c1 - 0.01, hbot - 0.3, htop - tt);
    }
    box(kit, tread, f, a0, a0 + f.sign * 0.05, f.c0 + 0.005, f.c1 - 0.005, hbot, htop - (k < f.n ? tt : 0));
  }
  // sloped waist slab (soffit): parallelepiped below the line through the inner step corners
  const run = (f.n - 1) * f.tread;
  const rise = (f.n - 1) * f.riser;
  const L = Math.hypot(run, rise);
  if (L < 0.5) return;
  const thick = 0.42;
  const [ox, oy] = pt(f, f.s0, f.c0 + 0.01);
  const start = P3(ox, oy, f.h0);
  // downward normal in (along, h): (rise, -run)/L
  const o = start.clone().add(alongVec(f, (f.sign * thick * rise) / L, (-thick * run) / L));
  const up = alongVec(f, (-f.sign * thick * rise) / L, (thick * run) / L);
  const along = alongVec(f, run * f.sign, rise);
  const across = f.axis === "x" ? new THREE.Vector3(0, 0, (f.c1 - f.c0 - 0.02) * FT) : new THREE.Vector3((f.c1 - f.c0 - 0.02) * FT, 0, 0);
  skewBox(kit.mb(body), o, along, up, across);
}

function alongVec(f: Flight, d: number, h: number): THREE.Vector3 {
  return f.axis === "x" ? new THREE.Vector3(d * FT, h * FT, 0) : new THREE.Vector3(0, h * FT, d * FT);
}

function box(kit: Kit, mat: THREE.Material, f: Flight, a0: number, a1: number, c0: number, c1: number, h0: number, h1: number): void {
  const A0 = Math.min(a0, a1), A1 = Math.max(a0, a1);
  if (A1 - A0 < 1e-4 || h1 - h0 < 1e-4) return;
  if (f.axis === "x") kit.mb(mat).box(A0 * FT, h0 * FT, c0 * FT, A1 * FT, h1 * FT, c1 * FT);
  else kit.mb(mat).box(c0 * FT, h0 * FT, A0 * FT, c1 * FT, h1 * FT, A1 * FT);
}
