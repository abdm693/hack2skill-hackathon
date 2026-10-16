/**
 * Before and after, on the plan (DESIGN.md "Revisions → Compare"): both versions drawn in one sheet with a wipe
 * that snaps to 0, 50 and 100%, changed rooms outlined with their area change, one floor at a time.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { BuildingPlan } from "@contracts/plan";
import { cn } from "@/app/lib/utils";
import { FloorStack, stackItems } from "@/app/design/FloorStack";
import { Segmented } from "@/app/design/kit";
import { PlanDefs, PlanSheet, sheetBounds } from "@/app/plan/FloorPlan";
import { areaDeltas, levelKey, levelName, levelsOf } from "@/app/plan/model";

export function PlanCompare({ before, after, changed, className }: { before?: BuildingPlan; after: BuildingPlan; changed: string[]; className?: string }) {
  const levels = useMemo(() => levelsOf(after), [after]);
  const firstChanged = after.rooms.find((r) => changed.includes(r.id))?.level;
  const [level, setLevel] = useState(firstChanged ?? levels[0]?.id ?? "ground");
  useEffect(() => {
    if (firstChanged) setLevel(firstChanged);
  }, [firstChanged]);
  const [wipeState, setWipe] = useState(50);
  const wipe = before ? wipeState : 0;
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 400, h: 500 });
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const B = sheetBounds(after);
  const ppf = Math.min(size.w / B.w, size.h / B.h);
  const deltas = useMemo(() => areaDeltas(before, after, changed), [before, after, changed]);
  const dragging = useRef(false);
  const toPct = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return wipe;
    // The sheet is centred; map the pointer to the drawing's own width.
    const drawW = B.w * ppf;
    const left = r.left + (r.width - drawW) / 2;
    return Math.max(0, Math.min(100, ((clientX - left) / drawW) * 100));
  };
  const snap = (p: number) => ([0, 50, 100].find((s) => Math.abs(s - p) < 6) ?? p);
  const cutX = B.x + (B.w * wipe) / 100;
  const id = useMemo(() => `cmp-${Math.random().toString(36).slice(2, 8)}`, []);
  const items = stackItems(levels, (l) => levelKey(l, levels), levelName);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {levels.length > 1 && <FloorStack items={items} value={level} onChange={setLevel} orientation="horizontal" hotkeys={false} />}
        {before && (
          <Segmented
            label="Compare"
            size="sm"
            value={wipe === 100 ? "before" : wipe === 0 ? "after" : "both"}
            onChange={(v) => setWipe(v === "before" ? 100 : v === "after" ? 0 : 50)}
            options={[
              { value: "before", label: "Before" },
              { value: "both", label: "Wipe" },
              { value: "after", label: "After" },
            ]}
          />
        )}
      </div>
      <div
        ref={box}
        className="relative mt-3 min-h-[360px] flex-1 touch-none select-none overflow-hidden rounded-card bg-surface shadow-e1"
        onPointerDown={(e) => {
          if (!before) return;
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setWipe(toPct(e.clientX));
        }}
        onPointerMove={(e) => dragging.current && setWipe(toPct(e.clientX))}
        onPointerUp={() => {
          dragging.current = false;
          setWipe((w) => snap(w));
        }}
      >
        <svg viewBox={`${B.x} ${B.y} ${B.w} ${B.h}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Plan before and after">
          <PlanDefs ppf={ppf || 1} />
          <defs>
            <clipPath id={`${id}-b`}>
              <rect x={B.x - 1} y={B.y - 1} width={cutX - B.x + 1} height={B.h + 2} />
            </clipPath>
            <clipPath id={`${id}-a`}>
              <rect x={cutX} y={B.y - 1} width={B.x + B.w - cutX + 1} height={B.h + 2} />
            </clipPath>
          </defs>
          {before && wipe > 0 && (
            <g clipPath={`url(#${id}-b)`}>
              <PlanSheet plan={before} levelId={level} ppf={ppf || 1} highlight={changed.filter((x) => before.rooms.some((r) => r.id === x))} tone="warn" />
            </g>
          )}
          {wipe < 100 && (
            <g clipPath={`url(#${id}-a)`}>
              <PlanSheet plan={after} levelId={level} ppf={ppf || 1} changed={changed} deltas={deltas} />
            </g>
          )}
          {before && wipe > 0 && wipe < 100 && <line x1={cutX} y1={B.y} x2={cutX} y2={B.y + B.h} stroke="#2747F5" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />}
        </svg>
        {before && wipe > 0 && wipe < 100 && (
          <>
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[12px] font-medium text-ink-2 shadow-e1">Before</span>
            <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[12px] font-medium text-ink-2 shadow-e1">After</span>
          </>
        )}
      </div>
      <p className="mt-2 text-[12.5px] text-ink-3">{before ? "Drag across the plan to compare. Changed rooms are outlined." : "The first design: nothing to compare yet."}</p>
    </div>
  );
}
