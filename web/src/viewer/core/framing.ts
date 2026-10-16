/** Camera framing: the hero 3/4 aerial front view and helpers. */
import * as THREE from "three";
import type { BuildingPlan } from "@contracts/plan";
import { FT } from "./units";

/** World box of the plot, from the road edge up to the top of the mumty/parapet. */
export function plotBox(plan: BuildingPlan): THREE.Box3 {
  const { width_ft: W, depth_ft: D } = plan.site.plot;
  const top = Math.max(...plan.levels.map((l) => l.elevation_ft + l.height_ft), 10) + (plan.roof?.mumty?.height_ft ?? 0) * 0.6;
  return new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(W * FT, top * FT, D * FT));
}

/** Box of the built footprint (enclosed rooms), used to focus shadows and the orbit target. */
export function houseBox(plan: BuildingPlan): THREE.Box3 {
  const outdoor = new Set(["lawn", "driveway", "open_space", "courtyard"]);
  const rooms = plan.rooms.filter((r) => !outdoor.has(r.type));
  const b = new THREE.Box3();
  for (const r of rooms) {
    b.expandByPoint(new THREE.Vector3(r.rect.x * FT, 0, r.rect.y * FT));
    b.expandByPoint(new THREE.Vector3((r.rect.x + r.rect.w) * FT, 0, (r.rect.y + r.rect.d) * FT));
  }
  if (b.isEmpty()) return plotBox(plan);
  b.max.y = plotBox(plan).max.y;
  return b;
}

const _v = new THREE.Vector3();

function fits(camera: THREE.PerspectiveCamera, corners: THREE.Vector3[], pos: THREE.Vector3, target: THREE.Vector3, mx: number, my: number) {
  camera.position.copy(pos);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  for (const c of corners) {
    _v.copy(c).project(camera);
    if (Math.abs(_v.x) > mx || Math.abs(_v.y) > my || _v.z > 1) return false;
  }
  return true;
}

/**
 * A 3/4 aerial view of the front, `side` = +1 looks from the +X side, −1 from −X.
 * Distance is solved so the whole plot fits with margins (room for HUD overlays).
 */
export function heroPose(plan: BuildingPlan, camera: THREE.PerspectiveCamera, side: 1 | -1 = 1, azimuthDeg = 36, elevationDeg = 24) {
  const box = plotBox(plan);
  const size = box.getSize(new THREE.Vector3());
  const target = box.getCenter(new THREE.Vector3());
  target.y = size.y * 0.32;
  target.z -= size.z * 0.06; // bias toward the front facade
  const az = THREE.MathUtils.degToRad(azimuthDeg) * side;
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
  const corners: THREE.Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  const saved = { p: camera.position.clone(), q: camera.quaternion.clone() };
  let lo = 2, hi = 400;
  const pos = new THREE.Vector3();
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    pos.copy(target).addScaledVector(dir, mid);
    if (fits(camera, corners, pos, target, 0.84, 0.74)) hi = mid;
    else lo = mid;
  }
  pos.copy(target).addScaledVector(dir, hi);
  camera.position.copy(saved.p);
  camera.quaternion.copy(saved.q);
  camera.updateMatrixWorld();
  return { position: pos, target };
}
