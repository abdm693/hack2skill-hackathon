/** Porch columns, balcony/terrace railings and the rooftop water tank. */
import * as THREE from "three";
import { Kit, lathe, mat4 } from "../core/shapes";
import { FT, clamp } from "../core/util";
import type { BuildCtx } from "../core/ctx";
import { railing, type RailMats, type RailType } from "./railings";

export function buildPorchColumns(ctx: BuildCtx, mat: THREE.Material): void {
  const model = ctx.model;
  const plan = ctx.plan;
  const byLevel = new Map<string, typeof model.edges>();
  for (const e of model.edges) if (e.kind === "porch") byLevel.set(e.level.id, [...(byLevel.get(e.level.id) ?? []), e]);
  for (const [lvId, edges] of byLevel) {
    const runs = model.runsByLevel.get(lvId) ?? [];
    const lv = plan.levelById.get(lvId)!;
    const nodes = new Map<string, { x: number; y: number; sx: number; sy: number; room: string; floor: number }>();
    const addNode = (x: number, y: number, sx: number, sy: number, room: string, floor: number) => {
      // skip nodes where a wall already stands
      for (const r of runs) {
        const along = r.axis === "x" ? x : y, across = r.axis === "x" ? y : x;
        if (Math.abs(across - r.c) < 0.45 && along >= r.a - 0.45 && along <= r.b + 0.45) return;
      }
      const k = `${x.toFixed(2)},${y.toFixed(2)}`;
      const cur = nodes.get(k);
      if (cur) {
        cur.sx = cur.sx || sx;
        cur.sy = cur.sy || sy;
      } else nodes.set(k, { x, y, sx, sy, room, floor });
    };
    for (const e of edges) {
      const out = e.out;
      const ends = [e.a, e.b];
      const len = e.b - e.a;
      // intermediate columns only on long edges that do not face the driveway/road
      const outsideRoom = ctx.plan.roomAt(lvId, e.axis === "x" ? (e.a + e.b) / 2 : e.c + out * 0.5, e.axis === "x" ? e.c + out * 0.5 : (e.a + e.b) / 2);
      const faceDrive = !outsideRoom || outsideRoom.type === "driveway" || (e.axis === "x" && out < 0);
      if (len > 20 && !faceDrive) {
        const n = Math.ceil(len / 16);
        for (let k = 1; k < n; k++) ends.push(e.a + (len * k) / n);
      }
      for (const u of ends) {
        const x = e.axis === "x" ? u : e.c, y = e.axis === "x" ? e.c : u;
        addNode(x, y, e.axis === "y" ? out : 0, e.axis === "x" ? out : 0, e.room.id, e.room.floorH);
      }
    }
    const kit = new Kit();
    const size = 1.0;
    const top = lv.next - lv.slab;
    for (const n of nodes.values()) {
      // keep the outer faces flush with the slab edge (0.375 ft outside the room edge)
      const room = plan.room(n.room)!;
      const r = room.rect;
      const cx = clamp(n.x + (n.sx ? -n.sx * (size / 2 - 0.375) : 0), r.x - 0.375 + size / 2, r.x + r.w + 0.375 - size / 2);
      const cy = clamp(n.y + (n.sy ? -n.sy * (size / 2 - 0.375) : 0), r.y - 0.375 + size / 2, r.y + r.d + 0.375 - size / 2);
      const h0 = n.floor - 0.05;
      kit.rbox(mat, cx * FT, ((h0 + top) / 2) * FT, cy * FT, size * FT, (top - h0) * FT, size * FT, 0.012, 1);
    }
    if (!kit.empty) {
      const g = kit.build();
      ctx.add(g, { kind: "column", level: lvId, id: `porch_columns_${lvId}`, label: "Porch columns" });
      g.traverse((o) => (o as THREE.Mesh).isMesh && ctx.collider(o as THREE.Mesh));
    }
  }
}

export function buildDeckRailings(ctx: BuildCtx, type: RailType, m: RailMats): void {
  const byLevel = new Map<string, { kit: Kit; glass: Kit }>();
  for (const e of ctx.model.edges) {
    if (e.kind !== "deck") continue;
    let k = byLevel.get(e.level.id);
    if (!k) byLevel.set(e.level.id, (k = { kit: new Kit(), glass: new Kit() }));
    const c = e.c + e.out * 0.2;
    const a = e.a - 0.2, b = e.b + 0.2;
    const [x0, y0, x1, y1] = e.axis === "x" ? [a, c, b, c] : [c, a, c, b];
    railing(k.kit, k.glass, type, x0, y0, e.room.floorH, x1, y1, e.room.floorH, 3.5, m);
  }
  for (const [lv, k] of byLevel) {
    if (!k.kit.empty) {
      const g = k.kit.build();
      ctx.add(g, { kind: "railing", id: `deck_railings_${lv}`, label: "Balcony & terrace railings", level: lv });
      g.traverse((o) => (o as THREE.Mesh).isMesh && ctx.collider(o as THREE.Mesh));
    }
    if (!k.glass.empty) {
      const gg = k.glass.build(new THREE.Group(), false);
      ctx.add(gg, { kind: "railing:glass", id: `deck_railings_glass_${lv}`, label: "Glass balustrade", level: lv });
      gg.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          (o as THREE.Mesh).renderOrder = 2;
          ctx.collider(o as THREE.Mesh);
        }
      });
    }
  }
}

export function buildWaterTank(ctx: BuildCtx, mats: { plastic: THREE.Material; concrete: THREE.Material; pipe: THREE.Material }): void {
  const plan = ctx.plan;
  const wt = plan.plan.roof?.water_tank;
  if (!wt?.rect) return;
  const r = wt.rect;
  const x = clamp(Number(r.x) || 0, 0, plan.plotW), y = clamp(Number(r.y) || 0, 0, plan.plotD);
  const w = clamp(Number(r.w) || 5, 2, 12), d = clamp(Number(r.d) || 5, 2, 12);
  const H = clamp(Number(wt.height_ft) || 5, 2, 10);
  const cx = x + w / 2, cy = y + d / 2;
  // on the mumty if it overlaps it, else on the roof
  const mumty = plan.rooms.find((m) => m.lv.isRoof && m.cat === "enclosed" && cx > m.rect.x && cx < m.rect.x + m.rect.w && cy > m.rect.y && cy < m.rect.y + m.rect.d);
  const base = mumty ? mumty.lv.elev + plan.mumtyHeight : plan.roof.elev;
  const kit = new Kit();
  const pad = 0.6;
  kit.rbox(mats.concrete, cx * FT, (base + pad / 2) * FT, cy * FT, (w - 0.2) * FT, pad * FT, (d - 0.2) * FT, 0.02, 1);
  const R = (Math.min(w, d) / 2 - 0.25) * FT;
  const h = H * FT;
  // ribbed tank profile (lathe)
  const pts: [number, number][] = [[0, 0], [R * 0.92, 0], [R, 0.04]];
  const ribs = Math.max(4, Math.round(H / 0.55));
  for (let k = 0; k <= ribs; k++) {
    const yy = 0.06 + ((h * 0.86 - 0.06) * k) / ribs;
    pts.push([R * (k % 2 ? 0.965 : 1), yy]);
  }
  pts.push([R * 0.96, h * 0.9], [R * 0.75, h * 0.97], [R * 0.3, h], [0, h]);
  const key = `tank|${R.toFixed(3)}|${h.toFixed(3)}`;
  kit.geo(mats.plastic, lathe(key, pts, 40), mat4(cx * FT, (base + pad) * FT, cy * FT));
  kit.cyl(mats.plastic, cx * FT, (base + pad) * FT + h + 0.03, cy * FT, R * 0.32, 0.07, 28);
  // pipes down to the roof
  kit.cyl(mats.pipe, (cx + Math.min(w, d) / 2 - 0.4) * FT, (base + pad) * FT + 0.12, cy * FT, 0.035, 0.24, 10, 0, 0, Math.PI / 2);
  const g = kit.build();
  ctx.add(g, { kind: "water_tank", level: plan.roof.id, id: "water_tank", label: "Overhead water tank" });
}
