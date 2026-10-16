/**
 * Image-based light (RoomEnvironment PMREM, no network HDRIs), the Preetham Sky synced to the sun, a soft ground
 * plane so the house never floats, and the sun light itself (the engine's `kind: "sun"` light when present,
 * otherwise a viewer-owned fallback until the design's lighting section runs).
 */
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import type { Quality } from "../core/store";
import { lerp, smoothstep } from "../core/units";
import type { SunState } from "../core/sun";

/**
 * Emissive fixtures and additive light pools read as "on" at dusk and subtle at noon. Mirrors the engine's
 * setTimeOfDay (same userData keys, so the two never fight); safe to call on every slider move.
 */
export function applyNight(root: THREE.Object3D, night: number) {
  const seen = new Set<THREE.Material>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
      if (!mat || seen.has(mat)) continue;
      seen.add(mat);
      const sm = mat as THREE.MeshStandardMaterial & THREE.MeshBasicMaterial;
      if (sm.blending === THREE.AdditiveBlending) {
        sm.userData.baseOpacity ??= sm.opacity;
        sm.opacity = (sm.userData.baseOpacity as number) * (0.12 + 0.88 * night);
      } else if (sm.emissive && sm.emissiveIntensity > 0 && sm.emissive.getHex() !== 0) {
        sm.userData.baseEmissive ??= sm.emissiveIntensity;
        sm.emissiveIntensity = (sm.userData.baseEmissive as number) * (0.35 + 0.65 * night);
      }
    }
  });
}

/**
 * Ground plane texture (no network): lighter, warmer near the plot and darker, cooler toward the horizon, with soft
 * low-frequency mottling so the big plane doesn't read as a flat desert. Mapped once across the 900 m disc.
 */
function groundTexture(): THREE.Texture {
  const N = 512;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  const rad = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
  rad.addColorStop(0, "#ffffff");
  rad.addColorStop(0.035, "#f6f5f2");
  rad.addColorStop(0.12, "#e6e5e1");
  rad.addColorStop(0.45, "#d8d8d5");
  rad.addColorStop(1, "#d0d1cf");
  g.fillStyle = rad;
  g.fillRect(0, 0, N, N);
  // mottling: a few hundred soft blotches
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 420; i++) {
    const x = rnd() * N, y = rnd() * N, r = 6 + rnd() * 34;
    const dark = rnd() < 0.55;
    const blot = g.createRadialGradient(x, y, 0, x, y, r);
    blot.addColorStop(0, dark ? "rgba(70,62,48,0.10)" : "rgba(255,250,235,0.10)");
    blot.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = blot;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Atmosphere {
  readonly sky = new Sky();
  readonly ground: THREE.Mesh;
  readonly fallbackSun = new THREE.DirectionalLight("#fff3e2", 3.0);
  readonly env: THREE.Texture;
  private engineSunBase = new WeakMap<THREE.DirectionalLight, number>();
  private configured = new WeakMap<THREE.DirectionalLight, string>();
  /** World-space box the shadow camera must cover (the plot + house height). */
  shadowFocus = new THREE.Box3(new THREE.Vector3(-2, 0, -4), new THREE.Vector3(14, 10, 22));
  daylight = 1;
  exposure = 1;

  constructor(private gl: THREE.WebGLRenderer, private scene: THREE.Scene) {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    this.env = pmrem.fromScene(room, 0.04).texture;
    room.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      }
    });
    pmrem.dispose();
    scene.environment = this.env;
    scene.environmentIntensity = 0.6;

    const u = this.sky.material.uniforms;
    u.turbidity.value = 4.2; // a little Lahore haze
    u.rayleigh.value = 1.15;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.84;
    if (u.cloudCoverage) u.cloudCoverage.value = 0.22;
    if (u.cloudDensity) u.cloudDensity.value = 0.32;
    if (u.cloudElevation) u.cloudElevation.value = 0.62;
    this.sky.scale.setScalar(6000);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    this.sky.userData = { noPick: true, viewer: "sky" };
    scene.add(this.sky);

    const groundMat = new THREE.MeshStandardMaterial({ color: "#c4c2bb", roughness: 1, metalness: 0, map: groundTexture() });
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(900, 72), groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.06;
    this.ground.receiveShadow = true;
    this.ground.userData = { noPick: true, viewer: "ground" };
    scene.add(this.ground);
    scene.fog = new THREE.Fog("#d4d6d2", 70, 560);

    this.fallbackSun.castShadow = true;
    this.fallbackSun.userData = { viewer: "fallback-sun" };
    scene.add(this.fallbackSun, this.fallbackSun.target);
  }

  /** Keep shadows crisp and stable: fit an orthographic frustum around the plot's bounding sphere. */
  configureShadow(light: THREE.DirectionalLight, quality: Quality) {
    const key = `${quality}|${this.shadowFocus.min.toArray().join()}|${this.shadowFocus.max.toArray().join()}`;
    if (this.configured.get(light) === key) return;
    this.configured.set(light, key);
    const size = quality === "high" ? 4096 : 2048;
    light.castShadow = true;
    if (light.shadow.mapSize.x !== size) {
      light.shadow.mapSize.set(size, size);
      light.shadow.map?.dispose();
      (light.shadow as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
    const sphere = this.shadowFocus.getBoundingSphere(new THREE.Sphere());
    const r = sphere.radius + 1.5;
    const cam = light.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 0.5;
    cam.far = r * 2 + 80;
    cam.updateProjectionMatrix();
    light.shadow.bias = -0.00025;
    light.shadow.normalBias = 0.028;
    light.shadow.radius = quality === "performance" ? 2 : 3.5;
    light.shadow.needsUpdate = true;
  }

  /**
   * Point `light` along `sun` and retint it like the engine's updateSun (engine/lights.ts), then sync the design's
   * hemisphere "sky" fill, night emissives, Sky shader, fog, IBL and exposure.
   */
  applySun(light: THREE.DirectionalLight, sun: SunState, engine: { owned: boolean; hemi?: THREE.HemisphereLight | null; root?: THREE.Object3D | null }) {
    if (engine.owned) {
      // keep the design's own target and distance; just move along the new direction
      const dist = (light.userData.sunDistance as number) ?? 70;
      light.position.copy(light.target.position).addScaledVector(sun.dir, dist);
      light.intensity = sun.intensity * ((light.userData.intensityScale as number) ?? 1);
    } else {
      const center = this.shadowFocus.getCenter(new THREE.Vector3());
      const dist = this.shadowFocus.getBoundingSphere(new THREE.Sphere()).radius + 40;
      light.position.copy(center).addScaledVector(sun.dir, dist);
      light.target.position.copy(center);
      light.intensity = sun.intensity * 1.15;
    }
    light.target.updateMatrixWorld();
    light.updateMatrixWorld();
    light.color.copy(sun.color);
    const hemi = engine.hemi;
    if (hemi) {
      hemi.color.copy(sun.hemi.sky);
      hemi.groundColor.copy(sun.hemi.ground);
      hemi.intensity = sun.hemi.intensity * ((hemi.userData.intensityScale as number) ?? 1);
    }
    if (engine.root) applyNight(engine.root, sun.night);
    this.daylight = sun.daylight;
    this.hasHemi = !!hemi;
    this.syncSky(sun.skyDir);
  }

  private hasHemi = false;

  /** Leave a design's own sun where it is; just align the sky with it. */
  syncSkyToLight(light: THREE.DirectionalLight) {
    const dir = new THREE.Vector3().subVectors(light.position, light.target.position).normalize();
    this.daylight = smoothstep(-0.05, 0.2, dir.y);
    this.syncSky(dir);
  }

  private syncSky(dir: THREE.Vector3) {
    this.sky.material.uniforms.sunPosition.value.copy(dir);
    const d = this.daylight;
    const golden = 1 - smoothstep(0.08, 0.45, dir.y);
    // the design's hemisphere light already fills the shade; keep the IBL for reflections mostly
    this.scene.environmentIntensity = lerp(0.14, 0.36, d) * (this.hasHemi ? 0.6 : 1);
    // haze = the sky's own colour just above the horizon, so the ground plane melts into it
    const fog = this.scene.fog as THREE.Fog;
    const horizon = this.sampleHorizon();
    if (horizon) fog.color.copy(horizon);
    else fog.color.set("#d3d7d6").lerp(new THREE.Color("#e6c6a4"), golden * 0.85).lerp(new THREE.Color("#5c5a63"), 1 - d);
    (this.ground.material as THREE.MeshStandardMaterial).color.set("#c4c2bb").lerp(new THREE.Color("#b9aa98"), golden * 0.2);
    this.exposure = lerp(1.45, 1.0, d) * (1 + golden * 0.08);
  }

  private probe: { rt: THREE.WebGLRenderTarget; cam: THREE.PerspectiveCamera; scene: THREE.Scene; buf: Uint16Array } | null = null;

  /** Average linear colour of the sky 2° above the horizon (4 azimuths), read from a 1×1 half-float target. */
  private sampleHorizon(): THREE.Color | null {
    try {
      if (!this.probe) {
        const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
        const scene = new THREE.Scene();
        const sky = new THREE.Mesh(this.sky.geometry, this.sky.material);
        sky.scale.setScalar(100);
        sky.frustumCulled = false;
        scene.add(sky);
        this.probe = { rt, cam: new THREE.PerspectiveCamera(6, 1, 0.1, 1000), scene, buf: new Uint16Array(4) };
      }
      const { rt, cam, scene, buf } = this.probe;
      const prevTarget = this.gl.getRenderTarget();
      const prevClip = this.gl.clippingPlanes;
      this.gl.clippingPlanes = [];
      const samples: THREE.Color[] = [];
      const el = THREE.MathUtils.degToRad(3);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        cam.position.set(0, 0, 0);
        cam.lookAt(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el));
        cam.updateMatrixWorld();
        this.gl.setRenderTarget(rt);
        this.gl.render(scene, cam);
        this.gl.readRenderTargetPixels(rt, 0, 0, 1, 1, buf);
        samples.push(new THREE.Color(THREE.DataUtils.fromHalfFloat(buf[0]), THREE.DataUtils.fromHalfFloat(buf[1]), THREE.DataUtils.fromHalfFloat(buf[2])));
      }
      this.gl.setRenderTarget(prevTarget);
      this.gl.clippingPlanes = prevClip;
      // median by luminance: the sun-side glow would otherwise wash the whole horizon out
      samples.sort((p, q) => p.r + p.g + p.b - (q.r + q.g + q.b));
      const acc = samples[3].clone().add(samples[4]).multiplyScalar(0.5 * 0.92);
      const sum = acc.r + acc.g + acc.b;
      if (!Number.isFinite(sum) || sum < 1e-4) return null; // unreadable target → keep the analytic fallback
      return acc;
    } catch {
      return null;
    }
  }

  baseIntensity(light: THREE.DirectionalLight) {
    if (!this.engineSunBase.has(light)) this.engineSunBase.set(light, light.intensity > 0 ? light.intensity : 3);
    return this.engineSunBase.get(light)!;
  }

  setFallbackActive(on: boolean) {
    this.fallbackSun.visible = on;
    this.fallbackSun.castShadow = on;
  }

  dispose() {
    this.probe?.rt.dispose();
    this.probe = null;
    this.scene.remove(this.sky, this.ground, this.fallbackSun, this.fallbackSun.target);
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.MeshStandardMaterial).map?.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.fallbackSun.shadow.map?.dispose();
    this.fallbackSun.dispose();
    if (this.scene.environment === this.env) this.scene.environment = null;
    this.env.dispose();
    this.scene.fog = null;
  }
}
