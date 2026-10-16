/**
 * One merged, static BVH collider from the engine's `colliders` (walls, slabs, invisible stair ramps, furniture…).
 *
 * Follows the tested recipe in docs/research/tech-stack.md §1.5: refresh world matrices first (or every mesh
 * collapses to the origin), then bake with StaticGeometryGenerator. Each source mesh gets a visible proxy with a
 * position-only, indexed geometry, because the generator skips invisible meshes (stair ramps are invisible) and
 * refuses to merge indexed with non-indexed geometry (BoxGeometry vs CSG output).
 */
import * as THREE from "three";
import { MeshBVH, StaticGeometryGenerator } from "three-mesh-bvh";

const proxyGeometryCache = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();

function positionOnly(src: THREE.BufferGeometry): THREE.BufferGeometry | null {
  const hit = proxyGeometryCache.get(src);
  if (hit) return hit;
  const pos = src.getAttribute("position") as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
  if (!pos || pos.count < 3) return null;
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    arr[i * 3] = pos.getX(i);
    arr[i * 3 + 1] = pos.getY(i);
    arr[i * 3 + 2] = pos.getZ(i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  let index: Uint32Array;
  if (src.index) {
    index = new Uint32Array(src.index.count);
    for (let i = 0; i < src.index.count; i++) index[i] = src.index.getX(i);
  } else {
    const n = pos.count - (pos.count % 3);
    index = new Uint32Array(n);
    for (let i = 0; i < n; i++) index[i] = i;
  }
  if (index.length < 3) return null;
  g.setIndex(new THREE.BufferAttribute(index, 1));
  proxyGeometryCache.set(src, g);
  return g;
}

/** Invisible stair helpers: only their walkable tops should collide. */
const RAMP_KIND = /(^|[:_])(ramp|landing)($|[:_])/;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _e1 = new THREE.Vector3(), _e2 = new THREE.Vector3();

/**
 * World-space top faces (normal·up > 0.3) of a stair ramp/landing. Their vertical sides would otherwise block a
 * walker stepping onto the first treads from the side (stairs whose foot is against a wall, which Argon plans
 * produce); the sloped top alone still pushes you back where the flight is already high.
 */
function rampTops(m: THREE.Mesh): THREE.BufferGeometry | null {
  const pos = m.geometry.getAttribute("position") as THREE.BufferAttribute | undefined;
  if (!pos) return null;
  const idx = m.geometry.index;
  const tris = idx ? idx.count / 3 : pos.count / 3;
  const out: number[] = [];
  const v = (i: number, t: THREE.Vector3) => t.fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(m.matrixWorld);
  for (let t = 0; t < tris; t++) {
    v(t * 3, _a);
    v(t * 3 + 1, _b);
    v(t * 3 + 2, _c);
    _n.crossVectors(_e1.subVectors(_b, _a), _e2.subVectors(_c, _a)).normalize();
    if (Math.abs(_n.y) < 0.3) continue; // drop the sides (keep tops; undersides are harmless for a floor follower)
    out.push(_a.x, _a.y, _a.z, _b.x, _b.y, _b.z, _c.x, _c.y, _c.z);
  }
  if (!out.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  const index = new Uint32Array(out.length / 3);
  for (let i = 0; i < index.length; i++) index[i] = i;
  g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
}

export interface ColliderBVH {
  mesh: THREE.Mesh; // query-only; never added to the scene
  bvh: MeshBVH;
  triangles: number;
  bounds: THREE.Box3;
}

const _m = new THREE.Matrix4();

export function buildColliderBVH(meshes: THREE.Mesh[]): ColliderBVH | null {
  const group = new THREE.Group();
  const temp: THREE.BufferGeometry[] = [];
  for (const m of meshes) {
    if (!m?.geometry) continue;
    m.updateWorldMatrix(true, false); // REQUIRED: stale matrices collapse everything to the origin
    if (typeof m.userData?.kind === "string" && RAMP_KIND.test(m.userData.kind) && !(m as unknown as THREE.InstancedMesh).isInstancedMesh) {
      const tops = rampTops(m); // already in world space
      if (tops) {
        temp.push(tops);
        group.add(new THREE.Mesh(tops));
      }
      continue;
    }
    const geo = positionOnly(m.geometry);
    if (!geo) continue;
    const inst = m as unknown as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, _m);
        const p = new THREE.Mesh(geo);
        p.matrixAutoUpdate = false;
        p.matrix.multiplyMatrices(m.matrixWorld, _m);
        group.add(p);
      }
    } else {
      const p = new THREE.Mesh(geo);
      p.matrixAutoUpdate = false;
      p.matrix.copy(m.matrixWorld);
      group.add(p);
    }
  }
  if (!group.children.length) return null;
  group.updateMatrixWorld(true); // REQUIRED: the generator bakes matrixWorld
  const gen = new StaticGeometryGenerator(group);
  gen.attributes = ["position"];
  gen.useGroups = false;
  const merged = gen.generate();
  temp.forEach((g) => g.dispose());
  const bvh = new MeshBVH(merged);
  merged.boundsTree = bvh;
  merged.computeBoundingBox();
  const mesh = new THREE.Mesh(merged);
  return { mesh, bvh, triangles: (merged.index?.count ?? 0) / 3, bounds: merged.boundingBox!.clone() };
}

export function disposeCollider(c: ColliderBVH | null) {
  if (!c) return;
  c.mesh.geometry.dispose();
}
