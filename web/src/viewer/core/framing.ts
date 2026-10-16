/** Camera framing: the hero 3/4 aerial front view and helpers. World mapping: x = x_ft, z = −y_ft (road at +z). */
import * as THREE from "three";
import type { BuildingPlan } from "@contracts/plan";
import { planToWorld } from "./units";

/** World box of the plot, from the road edge up to the top of the mumty/parapet. */
export function plotBox(plan: BuildingPlan): THREE.Box3 {
  const { width_ft: W, depth_ft: D } = plan.site.plot;
  const top = Math.max(...plan.levels.map((l) => l.elevation_ft + l.height_ft), 10) + (plan.roof?.mumty?.height_ft ?? 0) * 0.6;
  return new THREE.Box3().setFromPoints([planToWorld(0, 0, 0), planToWorld(W, D, top)]);
}

/** Box of the built footprint (enclosed rooms), used to focus shadows and the orbit target. */
export function houseBox(plan: BuildingPlan): THREE.Box3 {
  const outdoor = new Set(["lawn", "driveway", "open_space", "courtyard"]);
  const rooms = plan.rooms.filter((r) => !outdoor.has(r.type));
  const b = new THREE.Box3();
  for (const r of rooms) {
    b.expandByPoint(planToWorld(r.rect.x, r.rect.y, 0));
    b.expandByPoint(planToWorld(r.rect.x + r.rect.w, r.rect.y + r.rect.d, 0));
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
 * A 3/4 aerial view of the front (the road side, +z). `side` = +1 looks from the +X side (plan right),
 * −1 from −X. Distance is solved so the whole plot fits with margins (room for HUD overlays).
 * Neighbouring houses sit right beside a plot (zero side setbacks), so the view looks over them.
 */
export function heroPose(plan: BuildingPlan, camera: THREE.PerspectiveCamera, side: 1 | -1 = 1, azimuthDeg = 30, elevationDeg = 31) {
  const box = plotBox(plan);
  const size = box.getSize(new THREE.Vector3());
  const target = box.getCenter(new THREE.Vector3());
  target.y = size.y * 0.32;
  target.z += size.z * 0.06; // bias toward the front facade (front edge is the box's max z)
  const az = THREE.MathUtils.degToRad(azimuthDeg) * side;
  const el = THREE.MathUtils.degToRad(elevationDeg);
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
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

/**
 * The volume neighbours must never hide (orbit ghosting): the whole plot, from just above the ground to the top of
 * the stair tower and water tank.
 */
export function ghostBox(plan: BuildingPlan): THREE.Box3 {
  const { width_ft: W, depth_ft: D } = plan.site.plot;
  const roofTop = Math.max(...plan.levels.map((l) => l.elevation_ft + l.height_ft), 10);
  const tower = Math.max(plan.roof?.mumty?.height_ft ?? 0, plan.roof?.water_tank?.height_ft ?? 0);
  return new THREE.Box3().setFromPoints([planToWorld(0, 0, 0.4), planToWorld(W, D, roofTop + tower + 1)]);
}

/** An aerial three-quarter view into one room (dollhouse cut), keeping the current compass direction. */
export function roomPose(rect: { x: number; y: number; w: number; d: number }, floorFt: number, azimuth: number) {
  const target = planToWorld(rect.x + rect.w / 2, rect.y + rect.d / 2, floorFt + 2.5);
  const diag = Math.hypot(rect.w, rect.d) * 0.3048;
  const dist = THREE.MathUtils.clamp(diag * 1.55 + 3.5, 7, 26);
  const el = THREE.MathUtils.degToRad(52);
  const dir = new THREE.Vector3(Math.sin(azimuth) * Math.cos(el), Math.sin(el), Math.cos(azimuth) * Math.cos(el));
  return { position: target.clone().addScaledVector(dir, dist), target };
}

