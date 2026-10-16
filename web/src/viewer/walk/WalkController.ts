/**
 * First-person walk physics (imperative, no React). Capsule vs one merged BVH (three-mesh-bvh), sub-stepped.
 *
 * Adapted from the tested controller in docs/research/tech-stack.md §1.5, with one change that makes stairs and
 * thresholds feel smooth: walls are resolved by a capsule that starts STEP_UP above the feet (horizontal push-out
 * only), while the feet follow the floor through short downward BVH raycasts. Steps < STEP_UP and the engine's
 * invisible stair ramps are climbed without bumps, gravity takes over beyond SNAP_DOWN, and the 1e-5 epsilon from
 * the research notes stops float noise from cancelling gravity.
 */
import * as THREE from "three";
import type { MeshBVH } from "three-mesh-bvh";
import { clamp, damp, easeInOutCubic } from "../core/units";

export const RADIUS = 0.28; // capsule radius (m): 2.5 ft doors (~0.66 m clear inside frames) pass comfortably
export const EYE = 1.6; // eye height (m)
const HEAD = 1.78; // top of the capsule
const STEP_UP = 0.36; // highest step climbed without a ramp (plinth/threshold/stair riser)
const SNAP_DOWN = 0.5; // follow floors/ramps downward up to this much per frame while grounded
const WALK = 1.5; // m/s
const RUN = 3.0; // m/s
const GRAVITY = -9.81 * 1.8;
const ACCEL = 11; // velocity smoothing (1/s)
const LOOK_SENS = 0.0022; // rad per pixel
const MAX_PITCH = THREE.MathUtils.degToRad(84);

export interface WalkInput {
  keys: Set<string>;
  joy: { x: number; y: number }; // touch joystick, −1..1 (y = forward)
  look: { dx: number; dy: number }; // accumulated pixels since the last frame
}

export interface WalkTransition {
  fromPos: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  fromFov: number;
  t: number;
  dur: number;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _seg = new THREE.Line3();
const _box = new THREE.Box3();
const _ray = new THREE.Ray();
const _euler = new THREE.Euler(0, 0, 0, "YXZ");
const _q = new THREE.Quaternion();
const _push = new THREE.Vector3();
const _before = new THREE.Vector3();
const DOWN = new THREE.Vector3(0, -1, 0);

export class WalkController {
  feet = new THREE.Vector3();
  yaw = 0;
  pitch = 0;
  vel = new THREE.Vector3();
  vy = 0;
  grounded = false;
  camY = 0;
  bvh: MeshBVH | null = null;
  spawn = { feet: new THREE.Vector3(), yaw: 0, pitch: 0 };
  transition: WalkTransition | null = null;
  fov = 70;
  input: WalkInput = { keys: new Set(), joy: { x: 0, y: 0 }, look: { dx: 0, dy: 0 } };
  /** true while the player is allowed to move (pointer locked / touch active). */
  enabled = false;
  private hasPose = false;

  setCollider(bvh: MeshBVH | null) {
    this.bvh = bvh;
  }

  /** Highest walkable surface under (x, z) between `top` and `bottom` (world Y), sampled at 5 points. */
  groundAt(p: THREE.Vector3, top: number, bottom: number): number | null {
    if (!this.bvh) return null;
    let best: number | null = null;
    const r = RADIUS * 0.55;
    const offs = [0, 0, r, 0, -r, 0, 0, r, 0, -r];
    for (let i = 0; i < offs.length; i += 2) {
      _ray.origin.set(p.x + offs[i], top, p.z + offs[i + 1]);
      _ray.direction.copy(DOWN);
      const hit = this.bvh.raycastFirst(_ray, THREE.DoubleSide, 0, top - bottom);
      if (hit && (best === null || hit.point.y > best)) best = hit.point.y;
    }
    return best;
  }

  /** Would a capsule standing at `feet` overlap walls or furniture? */
  overlaps(feet: THREE.Vector3): boolean {
    if (!this.bvh) return false;
    _seg.start.set(feet.x, feet.y + STEP_UP + RADIUS, feet.z);
    _seg.end.set(feet.x, feet.y + HEAD - RADIUS, feet.z);
    _box.makeEmpty().expandByPoint(_seg.start).expandByPoint(_seg.end);
    _box.min.addScalar(-RADIUS + 0.02);
    _box.max.addScalar(RADIUS - 0.02);
    let hit = false;
    this.bvh.shapecast({
      intersectsBounds: (box) => box.intersectsBox(_box),
      intersectsTriangle: (tri) => {
        if (tri.closestPointToSegment(_seg, _v, _v2) < RADIUS - 0.02) {
          hit = true;
          return true;
        }
      },
    });
    return hit;
  }

  /**
   * Nearest free standing spot to `pos` on the floor at ~`floorY` (spiral search, ≤ 3 m). Engines sometimes put the
   * spawn on a parked car or a planter; this keeps the walkthrough from starting on a roof or inside a wall.
   */
  findFreeSpot(pos: THREE.Vector3, floorY: number): THREE.Vector3 | null {
    const p = new THREE.Vector3();
    for (let r = 0; r <= 3.0001; r += 0.25) {
      const n = r === 0 ? 1 : Math.ceil((2 * Math.PI * r) / 0.35);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        p.set(pos.x + Math.cos(a) * r, floorY, pos.z + Math.sin(a) * r);
        const g = this.groundAt(p, floorY + STEP_UP + 0.02, floorY - 0.6);
        if (g === null || Math.abs(g - floorY) > 0.3) continue;
        p.y = g;
        if (!this.overlaps(p)) return p.clone();
      }
    }
    return null;
  }

  /** Place the walker (feet on the floor below `pos`, nudged to a free spot) looking at `lookAt`. */
  teleport(pos: THREE.Vector3, lookAt?: THREE.Vector3) {
    const floor = this.groundAt(pos, pos.y + 0.3, pos.y - 3);
    const spot = floor !== null ? this.findFreeSpot(pos, floor) : null;
    const g = spot ? spot.y : floor;
    this.feet.set(spot?.x ?? pos.x, g ?? pos.y, spot?.z ?? pos.z);
    if (lookAt) {
      _v.subVectors(lookAt, _v2.set(pos.x, this.feet.y + EYE, pos.z));
      this.yaw = Math.atan2(-_v.x, -_v.z);
      this.pitch = clamp(Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), -0.5, 0.5);
    }
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.grounded = g !== null;
    this.camY = this.feet.y + EYE;
    this.hasPose = true;
  }

  setSpawn(pos: THREE.Vector3, lookAt: THREE.Vector3) {
    this.teleport(pos, lookAt);
    this.spawn.feet.copy(this.feet);
    this.spawn.yaw = this.yaw;
    this.spawn.pitch = this.pitch;
  }

  get ready() {
    return this.hasPose;
  }

  respawn() {
    this.feet.copy(this.spawn.feet);
    this.yaw = this.spawn.yaw;
    this.pitch = this.spawn.pitch;
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.camY = this.feet.y + EYE;
  }

  /** Eased fly-in from the current camera pose to the walker's eye. */
  beginTransition(camera: THREE.PerspectiveCamera, dur = 1.1) {
    this.transition = { fromPos: camera.position.clone(), fromQuat: camera.quaternion.clone(), fromFov: camera.fov, t: 0, dur };
  }

  eyePosition(out: THREE.Vector3) {
    return out.set(this.feet.x, this.camY, this.feet.z);
  }

  eyeQuaternion(out: THREE.Quaternion) {
    _euler.set(this.pitch, this.yaw, 0, "YXZ");
    return out.setFromEuler(_euler);
  }

  /** Advance one frame and write the camera. Returns true while something moved. */
  update(dt: number, camera: THREE.PerspectiveCamera): boolean {
    dt = Math.min(dt, 0.1);
    if (this.transition) return this.updateTransition(dt, camera);

    // look
    const { look, keys, joy } = this.input;
    if (this.enabled && (look.dx || look.dy)) {
      this.yaw -= look.dx * LOOK_SENS;
      this.pitch = clamp(this.pitch - look.dy * LOOK_SENS, -MAX_PITCH, MAX_PITCH);
    }
    look.dx = 0;
    look.dy = 0;

    // wish direction from keys + joystick, relative to yaw
    let f = 0, s = 0;
    if (this.enabled) {
      if (keys.has("KeyW") || keys.has("ArrowUp")) f += 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) f -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) s += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) s -= 1;
      f += joy.y;
      s += joy.x;
    }
    const len = Math.hypot(f, s);
    if (len > 1) { f /= len; s /= len; }
    const run = keys.has("ShiftLeft") || keys.has("ShiftRight") || Math.hypot(joy.x, joy.y) > 0.92;
    const speed = run ? RUN : WALK;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward = (−sin, 0, −cos), right = (cos, 0, −sin)
    const wx = (-sin * f + cos * s) * speed;
    const wz = (-cos * f - sin * s) * speed;
    const k = damp(ACCEL, dt);
    this.vel.x += (wx - this.vel.x) * k;
    this.vel.z += (wz - this.vel.z) * k;
    if (Math.abs(this.vel.x) < 1e-4) this.vel.x = 0;
    if (Math.abs(this.vel.z) < 1e-4) this.vel.z = 0;

    const before = _before.copy(this.feet);
    const moveLen = Math.hypot(this.vel.x, this.vel.z) * dt;
    if (this.bvh) {
      const steps = clamp(Math.ceil(moveLen / 0.035), 1, 10);
      for (let i = 0; i < steps; i++) {
        this.feet.x += (this.vel.x * dt) / steps;
        this.feet.z += (this.vel.z * dt) / steps;
        this.resolveWalls();
      }
      this.followFloor(dt);
    } else {
      this.feet.x += this.vel.x * dt;
      this.feet.z += this.vel.z * dt;
    }
    // walls ate the motion: kill velocity along the blocked axis so we don't "stick"
    if (moveLen > 1e-5 && dt > 0) {
      const realX = (this.feet.x - before.x) / dt, realZ = (this.feet.z - before.z) / dt;
      this.vel.x = Math.abs(realX) < Math.abs(this.vel.x) ? realX : this.vel.x;
      this.vel.z = Math.abs(realZ) < Math.abs(this.vel.z) ? realZ : this.vel.z;
    }
    if (this.feet.y < -25) this.respawn();

    // camera: smooth vertical motion over steps, exact when falling
    const eye = this.feet.y + EYE;
    const dy = eye - this.camY;
    this.camY = Math.abs(dy) > 0.9 || !this.grounded ? eye : this.camY + dy * damp(16, dt);
    camera.position.set(this.feet.x, this.camY, this.feet.z);
    camera.quaternion.copy(this.eyeQuaternion(_q));
    camera.updateMatrixWorld();
    return moveLen > 1e-5 || Math.abs(dy) > 1e-4 || !this.grounded;
  }

  private updateTransition(dt: number, camera: THREE.PerspectiveCamera) {
    const tr = this.transition!;
    tr.t = Math.min(1, tr.t + dt / tr.dur);
    const e = easeInOutCubic(tr.t);
    this.camY = this.feet.y + EYE;
    const toPos = this.eyePosition(_v);
    // arc slightly upward mid-flight so we don't clip through the porch roof
    camera.position.lerpVectors(tr.fromPos, toPos, e);
    camera.position.y += Math.sin(e * Math.PI) * 1.2 * Math.max(0, 1 - toPos.distanceTo(tr.fromPos) / 60);
    camera.quaternion.slerpQuaternions(tr.fromQuat, this.eyeQuaternion(_q), e);
    camera.fov = tr.fromFov + (this.fov - tr.fromFov) * e;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    if (tr.t >= 1) this.transition = null;
    return true;
  }

  /** Horizontal capsule push-out against everything that isn't floor/ceiling-like. */
  private resolveWalls() {
    const bvh = this.bvh!;
    _seg.start.set(this.feet.x, this.feet.y + STEP_UP + RADIUS, this.feet.z);
    _seg.end.set(this.feet.x, this.feet.y + HEAD - RADIUS, this.feet.z);
    for (let iter = 0; iter < 3; iter++) {
      _box.makeEmpty().expandByPoint(_seg.start).expandByPoint(_seg.end);
      _box.min.addScalar(-RADIUS);
      _box.max.addScalar(RADIUS);
      let moved = false;
      bvh.shapecast({
        intersectsBounds: (box) => box.intersectsBox(_box),
        intersectsTriangle: (tri) => {
          const triPoint = _v, capPoint = _v2;
          const d = tri.closestPointToSegment(_seg, triPoint, capPoint);
          if (d >= RADIUS) return;
          _push.subVectors(capPoint, triPoint);
          _push.y = 0;
          let h = _push.length();
          if (h < 1e-6) {
            // segment touches the triangle: fall back to its normal
            tri.getNormal(_push);
            _push.y = 0;
            h = _push.length();
          }
          if (h < 0.2 * Math.max(d, 1e-6) || h < 1e-6) return; // floor/ceiling-like contact: the floor follower owns Y
          const depth = RADIUS - d;
          _push.multiplyScalar(depth / h);
          _seg.start.add(_push);
          _seg.end.add(_push);
          moved = true;
        },
      });
      if (!moved) break;
    }
    const nx = _seg.start.x, nz = _seg.start.z;
    const dx = nx - this.feet.x, dz = nz - this.feet.z;
    const off = Math.hypot(dx, dz);
    if (off > 1e-5) {
      const s = Math.max(0, off - 1e-5) / off; // ignore float noise (research note: required)
      this.feet.x += dx * s;
      this.feet.z += dz * s;
    }
  }

  private followFloor(dt: number) {
    const top = this.feet.y + STEP_UP + 0.02;
    if (this.grounded) {
      const g = this.groundAt(this.feet, top, this.feet.y - SNAP_DOWN);
      if (g !== null) {
        this.feet.y = g;
        this.vy = 0;
        return;
      }
      this.grounded = false;
    }
    // airborne
    this.vy += GRAVITY * dt;
    const nextY = this.feet.y + this.vy * dt;
    const g = this.groundAt(this.feet, top, Math.min(nextY, this.feet.y) - 0.05);
    if (g !== null && nextY <= g + 1e-5) {
      this.feet.y = g;
      this.vy = 0;
      this.grounded = true;
    } else this.feet.y = nextY;
  }
}
