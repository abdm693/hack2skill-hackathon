/**
 * What Naqsha is doing right now, in one plain line for the dock ("Laying out the floors…", "Building 3D, 14 of 23"),
 * and what it last said. While Naqsha works, narration replaces the Next pill (DESIGN.md §5).
 */
import { useMemo } from "react";
import type { Project } from "@contracts/api-types";
import { useProject, type Run } from "@/app/store/project";

export interface Narration {
  text: string;
  /** 0..1 when known. */
  progress?: number;
  kind: "intake" | "concepts" | "design" | "revise" | "night";
}

/** Room ids to names ("g_kitchen" → "Kitchen") from the current plan, for plain narration. */
let roomNames = new Map<string, string>();
export function setRoomNames(rooms: { id: string; name: string }[] | undefined) {
  roomNames = new Map((rooms ?? []).map((r) => [r.id, r.name]));
}

function roomWords(id: string): string {
  const named = roomNames.get(id);
  // "Master Bedroom" → "master bedroom", "TV Lounge" → "TV lounge", "Bedroom 2" → "bedroom 2"
  if (named) return named.split(" ").map((w) => (/^[A-Z][a-z]+$/.test(w) ? w.toLowerCase() : w)).join(" ");
  return id
    .replace(/^[gfrb]_/, "")
    .replace(/^bed(\d)/, "bedroom $1")
    .replace(/^bath(\d)/, "bath $1")
    .replace(/^corr$/, "passage")
    .replace(/_/g, " ");
}

/** "the kitchen", but "Bedroom 2" (numbered rooms read as names). */
function room(id: string): string {
  const w = roomWords(id);
  return /\d/.test(w) ? w.replace(/^\w/, (c) => c.toUpperCase()) : `the ${w}`;
}

/**
 * Plain words for what the API narrates: no codenames, no ids, no "sections".
 * "Reading furnish_g_kitchen…" → "Reading the kitchen furniture…", "Looking at g_lounge…" → "Looking at the TV lounge…".
 */
export function plain(text: string): string {
  return text
    .replace(/\bArgon( is)?\b/g, "")
    .replace(/\bthe AI architect\b/gi, "Naqsha")
    .replace(/\bfurnish_([a-z0-9_]+)/g, (_, id: string) => `the furniture in ${room(id)}`)
    .replace(/\bfacade_([a-z0-9_]+)/g, (_, id: string) => `the ${id.replace(/_/g, " ")} facade`)
    .replace(/\binterior_([a-z0-9_]+)/g, (_, id: string) => `the ${roomWords(id)} interiors`)
    .replace(/\b(structure|landscape|lighting)\b(?= *[….]|$)/g, (m) => `the ${m}`)
    .replace(/\b[gfrb]_[a-z0-9_]+\b/g, (id) => room(id))
    .replace(/\b(\d+) (code )?sections\b/g, "$1 parts")
    .replace(/\bthe the\b/g, "the")
    .replace(/\s{2,}/g, " ")
    .replace(/^\s*[a-z]/, (c) => c.toUpperCase())
    .trim();
}

function runLine(run: Run, kind: "design" | "revise"): Narration | null {
  if (run.status !== "running") return null;
  const last = [...run.items].reverse().find((i) => i.kind === "stage");
  const building = last?.kind === "stage" && last.stage === "build";
  const done = run.sections.length;
  const total = run.version?.sections.length ?? 0;
  if (building && done > 0) {
    return { kind, text: total ? `Building your home in 3D, ${done} of ${total}` : `Building your home in 3D, ${done} parts so far`, progress: total ? done / total : undefined };
  }
  if (last?.kind === "stage") return { kind, text: plain(last.message) || "Working…" };
  return { kind, text: kind === "design" ? "Reading the brief…" : "Reading your notes…" };
}

export function useNarration(): Narration | null {
  const intakeBusy = useProject((s) => s.intakeBusy);
  const conceptRun = useProject((s) => s.conceptRun);
  const design = useProject((s) => s.design);
  const revise = useProject((s) => s.revise);
  return useMemo(() => {
    const r = runLine(revise, "revise") ?? runLine(design, "design");
    if (r) return r;
    if (conceptRun?.running) {
      const done = conceptRun.slots.filter((x) => x.status !== "drawing").length;
      const n = conceptRun.slots.length;
      const what = conceptRun.baseId ? (n === 1 ? "a variation" : `${n} variations`) : n === 4 ? "four exteriors" : `${n} exteriors`;
      return { kind: "concepts", text: done ? `Drawing ${what}, ${done} of ${n} ready` : `Drawing ${what}…`, progress: done / n };
    }
    if (intakeBusy) return { kind: "intake", text: "Reading your message…" };
    return null;
  }, [intakeBusy, conceptRun, design, revise]);
}

/** Naqsha's most recent words in the conversation (for the dock line). */
export function useLastLine(): string | null {
  const messages = useProject((s) => s.messages);
  return useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "assistant") return plain(messages[i].text);
    return null;
  }, [messages]);
}

/** LDA and livable counts for the current version ("42/42 LDA · 5/5 livable"). */
export function complianceCounts(project: Project | null, versions: Record<string, { compliance?: { checks: { status: string; category?: string }[] } }>) {
  const vid = project?.current_version_id;
  const checks = vid ? versions[vid]?.compliance?.checks : undefined;
  if (!checks?.length) return null;
  const lda = checks.filter((c) => (c.category ?? "lda") === "lda");
  const livable = checks.filter((c) => c.category === "livable");
  const pass = (l: typeof checks) => l.filter((c) => c.status !== "fail").length;
  return {
    lda: { pass: pass(lda), total: lda.length },
    livable: livable.length ? { pass: pass(livable), total: livable.length } : null,
  };
}
