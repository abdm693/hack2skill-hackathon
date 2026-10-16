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
    u.turbidity.value = 6.5; // Lahore haze
    u.rayleigh.value = 1.35;
    u.mieCoefficient.value = 0.0055;
    u.mieDirectionalG.value = 0.86;
    if (u.cloudCoverage) u.cloudCoverage.value = 0.22;
    if (u.cloudDensity) u.cloudDensity.value = 0.32;
    if (u.cloudElevation) u.cloudElevation.value = 0.62;
    this.sky.scale.setScalar(6000);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -1;
    this.sky.userData = { noPick: true, viewer: "sky" };
    scene.add(this.sky);

    const groundMat = new THREE.MeshStandardMaterial({ color: "#bdb4a2", roughness: 1, metalness: 0 });
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(900, 72), groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.06;
    this.ground.receiveShadow = true;
    this.ground.userData = { noPick: true, viewer: "ground" };
    scene.add(this.ground);
    scene.fog = new THREE.Fog("#d4d6d2", 160, 850);

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

  /** Point `light` along `sun`, retint it, and sync sky, fog, IBL and exposure. */
  applySun(light: THREE.DirectionalLight, sun: SunState, skyDir: THREE.Vector3, engineOwned: boolean) {
    const center = this.shadowFocus.getCenter(new THREE.Vector3());
    const dist = this.shadowFocus.getBoundingSphere(new THREE.Sphere()).radius + 40;
    light.position.copy(center).addScaledVector(sun.dir, dist);
    light.target.position.copy(center);
    light.target.updateMatrixWorld();
    light.updateMatrixWorld();
    const base = engineOwned ? this.baseIntensity(light) : 3.1;
    light.intensity = base * lerp(0.04, 1, sun.daylight) * (0.82 + 0.18 * smoothstep(5, 35, sun.elevationDeg));
    light.color.copy(sun.color);
    this.daylight = sun.daylight;
    this.syncSky(skyDir);
  }

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
    this.scene.environmentIntensity = lerp(0.18, 0.62, d);
    // haze colour ≈ sky near the horizon so the ground melts into it
    const fog = this.scene.fog as THREE.Fog;
    fog.color.set("#d3d7d6").lerp(new THREE.Color("#e6c6a4"), golden * 0.85).lerp(new THREE.Color("#5c5a63"), 1 - d);
    (this.ground.material as THREE.MeshStandardMaterial).color.set("#bdb4a2").lerp(new THREE.Color("#c9a989"), golden * 0.35);
    this.exposure = lerp(1.45, 1.0, d) * (1 + golden * 0.08);
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
    this.scene.remove(this.sky, this.ground, this.fallbackSun, this.fallbackSun.target);
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.ground.geometry.dispose();
    (this.ground.material as THREE.Material).dispose();
    this.fallbackSun.shadow.map?.dispose();
    this.fallbackSun.dispose();
    if (this.scene.environment === this.env) this.scene.environment = null;
    this.env.dispose();
    this.scene.fog = null;
  }
}
