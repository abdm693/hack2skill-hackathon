import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Box, CodeXml, Play, RefreshCw, Ruler, ShieldCheck } from "lucide-react";
import type { BuildingPlan, ComplianceCheck } from "@contracts/plan";
import type { Version } from "@contracts/api-types";
import { cn, num } from "@/app/lib/utils";
import { loadFixLoop } from "@/app/lib/fixloop";
import { useProject, type FeedItem, type Run } from "@/app/store/project";
import { FloorPlan } from "@/app/plan/FloorPlan";
import { EnvelopeDiagram } from "@/app/setup/EnvelopeDiagram";
import { Button } from "@/app/ui/Button";
import { Spinner } from "@/app/ui/primitives";
import { CompliancePanel, FixLoop } from "./CompliancePanel";
import { DesignTimeline } from "./Timeline";

type MobileTab = "progress" | "drawing" | "compliance";

/** A finished version shown without a live run: rebuild a compact timeline from it. */
function staticItems(v: Version, loop?: number[]): FeedItem[] {
  const at = new Date(v.created_at).getTime();
  const attempts = loop && loop.length > 1 ? loop.length : 1;
  const items: FeedItem[] = [
    { id: "s-plan", at, kind: "plan", attempt: attempts, plan: v.plan },
    ...(attempts > 1
      ? [{ id: "s-fix", at, kind: "stage", stage: "fix", message: `Argon fixed ${loop!.join(" → ")} LDA violations over ${attempts} checks` } as FeedItem]
      : []),
    { id: "s-comp", at, kind: "compliance", attempt: attempts, report: v.compliance },
    { id: "s-build", at, kind: "stage", stage: "build", message: `Argon wrote the 3D model as ${v.sections.length} code sections` },
    ...v.sections.map((s, i): FeedItem => ({ id: `s-sec-${s.name}`, at, kind: "section", index: i, section: s })),
    { id: "s-ver", at, kind: "version", version: v },
  ];
  return items;
}

export function DesignStep() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const project = useProject((s) => s.project)!;
  const run = useProject((s) => s.design);
  const runDesign = useProject((s) => s.runDesign);
  const loadVersion = useProject((s) => s.loadVersion);
  const versions = useProject((s) => s.versions);

  const [check, setCheck] = useState<ComplianceCheck | null>(null);
  const [override, setOverride] = useState<{ plan: BuildingPlan; attempt: number } | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("progress");
  const [rightTab, setRightTab] = useState<"drawing" | "compliance">("drawing");
  const [level, setLevel] = useState<string | undefined>(undefined);

  const currentVid = params.get("v") ?? project.current_version_id;
  useEffect(() => {
    if (currentVid) void loadVersion(currentVid);
  }, [currentVid, loadVersion]);
  const version = run.version ?? (currentVid ? versions[currentVid] : undefined);

  // Arriving from "Use this concept": start straight away.
  useEffect(() => {
    const st = location.state as { autostart?: boolean } | null;
    if (st?.autostart) {
      navigate(".", { replace: true, state: null });
      if (run.status === "idle" && !project.current_version_id) void runDesign();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A newer plan replaces any attempt the user was inspecting.
  useEffect(() => setOverride(null), [run.planAttempt]);

  const running = run.status === "running";
  const plan = override?.plan ?? run.plan ?? version?.plan;
  const report = run.compliance ?? version?.compliance;
  const attempt = run.complianceAttempt;
  const shownRun: Run | null = run.items.length ? run : version ? { ...run, status: "done", items: staticItems(version, loadFixLoop(version.id)), resumed: true } : null;

  const issues = useMemo(
    () => (report && !report.ok ? report.checks.filter((c) => c.status === "fail").flatMap((c) => c.element_ids ?? []) : []),
    [report],
  );

  const select = (c: ComplianceCheck | null) => {
    setCheck(c);
    if (c?.element_ids?.length) {
      setRightTab("drawing");
      setMobileTab("drawing");
    }
  };

  const explore = () => navigate("../explore");
  const idle = !running && !shownRun && !plan;

  if (idle && currentVid) {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex items-center gap-3 text-[14px] text-graphite">
          <Spinner className="text-brick" /> Loading the drawings…
        </div>
      </div>
    );
  }
  if (idle) return <ReadyToDesign onStart={() => void runDesign()} />;

  return (
    <div className="flex h-full flex-col">
      {/* Header strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="font-display-text text-[19px] font-medium leading-tight text-ink">
            {running ? "Argon, the AI architect, is at work" : version ? `Version ${version.n}: your naqsha` : "Design"}
          </h1>
          <p className="text-[12.5px] text-graphite">
            {running
              ? run.resumed
                ? "Reconnected to the run in progress."
                : "Plan, LDA check and fix loop, then the 3D model written as code."
              : version
                ? `${version.plan.rooms.length} spaces, ${version.sections.length} code sections, ${version.compliance.checks.filter((c) => c.status === "pass").length}/${version.compliance.checks.length} LDA checks passed`
                : run.status === "error"
                  ? "The run stopped. You can run it again."
                  : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!running && (
            <Button variant="ghost" size="sm" icon={<RefreshCw className="size-3.5" strokeWidth={1.75} />} onClick={() => void runDesign()}>
              {version ? "Design again" : "Run again"}
            </Button>
          )}
          {version && !running && (
            <Button variant="primary" size="md" onClick={explore} trailing={<ArrowRight className="size-4" strokeWidth={1.75} />}>
              Explore in 3D
            </Button>
          )}
          {running && <RunClock run={run} />}
        </div>
      </div>

      {/* Phone tabs */}
      <div className="flex gap-1 border-b border-line px-3 py-2 lg:hidden">
        {(["progress", "drawing", "compliance"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={cn("h-8 flex-1 rounded-full text-[13px] font-medium", mobileTab === t ? "bg-ink text-sheet" : "text-graphite")}
          >
            {t === "progress" ? "Progress" : t === "drawing" ? "Drawing" : "LDA check"}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Timeline */}
        <section
          className={cn(
            "scrollbar-thin min-h-0 w-full flex-col overflow-y-auto border-line px-4 py-5 sm:px-5 lg:w-[350px] lg:shrink-0 lg:border-r xl:w-[370px]",
            mobileTab === "progress" ? "flex" : "hidden",
            "lg:flex",
          )}
        >
          {shownRun && (
            <DesignTimeline
              run={shownRun}
              onShowPlan={running ? (p, a) => setOverride(a === run.planAttempt ? null : { plan: p, attempt: a }) : undefined}
              shownPlanAttempt={override?.attempt ?? run.planAttempt}
              onExplore={explore}
            />
          )}
          {running && !run.items.length && (
            <div className="flex items-center gap-3 text-[13.5px] text-graphite">
              <Spinner className="text-brick" /> Starting the architect…
            </div>
          )}
        </section>

        {/* Drawing */}
        <section
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col",
            mobileTab === "drawing" ? "flex" : "hidden",
            rightTab === "drawing" ? "lg:flex" : "lg:hidden",
            "xl:flex",
          )}
        >
          <RightTabs value={rightTab} onChange={setRightTab} />
          <div className="relative min-h-0 flex-1 p-3 sm:p-5">
            <div className="bg-drafting relative flex h-full min-h-[460px] flex-col rounded-[22px] p-3 ring-1 ring-line sm:p-4">
              {plan ? (
                <FloorPlan
                  plan={plan}
                  level={level}
                  onLevelChange={setLevel}
                  highlight={check?.element_ids}
                  highlightTone={check ? (check.status === "fail" ? "fail" : check.status === "warn" ? "warn" : "pass") : "accent"}
                  issues={!override && running ? issues : undefined}
                  setbacks={report?.envelope.setbacks_ft}
                />
              ) : (
                <PlanPending project={project} run={run} />
              )}
              <AnimatePresence>
                {override && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-1.5 text-[12.5px] text-sheet shadow-float"
                  >
                    Showing attempt {override.attempt}
                    <button onClick={() => setOverride(null)} className="font-medium text-[#f3b9a8] hover:underline">
                      Show latest
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* Compliance */}
        <section
          className={cn(
            "scrollbar-thin min-h-0 w-full flex-col overflow-y-auto border-line lg:w-auto lg:flex-1 xl:w-[360px] xl:flex-none xl:shrink-0 xl:border-l",
            mobileTab === "compliance" ? "flex" : "hidden",
            rightTab === "compliance" ? "lg:flex" : "lg:hidden",
            "xl:flex",
          )}
        >
          <div className="xl:hidden">
            <RightTabs value={rightTab} onChange={setRightTab} />
          </div>
          <CompliancePanel
            report={report}
            attempt={attempt}
            failures={run.failures.length > 1 ? run.failures : loadFixLoop(version?.id)}
            selectedId={check?.id}
            onSelect={select}
            running={running}
          />
        </section>
      </div>
    </div>
  );
}

function RightTabs({ value, onChange }: { value: "drawing" | "compliance"; onChange: (v: "drawing" | "compliance") => void }) {
  return (
    <div className="hidden gap-1 px-5 pt-4 lg:flex xl:hidden">
      {(["drawing", "compliance"] as const).map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={cn("h-8 rounded-full px-4 text-[13px] font-medium", value === t ? "bg-ink text-sheet" : "text-graphite hover:bg-wash")}
        >
          {t === "drawing" ? "Drawing" : "LDA check"}
        </button>
      ))}
    </div>
  );
}

function RunClock({ run }: { run: Run }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = run.startedAt ? Math.round((now - run.startedAt) / 1000) : 0;
  const sections = run.sections.length;
  return (
    <div className="flex items-center gap-3 rounded-full bg-plaster px-3.5 py-1.5 text-[12.5px] text-graphite ring-1 ring-line">
      <Spinner className="size-3.5 text-brick" />
      {!run.resumed && <span className="tabular">{Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}</span>}
      {sections > 0 && <span className="tabular">{sections} sections</span>}
      {run.chars > 0 && <span className="hidden tabular sm:inline">{num(run.chars)} chars</span>}
    </div>
  );
}

function PlanPending({ project, run }: { project: NonNullable<ReturnType<typeof useProject.getState>["project"]>; run: Run }) {
  const plot = project.brief?.plot;
  return (
    <div className="relative grid h-full place-items-center">
      {plot?.width_ft && project.envelope ? (
        <EnvelopeDiagram width={plot.width_ft} depth={plot.depth_ft} envelope={project.envelope} corner={plot.corner} facing={project.brief?.facing} className="h-full max-h-[620px] w-auto opacity-60" />
      ) : null}
      <div className="absolute inset-x-0 bottom-6 mx-auto w-fit max-w-[90%] rounded-2xl bg-plaster/95 px-5 py-3 text-center shadow-lift ring-1 ring-line backdrop-blur">
        <p className="flex items-center justify-center gap-2 text-[13.5px] font-medium text-ink">
          <Spinner className="size-3.5 text-brick" /> Argon is laying out the floors inside the envelope
        </p>
        <p className="mt-0.5 text-[12px] text-graphite">
          {run.chars ? `${num(run.chars)} characters of plan written so far. ` : ""}Drafting a full plan usually takes a minute or two.
        </p>
      </div>
    </div>
  );
}

function ReadyToDesign({ onStart }: { onStart: () => void }) {
  const steps = [
    { icon: Ruler, title: "Plan", body: "Argon lays out every floor, room, door, window and stair, in feet, inside your LDA envelope." },
    { icon: ShieldCheck, title: "Check and fix", body: "The LDA engine checks 40+ rules. Argon fixes anything that fails and checks again." },
    { icon: CodeXml, title: "Build", body: "Argon writes the 3D model as code, section by section, guided by your concept." },
    { icon: Box, title: "Walk", body: "Explore the house in 3D, walk through it, and pin comments anywhere." },
  ];
  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-8">
        <h1 className="font-display-tight text-[40px] font-medium leading-tight text-ink">Ready to draw your naqsha</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-graphite">
          The AI architect turns your brief and chosen concept into a dimensioned plan that passes LDA rules, then a 3D house you can walk through.
        </p>
        <ol className="mt-8 grid gap-4 sm:grid-cols-2">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-2xl bg-plaster p-4 ring-1 ring-line">
              <div className="flex items-center gap-2">
                <span className="font-display-text text-[13px] text-brick">{i + 1}</span>
                <s.icon className="size-4 text-ink" strokeWidth={1.6} />
                <span className="text-[14px] font-semibold text-ink">{s.title}</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-graphite">{s.body}</p>
            </li>
          ))}
        </ol>
        <Button variant="primary" size="xl" className="mt-8" icon={<Play className="size-4" strokeWidth={1.75} />} onClick={onStart} trailing={<ArrowRight className="size-[18px]" strokeWidth={1.75} />}>
          Start the design
        </Button>
      </div>
    </div>
  );
}

export { FixLoop };
