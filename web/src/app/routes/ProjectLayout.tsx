import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, Check, RefreshCw } from "lucide-react";
import { api } from "@/api/client";
import { cn } from "@/app/lib/utils";
import { STEPS, defaultStep, stageIndex, stepEnabled, type StepId } from "@/app/lib/steps";
import { useProject } from "@/app/store/project";
import { Button } from "@/app/ui/Button";
import { Wordmark } from "@/app/ui/brand";
import { Pill, Spinner } from "@/app/ui/primitives";

export function ProjectLayout() {
  const { id } = useParams();
  const open = useProject((s) => s.open);
  const loadState = useProject((s) => s.loadState);
  const loadError = useProject((s) => s.loadError);
  const name = useProject((s) => s.project?.name);

  useEffect(() => {
    if (id) void open(id);
  }, [id, open]);

  useEffect(() => {
    if (name) document.title = `${name} — Naqsha`;
  }, [name]);

  return (
    <div className="flex h-[100dvh] flex-col bg-paper">
      <ProjectHeader />
      <div className="relative min-h-0 flex-1">
        {loadState === "error" ? (
          <div className="grid h-full place-items-center p-6">
            <div className="max-w-sm text-center">
              <p className="font-display-text text-[22px] text-ink">This project didn't open.</p>
              <p className="mt-2 text-[14px] text-graphite">{loadError}</p>
              <div className="mt-5 flex justify-center gap-2">
                <Link to="/">
                  <Button variant="ghost" icon={<ArrowLeft className="size-4" strokeWidth={1.75} />}>Back to projects</Button>
                </Link>
                <Button icon={<RefreshCw className="size-4" strokeWidth={1.75} />} onClick={() => id && open(id)}>
                  Try again
                </Button>
              </div>
            </div>
          </div>
        ) : loadState !== "ready" ? (
          <div className="grid h-full place-items-center">
            <div className="flex items-center gap-3 text-[14px] text-graphite">
              <Spinner className="text-brick" /> Opening your project…
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
}

function stepDone(step: StepId): (p: NonNullable<ReturnType<typeof useProject.getState>["project"]>) => boolean {
  return (p) => {
    const i = stageIndex(p.stage);
    switch (step) {
      case "setup": return i >= stageIndex("concepts");
      case "concepts": return !!p.selected_concept_id && i >= stageIndex("planning");
      case "design": return p.versions.length > 0;
      case "explore": return p.versions.length > 1 || p.stage === "revising";
      case "revisions": return p.versions.length > 1 && p.stage === "ready";
    }
  };
}

function ProjectHeader() {
  const project = useProject((s) => s.project);
  const designRunning = useProject((s) => s.design.status === "running");
  const reviseRunning = useProject((s) => s.revise.status === "running");
  const conceptsRunning = useProject((s) => !!s.conceptRun?.running);
  const location = useLocation();
  const current = (location.pathname.split("/")[3] ?? "") as StepId;

  const busy: Partial<Record<StepId, boolean>> = { concepts: conceptsRunning, design: designRunning, revisions: reviseRunning };

  return (
    <header className="relative z-20 border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 sm:px-5 lg:flex-nowrap lg:py-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 lg:h-16 lg:flex-none lg:basis-[300px] xl:basis-[340px]">
          <Link
            to="/"
            className="group flex shrink-0 items-center gap-1 rounded-full py-1 pl-1 pr-2 text-graphite transition-colors hover:bg-wash hover:text-ink"
            aria-label="All projects"
          >
            <ArrowLeft className="size-4 transition-transform duration-300 group-hover:-translate-x-0.5" strokeWidth={1.75} />
            <Wordmark compact className="[&>span]:text-[18px] [&>svg]:size-6" />
          </Link>
          <span className="h-5 w-px shrink-0 bg-line" />
          {project && <ProjectName name={project.name} />}
        </div>

        <nav aria-label="Project steps" className="no-scrollbar order-3 -mx-3 flex w-[calc(100%+1.5rem)] items-center overflow-x-auto px-3 lg:order-none lg:mx-auto lg:w-auto lg:overflow-visible lg:px-0">
          <ol className="flex items-center">
            {STEPS.map((s, i) => {
              const enabled = stepEnabled(project, s.id);
              const done = project ? stepDone(s.id)(project) : false;
              const active = current === s.id;
              return (
                <li key={s.id} className="flex items-center">
                  {i > 0 && <span className={cn("mx-1 h-px w-4 sm:w-7", enabled ? "bg-line-strong" : "bg-line")} aria-hidden />}
                  <StepLink to={s.id} enabled={enabled} active={active}>
                    <span
                      className={cn(
                        "grid size-[22px] shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular transition-colors duration-300",
                        active
                          ? "bg-brick text-sheet"
                          : done
                            ? "bg-ink text-sheet"
                            : enabled
                              ? "text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
                              : "text-pencil shadow-[inset_0_0_0_1px_var(--color-line)]",
                      )}
                    >
                      {busy[s.id] ? <Spinner className="size-3" /> : done && !active ? <Check className="size-3" strokeWidth={2.5} /> : i + 1}
                    </span>
                    <span className={cn("whitespace-nowrap", active ? "font-semibold text-ink" : enabled ? "text-ink-2" : "text-pencil")}>
                      <span className="hidden sm:inline">{s.label}</span>
                      <span className="sm:hidden">{s.short}</span>
                    </span>
                    {active && (
                      <motion.span
                        layoutId="step-underline"
                        className="absolute inset-x-2 -bottom-[11px] h-[2px] rounded-full bg-brick lg:-bottom-[21px]"
                        transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      />
                    )}
                  </StepLink>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="hidden items-center justify-end gap-2 lg:flex lg:basis-[300px] xl:basis-[340px]">
          {api.mock && <Pill tone="accent">Demo data</Pill>}
        </div>
      </div>
    </header>
  );
}

function StepLink({ to, enabled, active, children }: { to: StepId; enabled: boolean; active: boolean; children: ReactNode }) {
  const cls = "relative flex items-center gap-2 rounded-full px-2 py-1.5 text-[13px] transition-colors duration-200";
  if (!enabled) {
    return (
      <span className={cn(cls, "cursor-not-allowed")} aria-disabled title="Finish the earlier steps first">
        {children}
      </span>
    );
  }
  return (
    <NavLink to={to} className={cn(cls, !active && "hover:bg-wash")} aria-current={active ? "step" : undefined}>
      {children}
    </NavLink>
  );
}

function ProjectName({ name }: { name: string }) {
  const rename = useProject((s) => s.rename);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setValue(name), [name]);
  useEffect(() => { if (editing) ref.current?.select(); }, [editing]);
  const commit = () => {
    setEditing(false);
    if (value.trim() && value.trim() !== name) void rename(value.trim());
    else setValue(name);
  };
  return editing ? (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setValue(name); setEditing(false); }
      }}
      aria-label="Project name"
      className="min-w-0 flex-1 rounded-md bg-plaster px-2 py-1 font-display-text text-[16px] font-medium text-ink outline-none ring-1 ring-brick"
    />
  ) : (
    <button
      onClick={() => setEditing(true)}
      title="Rename"
      className="min-w-0 truncate rounded-md px-1.5 py-1 text-left font-display-text text-[16px] font-medium text-ink transition-colors hover:bg-wash"
    >
      {name}
    </button>
  );
}

/** Redirects to the right step for the project's stage, and guards locked steps. */
export function StepGate({ step, children }: { step?: StepId; children?: ReactNode }) {
  const project = useProject((s) => s.project);
  if (!project) return null;
  if (!step) return <Navigate to={defaultStep(project)} replace />;
  if (!stepEnabled(project, step)) return <Navigate to={`../${defaultStep(project)}`} replace />;
  return <>{children}</>;
}
