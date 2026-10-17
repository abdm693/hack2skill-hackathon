/**
 * EN2-05: names for as-built notes. A note speaks the family's language: "the door between the Kitchen and the
 * Dining", "the ground-to-first stair", never a plan id like g_kitchen_open or stair_g_f.
 */
import { DOOR_TYPES, type OpeningM, type PlanModel, type StairM } from "../plan/model";

export const cap = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
const low = (t: string): string => t.charAt(0).toLowerCase() + t.slice(1);

/** "ground" for "Ground Floor", "first" for "First Floor", "roof" for "Roof". */
const short = (name: string): string => name.replace(/\s*floor$/i, "").trim().toLowerCase() || name.toLowerCase();

/** "the ground-to-first stair", "the first-to-roof stair". */
export function stairLabel(s: StairM): string {
  return `the ${short(s.from.name)}-to-${short(s.to.name)} stair`;
}

/** "The main door", "The Kitchen window", "The door between the Kitchen and the Dining": for as-built notes. */
export function openingName(plan: PlanModel, op: OpeningM): string {
  const names = op.between.map((b) => (b === "exterior" ? null : plan.room(b)?.name ?? null)).filter((n): n is string => !!n);
  const kind = op.type === "main_door" ? "main door" : op.type === "double_door" ? "double door" : op.type === "sliding_door" ? "sliding door" : op.type === "garage_door" ? "garage door" : op.type === "arch" ? "arch" : op.type === "ventilator" ? "ventilator" : DOOR_TYPES.includes(op.type) ? "door" : "window";
  if (op.type === "main_door") return "The main door";
  if (op.id === "roof_mumty_door") return "The roof door";
  // EN-07: name the floor when a room name repeats on another floor ("Stair Hall" on every storey)
  const lv = plan.levelById.get(op.level);
  const twin = op.between.some((b) => {
    const r = plan.room(b);
    return !!r && plan.rooms.some((q) => q !== r && q.level !== r.level && q.name.trim().toLowerCase() === r.name.trim().toLowerCase());
  });
  const on = twin && lv ? ` on the ${lv.name.toLowerCase()}` : "";
  if (names.length >= 2) return `The ${kind} between the ${names[0]} and the ${names[1]}${on}`;
  if (names.length === 1) return `The ${names[0]} ${kind}${on}`;
  return lv ? `A ${kind} on the ${lv.name.toLowerCase()}` : `A ${kind}`;
}

/** The same, mid-sentence ("the door between the Kitchen and the Dining"). */
export function openingNameLow(plan: PlanModel, op: OpeningM): string {
  return low(openingName(plan, op));
}
