/** Landscape: lawns (with instanced grass tufts), paving, planters, trees, hedges and the street context. */
import * as THREE from "three";
import type { MaterialSpec } from "@contracts/house-sdk";
import type { Pt, Rect } from "@contracts/plan";
import type { BuildCtx } from "./core/ctx";
import { CellGrid, rectIntersect, type R } from "./core/grid";
import { MeshBuilder } from "./core/meshbuilder";
import { Kit, lathe, mat4, unitCyl } from "./core/shapes";
import { FT, clamp, hashStr, num, rng, warn } from "./core/util";
import { makeCanvas } from "./materials/gen";

type TreeKind = "palm" | "ashoka" | "neem" | "ornamental" | "bush";

function normRect(r: Partial<Rect> | undefined): Rect | null {
  if (!r) return null;
  let x = num(r.x, NaN), y = num(r.y, NaN), w = num(r.w, NaN), d = num(r.d, NaN);
  if (![x, y, w, d].every(Number.isFinite)) return null;
  if (w < 0) { x += w; w = -w; }
  if (d < 0) { y += d; d = -d; }
  if (w < 0.2 || d < 0.2) return null;
  return { x: clamp(x, -300, 600), y: clamp(y, -300, 800), w: Math.min(w, 400), d: Math.min(d, 400) };
}

export function landscapeAPI(ctx: BuildCtx) {
  const M = ctx.mats;
  const plan = ctx.plan;
  const FOOTPATH = 6;

  /** surface height (ft) at a plan point: registered ground surfaces, else plot grade / footpath / road. */
  const groundAt = (x: number, y: number): number => {
    let h = -1;
    for (const g of ctx.ground) if (x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.d) h = Math.max(h, g.h);
    if (h >= 0) return h;
    if (x >= 0 && x <= plan.plotW && y >= 0 && y <= plan.plotD) {
      const r = plan.roomAt(plan.levels[0].id, x, y);
      if (r && r.cat !== "outdoor") return r.floorH;
      return plan.grade;
    }
    if (y < 0 && y >= -FOOTPATH) return plan.grade;
    if (y < -FOOTPATH) return 0;
    return plan.grade;
  };
  const tag = (kind: string, label: string) => ({ kind: `landscape:${kind}`, label, level: plan.levels[0].id });
  const context = (o: THREE.Object3D) => {
    o.userData.mergeGroup = "context";
    return o;
  };
  /** street context (road, footpaths, poles, neighbours): kind "context" so viewers can ghost or hide it */
  const ctag = (label: string) => ({ kind: "context", label, level: plan.levels[0].id });

  function surface(rect: Rect, mat: THREE.Material, kind: string, label: string, lift: number): number {
    // skip if a site surface already covers ≥ 90% of this rect with the same material
    const same = ctx.ground.find((g) => (g.obj as THREE.Mesh).material === mat && overlapFrac(g, rect) > 0.9);
    const base = Math.max(...[plan.grade, ...ctx.ground.filter((g) => rectIntersect(g, rect)).map((g) => g.h)]);
    if (same) return same.h;
    const h = (rect.y < 0 && rect.y + rect.d <= 0 ? plan.grade : base) + lift;
    const mb = new MeshBuilder();
    mb.faceY(h * FT, rect.x * FT, (rect.x + rect.w) * FT, rect.y * FT, (rect.y + rect.d) * FT, 1);
    const mesh = new THREE.Mesh(mb.build()!, mat);
    mesh.receiveShadow = true;
    ctx.add(mesh, tag(kind, label));
    ctx.collider(mesh);
    ctx.ground.push({ ...rect, h, obj: mesh, kind: "landscape" });
    return h;
  }

  function lawn(r: Rect): void {
    const rect = normRect(r);
    if (!rect) return warn("landscape.lawn: invalid rect");
    const h = surface(rect, M.get("grass"), "lawn", "Lawn", 0.03);
    grassTufts(ctx, rect, h);
    // slim steel edging around the lawn
    const kit = new Kit();
    const edge = M.get("metal_black");
    const e = 0.06, t = 0.12;
    kit.box(edge, (rect.x + rect.w / 2) * FT, (h + t / 4) * FT, rect.y * FT, rect.w * FT, (t / 2) * FT, e * FT);
    kit.box(edge, (rect.x + rect.w / 2) * FT, (h + t / 4) * FT, (rect.y + rect.d) * FT, rect.w * FT, (t / 2) * FT, e * FT);
    kit.box(edge, rect.x * FT, (h + t / 4) * FT, (rect.y + rect.d / 2) * FT, e * FT, (t / 2) * FT, rect.d * FT);
    kit.box(edge, (rect.x + rect.w) * FT, (h + t / 4) * FT, (rect.y + rect.d / 2) * FT, e * FT, (t / 2) * FT, rect.d * FT);
    ctx.add(kit.build(), tag("lawn_edge", "Lawn edging"));
  }

  function paving(r: Rect, material?: MaterialSpec): void {
    const rect = normRect(r);
    if (!rect) return warn("landscape.paving: invalid rect");
    surface(rect, M.get(material, "paving"), "paving", "Paving", 0.035);
  }

  function planter(r: Rect, o?: { height_ft?: number; material?: MaterialSpec }): void {
    const rect = normRect(r);
    if (!rect) return warn("landscape.planter: invalid rect");
    const H = clamp(num(o?.height_ft, 1.5), 0.3, 6);
    const base = groundAt(rect.x + rect.w / 2, rect.y + rect.d / 2);
    const mat = M.get(o?.material, "plaster_grey");
    const kit = new Kit();
    const t = Math.min(0.33, rect.w / 4, rect.d / 4);
    const x0 = rect.x, x1 = rect.x + rect.w, y0 = rect.y, y1 = rect.y + rect.d;
    const b = (ax: number, bx: number, ay: number, by: number) => kit.mb(mat).box(ax * FT, (base - 0.2) * FT, ay * FT, bx * FT, (base + H) * FT, by * FT);
    b(x0, x1, y0, y0 + t);
    b(x0, x1, y1 - t, y1);
    b(x0, x0 + t, y0 + t, y1 - t);
    b(x1 - t, x1, y0 + t, y1 - t);
    kit.mb(M.get("concrete")).box((x0 - 0.04) * FT, (base + H) * FT, (y0 - 0.04) * FT, (x1 + 0.04) * FT, (base + H + 0.08) * FT, (y0 + t + 0.02) * FT);
    kit.mb(M.get({ preset: "soil", color: "#3f3027" })).box((x0 + t) * FT, base * FT, (y0 + t) * FT, (x1 - t) * FT, (base + H - 0.18) * FT, (y1 - t) * FT);
    ctx.add(kit.build(), tag("planter", "Planter"));
    // shrubs inside
    const n = Math.max(1, Math.round(rect.w / 2.2));
    for (let i = 0; i < n; i++) {
      const px = x0 + (rect.w * (i + 0.5)) / n, py = (y0 + y1) / 2;
      plantTree(ctx, px, py, base + H - 0.18, i % 3 === 1 ? "ornamental" : "bush", i % 3 === 1 ? 3.2 : 2.2, `planter${i}`);
    }
  }

  function tree(at: Pt, o?: { kind?: TreeKind; height_ft?: number }): void {
    const p = Array.isArray(at) ? at : [0, 0];
    const x = num(p[0], 0), y = num(p[1], 0);
    const kinds: TreeKind[] = ["palm", "ashoka", "neem", "ornamental", "bush"];
    const kind: TreeKind = kinds.includes(o?.kind as TreeKind) ? (o!.kind as TreeKind) : "neem";
    const dflt: Record<TreeKind, number> = { palm: 14, ashoka: 18, neem: 20, ornamental: 12, bush: 3 };
    const H = clamp(num(o?.height_ft, dflt[kind]), kind === "bush" ? 0.8 : 2, 60);
    plantTree(ctx, x, y, groundAt(x, y), kind, H);
  }

  function hedge(from: Pt, to: Pt, o?: { height_ft?: number }): void {
    const a = Array.isArray(from) ? from : [0, 0], b = Array.isArray(to) ? to : [0, 0];
    const x0 = num(a[0], 0), y0 = num(a[1], 0), x1 = num(b[0], 0), y1 = num(b[1], 0);
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 0.5) return;
    const H = clamp(num(o?.height_ft, 3), 0.8, 10);
    const base = groundAt((x0 + x1) / 2, (y0 + y1) / 2);
    const depth = Math.min(1.6, H * 0.6);
    const kit = new Kit();
    const core = M.basic("#2c4a22", { roughness: 0.95 });
    const ang = Math.atan2(y1 - y0, x1 - x0);
    kit.rbox(core, ((x0 + x1) / 2) * FT, (base + H / 2 - 0.05) * FT, ((y0 + y1) / 2) * FT, len * FT, (H - 0.1) * FT, depth * FT, 0.12, 2, 0, -ang, 0);
    ctx.add(kit.build(), tag("hedge", "Hedge"));
    // leafy skin of cards
    const cards = new MeshBuilder();
    const r = rng(hashStr(`hedge${x0},${y0}`));
    const n = Math.round(len * H * 3.2);
    const ux = (x1 - x0) / len, uy = (y1 - y0) / len, nx = -uy, ny = ux;
    for (let i = 0; i < n; i++) {
      const t = r(), side = r() < 0.5 ? -1 : 1, top = r() < 0.3;
      const hh = top ? H - 0.05 : 0.2 + r() * (H - 0.4);
      const off = top ? (r() - 0.5) * depth : side * depth * 0.5;
      const px = x0 + ux * len * t + nx * off, py = y0 + uy * len * t + ny * off;
      const cn = new THREE.Vector3(top ? nx * off * 0.3 : nx * side, top ? 1 : 0.25 * (r() - 0.3), top ? ny * off * 0.3 : ny * side).normalize();
      card(cards, new THREE.Vector3(px * FT, (base + hh) * FT, py * FT), cn, 0.42 + r() * 0.25, r() * Math.PI * 2, r);
    }
    const g = cards.build();
    if (g) {
      const m = new THREE.Mesh(g, leafCardMat(ctx, "bush"));
      m.castShadow = m.receiveShadow = true;
      ctx.add(m, tag("hedge", "Hedge"));
    }
  }

  function street(o?: { road_width_ft?: number; neighbours?: boolean; streetlights?: boolean }): void {
    const RW = clamp(num(o?.road_width_ft, plan.plan.site?.road_width_ft ?? 40), 12, 150);
    const W = plan.plotW, D = plan.plotD;
    const ext = 110;
    const fpY0 = -FOOTPATH, rY0 = -FOOTPATH - RW, rY1 = -FOOTPATH;
    // road
    const road = new MeshBuilder();
    road.faceY(0, (-ext) * FT, (W + ext) * FT, (rY0 - FOOTPATH - 0.5) * FT, rY1 * FT, 1);
    const roadMesh = new THREE.Mesh(road.build()!, M.get("asphalt"));
    roadMesh.receiveShadow = true;
    ctx.add(context(roadMesh), ctag("Road"));
    ctx.collider(roadMesh);
    // markings
    const paint = M.basic("#e9e6dc", { roughness: 0.6 });
    const mk = new Kit();
    const mid = (rY0 + rY1) / 2;
    for (let x = -ext + 4; x < W + ext - 8; x += 18) mk.box(paint, (x + 4) * FT, 0.004, mid * FT, 8 * FT, 0.006, 0.35 * FT);
    for (const yy of [rY0 + 1.2, rY1 - 1.2]) mk.box(paint, (W / 2) * FT, 0.004, yy * FT, (W + 2 * ext) * FT, 0.006, 0.3 * FT);
    ctx.add(context(mk.build(new THREE.Group(), false)), ctag("Road markings"));
    // footpaths + kerbs on both sides (skip parts already landscaped)
    const near: R[] = [{ x: -ext, y: fpY0, w: W + 2 * ext, d: FOOTPATH }];
    const far: R[] = [{ x: -ext, y: rY0 - FOOTPATH, w: W + 2 * ext, d: FOOTPATH }];
    const fpMat = M.get({ preset: "paving", color: "#a9a49b" });
    for (const [rects, kerbY, sign] of [[near, rY1, 1], [far, rY0, -1]] as const) {
      const g = CellGrid.fromRects<boolean>([
        ...rects.map((rect) => ({ rect, val: true })),
        ...ctx.ground.filter((s) => s.y < 0).map((s) => ({ rect: { x: s.x, y: s.y, w: s.w, d: s.d }, val: false })),
      ]);
      const mb = new MeshBuilder();
      for (const rr of g.rects((v) => v === true)) mb.faceY(plan.grade * FT, rr.x * FT, (rr.x + rr.w) * FT, rr.y * FT, (rr.y + rr.d) * FT, 1);
      const m = new THREE.Mesh(mb.build()!, fpMat);
      m.receiveShadow = true;
      ctx.add(context(m), ctag("Footpath"));
      ctx.collider(m);
      const kerb = new Kit();
      kerb.box(M.get({ preset: "concrete", color: "#cfcac1" }), (W / 2) * FT, (plan.grade / 2) * FT, (kerbY + sign * 0.35) * FT, (W + 2 * ext) * FT, plan.grade * FT + 0.01, 0.7 * FT);
      ctx.add(context(kerb.build()), ctag("Kerb"));
    }
    // street trees in the verge
    const r = rng(hashStr(`street${W}`));
    for (let x = -ext + 25; x < W + ext - 20; x += 38 + r() * 12) {
      if (x > -6 && x < W + 6) continue;
      plantTree(ctx, x, fpY0 + 1.8, plan.grade, r() < 0.5 ? "neem" : "ashoka", 18 + r() * 8, `st${x}`);
    }
    if (o?.streetlights !== false) {
      const kit = new Kit();
      const pole = M.get({ preset: "metal_brushed", color: "#7d8187" });
      const head = M.emissive("#fff0d8", 2.2);
      for (const x of [-34, W + 26, -110, W + 92]) {
        const y = fpY0 + 0.6;
        kit.cyl(pole, x * FT, ((plan.grade + 14) / 2) * FT, y * FT, 0.07, 14 * FT, 12);
        kit.cyl(pole, x * FT, (plan.grade + 14) * FT + 0.05, (y - 2.5) * FT, 0.04, 5 * FT, 8, Math.PI / 2 - 0.15);
        kit.rbox(pole, x * FT, (plan.grade + 14.2) * FT, (y - 5) * FT, 0.18, 0.08, 0.6, 0.02, 2);
        kit.box(head, x * FT, (plan.grade + 14.2) * FT - 0.045, (y - 5) * FT, 0.14, 0.01, 0.5);
      }
      ctx.add(context(kit.build()), ctag("Streetlights"));
      utilityPoles(ctx, W, fpY0 + 0.5, ext);
    }
    if (o?.neighbours !== false) neighbours(ctx, W, D, RW, FOOTPATH);
  }

  return { lawn, paving, planter, tree, hedge, street };
}

function overlapFrac(a: R, b: R): number {
  const i = rectIntersect(a, b);
  return i ? (i.w * i.d) / Math.max(1e-6, b.w * b.d) : 0;
}

// ── grass tufts (instanced) ─────────────────────────────────────────────────────────────────────────────
let tuftGeo: THREE.BufferGeometry | null = null;
function grassTufts(ctx: BuildCtx, rect: Rect, h: number): void {
  if (!tuftGeo) {
    const pos: number[] = [], col: number[] = [], idx: number[] = [];
    const r = rng(7);
    const blades = 9;
    for (let i = 0; i < blades; i++) {
      const a = r() * Math.PI * 2, rr = r() * 0.05;
      const bx = Math.cos(a) * rr, bz = Math.sin(a) * rr;
      const lean = 0.25 + r() * 0.35, la = r() * Math.PI * 2;
      const hh = 0.06 + r() * 0.08, w = 0.007 + r() * 0.004;
      const tx = bx + Math.cos(la) * lean * hh, tz = bz + Math.sin(la) * lean * hh;
      const px = -Math.sin(la) * w, pz = Math.cos(la) * w;
      const k = pos.length / 3;
      pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, hh, tz);
      const dark = [0.14, 0.24, 0.07], light = [0.42, 0.55, 0.2];
      col.push(...dark, ...dark, ...light);
      idx.push(k, k + 1, k + 2);
    }
    tuftGeo = new THREE.BufferGeometry();
    tuftGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    tuftGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    tuftGeo.setIndex(idx);
    tuftGeo.computeVertexNormals();
    const nor = tuftGeo.getAttribute("normal") as THREE.BufferAttribute;
    for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
  }
  const area = rect.w * rect.d * FT * FT;
  const n = Math.min(ctx.quality === "high" ? 9000 : 3500, Math.round(area * (ctx.quality === "high" ? 140 : 60)));
  if (n < 10) return;
  const mat = ctx.mats.basic("#ffffff", { roughness: 0.9 });
  const tm = (ctx.mats as unknown as { _tuft?: THREE.MeshStandardMaterial });
  if (!tm._tuft) {
    tm._tuft = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
    ctx.mats.created.push(tm._tuft);
  }
  void mat;
  const im = new THREE.InstancedMesh(tuftGeo, tm._tuft, n);
  const r = rng(hashStr(`tuft${rect.x},${rect.y}`));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const x = rect.x + r() * rect.w, y = rect.y + r() * rect.d;
    p.set(x * FT, h * FT, -y * FT);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * Math.PI * 2);
    const k = 0.7 + r() * 0.9;
    s.set(k, k * (0.8 + r() * 0.5), k);
    m.compose(p, q, s);
    im.setMatrixAt(i, m);
  }
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = false;
  im.receiveShadow = true;
  im.frustumCulled = true;
  im.computeBoundingSphere();
  ctx.add(im, { kind: "landscape:grass", label: "Grass", level: ctx.plan.levels[0].id });
  im.userData.collide = false;
}

// ── trees ──────────────────────────────────────────────────────────────────────────────────────────────
const leafTex = new Map<string, THREE.Texture>();
function leafTexture(kind: string): THREE.Texture {
  let t = leafTex.get(kind);
  if (t) return t;
  const N = 256;
  const cv = makeCanvas(N);
  const g = cv.getContext("2d") as CanvasRenderingContext2D;
  g.clearRect(0, 0, N, N);
  const r = rng(hashStr(kind));
  const greens = kind === "ashoka" ? ["#24401c", "#2e5124", "#3a6329", "#1d3517"] : kind === "ornamental" ? ["#3a5f2a", "#4d7533", "#2f4f22", "#5a8238"] : ["#2f5223", "#3d6a2b", "#4a7a33", "#284a1f", "#5b8a3c"];
  const leaf = (x: number, y: number, len: number, wid: number, ang: number, col: string) => {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(wid, len * 0.45, 0, len);
    g.quadraticCurveTo(-wid, len * 0.45, 0, 0);
    g.fill();
    g.strokeStyle = "rgba(20,35,15,0.35)";
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, len * 0.9);
    g.stroke();
    g.restore();
  };
  if (kind === "palm") {
    // frond strip: midrib along x, leaflets angled both sides
    g.strokeStyle = "#5d6b33";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, N / 2);
    g.lineTo(N, N / 2);
    g.stroke();
    for (let x = 6; x < N - 4; x += 4) {
      const L = (N / 2 - 6) * Math.sin((x / N) * Math.PI * 0.95 + 0.05);
      for (const s of [-1, 1]) {
        g.strokeStyle = greens[Math.floor(r() * greens.length)];
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(x, N / 2);
        g.quadraticCurveTo(x + 14, N / 2 + s * L * 0.5, x + 24, N / 2 + s * L);
        g.stroke();
      }
    }
  } else if (kind === "ashoka") {
    for (let i = 0; i < 42; i++) {
      const x = N * (0.15 + r() * 0.7), y = N * (0.05 + r() * 0.35);
      leaf(x, y, N * (0.35 + r() * 0.25), N * 0.03, (r() - 0.5) * 0.5, greens[Math.floor(r() * greens.length)]);
    }
  } else {
    const n = kind === "bush" ? 110 : 90;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * N * 0.42;
      const x = N / 2 + Math.cos(a) * rr, y = N / 2 + Math.sin(a) * rr;
      leaf(x, y, N * (kind === "bush" ? 0.09 : 0.13) * (0.7 + r() * 0.6), N * (kind === "bush" ? 0.035 : 0.045), a + Math.PI / 2 + (r() - 0.5), greens[Math.floor(r() * greens.length)]);
    }
    if (kind === "ornamental") {
      for (let i = 0; i < 26; i++) {
        const a = r() * Math.PI * 2, rr = Math.sqrt(r()) * N * 0.4;
        g.fillStyle = r() < 0.5 ? "#c2347a" : "#e05a9a";
        g.beginPath();
        g.arc(N / 2 + Math.cos(a) * rr, N / 2 + Math.sin(a) * rr, 4 + r() * 3, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  t = new THREE.CanvasTexture(cv as HTMLCanvasElement);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  leafTex.set(kind, t);
  return t;
}

function leafCardMat(ctx: BuildCtx, kind: string): THREE.Material {
  const key = `leafcard|${kind === "neem" || kind === "bush" ? "broad" : kind}`;
  const cache = ctx.mats as unknown as { _cards?: Map<string, THREE.Material> };
  cache._cards ??= new Map();
  let m = cache._cards.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: leafTexture(kind === "neem" ? "broad" : kind), alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.75, metalness: 0 });
    m.name = key;
    cache._cards.set(key, m);
    ctx.mats.created.push(m);
  }
  return m;
}

/** One leaf card: a quad centered at p, facing n (for shading normals point outward from the crown). */
function card(mb: MeshBuilder, p: THREE.Vector3, n: THREE.Vector3, size: number, spin: number, r: () => number, radial?: THREE.Vector3): void {
  const up = Math.abs(n.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const t1 = new THREE.Vector3().crossVectors(up, n).normalize();
  const t2 = new THREE.Vector3().crossVectors(n, t1).normalize();
  const c = Math.cos(spin), s = Math.sin(spin);
  const a = t1.clone().multiplyScalar(c).addScaledVector(t2, s).multiplyScalar(size / 2);
  const b = t2.clone().multiplyScalar(c).addScaledVector(t1, -s).multiplyScalar(size / 2);
  const nn = (radial ?? n).clone().normalize();
  const k = mb.pos.length / 3;
  const corners = [
    p.clone().sub(a).sub(b), p.clone().add(a).sub(b), p.clone().add(a).add(b), p.clone().sub(a).add(b),
  ];
  const uv = [0, 0, 1, 0, 1, 1, 0, 1];
  corners.forEach((v, i) => mb.vertex(v.x, v.y, v.z, nn.x, nn.y, nn.z, uv[i * 2], uv[i * 2 + 1]));
  mb.idx.push(k, k + 1, k + 2, k, k + 2, k + 3);
  void r;
}

export function plantTree(ctx: BuildCtx, x: number, y: number, base: number, kind: TreeKind, H: number, seedKey = ""): void {
  const r = rng(hashStr(`${kind}|${x.toFixed(1)}|${y.toFixed(1)}|${seedKey}`));
  const M = ctx.mats;
  const bark = M.get({ preset: "wood_walnut", color: "#5c4b3d", roughness: 0.9 });
  const kit = new Kit();
  const cards = new MeshBuilder();
  const X = x * FT, Y = base * FT, Z = y * FT;
  const Hm = H * FT;
  const tagLv = ctx.plan.levels[0].id;
  // street trees outside the plot are context, like the road and the neighbours
  const outside = x < 0 || y < 0 || x > ctx.plan.plotW || y > ctx.plan.plotD;
  const treeKind = outside ? "context" : "landscape:tree";
  const ctxMark = (o: THREE.Object3D) => {
    if (outside) o.userData.mergeGroup = "context";
    return o;
  };
  if (kind === "palm") {
    // curved ringed trunk + arching fronds
    const trunkH = Hm * 0.78;
    const lean = new THREE.Vector3((r() - 0.5) * 0.3, 1, (r() - 0.5) * 0.3).normalize();
    const segs = 9;
    let prev = new THREE.Vector3(X, Y, Z);
    const r0 = Math.max(0.09, Hm * 0.028), r1 = r0 * 0.75;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const pt = new THREE.Vector3(X + lean.x * trunkH * t * t * 0.6, Y + trunkH * t, Z + lean.z * trunkH * t * t * 0.6);
      const d = pt.clone().sub(prev);
      const L = d.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
      const rr = r0 + (r1 - r0) * t;
      kit.geo(bark, lathe("palmseg", [[0.92, 0], [1, 0.15], [1, 0.85], [0.92, 1]], 14), new THREE.Matrix4().compose(prev, q, new THREE.Vector3(rr, L, rr)));
      prev = pt;
    }
    const crown = prev;
    const fronds = 14 + Math.floor(r() * 5);
    const fl = Math.max(0.9, Hm * 0.32);
    const fm = new MeshBuilder();
    for (let i = 0; i < fronds; i++) {
      const az = (i / fronds) * Math.PI * 2 + r() * 0.3;
      const up = 0.9 - (i % 3) * 0.35 + r() * 0.2; // initial elevation
      const len = fl * (0.8 + r() * 0.35);
      frond(fm, crown, az, up, len, 0.28 * len);
    }
    const g1 = fm.build();
    if (g1) {
      const m = new THREE.Mesh(g1, leafCardMat(ctx, "palm"));
      m.castShadow = m.receiveShadow = true;
      ctx.add(ctxMark(m), { kind: treeKind, label: "Palm", level: tagLv });
    }
  } else {
    // trunk + crown of cards
    const spec = {
      neem: { trunk: 0.42, crownR: 0.36, crownH: 0.55, flat: 0.75, cards: 360 },
      ashoka: { trunk: 0.12, crownR: 0.14, crownH: 0.9, flat: 1, cards: 300 },
      ornamental: { trunk: 0.38, crownR: 0.3, crownH: 0.55, flat: 0.85, cards: 200 },
      bush: { trunk: 0, crownR: 0.55, crownH: 0.9, flat: 0.7, cards: 70 },
    }[kind];
    const trunkTop = Hm * spec.trunk;
    if (spec.trunk > 0) {
      const tr = Math.max(0.05, Hm * 0.022);
      kit.geo(bark, lathe("trunk", [[1.3, 0], [1, 0.08], [0.85, 0.6], [0.6, 1]], 12), mat4(X, Y, Z, 0, 0, 0, tr, trunkTop + Hm * 0.12, tr));
      if (kind !== "ashoka")
        for (let b = 0; b < 4; b++) {
          const a = (b / 4) * Math.PI * 2 + r();
          const from = new THREE.Vector3(X, Y + trunkTop * (0.75 + r() * 0.2), Z);
          const to = new THREE.Vector3(X + Math.cos(a) * Hm * spec.crownR * 0.6, Y + trunkTop + Hm * 0.12, Z + Math.sin(a) * Hm * spec.crownR * 0.6);
          const d = to.clone().sub(from);
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
          kit.geo(bark, lathe("branch", [[1, 0], [0.55, 1]], 8), new THREE.Matrix4().compose(from, q, new THREE.Vector3(tr * 0.55, d.length(), tr * 0.55)));
        }
    }
    const cy = Y + (kind === "bush" ? Hm * 0.5 : trunkTop + Hm * spec.crownH * 0.5);
    const RX = Math.max(kind === "bush" ? 0.3 : 0.5, Hm * spec.crownR), RY = Math.max(0.3, Hm * spec.crownH * 0.5 * spec.flat);
    const n = Math.round(spec.cards * (ctx.quality === "high" ? 1 : 0.6) * clamp(Hm / 5, kind === "bush" ? 0.5 : 0.7, 1.6));
    const sz = kind === "ashoka" ? Math.max(0.45, Hm * 0.11) : kind === "bush" ? Math.max(0.28, RX * 0.55) : Math.max(0.5, RX * 0.42);
    for (let i = 0; i < n; i++) {
      // points biased to the surface of an ellipsoid (columnar for ashoka)
      const u = r() * 2 - 1, th = r() * Math.PI * 2;
      const rad = Math.pow(r(), 0.35);
      const sxz = Math.sqrt(1 - u * u);
      let px = Math.cos(th) * sxz * rad, py = u * rad, pz = Math.sin(th) * sxz * rad;
      if (kind === "ashoka") {
        const k = 1 - (py + 1) / 2; // wider at the bottom
        px *= 0.4 + 0.75 * k;
        pz *= 0.4 + 0.75 * k;
      }
      const p = new THREE.Vector3(X + px * RX, cy + py * RY, Z + pz * RX);
      const radial = new THREE.Vector3(px, py * 0.8 + 0.25, pz).normalize();
      const nrm = radial.clone().add(new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.9)).normalize();
      card(cards, p, nrm, sz * (0.75 + r() * 0.5), r() * Math.PI * 2, r, radial);
    }
    const g2 = cards.build();
    if (g2) {
      const m = new THREE.Mesh(g2, leafCardMat(ctx, kind));
      m.castShadow = m.receiveShadow = true;
      ctx.add(ctxMark(m), { kind: treeKind, label: kind === "bush" ? "Shrub" : `${kind[0].toUpperCase()}${kind.slice(1)} tree`, level: tagLv });
    }
  }
  if (!kit.empty) ctx.add(ctxMark(kit.build()), { kind: treeKind, label: "Tree", level: tagLv });
}

/** An arching palm frond as a ribbon with the frond texture (u along, v across). */
function frond(mb: MeshBuilder, base: THREE.Vector3, az: number, elev: number, len: number, width: number): void {
  const n = 10;
  const dir = new THREE.Vector3(Math.cos(az), 0, Math.sin(az));
  const side = new THREE.Vector3(-dir.z, 0, dir.x);
  const k0 = mb.pos.length / 3;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // parabolic arch: rises then droops
    const hx = Math.cos(elev) * len * t;
    const hy = Math.sin(elev) * len * t - len * 0.55 * t * t;
    const c = base.clone().addScaledVector(dir, hx).add(new THREE.Vector3(0, hy, 0));
    const w = width * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) * 0.5;
    const droop = -w * 0.35;
    const a = c.clone().addScaledVector(side, -w).add(new THREE.Vector3(0, droop, 0));
    const b = c.clone().addScaledVector(side, w).add(new THREE.Vector3(0, droop, 0));
    const nrm = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -0.2).normalize();
    mb.vertex(a.x, a.y, a.z, nrm.x, nrm.y, nrm.z, t, 0);
    mb.vertex(b.x, b.y, b.z, nrm.x, nrm.y, nrm.z, t, 1);
  }
  for (let i = 0; i < n; i++) {
    const a = k0 + i * 2;
    mb.idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
}

// ── street furniture: utility poles + wires, neighbours ───────────────────────────────────────────────
function utilityPoles(ctx: BuildCtx, W: number, y: number, ext: number): void {
  const M = ctx.mats;
  const kit = new Kit();
  const conc = M.get({ preset: "concrete", color: "#a19d95" });
  const dark = M.basic("#1b1c1e", { roughness: 0.7 });
  const xs = [-ext + 20, -18, W + 40, W + ext - 10];
  const top = ctx.plan.grade + 26;
  for (const x of xs) {
    kit.geo(conc, lathe("upole", [[1, 0], [0.62, 1]], 10), mat4(x * FT, ctx.plan.grade * FT, (y + 0.4) * FT, 0, 0, 0, 0.13, (top - ctx.plan.grade) * FT, 0.13));
    kit.box(dark, x * FT, (top - 1.2) * FT, (y + 0.4) * FT, 0.06, 0.06, 1.6);
    kit.cyl(M.basic("#3a3b3c", { roughness: 0.6 }), x * FT, (top - 3.2) * FT, (y + 0.9) * FT, 0.22, 0.6, 12);
  }
  // sagging wires between poles
  const wires = new MeshBuilder();
  for (let i = 0; i < xs.length - 1; i++)
    for (const dz of [-0.6, 0, 0.6]) {
      const a = new THREE.Vector3(xs[i] * FT, (top - 1.15) * FT, (y + 0.4) * FT + dz);
      const b = new THREE.Vector3(xs[i + 1] * FT, (top - 1.15) * FT, (y + 0.4) * FT + dz);
      const segs = 16;
      let prev = a;
      for (let k = 1; k <= segs; k++) {
        const t = k / segs;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(Math.PI * t) * 0.9;
        const d = p.clone().sub(prev);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
        wires.addGeometry(unitCyl(4), new THREE.Matrix4().compose(prev.clone().add(p).multiplyScalar(0.5), q, new THREE.Vector3(0.02, d.length(), 0.02)));
        prev = p;
      }
    }
  const poles = kit.build();
  poles.userData.mergeGroup = "context";
  ctx.add(poles, { kind: "context", label: "Utility poles", level: ctx.plan.levels[0].id });
  const wg = wires.build();
  if (wg) {
    const m = new THREE.Mesh(wg, dark);
    m.userData.mergeGroup = "context";
    ctx.add(m, { kind: "context", label: "Power lines", level: ctx.plan.levels[0].id });
  }
}

function neighbours(ctx: BuildCtx, W: number, D: number, RW: number, FP: number): void {
  const M = ctx.mats;
  const r = rng(hashStr(`nb${W}|${D}`));
  const walls = [
    M.get({ preset: "plaster_white", color: "#e8e3da" }),
    M.get({ preset: "plaster_warm", color: "#dccfbd" }),
    M.get({ preset: "plaster_grey", color: "#c3c0ba" }),
    M.get({ preset: "plaster_warm", color: "#e2d8c8" }),
  ];
  const trim = M.get({ preset: "plaster_white", color: "#f2efe9" });
  const stone = M.get({ preset: "stone_cladding", color: "#8f8a83" });
  const wood = M.get("wood_teak");
  const glass = nbGlass(ctx);
  const frame = M.get("metal_black");
  const kit = new Kit();
  const grade = ctx.plan.grade;
  const bx = (a: number, b: number, c: number, d: number, h0: number, h1: number, m: THREE.Material) =>
    kit.mb(m).box(Math.min(a, b) * FT, h0 * FT, Math.min(c, d) * FT, Math.max(a, b) * FT, h1 * FT, Math.max(c, d) * FT);
  const house = (x0: number, w: number, frontY: number, depth: number, facing: 1 | -1, storeys: number) => {
    const wm = walls[Math.floor(r() * walls.length)];
    const setback = 9 + r() * 4;
    const fy = frontY + facing * setback;
    const H = storeys * 11 + 1.5;
    const back = fy + facing * depth;
    // main volume (slightly recessed) + projecting front volume on one side
    bx(x0 + 0.6, x0 + w - 0.6, fy + facing * 2.5, back, grade, grade + H, wm);
    const split = x0 + w * (0.42 + r() * 0.16);
    const projLeft = r() < 0.5;
    const pa = projLeft ? x0 + 0.6 : split, pb = projLeft ? split : x0 + w - 0.6;
    bx(pa, pb, fy, fy + facing * 2.6, grade, grade + H + 1.2, wm);
    // parapet + coping
    bx(x0 + 0.6, x0 + w - 0.6, fy + facing * 2.5, back, grade + H, grade + H + 3, wm);
    bx(x0 + 0.4, x0 + w - 0.4, fy + facing * 2.3, back + facing * 0.2, grade + H + 3, grade + H + 3.25, trim);
    // per storey: chajja band + windows with frames
    for (let s = 0; s < storeys; s++) {
      const fl = grade + 1.5 + s * 11;
      const band = fl + 11 - 0.5;
      bx(x0 + 0.3, x0 + w - 0.3, fy + facing * 2.5 - facing * 1.6, fy + facing * 2.5, band, band + 0.55, trim);
      for (const [a, b, plane] of [[pa, pb, fy], [projLeft ? split : x0 + 0.6, projLeft ? x0 + w - 0.6 : split, fy + facing * 2.5]] as const) {
        const span = Math.abs(b - a);
        const n = Math.max(1, Math.floor(span / 9));
        for (let k = 0; k < n; k++) {
          const wx = Math.min(a, b) + (span * (k + 0.5)) / n;
          const ww = Math.min(7, span / n - 2);
          if (ww < 2) continue;
          const tall = r() < 0.35;
          const h0 = fl + (tall ? 0.3 : 2.6), h1 = fl + 8.2;
          bx(wx - ww / 2, wx + ww / 2, plane - facing * 0.02, plane + facing * 0.2, h0, h1, glass);
          bx(wx - ww / 2 - 0.18, wx + ww / 2 + 0.18, plane - facing * 0.06, plane + facing * 0.12, h1, h1 + 0.18, frame);
          bx(wx - ww / 2 - 0.18, wx + ww / 2 + 0.18, plane - facing * 0.25, plane + facing * 0.12, h0 - 0.15, h0, frame);
          bx(wx - 0.05, wx + 0.05, plane - facing * 0.06, plane + facing * 0.12, h0, h1, frame);
          if (tall && s > 0) bx(wx - ww / 2 - 0.3, wx + ww / 2 + 0.3, plane - facing * 2.2, plane, fl - 0.1, fl + 0.35, trim);
        }
      }
    }
    // accents
    const acc = r();
    if (acc < 0.45) bx(projLeft ? pb - 3.5 : pa, projLeft ? pb : pa + 3.5, fy - facing * 0.25, fy + facing * 0.4, grade, grade + H + 1.2, stone);
    else if (acc < 0.75) bx(pa + 1, pb - 1, fy - facing * 0.2, fy, grade + 12.4, grade + 13.4, wood);
    // boundary wall + gate + water tank
    bx(x0, x0 + w, frontY - 0.35, frontY + 0.35, grade - 0.2, grade + 4.5, walls[2]);
    bx(x0, x0 + w, frontY - 0.45, frontY + 0.45, grade + 4.5, grade + 4.7, trim);
    const gx = x0 + w * (0.25 + r() * 0.3);
    bx(gx, gx + 12, frontY - 0.25, frontY + 0.25, grade, grade + 5.4, frame);
    kit.cyl(M.get({ preset: "plastic", color: "#1f2022" }), (x0 + w * 0.3) * FT, (grade + H + 3) * FT + 0.7, ((fy + back) / 2) * FT, 0.65, 1.4, 20);
  };
  house(-36, 35, 0, D - 24, 1, 2);
  house(W, 35, 0, D - 24, 1, 2);
  house(-72, 36, 0, D - 24, 1, r() < 0.5 ? 2 : 3);
  house(W + 35, 36, 0, D - 24, 1, 2);
  const yAcross = -FP - RW - FP;
  for (let i = -1; i <= 2; i++) house(-30 + i * 36, 35, yAcross, 44, -1, r() < 0.6 ? 2 : 3);
  const g = kit.build();
  g.userData.mergeGroup = "context";
  ctx.add(g, { kind: "context", label: "Neighbouring houses", level: ctx.plan.levels[0].id });
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = false;
  });
}

function nbGlass(ctx: BuildCtx): THREE.Material {
  const c = ctx.mats as unknown as { _nbg?: THREE.Material };
  if (!c._nbg) {
    c._nbg = new THREE.MeshStandardMaterial({ color: new THREE.Color("#4a5560"), roughness: 0.06, metalness: 0.65, envMapIntensity: 1.6 });
    c._nbg.name = "neighbour_glass";
    ctx.mats.created.push(c._nbg);
  }
  return c._nbg;
}
