/**
 * House SDK engine: public interface (track: ENGINE). See contracts/web-modules.md and contracts/house-sdk.d.ts.
 * The stubs below define the signatures; the ENGINE track replaces their bodies.
 */
import * as THREE from "three";
import type { BuildingPlan } from "@contracts/plan";
import type { Layer } from "@contracts/house-sdk";
import type { AsBuiltSummary } from "@contracts/api-types";

export interface DesignSectionSrc { name: string; layer: Layer; body: string }

export interface SectionResult { name: string; layer: Layer; ok: boolean; error?: string; ms: number; objects: number }

export interface BuildResult {
  root: THREE.Group;
  summary: AsBuiltSummary;
  sections: SectionResult[];
  levels: { id: string; name: string; floor_y: number; top_y: number }[];
  colliders: THREE.Mesh[];
  spawn: { position: THREE.Vector3; lookAt: THREE.Vector3 };
  dispose(): void;
}

const SECTION_RE = /^\s*\/\/\s*@section\s+([A-Za-z0-9_]+)\s*\[(\w+)\]\s*$/;
const END_RE = /^\s*\/\/\s*@end\s*$/;

export function parseDesign(code: string): DesignSectionSrc[] {
  const out: DesignSectionSrc[] = [];
  let cur: DesignSectionSrc | null = null;
  for (const line of code.split(/\r?\n/)) {
    const m = line.match(SECTION_RE);
    if (m) { if (cur) out.push(cur); cur = { name: m[1], layer: m[2] as Layer, body: "" }; continue; }
    if (END_RE.test(line)) { if (cur) out.push(cur); cur = null; continue; }
    if (cur) cur.body += line + "\n";
  }
  if (cur) out.push(cur);
  return out;
}

export function serializeDesign(sections: DesignSectionSrc[]): string {
  return sections.map((s) => `// @section ${s.name} [${s.layer}]\n${s.body.replace(/\n$/, "")}\n// @end`).join("\n");
}

export function screenSection(body: string): string[] {
  const banned = ["fetch", "XMLHttpRequest", "WebSocket", "import(", "eval(", "Function(", "document.", "window.", "localStorage", "sessionStorage", "indexedDB", "navigator.", "postMessage"];
  return banned.filter((b) => body.includes(b)).map((b) => `uses forbidden API: ${b}`);
}

export function defaultDesign(_plan: BuildingPlan): DesignSectionSrc[] {
  throw new Error("engine.defaultDesign: not implemented yet (ENGINE track)");
}

export async function buildHouse(
  _plan: BuildingPlan,
  _sections: DesignSectionSrc[],
  _opts?: { onSection?: (r: SectionResult, root: THREE.Group) => void | Promise<void>; quality?: "high" | "medium" },
): Promise<BuildResult> {
  throw new Error("engine.buildHouse: not implemented yet (ENGINE track)");
}
