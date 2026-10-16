import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, ImageOff, RefreshCw, Shuffle, Wand } from "lucide-react";
import type { Concept, Project } from "@contracts/api-types";
import { assetUrl } from "@/api/client";
import { FACING_LABEL, plotLabel } from "@/api/domain";
import { cn } from "@/app/lib/utils";
import { useProject, type ConceptSlot } from "@/app/store/project";
import { Button } from "@/app/ui/Button";
import { Chip, Pill } from "@/app/ui/primitives";
import { ConceptSketch } from "./ConceptSketch";

const REMIX_IDEAS = ["More wood", "Darker glass", "Add a jaali screen", "Warmer evening light", "Stone instead of plaster", "More greenery"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

interface Tile {
  key: string;
  label: string;
  concept?: Concept;
  slot?: ConceptSlot;
}

interface Group {
  key: string;
  title: string;
  subtitle?: string;
  tiles: Tile[];
}

export function ConceptsStep() {
  const navigate = useNavigate();
  const project = useProject((s) => s.project)!;
  const run = useProject((s) => s.conceptRun);
  const generate = useProject((s) => s.generateConcepts);
  const select = useProject((s) => s.selectConcept);
  const [focusId, setFocusIdState] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const setFocusId = (id: string | null) => {
    setFocusIdState(id);
    scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // First visit: start rendering straight away.
  useEffect(() => {
    if (!project.concepts.length && !run) void generate({ count: 4 });
  }, [project.concepts.length, run, generate]);

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    const roots = project.concepts.filter((c) => !c.parent_id);
    roots.forEach((c, i) => map.set(c.id, LETTERS[i % 26] + (i >= 26 ? String(Math.floor(i / 26)) : "")));
    const counts = new Map<string, number>();
    for (const c of project.concepts.filter((x) => x.parent_id)) {
      const n = (counts.get(c.parent_id!) ?? 0) + 1;
      counts.set(c.parent_id!, n);
      map.set(c.id, `${map.get(c.parent_id!) ?? "R"}${n}`);
    }
    return map;
  }, [project.concepts]);

  const groups = useMemo<Group[]>(() => {
    const roots: Tile[] = project.concepts.filter((c) => !c.parent_id).map((c) => ({ key: c.id, label: labels.get(c.id)!, concept: c }));
    const pending = (run?.slots ?? []).filter((s) => s.status !== "done");
    const remixGroups = new Map<string, Group>();
    for (const c of project.concepts.filter((x) => x.parent_id)) {
      const key = `${c.parent_id}|${c.instruction ?? ""}`;
      const g = remixGroups.get(key) ?? { key, title: `Remix of ${labels.get(c.parent_id!) ?? "a concept"}`, subtitle: c.instruction, tiles: [] };
      g.tiles.push({ key: c.id, label: labels.get(c.id)!, concept: c });
      remixGroups.set(key, g);
    }
    if (run && pending.length) {
      const tiles = pending.map((s) => ({ key: s.key, label: "", slot: s }));
      if (run.baseId) {
        const key = `${run.baseId}|${run.instruction ?? ""}`;
        const g = remixGroups.get(key) ?? { key, title: `Remix of ${labels.get(run.baseId) ?? "a concept"}`, subtitle: run.instruction, tiles: [] };
        g.tiles.push(...tiles.map((t, i) => ({ ...t, label: `${labels.get(run.baseId!) ?? "R"}${g.tiles.length + i + 1}` })));
        remixGroups.set(key, g);
      } else {
        roots.push(...tiles.map((t, i) => ({ ...t, label: LETTERS[(roots.length + i) % 26] })));
      }
    }
    const remixes = [...remixGroups.values()].reverse();
    return [...remixes, { key: "roots", title: remixes.length ? "Original concepts" : "Concepts", tiles: roots }];
  }, [project.concepts, run, labels]);

  const focus = project.concepts.find((c) => c.id === focusId) ?? null;
  const brief = project.brief;
  const subtitle = [
    brief?.style,
    brief?.plot?.area_marla ? plotLabel(brief.plot.area_marla) : null,
    brief?.facing ? `${FACING_LABEL[brief.facing]?.toLowerCase()}-facing` : null,
    brief?.scheme,
  ].filter(Boolean).join(", ");

  const choose = async (c: Concept) => {
    setChoosing(true);
    const ok = await select(c.id);
    setChoosing(false);
    if (ok) navigate("../design", { state: { autostart: true } });
  };

  const remix = (base: Concept, instruction: string) => {
    if (!instruction.trim()) return;
    void generate({ count: 2, instruction: instruction.trim(), base_concept_id: base.id });
    setFocusId(null);
  };

  return (
    <div ref={scroller} className="scrollbar-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-[1360px] px-4 pb-24 pt-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display-tight text-[32px] font-medium leading-tight text-ink sm:text-[40px]">
              {focus ? `Concept ${labels.get(focus.id)}` : "Four directions for your home"}
            </h1>
            <p className="mt-1.5 text-[14px] text-graphite">
              {focus ? "Use it to guide the plan and the 3D model, or remix it with a few words." : subtitle || "Pick the one that feels like home."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {focus ? (
              <Button variant="ghost" icon={<ArrowLeft className="size-4" strokeWidth={1.75} />} onClick={() => setFocusId(null)}>
                All concepts
              </Button>
            ) : (
              <Button
                variant="outline"
                icon={<RefreshCw className="size-4" strokeWidth={1.75} />}
                onClick={() => void generate({ count: 4 })}
                disabled={!!run?.running}
              >
                Four more
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {focus ? (
            <motion.div
              key="focus"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <FocusView
                concept={focus}
                label={labels.get(focus.id)!}
                all={project.concepts}
                labels={labels}
                selectedId={project.selected_concept_id}
                choosing={choosing}
                remixing={!!run?.running}
                onPick={setFocusId}
                onChoose={choose}
                onRemix={remix}
              />
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="xl:grid xl:grid-cols-[minmax(0,1fr)_290px] xl:gap-10"
            >
              <div className="min-w-0">
              {groups.map((g, gi) =>
                g.tiles.length ? (
                  <section key={g.key} className={gi === 0 ? "mt-6" : "mt-8"}>
                    {(g.key !== "roots" || groups.length > 1) && (
                      <div className={cn("mb-3 flex flex-wrap items-baseline gap-x-3", gi > 0 && "border-t border-line pt-6")}>
                        <h2 className="font-display-text text-[20px] font-medium text-ink">{g.title}</h2>
                        {g.subtitle && <p className="text-[13.5px] text-graphite">“{g.subtitle}”</p>}
                      </div>
                    )}
                    <div className={cn("grid gap-5", g.key === "roots" ? "md:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3")}>
                      {g.tiles.map((t) => (
                        <ConceptTile
                          key={t.key}
                          tile={t}
                          startedAt={run?.startedAt ?? Date.now()}
                          chosen={!!t.concept && t.concept.id === project.selected_concept_id}
                          onOpen={() => t.concept && setFocusId(t.concept.id)}
                          onRetry={() => void generate({ count: 1, instruction: run?.instruction, base_concept_id: run?.baseId })}
                        />
                      ))}
                    </div>
                  </section>
                ) : null,
              )}
              {!project.concepts.length && !run && (
                <p className="mt-10 text-[14px] text-graphite">No concepts yet.</p>
              )}
              </div>
              <ChoosingGuide project={project} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Side guide on wide screens: what the concepts were drawn from, and what choosing one does. */
function ChoosingGuide({ project }: { project: Project }) {
  const b = project.brief;
  const rows = [
    ["Plot", b?.plot?.area_marla ? `${plotLabel(b.plot.area_marla)}, ${b.plot.width_ft}' × ${b.plot.depth_ft}'` : null],
    ["Facing", b?.facing ? FACING_LABEL[b.facing] : null],
    ["Floors", b?.storeys ? `${b.storeys} storeys` : null],
    ["Rooms", b?.bedrooms ? `${b.bedrooms} bedrooms, ${b.bathrooms ?? b.bedrooms + 1} baths` : null],
    ["Style", b?.style || null],
  ].filter((r): r is [string, string] => !!r[1]);
  return (
    <aside className="mt-6 hidden self-start xl:sticky xl:top-6 xl:block">
      <div className="rounded-[22px] bg-plaster p-5 ring-1 ring-line">
        <p className="font-display-text text-[17px] font-medium text-ink">Drawn from your brief</p>
        <dl className="mt-3 space-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 text-[13px]">
              <dt className="text-pencil">{k}</dt>
              <dd className="text-right text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <ol className="mt-5 space-y-4 px-1">
        {[
          ["Pick the massing you like", "Materials and colours can change later. The concept guides the plan and the 3D model."],
          ["Remix in a few words", "“More wood, darker glass” gives two new versions that keep the same house."],
          ["Change your mind any time", "Come back and choose another concept before or after the design."],
        ].map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="font-display-text text-[14px] text-brick">{i + 1}</span>
            <span>
              <span className="block text-[13.5px] font-semibold text-ink">{t}</span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-graphite">{d}</span>
            </span>
          </li>
        ))}
      </ol>
    </aside>
  );
}

function ConceptImage({ concept, className, eager }: { concept: Concept; className?: string; eager?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className={cn("grid place-items-center bg-wash text-pencil", className)}>
        <span className="flex items-center gap-2 text-[12.5px]">
          <ImageOff className="size-4" strokeWidth={1.5} /> Image unavailable
        </span>
      </div>
    );
  }
  return (
    <img
      src={assetUrl(concept.url)}
      alt={concept.prompt}
      loading={eager ? "eager" : "lazy"}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
      className={cn(
        "object-cover transition-[opacity,filter,transform] duration-[1100ms] ease-[var(--ease-out-quint)]",
        loaded ? "scale-100 opacity-100 blur-0" : "scale-[1.04] opacity-0 blur-md",
        className,
      )}
    />
  );
}

function ConceptTile({
  tile,
  startedAt,
  chosen,
  onOpen,
  onRetry,
}: {
  tile: Tile;
  startedAt: number;
  chosen: boolean;
  onOpen: () => void;
  onRetry: () => void;
}) {
  const { concept, slot, label } = tile;
  return (
    <div className="rounded-[24px] bg-ink/[0.035] p-1.5 ring-1 ring-ink/[0.05]">
      <div className="group relative aspect-[16/9] overflow-hidden rounded-[19px] bg-sheet shadow-[inset_0_1px_0_rgb(255_255_255/0.8)]">
        <AnimatePresence initial={false}>
          {concept ? (
            <motion.button
              key="img"
              type="button"
              onClick={onOpen}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 block h-full w-full text-left"
              aria-label={`Open concept ${label}`}
            >
              <ConceptImage concept={concept} className="h-full w-full transition-transform duration-[1200ms] group-hover:scale-[1.025]" />
              <span className="absolute inset-0 bg-gradient-to-t from-ink/55 via-ink/0 to-ink/0 opacity-80 transition-opacity duration-500 group-hover:opacity-100" />
              <span className="absolute bottom-3 left-4 right-4 flex items-end justify-between gap-3">
                <span className="font-display-text text-[22px] font-medium text-sheet drop-shadow">Concept {label}</span>
                <span className="inline-flex translate-y-1 items-center gap-1.5 rounded-full bg-sheet/90 px-3 py-1.5 text-[12.5px] font-medium text-ink opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  View <ArrowRight className="size-3.5" strokeWidth={1.75} />
                </span>
              </span>
              {chosen && (
                <span className="absolute left-3 top-3">
                  <Pill tone="accent" className="bg-sheet/95">
                    Chosen
                  </Pill>
                </span>
              )}
            </motion.button>
          ) : (
            <motion.div key="sketch" exit={{ opacity: 0, transition: { duration: 0.6 } }} className="absolute inset-0">
              <ConceptSketch label={label} prompt={slot?.prompt} startedAt={startedAt} failed={slot?.status === "failed"} message={slot?.message} className="h-full w-full" />
              {slot?.status === "failed" && (
                <Button size="xs" className="absolute right-3 top-3" icon={<RefreshCw className="size-3" />} onClick={onRetry}>
                  Retry
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function FocusView({
  concept,
  label,
  all,
  labels,
  selectedId,
  choosing,
  remixing,
  onPick,
  onChoose,
  onRemix,
}: {
  concept: Concept;
  label: string;
  all: Concept[];
  labels: Map<string, string>;
  selectedId: string | null;
  choosing: boolean;
  remixing: boolean;
  onPick: (id: string) => void;
  onChoose: (c: Concept) => void;
  onRemix: (c: Concept, instruction: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const isChosen = selectedId === concept.id;
  const addIdea = (idea: string) =>
    setInstruction((cur) => (cur.trim() ? `${cur.trim().replace(/[.,]$/, "")}, ${idea.toLowerCase()}` : idea));

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] xl:gap-8">
      <div className="self-start rounded-[28px] bg-ink/[0.035] p-2 ring-1 ring-ink/[0.05]">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[22px] bg-wash">
          <ConceptImage key={concept.id} concept={concept} eager className="h-full w-full" />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-[22px] bg-plaster p-5 ring-1 ring-line">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display-text text-[20px] font-medium text-ink">Concept {label}</span>
            {concept.instruction ? <Pill tone="neutral" dot={false}>Remix</Pill> : null}
          </div>
          {concept.instruction && <p className="mt-2 font-display-text text-[15px] text-ink">“{concept.instruction}”</p>}
          <p className="mt-2 text-[13px] leading-relaxed text-graphite">{concept.prompt}</p>
          <p className="mt-2 text-[11.5px] text-pencil">Rendered by {concept.model}</p>
          <Button
            variant="primary"
            size="lg"
            className="mt-5 w-full justify-between pl-6"
            loading={choosing}
            onClick={() => onChoose(concept)}
            trailing={<ArrowRight className="size-4" strokeWidth={1.75} />}
          >
            {isChosen ? "Continue with this concept" : "Use this concept"}
          </Button>
          {isChosen && (
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-pass">
              <Check className="size-3.5" strokeWidth={2} /> This is your chosen concept
            </p>
          )}
        </div>

        <div className="rounded-[22px] bg-plaster p-5 ring-1 ring-line">
          <div className="flex items-center gap-2">
            <Wand className="size-4 text-brick" strokeWidth={1.75} />
            <span className="text-[14px] font-semibold text-ink">Remix it</span>
          </div>
          <p className="mt-1 text-[12.5px] text-graphite">Describe a change. You'll get two variations that keep this massing.</p>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={2}
            placeholder="more wood, darker glass"
            className="mt-3 w-full resize-none rounded-xl bg-wash px-3 py-2.5 text-[14px] text-ink outline-none ring-brick placeholder:text-pencil focus:ring-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onRemix(concept, instruction);
            }}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {REMIX_IDEAS.map((idea) => (
              <Chip key={idea} size="sm" onClick={() => addIdea(idea)}>
                {idea}
              </Chip>
            ))}
          </div>
          <Button
            variant="ink"
            className="mt-4"
            icon={<Shuffle className="size-4" strokeWidth={1.75} />}
            disabled={!instruction.trim() || remixing}
            onClick={() => onRemix(concept, instruction)}
          >
            {remixing ? "Another render is running…" : "Remix"}
          </Button>
        </div>

        {all.length > 1 && (
          <div>
            <p className="text-[12.5px] font-medium text-pencil">Other concepts</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {all
                .filter((c) => c.id !== concept.id)
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onPick(c.id)}
                    className="group relative aspect-[16/10] overflow-hidden rounded-xl ring-1 ring-line transition-shadow hover:ring-ink/40"
                    title={`Concept ${labels.get(c.id)}`}
                  >
                    <img src={assetUrl(c.url)} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                    <span className="absolute bottom-1 left-1.5 rounded bg-ink/60 px-1 text-[10px] font-semibold text-sheet">{labels.get(c.id)}</span>
                    {c.id === selectedId && <span className="absolute right-1 top-1 size-2 rounded-full bg-brick ring-2 ring-sheet" />}
                  </button>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
