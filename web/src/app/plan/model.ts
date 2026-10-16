/**
 * Reading a BuildingPlan the way people talk about a house: room categories and colours, short names
 * that never degrade into nonsense ("Powder", never "ROOM"), what each room opens to, floor names and
 * the room schedule. Units are plan feet (contracts/plan.ts).
 */
import type { BuildingPlan, Level, Opening, Room, RoomType } from "@contracts/plan";
import type { Comment } from "@contracts/api-types";

export type Category = "bed" | "wet" | "living" | "service" | "outdoor";

export const CATEGORY: Record<RoomType, Category> = {
  bedroom: "bed",
  master_bedroom: "bed",
  guest_bedroom: "bed",
  dressing: "bed",
  study: "bed",
  bath: "wet",
  powder: "wet",
  laundry: "wet",
  kitchen: "wet",
  dirty_kitchen: "wet",
  drawing: "living",
  lounge: "living",
  dining: "living",
  prayer: "living",
  lobby: "living",
  corridor: "living",
  stair: "living",
  store: "service",
  servant: "service",
  porch: "service",
  garage: "service",
  driveway: "service",
  balcony: "outdoor",
  terrace: "outdoor",
  courtyard: "outdoor",
  lawn: "outdoor",
  open_space: "outdoor",
};

/** Plan fills (DESIGN.md --color-plan-*), as literal colours so print and SVG export keep them. */
export const FILL: Record<Category, string> = {
  bed: "#EEF1FE",
  wet: "#E6F1F5",
  living: "#F2F2EF",
  service: "#ECECE8",
  outdoor: "#E8F1E9",
};

/** Room types without walls on their exterior edges. */
export const OPEN_TYPES = new Set<RoomType>(["porch", "balcony", "terrace", "lawn", "driveway", "courtyard", "open_space"]);
/** Site areas drawn only on the ground level. */
export const SITE_TYPES = new Set<RoomType>(["lawn", "driveway", "courtyard", "open_space"]);
/** Rooms people live in (bedrooms must be independent). */
export const BEDROOMS = new Set<RoomType>(["bedroom", "master_bedroom", "guest_bedroom"]);
export const CIRCULATION = new Set<RoomType>(["corridor", "lobby", "stair", "lounge", "dining", "balcony", "terrace", "porch", "courtyard"]);
export const DOOR_TYPES = new Set<Opening["type"]>(["main_door", "door", "double_door", "sliding_door", "arch", "garage_door"]);

const SHORT: Partial<Record<RoomType, string>> = {
  master_bedroom: "Master bed",
  guest_bedroom: "Guest bed",
  bedroom: "Bedroom",
  bath: "Bath",
  powder: "Powder",
  dressing: "Dressing",
  lounge: "Lounge",
  drawing: "Drawing",
  dining: "Dining",
  kitchen: "Kitchen",
  dirty_kitchen: "Dirty kitchen",
  corridor: "Passage",
  lobby: "Lobby",
  stair: "Stair",
  store: "Store",
  laundry: "Laundry",
  servant: "Servant",
  porch: "Porch",
  garage: "Garage",
  balcony: "Balcony",
  terrace: "Terrace",
  lawn: "Lawn",
  driveway: "Drive",
  courtyard: "Court",
  prayer: "Prayer",
  study: "Study",
  open_space: "Open",
};

const TINY: Partial<Record<RoomType, string>> = {
  master_bedroom: "Master",
  guest_bedroom: "Guest",
  bedroom: "Bed",
  dirty_kitchen: "D. kitchen",
  kitchen: "Kit.",
  dressing: "Dress",
  laundry: "Lndry",
  corridor: "Pass.",
  servant: "Serv.",
};

/** "Master Bedroom" → "Master bedroom" (keeps "TV", numbers and proper nouns that are all caps). */
export function sentenceCase(name: string): string {
  const words = name.trim().split(/\s+/);
  return words
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : /^[A-Z]{2,}$/.test(w) || /\d/.test(w) ? w : w.toLowerCase()))
    .join(" ");
}

/**
 * Name forms for a room label, longest first. Every form still names the room: "Powder room" → "Powder",
 * "Bedroom 3" → "Bed 3", "Dirty Kitchen" → "Dirty kitchen" → "D. kitchen"; a bare "Room" never appears.
 */
export function nameForms(r: Room, taken: Set<string> = new Set()): string[] {
  const full = sentenceCase(r.name);
  const num = r.name.match(/\b(\d+)\b/)?.[1];
  const out: string[] = [full];
  const words = full.split(" ");
  if (words.length > 1 && /^(room|space|area|hall)$/i.test(words[words.length - 1])) out.push(words.slice(0, -1).join(" "));
  const short = SHORT[r.type];
  if (short) out.push(num && !short.includes(num) ? `${short} ${num}` : short);
  const tiny = TINY[r.type];
  if (tiny) out.push(num && !tiny.includes(num) ? `${tiny} ${num}` : tiny);
  // Never let a short form collide with another room's full name ("Dirty kitchen" never becomes "Kitchen").
  return [...new Set(out)].filter((c, i) => i === 0 || !taken.has(c.toLowerCase())).filter((c) => !/^(room|space|area|hall)$/i.test(c));
}

export function levelsOf(plan: BuildingPlan): Level[] {
  return [...plan.levels].sort((a, b) => a.index - b.index);
}

/** "G", "1", "2", "R": the floor-stack label. */
export function levelKey(l: Level, all: Level[]): string {
  if (l.id === "roof" || /roof/i.test(l.name)) return "R";
  if (l.index < 0) return "B";
  if (l.index === 0) return "G";
  const top = Math.max(...all.map((x) => x.index));
  if (l.index === top && !all.some((x) => x.id === "roof")) return "R";
  return String(l.index);
}

export function levelName(l: Level): string {
  return sentenceCase(l.name.replace(/\s*plan$/i, ""));
}

export function isRoofLevel(plan: BuildingPlan, l: Level): boolean {
  const top = Math.max(...plan.levels.map((x) => x.index));
  return l.id === "roof" || (l.index === top && !plan.rooms.some((r) => r.level === l.id && !SITE_TYPES.has(r.type) && !OPEN_TYPES.has(r.type)));
}

export const area = (r: Room) => r.rect.w * r.rect.d;

/** Door-like connections of a room: [neighbour id, opening]. "exterior" for outside. */
export function connections(plan: BuildingPlan, room: Room): { other: string; via: Opening["type"] | "open" }[] {
  const out: { other: string; via: Opening["type"] | "open" }[] = [];
  for (const o of plan.openings) {
    if (!DOOR_TYPES.has(o.type) || o.level !== room.level) continue;
    if (o.between[0] === room.id) out.push({ other: o.between[1], via: o.type });
    else if (o.between[1] === room.id) out.push({ other: o.between[0], via: o.type });
  }
  for (const r of plan.rooms) {
    if (r.id === room.id || r.level !== room.level) continue;
    if (room.open_to?.includes(r.id) || r.open_to?.includes(room.id)) out.push({ other: r.id, via: "open" });
  }
  return out;
}

/** "Corridor, own bath", the "Opens to" line for a room (DESIGN.md Plan: room hover). */
export function opensTo(plan: BuildingPlan, room: Room): string[] {
  const byId = new Map(plan.rooms.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of connections(plan, room)) {
    if (seen.has(c.other)) continue;
    seen.add(c.other);
    if (c.other === "exterior") {
      out.push(room.type === "porch" || room.type === "lobby" || c.via === "main_door" ? "the street side" : "outside");
      continue;
    }
    const other = byId.get(c.other);
    if (!other) continue;
    const otherDoors = connections(plan, other).filter((x) => x.other !== "exterior");
    const own = (other.type === "bath" || other.type === "dressing") && otherDoors.length === 1 && otherDoors[0].other === room.id;
    out.push(own ? `own ${other.type === "bath" ? "bath" : "dressing"}` : sentenceCase(other.name).replace(/^./, (ch) => (out.length ? ch.toLowerCase() : ch)));
  }
  // Exterior views: windows onto the outside are not "opens to".
  return out.map((s, i) => (i === 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s));
}

/** The level a world-space comment anchor sits on (anchor.level wins; else by height). */
export function anchorLevel(plan: BuildingPlan, c: Comment): string | undefined {
  if (c.anchor.level && plan.levels.some((l) => l.id === c.anchor.level)) return c.anchor.level;
  const hFt = c.anchor.position[1] / 0.3048;
  const lv = levelsOf(plan);
  let best: Level | undefined = lv[0];
  for (const l of lv) if (hFt >= l.elevation_ft - 0.5) best = l;
  return best?.id;
}

/** World meters (x, -y) → plan feet. */
export function anchorPlanXY(c: Comment): [number, number] {
  return [c.anchor.position[0] / 0.3048, -c.anchor.position[2] / 0.3048];
}

/** Rooms of a level that carry floor area (for schedules and totals). */
export function roomsOn(plan: BuildingPlan, levelId: string): Room[] {
  return plan.rooms.filter((r) => r.level === levelId && !SITE_TYPES.has(r.type));
}

/** Covered area of a level: rooms with a roof over them (porches count, balconies and terraces don't). */
export function coveredArea(plan: BuildingPlan, levelId: string): number {
  return roomsOn(plan, levelId)
    .filter((r) => !OPEN_TYPES.has(r.type) || r.type === "porch")
    .reduce((s, r) => s + area(r), 0);
}

/** Room-size changes between two plans: id → delta sq ft (only rooms in both, |Δ| ≥ 1). New rooms are "new". */
export function areaDeltas(before: BuildingPlan | undefined, after: BuildingPlan, ids: string[]): Map<string, number | "new"> {
  const out = new Map<string, number | "new">();
  for (const id of ids) {
    const a = after.rooms.find((r) => r.id === id);
    if (!a) continue;
    const b = before?.rooms.find((r) => r.id === id);
    if (!b) out.set(id, "new");
    else {
      const d = Math.round(area(a) - area(b));
      if (Math.abs(d) >= 1) out.set(id, d);
    }
  }
  return out;
}

/** DESIGN.md author hues (literal, so they work in SVG, print and inline styles). */
export const AUTHOR_HUES = ["#0D7C72", "#6A4FD6", "#C23F78", "#A8641A", "#4F6378", "#2F7A3A"];
export const hueColor = (c: Comment) => AUTHOR_HUES[(authorHue(c) - 1) % 6];

/** Stable author hue (1..6) for pins and avatars. */
export function authorHue(c: Comment): number {
  const key = c.author?.id || c.author?.name || "";
  if (!key) return 1;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}
