/**
 * View switch (DESIGN.md §5.2), top-centre: Brief · Concepts · Plan · House. Views of one home, not steps.
 * Only views that exist are shown; one being made carries a breathing accent dot. ⌘1–4 switch views (ProjectShell).
 */
import { useNavigate } from "react-router-dom";
import type { Project } from "@contracts/api-types";
import { cn } from "@/app/lib/utils";
import { VIEWS, viewAvailable, type SwitchViewId, type ViewId } from "@/app/lib/views";
import { useProject } from "@/app/store/project";
import { Segmented } from "@/app/ui/Segmented";

export function useBusyViews(): Partial<Record<SwitchViewId, boolean>> {
  const concepts = useProject((s) => !!s.conceptRun?.running);
  const design = useProject((s) => s.design.status === "running");
  const revise = useProject((s) => s.revise.status === "running");
  const intake = useProject((s) => s.intakeBusy);
  return { brief: intake, concepts, plan: design, house: revise };
}

export function ViewSwitch({ project, view, tone, fill }: { project: Project; view: ViewId; tone: "light" | "hud"; fill?: boolean }) {
  const navigate = useNavigate();
  const busy = useBusyViews();
  const options = VIEWS.filter((v) => viewAvailable(project, v.id) || v.id === view).map((v) => ({
    value: v.id,
    label: v.label,
    busy: !!busy[v.id] && v.id !== view,
  }));
  // One place only (a brand-new home): nothing to switch between.
  if (options.length < 2) return null;
  return (
    <div className={cn("pointer-events-auto rounded-full", tone === "hud" ? "glass-hud" : "glass-light", fill && "w-full")}>
      <Segmented<SwitchViewId>
        label="Views of this home"
        value={view as SwitchViewId}
        options={options}
        onChange={(v) => navigate(`/app/p/${project.id}/${v}`)}
        tone={tone === "hud" ? "hud" : "light"}
        className={cn("h-12 bg-transparent p-1.5 [&>button]:px-4", fill && "w-full")}
        fill={fill}
      />
    </div>
  );
}
