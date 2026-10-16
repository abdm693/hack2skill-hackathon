# Tech stack reference: AI house designer (hackathon)

Researched **2026-10-16**. Versions were pulled live from the npm and PyPI registries. Google docs, GitHub READMEs and source were fetched the same day.

How to read the tags:

- **[verified]**: checked against an official doc, the registry, or package source.
- **[tested]**: the code was run in a scratch environment (Node 22 / Python 3.12–3.13) without a GPU or browser.
- **[type-checked]**: compiled with `tsc` against the exact pinned packages. It was not run in a browser.
- **[uncertain]**: the source is third-party, ambiguous or older. Verify before relying on it.

Nothing here was live-called against Gemini (no spend on the project). The project's `SETUP.md` already confirms `gemini-4-argon` and `gemini-3.8-flash` answer on `location=global`.

---

## 0. Pins at a glance

### Frontend (npm) [verified]

| Package | Pin | Published | Peer deps / notes |
|---|---|---|---|
| `next` | **16.4.2** | 2026-10-15 | Node ≥ 20.9. App Router vendors `react@19.3.0-canary-278794d7-20261002`. Turbopack is the default bundler. |
| `react`, `react-dom` | **19.3.1** | 2026-10-14 | R3F 9.8.x requires **≥19 <19.4**. |
| `three` | **0.186.1** (r186) | 2026-09-24 | |
| `@types/three` | **0.186.0** | 2026-09-11 | Depends on `@dimforge/rapier3d-compat ~0.12.0` (see Rapier gotcha). |
| `@react-three/fiber` | **9.8.2** | 2026-10-14 | `react >=19 <19.4`, `three >=0.156`. 9.8.0 added React 19.3 support and fixed async (WebGPU) root gating. |
| `@react-three/drei` | **10.7.9** | 2026-09-25 | `fiber ^9`, `react ^19`. Bundles `three-mesh-bvh@0.8.x` and `stats-gl` (which pulls its own `three@0.170` unless overridden). |
| `@react-three/postprocessing` | **3.2.0** | 2026-10-10 | `fiber >=9.7.0`, `postprocessing ^6.36`, depends on `n8ao ^2`. WebGL only. |
| `postprocessing` | **6.39.5** | 2026-09-09 | **`three >=0.168 <0.187`**: three r187 will break the peer range. |
| `n8ao` | **2.0.1** | 2026-08-10 | `three >=0.137`, `postprocessing >=6.30`. |
| `three-mesh-bvh` | **0.9.16** | 2026-10-08 | `three >=0.159`. 0.9.16 fixes `BVHHelper` on r186. |
| `three-bvh-csg` | **0.0.18** | 2026-02-17 | `three >=0.179`, `three-mesh-bvh >=0.9.7`. Self-described "experimental". |
| `three-gpu-pathtracer` | **0.0.27** | 2026-10-08 | `three >=0.185`, `three-mesh-bvh >=0.9.15`, `xatlas-web ^0.1.0` (npm auto-installs it). |
| `@react-three/rapier` (optional) | **2.2.0** | 2025-11-03 | `fiber ^9.0.4`, `react ^19`. Hard-pins `@dimforge/rapier3d-compat@0.19.2`. |

```bash
npm i --save-exact next@16.4.2 react@19.3.1 react-dom@19.3.1 \
  three@0.186.1 @react-three/fiber@9.8.2 @react-three/drei@10.7.9 \
  @react-three/postprocessing@3.2.0 postprocessing@6.39.5 n8ao@2.0.1 \
  three-mesh-bvh@0.9.16 three-bvh-csg@0.0.18 three-gpu-pathtracer@0.0.27
npm i -D --save-exact @types/three@0.186.0
# optional physics:  npm i --save-exact @react-three/rapier@2.2.0
```

Add this to `package.json`. It is **[tested]**: it removes the duplicate `three@0.170` that `stats-gl` (via drei) installs.

```json
"overrides": { "three": "$three" }
```

### Backend (PyPI), Python 3.13 [verified, tested install]

```text
google-adk==2.12.0          # 2026-10-13, requires Python >=3.11
google-genai==2.31.0        # 2026-10-14 (Gemini 4 Argon needs >=2.30.1)
google-cloud-firestore==2.34.1
google-cloud-storage==3.17.1
uvicorn[standard]==0.54.0
# Let ADK resolve fastapi/starlette/pydantic. It resolves to fastapi 0.141.1, starlette 1.8.0, pydantic 2.14.1.
# Do NOT pin fastapi 0.143.x: it needs opentelemetry-api>=1.44, and google-adk 2.12.0 caps it at <=1.42.1 (unsatisfiable). [tested]
```

### Models on Gemini Enterprise Agent Platform (formerly Vertex AI) [verified]

| Job | Model ID | Endpoint | Price (Standard PayGo, global) |
|---|---|---|---|
| 3D design, spec and code generation | `gemini-4-argon` | `global`, `us`, `eu` (not regional) | $2 in / $10 out per 1M through 2026-11-30 (promo, paid as a 50% credit-back). **$4 / $20 from 2026-12-01.** Non-global is +10%. |
| Fast helper (routing, comment parsing) | `gemini-3.8-flash` | `global`, `us`, `eu` | $0.75 / $3.75 promo through 2026-12-31, then $1.50 / $7.50 |
| Concept images (default) | `gemini-nano-banana-2.1` | **global only** | ≈ $0.034 (1K) / $0.050 (2K) / $0.113 (4K) per image |
| Highest-fidelity images | `gemini-3-pro-image` | **global only** | ≈ $0.134 (1K and 2K) / $0.24 (4K) |
| Alternative image model | `gemini-3.1-flash-image` | `global`, `us`, `eu` | ≈ $0.045 (512) / $0.067 (1K) / $0.101 (2K) / $0.15 (4K) |
| Do not use | `imagen-4.0-*-001` | | Discontinued 2026-06-30 per the Vertex docs, though the Agent Platform pricing page still lists it. Gemini API shutdown was 2026-08-17. |

---

## 1. three.js ecosystem

### 1.1 Fit with React 19 and Next.js 15/16

| Package | Verdict | Notes |
|---|---|---|
| `three` r186 | Yes | Requiring the CJS build logs `THREE_CJS_DEPRECATED`. Next's client bundles use ESM, so that is not an issue there. r183 deprecated `THREE.Clock`, and R3F 9.8.2 still creates one, so expect one console warning. |
| `@react-three/fiber` 9.8.2 | Yes | 9.8.0 added React 19.3 support and fixed StrictMode with async (WebGPU) roots. **Peer range stops at <19.4.** Next 16.4.2's App Router runs React 19.3 canary, so it is compatible today. Do not bump React or Next minors mid-hackathon. |
| `@react-three/drei` 10.7.9 | Yes | `<Html>` logs a dev-only StrictMode warning, "Attempted to synchronously unmount a root" (drei #2867, open). It is harmless in production. `Environment preset="..."` downloads from `raw.githack.com`, so self-host HDRIs instead. `useGLTF` pulls Draco decoders from `gstatic.com`. |
| `@react-three/postprocessing` 3.2.0 + `postprocessing` 6.39.5 | Yes, WebGL only | **`<EffectComposer>` forces `gl.toneMapping = NoToneMapping` while mounted [verified in source].** Put `<ToneMapping mode={ToneMappingMode.AGX}/>` last, or the output is untonemapped. `ToneMappingMode` has `AGX=7` and `NEUTRAL=8`. There is no SSR effect in postprocessing v6. |
| `n8ao` 2.0.1 | Yes, WebGL only | Use it via `<N8AO/>`. 2.x adds `setQualityMode("Neural-Low" \| "Neural-Medium" \| "Neural-High")`, available on the pass ref. |
| `three-mesh-bvh` 0.9.16 | Yes | The pure-JS parts (raycast, shapecast) work with any renderer. drei keeps its own nested 0.8.3. That is fine, just duplicate code. |
| `three-bvh-csg` 0.0.18 | Yes | Brushes must be two-manifold (watertight). With three-mesh-bvh 0.9.16 it logs `"maxLeafSize" option has been deprecated` (harmless) **[tested]**. |
| `three-gpu-pathtracer` 0.0.27 | Partly | `WebGLPathTracer` is **deprecated** (it logs a warning) but still exported. The new `WebGPUPathTracer` from `three-gpu-pathtracer/webgpu` requires a `WebGPURenderer`. Avoid the `@react-three/gpu-pathtracer` wrapper: 0.3.2 pins `three-gpu-pathtracer ^0.0.23`. |
| `@react-three/rapier` 2.2.0 | Yes, with caveats | See 1.9. Avoid `@react-three/csg` 4.0.0, which pins `three-mesh-bvh ^0.6.8` and `three-bvh-csg ^0.0.16`. |

Next.js integration:

- Put the `<Canvas>` tree in a `'use client'` file. Load it with `next/dynamic(() => import('./Scene'), { ssr: false })` from another client component. `ssr: false` is not allowed in Server Components.
- Turbopack is the default in Next 16, and R3F 9 works with it. The R3F v10-alpha `/webgpu` entry had a Turbopack crash (#3846, closed). `next build --webpack` is the escape hatch.
- The React Compiler (`reactCompiler: true`) is stable in Next 16 but opt-in. R3F 9.6+ improved compatibility. Leave it off unless you have time to test the 3D subtree.
- Next 16 needs TypeScript ≥ 5.1. `npm i typescript` currently installs **7.0.2**, and the snippets below type-check with it.

### 1.2 WebGPU renderer status [verified]

- The three r186 manual says `WebGPURenderer` "is still in an experimental state although its maturity level has been greatly improved". It falls back to a **WebGL 2 backend** automatically (`forceWebGL: true` forces it).
  - Imports: `three/webgpu` and `three/tsl`.
  - Initialization is async: use `await renderer.init()` or `setAnimationLoop`.
  - `ShaderMaterial`, `RawShaderMaterial` and `onBeforeCompile` are **not supported**. You must port them to node materials and TSL.
  - `EffectComposer` is not supported. Use `THREE.RenderPipeline` (renamed from `PostProcessing`) with TSL nodes: `GTAONode`, `SSRNode` (denoiser added in r185), `SSGINode`, `TRAANode`, `BloomNode`, `SMAANode`, `FXAANode`.
  - In r186, `PCFSoftShadowMap` was removed for WebGPU, and `PCFShadowMap` is now soft.
- **R3F 9.x** supports it through an async `gl` factory (official docs). See the snippet in 1.4.
  - A TypeScript gotcha **[type-checked]**: the doc's `interface ThreeElements extends ThreeToJSXElements<typeof THREE>` clashes with the default WebGL typings (`pMREMGenerator` conflict). Augment only the node materials you use.
- **R3F v10** (`10.0.0-alpha.5`, 2026-09-08) and **drei v11** (`11.0.0-alpha.7`) are WebGPU and TSL-first (`@react-three/fiber/webgpu`, `useUniforms`, `useRenderPipeline`). They are alpha. `@react-three/rapier` 3.0 (R3F v10/WebGPU) is only a tracking issue (#789).
- **What breaks on WebGPU:**
  - `@react-three/postprocessing` and `postprocessing`
  - `n8ao`
  - drei shader-based pieces: `MeshReflectorMaterial`, `MeshTransmissionMaterial`, `SoftShadows`, `AccumulativeShadows`
  - `WebGLPathTracer`
- **Browser support:** Chrome/Edge (desktop and Android), Safari 26 (macOS, iOS and iPadOS 26), Firefox 141+ on Windows and 145+ on Apple-silicon macOS. Firefox on Linux and Android was still in progress per web.dev (Nov 2025) **[uncertain as of Oct 2026]**.
- **Verdict:** stay on **WebGLRenderer** for the hackathon. The whole archviz toolchain here (postprocessing, N8AO, drei materials, WebGL path tracer) is WebGL-only, and WebGPU in R3F is officially alpha (v10).

### 1.3 Photoreal archviz settings (WebGL path)

| Concern | Recommended setting | Why / notes |
|---|---|---|
| Tone mapping | **`THREE.AgXToneMapping`**, exposure 0.9–1.2. Use `NeutralToneMapping` for a "material swatch" view. Avoid ACES. | AgX rolls off bright skies and windows gracefully, at the cost of some highlight desaturation. Khronos PBR Neutral keeps base colours faithful, which matters for paint and material choices, but clips harder. ACES shifts hues and oversaturates. With `<EffectComposer>` you must use `<ToneMapping mode={ToneMappingMode.AGX}/>` (see 1.1). |
| Colour | `outputColorSpace = SRGBColorSpace` (R3F default). Colour maps use `SRGBColorSpace`. Normal, roughness, AO and ARM maps stay linear (`NoColorSpace`). | Wrong colour space is the #1 "looks fake" bug. |
| Environment / IBL | Poly Haven **2k `.hdr`** via `<Environment files=... background environmentIntensity={1}/>`. Use `ground={{ height, radius }}` (GroundedSkybox) for exteriors. Rotate it with `environmentRotation` to match the sun. | `kloofendal_48d_partly_cloudy_puresky_1k.hdr` is 1.4 MB and `venice_sunset_2k.hdr` is 5.7 MB **[verified]**. Self-host on GCS. |
| Sun and soft shadows | `<Canvas shadows="percentage">`, a directional light with `shadow-mapSize 2048–4096` and `shadow-radius 4–8`, `bias ≈ -2e-4`, `normalBias 0.02–0.05`, and a tight shadow-camera frustum around the house. Add `<BakeShadows/>` once the scene is static. | In r186, WebGL `PCFShadowMap` does Vogel-disk soft filtering using `shadow.radius` **[verified in shader]**. **Do not pass boolean `shadows`**: R3F maps it to `PCFSoftShadowMap`, which r186 removes with a warning. `<SoftShadows/>` (drei PCSS) is an option and was updated for new three in 10.7.9. |
| AO | `<N8AO halfRes aoRadius={0.5–1.0} distanceFalloff={1} intensity={2–3} quality="medium"/>`. Set `multisampling={0}` on the composer and add `<SMAA/>`. | `aoRadius` is in world units, so metres here. MSAA does not work with N8AO. |
| Reflections (SSR) | There is no SSR in pmndrs postprocessing v6. Use drei `<MeshReflectorMaterial>` on one hero glossy floor, and env-map reflections elsewhere (roughness ≥ 0.2 hides it). On WebGPU, `SSRNode` exists. | Each reflector re-renders the scene, so use one at most. |
| Glass | `meshPhysicalMaterial transmission={1} thickness={0.005–0.01} roughness={0–0.05} ior={1.5}`. Do not set `transparent`. Add a slight `attenuationColor` tint. | Transmission adds one extra scene render (`gl.transmissionResolutionScale` can lower it). Transmissive objects don't see each other. For many windows, a cheap fallback is `transparent`, `opacity 0.15`, `roughness 0`. |
| Lightmaps / baked AO | glTF `TEXCOORD_1` becomes `uv1`. Choose the set with `texture.channel` (0 = `uv`, 1 = `uv1`); since r151 `aoMap` and `lightMap` no longer default to `uv2`. | Runtime baking isn't realistic in 2 days. Use N8AO plus contact shadows. Path-traced photo mode (1.8) gives "baked" quality for stills. |
| Textures | `RepeatWrapping` and `anisotropy` 8. Use **world-scale UVs** (1.7 helper). Poly Haven texture `dimensions` are in **mm**. ambientCG `dimensions` appear to be **cm** (0 = unknown) **[uncertain]**. | Box UVs stretch bricks on long walls. |
| Performance | `dpr={[1, 2]}`, drei `<Bvh firstHitOnly>` for pointer raycasts, `<PerformanceMonitor>` / `<AdaptiveDpr>`, `frameloop="demand"` in orbit view (walk mode needs `"always"`), and 1k textures for furniture. | |

### 1.4 Canvas setup (WebGL) [type-checked]

```tsx
'use client'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Environment, MeshReflectorMaterial, Bvh } from '@react-three/drei'
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'

export default function Scene({ children }: { children: React.ReactNode }) {
  return (
    <Canvas
      shadows="percentage"                       // NOT boolean `shadows` (maps to removed PCFSoftShadowMap on r186)
      dpr={[1, 2]}
      camera={{ fov: 60, near: 0.05, far: 500, position: [8, 6, 12] }}
      gl={{ antialias: false, powerPreference: 'high-performance', toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.0 }}
    >
      <Environment files="/hdri/kloofendal_48d_partly_cloudy_puresky_2k.hdr" background environmentIntensity={1} />
      <directionalLight castShadow position={[12, 18, 8]} intensity={3}
        shadow-mapSize={[4096, 4096]} shadow-bias={-0.0002} shadow-normalBias={0.03} shadow-radius={6}
        shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
      <Bvh firstHitOnly>{children}</Bvh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001}>{/* one hero glossy floor */}
        <planeGeometry args={[6, 6]} />
        <MeshReflectorMaterial mirror={0.4} blur={[300, 100]} resolution={1024} mixBlur={1} mixStrength={2} roughness={0.6} metalness={0} />
      </mesh>
      <EffectComposer multisampling={0}>
        <N8AO halfRes aoRadius={0.6} distanceFalloff={1} intensity={2.5} quality="medium" />
        <SMAA />
        <ToneMapping mode={ToneMappingMode.AGX} />{/* required: composer disables renderer tone mapping */}
      </EffectComposer>
    </Canvas>
  )
}

export const Glass = () => (
  <meshPhysicalMaterial transmission={1} thickness={0.01} roughness={0.02} ior={1.5} metalness={0}
    attenuationColor="#e8f4f2" attenuationDistance={2} />
)
```

WebGPU variant (only if you deliberately go WebGPU) [type-checked]:

```tsx
'use client'
import * as THREE from 'three/webgpu'
import { Canvas, extend, type ThreeElement } from '@react-three/fiber'

declare module '@react-three/fiber' {          // augment only what you use (full ThreeToJSXElements<typeof THREE> clashes)
  interface ThreeElements { meshStandardNodeMaterial: ThreeElement<typeof THREE.MeshStandardNodeMaterial> }
}
extend({ MeshStandardNodeMaterial: THREE.MeshStandardNodeMaterial })

export const WebGPUCanvas = ({ children }: { children: React.ReactNode }) => (
  <Canvas gl={async (props) => {
    const renderer = new THREE.WebGPURenderer({ ...(props as any), antialias: true }) // auto-falls back to WebGL2 backend
    await renderer.init()
    return renderer
  }}>{children}</Canvas>
)
```

### 1.5 (a) First-person walkthrough with collision, stairs and floor snapping

This adapts the official `three-mesh-bvh` `characterMovement` example: a capsule shapecast against one merged static BVH, with sub-stepping. The core loop was **[tested]** headless in Node, and the R3F component is **[type-checked]**. The Node sim with capsule radius 0.3 m gave these results:

| Step rise | Result |
|---|---|
| 0.18 m (typical residential stair) | Climbs; walking off the top drops back to the floor |
| 0.25 m | Climbs |
| 0.30 m (= radius) or more | Blocks like a wall |

So "stairs" work automatically if rise < ~0.8 × radius. Floor snapping comes from the vertical push-out and the `onGround` reset.

Two bugs were found while testing, and both are fixed below. The 1e-5 epsilon is required, or float noise cancels gravity and you "float down". The collider group needs `updateMatrixWorld(true)` before `StaticGeometryGenerator`, or every mesh collapses to the origin.

```tsx
'use client'
import * as THREE from 'three'
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls, KeyboardControls, useKeyboardControls } from '@react-three/drei'
import { MeshBVH, StaticGeometryGenerator } from 'three-mesh-bvh'

type Controls = 'forward' | 'back' | 'left' | 'right' | 'jump'
export const keyMap: { name: Controls; keys: string[] }[] = [
  { name: 'forward', keys: ['KeyW', 'ArrowUp'] }, { name: 'back', keys: ['KeyS', 'ArrowDown'] },
  { name: 'left', keys: ['KeyA', 'ArrowLeft'] }, { name: 'right', keys: ['KeyD', 'ArrowRight'] },
  { name: 'jump', keys: ['Space'] },
]
const EYE_HEIGHT = 1.6, RADIUS = 0.3, GRAVITY = -9.81 * 2, SPEED = 3.0, STEPS = 5

/** One merged BVH collider from every mesh under root (skip a mesh with userData.collide = false). */
export function useCollider(root: THREE.Object3D | null) {
  return useMemo(() => {
    if (!root) return null
    root.updateMatrixWorld(true)
    const colliders = new THREE.Group()
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.userData.collide !== false) {
        const c = new THREE.Mesh(m.geometry); c.applyMatrix4(m.matrixWorld); colliders.add(c)
      }
    })
    colliders.updateMatrixWorld(true)           // REQUIRED: generator bakes matrixWorld (stale on a detached group)
    const gen = new StaticGeometryGenerator(colliders)
    gen.attributes = ['position']
    const geometry = gen.generate()
    geometry.boundsTree = new MeshBVH(geometry)
    return new THREE.Mesh(geometry)             // query-only; don't add to the scene
  }, [root])
}

export function Player({ collider, spawn = [0, 0, 0] }: { collider: THREE.Mesh | null; spawn?: [number, number, number] }) {
  const camera = useThree((s) => s.camera)
  const [, get] = useKeyboardControls<Controls>()
  const feet = useRef(new THREE.Vector3(...spawn))
  const velocity = useRef(new THREE.Vector3())
  const onGround = useRef(false)
  const t = useMemo(() => ({ v: new THREE.Vector3(), v2: new THREE.Vector3(), box: new THREE.Box3(), seg: new THREE.Line3(),
    fwd: new THREE.Vector3(), side: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0) }), [])

  useEffect(() => { camera.position.set(spawn[0], spawn[1] + EYE_HEIGHT, spawn[2]) }, [camera, spawn])

  useFrame((_, dt) => {
    if (!collider?.geometry.boundsTree) return
    const delta = Math.min(dt, 0.1) / STEPS
    const { forward, back, left, right, jump } = get()
    for (let i = 0; i < STEPS; i++) {
      velocity.current.y = onGround.current ? Math.max(velocity.current.y, 0) : velocity.current.y + GRAVITY * delta
      if (jump && onGround.current) { velocity.current.y = 4; onGround.current = false }
      feet.current.addScaledVector(velocity.current, delta)

      camera.getWorldDirection(t.fwd); t.fwd.y = 0; t.fwd.normalize()
      t.side.crossVectors(t.fwd, t.up).normalize()
      const move = t.v.set(0, 0, 0)
      if (forward) move.add(t.fwd); if (back) move.sub(t.fwd)
      if (right) move.add(t.side); if (left) move.sub(t.side)
      if (move.lengthSq() > 0) feet.current.addScaledVector(move.normalize(), SPEED * delta)

      // capsule = segment from (feet + r) to (eye - r), radius r
      t.seg.start.copy(feet.current).y += RADIUS
      t.seg.end.copy(feet.current).y += EYE_HEIGHT - RADIUS
      t.box.makeEmpty().expandByPoint(t.seg.start).expandByPoint(t.seg.end)
      t.box.min.addScalar(-RADIUS); t.box.max.addScalar(RADIUS)

      collider.geometry.boundsTree.shapecast({
        intersectsBounds: (box) => box.intersectsBox(t.box),
        intersectsTriangle: (tri) => {
          const triPoint = t.v, capsulePoint = t.v2
          const distance = tri.closestPointToSegment(t.seg, triPoint, capsulePoint)
          if (distance < RADIUS) {
            const depth = RADIUS - distance
            const dir = capsulePoint.sub(triPoint).normalize()
            t.seg.start.addScaledVector(dir, depth); t.seg.end.addScaledVector(dir, depth)
          }
        },
      })

      const newFeet = t.v.copy(t.seg.start); newFeet.y -= RADIUS
      const correction = t.v2.subVectors(newFeet, feet.current)
      onGround.current = correction.y > Math.abs(delta * velocity.current.y * 0.25)  // pushed mostly up => standing
      const offset = Math.max(0, correction.length() - 1e-5)                           // ignore float noise (required)
      correction.normalize().multiplyScalar(offset)
      feet.current.add(correction)
      if (onGround.current) velocity.current.set(0, 0, 0)
      else if (offset > 0) { correction.normalize(); velocity.current.addScaledVector(correction, -correction.dot(velocity.current)) }
    }
    if (feet.current.y < -20) { feet.current.set(...spawn); velocity.current.set(0, 0, 0) }
    camera.position.set(feet.current.x, feet.current.y + EYE_HEIGHT, feet.current.z)
  })
  return <PointerLockControls makeDefault />
}

export const WalkthroughControls = ({ children }: { children: React.ReactNode }) =>
  <KeyboardControls map={keyMap}>{children}</KeyboardControls>

// usage:
// const [house, setHouse] = useState<THREE.Group | null>(null); const collider = useCollider(house)
// <WalkthroughControls><Canvas ...><group ref={setHouse}>...</group><Player collider={collider} spawn={[0,0,3]} /></Canvas></WalkthroughControls>
```

Notes:

- Rebuild the collider only when the design changes. BVH build cost is proportional to triangle count, so merge static architecture only and tag small decor with `userData.collide = false`.
- Doorways need a clear opening wider than 2 × radius. CSG openings (1.7) create real holes.

### 1.6 (b) Raycast-on-click comment pins with HTML labels [type-checked]

```tsx
'use client'
import * as THREE from 'three'
import { useState } from 'react'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Html } from '@react-three/drei'

export type Pin = { id: string; position: [number, number, number]; normal: [number, number, number]; objectName: string; text: string }

/** Orbit mode: click any surface under <PinLayer> to create a pin. */
export function PinLayer({ children, pins, onAdd }: { children: React.ReactNode; pins: Pin[]; onAdd: (p: Omit<Pin, 'id' | 'text'>) => void }) {
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()                                   // nearest hit only
    if (!e.face) return
    const n = e.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(e.object.matrixWorld)).normalize()
    onAdd({ position: e.point.toArray() as [number, number, number], normal: n.toArray() as [number, number, number], objectName: e.object.name })
  }
  return (
    <group>
      <group onClick={handleClick}>{children}</group>
      {pins.map((p) => <PinMarker key={p.id} pin={p} />)}
    </group>
  )
}

function PinMarker({ pin }: { pin: Pin }) {
  const [open, setOpen] = useState(false)
  const pos = new THREE.Vector3(...pin.position).addScaledVector(new THREE.Vector3(...pin.normal), 0.02)
  return (
    <group position={pos}>
      <mesh onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshBasicMaterial color="#ff3b30" toneMapped={false} />
      </mesh>
      <Html center distanceFactor={8} occlude zIndexRange={[100, 0]}>
        <div style={{ background: 'white', padding: '4px 8px', borderRadius: 6, fontSize: 12, whiteSpace: 'nowrap' }}
             onClick={() => setOpen((o) => !o)}>{open ? pin.text : 'Note'}</div>
      </Html>
    </group>
  )
}

/** Walk mode: pointer lock freezes the cursor, so cast from screen centre on click instead of using onClick. */
export function useCenterRaycast() {
  const { camera, scene, raycaster } = useThree()
  return () => {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
    const hit = raycaster.intersectObjects(scene.children, true).find((h) => (h.object as THREE.Mesh).isMesh && h.face)
    if (!hit || !hit.face) return null
    const normal = hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize()
    return { point: hit.point, normal, object: hit.object }
  }
}
```

Persist pins in Firestore as `{position, normal, objectName, elementId, text, cameraPose}`. Make sure every generated mesh has a stable `name` or `userData.elementId` (wall id, furniture id), so the agent can map a comment to an element of the spec. With many pins, use `occlude={[houseRef]}` instead of `occlude` (which raycasts against the whole scene every frame).

### 1.7 Cutting door and window openings (three-bvh-csg) [tested]

```ts
import * as THREE from 'three'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'

const evaluator = new Evaluator()
evaluator.attributes = ['position', 'uv', 'normal']

/** Wall spanning x = 0..length in its parent's space, with rectangular through-holes. */
export function wallWithOpenings(length: number, height: number, thickness: number,
  openings: { x: number; y: number; w: number; h: number }[],   // x = centre along wall, y = sill height
  material: THREE.Material | THREE.Material[]): THREE.Mesh {
  let result: Brush = new Brush(new THREE.BoxGeometry(length, height, thickness), material)
  result.position.set(length / 2, height / 2, 0); result.updateMatrixWorld()
  for (const o of openings) {
    const cutter = new Brush(new THREE.BoxGeometry(o.w, o.h, thickness * 1.5))   // deeper than the wall
    cutter.position.set(o.x, o.y + o.h / 2, 0); cutter.updateMatrixWorld()
    result = evaluator.evaluate(result, cutter, SUBTRACTION)
  }
  result.castShadow = result.receiveShadow = true
  return result
}
```

Measured in Node: a 4 × 2.7 × 0.2 m wall with one window took 12.5 ms and produced 66 triangles. Rays through the window and a door miss, and rays through solid wall hit. The result Brush **keeps brush A's transform**, so its geometry stays in A's local space. Chained cuts work.

For textures that tile at true scale, apply box-projected world UVs after baking the transform (`geometry.applyMatrix4(mesh.matrix)`, then reset the mesh transform). The helper is **[type-checked, tested]**:

```ts
export function boxProjectUVs(geometry: THREE.BufferGeometry, tileSizeM = 1): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  g.computeVertexNormals()
  const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i)), ay = Math.abs(nor.getY(i)), az = Math.abs(nor.getZ(i))
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const [u, v] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y]
    uv[i * 2] = u / tileSizeM; uv[i * 2 + 1] = v / tileSizeM
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}
```

### 1.8 Progressive path-traced "photo mode" [type-checked]

Mount this only while photo mode is on and the camera is still. **Unmount `<EffectComposer>` while it runs**: both use `useFrame` priority 1 and fight over the canvas. It uses the deprecated WebGL tracer, which is still shipped in 0.0.27. Expect a console deprecation warning. Pin the version, because a future release removes it.

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { WebGLPathTracer } from 'three-gpu-pathtracer'

export function PhotoMode({ bounces = 6, onSamples }: { bounces?: number; onSamples?: (n: number) => void }) {
  const { gl, scene, camera } = useThree()
  const tracer = useRef<WebGLPathTracer | null>(null)
  useEffect(() => {
    const pt = new WebGLPathTracer(gl)
    pt.bounces = bounces
    pt.tiles.set(2, 2)                                   // keeps the UI responsive
    pt.renderScale = Math.min(1, 1.5 / gl.getPixelRatio())
    pt.setScene(scene, camera)                           // call pt.updateMaterials()/updateCamera() after changes
    tracer.current = pt
    return () => { pt.dispose(); tracer.current = null }
  }, [gl, scene, camera, bounces])
  useFrame(() => { const pt = tracer.current; if (!pt) return; pt.renderSample(); onSamples?.(Math.floor(pt.samples)) }, 1)
  return null
}
```

The tracer supports `MeshStandardMaterial` and `MeshPhysicalMaterial` only, so transmission glass is physically correct. `WebGPUPathTracer` (`three-gpu-pathtracer/webgpu`) is faster and adds an OIDN denoiser (`oidn-web@0.5.0`) and an FSR upscaler (`@pmndrs/upscaler@0.5.0`). It needs `WebGPURenderer`, which means a separate vanilla-three canvas for photo mode **[uncertain: not tested]**.

### 1.9 Alternative: `@react-three/rapier` [type-checked]

Rapier's `KinematicCharacterController` gives autostep, snap-to-ground and slope limits out of the box. Use it if you also want dynamic objects (swinging doors, props). For a static house, the BVH approach above has fewer moving parts.

```tsx
// <Physics><RigidBody type="fixed" colliders="trimesh"><House/></RigidBody><RapierPlayer/></Physics>
const { world } = useRapier()
const controller = useMemo(() => {
  const c = world.createCharacterController(0.01)   // skin offset (m)
  c.enableAutostep(0.25, 0.2, false)                 // max step height, min step width, include dynamic bodies
  c.enableSnapToGround(0.3)
  c.setMaxSlopeClimbAngle((45 * Math.PI) / 180)
  return c
}, [world])
// per frame: controller.computeColliderMovement(collider, desired); const m = controller.computedMovement();
// body.setNextKinematicTranslation(p + m); grounded = controller.computedGrounded()
// <RigidBody type="kinematicPosition" colliders={false}><CapsuleCollider args={[0.6, 0.3]} /></RigidBody>
```

Rapier gotchas, all **[verified]**:

- **Never import `@dimforge/rapier3d-compat` yourself.** `@types/three@0.186.0` depends on `~0.12.0` and hoists it to the top level, while `@react-three/rapier` uses its own 0.19.2. A mismatched import throws `raweventqueue_new` (#771). Use `useRapier().rapier`.
- Trimesh and hull colliders are corrupted for **indexed geometry with `InterleavedBufferAttribute`**, which is common in glTF (#781, open). Run `BufferGeometryUtils.deinterleaveGeometry` first, or build colliders from merged plain geometry.
- `@react-three/rapier` 2.2.0 dates from Nov 2025. Version 3.0 (R3F v10/WebGPU, Rapier 0.21) is only a tracking issue.

---

## 2. Free CC0 assets usable at runtime

### 2.1 Poly Haven (`api.polyhaven.com`) [verified]

**Licence:** every asset is **CC0**. The API is free, including for commercial use, and needs no key.

API Terms of Service:

- If your product shows Poly Haven content from the live API, make the source clear to users, for example with a "Powered by Poly Haven" credit. The credit must not imply endorsement.
- Every call must send a **unique User-Agent or Referer** identifying your app.
- No rate limits are published, and the API may change or disappear without notice.
- Hotlinking and caching of `dl.polyhaven.org` files are **not addressed** by the ToS.

The file CDN returns `Access-Control-Allow-Origin: *` and `cache-control: max-age=14400` (Cloudflare) **[tested]**. Browser hotlinking therefore works technically. Browsers send a `Referer` automatically, but you cannot set a User-Agent from the browser. The safe pattern is to call the API **from the backend** with a custom UA and **mirror the curated subset to GCS**, which CC0 permits.

| Endpoint | Purpose |
|---|---|
| `GET /types` | Returns `["hdris","textures","models"]` |
| `GET /assets?t={type}&c={categories}` | Assets with metadata. `type` and `t`, plus `categories` (legacy, comma-separated, AND), `category` (new taxonomy path), `collection`, and attribute filters like `?material=wood`. |
| `GET /search?q=&t=&limit=&min=&hybrid=` | **New: hybrid semantic plus keyword search.** For example, `q=modern sofa&t=models` returns `{results:[{slug,score}]}`. Good for an agent tool. |
| `GET /info/{id}` | Metadata: `dimensions` (mm), `polycount`, `max_resolution`, `categories`, `tags`, `authors` |
| `GET /files/{id}` | Every downloadable file with URL, size and md5, keyed by format and resolution |
| `GET /categories/{type}` (legacy), `GET /taxonomy[/{type}]`, `GET /author/{id}` | Category and taxonomy listings, and author info |

File URL patterns (all return 200 **[tested]**):

```text
HDRI    https://dl.polyhaven.org/file/ph-assets/HDRIs/{hdr|exr}/{1k|2k|4k|8k|16k}/{id}_{res}.{hdr|exr}
Texture https://dl.polyhaven.org/file/ph-assets/Textures/{jpg|png|exr}/{res}/{id}/{id}_{map}_{res}.{ext}
        map in: diff | nor_gl (use for three.js) | nor_dx | rough | arm (R=AO, G=rough, B=metal == glTF ORM) | ao | disp | bump | spec
Model   https://dl.polyhaven.org/file/ph-assets/Models/gltf/{res}/{id}/{id}_{res}.gltf
        its textures live at Models/jpg/{res}/{id}/{id}_{map}_{res}.jpg   (NOT next to the .gltf)
```

**Gotcha [tested]:** a model `.gltf` references `textures/<file>.jpg` relative to itself, and that path **404s**. There is no `.glb` format; `/files` offers only `gltf`, `fbx`, `blend` and `usd`. Remap each request using the `include` map returned by `/files/{id}`, or repack it server-side into a single GLB (`gltf-transform copy model.gltf model.glb`).

```ts
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js'
export async function loadPolyHavenModel(id: string, res: '1k' | '2k' | '4k' = '1k'): Promise<GLTF> {
  const files = await fetch(`https://api.polyhaven.com/files/${id}`).then((r) => r.json())   // better: via your backend
  const g = files.gltf[res].gltf as { url: string; include: Record<string, { url: string }> }
  const base = g.url.slice(0, g.url.lastIndexOf('/') + 1)
  const manager = new THREE.LoadingManager()
  manager.setURLModifier((url) => g.include[url.startsWith(base) ? url.slice(base.length) : url]?.url ?? url)
  return new GLTFLoader(manager).loadAsync(g.url)
}
```

Scale: models are in **metres, Y-up, origin on the floor**. For example, `sofa_02` is 1.81 × 0.71 m. Texture `dimensions` are in mm, so `red_brick_03` covers 1000 mm, which gives `repeat = surfaceMetres / 1.0`.

**Inventory and fidelity:** 997 HDRIs, 869 textures and 521 models, with **85 in `furniture`**. These are photoreal, with 1k–8k PBR textures and roughly 2k–8k polygons per item, so they are the **only high-fidelity option** in this list. The style skews vintage, Victorian and industrial.

Modern pieces:

- Seating and tables: `modern_arm_chair_01`, `mid_century_lounge_chair`, `sofa_02`, `sofa_03`, `Sofa_01`, `modern_coffee_table_01`, `modern_coffee_table_02`, `coffee_table_round_01`, `dining_table`, `dining_chair_02`, `bar_chair_round_01`, `side_table_01`
- Storage: `steel_frame_shelves_01`–`03`, `modern_wooden_cabinet`, `drawer_cabinet`
- Lighting and decor: `modern_ceiling_lamp_01`, `potted_plant_01`, `potted_plant_02`, `potted_plant_04`, `hanging_picture_frame_01`–`03`

**Gaps:** there are no modern beds (only 3 vintage), no kitchen cabinetry, fridge or sink, and no bathroom fixtures. Generate those procedurally with PBR textures (boxes plus bevels look good), or retexture Kenney meshes (2.3).

Suggested HDRIs **[verified IDs]**:

- Exterior daylight: `kloofendal_48d_partly_cloudy_puresky`, `kloppenheim_06_puresky`, `autumn_field_puresky`
- Golden hour: `belfast_sunset_puresky`, `venice_sunset`, `kiara_1_dawn`
- Interior and studio: `brown_photostudio_02`, `studio_small_09`, `photo_studio_01`, `cayley_interior`

Suggested textures **[verified IDs]**:

| Surface | IDs |
|---|---|
| Brick | `red_brick_03`, `red_brick`, `brick_wall_001` |
| Plaster | `white_plaster_02`, `painted_plaster_wall`, `beige_wall_001`, `grey_plaster` |
| Marble | `marble_01`, `marble_tiles` |
| Terrazzo | `terrazzo_tiles` |
| Wood floor | `wood_floor`, `laminate_floor_02`, `wood_floor_deck` |
| Tiles | `large_floor_tiles_02`, `floor_tiles_06`, `granite_tile` |
| Concrete | `concrete_floor_worn_001`, `concrete_floor_02` |
| Roof | `roof_slates_03`, `ceramic_roof_01`, `grey_roof_01` |
| Ground | `leafy_grass`, `grass_path_2` |

### 2.2 ambientCG [verified]

- **Licence:** CC0 1.0. Attribution is optional ("appreciated"). Commercial use is fine. The maintainer warns the API is run by one person and is not enterprise-grade.
- **API v3:** `GET https://ambientcg.com/api/v3/assets`
  - `q`: keywords, AND
  - `type`: `material`, `hdri`, `3d-model`, `decal`, `atlas`, `substance`, …
  - `technique`
  - `sort`: `popular`, `latest`, `downloads`, `random`, `alphabet`
  - `id`: comma list
  - `date`, `limit` (1–500, default 100), `offset`
  - `include`: comma list of `title`, `tags`, `dimensions`, `maps`, `downloads`, `previews`, `thumbnails`, …
  - Example: `https://ambientcg.com/api/v3/assets?type=material&q=bricks&include=downloads,maps,dimensions`. v2 (`/api/v2/full_json`) still works.
- **Downloads are ZIPs only:** `https://ambientcg.com/get?file={id}_{1K|2K|4K|8K}-{JPG|PNG}.zip`, a 302 redirect to `acg-download.struffelproductions.com`.
  - Sizes: Bricks105 is 4.8 MB at 1K-JPG and 15 MB at 2K-JPG.
  - ZIP contents **[tested]**: `{id}_1K-JPG_Color.jpg`, `_NormalGL.jpg` (use this for three.js), `_NormalDX.jpg`, `_Roughness.jpg`, `_AmbientOcclusion.jpg`, `_Displacement.jpg`, plus `.mtlx`, `.usdc`, `.blend` and `.tres`. Metals add `_Metalness.jpg`.
- **No CORS headers on the API or the `get` endpoint [tested].** Ingest server-side (download, unzip, upload maps to GCS). Thumbnails on `acg-media.struffelproductions.com` do send `ACAO: *`.

Material IDs (most popular first) **[verified]**:

| Surface | ambientCG IDs |
|---|---|
| Brick | `Bricks105`, `Bricks104`, `Bricks097`, `Bricks102`, `Bricks075A` |
| Plaster | `Plaster001`, `PaintedPlaster017`, `Plaster007`, `Plaster002` |
| Marble | `Marble012`, `Marble016`, `Marble021`, `Travertine009`, `Onyx015` |
| Terrazzo | `Terrazzo013`, `Terrazzo018`, `Terrazzo005`, `Tiles040` |
| Wood floor | `WoodFloor051`, `WoodFloor064`, `WoodFloor070`, `WoodFloor043` |
| Tiles | `Tiles141`, `Tiles139`, `Tiles143`, `Tiles107` |
| Concrete | `Concrete034`, `Concrete048`, `Concrete047A`, `Concrete046` |
| Grass | `Grass005`, `Grass001`, `Grass004`, `Grass008` |
| Also useful | `RoofingTiles013A`, `PavingStones151`, `Fabric085`, `Leather037`, `Wood096` |

### 2.3 glTF furniture sources compared

| Source | Licence | Format | Count | Fidelity | Runtime notes |
|---|---|---|---|---|---|
| **Poly Haven** models | CC0. API needs "Powered by Poly Haven" if served live. | `.gltf` + bin + JPG at 1k/2k/4k, plus FBX, blend and USD | 85 furniture (521 models total) | **Photoreal PBR** | Use the URL remap or repack to GLB. Metres. Best choice for hero pieces. |
| **Kenney Furniture Kit 2.0** | CC0 (credit optional) | **140 `.glb`** plus OBJ/FBX, in one 5.1 MB zip | 140 | Low-poly, **untextured flat colours** | Covers every room: beds, kitchen cabinets, fridge, toilet, bathtub, shower, sofas. Materials are named (`wood`, `metal`, `carpet`, `glass`), so you can swap in PBR materials by name. Scale isn't real-world, so normalise per category. |
| **Quaternius** Ultimate House Interior Pack | CC0 | **FBX, OBJ, Blend only** (no glTF listed) | 123 | Stylised low-poly | Needs conversion (Blender or FBX2glTF). There is also an "Ultimate Furniture" pack (20) and a "Furniture" pack (23). |
| **Poly Pizza** | Per model: **CC0 or CC-BY** (shown in the `Licence` field) | GLB | 10k+ (all categories) | Low-poly | API needs a free key: `X-Auth-Token` header. Sources disagree on the base path: the third-party guide used `https://api.poly.pizza/v1/search/{q}`, and the live probe on 2026-10-16 that returned 401 was `/v1.1/search/{q}` **[uncertain]**. The ToS bans scraping and using content for **AI/ML training** without written permission. CC-BY models need a visible credit. |

For the "high fidelity" goal, use Poly Haven for visible hero furniture plus procedural cabinetry and fixtures with ambientCG or Poly Haven PBR textures. Use Kenney GLBs for anything else, retextured. Avoid mixing stylised packs in hero shots.

### 2.4 Asset pipeline that works for a demo

1. A backend tool, `search_assets(query)`, calls Poly Haven `/search` and the ambientCG v3 API.
2. On first use, download the asset, then repack or optimise it: `npx @gltf-transform/cli@4.5.1 copy in.gltf out.glb`, then `gltf-transform optimize out.glb out.glb --texture-compress webp`.
3. Upload the result to `gs://<bucket>/assets/...` and record `{id, source, licence, url, dims}` in a Firestore `assets` collection.
4. The frontend loads only from your bucket, which needs CORS:

```json
[{ "origin": ["http://localhost:3000", "https://YOUR-FRONTEND.run.app"], "method": ["GET", "HEAD"],
   "responseHeader": ["Content-Type", "Content-Length", "ETag"], "maxAgeSeconds": 3600 }]
```

```bash
gcloud storage buckets update gs://BUCKET --cors-file=cors.json
```

---

## 3. Gemini on Gemini Enterprise Agent Platform (formerly Vertex AI)

### 3.1 Platform basics [verified]

- Vertex AI was renamed **Gemini Enterprise Agent Platform** at Cloud Next '26 (April 22, 2026). Docs moved to `docs.cloud.google.com/gemini-enterprise-agent-platform/...`, and the old Vertex docs are frozen. Agent Engine is now **Agent Runtime**, and Agent Engine Sessions are now Agent Platform Sessions. The REST host is still `aiplatform.googleapis.com`.
- In the SDK, `genai.Client(enterprise=True, project=..., location="global")`. **`vertexai=True` and `GOOGLE_GENAI_USE_VERTEXAI` are legacy.**
  - Env vars: `GOOGLE_GENAI_USE_ENTERPRISE=true`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION=global`.
  - ADK 2.12 logs "GOOGLE_GENAI_USE_VERTEXAI is deprecated, please use GOOGLE_GENAI_USE_ENTERPRISE". The project `.env.example` still uses the old name.
- Endpoints the SDK builds **[tested]**:

| `location` | Base URL | Default API version |
|---|---|---|
| `global` | `https://aiplatform.googleapis.com/` | `v1beta1` |
| `us` (multi-region) | `https://aiplatform.us.rep.googleapis.com/` | |
| `us-central1` (regional) | `https://us-central1-aiplatform.googleapis.com/` | Returns 404 for Gemini 4, 3.x and the image models |

- The generative module of the old Vertex AI SDK (`vertexai.generative_models`) was scheduled for removal on 2026-06-24. Agent Platform SDK 2.0.1 (2026-09-18) moved the generative modules into the Gen AI SDK. Use `google-genai` only.
- The runtime service account needs `roles/aiplatform.user`, which the project already has.

### 3.2 `gemini-4-argon` [verified, official docs]

| Item | Value |
|---|---|
| Status | **GA 2026-10-13**. Retirement no earlier than 2027-10-13. There is an allowlisted variant, `gemini-4-argon-cyber-permissive`. |
| Endpoints | `global`, plus multi-region `us` and `eu`. **No regional endpoints.** Non-global calls are priced +10%. |
| Context | **1,048,576 tokens unified for input and output.** Output counts thinking, function calls and the response. |
| Max output per request | **65,536** (32,768 for non-streaming raw HTTP). "Long decode" allows up to 1,048,576 minus input via continuation tokens on `v1beta1` only. The SDK (google-genai ≥2.30.1) follows continuations automatically when `max_output_tokens` is above 65,536 (`automatic_continuation=False` turns that off). This is not available on the Interactions API. Each request has a **20-minute** limit. |
| Thinking | `thinking_level`: `LOW`, **`MEDIUM` (default)** or `HIGH`. **`thinking_budget` or `MINIMAL` returns HTTP 400.** Use HIGH for multi-file engineering and architecture, MEDIUM for general coding and tools, LOW for extraction. |
| Sampling | `temperature`, `top_p` and `top_k` are **ignored**. **`candidate_count`, `frequency_penalty` and `presence_penalty` return HTTP 400.** Prefilled model turns aren't supported. |
| Inputs | Text, image (up to 3,000 per prompt, 7 MB inline or 30 MB from GCS), PDF, audio and video. Output is text only. |
| Tools | Function calling, structured output, code execution, Google Search, Maps and URL grounding, computer use (Preview). |
| Caching | **Implicit only, for prefixes ≥ 6,144 tokens.** Explicit `cached_content` is not supported. Put static content (API cheat-sheet, asset catalog) first. |
| Pricing (per 1M, Standard PayGo) | Global: input $2, output $10 through 2026-11-30 (paid as a 50% credit-back), then **$4 / $20 from 2026-12-01**. Cached input is $0.10 promo, then $0.20. Non-global is $2.20 / $11. Batch is $1 / $5 promo, then $2 / $10. Priority PayGo is $3.60 / $18 promo, then $7.20 / $36. The Agent Platform model page lists only Standard and Priority PayGo, not Flex. **Thinking tokens bill as output**, and so do grounding's internal tool instructions. Google Search grounding has 5,000 queries a month free, then $14 per 1k. |
| Coding strength | The docs call it a "flagship reasoning model" for complex software engineering and multi-file generation. Google's launch post shows a Three.js racing game and a procedurally built Blender scene. The model card lists DeepSWE v1.1 77.9%, Vibe Code Bench 91.9%, FrontierSWE v2 55.0% and Terminal-bench 4.0 57.4%. **Knowledge cutoff: March 2026.** |
| Latency | No official figures. Artificial Analysis (third-party, HIGH thinking, 10k-input workload) measured about **245 output tokens/s and about 22 s to first token**, including thinking **[uncertain]**. The model card notes "occasional slowness or timeout issues". Budget 20–90 s per full house spec at MEDIUM/HIGH, stream progress, and set Cloud Run `--timeout=3600`. |

**Gotcha:** the knowledge cutoff is March 2026, but three r186, R3F 9.8, drei 10.7.9 and ADK 2.x came later. If Argon writes three.js code, expect stale APIs such as `PCFSoftShadowMap`, `THREE.Clock`, `RGBELoader` and `PostProcessing` (now `RenderPipeline`). Ship a short API cheat-sheet as the static prompt prefix, which also triggers implicit caching. A better option is to have Argon emit a **schema-validated JSON house spec** that your own TypeScript builder turns into geometry (walls via 1.7, slabs, roofs, stairs, furniture placements from the asset catalog). Run any free-form generated JS only in a sandboxed iframe or worker.

### 3.3 Image generation and editing models [verified, Agent Platform model pages]

| | `gemini-nano-banana-2.1` | `gemini-3-pro-image` ("Nano Banana Pro") | `gemini-3.1-flash-image` ("Nano Banana 2") | `gemini-3.1-flash-lite-image` | `imagen-4.0-{fast-,ultra-,}generate-001` |
|---|---|---|---|---|---|
| Status | **GA 2026-10-06**, in the "shorter availability" table | GA 2026-05-28. Retires 2027-05-28 or later. | GA 2026-05-28. Retires 2027-05-28 or later. The Gemini API names NB 2.1 as its successor. | GA 2026-06-23 | **Discontinued 2026-06-30** on Vertex (legacy docs). Gemini API shutdown 2026-08-17, replaced by NB 2.1. The Agent Platform pricing page still lists $0.02 / $0.04 / $0.06 per image, so availability is ambiguous: don't build on it **[uncertain]**. |
| Endpoint | **global only** | **global only** | global, us, eu | global only | |
| Text-to-image, image-to-image, editing, multi-turn | yes / yes / yes / yes | yes / yes / yes / yes | yes / yes / yes / yes | yes / yes / yes / yes | Imagen edits used a separate API |
| Max input images per prompt | **14** (7 MB inline, 30 MB GCS) | **14** | **14** | 14 | |
| Aspect ratios | 1:1, 3:2, 2:3, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9, 9:21, 1:4, 4:1, 1:8, 8:1 | same 15 | same 15 | same, minus 9:21 | 1:1, 3:4, 4:3, 9:16, 16:9 |
| Output size | 1K, 2K, 4K (≈1/4/16 MP) | 1K, 2K, 4K | **512**, 1K, 2K, 4K | 1K only | up to 2K |
| Context (in/out) | 131,072 / 32,768 | 65,536 / 32,768 | 131,072 / 32,768 | 65,536 / 4,096 | |
| Price per output image (Standard) | 1K $0.034, 2K $0.050, 4K $0.113 ($30/M image tokens). Input image ≈ 1,120 tokens at $1.50/M. | 1K and 2K $0.134, 4K $0.24 ($120/M). Input image 560 tokens at $2/M. | 512 $0.045, 1K $0.067, 2K $0.101, 4K $0.15 ($60/M) | 1K $0.034 | |
| Notes | **`seed`, `topK`, `logprobs`, `temperature` and `topP` all return an API error.** Thinking: minimal, medium (default) or high. Search and image-search grounding. No structured output or function calling. | Best for complex, reasoning-heavy compositions. Temperature 0–2. | Thinking: minimal (default) or high. Accepts video input. | | |

For reference only, the legacy Imagen call shape was `client.models.generate_images(model="imagen-4.0-generate-001", prompt=..., config=types.GenerateImagesConfig(number_of_images=1, aspect_ratio="16:9", image_size="2K"))`. It was text-to-image only; Imagen 4 had no multi-image or reference editing on these IDs.

Also:

- All generated images carry **SynthID**, and C2PA Content Credentials are supported.
- `image_size` must use an **uppercase "K"** (`"2K"`); lowercase is rejected.
- Reference-image breakdown from the Gemini API docs: NB 2.1 and 3.1 Flash take up to 10 object plus 4 character images, and 3 Pro takes up to 6 object, 5 character and 3 style images **[uncertain: parsed from a dense table]**.
- The Gemini *Developer* API docs now show these models through `client.interactions.create(...)`. On Agent Platform, image models are **GenerateContent-only** (the Interactions API is listed as not supported), so use `generate_content` as below.

### 3.4 Python patterns (google-genai 2.31.0) [compiled and dry-run; not live-called]

```python
# env: GOOGLE_GENAI_USE_ENTERPRISE=true GOOGLE_CLOUD_PROJECT=... GOOGLE_CLOUD_LOCATION=global
import pathlib
from typing import Literal
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

client = genai.Client(enterprise=True, location="global")   # or genai.Client() from env

# 1) Argon -> structured house spec (Pydantic), optionally streamed
class Opening(BaseModel):
    kind: Literal["door", "window"]
    wall_id: str
    offset_m: float = Field(description="distance from wall start to opening centre")
    width_m: float
    height_m: float
    sill_m: float = 0.0

class Wall(BaseModel):
    id: str
    start: list[float] = Field(description="[x, z] metres")
    end: list[float]
    height_m: float
    thickness_m: float
    material: str = Field(description="asset catalog id, e.g. ambientcg:Bricks105")

class HouseSpec(BaseModel):
    style: str
    walls: list[Wall]
    openings: list[Opening]

def spec_config(level: str = "MEDIUM") -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction="You are a residential architect. Units: metres, Y up. Return only the schema.",
        response_mime_type="application/json",
        response_schema=HouseSpec,                                   # SDK converts the Pydantic model
        thinking_config=types.ThinkingConfig(thinking_level=level),  # LOW | MEDIUM | HIGH
        max_output_tokens=65536,                                     # > 65,536 => auto long-decode continuation
    )   # never set temperature/top_p/top_k (ignored) or candidate_count/penalties (HTTP 400)

spec: HouseSpec = client.models.generate_content(model="gemini-4-argon", contents="3-bed modern bungalow...",
                                                 config=spec_config()).parsed

def stream_spec(brief: str) -> HouseSpec:
    buf = [c.text for c in client.models.generate_content_stream(model="gemini-4-argon", contents=brief,
                                                                 config=spec_config()) if c.text]
    return HouseSpec.model_validate_json("".join(buf))   # chunks are partial JSON text

# 2) concept image (text -> image)
resp = client.models.generate_content(
    model="gemini-nano-banana-2.1",
    contents="Photoreal exterior of a 2-storey modern house, white render + timber, dusk, 35mm",
    config=types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(aspect_ratio="16:9", image_size="2K"),
    ),
)
img = next(p.inline_data.data for p in resp.parts if p.inline_data)   # bytes (PNG); p.as_image() -> PIL
pathlib.Path("concept.png").write_bytes(img)

# 3) image-to-image edit with several references (<= 14)
parts = [types.Part.from_bytes(data=img, mime_type="image/png"),
         types.Part.from_uri(file_uri="gs://BUCKET/swatches/brick.jpg", mime_type="image/jpeg"),
         "Re-render image 1 with the brick from image 2 on the facade. Keep camera, massing and windows identical."]
edited = client.models.generate_content(model="gemini-3-pro-image", contents=parts,
    config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"],
                                       image_config=types.ImageConfig(aspect_ratio="16:9", image_size="2K")))

# 4) multi-turn editing: chats keep history (and thought signatures) for you
chat = client.chats.create(model="gemini-nano-banana-2.1",
                           config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]))
r1 = chat.send_message("Photoreal modern two-storey house, white render, timber cladding, dusk.")
r2 = chat.send_message("Same house and camera; make the roof dark standing-seam metal.")

# 5) async streaming (FastAPI / ADK tools)
async def stream_async(brief: str):
    async for chunk in await client.aio.models.generate_content_stream(
            model="gemini-4-argon", contents=brief, config=spec_config("LOW")):
        if chunk.text:
            yield chunk.text
```

### 3.5 Structured output limits [verified, Agent Platform doc]

- **Supported schema fields:** `anyOf`, `enum` (string only), `format` (`date`, `date-time`, `duration`, `time`), `items`, `minimum`, `maximum`, `minItems`, `maxItems`, `nullable`, `properties`, `required`, `description`, and `propertyOrdering`. Other fields are **silently ignored**.
- The schema counts toward input tokens. **Complex schemas fail with `400 InvalidArgument`.** The causes are long property names, long array limits, large enums, many optional properties and deep nesting. The fixes: shorten names, flatten nested arrays, cut constraints and optionals, shrink enums.
- JSON mode without a schema is only a hint and can produce malformed JSON. Always send `response_schema` and `application/json`, and still validate (Pydantic) with a retry.
- The Python SDK preserves your field order. Otherwise order is alphabetical, required first. Keep any in-prompt examples in the same order as the schema.
- `response_json_schema` (raw JSON Schema) exists in the SDK. Its keyword coverage on Agent Platform isn't documented, so prefer `response_schema` **[uncertain]**.
- The image models don't support structured output.
- In ADK, put the schema in `LlmAgent(output_schema=...)`, never in `generate_content_config.response_schema` (ADK raises `ValueError`). Since ADK 2.x, `output_schema` and `tools` can be combined: tools run during the loop and the schema applies to the final answer.

### 3.6 Streaming

- In the SDK: `generate_content_stream` (sync) and `await client.aio.models.generate_content_stream(...)` (async iterator). Structured output streams as partial JSON text. Image models return image parts in the stream as well.
- **[uncertain]** `ThinkingConfig(include_thoughts=True)` should stream thought summaries, as on Gemini 3, but this wasn't verified for Argon.
- Through ADK, `RunConfig(streaming_mode=StreamingMode.SSE)` gives `partial=True` text events followed by a final aggregated event (4.8).

---

## 4. Google ADK (Python) 2.12.0

### 4.1 Install and environment [verified]

```bash
pip install "google-adk==2.12.0" "google-genai==2.31.0" "google-cloud-firestore==2.34.1" "google-cloud-storage==3.17.1"
# extras: [db] (SQLAlchemy sessions), [gcp], [extensions] (heavy: langgraph, litellm, crewai...), [a2a], [mcp]
# resolved install is ~118 MB site-packages on Python 3.13 (minimal set above) [tested]
```

- Python **≥ 3.11** (3.15 is supported since 2.12). ADK 2.0.0 shipped 2026-05-19, and 2.12.0 was released 2026-10-13. 2.12 adds resuming of continuation-token (long-decode) generations, `require_confirmation` on workflow nodes, and a 40% faster first model call in long sessions.
- Set `GOOGLE_GENAI_USE_ENTERPRISE=TRUE`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION=global`. A per-model override is available: `Gemini(model="gemini-4-argon", client_kwargs={"enterprise": True, "location": "global"})`.
- **Deprecated in 2.x [tested]:** `SequentialAgent`, `ParallelAgent` and `LoopAgent` emit a `DeprecationWarning` and point you to `Workflow`. The warning also says "**Workflow cannot yet be used as an LlmAgent sub-agent.**"

### 4.2 Import paths (all imported successfully on 2.12.0) [tested]

```python
from google.adk import Agent, Runner, Workflow, Event, Context          # Agent is LlmAgent; Context == ToolContext
from google.adk.agents import LlmAgent, BaseAgent, RunConfig            # (+ deprecated Sequential/Parallel/LoopAgent)
from google.adk.agents.run_config import StreamingMode                   # NONE | SSE | BIDI
from google.adk.tools import AgentTool, FunctionTool, ToolContext, LongRunningFunctionTool, google_search, load_artifacts, exit_loop
from google.adk.workflow import Workflow, JoinNode, node, START, DEFAULT_ROUTE, FunctionNode, Edge, RetryConfig
from google.adk.sessions import InMemorySessionService, DatabaseSessionService, VertexAiSessionService, Session, State
from google.adk.integrations.firestore import FirestoreSessionService, FirestoreMemoryService   # needs google-cloud-firestore
from google.adk.artifacts import GcsArtifactService, InMemoryArtifactService, FileArtifactService
from google.adk.memory import InMemoryMemoryService, VertexAiMemoryBankService
from google.adk.models import Gemini
from google.adk.apps import App, ResumabilityConfig
from google.adk.events import Event, EventActions
from google.adk.cli.fast_api import get_fast_api_app
from google.adk.cli.service_registry import get_service_registry
```

### 4.3 Multi-agent patterns

| Pattern | Use it for | Behaviour |
|---|---|---|
| `LlmAgent(sub_agents=[...])` | Open-ended delegation | The LLM calls `transfer_to_agent`, and **control moves** to the sub-agent, which then talks to the user. |
| `AgentTool(agent=critic)` in `tools=[...]` | "Ask a specialist and come back" | The parent **stays in control** and receives the sub-agent's final text as a tool result. Signature: `AgentTool(agent, skip_summarization=False, *, include_plugins=True, propagate_grounding_metadata=False)`. |
| `Workflow(edges=[...])` (ADK 2.0 graph) | Deterministic pipelines: generate, then validate, then route, then revise | Nodes can be agents, tools or plain functions. The return value becomes the next node's `node_input`. `Event(route=...)` plus a dict edge gives branching, a tuple gives fan-out, `JoinNode` gives fan-in, and nesting is supported. Cycles are allowed but **unbounded**, so ensure an exit route. |

The Workflow below was **[tested]** with function nodes (no LLM):

```python
from google.adk import Event, Workflow

def classify(node_input: str):        # annotate `str` -> receives the user's text; unannotated -> types.Content [tested]
    return Event(route="MATERIAL" if "brick" in node_input.lower() else "LAYOUT", output=node_input)
def material_patch(node_input: str): return Event(output=f"material patch: {node_input}")
def layout_patch(node_input: str):   return Event(output=f"layout patch: {node_input}")
def finish(node_input: str):         return Event(message=f"DONE -> {node_input}")   # message => visible content

revise = Workflow(name="revise", edges=[
    ("START", classify),
    (classify, {"MATERIAL": material_patch, "LAYOUT": layout_patch}),
    (material_patch, finish),
    (layout_patch, finish),
])
```

### 4.4 Function tools, AgentTool and output schema (constructs on 2.12.0) [tested construct; not live-run]

```python
from pydantic import BaseModel
from google import genai
from google.genai import types
from google.adk import Agent, Context
from google.adk.agents import LlmAgent
from google.adk.tools import AgentTool

_genai = genai.Client(enterprise=True, location="global")

async def render_concept(prompt: str, aspect_ratio: str, tool_context: Context) -> dict:
    """Generate one photoreal concept image of the house and save it as an artifact.

    Args:
      prompt: Full visual description of the house and camera angle.
      aspect_ratio: One of "16:9", "4:3", "1:1", "3:2", "21:9".
    """
    resp = await _genai.aio.models.generate_content(
        model="gemini-nano-banana-2.1", contents=[prompt],
        config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"],
                                           image_config=types.ImageConfig(aspect_ratio=aspect_ratio, image_size="2K")))
    for p in resp.parts or []:
        if p.inline_data and p.inline_data.data:
            v = await tool_context.save_artifact("concept.png", types.Part.from_bytes(data=p.inline_data.data, mime_type="image/png"))
            return {"artifact": "concept.png", "version": v}   # return small JSON, never raw bytes
    return {"error": "no image returned"}

class HouseSpec(BaseModel):
    style: str
    floors: int
    rooms: list[str]
    facade_material: str

critic = LlmAgent(name="critic", model="gemini-3.8-flash",
                  description="Reviews a design against walkthrough comments; returns concrete fixes.",
                  instruction="Return a numbered list of concrete geometric fixes. Be terse.")

designer = LlmAgent(
    name="designer", model="gemini-4-argon",
    instruction="You design houses. Walkthrough comments: {pins?}. Use render_concept for images; consult critic first.",
    tools=[render_concept, AgentTool(agent=critic)],        # plain functions are auto-wrapped as FunctionTool
    output_schema=HouseSpec, output_key="house_spec",        # final answer -> state["house_spec"]
    generate_content_config=types.GenerateContentConfig(thinking_config=types.ThinkingConfig(thinking_level="MEDIUM")),
)
```

Tool rules:

- The docstring and type hints become the function declaration.
- A `tool_context: Context` (or `ToolContext`) parameter is injected, not exposed to the model. It provides `state`, `save_artifact`, `load_artifact`, `list_artifacts` (all **async**) and `search_memory`.
- `FunctionTool(func, require_confirmation=True)` gives human-in-the-loop confirmation.
- Gemini 4 requires each `FunctionResponse` to match the `id`, `name` and order of its `FunctionCall`. ADK handles this. Hand-rolled loops must too.

### 4.5 Session services [verified in source]

| Service | Import / URI | Notes |
|---|---|---|
| In-memory | `InMemorySessionService()` / `memory://` | Data is lost on restart. Dev only. |
| SQL | `DatabaseSessionService(db_url=...)` / `sqlite+aiosqlite:///./s.db`, `postgresql+asyncpg://...`, `mysql://...` | Needs the `google-adk[db]` extra and an **async** driver. |
| SQLite | `sqlite:///path` scheme becomes `SqliteSessionService` | |
| Agent Platform Sessions | `VertexAiSessionService(project, location, agent_engine_id)` / `agentengine://<id>` | Needs an Agent Runtime (Agent Engine) resource. Global and multi-region endpoints have been GA since 2026-06-17, but CMEK is not available on global. Quotas: 100 session writes and 300 event appends per minute per region. |
| **Firestore** | `from google.adk.integrations.firestore import FirestoreSessionService` / `FirestoreSessionService(client: firestore.AsyncClient \| None = None, root_collection="adk-session")` | Layout: `adk-session/{app}/users/{user}/sessions/{sid}/events/{eid}`, plus `app_states` and `user_states`. The root can also be set with `ADK_FIRESTORE_ROOT_COLLECTION`. **No built-in URI scheme**, so register one (below) or use a custom Runner. Each document is limited to 1 MiB, so keep images and GLBs in artifacts, not state. |

Register `firestore://` for `get_fast_api_app` and `adk web` by dropping `services.py` into the agents dir. It is picked up automatically **[tested]**:

```python
# agents/services.py
from urllib.parse import urlparse
from google.adk.cli.service_registry import get_service_registry
from google.adk.integrations.firestore import FirestoreSessionService

def firestore_session_factory(uri: str, **kwargs):
    return FirestoreSessionService(root_collection=urlparse(uri).netloc or None)   # firestore://adk-sessions

get_service_registry().register_session_service("firestore", firestore_session_factory)
```

### 4.6 Artifact service on GCS [verified in source]

- Use `GcsArtifactService(bucket_name="my-bucket")`, or the `artifact_service_uri="gs://my-bucket"` URI.
- Objects are stored as `gs://bucket/{app}/{user}/{session}/{filename}/{version}`. A filename prefixed `user:` is stored under `{app}/{user}/user/{filename}/{version}` and shared across sessions.
- `save_artifact` returns an int version. Methods: `load_artifact`, `list_artifact_keys`, `list_versions`, `get_artifact_version`, `delete_artifact`, and **`get_signed_url(app_name, user_id, filename, session_id, version, expiration=timedelta|int, method="GET")`**.
- **Signed URLs on Cloud Run:** the runtime credentials have no private key. Pass `service_account_email=...` and `access_token=...` (forwarded to `Blob.generate_signed_url`), and grant the runtime SA `roles/iam.serviceAccountTokenCreator` on itself. The SA also needs `roles/storage.objectAdmin` on the bucket, which the current SA role list in `SETUP.md` lacks.
- `RunConfig(save_input_blobs_as_artifacts=True)` stores uploaded images as artifacts instead of inlining them into session events.

### 4.7 Serving ADK in FastAPI on Cloud Run

**Option A: `get_fast_api_app`** (fastest). The routes listed below are from 2.12.0 **[tested]**.

```python
# main.py
import os
from google.adk.cli.fast_api import get_fast_api_app
app = get_fast_api_app(
    agents_dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), "agents"),  # agents/<app_name>/{__init__.py,agent.py(root_agent)}
    session_service_uri="firestore://adk-sessions",          # via agents/services.py (4.5), or sqlite+aiosqlite:///... / agentengine://...
    artifact_service_uri="gs://YOUR_BUCKET",
    allow_origins=["http://localhost:3000", "https://YOUR-FRONTEND.run.app"],
    web=False,                                               # required keyword; True also serves the dev UI
)
@app.get("/healthz")
def healthz(): return {"ok": True}
```

Routes:

- `GET /list-apps`
- `POST /apps/{app}/users/{user}/sessions` with body `{session_id?, state?, events?}`
- `POST /apps/{app}/users/{user}/sessions/{session_id}`. **The body is the raw state dict** [tested], not `{"state": ...}`.
- `GET` and `DELETE` on the same session path
- Artifact routes
- `POST /run` (returns a list of events)
- **`POST /run_sse`** with body `{app_name, user_id, session_id, new_message: {role, parts:[{text}]}, streaming, state_delta?}`
- `WS /run_live`

**Option B: a custom FastAPI app with `Runner`** (full control over auth and routes) **[tested end to end with a function-node Workflow]**:

```python
import json
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from google.adk import Runner
from google.adk.agents import RunConfig
from google.adk.agents.run_config import StreamingMode
from google.adk.integrations.firestore import FirestoreSessionService
from google.adk.artifacts import GcsArtifactService
from google.genai import types
from agents.house_agent.agent import root_agent

session_service = FirestoreSessionService(root_collection="adk-sessions")
runner = Runner(app_name="house", agent=root_agent, session_service=session_service,
                artifact_service=GcsArtifactService(bucket_name="YOUR_BUCKET"))
app = FastAPI()

class ReviseReq(BaseModel):
    user_id: str
    session_id: str | None = None
    text: str

@app.post("/api/revise")
async def revise(req: ReviseReq):
    s = req.session_id and await session_service.get_session(app_name="house", user_id=req.user_id, session_id=req.session_id)
    if not s:
        s = await session_service.create_session(app_name="house", user_id=req.user_id)
    msg = types.Content(role="user", parts=[types.Part(text=req.text)])

    async def gen():
        yield f"event: session\ndata: {json.dumps({'session_id': s.id})}\n\n"
        async for ev in runner.run_async(user_id=req.user_id, session_id=s.id, new_message=msg,
                                         run_config=RunConfig(streaming_mode=StreamingMode.SSE)):
            yield f"data: {ev.model_dump_json(exclude_none=True, by_alias=True)}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
```

Signatures: `Runner(*, app=None, app_name=None, agent=None, node=None, plugins=None, artifact_service=None, session_service, memory_service=None, credential_service=None, auto_create_session=False)` and `run_async(*, user_id, session_id, new_message=None, state_delta=None, run_config=None, abort_signal=None)`. You can also pass `Runner(app=App(name=..., root_agent=...), ...)`.

Dockerfile and deploy:

```dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
```

```bash
gcloud run deploy agent-api --source . --region us-central1 \
  --service-account agent-runtime@PROJECT.iam.gserviceaccount.com \
  --set-env-vars GOOGLE_GENAI_USE_ENTERPRISE=TRUE,GOOGLE_CLOUD_PROJECT=PROJECT,GOOGLE_CLOUD_LOCATION=global \
  --timeout=3600 --cpu=2 --memory=2Gi --concurrency=40 --allow-unauthenticated
# or: adk deploy cloud_run --project=PROJECT --region=us-central1 --service_name=agent-api \
#       --session_service_uri=... --artifact_service_uri=gs://BUCKET --allow_origins=... \
#       --env GOOGLE_GENAI_USE_ENTERPRISE=1 ./agents/house_agent -- --timeout=3600
```

Cloud Run facts **[verified]**:

- The request timeout defaults to 300 s and can go up to **3600 s**. Above 15 minutes, Google recommends designing for client reconnects.
- SSE works within the request.
- Keep the Cloud Run region (`us-central1`) separate from the model location (`global`).

### 4.8 Streaming events to the web frontend (SSE)

ADK's `/run_sse` writes `data: <Event JSON>\n\n`, with **camelCase keys** (`by_alias=True`): `content.parts[].text`, `partial`, `author`, `actions.stateDelta`, `actions.artifactDelta`, `errorCode`, `nodeInfo` and `output`. With `streaming: true`, LLM text arrives as `partial: true` chunks followed by a final non-partial event.

`EventSource` cannot POST, so use `fetch` with a stream reader. The client below is **[type-checked; tested against a local `get_fast_api_app`]**:

```ts
export async function* runSse(baseUrl: string, b: { appName: string; userId: string; sessionId: string; text: string }) {
  const res = await fetch(`${baseUrl}/run_sse`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ app_name: b.appName, user_id: b.userId, session_id: b.sessionId,
      new_message: { role: 'user', parts: [{ text: b.text }] }, streaming: true }),
  })
  if (!res.ok || !res.body) throw new Error(`run_sse ${res.status}`)
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read(); if (done) break
    buf += value
    let i: number
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, i); buf = buf.slice(i + 2)
      const data = frame.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n')
      if (data) yield JSON.parse(data)          // {author, partial, content:{parts:[{text}]}, actions:{stateDelta, artifactDelta}}
    }
  }
}
```

If the Next.js app proxies SSE through a route handler, return the upstream `ReadableStream` directly and set `Cache-Control: no-cache`. Do not buffer it with `await res.text()`.

---

## 5. Optional: headless Blender (`bpy`) on Cloud Run

Facts, all **[verified]**:

- **`bpy==5.2.2`** (2026-09-15) supports **Python 3.13 only**. The `manylinux_2_28_x86_64` wheel is **402 MB compressed and 0.90 GB installed**, measured from the wheel's central directory: `__init__.so` is 220 MB, `bpy/lib` is 459 MB, and `bpy/5.2` is 221 MB. Add a Python base image and X/GL runtime libs (`libxrender1 libxxf86vm1 libxfixes3 libxi6 libxkbcommon0 libsm6 libgl1`) **[uncertain list; confirm with `python -c "import bpy"`]**. That makes the image roughly **1.2–1.5 GB**.
- The wheel ships Cycles CUDA cubins (`sm_50` … `sm_86`, `sm_120`), OptiX PTX and HIP kernels, plus the glTF exporter (`io_scene_gltf2`). An NVIDIA L4 is sm_89, which runs the sm_86 cubins (same major version) or JIT-compiles the PTX.
- `bpy` limitations: one `.blend` state per process (no concurrency, so use one request per instance or multiprocessing), no signal handlers, and a default cube, camera and light on import (`bpy.ops.wm.read_factory_settings(use_empty=True)`).
- Cloud Run GPUs:
  - **NVIDIA L4 (24 GB)** in `us-central1`, `us-east4`, `europe-west1`, `europe-west4`, `asia-southeast1` and `asia-south1` (by invitation). RTX PRO 6000 (96 GB) is also offered.
  - L4 needs at least **4 vCPU and 16 GiB** (8 vCPU and 32 GiB recommended). Driver 580.x (CUDA 13.0) is preinstalled.
  - **Instance-based billing is mandatory.** L4 without zonal redundancy costs **$0.0001867 per second (about $0.67 per hour) plus CPU and memory**, about $1.05 per hour at the minimum shape in us-central1.
  - New projects get **3 L4s** of auto-quota.
  - GPU instances provision in about **5 s**. Image streaming means a large image adds little boot time (Google's AI cold-start guide, May 2026). Engine initialisation (here `import bpy` plus scene setup) is extra: expect roughly 10–20 s for a cold request **[uncertain]**.

**Verdict.** Blender on Cloud Run is technically practical: a CPU-only container can generate and export glTF, and an L4 service or Cloud Run Job can do Cycles hero renders. It is **not worth it for this 2-day build**:

- It adds a second 1.2–1.5 GB Python 3.13 image.
- It has a single-scene-per-process concurrency model.
- It has 10–20 s cold starts and about $1 per GPU-hour, plus quota and region constraints.
- It produces nothing the browser can't already do. A JSON house spec from `gemini-4-argon` becomes three.js geometry (CSG walls and procedural parts) in milliseconds and stays live-editable for comment pins. The in-browser path tracer (1.8) already gives a "photo mode".

Treat Blender as a stretch goal only, for an offline "export to .blend" or a 4K hero still via a Cloud Run **Job** with `--gpu 1`, kept off the request path. For server-side glTF work in the meantime, `@gltf-transform/cli@4.5.1` (Node) or `trimesh==5.1.1` / `pygltflib==1.16.5` (Python) are tiny by comparison.

---

## 6. Gotchas checklist

1. **React and Next pins:** R3F 9.8.x peer is `react <19.4`. Next 16.4.2 runs React 19.3 canary, so it's OK. Freeze `next`, `react` and `three` for the hackathon. `postprocessing` 6.39.5 caps `three <0.187`.
2. **Tone mapping disappears** when `<EffectComposer>` mounts, so add `<ToneMapping mode={AGX}/>`.
3. **`<Canvas shadows>` boolean** triggers the "PCFSoftShadowMap has been removed" warning on r186. Use `shadows="percentage"` plus `shadow-radius`.
4. **Duplicate three:** `stats-gl` (drei) installs `three@0.170`, so add `"overrides": {"three": "$three"}`. drei also keeps its own `three-mesh-bvh@0.8.3`, which is harmless.
5. **WebGPU:** experimental in three r186, alpha in R3F v10. All post-processing, N8AO, drei shader materials and the WebGL path tracer are WebGL-only. Stay on WebGL.
6. **Pointer lock** freezes R3F pointer events at the last cursor position. Raycast from the screen centre for pins in walk mode.
7. **Poly Haven:** `.gltf` texture paths 404 unless remapped. The live API requires attribution and a unique UA. Mirror the assets to GCS.
8. **ambientCG:** ZIP-only downloads and no CORS, so ingest server-side. Use `NormalGL`, not `NormalDX`.
9. **Asset CORS:** your GCS bucket needs a CORS config for the frontend origin(s). Signed URLs on Cloud Run need `serviceAccountTokenCreator`.
10. **Gemini endpoints:** `gemini-4-argon` uses `global`, `us` or `eu` (us/eu cost +10%). NB 2.1 and 3 Pro Image are **global only**. Regional `us-central1` returns 404.
11. **Argon request rules:** no `thinking_budget`, `MINIMAL`, `candidate_count` or penalties (400). Temperature is ignored. Thinking tokens bill as output. The promo price ends 2026-11-30, after which the cost doubles.
12. **NB 2.1 rejects** `temperature`, `topP`, `topK`, `seed` and `logprobs`. `image_size` needs an uppercase "K". There is no structured output on image models.
13. **Imagen 4 is discontinued** (2026-06-30 on Vertex). Use `gemini-nano-banana-2.1`.
14. **ADK 2.x:** Sequential, Parallel and LoopAgent are deprecated in favour of `Workflow`, which can't yet be an LlmAgent sub-agent. Schemas go in `output_schema`, not `generate_content_config`. Annotate `node_input: str` on function nodes.
15. **ADK env var:** use `GOOGLE_GENAI_USE_ENTERPRISE` (the project's `.env.example` still uses the deprecated `GOOGLE_GENAI_USE_VERTEXAI`). `get_fast_api_app(web=...)` is a required keyword. `fastapi>=0.143` cannot be installed with `google-adk==2.12.0`.
16. **Firestore:** 1 MiB per document. Store specs, images and GLBs in GCS artifacts and keep only IDs and URLs in Firestore and session state.
17. **Long requests:** Argon can take tens of seconds to minutes. Set Cloud Run `--timeout=3600`, stream SSE, and make revise calls idempotent so a client reconnect is safe.
18. **Rapier:** never import `@dimforge/rapier3d-compat` directly (`@types/three` hoists 0.12.0). Interleaved glTF geometry breaks trimesh colliders.

---

## 7. Sources

**Registries (queried 2026-10-16):** registry.npmjs.org (`three`, `@react-three/*`, `postprocessing`, `n8ao`, `three-mesh-bvh`, `three-bvh-csg`, `three-gpu-pathtracer`, `next`, `react`, `@types/three`, `stats-gl`), pypi.org (`google-adk`, `google-genai`, `bpy`, `google-cloud-*`, `fastapi`, `uvicorn`)

**three.js and React Three Fiber**
- https://github.com/mrdoob/three.js/releases/tag/r186
- https://github.com/mrdoob/three.js/wiki/Migration-Guide
- https://github.com/mrdoob/three.js/blob/r186/manual/pages/webgpurenderer.html
- https://github.com/mrdoob/three.js/blob/r186/manual/pages/webgpu-postprocessing.html
- https://github.com/pmndrs/react-three-fiber/releases (v9.8.0, v9.8.2, v10.0.0-alpha.4/5)
- https://github.com/pmndrs/react-three-fiber/blob/master/docs/API/canvas.mdx
- https://github.com/pmndrs/drei/releases and https://github.com/pmndrs/drei/issues/2867
- https://github.com/pmndrs/react-postprocessing/releases
- https://github.com/pmndrs/postprocessing/releases
- https://github.com/N8python/n8ao
- https://github.com/gkjohnson/three-mesh-bvh (README, `example/characterMovement.js`)
- https://github.com/gkjohnson/three-bvh-csg
- https://github.com/gkjohnson/three-gpu-pathtracer (README, `src/webgpu/API.md`, releases 0.0.25–0.0.27)
- https://github.com/pmndrs/react-three-rapier/issues/771, /781, /789
- https://nextjs.org/blog/next-16
- https://raw.githubusercontent.com/vercel/next.js/v16.4.2/package.json (vendored React)
- https://web.dev/blog/webgpu-supported-major-browsers
- https://projects.blender.org/blender/blender/issues/118824 (Khronos PBR Neutral rationale)

**Assets**
- https://polyhaven.com/our-api
- https://github.com/Poly-Haven/Public-API/blob/master/ToS.md
- https://api.polyhaven.com/api-docs/swagger.json
- https://docs.ambientcg.com/api/
- https://docs.ambientcg.com/api/v3/assets/
- https://docs.ambientcg.com/license/
- https://kenney.nl/assets/furniture-kit
- https://quaternius.com/packs/ultimatehomeinterior.html
- https://poly.pizza/docs/tos
- https://tessl.io/registry/skills/github/jasonkneen/tiny-world-builder/poly-pizza-api (third-party Poly Pizza API notes)

**Gemini on Agent Platform**
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/release-notes
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/4-argon
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/guides/gemini-4-argon
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/start/get-started-with-gemini-4
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/nano-banana-2-1
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-pro-image
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-image
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-1-flash-lite-image
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/3-8-flash
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/image-generation
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/gemini-edit-images
- https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/capabilities/control-generated-output
- https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing
- https://docs.cloud.google.com/vertex-ai/generative-ai/docs/models/imagen/4-0-generate (legacy; Imagen 4 discontinuation)
- https://ai.google.dev/gemini-api/docs/models/gemini-4-argon
- https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1
- https://ai.google.dev/gemini-api/docs/image-generation
- https://ai.google.dev/gemini-api/docs/deprecations
- https://ai.google.dev/gemini-api/docs/pricing
- https://deepmind.google/models/model-cards/gemini-4-argon/
- https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-argon/
- https://artificialanalysis.ai/models/gemini-4-argon/providers (third-party latency)

**ADK**
- https://pypi.org/project/google-adk/
- https://github.com/google/adk-python/blob/main/CHANGELOG.md
- https://adk.dev/graphs/
- https://adk.dev/graphs/routes/
- https://adk.dev/deploy/cloud-run/
- Installed package source for 2.12.0: `google/adk/cli/fast_api.py`, `cli/api_server.py`, `cli/service_registry.py`, `integrations/firestore/`, `artifacts/gcs_artifact_service.py`

**Cloud Run and Blender**
- https://pypi.org/project/bpy/
- https://docs.blender.org/api/current/info_advanced_blender_as_bpy.html
- https://docs.cloud.google.com/run/docs/configuring/services/gpu
- https://cloud.google.com/run/pricing
- https://docs.cloud.google.com/run/docs/configuring/request-timeout
- https://cloud.google.com/blog/topics/developers-practitioners/a-guide-to-ai-cold-starts-on-cloud-run/
