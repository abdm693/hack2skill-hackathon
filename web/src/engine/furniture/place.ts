/** furnish(): place one furniture item (against a wall or at a room-local point), clamp, nudge, support, tag. */
import * as THREE from "three";
import type { FurnishOptions, FurnitureType, Side } from "@contracts/house-sdk";
import type { BuildCtx, PlacedItem } from "../core/ctx";
import { Kit } from "../core/shapes";
import { DEG, FT, clamp, colorHex, hashStr, luma, num, rng, warn } from "../core/util";
import type { RoomM } from "../plan/model";
import { findRoom, innerRect } from "../interior";
import { acOutdoor, chairsForTable, ITEMS, type ItemDef } from "./items";
import { makeMats, type ItemBuild } from "./parts";
import { keepOut, solidIntervals, type Zone } from "./zones";
import { ceilingSpot } from "../lights";
import { onWalkwayRect, parking } from "./parking";
import { subtract } from "../structure/cover";

const SIDES: Side[] = ["front", "back", "left", "right"];
const ROT: Record<Side, number> = { front: 0, back: 180, left: -90, right: 90 };

const ALIASES: Record<string, FurnitureType> = {
  bed: "bed_queen", king_bed: "bed_king", queen_bed: "bed_queen", single_bed: "bed_single", double_bed: "bed_queen",
  nightstand: "side_table", bedside_table: "side_table", end_table: "side_table", closet: "wardrobe", cupboard: "wardrobe",
  sofa: "sofa_3", couch: "sofa_3", loveseat: "sofa_2", sectional: "sofa_l", l_sofa: "sofa_l", chair: "dining_chair", lounge_chair: "armchair",
  pouf: "ottoman", center_table: "coffee_table", centre_table: "coffee_table", tv_stand: "tv_unit", media_unit: "tv_unit", television: "tv",
  carpet: "rug", lamp: "floor_lamp", light: "pendant", fan: "ceiling_fan", ac: "ac_split", air_conditioner: "ac_split", plant: "plant_floor",
  potted_plant: "plant_floor", art: "painting", picture: "painting", mirror: "mirror_wall", dining_table: "dining_table_6", table: "dining_table_4",
  buffet: "sideboard", kitchen: "kitchen_counter", counter: "kitchen_counter", island: "kitchen_island", refrigerator: "fridge", stove: "hob",
  cooker: "oven", range: "oven", sink: "sink_kitchen", toilet: "wc", commode: "wc", basin: "vanity", washbasin: "vanity", bath: "bathtub",
  tub: "bathtub", towel: "towel_rail", desk: "study_desk", office_chair: "desk_chair", shelf: "bookshelf", shelves: "bookshelf",
  car: "car_sedan", suv: "car_suv", bike: "motorbike", motorcycle: "motorbike", washer: "washing_machine", jhoola: "swing",
  dispenser: "water_dispenser", janamaz: "prayer_mat", chandeliers: "chandelier", curtain: "curtains", drapes: "curtains",
};

export function resolveItem(item: unknown): FurnitureType | null {
  const s = String(item ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((ITEMS as Record<string, unknown>)[s]) return s as FurnitureType;
  if (ALIASES[s]) return ALIASES[s];
  for (const [k, v] of Object.entries(ALIASES)) if (s.includes(k)) return v;
  return null;
}

/** Items that may overlap each other's footprints (sets). */
const COMPANIONS: [string, string][] = [
  ["dining_chair", "dining_table"], ["desk_chair", "study_desk"], ["ottoman", "dressing_table"], ["ottoman", "sofa"], ["coffee_table", "sofa_l"],
  ["hob", "kitchen_counter"], ["sink_kitchen", "kitchen_counter"], ["microwave", "kitchen_counter"], ["outdoor_chair", "outdoor_table"],
];
const companions = (a: string, b: string) => COMPANIONS.some(([p, q]) => (a.startsWith(p) && b.startsWith(q)) || (a.startsWith(q) && b.startsWith(p)));

interface Rect4 { x0: number; x1: number; y0: number; y1: number }
const overlaps = (a: Rect4, b: Rect4, tol = 0.05) => a.x0 < b.x1 - tol && b.x0 < a.x1 - tol && a.y0 < b.y1 - tol && b.y0 < a.y1 - tol;

const OPP: Record<Side, Side> = { front: "back", back: "front", left: "right", right: "left" };
const WET = new Set<string>(["bath", "powder", "laundry", "store"]);
const ADJ: Record<Side, Side[]> = { front: ["left", "right"], back: ["left", "right"], left: ["front", "back"], right: ["front", "back"] };
/** floor items that adapt to the window behind them (counters cut their wall cabinets, baths sit under ventilators) */
const TALL_EXEMPT = new Set<string>(["kitchen_counter", "vanity", "shower", "wc", "bathtub", "sink_kitchen", "washing_machine", "curtains"]);
/** may be narrowed up to 15 % to fit */
const SHRINK = new Set<string>(["wardrobe", "sideboard", "kitchen_counter", "bookshelf", "tv_unit", "dresser", "console_table", "bed_king", "bed_queen", "sofa_3", "sofa_l", "shower", "vanity", "study_desk", "dressing_table"]);
/** never left out: if nothing is free they may touch other furniture, but never a door, stair or walkway */
const ESSENTIAL = new Set<string>(["wc", "vanity", "shower", "bed_king", "bed_queen", "bed_single", "kitchen_counter", "fridge", "dining_table_4", "dining_table_6", "dining_table_8", "sofa_3", "sofa_l", "sofa_2", "wardrobe", "tv_unit", "washing_machine"]);

const alongOf = (side: Side, it: { x0: number; x1: number; y0: number; y1: number }): [number, number] => (side === "front" || side === "back" ? [it.x0, it.x1] : [it.y0, it.y1]);

/** The partner a wall item lines up with: a TV over its unit, a mirror over a dresser or vanity, a painting over a sofa, sideboard, console or bed. */
function pairPartner(ctx: BuildCtx, room: RoomM, type: string, side: Side, u: number, alongGiven: boolean): { side: Side; u: number } | null {
  const partners: Record<string, string[]> = {
    tv: ["tv_unit"],
    mirror_wall: ["dresser", "dressing_table", "vanity"],
    painting: ["sofa_3", "sofa_2", "sofa_l", "sideboard", "console_table", "bed_king", "bed_queen", "bed_single"],
  };
  const want = partners[type];
  if (!want) return null;
  const cands = ctx.items.filter((it) => it.room === room.id && want.includes(it.type) && it.against);
  if (!cands.length) return null;
  const scored = cands
    .map((it) => {
      const [a, b] = alongOf(it.against as Side, it);
      const c = (a + b) / 2;
      return { it, c, half: (b - a) / 2, dist: it.against === side ? Math.abs(c - u) : 1e6 };
    })
    .sort((p, q) => p.dist - q.dist);
  const best = scored[0];
  if (type === "tv") return { side: best.it.against as Side, u: best.c };
  if (best.it.against !== side) return null;
  if (alongGiven && best.dist > best.half + 2) return null;
  return { side, u: best.c };
}

/** B.4.1: a solid stretch of wall for a wall item: the requested wall, then the opposite one, then the adjacent ones. */
function placeOnWall(ctx: BuildCtx, room: RoomM, type: string, side: Side, u: number, w: number): { side: Side; u: number } | null {
  const high = (t: string) => t === "ac_split";
  const others = ctx.items.filter((it) => it.room === room.id && it.cls === "wall" && it.type !== "curtains" && high(it.type) === high(type));
  for (const s of [side, OPP[side], ...ADJ[side]]) {
    let ints = solidIntervals(ctx, room, s);
    ints = subtract(ints, others.filter((it) => it.against === s).map((it) => { const [a, b] = alongOf(s, it); return [a - 0.25, b + 0.25] as [number, number]; }));
    const fits = ints.filter(([a, b]) => b - a >= w + 0.2);
    if (!fits.length) continue;
    if (s === side) {
      let best: { u: number; dd: number } | null = null;
      for (const [a, b] of fits) {
        const c = clamp(u, a + w / 2 + 0.1, b - w / 2 - 0.1);
        if (!best || Math.abs(c - u) < best.dd) best = { u: c, dd: Math.abs(c - u) };
      }
      return { side: s, u: best!.u };
    }
    const [a, b] = fits.sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0];
    return { side: s, u: (a + b) / 2 };
  }
  return null;
}

/** A TV placed before its unit: at the end of the section, slide it over the unit and set it 0.9 ft above it. */
function deferTvPairing(ctx: BuildCtx, room: RoomM, group: THREE.Object3D, getItem: () => PlacedItem | undefined): void {
  ctx.endOfSection.push(() => {
    const it = getItem();
    if (!it || !it.against) return;
    const side = it.against as Side;
    const unit = ctx.items.find((q) => q.room === room.id && q.type === "tv_unit" && q.against === side);
    if (!unit) return;
    const [ua, ub] = alongOf(side, unit);
    const [ta, tb] = alongOf(side, it);
    const du = (ua + ub) / 2 - (ta + tb) / 2;
    const w = tb - ta;
    const target = (ua + ub) / 2;
    if (!solidIntervals(ctx, room, side).some(([a, b]) => target - w / 2 >= a - 0.01 && target + w / 2 <= b + 0.01)) return;
    const mount = unit.h1 + 0.9;
    if (side === "front" || side === "back") {
      group.position.x += du * FT;
      it.x0 += du;
      it.x1 += du;
    } else {
      group.position.z -= du * FT;
      it.y0 += du;
      it.y1 += du;
    }
    const dh = mount - it.h0;
    group.position.y += dh * FT;
    it.h0 += dh;
    it.h1 += dh;
  });
}

/** Door, open-plan gate, stair and roof keep-out zones inside a room (plan ft); see zones.ts. */
export function doorZones(ctx: BuildCtx, room: RoomM): Rect4[] {
  return keepOut(ctx, room).filter((z) => z.kind !== "window");
}

function footprint(cx: number, cy: number, w: number, d: number, rotDeg: number): Rect4 {
  const t = rotDeg * DEG;
  const hx = (Math.abs(Math.cos(t)) * w + Math.abs(Math.sin(t)) * d) / 2;
  const hy = (Math.abs(Math.sin(t)) * w + Math.abs(Math.cos(t)) * d) / 2;
  return { x0: cx - hx, x1: cx + hx, y0: cy - hy, y1: cy + hy };
}

function defaultsFor(ctx: BuildCtx, type: FurnitureType, style: string): { fabric: string; accent: string; accent2: string; main?: string } {
  const pal = ctx.plan.palette;
  const wood = pal.find((c) => { const l = luma(c); return l > 0.18 && l < 0.55; }) ?? "#a26a3c";
  const neutral = pal.find((c) => luma(c) > 0.65 && luma(c) < 0.92) ?? "#d9d3c7";
  const fabric: Partial<Record<string, string>> = {
    sofa_3: "#cfc8bb", sofa_2: "#cfc8bb", sofa_l: "#c9c3b7", armchair: "#a8714a", ottoman: "#6e7d73", bed_king: "#cfc6b8", bed_queen: "#d4cdbf",
    bed_single: "#c9cfd2", dining_chair: "#d8d0c2", desk_chair: "#4a4d52", rug: neutral, prayer_mat: "#7a1f2b", curtains: "#ece6da",
  };
  void style;
  return { fabric: fabric[type] ?? "#cfc8bb", accent: wood === "#a26a3c" ? "#8a5a3a" : wood, accent2: "#e9e1d3" };
}

function defaultMain(ctx: BuildCtx, type: FurnitureType): THREE.Material {
  const M = ctx.mats;
  switch (type) {
    case "wardrobe": return M.get({ preset: "lacquer", color: "#d8d2c8" });
    case "kitchen_counter": case "kitchen_island": case "sink_kitchen": return M.get({ preset: "lacquer", color: "#2d3034" });
    case "fridge": case "oven": return M.get("metal_brushed");
    case "ceiling_fan": return M.get({ preset: "lacquer", color: "#f1efea" });
    case "car_sedan": return M.get({ preset: "lacquer", color: "#e9e9e6", metalness: 0.35, roughness: 0.3 });
    case "car_suv": return M.get({ preset: "lacquer", color: "#25272a", metalness: 0.45, roughness: 0.3 });
    case "vanity": return M.get("wood_walnut");
    case "coffee_table": case "dining_table_4": case "dining_table_6": case "dining_table_8": return M.get("wood_walnut");
    default: return M.get("wood_walnut");
  }
}

export interface FurnishResult {
  group: THREE.Group;
  item?: PlacedItem;
}

export function furnishImpl(ctx: BuildCtx, itemIn: FurnitureType, o: FurnishOptions, style: "modern" | "classic" | "minimal" | "traditional" = "modern"): FurnishResult {
  const prof = (globalThis as unknown as { __naqshaProf?: Record<string, number> }).__naqshaProf;
  const tp = prof ? performance.now() : 0;
  try {
    return furnishInner(ctx, itemIn, o, style);
  } finally {
    if (prof) prof[String(itemIn)] = (prof[String(itemIn)] ?? 0) + performance.now() - tp;
  }
}

function furnishInner(ctx: BuildCtx, itemIn: FurnitureType, o: FurnishOptions, style: "modern" | "classic" | "minimal" | "traditional"): FurnishResult {
  const group = new THREE.Group();
  const type = resolveItem(itemIn);
  if (!type) {
    warn(`furnish: unknown item "${String(itemIn)}", skipped`);
    return { group };
  }
  if (type !== itemIn) warn(`furnish: "${String(itemIn)}" interpreted as ${type}`);
  const def: ItemDef = ITEMS[type];
  const room = findRoom(ctx, o?.room);
  if (!room) return { group };
  const inner = innerRect(ctx, room);
  const isOpenRoom = room.cat !== "enclosed";
  // an open-plan side (no wall at all) is no boundary: furniture may reach 1.5 ft into the neighbouring space
  const openSide = (s: Side) => !isOpenRoom && ctx.structureBuilt && !ctx.model.roomWalls(room, s).length && [...room.open].some((id) => ctx.plan.room(id)?.level === room.level);
  const bounds: Rect4 = isOpenRoom
    ? { x0: room.rect.x + 0.2, x1: room.rect.x + room.rect.w - 0.2, y0: room.rect.y + 0.2, y1: room.rect.y + room.rect.d - 0.2 }
    : { x0: inner.x0 - (openSide("left") ? 1.5 : 0), x1: inner.x1 + (openSide("right") ? 1.5 : 0), y0: inner.y0 - (openSide("front") ? 1.5 : 0), y1: inner.y1 + (openSide("back") ? 1.5 : 0) };
  const size = (o?.size ?? {}) as { w_ft?: number; d_ft?: number; h_ft?: number };
  let w = num(size.w_ft, def.dims[0], 0.2, 40);
  let d = num(size.d_ft, def.dims[1], 0.05, 40);
  const h = num(size.h_ft, def.dims[2], 0.02, 30);
  if ((type === "car_sedan" || type === "car_suv" || type === "motorbike") && w > d) [w, d] = [d, w];
  if (type === "kitchen_counter") d = clamp(d, 1.6, 3);
  const variant = String(o?.variant ?? "").toLowerCase();
  let against: Side | null = SIDES.includes(o?.against as Side) ? (o.against as Side) : null;
  const isVehicle = type === "car_sedan" || type === "car_suv";
  const outdoorGround = room.lv.i === 0 && room.cat !== "enclosed";
  const park = outdoorGround && ctx.structureBuilt ? parking(ctx) : null;
  // keep-out zones for floor items: doors, open-plan gates, stairs, roof door, tank, solar area; windows for tall items
  const tallH = type === "tv_unit" ? 5.6 : h;
  const zones: Zone[] = def.cls === "floor" && ctx.structureBuilt ? keepOut(ctx, room).filter((z) => z.kind !== "window" || (!TALL_EXEMPT.has(type) && tallH > (z.sill ?? 3) + 0.5)) : [];
  let rot = 0;
  let cx: number, cy: number;
  let wallInfo: { axis: "x" | "y"; inner: number; into: number; lo: number; hi: number } | null = null;
  const faceOf = (side: Side) => {
    const r = room.rect;
    const axis: "x" | "y" = side === "front" || side === "back" ? "x" : "y";
    const walls = ctx.model.roomWalls(room, side);
    const into = side === "front" || side === "left" ? 1 : -1;
    const edge = side === "front" ? r.y : side === "back" ? r.y + r.d : side === "left" ? r.x : r.x + r.w;
    // the face of the thickest wall on that side (the room bounds use the same), so items never sink into a wall
    const inner = walls.length ? (into > 0 ? Math.max(...walls.map((wl) => wl.inner)) : Math.min(...walls.map((wl) => wl.inner))) : edge + into * 0.05;
    const lo = axis === "x" ? bounds.x0 : bounds.y0, hi = axis === "x" ? bounds.x1 : bounds.y1;
    return { axis, inner, into, lo, hi };
  };
  /** centre of an item of this size against `side` at along-coordinate u */
  const poseOn = (side: Side, u: number): [number, number] => {
    const f = faceOf(side);
    const t = ROT[side] * DEG;
    const halfAcross = f.axis === "x" ? (Math.abs(Math.sin(t)) * w + Math.abs(Math.cos(t)) * d) / 2 : (Math.abs(Math.cos(t)) * w + Math.abs(Math.sin(t)) * d) / 2;
    const across = f.inner + f.into * (halfAcross + 0.02);
    return f.axis === "x" ? [u, across] : [across, u];
  };
  const dropped = (why: string, status: "warn" | "fail" = "warn"): FurnishResult => {
    ctx.notes.add({ id: `asbuilt.furniture_dropped:${room.id}:${type}:${ctx.items.length}`, title: "Furniture left out", status, message: `${room.name}: the ${type.replace(/_/g, " ")} was left out because ${why}.`, element_ids: [room.id] });
    warn(`furnish ${type} in ${room.id}: ${why}; left out`);
    const dbg = (ctx as unknown as { dropLog?: unknown[] }).dropLog ?? ((ctx as unknown as { dropLog?: unknown[] }).dropLog = []);
    dbg.push({ type, room: room.id, cx, cy, w, d, rot, against, bounds, zones });
    return { group };
  };

  if (isVehicle) {
    // B.6: cars only in a parking bay that keeps the gate-to-door walkway clear
    const bays = ctx.structureBuilt ? parking(ctx).bays.filter((b) => !b.used) : [];
    const want = Array.isArray(o?.at) ? [room.rect.x + num(o.at[0], room.rect.w / 2), room.rect.y + num(o.at[1], room.rect.d / 2)] : [room.rect.x + room.rect.w / 2, room.rect.y + room.rect.d / 2];
    const bay = bays.sort((a, b) => (a.where === b.where ? 0 : a.where === "porch" ? -1 : 1) || Math.hypot(a.rect.x + a.rect.w / 2 - want[0], a.rect.y + a.rect.d / 2 - want[1]) - Math.hypot(b.rect.x + b.rect.w / 2 - want[0], b.rect.y + b.rect.d / 2 - want[1]))[0];
    if (!bay) {
      ctx.notes.add({ id: `asbuilt.car_dropped:${ctx.items.length}`, title: "Car left out", status: "warn", message: `No parking bay is left that keeps the walkway from the gate to the main door clear, so the ${type === "car_suv" ? "SUV" : "car"} in ${room.name} was left out.`, element_ids: [room.id] });
      return { group };
    }
    bay.used = true;
    cx = bay.rect.x + bay.rect.w / 2;
    cy = bay.rect.y + bay.rect.d / 2;
    rot = bay.rot;
    against = null;
  } else if (against) {
    rot = ROT[against];
    const r = room.rect;
    const axis: "x" | "y" = against === "front" || against === "back" ? "x" : "y";
    wallInfo = faceOf(against);
    // along_ft: from the wall's LEFT end as seen from inside the room
    const len = axis === "x" ? r.w : r.d;
    let along = num(o?.along_ft, NaN);
    let u: number | undefined;
    const alongGiven = Number.isFinite(along);
    if (!alongGiven) {
      along = len / 2;
      if (type === "curtains") {
        // center on the biggest window of that wall
        const ops = ctx.model.roomWalls(room, against).flatMap((wl) => wl.run.openings.filter((op) => !op.isDoor || op.op.type === "sliding_door"));
        if (ops.length) {
          const big = ops.sort((p, q) => q.u1 - q.u0 - (p.u1 - p.u0))[0];
          u = (big.u0 + big.u1) / 2;
          if (!o?.size?.w_ft) w = big.u1 - big.u0 + 1.6;
        }
      }
    }
    if (u === undefined) {
      along = clamp(along, 0, len);
      u = against === "front" ? r.x + r.w - along : against === "back" ? r.x + along : against === "left" ? r.y + along : r.y + r.d - along;
    }
    // B.4: wall items only on solid wall, never over a door or window; paired items line up with their partner
    if (def.cls === "wall" && type !== "curtains" && ctx.structureBuilt) {
      const partner = pairPartner(ctx, room, type, against, u, alongGiven);
      if (partner) {
        against = partner.side;
        u = partner.u;
      }
      const spot = placeOnWall(ctx, room, type, against, u, w);
      if (!spot) return dropped("no wall in the room has a clear stretch for it (it may not hang over a door or window)");
      if (spot.side !== against) {
        against = spot.side;
        rot = ROT[against];
        wallInfo = faceOf(against);
      }
      u = spot.u;
    }
    [cx, cy] = poseOn(against, u);
  } else {
    const at = Array.isArray(o?.at) ? o.at : null;
    const lx = at ? num(at[0], room.rect.w / 2) : room.rect.w / 2;
    const ly = at ? num(at[1], room.rect.d / 2) : room.rect.d / 2;
    cx = room.rect.x + lx;
    cy = room.rect.y + ly;
    rot = num(o?.rot_deg, 0, -720, 720);
    if (type === "prayer_mat" && o?.rot_deg === undefined) rot = qiblaRot(ctx);
  }

  // clamp inside the room
  let fp = footprint(cx, cy, w, d, rot);
  const clampFp = () => {
    const hw = (fp.x1 - fp.x0) / 2, hh = (fp.y1 - fp.y0) / 2;
    if (def.cls === "ceiling") return;
    cx = bounds.x1 - bounds.x0 > 2 * hw ? clamp(cx, bounds.x0 + hw, bounds.x1 - hw) : (bounds.x0 + bounds.x1) / 2;
    cy = bounds.y1 - bounds.y0 > 2 * hh ? clamp(cy, bounds.y0 + hh, bounds.y1 - hh) : (bounds.y0 + bounds.y1) / 2;
    fp = footprint(cx, cy, w, d, rot);
  };
  if (!isVehicle) clampFp();

  // B.4/B.6: floor items never in a keep-out zone, on the walkway or in a parking bay. Search: the requested wall
  // (full clearances, then the core clearances that still keep every door leaf, doorway and stair free), the other
  // walls, a narrower size, and for essential fixtures a spot that may touch other furniture; else leave it out.
  if (def.cls === "floor" && !isVehicle) {
    const others = ctx.items.filter((it) => it.room === room.id && it.cls === "floor" && !companions(type, it.type)).map((it) => ({ x0: it.x0, x1: it.x1, y0: it.y0, y1: it.y1 }));
    const bays = park ? park.bays.map((b) => ({ x0: b.rect.x, x1: b.rect.x + b.rect.w, y0: b.rect.y, y1: b.rect.y + b.rect.d })) : [];
    const inBounds = (f: Rect4) => !(f.x0 < bounds.x0 - 0.01 || f.x1 > bounds.x1 + 0.01 || f.y0 < bounds.y0 - 0.01 || f.y1 > bounds.y1 + 0.01);
    /** tier 0: full zones; 1: core zones; 2: core zones, other furniture ignored; 3: (tiny wet rooms) only the
     *  doorway itself and 1 ft in front of it, the stair and its landings */
    const doorway = (z: Zone) => {
      if (z.kind !== "door" || !z.core) return z.core ?? z;
      const c = z.core;
      const wide = c.x1 - c.x0 > c.y1 - c.y0;
      return wide ? { x0: c.x0, x1: c.x1, y0: c.y0, y1: Math.min(c.y1, c.y0 + 1.2) } : { x0: c.x0, x1: Math.min(c.x1, c.x0 + 1.2), y0: c.y0, y1: c.y1 };
    };
    const free = (f: Rect4, tier = 0) =>
      inBounds(f) &&
      !zones.some((z) => (tier >= 2 && z.kind === "window") || overlaps(f, tier === 0 ? z : tier === 3 ? doorway(z) : z.core ?? z, 0.04)) &&
      (tier >= 2 || !others.some((ob) => overlaps(f, ob, 0.08))) &&
      !bays.some((b) => overlaps(f, b, 0.02)) &&
      !(park && onWalkwayRect(park, f));
    if (!free(fp)) {
      const start = { side: against, rot, w, cx, cy };
      let found: { x: number; y: number; side: Side | null; rot: number; w: number } | null = null;
      // an item that stands against a wall only moves to stretches where a wall really stands behind it
      const backed = (side: Side, u: number, ww: number) => {
        const ws = ctx.model.roomWalls(room, side).map((wl) => [wl.a, wl.b] as [number, number]).sort((p, q) => p[0] - q[0]);
        if (!ws.length) return side === start.side;
        const merged: [number, number][] = [];
        for (const sp of ws) {
          const last = merged[merged.length - 1];
          if (last && sp[0] <= last[1] + 0.06) last[1] = Math.max(last[1], sp[1]);
          else merged.push([sp[0], sp[1]]);
        }
        return merged.some(([a, b]) => u - ww / 2 >= a - 0.3 && u + ww / 2 <= b + 0.3);
      };
      // obstacles as intervals along a wall, to try the exact spots between them (a 0.25 ft scan misses tight gaps)
      const edgesAlong = (side: Side, tier: number): number[] => {
        const ax = side === "front" || side === "back";
        const out: number[] = [];
        for (const z of zones) {
          const q = tier === 0 ? z : z.core ?? z;
          out.push(ax ? q.x0 : q.y0, ax ? q.x1 : q.y1);
        }
        for (const o of tier === 2 ? [] : others) out.push(ax ? o.x0 : o.y0, ax ? o.x1 : o.y1);
        for (const wl of ctx.model.roomWalls(room, side)) out.push(wl.a, wl.b);
        return out;
      };
      const tryWall = (side: Side, uPref: number, wTry: number, tier: number): boolean => {
        const f0 = faceOf(side);
        const r2 = ROT[side];
        const save = w;
        w = wTry;
        const t = r2 * DEG;
        const hw = (side === "front" || side === "back" ? Math.abs(Math.cos(t)) * w + Math.abs(Math.sin(t)) * d : Math.abs(Math.sin(t)) * w + Math.abs(Math.cos(t)) * d) / 2;
        const us = [uPref, f0.lo + hw, f0.hi - hw];
        for (const e of edgesAlong(side, tier)) us.push(e - hw - 0.05, e + hw + 0.05);
        for (let u = f0.lo + hw; u <= f0.hi - hw + 1e-6; u += 0.5) us.push(u);
        us.sort((a, b) => Math.abs(a - uPref) - Math.abs(b - uPref));
        for (const u of us) {
          if (u < f0.lo + hw - 0.01 || u > f0.hi - hw + 0.01) continue;
          if (!backed(side, u, w)) continue;
          const [px, py] = poseOn(side, u);
          const f = footprint(px, py, w, d, r2);
          if (free(f, tier)) {
            found = { x: px, y: py, side, rot: r2, w };
            return true;
          }
        }
        w = save;
        return false;
      };
      /** nearest free spot within 5 ft: candidates touch the room bounds or an obstacle's edge, plus a 0.5 ft grid */
      const trySpiral = (tier: number): boolean => {
        const f = footprint(cx, cy, w, d, rot);
        const hx = (f.x1 - f.x0) / 2, hy = (f.y1 - f.y0) / 2;
        const xs = [cx, bounds.x0 + hx, bounds.x1 - hx], ys = [cy, bounds.y0 + hy, bounds.y1 - hy];
        for (const z of zones) {
          const q = tier === 0 ? z : z.core ?? z;
          xs.push(q.x0 - hx - 0.05, q.x1 + hx + 0.05);
          ys.push(q.y0 - hy - 0.05, q.y1 + hy + 0.05);
        }
        for (const o of tier === 2 ? [] : others) {
          xs.push(o.x0 - hx - 0.1, o.x1 + hx + 0.1);
          ys.push(o.y0 - hy - 0.1, o.y1 + hy + 0.1);
        }
        for (let k = -18; k <= 18; k++) {
          xs.push(cx + k * 0.5);
          ys.push(cy + k * 0.5);
        }
        let best: { x: number; y: number; dd: number } | null = null;
        for (const x of xs)
          for (const y of ys) {
            const dd = Math.hypot(x - cx, y - cy);
            if (dd > (tier === 0 ? 5 : 9) || (best && dd >= best.dd)) continue;
            if (free(footprint(x, y, w, d, rot), tier)) best = { x, y, dd };
          }
        if (!best) return false;
        found = { x: best.x, y: best.y, side: null, rot, w };
        return true;
      };
      /** the widest clear stretch of any wall, for items that can be made shorter (counters, wardrobes) */
      const fitSpan = (tier: number): boolean => {
        const spans: { side: Side; u: number; len: number }[] = [];
        for (const s of [start.side!, OPP[start.side!], ...ADJ[start.side!]]) {
          if (!ctx.model.roomWalls(room, s).length) continue;
          const f0 = faceOf(s);
          let run0: number | null = null;
          const probe = 0.6;
          for (let u = f0.lo; u <= f0.hi + 1e-6; u += 0.25) {
            const [px, py] = poseOn(s, u);
            const ok = free(footprint(px, py, probe, d, ROT[s]), tier);
            if (ok && run0 === null) run0 = u;
            if ((!ok || u + 0.25 > f0.hi + 1e-6) && run0 !== null) {
              const end = ok ? u : u - 0.25;
              const len = end - run0 + probe;
              spans.push({ side: s, u: (run0 + end) / 2, len });
              run0 = null;
            }
          }
        }
        spans.sort((a, b) => b.len - a.len);
        for (const b of spans) {
          if (b.len - 0.2 < Math.max(3, start.w * 0.5)) break;
          if (tryWall(b.side, b.u, Math.min(start.w, b.len - 0.2), tier)) return true;
        }
        return false;
      };
      if (start.side) {
        const s0 = start.side;
        const uNow = wallInfo!.axis === "x" ? cx : cy;
        const proj = (side: Side) => (side === "front" || side === "back" ? cx : cy);
        const rest: Side[] = [OPP[s0], ...ADJ[s0]];
        const ok =
          tryWall(s0, uNow, w, 0) ||
          tryWall(s0, uNow, w, 1) ||
          rest.some((s) => tryWall(s, proj(s), start.w, 0)) ||
          rest.some((s) => tryWall(s, proj(s), start.w, 1)) ||
          (SHRINK.has(type) && [0.95, 0.9, 0.85].some((k) => [s0, ...rest].some((s) => tryWall(s, s === s0 ? uNow : proj(s), start.w * k, 1)))) ||
          (SHRINK.has(type) && fitSpan(1)) ||
          (ESSENTIAL.has(type) && [s0, ...rest].some((s) => tryWall(s, s === s0 ? uNow : proj(s), start.w, 2))) ||
          (ESSENTIAL.has(type) && SHRINK.has(type) && fitSpan(2)) ||
          (ESSENTIAL.has(type) && WET.has(room.type) && [s0, ...rest].some((s) => tryWall(s, s === s0 ? uNow : proj(s), start.w * (SHRINK.has(type) ? 0.85 : 1), 3)));
        void ok;
      } else if (!trySpiral(0) && !trySpiral(1) && ESSENTIAL.has(type)) trySpiral(2);
      if (!found) return dropped("there is no place for it that keeps doors, stairs and walkways clear");
      const fnd = found as { x: number; y: number; side: Side | null; rot: number; w: number };
      cx = fnd.x;
      cy = fnd.y;
      w = fnd.w;
      if (fnd.side && fnd.side !== start.side) {
        against = fnd.side;
        rot = fnd.rot;
        wallInfo = faceOf(fnd.side);
      }
      fp = footprint(cx, cy, w, d, rot);
    }
  }
  if (def.cls === "wall" && type === "tv" && ctx.structureBuilt) {
    // a TV placed before its unit: line it up at the end of the section
    const tvUnitLater = !ctx.items.some((it) => it.room === room.id && it.type === "tv_unit");
    if (tvUnitLater) deferTvPairing(ctx, room, group, () => item);
  }

  // vertical placement
  let base = room.floorH;
  const extra: ItemBuild["extra"] = { room: room.id };
  const ceilingAtPoint = () => {
    const fc = ctx.falseCeil.get(room.id);
    const cove = (ctx as unknown as { coveInner?: Map<string, number[]> }).coveInner?.get(room.id);
    if (fc !== undefined && cove) {
      const [ix0, ix1, iy0, iy1] = cove;
      const inside = cx > ix0 && cx < ix1 && cy > iy0 && cy < iy1;
      return inside ? room.ceilH : fc;
    }
    return fc ?? room.ceilH;
  };
  if (def.cls === "ceiling") {
    // pendants, chandeliers and fans never hang in a stairwell
    [cx, cy] = ceilingSpot(ctx, room, cx, cy);
    fp = footprint(cx, cy, w, d, rot);
    extra.ceiling = (ceilingAtPoint() - room.floorH) * FT;
  } else if (def.cls === "wall") {
    let mount = def.mount ?? 4;
    if (num(size.h_ft, NaN) && type === "curtains") mount = 0;
    const below = ctx.items.filter((it) => it.room === room.id && it.cls === "floor" && it.against === against && overlaps(it, { x0: fp.x0 - 0.2, x1: fp.x1 + 0.2, y0: fp.y0 - 3, y1: fp.y1 + 3 }, 0));
    const topBelow = below.length ? Math.max(...below.map((it) => it.h1)) - room.floorH : 0;
    if (type === "tv") mount = topBelow > 0 ? topBelow + 0.9 : 3.3;
    else if (type === "painting") mount = topBelow > 0 ? Math.max(topBelow + 0.8, 3.6) : Math.max(3.2, 5 - h / 2);
    else if (type === "mirror_wall") mount = topBelow > 0 ? topBelow + 0.6 : Math.max(2.8, 5.2 - h / 2);
    else if (type === "ac_split") mount = Math.min(def.mount ?? 6.9, ceilingAtPoint() - room.floorH - 1.25);
    else if (type === "curtains") mount = 0;
    base = room.floorH + mount;
    if (type === "curtains") extra.ceiling = (ceilingAtPoint() - room.floorH) * FT;
  } else if (def.cls === "top") {
    const sup = ctx.items.filter((it) => it.room === room.id && it.topH !== null && cx > it.x0 && cx < it.x1 && cy > it.y0 && cy < it.y1).sort((a, b) => (b.topH ?? 0) - (a.topH ?? 0))[0];
    if (sup) {
      base = sup.topH!;
      extra.support = (sup.topH! - room.floorH) * FT;
    }
  }
  if (type === "kitchen_counter" && wallInfo) {
    // openings on the wall behind, in item-local x (m)
    const walls = ctx.model.roomWalls(room, against!);
    // item-local +x along the wall's plan axis (world z = -y, built geometry mirrored in local z)
    const sgn = against === "front" || against === "right" ? 1 : -1;
    const centerU = wallInfo.axis === "x" ? cx : cy;
    extra.wallOpenings = walls.flatMap((wl) =>
      wl.run.openings
        .filter((op) => !op.isDoor)
        .map((op) => {
          const a = (op.u0 - centerU) * sgn * FT, b = (op.u1 - centerU) * sgn * FT;
          return { x0: Math.min(a, b), x1: Math.max(a, b), sill: (op.bottom - room.floorH) * FT, top: (op.top - room.floorH) * FT };
        }),
    );
    extra.ceiling = (ceilingAtPoint() - room.floorH) * FT;
  }

  // materials
  const dflt = defaultsFor(ctx, type, style);
  const fabricHex = typeof o?.color === "string" ? colorHex(o.color, dflt.fabric) : dflt.fabric;
  const main = o?.material ? ctx.mats.get(o.material, "wood_walnut") : defaultMain(ctx, type);
  const mats = makeMats(ctx.mats, { main, fabricHex, accentHex: dflt.accent, accent2Hex: dflt.accent2, style });
  if (type === "car_sedan" || type === "car_suv") mats.main = typeof o?.color === "string" ? ctx.mats.get({ preset: "lacquer", color: o.color, metalness: 0.45, roughness: 0.3 }) : main;
  if (type === "curtains" || type === "towel_rail") mats.accent2 = ctx.mats.get({ preset: "linen", color: fabricHex });
  if (type === "rug" || type === "prayer_mat") mats.fabric = ctx.mats.get({ preset: "fabric", color: fabricHex });

  const seed = hashStr(`${room.id}|${type}|${ctx.items.length}`);
  const kit = new Kit();
  const b: ItemBuild = { k: kit, w: w * FT, d: d * FT, h: h * FT, m: mats, variant, rnd: rng(seed), style, colorHex: fabricHex, extra };

  // deferred builds (need to know what else the section places)
  const deferred = type === "kitchen_counter" || type.startsWith("dining_table");
  const doBuild = () => {
    try {
      def.build(b);
    } catch (e) {
      warn(`furnish ${type} failed: ${(e as Error).message}`);
    }
    kit.build(group);
    group.traverse((x) => {
      const mesh = x as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.userData.collide = !!def.collide;
        if (def.collide) ctx.collider(mesh);
      }
    });
  };
  // world: z = -y; built geometry faces local -z, so a plan CCW rotation θ is rotation.y = +θ
  group.position.set(cx * FT, base * FT, -cy * FT);
  group.rotation.y = rot * DEG;
  if (type === "prayer_mat") group.rotation.y += Math.PI;
  const label = `${room.name} ${type.replace(/_/g, " ")}`;
  const topH = topHeight(type, base, h, b);
  const item: PlacedItem = {
    id: ctx.uid(`${room.id}_${type}`), type, room: room.id, x0: fp.x0, x1: fp.x1, y0: fp.y0, y1: fp.y1,
    h0: base, h1: base + (def.cls === "ceiling" ? 0 : h), cls: def.cls, topH, group, against: against ?? undefined, w, d, rot,
  };
  ctx.items.push(item);
  const vehicle = isVehicle || type === "motorbike";
  ctx.add(group, { kind: vehicle ? "vehicle" : `furniture:${type}`, room: room.id, level: room.level, id: item.id, label: vehicle ? (type === "car_suv" ? "SUV" : type === "motorbike" ? "Motorbike" : "Car") : label });
  if (vehicle) group.userData.mergeGroup = "vehicle";

  if (deferred) {
    ctx.endOfSection.push(() => {
      if (type === "kitchen_counter") {
        b.extra.noHob = ctx.items.some((it) => it.room === room.id && (it.type === "hob" || it.type === "oven"));
        b.extra.noSink = ctx.items.some((it) => it.room === room.id && it.type === "sink_kitchen");
      }
      doBuild();
      if (type.startsWith("dining_table") && !variant.includes("no chair") && !variant.includes("table only")) {
        const explicit = ctx.items.some((it) => it.room === room.id && it.type === "dining_chair" && Math.abs((it.x0 + it.x1) / 2 - cx) < w / 2 + 3 && Math.abs((it.y0 + it.y1) / 2 - cy) < w / 2 + 3);
        if (!explicit) {
          const seats = type === "dining_table_8" ? 8 : type === "dining_table_6" ? 6 : 4;
          const ck = new Kit();
          chairsForTable(ck, { ...b, k: ck, m: { ...mats, fabric: ctx.mats.get({ preset: "fabric", color: "#d6cdbd" }) } }, seats);
          const cg = ck.build(new THREE.Group());
          cg.name = "auto_chairs";
          group.add(cg);
          cg.traverse((x) => {
            if ((x as THREE.Mesh).isMesh) x.userData.collide = false;
          });
          for (const k of ["layer", "level", "room", "kind", "id", "label", "section"]) cg.traverse((x) => (x.userData[k] ??= group.userData[k]));
        }
      }
      // propagate tags to late-built children
      group.traverse((x) => {
        for (const k of ["layer", "level", "room", "kind", "id", "label", "section"]) if (x.userData[k] === undefined) x.userData[k] = group.userData[k];
      });
    });
  } else {
    doBuild();
    group.traverse((x) => {
      for (const k of ["layer", "level", "room", "kind", "id", "label", "section"]) if (x.userData[k] === undefined) x.userData[k] = group.userData[k];
    });
  }

  if (type === "ac_split" && wallInfo && against) addOutdoorUnit(ctx, room, against, cx, cy, base, mats);
  return { group, item };
}

function topHeight(type: FurnitureType, base: number, h: number, b: ItemBuild): number | null {
  const ft = (m: number) => m / FT;
  switch (type) {
    case "side_table": case "dresser": case "console_table": case "sideboard": case "tv_unit": case "coffee_table": case "bookshelf": case "wardrobe": case "outdoor_table":
      return base + h;
    case "study_desk": case "dressing_table": case "dining_table_4": case "dining_table_6": case "dining_table_8":
      return base + ft(0.76);
    case "kitchen_counter": case "kitchen_island": case "vanity":
      return base + ft(type === "vanity" ? 0.86 : 0.9);
    default:
      void b;
      return null;
  }
}

function addOutdoorUnit(ctx: BuildCtx, room: RoomM, side: Side, cx: number, cy: number, base: number, mats: ReturnType<typeof makeMats>): void {
  const walls = ctx.model.roomWalls(room, side);
  const u = side === "front" || side === "back" ? cx : cy;
  const wl = walls.find((x) => u >= x.a - 0.1 && u <= x.b + 0.1);
  if (!wl || wl.run.out === 0) return;
  const run = wl.run;
  if (run.axis === "x" && run.out < 0) return; // keep the street facade clean
  const outer = run.c + (run.out * run.t) / 2;
  // never hang it over a party wall / past the plot's projection envelope (the unit is ~1.1 ft deep)
  const face0: Side = run.axis === "x" ? (run.out < 0 ? "front" : "back") : run.out < 0 ? "left" : "right";
  const env = ctx.model.envelope;
  const reach = outer + run.out * 1.15;
  if (env.party[face0] || (run.axis === "x" ? reach < env.y0 || reach > env.y1 : reach < env.x0 || reach > env.x1)) return;
  // skip if a facade element or an opening sits there
  if (run.openings.some((op) => u > op.u0 - 1.6 && u < op.u1 + 1.6)) return;
  const h = Math.max(room.floorH + 1, base - 1.6);
  const kit = new Kit();
  acOutdoor(kit, mats);
  const g = kit.build();
  const px = run.axis === "x" ? u : outer, py = run.axis === "x" ? outer : u;
  g.position.set(px * FT, h * FT, -py * FT);
  // outward facing
  const face: Side = run.axis === "x" ? (run.out < 0 ? "front" : "back") : run.out < 0 ? "left" : "right";
  const rot = face === "back" ? 0 : face === "front" ? 180 : face === "left" ? 90 : -90;
  g.rotation.y = rot * DEG;
  ctx.add(g, { kind: "furniture:ac_outdoor", room: room.id, level: room.level, label: "AC outdoor unit" });
  g.traverse((x) => (x.userData.collide = false));
}

/** rot_deg so that a prayer mat faces the qibla (~263° from Lahore). */
export function qiblaRot(ctx: BuildCtx): number {
  const FACING: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
  const bF = FACING[ctx.plan.plan.site?.facing ?? "N"] ?? 0;
  const th = (263 - bF) * DEG;
  const dx = -Math.sin(th), dy = -Math.cos(th);
  return Math.atan2(-dx, dy) / DEG;
}
