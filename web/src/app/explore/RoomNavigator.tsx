/** The room navigator (M): rooms by floor with type-to-filter. Shared by the owner's House and the client's walk. */
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { BuildingPlan } from "@contracts/plan";
import { cn, feetInches } from "@/app/lib/utils";
import { Kbd } from "@/app/design/kit";
import { CATEGORY, SITE_TYPES, levelName, levelsOf, sentenceCase } from "@/app/plan/model";

const ROOM_ORDER = ["living", "bed", "wet", "service", "outdoor"];

/** Rooms by floor with type-to-filter (M). Shared by the owner's House and the client's walk. */
export function RoomNavigator({ plan, current, onGo, open = true }: { plan: BuildingPlan; current: string | null; onGo: (id: string) => void; open?: boolean }) {
  const [q, setQ] = useState("");
  const search = useRef<HTMLInputElement>(null);
  // The panel is placed (and made visible) a frame after it mounts; focus the search once it can take focus.
  useEffect(() => {
    if (!open) return;
    const fine = window.matchMedia?.("(pointer: fine)").matches ?? true;
    if (!fine) return;
    const t = window.setTimeout(() => search.current?.focus({ preventScroll: true }), 40);
    const t2 = window.setTimeout(() => { if (document.activeElement !== search.current) search.current?.focus({ preventScroll: true }); }, 160);
    return () => { window.clearTimeout(t); window.clearTimeout(t2); };
  }, [open]);
  const levels = levelsOf(plan);
  const rooms = plan.rooms.filter((r) => !SITE_TYPES.has(r.type) && r.type !== "stair");
  const match = (name: string) => !q.trim() || name.toLowerCase().includes(q.trim().toLowerCase());
  const groups = levels
    .map((l) => ({ l, list: rooms.filter((r) => r.level === l.id && match(r.name)).sort((a, b) => ROOM_ORDER.indexOf(CATEGORY[a.type]) - ROOM_ORDER.indexOf(CATEGORY[b.type]) || a.name.localeCompare(b.name, undefined, { numeric: true })) }))
    .filter((g) => g.list.length);
  const first = groups[0]?.list[0];
  return (
    <div>
      <div className="flex items-center gap-2 rounded-control bg-white/8 px-2.5">
        <Search className="size-3.5 text-hud-ink-2" strokeWidth={1.75} />
        <input
          ref={search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && first) onGo(first.id);
            e.stopPropagation();
          }}
          placeholder="Go to a room"
          aria-label="Go to a room"
          className="h-9 min-w-0 flex-1 bg-transparent text-[13.5px] text-hud-ink outline-none placeholder:text-hud-ink-2"
        />
        <Kbd tone="hud">M</Kbd>
      </div>
      <div className="mt-2 max-h-[50vh] overflow-y-auto [scrollbar-width:thin] max-md:max-h-none">
        {groups.map(({ l, list }) => (
          <div key={l.id} className="mb-1">
            <p className="px-2 pb-0.5 pt-1.5 text-[12px] text-hud-ink-2">{levelName(l)}</p>
            {list.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onGo(r.id)}
                className={cn("flex w-full items-center justify-between gap-3 rounded-control px-2 py-1.5 text-left text-[13.5px] outline-none hover:bg-white/8 focus-visible:shadow-focus", r.id === current && "bg-white/10")}
              >
                <span className="truncate">{sentenceCase(r.name)}</span>
                {r.id === current ? <span className="text-[12px] text-hud-accent">You're here</span> : <span className="font-mono text-[11.5px] tabular-nums text-hud-ink-2">{feetInches(r.rect.w)} × {feetInches(r.rect.d)}</span>}
              </button>
            ))}
          </div>
        ))}
        {!groups.length && <p className="px-2 py-3 text-[13px] text-hud-ink-2">No room called that.</p>}
      </div>
    </div>
  );
}
