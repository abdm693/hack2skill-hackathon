/**
 * StructureModel: derives walls, junctions, openings, stair layouts, slabs, parapets and facade surfaces
 * from the PlanModel. Pure geometry in plan feet; no THREE objects here.
 */
import { CellGrid, expandRect, type R } from "../core/grid";
import { clamp, warn } from "../core/util";
import { DOOR_TYPES, type LevelM, type OpeningM, type PlanModel, type RoomM, type Side, type StairM } from "../plan/model";

export const EXT_T = 0.75;
export const INT_T = 0.375;
export const FINISH = 0.04;
export const PLINTH_PROUD = 0.08;
const EPS = 1e-3;
const near = (a: number, b: number, e = EPS) => Math.abs(a - b) <= e;

export type Cap = { kind: "none" } | { kind: "full"; h0?: number } | { kind: "strips"; strips: [number, number][] };

export interface WallRun {
  id: string;
  level: LevelM;
  axis: "x" | "y";
  c: number;
  a: number;
  b: number;
  t: number;
  kind: "exterior" | "interior" | "parapet" | "boundary";
  neg: RoomM | null;
  pos: RoomM | null;
  /** side that is outside: -1 neg, +1 pos, 0 interior */
  out: -1 | 0 | 1;
  ea: number;
  eb: number;
  capA: Cap;
  capB: Cap;
  /** thickness of perpendicular walls meeting each end (0 = none) */
  perpA?: number;
  perpB?: number;
  h0: number;
  h1: number;
  openings: PlacedOpening[];
  topExposed: boolean;
}

export interface PlacedOpening {
  op: OpeningM;
  run: WallRun;
  u0: number;
  u1: number;
  /** absolute heights (ft) of the hole */
  bottom: number;
  top: number;
  /** room floor height the opening relates to */
  floor: number;
  swingSide: -1 | 1;
  hingeAtA: boolean;
  /** frame plane offset from the wall centerline (ft, signed in the run's across axis) */
  frameOff: number;
  isDoor: boolean;
}

export interface EdgeFeature {
  level: LevelM;
  kind: "porch" | "deck";
  axis: "x" | "y";
  c: number;
  a: number;
  b: number;
  room: RoomM;
  out: -1 | 1;
}

export interface Flight {
  axis: "x" | "y";
  sign: 1 | -1;
  /** across extent */
  c0: number;
  c1: number;
  /** along coordinate of the first riser */
  s0: number;
  n: number;
  riser: number;
  tread: number;
  h0: number;
}

export interface StairLayout {
  stair: StairM;
  flights: Flight[];
  landings: { rect: R; h: number }[];
  holes: R[];
  /** across ranges per flight side that are "open" decided later by the builder */
  rect: R;
  /** upper level id where the hole is cut */
  holeLevel: string;
  arrival: { x: number; y: number };
}

export interface SlabSpec {
  /** level whose floor this slab is (the level above the gap) */
  level: LevelM;
  grid: CellGrid<boolean>;
  top: number;
  bottom: number;
}

export interface FacadeSurf {
  side: Side;
  plane: number;
  u0: number;
  u1: number;
  h0: number;
  h1: number;
  level: string;
  kind: "wall" | "slab" | "parapet" | "plinth";
}

export class StructureModel {
  readonly plan: PlanModel;
  readonly runs: WallRun[] = [];
  readonly runsByLevel = new Map<string, WallRun[]>();
  readonly edges: EdgeFeature[] = [];
  readonly openings: PlacedOpening[] = [];
  readonly stairs: StairLayout[] = [];
  readonly slabs: SlabSpec[] = [];
  readonly parapets: WallRun[] = [];
  plinth!: CellGrid<number>;
  readonly surfaces: FacadeSurf[] = [];
  /** building footprint on the lowest level (rect list, expanded to wall faces) */
  footprint: R[] = [];

  constructor(plan: PlanModel) {
    this.plan = plan;
    for (const lv of plan.levels) {
      const runs = this.computeRuns(lv);
      this.runsByLevel.set(lv.id, runs);
      this.runs.push(...runs);
    }
    this.computeParapets();
    for (const lv of plan.levels) resolveJunctions(this.runsByLevel.get(lv.id) ?? []);
    this.placeOpenings();
    this.computeStairs();
    this.computeSlabs();
    this.computePlinth();
    this.computeSurfaces();
  }

  // ── walls ──────────────────────────────────────────────────────────────────────────────────────────
  private computeRuns(lv: LevelM): WallRun[] {
    const plan = this.plan;
    const g = plan.grid(lv.id);
    const isOut = (r: RoomM | null) => !r || r.cat === "outdoor";
    type K = { kind: "interior" | "exterior" | "porch" | "deck"; out: -1 | 0 | 1; room?: RoomM };
    const kinds = new Map<string, K>();
    const er = g.edgeRuns((neg, pos) => {
      if (neg === pos) return null;
      const en = neg?.cat === "enclosed", ep = pos?.cat === "enclosed";
      let k: K | null = null;
      let key = "";
      if (en && ep) {
        if (plan.isOpen(neg, pos)) return null;
        k = { kind: "interior", out: 0 };
        key = `int|${neg!.id}|${pos!.id}`;
      } else if (en || ep) {
        k = { kind: "exterior", out: en ? 1 : -1 };
        key = `ext|${(en ? neg : pos)!.id}|${k.out}`;
      } else if (!lv.isRoof) {
        if (neg?.cat === "porch" && isOut(pos)) k = { kind: "porch", out: 1, room: neg };
        else if (pos?.cat === "porch" && isOut(neg)) k = { kind: "porch", out: -1, room: pos };
        else if (neg?.cat === "deck" && (isOut(pos) || pos?.cat === "porch")) k = { kind: "deck", out: 1, room: neg };
        else if (pos?.cat === "deck" && (isOut(neg) || neg?.cat === "porch")) k = { kind: "deck", out: -1, room: pos };
        if (k) key = `${k.kind}|${k.room!.id}|${k.out}`;
      }
      if (!k) return null;
      kinds.set(key, k);
      return key;
    });
    const runs: WallRun[] = [];
    for (const e of er) {
      const k = kinds.get(e.key)!;
      if (e.b - e.a < 0.05) continue;
      if (k.kind === "porch" || k.kind === "deck") {
        this.edges.push({ level: lv, kind: k.kind, axis: e.axis, c: e.c, a: e.a, b: e.b, room: k.room!, out: k.out as -1 | 1 });
        continue;
      }
      const neg = e.neg, pos = e.pos;
      const floors = [neg, pos].filter((r): r is RoomM => !!r && r.cat !== "outdoor").map((r) => r.floorH);
      const floor = floors.length ? Math.max(...floors) : lv.elev;
      let h1 = lv.next - lv.slab;
      if (lv.isRoof) h1 = lv.elev + this.plan.mumtyHeight - lv.slab;
      runs.push({
        id: `wall_${lv.id}_${runs.length}`,
        level: lv,
        axis: e.axis,
        c: e.c,
        a: e.a,
        b: e.b,
        t: k.kind === "exterior" ? EXT_T : INT_T,
        kind: k.kind,
        neg,
        pos,
        out: k.out,
        ea: e.a,
        eb: e.b,
        capA: { kind: "none" },
        capB: { kind: "none" },
        h0: floor - FINISH,
        h1: Math.max(floor + 6, h1),
        openings: [],
        topExposed: false,
      });
    }
    return runs;
  }

  /** Parapets around exposed roofs (the main roof and any lower roof not covered by the storey above). */
  private computeParapets(): void {
    const plan = this.plan;
    for (const U of plan.levels) {
      if (U.i === 0) continue;
      const L = plan.levels[U.i - 1];
      const below = plan.roomsOn(L.id).filter((r) => r.cat === "enclosed" || r.cat === "porch");
      const upper = plan.roomsOn(U.id).filter((r) => r.cat !== "outdoor");
      if (!below.length) continue;
      type V = "x" | "r";
      const items: { rect: R; val: V }[] = [
        ...below.map((r) => ({ rect: r.rect, val: "x" as V })),
        ...upper.map((r) => ({ rect: r.rect, val: "r" as V })),
      ];
      const g = CellGrid.fromRects<V>(items, (a, b) => (a === "r" || b === "r" ? "r" : "x"));
      const height = U.isRoof ? plan.parapet : Math.min(plan.parapet, 3.0);
      if (height <= 0.2) continue;
      const er = g.edgeRuns((neg, pos) => {
        if (neg === "x" && pos === null) return "p+";
        if (pos === "x" && neg === null) return "p-";
        return null;
      });
      for (const e of er) {
        const run: WallRun = {
          id: `parapet_${U.id}_${this.parapets.length}`,
          level: U,
          axis: e.axis,
          c: e.c,
          a: e.a,
          b: e.b,
          t: EXT_T,
          kind: "parapet",
          neg: null,
          pos: null,
          out: e.key === "p+" ? 1 : -1,
          ea: e.a,
          eb: e.b,
          capA: { kind: "none" },
          capB: { kind: "none" },
          h0: U.elev - FINISH,
          h1: U.elev + height,
          openings: [],
          topExposed: true,
        };
        this.parapets.push(run);
        const arr = this.runsByLevel.get(U.id) ?? [];
        arr.push(run);
        this.runsByLevel.set(U.id, arr);
      }
    }
  }

  // ── openings ───────────────────────────────────────────────────────────────────────────────────────
  private placeOpenings(): void {
    const plan = this.plan;
    const list = [...plan.openings];
    // synthetic mumty door
    const mumty = plan.rooms.find((r) => r.synthetic && r.id === "roof_mumty");
    if (mumty) {
      const side = plan.plan.roof?.mumty?.door_side ?? "front";
      const rr = mumty.rect;
      const stair = plan.stairs.find((s) => s.to === mumty.lv);
      let at: [number, number];
      const along = (lo: number, hi: number, pref: number) => clamp(pref, lo + 2.2, hi - 2.2);
      const sp = stair ? stairStartPoint(stair) : { x: rr.x + rr.w / 2, y: rr.y + rr.d / 2 };
      if (side === "front") at = [along(rr.x, rr.x + rr.w, sp.x), rr.y];
      else if (side === "back") at = [along(rr.x, rr.x + rr.w, sp.x), rr.y + rr.d];
      else if (side === "left") at = [rr.x, along(rr.y, rr.y + rr.d, sp.y)];
      else at = [rr.x + rr.w, along(rr.y, rr.y + rr.d, sp.y)];
      if (!list.some((o) => o.level === mumty.level)) {
        list.push({ id: "roof_mumty_door", level: mumty.level, type: "door", at, width: 3, height: 7, sill: 0, between: [mumty.id, "exterior"], swing: "out", synthetic: true });
      }
    }
    for (const op of list) {
      const runs = (this.runsByLevel.get(op.level) ?? []).filter((r) => r.kind === "exterior" || r.kind === "interior");
      let best: { run: WallRun; score: number; along: number } | null = null;
      for (const run of runs) {
        const along = run.axis === "x" ? op.at[0] : op.at[1];
        const across = run.axis === "x" ? op.at[1] : op.at[0];
        const dA = Math.abs(across - run.c);
        const dL = along < run.a ? run.a - along : along > run.b ? along - run.b : 0;
        const dist = Math.hypot(dA, dL);
        const ids = [run.neg?.id, run.pos?.id];
        const want = op.between.filter((b) => b && b !== "exterior");
        let match = 0;
        for (const w of want) if (ids.includes(w)) match++;
        if (op.between.includes("exterior") && run.kind === "exterior") match++;
        const miss = Math.max(0, 2 - match);
        const score = dist + miss * 0.8;
        const lim = miss === 0 ? 3 : miss === 1 ? 2 : 1.5;
        if (dist <= lim && (!best || score < best.score)) best = { run, score, along };
      }
      if (!best) {
        // openings on porch/deck edges are simply open; anything else is reported
        const onEdge = this.edges.some((e) => e.level.id === op.level && distToEdge(e, op.at) < 1.5);
        if (!onEdge) warn(`opening ${op.id}: no wall within 1.5 ft of [${op.at}] on ${op.level}, skipped`);
        continue;
      }
      const run = best.run;
      const isDoor = DOOR_TYPES.includes(op.type);
      const mA = run.perpA ? run.perpA / 2 + 0.12 : 0.06;
      const mB = run.perpB ? run.perpB / 2 + 0.12 : 0.06;
      const avail = run.b - run.a - mA - mB;
      let w = op.width;
      if (w > avail) {
        if (avail < 1.2) {
          warn(`opening ${op.id}: wall too short, skipped`);
          continue;
        }
        warn(`opening ${op.id}: narrowed from ${w} to ${avail.toFixed(2)} ft to fit its wall`);
        w = avail;
      }
      let u0 = clamp(best.along - w / 2, run.a + mA, run.b - mB - w);
      // avoid overlapping openings already on this run
      const clash = (a: number) => run.openings.some((o) => a < o.u1 + 0.3 && a + w > o.u0 - 0.3);
      if (clash(u0)) {
        let found = false;
        for (let step = 0.25; step < run.b - run.a; step += 0.25) {
          for (const s of [u0 + step, u0 - step]) {
            if (s >= run.a + mA && s + w <= run.b - mB && !clash(s)) {
              u0 = s;
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (!found) {
          warn(`opening ${op.id}: overlaps another opening, skipped`);
          continue;
        }
      }
      const rooms = [run.neg, run.pos].filter((r): r is RoomM => !!r && r.cat !== "outdoor");
      const r0 = plan.room(op.between[0]);
      const floor = r0 && rooms.includes(r0) ? r0.floorH : rooms.length ? Math.max(...rooms.map((r) => r.floorH)) : run.h0 + FINISH;
      const wallFloor = run.h0 + FINISH;
      let bottom = isDoor ? run.h0 : Math.max(wallFloor + 0.2, floor + op.sill);
      let top = (isDoor ? wallFloor : floor + op.sill) + op.height;
      top = Math.min(top, run.h1 - 0.35);
      if (top - bottom < 0.8) {
        bottom = Math.max(run.h0, top - 0.8);
        if (top - bottom < 0.8) {
          warn(`opening ${op.id}: no room for it in the wall height, skipped`);
          continue;
        }
      }
      // swing side
      const target = op.swing === "out" ? op.between[1] : op.between[0];
      let swingSide: -1 | 1;
      if (run.neg?.id === target) swingSide = -1;
      else if (run.pos?.id === target) swingSide = 1;
      else if (run.out !== 0) swingSide = (-run.out) as -1 | 1;
      else swingSide = run.neg && run.neg.cat === "enclosed" ? -1 : 1;
      if (op.swing === "out" && run.out !== 0 && target === "exterior") swingSide = run.out as -1 | 1;
      const hingeAtA = u0 - run.a <= run.b - (u0 + w);
      const frameOff = run.out !== 0 && !isDoor ? run.out * run.t * 0.18 : run.out !== 0 && op.type === "sliding_door" ? run.out * run.t * 0.12 : 0;
      const po: PlacedOpening = { op, run, u0, u1: u0 + w, bottom, top, floor, swingSide, hingeAtA, frameOff, isDoor };
      run.openings.push(po);
      run.openings.sort((p, q) => p.u0 - q.u0);
      this.openings.push(po);
    }
  }

  // ── stairs ─────────────────────────────────────────────────────────────────────────────────────────
  private computeStairs(): void {
    for (const s of this.plan.stairs) {
      const lay = layoutStair(this.plan, s, this);
      if (lay) this.stairs.push(lay);
    }
  }

  // ── slabs ──────────────────────────────────────────────────────────────────────────────────────────
  private computeSlabs(): void {
    const plan = this.plan;
    for (const U of plan.levels) {
      if (U.i === 0) continue;
      const L = plan.levels[U.i - 1];
      const rects: R[] = [];
      for (const r of plan.roomsOn(L.id)) if (r.cat === "enclosed" || r.cat === "porch") rects.push(expandRect(r.rect, EXT_T / 2));
      for (const r of plan.roomsOn(U.id)) if (r.cat !== "outdoor") rects.push(expandRect(r.rect, EXT_T / 2));
      if (!rects.length) continue;
      const holes = this.stairs.filter((s) => s.holeLevel === U.id).flatMap((s) => s.holes);
      const g = CellGrid.fromRects<boolean>(
        [...rects.map((rect) => ({ rect, val: true })), ...holes.map((rect) => ({ rect, val: false }))],
        (a, b) => a && b,
      );
      for (let k = 0; k < g.cells.length; k++) if (g.cells[k] === false) g.cells[k] = null;
      this.slabs.push({ level: U, grid: g, top: U.elev - FINISH, bottom: U.elev - L.slab });
    }
    // mumty roof slab
    const m = plan.rooms.find((r) => r.lv.isRoof && r.cat === "enclosed");
    if (m) {
      const top = m.lv.elev + plan.mumtyHeight;
      const g = CellGrid.fromRects<boolean>(
        plan.rooms.filter((r) => r.lv.isRoof && r.cat === "enclosed").map((r) => ({ rect: expandRect(r.rect, EXT_T / 2 + 0.9), val: true })),
      );
      this.slabs.push({ level: m.lv, grid: g, top, bottom: top - m.lv.slab - 0.1 });
    }
  }

  private computePlinth(): void {
    const plan = this.plan;
    const L0 = plan.levels[0];
    const items = plan
      .roomsOn(L0.id)
      .filter((r) => r.cat !== "outdoor")
      .map((r) => ({ rect: expandRect(r.rect, EXT_T / 2 + PLINTH_PROUD), val: r.floorH - FINISH }));
    this.plinth = CellGrid.fromRects<number>(items, (a, b) => Math.max(a, b));
    this.footprint = plan
      .roomsOn(L0.id)
      .filter((r) => r.cat === "enclosed")
      .map((r) => expandRect(r.rect, EXT_T / 2));
  }

  private computeSurfaces(): void {
    const sideOf = (axis: "x" | "y", out: number): Side => (axis === "x" ? (out < 0 ? "front" : "back") : out < 0 ? "left" : "right");
    for (const r of [...this.runs, ...this.parapets]) {
      if (r.out === 0) continue;
      const kind = r.kind === "parapet" ? "parapet" : "wall";
      this.surfaces.push({ side: sideOf(r.axis, r.out), plane: r.c + (r.out * r.t) / 2, u0: r.ea, u1: r.eb, h0: r.h0, h1: r.h1 + (r.topExposed ? 0.12 : 0), level: r.level.id, kind });
    }
    for (const s of this.slabs) {
      const er = s.grid.edgeRuns((n, p) => (n && !p ? "+" : p && !n ? "-" : null));
      for (const e of er) {
        const out = e.key === "+" ? 1 : -1;
        this.surfaces.push({ side: sideOf(e.axis, out), plane: e.c, u0: e.a, u1: e.b, h0: s.bottom, h1: s.top + FINISH, level: s.level.id, kind: "slab" });
      }
    }
    const er = this.plinth.edgeRuns((n, p) => (n != null && p == null ? "+" : p != null && n == null ? "-" : null));
    for (const e of er) {
      const out = e.key === "+" ? 1 : -1;
      const h = (out > 0 ? e.neg : e.pos) ?? this.plan.ground.elev;
      this.surfaces.push({ side: sideOf(e.axis, out), plane: e.c, u0: e.a, u1: e.b, h0: this.plan.grade, h1: h as number, level: this.plan.levels[0].id, kind: "plinth" });
    }
  }

  // ── queries ────────────────────────────────────────────────────────────────────────────────────────
  /** Overall outer face of the building on one side. */
  face(side: Side, level?: string): { side: Side; from_ft: number; to_ft: number; plane_ft: number; bottom_h_ft: number; top_h_ft: number } {
    let surfs = this.surfaces.filter((s) => s.side === side && (!level || s.level === level));
    if (!surfs.length) surfs = this.surfaces.filter((s) => s.side === side);
    const plan = this.plan;
    if (!surfs.length) {
      const horiz = side === "front" || side === "back";
      return {
        side,
        from_ft: 0,
        to_ft: horiz ? plan.plotW : plan.plotD,
        plane_ft: side === "front" ? 0 : side === "back" ? plan.plotD : side === "left" ? 0 : plan.plotW,
        bottom_h_ft: plan.grade,
        top_h_ft: plan.roof.elev + plan.parapet,
      };
    }
    const outer = side === "front" || side === "left" ? Math.min(...surfs.map((s) => s.plane)) : Math.max(...surfs.map((s) => s.plane));
    const wallish = surfs.filter((s) => s.kind !== "plinth");
    return {
      side,
      from_ft: Math.min(...surfs.map((s) => s.u0)),
      to_ft: Math.max(...surfs.map((s) => s.u1)),
      plane_ft: outer,
      bottom_h_ft: Math.min(...surfs.map((s) => s.h0)),
      top_h_ft: Math.max(...(wallish.length ? wallish : surfs).map((s) => s.h1)),
    };
  }

  /** Outermost building surface plane on `side` overlapping a (u, h) region; null if nothing there. */
  outerPlane(side: Side, u0: number, u1: number, h0: number, h1: number, extra?: { side: string; plane: number; u0: number; u1: number; h0: number; h1: number }[]): number | null {
    const all = extra ? [...this.surfaces, ...extra] : this.surfaces;
    let best: number | null = null;
    for (const s of all) {
      if (s.side !== side) continue;
      if (s.u1 <= u0 + 1e-3 || s.u0 >= u1 - 1e-3 || s.h1 <= h0 + 1e-3 || s.h0 >= h1 - 1e-3) continue;
      if (best === null) best = s.plane;
      else best = side === "front" || side === "left" ? Math.min(best, s.plane) : Math.max(best, s.plane);
    }
    return best;
  }

  /** Wall runs bounding a room on one side (the room's edge), with the wall's inner face offset. */
  roomWalls(room: RoomM, side: Side): { run: WallRun; a: number; b: number; inner: number }[] {
    const r = room.rect;
    const axis = side === "front" || side === "back" ? "x" : "y";
    const c = side === "front" ? r.y : side === "back" ? r.y + r.d : side === "left" ? r.x : r.x + r.w;
    const lo = axis === "x" ? r.x : r.y, hi = axis === "x" ? r.x + r.w : r.y + r.d;
    const into = side === "front" || side === "left" ? 1 : -1;
    const out: { run: WallRun; a: number; b: number; inner: number }[] = [];
    for (const run of this.runsByLevel.get(room.level) ?? []) {
      if (run.axis !== axis || !near(run.c, c, 0.05) || run.kind === "parapet") continue;
      const a = Math.max(lo, run.a), b = Math.min(hi, run.b);
      if (b - a < 0.05) continue;
      out.push({ run, a, b, inner: c + (into * run.t) / 2 });
    }
    return out.sort((p, q) => p.a - q.a);
  }

  openingsOfRoom(room: RoomM): PlacedOpening[] {
    return this.openings.filter((o) => o.run.neg === room || o.run.pos === room);
  }
}

function distToEdge(e: EdgeFeature, at: [number, number]): number {
  const along = e.axis === "x" ? at[0] : at[1];
  const across = e.axis === "x" ? at[1] : at[0];
  const dL = along < e.a ? e.a - along : along > e.b ? along - e.b : 0;
  return Math.hypot(across - e.c, dL);
}

// ── junctions ──────────────────────────────────────────────────────────────────────────────────────────
export function resolveJunctions(runs: WallRun[]): void {
  for (const r of runs) {
    for (const end of ["a", "b"] as const) {
      const u = end === "a" ? r.a : r.b;
      const coll = runs.find((o) => o !== r && o.axis === r.axis && near(o.c, r.c) && (end === "a" ? near(o.b, u) : near(o.a, u)));
      const perp = runs.filter((o) => o.axis !== r.axis && near(o.c, u) && o.a - EPS <= r.c && o.b + EPS >= r.c);
      const pass = perp.some((o) => o.a < r.c - EPS && o.b > r.c + EPS);
      const lowSide = perp.some((o) => near(o.b, r.c));
      const highSide = perp.some((o) => near(o.a, r.c));
      const perpThrough = pass || (lowSide && highSide);
      let adj = 0;
      let cap: Cap = { kind: "none" };
      const perpT = perp.length ? Math.max(...perp.map((o) => o.t)) : 0;
      if (end === "a") r.perpA = perpT;
      else r.perpB = perpT;
      if (!perp.length) {
        if (!coll) cap = { kind: "full" };
        else if (coll.t < r.t - EPS) cap = { kind: "strips", strips: [[-r.t / 2, -coll.t / 2], [coll.t / 2, r.t / 2]] };
        else if (coll.h1 < r.h1 - 0.05) cap = { kind: "full", h0: Math.max(r.h0, coll.h1) };
      } else {
        const tMin = Math.min(...perp.map((o) => o.t));
        const tMax = Math.max(...perp.map((o) => o.t));
        const hPerp = Math.max(...perp.map((o) => o.h1));
        if (perpThrough && coll) {
          if (r.axis === "y") adj = -tMin / 2;
          if (coll.t < r.t - EPS) cap = { kind: "strips", strips: [[-r.t / 2, -coll.t / 2], [coll.t / 2, r.t / 2]] };
        } else if (perpThrough && !coll) {
          // T-stem
          if (r.h1 > hPerp + 0.05) {
            adj = tMax / 2;
            cap = { kind: "full", h0: hPerp };
          } else adj = -tMin / 2;
        } else if (!perpThrough && coll) {
          if (coll.t < r.t - EPS) cap = { kind: "strips", strips: [[-r.t / 2, -coll.t / 2], [coll.t / 2, r.t / 2]] };
          else if (coll.h1 < r.h1 - 0.05) cap = { kind: "full", h0: Math.max(r.h0, coll.h1) };
        } else {
          // L-corner: the taller run (or the x-run on ties) owns the corner square
          const owner = r.h1 > hPerp + 0.05 || (Math.abs(r.h1 - hPerp) <= 0.05 && r.axis === "x");
          if (owner) {
            adj = tMax / 2;
            cap = { kind: "full" };
          } else {
            adj = -tMin / 2;
            if (r.h1 > hPerp + 0.05) cap = { kind: "full", h0: hPerp };
          }
        }
      }
      if (end === "a") {
        r.ea = r.a - adj;
        r.capA = cap;
      } else {
        r.eb = r.b + adj;
        r.capB = cap;
      }
    }
  }
}

// ── stair layout ───────────────────────────────────────────────────────────────────────────────────────
function stairStartPoint(s: StairM): { x: number; y: number } {
  const r = s.rect;
  // arrival of a dogleg is at the start edge
  switch (s.start) {
    case "+y": return { x: r.x + r.w / 2, y: r.y + 1 };
    case "-y": return { x: r.x + r.w / 2, y: r.y + r.d - 1 };
    case "+x": return { x: r.x + 1, y: r.y + r.d / 2 };
    default: return { x: r.x + r.w - 1, y: r.y + r.d / 2 };
  }
}

function layoutStair(plan: PlanModel, s: StairM, model: StructureModel): StairLayout | null {
  const R0 = s.rect;
  const axis: "x" | "y" = s.start === "+x" || s.start === "-x" ? "x" : "y";
  const sign: 1 | -1 = s.start === "+x" || s.start === "+y" ? 1 : -1;
  const A0 = axis === "x" ? R0.x : R0.y, A1 = axis === "x" ? R0.x + R0.w : R0.y + R0.d;
  const C0 = axis === "x" ? R0.y : R0.x, C1 = axis === "x" ? R0.y + R0.d : R0.x + R0.w;
  const startA = sign > 0 ? A0 : A1;
  const farA = sign > 0 ? A1 : A0;
  const length = A1 - A0, breadth = C1 - C0;
  const fromRoom = plan.roomAt(s.from.id, R0.x + R0.w / 2, R0.y + R0.d / 2);
  const h0 = fromRoom ? fromRoom.floorH : s.from.elev;
  const rise = s.to.elev - h0;
  if (rise < 3) return null;
  const N = Math.max(3, Math.round((rise * 12) / s.riser_in));
  const r = rise / N;
  let T = s.tread_in / 12;
  const flights: Flight[] = [];
  const landings: { rect: R; h: number }[] = [];
  const holes: R[] = [];
  const mk = (a0: number, a1: number, c0: number, c1: number): R =>
    axis === "x" ? { x: Math.min(a0, a1), y: Math.min(c0, c1), w: Math.abs(a1 - a0), d: Math.abs(c1 - c0) } : { x: Math.min(c0, c1), y: Math.min(a0, a1), w: Math.abs(c1 - c0), d: Math.abs(a1 - a0) };

  // which across side should the user ARRIVE on? the side nearer the upper level's access (open_to / doors)
  const upRoom = plan.roomAt(s.to.id, R0.x + R0.w / 2, R0.y + R0.d / 2);
  let accessC = (C0 + C1) / 2 + (axis === "y" ? (plan.plotW / 2 > (C0 + C1) / 2 ? 0.1 : -0.1) : 0.1);
  if (upRoom) {
    const pts: number[] = [];
    for (const o of plan.roomsOn(s.to.id)) {
      if (!plan.isOpen(upRoom, o)) continue;
      pts.push(axis === "y" ? o.rect.x + o.rect.w / 2 : o.rect.y + o.rect.d / 2);
    }
    for (const op of model.openings) {
      if (op.op.level !== s.to.id || (op.run.neg !== upRoom && op.run.pos !== upRoom)) continue;
      pts.push(axis === "y" ? op.op.at[0] : op.op.at[1]);
    }
    if (pts.length) accessC = pts.reduce((a, b) => a + b, 0) / pts.length;
  }
  const arriveHigh = accessC > (C0 + C1) / 2;

  if (s.kind === "dogleg" && breadth >= 2 * 2.4 + 0.1) {
    const wf = Math.min(s.width, (breadth - 0.15) / 2);
    const n1 = Math.ceil(N / 2), n2 = N - n1;
    let L = length - (n1 - 1) * T;
    if (L < wf * 0.8) {
      T = Math.max(0.6, (length - wf * 0.9) / Math.max(1, n1 - 1));
      L = length - (n1 - 1) * T;
      if (T < 0.75) warn(`stair ${s.id}: treads compressed to ${(T * 12).toFixed(1)} in to fit the rect`);
    }
    // flight 1 on the side opposite the arrival
    const f1c: [number, number] = arriveHigh ? [C0, C0 + wf] : [C1 - wf, C1];
    const f2c: [number, number] = arriveHigh ? [C1 - wf, C1] : [C0, C0 + wf];
    flights.push({ axis, sign, c0: f1c[0], c1: f1c[1], s0: startA, n: n1, riser: r, tread: T, h0 });
    const landNear = farA - sign * L;
    landings.push({ rect: mk(landNear, farA, C0, C1), h: h0 + n1 * r });
    flights.push({ axis, sign: (-sign) as 1 | -1, c0: f2c[0], c1: f2c[1], s0: landNear, n: n2, riser: r, tread: T, h0: h0 + n1 * r });
    const end2 = landNear - sign * (n2 - 1) * T; // along position of flight 2's top riser
    // headroom on flight 1 under the upper slab
    const slabBottom = s.to.elev - s.from.slab;
    const kMax = Math.floor((slabBottom - 6.75 - h0) / r) - 1;
    const safe1 = startA + sign * Math.max(0, kMax) * T;
    const cut1 = sign > 0 ? Math.min(end2, safe1) : Math.max(end2, safe1);
    holes.push(mk(end2, farA, f2c[0], f2c[1]));
    holes.push(mk(cut1, farA, f1c[0], f1c[1]));
    if (f2c[0] > f1c[1] + 1e-3) holes.push(mk(cut1, farA, f1c[1], f2c[0]));
    if (f1c[0] > f2c[1] + 1e-3) holes.push(mk(cut1, farA, f2c[1], f1c[0]));
    const ac = (f2c[0] + f2c[1]) / 2;
    const aa = end2 - sign * 1.2;
    return { stair: s, flights, landings, holes, rect: R0, holeLevel: s.to.id, arrival: axis === "x" ? { x: aa, y: ac } : { x: ac, y: aa } };
  }

  if (s.kind === "l_shape" && breadth >= 4.5 && length >= 4.5) {
    const wf = Math.min(s.width, breadth * 0.5, length * 0.5);
    const n1 = Math.ceil(N / 2), n2 = N - n1;
    let T1 = T, T2 = T;
    if ((n1 - 1) * T1 + wf > length) T1 = Math.max(0.6, (length - wf) / Math.max(1, n1 - 1));
    if ((n2 - 1) * T2 + wf > breadth) T2 = Math.max(0.6, (breadth - wf) / Math.max(1, n2 - 1));
    const f1c: [number, number] = arriveHigh ? [C0, C0 + wf] : [C1 - wf, C1];
    flights.push({ axis, sign, c0: f1c[0], c1: f1c[1], s0: startA, n: n1, riser: r, tread: T1, h0 });
    const landA0 = startA + sign * (n1 - 1) * T1;
    const landA1 = landA0 + sign * wf;
    landings.push({ rect: mk(landA0, landA1, f1c[0], f1c[1]), h: h0 + n1 * r });
    const axis2: "x" | "y" = axis === "x" ? "y" : "x";
    const sign2: 1 | -1 = arriveHigh ? 1 : -1;
    const s02 = arriveHigh ? f1c[1] : f1c[0];
    flights.push({ axis: axis2, sign: sign2, c0: Math.min(landA0, landA1), c1: Math.max(landA0, landA1), s0: s02, n: n2, riser: r, tread: T2, h0: h0 + n1 * r });
    holes.push(R0);
    const end = s02 + sign2 * (n2 - 1) * T2 + sign2 * 1.2;
    const ac = (landA0 + landA1) / 2;
    return { stair: s, flights, landings, holes, rect: R0, holeLevel: s.to.id, arrival: axis === "x" ? { x: ac, y: end } : { x: end, y: ac } };
  }

  // straight (also the fallback)
  const wf = Math.min(s.width, breadth);
  if ((N - 1) * T > length) {
    T = Math.max(0.6, length / (N - 1));
    if (T < 0.75) warn(`stair ${s.id}: straight flight compressed to ${(T * 12).toFixed(1)} in treads`);
  }
  const cMid = (C0 + C1) / 2;
  flights.push({ axis, sign, c0: cMid - wf / 2, c1: cMid + wf / 2, s0: startA, n: N, riser: r, tread: T, h0 });
  const end = startA + sign * (N - 1) * T;
  holes.push(mk(startA, end, cMid - wf / 2 - 0.05, cMid + wf / 2 + 0.05));
  const aa = end + sign * 1.2;
  return { stair: s, flights, landings, holes, rect: R0, holeLevel: s.to.id, arrival: axis === "x" ? { x: aa, y: cMid } : { x: cMid, y: aa } };
}
