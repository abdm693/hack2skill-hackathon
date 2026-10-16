/**
 * B.4 furniture keep-out zones (plan ft), computed once per room after the structure exists:
 *  - doors: (width + 1 ft) × max(3 ft, leaf + 0.5 ft) on the swing side, × 3 ft on the other side (sliding doors
 *    and arches: 3 ft both sides);
 *  - open-plan edges: a 3.5 ft gate, 3 ft deep on both sides, where people actually cross;
 *  - stairs: the laid-out stair + 0.5 ft, its foot landing, its top landing and 1 ft around the stairwell;
 *  - the roof door's outside landing, the water tank and the solar area on the roof;
 *  - windows: a 2 ft band in front of each window, for items taller than its sill;
 *  - wall items: every door or window on the wall ± 0.3 ft (see solidIntervals).
 */
import type { Side } from "@contracts/house-sdk";
import type { BuildCtx } from "../core/ctx";
import { expandRect, type R } from "../core/grid";
import type { RoomM } from "../plan/model";
import { innerRect } from "../interior";
import { subtract, type Span } from "../structure/cover";

export interface Zone {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  kind: "door" | "gate" | "stair" | "roof_door" | "tank" | "solar" | "window" | "walkway" | "bay";
  /** windows: sill height above the room floor (the zone applies to items that rise 0.5 ft above the sill) */
  sill?: number;
  /** the part that may never be touched, used when the full clearance leaves no room (the door leaf's sweep and
   *  2 ft in front of every doorway, the stair itself, its landings and 0.5 ft around the stairwell) */
  core?: { x0: number; x1: number; y0: number; y1: number };
  id?: string;
}

const SIDES: Side[] = ["front", "back", "left", "right"];
const fromR = (r: R, kind: Zone["kind"], id?: string): Zone => ({ x0: r.x, x1: r.x + r.w, y0: r.y, y1: r.y + r.d, kind, id });
const hits = (z: { x0: number; x1: number; y0: number; y1: number }, r: RoomM, m = 0) => z.x0 < r.rect.x + r.rect.w + m && z.x1 > r.rect.x - m && z.y0 < r.rect.y + r.rect.d + m && z.y1 > r.rect.y - m;

const cache = new WeakMap<BuildCtx, Map<string, Zone[]>>();

export function keepOut(ctx: BuildCtx, room: RoomM): Zone[] {
  let m = cache.get(ctx);
  if (!m) cache.set(ctx, (m = new Map()));
  let z = m.get(room.id);
  if (!z) m.set(room.id, (z = computeZones(ctx, room)));
  return z;
}

function computeZones(ctx: BuildCtx, room: RoomM): Zone[] {
  const out: Zone[] = [];
  const model = ctx.model;
  const plan = ctx.plan;
  // doors and windows on this room's walls
  for (const o of model.openingsOfRoom(room)) {
    const run = o.run;
    const into = run.neg === room ? -1 : 1;
    const c0 = run.c + (into * run.t) / 2;
    const w = o.u1 - o.u0;
    if (o.isDoor) {
      const hinged = o.op.type !== "sliding_door" && o.op.type !== "arch";
      const leaf = o.op.type === "double_door" ? w / 2 : w;
      const swing = hinged && o.swingSide === into;
      const depth = swing ? Math.max(3.0, leaf + 0.5) : 3.0;
      const box = (a: number, b: number, dep: number) => {
        const c1 = c0 + into * dep;
        return run.axis === "x" ? { x0: a, x1: b, y0: Math.min(c0, c1), y1: Math.max(c0, c1) } : { x0: Math.min(c0, c1), x1: Math.max(c0, c1), y0: a, y1: b };
      };
      const core = swing ? box(o.u0 - 0.15, o.u1 + 0.15, leaf + 0.15) : box(o.u0, o.u1, 2.0);
      out.push({ ...box(o.u0 - 0.5, o.u1 + 0.5, depth), kind: "door", id: o.op.id, core });
    } else {
      const c1 = c0 + into * 2.0;
      const a = o.u0 - 0.3, b = o.u1 + 0.3;
      const sill = o.bottom - room.floorH;
      out.push(run.axis === "x" ? { x0: a, x1: b, y0: Math.min(c0, c1), y1: Math.max(c0, c1), kind: "window", sill, id: o.op.id } : { x0: Math.min(c0, c1), x1: Math.max(c0, c1), y0: a, y1: b, kind: "window", sill, id: o.op.id });
    }
  }
  // open-plan gates
  for (const oid of room.open) {
    const other = plan.room(oid);
    if (!other || other.level !== room.level) continue;
    const e = sharedEdge(room.rect, other.rect);
    if (!e) continue;
    let mid = (e.a + e.b) / 2;
    // a stair landing that reaches this edge sets where people cross
    for (const lay of model.stairs) {
      for (const L of [lay.stair.from.id === room.level ? lay.foot : null, lay.holeLevel === room.level ? lay.landing : null]) {
        if (!L) continue;
        const lo = e.axis === "x" ? L.x : L.y, hi = e.axis === "x" ? L.x + L.w : L.y + L.d;
        const cl = e.axis === "x" ? L.y : L.x, ch = e.axis === "x" ? L.y + L.d : L.x + L.w;
        if (hi > e.a && lo < e.b && cl < e.c + 6 && ch > e.c - 6) mid = Math.min(Math.max((lo + hi) / 2, e.a + 1.75), e.b - 1.75);
      }
    }
    const a = Math.max(e.a, mid - 1.75), b = Math.min(e.b, mid + 1.75);
    const a2 = Math.max(e.a, mid - 1.5), b2 = Math.min(e.b, mid + 1.5);
    const core = e.axis === "x" ? { x0: a2, x1: b2, y0: e.c - 2, y1: e.c + 2 } : { x0: e.c - 2, x1: e.c + 2, y0: a2, y1: b2 };
    out.push(e.axis === "x" ? { x0: a, x1: b, y0: e.c - 3, y1: e.c + 3, kind: "gate", id: oid, core } : { x0: e.c - 3, x1: e.c + 3, y0: a, y1: b, kind: "gate", id: oid, core });
  }
  // stairs
  for (const lay of model.stairs) {
    if (lay.stair.from.id === room.level) {
      const z = fromR(expandRect(lay.rect, 0.5), "stair", lay.stair.id);
      const r2 = expandRect(lay.rect, 0.15);
      z.core = { x0: r2.x, x1: r2.x + r2.w, y0: r2.y, y1: r2.y + r2.d };
      if (hits(z, room)) out.push(z);
      const f = fromR(expandRect(lay.foot, 0.25), "stair", lay.stair.id);
      if (hits(f, room)) out.push(f);
    }
    if (lay.holeLevel === room.level) {
      for (const h of lay.holes) {
        const z = fromR(expandRect(h, 1.0), "stair", lay.stair.id);
        const r2 = expandRect(h, 0.5);
        z.core = { x0: r2.x, x1: r2.x + r2.w, y0: r2.y, y1: r2.y + r2.d };
        if (hits(z, room)) out.push(z);
      }
      const l = fromR(lay.landing, "stair", lay.stair.id);
      if (hits(l, room)) out.push(l);
    }
  }
  // roof: the tower door's outside landing, the water tank, the solar area
  if (room.lv.isRoof) {
    const tw = model.tower;
    const door = tw ? model.openings.find((o) => o.op.level === tw.room.level && o.isDoor && (o.run.neg === tw.room || o.run.pos === tw.room)) : null;
    if (door) {
      const run = door.run;
      const out1 = run.neg === tw!.room ? 1 : -1;
      const c0 = run.c + (out1 * run.t) / 2, c1 = c0 + out1 * 3.5;
      const z: Zone = run.axis === "x" ? { x0: door.u0 - 0.5, x1: door.u1 + 0.5, y0: Math.min(c0, c1), y1: Math.max(c0, c1), kind: "roof_door" } : { x0: Math.min(c0, c1), x1: Math.max(c0, c1), y0: door.u0 - 0.5, y1: door.u1 + 0.5, kind: "roof_door" };
      if (hits(z, room)) out.push(z);
    }
    const t = plan.plan.roof?.water_tank?.rect;
    if (t) {
      const z = fromR(expandRect({ x: Number(t.x) || 0, y: Number(t.y) || 0, w: Number(t.w) || 0, d: Number(t.d) || 0 }, 1), "tank");
      if (hits(z, room)) out.push(z);
    }
    const sol = solarRect(ctx);
    if (sol) {
      const z = fromR(sol, "solar");
      if (hits(z, room)) out.push(z);
    }
  }
  return out;
}

export function sharedEdge(a: R, b: R): { axis: "x" | "y"; c: number; a: number; b: number } | null {
  const tol = 0.05;
  const ox0 = Math.max(a.x, b.x), ox1 = Math.min(a.x + a.w, b.x + b.w);
  const oy0 = Math.max(a.y, b.y), oy1 = Math.min(a.y + a.d, b.y + b.d);
  if (ox1 - ox0 > 0.5 && (Math.abs(a.y + a.d - b.y) < tol || Math.abs(b.y + b.d - a.y) < tol)) return { axis: "x", c: Math.abs(a.y + a.d - b.y) < tol ? b.y : a.y, a: ox0, b: ox1 };
  if (oy1 - oy0 > 0.5 && (Math.abs(a.x + a.w - b.x) < tol || Math.abs(b.x + b.w - a.x) < tol)) return { axis: "y", c: Math.abs(a.x + a.w - b.x) < tol ? b.x : a.x, a: oy0, b: oy1 };
  return null;
}

/** The roof area kept clear for solar panels (plan.roof.solar.rect, or the engine's own pick), or null. */
export function solarRect(ctx: BuildCtx): R | null {
  const s = ctx.plan.plan.roof?.solar;
  if (!s) return null;
  const r = s.rect;
  if (r && [r.x, r.y, r.w, r.d].every((v) => Number.isFinite(Number(v))) && Number(r.w) > 1 && Number(r.d) > 1) return { x: Number(r.x), y: Number(r.y), w: Number(r.w), d: Number(r.d) };
  return (ctx as unknown as { solarAuto?: R | null }).solarAuto ?? null;
}

/**
 * Solid intervals of a room's wall on one side, in plan coordinates along the wall: wall runs minus every door
 * and window ± 0.3 ft, minus open-plan stretches, inside the room's inner extent. Wall items go only here.
 */
export function solidIntervals(ctx: BuildCtx, room: RoomM, side: Side): Span[] {
  const inner = innerRect(ctx, room);
  const axis = side === "front" || side === "back" ? "x" : "y";
  const lo = axis === "x" ? inner.x0 : inner.y0, hi = axis === "x" ? inner.x1 : inner.y1;
  const spans: Span[] = [];
  const cuts: Span[] = [];
  for (const w of ctx.model.roomWalls(room, side)) {
    const a = Math.max(lo, w.a), b = Math.min(hi, w.b);
    if (b - a > 0.05) spans.push([a, b]);
    for (const o of w.run.openings) cuts.push([o.u0 - 0.3, o.u1 + 0.3]);
  }
  // wall runs that meet end to end (at a T junction) are one continuous face on this side
  spans.sort((p, q) => p[0] - q[0]);
  const merged: Span[] = [];
  for (const sp of spans) {
    const last = merged[merged.length - 1];
    if (last && sp[0] <= last[1] + 0.06) last[1] = Math.max(last[1], sp[1]);
    else merged.push([sp[0], sp[1]]);
  }
  return subtract(merged, cuts, 0.3);
}

export { SIDES };
