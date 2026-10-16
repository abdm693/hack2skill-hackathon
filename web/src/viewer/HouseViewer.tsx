/**
 * HouseViewer: public interface (track: VIEWER). See contracts/web-modules.md.
 *
 * Orbit (camera-controls) and first-person walk (BVH capsule) views of a house built progressively by
 * engine.buildHouse, with level/layer toggles, a section cut, a Lahore sun path, comment pins and capture.
 * React renders the shell; everything per-frame lives in ViewerController (core/controller.ts).
 *
 * Mode: `mode` is the app's requested mode. The viewer can also leave walk mode by itself (Esc → Exit, F to
 * finish, flyTo to an aerial comment); it then calls `onExitWalk` — set your `mode` prop to "orbit" there.
 */
import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { useStore } from "zustand";
import type { BuildingPlan } from "@contracts/plan";
import type { Layer } from "@contracts/house-sdk";
import type { AsBuiltSummary, Comment, CommentAnchor } from "@contracts/api-types";
import type { DesignSectionSrc, SectionResult } from "@/engine";
import { ViewerController } from "./core/controller";
import type { Quality } from "./core/store";
import { SceneRoot } from "./scene/SceneRoot";
import { OrbitRig } from "./scene/OrbitRig";
import { PostFX } from "./scene/PostFX";
import { PinsLayer } from "./comments/PinsLayer";
import { Hud } from "./hud/Hud";
import "./viewer.css";

export interface ViewerHandle {
  capture(opts?: { width?: number; height?: number }): Promise<string>;
  flyTo(comment: Comment): void;
  setMode(mode: "orbit" | "walk"): void;
}

export interface HouseViewerProps {
  plan: BuildingPlan;
  sections: DesignSectionSrc[];
  mode: "orbit" | "walk";
  visibleLevels?: string[];
  layers?: Partial<Record<Layer, boolean>>;
  sectionCut?: number | null;
  sunHour?: number;
  comments?: Comment[];
  commentMode?: boolean;
  onAddComment?: (draft: { anchor: CommentAnchor; camera: Comment["camera"]; snapshot: string }) => void;
  onSelectComment?: (id: string) => void;
  onBuildProgress?: (r: SectionResult, done: number, total: number) => void;
  onReady?: (result: { summary: AsBuiltSummary; sections: SectionResult[] }) => void;
  /** The viewer left walk mode by itself: "finish" (F / Finish), "exit" (Exit walk, setMode), "flyTo" (aerial comment). */
  onExitWalk?: (reason?: "exit" | "flyTo" | "finish") => void;
}

/**
 * Device-pixel-ratio range per quality tier (R3F re-applies the `dpr` prop on every render, so the tier must drive
 * the prop). Measured walking the engine's argon-v1 house (230k tris, 12 point lights, PBR + transmission glass) at
 * 1440×900 CSS px on a laptop: DPR 1.6 + full AO ≈ 27 fps, DPR 1.25 + half AO ≈ 47, DPR 1 without AO ≈ 58.
 * The scene is fill-rate bound, so the tiers trade pixels first.
 */
const DPR: Record<Quality, [number, number]> = { high: [1, 1.5], balanced: [1, 1.1], performance: [0.85, 1] };

const GL_PROPS = {
  antialias: false,
  preserveDrawingBuffer: false,
  powerPreference: "high-performance" as const,
  toneMapping: THREE.AgXToneMapping,
  stencil: false,
};

export const HouseViewer = forwardRef<ViewerHandle, HouseViewerProps>(function HouseViewer(props, ref) {
  const [ctrl] = useState(() => new ViewerController(props));
  ctrl.setProps(props);
  useImperativeHandle(ref, () => ctrl.handle, [ctrl]);

  const mode = useStore(ctrl.store, (s) => s.mode);
  const walkPhase = useStore(ctrl.store, (s) => s.walk);
  const dragLook = useStore(ctrl.store, (s) => s.dragLook);
  const quality = useStore(ctrl.store, (s) => s.quality);

  useEffect(() => {
    ctrl.mount();
    return () => ctrl.unmount();
  }, [ctrl]);

  // rebuild when plan / sections change identity (content-identical inputs are skipped inside)
  useEffect(() => {
    ctrl.builds.request(props.plan, props.sections);
  }, [ctrl, props.plan, props.sections]);

  useEffect(() => {
    ctrl.setMode(props.mode, "props");
  }, [ctrl, props.mode]);

  const levelsKey = props.visibleLevels ? props.visibleLevels.join("|") : "*";
  const layersKey = useMemo(() => JSON.stringify(props.layers ?? {}), [props.layers]);
  useEffect(() => {
    ctrl.syncVisibility();
  }, [ctrl, levelsKey, layersKey, props.plan]);

  useEffect(() => {
    ctrl.syncSectionCut();
  }, [ctrl, props.sectionCut]);

  useEffect(() => {
    ctrl.syncSun();
  }, [ctrl, props.sunHour, props.plan]);

  useEffect(() => {
    ctrl.syncCommentMode();
  }, [ctrl, props.commentMode]);

  useEffect(() => {
    ctrl.onCommentsChanged();
  }, [ctrl, props.comments]);

  return (
    <div
      ref={ctrl.setContainer}
      className="nq-viewer"
      data-mode={mode}
      data-walk={walkPhase}
      data-comment={props.commentMode ? "1" : "0"}
      data-drag={dragLook ? "1" : "0"}
    >
      <Canvas
        shadows="percentage"
        dpr={DPR[quality]}
        gl={GL_PROPS}
        camera={{ fov: 50, near: 0.08, far: 3000, position: [30, 22, 26] }}
        frameloop={mode === "walk" ? "always" : "demand"}
      >
        <SceneRoot ctrl={ctrl} />
        <OrbitRig ctrl={ctrl} />
        <PinsLayer ctrl={ctrl} comments={props.comments} />
        <PostFX ctrl={ctrl} />
      </Canvas>
      <Hud ctrl={ctrl} plan={props.plan} commentMode={!!props.commentMode} />
    </div>
  );
});
