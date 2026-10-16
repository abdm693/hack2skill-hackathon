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

/** Strip engineering words the API might still send ("Argon", "section"). */
export function plain(text: string): string {
  return text
    .replace(/\bArgon( is)?\b/g, "")
    .replace(/\bthe AI architect\b/gi, "Naqsha")
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
