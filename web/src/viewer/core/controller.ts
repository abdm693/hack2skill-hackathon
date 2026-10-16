/**
 * ViewerController: the imperative core behind <HouseViewer>. React renders the shell once; everything that
 * changes per frame (camera, walk physics, hover, pins, animations) lives here, outside React state.
 */
import * as THREE from "three";
import type CameraControlsImpl from "camera-controls";
import type { EffectComposer as EffectComposerImpl, OutlineEffect } from "postprocessing";
import type { BuildingPlan } from "@contracts/plan";
import type { Comment, CommentAnchor, Vec3 } from "@contracts/api-types";
import type { BuildResult, SectionResult } from "@/engine";
import type { HouseViewerProps } from "../HouseViewer";
import { BuildManager } from "./build";
import { grabCanvas, projectToNdc } from "./capture";
import { heroPose, houseBox, plotBox } from "./framing";
import { hitNormal, pick, accelerateLater } from "./pick";
import { makeViewerStore, type BuildState, type Quality, type ViewerMode, type ViewerStore } from "./store";
import { sunState, type Facing } from "./sun";
import { displayLabel, resolveHitTags, type PartRange } from "./tags";
import { FT, damp, isCoarsePointer, prefersReducedMotion } from "./units";
import { VisibilityController, type LevelBand } from "./visibility";
import { Atmosphere } from "../scene/atmosphere";
import { buildColliderBVH, disposeCollider, type ColliderBVH } from "../walk/collider";
import { EYE, WalkController } from "../walk/WalkController";

export type SuspendableControls = CameraControlsImpl & { suspended: boolean };

type ModeSource = "props" | "handle" | "user" | "flyTo";

const ORBIT_FOV = 50;
const WALK_FOV = 70;
const MOVE_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ShiftLeft", "ShiftRight"]);

const v3 = (v: THREE.Vector3): Vec3 => [round(v.x), round(v.y), round(v.z)];
const round = (n: number) => Math.round(n * 1000) / 1000;
const isEditable = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
};

interface OutlineTarget {
  obj: THREE.Object3D;
  part: PartRange | null;
}

/** Invisible in the beauty pass; the Outline effect renders its own mask from the selection layer. */
const OVERLAY_MAT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

/** Geometry of one consolidated part (triangle range) as a child of the merged mesh, for outlining. */
function partOverlay(mesh: THREE.Mesh, part: PartRange): THREE.Mesh | null {
  const g = mesh.geometry;
  const pos = g.getAttribute("position");
  if (!pos || part.count <= 0) return null;
  const count = Math.min(part.count, 60000);
  const out = new Float32Array(count * 9);
  const idx = g.index;
  for (let t = 0; t < count; t++) {
    for (let k = 0; k < 3; k++) {
      const i = (part.start + t) * 3 + k;
      const vi = idx ? (i < idx.count ? idx.getX(i) : 0) : i;
      out[(t * 3 + k) * 3] = pos.getX(vi);
      out[(t * 3 + k) * 3 + 1] = pos.getY(vi);
      out[(t * 3 + k) * 3 + 2] = pos.getZ(vi);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(out, 3));
  const m = new THREE.Mesh(geo, OVERLAY_MAT);
  m.userData = { noPick: true, viewer: "outline-part" };
  m.renderOrder = mesh.renderOrder;
  return m;
}

export interface ThreeBits {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  invalidate: () => void;
}

export class ViewerController {
  readonly store: ViewerStore;
  readonly vis = new VisibilityController();
  readonly walk = new WalkController();
  readonly builds: BuildManager;
  readonly holder = new THREE.Group();
  props: HouseViewerProps;

  gl: THREE.WebGLRenderer | null = null;
  scene: THREE.Scene | null = null;
  camera: THREE.PerspectiveCamera | null = null;
  atmosphere: Atmosphere | null = null;
  controls: SuspendableControls | null = null;
  composer: EffectComposerImpl | null = null;
  outline: OutlineEffect | null = null;
  pinsGroup: THREE.Group | null = null;
  container: HTMLDivElement | null = null;
  tooltipEl: HTMLDivElement | null = null;
  minimapMarker: SVGGElement | null = null;

  private r3fInvalidate: (() => void) | null = null;
  private raycaster = new THREE.Raycaster();
  private collider: ColliderBVH | null = null;
  private colliderDirty = true;
  private colliderTimer = 0;
  private engineSun: THREE.DirectionalLight | null = null;
  private engineHemi: THREE.HemisphereLight | null = null;
  private cancelAccel: (() => void) | null = null;
  private hoverPending: { x: number; y: number } | null = null;
  private hoverKey = "";
  private crosshairAt = 0;
  private roomAt = 0;
  private pinCursor = 0;
  private fovTarget = ORBIT_FOV;
  private shadowsDirty = true;
  private perf = { samples: 0, sum: 0, settleUntil: 0, locked: false };
  private dragLook = false;
  private down: { x: number; y: number; t: number; button: number } | null = null;
  private sectionPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  private spawnedFor = new WeakSet<BuildResult>();
  private heroDone = false;
  private userMovedCamera = false;
  private readyWaiters: (() => void)[] = [];
  private toastSeq = 0;
  private toastTimer = 0;
  private draftTimer = 0;
  private pinEls = new Map<string, HTMLElement | null>();
  private disposed = false;
  private unmountTimer = 0;
  result: BuildResult | null = null;

  constructor(props: HouseViewerProps) {
    this.props = props;
    this.store = makeViewerStore("orbit", isCoarsePointer());
    this.builds = new BuildManager(this);
    this.holder.name = "naqsha-house";
    this.raycaster.layers.enableAll();
    try {
      const q = localStorage.getItem("naqsha.viewer.quality") as Quality | null;
      if (q === "high" || q === "balanced" || q === "performance") {
        this.store.setState({ quality: q });
        this.perf.locked = true;
      }
    } catch {
      /* storage blocked */
    }
  }

  get plan(): BuildingPlan {
    return this.props.plan;
  }

  /** Imperative handle exposed through forwardRef (contracts/web-modules.md). */
  readonly handle = {
    capture: (opts?: { width?: number; height?: number }) => this.capture(opts),
    flyTo: (comment: Comment) => this.flyTo(comment),
    setMode: (mode: ViewerMode) => this.setMode(mode, "handle"),
  };

  // ───────────────────────────── lifecycle ─────────────────────────────

  mount() {
    window.clearTimeout(this.unmountTimer);
    this.disposed = false;
    window.addEventListener("keydown", this.onKeyDown, { capture: true });
    window.addEventListener("keyup", this.onKeyUp, { capture: true });
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    document.addEventListener("pointerlockerror", this.onPointerLockError);
    document.addEventListener("mousemove", this.onLockedMouseMove);
  }

  /** Deferred so a StrictMode remount (unmount → mount in the same tick) keeps the built house. */
  unmount() {
    window.removeEventListener("keydown", this.onKeyDown, { capture: true });
    window.removeEventListener("keyup", this.onKeyUp, { capture: true });
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    document.removeEventListener("pointerlockerror", this.onPointerLockError);
    document.removeEventListener("mousemove", this.onLockedMouseMove);
    if (this.isLocked()) document.exitPointerLock?.();
    this.unmountTimer = window.setTimeout(() => this.dispose(), 0);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.builds.cancel();
    this.builds.invalidate();
    this.cancelAccel?.();
    disposeCollider(this.collider);
    this.collider = null;
    const shown = this.builds.displayed;
    if (shown) {
      shown.result.root.removeFromParent();
      try {
        shown.result.dispose();
      } catch {
        /* ignore */
      }
      this.builds.displayed = null;
    }
    this.result = null;
    window.clearTimeout(this.toastTimer);
    window.clearTimeout(this.draftTimer);
    if (import.meta.env.DEV && (window as unknown as { __viewerDebug?: { ctrl?: unknown } }).__viewerDebug?.ctrl === this) {
      delete (window as unknown as { __viewerDebug?: unknown }).__viewerDebug;
    }
  }

  attachThree(t: ThreeBits) {
    this.gl = t.gl;
    this.scene = t.scene;
    this.camera = t.camera;
    this.r3fInvalidate = t.invalidate;
    t.scene.add(this.holder);
    t.gl.shadowMap.autoUpdate = false;
    t.gl.shadowMap.needsUpdate = true;
    t.gl.localClippingEnabled = false;
    // transmission glass re-renders the opaque scene every frame; half resolution is visually identical here
    t.gl.transmissionResolutionScale = 0.5;
    // big, dense canvases (e.g. a 1440-wide panel on a retina laptop) start one tier down
    if (!this.perf.locked) {
      const px = t.gl.domElement.clientWidth * t.gl.domElement.clientHeight * Math.min(window.devicePixelRatio || 1, 1.5) ** 2;
      if (px > 2.6e6) this.store.setState({ quality: "balanced" });
    }
    t.camera.near = 0.08;
    t.camera.far = 3000;
    t.camera.fov = ORBIT_FOV;
    t.camera.updateProjectionMatrix();
    this.atmosphere = new Atmosphere(t.gl, t.scene);
    this.atmosphere.shadowFocus.copy(houseBox(this.plan)).expandByScalar(1.5);
    const plotCenter = plotBox(this.plan).getCenter(new THREE.Vector3());
    this.atmosphere.ground.position.set(plotCenter.x, -0.06, plotCenter.z);
    this.atmosphere.configureShadow(this.atmosphere.fallbackSun, this.store.getState().quality);
    this.syncSun();
    this.syncSectionCut();
    this.syncVisibility();
    this.placeHero(false);
    if (this.store.getState().mode === "walk") this.enterWalk(true);
    this.readyWaiters.splice(0).forEach((r) => r());
    if (import.meta.env.DEV) this.installDebug();
  }

  detachThree() {
    this.holder.removeFromParent();
    this.atmosphere?.dispose();
    this.atmosphere = null;
    this.gl = null;
    this.scene = null;
    this.camera = null;
    this.r3fInvalidate = null;
  }

  attachControls(c: SuspendableControls | null) {
    this.controls = c;
    if (!c) return;
    c.smoothTime = 0.3;
    c.draggingSmoothTime = 0.12;
    c.dollyToCursor = true;
    c.minDistance = 1.2;
    c.maxDistance = 180;
    c.maxPolarAngle = Math.PI / 2 - 0.035;
    c.dollySpeed = 0.6;
    c.truckSpeed = 1.6;
    c.restThreshold = 0.004;
    c.suspended = this.store.getState().mode === "walk";
    c.enabled = !c.suspended;
    const b = plotBox(this.plan).expandByScalar(18);
    b.min.y = -2;
    c.setBoundary(b);
    c.addEventListener("controlstart", () => {
      this.userMovedCamera = true;
      this.clearHover();
    });
    this.placeHero(false);
  }

  whenReady(): Promise<void> {
    if (this.gl) return Promise.resolve();
    return new Promise((r) => this.readyWaiters.push(r));
  }

  setProps(p: HouseViewerProps) {
    this.props = p;
  }

  setContainer = (el: HTMLDivElement | null) => {
    if (this.container) {
      const c = this.container;
      c.removeEventListener("pointerdown", this.onPointerDown);
      c.removeEventListener("pointermove", this.onPointerMove);
      c.removeEventListener("pointerup", this.onPointerUp);
      c.removeEventListener("pointerleave", this.onPointerLeave);
      c.removeEventListener("dblclick", this.onDblClick);
      c.removeEventListener("wheel", this.onWheel);
      c.removeEventListener("contextmenu", this.onContextMenu);
    }
    this.container = el;
    if (!el) return;
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointerleave", this.onPointerLeave);
    el.addEventListener("dblclick", this.onDblClick);
    el.addEventListener("wheel", this.onWheel, { passive: true });
    el.addEventListener("contextmenu", this.onContextMenu);
  };

  invalidate() {
    this.r3fInvalidate?.();
  }

  markDirty() {
    this.shadowsDirty = true;
    this.invalidate();
  }

  // ───────────────────────────── per frame ─────────────────────────────

  frame(dt: number) {
    const cam = this.camera, gl = this.gl;
    if (!cam || !gl) return;
    const now = performance.now();
    let busy = false;
    if (this.builds.tick(now)) {
      busy = true;
      this.shadowsDirty = true;
    }
    const mode = this.store.getState().mode;
    if (mode === "orbit" && Math.abs(cam.fov - this.fovTarget) > 0.02) {
      cam.fov += (this.fovTarget - cam.fov) * damp(7, dt);
      if (Math.abs(cam.fov - this.fovTarget) < 0.05) cam.fov = this.fovTarget;
      cam.updateProjectionMatrix();
      busy = true;
    }
    if (mode === "walk") this.walkFrame(dt, now, cam);
    else if (this.hoverPending) this.processHover();
    this.updatePins(cam);
    if (this.colliderDirty && mode === "walk" && now > this.colliderTimer) this.ensureCollider();
    if (this.shadowsDirty) {
      gl.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }
    gl.toneMappingExposure = (this.atmosphere?.exposure ?? 1) * (mode === "walk" ? 1.1 : 1);
    this.monitorPerf(dt, now);
    if (busy) this.invalidate();
  }

  private walkFrame(dt: number, now: number, cam: THREE.PerspectiveCamera) {
    const wasIntro = !!this.walk.transition;
    this.walk.update(dt, cam);
    if (wasIntro && !this.walk.transition) this.onIntroDone();
    if (this.minimapMarker) {
      const x = this.walk.feet.x / FT, y = this.walk.feet.z / FT;
      this.minimapMarker.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${((-this.walk.yaw * 180) / Math.PI).toFixed(1)})`);
    }
    if (now - this.roomAt > 200) {
      this.roomAt = now;
      this.updateRoomLabel();
    }
    if (now - this.crosshairAt > 120 && this.store.getState().walk === "active") {
      this.crosshairAt = now;
      this.updateCrosshairTarget();
    }
  }

  // ───────────────────────────── build hooks (called by BuildManager) ─────────────────────────────

  setBuildState(partial: Partial<BuildState>) {
    this.store.setState((s) => ({ build: { ...s.build, ...partial } }));
  }

  levelIndexMap() {
    return new Map(this.plan.levels.map((l) => [l.id, l.index] as [string, number]));
  }

  currentRoot(): THREE.Object3D | null {
    return this.holder.children[0] ?? null;
  }

  onRootAttached(root: THREE.Group) {
    this.cancelAccel?.();
    this.cancelAccel = null;
    this.engineSun = null;
    this.engineHemi = null;
    // the previous result was disposed by the swap; walking keeps using its merged BVH until the new build lands
    this.result = null;
    this.atmosphere?.setFallbackActive(true);
    this.configureVisibility();
    this.vis.apply(root);
    this.clearHover();
    this.markDirty();
  }

  onSectionApplied(root: THREE.Object3D, r: SectionResult | null) {
    this.vis.apply(root);
    if (!this.engineSun || r?.layer === "lighting") this.adoptEngineSun(root);
    this.markDirty();
  }

  onBuildComplete(result: BuildResult, _mock: boolean) {
    this.result = result;
    this.configureVisibility();
    this.vis.apply(result.root);
    this.adoptEngineSun(result.root);
    if (this.atmosphere) {
      this.atmosphere.shadowFocus.copy(houseBox(this.plan)).expandByScalar(1.5);
      const sun = this.engineSun ?? this.atmosphere.fallbackSun;
      this.atmosphere.configureShadow(sun, this.store.getState().quality);
    }
    this.syncSun();
    this.colliderDirty = true;
    this.cancelAccel?.();
    this.cancelAccel = accelerateLater(result.root);
    this.perf.settleUntil = performance.now() + 2500;
    if (this.store.getState().mode === "walk") {
      this.ensureCollider();
      if (!this.walk.ready || this.walkerOnFallback) this.spawnWalker(true);
    }
    this.pinEls.clear();
    this.markDirty();
  }

  onAnimationsSettled() {
    this.colliderDirty = true;
    this.markDirty();
  }

  private adoptEngineSun(root: THREE.Object3D) {
    const lights: THREE.DirectionalLight[] = [];
    root.traverse((o) => {
      if ((o as THREE.DirectionalLight).isDirectionalLight) lights.push(o as THREE.DirectionalLight);
    });
    const sun = lights.find((l) => l.userData?.kind === "sun") ?? lights.find((l) => l.castShadow) ?? null;
    if (sun === this.engineSun) return;
    this.engineSun = sun;
    // the engine pairs its sun with a hemisphere "sky" fill (engine/lights.ts addSun)
    this.engineHemi = null;
    root.traverse((o) => {
      if (!this.engineHemi && (o as THREE.HemisphereLight).isHemisphereLight) this.engineHemi = o as THREE.HemisphereLight;
    });
    if (sun && this.atmosphere) {
      this.atmosphere.baseIntensity(sun);
      this.atmosphere.setFallbackActive(false);
      this.atmosphere.configureShadow(sun, this.store.getState().quality);
      if (!sun.target.parent) sun.parent?.add(sun.target);
      this.syncSun();
    }
  }

  // ───────────────────────────── prop syncs ─────────────────────────────

  private bands(): LevelBand[] {
    if (this.result?.levels?.length) return this.result.levels;
    return this.plan.levels.map((l) => ({ id: l.id, floor_y: l.elevation_ft * FT, top_y: (l.elevation_ft + l.height_ft) * FT }));
  }

  private configureVisibility() {
    this.vis.configure({ visibleLevels: this.props.visibleLevels, layers: this.props.layers }, this.plan.levels, this.bands());
  }

  syncVisibility() {
    this.configureVisibility();
    const root = this.currentRoot();
    if (root) this.vis.apply(root);
    this.colliderDirty = true;
    this.colliderTimer = performance.now() + 150;
    this.clearHover();
    this.markDirty();
  }

  syncSectionCut() {
    const gl = this.gl;
    if (!gl) return;
    const cut = this.props.sectionCut;
    if (cut === null || cut === undefined || !Number.isFinite(cut)) gl.clippingPlanes = [];
    else {
      this.sectionPlane.constant = cut;
      gl.clippingPlanes = [this.sectionPlane];
    }
    this.clearHover();
    this.markDirty();
  }

  syncSun() {
    const atm = this.atmosphere;
    if (!atm) return;
    const facing = (this.plan.site?.facing ?? "N") as Facing;
    const hour = this.props.sunHour;
    const root = this.currentRoot();
    if (hour === undefined || hour === null || !Number.isFinite(hour)) {
      // no slider: keep the design's own sun (engine set it from `s.lights.sun({hour})`)
      if (this.engineSun) atm.syncSkyToLight(this.engineSun);
      else atm.applySun(atm.fallbackSun, sunState(17.5, facing), { owned: false, root });
    } else {
      const sun = sunState(hour, facing);
      if (this.engineSun) atm.applySun(this.engineSun, sun, { owned: true, hemi: this.engineHemi, root });
      else atm.applySun(atm.fallbackSun, sun, { owned: false, root });
    }
    this.markDirty();
  }

  syncCommentMode() {
    if (!this.props.commentMode) this.setOutline(null);
    this.invalidate();
  }

  onCommentsChanged() {
    this.pinEls.clear();
    if (this.store.getState().draft) {
      window.clearTimeout(this.draftTimer);
      this.store.setState({ draft: null });
    }
    this.invalidate();
  }

  // ───────────────────────────── quality ─────────────────────────────

  setQuality(q: Quality, lock = false) {
    if (lock) this.perf.locked = true;
    if (this.store.getState().quality === q) return;
    // DPR follows the tier through the Canvas `dpr` prop (HouseViewer re-renders on quality changes)
    this.store.setState({ quality: q });
    const sun = this.engineSun ?? this.atmosphere?.fallbackSun;
    if (sun && this.atmosphere) this.atmosphere.configureShadow(sun, q);
    this.perf.settleUntil = performance.now() + 2500;
    this.markDirty();
  }

  /** Auto-detect slow GPUs from continuous frames only (orbit is demand-rendered): high → balanced → performance. */
  private monitorPerf(dt: number, now: number) {
    if (this.perf.locked || now < this.perf.settleUntil || dt <= 0 || dt > 0.2) return;
    // only sample while frames are back-to-back: walking, or the orbit camera is moving
    const continuous = this.store.getState().mode === "walk" || !!this.controls?.active;
    if (!continuous) return;
    this.perf.sum += dt;
    if (++this.perf.samples < 90) return;
    const fps = this.perf.samples / this.perf.sum;
    this.perf.samples = 0;
    this.perf.sum = 0;
    const q = this.store.getState().quality;
    if (q !== "performance" && fps < 30) this.setQuality("performance");
    else if (q === "high" && fps < 50) this.setQuality("balanced");
    else if (q === "balanced" && fps < 45) this.setQuality("performance");
  }

  // ───────────────────────────── orbit ─────────────────────────────

  /** The hero 3/4 aerial front view, on the sunny side of the house. */
  placeHero(animate: boolean) {
    const c = this.controls, cam = this.camera;
    if (!c || !cam || (this.heroDone && !animate)) return;
    this.heroDone = true;
    const facing = (this.plan.site?.facing ?? "N") as Facing;
    const sun = sunState(this.props.sunHour ?? 16.5, facing);
    const side: 1 | -1 = sun.dir.x >= 0 ? 1 : -1;
    const pose = heroPose(this.plan, cam, side);
    c.setLookAt(pose.position.x, pose.position.y, pose.position.z, pose.target.x, pose.target.y, pose.target.z, animate);
    this.invalidate();
  }

  focusAt(clientX: number, clientY: number) {
    const c = this.controls;
    const hit = this.pickClient(clientX, clientY);
    if (!c || !hit || !this.camera) return;
    const cam = this.camera;
    const dir = cam.position.clone().sub(hit.point).normalize();
    const dist = THREE.MathUtils.clamp(cam.position.distanceTo(hit.point) * 0.45, 2.5, 14);
    const pos = hit.point.clone().addScaledVector(dir, dist);
    pos.y = Math.max(pos.y, hit.point.y + 0.4);
    c.setLookAt(pos.x, pos.y, pos.z, hit.point.x, hit.point.y, hit.point.z, true);
  }

  // ───────────────────────────── modes ─────────────────────────────

  setMode(next: ViewerMode, source: ModeSource) {
    const prev = this.store.getState().mode;
    if (prev === next) return;
    if (next === "walk") this.enterWalk(false);
    else this.leaveWalk(source);
  }

  private enterWalk(initial: boolean) {
    this.store.setState({ mode: "walk", walk: "intro", target: null, hover: null });
    const cam = this.camera, c = this.controls;
    if (!cam) return; // attachThree() calls back once the canvas exists
    this.clearHover();
    this.builds.finishAnims();
    this.ensureCollider();
    this.spawnWalker(false);
    if (c) {
      c.suspended = true;
      c.enabled = false;
    }
    this.walk.fov = WALK_FOV;
    this.walk.enabled = false;
    this.walk.beginTransition(cam, initial || prefersReducedMotion() ? 0.01 : 1.15);
    this.perf.settleUntil = performance.now() + 2500;
    this.invalidate();
  }

  private walkerOnFallback = false;

  private spawnWalker(force: boolean) {
    const res = this.result;
    if (res && (force || !this.spawnedFor.has(res))) {
      this.spawnedFor.add(res);
      const p = res.spawn.position.clone();
      // the finished floor of the plan level the spawn is on (spawn may be given at feet or eye height)
      const levels = [...this.plan.levels].sort((a, b) => b.elevation_ft - a.elevation_ft);
      const lvl = levels.find((l) => l.elevation_ft * FT <= p.y + 0.35) ?? levels[levels.length - 1];
      this.walk.setSpawn(p, res.spawn.lookAt.clone(), lvl ? lvl.elevation_ft * FT : undefined);
      this.walkerOnFallback = false;
    } else if (!this.walk.ready) {
      // no house yet: stand on the road facing the plot until the build lands
      const W = this.plan.site.plot.width_ft;
      this.walk.setSpawn(new THREE.Vector3((W / 2) * FT, 0, -2), new THREE.Vector3((W / 2) * FT, 1.6, 8));
      this.walkerOnFallback = true;
    }
  }

  private onIntroDone() {
    const s = this.store.getState();
    if (s.walk !== "intro") return;
    if (this.isLocked()) this.activateWalk();
    else this.store.setState({ walk: "ready" });
  }

  private leaveWalk(source: ModeSource) {
    if (this.isLocked()) document.exitPointerLock?.();
    this.walk.enabled = false;
    this.walk.transition = null;
    this.walk.input.keys.clear();
    this.dragLook = false;
    const cam = this.camera, c = this.controls;
    this.store.setState({ mode: "orbit", walk: "off", target: null, room: null, level: null });
    this.setOutline(null);
    if (cam && c) {
      const fwd = cam.getWorldDirection(new THREE.Vector3());
      const ahead = cam.position.clone().addScaledVector(fwd, 3.5);
      c.suspended = false;
      c.enabled = true;
      c.setLookAt(cam.position.x, cam.position.y, cam.position.z, ahead.x, ahead.y, ahead.z, false);
      if (source !== "flyTo") {
        const focus = new THREE.Vector3(this.walk.feet.x, this.walk.feet.y + 1, this.walk.feet.z);
        const back = new THREE.Vector3(fwd.x, 0, fwd.z);
        if (back.lengthSq() < 1e-6) back.set(0, 0, -1);
        back.normalize();
        const pos = focus.clone().addScaledVector(back, -10).add(new THREE.Vector3(0, 9, 0));
        c.setLookAt(pos.x, pos.y, pos.z, focus.x, focus.y, focus.z, true);
      }
    }
    this.fovTarget = ORBIT_FOV;
    this.invalidate();
    if (source !== "props" && this.props.mode !== "orbit") {
      try {
        // the contract's onExitWalk takes no args; the reason is passed for apps that want it
        (this.props.onExitWalk as ((reason?: string) => void) | undefined)?.(source === "flyTo" ? "flyTo" : "exit");
      } catch (e) {
        console.warn("[viewer] onExitWalk threw", e);
      }
    }
  }

  /**
   * Jump to another floor (number keys while walking): the stair hall of that level, else its largest room,
   * at the nearest free spot. A safety net for awkward stairs and a quick way around big houses.
   */
  gotoLevel(index: number) {
    const levels = [...this.plan.levels].sort((a, b) => a.index - b.index);
    const lvl = levels[index];
    const cam = this.camera;
    if (!lvl || !cam || this.store.getState().mode !== "walk") return;
    this.ensureCollider();
    const rooms = this.plan.rooms.filter((r) => r.level === lvl.id);
    const enclosed = rooms.filter((r) => !["lawn", "driveway", "open_space", "courtyard", "porch", "balcony", "terrace"].includes(r.type));
    const pickRoom = enclosed.find((r) => r.type === "stair") ?? [...enclosed].sort((a, b) => b.rect.w * b.rect.d - a.rect.w * a.rect.d)[0];
    let target: THREE.Vector3;
    if (pickRoom) target = new THREE.Vector3((pickRoom.rect.x + pickRoom.rect.w / 2) * FT, lvl.elevation_ft * FT, (pickRoom.rect.y + pickRoom.rect.d / 2) * FT);
    else {
      // e.g. the roof: stand near the stair tower if there is one, else mid-plot
      const m = this.plan.roof?.mumty?.rect;
      const W = this.plan.site.plot.width_ft, D = this.plan.site.plot.depth_ft;
      target = m ? new THREE.Vector3((m.x + m.w + 3) * FT, lvl.elevation_ft * FT, (m.y + m.d / 2) * FT) : new THREE.Vector3((W / 2) * FT, lvl.elevation_ft * FT, (D / 2) * FT);
    }
    const spot = this.walk.findFreeSpot(target, lvl.elevation_ft * FT) ?? this.walk.findFreeSpot(target.clone().setY(target.y + 0.3), lvl.elevation_ft * FT);
    if (!spot) {
      this.toast(`No clear spot on the ${lvl.name.toLowerCase()}`);
      return;
    }
    this.walk.feet.copy(spot);
    this.walk.camY = spot.y + EYE;
    this.walk.vel.set(0, 0, 0);
    this.walk.vy = 0;
    this.walk.grounded = true;
    this.walk.beginTransition(cam, prefersReducedMotion() ? 0.01 : 0.6);
    this.toast(lvl.name);
  }

  /** "Finish walkthrough" (F): leave walk mode and tell the app. */
  finishWalk() {
    if (this.store.getState().mode !== "walk") return;
    this.leaveWalk("user");
  }

  private activateWalk() {
    this.walk.enabled = true;
    this.store.setState({ walk: "active" });
    this.invalidate();
  }

  pauseWalk() {
    if (this.store.getState().walk !== "active") return;
    this.walk.enabled = false;
    this.walk.input.keys.clear();
    this.store.setState({ walk: "paused", target: null });
    this.setOutline(null);
  }

  /** Resume / start walking: pointer lock on desktop (needs a user gesture), immediate on touch. */
  requestLock() {
    const s = this.store.getState();
    if (s.mode !== "walk") return;
    if (this.walk.transition) this.walk.transition.t = 1; // skip the fly-in
    if (s.touch || this.dragLook) {
      this.activateWalk();
      return;
    }
    const el = this.gl?.domElement as (HTMLCanvasElement & { requestPointerLock(o?: unknown): Promise<void> | void }) | undefined;
    if (!el?.requestPointerLock) {
      this.fallbackDragLook();
      return;
    }
    const plain = () => {
      try {
        const p2 = el.requestPointerLock();
        if (p2 && typeof (p2 as Promise<void>).catch === "function") (p2 as Promise<void>).catch(() => this.onLockFailed());
      } catch {
        this.onLockFailed();
      }
    };
    try {
      const p = el.requestPointerLock({ unadjustedMovement: true });
      if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(plain);
    } catch {
      plain();
    }
  }

  private lockEverSucceeded = false;

  /**
   * Chrome refuses a re-lock for ~1 s after the user pressed Esc. If lock has worked before in this session, that is
   * the likely cause: ask for another click instead of dropping to drag-to-look for good.
   */
  private onLockFailed() {
    if (this.lockEverSucceeded) {
      if (this.store.getState().walk === "active" && !this.isLocked()) this.pauseWalk();
      this.toast("Click again to resume walking");
      return;
    }
    this.fallbackDragLook();
  }

  private fallbackDragLook() {
    if (this.store.getState().mode !== "walk") return;
    if (this.dragLook && this.store.getState().walk === "active") return;
    this.dragLook = true;
    this.store.setState({ dragLook: true });
    this.activateWalk();
    this.toast("Pointer lock unavailable here: drag to look around");
  }

  isLocked() {
    return !!this.gl && document.pointerLockElement === this.gl.domElement;
  }

  private onPointerLockChange = () => {
    if (this.isLocked()) {
      this.lockEverSucceeded = true;
      this.dragLook = false;
      this.store.setState({ dragLook: false });
      if (this.store.getState().mode === "walk") this.activateWalk();
    } else if (this.store.getState().walk === "active") this.pauseWalk();
  };

  private onPointerLockError = () => this.onLockFailed();

  private onLockedMouseMove = (e: MouseEvent) => {
    if (!this.isLocked() || !this.walk.enabled) return;
    // clamp occasional spikes from some platforms
    this.walk.input.look.dx += THREE.MathUtils.clamp(e.movementX, -180, 180);
    this.walk.input.look.dy += THREE.MathUtils.clamp(e.movementY, -180, 180);
  };

  // ───────────────────────────── keyboard ─────────────────────────────

  private onKeyDown = (e: KeyboardEvent) => {
    const s = this.store.getState();
    if (s.mode !== "walk" || isEditable(e.target)) return;
    if (s.walk === "active") {
      if (MOVE_KEYS.has(e.code)) {
        this.walk.input.keys.add(e.code);
        if (e.code.startsWith("Arrow")) e.preventDefault();
      } else if (e.code === "KeyC" && !e.repeat) {
        e.preventDefault();
        this.placeComment(0, 0, true);
      } else if (e.code === "KeyF" && !e.repeat) {
        e.preventDefault();
        this.finishWalk();
      } else if (/^Digit[1-9]$/.test(e.code) && !e.repeat) {
        e.preventDefault();
        this.gotoLevel(Number(e.code.slice(5)) - 1);
      } else if (e.code === "Escape" && !this.isLocked()) this.pauseWalk();
      else if (e.code === "Space") e.preventDefault();
    } else if (s.walk === "paused" || s.walk === "ready") {
      if ((e.code === "Enter" || e.code === "Space") && !e.repeat) {
        e.preventDefault();
        this.requestLock();
      } else if (e.code === "KeyF" && !e.repeat) this.finishWalk();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.walk.input.keys.delete(e.code);
  };

  private onBlur = () => {
    this.walk.input.keys.clear();
    this.walk.input.joy.x = this.walk.input.joy.y = 0;
  };

  // ───────────────────────────── pointer ─────────────────────────────

  private isUiEvent(e: Event) {
    const t = e.target as Element | null;
    return !!t?.closest?.("[data-nq-ui]");
  }

  private local(e: { clientX: number; clientY: number }) {
    const r = this.container!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.isUiEvent(e)) return;
    this.down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button };
    const s = this.store.getState();
    if (s.mode === "walk" && this.dragLook && s.walk === "active" && e.pointerType === "mouse") {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const s = this.store.getState();
    if (s.mode === "walk") {
      if (this.dragLook && s.walk === "active" && e.buttons & 1 && e.pointerType === "mouse") {
        this.walk.input.look.dx += e.movementX * 1.4;
        this.walk.input.look.dy += e.movementY * 1.4;
      }
      return;
    }
    if (this.isUiEvent(e) || e.pointerType === "touch") return;
    if (e.buttons) {
      if (this.store.getState().hover) this.clearHover();
      return;
    }
    const p = this.local(e);
    this.hoverPending = { x: p.x, y: p.y };
    if (this.tooltipEl) this.tooltipEl.style.transform = `translate3d(${Math.round(p.x + 16)}px, ${Math.round(p.y + 18)}px, 0)`;
    this.invalidate();
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.down;
    this.down = null;
    if (!d || this.isUiEvent(e) || e.button !== 0) return;
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    if (moved > 6 || performance.now() - d.t > 650) return;
    this.onClick(e);
  };

  private onClick(e: PointerEvent) {
    const s = this.store.getState();
    if (s.mode === "orbit") {
      if (this.props.commentMode) {
        const p = this.local(e);
        this.placeComment((p.x / p.w) * 2 - 1, -(p.y / p.h) * 2 + 1, false);
      }
      return;
    }
    if (s.walk === "ready" || s.walk === "paused" || s.walk === "commenting" || s.walk === "intro") this.requestLock();
    else if (s.walk === "active" && this.props.commentMode) this.placeComment(0, 0, true);
  }

  private onDblClick = (e: MouseEvent) => {
    if (this.isUiEvent(e) || this.store.getState().mode !== "orbit" || this.props.commentMode) return;
    this.focusAt(e.clientX, e.clientY);
  };

  private onPointerLeave = () => {
    this.hoverPending = null;
    this.clearHover();
  };

  private onWheel = () => this.clearHover();

  private onContextMenu = (e: Event) => {
    if (!this.isUiEvent(e)) e.preventDefault();
  };

  // ───────────────────────────── picking / hover ─────────────────────────────

  private clipY() {
    const c = this.props.sectionCut;
    return c === null || c === undefined || !Number.isFinite(c) ? null : c;
  }

  pickNdc(x: number, y: number, far = 250) {
    if (!this.camera) return null;
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    return pick(this.raycaster, [this.holder], { clipY: this.clipY(), far });
  }

  private pickClient(clientX: number, clientY: number) {
    if (!this.container) return null;
    const p = this.local({ clientX, clientY });
    return this.pickNdc((p.x / p.w) * 2 - 1, -(p.y / p.h) * 2 + 1);
  }

  private processHover() {
    const p = this.hoverPending;
    this.hoverPending = null;
    if (!p || !this.container || !this.camera) return;
    const c = this.controls;
    if (c && c.currentAction !== 0) return this.clearHover();
    const r = this.container.getBoundingClientRect();
    const hit = this.pickNdc((p.x / r.width) * 2 - 1, -(p.y / r.height) * 2 + 1);
    if (!hit) return this.clearHover();
    const tags = resolveHitTags(hit, this.currentRoot());
    const key = tags.part ? `${hit.object.uuid}:${tags.part.start}` : tags.element.uuid;
    if (key === this.hoverKey) return;
    this.hoverKey = key;
    this.setOutline({ obj: tags.element, part: tags.part });
    this.store.setState({ hover: displayLabel(tags, this.plan) });
  }

  clearHover() {
    if (!this.hoverKey && !this.store.getState().hover) return;
    this.hoverKey = "";
    this.setOutline(null);
    this.store.setState({ hover: null });
  }

  private outlined: OutlineTarget | null = null;
  private partOverlay: THREE.Mesh | null = null;

  /** Outline an element: its meshes, or — for a consolidated (merged) mesh — just that element's triangles. */
  setOutline(t: OutlineTarget | null) {
    const same = (a: OutlineTarget | null, b: OutlineTarget | null) => a?.obj === b?.obj && a?.part?.start === b?.part?.start;
    if (same(t, this.outlined)) return;
    this.outlined = t;
    if (this.partOverlay) {
      this.partOverlay.removeFromParent();
      this.partOverlay.geometry.dispose();
      this.partOverlay = null;
    }
    const o = this.outline;
    if (!o) return;
    const meshes: THREE.Object3D[] = [];
    if (t?.part && (t.obj as THREE.Mesh).isMesh) {
      const overlay = partOverlay(t.obj as THREE.Mesh, t.part);
      if (overlay) {
        t.obj.add(overlay);
        this.partOverlay = overlay;
        meshes.push(overlay);
      }
    } else if (t) {
      t.obj.traverseVisible((c) => {
        if ((c as THREE.Mesh).isMesh && meshes.length < 400 && !c.userData?.noPick) meshes.push(c);
      });
      // whole-house or giant groups: tooltip only
      const box = new THREE.Box3().setFromObject(t.obj);
      if (meshes.length >= 400 || box.getSize(new THREE.Vector3()).length() > 40) meshes.length = 0;
    }
    o.selection.set(meshes);
    this.invalidate();
  }

  // ───────────────────────────── walk HUD helpers ─────────────────────────────

  /** {level, room} for a world point from plan rects + level elevations (tags missing → still useful anchors). */
  locate(p: THREE.Vector3, tolerance = 0.1): { level?: string; room?: string } {
    const levels = [...this.plan.levels].sort((a, b) => a.index - b.index);
    let level = levels[0];
    for (const l of levels) if (l.elevation_ft * FT <= p.y + tolerance) level = l;
    if (!level) return {};
    const x = p.x / FT, y = p.z / FT;
    const rooms = this.plan.rooms.filter((r) => r.level === level.id && x >= r.rect.x - 0.3 && x <= r.rect.x + r.rect.w + 0.3 && y >= r.rect.y - 0.3 && y <= r.rect.y + r.rect.d + 0.3);
    rooms.sort((a, b) => a.rect.w * a.rect.d - b.rect.w * b.rect.d);
    return { level: level.id, room: rooms[0]?.id };
  }

  private updateRoomLabel() {
    const where = this.locate(new THREE.Vector3(this.walk.feet.x, this.walk.feet.y + 0.05, this.walk.feet.z), 0.25);
    const lvl = this.plan.levels.find((l) => l.id === where.level);
    const lowest = Math.min(...this.plan.levels.map((l) => l.index));
    // no room rect here: outdoors on the ground, otherwise name the level (roof terrace, open first-floor area…)
    const room = where.room ? this.plan.rooms.find((r) => r.id === where.room)?.name ?? null : lvl && lvl.index > lowest ? lvl.name : "Outside";
    const s = this.store.getState();
    if (s.room !== room || s.level !== (where.level ?? null)) this.store.setState({ room, level: where.level ?? null });
  }

  private updateCrosshairTarget() {
    const hit = this.pickNdc(0, 0, 9);
    if (!hit) {
      if (this.store.getState().target) this.store.setState({ target: null });
      if (this.props.commentMode) this.setOutline(null);
      return;
    }
    const tags = resolveHitTags(hit, this.currentRoot());
    const label = displayLabel(tags, this.plan);
    const cur = this.store.getState().target;
    if (!cur || cur.title !== label.title || cur.subtitle !== label.subtitle) this.store.setState({ target: label });
    this.setOutline(this.props.commentMode ? { obj: tags.element, part: tags.part } : null);
  }

  // ───────────────────────────── colliders ─────────────────────────────

  ensureCollider() {
    if (!this.colliderDirty && this.collider) return;
    const res = this.result;
    if (!res) return;
    this.builds.finishAnims();
    const root = this.currentRoot();
    const list = (res.colliders ?? []).filter((m) => m && this.vis.colliderEnabled(m, root));
    const next = buildColliderBVH(list);
    disposeCollider(this.collider);
    this.collider = next;
    this.walk.setCollider(next?.bvh ?? null);
    this.colliderDirty = false;
  }

  // ───────────────────────────── pins ─────────────────────────────

  private pinEl(id: string): HTMLElement | null {
    if (!this.pinEls.has(id) || !this.pinEls.get(id)?.isConnected) {
      this.pinEls.set(id, (this.container?.querySelector(`[data-pin="${CSS.escape(id)}"]`) as HTMLElement | null) ?? null);
    }
    return this.pinEls.get(id) ?? null;
  }

  private updatePins(cam: THREE.PerspectiveCamera) {
    const g = this.pinsGroup;
    if (!g || !g.children.length) return;
    const cut = this.clipY();
    const kids = g.children;
    for (const pinObj of kids) {
      const id = pinObj.userData?.pin as string | undefined;
      if (!id) continue;
      const level = pinObj.userData.level as string | undefined;
      const hiddenLevel = !!level && !!this.vis.levelsShown && this.plan.levels.some((l) => l.id === level) && !this.vis.levelsShown.has(level);
      const visible = !hiddenLevel && (cut === null || pinObj.position.y <= cut + 0.05);
      pinObj.visible = visible;
      const dist = cam.position.distanceTo(pinObj.position);
      const s = THREE.MathUtils.clamp(dist * 0.085, 0.9, 7);
      pinObj.scale.setScalar(s);
      const el = this.pinEl(id);
      if (el) el.dataset.hidden = visible ? "0" : "1";
    }
    // occlusion: a couple of pins per frame, visibility-aware (hidden floors never occlude)
    const n = Math.min(2, kids.length);
    for (let i = 0; i < n; i++) {
      this.pinCursor = (this.pinCursor + 1) % kids.length;
      const pinObj = kids[this.pinCursor];
      const id = pinObj.userData?.pin as string | undefined;
      if (!id || !pinObj.visible) continue;
      const head = pinObj.userData.headLocal as THREE.Vector3 | undefined;
      const p = head ? head.clone().multiplyScalar(pinObj.scale.x).add(pinObj.position) : pinObj.position.clone();
      const dir = p.clone().sub(cam.position);
      const dist = dir.length();
      this.raycaster.set(cam.position, dir.normalize());
      const hit = pick(this.raycaster, [this.holder], { clipY: cut, far: Math.max(0, dist - 0.12) });
      const el = this.pinEl(id);
      if (el) el.dataset.occluded = hit ? "1" : "0";
    }
  }

  // ───────────────────────────── comments ─────────────────────────────

  /** Raycast at NDC (x, y) and hand a CommentAnchor + camera + snapshot to the app. */
  placeComment(x: number, y: number, fromWalk: boolean) {
    const cam = this.camera;
    if (!cam || !this.gl) return;
    this.builds.finishAnims();
    const hit = this.pickNdc(x, y, 80);
    if (!hit) {
      this.toast("Aim at a wall, floor or object to pin a comment");
      return;
    }
    const tags = resolveHitTags(hit, this.currentRoot());
    const normal = hitNormal(hit, this.raycaster.ray.direction);
    const where = this.locate(hit.point.clone().addScaledVector(normal, 0.05));
    const label = tags.label ?? displayLabel(tags, this.plan).title;
    const anchor: CommentAnchor = { position: v3(hit.point), normal: v3(normal) };
    // untagged hits: infer level/room from the plan, but only when the point is inside a room (not a street tree)
    const level = tags.level ?? (where.room ? where.level : undefined), room = tags.room ?? where.room;
    if (level) anchor.level = level;
    if (room) anchor.room = room;
    if (tags.id) anchor.element_id = tags.id;
    if (tags.kind) anchor.kind = tags.kind;
    if (label) anchor.label = label;
    const position = cam.position.clone();
    const target = position.clone().addScaledVector(this.raycaster.ray.direction, hit.distance);
    const snapshot = this.snapshot({ width: 640, pin: hit.point, maxAspect: 0.75 });
    window.clearTimeout(this.draftTimer);
    this.store.setState({ draft: { position: anchor.position, normal: anchor.normal } });
    this.draftTimer = window.setTimeout(() => this.store.setState({ draft: null }), 60000);
    if (fromWalk && this.store.getState().mode === "walk") {
      this.walk.enabled = false;
      this.walk.input.keys.clear();
      this.store.setState({ walk: "commenting", target: null });
      if (this.isLocked()) document.exitPointerLock?.();
    }
    try {
      this.props.onAddComment?.({ anchor, camera: { position: v3(position), target: v3(target) }, snapshot });
    } catch (e) {
      console.warn("[viewer] onAddComment threw", e);
    }
    this.invalidate();
  }

  flyTo(comment: Comment) {
    const cam = this.camera;
    if (!cam || !comment?.camera) return;
    const pos = new THREE.Vector3(...comment.camera.position);
    const tgt = new THREE.Vector3(...comment.camera.target);
    if (this.store.getState().mode === "walk") {
      this.ensureCollider();
      const g = this.walk.groundAt(pos, pos.y - EYE + 0.4, pos.y - EYE - 1.2);
      if (g !== null) {
        this.walk.feet.set(pos.x, g, pos.z);
        const d = tgt.clone().sub(new THREE.Vector3(pos.x, g + EYE, pos.z));
        this.walk.yaw = Math.atan2(-d.x, -d.z);
        this.walk.pitch = THREE.MathUtils.clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -1.3, 1.3);
        this.walk.camY = g + EYE;
        this.walk.vel.set(0, 0, 0);
        this.walk.beginTransition(cam, prefersReducedMotion() ? 0.01 : 0.7);
        this.flashPin(comment.id);
        return;
      }
      this.leaveWalk("flyTo");
    }
    this.controls?.setLookAt(pos.x, pos.y, pos.z, tgt.x, tgt.y, tgt.z, true);
    this.flashPin(comment.id);
    this.invalidate();
  }

  private flashPin(id: string) {
    const el = this.pinEl(id);
    if (!el) return;
    el.dataset.flash = "1";
    window.setTimeout(() => {
      if (el.dataset.flash === "1") el.dataset.flash = "0";
    }, 1800);
  }

  // ───────────────────────────── capture ─────────────────────────────

  /** Render a fresh frame and read it back in the same task (preserveDrawingBuffer stays false). */
  renderNow() {
    const gl = this.gl, scene = this.scene, cam = this.camera;
    if (!gl || !scene || !cam) return;
    if (this.shadowsDirty) {
      gl.shadowMap.needsUpdate = true;
      this.shadowsDirty = false;
    }
    gl.toneMappingExposure = (this.atmosphere?.exposure ?? 1) * (this.store.getState().mode === "walk" ? 1.1 : 1);
    if (this.composer) this.composer.render(0);
    else gl.render(scene, cam);
  }

  snapshot(o: { width?: number; height?: number; pin?: THREE.Vector3 | null; maxAspect?: number } = {}): string {
    const gl = this.gl, cam = this.camera;
    if (!gl || !cam) return "";
    const pinsVisible = this.pinsGroup?.visible ?? true;
    if (this.pinsGroup) this.pinsGroup.visible = false;
    const outlined = this.outlined;
    this.setOutline(null);
    let url = "";
    try {
      this.renderNow();
      const pinNdc = o.pin ? projectToNdc(o.pin, cam) : null;
      url = grabCanvas(gl.domElement, { width: o.width, height: o.height, pinNdc, maxAspect: o.maxAspect });
    } finally {
      if (this.pinsGroup) this.pinsGroup.visible = pinsVisible;
      this.setOutline(outlined);
      this.invalidate();
    }
    return url;
  }

  async capture(opts?: { width?: number; height?: number }): Promise<string> {
    await this.whenReady();
    this.builds.finishAnims();
    return this.snapshot({ width: opts?.width, height: opts?.height });
  }

  // ───────────────────────────── misc ─────────────────────────────

  toast(text: string) {
    window.clearTimeout(this.toastTimer);
    this.store.setState({ toast: { id: ++this.toastSeq, text } });
    this.toastTimer = window.setTimeout(() => this.store.setState({ toast: null }), 2600);
  }

  /** Dev-only hooks for automated testing (synthetic pointer lock, key presses, teleport). */
  private installDebug() {
    const ctrl = this;
    const dbg = {
      ctrl,
      walk: this.walk,
      state: () => ({ ...ctrl.store.getState(), feet: ctrl.walk.feet.toArray(), yaw: ctrl.walk.yaw, pitch: ctrl.walk.pitch, grounded: ctrl.walk.grounded, colliderTris: ctrl.collider?.triangles ?? 0, fov: ctrl.camera?.fov }),
      /** Start walking without real pointer lock (automation can't grant it). */
      activate: () => {
        if (ctrl.walk.transition) ctrl.walk.transition.t = 1;
        ctrl.dragLook = true;
        ctrl.activateWalk();
      },
      hold: (code: string, ms: number) =>
        new Promise<void>((res) => {
          ctrl.walk.input.keys.add(code);
          window.setTimeout(() => {
            ctrl.walk.input.keys.delete(code);
            res();
          }, ms);
        }),
      look: (dx: number, dy = 0) => {
        ctrl.walk.input.look.dx += dx;
        ctrl.walk.input.look.dy += dy;
      },
      setYaw: (deg: number, pitchDeg = 0) => {
        ctrl.walk.yaw = THREE.MathUtils.degToRad(deg);
        ctrl.walk.pitch = THREE.MathUtils.degToRad(pitchDeg);
      },
      teleport: (x: number, y: number, z: number) => ctrl.walk.teleport(new THREE.Vector3(x, y, z)),
      teleportPlan: (xFt: number, yFt: number, hFt = 30) => ctrl.walk.teleport(new THREE.Vector3(xFt * FT, hFt * FT, yFt * FT)),
      comment: () => ctrl.placeComment(0, 0, ctrl.store.getState().mode === "walk"),
      commentAt: (x: number, y: number) => ctrl.placeComment(x, y, false),
      hero: () => ctrl.placeHero(true),
      setQuality: (q: Quality) => ctrl.setQuality(q, true),
      snapshot: (w = 640) => ctrl.snapshot({ width: w }),
      setLookAt: (p: Vec3, t: Vec3, animate = false) => ctrl.controls?.setLookAt(p[0], p[1], p[2], t[0], t[1], t[2], animate),
    };
    (window as unknown as { __viewerDebug: typeof dbg }).__viewerDebug = dbg;
  }
}
