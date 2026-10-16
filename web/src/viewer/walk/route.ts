/**
 * Room navigator: plans a walk from where you stand to a room, a floor or a point, the way a person would go —
 * along a walkability grid on each floor (through doorways, around furniture) and up or down the engine's stair
 * ramps between floors — and decides where to stop and which way to face.
 *
 * Falls back to the plan's room graph (doors, open-plan edges, outdoor areas) when the grid finds no way through
 * (e.g. furniture in a doorway), and reports "no route" when even the plan has no door to the room.
 */
import * as THREE from "three";
import type { BuildingPlan, Level, Opening, Room } from "@contracts/plan";
import { FT, clamp, zOf } from "../core/units";
import { NavGrid } from "./navgrid";
import { EYE, type WalkController } from "./WalkController";

export type NavTarget =
  | { kind: "room"; room: Room }
  | { kind: "level"; level: Level }
  | { kind: "point"; level: Level; x: number; z: number };

export interface RoutePlan {
  ok: boolean;
  /** Dense feet positions (world m), start → end. */
  pts: THREE.Vector3[];
  /** Final stance. */
  end: THREE.Vector3;
  yaw: number;
  pitch: number;
  length: number;
  /** Per point: how slowly to take the segment that ends there (stairs are taken slower than floors). */
  weights: number[];
  /** Length weighted by `weights` (drives the glide's duration). */
  timeLength: number;
  /** The route uses a stair. */
  stairs: boolean;
  /** Route as plan-feet polylines per level (for the minimap). */
  byLevel: Record<string, [number, number][]>;
  /** True when part of the route ignores furniture (room-graph fallback). */
  rough?: boolean;
  /** The only way in goes through something solid at eye height (a wardrobe in a doorway): don't glide it. */
  blocked?: boolean;
  reason?: string;
}

interface StairPath {
  id: string;
  from: string;
  to: string;
  /** feet positions from the foot (on `from`) to the arrival (on `to`) */
  pts: THREE.Vector3[];
}

const OUTDOOR = new Set(["porch", "balcony", "terrace", "lawn", "driveway", "courtyard", "open_space", "garage"]);
const WALKABLE_OPENINGS = new Set<Opening["type"]>(["main_door", "door", "double_door", "sliding_door", "arch", "garage_door"]);
const LOOK_PITCH = -0.06;
/** Stairs are glided at well under half the floor speed (a quick glide down a flight is dizzying). */
const STAIR_WEIGHT = 2.8;

const _v = new THREE.Vector3();

/** Low/high end centres of an invisible stair ramp (world), from its extreme vertices. */
function rampEnds(m: THREE.Mesh) {
  m.updateWorldMatrix(true, false);
  const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos || pos.count < 3) return null;
  const vs: THREE.Vector3[] = [];
  for (let i = 0; i < pos.count; i++) vs.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld));
  let minY = Infinity, maxY = -Infinity;
  for (const v of vs) {
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }
  const avg = (arr: THREE.Vector3[]) => arr.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, arr.length));
  const lo = avg(vs.filter((v) => v.y < minY + 0.03));
  const hi = avg(vs.filter((v) => v.y > maxY - 0.03));
  if (Math.hypot(hi.x - lo.x, hi.z - lo.z) < 0.15) return null; // a landing, not a flight
  return { lo, hi, minY, maxY };
}

function roomWorldRect(r: Room, inset = 0) {
  return {
    x0: r.rect.x * FT + inset,
    x1: (r.rect.x + r.rect.w) * FT - inset,
    z0: zOf(r.rect.y + r.rect.d) + inset,
    z1: zOf(r.rect.y) - inset,
  };
}

export class Navigator {
  private grids = new Map<string, NavGrid>();
  private stairs: StairPath[] | null = null;
  /** Points that lie on a stair flight (shared with the cached stair paths). */
  private stairSet = new WeakSet<THREE.Vector3>();
  private colliders: THREE.Mesh[] = [];

  constructor(
    private plan: BuildingPlan,
    private walk: WalkController,
  ) {}

  /** A new collider was built (new house, toggles): forget grids and stair paths. */
  reset(plan: BuildingPlan, colliders: THREE.Mesh[]) {
    this.plan = plan;
    this.colliders = colliders;
    this.grids.clear();
    this.stairs = null;
  }

  get levels() {
    return [...this.plan.levels].sort((a, b) => a.index - b.index);
  }

  levelAt(y: number): Level {
    const ls = this.levels;
    let lvl = ls[0];
    for (const l of ls) if (l.elevation_ft * FT <= y + 0.45) lvl = l;
    return lvl;
  }

  grid(levelId: string, budgetMs = Infinity): NavGrid | null {
    if (!this.walk.bvh) return null;
    let g = this.grids.get(levelId);
    if (!g) {
      const lvl = this.plan.levels.find((l) => l.id === levelId);
      if (!lvl) return null;
      const W = this.plan.site.plot.width_ft, D = this.plan.site.plot.depth_ft;
      const lowest = this.levels[0]?.id === levelId;
      // the ground floor also covers the footpath in front of the plot (the walk starts outside)
      const y0 = lowest ? -14 : -3;
      g = new NavGrid(levelId, lvl.elevation_ft * FT, { x0: -0.4, x1: W * FT + 0.4, z0: zOf(D + 1), z1: zOf(y0) }, 0.2, lowest ? [-0.75, 0.4] : [-0.35, 0.35]);
      this.grids.set(levelId, g);
    }
    g.build(this.walk, budgetMs);
    return g.ready ? g : null;
  }

  /** Build grids a little at a time (call from the frame loop while walking). Returns true when all are ready. */
  warm(budgetMs: number): boolean {
    if (!this.walk.bvh) return false;
    const t0 = performance.now();
    for (const l of this.levels) {
      const left = budgetMs - (performance.now() - t0);
      if (left <= 0) return false;
      if (!this.grid(l.id, left)) return false;
    }
    this.stairPaths();
    return true;
  }

  // ───────────────────────────── stairs ─────────────────────────────

  stairPaths(): StairPath[] {
    if (this.stairs) return this.stairs;
    const out: StairPath[] = [];
    for (const s of this.plan.stairs ?? []) {
      const ramps = this.colliders
        .filter((m) => typeof m.userData?.id === "string" && m.userData.id.startsWith(`${s.id}_`) && /ramp/.test(String(m.userData.kind ?? m.userData.id)))
        .map(rampEnds)
        .filter((r): r is NonNullable<ReturnType<typeof rampEnds>> => !!r)
        .sort((a, b) => a.minY - b.minY);
      const from = this.plan.levels.find((l) => l.id === s.from_level), to = this.plan.levels.find((l) => l.id === s.to_level);
      if (!from || !to) continue;
      const xz: THREE.Vector3[] = [];
      if (ramps.length) {
        const dirOf = (r: (typeof ramps)[number]) => new THREE.Vector3(r.hi.x - r.lo.x, 0, r.hi.z - r.lo.z).normalize();
        // step off each end onto the floor, but never through the wall a stair often starts against
        const fy = from.elevation_ft * FT, ty = to.elevation_ft * FT;
        xz.push(this.extendFree(ramps[0].lo.clone().setY(fy), dirOf(ramps[0]).negate(), 0.5));
        for (const r of ramps) xz.push(r.lo.clone(), r.hi.clone());
        const last = ramps[ramps.length - 1];
        xz.push(this.extendFree(last.hi.clone().setY(ty), dirOf(last), 0.6));
      } else {
        // no ramps (older engines): straight across the stair rect
        const r = s.rect;
        const startEdge: Record<string, [number, number, number, number]> = {
          "+y": [r.x + r.w / 2, r.y, r.x + r.w / 2, r.y + r.d],
          "-y": [r.x + r.w / 2, r.y + r.d, r.x + r.w / 2, r.y],
          "+x": [r.x, r.y + r.d / 2, r.x + r.w, r.y + r.d / 2],
          "-x": [r.x + r.w, r.y + r.d / 2, r.x, r.y + r.d / 2],
        };
        const [ax, ay, bx, by] = startEdge[s.start] ?? startEdge["+y"];
        xz.push(new THREE.Vector3(ax * FT, from.elevation_ft * FT, zOf(ay)), new THREE.Vector3(bx * FT, to.elevation_ft * FT, zOf(by)));
      }
      // densify and drop onto the walkable surface (ramp tops, landings, floors)
      const y0 = from.elevation_ft * FT, y1 = to.elevation_ft * FT;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < xz.length; i++) {
        if (i === 0) {
          pts.push(xz[0].clone().setY(y0));
          continue;
        }
        const a = xz[i - 1], b = xz[i];
        const n = Math.max(1, Math.ceil(a.distanceTo(b) / 0.15));
        for (let k = 1; k <= n; k++) pts.push(new THREE.Vector3().lerpVectors(a, b, k / n));
      }
      pts[pts.length - 1].y = y1;
      for (const p of pts) {
        const approx = clamp(p.y, Math.min(y0, y1) - 0.2, Math.max(y0, y1) + 0.2);
        const g = this.walk.groundAt1(p.x, p.z, approx + 0.55, approx - 0.8);
        if (g !== null) p.y = g;
      }
      pts[0].y = this.walk.groundAt1(pts[0].x, pts[0].z, y0 + 0.4, y0 - 0.4) ?? y0;
      for (const p of pts) this.stairSet.add(p);
      out.push({ id: s.id, from: s.from_level, to: s.to_level, pts });
    }
    this.stairs = out;
    return out;
  }

  /** Does the path pass through anything solid at eye height? */
  private crossesAtEye(pts: THREE.Vector3[]): boolean {
    const bvh = this.walk.bvh;
    if (!bvh) return false;
    const ray = new THREE.Ray();
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      ray.origin.set(a.x, a.y + EYE - 0.1, a.z);
      ray.direction.set(b.x - a.x, b.y - a.y, b.z - a.z);
      const len = ray.direction.length();
      if (len < 1e-4) continue;
      ray.direction.multiplyScalar(1 / len);
      if (bvh.raycastFirst(ray, THREE.DoubleSide, 0, len)) return true;
    }
    return false;
  }

  /** Walk from `p` (on a floor) along `dir` up to `max` m, stopping before anything solid. */
  private extendFree(p: THREE.Vector3, dir: THREE.Vector3, max: number): THREE.Vector3 {
    let best = p.clone();
    const q = new THREE.Vector3();
    for (let t = 0.05; t <= max + 1e-6; t += 0.05) {
      q.copy(p).addScaledVector(dir, t);
      const g = this.walk.groundAt1(q.x, q.z, p.y + 0.4, p.y - 0.4);
      if (g === null || Math.abs(g - p.y) > 0.3) break;
      q.y = g;
      if (this.walk.overlaps(q, 0.18)) break;
      best = q.clone();
    }
    return best;
  }

  /**
   * The free grid cell nearest to `p` that can actually see it (a clear straight step at knee height), so a route
   * never joins a stair or a door from the far side of a wall.
   */
  private nearestReachable(g: NavGrid, p: THREE.Vector3, maxR = 1.6): number {
    const R = Math.ceil(maxR / g.cell);
    const c = g.cellAt(p.x, p.z);
    if (c >= 0 && g.free[c] && Math.abs(g.h[c] - p.y) < 0.6) return c;
    const ix0 = Math.floor((p.x - g.b.x0) / g.cell), iz0 = Math.floor((p.z - g.b.z0) / g.cell);
    const cand: [number, number][] = [];
    for (let iz = iz0 - R; iz <= iz0 + R; iz++) {
      if (iz < 0 || iz >= g.nz) continue;
      for (let ix = ix0 - R; ix <= ix0 + R; ix++) {
        if (ix < 0 || ix >= g.nx) continue;
        const i = g.idx(ix, iz);
        if (!g.free[i] || Math.abs(g.h[i] - p.y) > 0.6) continue;
        const d = Math.hypot(g.cx(i) - p.x, g.cz(i) - p.z);
        if (d <= maxR) cand.push([d, i]);
      }
    }
    cand.sort((a, b) => a[0] - b[0]);
    const from = new THREE.Vector3(), dir = new THREE.Vector3();
    for (const [d, i] of cand.slice(0, 80)) {
      from.set(g.cx(i), g.h[i] + 0.5, g.cz(i));
      dir.set(p.x - from.x, 0, p.z - from.z);
      if (d < 1e-3 || this.walk.clearDistance(from, dir.normalize(), d) >= d - 0.02) return i;
    }
    return cand[0]?.[1] ?? -1;
  }

  /** Stairs to climb/descend from level a to level b (BFS over the stair graph), each oriented in travel order. */
  private stairChain(a: string, b: string): THREE.Vector3[][] | null {
    if (a === b) return [];
    const paths = this.stairPaths();
    const prev = new Map<string, { from: string; pts: THREE.Vector3[] }>();
    const q = [a];
    const seen = new Set([a]);
    while (q.length) {
      const cur = q.shift()!;
      if (cur === b) break;
      for (const s of paths) {
        const step = s.from === cur ? { next: s.to, pts: s.pts } : s.to === cur ? { next: s.from, pts: [...s.pts].reverse() } : null;
        if (!step || seen.has(step.next)) continue;
        seen.add(step.next);
        prev.set(step.next, { from: cur, pts: step.pts });
        q.push(step.next);
      }
    }
    if (!prev.has(b)) return null;
    const chain: THREE.Vector3[][] = [];
    for (let c = b; c !== a; ) {
      const p = prev.get(c)!;
      chain.unshift(p.pts);
      c = p.from;
    }
    return chain;
  }

  // ───────────────────────────── floors ─────────────────────────────

  /** Path on one floor between two feet positions: grid A* (string-pulled, corners rounded), else the room graph. */
  private floorPath(levelId: string, a: THREE.Vector3, b: THREE.Vector3): { pts: THREE.Vector3[]; rough: boolean } | null {
    const g = this.grid(levelId);
    if (g) {
      const s = this.nearestReachable(g, a), e = this.nearestReachable(g, b);
      const cells = s >= 0 && e >= 0 ? g.findPath(s, e) : null;
      if (cells) {
        const turns = g.simplify(cells).map((i) => g.center(i));
        const way = [a.clone(), ...turns.slice(1, -1), b.clone()];
        return { pts: roundCorners(dedupe(way), g), rough: false };
      }
    }
    const lvl = this.plan.levels.find((l) => l.id === levelId);
    if (!lvl) return null;
    const rough = roomGraphPath(this.plan, lvl, a, b);
    return rough ? { pts: roundCorners(dedupe(rough), null), rough: true } : null;
  }

  // ───────────────────────────── routing ─────────────────────────────

  route(from: THREE.Vector3, target: NavTarget): RoutePlan {
    const fail = (reason: string): RoutePlan => ({ ok: false, pts: [], end: from.clone(), yaw: 0, pitch: 0, length: 0, weights: [], timeLength: 0, stairs: false, byLevel: {}, reason });
    const startLevel = this.levelAt(from.y);
    const goalLevel = target.kind === "room" ? this.plan.levels.find((l) => l.id === target.room.level) : target.level;
    if (!goalLevel) return fail("unknown level");
    const chain = this.stairChain(startLevel.id, goalLevel.id);
    if (!chain) return fail("no stair");
    const pts: THREE.Vector3[] = [from.clone()];
    let rough = false;
    let cur = from.clone();
    let curLevel = startLevel.id;
    for (const stair of chain) {
      const seg = this.floorPath(curLevel, cur, stair[0]);
      if (!seg) return fail("no path to the stair");
      rough ||= seg.rough;
      pts.push(...seg.pts.slice(1), ...stair.slice(1));
      cur = stair[stair.length - 1].clone();
      curLevel = this.levelAt(cur.y).id;
    }
    // step off the stair onto a free spot
    const gl = this.grid(goalLevel.id);
    if (chain.length && gl) {
      const c = this.nearestReachable(gl, cur, 1.2);
      if (c >= 0) {
        const p = gl.center(c);
        if (p.distanceTo(cur) > 0.05) pts.push(p);
        cur = p;
      }
    }
    let end: THREE.Vector3;
    let face: number;
    if (target.kind === "room") {
      const res = this.roomStand(target.room, cur);
      if (!res) return fail("no spot in the room");
      rough ||= res.rough;
      pts.push(...res.pts.slice(1));
      end = res.end;
      face = res.yaw;
    } else if (target.kind === "point") {
      const want = new THREE.Vector3(target.x, goalLevel.elevation_ft * FT, target.z);
      const c = gl?.nearestFree(want.x, want.z, 2.0);
      const dest = c !== undefined && c >= 0 ? gl!.center(c) : want;
      const seg = this.floorPath(goalLevel.id, cur, dest);
      if (!seg) return fail("no path");
      rough ||= seg.rough;
      pts.push(...seg.pts.slice(1));
      end = pts[pts.length - 1].clone();
      const a = pts[Math.max(0, pts.length - 6)];
      face = Math.hypot(end.x - a.x, end.z - a.z) > 0.1 ? Math.atan2(-(end.x - a.x), -(end.z - a.z)) : this.walk.yaw;
    } else {
      end = cur.clone();
      face = this.intoFloorYaw(goalLevel, end, pts);
    }
    // a stance the real capsule fits (the grid probes a slimmer one)
    const snug = this.walk.overlaps(end) ? this.walk.findFreeSpot(end, end.y, 0.6) : null;
    if (snug) {
      pts.push(snug);
      end = snug;
    }
    const clean = dedupe(pts);
    let length = 0, timeLength = 0;
    const weights = [0];
    for (let i = 1; i < clean.length; i++) {
      const d = clean[i].distanceTo(clean[i - 1]);
      const w = this.stairSet.has(clean[i]) && this.stairSet.has(clean[i - 1]) ? STAIR_WEIGHT : 1;
      weights.push(w);
      length += d;
      timeLength += d * w;
    }
    const blocked = rough && this.crossesAtEye(clean);
    return { ok: true, pts: clean, end, yaw: face, pitch: LOOK_PITCH, length, weights, timeLength, stairs: chain.length > 0, byLevel: this.splitByLevel(clean), rough, blocked };
  }

  /** Where to stand in a room (just inside, a step past the door) and which way to look (into the room). */
  private roomStand(room: Room, from: THREE.Vector3): { pts: THREE.Vector3[]; end: THREE.Vector3; yaw: number; rough: boolean } | null {
    const lvl = this.plan.levels.find((l) => l.id === room.level)!;
    const floorY = lvl.elevation_ft * FT;
    const rect = roomWorldRect(room);
    const inner = roomWorldRect(room, Math.min(0.35, (Math.min(room.rect.w, room.rect.d) * FT) / 4));
    const centre = new THREE.Vector3((rect.x0 + rect.x1) / 2, floorY, (rect.z0 + rect.z1) / 2);
    const g = this.grid(room.level);
    const inside = (p: THREE.Vector3) => p.x >= rect.x0 && p.x <= rect.x1 && p.z >= rect.z0 && p.z <= rect.z1 && Math.abs(p.y - floorY) < 0.8;
    const faceFrom = (p: THREE.Vector3) => {
      const d = _v.subVectors(centre, p);
      d.y = 0;
      if (d.length() > 1.0) return Math.atan2(-d.x, -d.z);
      // standing near the middle: look at the farthest corner
      let best = 0, bd = -1;
      for (const [x, z] of [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x0, rect.z1], [rect.x1, rect.z1]]) {
        const dd = Math.hypot(x - p.x, z - p.z);
        if (dd > bd) {
          bd = dd;
          best = Math.atan2(-(x - p.x), -(z - p.z));
        }
      }
      return best;
    };
    if (g) {
      // the reachable free cell nearest the room's middle, preferring open floor (furniture can wall part of a
      // room off: then you stop where you can stand and still see the room)
      const s = this.nearestReachable(g, from);
      const fl = g.flood(s);
      let goal = -1, gd = Infinity;
      for (let i = 0; i < g.free.length; i++) {
        if (!Number.isFinite(fl.cost[i]) || !g.inRect(i, inner) || Math.abs(g.h[i] - floorY) > 0.6) continue;
        const d = Math.hypot(g.cx(i) - centre.x, g.cz(i) - centre.z) - Math.min(g.clr[i], 3) * 0.35;
        if (d < gd) {
          gd = d;
          goal = i;
        }
      }
      // nothing reachable inside the inset rect: try right up to the walls
      if (goal < 0)
        for (let i = 0; i < g.free.length; i++) {
          if (!Number.isFinite(fl.cost[i]) || !g.inRect(i, rect) || Math.abs(g.h[i] - floorY) > 0.6) continue;
          const d = Math.hypot(g.cx(i) - centre.x, g.cz(i) - centre.z);
          if (d < gd) {
            gd = d;
            goal = i;
          }
        }
      const cells = goal >= 0 && s >= 0 ? NavGrid.trace(fl.came, s, goal) : null;
      if (cells) {
        let stop = cells.length - 1;
        if (!inside(from)) {
          // stop a step inside the room, past the doorway, where there is room to stand
          let entry = 0;
          for (let k = 1; k < cells.length; k++) if (!g.inRect(cells[k - 1], rect) && g.inRect(cells[k], rect)) entry = k;
          let acc = 0;
          stop = entry;
          for (let k = entry + 1; k < cells.length; k++) {
            acc += Math.hypot(g.cx(cells[k]) - g.cx(cells[k - 1]), g.cz(cells[k]) - g.cz(cells[k - 1]));
            stop = k;
            if (acc >= 1.25 && g.clr[cells[k]] >= 2) break;
          }
        }
        const kept = cells.slice(0, stop + 1);
        const turns = g.simplify(kept).map((i) => g.center(i));
        const pts = roundCorners(dedupe([from.clone(), ...turns.slice(1)]), g);
        const end = pts[pts.length - 1].clone();
        return { pts, end, yaw: faceFrom(end), rough: false };
      }
    }
    // fallback: the plan's doors
    const spot = this.walk.findFreeSpot(centre, floorY, 2.5) ?? centre;
    const rough = roomGraphPath(this.plan, lvl, from, spot);
    if (!rough) return null;
    const pts = roundCorners(dedupe(rough), null);
    return { pts, end: pts[pts.length - 1].clone(), yaw: faceFrom(spot), rough: true };
  }

  /**
   * "Into the floor" from a stair landing: toward the middle of the floor's rooms, nudged to the most open view
   * (never a blank wall a step away).
   */
  intoFloorYaw(level: Level, at: THREE.Vector3, path?: THREE.Vector3[]): number {
    const rooms = this.plan.rooms.filter((r) => r.level === level.id && r.type !== "stair");
    let fx = 0, fz = 0, wsum = 0;
    for (const r of rooms) {
      const w = r.rect.w * r.rect.d * (OUTDOOR.has(r.type) ? 0.4 : 1);
      fx += (r.rect.x + r.rect.w / 2) * FT * w;
      fz += zOf(r.rect.y + r.rect.d / 2) * w;
      wsum += w;
    }
    if (!wsum) {
      // the roof: look across the terrace (away from the stair tower)
      const W = this.plan.site.plot.width_ft, D = this.plan.site.plot.depth_ft;
      fx = (W / 2) * FT;
      fz = zOf(D / 2);
      wsum = 1;
    }
    fx /= wsum;
    fz /= wsum;
    const want = Math.atan2(-(fx - at.x), -(fz - at.z));
    // otherwise the way we were heading
    let heading = want;
    if (path && path.length > 3) {
      const a = path[path.length - 4], b = path[path.length - 1];
      if (Math.hypot(b.x - a.x, b.z - a.z) > 0.1) heading = Math.atan2(-(b.x - a.x), -(b.z - a.z));
    }
    const eye = new THREE.Vector3(at.x, at.y + EYE - 0.1, at.z);
    let best = want, bestScore = -Infinity;
    for (let k = -12; k <= 12; k++) {
      const yaw = want + (k * Math.PI) / 12;
      const dir = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const dist = this.walk.clearDistance(eye, dir, 9);
      const off = Math.abs(angleWrap(yaw - want));
      const offH = Math.abs(angleWrap(yaw - heading));
      const score = Math.min(dist, 7) - off * 1.6 - offH * 0.3 - (dist < 1.6 ? 6 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = yaw;
      }
    }
    return best;
  }

  private splitByLevel(pts: THREE.Vector3[]): Record<string, [number, number][]> {
    const out: Record<string, [number, number][]> = {};
    for (const p of pts) {
      const id = this.levelAt(p.y).id;
      (out[id] ??= []).push([p.x / FT, -p.z / FT]);
    }
    return out;
  }
}

const angleWrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function dedupe(pts: THREE.Vector3[]) {
  const out: THREE.Vector3[] = [];
  for (const p of pts) if (!out.length || out[out.length - 1].distanceTo(p) > 0.02) out.push(p);
  return out;
}

/**
 * Round each turn with a short quadratic curve (≤ 0.45 m) and resample every 0.12 m. Heights follow the grid's
 * floor where there is one (thresholds, porch steps); stair points keep their own heights.
 */
function roundCorners(pts: THREE.Vector3[], g: NavGrid | null): THREE.Vector3[] {
  if (pts.length < 2) return pts.map((p) => p.clone());
  const out: THREE.Vector3[] = [pts[0].clone()];
  const push = (p: THREE.Vector3) => {
    const last = out[out.length - 1];
    const d = last.distanceTo(p);
    const n = Math.max(1, Math.ceil(d / 0.12));
    for (let k = 1; k <= n; k++) out.push(new THREE.Vector3().lerpVectors(last, p, k / n));
  };
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], p = pts[i], b = pts[i + 1];
    const din = p.clone().sub(a), dout = b.clone().sub(p);
    const lin = din.length(), lout = dout.length();
    const r = Math.min(0.45, lin * 0.45, lout * 0.45);
    if (r < 0.05) {
      push(p);
      continue;
    }
    const p0 = p.clone().addScaledVector(din.normalize(), -r);
    const p1 = p.clone().addScaledVector(dout.normalize(), r);
    push(p0);
    const steps = 6;
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      const q = new THREE.Vector3()
        .addScaledVector(p0, (1 - t) * (1 - t))
        .addScaledVector(p, 2 * (1 - t) * t)
        .addScaledVector(p1, t * t);
      out.push(q);
    }
  }
  push(pts[pts.length - 1]);
  if (g) {
    for (const q of out) {
      const c = g.cellAt(q.x, q.z);
      if (c >= 0 && Number.isFinite(g.h[c]) && Math.abs(g.h[c] - q.y) < 0.4) q.y = g.h[c];
    }
  }
  return out;
}

/**
 * Fallback route from the plan alone: BFS over rooms on one level, connected by walkable openings, open-plan edges
 * and shared edges between outdoor areas. Waypoints are door centres (a short step either side of each door so the
 * glide crosses the wall square-on).
 */
function roomGraphPath(plan: BuildingPlan, level: Level, a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] | null {
  const y = level.elevation_ft * FT;
  const rooms = plan.rooms.filter((r) => r.level === level.id);
  const at = (p: THREE.Vector3) => {
    const x = p.x / FT, yy = -p.z / FT;
    const hits = rooms.filter((r) => x >= r.rect.x - 0.3 && x <= r.rect.x + r.rect.w + 0.3 && yy >= r.rect.y - 0.3 && yy <= r.rect.y + r.rect.d + 0.3);
    hits.sort((p1, p2) => p1.rect.w * p1.rect.d - p2.rect.w * p2.rect.d);
    return hits[0]?.id ?? "exterior";
  };
  const start = at(a), goal = at(b);
  if (!rooms.length || start === goal) return [a.clone(), b.clone()];
  type Edge = { to: string; via: THREE.Vector3[] };
  const adj = new Map<string, Edge[]>();
  const link = (p: string, q: string, via: THREE.Vector3[]) => {
    (adj.get(p) ?? adj.set(p, []).get(p)!).push({ to: q, via });
    (adj.get(q) ?? adj.set(q, []).get(q)!).push({ to: p, via: [...via].reverse() });
  };
  const isOutdoor = (id: string) => id === "exterior" || OUTDOOR.has(rooms.find((r) => r.id === id)?.type ?? "");
  const centreOf = (id: string) => {
    const r = rooms.find((rr) => rr.id === id);
    return r ? new THREE.Vector3((r.rect.x + r.rect.w / 2) * FT, y, zOf(r.rect.y + r.rect.d / 2)) : null;
  };
  for (const o of plan.openings ?? []) {
    if (o.level !== level.id || !WALKABLE_OPENINGS.has(o.type)) continue;
    const [p, q] = o.between;
    const pr = rooms.find((r) => r.id === p), qr = rooms.find((r) => r.id === q);
    if (!pr && p !== "exterior") continue;
    if (!qr && q !== "exterior") continue;
    // doors open across the wall: step 0.5 m either side, toward each room's middle
    const door = new THREE.Vector3(o.at[0] * FT, y, zOf(o.at[1]));
    const toward = (id: string) => {
      const c = centreOf(id);
      if (!c) return door.clone();
      const d = c.sub(door);
      // keep only the component across the wall
      const room = rooms.find((r) => r.id === id)!;
      const onX = Math.abs(o.at[1] - room.rect.y) < 0.6 || Math.abs(o.at[1] - (room.rect.y + room.rect.d)) < 0.6;
      if (onX) d.x = 0;
      else d.z = 0;
      return door.clone().addScaledVector(d.normalize(), 0.5);
    };
    link(p, q, [p === "exterior" ? door.clone() : toward(p), door, q === "exterior" ? door.clone() : toward(q)]);
  }
  for (const r of rooms)
    for (const id of r.open_to ?? []) {
      const o = rooms.find((x) => x.id === id);
      if (!o) continue;
      const mid = sharedEdgeMid(r, o);
      if (mid) link(r.id, o.id, [new THREE.Vector3(mid[0] * FT, y, zOf(mid[1]))]);
    }
  for (let i = 0; i < rooms.length; i++)
    for (let j = i + 1; j < rooms.length; j++) {
      if (!isOutdoor(rooms[i].id) || !isOutdoor(rooms[j].id)) continue;
      const mid = sharedEdgeMid(rooms[i], rooms[j]);
      if (mid) link(rooms[i].id, rooms[j].id, [new THREE.Vector3(mid[0] * FT, y, zOf(mid[1]))]);
    }
  // outdoor areas are all "exterior"
  for (const r of rooms) if (isOutdoor(r.id) && level.index === Math.min(...plan.levels.map((l) => l.index))) link(r.id, "exterior", [centreOf(r.id)!]);
  const prev = new Map<string, { from: string; via: THREE.Vector3[] }>();
  const q = [start];
  const seen = new Set([start]);
  while (q.length) {
    const cur = q.shift()!;
    if (cur === goal) break;
    for (const e of adj.get(cur) ?? []) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, { from: cur, via: e.via });
      q.push(e.to);
    }
  }
  if (!prev.has(goal)) return null;
  const via: THREE.Vector3[] = [];
  for (let c = goal; c !== start; ) {
    const p = prev.get(c)!;
    via.unshift(...p.via);
    c = p.from;
  }
  return [a.clone(), ...via, b.clone()];
}

function sharedEdgeMid(a: Room, b: Room): [number, number] | null {
  const A = a.rect, B = b.rect;
  const eps = 0.3;
  // vertical shared edge
  for (const [xa, xb] of [[A.x + A.w, B.x], [A.x, B.x + B.w]]) {
    if (Math.abs(xa - xb) < eps) {
      const y0 = Math.max(A.y, B.y), y1 = Math.min(A.y + A.d, B.y + B.d);
      if (y1 - y0 >= 2.5) return [xa, (y0 + y1) / 2];
    }
  }
  for (const [ya, yb] of [[A.y + A.d, B.y], [A.y, B.y + B.d]]) {
    if (Math.abs(ya - yb) < eps) {
      const x0 = Math.max(A.x, B.x), x1 = Math.min(A.x + A.w, B.x + B.w);
      if (x1 - x0 >= 2.5) return [(x0 + x1) / 2, ya];
    }
  }
  return null;
}

/**
 * Glide time for a route: DESIGN `clamp(700, d×120, 2400)` ms on one floor. Routes that take a stair get up to
 * 4.2 s, with the stair stretch weighted so the climb reads as a climb.
 */
export function glideSeconds(r: Pick<RoutePlan, "timeLength" | "stairs">) {
  return clamp(r.timeLength * 120, 700, r.stairs ? 4200 : 2400) / 1000;
}

