import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Armchair,
  ArrowRight,
  Braces,
  BrickWall,
  Check,
  ChevronDown,
  CircleAlert,
  CodeXml,
  Columns2,
  Lamp,
  Lightbulb,
  MessagesSquare,
  Ruler,
  ShieldCheck,
  Trees,
  Wrench,
} from "lucide-react";
import type { Layer } from "@contracts/house-sdk";
import type { BuildingPlan } from "@contracts/plan";
import type { FeedItem, Run } from "@/app/store/project";
import { cn, num } from "@/app/lib/utils";
import { Button } from "@/app/ui/Button";
import { Spinner } from "@/app/ui/primitives";
import { CodeBlock } from "./CodeBlock";

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;

export const LAYER_ICON: Record<Layer, Icon> = {
  structure: BrickWall,
  facade: Columns2,
  interior: Lamp,
  furniture: Armchair,
  landscape: Trees,
  lighting: Lightbulb,
  custom: Braces,
};

const STAGE_ICON: Record<string, Icon> = {
  plan: Ruler,
  compliance: ShieldCheck,
  fix: Wrench,
  build: CodeXml,
  save: Check,
  changes: MessagesSquare,
};

function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function planSummary(plan: BuildingPlan) {
  const storeys = plan.levels.filter((l) => l.index >= 0 && l.id !== "roof").length;
  const spaces = plan.rooms.filter((r) => !["lawn", "driveway", "open_space", "courtyard"].includes(r.type)).length;
  return `${storeys} floor${storeys === 1 ? "" : "s"}, ${spaces} spaces, ${plan.openings.length} doors and windows, ${plan.stairs.length} stair${plan.stairs.length === 1 ? "" : "s"}`;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function DesignTimeline({
  run,
  onShowPlan,
  shownPlanAttempt,
  onExplore,
}: {
  run: Run;
  onShowPlan?: (plan: BuildingPlan, attempt: number) => void;
  shownPlanAttempt?: number | null;
  onExplore?: () => void;
}) {
  const running = run.status === "running";
  const now = useNow(running);
  const items = run.items;
  const lastStageIdx = items.map((i) => i.kind).lastIndexOf("stage");
  const lastSectionIdx = items.map((i) => i.kind).lastIndexOf("section");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <ol className="relative">
      <span aria-hidden className="absolute bottom-3 left-[15px] top-3 w-px bg-line" />
      <AnimatePresence initial={false}>
        {items.map((it, idx) => {
          const offset = !run.resumed && run.startedAt ? clock(it.at - run.startedAt) : null;
          const isActiveStage = running && it.kind === "stage" && idx === lastStageIdx && !items.slice(idx + 1).some((x) => x.kind === "stage");
          return (
            <motion.li
              key={it.id}
              layout="position"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="relative pb-4 pl-11"
            >
              <Item
                it={it}
                active={isActiveStage}
                offset={isActiveStage ? null : offset}
                elapsed={isActiveStage ? clock(now - it.at) : null}
                chars={run.chars}
                latestSection={running && idx === lastSectionIdx}
                open={open[it.id]}
                onToggle={() => setOpen((o) => ({ ...o, [it.id]: !(o[it.id] ?? (running && idx === lastSectionIdx)) }))}
                onShowPlan={onShowPlan}
                shownPlanAttempt={shownPlanAttempt}
                onExplore={onExplore}
              />
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}

function Node({ children, tone = "ink", pulse }: { children: ReactNode; tone?: "ink" | "brick" | "pass" | "fail" | "muted"; pulse?: boolean }) {
  return (
    <span
      className={cn(
        "absolute left-0 top-0 grid size-[31px] place-items-center rounded-full ring-4 ring-paper",
        tone === "ink" && "bg-ink text-sheet",
        tone === "brick" && "bg-brick text-sheet",
        tone === "pass" && "bg-pass text-sheet",
        tone === "fail" && "bg-fail text-sheet",
        tone === "muted" && "bg-plaster text-graphite shadow-[inset_0_0_0_1px_var(--color-line-strong)]",
      )}
    >
      {pulse && <span className="absolute inset-0 animate-ping rounded-full bg-brick/30" />}
      {children}
    </span>
  );
}

function Meta({ offset, children }: { offset: string | null; children?: ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-[11.5px] text-pencil tabular">
      {children}
      {offset && <span>{offset}</span>}
    </span>
  );
}

function Item({
  it,
  active,
  offset,
  elapsed,
  chars,
  latestSection,
  open,
  onToggle,
  onShowPlan,
  shownPlanAttempt,
  onExplore,
}: {
  it: FeedItem;
  active: boolean;
  offset: string | null;
  elapsed: string | null;
  chars: number;
  latestSection: boolean;
  open?: boolean;
  onToggle: () => void;
  onShowPlan?: (plan: BuildingPlan, attempt: number) => void;
  shownPlanAttempt?: number | null;
  onExplore?: () => void;
}) {
  switch (it.kind) {
    case "stage": {
      const I = STAGE_ICON[it.stage] ?? Check;
      return (
        <>
          <Node tone={active ? "brick" : "muted"} pulse={active}>
            {active ? <Spinner className="size-3.5" /> : <I className="size-3.5" strokeWidth={1.75} />}
          </Node>
          <div className="pt-1">
            <p className={cn("text-[13.5px] leading-snug", active ? "font-medium text-ink" : "text-graphite")}>{it.message}</p>
            <Meta offset={offset}>
              {active && elapsed && <span className="text-brick">{elapsed}</span>}
              {active && chars > 0 && (it.stage === "plan" || it.stage === "fix" || it.stage === "build") && <span>{num(chars)} characters written</span>}
            </Meta>
          </div>
        </>
      );
    }
    case "plan":
      return (
        <>
          <Node tone="ink">
            <Ruler className="size-3.5" strokeWidth={1.75} />
          </Node>
          <div className="pt-1">
            <p className="text-[13.5px] font-medium text-ink">
              Plan drafted <span className="font-normal text-pencil">(attempt {it.attempt})</span>
            </p>
            <p className="text-[12.5px] text-graphite">{planSummary(it.plan)}</p>
            <div className="mt-1 flex items-center gap-3">
              <Meta offset={offset} />
              {onShowPlan && (
                <button
                  onClick={() => onShowPlan(it.plan, it.attempt)}
                  className={cn("text-[12px] font-medium underline-offset-4 hover:underline", shownPlanAttempt === it.attempt ? "text-brick" : "text-graphite")}
                >
                  {shownPlanAttempt === it.attempt ? "Shown on the drawing" : "Show on the drawing"}
                </button>
              )}
            </div>
          </div>
        </>
      );
    case "compliance": {
      const fails = it.report.checks.filter((c) => c.status === "fail");
      const warns = it.report.checks.filter((c) => c.status === "warn").length;
      return (
        <>
          <Node tone={fails.length ? "fail" : "pass"}>
            {fails.length ? <CircleAlert className="size-3.5" strokeWidth={2} /> : <ShieldCheck className="size-3.5" strokeWidth={1.75} />}
          </Node>
          <div className="pt-1">
            <p className="text-[13.5px] font-medium text-ink">
              LDA check {it.attempt}:{" "}
              <span className={fails.length ? "text-fail" : "text-pass"}>
                {fails.length ? `${fails.length} ${fails.length === 1 ? "violation" : "violations"}` : `all ${it.report.checks.length} pass`}
              </span>
              {!fails.length && warns > 0 && <span className="font-normal text-warn">, {warns} advisory</span>}
            </p>
            {fails.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {fails.slice(0, 4).map((c) => (
                  <li key={c.id} className="text-[12px] leading-snug text-graphite">
                    {c.title}
                  </li>
                ))}
                {fails.length > 4 && <li className="text-[12px] text-pencil">and {fails.length - 4} more</li>}
              </ul>
            )}
            <Meta offset={offset} />
          </div>
        </>
      );
    }
    case "section": {
      const I = LAYER_ICON[it.section.layer] ?? Braces;
      const isOpen = open ?? latestSection;
      const lines = it.section.code.trimEnd().split("\n").length;
      return (
        <>
          <Node tone="muted">
            <I className="size-3.5" strokeWidth={1.75} />
          </Node>
          <div className="pt-0.5">
            <button onClick={onToggle} className="group flex w-full items-center justify-between gap-2 rounded-lg py-1 text-left" aria-expanded={isOpen}>
              <span className="min-w-0">
                <span className="font-mono text-[12.5px] font-medium text-ink">{it.section.name}</span>
                <span className="ml-2 text-[11.5px] text-pencil">
                  {it.section.layer}, {lines} lines
                </span>
              </span>
              <ChevronDown className={cn("size-3.5 shrink-0 text-pencil transition-transform", isOpen && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <CodeBlock code={it.section.code} typing={latestSection} className="mt-1.5" maxHeight={260} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      );
    }
    case "changes":
      return (
        <>
          <Node tone="ink">
            <MessagesSquare className="size-3.5" strokeWidth={1.75} />
          </Node>
          <div className="pt-1">
            <p className="text-[13.5px] font-medium text-ink">{it.changes.length} change{it.changes.length === 1 ? "" : "s"} planned</p>
            <ul className="mt-1 space-y-1">
              {it.changes.map((c) => (
                <li key={c.id} className="text-[12.5px] leading-snug text-graphite">
                  {c.summary}
                </li>
              ))}
            </ul>
          </div>
        </>
      );
    case "comment":
      return (
        <>
          <Node tone="muted">
            <MessagesSquare className="size-3.5" strokeWidth={1.75} />
          </Node>
          <div className="pt-1 text-[12.5px] text-graphite">
            “{it.comment.text}” <span className="font-medium text-ink">{it.comment.status}</span>
          </div>
        </>
      );
    case "version":
      return (
        <>
          <Node tone="pass">
            <Check className="size-3.5" strokeWidth={2.5} />
          </Node>
          <div className="pt-1">
            <p className="text-[13.5px] font-medium text-ink">Saved as version {it.version.n}</p>
            <p className="text-[12.5px] text-graphite">
              {it.version.sections.length} code sections, {it.version.compliance.checks.filter((c) => c.status === "pass").length} of {it.version.compliance.checks.length} LDA checks passed
            </p>
            {onExplore && (
              <Button variant="primary" size="md" className="mt-3" onClick={onExplore} trailing={<ArrowRight className="size-4" strokeWidth={1.75} />}>
                Explore in 3D
              </Button>
            )}
          </div>
        </>
      );
    case "error":
      return (
        <>
          <Node tone="fail">
            <CircleAlert className="size-3.5" strokeWidth={2} />
          </Node>
          <div className="pt-1">
            <p className="text-[13.5px] font-medium text-fail">The run stopped</p>
            <p className="text-[12.5px] text-graphite">{it.message}</p>
          </div>
        </>
      );
  }
}
