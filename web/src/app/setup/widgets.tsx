/**
 * The one widget each setup question carries (DESIGN.md "Brief → Rounds"): plot, floors (per-floor program with
 * steppers and a capacity meter), roof (tank and solar), style, the map pin and plain chips. Every widget has
 * "Decide for me".
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, Minus, Plus } from "lucide-react";
import type { Brief, Chip as ChipT, Envelope } from "@contracts/api-types";
import { api, type IntakeBody } from "@/api/client";
import { PLOT_PRESETS, STYLE_OPTIONS, parseCoordinates, plotLabel, toMarla } from "@/api/domain";
import { cn, num } from "@/app/lib/utils";
import { Button, Chip, EASE_OUT, Meter, SPRING, Segmented } from "@/app/design/kit";
import { StyleArt } from "./StyleArt";
import {
  CATALOGUE,
  LEVEL_LABEL,
  bedroomsIn,
  capacity,
  chipsFor,
  describe,
  levelsFor,
  roomsLine,
  suggestMove,
  used,
  type LevelId,
  type Program,
} from "./catalogue";
import { chat } from "./chat";

export type Send = (body: IntakeBody, display?: string) => void;

export function QuestionActions({ children, onSkip, disabled, skipLabel = "Decide for me" }: { children?: ReactNode; onSkip?: () => void; disabled?: boolean; skipLabel?: string }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {children}
      {onSkip && (
        <Button variant="quiet" size="sm" onClick={onSkip} disabled={disabled}>
          {skipLabel}
        </Button>
      )}
    </div>
  );
}

export function Stepper({ value, min = 0, max = 9, onChange, label }: { value: number; min?: number; max?: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Fewer: ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink outline-none transition-[background-color,transform] duration-(--dur-press) hover:bg-surface-3 focus-visible:shadow-focus active:scale-90 disabled:opacity-30"
      >
        <Minus className="size-3.5" strokeWidth={2} />
      </button>
      <span className="w-6 text-center font-mono text-[15px] font-medium tabular-nums text-ink" aria-live="polite">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 6, opacity: 0 }} transition={{ duration: 0.16 }} className="inline-block">
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
      <button
        type="button"
        aria-label={`More: ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="grid size-8 place-items-center rounded-full bg-surface-2 text-ink outline-none transition-[background-color,transform] duration-(--dur-press) hover:bg-surface-3 focus-visible:shadow-focus active:scale-90 disabled:opacity-30"
      >
        <Plus className="size-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Plot ────────────────────────────────────────────────────────────────────────────────────────────

export function PlotEditor({ brief, onDone, doneLabel, onSkip, disabled }: { brief: Brief | null; onDone: (w: number, d: number, corner: boolean, label: string) => void; doneLabel?: (marla: number) => string; onSkip?: () => void; disabled?: boolean }) {
  const initial = brief?.plot?.width_ft ? { w: brief.plot.width_ft, d: brief.plot.depth_ft } : null;
  const [preset, setPreset] = useState<string | null>(() => PLOT_PRESETS.find((p) => initial && p.width_ft === initial.w && p.depth_ft === initial.d)?.id ?? null);
  const [w, setW] = useState(initial ? String(initial.w) : "");
  const [d, setD] = useState(initial ? String(initial.d) : "");
  const [corner, setCorner] = useState<"mid" | "corner">(brief?.plot?.corner ? "corner" : "mid");
  const width = Number(w);
  const depth = Number(d);
  const valid = width >= 10 && depth >= 20 && width <= 400 && depth <= 600;
  const marla = valid ? toMarla(width, depth) : 0;

  useEffect(() => {
    if (!valid) { chat.setPreview(null); return; }
    const c = new AbortController();
    const t = setTimeout(async () => {
      try {
        const envelope = await api.getEnvelope({ width_ft: width, depth_ft: depth, corner: corner === "corner", authority: brief?.authority ?? "LDA" }, { signal: c.signal });
        chat.setPreview({ width, depth, corner: corner === "corner", envelope });
      } catch {
        chat.setPreview({ width, depth, corner: corner === "corner", envelope: null });
      }
    }, 160);
    return () => { clearTimeout(t); c.abort(); };
  }, [valid, width, depth, corner, brief?.authority]);
  useEffect(() => () => chat.setPreview(null), []);

  const pick = (id: string) => {
    const p = PLOT_PRESETS.find((x) => x.id === id)!;
    setPreset(id);
    setW(String(p.width_ft));
    setD(String(p.depth_ft));
  };
  const label = () => {
    const p = PLOT_PRESETS.find((x) => x.id === preset);
    return `${p ? p.label : plotLabel(marla)} plot, ${num(width, 1)} × ${num(depth, 1)} ft, ${corner === "corner" ? "corner" : "mid-row"}`;
  };
  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {PLOT_PRESETS.map((p) => {
          const active = preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => pick(p.id)}
              aria-pressed={active}
              className={cn(
                "relative rounded-control px-3 py-2.5 text-left outline-none transition-[background-color,box-shadow] duration-(--dur-fast) focus-visible:shadow-focus",
                active ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent)]" : "bg-surface shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-surface-2",
              )}
            >
              <span className={cn("block text-[14px] font-medium", active ? "text-accent" : "text-ink")}>{p.label}</span>
              <span className="block font-mono text-[12px] tabular-nums text-ink-3">
                {p.width_ft}′ × {p.depth_ft}′
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[13px] text-ink-3">
          <span className="sr-only">Width in feet</span>
          <input
            inputMode="decimal"
            value={w}
            placeholder="Width"
            onChange={(e) => { setPreset(null); setW(e.target.value.replace(/[^\d.]/g, "")); }}
            className="h-10 w-20 rounded-control bg-surface px-3 text-center font-mono text-[14px] tabular-nums text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)] outline-none focus:shadow-[inset_0_0_0_1px_var(--color-accent),var(--shadow-focus)]"
          />
        </label>
        <span className="text-ink-3">×</span>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Depth in feet</span>
          <input
            inputMode="decimal"
            value={d}
            placeholder="Depth"
            onChange={(e) => { setPreset(null); setD(e.target.value.replace(/[^\d.]/g, "")); }}
            className="h-10 w-20 rounded-control bg-surface px-3 text-center font-mono text-[14px] tabular-nums text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)] outline-none focus:shadow-[inset_0_0_0_1px_var(--color-accent),var(--shadow-focus)]"
          />
        </label>
        <span className="text-[13px] text-ink-3">ft</span>
        <span className="ml-auto font-mono text-[12.5px] tabular-nums text-ink-3">{valid ? `${num(width * depth)} sq ft · ${num(marla, 1)} marla` : "225 sq ft = 1 marla"}</span>
      </div>
      <div className="mt-3">
        <Segmented
          label="Plot position"
          value={corner}
          onChange={setCorner}
          options={[
            { value: "mid", label: "Mid-row" },
            { value: "corner", label: "Corner" },
          ]}
        />
      </div>
      <QuestionActions onSkip={onSkip} disabled={disabled}>
        <Button variant="primary" size="sm" disabled={!valid || disabled} onClick={() => onDone(width, depth, corner === "corner", label())}>
          {valid ? (doneLabel ? doneLabel(marla) : `Use this ${plotLabel(marla)} plot`) : "Pick a size"}
        </Button>
      </QuestionActions>
    </div>
  );
}

export function PlotWidget({ brief, onSend, onSkip, disabled }: { brief: Brief | null; onSend: Send; onSkip: () => void; disabled?: boolean }) {
  return (
    <PlotEditor
      brief={brief}
      disabled={disabled}
      onSkip={onSkip}
      onDone={(w, d, corner, label) => onSend({ message: label, chips: [`plot:${w}x${d}`, `corner:${corner}`] }, label)}
    />
  );
}

// ── Floors ──────────────────────────────────────────────────────────────────────────────────────────

/** The per-floor program: storeys, a tab per floor, catalogue steppers and the floor's capacity meter. */
export function FloorsEditor({
  brief,
  envelope,
  program,
  storeys,
  onChange,
}: {
  brief: Brief | null;
  envelope: Envelope | null;
  program: Program;
  storeys: number;
  onChange: (p: Program, storeys: number) => void;
}) {
  const levels = levelsFor(storeys);
  const [tab, setTab] = useState<LevelId>(levels.includes("first") ? "first" : "ground");
  const active = levels.includes(tab) ? tab : levels[0];
  const marla = brief?.plot?.area_marla || 10;
  const rooms = program[active] ?? {};
  const cap = capacity(active, envelope, brief);
  const use = used(active, rooms, marla);
  const ratio = cap ? use / cap : 0;
  const move = suggestMove(program, levels, envelope, brief);
  const set = (id: string, n: number) => onChange({ ...program, [active]: { ...rooms, [id]: Math.max(0, n) } }, storeys);
  const items = CATALOGUE.filter((c) => c.on.includes(active));
  const beds = bedroomsIn(program);

  const doMove = () => {
    if (!move) return;
    const from = { ...(program[move.from] ?? {}) };
    from[move.id] = Math.max(0, (from[move.id] ?? 0) - 1);
    const to = { ...(program[move.to] ?? {}) };
    to[move.id] = (to[move.id] ?? 0) + 1;
    onChange({ ...program, [move.from]: from, [move.to]: to }, storeys);
  };
  const moveItem = move ? CATALOGUE.find((c) => c.id === move.id) : undefined;

  return (
    <div className="@container">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Segmented
          label="Storeys"
          size="sm"
          value={String(storeys)}
          onChange={(v) => onChange(program, Number(v))}
          options={[
            { value: "1", label: "1 storey" },
            { value: "2", label: "2" },
            { value: "3", label: "3", title: "LDA allows up to three" },
          ]}
        />
        <span className="text-[13px] text-ink-3">
          {beds} {beds === 1 ? "bedroom" : "bedrooms"} in all
        </span>
      </div>

      <div className="mt-3 flex gap-1 border-b border-line" role="tablist" aria-label="Floor">
        {[...levels].map((l) => {
          const r = program[l] ?? {};
          const over = used(l, r, marla) > capacity(l, envelope, brief);
          return (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={l === active}
              onClick={() => setTab(l)}
              className={cn("relative -mb-px px-3 pb-2 pt-1 text-[13px] font-medium outline-none transition-colors focus-visible:shadow-focus", l === active ? "text-ink" : "text-ink-3 hover:text-ink")}
            >
              {LEVEL_LABEL[l]}
              {over && <span className="ml-1.5 inline-block size-1.5 rounded-full bg-warn align-middle" />}
              {l === active && <motion.span layoutId="floors-tab" transition={SPRING} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-ink" />}
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-[12.5px]">
          <span className="text-ink-3">{LEVEL_LABEL[active]} floor{active === "roof" ? " (beside the stair tower)" : ""}</span>
          <span className={cn("font-mono tabular-nums", ratio > 1 ? "text-fail" : ratio > 0.9 ? "text-warn" : "text-ink-2")}>
            {num(use)} of {num(cap)} sq ft
          </span>
        </div>
        <motion.div key={ratio > 1 ? "over" : "ok"} animate={ratio > 1 ? { x: [0, -3, 3, -2, 0] } : {}} transition={{ duration: 0.32 }}>
          <Meter value={use} max={cap} height={4} className="mt-1.5" tone={ratio > 1 ? "fail" : ratio > 0.9 ? "warn" : "ink"} />
        </motion.div>
        <AnimatePresence>
          {ratio > 1 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-control bg-warn-soft px-3 py-2 text-[13px] text-ink">
                <span>
                  Too much for the {LEVEL_LABEL[active].toLowerCase()} floor.
                  {move && moveItem && move.from === active ? ` Move the ${moveItem.label.replace(" + bath", "").toLowerCase()} ${levelsFor(storeys).indexOf(move.to) < levelsFor(storeys).indexOf(move.from) ? "down" : "up"}?` : ""}
                </span>
                {move && move.from === active && (
                  <button type="button" onClick={doMove} className="font-medium text-accent hover:underline">
                    Move it to the {LEVEL_LABEL[move.to].toLowerCase()} floor
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ul className="mt-2 grid gap-x-6 @lg:grid-cols-2">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0 @lg:[&:nth-last-child(2)]:border-b-0">
            <span className="min-w-0">
              <span className="block truncate text-[14px] text-ink">{c.label}</span>
              {c.hint && <span className="block text-[12px] text-ink-3">{c.hint}</span>}
            </span>
            <Stepper label={c.label} value={rooms[c.id] ?? 0} max={c.max} onChange={(n) => set(c.id, n)} />
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-0.5 text-[12.5px] text-ink-3">
        {levels
          .filter((l) => l !== active && roomsLine(program[l]))
          .map((l) => (
            <p key={l}>
              <span className="text-ink-2">{LEVEL_LABEL[l]}:</span> {roomsLine(program[l])}
            </p>
          ))}
      </div>
    </div>
  );
}

export function FloorsWidget({ brief, envelope, initial, onSend, onSkip, disabled }: { brief: Brief | null; envelope: Envelope | null; initial: Program; onSend: Send; onSkip: () => void; disabled?: boolean }) {
  const [program, setProgram] = useState<Program>(initial);
  const [storeys, setStoreys] = useState(Math.max(1, Math.min(3, brief?.storeys || 2)));
  const levels = levelsFor(storeys);
  const send = () => {
    const text = describe(program, levels);
    onSend({ message: text, chips: chipsFor(program, levels) }, text || "Use this layout");
  };
  return (
    <div>
      <FloorsEditor
        brief={brief}
        envelope={envelope}
        program={program}
        storeys={storeys}
        onChange={(p, s) => {
          setProgram(p);
          setStoreys(s);
        }}
      />
      <QuestionActions onSkip={onSkip} disabled={disabled}>
        <Button variant="primary" size="sm" onClick={send} disabled={disabled}>
          Use these floors
        </Button>
      </QuestionActions>
    </div>
  );
}

// ── Roof ────────────────────────────────────────────────────────────────────────────────────────────

export function TankArt({ kind, className }: { kind: "plastic" | "concrete"; className?: string }) {
  return (
    <svg viewBox="0 0 160 96" className={className} aria-hidden fill="none">
      <path d="M8 84H152" stroke="#CFCFC8" strokeWidth="1.5" />
      {kind === "plastic" ? (
        <g>
          <path d="M28 84V64H132V84" stroke="#A1A1A6" strokeWidth="1.5" />
          <path d="M60 64V54M100 64V54M58 54H102" stroke="#6E6E73" strokeWidth="1.6" />
          <rect x="56" y="18" width="48" height="36" rx="8" fill="#3D6FE0" />
          <path d="M60 26H100M60 34H100M60 42H100" stroke="#2C57C2" strokeWidth="1.2" />
          <ellipse cx="80" cy="18" rx="12" ry="3" fill="#2C57C2" />
        </g>
      ) : (
        <g>
          <path d="M28 84V64H132V84" stroke="#A1A1A6" strokeWidth="1.5" />
          <rect x="60" y="22" width="56" height="62" fill="#EEEEEA" stroke="#46464B" strokeWidth="1.5" />
          <rect x="60" y="22" width="56" height="16" fill="#D9D9D3" stroke="#46464B" strokeWidth="1.5" />
          <path d="M70 84V58H84V84" stroke="#46464B" strokeWidth="1.4" />
          <text x="88" y="33" fontSize="7" fill="#46464B" fontFamily="Geist, sans-serif">
            tank
          </text>
        </g>
      )}
    </svg>
  );
}

export function SolarArt({ mode, className }: { mode: "ready" | "panels" | "none"; className?: string }) {
  return (
    <svg viewBox="0 0 160 96" className={className} aria-hidden fill="none">
      <path d="M8 84H152M28 84V62H132V84" stroke="#A1A1A6" strokeWidth="1.5" />
      {mode === "ready" && (
        <g>
          <rect x="36" y="50" width="88" height="10" fill="#EDF0FF" stroke="#2747F5" strokeWidth="1.3" strokeDasharray="4 3" />
          <path d="M80 30v8M68 34l4 5M92 34l-4 5" stroke="#2747F5" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      )}
      {mode === "panels" && (
        <g>
          <path d="M40 62V44M120 62V44M40 44H120" stroke="#6E6E73" strokeWidth="1.4" />
          {[0, 1, 2, 3].map((i) => (
            <polygon key={i} points={`${42 + i * 20},44 ${60 + i * 20},44 ${56 + i * 20},30 ${38 + i * 20},30`} fill="#2747F5" opacity="0.88" stroke="#1F3BD6" strokeWidth="0.8" />
          ))}
        </g>
      )}
      {mode === "none" && <path d="M64 48h32" stroke="#A1A1A6" strokeWidth="1.5" strokeLinecap="round" />}
    </svg>
  );
}

export function RoofEditor({
  tank,
  solar,
  onChange,
  panels,
}: {
  tank: "plastic" | "concrete" | undefined;
  solar: "none" | "ready" | "panels" | undefined;
  onChange: (tank: "plastic" | "concrete", solar: "none" | "ready" | "panels") => void;
  panels: { count: number; kw: number };
}) {
  const t = tank ?? "concrete";
  const s = solar ?? "ready";
  const card = (active: boolean) =>
    cn(
      "group relative flex flex-col rounded-card p-3 text-left outline-none transition-[background-color,box-shadow] duration-(--dur-fast) focus-visible:shadow-focus",
      active ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent)]" : "bg-surface shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:bg-surface-2",
    );
  return (
    <div className="@container space-y-4">
      <div>
        <p className="mb-2 text-label text-ink-2">Water tank</p>
        <div className="grid grid-cols-2 gap-2">
          {(["plastic", "concrete"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={t === k} onClick={() => onChange(k, s)} className={card(t === k)}>
              <TankArt kind={k} className="h-auto w-full" />
              <span className="mt-2 text-[14px] font-medium text-ink">{k === "plastic" ? "Blue plastic tank" : "Concrete tank in the stair tower"}</span>
              <span className="text-[12.5px] text-ink-3">{k === "plastic" ? "Cheaper, visible from the street" : "Hidden, and lasts decades"}</span>
              {k === "concrete" && <span className="mt-1 text-[12px] font-medium text-pass">Recommended</span>}
              {t === k && <Check className="absolute right-2.5 top-2.5 size-4 text-accent" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-label text-ink-2">Rooftop solar</p>
        <div className="grid gap-2 @lg:grid-cols-3">
          {(["ready", "panels", "none"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={s === k} onClick={() => onChange(t, k)} className={cn(card(s === k), "flex-row items-center gap-3 @lg:flex-col @lg:items-stretch @lg:gap-0")}>
              <SolarArt mode={k} className="h-auto w-24 shrink-0 @lg:w-full" />
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium leading-snug text-ink @lg:mt-1.5">{k === "ready" ? "Keep the roof clear for solar" : k === "panels" ? "Raised solar frame" : "Not now"}</span>
                <span className="block text-[12px] text-ink-3">{k === "ready" ? `About ${panels.count} panels, ~${panels.kw} kW` : k === "panels" ? "Panels on a frame you can sit under" : "Use the roof as a terrace"}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[12.5px] text-ink-3">No domes, minarets or chhatris unless you ask for them.</p>
      </div>
    </div>
  );
}

/** Panels that fit on a clear roof: about 55% of the floor plate, 26 sq ft and 0.55 kW a panel. */
export function solarEstimate(envelope: Envelope | null, brief: Brief | null): { count: number; kw: number } {
  const floor = capacity("ground", envelope, brief);
  const count = Math.max(4, Math.round((floor * 0.33) / 26));
  return { count, kw: Math.round(count * 0.55) };
}

export function RoofWidget({ brief, envelope, onSend, onSkip, disabled }: { brief: Brief | null; envelope: Envelope | null; onSend: Send; onSkip: () => void; disabled?: boolean }) {
  const [tank, setTank] = useState<"plastic" | "concrete">(brief?.water_tank ?? "concrete");
  const [solar, setSolar] = useState<"none" | "ready" | "panels">(brief?.solar ?? "ready");
  const panels = solarEstimate(envelope, brief);
  const send = () => {
    const text = `${tank === "plastic" ? "Blue plastic tank" : "Concrete tank in the stair tower"}; ${solar === "ready" ? "keep the roof clear for solar" : solar === "panels" ? "a raised solar frame" : "no solar for now"}`;
    onSend({ message: text, chips: [`tank:${tank}`, `solar:${solar}`] }, text);
  };
  return (
    <div>
      <RoofEditor tank={tank} solar={solar} panels={panels} onChange={(t, s) => { setTank(t); setSolar(s); }} />
      <QuestionActions onSkip={onSkip} disabled={disabled}>
        <Button variant="primary" size="sm" onClick={send} disabled={disabled}>
          Continue
        </Button>
      </QuestionActions>
    </div>
  );
}

// ── Style ───────────────────────────────────────────────────────────────────────────────────────────

export function StyleEditor({ current, offered, onPick, disabled }: { current?: string; offered?: string[]; onPick: (name: string) => void; disabled?: boolean }) {
  const [all, setAll] = useState(false);
  const first = useMemo(() => {
    const names = offered?.length ? offered : ["Modern Contemporary", "Spanish", "Minimalist"];
    return names.map((n) => STYLE_OPTIONS.find((s) => s.name === n)).filter((s): s is (typeof STYLE_OPTIONS)[number] => !!s).slice(0, 3);
  }, [offered]);
  const list = all ? STYLE_OPTIONS : first;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {list.map((s) => {
          const active = current === s.name;
          return (
            <motion.button
              layout
              key={s.name}
              type="button"
              disabled={disabled}
              onClick={() => onPick(s.name)}
              aria-pressed={active}
              className={cn(
                "group overflow-hidden rounded-card text-left outline-none transition-shadow duration-(--dur-fast) focus-visible:shadow-focus",
                active ? "shadow-[inset_0_0_0_1.5px_var(--color-accent)]" : "shadow-e1 hover:shadow-e2",
              )}
            >
              <div className="relative bg-surface-2 px-2 pt-2">
                <StyleArt style={s} className="h-auto w-full transition-transform duration-(--dur-slow) ease-out group-hover:scale-[1.02]" />
                {active && (
                  <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-accent text-white">
                    <Check className="size-3" strokeWidth={2.5} />
                  </span>
                )}
              </div>
              <div className="bg-surface px-3 pb-2.5 pt-2">
                <span className="block text-[13.5px] font-medium text-ink">{s.name}</span>
                <span className="mt-0.5 line-clamp-1 block text-[12px] text-ink-3">{s.blurb}</span>
              </div>
            </motion.button>
          );
        })}
      </div>
      {!all && (
        <button type="button" onClick={() => setAll(true)} className="mt-2 text-[13px] font-medium text-ink-2 hover:text-ink">
          More styles
        </button>
      )}
    </div>
  );
}

export function StyleWidget({ chips, current, onSend, onSkip, disabled }: { chips?: ChipT[]; current?: string; onSend: Send; onSkip: () => void; disabled?: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div>
      <StyleEditor
        current={picked ?? current}
        offered={chips?.map((c) => c.value)}
        disabled={disabled || !!picked}
        onPick={(name) => {
          setPicked(name);
          setTimeout(() => onSend({ message: name, chips: [name] }, name), 200);
        }}
      />
      <QuestionActions onSkip={onSkip} disabled={disabled || !!picked} />
    </div>
  );
}

// ── Facing and map pin ──────────────────────────────────────────────────────────────────────────────

const DIRS: NonNullable<Brief["facing"]>[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const DIR_NAME: Record<string, string> = { N: "North", NE: "North-east", E: "East", SE: "South-east", S: "South", SW: "South-west", W: "West", NW: "North-west" };

/** An 8-way compass: which way the front of the plot (the road side) faces. */
export function FacingPicker({ value, onChange }: { value?: string; onChange: (f: NonNullable<Brief["facing"]>) => void }) {
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-[132px] shrink-0 rounded-full bg-surface-2" role="radiogroup" aria-label="The front faces">
        {DIRS.map((d, i) => {
          const a = (i * 45 * Math.PI) / 180;
          const x = 66 + Math.sin(a) * 48;
          const y = 66 - Math.cos(a) * 48;
          const active = value === d;
          return (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={DIR_NAME[d]}
              onClick={() => onChange(d)}
              className={cn(
                "absolute grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[12px] font-medium outline-none transition-colors focus-visible:shadow-focus",
                active ? "bg-accent text-white" : "bg-surface text-ink-2 shadow-e1 hover:text-ink",
              )}
              style={{ left: x, top: y }}
            >
              {d}
            </button>
          );
        })}
        <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-3" />
      </div>
      <p className="text-[13px] leading-snug text-ink-3">{value ? `The front, on the road, faces ${DIR_NAME[value].toLowerCase()}.` : "Which way does the road side face?"}</p>
    </div>
  );
}

export function MapWidget({ chips, onSend, onSkip, disabled }: { chips?: ChipT[]; onSend: Send; onSkip: () => void; disabled?: boolean }) {
  const [value, setValue] = useState("");
  const [facing, setFacing] = useState<string | undefined>();
  const coords = useMemo(() => (value.trim() ? parseCoordinates(value) : null), [value]);
  const offersFacing = !!chips?.length;
  const send = () => {
    const parts = [facing ? `The front faces ${DIR_NAME[facing].toLowerCase()}` : null, coords ? `Pin: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : null].filter(Boolean) as string[];
    onSend({ message: parts.join(". "), chips: [...(facing ? [facing] : []), ...(coords ? [`coords:${coords.lat},${coords.lng}`] : [])] }, parts.join(". "));
  };
  return (
    <div className="space-y-3">
      {offersFacing && <FacingPicker value={facing} onChange={setFacing} />}
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (coords || facing) && send()}
        placeholder="Paste a Google Maps link, or 31.4697, 74.2728"
        aria-label="Google Maps link or coordinates"
        className="h-11 w-full rounded-control bg-surface px-3.5 text-body text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)] outline-none placeholder:text-ink-4 focus:shadow-[inset_0_0_0_1px_var(--color-accent),var(--shadow-focus)]"
      />
      {value.trim() && <p className={cn("text-[12.5px]", coords ? "text-pass" : "text-warn")}>{coords ? `Found ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "No coordinates in that yet. Links with @31.47,74.27 work."}</p>}
      <QuestionActions onSkip={onSkip} disabled={disabled} skipLabel="Skip the pin">
        <Button variant="primary" size="sm" disabled={(!coords && !facing) || disabled} onClick={send}>
          Continue
        </Button>
      </QuestionActions>
    </div>
  );
}

// ── Plain chips ─────────────────────────────────────────────────────────────────────────────────────

export function ChipsWidget({ chips, multi, onSend, onSkip, disabled }: { chips: ChipT[]; multi?: boolean; onSend: Send; onSkip?: () => void; disabled?: boolean }) {
  const [picked, setPicked] = useState<string[]>([]);
  if (!multi) {
    return (
      <div>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <Chip key={c.value} tone="suggestion" disabled={disabled} onClick={() => onSend({ message: c.label, chips: [c.value] }, c.label)} title={c.hint}>
              {c.label}
              {c.hint && <span className="font-normal text-ink-3">{c.hint}</span>}
            </Chip>
          ))}
        </div>
        {onSkip && <QuestionActions onSkip={onSkip} disabled={disabled} />}
      </div>
    );
  }
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const labels = chips.filter((c) => picked.includes(c.value)).map((c) => c.label);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Chip key={c.value} selected={picked.includes(c.value)} onClick={() => toggle(c.value)} disabled={disabled} title={c.hint}>
            {c.label}
          </Chip>
        ))}
      </div>
      <QuestionActions onSkip={onSkip} disabled={disabled}>
        <Button variant="primary" size="sm" disabled={!picked.length || disabled} onClick={() => onSend({ message: labels.join(", "), chips: picked }, labels.join(", "))}>
          Continue
        </Button>
      </QuestionActions>
    </div>
  );
}

export const roofChips = (chips?: ChipT[]) => !!chips?.some((c) => c.value.startsWith("tank:") || c.value.startsWith("solar:"));

export { EASE_OUT };
