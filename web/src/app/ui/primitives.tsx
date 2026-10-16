import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check, CircleAlert, CircleCheck, CircleX, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/app/lib/utils";
import { useToasts } from "@/app/store/toast";

// ── Chip (one-tap answers, toggles) ──────────────────────────────────────────────────────────────────

export function Chip({
  selected,
  onClick,
  children,
  hint,
  disabled,
  size = "md",
  className,
  multi,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  hint?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  multi?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full text-left transition-[background-color,box-shadow,color,transform] duration-200 ease-[var(--ease-press)] active:scale-[0.97] disabled:opacity-40",
        size === "md" ? "min-h-9 px-3.5 py-1.5 text-[13.5px]" : "min-h-7 px-2.5 py-1 text-[12.5px]",
        selected
          ? "bg-brick-soft text-brick-deep shadow-[0_0_0_1px_var(--color-brick)]"
          : "bg-plaster text-ink shadow-[0_0_0_1px_var(--color-line)] hover:shadow-[0_0_0_1px_var(--color-line-strong),0_2px_8px_-4px_rgb(30_27_23/0.15)]",
        className,
      )}
    >
      {multi && (
        <span
          className={cn(
            "grid size-4 place-items-center rounded-[5px] transition-colors",
            selected ? "bg-brick text-sheet" : "shadow-[0_0_0_1px_var(--color-line-strong)]",
          )}
        >
          {selected && <Check className="size-3" strokeWidth={2.5} />}
        </span>
      )}
      <span className="font-medium">{children}</span>
      {hint && <span className={cn("text-[12px]", selected ? "text-brick/80" : "text-pencil")}>{hint}</span>}
    </button>
  );
}

// ── Status pill ─────────────────────────────────────────────────────────────────────────────────────

export type Tone = "neutral" | "accent" | "pass" | "warn" | "fail" | "progress" | "dark";

const toneClass: Record<Tone, string> = {
  neutral: "bg-wash text-graphite",
  accent: "bg-brick-soft text-brick-deep",
  pass: "bg-pass-soft text-pass",
  warn: "bg-warn-soft text-warn",
  fail: "bg-fail-soft text-fail",
  progress: "bg-[#ebe6f3] text-[#4d3f78]",
  dark: "bg-white/12 text-sheet",
};
const dotClass: Record<Tone, string> = {
  neutral: "bg-pencil",
  accent: "bg-brick",
  pass: "bg-pass",
  warn: "bg-warn",
  fail: "bg-fail",
  progress: "bg-[#6b5aa6] animate-pulse-soft",
  dark: "bg-sheet",
};

export function Pill({ tone = "neutral", children, dot = true, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium whitespace-nowrap", toneClass[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", dotClass[tone])} />}
      {children}
    </span>
  );
}

export function StatusIcon({ status, className }: { status: "pass" | "warn" | "fail"; className?: string }) {
  const Icon = status === "pass" ? CircleCheck : status === "warn" ? TriangleAlert : CircleX;
  return <Icon className={cn("size-4 shrink-0", status === "pass" ? "text-pass" : status === "warn" ? "text-warn" : "text-fail", className)} strokeWidth={1.75} />;
}

// ── Segmented control ───────────────────────────────────────────────────────────────────────────────

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  tone = "light",
  size = "md",
  className,
  layoutId,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  tone?: "light" | "dark";
  size?: "sm" | "md";
  className?: string;
  layoutId: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "relative inline-flex items-center rounded-full p-1",
        tone === "light" ? "bg-wash shadow-[inset_0_0_0_1px_rgb(30_27_23/0.05)]" : "bg-white/8 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.08)]",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-0 inline-flex items-center gap-1.5 rounded-full font-medium transition-colors duration-200",
              size === "md" ? "h-8 px-3.5 text-[13px]" : "h-7 px-3 text-[12px]",
              tone === "light" ? (active ? "text-ink" : "text-graphite hover:text-ink") : active ? "text-ink" : "text-sheet/75 hover:text-sheet",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className={cn("absolute inset-0 -z-10 rounded-full", tone === "light" ? "bg-plaster shadow-[0_1px_2px_rgb(30_27_23/0.12),0_0_0_1px_rgb(30_27_23/0.04)]" : "bg-sheet")}
                transition={{ type: "spring", stiffness: 520, damping: 40 }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Dialog ──────────────────────────────────────────────────────────────────────────────────────────

export function Dialog({
  open,
  onClose,
  children,
  className,
  label,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-40 grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-ink/35 backdrop-blur-[3px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={cn("relative w-full max-w-md rounded-[22px] bg-sheet p-6 shadow-float ring-1 ring-ink/5", className)}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Menu (kebab) ────────────────────────────────────────────────────────────────────────────────────

export function Menu({
  trigger,
  items,
  align = "right",
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: { label: string; icon?: ReactNode; onSelect: () => void; danger?: boolean }[];
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "absolute top-full z-30 mt-1.5 min-w-40 origin-top-right rounded-2xl bg-plaster p-1.5 shadow-float ring-1 ring-ink/6",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            {items.map((it) => (
              <button
                key={it.label}
                role="menuitem"
                onClick={(e) => { e.stopPropagation(); setOpen(false); it.onSelect(); }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] transition-colors",
                  it.danger ? "text-fail hover:bg-fail-soft" : "text-ink hover:bg-wash",
                )}
              >
                {it.icon}
                {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Toaster ─────────────────────────────────────────────────────────────────────────────────────────

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="app-toaster pointer-events-none fixed inset-x-0 top-[68px] z-50 flex flex-col items-center gap-2 px-4 pt-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97, transition: { duration: 0.18 } }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-ink px-4 py-3 text-sheet shadow-float"
          >
            <span className="mt-0.5">
              {t.tone === "error" ? (
                <CircleAlert className="size-4 text-[#f19a8c]" strokeWidth={1.75} />
              ) : t.tone === "success" ? (
                <CircleCheck className="size-4 text-[#9fd0ae]" strokeWidth={1.75} />
              ) : (
                <Info className="size-4 text-sheet/70" strokeWidth={1.75} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[12.5px] leading-snug text-sheet/70">{t.body}</p>}
              {t.action && (
                <button
                  onClick={() => { t.action?.run(); dismiss(t.id); }}
                  className="mt-2 text-[12.5px] font-medium text-[#f3b9a8] underline-offset-4 hover:underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 rounded-full p-1 text-sheet/50 hover:bg-white/10 hover:text-sheet">
              <X className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Spinner: a drafting compass arc ─────────────────────────────────────────────────────────────────

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4 animate-spin", className)} fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Corner registration marks (drawing-sheet framing) ───────────────────────────────────────────────

export function CornerMarks({ className, size = 10 }: { className?: string; size?: number }) {
  const s = size;
  const common = "absolute border-ink/35";
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      <span className={cn(common, "left-0 top-0 border-l border-t")} style={{ width: s, height: s }} />
      <span className={cn(common, "right-0 top-0 border-r border-t")} style={{ width: s, height: s }} />
      <span className={cn(common, "bottom-0 left-0 border-b border-l")} style={{ width: s, height: s }} />
      <span className={cn(common, "bottom-0 right-0 border-b border-r")} style={{ width: s, height: s }} />
    </span>
  );
}

/** Small label used above values (sentence case, graphite). */
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-[12px] font-medium text-pencil", className)}>{children}</span>;
}
