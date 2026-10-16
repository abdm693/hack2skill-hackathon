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

/** Door swing/approach zones inside a room (plan ft). */
export function doorZones(ctx: BuildCtx, room: RoomM): Rect4[] {
  const out: Rect4[] = [];
  for (const o of ctx.model.openingsOfRoom(room)) {
    if (!o.isDoor) continue;
    const run = o.run;
    const into = run.neg === room ? -1 : 1;
    const swingsHere = o.swingSide === into;
    const depth = o.op.type === "sliding_door" ? 2.6 : swingsHere ? Math.min(3.4, o.u1 - o.u0 + 0.3) : 2.6;
    const pad = 0.3;
    const c0 = run.c + (into * run.t) / 2, c1 = c0 + into * depth;
    if (run.axis === "x") out.push({ x0: o.u0 - pad, x1: o.u1 + pad, y0: Math.min(c0, c1), y1: Math.max(c0, c1) });
    else out.push({ x0: Math.min(c0, c1), x1: Math.max(c0, c1), y0: o.u0 - pad, y1: o.u1 + pad });
  }
  // stairs in this room
  for (const s of ctx.model.stairs) {
    if (s.stair.from.id !== room.level) continue;
    const r = s.rect;
    if (r.x + r.w < room.rect.x || r.x > room.rect.x + room.rect.w || r.y + r.d < room.rect.y || r.y > room.rect.y + room.rect.d) continue;
    out.push({ x0: r.x - 0.3, x1: r.x + r.w + 0.3, y0: r.y - 0.3, y1: r.y + r.d + 0.3 });
  }
  return out;
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
  const bounds: Rect4 = isOpenRoom ? { x0: room.rect.x + 0.2, x1: room.rect.x + room.rect.w - 0.2, y0: room.rect.y + 0.2, y1: room.rect.y + room.rect.d - 0.2 } : { x0: inner.x0, x1: inner.x1, y0: inner.y0, y1: inner.y1 };
  const size = (o?.size ?? {}) as { w_ft?: number; d_ft?: number; h_ft?: number };
  let w = num(size.w_ft, def.dims[0], 0.2, 40);
  let d = num(size.d_ft, def.dims[1], 0.05, 40);
  const h = num(size.h_ft, def.dims[2], 0.02, 30);
  if ((type === "car_sedan" || type === "car_suv" || type === "motorbike") && w > d) [w, d] = [d, w];
  if (type === "kitchen_counter") d = clamp(d, 1.6, 3);
  const variant = String(o?.variant ?? "").toLowerCase();
  const against = SIDES.includes(o?.against as Side) ? (o.against as Side) : null;
  const zones = def.cls === "floor" ? doorZones(ctx, room) : [];
  let rot = 0;
  let cx: number, cy: number;
  let wallInfo: { axis: "x" | "y"; inner: number; into: number; lo: number; hi: number } | null = null;

  if (against) {
    rot = ROT[against];
    const r = room.rect;
    const axis: "x" | "y" = against === "front" || against === "back" ? "x" : "y";
    const walls = ctx.model.roomWalls(room, against);
    const into = against === "front" || against === "left" ? 1 : -1;
    const edge = against === "front" ? r.y : against === "back" ? r.y + r.d : against === "left" ? r.x : r.x + r.w;
    const face = walls.length ? walls[0].inner : edge + into * 0.05;
    const lo = axis === "x" ? bounds.x0 : bounds.y0, hi = axis === "x" ? bounds.x1 : bounds.y1;
    wallInfo = { axis, inner: face, into, lo, hi };
    // along_ft: from the wall's LEFT end as seen from inside the room
    const len = axis === "x" ? r.w : r.d;
    let along = num(o?.along_ft, NaN);
    let u: number;
    if (!Number.isFinite(along)) {
      along = len / 2;
      if (type === "curtains" || type === "ac_split") {
        // center on the biggest window of that wall (curtains) / largest solid stretch (AC)
        const ops = walls.flatMap((wl) => wl.run.openings.filter((op) => !op.isDoor || op.op.type === "sliding_door"));
        if (type === "curtains" && ops.length) {
          const big = ops.sort((p, q) => q.u1 - q.u0 - (p.u1 - p.u0))[0];
          u = (big.u0 + big.u1) / 2;
          if (!o?.size?.w_ft) w = big.u1 - big.u0 + 1.6;
        }
      }
    }
    if (u! === undefined) {
      along = clamp(along, 0, len);
      u = against === "front" ? r.x + r.w - along : against === "back" ? r.x + along : against === "left" ? r.y + along : r.y + r.d - along;
    }
    // wall-mounted items need a real wall: slide to the nearest wall interval on this side
    if (def.cls === "wall") {
      if (!walls.length) {
        warn(`furnish ${type}: ${room.id} has no wall on its ${against} side`);
      } else if (!walls.some((wl) => u > wl.a + 0.3 && u < wl.b - 0.3)) {
        const best = walls.map((wl) => ({ wl, c: clamp(u, wl.a + Math.min(w / 2, (wl.b - wl.a) / 2), wl.b - Math.min(w / 2, (wl.b - wl.a) / 2)) })).sort((p, q) => Math.abs(p.c - u) - Math.abs(q.c - u))[0];
        u = best.c;
      }
    }
    const t = rot * DEG;
    const halfDepth = (Math.abs(Math.sin(t)) * w + Math.abs(Math.cos(t)) * d) / 2;
    const halfDepthAcross = axis === "x" ? halfDepth : (Math.abs(Math.cos(t)) * w + Math.abs(Math.sin(t)) * d) / 2;
    const across = face + into * (halfDepthAcross + 0.02);
    if (axis === "x") {
      cx = u;
      cy = across;
    } else {
      cx = across;
      cy = u;
    }
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
  clampFp();

  // nudge floor items away from doors, stairs and other furniture
  if (def.cls === "floor") {
    const others = ctx.items.filter((it) => it.room === room.id && it.cls === "floor" && !companions(type, it.type)).map((it) => ({ x0: it.x0, x1: it.x1, y0: it.y0, y1: it.y1 }));
    const obstacles = [...others, ...zones];
    const free = (f: Rect4) => !obstacles.some((ob) => overlaps(f, ob, 0.08));
    if (!free(fp)) {
      let best: { x: number; y: number; dist: number } | null = null;
      const step = 0.25;
      if (wallInfo) {
        for (let k = 1; k <= 120 && !best; k++)
          for (const sgn of [1, -1]) {
            const s = sgn * k * step;
            const nx = wallInfo.axis === "x" ? cx + s : cx, ny = wallInfo.axis === "x" ? cy : cy + s;
            const f = footprint(nx, ny, w, d, rot);
            if (f.x0 < bounds.x0 - 0.01 || f.x1 > bounds.x1 + 0.01 || f.y0 < bounds.y0 - 0.01 || f.y1 > bounds.y1 + 0.01) continue;
            if (free(f)) {
              best = { x: nx, y: ny, dist: Math.abs(s) };
              break;
            }
          }
      } else {
        for (let rr = step; rr <= 3 && !best; rr += step)
          for (let a = 0; a < 16; a++) {
            const nx = cx + Math.cos((a / 16) * Math.PI * 2) * rr, ny = cy + Math.sin((a / 16) * Math.PI * 2) * rr;
            const f = footprint(nx, ny, w, d, rot);
            if (f.x0 < bounds.x0 - 0.01 || f.x1 > bounds.x1 + 0.01 || f.y0 < bounds.y0 - 0.01 || f.y1 > bounds.y1 + 0.01) continue;
            if (free(f)) {
              best = { x: nx, y: ny, dist: rr };
              break;
            }
          }
      }
      if (best) {
        cx = best.x;
        cy = best.y;
        fp = footprint(cx, cy, w, d, rot);
      }
    }
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
    h0: base, h1: base + (def.cls === "ceiling" ? 0 : h), cls: def.cls, topH, group, against: against ?? undefined,
  };
  ctx.items.push(item);
  ctx.add(group, { kind: `furniture:${type}`, room: room.id, level: room.level, id: item.id, label });

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
