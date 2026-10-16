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
  onExitWalk?: () => void;
}

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
      data-drag="0"
    >
      <Canvas
        shadows="percentage"
        dpr={[1, 2]}
        gl={GL_PROPS}
        camera={{ fov: 50, near: 0.08, far: 3000, position: [30, 22, -26] }}
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
