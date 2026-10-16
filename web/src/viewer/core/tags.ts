/**
 * userData tags ({layer, level, room, kind, id, label}) and human-readable labels.
 */
import type * as THREE from "three";
import type { BuildingPlan } from "@contracts/plan";

export interface ResolvedTags {
  /** Nearest ancestor (or self) that carries an id or kind: the "element" a comment/hover refers to. */
  element: THREE.Object3D;
  id?: string;
  kind?: string;
  label?: string;
  level?: string;
  room?: string;
  layer?: string;
}

const str = (v: unknown) => (typeof v === "string" && v.length ? v : undefined);

/** Engine containers that carry tags but are never "the element" (a design.js section, the merged-mesh group). */
const CONTAINER_KINDS = new Set(["section", "merged"]);
export const isContainer = (o: THREE.Object3D) => CONTAINER_KINDS.has(o.userData?.kind);

/** Triangle range of a consolidated mesh → the tags of the original element (engine core/consolidate.ts). */
export interface PartRange {
  start: number;
  count: number;
  tags: Record<string, unknown>;
}

export function partsOf(o: THREE.Object3D): PartRange[] | null {
  const p = o.userData?.parts;
  return Array.isArray(p) && p.length ? (p as PartRange[]) : null;
}

/** The part containing triangle `faceIndex` (binary search; parts are in triangle order). */
export function partAt(o: THREE.Object3D, faceIndex: number | null | undefined): PartRange | null {
  const parts = partsOf(o);
  if (!parts || faceIndex == null || faceIndex < 0) return null;
  let lo = 0, hi = parts.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const p = parts[mid];
    if (faceIndex < p.start) hi = mid - 1;
    else if (faceIndex >= p.start + p.count) lo = mid + 1;
    else return p;
  }
  return null;
}

/** Tags for a raycast hit: the element's own tags, refined by its consolidated part when the mesh was merged. */
export function resolveHitTags(hit: THREE.Intersection, stopAt?: THREE.Object3D | null): ResolvedTags & { part: PartRange | null } {
  const base = resolveTags(hit.object, stopAt);
  const part = partAt(hit.object, hit.faceIndex);
  if (!part) return { ...base, part: null };
  const t = part.tags;
  return {
    element: hit.object,
    part,
    id: str(t.id) ?? base.id,
    kind: str(t.kind) ?? base.kind,
    label: str(t.label) ?? (str(t.id) ? undefined : base.label),
    level: str(t.level) ?? base.level,
    room: str(t.room) ?? base.room,
    layer: str(t.layer) ?? base.layer,
  };
}

/**
 * Walk up from a hit object: the first ancestor with id/kind is the element; missing fields inherit from further up.
 * `stopAt` (exclusive) is the build root, so a tag on the whole house never becomes "the element".
 */
export function resolveTags(obj: THREE.Object3D, stopAt?: THREE.Object3D | null): ResolvedTags {
  let element: THREE.Object3D | null = null;
  const out: Omit<ResolvedTags, "element"> = {};
  let o: THREE.Object3D | null = obj;
  while (o && o !== stopAt) {
    const u = o.userData ?? {};
    if (!element && !isContainer(o) && (str(u.id) || str(u.kind))) element = o;
    if (element) {
      out.id ??= str(u.id);
      out.kind ??= str(u.kind);
      out.label ??= str(u.label);
    }
    out.level ??= str(u.level);
    out.room ??= str(u.room);
    out.layer ??= str(u.layer);
    o = o.parent;
  }
  return { element: element ?? obj, ...out };
}

const KIND_WORDS: Record<string, string> = {
  wc: "WC",
  tv: "TV",
  tv_unit: "TV unit",
  ac_split: "AC",
  sofa_3: "3-seat sofa",
  sofa_2: "2-seat sofa",
  sofa_l: "L-shaped sofa",
  bed_king: "King bed",
  bed_queen: "Queen bed",
  bed_single: "Single bed",
  dining_table_4: "Dining table",
  dining_table_6: "Dining table",
  dining_table_8: "Dining table",
  car_sedan: "Car",
  car_suv: "SUV",
};

/** "furniture:sofa_3" → "3-seat sofa", "facade:fins" → "Fins", "stair_ramp" → "Stair ramp". */
export function humanizeKind(kind?: string): string {
  if (!kind) return "Element";
  const last = kind.split(":").pop() || kind;
  if (KIND_WORDS[last]) return KIND_WORDS[last];
  const s = last.replace(/[_-]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function roomName(plan: BuildingPlan | undefined, roomId?: string): string | undefined {
  if (!roomId || !plan) return undefined;
  return plan.rooms.find((r) => r.id === roomId)?.name;
}

export function levelName(plan: BuildingPlan | undefined, levelId?: string): string | undefined {
  if (!levelId || !plan) return undefined;
  return plan.levels.find((l) => l.id === levelId)?.name;
}

/** Hover / anchor label: `userData.label`, else "<Kind> · <Room name>". */
export function displayLabel(t: Omit<ResolvedTags, "element">, plan?: BuildingPlan): { title: string; subtitle?: string } {
  const rn = roomName(plan, t.room);
  if (t.label) return { title: t.label, subtitle: rn ?? levelName(plan, t.level) };
  const title = rn ? `${humanizeKind(t.kind)} · ${rn}` : humanizeKind(t.kind);
  return { title, subtitle: levelName(plan, t.level) };
}
