/**
 * Dev-only livability checklist, run on a BUILT scene (web/dev/engine.html, "Checks" panel and __engine.checks()):
 *  1. guards: rays across every edge of walkable floor on every upper level hit a wall, railing, parapet or window
 *     (the stair arrival and the band of a flight leaving that floor are the only openings), and a walker pushed
 *     toward every stairwell edge is stopped;
 *  2. a stair chain reaches the roof, the roof door is at roof level on the top landing, and a walker climbs from
 *     the ground-floor foot of the stair to the roof outside that door;
 *  3. no furniture in a door's swing or doorway, on a stair or its landings; no wall item over a door or window;
 *  4. the walkway from the gate to the main door is clear of cars, and the walk starts on it with the door in view;
 *  5. 3 ft walking paths join every door and stair landing of each room cluster;
 *  6. openings cut only into the wall between the rooms they name;
 *  7. stairs at code (treads, landings, foot strip) and the stair tower covers the top flight;
 *  8. headroom: every cell inside a stair's footprint a walker can stand in has 6′8″ clear to the soffit above
 *     (anything lower is boxed in as under-stair storage);
 *  9. windows: every curtain pair hangs centred on a window or sliding door (never over a door), and no tall piece
 *     (wardrobe, bookshelf, fridge, TV unit) stands in front of a window in a habitable room (zones.HABITABLE).
 */
import * as THREE from "three";
import { MeshBVH, acceleratedRaycast } from "three-mesh-bvh";
import type { BuildResult } from "../index";
import type { BuildCtx } from "../core/ctx";
import { resolveHit } from "../core/tags";
import { rectContains } from "../core/grid";
import { subtract } from "../structure/cover";
import { HEADROOM, openingsOnEdge } from "../structure/stairs-geo";
import { blocksWindow, doorClearance, HABITABLE, intrudes, isTall, keepOut, solidIntervals } from "../furniture/zones";
import { parking, onWalkwayRect } from "../furniture/parking";
import { pathReport } from "../furniture/paths";
import { ITEMS } from "../furniture/items";
import { colliderMesh, walk } from "./walktest";

export interface Check {
  id: string;
  title: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  spots?: { level: string; x: number; y: number; note: string }[];
}

const FT = 0.3048;
const GUARD_KIND = /^(wall|railing|window|parapet|column)/;

export function runChecks(res: BuildResult): Check[] {
  const ctx = (res as unknown as { ctx?: BuildCtx }).ctx;
  if (!ctx || !ctx.structureBuilt) return [{ id: "build", title: "Build", status: "fail", detail: "no build context" }];
  const out: Check[] = [];
  res.root.updateMatrixWorld(true);
  const col = colliderMesh(res);
  out.push(checkGuards(ctx, res));
  out.push(checkFalls(ctx, col));
  out.push(checkRoof(ctx, res, col));
  out.push(...checkFurniture(ctx));
  out.push(checkWalkway(ctx, res));
  out.push(checkPaths(ctx));
  out.push(checkOpenings(ctx));
  out.push(checkStairs(ctx));
  out.push(checkHeadroom(ctx, res, col));
  out.push(checkWindows(ctx));
  return out;
}

/** a point a person can stand on: inside a room of that level, not inside a wall, not over a stairwell */
function standable(ctx: BuildCtx, level: string, x: number, y: number): boolean {
  const r = ctx.plan.roomAt(level, x, y);
  if (!r || r.cat === "outdoor") return false;
  for (const run of ctx.model.runsByLevel.get(level) ?? []) {
    const along = run.axis === "x" ? x : y, across = run.axis === "x" ? y : x;
    if (along >= run.ea - 0.05 && along <= run.eb + 0.05 && Math.abs(across - run.c) <= run.t / 2 + 0.3) return false;
  }
  return !ctx.model.stairs.some((l) => l.holeLevel === level && l.holes.some((h) => rectContains(h, x, y, -0.01)));
}

// ── 1. guards (scene raycasts) ─────────────────────────────────────────────────────────────────────────────
function sceneMeshes(res: BuildResult): THREE.Mesh[] {
  const list: THREE.Mesh[] = [];
  res.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible || o.userData.kind === "collider" || (o as THREE.InstancedMesh).isInstancedMesh) return;
    const layer = o.userData.layer;
    if (layer !== "structure" && layer !== "facade" && layer !== "custom") return;
    const g = m.geometry as THREE.BufferGeometry & { boundsTree?: MeshBVH };
    // indirect: never reorder the scene geometry (merged meshes map triangle ranges to elements)
    if (!g.boundsTree) g.boundsTree = new MeshBVH(g, { indirect: true });
    m.raycast = acceleratedRaycast;
    list.push(m);
  });
  return list;
}

function edgesToGuard(ctx: BuildCtx): { level: string; elev: number; axis: "x" | "y"; c: number; a: number; b: number; floorSide: -1 | 1; hole: boolean }[] {
  const out: { level: string; elev: number; axis: "x" | "y"; c: number; a: number; b: number; floorSide: -1 | 1; hole: boolean }[] = [];
  for (const s of ctx.model.slabs) {
    const U = s.level;
    if (s.top > U.elev + 1) continue;
    const holes = ctx.model.stairs.filter((l) => l.holeLevel === U.id).flatMap((l) => l.holes);
    const er = s.grid.edgeRuns((n, p) => ((n === true) !== (p === true) ? (n === true ? "+" : "-") : null));
    for (const e of er) {
      const floorSide: -1 | 1 = e.key === "+" ? 1 : -1;
      const keep = subtract([[e.a, e.b]], openingsOnEdge(ctx, U.id, e.axis, e.c), 0.2);
      const off = e.c + floorSide * 0.3;
      for (const [a, b] of keep) {
        const mid = (a + b) / 2;
        const [x, y] = e.axis === "x" ? [mid, off] : [off, mid];
        const hole = holes.some((h) => rectContains(h, x, y, -0.01));
        out.push({ level: U.id, elev: U.elev, axis: e.axis, c: e.c, a, b, floorSide, hole });
      }
    }
  }
  return out;
}

function checkGuards(ctx: BuildCtx, res: BuildResult): Check {
  const meshes = sceneMeshes(res);
  const rc = new THREE.Raycaster();
  const spots: Check["spots"] = [];
  let samples = 0, bad = 0;
  for (const e of edgesToGuard(ctx)) {
    for (let u = e.a + 0.25; u < e.b - 0.1; u += 0.5) {
      const near = e.c - e.floorSide * 0.6;
      const [nx, ny] = e.axis === "x" ? [u, near] : [near, u];
      if (!standable(ctx, e.level, nx, ny)) continue;
      samples++;
      const back = e.c - e.floorSide * 2.0; // start 2 ft back on the floor
      let ok = false;
      for (const h of [1.0, 3.45]) {
        const [x, y] = e.axis === "x" ? [u, back] : [back, u];
        const dir = e.axis === "x" ? new THREE.Vector3(0, 0, -e.floorSide) : new THREE.Vector3(e.floorSide, 0, 0);
        rc.set(new THREE.Vector3(x * FT, (e.elev + h) * FT, -y * FT), dir);
        rc.far = 2.6 * FT;
        const hits = rc.intersectObjects(meshes, false);
        if (hits.some((hit) => GUARD_KIND.test(resolveHit(hit.object, hit.faceIndex).kind ?? ""))) {
          ok = true;
          break;
        }
      }
      if (!ok) {
        bad++;
        const [x, y] = e.axis === "x" ? [u, e.c] : [e.c, u];
        if (spots.length < 30) spots.push({ level: e.level, x: +x.toFixed(1), y: +y.toFixed(1), note: e.hole ? "stairwell edge" : "slab edge" });
      }
    }
  }
  return {
    id: "guards",
    title: "Guards at every drop",
    status: bad ? "fail" : "pass",
    detail: bad ? `${bad} of ${samples} edge samples have no wall, railing or parapet` : `${samples} edge samples on stairwells, terraces and roofs: all guarded`,
    spots,
  };
}

function checkFalls(ctx: BuildCtx, col: THREE.Mesh): Check {
  // push a walker at every stairwell edge (outside the arrival opening): it must be stopped, not fall
  const edges = edgesToGuard(ctx).filter((e) => e.hole && e.b - e.a > 0.6);
  const spots: Check["spots"] = [];
  let falls = 0;
  for (const e of edges) {
    const mid = (e.a + e.b) / 2;
    const back = [2.6, 1.6, 1.1].find((b) => {
      const v = e.c - e.floorSide * b;
      const [x, y] = e.axis === "x" ? [mid, v] : [v, mid];
      return standable(ctx, e.level, x, y);
    });
    if (back === undefined) continue;
    const s = e.c - e.floorSide * back, t = e.c + e.floorSide * 2.5;
    const [sx, sy] = e.axis === "x" ? [mid, s] : [s, mid];
    const [tx, ty] = e.axis === "x" ? [mid, t] : [t, mid];
    const start = new THREE.Vector3(sx * FT, e.elev * FT + 0.05, -sy * FT);
    const r = walk(col, start, [new THREE.Vector3(tx * FT, e.elev * FT, -ty * FT)], 4);
    const drop = e.elev - r.feet.y / FT;
    if (drop > 1.0) {
      falls++;
      const [px, py] = e.axis === "x" ? [mid, e.c] : [e.c, mid];
      spots.push({ level: e.level, x: +px.toFixed(1), y: +py.toFixed(1), note: `fell ${drop.toFixed(1)} ft` });
    }
  }
  return { id: "falls", title: "Walker stopped at stairwells", status: falls ? "fail" : "pass", detail: falls ? `${falls} of ${edges.length} pushes fell through` : `${edges.length} pushes toward stairwell edges: none fell`, spots };
}

// ── 2. stair to the roof, door at the top landing ──────────────────────────────────────────────────────────
function checkRoof(ctx: BuildCtx, res: BuildResult, col: THREE.Mesh): Check {
  const plan = ctx.plan;
  const chain = [...plan.storeys, plan.roof];
  const missing: string[] = [];
  for (let k = 0; k + 1 < chain.length; k++) if (!ctx.model.stairs.some((l) => l.stair.from === chain[k] && l.stair.to.elev >= chain[k + 1].elev - 0.01)) missing.push(`${chain[k].name} → ${chain[k + 1].name}`);
  if (!ctx.model.stairs.length) return { id: "roof", title: "Stair reaches the roof door", status: chain.length > 2 ? "fail" : "warn", detail: "no stairs in the plan" };
  const tw = ctx.model.tower;
  const door = tw ? ctx.model.openings.find((o) => o.op.level === tw.room.level && o.isDoor && (o.run.neg === tw.room || o.run.pos === tw.room)) : null;
  if (missing.length || !door || !tw) return { id: "roof", title: "Stair reaches the roof door", status: "fail", detail: missing.length ? `no stair ${missing.join(", ")}` : "no roof door" };
  const top = ctx.model.stairs.find((l) => l.holeLevel === plan.roof.id)!;
  const sill = door.bottom - (plan.roof.elev - 0.04);
  const into = door.run.neg === tw.room ? -1 : 1;
  const u = (door.u0 + door.u1) / 2;
  const pIn = door.run.c + into * 1.6, pOut = door.run.c - into * 3.0;
  const inside: [number, number] = door.run.axis === "x" ? [u, pIn] : [pIn, u];
  const outside: [number, number] = door.run.axis === "x" ? [u, pOut] : [pOut, u];
  const onLanding = rectContains(top.landing, inside[0], inside[1], 0.4);
  // walk it: from the foot of the lowest stair, up every flight, onto the top landing, out of the door
  const lays = [...ctx.model.stairs].sort((a, b) => a.stair.from.elev - b.stair.from.elev);
  const foot = lays[0].foot;
  // start in the middle of the foot landing, at least a body width (1.1 ft) from its wall
  const f0 = lays[0].flights[0];
  const back = Math.max(lays[0].strip / 2, Math.min(lays[0].strip, 1.1));
  const fa = f0.s0 - f0.sign * back;
  const fcm = (foot.x + foot.w / 2), fcy = (foot.y + foot.d / 2);
  const [sx0, sy0] = f0.axis === "x" ? [fa, fcy] : [fcm, fa];
  const start = new THREE.Vector3(sx0 * FT, f0.h0 * FT + 0.05, -sy0 * FT);
  const wps: THREE.Vector3[] = [];
  for (const l of lays)
    l.flights.forEach((f, fi) => {
      const sEnd = f.s0 + f.sign * (f.n - 1) * f.tread;
      const cm = (f.c0 + f.c1) / 2;
      const P = (a: number, h: number) => (f.axis === "x" ? new THREE.Vector3(a * FT, h * FT, -cm * FT) : new THREE.Vector3(cm * FT, h * FT, -a * FT));
      if (fi === 0) {
        // line up in front of the first riser (as far back as the foot strip lets a body stand), then step on
        const back = Math.min(0.6, Math.max(0.05, l.strip - 1.05));
        if (wps.length) wps.push(P(f.s0 - f.sign * back, f.h0));
        wps.push(P(f.s0 + f.sign * 0.4 * f.tread, f.h0 + f.riser));
      } else wps.push(P(f.s0 - f.sign * 0.6, f.h0));
      wps.push(P(sEnd + f.sign * 0.9, f.h0 + f.n * f.riser));
    });
  wps.push(new THREE.Vector3(inside[0] * FT, plan.roof.elev * FT, -inside[1] * FT), new THREE.Vector3(outside[0] * FT, plan.roof.elev * FT, -outside[1] * FT));
  const r = walk(col, start, wps, 120);
  const feetFt = r.feet.y / FT;
  const out = Math.hypot(r.feet.x / FT - outside[0], -r.feet.z / FT - outside[1]) < 1.5 && Math.abs(feetFt - plan.roof.elev) < 0.6;
  const okDoor = Math.abs(sill) < 0.15 && onLanding;
  void res;
  return {
    id: "roof",
    title: "Stair reaches the roof door",
    status: okDoor && out ? "pass" : "fail",
    detail: `door on the ${tw.side} wall, sill ${sill >= 0 ? "+" : ""}${sill.toFixed(2)} ft, ${onLanding ? "on" : "NOT on"} the top landing (${Math.min(top.landing.w, top.landing.d).toFixed(1)} ft deep); walker ${out ? "climbed from the ground floor out onto the roof" : `stopped at ${feetFt.toFixed(1)} ft (${r.reached}/${wps.length} waypoints)`}`,
    spots: out ? [] : [{ level: plan.roof.id, x: +(r.feet.x / FT).toFixed(1), y: +(-r.feet.z / FT).toFixed(1), note: r.log.slice(-1)[0] ?? "" }],
  };
}

// ── 3. furniture vs doors, stairs, openings ────────────────────────────────────────────────────────────────
function checkFurniture(ctx: BuildCtx): Check[] {
  const ov = (a: { x0: number; x1: number; y0: number; y1: number }, b: { x0: number; x1: number; y0: number; y1: number }, t = 0.05) => a.x0 < b.x1 - t && b.x0 < a.x1 - t && a.y0 < b.y1 - t && b.y0 < a.y1 - t;
  const hard: string[] = [], soft: string[] = [];
  const spots: Check["spots"] = [];
  for (const it of ctx.items) {
    if (it.cls !== "floor") continue;
    const room = ctx.plan.room(it.room);
    if (!room) continue;
    for (const z of keepOut(ctx, room)) {
      if (z.kind === "window" || z.kind === "tank" || z.kind === "solar") continue;
      if (ov(it, z.core ?? z)) {
        hard.push(`${it.id} in ${z.kind} ${z.id ?? ""}`.trim());
        spots.push({ level: room.level, x: +((it.x0 + it.x1) / 2).toFixed(1), y: +((it.y0 + it.y1) / 2).toFixed(1), note: `${it.type} in ${z.kind}` });
      } else if (z.kind === "door" && ov(it, z)) soft.push(`${it.id} near ${z.id}`);
    }
  }
  // EN-02: every door, arch and sliding door keeps its opening width × 3 ft clear on each side, plus the leaf sweep
  const clear: string[] = [];
  const clearSpots: Check["spots"] = [];
  let doors = 0;
  for (const o of ctx.model.openings) {
    if (!o.isDoor) continue;
    doors++;
    for (const into of [-1, 1] as const) {
      const z = doorClearance(o, into);
      for (const it of ctx.items) {
        if (it.cls !== "floor" && it.cls !== "top") continue;
        const room = ctx.plan.room(it.room);
        if (!room || room.level !== o.op.level) continue;
        if (!intrudes(it, z)) continue;
        clear.push(`${it.id} in front of ${o.op.id}`);
        clearSpots.push({ level: room.level, x: +((it.x0 + it.x1) / 2).toFixed(1), y: +((it.y0 + it.y1) / 2).toFixed(1), note: `${it.type} in ${o.op.id}'s clear zone` });
      }
    }
  }
  const wallBad: string[] = [];
  for (const it of ctx.items) {
    if (it.cls !== "wall" || it.type === "curtains" || !it.against) continue;
    const room = ctx.plan.room(it.room)!;
    const side = it.against as "front" | "back" | "left" | "right";
    const [a, b] = side === "front" || side === "back" ? [it.x0, it.x1] : [it.y0, it.y1];
    const ints = solidIntervals(ctx, room, side);
    if (!ints.some(([p, q]) => a >= p - 0.35 && b <= q + 0.35)) wallBad.push(`${it.id} (${it.type})`);
  }
  return [
    {
      id: "furniture_doors",
      title: "No furniture in doorways or on stairs",
      status: hard.length ? "fail" : soft.length ? "warn" : "pass",
      detail: hard.length ? `${hard.length} items block a door swing, doorway or stair: ${hard.slice(0, 6).join("; ")}` : soft.length ? `door leaves and stairs clear; ${soft.length} items inside the full 3 ft door clearance (${soft.slice(0, 4).join("; ")})` : `${ctx.items.filter((i) => i.cls === "floor").length} floor items, all clear of door clearances and stairs`,
      spots,
    },
    {
      id: "door_clear",
      title: "Doorways keep 3 ft clear on each side",
      status: clear.length ? "fail" : "pass",
      detail: clear.length ? `${clear.length} intrusions into a door's 3 ft clear zone or leaf sweep: ${clear.slice(0, 8).join("; ")}` : `${doors} doors, arches and sliding doors: no furniture, counter or fixture in their clear zones`,
      spots: clearSpots,
    },
    {
      id: "furniture_walls",
      title: "No TV, art, mirror or AC over a door or window",
      status: wallBad.length ? "fail" : "pass",
      detail: wallBad.length ? `${wallBad.length} wall items over an opening: ${wallBad.slice(0, 6).join("; ")}` : `${ctx.items.filter((i) => i.cls === "wall" && i.type !== "curtains").length} wall items, all on solid wall`,
    },
  ];
}

// ── 4. walkway and spawn ───────────────────────────────────────────────────────────────────────────────────
function checkWalkway(ctx: BuildCtx, res: BuildResult): Check {
  const P = parking(ctx);
  if (!P.door || !P.approach) return { id: "walkway", title: "Gate-to-door walkway clear", status: "warn", detail: "no main door found" };
  const cars = ctx.items.filter((it) => it.type.startsWith("car_") || it.type === "motorbike");
  const onPath = cars.filter((c) => onWalkwayRect(P, c));
  const last = P.path[P.path.length - 1];
  const reaches = !!last && Math.hypot(last[0] - P.approach[0], last[1] - P.approach[1]) < 1;
  const sx = res.spawn.position.x / FT, sy = -res.spawn.position.z / FT;
  const onWalk = P.onWalkway(sx, sy);
  const [dx, dy] = P.approach;
  const blocks = ctx.items.filter((it) => it.cls === "floor" && it.h1 - it.h0 > 2.5 && ITEMS[it.type as keyof typeof ITEMS]?.collide && ctx.plan.room(it.room)?.cat !== "enclosed").filter((it) => segBox(sx, sy, dx, dy, it));
  const ok = reaches && !onPath.length && onWalk && !blocks.length;
  return {
    id: "walkway",
    title: "Gate-to-door walkway clear",
    status: ok ? "pass" : "fail",
    detail: `${P.bays.filter((b) => b.used).length} car(s) in ${P.bays.length} bay(s); walkway ${reaches ? `${pathLen(P.path).toFixed(0)} ft from the gate to the main door` : "does not reach the door"}${onPath.length ? `, BLOCKED by ${onPath.map((c) => c.type).join(", ")}` : ", clear"}; walk starts ${onWalk ? "on it" : "off it"} at (${sx.toFixed(1)}, ${sy.toFixed(1)})${blocks.length ? `, view blocked by ${blocks.map((b) => b.type).join(", ")}` : " with the door in view"}`,
  };
}

const pathLen = (p: [number, number][]) => p.slice(1).reduce((s, q, k) => s + Math.hypot(q[0] - p[k][0], q[1] - p[k][1]), 0);
function segBox(x0: number, y0: number, x1: number, y1: number, b: { x0: number; x1: number; y0: number; y1: number }): boolean {
  for (let k = 0; k <= 40; k++) {
    const x = x0 + ((x1 - x0) * k) / 40, y = y0 + ((y1 - y0) * k) / 40;
    if (x > b.x0 && x < b.x1 && y > b.y0 && y < b.y1) return true;
  }
  return false;
}

// ── 5. walking paths ───────────────────────────────────────────────────────────────────────────────────────
function checkPaths(ctx: BuildCtx): Check {
  const rep = pathReport(ctx);
  const bad = rep.filter((r) => r.unreached.length);
  const split = rep.filter((r) => r.planSplit);
  return {
    id: "paths",
    title: "3 ft paths between doors and stairs",
    status: bad.length ? "warn" : "pass",
    detail:
      (bad.length ? `${bad.length} of ${rep.length} room groups have a door or landing furniture leaves under 3 ft: ${bad.slice(0, 5).map((b) => `${b.rooms.join("+")} → ${b.unreached.join(", ")}`).join("; ")}` : `${rep.length} room groups: furniture leaves a 3 ft path to every door and stair landing`) +
      (split.length ? `. Plan: ${split.map((b) => b.rooms.join("+")).join("; ")} are open-plan on paper but walls part them (no shared edge)` : ""),
  };
}

// ── 6. openings ────────────────────────────────────────────────────────────────────────────────────────────
function checkOpenings(ctx: BuildCtx): Check {
  const wrong: string[] = [];
  for (const o of ctx.model.openings) {
    const ids = [o.run.neg?.id, o.run.pos?.id];
    const named = o.op.between.filter((b) => b && b !== "exterior" && ctx.plan.room(b));
    if (!named.every((id) => ids.includes(id))) wrong.push(o.op.id);
    if (o.op.between.includes("exterior") && o.run.out === 0) wrong.push(o.op.id);
  }
  const skipped = ctx.model.notes.list.filter((n) => n.id.startsWith("asbuilt.opening_skipped"));
  return {
    id: "openings",
    title: "Openings only in the right wall",
    status: wrong.length ? "fail" : skipped.length ? "warn" : "pass",
    detail: `${ctx.model.openings.length} openings built, ${wrong.length ? `${wrong.length} in the wrong wall (${wrong.join(", ")})` : "each between the rooms it names"}${skipped.length ? `; ${skipped.length} not built: ${skipped.map((n) => n.element_ids?.[0]).join(", ")}` : ""}`,
  };
}

// ── 7. stairs at code, tower covers the stair ──────────────────────────────────────────────────────────────
function checkStairs(ctx: BuildCtx): Check {
  const notes = ctx.model.notes.list.filter((n) => n.id.startsWith("asbuilt.stair_fit"));
  const roof = ctx.plan.roof.id;
  const tw = ctx.model.tower;
  const uncovered = ctx.model.stairs.filter((l) => l.holeLevel === roof).flatMap((l) => l.holes).filter((h) => !tw || !(h.x >= tw.room.rect.x + 0.3 && h.y >= tw.room.rect.y + 0.3 && h.x + h.w <= tw.room.rect.x + tw.room.rect.w - 0.3 && h.y + h.d <= tw.room.rect.y + tw.room.rect.d - 0.3));
  const treads = ctx.model.stairs.flatMap((l) => l.flights.map((f) => f.tread * 12));
  const minT = treads.length ? Math.min(...treads) : 0;
  const strips = ctx.model.stairs.map((l) => l.strip);
  const status = uncovered.length || notes.some((n) => n.status === "fail") ? "fail" : notes.length ? "warn" : "pass";
  return {
    id: "stairs",
    title: "Stairs at code, tower over the top flight",
    status,
    detail: `${ctx.model.stairs.length} stairs, treads ≥ ${minT.toFixed(1)} in, foot strip ≥ ${(strips.length ? Math.min(...strips) : 0).toFixed(1)} ft; ${uncovered.length ? "the roof stairwell is NOT inside the tower" : "the tower covers the top flight and its landing"}${notes.length ? `; ${notes.map((n) => n.message).join(" ")}` : ""}`,
  };
}

// ── 8. headroom under the stairs ───────────────────────────────────────────────────────────────────────────
/**
 * EN2-01: on every 0.25 ft cell of a stair's footprint on its lower floor where a walker fits (a 0.56 m wide column
 * from step height to a 1.78 m head is free of walk colliders), the clear height to the stair's own soffit or landing
 * above must be at least 6′8″. Reports the lowest headroom over a walkable cell for each stair.
 */
function checkHeadroom(ctx: BuildCtx, res: BuildResult, col: THREE.Mesh): Check {
  const meshes = sceneMeshes(res);
  const bvh = (col.geometry as unknown as { boundsTree: MeshBVH }).boundsTree;
  const rc = new THREE.Raycaster();
  const box = new THREE.Box3();
  const I = new THREE.Matrix4();
  const spots: Check["spots"] = [];
  const per: string[] = [];
  let bad = 0, cells = 0;
  for (const lay of ctx.model.stairs) {
    const lv = lay.stair.from.id;
    const r = lay.rect;
    let min = Infinity;
    let at: [number, number] | null = null;
    for (let x = r.x + 0.125; x < r.x + r.w; x += 0.25)
      for (let y = r.y + 0.125; y < r.y + r.d; y += 0.25) {
        if (!standable(ctx, lv, x, y)) continue;
        const F = ctx.plan.roomAt(lv, x, y)!.floorH;
        box.min.set(x * FT - 0.28, F * FT + 0.12, -y * FT - 0.28);
        box.max.set(x * FT + 0.28, F * FT + 1.78, -y * FT + 0.28);
        if (bvh.intersectsBox(box, I)) continue;
        rc.set(new THREE.Vector3(x * FT, (F + 0.3) * FT, -y * FT), new THREE.Vector3(0, 1, 0));
        rc.far = 14 * FT;
        const hit = rc.intersectObjects(meshes, false).find((h) => resolveHit(h.object, h.faceIndex).kind === "stair");
        if (!hit) continue;
        cells++;
        const head = hit.point.y / FT - F;
        if (head < min) {
          min = head;
          at = [x, y];
        }
        if (head < HEADROOM - 0.02) {
          bad++;
          if (spots.length < 30) spots.push({ level: lv, x: +x.toFixed(2), y: +y.toFixed(2), note: `${head.toFixed(2)} ft headroom` });
        }
      }
    if (Number.isFinite(min) && at) per.push(`${lay.stair.from.name} → ${lay.stair.to.name}: ${min.toFixed(2)} ft at (${at[0].toFixed(1)}, ${at[1].toFixed(1)})`);
    else per.push(`${lay.stair.from.name} → ${lay.stair.to.name}: no walkable cell under it`);
  }
  return {
    id: "headroom",
    title: "6′8″ headroom under every stair",
    status: bad ? "fail" : "pass",
    detail: `${bad ? `${bad} walkable cells under a stair have less than 6′8″` : `${cells} walkable cells under the stairs, all with 6′8″ or more`}; lowest per stair: ${per.join("; ")}`,
    spots,
  };
}

// ── 9. curtains on glazing, nothing tall across a window ────────────────────────────────────────────────────
function checkWindows(ctx: BuildCtx): Check {
  const bad: string[] = [];
  const spots: Check["spots"] = [];
  let pairs = 0, tall = 0;
  for (const it of ctx.items) {
    const room = ctx.plan.room(it.room);
    if (!room) continue;
    if (it.type === "curtains") {
      pairs++;
      const side = it.against as "front" | "back" | "left" | "right" | undefined;
      const mid = side === "front" || side === "back" ? (it.x0 + it.x1) / 2 : (it.y0 + it.y1) / 2;
      const glaze = side ? ctx.model.roomWalls(room, side).flatMap((wl) => wl.run.openings.filter((o) => !o.isDoor || o.op.type === "sliding_door")) : [];
      const onGlass = glaze.some((o) => Math.abs((o.u0 + o.u1) / 2 - mid) < 0.35);
      const onDoor = side ? ctx.model.roomWalls(room, side).some((wl) => wl.run.openings.some((o) => o.isDoor && o.op.type !== "sliding_door" && mid > o.u0 - 0.3 && mid < o.u1 + 0.3)) : false;
      if (!onGlass || onDoor) {
        bad.push(`curtains in ${room.name} ${onDoor ? "over a door" : "not centred on a window"}`);
        spots.push({ level: room.level, x: +((it.x0 + it.x1) / 2).toFixed(1), y: +((it.y0 + it.y1) / 2).toFixed(1), note: "curtains off the glazing" });
      }
      continue;
    }
    if (it.cls !== "floor" || !HABITABLE.has(room.type) || !isTall(it.type, it.h1 - it.h0)) continue;
    for (const z of keepOut(ctx, room)) {
      if (!blocksWindow(it.type, it.h1 - it.h0, z) || z.op === "ventilator") continue;
      if (it.x0 < z.x1 - 0.05 && z.x0 < it.x1 - 0.05 && it.y0 < z.y1 - 0.05 && z.y0 < it.y1 - 0.05) {
        tall++;
        bad.push(`${it.type} across ${z.id} in ${room.name}`);
        spots.push({ level: room.level, x: +((it.x0 + it.x1) / 2).toFixed(1), y: +((it.y0 + it.y1) / 2).toFixed(1), note: `${it.type} in front of a window` });
      }
    }
  }
  return {
    id: "windows",
    title: "Curtains on glazing, windows kept clear",
    status: bad.length ? "fail" : "pass",
    detail: bad.length ? `${bad.length} problems: ${bad.slice(0, 8).join("; ")}` : `${pairs} curtain pairs, each centred on a window or sliding door; no tall piece in front of a window (${tall} found)`,
    spots,
  };
}
