import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/app/lib/utils";
import { spring } from "./motion";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
  disabled?: boolean;
  /** A breathing accent dot after the label ("being made"). */
  busy?: boolean;
}

/**
 * A segmented control (DESIGN.md §4): 36px, a surface-2 track and a surface thumb (e1) that springs between options.
 * Arrow keys move the selection. `tone="hud"` for use over 3D.
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  size = "md",
  tone = "light",
  label,
  className,
  layoutId,
  fill,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
  tone?: "light" | "hud" | "dark";
  /** Accessible name of the group. */
  label?: string;
  className?: string;
  /** Optional; one is generated per instance. */
  layoutId?: string;
  /** Stretch options to fill the width. */
  fill?: boolean;
}) {
  const auto = useId();
  const lid = layoutId ?? `seg-${auto}`;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const hud = tone !== "light";
  // Roving tab stop: the selected option, or the first one when nothing is selected.
  const tabStop = Math.max(0, options.findIndex((o) => o.value === value));

  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const dir = e.key === "ArrowRight" ? 1 : -1;
    for (let k = 1; k <= options.length; k++) {
      const j = (i + dir * k + options.length) % options.length;
      if (!options[j].disabled) {
        onChange(options[j].value);
        refs.current[j]?.focus();
        break;
      }
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "relative inline-flex items-center rounded-full p-[3px]",
        size === "md" ? "h-9" : "h-8",
        hud ? "bg-white/10" : "bg-surface-2",
        fill && "flex w-full",
        className,
      )}
    >
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={i === tabStop ? 0 : -1}
            title={o.title}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "relative z-0 inline-flex h-full items-center justify-center gap-1.5 whitespace-nowrap rounded-full font-medium outline-none transition-colors duration-[160ms]",
              "focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-40",
              size === "md" ? "px-3.5 text-[13px]" : "px-3 text-[12px]",
              fill && "flex-1",
              hud
                ? active ? "text-ink" : "text-hud-ink-2 hover:text-hud-ink"
                : active ? "text-ink" : "text-ink-3 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={lid}
                className={cn("absolute inset-0 -z-10 rounded-full", hud ? "bg-hud-ink" : "bg-surface shadow-e1")}
                transition={spring}
              />
            )}
            {o.label}
            {o.busy && <span className="size-1.5 rounded-full bg-accent animate-breathe" aria-label="In progress" />}
          </button>
        );
      })}
    </div>
  );
}
