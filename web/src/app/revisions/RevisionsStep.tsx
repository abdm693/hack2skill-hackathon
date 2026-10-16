import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bot, ChevronDown, CircleAlert, Footprints, GitCompareArrows, ShieldCheck } from "lucide-react";
import type { Change, Comment, DesignSection, Version } from "@contracts/api-types";
import type { BuildingPlan, ComplianceReport } from "@contracts/plan";
import { api, assetUrl } from "@/api/client";
import { cn, relativeTime } from "@/app/lib/utils";
import { useProject, type FeedItem, type Run } from "@/app/store/project";
import { FloorPlan } from "@/app/plan/FloorPlan";
import { CodeBlock } from "@/app/design/CodeBlock";
import { LAYER_ICON } from "@/app/design/Timeline";
import { STATUS_LABEL, STATUS_TONE } from "@/app/explore/CommentsDrawer";
import { anchorLabel } from "@/app/explore/snapshot";
import { Button } from "@/app/ui/Button";
import { Pill, Segmented, Spinner } from "@/app/ui/primitives";

export function RevisionsStep() {
  const navigate = useNavigate();
  const project = useProject((s) => s.project)!;
  const run = useProject((s) => s.revise);
  const versions = useProject((s) => s.versions);
  const loadVersion = useProject((s) => s.loadVersion);
  const [selectedVid, setSelectedVid] = useState<string | null>(null);

  const ordered = useMemo(() => [...project.versions].sort((a, b) => b.n - a.n), [project.versions]);
  const running = run.status === "running";
  const latestVid = project.current_version_id;
  const vid = running ? null : selectedVid ?? run.version?.id ?? latestVid;

  useEffect(() => {
    if (vid) void loadVersion(vid);
  }, [vid, loadVersion]);
  const version = vid ? (versions[vid] as Version | undefined) : undefined;
  useEffect(() => {
    if (version?.parent_id) void loadVersion(version.parent_id);
    if (run.baseVersionId) void loadVersion(run.baseVersionId);
  }, [version?.parent_id, run.baseVersionId, loadVersion]);

  const hasRevisions = project.versions.length > 1 || running || run.items.length > 0;

  return (
    <div className="flex h-full">
      {/* Version rail */}
      <aside className="scrollbar-thin hidden w-[270px] shrink-0 overflow-y-auto border-r border-line px-4 py-6 md:block">
        <p className="font-display-text text-[18px] font-medium text-ink">Versions</p>
        <ol className="mt-3 space-y-1.5">
          {running && (
            <li className="flex items-center gap-2.5 rounded-2xl bg-brick-soft px-3 py-2.5 text-[13px] font-medium text-brick-deep">
              <Spinner className="size-3.5" /> v{project.versions.length + 1} in progress
            </li>
          )}
          {ordered.map((v) => {
            const active = !running && v.id === vid;
            return (
              <li key={v.id}>
                <button
                  onClick={() => setSelectedVid(v.id)}
                  className={cn("w-full rounded-2xl px-3 py-2.5 text-left transition-colors", active ? "bg-ink text-sheet" : "hover:bg-wash")}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-display-text text-[16px] font-medium">Version {v.n}</span>
                    <span className={cn("text-[11.5px]", active ? "text-sheet/60" : "text-pencil")}>{relativeTime(v.created_at)}</span>
                  </span>
                  {v.summary && <span className={cn("mt-0.5 line-clamp-2 block text-[12px] leading-snug", active ? "text-sheet/75" : "text-graphite")}>{v.summary}</span>}
                  {v.id === latestVid && <span className={cn("mt-1 inline-block text-[11px] font-medium", active ? "text-[#f3b9a8]" : "text-brick")}>Latest</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      <div className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
        {!hasRevisions ? (
          <NoRevisionsYet onWalk={() => navigate("../explore")} />
        ) : running || (run.items.length > 0 && run.version?.id === vid) || (run.status === "error" && !selectedVid) ? (
          <LiveRevision run={run} base={run.baseVersionId ? versions[run.baseVersionId] : undefined} onExplore={() => navigate("../explore")} />
        ) : version ? (
          <VersionChanges version={version} parent={version.parent_id ? versions[version.parent_id] : undefined} onExplore={() => navigate(version.id === latestVid ? "../explore" : `../explore?v=${version.id}`)} />
        ) : (
          <div className="grid h-full place-items-center">
            <Spinner className="text-brick" />
          </div>
        )}
      </div>
    </div>
  );
}

function NoRevisionsYet({ onWalk }: { onWalk: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="font-display-tight text-[40px] font-medium leading-tight text-ink">Walk it, mark it up, get version 2</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-graphite">
        Pin comments anywhere in the 3D house: “make this bigger”, “more light here”, “move the kitchen door”. When you finish the walkthrough, Argon turns
        them into a change list, edits the plan and the code, re-checks LDA rules and explains anything it couldn't do.
      </p>
      <Button variant="primary" size="xl" className="mt-7" icon={<Footprints className="size-4" strokeWidth={1.75} />} onClick={onWalk} trailing={<ArrowRight className="size-[18px]" strokeWidth={1.75} />}>
        Explore and walk
      </Button>
    </div>
  );
}

/** Highlight ids in agent messages ("Looking at f_bed2…") and name them from the plan. */
function AgentText({ text, plan }: { text: string; plan?: BuildingPlan }) {
  const parts = text.split(/(\b[a-z]+(?:_[a-z0-9]+)+\b)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return <span key={i}>{p}</span>;
        const room = plan?.rooms.find((r) => r.id === p);
        return (
          <span key={i} className="whitespace-nowrap">
            {room && <span className="font-medium text-ink">{room.name} </span>}
            <code className="rounded bg-wash px-1 py-0.5 font-mono text-[11.5px] text-ink-2">{p}</code>
          </span>
        );
      })}
    </>
  );
}

function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function LiveRevision({ run, base, onExplore }: { run: Run; base?: Version; onExplore: () => void }) {
  const running = run.status === "running";
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  const activity = run.items.filter((i) => i.kind === "stage" || i.kind === "plan" || i.kind === "compliance" || i.kind === "section" || i.kind === "error");
  const changes = run.changes ?? [];
  const resolutions = run.items.filter((i): i is Extract<FeedItem, { kind: "comment" }> => i.kind === "comment").map((i) => i.comment);
  const changedRooms = changes.filter((c) => c.kind === "plan").flatMap((c) => c.targets);
  const newPlan = run.version?.plan ?? run.plan;
  const lastIdx = activity.length - 1;
  const done = !running && !!run.version;
  const [showAll, setShowAll] = useState(false);
  const visible = done && !showAll ? activity.slice(-4) : activity;
  const offset = activity.length - visible.length;

  const outcome = (
    <>
      {run.version && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6 flex flex-wrap items-center gap-3 rounded-[22px] bg-pass-soft px-5 py-4">
          <ShieldCheck className="size-5 text-pass" strokeWidth={1.75} />
          <p className="flex-1 text-[14px] text-ink">
            <span className="font-semibold">Version {run.version.n}</span> saved. {complianceLine(run.version.compliance)}
          </p>
          <Button variant="primary" onClick={onExplore} trailing={<ArrowRight className="size-4" strokeWidth={1.75} />}>
            Explore v{run.version.n} in 3D
          </Button>
        </motion.div>
      )}
      {changes.length > 0 && <ChangesList changes={changes} plan={newPlan} sections={run.version?.sections ?? run.sections} />}
      {resolutions.length > 0 && <Resolutions comments={resolutions} plan={base?.plan} />}
    </>
  );

  return (
    <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display-tight text-[34px] font-medium leading-tight text-ink">
              {running ? `Revising version ${base?.n ?? ""}` : run.version ? `Version ${run.version.n} is ready` : "Revision"}
            </h1>
            <p className="mt-1 text-[14px] text-graphite">
              {running ? "Argon is reading your walkthrough comments and editing the plan and the code." : run.status === "error" ? run.error : "Here's what changed and how each comment was handled."}
            </p>
          </div>
          {running && run.startedAt && (
            <span className="flex items-center gap-2 rounded-full bg-plaster px-3.5 py-1.5 text-[12.5px] text-graphite ring-1 ring-line">
              <Spinner className="size-3.5 text-brick" /> {run.resumed ? "Reconnected" : clock(now - run.startedAt)}
            </span>
          )}
        </div>

        {done && outcome}

        {/* Agent activity */}
        <section className={cn("overflow-hidden rounded-[22px] bg-ink text-sheet", done ? "mt-8" : "mt-6")}>
          <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
            <Bot className="size-4 text-[#e7a58f]" strokeWidth={1.75} />
            <span className="text-[13px] font-medium">{done ? "How Argon worked" : "Agent activity"}</span>
            <span className="text-[12px] text-sheet/45">{activity.length} steps</span>
            {done && activity.length > 4 && (
              <button onClick={() => setShowAll((s) => !s)} className="ml-auto flex items-center gap-1 text-[12px] font-medium text-[#f3b9a8] hover:underline">
                {showAll ? "Show less" : `Show all ${activity.length}`}
                <ChevronDown className={cn("size-3.5 transition-transform", showAll && "rotate-180")} />
              </button>
            )}
          </div>
          <ol className="space-y-0.5 px-3 py-3">
            <AnimatePresence initial={false}>
              {visible.map((it, vi) => {
                const idx = vi + offset;
                return (
                <motion.li
                  key={it.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start gap-3 rounded-xl px-2 py-1.5 text-[13px]"
                >
                  <span className="mt-[3px] grid size-4 shrink-0 place-items-center">
                    {running && idx === lastIdx && it.kind === "stage" ? (
                      <Spinner className="size-3.5 text-[#e7a58f]" />
                    ) : it.kind === "error" ? (
                      <CircleAlert className="size-3.5 text-[#f19a8c]" />
                    ) : (
                      <span className="size-1.5 rounded-full bg-sheet/40" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 leading-relaxed text-sheet/85 [&_code]:bg-white/10 [&_code]:text-sheet [&_span.font-medium]:text-sheet">
                    <ActivityLine it={it} plan={base?.plan} />
                  </span>
                  {!run.resumed && run.startedAt && <span className="shrink-0 text-[11px] tabular text-sheet/35">{clock(it.at - run.startedAt)}</span>}
                </motion.li>
                );
              })}
            </AnimatePresence>
            {running && !activity.length && (
              <li className="flex items-center gap-3 px-2 py-1.5 text-[13px] text-sheet/70">
                <Spinner className="size-3.5 text-[#e7a58f]" /> Starting the reviser…
              </li>
            )}
          </ol>
        </section>

        {!done && outcome}
      </div>

      <PlanCompare before={base?.plan} after={newPlan} changed={changedRooms} />
    </div>
  );
}

function complianceLine(r: ComplianceReport) {
  const fails = r.checks.filter((c) => c.status === "fail").length;
  const passes = r.checks.filter((c) => c.status === "pass").length;
  return fails ? `${fails} LDA check${fails === 1 ? "" : "s"} need attention.` : `All ${passes} LDA checks still pass.`;
}

function ActivityLine({ it, plan }: { it: FeedItem; plan?: BuildingPlan }) {
  switch (it.kind) {
    case "stage":
      return <AgentText text={it.message} plan={plan} />;
    case "plan":
      return <span>Patched the plan.</span>;
    case "compliance": {
      const fails = it.report.checks.filter((c) => c.status === "fail").length;
      return <span>{fails ? `LDA re-check: ${fails} issue${fails === 1 ? "" : "s"}.` : `LDA re-check: all ${it.report.checks.length} rules pass.`}</span>;
    }
    case "section":
      return (
        <span>
          Rewrote <code className="rounded px-1 py-0.5 font-mono text-[11.5px]">{it.section.name}</code>
        </span>
      );
    case "error":
      return <span className="text-[#f6b8ad]">{it.message}</span>;
    default:
      return null;
  }
}

function ChangesList({ changes, plan, sections }: { changes: Change[]; plan?: BuildingPlan; sections?: DesignSection[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="mt-8">
      <h2 className="font-display-text text-[22px] font-medium text-ink">What changed</h2>
      <ul className="mt-3 space-y-2.5">
        {changes.map((c) => {
          const sec = c.kind === "section" ? sections?.find((s) => c.targets.includes(s.name)) : undefined;
          const Icon = sec ? LAYER_ICON[sec.layer] : null;
          return (
            <motion.li key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl bg-plaster p-4 ring-1 ring-line">
              <div className="flex items-start gap-3">
                <Pill tone={c.kind === "plan" ? "accent" : "neutral"} dot={false} className="mt-0.5">
                  {c.kind === "plan" ? "Plan" : "Code"}
                </Pill>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium leading-snug text-ink">{c.summary}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.targets.map((t) => {
                      const room = plan?.rooms.find((r) => r.id === t);
                      return (
                        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-wash px-2 py-0.5 text-[11.5px] text-ink-2">
                          {Icon && <Icon className="size-3" strokeWidth={1.75} />}
                          {room ? room.name : <code className="font-mono">{t}</code>}
                        </span>
                      );
                    })}
                    {c.comment_ids.length > 0 && <span className="text-[11.5px] text-pencil">from {c.comment_ids.length} comment{c.comment_ids.length === 1 ? "" : "s"}</span>}
                  </div>
                </div>
                {sec && (
                  <button onClick={() => setOpen(open === c.id ? null : c.id)} className="flex items-center gap-1 text-[12px] font-medium text-graphite hover:text-ink">
                    Code <ChevronDown className={cn("size-3.5 transition-transform", open === c.id && "rotate-180")} />
                  </button>
                )}
              </div>
              {sec && open === c.id && <CodeBlock code={sec.code} className="mt-3" maxHeight={300} />}
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}

function Resolutions({ comments, plan }: { comments: Comment[]; plan?: BuildingPlan }) {
  return (
    <section className="mt-8">
      <h2 className="font-display-text text-[22px] font-medium text-ink">Your comments</h2>
      <ul className="mt-3 space-y-2.5">
        {comments.map((c) => (
          <motion.li key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-2xl bg-plaster ring-1 ring-line">
            <div className="flex gap-3 p-3.5">
              <span className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-wash">
                {c.snapshot_url && <img src={assetUrl(c.snapshot_url)} alt="" className="h-full w-full object-cover" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11.5px] text-pencil">{anchorLabel(c.anchor, plan)}</p>
                <p className="mt-0.5 text-[14px] leading-snug text-ink">“{c.text}”</p>
                <Pill tone={STATUS_TONE[c.status]} className="mt-2">
                  {STATUS_LABEL[c.status]}
                </Pill>
              </div>
            </div>
            {c.resolution && (
              <p
                className={cn(
                  "border-t px-4 py-3 text-[13px] leading-relaxed",
                  c.status === "rejected" ? "border-fail/15 bg-fail-soft/50 text-ink-2" : c.status === "partial" ? "border-warn/15 bg-warn-soft/50 text-ink-2" : "border-line text-graphite",
                )}
              >
                {c.resolution}
              </p>
            )}
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

function PlanCompare({ before, after, changed }: { before?: BuildingPlan; after?: BuildingPlan; changed: string[] }) {
  const [side, setSide] = useState<"before" | "after">("after");
  const [level, setLevel] = useState<string | undefined>(undefined);
  const plan = side === "before" ? before ?? after : after ?? before;
  // Open on the level with the first changed room.
  useEffect(() => {
    const r = after?.rooms.find((x) => changed.includes(x.id));
    if (r) setLevel(r.level);
  }, [after, changed.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!plan) {
    return (
      <div className="hidden min-h-[400px] place-items-center rounded-[22px] bg-plaster ring-1 ring-line xl:grid">
        <Spinner className="text-brick" />
      </div>
    );
  }
  return (
    <div className="xl:sticky xl:top-6 xl:self-start">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-display-text text-[18px] font-medium text-ink">
          <GitCompareArrows className="size-4 text-brick" strokeWidth={1.75} /> Plan
        </p>
        {before && after && (
          <Segmented
            layoutId="plan-compare"
            size="sm"
            value={side}
            onChange={setSide}
            options={[
              { value: "before", label: "Before" },
              { value: "after", label: "After" },
            ]}
          />
        )}
      </div>
      <div className="bg-drafting mt-3 h-[640px] rounded-[22px] p-3 ring-1 ring-line">
        <FloorPlan plan={plan} level={level} onLevelChange={setLevel} changed={side === "after" ? changed : undefined} highlight={side === "before" ? changed : undefined} highlightTone="warn" titleBlock={false} />
      </div>
      {changed.length > 0 && <p className="mt-2 text-[12px] text-pencil">Dashed outlines mark the rooms that changed.</p>}
    </div>
  );
}

function VersionChanges({ version, parent, onExplore }: { version: Version; parent?: Version; onExplore: () => void }) {
  const project = useProject((s) => s.project)!;
  const [comments, setComments] = useState<Comment[] | null>(null);
  useEffect(() => {
    let alive = true;
    if (!parent) { setComments([]); return; }
    api
      .listComments(project.id, parent.id)
      .then((list) => alive && setComments(list.filter((c) => c.resolved_in_version === version.id || c.status !== "open")))
      .catch(() => alive && setComments([]));
    return () => { alive = false; };
  }, [project.id, parent, version.id]);

  const changes = version.changes ?? [];
  const changedRooms = changes.filter((c) => c.kind === "plan").flatMap((c) => c.targets);
  const isFirst = !version.parent_id;

  return (
    <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-8 sm:px-8 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="min-w-0">
        <h1 className="font-display-tight text-[34px] font-medium leading-tight text-ink">Version {version.n}</h1>
        <p className="mt-1 text-[14px] text-graphite">
          {isFirst ? "The first design from your brief." : `Revised from version ${parent?.n ?? ""}, ${relativeTime(version.created_at)}.`} {complianceLine(version.compliance)}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" onClick={onExplore} trailing={<ArrowRight className="size-4" strokeWidth={1.75} />}>
            Explore v{version.n} in 3D
          </Button>
        </div>

        {isFirst ? (
          <div className="mt-8 rounded-[22px] border border-dashed border-line-strong px-5 py-6">
            <p className="text-[14px] font-medium text-ink">No changes yet</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-graphite">
              Walk through version {version.n}, pin comments, then finish the walkthrough. Argon will produce version {version.n + 1} and explain every change here.
            </p>
          </div>
        ) : (
          <>
            {changes.length > 0 ? <ChangesList changes={changes} plan={version.plan} sections={version.sections} /> : <p className="mt-8 text-[14px] text-graphite">No changes were recorded for this version.</p>}
            {comments === null ? (
              <div className="mt-8 flex items-center gap-2 text-[13px] text-graphite">
                <Spinner className="text-brick" /> Loading comments…
              </div>
            ) : comments.length > 0 ? (
              <Resolutions comments={comments} plan={parent?.plan} />
            ) : null}
          </>
        )}
      </div>
      <PlanCompare before={parent?.plan} after={version.plan} changed={changedRooms} />
    </div>
  );
}

