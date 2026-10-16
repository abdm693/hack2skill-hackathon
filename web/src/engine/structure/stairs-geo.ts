/** Stairs: marble treads/risers on a concrete waist, landings, stringers, balustrades, hole railings, ramp colliders. */
import * as THREE from "three";
import { CellGrid } from "../core/grid";
import { MeshBuilder } from "../core/meshbuilder";
import { Kit } from "../core/shapes";
import { FT } from "../core/util";
import type { BuildCtx } from "../core/ctx";
import type { RoomM } from "../plan/model";
import { FINISH, type Flight } from "./model";
import { P3, railing, skewBox, type RailMats, type RailType } from "./railings";

export interface StairMats {
  tread: (room: RoomM | null) => THREE.Material;
  body: THREE.Material;
  stringer: THREE.Material;
  rail: RailMats;
  railType: RailType;
}

const pt = (f: { axis: "x" | "y" }, along: number, across: number): [number, number] => (f.axis === "x" ? [along, across] : [across, along]);

export function buildStairs(ctx: BuildCtx, m: StairMats): void {
  const plan = ctx.plan;
  /** sub-spans of [a,b] on line (axis, c) NOT covered by a wall face within 0.6 ft */
  const openSpans = (axis: "x" | "y", c: number, a: number, b: number, level: string): [number, number][] => {
    const cov: [number, number][] = [];
    for (const run of ctx.model.runsByLevel.get(level) ?? []) {
      if (run.axis !== axis) continue;
      if (![run.c - run.t / 2, run.c + run.t / 2].some((w) => Math.abs(w - c) < 0.6)) continue;
      const p = Math.max(a, run.ea), q = Math.min(b, run.eb);
      if (q - p > 0.05) cov.push([p, q]);
    }
    cov.sort((p, q) => p[0] - q[0]);
    const out: [number, number][] = [];
    let cur = a;
    for (const [p, q] of cov) {
      if (p - cur > 0.5) out.push([cur, p]);
      cur = Math.max(cur, q);
    }
    if (b - cur > 0.5) out.push([cur, b]);
    return out;
  };

  for (const lay of ctx.model.stairs) {
    const s = lay.stair;
    const room = plan.roomAt(s.from.id, lay.rect.x + lay.rect.w / 2, lay.rect.y + lay.rect.d / 2);
    const tread = m.tread(room);
    const kit = new Kit();
    const glassKit = new Kit();
    for (const f of lay.flights) flightGeo(kit, f, tread, m.body);
    for (const L of lay.landings) {
      const r = L.rect;
      kit.mb(m.body).box(r.x * FT, (L.h - 0.55) * FT, r.y * FT, (r.x + r.w) * FT, (L.h - FINISH) * FT, (r.y + r.d) * FT);
      kit.mb(tread).box(r.x * FT, (L.h - FINISH) * FT, r.y * FT, (r.x + r.w) * FT, L.h * FT, (r.y + r.d) * FT);
    }
    // flights: stringer + balustrade on open sides; the inner well always gets a balustrade
    for (const f of lay.flights) {
      const sEnd = f.s0 + f.sign * (f.n - 1) * f.tread;
      const lo = Math.min(f.s0, sEnd), hi = Math.max(f.s0, sEnd);
      for (const [c, out] of [[f.c0, -1], [f.c1, 1]] as const) {
        const isWell = lay.flights.some((o) => o !== f && o.axis === f.axis && (out > 0 ? o.c0 > c - 0.05 && o.c0 - c < 1.5 : c > o.c1 - 0.05 && c - o.c1 < 1.5));
        const spans = isWell ? [[lo, hi] as [number, number]] : openSpans(f.axis, c, lo, hi, s.from.id);
        for (const [p, q] of spans) {
          const ka = (p - f.s0) / (sEnd - f.s0 || 1), kb = (q - f.s0) / (sEnd - f.s0 || 1);
          const k0 = Math.min(ka, kb), k1 = Math.max(ka, kb);
          const aS = f.s0 + (sEnd - f.s0) * k0, bS = f.s0 + (sEnd - f.s0) * k1;
          const hA = f.h0 + f.riser + (f.n - 1) * f.riser * k0, hB = f.h0 + f.riser + (f.n - 1) * f.riser * k1;
          // stringer plate (outside face of the flight)
          const cs = c + out * 0.04;
          const [ax, ay] = pt(f, aS - (k0 === 0 ? f.sign * 0.05 : 0), cs);
          const [bx, by] = pt(f, bS, cs);
          const o = P3(ax, ay, hA - 1.0);
          const along = P3(bx - ax, by - ay, hB - hA);
          skewBox(kit.mb(m.stringer), o, along, new THREE.Vector3(0, 1.08 * FT, 0), side(f, out, 0.07));
          const [rx0, ry0] = pt(f, aS, c - out * 0.05);
          const [rx1, ry1] = pt(f, bS, c - out * 0.05);
          railing(kit, glassKit, m.railType, rx0, ry0, hA + 0.12, rx1, ry1, hB + 0.12, 3.0, m.rail, { shoe: false, handrailWood: true });
        }
      }
    }
    for (const L of lay.landings) {
      const r = L.rect;
      const edges: ["x" | "y", number, number, number][] = [
        ["x", r.y, r.x, r.x + r.w],
        ["x", r.y + r.d, r.x, r.x + r.w],
        ["y", r.x, r.y, r.y + r.d],
        ["y", r.x + r.w, r.y, r.y + r.d],
      ];
      for (const [axis, c, a, b] of edges) {
        // parts of the edge where a flight connects are left open
        const cover = lay.flights
          .filter((f) => f.axis !== axis && (Math.abs(f.s0 - c) < 0.3 || Math.abs(f.s0 + f.sign * (f.n - 1) * f.tread - c) < 0.3))
          .map((f) => [f.c0, f.c1] as [number, number])
          .sort((p, q) => p[0] - q[0]);
        const free: [number, number][] = [];
        let cur = a;
        for (const [p, q] of cover) {
          if (p - cur > 0.3) free.push([cur, p]);
          cur = Math.max(cur, q);
        }
        if (b - cur > 0.3) free.push([cur, b]);
        for (const [p0, q0] of free)
          for (const [p, q] of openSpans(axis, c, p0, q0, s.from.id)) {
            const [x0, y0] = axis === "x" ? [p, c] : [c, p];
            const [x1, y1] = axis === "x" ? [q, c] : [c, q];
            railing(kit, glassKit, m.railType, x0, y0, L.h, x1, y1, L.h, 3.2, m.rail, { handrailWood: true });
          }
      }
    }
    // railings around the hole on the upper floor, except at the arrival
    const holeG = CellGrid.fromRects(lay.holes.map((h) => ({ rect: h, val: true })));
    const upper = plan.levelById.get(lay.holeLevel)!;
    const er = holeG.edgeRuns((n, p) => (n && !p ? "+" : p && !n ? "-" : null));
    for (const e of er) {
      const dir = e.key === "+" ? 1 : -1;
      const c = e.c + dir * 0.12;
      for (const [p, q] of openSpans(e.axis, e.c, e.a, e.b, upper.id)) {
        const [x0, y0] = e.axis === "x" ? [p, c] : [c, p];
        const [x1, y1] = e.axis === "x" ? [q, c] : [c, q];
        // distance from the arrival point to this segment
        const ax = lay.arrival.x, ay = lay.arrival.y;
        const tx = Math.max(Math.min(x0, x1), Math.min(Math.max(x0, x1), ax));
        const ty = Math.max(Math.min(y0, y1), Math.min(Math.max(y0, y1), ay));
        if (Math.hypot(ax - tx, ay - ty) < 2.6) continue;
        railing(kit, glassKit, m.railType, x0, y0, upper.elev, x1, y1, upper.elev, 3.3, m.rail, { handrailWood: true });
      }
    }
    const g = kit.build();
    ctx.add(g, { kind: "stair", level: s.from.id, room: room?.id, id: s.id, label: `Stair ${s.from.name} → ${s.to.name}` });
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.userData.collide = false;
    });
    if (!glassKit.empty) {
      const gg = glassKit.build(new THREE.Group(), false);
      ctx.add(gg, { kind: "railing:glass", level: s.from.id, room: room?.id, id: `${s.id}_glass`, label: "Stair glass balustrade" });
      gg.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).renderOrder = 2;
          ctx.collider(o as THREE.Mesh);
        }
      });
    }
    // invisible ramp colliders so the walkthrough glides up the flights
    lay.flights.forEach((f, i) => {
      const mb = new MeshBuilder();
      const s0 = f.s0 - f.sign * f.tread;
      const s1 = f.s0 + f.sign * (f.n - 1) * f.tread;
      const [ax, ay] = pt(f, s0, f.c0);
      const [bx, by] = pt(f, s1, f.c0);
      const o = P3(ax, ay, f.h0 + 0.03);
      const along = P3(bx - ax, by - ay, f.n * f.riser);
      const across = f.axis === "x" ? new THREE.Vector3(0, 0, (f.c1 - f.c0) * FT) : new THREE.Vector3((f.c1 - f.c0) * FT, 0, 0);
      skewBox(mb, o.clone().add(new THREE.Vector3(0, -0.1, 0)), along, new THREE.Vector3(0, 0.1, 0), across);
      const geo = mb.build();
      if (geo) ctx.addColliderOnly(geo, { kind: "stair:ramp", level: s.from.id, id: `${s.id}_ramp_${i}` });
    });
    for (const L of lay.landings) {
      const mb = new MeshBuilder();
      const r = L.rect;
      mb.box(r.x * FT, (L.h - 0.3) * FT, r.y * FT, (r.x + r.w) * FT, (L.h + 0.03) * FT, (r.y + r.d) * FT);
      const geo = mb.build();
      if (geo) ctx.addColliderOnly(geo, { kind: "stair:landing", level: s.from.id, id: ctx.uid(`${s.id}_landing`) });
    }
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
