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

export interface ColliderBVH {
  mesh: THREE.Mesh; // query-only; never added to the scene
  bvh: MeshBVH;
  triangles: number;
  bounds: THREE.Box3;
}

const _m = new THREE.Matrix4();

export function buildColliderBVH(meshes: THREE.Mesh[]): ColliderBVH | null {
  const group = new THREE.Group();
  for (const m of meshes) {
    if (!m?.geometry) continue;
    m.updateWorldMatrix(true, false); // REQUIRED: stale matrices collapse everything to the origin
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
