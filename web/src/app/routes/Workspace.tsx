import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Ellipsis, PencilLine, Plus, RefreshCw, Trash } from "lucide-react";
import type { Project } from "@contracts/api-types";
import { api, assetUrl, errorMessage } from "@/api/client";
import { plotLabel } from "@/api/domain";
import { relativeTime } from "@/app/lib/utils";
import { stageLabel, stageTone } from "@/app/lib/steps";
import { toast } from "@/app/store/toast";
import { Button } from "@/app/ui/Button";
import { HouseLineArt, PlotSketch, Wordmark } from "@/app/ui/brand";
import { Dialog, Menu, Pill, type Tone } from "@/app/ui/primitives";

const JOURNEY = [
  { title: "Brief", body: "One-tap answers and an instant LDA envelope" },
  { title: "Concepts", body: "Four photoreal exteriors to choose from" },
  { title: "Naqsha", body: "Dimensioned floor plans, checked against LDA rules" },
  { title: "Walk", body: "Explore in 3D and pin comments anywhere" },
  { title: "Revise", body: "Your notes applied, still compliant" },
];

export function Workspace() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setProjects(await api.listProjects());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    document.title = "Naqsha — AI home design for Pakistan";
    void load();
  }, [load]);

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const p = await api.createProject();
      navigate(`/p/${p.id}/setup`);
    } catch (e) {
      toast.error("Couldn't start a new project", e);
      setCreating(false);
    }
  };

  const rename = async (p: Project, name: string) => {
    const prev = projects;
    setProjects((list) => list?.map((x) => (x.id === p.id ? { ...x, name } : x)) ?? null);
    try {
      await api.updateProject(p.id, { name });
    } catch (e) {
      setProjects(prev);
      toast.error("Couldn't rename the project", e);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api.deleteProject(toDelete.id);
      setProjects((list) => list?.filter((x) => x.id !== toDelete.id) ?? null);
      toast.success("Project deleted");
      setToDelete(null);
    } catch (e) {
      toast.error("Couldn't delete the project", e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grain min-h-[100dvh] bg-paper">
      <header className="mx-auto flex max-w-[1320px] items-center justify-between px-4 pt-5 sm:px-8 sm:pt-7">
        <Link to="/" aria-label="Naqsha home">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-3 text-[13px] text-graphite">
          {api.mock && <Pill tone="accent">Demo data</Pill>}
          <span className="hidden sm:inline">Guest workspace</span>
        </div>
      </header>

      <main className="relative z-[2] mx-auto max-w-[1320px] px-4 sm:px-8">
        {/* Hero */}
        <section className="grid gap-10 pb-16 pt-12 sm:pt-16 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:gap-x-12 lg:gap-y-0 lg:pb-24 lg:pt-20">
          <div className="lg:col-span-7 lg:row-start-1 lg:pt-6">
            <h1 className="font-display-tight text-[44px] font-medium leading-[1.02] text-ink sm:text-[64px] xl:text-[78px]">
              From idea to a walkable, LDA-compliant home.
            </h1>
            <p className="mt-6 max-w-[34rem] text-[17px] leading-[1.6] text-graphite">
              Tell the AI architect about your plot and family. You get photoreal concepts, a dimensioned naqsha checked against Lahore's
              building rules, and a 3D house you can walk through and mark up.
            </p>
          </div>

          <div className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
            <NewProjectCard onCreate={create} creating={creating} />
          </div>

          <ol className="grid grid-cols-2 gap-x-6 gap-y-6 border-t border-line pt-6 sm:grid-cols-5 sm:gap-x-5 lg:col-span-7 lg:row-start-2 lg:mt-12 lg:self-start">
            {JOURNEY.map((j, i) => (
              <li key={j.title} className="relative">
                <span className="font-display-text text-[13px] text-brick">{i + 1}</span>
                <p className="mt-1 text-[14px] font-semibold text-ink">{j.title}</p>
                <p className="mt-1 text-[12.5px] leading-snug text-graphite">{j.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Projects */}
        <section className="pb-24" aria-labelledby="projects-heading">
          <div className="flex items-end justify-between gap-4 border-b border-line pb-4">
            <h2 id="projects-heading" className="font-display-text text-[26px] font-medium text-ink">
              Your projects
              {projects && projects.length > 0 && <span className="ml-2 align-middle text-[15px] text-pencil tabular">{projects.length}</span>}
            </h2>
            {projects && projects.length > 0 && (
              <Button variant="outline" size="sm" icon={<Plus className="size-4" strokeWidth={1.75} />} onClick={create} loading={creating}>
                New project
              </Button>
            )}
          </div>

          {error ? (
            <div className="mt-10 flex flex-col items-start gap-3 rounded-2xl bg-sheet p-6 ring-1 ring-line">
              <p className="text-[15px] font-medium text-ink">Your projects didn't load.</p>
              <p className="text-[13.5px] text-graphite">{error}</p>
              <Button size="sm" icon={<RefreshCw className="size-3.5" strokeWidth={1.75} />} onClick={load}>
                Try again
              </Button>
            </div>
          ) : !projects ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="overflow-hidden rounded-[22px] bg-sheet ring-1 ring-line">
                  <div className="relative aspect-[16/10] overflow-hidden bg-wash">
                    <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                  </div>
                  <div className="space-y-2 p-5">
                    <div className="h-4 w-2/3 rounded bg-wash" />
                    <div className="h-3 w-1/3 rounded bg-wash" />
                  </div>
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState onCreate={create} creating={creating} />
          ) : (
            <motion.ul layout className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence initial={false}>
                {projects.map((p, i) => (
                  <motion.li
                    key={p.id}
                    layout
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 6) * 0.04, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
                    exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
                  >
                    <ProjectCard project={p} onRename={(name) => rename(p, name)} onDelete={() => setToDelete(p)} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
          )}
        </section>
      </main>

      <Dialog open={!!toDelete} onClose={() => !deleting && setToDelete(null)} label="Delete project">
        <h3 className="font-display-text text-[22px] font-medium text-ink">Delete “{toDelete?.name}”?</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-graphite">
          This removes its brief, concepts, versions and comments. It can't be undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setToDelete(null)} disabled={deleting}>
            Keep it
          </Button>
          <Button variant="danger" onClick={confirmDelete} loading={deleting}>
            Delete project
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function NewProjectCard({ onCreate, creating }: { onCreate: () => void; creating: boolean }) {
  return (
    <div className="rounded-[30px] bg-ink/[0.035] p-2 ring-1 ring-ink/[0.06]">
      <button
        type="button"
        onClick={onCreate}
        disabled={creating}
        className="group relative block w-full overflow-hidden rounded-[24px] bg-sheet text-left shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_1px_2px_rgb(30_27_23/0.05)] transition-shadow duration-500 hover:shadow-lift"
      >
        <div className="bg-drafting-faint relative px-6 pt-6">
          <HouseLineArt className="mx-auto max-w-[420px]" />
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-line px-6 py-5">
          <div>
            <p className="font-display-text text-[26px] font-medium leading-tight text-ink">New project</p>
            <p className="mt-1 max-w-[17rem] text-[13.5px] leading-snug text-graphite">
              Start with your plot. The LDA envelope appears the moment you pick a size.
            </p>
          </div>
          <span className="inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-brick pl-5 pr-1.5 text-[14.5px] font-medium text-sheet shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_10px_24px_-12px_rgb(127_49_28/0.7)] transition-colors duration-300 group-hover:bg-brick-deep">
            {creating ? "Opening…" : "Start"}
            <span className="grid size-9 place-items-center rounded-full bg-white/14 transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:translate-x-0.5 group-hover:-translate-y-px">
              <ArrowRight className="size-4" strokeWidth={1.75} />
            </span>
          </span>
        </div>
      </button>
    </div>
  );
}

function EmptyState({ onCreate, creating }: { onCreate: () => void; creating: boolean }) {
  return (
    <div className="mt-8 grid place-items-center rounded-[26px] border border-dashed border-line-strong bg-sheet/60 px-6 py-16 text-center">
      <div className="h-24 w-40">
        <PlotSketch />
      </div>
      <p className="mt-4 font-display-text text-[22px] font-medium text-ink">No projects yet</p>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-graphite">
        Your first home starts with a plot size. Pick one and you'll see what LDA lets you build before you've typed a word.
      </p>
      <Button variant="primary" size="lg" className="mt-6" onClick={onCreate} loading={creating} trailing={<ArrowRight className="size-4" strokeWidth={1.75} />}>
        Start a new home
      </Button>
    </div>
  );
}

const toneMap: Record<ReturnType<typeof stageTone>, Tone> = { neutral: "neutral", accent: "accent", progress: "progress", done: "pass" };

function ProjectCard({ project: p, onRename, onDelete }: { project: Project; onRename: (name: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const thumb = assetUrl(p.thumbnail_url ?? p.concepts.find((c) => c.id === p.selected_concept_id)?.url ?? p.concepts[0]?.url);
  const brief = p.brief;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);
  useEffect(() => setName(p.name), [p.name]);

  const commit = () => {
    setEditing(false);
    const n = name.trim();
    if (n && n !== p.name) onRename(n);
    else setName(p.name);
  };

  const meta = [
    brief?.plot?.area_marla ? plotLabel(brief.plot.area_marla) : null,
    brief?.style || null,
    brief?.bedrooms ? `${brief.bedrooms} bed` : null,
  ].filter(Boolean) as string[];

  return (
    <article className="group relative overflow-hidden rounded-[22px] bg-sheet shadow-[0_1px_2px_rgb(30_27_23/0.05)] ring-1 ring-line transition-[box-shadow,transform] duration-500 ease-[var(--ease-out-quint)] hover:-translate-y-0.5 hover:shadow-lift">
      <Link to={`/p/${p.id}`} className="block" aria-label={`Open ${p.name}`}>
        <div className="relative aspect-[16/10] overflow-hidden bg-wash">
          {thumb ? (
            <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-[var(--ease-out-quint)] group-hover:scale-[1.03]" />
          ) : (
            <div className="bg-drafting-faint grid h-full w-full place-items-center bg-sheet">
              <div className="h-[78%] w-[78%]">
                <PlotSketch envelope={p.envelope} width={brief?.plot?.width_ft} depth={brief?.plot?.depth_ft} />
              </div>
            </div>
          )}
        </div>
      </Link>
      <div className="flex items-start gap-2 px-5 pb-4 pt-4">
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") { setName(p.name); setEditing(false); }
              }}
              className="w-full rounded-lg bg-plaster px-2 py-1 font-display-text text-[18px] font-medium text-ink outline-none ring-1 ring-brick"
              aria-label="Project name"
            />
          ) : (
            <Link to={`/p/${p.id}`} className="block truncate font-display-text text-[18px] font-medium text-ink">
              {p.name}
            </Link>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Pill tone={toneMap[stageTone(p)]}>{stageLabel(p)}</Pill>
            <span className="text-[12.5px] text-pencil" title={new Date(p.updated_at).toLocaleString()}>
              Edited {relativeTime(p.updated_at)}
            </span>
          </div>
          {meta.length > 0 && (
            <p className="mt-2.5 flex flex-wrap gap-x-3 text-[12.5px] text-graphite">
              {meta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </p>
          )}
        </div>
        <Menu
          trigger={({ toggle, open }) => (
            <button
              onClick={toggle}
              aria-label="Project actions"
              aria-expanded={open}
              className="grid size-8 place-items-center rounded-full text-graphite transition-colors hover:bg-wash hover:text-ink"
            >
              <Ellipsis className="size-4" strokeWidth={1.75} />
            </button>
          )}
          items={[
            { label: "Open", icon: <ArrowRight className="size-3.5" strokeWidth={1.75} />, onSelect: () => navigate(`/p/${p.id}`) },
            { label: "Rename", icon: <PencilLine className="size-3.5" strokeWidth={1.75} />, onSelect: () => setEditing(true) },
            { label: "Delete", icon: <Trash className="size-3.5" strokeWidth={1.75} />, onSelect: onDelete, danger: true },
          ]}
        />
      </div>
    </article>
  );
}
