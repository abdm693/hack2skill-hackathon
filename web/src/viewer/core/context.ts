/**
 * Clear view and cars.
 *
 * Ghosting: neighbours, poles, wires and other street context (engine `kind: "context"`, legacy
 * `landscape:neighbour…`, or `userData.mergeGroup === "context"`) get a shader patch that, per fragment, tests whether
 * the house lies behind it along the view ray. Those fragments are dropped from the opaque pass and redrawn by a
 * translucent clay overlay (DESIGN: "neighbours between the camera and the house ghost to 15% clay"). Per fragment,
 * so it works on consolidated meshes and from any angle, with no sorting artefacts in the solid parts.
 *
 * Vehicles: cars and motorbikes (engine `kind: "vehicle"`, legacy `furniture:car_*`/`motorbike`) are split out of
 * consolidated meshes into their own meshes so they can fade and hide on their own, and their triangles are left
 * out of the walk collider (porch cars never block the way in).
 */
import * as THREE from "three";
import { partsOf, type PartRange } from "./tags";

export const CONTEXT_KIND = /(^|:)(context|neighbou?rs?|utility_poles?|wires|streetlights?|power_lines?)($|:)/;
export const VEHICLE_KIND = /(^|:)(vehicles?|cars?|car_sedan|car_suv|suv|sedan|motorbikes?|motorcycles?|scooters?|rickshaw)($|:)/;

/** Shared uniforms: one value drives every patched material. */
export const GHOST = {
  nqGhost: { value: 0 },
  nqBoxMin: { value: new THREE.Vector3() },
  nqBoxMax: { value: new THREE.Vector3() },
};

const GLSL = /* glsl */ `
uniform float nqGhost;
uniform vec3 nqBoxMin;
uniform vec3 nqBoxMax;
varying vec3 vNqW;
// length of the view ray's stretch inside the box that lies beyond the fragment (0 = the box isn't behind it)
float nqChord(vec3 ro, vec3 inv, float L, vec3 bmin, vec3 bmax) {
  vec3 t0 = (bmin - ro) * inv;
  vec3 t1 = (bmax - ro) * inv;
  vec3 tn3 = min(t0, t1), tf3 = max(t0, t1);
  float tn = max(max(tn3.x, tn3.y), tn3.z);
  float tf = min(min(tf3.x, tf3.y), tf3.z);
  return tf - max(tn, L);
}
float nqGhostAt(vec3 p) {
  if (nqGhost <= 0.0) return 0.0;
  vec3 d = p - cameraPosition;
  float L = length(d);
  vec3 rd = d / max(L, 1e-5);
  vec3 sg = sign(rd);
  sg += 1.0 - abs(sg);
  vec3 inv = 1.0 / (sg * max(abs(rd), vec3(1e-5)));
  // the house box, then the same box grown by 0.7 / 1.4 / 2.1 m: a soft-edged window, not a hard cut-out
  float g = 0.0;
  for (int k = 0; k < 4; k++) {
    vec3 e = vec3(0.7 * float(k));
    vec3 grow = vec3(e.x, e.y, e.z);
    g += smoothstep(0.0, 0.35, nqChord(cameraPosition, inv, L, nqBoxMin - vec3(grow.x, 0.0, grow.z), nqBoxMax + grow));
  }
  return nqGhost * g * 0.25;
}
`;

const VERT_DECL = "varying vec3 vNqW;\n";
const VERT_BODY = `#include <project_vertex>
  vec4 nqW4 = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    nqW4 = instanceMatrix * nqW4;
  #endif
  vNqW = (modelMatrix * nqW4).xyz;`;

function patch(mat: THREE.Material, mode: "solid" | "ghost") {
  const prev = mat.onBeforeCompile?.bind(mat);
  mat.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    Object.assign(sh.uniforms, GHOST);
    sh.vertexShader = VERT_DECL + sh.vertexShader.replace("#include <project_vertex>", VERT_BODY);
    const test = mode === "solid" ? "if (nqG > 0.02) discard;" : "if (nqG <= 0.02) discard;";
    sh.fragmentShader =
      GLSL +
      sh.fragmentShader.replace("#include <clipping_planes_fragment>", `#include <clipping_planes_fragment>\n  float nqG = nqGhostAt(vNqW);\n  ${test}`);
    if (mode === "ghost") {
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <dithering_fragment>",
        "#include <dithering_fragment>\n  float nqK = smoothstep(0.02, 0.85, nqG);\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.84, 0.82, 0.78), 0.5 * nqK);\n  gl_FragColor.a *= mix(1.0, 0.15, nqK);",
      );
    }
  };
  const key = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => `${key ? key() : ""}|nq-ghost-${mode}`;
  mat.needsUpdate = true;
}


/** CPU twin of the shader test (for picking through ghosted neighbours). */
export function ghostAt(p: THREE.Vector3, cam: THREE.Vector3): number {
  const g = GHOST.nqGhost.value;
  if (g <= 0) return 0;
  const d = new THREE.Vector3().subVectors(p, cam);
  const L = d.length();
  if (L < 1e-5) return 0;
  d.multiplyScalar(1 / L);
  const mn = GHOST.nqBoxMin.value, mx = GHOST.nqBoxMax.value;
  const ss = (x: number) => {
    const t = Math.min(1, Math.max(0, x / 0.35));
    return t * t * (3 - 2 * t);
  };
  let sum = 0;
  for (let k = 0; k < 4; k++) {
    const e = 0.7 * k;
    let tn = -Infinity, tf = Infinity;
    for (const a of ["x", "y", "z"] as const) {
      const lo = mn[a] - (a === "y" ? 0 : e), hi = mx[a] + e;
      const inv = 1 / (Math.abs(d[a]) < 1e-5 ? 1e-5 * (d[a] < 0 ? -1 : 1) : d[a]);
      const t0 = (lo - cam[a]) * inv, t1 = (hi - cam[a]) * inv;
      tn = Math.max(tn, Math.min(t0, t1));
      tf = Math.min(tf, Math.max(t0, t1));
    }
    sum += ss(tf - Math.max(tn, L));
  }
  return (g * sum) / 4;
}

function tagChain(o: THREE.Object3D, stop: THREE.Object3D | null) {
  let kind: string | undefined, group: string | undefined;
  for (let p: THREE.Object3D | null = o; p && p !== stop; p = p.parent) {
    const u = p.userData ?? {};
    if (!kind && typeof u.kind === "string" && u.kind !== "merged" && u.kind !== "section") kind = u.kind;
    if (!group && typeof u.mergeGroup === "string") group = u.mergeGroup;
  }
  return { kind, group };
}

const isVehicleKind = (k: unknown) => typeof k === "string" && VEHICLE_KIND.test(k);
const isContextKind = (k: unknown) => typeof k === "string" && CONTEXT_KIND.test(k);

export interface Vehicle {
  id: string;
  meshes: THREE.Mesh[];
  /** world box (m) */
  box: THREE.Box3;
  opacity: number;
  clones: Map<THREE.Material, THREE.Material>;
  originals: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
}

/**
 * Move the triangles of `ranges` (consolidated parts) into a new sibling mesh with the same material, and
 * collapse them in the source (degenerate triangles: numbering, and so part lookup, stays valid).
 */
function splitParts(src: THREE.Mesh, ranges: PartRange[]): THREE.Mesh | null {
  const g = src.geometry;
  const idx = g.index;
  if (!idx || !ranges.length) return null;
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const nor = g.getAttribute("normal") as THREE.BufferAttribute | undefined;
  const uv = g.getAttribute("uv") as THREE.BufferAttribute | undefined;
  const map = new Map<number, number>();
  const P: number[] = [], N: number[] = [], U: number[] = [], I: number[] = [];
  const parts: PartRange[] = [];
  for (const r of ranges) {
    const start = I.length / 3;
    for (let t = r.start; t < r.start + r.count; t++)
      for (let k = 0; k < 3; k++) {
        const vi = idx.getX(t * 3 + k);
        let ni = map.get(vi);
        if (ni === undefined) {
          ni = P.length / 3;
          map.set(vi, ni);
          P.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
          if (nor) N.push(nor.getX(vi), nor.getY(vi), nor.getZ(vi));
          if (uv) U.push(uv.getX(vi), uv.getY(vi));
        }
        I.push(ni);
      }
    parts.push({ start, count: r.count, tags: r.tags });
  }
  for (const r of ranges)
    for (let t = r.start; t < r.start + r.count; t++) {
      const a = idx.getX(t * 3);
      idx.setX(t * 3 + 1, a);
      idx.setX(t * 3 + 2, a);
    }
  idx.needsUpdate = true;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(P, 3));
  if (nor) geo.setAttribute("normal", new THREE.Float32BufferAttribute(N, 3));
  if (uv) geo.setAttribute("uv", new THREE.Float32BufferAttribute(U, 2));
  geo.setIndex(I);
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  const m = new THREE.Mesh(geo, src.material);
  m.castShadow = src.castShadow;
  m.receiveShadow = src.receiveShadow;
  m.renderOrder = src.renderOrder;
  m.matrixAutoUpdate = src.matrixAutoUpdate;
  m.position.copy(src.position);
  m.quaternion.copy(src.quaternion);
  m.scale.copy(src.scale);
  m.matrix.copy(src.matrix);
  const t0 = ranges[0].tags as Record<string, unknown>;
  m.userData = { ...t0, parts, viewer: "split" };
  src.parent?.add(m);
  return m;
}

export class ContextFX {
  vehicles: Vehicle[] = [];
  private done = new WeakSet<THREE.Object3D>();
  private solidClones = new Map<THREE.Material, THREE.Material>();
  /** Same material, translucent: redraws only the ghosted fragments (so the edge of the window is seamless). */
  private ghostClones = new Map<THREE.Material, THREE.Material>();
  private owned: (THREE.Material | THREE.BufferGeometry)[] = [];

  /** Classify and prepare a finished build (idempotent per root). */
  install(root: THREE.Object3D) {
    this.vehicles = [];
    const byId = new Map<string, Vehicle>();
    const addVehicle = (m: THREE.Mesh, id: string) => {
      let v = byId.get(id);
      if (!v) {
        v = { id, meshes: [], box: new THREE.Box3(), opacity: 1, clones: new Map(), originals: new Map() };
        byId.set(id, v);
      }
      v.meshes.push(m);
    };
    const meshes: THREE.Mesh[] = [];
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !o.userData?.viewer) meshes.push(o as THREE.Mesh);
    });
    const firstTime = !this.done.has(root);
    for (const m of meshes) {
      const { kind, group } = tagChain(m, root);
      const parts = partsOf(m);
      // ── vehicles ──
      if (parts) {
        const veh = parts.filter((p) => isVehicleKind(p.tags.kind));
        if (veh.length === parts.length) addVehicle(m, String(veh[0].tags.id ?? m.uuid));
        else if (veh.length && firstTime) {
          // one new mesh per vehicle id
          const ids = new Map<string, PartRange[]>();
          for (const p of veh) {
            const id = String(p.tags.id ?? "vehicle");
            (ids.get(id) ?? ids.set(id, []).get(id)!).push(p);
          }
          for (const [id, rs] of ids) {
            const split = splitParts(m, rs);
            if (split) addVehicle(split, id);
          }
        }
      } else if (isVehicleKind(kind) || isVehicleKind(m.userData?.kind)) {
        let id = m.uuid;
        for (let p: THREE.Object3D | null = m; p && p !== root; p = p.parent) if (isVehicleKind(p.userData?.kind) && p.userData?.id) id = String(p.userData.id);
        addVehicle(m, id);
      }
      // ── context ──
      const ctx = group === "context" || isContextKind(kind) || (!!parts && parts.every((p) => isContextKind(p.tags.kind)));
      if (ctx && !m.userData.nqGhost) this.ghostify(m);
    }
    // split meshes created on an earlier install are tagged "split": pick them up again (cached builds)
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.userData?.viewer === "split") {
        const id = String(partsOf(m)?.[0]?.tags.id ?? m.uuid);
        if (!byId.get(id)?.meshes.includes(m)) addVehicle(m, id);
      }
    });
    this.done.add(root);
    root.updateMatrixWorld(true);
    for (const v of byId.values()) {
      v.box.makeEmpty();
      for (const m of v.meshes) v.box.expandByObject(m);
      // cars bigger than a garage are not cars (defensive)
      const s = v.box.getSize(new THREE.Vector3());
      if (s.x > 12 || s.z > 12) continue;
      this.vehicles.push(v);
    }
  }

  private ghostify(m: THREE.Mesh) {
    m.geometry.computeBoundingBox();
    const bb = m.geometry.boundingBox;
    // flat ground pieces (road, footpath, kerbs) can never block the view
    if (bb && bb.max.y - bb.min.y < 0.35 && !m.userData.parts) return;
    m.userData.nqGhost = true;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const next = mats.map((mat) => {
      let c = this.solidClones.get(mat);
      if (!c) {
        c = mat.clone();
        patch(c, "solid");
        this.solidClones.set(mat, c);
        this.owned.push(c);
      }
      return c;
    });
    m.material = Array.isArray(m.material) ? next : next[0];
    if ((m as THREE.InstancedMesh).isInstancedMesh) return; // no overlay for instanced street trees etc.
    const ghosts = mats.map((mat) => {
      let c = this.ghostClones.get(mat);
      if (!c) {
        c = mat.clone();
        c.transparent = true;
        // drawn last (renderOrder) and depth-written: only the nearest ghosted face shows, so the veil is one even 15%
        c.depthWrite = true;
        patch(c, "ghost");
        this.ghostClones.set(mat, c);
        this.owned.push(c);
      }
      return c;
    });
    const overlay = new THREE.Mesh(m.geometry, Array.isArray(m.material) ? ghosts : ghosts[0]);
    overlay.userData = { noPick: true, viewer: "ghost" };
    overlay.renderOrder = 50;
    overlay.castShadow = false;
    overlay.receiveShadow = false;
    overlay.frustumCulled = m.frustumCulled;
    m.add(overlay);
  }

  /** Set the house box rays are tested against (world). */
  setHouseBox(b: THREE.Box3) {
    GHOST.nqBoxMin.value.copy(b.min);
    GHOST.nqBoxMax.value.copy(b.max);
  }

  /** Fade one vehicle (0 = hidden). Transparent clones are made on first use and kept. */
  setVehicleOpacity(v: Vehicle, a: number, suppress: (o: THREE.Object3D, hidden: boolean) => void) {
    a = Math.min(1, Math.max(0, a));
    if (Math.abs(a - v.opacity) < 1e-3 && !(a === 0 || a === 1)) return;
    v.opacity = a;
    for (const m of v.meshes) {
      if (a <= 0.001) {
        suppress(m, true);
        continue;
      }
      suppress(m, false);
      if (a >= 0.999) {
        const orig = v.originals.get(m);
        if (orig) {
          m.material = orig;
          v.originals.delete(m);
        }
        continue;
      }
      if (!v.originals.has(m)) v.originals.set(m, m.material);
      const src = v.originals.get(m)!;
      const list = Array.isArray(src) ? src : [src];
      const fade = list.map((mat) => {
        let c = v.clones.get(mat);
        if (!c) {
          c = mat.clone();
          c.transparent = true;
          c.depthWrite = false;
          v.clones.set(mat, c);
          this.owned.push(c);
        }
        c.opacity = (mat.opacity ?? 1) * a;
        return c;
      });
      m.material = Array.isArray(src) ? fade : fade[0];
    }
  }

  /**
   * The engine streams full-resolution textures into its materials after the build; carry them over to our
   * clones (ghost-able context, fading cars).
   */
  syncClones() {
    const pairs: [THREE.Material, THREE.Material][] = [...this.solidClones, ...this.ghostClones];
    for (const v of this.vehicles) pairs.push(...v.clones);
    for (const [src, dst] of pairs) {
      const a = src as THREE.MeshStandardMaterial, b = dst as THREE.MeshStandardMaterial;
      let recompile = false;
      for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap"] as const) {
        if (!(k in a)) continue;
        if (a[k] !== b[k]) {
          if (!a[k] !== !b[k]) recompile = true;
          (b as unknown as Record<string, unknown>)[k] = a[k];
        }
      }
      if ("roughness" in a) b.roughness = a.roughness;
      if ("metalness" in a) b.metalness = a.metalness;
      if (recompile) b.needsUpdate = true;
    }
  }

  /** World boxes of every vehicle, shrunk off the floor so the slab under a car stays solid. */
  exclusionBoxes(): THREE.Box3[] {
    return this.vehicles.map((v) => {
      const b = v.box.clone().expandByScalar(0.03);
      b.min.y += 0.06;
      return b;
    });
  }

  dispose() {
    for (const o of this.owned) o.dispose();
    this.owned = [];
    this.solidClones.clear();
    this.ghostClones.clear();
    this.vehicles = [];
  }
}
