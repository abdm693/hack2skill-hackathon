/** Engine dev harness (web/dev/engine.html): builds the fixture with buildHouse and renders it. */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { EffectComposer, EffectPass, RenderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { N8AOPostPass } from "n8ao";
import type { BuildingPlan } from "@contracts/plan";
import planFixture from "@contracts/fixtures/plan-10-marla.json";
import planArgon from "@contracts/fixtures/argon-v1-plan.json";
import designFixture from "@contracts/fixtures/design-10-marla.js?raw";
import designArgon from "@contracts/fixtures/argon-v1-design.js?raw";
import { buildHouse, defaultDesign, parseDesign, setTimeOfDay, sunDirection, texturesReady, updateSun, type BuildResult, type DesignSectionSrc } from "../index";

const app = document.getElementById("app")!;
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.info.autoReset = false;
renderer.transmissionResolutionScale = 0.6;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#9fb6cc");
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 900);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;

const pmrem = new THREE.PMREMGenerator(renderer);
const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.5;

const sky = new Sky();
sky.scale.setScalar(4000);
scene.add(sky);
const skyU = sky.material.uniforms;
skyU.turbidity.value = 4;
skyU.rayleigh.value = 1.4;
skyU.mieCoefficient.value = 0.004;
skyU.mieDirectionalG.value = 0.82;

// post-processing
const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
composer.addPass(new RenderPass(scene, camera));
const n8 = new N8AOPostPass(scene, camera, window.innerWidth, window.innerHeight);
n8.configuration.aoRadius = 0.9;
n8.configuration.distanceFalloff = 1.2;
n8.configuration.intensity = 2.2;
n8.configuration.halfRes = true;
n8.configuration.gammaCorrection = false;
composer.addPass(n8);
const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
composer.addPass(new EffectPass(camera, new SMAAEffect(), tone));
let usePost = true;

const designs: Record<string, () => { plan: BuildingPlan; sections: DesignSectionSrc[] }> = {
  fixture: () => ({ plan: planFixture as unknown as BuildingPlan, sections: parseDesign(designFixture) }),
  "fixture-default": () => ({ plan: planFixture as unknown as BuildingPlan, sections: defaultDesign(planFixture as unknown as BuildingPlan) }),
  argon: () => ({ plan: planArgon as unknown as BuildingPlan, sections: parseDesign(designArgon) }),
  "argon-default": () => ({ plan: planArgon as unknown as BuildingPlan, sections: defaultDesign(planArgon as unknown as BuildingPlan) }),
};

let current: BuildResult | null = null;
let currentPlan: BuildingPlan = planFixture as unknown as BuildingPlan;
let visibleLevels: Set<string> | null = null;
let buildMs = 0;
let clip: THREE.Plane | null = null;
let building = false;
let texWaitMs = 0;

const $ = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.search);
if (params.has("prof")) (globalThis as unknown as { __naqshaProf?: object }).__naqshaProf = {};
($("design") as HTMLSelectElement).value = params.get("design") ?? "fixture";
($("quality") as HTMLSelectElement).value = params.get("quality") ?? "high";

async function rebuild(): Promise<void> {
  const key = ($("design") as HTMLSelectElement).value;
  const quality = ($("quality") as HTMLSelectElement).value as "high" | "medium";
  const { plan, sections } = designs[key]();
  currentPlan = plan;
  if (current) {
    scene.remove(current.root);
    current.dispose();
    current = null;
  }
  $("stats").textContent = "building…";
  $("sections").innerHTML = "";
  building = true;
  const t0 = performance.now();
  let live: THREE.Group | null = null;
  const res = await buildHouse(plan, sections, {
    quality,
    onSection: (r, root) => {
      if (!live) {
        live = root;
        scene.add(root);
      }
      const d = document.createElement("div");
      d.innerHTML = `<span class="${r.ok ? "" : "err"}">${r.ok ? "✓" : "✗"} ${r.name} <i style="color:#777">[${r.layer}]</i>${r.error ? `<span class="msg">${escapeHtml(r.error)}</span>` : ""}</span><span>${r.ms.toFixed(0)} ms · ${r.objects}</span>`;
      $("sections").appendChild(d);
    },
  });
  buildMs = performance.now() - t0;
  const tTex = performance.now();
  await texturesReady();
  texWaitMs = performance.now() - tTex;
  building = false;
  current = res;
  if (!live) scene.add(res.root);
  buildLevelButtons(res);
  applyLevels();
  setHour(parseFloat(($("hour") as HTMLInputElement).value));
  const st = (res as unknown as { stats?: Record<string, number> }).stats;
  (window as unknown as Record<string, unknown>).__lastStats = st;
  renderer.compile(scene, camera);
  setView(params.get("view") ?? "aerial");
  frame();
  updateStats(st);
}

function buildLevelButtons(res: BuildResult): void {
  const box = $("levels");
  box.innerHTML = "";
  const mk = (label: string, ids: string[] | null) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = () => {
      visibleLevels = ids ? new Set(ids) : null;
      clip = null;
      applyLevels();
    };
    box.appendChild(b);
  };
  mk("All", null);
  const ids = res.levels.map((l) => l.id);
  res.levels.forEach((l, i) => mk(`≤ ${l.name}`, ids.slice(0, i + 1)));
}

function applyLevels(): void {
  if (!current) return;
  current.root.traverse((o) => {
    const lv = o.userData.level as string | undefined;
    if (lv && (o as THREE.Mesh).isMesh) o.visible = !visibleLevels || visibleLevels.has(lv);
    if (lv && (o as THREE.Light).isLight && !(o.userData.kind === "sun" || o.userData.kind === "sky")) o.visible = !visibleLevels || visibleLevels.has(lv);
  });
  renderer.clippingPlanes = clip ? [clip] : [];
}

function setHour(h: number): void {
  $("hourv").textContent = h.toFixed(2);
  if (!current) return;
  let sun: THREE.DirectionalLight | null = null;
  let hemi: THREE.HemisphereLight | null = null;
  current.root.traverse((o) => {
    if (o.userData.kind === "sun") sun = o as THREE.DirectionalLight;
    if (o.userData.kind === "sky") hemi = o as THREE.HemisphereLight;
  });
  if (sun) updateSun(sun, currentPlan, h, hemi);
  setTimeOfDay(current.root, currentPlan, h);
  const { dir } = sunDirection(currentPlan, h);
  skyU.sunPosition.value.copy(dir);
  const alt = Math.asin(dir.y);
  renderer.toneMappingExposure = 0.85 + 0.25 * Math.min(1, alt / 0.5);
}

const FT = 0.3048;
function roomCenter(type: string, level?: string): { x: number; y: number; w: number; d: number; floor: number } | null {
  const r = currentPlan.rooms.find((q) => q.type === type && (!level || q.level === level));
  if (!r) return null;
  const lv = currentPlan.levels.find((l) => l.id === r.level)!;
  return { x: r.rect.x, y: r.rect.y, w: r.rect.w, d: r.rect.d, floor: lv.elevation_ft };
}

function setView(name: string): void {
  const W = currentPlan.site.plot.width_ft * FT, D = currentPlan.site.plot.depth_ft * FT;
  visibleLevels = null;
  clip = null;
  camera.fov = 42;
  switch (name) {
    case "front":
      camera.position.set(W / 2, 1.75, -14.5);
      controls.target.set(W / 2, 4.6, D * 0.22);
      break;
    case "back":
      camera.position.set(W * 0.2, 9, D + 16);
      controls.target.set(W / 2, 4, D * 0.6);
      break;
    case "dollhouse": {
      const ids = current?.levels.map((l) => l.id) ?? [];
      visibleLevels = new Set(ids.slice(0, 1));
      camera.position.set(W + 7, 16, D * 0.05 - 4);
      controls.target.set(W * 0.45, 0, D * 0.52);
      break;
    }
    case "lounge":
    case "master": {
      const r = name === "lounge" ? roomCenter("lounge", "ground") ?? roomCenter("lounge") : roomCenter("master_bedroom") ?? roomCenter("bedroom");
      if (r) {
        camera.fov = 62;
        camera.position.set((r.x + r.w - 1.6) * FT, (r.floor + 5.2) * FT, (r.y + r.d - 1.4) * FT);
        controls.target.set((r.x + r.w * 0.3) * FT, (r.floor + 3.6) * FT, (r.y + r.d * 0.3) * FT);
        if (name === "master") visibleLevels = null;
      }
      break;
    }
    default:
      camera.position.set(-W * 0.55, 15, -11);
      controls.target.set(W * 0.5, 3.2, D * 0.42);
  }
  camera.updateProjectionMatrix();
  controls.update();
  applyLevels();
  document.querySelectorAll("#views button").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.view === name));
}

function frame(): void {
  renderer.info.reset();
  if (usePost) composer.render();
  else renderer.render(scene, camera);
}

function updateStats(st?: Record<string, number>): void {
  frame();
  const info = renderer.info;
  const sec = current?.sections ?? [];
  const errs = sec.filter((s) => !s.ok).length;
  $("stats").textContent =
    `build ${buildMs.toFixed(0)} ms (engine ${st?.totalMs?.toFixed(0) ?? "?"} · merge ${st?.consolidateMs?.toFixed(0) ?? "?"}) · textures +${texWaitMs.toFixed(0)} ms\n` +
    `meshes ${st?.meshesBefore ?? "?"} → ${st?.meshesAfter ?? "?"}\n` +
    `draw calls ${info.render.calls} · tris ${(info.render.triangles / 1000).toFixed(0)}k\n` +
    `geometries ${info.memory.geometries} · textures ${info.memory.textures}\n` +
    `sections ${sec.length} · errors ${errs} · colliders ${current?.colliders.length ?? 0}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

$("rebuild").onclick = () => void rebuild();
$("design").onchange = () => void rebuild();
$("quality").onchange = () => void rebuild();
$("toggle").onclick = () => $("ui").classList.toggle("min");
document.querySelectorAll("#views button").forEach((b) => ((b as HTMLElement).onclick = () => setView((b as HTMLElement).dataset.view!)));
$("hour").oninput = (e) => setHour(parseFloat((e.target as HTMLInputElement).value));
$("post").onchange = (e) => {
  usePost = (e.target as HTMLInputElement).checked;
  renderer.toneMapping = usePost ? THREE.NoToneMapping : THREE.AgXToneMapping;
};
renderer.toneMapping = THREE.NoToneMapping;

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

let statTick = 0;
renderer.setAnimationLoop(() => {
  if (building) return;
  controls.update();
  frame();
  if (++statTick % 60 === 0 && current) updateStats((window as unknown as { __lastStats?: Record<string, number> }).__lastStats);
});

// automation hooks for screenshots / checks
(window as unknown as Record<string, unknown>).__engine = {
  rebuild,
  setView,
  setHour: (h: number) => {
    ($("hour") as HTMLInputElement).value = String(h);
    setHour(h);
  },
  capture: (w?: number, h?: number) => {
    if (w && h) {
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    frame();
    return renderer.domElement.toDataURL("image/png");
  },
  stats: () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, buildMs, texWaitMs, ...(window as unknown as { __lastStats?: object }).__lastStats }),
  texturesReady,
  camera,
  controls,
  scene,
  get result() {
    return current;
  },
};

void rebuild();
