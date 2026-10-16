/**
 * Revisions (DESIGN.md "Revisions"): a live activity feed in plain words while Naqsha revises; what changed, with
 * before and after; each comment as a thread ending in Naqsha's answer (Done, Alternative offered, or Not possible
 * with the reason); and a rail of versions with clean copy.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight } from "lucide-react";
import type { Change, Comment, Project, Version } from "@contracts/api-types";
import type { BuildingPlan } from "@contracts/plan";
import { api, assetUrl } from "@/api/client";
import { cn, feetInches, num, relativeTime } from "@/app/lib/utils";
import { useAskContext } from "@/app/shell/ask";
import { flow, useFlow, type Activity, type Run } from "@/app/design/flow";
import { BreathingDot, Button, EASE_OUT, useMediaQuery } from "@/app/design/kit";
import { useViewNav } from "@/app/design/nav";
import { useNow } from "@/app/design/RunProgress";
import { plural, roomName, sectionPhrase, versionLine } from "@/app/design/words";
import { anchorLabel } from "@/app/explore/snapshot";
import { summarize } from "@/app/plan/compliance";
import { area, hueColor } from "@/app/plan/model";
import { NaqshaMark } from "@/app/setup/Conversation";
import { PlanCompare } from "./PlanCompare";

export function RevisionsView({ project, onProjectChange }: { project: Project; onProjectChange(p: Project): void }) {
  const goTo = useViewNav();
  const [params, setParams] = useSearchParams();
  const wide = useMediaQuery("(min-width: 1280px)");
  const run = useFlow((s) => (s.revise?.pid === project.id ? s.revise : null));
  const running = run?.status === "running";

  const ordered = useMemo(() => [...project.versions].sort((a, b) => b.n - a.n), [project.versions]);
  const picked = params.get("v");
  const vid = picked ?? project.current_version_id;
  const version = useFlow((s) => (vid ? s.versions[vid] : undefined));
  const parent = useFlow((s) => (version?.parent_id ? s.versions[version.parent_id] : undefined));
  useEffect(() => {
    if (vid) void flow.loadVersion(project.id, vid);
  }, [project.id, vid]);
  useEffect(() => {
    if (version?.parent_id) void flow.loadVersion(project.id, version.parent_id);
  }, [project.id, version?.parent_id]);
  useEffect(() => {
    void flow.resume(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // The live run takes the stage while it runs, and stays for the version it made until someone picks another.
  const showRun = !!run && (running || run.status === "error" || (!picked && run.version?.id === project.current_version_id));
  const base = useFlow((s) => (run?.baseVersionId ? s.versions[run.baseVersionId] : undefined));

  const latest = project.current_version_id;
  useAskContext(
    latest
      ? {
          placeholder: "Tell Naqsha what to change…",
          busy: running,
          onSubmit: (text) => flow.revise(project.id, { version_id: latest, instruction: text }),
        }
      : null,
  );

  const pick = (id: string) => setParams((p) => { const n = new URLSearchParams(p); if (id === latest) n.delete("v"); else n.set("v", id); return n; });

  if (!project.versions.length && !run) {
    return (
      <div className="grid h-full place-items-center bg-canvas px-6">
        <div className="max-w-md text-center">
          <h1 className="text-title text-ink">Nothing revised yet</h1>
          <p className="mt-2 text-body-lg text-ink-2">Once the house is built, walk it, pin what you'd change, and Naqsha will make the next version and explain every change here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full overflow-hidden bg-canvas">
      <div className="absolute inset-0 overflow-y-auto [scrollbar-width:thin]">
        <div className="mx-auto grid max-w-[1400px] gap-8 px-4 pb-40 pt-[var(--chrome-top)] sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_minmax(360px,440px)]">
          <VersionRail versions={ordered} current={showRun ? null : vid} latest={latest} running={running} nextN={(ordered[0]?.n ?? 0) + 1} onPick={pick} />

          <main className="min-w-0">
            {showRun && run ? (
              <LiveRevision run={run} base={base} onWalk={() => goTo("house")} onPlan={() => goTo("plan")} />
            ) : version ? (
              <VersionStory project={project} version={version} parent={parent} onWalk={() => goTo("house", version.id === latest ? undefined : { search: `v=${version.id}` })} onPlan={() => goTo("plan", version.id === latest ? undefined : { search: `v=${version.id}` })} />
            ) : (
              <p className="text-[15px] text-ink-3">Opening the version…</p>
            )}
          </main>

          {wide && (
            <aside className="hidden xl:sticky xl:top-[72px] xl:block xl:h-[calc(100dvh-200px)] xl:self-start">
              {(() => {
                const revised = showRun ? run?.version?.plan ?? run?.plan : version?.plan;
                // While a revision hasn't touched the plan yet, show the plan it starts from.
                const after = revised ?? (showRun ? base?.plan : undefined);
                const before = showRun ? (revised ? base?.plan : undefined) : parent?.plan;
                const changes = showRun ? run?.version?.changes ?? run?.changes ?? [] : version?.changes ?? [];
                const changed = changes.filter((c) => c.kind === "plan").flatMap((c) => c.targets);
                const caption = !before ? (showRun ? "The plan as it stands; changes appear here as Naqsha makes them." : "The first design: nothing to compare yet.") : undefined;
                return after ? <PlanCompare before={before} after={after} changed={changed} caption={caption} className="h-full" /> : <div className="h-full rounded-card bg-surface-2" />;
              })()}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Version rail ────────────────────────────────────────────────────────────────────────────────────

function VersionRail({ versions, current, latest, running, nextN, onPick }: { versions: Project["versions"]; current: string | null; latest: string | null; running: boolean; nextN: number; onPick: (id: string) => void }) {
  return (
    <nav aria-label="Versions" className="lg:sticky lg:top-[72px] lg:self-start">
      <p className="text-label text-ink-3">Versions</p>
      <ol className="mt-2 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {running && (
          <li className="shrink-0">
            <div className="flex min-w-[160px] items-center gap-2 rounded-control bg-accent-soft px-3 py-2.5 text-[13.5px] text-accent">
              <BreathingDot /> Version {nextN} · in progress
            </div>
          </li>
        )}
        {versions.map((v) => {
          const active = v.id === current;
          return (
            <li key={v.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(v.id)}
                aria-current={active ? "true" : undefined}
                className={cn("w-full min-w-[160px] rounded-control px-3 py-2.5 text-left outline-none transition-colors focus-visible:shadow-focus", active ? "bg-surface shadow-e1" : "hover:bg-surface-2")}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-medium text-ink">Version {v.n}</span>
                  {v.id === latest && <span className="text-[12px] font-medium text-accent">Latest</span>}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-ink-2">{v.n === 1 ? "The first design" : versionLine(v.summary)}</span>
                <span className="mt-0.5 block text-[12px] text-ink-3">{relativeTime(v.created_at)}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── A revision as it happens ────────────────────────────────────────────────────────────────────────

function clock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function LiveRevision({ run, base, onWalk, onPlan }: { run: Run; base?: Version; onWalk: () => void; onPlan: () => void }) {
  const running = run.status === "running";
  const now = useNow(running);
  const asked = run.instruction ? `“${run.instruction}”` : run.commentIds?.length ? plural(run.commentIds.length, "comment") : "your changes";
  const plan = run.version?.plan ?? run.plan ?? base?.plan;
  return (
    <div>
      <p className="text-label text-ink-3">{running ? `Revising version ${base?.n ?? ""}` : run.version ? `Version ${run.version.n}` : "Revision"}</p>
      <h1 className="mt-1 text-title text-ink">
        {running ? <>Working on {asked}</> : run.version ? `Version ${run.version.n} is ready` : "The revision stopped"}
      </h1>
      {!running && run.version && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button variant="primary" iconRight={<ArrowRight className="size-4" strokeWidth={1.75} />} onClick={onWalk}>
            Walk through it
          </Button>
          <Button variant="secondary" onClick={onPlan}>
            Open the plan
          </Button>
        </div>
      )}
      {!running && run.version && <ComplianceLine version={run.version} />}

      <section className="mt-6 rounded-card bg-surface p-5 shadow-e1" aria-live="polite">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold text-ink">What Naqsha is doing</h2>
          {running && !run.resumed && <span className="font-mono text-[12px] tabular-nums text-ink-3">{clock(now - run.startedAt)}</span>}
        </div>
        <ActivityFeed items={run.activity} running={running} startedAt={run.resumed ? undefined : run.startedAt} />
      </section>

      {(run.version?.changes ?? run.changes)?.length ? <Changes changes={(run.version?.changes ?? run.changes)!} before={base?.plan} after={plan} /> : null}
      {run.resolved.length > 0 && <Threads comments={run.resolved} plan={base?.plan} latestVersion={run.version?.id} />}
    </div>
  );
}

function ActivityFeed({ items, running, startedAt }: { items: Activity[]; running: boolean; startedAt?: number }) {
  return (
    <ol className="mt-3 space-y-0.5">
      <AnimatePresence initial={false}>
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <motion.li key={it.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: EASE_OUT }} className="flex items-start gap-3 py-1">
              <span className="mt-[7px] grid size-2 shrink-0 place-items-center">
                {running && last ? (
                  <BreathingDot />
                ) : (
                  <span className={cn("size-1.5 rounded-full", it.tone === "pass" ? "bg-pass" : it.tone === "warn" ? "bg-warn" : it.tone === "fail" ? "bg-fail" : "bg-ink-4")} />
                )}
              </span>
              <span className={cn("min-w-0 flex-1 text-[14px] leading-relaxed", running && last ? "text-ink" : "text-ink-2", it.tone === "fail" && "text-fail")}>{it.text}</span>
              {startedAt && <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-ink-4">{clock(it.at - startedAt)}</span>}
            </motion.li>
          );
        })}
      </AnimatePresence>
      {running && !items.length && (
        <li className="flex items-center gap-3 py-1 text-[14px] text-ink-2">
          <BreathingDot /> Reading your changes
        </li>
      )}
    </ol>
  );
}

function ComplianceLine({ version }: { version: Version }) {
  const s = summarize(version.compliance, version.plan);
  return (
    <p className={cn("mt-3 flex items-start gap-2 text-[13.5px]", s.fails.length ? "text-fail" : "text-ink-2")}>
      <span className={cn("mt-[7px] size-1.5 shrink-0 rounded-full", s.fails.length ? "bg-fail" : "bg-pass")} />
      {s.fails.length ? `${plural(s.fails.length, "rule")} to fix` : `All ${s.lda.length} LDA checks and ${s.livable.length} livable rules pass`}
    </p>
  );
}

// ── A finished version ──────────────────────────────────────────────────────────────────────────────

function VersionStory({ project, version, parent, onWalk, onPlan }: { project: Project; version: Version; parent?: Version; onWalk: () => void; onPlan: () => void }) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  useEffect(() => {
    let alive = true;
    setComments(null);
    if (!version.parent_id) {
      setComments([]);
      return;
    }
    api
      .listComments(project.id, version.parent_id)
      .then((list) => alive && setComments(list.filter((c) => c.resolved_in_version === version.id || (c.status !== "open" && !c.resolved_in_version))))
      .catch(() => alive && setComments([]));
    return () => {
      alive = false;
    };
  }, [project.id, version.id, version.parent_id]);
  const changes = version.changes ?? [];
  const summary = project.versions.find((v) => v.id === version.id)?.summary;
  const first = !version.parent_id;
  return (
    <div>
      <p className="text-label text-ink-3">
        Version {version.n} · {relativeTime(version.created_at)}
      </p>
      <h1 className="mt-1 text-title text-ink">{first ? "The first design" : versionLine(summary)}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="primary" iconRight={<ArrowRight className="size-4" strokeWidth={1.75} />} onClick={onWalk}>
          Walk through it
        </Button>
        <Button variant="secondary" onClick={onPlan}>
          Open the plan
        </Button>
      </div>
      <ComplianceLine version={version} />
      {first ? (
        <p className="mt-8 max-w-xl text-body-lg text-ink-2">
          Drawn from your brief and chosen concept. Walk through it and pin what you'd change; Naqsha will make version {version.n + 1} and explain each change here.
        </p>
      ) : (
        <>
          {changes.length ? (
            <Changes changes={changes} before={parent?.plan} after={version.plan} />
          ) : (
            <p className="mt-8 max-w-xl text-body-lg text-ink-2">
              {versionLine(summary) === "A fresh design"
                ? `Drawn again from your brief and concept. Version ${parent?.n ?? version.n - 1} stays in your history; compare them on the plan.`
                : comments?.length
                  ? "Naqsha looked at every comment and didn't need to change the plan; each answer is below."
                  : "Nothing in the plan needed to change for this one."}
            </p>
          )}
          {comments === null ? <p className="mt-8 text-[14px] text-ink-3">Loading the comments…</p> : comments.length ? <Threads comments={comments} plan={parent?.plan} latestVersion={project.current_version_id ?? undefined} /> : null}
        </>
      )}
    </div>
  );
}

// ── What changed ────────────────────────────────────────────────────────────────────────────────────

function Changes({ changes, before, after }: { changes: Change[]; before?: BuildingPlan; after?: BuildingPlan }) {
  return (
    <section className="mt-8">
      <h2 className="text-heading text-ink">What changed</h2>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-card bg-surface shadow-e1">
        {changes.map((c) => (
          <motion.li key={c.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: EASE_OUT }} className="px-5 py-4">
            <p className="text-body text-ink">{plainSummary(c.summary, after)}</p>
            {c.kind === "plan" ? (
              <BeforeAfter targets={c.targets} before={before} after={after} />
            ) : (
              <p className="mt-1 text-[13px] text-ink-3">{c.targets.map((t) => sectionPhrase(t, after)).join(", ").replace(/^\w/, (x) => x.toUpperCase())} redrawn in 3D</p>
            )}
            {c.comment_ids.length > 0 && <p className="mt-1 text-[12.5px] text-ink-3">From {plural(c.comment_ids.length, "comment")}</p>}
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

/** Summaries come from the reviser; make sure no id or section name slips through. */
function plainSummary(s: string, plan?: BuildingPlan): string {
  return s.replace(/\b([bgfstr]_[a-z0-9_]+|furnish_[a-z0-9_]+|facade_[a-z0-9_]+|interior_[a-z0-9_]+)\b/g, (id) => (id.includes("_") && /^[bgfstr]_/.test(id) ? roomName(plan, id) : sectionPhrase(id, plan).replace(/^the /, "")));
}

function BeforeAfter({ targets, before, after }: { targets: string[]; before?: BuildingPlan; after?: BuildingPlan }) {
  if (!before || !after) return null;
  const rows = targets
    .map((id) => {
      const a = after?.rooms.find((r) => r.id === id);
      const b = before?.rooms.find((r) => r.id === id);
      const o = after?.openings.find((x) => x.id === id);
      const ob = before?.openings.find((x) => x.id === id);
      if (a) return { id, name: a.name, before: b ? `${feetInches(b.rect.w)} × ${feetInches(b.rect.d)}` : "New", after: `${feetInches(a.rect.w)} × ${feetInches(a.rect.d)}`, delta: b ? Math.round(area(a) - area(b)) : null };
      if (o) return { id, name: o.type.includes("door") ? "Door" : "Window", before: ob ? `${feetInches(ob.width_ft)} wide` : "New", after: `${feetInches(o.width_ft)} wide`, delta: null };
      return null;
    })
    .filter((r): r is NonNullable<typeof r> => !!r && r.before !== r.after);
  if (!rows.length) return null;
  return (
    <ul className="mt-2 space-y-1">
      {rows.map((r) => (
        <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
          <span className="text-ink-2">{r.name}</span>
          <span className="font-mono tabular-nums text-ink-3">{r.before}</span>
          <ArrowRight className="size-3 self-center text-ink-4" strokeWidth={2} />
          <span className="font-mono tabular-nums text-ink">{r.after}</span>
          {r.delta ? <span className={cn("font-mono tabular-nums font-semibold", r.delta > 0 ? "text-accent" : "text-ink-2")}>{r.delta > 0 ? "+" : "−"}{num(Math.abs(r.delta))} sq ft</span> : null}
        </li>
      ))}
    </ul>
  );
}

// ── Comment threads ─────────────────────────────────────────────────────────────────────────────────

const OUTCOME: Record<Comment["status"], { label: string; tone: string }> = {
  open: { label: "Open", tone: "text-ink-3 bg-surface-2" },
  resolved: { label: "Done", tone: "text-pass bg-pass-soft" },
  partial: { label: "Alternative offered", tone: "text-warn bg-warn-soft" },
  rejected: { label: "Not possible", tone: "text-fail bg-fail-soft" },
};

function initials(name?: string) {
  if (!name) return "Y";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Threads({ comments, plan, latestVersion }: { comments: Comment[]; plan?: BuildingPlan; latestVersion?: string }) {
  const ordered = [...comments].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <section className="mt-8">
      <h2 className="text-heading text-ink">Your comments</h2>
      <ul className="mt-3 space-y-3">
        {ordered.map((c, i) => (
          <Thread key={c.id} c={c} n={i + 1} plan={plan} latestVersion={latestVersion} />
        ))}
      </ul>
    </section>
  );
}

function Thread({ c, n, plan, latestVersion }: { c: Comment; n: number; plan?: BuildingPlan; latestVersion?: string }) {
  const project = useFlow((s) => s.pid);
  const outcome = OUTCOME[c.status];
  const replies = (c.replies ?? []).filter((r) => !(r.author.role === "agent" && r.text.trim() === (c.resolution ?? "").trim()));
  const useAlternative = () => {
    if (!project || !latestVersion) return;
    void flow.revise(project, { version_id: latestVersion, instruction: `Go ahead with the alternative you offered for “${c.text}”: ${c.resolution ?? ""}`.trim() });
  };
  return (
    <motion.li initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: EASE_OUT }} className="overflow-hidden rounded-card bg-surface shadow-e1">
      <div className="flex gap-3 p-4">
        {c.snapshot_url ? <img src={assetUrl(c.snapshot_url)} alt="" className="h-16 w-24 shrink-0 rounded-control object-cover" /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white" style={{ background: hueColor(c) }} aria-hidden>
              {c.author ? initials(c.author.name) : n}
            </span>
            <span className="truncate text-[13px] text-ink-2">
              {c.author?.name ?? "You"}
              {c.author?.role === "client" ? " · Client" : ""} · {relativeTime(c.created_at)}
            </span>
          </div>
          <p className="mt-1.5 text-body text-ink">{c.text}</p>
          <p className="mt-0.5 text-[12.5px] text-ink-3">{anchorLabel(c.anchor, plan)}</p>
        </div>
      </div>
      {replies.map((r) => (
        <div key={r.id} className="flex gap-3 border-t border-line px-4 py-3">
          {r.author.role === "agent" ? (
            <NaqshaMark />
          ) : (
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-3 text-[11px] font-semibold text-white">{initials(r.author.name)}</span>
          )}
          <div className="min-w-0">
            <p className="text-[12.5px] text-ink-3">
              {r.author.role === "agent" ? "Naqsha" : r.author.name} · {relativeTime(r.created_at)}
            </p>
            <p className="mt-0.5 text-body text-ink">{r.text}</p>
          </div>
        </div>
      ))}
      {c.status !== "open" && (
        <div className="flex gap-3 border-t border-line bg-surface-2/50 px-4 py-3">
          <NaqshaMark />
          <div className="min-w-0 flex-1">
            <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium", outcome.tone)}>{outcome.label}</span>
            {c.resolution && <p className={cn("mt-1.5 text-body", c.status === "rejected" ? "text-ink-2" : "text-ink")}>{c.resolution}</p>}
            {c.status === "partial" && latestVersion && (
              <Button variant="secondary" size="sm" className="mt-2.5" onClick={useAlternative}>
                Use the alternative
              </Button>
            )}
          </div>
        </div>
      )}
    </motion.li>
  );
}
