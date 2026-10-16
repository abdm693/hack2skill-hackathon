/**
 * HouseViewer: public interface (track: VIEWER). See contracts/web-modules.md.
 * The stub renders a placeholder; the VIEWER track replaces it.
 */
import { forwardRef } from "react";
import type { BuildingPlan } from "@contracts/plan";
import type { Layer } from "@contracts/house-sdk";
import type { AsBuiltSummary, Comment, CommentAnchor } from "@contracts/api-types";
import type { DesignSectionSrc, SectionResult } from "@/engine";

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

export const HouseViewer = forwardRef<ViewerHandle, HouseViewerProps>(function HouseViewer(_props, _ref) {
  return <div className="grid h-full w-full place-items-center bg-neutral-900 text-neutral-400">3D viewer coming soon</div>;
});
