import type { Project, Stage } from "@contracts/api-types";

export type StepId = "setup" | "concepts" | "design" | "explore" | "revisions";

export interface StepDef { id: StepId; label: string; short: string }

export const STEPS: StepDef[] = [
  { id: "setup", label: "Setup", short: "Setup" },
  { id: "concepts", label: "Concepts", short: "Concepts" },
  { id: "design", label: "Design", short: "Design" },
  { id: "explore", label: "Explore & Walk", short: "Explore" },
  { id: "revisions", label: "Revisions", short: "Revise" },
];

const ORDER: Stage[] = ["setup", "concepts", "planning", "building", "ready", "revising"];
export const stageIndex = (s: Stage) => ORDER.indexOf(s);

/** Which steps the project's stage unlocks. */
export function stepEnabled(project: Project | null | undefined, step: StepId): boolean {
  if (!project) return step === "setup";
  const i = stageIndex(project.stage);
  const hasVersion = project.versions.length > 0 && !!project.current_version_id;
  switch (step) {
    case "setup":
      return true;
    case "concepts":
      return i >= stageIndex("concepts") || project.concepts.length > 0;
    case "design":
      return !!project.selected_concept_id || i >= stageIndex("planning");
    case "explore":
      return hasVersion;
    case "revisions":
      return hasVersion;
  }
}

/** The step a project should open on. */
export function defaultStep(project: Project): StepId {
  switch (project.stage) {
    case "setup":
      return "setup";
    case "concepts":
      return project.selected_concept_id ? "design" : "concepts";
    case "planning":
    case "building":
      return "design";
    case "ready":
      return "explore";
    case "revising":
      return "revisions";
  }
}

export function stageLabel(project: Project): string {
  const v = project.versions.length;
  switch (project.stage) {
    case "setup":
      return "Setup";
    case "concepts":
      return project.selected_concept_id ? "Concept chosen" : "Concepts";
    case "planning":
      return "Planning";
    case "building":
      return "Building";
    case "ready":
      return v > 1 ? `Revised to v${v}` : "Ready to walk";
    case "revising":
      return "Revising";
  }
}

export type StageTone = "neutral" | "accent" | "progress" | "done";

export function stageTone(project: Project): StageTone {
  switch (project.stage) {
    case "setup":
    case "concepts":
      return "neutral";
    case "planning":
    case "building":
    case "revising":
      return "progress";
    case "ready":
      return "done";
  }
}
