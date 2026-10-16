import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  Armchair,
  ArrowRight,
  Braces,
  BrickWall,
  ChevronDown,
  CircleAlert,
  Columns2,
  Footprints,
  History,
  Lamp,
  Lightbulb,
  MessageSquare,
  MessageSquarePlus,
  Orbit,
  Scissors,
  ShieldCheck,
  Sparkles,
  Sun,
  Trees,
} from "lucide-react";
import type { Layer } from "@contracts/house-sdk";
import type { Comment, Version } from "@contracts/api-types";
import type { ComplianceReport } from "@contracts/plan";
import { HouseViewer, type ViewerHandle } from "@/viewer/HouseViewer";
import type { DesignSectionSrc, SectionResult } from "@/engine";
import { api, errorMessage } from "@/api/client";
import { cn, feetInches, hourLabel } from "@/app/lib/utils";
import { useProject } from "@/app/store/project";
import { toast } from "@/app/store/toast";
import { Button } from "@/app/ui/Button";
import { Menu, Spinner } from "@/app/ui/primitives";
import { CommentsDrawer } from "./CommentsDrawer";
import { Composer, type CommentDraft } from "./Composer";
import { RenderLightbox } from "./RenderLightbox";
import { frontCamera, generalAnchor, placeholderSnapshot } from "./snapshot";

const LAYERS: { id: Layer; label: string; icon: typeof BrickWall }[] = [
  { id: "structure", label: "Structure", icon: BrickWall },
  { id: "facade", label: "Facade", icon: Columns2 },
  { id: "interior", label: "Interior", icon: Lamp },
  { id: "furniture", label: "Furniture", icon: Armchair },
  { id: "landscape", label: "Landscape", icon: Trees },
  { id: "lighting", label: "Lighting", icon: Lightbulb },
];

const FT = 0.3048;

function glass(extra?: string) {
  return cn("bg-night/72 text-sheet shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6),inset_0_0_0_1px_rgb(255_255_255/0.09)] backdrop-blur-xl", extra);
}

export function ExploreStep() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const project = useProject((s) => s.project)!;
  const versions = useProject((s) => s.versions);
  const loadVersion = useProject((s) => s.loadVersion);
  const cacheVersion = useProject((s) => s.cacheVersion);
  const comments = useProject((s) => s.comments);
  const commentsFor = useProject((s) => s.commentsFor);
  const loadComments = useProject((s) => s.loadComments);
  const addComment = useProject((s) => s.addComment);
  const updateComment = useProject((s) => s.updateComment);
  const deleteComment = useProject((s) => s.deleteComment);
  const runRevise = useProject((s) => s.runRevise);
  const patchProject = useProject((s) => s.patchProject);

  const vid = params.get("v") ?? project.current_version_id ?? "";
  const [compare, setCompare] = useState<"after" | "before">("after");
  useEffect(() => {
    if (vid) void loadVersion(vid);
  }, [vid, loadVersion]);
  const version = versions[vid] as Version | undefined;
  useEffect(() => {
    if (version?.parent_id) void loadVersion(version.parent_id);
  }, [version?.parent_id, loadVersion]);
  const before = version?.parent_id ? versions[version.parent_id] : undefined;
  const shown = compare === "before" && before ? before : version;

  useEffect(() => {
    if (shown?.id && commentsFor !== shown.id) void loadComments(shown.id);
  }, [shown?.id, commentsFor, loadComments]);
  const shownComments = useMemo(() => (shown ? comments.filter((c) => c.version_id === shown.id) : []), [comments, shown]);

  // Viewer state
  const viewer = useRef<ViewerHandle>(null);
  const [mode, setMode] = useState<"orbit" | "walk">("orbit");
  const [levelChoice, setLevelChoice] = useState<string>("all");
  const [layers, setLayers] = useState<Record<Layer, boolean>>({ structure: true, facade: true, interior: true, furniture: true, landscape: true, lighting: true, custom: true });
  const [cutFt, setCutFt] = useState<number | null>(null);
  const [sun, setSun] = useState(17.5);
  const [commentMode, setCommentMode] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<CommentDraft | null>(null);
  const [build, setBuild] = useState<{ done: number; total: number; name: string } | null>(null);
  const [failed, setFailed] = useState<SectionResult[]>([]);
  const [asBuilt, setAsBuilt] = useState<ComplianceReport | null>(null);
  const [render, setRender] = useState<{ before: string; after?: string; error?: string } | null>(null);
  const [finishing, setFinishing] = useState(false);

  const plan = shown?.plan;
  const levels = useMemo(() => (plan ? [...plan.levels].sort((a, b) => a.index - b.index) : []), [plan]);
  const visibleLevels = useMemo(() => {
    if (levelChoice === "all" || !levels.length) return undefined;
    const idx = levels.findIndex((l) => l.id === levelChoice);
    return levels.slice(0, idx + 1).map((l) => l.id);
  }, [levelChoice, levels]);
  const topFt = useMemo(() => (plan ? Math.max(...plan.levels.map((l) => l.elevation_ft + l.height_ft)) + 2 : 30), [plan]);

  const sections: DesignSectionSrc[] = useMemo(
    () => (shown ? shown.sections.map((s) => ({ name: s.name, layer: s.layer, body: s.code })) : []),
    // Rebuild only when the version (or a repaired section) changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown?.id, shown?.sections],
  );

  // Esc leaves comment mode; the viewer handles Esc in walk mode itself.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && commentMode && !draft) setCommentMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commentMode, draft]);

  const capture = useCallback(
    async (width = 1280) => {
      try {
        const img = await viewer.current?.capture({ width, height: Math.round((width * 9) / 16) });
        if (img) return img;
      } catch (e) {
        console.warn("capture failed", e);
      }
      return placeholderSnapshot(plan, "3D view", width, Math.round((width * 9) / 16));
    },
    [plan],
  );

  const onReady = useCallback(
    async (result: { summary: Parameters<typeof api.asBuilt>[2]; sections: SectionResult[] }) => {
      setBuild(null);
      setFailed(result.sections.filter((s) => !s.ok));
      if (!shown) return;
      // First successful build of a version: store a real 3D thumbnail for the workspace grid.
      const key = `naqsha.thumb.${shown.id}`;
      let done = false;
      try { done = !!localStorage.getItem(key); } catch { /* ignore */ }
      if (!done && viewer.current) {
        try {
          const img = await viewer.current.capture({ width: 960, height: 540 });
          if (img) {
            const { url } = await api.saveThumbnail(project.id, shown.id, img);
            try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
            patchProject({ thumbnail_url: url });
          }
        } catch (e) {
          console.warn("thumbnail failed", e);
        }
      }
      try {
        setAsBuilt(await api.asBuilt(project.id, shown.id, result.summary));
      } catch {
        setAsBuilt(null);
      }
    },
    [shown, project.id, patchProject],
  );

  const repair = async (r: SectionResult) => {
    if (!shown) return;
    try {
      await api.repairSection(project.id, shown.id, { section: r.name, error: r.error ?? "failed to build" }, {
        section: ({ section }) => {
          const v = useProject.getState().versions[shown.id] ?? shown;
          cacheVersion({ ...v, sections: v.sections.map((s) => (s.name === section.name ? section : s)) });
        },
      });
      toast.success(`Argon rewrote ${r.name}`);
      setFailed((f) => f.filter((x) => x.name !== r.name));
    } catch (e) {
      toast.error(`Couldn't fix ${r.name}`, e);
    }
  };

  const startRender = async () => {
    const img = await capture(1280);
    setRender({ before: img });
    try {
      const { url } = await api.render(project.id, { image_data_url: img, version_id: shown?.id });
      setRender((r) => (r ? { ...r, after: url } : r));
    } catch (e) {
      setRender((r) => (r ? { ...r, error: errorMessage(e) } : r));
    }
  };

  const commentOnView = async () => {
    if (!plan) return;
    const snapshot = await capture(800);
    setDraft({ anchor: generalAnchor(plan), camera: frontCamera(plan), snapshot });
  };

  const saveDraft = async (text: string) => {
    if (!draft || !shown) return false;
    const c = await addComment({ version_id: shown.id, text, anchor: draft.anchor, camera: draft.camera, snapshot_data_url: draft.snapshot || undefined });
    if (!c) return false;
    setDraft(null);
    setDrawer(true);
    setSelected(c.id);
    toast.success("Comment pinned", "Add more, then finish the walkthrough to revise.");
    return true;
  };

  const finish = async () => {
    if (!shown) return;
    const open = shownComments.filter((c) => c.status === "open");
    if (!open.length) {
      toast.info("Pin a comment first", "Click a surface in comment mode, or press C while walking.");
      return;
    }
    setFinishing(true);
    setMode("orbit");
    void runRevise(shown.id, open.map((c) => c.id));
    navigate("../revisions");
  };

  const flyTo = (c: Comment) => {
    setSelected(c.id);
    viewer.current?.flyTo(c);
  };

  if (!version || !shown || !plan) {
    return (
      <div className="grid h-full place-items-center bg-night text-sheet/70">
        <div className="flex items-center gap-3 text-[14px]">
          <Spinner className="text-[#e7a58f]" /> Loading the version…
        </div>
      </div>
    );
  }

  const openCount = shownComments.filter((c) => c.status === "open").length;
  const isLatest = version.id === project.current_version_id && compare === "after";
  const asBuiltIssues = asBuilt?.checks.filter((c) => c.status !== "pass") ?? [];

  return (
    <div className="relative h-full overflow-hidden bg-night">
      <div className="absolute inset-0">
        <HouseViewer
          key={shown.id}
          ref={viewer}
          plan={plan}
          sections={sections}
          mode={mode}
          visibleLevels={visibleLevels}
          layers={layers}
          sectionCut={cutFt == null ? null : cutFt * FT}
          sunHour={sun}
          comments={shownComments}
          commentMode={commentMode && isLatest}
          onAddComment={(d) => isLatest && setDraft(d)}
          onSelectComment={(id) => { setSelected(id); setDrawer(true); }}
          onBuildProgress={(r, done, total) => setBuild({ done, total, name: r.name })}
          onReady={(res) => void onReady(res)}
          onExitWalk={() => setMode("orbit")}
        />
      </div>

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start gap-2 p-3 sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <Menu
            align="left"
            trigger={({ toggle, open }) => (
              <button onClick={toggle} aria-expanded={open} className={glass("flex h-10 items-center gap-2 rounded-full pl-3.5 pr-3 text-[13px] font-medium")}>
                <History className="size-4 text-sheet/70" strokeWidth={1.75} />
                Version {version.n}
                <ChevronDown className="size-3.5 text-sheet/60" />
              </button>
            )}
            items={[...project.versions]
              .sort((a, b) => b.n - a.n)
              .map((v) => ({
                label: `v${v.n}${v.id === project.current_version_id ? " (latest)" : ""}${v.summary ? `: ${v.summary.slice(0, 48)}${v.summary.length > 48 ? "…" : ""}` : ""}`,
                onSelect: () => {
                  setCompare("after");
                  setParams(v.id === project.current_version_id ? {} : { v: v.id });
                },
              }))}
          />
          {before && (
            <div className={glass("flex h-10 items-center rounded-full p-1")}>
              {(["before", "after"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setCompare(k)}
                  className={cn("h-8 rounded-full px-3 text-[12.5px] font-medium transition-colors", compare === k ? "bg-sheet text-ink" : "text-sheet/70 hover:text-sheet")}
                >
                  {k === "before" ? `Before (v${before.n})` : `After (v${version.n})`}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pointer-events-auto order-3 flex w-full items-center justify-center gap-2 sm:order-none sm:w-auto sm:flex-1">
          <div className={glass("flex h-10 items-center rounded-full p-1")}>
            {(["orbit", "walk"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn("flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors", mode === m ? "bg-sheet text-ink" : "text-sheet/75 hover:text-sheet")}
              >
                {m === "orbit" ? <Orbit className="size-4" strokeWidth={1.75} /> : <Footprints className="size-4" strokeWidth={1.75} />}
                {m === "orbit" ? "Orbit" : "Walk"}
              </button>
            ))}
          </div>
          <div className={glass("no-scrollbar flex h-10 max-w-[60vw] items-center overflow-x-auto rounded-full p-1")}>
            {[...levels.map((l) => ({ id: l.id, label: l.name.replace(/\s*floor$/i, "") })), { id: "all", label: "All" }].map((l) => (
              <button
                key={l.id}
                onClick={() => setLevelChoice(l.id)}
                className={cn("h-8 shrink-0 rounded-full px-3 text-[13px] font-medium transition-colors", levelChoice === l.id ? "bg-sheet text-ink" : "text-sheet/75 hover:text-sheet")}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pointer-events-auto ml-auto flex items-center gap-2">
          {isLatest && (
            <button
              onClick={() => setCommentMode((c) => !c)}
              aria-pressed={commentMode}
              className={cn(
                "flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                commentMode ? "bg-brick text-sheet shadow-float" : glass(),
              )}
            >
              <MessageSquarePlus className="size-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">{commentMode ? "Commenting" : "Comment"}</span>
            </button>
          )}
          <button onClick={() => setDrawer((d) => !d)} aria-pressed={drawer} className={glass("relative flex h-10 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium")}>
            <MessageSquare className="size-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Comments</span>
            {shownComments.length > 0 && (
              <span className="grid min-w-5 place-items-center rounded-full bg-brick px-1.5 text-[11px] font-semibold tabular">{shownComments.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* Status chips: build progress, as-built check, failed sections */}
      <div className="pointer-events-none absolute left-3 top-[108px] flex flex-col items-start gap-2 sm:left-4 sm:top-[72px]">
        <AnimatePresence>
          {build && (
            <motion.div key="build" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={glass("flex items-center gap-2.5 rounded-full px-3.5 py-2 text-[12.5px]")}>
              <Spinner className="size-3.5 text-[#e7a58f]" />
              Building <span className="font-mono text-[11.5px] text-sheet/80">{build.name}</span>
              <span className="tabular text-sheet/55">
                {build.done}/{build.total}
              </span>
            </motion.div>
          )}
          {!build && asBuilt && (
            <motion.div key="asbuilt" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={glass("pointer-events-auto flex items-center gap-2 rounded-full px-3.5 py-2 text-[12.5px]")} title={asBuiltIssues.map((c) => c.message).join("\n") || "Facade and landscape elements stay out of the setbacks"}>
              {asBuiltIssues.length ? <CircleAlert className="size-3.5 text-[#f3c27a]" /> : <ShieldCheck className="size-3.5 text-[#9fd0ae]" />}
              {asBuiltIssues.length ? `${asBuiltIssues.length} as-built note${asBuiltIssues.length === 1 ? "" : "s"}` : "As built: within LDA setbacks"}
            </motion.div>
          )}
          {failed.map((f) => (
            <motion.div key={f.name} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={glass("pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pl-3.5 pr-1.5 text-[12.5px]")}>
              <CircleAlert className="size-3.5 text-[#f19a8c]" />
              <span className="font-mono text-[11.5px]">{f.name}</span> didn't build
              <Button size="xs" variant="primary" onClick={() => void repair(f)}>
                Ask Argon to fix it
              </Button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Comment-mode hint */}
      <AnimatePresence>
        {commentMode && !draft && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute left-1/2 top-[120px] -translate-x-1/2 rounded-full bg-brick px-4 py-2 text-[13px] font-medium text-sheet shadow-float sm:top-[72px]"
          >
            {mode === "walk" ? "Press C to pin a comment where you're looking" : "Click any surface to pin a comment. Esc to stop."}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <AnimatePresence>
        {draft && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/25 p-4">
            <Composer draft={draft} plan={plan} onCancel={() => setDraft(null)} onSave={saveDraft} />
          </div>
        )}
      </AnimatePresence>

      {/* Dock */}
      <div className={cn("pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3 transition-[padding] duration-500 ease-[var(--ease-drawer)] sm:p-4", drawer && "md:pr-[392px]")}>
        <div className={glass("no-scrollbar pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-[22px] p-1.5")}>
          <div className="flex items-center gap-0.5 pr-1">
            {LAYERS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLayers((s) => ({ ...s, [l.id]: !s[l.id] }))}
                aria-pressed={layers[l.id]}
                title={`${layers[l.id] ? "Hide" : "Show"} ${l.label.toLowerCase()}`}
                className={cn(
                  "flex h-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-2.5 text-[10.5px] font-medium transition-colors",
                  layers[l.id] ? "text-sheet hover:bg-white/10" : "text-sheet/35 hover:bg-white/5",
                )}
              >
                <l.icon className="size-4" strokeWidth={1.6} />
                <span className={cn(!layers[l.id] && "line-through")}>{l.label}</span>
              </button>
            ))}
          </div>
          <Divider />
          <SliderControl
            icon={<Scissors className="size-4" strokeWidth={1.6} />}
            label={cutFt == null ? "Section cut off" : `Cut at ${feetInches(Math.round(cutFt))}`}
            active={cutFt != null}
            onToggle={() => setCutFt((c) => (c == null ? Math.round(topFt * 0.45) : null))}
            min={1}
            max={Math.round(topFt)}
            step={0.5}
            value={cutFt ?? Math.round(topFt)}
            onChange={(v) => setCutFt(v >= Math.round(topFt) ? null : v)}
          />
          <Divider />
          <SliderControl
            icon={<Sun className="size-4" strokeWidth={1.6} />}
            label={hourLabel(sun)}
            active
            min={6}
            max={19}
            step={0.25}
            value={sun}
            onChange={setSun}
          />
          <Divider />
          <button
            onClick={() => void startRender()}
            className="flex h-11 shrink-0 items-center gap-2 rounded-2xl bg-sheet px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-white"
          >
            <Sparkles className="size-4 text-brick" strokeWidth={1.75} />
            Render this view
          </button>
        </div>
      </div>

      {/* Walk mode: finish */}
      <AnimatePresence>
        {mode === "walk" && isLatest && !drawer && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-[92px] right-3 flex flex-col items-end gap-2 sm:right-6"
          >
            <span className={glass("hidden rounded-full px-3 py-1.5 text-[12px] text-sheet/80 md:block")}>WASD to move, drag to look, C to comment, Esc to leave</span>
            <Button variant="primary" size="xl" onClick={() => void finish()} loading={finishing} disabled={!openCount} trailing={<ArrowRight className="size-[18px]" strokeWidth={1.75} />}>
              Finish walkthrough ({openCount} comment{openCount === 1 ? "" : "s"})
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments drawer */}
      <AnimatePresence>
        {drawer && (
          <motion.aside
            initial={{ x: "105%" }}
            animate={{ x: 0 }}
            exit={{ x: "105%" }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
            className={glass("absolute bottom-3 right-3 top-3 z-10 w-[min(360px,calc(100%-1.5rem))] overflow-hidden rounded-[24px] sm:bottom-4 sm:right-4 sm:top-4")}
          >
            <CommentsDrawer
              comments={shownComments}
              plan={plan}
              selectedId={selected}
              onSelect={flyTo}
              onEdit={(c, text) => void updateComment(c.id, { text })}
              onDelete={(c) => void deleteComment(c.id)}
              onCommentView={() => void commentOnView()}
              onFinish={() => void finish()}
              onClose={() => setDrawer(false)}
              finishing={finishing}
              readOnly={!isLatest}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {render && <RenderLightbox before={render.before} after={render.after} error={render.error} onClose={() => setRender(null)} onRetry={() => void startRender()} />}
      </AnimatePresence>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-7 w-px shrink-0 bg-white/12" />;
}

function SliderControl({
  icon,
  label,
  active,
  onToggle,
  min,
  max,
  step,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onToggle?: () => void;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 px-2">
      <button
        onClick={onToggle}
        disabled={!onToggle}
        className={cn("grid size-8 place-items-center rounded-full transition-colors", active ? "text-sheet" : "text-sheet/40", onToggle && "hover:bg-white/10")}
        aria-pressed={active}
        title={label}
      >
        {icon}
      </button>
      <div className="flex w-[118px] flex-col">
        <span className={cn("text-[11px] font-medium tabular", active ? "text-sheet/85" : "text-sheet/45")}>{label}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="range w-full"
          style={{ ["--fill" as string]: `${fill}%` }}
          aria-label={label}
        />
      </div>
    </div>
  );
}
