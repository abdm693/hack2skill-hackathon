/**
 * Orbit floor focus motion (DESIGN "Floor stack · In Orbit: the floors above lift 1.5 m and fade (420 ms)").
 *
 * Hiding: the floors above are hidden at once and a translucent clay stand-in of them (same geometry, one shared
 * material, so no per-material shader variants) lifts 1.5 m while it fades out.
 * Showing: the real floors come back lifted and settle into place.
 */
import * as THREE from "three";
import { easeOutCubic, smoothstep } from "./units";

const LIFT = 1.5;
const DUR = 420;

const CLAY = new THREE.MeshLambertMaterial({ color: "#e4dfd6", transparent: true, opacity: 0.8, depthWrite: true });
CLAY.name = "nq-floor-lift";

interface Out {
  group: THREE.Group;
  start: number;
}
interface In {
  objs: { o: THREE.Object3D; y: number }[];
  start: number;
}

export class FloorLift {
  private outs: Out[] = [];
  private ins: In[] = [];

  get active() {
    return this.outs.length > 0 || this.ins.length > 0;
  }

  /** Stand-ins for `meshes` (currently visible, about to be hidden) that lift and fade. */
  liftAway(meshes: THREE.Mesh[], parent: THREE.Object3D) {
    if (!meshes.length) return;
    const group = new THREE.Group();
    group.name = "nq-floor-lift";
    group.userData = { noPick: true, viewer: "lift" };
    for (const m of meshes) {
      if ((m as THREE.InstancedMesh).isInstancedMesh || !m.geometry) continue;
      m.updateWorldMatrix(true, false);
      const g = new THREE.Mesh(m.geometry, CLAY);
      g.matrixAutoUpdate = false;
      g.matrix.copy(m.matrixWorld);
      g.userData = { noPick: true, viewer: "lift" };
      group.add(g);
    }
    group.matrixAutoUpdate = true;
    parent.add(group);
    this.outs.push({ group, start: performance.now() });
  }

  /** Real objects that just became visible: start them lifted and settle them. */
  settleIn(objs: THREE.Object3D[]) {
    if (!objs.length) return;
    const list = objs.map((o) => ({ o, y: o.position.y }));
    for (const it of list) {
      it.o.position.y = it.y + LIFT;
      it.o.updateMatrix();
    }
    this.ins.push({ objs: list, start: performance.now() });
  }

  /** Advance; returns true while anything moved. */
  tick(now: number): boolean {
    if (!this.active) return false;
    let w = 0;
    for (const a of this.outs) {
      const t = Math.min(1, (now - a.start) / DUR);
      const e = easeOutCubic(t);
      a.group.position.y = LIFT * e;
      // rise first, then dissolve
      CLAY.opacity = 0.8 * (1 - smoothstep(0.2, 1, t));
      if (t < 1) this.outs[w++] = a;
      else a.group.removeFromParent();
    }
    this.outs.length = w;
    w = 0;
    for (const a of this.ins) {
      const t = Math.min(1, (now - a.start) / DUR);
      const e = easeOutCubic(t);
      for (const it of a.objs) {
        it.o.position.y = it.y + LIFT * (1 - e);
        it.o.updateMatrix();
      }
      if (t < 1) this.ins[w++] = a;
    }
    this.ins.length = w;
    return true;
  }

  /** Snap everything to rest (before captures, rebuilds, walking). */
  finish() {
    for (const a of this.outs) a.group.removeFromParent();
    this.outs.length = 0;
    for (const a of this.ins)
      for (const it of a.objs) {
        it.o.position.y = it.y;
        it.o.updateMatrix();
      }
    this.ins.length = 0;
  }
}
