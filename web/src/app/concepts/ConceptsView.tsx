/**
 * Concepts (DESIGN.md "Concepts"): four exteriors in a 2×2 grid with no text on the images, named captions, a Day |
 * Night toggle (night is drawn lazily, all four at once, then crossfaded together), a lightbox to choose one and
 * remix it in a few words, and "Plan this one". No prompts or model names on screen; expensive actions can't be
 * double-fired.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, ImageOff, RotateCw, X } from "lucide-react";
import type { Concept, Project } from "@contracts/api-types";
import { api, assetUrl } from "@/api/client";
import { FACING_LABEL } from "@/api/domain";
import { cn } from "@/app/lib/utils";
import { useAskContext } from "@/app/shell/ask";
import { flow, useFlow, withNight, type ConceptSlot } from "@/app/design/flow";
import { BreathingDot, Button, Chip, Dialog, EASE_OUT, IconButton, Segmented, Shimmer, notify, useGuardedClick, useHotkeys } from "@/app/design/kit";
import { useViewNav } from "@/app/design/nav";
import { labelConcepts, nextRootLetter, type Labelled } from "./names";

const REMIX_IDEAS = ["Darker glass", "More timber", "Add a jaali screen", "Brick instead of plaster"];

type Light = "day" | "night";

export function ConceptsView({ project, onProjectChange }: { project: Project; onProjectChange(p: Project): void }) {
  const goTo = useViewNav();
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const run = useFlow((s) => (s.concepts?.pid === project.id ? s.concepts : null));
  const night = useFlow((s) => (s.night?.pid === project.id ? s.night : null));
  const nightUrls = useFlow((s) => s.nightUrls);
  const guard = useGuardedClick(700);

  const concepts = useMemo(() => withNight(project.concepts, nightUrls), [project.concepts, nightUrls]);
  const labels = useMemo(() => labelConcepts(concepts), [concepts]);
  const roots = useMemo(() => [...labels.values()].filter((l) => !l.concept.parent_id || !labels.has(l.concept.parent_id)), [labels]);
  const remixGroups = useMemo(() => {
    const g = new Map<string, Labelled[]>();
    for (const l of labels.values()) {
      if (!l.concept.parent_id || !labels.has(l.concept.parent_id)) continue;
      g.set(l.concept.parent_id, [...(g.get(l.concept.parent_id) ?? []), l]);
    }
    return [...g.entries()];
  }, [labels]);

  const light: Light = params.get("light") === "night" ? "night" : "day";
  const setLight = useCallback(
    (l: Light) => setParams((p) => { const n = new URLSearchParams(p); if (l === "night") n.set("light", "night"); else n.delete("light"); return n; }, { replace: true }),
    [setParams],
  );

  // First visit: draw four straight away.
  useEffect(() => {
    if (!project.concepts.length && !run) void flow.concepts(project.id, { count: 4 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Night is drawn lazily the first time someone switches to it, for every concept without one.
  useEffect(() => {
    if (light !== "night") return;
    const missing = concepts.filter((c) => !c.night_url).map((c) => c.id);
    if (missing.length && !night?.running) void flow.night(project.id, missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [light, concepts.length]);

  // All four crossfade together: show night only once the batch has landed (or after 30s, whatever is ready).
  const [nightShown, setNightShown] = useState(false);
  useEffect(() => {
    if (light !== "night") { setNightShown(false); return; }
    if (night?.running) {
      setNightShown(false);
      const t = setTimeout(() => setNightShown(true), 30_000);
      return () => clearTimeout(t);
    }
    setNightShown(true);
  }, [light, night?.running]);
  const waitingNight = light === "night" && !nightShown;

  useHotkeys({ n: () => setLight(light === "day" ? "night" : "day") });

  // Lightbox
  const [openId, setOpenId] = useState<string | null>(null);
  const open = openId ? labels.get(openId) : undefined;
  const ordered = useMemo(() => [...roots, ...remixGroups.flatMap(([, list]) => list)], [roots, remixGroups]);
  const step = (dir: 1 | -1) => {
    if (!open) return;
    const i = ordered.findIndex((l) => l.concept.id === open.concept.id);
    const next = ordered[(i + dir + ordered.length) % ordered.length];
    if (next) setOpenId(next.concept.id);
  };

  // Choose → plan
  const [confirm, setConfirm] = useState<Labelled | null>(null);
  const [choosing, setChoosing] = useState(false);
  const choose = async (l: Labelled, force = false) => {
    if (choosing) return;
    if (!force && project.current_version_id && project.selected_concept_id !== l.concept.id) {
      setConfirm(l);
      return;
    }
    setChoosing(true);
    try {
      const p = await api.selectConcept(project.id, l.concept.id);
      onProjectChange(p);
      const fresh = force || !project.current_version_id;
      goTo("plan", { state: fresh ? { autostart: true, walk: autopilot } : undefined });
      if (force) void flow.design(project.id);
    } catch (e) {
      notify.error("Couldn't choose that concept", e);
    } finally {
      setChoosing(false);
    }
  };

  // "Decide everything for me": take the first concept as soon as it lands.
  const [autopilot] = useState(() => !!(location.state as { autopilot?: boolean } | null)?.autopilot);
  const autoDone = useRef(false);
  useEffect(() => {
    // Forget the request in history so a reload or Back doesn't choose again.
    if (autopilot) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!autopilot || autoDone.current) return;
    const first = roots[0];
    if (!first) return;
    autoDone.current = true;
    // Let the first image land on screen for a beat, then carry on (deliberately not cancelled on re-render).
    setTimeout(() => void choose(first, !!project.current_version_id), 1400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autopilot, roots.length]);

  const remix = (base: Labelled, instruction: string) => {
    const t = instruction.trim();
    if (!t || run?.running) return;
    setOpenId(null);
    void flow.concepts(project.id, { count: 2, instruction: t, base_concept_id: base.concept.id });
    setTimeout(() => document.getElementById("remixes")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };

  useAskContext(
    open
      ? {
          placeholder: `Describe a change to ${open.label}, like darker glass`,
          busy: !!run?.running,
          onSubmit: (text) => remix(open, text),
        }
      : {
          placeholder: "Ask for four more, like more brick and deeper shade",
          busy: !!run?.running,
          onSubmit: (text) => void flow.concepts(project.id, { count: 4, instruction: text }),
        },
  );

  const brief = project.brief;
  const chips = [
    brief?.plot ? (brief.plot.corner ? "Corner" : "Mid-row") : null,
    brief?.facing ? `Faces ${FACING_LABEL[brief.facing]?.toLowerCase()}` : null,
    brief?.solar === "panels" ? "Solar frame" : brief?.solar === "ready" ? "Solar-ready roof" : null,
    brief?.water_tank === "concrete" ? "Tank in the stair tower" : brief?.water_tank === "plastic" ? "Plastic tank" : null,
    brief?.style || null,
  ].filter(Boolean) as string[];

  const pendingRoots = run && !run.baseId ? run.slots.filter((s) => s.status !== "done") : [];
  const pendingRemix = run && run.baseId ? run.slots.filter((s) => s.status !== "done") : [];
  const chosen = project.selected_concept_id;

  return (
    <div className="relative h-full overflow-hidden bg-canvas">
      <div className="absolute inset-0 overflow-y-auto [scrollbar-width:thin]">
      <div className="mx-auto max-w-[1280px] px-4 pb-40 pt-[104px] sm:px-6 md:pt-[72px]">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <h1 className="text-title text-ink">Concepts</h1>
            {chips.length > 0 && <p className="mt-1 text-[13.5px] text-ink-3">{chips.join(" · ")}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Segmented
              label="Light"
              value={light}
              onChange={setLight}
              options={[
                { value: "day", label: "Day", title: "Day (N)" },
                {
                  value: "night",
                  label: (
                    <span className="inline-flex items-center gap-1.5">
                      Night {night?.running && <BreathingDot className="bg-current" />}
                    </span>
                  ),
                  title: "Night (N)",
                },
              ]}
            />
            <Button variant="secondary" size="sm" className="h-9" disabled={!!run?.running} onClick={guard(() => void flow.concepts(project.id, { count: 4 }))}>
              {run?.running && !run.baseId ? "Drawing…" : "Four more"}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {waitingNight && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 text-[13.5px] text-ink-2">
              Turning the lights on: the same views, at night.
            </motion.p>
          )}
          {autopilot && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 inline-flex items-center gap-2 text-[13.5px] text-ink-2">
              <BreathingDot /> Choosing the strongest concept and drawing the plan for you…
            </motion.p>
          )}
        </AnimatePresence>

        {/* The originals, 2 × 2 */}
        {/* 2 × 2 on wider screens; a swipe carousel on phones */}
        <div className="-mx-4 mt-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 [&>*]:w-[84%] [&>*]:shrink-0 [&>*]:snap-center md:[&>*]:w-auto">
          {roots.map((l) => (
            <Tile key={l.concept.id} l={l} light={light} nightShown={nightShown} nightFailed={!!night?.failed.includes(l.concept.id)} chosen={chosen === l.concept.id} onOpen={() => setOpenId(l.concept.id)} />
          ))}
          {pendingRoots.map((s, i) => (
            <PendingTile key={s.key} slot={s} label={nextRootLetter(project.concepts, i)} onRetry={guard(() => void flow.concepts(project.id, { count: 1 }))} />
          ))}
        </div>
        {!roots.length && !pendingRoots.length && (
          <div className="mt-16 text-center">
            <p className="text-body-lg text-ink-2">No concepts yet.</p>
            <Button variant="primary" className="mt-4" onClick={guard(() => void flow.concepts(project.id, { count: 4 }))}>
              Draw four concepts
            </Button>
          </div>
        )}

        {/* Remixes */}
        {(remixGroups.length > 0 || pendingRemix.length > 0) && (
          <section id="remixes" className="mt-12 scroll-mt-20">
            <h2 className="text-heading text-ink">Remixes</h2>
            {[...new Set([...remixGroups.map(([pid]) => pid), ...(run?.baseId && pendingRemix.length ? [run.baseId] : [])])].map((pid) => {
              const parent = labels.get(pid);
              const list = remixGroups.find(([p]) => p === pid)?.[1] ?? [];
              const pend = run?.baseId === pid ? pendingRemix : [];
              return (
                <div key={pid} className="mt-4">
                  <p className="text-[13.5px] text-ink-3">
                    From {parent ? `${parent.label} · ${parent.name}` : "a concept"}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-4 lg:grid-cols-3">
                    {list.map((l) => (
                      <Tile key={l.concept.id} l={l} light={light} nightShown={nightShown} nightFailed={!!night?.failed.includes(l.concept.id)} chosen={chosen === l.concept.id} onOpen={() => setOpenId(l.concept.id)} small />
                    ))}
                    {pend.map((s, i) => (
                      <PendingTile key={s.key} slot={s} label={`${parent?.label ?? ""}${list.length + i + 1}`} small onRetry={guard(() => void flow.concepts(project.id, { count: 1, instruction: run?.instruction, base_concept_id: pid }))} />
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
      </div>

      <AnimatePresence>
        {open && (
          <Lightbox
            l={open}
            light={light}
            nightShown={nightShown}
            onLight={setLight}
            chosen={chosen === open.concept.id}
            actionLabel={chosen === open.concept.id && project.current_version_id ? "Open the plan" : "Plan this one"}
            choosing={choosing}
            remixing={!!run?.running}
            count={ordered.length}
            onClose={() => setOpenId(null)}
            onStep={step}
            onChoose={() => void choose(open)}
            onRemix={(t) => remix(open, t)}
          />
        )}
      </AnimatePresence>

      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={`Plan concept ${confirm?.label ?? ""} instead?`}
        description={`I'll draw a fresh plan guided by ${confirm?.name.toLowerCase() ?? "this concept"}. Version ${project.versions.length} stays in your history. It takes about five minutes.`}
        actions={
          <>
            <Button variant="quiet" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                if (c) void choose(c, true);
              }}
            >
              Plan this one
            </Button>
          </>
        }
      />
    </div>
  );
}

function ConceptImage({ concept, light, nightShown, className, eager }: { concept: Concept; light: Light; nightShown: boolean; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const night = light === "night" && nightShown && concept.night_url;
  if (failed) {
    return (
      <div className={cn("grid place-items-center bg-surface-2 text-ink-3", className)}>
        <span className="inline-flex items-center gap-2 text-[13px]">
          <ImageOff className="size-4" strokeWidth={1.5} /> This image didn't load
        </span>
      </div>
    );
  }
  return (
    <div className={cn("relative overflow-hidden bg-surface-2", className)}>
      <img
        src={assetUrl(concept.url)}
        alt=""
        loading={eager ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-[400ms] ease-out", loaded ? "opacity-100" : "opacity-0")}
      />
      {concept.night_url && (
        <img
          src={assetUrl(concept.night_url)}
          alt=""
          loading="lazy"
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-[400ms] ease-out", night ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  );
}

function Tile({ l, light, nightShown, nightFailed, chosen, onOpen, small }: { l: Labelled; light: Light; nightShown: boolean; nightFailed: boolean; chosen: boolean; onOpen: () => void; small?: boolean }) {
  const waiting = light === "night" && !nightShown && !l.concept.night_url && !nightFailed;
  const pendingSwap = light === "night" && !nightShown;
  return (
    <motion.figure layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: EASE_OUT }} className="group">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open concept ${l.label}, ${l.name}`}
        className={cn(
          "relative block w-full overflow-hidden rounded-card outline-none transition-[box-shadow,transform] duration-[600ms] ease-out focus-visible:shadow-focus",
          chosen ? "shadow-[0_0_0_2px_var(--color-accent)]" : "shadow-e1 group-hover:shadow-e2",
        )}
      >
        <ConceptImage concept={l.concept} light={light} nightShown={nightShown} className="aspect-[4/3] w-full transition-transform duration-[600ms] ease-out group-hover:scale-[1.02]" />
        {(waiting || pendingSwap) && (
          <>
            <div className="absolute inset-0 bg-ink/35 transition-opacity" />
            <Shimmer dark />
          </>
        )}
      </button>
      <figcaption className="mt-2.5 flex items-baseline justify-between gap-3 px-0.5">
        <span className={cn("min-w-0 truncate text-ink", small ? "text-[14px]" : "text-[15px]")}>
          <span className="font-medium">{l.label}</span>
          <span className="text-ink-3"> · {l.name}</span>
        </span>
        {chosen && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-accent">
            <span className="size-1.5 rounded-full bg-accent" /> Chosen
          </span>
        )}
        {light === "night" && nightFailed && <span className="shrink-0 text-[12.5px] text-ink-3">Night view unavailable</span>}
      </figcaption>
    </motion.figure>
  );
}

function PendingTile({ slot, label, onRetry, small }: { slot: ConceptSlot; label: string; onRetry: () => void; small?: boolean }) {
  const failed = slot.status === "failed";
  return (
    <figure>
      <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-surface-2 shadow-e1">
        {!failed && <Shimmer />}
        {failed && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <p className="text-[14px] text-ink-2">This one didn't come through.</p>
              <Button variant="secondary" size="sm" className="mt-3" icon={<RotateCw className="size-3.5" strokeWidth={1.75} />} onClick={onRetry}>
                Try again
              </Button>
            </div>
          </div>
        )}
      </div>
      <figcaption className={cn("mt-2.5 flex items-center gap-2 px-0.5 text-ink-3", small ? "text-[14px]" : "text-[15px]")}>
        <span className="font-medium text-ink">{label}</span>
        {!failed && (
          <>
            <BreathingDot /> Drawing
          </>
        )}
      </figcaption>
    </figure>
  );
}

function Lightbox({
  l,
  light,
  nightShown,
  onLight,
  chosen,
  actionLabel,
  choosing,
  remixing,
  count,
  onClose,
  onStep,
  onChoose,
  onRemix,
}: {
  l: Labelled;
  light: Light;
  nightShown: boolean;
  onLight: (l: Light) => void;
  chosen: boolean;
  actionLabel: string;
  choosing: boolean;
  remixing: boolean;
  count: number;
  onClose: () => void;
  onStep: (d: 1 | -1) => void;
  onChoose: () => void;
  onRemix: (t: string) => void;
}) {
  // Swallow clicks for a moment after opening so a double-click on a tile can't fire anything here.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 400);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /^(INPUT|TEXTAREA)$/.test((e.target as HTMLElement)?.tagName ?? "");
      if (e.key === "Escape") onClose();
      if (typing) return;
      if (e.key === "ArrowRight") onStep(1);
      if (e.key === "ArrowLeft") onStep(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onStep]);
  return (
    <motion.div
      className="absolute inset-0 z-30 flex flex-col bg-canvas pb-[96px] pt-[100px] md:pt-[64px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24 }}
      role="dialog"
      aria-modal="true"
      aria-label={`Concept ${l.label}`}
      style={{ pointerEvents: armed ? "auto" : "none" }}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-heading text-ink">
            {l.label} <span className="text-ink-3">· {l.name}</span>
          </p>
          {l.concept.instruction && <p className="text-[13px] text-ink-3">A remix: “{l.concept.instruction}”</p>}
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            label="Light"
            size="sm"
            value={light}
            onChange={onLight}
            options={[
              { value: "day", label: "Day" },
              { value: "night", label: "Night" },
            ]}
          />
          <IconButton label="Close" variant="secondary" size={36} onClick={onClose}>
            <X className="size-4" strokeWidth={1.75} />
          </IconButton>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 py-4 sm:px-16">
        <motion.div key={l.concept.id} initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.32, ease: EASE_OUT }} className="aspect-[4/3] max-h-full w-full max-w-[1100px] overflow-hidden rounded-media shadow-e3">
          <ConceptImage concept={l.concept} light={light} nightShown={nightShown} eager className="h-full w-full" />
        </motion.div>
        {count > 1 && (
          <>
            <IconButton label="Previous concept" variant="secondary" size={40} onClick={() => onStep(-1)} className="absolute left-3 top-1/2 hidden -translate-y-1/2 sm:inline-grid">
              <ArrowLeft className="size-4" strokeWidth={1.75} />
            </IconButton>
            <IconButton label="Next concept" variant="secondary" size={40} onClick={() => onStep(1)} className="absolute right-3 top-1/2 hidden -translate-y-1/2 sm:inline-grid">
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </IconButton>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-ink-3">Remix it:</span>
          {REMIX_IDEAS.map((idea) => (
            <Chip key={idea} tone="suggestion" disabled={remixing} onClick={() => onRemix(idea)}>
              {idea}
            </Chip>
          ))}
        </div>
        <Button variant="primary" size="lg" loading={choosing} onClick={onChoose} iconRight={<ArrowRight className="size-4" strokeWidth={1.75} />}>
          {actionLabel}
        </Button>
      </div>
    </motion.div>
  );
}
