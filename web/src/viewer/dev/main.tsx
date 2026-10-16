/**
 * Viewer dev harness (web/dev/viewer.html): mounts HouseViewer with fixture plans + design.js and a control panel.
 * URL params: ?fixture=argon-v1|plan-10-marla &mode=walk &hour=17.5 &panel=0 &levels=ground,first &cut=4.6 &comment=1
 * Dev builds expose window.__viewerDebug (activate walk without pointer lock, hold keys, teleport, capture…).
 */
import { StrictMode, useCallback, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import type { BuildingPlan } from "@contracts/plan";
import type { Layer } from "@contracts/house-sdk";
import type { Comment } from "@contracts/api-types";
import { parseDesign, type SectionResult } from "@/engine";
import { HouseViewer, type HouseViewerProps, type ViewerHandle } from "../HouseViewer";

const planFiles = import.meta.glob<BuildingPlan>("../../../../contracts/fixtures/*plan*.json", { eager: true, import: "default" });
const designFiles = import.meta.glob<string>("../../../../contracts/fixtures/*design*.js", { eager: true, query: "?raw", import: "default" });

interface Fixture { id: string; plan: BuildingPlan; design: string | null }
const base = (p: string) => p.split("/").pop()!.replace(/\.(json|js)$/, "");
const FIXTURES: Fixture[] = Object.entries(planFiles)
  .map(([path, plan]) => {
    const name = base(path);
    const designKey = Object.keys(designFiles).find((k) => base(k) === name.replace("plan", "design"));
    const id = name.replace(/-?plan-?/, "") || name;
    return { id, plan, design: designKey ? designFiles[designKey] : null };
  })
  .sort((a, b) => (a.id === "10-marla" ? -1 : b.id === "10-marla" ? 1 : a.id.localeCompare(b.id)));

const LAYERS: Layer[] = ["structure", "facade", "interior", "furniture", "landscape", "lighting", "custom"];
const STATUSES: Comment["status"][] = ["open", "partial", "resolved", "rejected"];
const STATUS_DOT: Record<Comment["status"], string> = { open: "#f59e0b", resolved: "#10b981", partial: "#3b82f6", rejected: "#ef4444" };

const qs = new URLSearchParams(location.search);

function Harness() {
  const [fixtureId, setFixtureId] = useState(() => {
    const want = qs.get("fixture")?.replace(/-?plan-?/, "");
    return FIXTURES.find((f) => f.id === want)?.id ?? FIXTURES[0]?.id;
  });
  const fixture = FIXTURES.find((f) => f.id === fixtureId) ?? FIXTURES[0];
  const sections = useMemo(() => (fixture.design ? parseDesign(fixture.design) : []), [fixture]);
  const [mode, setMode] = useState<"orbit" | "walk">(qs.get("mode") === "walk" ? "walk" : "orbit");
  const [levels, setLevels] = useState<Record<string, boolean>>(() => {
    const only = qs.get("levels")?.split(",");
    return only ? Object.fromEntries(fixture.plan.levels.map((l) => [l.id, only.includes(l.id)])) : {};
  });
  const [layers, setLayers] = useState<Partial<Record<Layer, boolean>>>({});
  const [cutOn, setCutOn] = useState(qs.has("cut"));
  const [cut, setCut] = useState(Number(qs.get("cut") ?? 4.6));
  const [hour, setHour] = useState(Number(qs.get("hour") ?? 16.5));
  const [commentMode, setCommentMode] = useState(qs.get("comment") === "1");
  const [comments, setComments] = useState<Comment[]>([]);
  const [snaps, setSnaps] = useState<Record<string, string>>({});
  const [capture, setCapture] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [ready, setReady] = useState("");
  const [panel, setPanel] = useState(qs.get("panel") !== "0");
  const viewer = useRef<ViewerHandle>(null);

  const visibleLevels = useMemo(() => {
    const ids = fixture.plan.levels.map((l) => l.id);
    const vis = ids.filter((id) => levels[id] !== false);
    return vis.length === ids.length ? undefined : vis;
  }, [fixture, levels]);

  const onAddComment = useCallback<NonNullable<HouseViewerProps["onAddComment"]>>((d) => {
    const id = `c${Date.now().toString(36)}`;
    setComments((cs) => [
      ...cs,
      {
        id,
        version_id: "dev",
        text: `Note on ${d.anchor.label ?? d.anchor.kind ?? "surface"}`,
        anchor: d.anchor,
        camera: d.camera,
        created_at: new Date().toISOString(),
        status: "open",
      },
    ]);
    setSnaps((s) => ({ ...s, [id]: d.snapshot }));
    console.info("[harness] onAddComment", d.anchor, d.camera, `${Math.round(d.snapshot.length / 1024)} KB snapshot`);
  }, []);

  const onBuildProgress = useCallback((r: SectionResult, done: number, total: number) => setProgress(`${done}/${total} · ${r.name}${r.ok ? "" : " ✗"}`), []);
  const onReady = useCallback<NonNullable<HouseViewerProps["onReady"]>>((r) => setReady(`${r.sections.length} sections · ${r.summary.objects.length} objects`), []);
  const onExitWalk = useCallback(() => setMode("orbit"), []);
  const onSelectComment = useCallback((id: string) => {
    const c = commentsRef.current.find((x) => x.id === id);
    if (c) viewer.current?.flyTo(c);
  }, []);
  const commentsRef = useRef(comments);
  commentsRef.current = comments;

  return (
    <div className="flex h-full w-full bg-neutral-950 text-neutral-100">
      <div className="relative min-w-0 flex-1">
        <HouseViewer
          key={fixture.id}
          ref={viewer}
          plan={fixture.plan}
          sections={sections}
          mode={mode}
          visibleLevels={visibleLevels}
          layers={layers}
          sectionCut={cutOn ? cut : null}
          sunHour={hour}
          comments={comments}
          commentMode={commentMode}
          onAddComment={onAddComment}
          onSelectComment={onSelectComment}
          onBuildProgress={onBuildProgress}
          onReady={onReady}
          onExitWalk={onExitWalk}
        />
        <button
          className="absolute right-3 bottom-3 z-40 rounded-lg bg-black/50 px-2.5 py-1.5 text-xs text-white/80 backdrop-blur hover:bg-black/70"
          onClick={() => setPanel((p) => !p)}
        >
          {panel ? "Hide panel" : "Panel"}
        </button>
      </div>
      {panel && (
        <aside className="flex w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-white/10 bg-neutral-900 p-4 text-[13px]">
          <header>
            <div className="text-[11px] tracking-[0.12em] text-white/40 uppercase">Naqsha · viewer harness</div>
            <div className="mt-1 text-white/60">{progress || "…"}</div>
            {ready && <div className="text-emerald-400/90">{ready}</div>}
          </header>

          <Field label="Fixture">
            <select className="w-full rounded-md border border-white/10 bg-neutral-800 px-2 py-1.5" value={fixture.id} onChange={(e) => setFixtureId(e.target.value)}>
              {FIXTURES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id} {f.design ? `(design.js, ${parseDesign(f.design).length} sections)` : "(no design → default)"}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Mode">
            <Seg value={mode} options={["orbit", "walk"]} onChange={(m) => setMode(m as "orbit" | "walk")} />
          </Field>

          <Field label="Levels (hiding one hides everything above)">
            <div className="flex flex-wrap gap-1.5">
              {fixture.plan.levels.map((l) => (
                <Toggle key={l.id} on={levels[l.id] !== false} onClick={() => setLevels((s) => ({ ...s, [l.id]: s[l.id] === false }))}>
                  {l.name}
                </Toggle>
              ))}
            </div>
          </Field>

          <Field label="Layers">
            <div className="flex flex-wrap gap-1.5">
              {LAYERS.map((l) => (
                <Toggle key={l} on={layers[l] !== false} onClick={() => setLayers((s) => ({ ...s, [l]: s[l] === false }))}>
                  {l}
                </Toggle>
              ))}
            </div>
          </Field>

          <Field label={`Section cut ${cutOn ? `· ${cut.toFixed(2)} m` : "· off"}`}>
            <div className="flex items-center gap-2">
              <Toggle on={cutOn} onClick={() => setCutOn((v) => !v)}>
                {cutOn ? "On" : "Off"}
              </Toggle>
              <input className="flex-1 accent-amber-500" type="range" min={0.3} max={9} step={0.05} value={cut} disabled={!cutOn} onChange={(e) => setCut(Number(e.target.value))} />
            </div>
          </Field>

          <Field label={`Sun · ${fmtHour(hour)}`}>
            <input className="w-full accent-amber-500" type="range" min={6} max={19} step={0.25} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
          </Field>

          <Field label="Comments">
            <Toggle on={commentMode} onClick={() => setCommentMode((v) => !v)}>
              {commentMode ? "Comment mode on" : "Comment mode off"}
            </Toggle>
            <ul className="mt-2 flex flex-col gap-2">
              {comments.map((c, i) => (
                <li key={c.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
                  <div className="flex items-center gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: STATUS_DOT[c.status] }}>
                      {i + 1}
                    </span>
                    <input
                      className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 outline-none focus:bg-white/5"
                      value={c.text}
                      onChange={(e) => setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
                    />
                  </div>
                  <div className="mt-1 truncate text-[11px] text-white/45">
                    {c.anchor.kind ?? "?"} · {c.anchor.room ?? "?"} · {c.anchor.level ?? "?"}
                  </div>
                  {snaps[c.id] && <img className="mt-1.5 w-full rounded" src={snaps[c.id]} alt="snapshot" />}
                  <div className="mt-1.5 flex gap-1.5">
                    <MiniBtn onClick={() => viewer.current?.flyTo(c)}>Fly to</MiniBtn>
                    <MiniBtn onClick={() => setComments((cs) => cs.map((x) => (x.id === c.id ? { ...x, status: STATUSES[(STATUSES.indexOf(x.status) + 1) % STATUSES.length] } : x)))}>
                      {c.status}
                    </MiniBtn>
                    <MiniBtn onClick={() => setComments((cs) => cs.filter((x) => x.id !== c.id))}>Delete</MiniBtn>
                  </div>
                </li>
              ))}
              {!comments.length && <li className="text-white/40">Turn on comment mode and click a surface, or press C while walking.</li>}
            </ul>
          </Field>

          <Field label="Capture">
            <div className="flex gap-1.5">
              <MiniBtn onClick={async () => setCapture((await viewer.current?.capture()) ?? null)}>Capture view</MiniBtn>
              <MiniBtn onClick={async () => setCapture((await viewer.current?.capture({ width: 640, height: 360 })) ?? null)}>640×360</MiniBtn>
            </div>
            {capture && (
              <a href={capture} download="naqsha-view.png" className="mt-2 block">
                <img className="w-full rounded border border-white/10" src={capture} alt="capture" />
              </a>
            )}
          </Field>
        </aside>
      )}
    </div>
  );
}

const fmtHour = (h: number) => {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  const ap = hh >= 12 ? "pm" : "am";
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${ap}`;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 text-[11px] font-medium tracking-wide text-white/45 uppercase">{label}</div>
      {children}
    </section>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-2 py-1 text-[12px] transition ${on ? "border-amber-500/60 bg-amber-500/15 text-amber-200" : "border-white/10 bg-white/[0.03] text-white/50"}`}
    >
      {children}
    </button>
  );
}

function Seg({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`rounded-md px-3 py-1 text-[12px] capitalize ${value === o ? "bg-amber-500 text-black" : "text-white/60"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}

function MiniBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-[11.5px] text-white/75 hover:bg-white/10">
      {children}
    </button>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
