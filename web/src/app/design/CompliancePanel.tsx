import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ComplianceCheck, ComplianceReport } from "@contracts/plan";
import { cn, num } from "@/app/lib/utils";
import { StatusIcon } from "@/app/ui/primitives";

const GROUPS: { key: string; title: string; match: (id: string) => boolean }[] = [
  { key: "site", title: "Setbacks and envelope", match: (id) => /^(setback|coverage|far|height|storeys|mumty|parapet|boundary|projection)/.test(id) },
  { key: "size", title: "Room sizes", match: (id) => id.startsWith("room.size") || id.startsWith("room.kitchen") || id.startsWith("room.ceiling") || id === "clear_height" },
  { key: "light", title: "Daylight", match: (id) => id.startsWith("room.light") || id === "glazing" },
  { key: "vent", title: "Ventilation", match: (id) => id.startsWith("room.vent") || id.startsWith("bath.") },
  { key: "stair", title: "Stairs", match: (id) => id.startsWith("stair") },
  { key: "other", title: "Services and access", match: () => true },
];

function groupOf(c: ComplianceCheck) {
  return GROUPS.find((g) => g.match(c.id))!.key;
}

export function CompliancePanel({
  report,
  attempt,
  failures,
  selectedId,
  onSelect,
  running,
}: {
  report: ComplianceReport | null | undefined;
  attempt?: number;
  /** Failures per attempt in this run, e.g. [5, 1, 0]. */
  failures?: number[];
  selectedId?: string | null;
  onSelect: (check: ComplianceCheck | null) => void;
  running?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const issues = useMemo(() => (report?.checks ?? []).filter((c) => c.status !== "pass").sort((a, b) => (a.status === "fail" ? -1 : 1) - (b.status === "fail" ? -1 : 1)), [report]);
  const grouped = useMemo(() => {
    const m = new Map<string, ComplianceCheck[]>();
    for (const c of report?.checks ?? []) if (c.status === "pass") m.set(groupOf(c), [...(m.get(groupOf(c)) ?? []), c]);
    return m;
  }, [report]);

  if (!report) {
    return (
      <div className="px-5 py-6">
        <h2 className="font-display-text text-[20px] font-medium text-ink">LDA compliance</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-graphite">
          {running
            ? "As soon as Argon drafts the plan, the LDA engine checks it: setbacks, coverage, height, room sizes, daylight, ventilation and stairs."
            : "The compliance report appears here with the plan."}
        </p>
        <div className="mt-5 space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-11 overflow-hidden rounded-xl bg-wash">
              {running && <div className="h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const fails = report.checks.filter((c) => c.status === "fail").length;
  const warns = report.checks.filter((c) => c.status === "warn").length;
  const passes = report.checks.length - fails - warns;
  const m = report.metrics;
  const env = report.envelope;

  return (
    <div className="px-5 py-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display-text text-[20px] font-medium text-ink">LDA compliance</h2>
        {attempt ? <span className="text-[12px] text-pencil">Check {attempt}</span> : null}
      </div>
      <p className="mt-0.5 text-[12px] text-pencil">{report.authority} Building & Zoning Regulations 2019, {report.band}</p>

      {failures && failures.length > 1 && <FixLoop failures={failures} />}

      <motion.div
        key={`${fails}-${warns}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "mt-4 flex items-center gap-3 rounded-2xl px-4 py-3",
          fails ? "bg-fail-soft text-fail" : warns ? "bg-warn-soft text-warn" : "bg-pass-soft text-pass",
        )}
      >
        {fails ? <ShieldAlert className="size-5 shrink-0" strokeWidth={1.75} /> : <ShieldCheck className="size-5 shrink-0" strokeWidth={1.75} />}
        <div>
          <p className="text-[14px] font-semibold">
            {fails ? `${fails} ${fails === 1 ? "rule fails" : "rules fail"}` : warns ? `Compliant, ${warns} advisor${warns === 1 ? "y" : "ies"}` : `All ${report.checks.length} checks pass`}
          </p>
          <p className="text-[12px] opacity-80">
            {passes} passed{warns ? `, ${warns} to review` : ""}{fails ? `, ${fails} to fix` : ""}
          </p>
        </div>
      </motion.div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Metric label="Ground coverage" value={`${num(m.coverage_pct, 1)}%`} limit={`${num(env.max_coverage_pct)}%`} ratio={m.coverage_pct / env.max_coverage_pct} />
        <Metric label="Height" value={`${num(m.height_ft, 1)} ft`} limit={`${num(env.max_height_ft)} ft`} ratio={m.height_ft / env.max_height_ft} />
        <Metric label="Storeys" value={String(m.storeys)} limit={String(env.max_storeys)} ratio={m.storeys / env.max_storeys} />
        <Metric label="Floor area" value={`${num(m.total_floor_area_sqft)} sq ft`} limit={`FAR 1:${num(m.far, 2)}`} ratio={0} />
      </div>

      {issues.length > 0 && (
        <div className="mt-5">
          <p className="text-[12.5px] font-medium text-pencil">Needs attention</p>
          <ul className="mt-2 space-y-1.5">
            {issues.map((c) => (
              <CheckRow key={c.id} c={c} selected={selectedId === c.id} onSelect={onSelect} expanded />
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 space-y-1">
        {GROUPS.filter((g) => grouped.get(g.key)?.length).map((g) => {
          const list = grouped.get(g.key)!;
          const isOpen = open[g.key] ?? (g.key === "site");
          return (
            <div key={g.key} className="border-t border-line">
              <button
                onClick={() => setOpen((o) => ({ ...o, [g.key]: !isOpen }))}
                className="flex w-full items-center justify-between py-2.5 text-left"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                  <StatusIcon status="pass" className="size-3.5" />
                  {g.title}
                </span>
                <span className="flex items-center gap-2 text-[12px] text-pencil tabular">
                  {list.length} passed
                  <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-1 overflow-hidden pb-2"
                  >
                    {list.map((c) => (
                      <CheckRow key={c.id} c={c} selected={selectedId === c.id} onSelect={onSelect} />
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value, limit, ratio }: { label: string; value: string; limit: string; ratio: number }) {
  return (
    <div className="rounded-xl bg-plaster px-3 py-2.5 ring-1 ring-line">
      <p className="text-[11.5px] text-pencil">{label}</p>
      <p className="mt-0.5 text-[14px] font-semibold text-ink tabular">
        {value} <span className="text-[11.5px] font-normal text-pencil">/ {limit}</span>
      </p>
      {ratio > 0 && (
        <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-wash">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, ratio * 100)}%` }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className={cn("h-full rounded-full", ratio > 1 ? "bg-fail" : ratio > 0.92 ? "bg-warn" : "bg-pass")}
          />
        </div>
      )}
    </div>
  );
}

function CheckRow({ c, selected, onSelect, expanded }: { c: ComplianceCheck; selected: boolean; onSelect: (c: ComplianceCheck | null) => void; expanded?: boolean }) {
  const hasTargets = !!c.element_ids?.length;
  return (
    <li>
      <button
        onClick={() => onSelect(selected ? null : c)}
        className={cn(
          "group flex w-full gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
          selected ? "bg-ink text-sheet" : expanded ? (c.status === "fail" ? "bg-fail-soft/60 hover:bg-fail-soft" : "bg-warn-soft/60 hover:bg-warn-soft") : "hover:bg-wash",
        )}
      >
        <StatusIcon status={c.status} className={cn("mt-0.5 size-3.5", selected && "text-sheet")} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("text-[13px] font-medium", selected ? "text-sheet" : "text-ink")}>{c.title}</span>
            {c.value != null && c.limit != null && (
              <span className={cn("shrink-0 text-[11px] tabular", selected ? "text-sheet/70" : "text-pencil")}>
                {String(c.value)} / {String(c.limit)}
              </span>
            )}
          </span>
          {(expanded || selected) && <span className={cn("mt-0.5 block text-[12px] leading-snug", selected ? "text-sheet/80" : "text-graphite")}>{c.message}</span>}
          {(expanded || selected) && c.rule_ref && <span className={cn("mt-1 block text-[10.5px]", selected ? "text-sheet/55" : "text-pencil")}>{c.rule_ref}</span>}
          {selected && hasTargets && <span className="mt-1 block text-[10.5px] font-medium text-[#f3b9a8]">Highlighted on the plan</span>}
        </span>
      </button>
    </li>
  );
}

/** "Argon fixed 5 → 1 → 0 LDA violations": the compliance loop, attempt by attempt. */
export function FixLoop({ failures, className }: { failures: number[]; className?: string }) {
  const max = Math.max(1, ...failures);
  const last = failures[failures.length - 1];
  return (
    <div className={cn("mt-4 rounded-2xl bg-ink px-4 py-3.5 text-sheet", className)}>
      <p className="text-[12px] text-sheet/60">Argon's fix loop</p>
      <p className="mt-1 font-display-text text-[19px] leading-snug">
        {last === 0 ? "Fixed " : ""}
        {failures.map((f, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1.5 text-sheet/40">→</span>}
            <span className={cn("tabular", i === failures.length - 1 && f === 0 ? "text-[#9fd0ae]" : f ? "text-[#f3b9a8]" : "")}>{f}</span>
          </span>
        ))}{" "}
        <span className="text-sheet/80">LDA violation{failures[0] === 1 ? "" : "s"}</span>
      </p>
      <div className="mt-3 flex h-8 items-end gap-1.5">
        {failures.map((f, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(3, (f / max) * 22)}px` }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className={cn("w-full rounded-sm", f ? "bg-[#d77b62]" : "bg-[#7fb390]")}
            />
            <span className="text-[10px] text-sheet/50">Check {i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
