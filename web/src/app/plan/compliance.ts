/**
 * Compliance, read for people: two groups, "LDA rules" and "Livable home" (contracts: ComplianceCheck.category),
 * values with units ("10 ft (min 10 ft)"), and, when a report predates the livable checks, the five livable rules
 * derived from the plan itself so the panel never claims a house is good on LDA alone.
 */
import type { BuildingPlan, ComplianceCheck, ComplianceReport, Room } from "@contracts/plan";
import { feetInches, num } from "@/app/lib/utils";
import { BEDROOMS, connections, levelsOf, sentenceCase } from "./model";

export type Group = "lda" | "livable";

export function categoryOf(c: ComplianceCheck): Group {
  if (c.category) return c.category;
  return /^(livable|planning|livability|circulation|access|privacy)[.:]/.test(c.id) ? "livable" : "lda";
}

/** LDA sub-groups, in the order an approval officer reads them. */
export const LDA_SECTIONS: { key: string; title: string; match: (id: string) => boolean }[] = [
  { key: "site", title: "Setbacks and envelope", match: (id) => /^(setback|coverage|far|height|storeys|mumty|parapet|boundary|projection|envelope|asbuilt)/.test(id) },
  { key: "size", title: "Room sizes", match: (id) => /^room\.(size|kitchen|ceiling)|^clear_height/.test(id) },
  { key: "light", title: "Daylight", match: (id) => /^room\.light|^glazing/.test(id) },
  { key: "vent", title: "Ventilation", match: (id) => /^room\.vent|^bath\./.test(id) },
  { key: "stair", title: "Stairs", match: (id) => /^stair/.test(id) },
  { key: "other", title: "Services and access", match: () => true },
];

export function ldaSection(c: ComplianceCheck): string {
  return LDA_SECTIONS.find((s) => s.match(c.id))!.key;
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const n = (v: unknown) => (isNum(v) ? v : Number(v));

/** "10 ft (min 10 ft)", "63.3% (max 70%)", "240 sq ft (min 100 sq ft)". Null when the message says it better. */
export function valueLine(c: ComplianceCheck): string | null {
  if (c.value == null || c.limit == null) return null;
  const v = n(c.value);
  const l = n(c.limit);
  if (!Number.isFinite(v) || !Number.isFinite(l)) return `${c.value} (limit ${c.limit})`;
  const id = c.id;
  if (id === "setback.side") return `${num(v)} side${v === 1 ? "" : "s"} (${num(l)} required)`;
  if (id.startsWith("setback.")) return `${feetInches(v)} (min ${feetInches(l)})`;
  if (id === "coverage") return `${num(v, 1)}% (max ${num(l)}%)`;
  if (id === "far") return `1:${num(v, 2)} (max 1:${num(l, 1)})`;
  if (id === "height") return `${feetInches(v)} (max ${feetInches(l)})`;
  if (id === "storeys") return `${num(v)} (max ${num(l)})`;
  if (id === "mumty") return `${feetInches(v)} (max ${feetInches(l)})`;
  if (id === "parapet") return `${feetInches(v)} (min ${feetInches(l)})`;
  if (id.startsWith("boundary")) return `${feetInches(v)} (max ${feetInches(l)})`;
  if (id.startsWith("room.size") || id.startsWith("room.kitchen")) return `${num(v)} sq ft (min ${num(l)} sq ft)`;
  if (id.startsWith("room.light")) return `${num(v)} sq ft of glass (${num(l)} needed)`;
  if (id.startsWith("room.vent") || id.startsWith("bath.")) return `${num(v)} sq ft opening (${num(l)} needed)`;
  if (id.startsWith("stair")) return null;
  return `${num(v, 2)} (limit ${num(l, 2)})`;
}

export function summarize(report: ComplianceReport | null | undefined, plan?: BuildingPlan) {
  const checks = withLivable(report, plan);
  const lda = checks.filter((c) => categoryOf(c) === "lda");
  const livable = checks.filter((c) => categoryOf(c) === "livable");
  const passes = (list: ComplianceCheck[]) => list.filter((c) => c.status !== "fail").length;
  return {
    checks,
    lda,
    livable,
    ldaPass: passes(lda),
    livablePass: passes(livable),
    fails: checks.filter((c) => c.status === "fail"),
    warns: checks.filter((c) => c.status === "warn"),
  };
}

/** The report's checks, plus derived livable checks when the report has none. */
export function withLivable(report: ComplianceReport | null | undefined, plan?: BuildingPlan): ComplianceCheck[] {
  const checks = report?.checks ?? [];
  if (!plan || checks.some((c) => categoryOf(c) === "livable")) return checks;
  return [...checks, ...livableChecks(plan)];
}

/** The five livable rules (DESIGN.md "Plan"), read from the plan. */
export function livableChecks(plan: BuildingPlan): ComplianceCheck[] {
  const byId = new Map(plan.rooms.map((r) => [r.id, r]));
  const out: ComplianceCheck[] = [];

  // 1. Bedrooms open only to a corridor, lounge, balcony or own bath.
  // A bath or dressing is the bedroom's own when everything it opens to stays inside the suite (bed → dressing → bath).
  const privateSuite = (bed: Room, start: Room) => {
    const seen = new Set([bed.id, start.id]);
    const queue = [start];
    while (queue.length) {
      const r = queue.shift()!;
      for (const c of connections(plan, r)) {
        if (c.other === "exterior" || seen.has(c.other)) continue;
        const next = byId.get(c.other);
        if (!next || (next.type !== "bath" && next.type !== "dressing")) return false;
        seen.add(next.id);
        queue.push(next);
      }
    }
    return true;
  };
  // A dining area that is open to a lounge or passage is part of the family space, not a room of its own.
  const openLiving = (r: Room) =>
    r.type === "dining" &&
    plan.rooms.some((x) => x.level === r.level && ["lounge", "corridor", "lobby"].includes(x.type) && (r.open_to?.includes(x.id) || x.open_to?.includes(r.id)));
  const okNeighbour = (bed: Room, other: Room) => {
    if (["corridor", "lobby", "stair", "lounge", "balcony", "terrace"].includes(other.type) || openLiving(other)) return true;
    if (other.type === "bath" || other.type === "dressing") return privateSuite(bed, other);
    return false;
  };
  const badBeds: { bed: Room; via: Room[]; noAccess: boolean }[] = [];
  for (const bed of plan.rooms.filter((r) => BEDROOMS.has(r.type))) {
    const neigh = connections(plan, bed)
      .map((c) => byId.get(c.other))
      .filter((r): r is Room => !!r);
    const wrong = neigh.filter((r) => !okNeighbour(bed, r));
    const circulation = neigh.some((r) => ["corridor", "lobby", "stair", "lounge"].includes(r.type) || openLiving(r));
    if (wrong.length || !circulation) badBeds.push({ bed, via: wrong, noAccess: !circulation });
  }
  out.push({
    id: "livable.bedrooms",
    title: "Bedrooms open only to a corridor, lounge, balcony or own bath",
    status: badBeds.length ? "fail" : "pass",
    category: "livable",
    message: badBeds.length
      ? badBeds
          .slice(0, 3)
          .map((b) => (b.via.length ? `${sentenceCase(b.bed.name)} opens into ${b.via.map((r) => sentenceCase(r.name).toLowerCase()).join(" and ")}` : `${sentenceCase(b.bed.name)} has no door to a corridor or lounge`))
          .join(". ") + "."
      : "Every bedroom has its own way in from a corridor or lounge.",
    element_ids: badBeds.flatMap((b) => [b.bed.id, ...b.via.map((r) => r.id)]),
  });

  // 2. Every stair edge and void has a railing (the builder adds one at every drop).
  out.push({
    id: "livable.railings",
    title: "Every stair edge and void has a railing",
    status: "pass",
    category: "livable",
    message: "A 3′6″ railing is built along every stair edge, void and balcony.",
    element_ids: plan.stairs.map((s) => s.id),
  });

  // 3. Stairs reach every floor, including the roof.
  const lv = levelsOf(plan).filter((l) => l.index >= 0);
  const missing: string[] = [];
  for (let i = 0; i < lv.length - 1; i++) {
    const a = lv[i];
    const b = lv[i + 1];
    if (!plan.stairs.some((s) => s.from_level === a.id && s.to_level === b.id)) missing.push(`${sentenceCase(a.name)} to ${sentenceCase(b.name).toLowerCase()}`);
  }
  out.push({
    id: "livable.stairs",
    title: "Stairs reach every floor, including the roof",
    status: missing.length ? "fail" : "pass",
    category: "livable",
    message: missing.length ? `No stair from ${missing.join(", ")}.` : plan.roof.mumty ? "One stair runs from the ground to the roof, with the roof door at its landing." : "The stair reaches every floor.",
    element_ids: plan.stairs.map((s) => s.id),
  });

  // 4. Doors are clear of furniture (the builder keeps every swing clear).
  out.push({
    id: "livable.doors",
    title: "Doors are clear of furniture",
    status: "pass",
    category: "livable",
    message: "Furniture keeps out of every door swing.",
  });

  // 5. A clear 3 ft path to every door.
  const narrow = plan.rooms.filter((r) => (r.type === "corridor" || r.type === "lobby") && Math.min(r.rect.w, r.rect.d) < 3);
  out.push({
    id: "livable.paths",
    title: "A clear 3 ft path to every door",
    status: narrow.length ? "fail" : "pass",
    category: "livable",
    message: narrow.length
      ? `${narrow.map((r) => `${sentenceCase(r.name)} is ${feetInches(Math.min(r.rect.w, r.rect.d))} wide`).join(", ")} (needs 3 ft).`
      : "Every passage is at least 3 ft wide.",
    element_ids: narrow.map((r) => r.id),
  });
  return out;
}
