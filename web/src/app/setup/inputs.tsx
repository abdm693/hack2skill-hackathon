import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { ArrowRight, Check, ExternalLink, MapPin, Minus, Plus, SkipForward } from "lucide-react";
import type { Brief, Chip as ChipT } from "@contracts/api-types";
import { api, type IntakeBody } from "@/api/client";
import { PLOT_PRESETS, SPACE_OPTIONS, STYLE_OPTIONS, parseCoordinates, plotLabel, toMarla } from "@/api/domain";
import { cn, num } from "@/app/lib/utils";
import { Button } from "@/app/ui/Button";
import { Chip, Segmented } from "@/app/ui/primitives";
import { StyleArt } from "./StyleArt";
import { useSetupUI } from "./store";

export type Send = (body: IntakeBody, display?: string) => void;

/** Frame shared by every question widget: content plus a Skip control. */
export function QuestionFrame({
  children,
  onSkip,
  disabled,
  skipLabel = "Skip",
  prominentSkip,
}: {
  children: ReactNode;
  onSkip: () => void;
  disabled?: boolean;
  skipLabel?: string;
  prominentSkip?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      className={cn("mt-3", disabled && "pointer-events-none opacity-60")}
    >
      {children}
      {!prominentSkip && (
        <div className="mt-3 flex">
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-graphite transition-colors hover:bg-wash hover:text-ink"
          >
            <SkipForward className="size-3.5" strokeWidth={1.75} />
            {skipLabel}
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ── Chips ───────────────────────────────────────────────────────────────────────────────────────────

export function ChipsInput({ chips, multi, onSend, disabled }: { chips: ChipT[]; multi?: boolean; onSend: Send; disabled?: boolean }) {
  const [picked, setPicked] = useState<string[]>([]);
  if (!multi) {
    return (
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Chip key={c.value} hint={c.hint} disabled={disabled} onClick={() => onSend({ message: c.label, chips: [c.value] }, c.label)}>
            {c.label}
          </Chip>
        ))}
      </div>
    );
  }
  const toggle = (v: string) => setPicked((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v]));
  const labels = chips.filter((c) => picked.includes(c.value)).map((c) => c.label);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <Chip key={c.value} multi hint={c.hint} selected={picked.includes(c.value)} onClick={() => toggle(c.value)} disabled={disabled}>
            {c.label}
          </Chip>
        ))}
      </div>
      <Button
        variant="ink"
        size="sm"
        className="mt-3"
        disabled={!picked.length || disabled}
        onClick={() => onSend({ message: labels.join(", "), chips: picked }, labels.join(", "))}
        trailing={<ArrowRight className="size-3.5" strokeWidth={1.75} />}
      >
        Continue{picked.length ? ` with ${picked.length}` : ""}
      </Button>
    </div>
  );
}

// ── Plot ────────────────────────────────────────────────────────────────────────────────────────────

const MAX_W = Math.max(...PLOT_PRESETS.map((p) => p.width_ft));
const MAX_D = Math.max(...PLOT_PRESETS.map((p) => p.depth_ft));

export function PlotInput({ onSend, disabled, brief }: { onSend: Send; disabled?: boolean; brief: Brief | null }) {
  const initial = brief?.plot.width_ft ? { w: brief.plot.width_ft, d: brief.plot.depth_ft } : null;
  const [presetId, setPresetId] = useState<string | null>(initial ? null : null);
  const [w, setW] = useState<string>(initial ? String(initial.w) : "");
  const [d, setD] = useState<string>(initial ? String(initial.d) : "");
  const [corner, setCorner] = useState<boolean>(brief?.plot.corner ?? false);
  const setPreview = useSetupUI((s) => s.setPreview);

  const width = Number(w);
  const depth = Number(d);
  const valid = width >= 10 && depth >= 20 && width <= 400 && depth <= 600;
  const marla = valid ? toMarla(width, depth) : 0;

  // Live envelope preview in the side panel.
  useEffect(() => {
    if (!valid) { setPreview(null); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const envelope = await api.getEnvelope({ width_ft: width, depth_ft: depth, corner, authority: brief?.authority ?? "LDA" }, { signal: ctrl.signal });
        setPreview({ width, depth, corner, envelope });
      } catch {
        setPreview({ width, depth, corner, envelope: null });
      }
    }, 180);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [valid, width, depth, corner, brief?.authority, setPreview]);
  useEffect(() => () => setPreview(null), [setPreview]);

  const pick = (id: string) => {
    const p = PLOT_PRESETS.find((x) => x.id === id)!;
    setPresetId(id);
    setW(String(p.width_ft));
    setD(String(p.depth_ft));
  };

  const submit = () => {
    if (!valid) return;
    const preset = PLOT_PRESETS.find((p) => p.id === presetId);
    const label = `${preset ? preset.label : plotLabel(marla)} plot, ${num(width, 1)} × ${num(depth, 1)} ft${corner ? ", corner" : ""}`;
    onSend({ message: label, chips: [`plot:${width}x${depth}`, `corner:${corner}`] }, label);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PLOT_PRESETS.map((p) => {
          const active = presetId === p.id;
          const bw = (p.width_ft / MAX_W) * 30 + 4;
          const bh = (p.depth_ft / MAX_D) * 34 + 4;
          return (
            <button
              key={p.id}
              type="button"
              disabled={disabled}
              onClick={() => pick(p.id)}
              aria-pressed={active}
              className={cn(
                "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-[box-shadow,background-color] duration-200",
                active ? "bg-brick-soft shadow-[0_0_0_1.5px_var(--color-brick)]" : "bg-plaster shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_1px_var(--color-line-strong)]",
              )}
            >
              <span className="grid h-11 w-9 shrink-0 place-items-end justify-center">
                <span
                  className={cn("block border transition-colors", active ? "border-brick bg-brick/10" : "border-ink/50 bg-wash")}
                  style={{ width: bw, height: bh }}
                />
              </span>
              <span className="min-w-0">
                <span className="block font-display-text text-[16px] font-medium leading-tight text-ink">{p.label}</span>
                <span className="block text-[12px] text-graphite tabular">
                  {p.width_ft}' × {p.depth_ft}'
                </span>
              </span>
              {p.note && <span className="absolute right-2.5 top-2 text-[10px] font-medium text-brick">{p.note}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-plaster px-3 py-2.5 shadow-[0_0_0_1px_var(--color-line)]">
        <span className="text-[12.5px] font-medium text-graphite">Exact size</span>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Width in feet</span>
          <input
            inputMode="decimal"
            value={w}
            placeholder="W"
            onChange={(e) => { setPresetId(null); setW(e.target.value.replace(/[^\d.]/g, "")); }}
            className="h-8 w-16 rounded-lg bg-wash px-2 text-center text-[14px] font-medium tabular text-ink outline-none ring-brick focus:ring-1"
          />
        </label>
        <span className="text-pencil">×</span>
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Depth in feet</span>
          <input
            inputMode="decimal"
            value={d}
            placeholder="D"
            onChange={(e) => { setPresetId(null); setD(e.target.value.replace(/[^\d.]/g, "")); }}
            className="h-8 w-16 rounded-lg bg-wash px-2 text-center text-[14px] font-medium tabular text-ink outline-none ring-brick focus:ring-1"
          />
        </label>
        <span className="text-[12.5px] text-graphite">ft</span>
        <span className="min-w-[9rem] flex-1 text-right text-[12.5px] tabular text-graphite">
          {valid ? (
            <>
              {num(width * depth)} sq ft ÷ 225 = <span className="font-semibold text-ink">{num(marla, 1)} marla</span>
            </>
          ) : (
            "225 sq ft = 1 marla"
          )}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Chip size="sm" multi selected={corner} onClick={() => setCorner((c) => !c)} disabled={disabled}>
          Corner plot
        </Chip>
        <Button variant="primary" size="md" disabled={!valid || disabled} onClick={submit} trailing={<ArrowRight className="size-4" strokeWidth={1.75} />}>
          {valid ? `Use this ${plotLabel(marla)} plot` : "Pick a size"}
        </Button>
      </div>
    </div>
  );
}

// ── Style ───────────────────────────────────────────────────────────────────────────────────────────

export function StyleInput({ onSend, disabled, current }: { onSend: Send; disabled?: boolean; current?: string }) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
      {STYLE_OPTIONS.map((s) => {
        const active = picked === s.name || (!picked && current === s.name);
        return (
          <button
            key={s.name}
            type="button"
            disabled={disabled || !!picked}
            onClick={() => {
              setPicked(s.name);
              setTimeout(() => onSend({ message: s.name, chips: [s.name] }, s.name), 220);
            }}
            aria-pressed={active}
            className={cn(
              "group overflow-hidden rounded-2xl text-left transition-[box-shadow,transform] duration-300 ease-[var(--ease-out-quint)] active:scale-[0.98]",
              active ? "shadow-[0_0_0_1.5px_var(--color-brick)]" : "shadow-[0_0_0_1px_var(--color-line)] hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--color-line-strong),0_8px_18px_-10px_rgb(30_27_23/0.25)]",
            )}
          >
            <div className="relative bg-[linear-gradient(180deg,#f7f3ec,#efe9df)] px-2 pt-2">
              <StyleArt style={s} className="h-auto w-full" />
              {active && (
                <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-brick text-sheet">
                  <Check className="size-3" strokeWidth={2.5} />
                </span>
              )}
            </div>
            <div className="bg-plaster px-3 pb-2.5 pt-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold leading-tight text-ink">{s.name}</span>
                <span className="flex shrink-0 -space-x-1">
                  {s.palette.map((c) => (
                    <span key={c} className="size-3 rounded-full ring-1 ring-plaster" style={{ background: c }} />
                  ))}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-1 text-[11.5px] text-graphite">{s.blurb}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Rooms ───────────────────────────────────────────────────────────────────────────────────────────

const ROOM_TOGGLES = ["drawing", "tv_lounge", "dirty_kitchen", "servant_quarter", "lawn", "prayer", "roof_terrace", "study"];

/** "Drawing room" → "drawing room", but "TV lounge" stays. */
const sentenceLower = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

function Stepper({ label, value, min, max, onChange, hint }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; hint?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-plaster px-3 py-2 shadow-[0_0_0_1px_var(--color-line)]">
      <div>
        <p className="text-[13.5px] font-medium text-ink">{label}</p>
        {hint && <p className="text-[11.5px] text-pencil">{hint}</p>}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`Fewer ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          className="grid size-8 place-items-center rounded-full bg-wash text-ink transition-[background-color,transform] hover:bg-wash-2 active:scale-90 disabled:opacity-35"
        >
          <Minus className="size-3.5" strokeWidth={2} />
        </button>
        <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-7 text-center font-display-text text-[20px] font-medium tabular text-ink">
          {value}
        </motion.span>
        <button
          type="button"
          aria-label={`More ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          className="grid size-8 place-items-center rounded-full bg-wash text-ink transition-[background-color,transform] hover:bg-wash-2 active:scale-90 disabled:opacity-35"
        >
          <Plus className="size-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

export function RoomsInput({ onSend, disabled, brief }: { onSend: Send; disabled?: boolean; brief: Brief | null }) {
  const m = brief?.plot.area_marla || 10;
  const defBeds = brief?.bedrooms || (m < 5 ? 2 : m < 10 ? 3 : m < 20 ? 4 : m < 40 ? 5 : 6);
  const [beds, setBeds] = useState(defBeds);
  const [baths, setBaths] = useState(brief?.bathrooms || defBeds + 1);
  const [storeys, setStoreys] = useState(String(brief?.storeys || (m < 5 ? 2 : 2)));
  const [spaces, setSpaces] = useState<string[]>(
    brief?.spaces.length ? brief.spaces.filter((s) => ROOM_TOGGLES.includes(s)) : ["drawing", "tv_lounge", ...(m >= 10 ? ["lawn"] : [])],
  );
  const [porch, setPorch] = useState(() => {
    const p = brief?.spaces.find((s) => s.startsWith("car_porch"));
    return p ? (p.split(":")[1] ?? "1") : m >= 10 ? "1" : m >= 5 ? "1" : "0";
  });

  const toggle = (id: string) => setSpaces((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = () => {
    const chosen = [...spaces, ...(porch !== "0" ? [`car_porch:${porch}`] : [])];
    const names = chosen.map((id) =>
      id.startsWith("car_porch") ? `car porch for ${porch} car${porch === "1" ? "" : "s"}` : sentenceLower(SPACE_OPTIONS.find((o) => o.id === id)?.label ?? id),
    );
    const text = `${beds} bedrooms, ${baths} baths, ${storeys} storey${storeys === "1" ? "" : "s"}${names.length ? `; ${names.join(", ")}` : ""}`;
    onSend({ message: text, chips: [`storeys:${storeys}`, `bedrooms:${beds}`, `bathrooms:${baths}`, ...chosen] }, text);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Stepper label="Bedrooms" value={beds} min={1} max={9} onChange={setBeds} />
        <Stepper label="Bathrooms" value={baths} min={1} max={10} onChange={setBaths} hint="Attached baths count" />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-medium text-graphite">Storeys</span>
          <Segmented
            layoutId="storeys"
            size="sm"
            value={storeys}
            onChange={setStoreys}
            options={[
              { value: "1", label: "1" },
              { value: "2", label: "2" },
              { value: "3", label: "3", title: "LDA maximum" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-medium text-graphite">Car porch</span>
          <Segmented
            layoutId="porch"
            size="sm"
            value={porch}
            onChange={setPorch}
            options={[
              { value: "0", label: "None" },
              { value: "1", label: "1 car" },
              { value: "2", label: "2 cars" },
            ]}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {ROOM_TOGGLES.map((id) => {
          const o = SPACE_OPTIONS.find((x) => x.id === id)!;
          return (
            <Chip key={id} size="sm" multi selected={spaces.includes(id)} onClick={() => toggle(id)} disabled={disabled}>
              {o.label}
            </Chip>
          );
        })}
      </div>
      <Button variant="primary" disabled={disabled} onClick={submit} trailing={<ArrowRight className="size-4" strokeWidth={1.75} />}>
        Continue
      </Button>
    </div>
  );
}

// ── Map ─────────────────────────────────────────────────────────────────────────────────────────────

export function MapInput({
  onSend,
  onSkip,
  disabled,
  chips,
}: {
  onSend: Send;
  onSkip: () => void;
  disabled?: boolean;
  /** Optional chips offered with the pin question (the live agent asks which way the front faces here). */
  chips?: ChipT[];
}) {
  const [value, setValue] = useState("");
  const [chip, setChip] = useState<ChipT | null>(null);
  const coords = useMemo(() => (value.trim() ? parseCoordinates(value) : null), [value]);
  const ref = useRef<HTMLInputElement>(null);
  const fmt = (n: number, pos: string, neg: string) => `${Math.abs(n).toFixed(4)}° ${n >= 0 ? pos : neg}`;

  const pin = () => {
    if (!coords && !chip) return;
    const parts = [
      chip ? `Front faces ${chip.label}` : null,
      coords ? `Plot location: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : null,
    ].filter(Boolean) as string[];
    const text = parts.join(". ");
    onSend({ message: text, chips: [...(chip ? [chip.value] : []), ...(coords ? [`coords:${coords.lat},${coords.lng}`] : [])] }, text);
  };

  return (
    <div className="space-y-3">
      {!!chips?.length && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-[12.5px] font-medium text-graphite">Front faces</span>
          {chips.map((c) => (
            <Chip key={c.value} size="sm" hint={c.hint} selected={chip?.value === c.value} onClick={() => setChip(chip?.value === c.value ? null : c)} disabled={disabled}>
              {c.label}
            </Chip>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2 rounded-2xl bg-plaster px-3 py-2 shadow-[0_0_0_1px_var(--color-line)] focus-within:shadow-[0_0_0_1.5px_var(--color-brick)]">
        <MapPin className="size-4 shrink-0 text-pencil" strokeWidth={1.75} />
        <input
          ref={ref}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && pin()}
          placeholder="Paste a Google Maps link, or 31.4697, 74.2728"
          className="h-8 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-pencil"
          aria-label="Google Maps link or coordinates"
        />
      </div>
      {value.trim() && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-3 text-[13px]">
          {coords ? (
            <>
              <span className="inline-flex items-center gap-1.5 font-medium text-pass">
                <Check className="size-4" strokeWidth={2} />
                {fmt(coords.lat, "N", "S")}, {fmt(coords.lng, "E", "W")}
              </span>
              <a
                href={`https://www.google.com/maps?q=${coords.lat},${coords.lng}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-graphite underline-offset-4 hover:text-ink hover:underline"
              >
                Check on Google Maps <ExternalLink className="size-3" />
              </a>
            </>
          ) : (
            <span className="text-warn">No coordinates found yet. Links with “@31.47,74.27” or “?q=31.47,74.27” work.</span>
          )}
        </motion.div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="lg" onClick={onSkip} disabled={disabled} icon={<SkipForward className="size-4" strokeWidth={1.75} />}>
          Skip, no pin
        </Button>
        <Button variant="primary" size="lg" onClick={pin} disabled={(!coords && !chip) || disabled} trailing={<ArrowRight className="size-4" strokeWidth={1.75} />}>
          {coords ? "Pin this location" : "Continue"}
        </Button>
      </div>
    </div>
  );
}
