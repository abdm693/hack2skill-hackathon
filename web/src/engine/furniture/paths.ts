/**
 * B.5 walking paths (900 mm): after each furnishing section, every entry of an open-plan cluster of rooms (each
 * door, the stair foot and the top landing) must be reachable from every other with a 3 ft wide path between the
 * furniture (obstacles grown by 1.5 ft, beds by 1.25 ft, walls by 0.6 ft). When furniture cuts a path, the piece
 * that reconnects the most entries is moved along its wall, to another wall or nearby, and left out as a last
 * resort. Whatever cannot be repaired is reported.
 */
import * as THREE from "three";
import type { BuildCtx, PlacedItem } from "../core/ctx";
import { FT, DEG, warn } from "../core/util";
import type { RoomM } from "../plan/model";
import { innerRect } from "../interior";
import { blocksWindow, keepOut } from "./zones";

const CELL = 0.25;
const FIXED = new Set(["kitchen_counter", "wc", "vanity", "shower", "bathtub", "tv_unit", "car_sedan", "car_suv", "fridge", "kitchen_island", "washing_machine", "oven"]);
/** moved if that frees the path, but never left out (a dresser that cannot move off the walkway is left out) */
const KEEP = new Set(["bed_king", "bed_queen", "bed_single", "sofa_3", "sofa_2", "sofa_l", "dining_table_4", "dining_table_6", "dining_table_8", "wardrobe", "study_desk"]);
/** may be made up to 15 % narrower to move off a walkway */
const NARROWER = new Set(["dresser", "sideboard", "console_table", "bookshelf", "dressing_table", "wardrobe", "study_desk"]);
type Box = { x0: number; x1: number; y0: number; y1: number };

const inflateOf = (it: PlacedItem) => (it.type.startsWith("bed_") ? 1.25 : it.type.startsWith("dining_table") ? 2.2 : 1.5);
const ROT: Record<string, number> = { front: 0, back: 180, left: -90, right: 90 };

function footprint(cx: number, cy: number, w: number, d: number, rotDeg: number): Box {
  const t = rotDeg * DEG;
  const hx = (Math.abs(Math.cos(t)) * w + Math.abs(Math.sin(t)) * d) / 2;
  const hy = (Math.abs(Math.sin(t)) * w + Math.abs(Math.cos(t)) * d) / 2;
  return { x0: cx - hx, x1: cx + hx, y0: cy - hy, y1: cy + hy };
}

function clusterOf(ctx: BuildCtx, room: RoomM): RoomM[] {
  const out = new Set<RoomM>([room]);
  const q = [room];
  while (q.length) {
    const r = q.pop()!;
    for (const id of r.open) {
      const o = ctx.plan.room(id);
      if (o && o.level === r.level && !out.has(o) && o.cat !== "outdoor") {
        out.add(o);
        q.push(o);
      }
    }
  }
  return [...out];
}

interface Grid {
  x0: number;
  y0: number;
  nx: number;
  ny: number;
  base: Uint8Array; // walkable before furniture
}

function baseGrid(ctx: BuildCtx, rooms: RoomM[]): Grid {
  const x0 = Math.min(...rooms.map((r) => r.rect.x)), y0 = Math.min(...rooms.map((r) => r.rect.y));
  const x1 = Math.max(...rooms.map((r) => r.rect.x + r.rect.w)), y1 = Math.max(...rooms.map((r) => r.rect.y + r.rect.d));
  const nx = Math.ceil((x1 - x0) / CELL), ny = Math.ceil((y1 - y0) / CELL);
  const base = new Uint8Array(nx * ny);
  // room rects (walls are blocked below, with their own clearance; open-plan edges must stay passable)
  const inners = rooms.map((r) => ({ x0: r.rect.x, x1: r.rect.x + r.rect.w, y0: r.rect.y, y1: r.rect.y + r.rect.d }));
  const level = rooms[0].level;
  const runs = (ctx.model.runsByLevel.get(level) ?? []).filter((r) => r.kind !== "boundary");
  const stairs = ctx.model.stairs;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * CELL, y = y0 + (j + 0.5) * CELL;
      let ok = rooms.some((r, k) => x >= r.rect.x && x <= r.rect.x + r.rect.w && y >= r.rect.y && y <= r.rect.y + r.rect.d && x >= inners[k].x0 - 0.01 && x <= inners[k].x1 + 0.01 && y >= inners[k].y0 - 0.01 && y <= inners[k].y1 + 0.01);
      if (ok)
        for (const run of runs) {
          const along = run.axis === "x" ? x : y, across = run.axis === "x" ? y : x;
          if (along < run.ea - 0.6 || along > run.eb + 0.6) continue;
          if (Math.abs(across - run.c) > run.t / 2 + 0.6) continue;
          // an open doorway in that wall is not an obstacle
          if (run.openings.some((o) => o.isDoor && along > o.u0 + 0.1 && along < o.u1 - 0.1)) continue;
          ok = false;
          break;
        }
      if (ok)
        for (const s of stairs) {
          if (s.stair.from.id === level && x > s.rect.x && x < s.rect.x + s.rect.w && y > s.rect.y && y < s.rect.y + s.rect.d) ok = false;
          if (s.holeLevel === level && s.holes.some((h) => x > h.x && x < h.x + h.w && y > h.y && y < h.y + h.d)) ok = false;
          if (!ok) break;
        }
      base[j * nx + i] = ok ? 1 : 0;
    }
  return { x0, y0, nx, ny, base };
}

function entriesOf(ctx: BuildCtx, rooms: RoomM[]): { x: number; y: number; what: string; room?: RoomM }[] {
  const out: { x: number; y: number; what: string; room?: RoomM }[] = [];
  const set = new Set(rooms);
  const level = rooms[0].level;
  for (const o of ctx.model.openings) {
    if (!o.isDoor || o.op.level !== level) continue;
    for (const [r, into] of [[o.run.neg, -1], [o.run.pos, 1]] as const) {
      if (!r || !set.has(r)) continue;
      const other = into < 0 ? o.run.pos : o.run.neg;
      if (other && set.has(other)) continue;
      const u = (o.u0 + o.u1) / 2, c = o.run.c + into * 1.5;
      out.push(o.run.axis === "x" ? { x: u, y: c, what: o.op.id, room: r } : { x: c, y: u, what: o.op.id, room: r });
    }
  }
  for (const lay of ctx.model.stairs) {
    const inside = (x: number, y: number) => rooms.some((r) => x >= r.rect.x && x <= r.rect.x + r.rect.w && y >= r.rect.y && y <= r.rect.y + r.rect.d);
    if (lay.stair.from.id === level) {
      const f = lay.foot, x = f.x + f.w / 2, y = f.y + f.d / 2;
      if (inside(x, y)) out.push({ x, y, what: `${lay.stair.id} foot` });
    }
    if (lay.holeLevel === level) {
      const f = lay.landing, x = f.x + f.w / 2, y = f.y + f.d / 2;
      if (inside(x, y)) out.push({ x, y, what: `${lay.stair.id} top` });
    }
  }
  return out;
}

/** Components reached by the entries; returns how many entries share the largest component. */
function connectivity(g: Grid, mask: Uint8Array, entries: { x: number; y: number }[]): { best: number; cells: number[] } {
  const { nx, ny } = g;
  const cells = entries.map((e) => {
    const i0 = Math.floor((e.x - g.x0) / CELL), j0 = Math.floor((e.y - g.y0) / CELL);
    // snap to the nearest walkable cell within 1 ft
    let best = -1, bd = Infinity;
    for (let dj = -4; dj <= 4; dj++)
      for (let di = -4; di <= 4; di++) {
        const i = i0 + di, j = j0 + dj;
        if (i < 0 || j < 0 || i >= nx || j >= ny || !mask[j * nx + i]) continue;
        const dd = di * di + dj * dj;
        if (dd < bd) { bd = dd; best = j * nx + i; }
      }
    return best;
  });
  const comp = new Int32Array(nx * ny).fill(-1);
  let nc = 0;
  for (const c0 of cells) {
    if (c0 < 0 || comp[c0] >= 0) continue;
    const q = [c0];
    comp[c0] = nc;
    while (q.length) {
      const cur = q.pop()!;
      const ci = cur % nx, cj = (cur - ci) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const k = j * nx + i;
        if (!mask[k] || comp[k] >= 0) continue;
        comp[k] = nc;
        q.push(k);
      }
    }
    nc++;
  }
  const count = new Map<number, number>();
  for (const c of cells) if (c >= 0) count.set(comp[c], (count.get(comp[c]) ?? 0) + 1);
  return { best: Math.max(0, ...count.values()), cells };
}

/** An item's no-walk area: 1.5 ft in front of it (1.25 ft for beds); along its wall only 0.75 ft past its ends. */
function stampItem(g: Grid, mask: Uint8Array, it: PlacedItem, box: Box = it): void {
  const inf = inflateOf(it);
  if (!it.against) return stamp(g, mask, box, inf);
  const alongX = it.against === "front" || it.against === "back";
  const e = Math.min(inf, 0.75);
  const b2 = alongX ? { x0: box.x0 - e, x1: box.x1 + e, y0: box.y0 - inf, y1: box.y1 + inf } : { x0: box.x0 - inf, x1: box.x1 + inf, y0: box.y0 - e, y1: box.y1 + e };
  stamp(g, mask, b2, 0);
}

function stamp(g: Grid, mask: Uint8Array, b: Box, inflate: number): void {
  const i0 = Math.max(0, Math.floor((b.x0 - inflate - g.x0) / CELL)), i1 = Math.min(g.nx, Math.ceil((b.x1 + inflate - g.x0) / CELL));
  const j0 = Math.max(0, Math.floor((b.y0 - inflate - g.y0) / CELL)), j1 = Math.min(g.ny, Math.ceil((b.y1 + inflate - g.y0) / CELL));
  for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) mask[j * g.nx + i] = 0;
}

export function ensurePaths(ctx: BuildCtx, roomIds: Iterable<string>): void {
  const done = new Set<string>();
  for (const id of roomIds) {
    const room = ctx.plan.room(id);
    if (!room || room.cat === "outdoor" || done.has(id)) continue;
    const cluster = clusterOf(ctx, room);
    for (const r of cluster) done.add(r.id);
    repairCluster(ctx, cluster);
  }
}

function repairCluster(ctx: BuildCtx, rooms: RoomM[]): void {
  const ids = new Set(rooms.map((r) => r.id));
  const entries = entriesOf(ctx, rooms);
  if (entries.length < 2) return;
  const g = baseGrid(ctx, rooms);
  const obstacles = () => ctx.items.filter((it) => ids.has(it.room) && it.cls === "floor");
  const maskWith = (skip?: PlacedItem, extra?: { it: PlacedItem; box: Box }) => {
    const m = g.base.slice();
    for (const it of obstacles()) {
      if (it === skip) continue;
      stampItem(g, m, it);
    }
    if (extra) stampItem(g, m, extra.it, extra.box);
    return m;
  };
  const bareCells = connectivity(g, g.base, entries).cells;
  const bareLab = labels(g, g.base);
  const score = (mask: Uint8Array) => joined(g, mask, entries, bareLab, bareCells);
  const stuck = new Set<PlacedItem>();
  for (let iter = 0; iter < 12; iter++) {
    const cur = score(maskWith()).ok;
    if (!score(maskWith()).blocked.length) return;
    // the piece whose removal reconnects the most entries (smaller pieces first on ties)
    let culprit: { it: PlacedItem; gain: number; area: number } | null = null;
    for (const it of obstacles()) {
      if (FIXED.has(it.type) || stuck.has(it)) continue;
      const gain = score(maskWith(it)).ok - cur;
      const area = (it.x1 - it.x0) * (it.y1 - it.y0);
      if (gain > 0 && (!culprit || gain > culprit.gain || (gain === culprit.gain && area < culprit.area))) culprit = { it, gain, area };
    }
    if (!culprit) {
      // several pieces block together: take the ones standing on the natural route (walls only) between an
      // entry that is cut off and the others, the piece covering most of that route first
      const route = naturalRoute(g, maskWith(), entries);
      if (!route) break;
      const onRoute = obstacles()
        .filter((it) => !FIXED.has(it.type) && !stuck.has(it))
        .map((it) => {
          const inf = inflateOf(it);
          let n = 0;
          for (const [x, y] of route) if (x > it.x0 - inf && x < it.x1 + inf && y > it.y0 - inf && y < it.y1 + inf) n++;
          return { it, gain: n, area: (it.x1 - it.x0) * (it.y1 - it.y0) };
        })
        .filter((c) => c.gain > 0)
        .sort((a, b) => b.gain - a.gain || a.area - b.area);
      if (!onRoute.length) break;
      culprit = onRoute[0];
      const routeFree = (skip: PlacedItem, box: Box) => {
        const inf = inflateOf(skip);
        return !route.some(([x, y]) => x > box.x0 - inf && x < box.x1 + inf && y > box.y0 - inf && y < box.y1 + inf);
      };
      const c = culprit;
      if (!relocate(ctx, c.it, rooms, (box) => routeFree(c.it, box))) {
        if (KEEP.has(c.it.type)) stuck.add(c.it);
        else drop(ctx, c.it);
      } else stuck.clear(); // (a piece that moved may have freed a spot for one that could not move before)
      continue;
    }
    if (!relocate(ctx, culprit.it, rooms, (box) => score(maskWith(culprit!.it, { it: culprit!.it, box })).ok > cur)) {
      if (KEEP.has(culprit.it.type)) {
        stuck.add(culprit.it);
        continue;
      }
      drop(ctx, culprit.it);
    } else stuck.clear();
  }
  // EN-03/EN-07: one note per room group (whichever room started the repair), naming the floor; a later section
  // that frees the path takes the note away again
  const key = `asbuilt.path_blocked:${[...ids].sort()[0]}`;
  const left = score(maskWith()).blocked;
  if (left.length) {
    const cut = [...new Set(left.map((k) => entries[k].room).filter((r): r is RoomM => !!r))];
    const named = (cut.length ? cut : rooms).map((r) => r.name);
    const floor = rooms[0].lv.name.toLowerCase();
    ctx.notes.set({ id: key, title: "Tight walking path", status: "warn", message: `${named.join(" and ")} (${floor}): furniture leaves less than 3 ft in front of some doors or the stair.`, element_ids: rooms.map((r) => r.id) });
  } else ctx.notes.remove(key);
}

/** Entries joined by a 3 ft path to the others they could reach on the bare floor (walls and stairs only); entries
 *  that walls already part (a plan issue, not furniture) are judged within their own group. */
function joined(g: Grid, mask: Uint8Array, entries: { x: number; y: number }[], bareLab: Int32Array, bareCells: number[]): { ok: number; blocked: number[] } {
  const fur = connectivity(g, mask, entries).cells;
  const lab = labels(g, mask);
  const groups = new Map<number, number[]>();
  bareCells.forEach((c, k) => {
    if (c < 0) return;
    const key = bareLab[c];
    groups.set(key, [...(groups.get(key) ?? []), k]);
  });
  let ok = 0;
  const blocked: number[] = [];
  for (const ks of groups.values()) {
    const cnt = new Map<number, number[]>();
    for (const k of ks) {
      const key = fur[k] < 0 ? -1 - k : lab[fur[k]];
      cnt.set(key, [...(cnt.get(key) ?? []), k]);
    }
    const main = [...cnt.values()].sort((a, b) => b.length - a.length)[0];
    ok += main.length;
    for (const k of ks) if (!main.includes(k)) blocked.push(k);
  }
  return { ok, blocked };
}

/** Shortest route on the bare floor (walls and stairs only) from a cut-off entry to the main group, as plan points. */
function naturalRoute(g: Grid, furnished: Uint8Array, entries: { x: number; y: number }[]): [number, number][] | null {
  const bare = connectivity(g, g.base, entries).cells; // entry cells on the bare floor
  const fur = connectivity(g, furnished, entries).cells; // and on the furnished floor
  const labB = labels(g, g.base), labF = labels(g, furnished);
  let best: [number, number][] | null = null;
  for (let a = 0; a < entries.length; a++)
    for (let b = a + 1; b < entries.length; b++) {
      if (bare[a] < 0 || bare[b] < 0 || labB[bare[a]] !== labB[bare[b]]) continue; // walls part them anyway
      if (fur[a] >= 0 && fur[b] >= 0 && labF[fur[a]] === labF[fur[b]]) continue; // already joined
      const r = bfsRoute(g, bare[a], bare[b]);
      if (r && (!best || r.length < best.length)) best = r;
    }
  return best;
}

function bfsRoute(g: Grid, s: number, t: number): [number, number][] | null {
  const { nx, ny } = g;
  const prev = new Int32Array(nx * ny).fill(-2);
  const q = new Int32Array(nx * ny);
  let h = 0, e = 0;
  q[e++] = s;
  prev[s] = -1;
  while (h < e) {
    const cur = q[h++];
    if (cur === t) break;
    const ci = cur % nx, cj = (cur - ci) / nx;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
      const k = j * nx + i;
      if (!g.base[k] || prev[k] !== -2) continue;
      prev[k] = cur;
      q[e++] = k;
    }
  }
  if (prev[t] === -2) return null;
  const out: [number, number][] = [];
  for (let k = t; k !== -1; k = prev[k]) out.push([g.x0 + ((k % nx) + 0.5) * CELL, g.y0 + (Math.floor(k / nx) + 0.5) * CELL]);
  return out;
}

/** Move an item (and anything standing on it) to a spot that is free and reconnects the paths. */
function relocate(ctx: BuildCtx, it: PlacedItem, rooms: RoomM[], improves: (box: Box) => boolean): boolean {
  const room = ctx.plan.room(it.room);
  if (!room || it.w === undefined || it.d === undefined) return false;
  const w0 = it.w, d = it.d;
  const inner = room.cat === "enclosed" ? innerRect(ctx, room) : { x0: room.rect.x + 0.2, x1: room.rect.x + room.rect.w - 0.2, y0: room.rect.y + 0.2, y1: room.rect.y + room.rect.d - 0.2 };
  // (EN2-02: a tall piece is never moved in front of a window to free a path)
  const zones = keepOut(ctx, room).filter((z) => z.kind !== "window" || blocksWindow(it.type, it.h1 - it.h0, z));
  const others = ctx.items.filter((q) => q !== it && q.room === it.room && q.cls === "floor");
  const ov = (a: Box, b: Box, t = 0.06) => a.x0 < b.x1 - t && b.x0 < a.x1 - t && a.y0 < b.y1 - t && b.y0 < a.y1 - t;
  const ok = (b: Box) => b.x0 >= inner.x0 - 0.01 && b.x1 <= inner.x1 + 0.01 && b.y0 >= inner.y0 - 0.01 && b.y1 <= inner.y1 + 0.01 && !zones.some((z) => ov(b, z, 0.02)) && !others.some((q) => ov(b, q)) && improves(b);
  const cx = (it.x0 + it.x1) / 2, cy = (it.y0 + it.y1) / 2;
  // wall runs that meet end to end (a T junction behind) are one face
  const wallsOf = (side: string) => {
    const walls: { a: number; b: number }[] = [];
    for (const wl of ctx.model.roomWalls(room, side as "front" | "back" | "left" | "right").map((x) => ({ a: x.a, b: x.b })).sort((p, q) => p.a - q.a)) {
      const last = walls[walls.length - 1];
      if (last && wl.a <= last.b + 0.06) last.b = Math.max(last.b, wl.b);
      else walls.push(wl);
    }
    return walls;
  };
  const candidates = (w: number) => {
    const cands: { x: number; y: number; rot: number; side?: string }[] = [];
    if (it.against) {
      for (const side of ["front", "back", "left", "right"]) {
        const rot = ROT[side];
        const t = rot * DEG;
        const hx = (Math.abs(Math.cos(t)) * w + Math.abs(Math.sin(t)) * d) / 2, hy = (Math.abs(Math.sin(t)) * w + Math.abs(Math.cos(t)) * d) / 2;
        const axisX = side === "front" || side === "back";
        const c = side === "front" ? inner.y0 + hy + 0.02 : side === "back" ? inner.y1 - hy - 0.02 : side === "left" ? inner.x0 + hx + 0.02 : inner.x1 - hx - 0.02;
        const lo = axisX ? inner.x0 + hx : inner.y0 + hy, hi = axisX ? inner.x1 - hx : inner.y1 - hy;
        const pref = axisX ? cx : cy;
        const walls = wallsOf(side);
        const half = axisX ? hx : hy;
        for (let k = 0; k <= Math.ceil((hi - lo) / 0.25) * 2; k++) {
          const u = pref + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25;
          if (u < lo || u > hi) continue;
          if (!walls.some((wl) => u - half >= wl.a - 0.3 && u + half <= wl.b + 0.3)) continue;
          cands.push(axisX ? { x: u, y: c, rot, side } : { x: c, y: u, rot, side });
        }
      }
      // same wall first
      cands.sort((a, b) => (a.side === it.against ? 0 : 1) - (b.side === it.against ? 0 : 1));
    } else {
      for (let rr = 0.25; rr <= 4.001; rr += 0.25) for (let a = 0; a < 24; a++) cands.push({ x: cx + Math.cos((a / 24) * Math.PI * 2) * rr, y: cy + Math.sin((a / 24) * Math.PI * 2) * rr, rot: it.rot ?? 0 });
    }
    return cands;
  };
  void rooms;
  // EN2-02: a piece that may be made shorter (a dresser, a sideboard) tries 95, 90 and 85 % of its width too
  for (const k of NARROWER.has(it.type) ? [1, 0.95, 0.9, 0.85] : [1]) {
    const w = w0 * k;
    for (const c of candidates(w)) {
      const box = footprint(c.x, c.y, w, d, c.rot);
      if (!ok(box)) continue;
      const dx = c.x - cx, dy = c.y - cy;
      const old = { side: it.against, x0: it.x0, x1: it.x1, y0: it.y0, y1: it.y1 };
      const deps = ctx.items.filter((q) => q !== it && q.room === it.room && q.cls === "top" && (q.x0 + q.x1) / 2 > it.x0 && (q.x0 + q.x1) / 2 < it.x1 && (q.y0 + q.y1) / 2 > it.y0 && (q.y0 + q.y1) / 2 < it.y1);
      for (const q of [it, ...deps]) {
        q.group.position.x += dx * FT;
        q.group.position.z -= dy * FT;
        q.x0 += dx; q.x1 += dx; q.y0 += dy; q.y1 += dy;
      }
      if (c.rot !== (it.rot ?? 0)) {
        it.group.rotation.y = c.rot * DEG;
        it.rot = c.rot;
        if (c.side) it.against = c.side;
      }
      if (k !== 1) {
        it.group.scale.x *= k;
        it.w = w;
      }
      Object.assign(it, box);
      rehang(ctx, it, old, dx, dy);
      return true;
    }
  }
  return false;
}

/** Pictures that hang over a moved piece: a mirror or painting over it moves along with it on the same wall and is
 *  taken down when it goes to another wall; a tall piece takes down the pictures it now stands in front of. */
function rehang(ctx: BuildCtx, it: PlacedItem, old: { side?: string; x0: number; x1: number; y0: number; y1: number }, dx: number, dy: number): void {
  const DECO = new Set(["mirror_wall", "painting"]);
  const along = (side: string | undefined, b: Box): [number, number] => (side === "front" || side === "back" ? [b.x0, b.x1] : [b.y0, b.y1]);
  const take = (q: PlacedItem) => {
    q.group.removeFromParent();
    const k = ctx.items.indexOf(q);
    if (k >= 0) ctx.items.splice(k, 1);
  };
  for (const q of ctx.items.filter((q) => q !== it && q.room === it.room && q.cls === "wall" && DECO.has(q.type) && q.against && q.against === old.side)) {
    const [a, b] = along(old.side, old), [qa, qb] = along(old.side, q);
    if (qb <= a + 0.1 || qa >= b - 0.1) continue;
    if (it.against === old.side) {
      const sx = old.side === "front" || old.side === "back" ? dx : 0, sy = old.side === "left" || old.side === "right" ? dy : 0;
      q.group.position.x += sx * FT;
      q.group.position.z -= sy * FT;
      q.x0 += sx; q.x1 += sx; q.y0 += sy; q.y1 += sy;
    } else take(q);
  }
  if (it.h1 - it.h0 > 5 && it.against)
    for (const q of ctx.items.filter((q) => q !== it && q.room === it.room && q.cls === "wall" && DECO.has(q.type) && q.against === it.against)) {
      const [a, b] = along(it.against, it), [qa, qb] = along(it.against, q);
      if (qb > a + 0.1 && qa < b - 0.1) take(q);
    }
}

function drop(ctx: BuildCtx, it: PlacedItem): void {
  const deps = ctx.items.filter((q) => q !== it && q.room === it.room && q.cls === "top" && (q.x0 + q.x1) / 2 > it.x0 && (q.x0 + q.x1) / 2 < it.x1 && (q.y0 + q.y1) / 2 > it.y0 && (q.y0 + q.y1) / 2 < it.y1);
  for (const q of [it, ...deps]) {
    q.group.removeFromParent();
    const meshes = new Set<THREE.Object3D>();
    q.group.traverse((o) => meshes.add(o));
    ctx.colliders = ctx.colliders.filter((m) => !meshes.has(m));
    const k = ctx.items.indexOf(q);
    if (k >= 0) ctx.items.splice(k, 1);
  }
  // EN2-05: an optional piece that gives way to a walking path is left out quietly (the defining ones never are)
  warn(`walking path: ${it.type} in ${it.room} left out to keep a 3 ft path between the doors`);
}

/** For checks: every room cluster's entries and which of them a 3 ft path does not reach. */
export function pathReport(ctx: BuildCtx): { rooms: string[]; entries: number; unreached: string[]; planSplit: boolean }[] {
  const out: { rooms: string[]; entries: number; unreached: string[]; planSplit: boolean }[] = [];
  const seen = new Set<string>();
  for (const room of ctx.plan.rooms) {
    if (seen.has(room.id) || room.cat === "outdoor") continue;
    const cl = clusterOf(ctx, room);
    for (const r of cl) seen.add(r.id);
    const ids = new Set(cl.map((r) => r.id));
    const entries = entriesOf(ctx, cl);
    if (entries.length < 2) continue;
    const g = baseGrid(ctx, cl);
    const m = g.base.slice();
    for (const it of ctx.items) if (ids.has(it.room) && it.cls === "floor") stampItem(g, m, it);
    const bareCells = connectivity(g, g.base, entries).cells;
    const bareLab = labels(g, g.base);
    const j = joined(g, m, entries, bareLab, bareCells);
    // entries walls keep apart (an open_to between rooms that do not touch): a plan issue, listed separately
    const groups = new Set(bareCells.filter((c) => c >= 0).map((c) => bareLab[c]));
    out.push({ rooms: cl.map((r) => r.id), entries: entries.length, unreached: j.blocked.map((k) => entries[k].what), planSplit: groups.size > 1 });
  }
  return out;
}

function labels(g: Grid, mask: Uint8Array): Int32Array {
  const { nx, ny } = g;
  const comp = new Int32Array(nx * ny).fill(-1);
  let nc = 0;
  for (let s = 0; s < nx * ny; s++) {
    if (!mask[s] || comp[s] >= 0) continue;
    const q = [s];
    comp[s] = nc;
    while (q.length) {
      const cur = q.pop()!;
      const ci = cur % nx, cj = (cur - ci) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const i = ci + di, j = cj + dj;
        if (i < 0 || j < 0 || i >= nx || j >= ny) continue;
        const k = j * nx + i;
        if (!mask[k] || comp[k] >= 0) continue;
        comp[k] = nc;
        q.push(k);
      }
    }
    nc++;
  }
  return comp;
}

/** For the dev plan overlay: the walkable mask of a cluster after furniture (1 = a 3 ft path can pass). */
export function pathMask(ctx: BuildCtx, room: RoomM): { x0: number; y0: number; nx: number; ny: number; cell: number; mask: Uint8Array; entries: { x: number; y: number; what: string }[] } {
  const cl = clusterOf(ctx, room);
  const ids = new Set(cl.map((r) => r.id));
  const g = baseGrid(ctx, cl);
  const m = g.base.slice();
  for (const it of ctx.items) if (ids.has(it.room) && it.cls === "floor") stampItem(g, m, it);
  return { x0: g.x0, y0: g.y0, nx: g.nx, ny: g.ny, cell: CELL, mask: m, entries: entriesOf(ctx, cl) };
}
