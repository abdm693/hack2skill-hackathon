/** Low-frequency viewer UI state (one store per HouseViewer). Per-frame values never go through here. */
import { createStore } from "zustand/vanilla";
import type { Vec3 } from "@contracts/api-types";

export type ViewerMode = "orbit" | "walk";
/** off = orbit · intro = flying in · ready = waiting for click · active = walking · paused = Esc · commenting = after C */
export type WalkPhase = "off" | "intro" | "ready" | "active" | "paused" | "commenting";
export type Quality = "high" | "balanced" | "performance";

export interface BuildState {
  phase: "idle" | "building" | "ready" | "error";
  done: number;
  total: number;
  current?: string;
  error?: string;
  failed: number;
  mock: boolean;
  first: boolean; // nothing on screen yet
}

export interface Label { title: string; subtitle?: string }

export interface ViewerState {
  mode: ViewerMode;
  walk: WalkPhase;
  build: BuildState;
  hover: Label | null;
  target: Label | null; // what the walk crosshair points at
  room: string | null; // "you are in"
  level: string | null; // level id under the walker
  quality: Quality;
  touch: boolean;
  draft: { position: Vec3; normal: Vec3 } | null;
  toast: { id: number; text: string } | null;
  pointerLockSupported: boolean;
}

export type ViewerStore = ReturnType<typeof makeViewerStore>;

export function makeViewerStore(mode: ViewerMode, touch: boolean) {
  return createStore<ViewerState>()(() => ({
    mode,
    walk: "off",
    build: { phase: "idle", done: 0, total: 0, failed: 0, mock: false, first: true },
    hover: null,
    target: null,
    room: null,
    level: null,
    quality: "high",
    touch,
    draft: null,
    toast: null,
    pointerLockSupported: typeof document !== "undefined" && "pointerLockElement" in document,
  }));
}
