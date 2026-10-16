/**
 * FloorPlan: the 2D "naqsha". Draws a BuildingPlan level as an architectural drawing:
 * room fills by type, poché walls (exterior thicker), doors with swing arcs, windows as double lines,
 * stairs with treads and an UP arrow, setback lines, plot boundary wall and gates, the road,
 * chain dimensions, a north arrow from site.facing, a scale bar, hover read-outs and highlights.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BuildingPlan, Opening, Room, RoomType } from "@contracts/plan";
import { cn, feetInches, num, sizeLabel } from "@/app/lib/utils";
import {
  EXT_WALL,
  INT_WALL,
  OPEN_TYPES,
  SITE_TYPES,
  deriveWalls,
  levelOrder,
  placeOpenings,
  stairDrawing,
  wallPieces,
  type PlacedOpening,
  type StairDrawing,
} from "./geometry";
import { northRotation } from "@/app/setup/EnvelopeDiagram";

export type HighlightTone = "accent" | "fail" | "warn" | "pass";

export interface FloorPlanProps {
  plan: BuildingPlan;
  /** Controlled level id; uncontrolled when omitted. */
  level?: string;
  onLevelChange?: (id: string) => void;
  /** Element ids (rooms, openings, stairs) to emphasise, e.g. from a compliance check. */
  highlight?: string[];
  highlightTone?: HighlightTone;
  /** Ids with failing checks: marked in red while the architect fixes them. */
  issues?: string[];
  /** Ids changed by a revision: dashed accent outline. */
  changed?: string[];
  /** Setbacks to draw (defaults to plan.site.setbacks_ft). */
  setbacks?: { front: number; rear: number; left: number; right: number };
  tabs?: boolean;
  titleBlock?: boolean;
  className?: string;
  footer?: ReactNode;
}

const FILL: Partial<Record<RoomType, string>> = {
  drawing: "#f1e7d8",
  lounge: "#f2eadc",
  dining: "#efe5d3",
  kitchen: "#e5ebe0",
  dirty_kitchen: "#e1e8da",
  bedroom: "#efe4df",
  master_bedroom: "#ecdfd9",
  guest_bedroom: "#efe4df",
  bath: "#e2eaed",
  powder: "#e2eaed",
  dressing: "#ece5df",
  laundry: "#e4e9ec",
  study: "#ebe7dc",
  prayer: "#efe8d8",
  store: "#e8e5df",
  servant: "#e9e5de",
  stair: "#e9e6e0",
  lobby: "#ece9e3",
  corridor: "#ece9e3",
  porch: "#e7e4de",
  garage: "#e7e4de",
  balcony: "#ebe6dc",
  terrace: "#ebe6dc",
  courtyard: "#e6ebe0",
  lawn: "#dde7d2",
  driveway: "#e5e2db",
  open_space: "#ebe9e4",
};

const PATTERN: Partial<Record<RoomType, string>> = {
  bath: "tile",
  powder: "tile",
  laundry: "tile",
  porch: "paving",
  driveway: "paving",
  garage: "paving",
  balcony: "deck",
  terrace: "deck",
  lawn: "grass",
  courtyard: "grass",
};

const TONE: Record<HighlightTone, { fill: string; stroke: string }> = {
  accent: { fill: "rgb(158 63 38 / 0.16)", stroke: "#9e3f26" },
  fail: { fill: "rgb(177 38 44 / 0.16)", stroke: "#b1262c" },
  warn: { fill: "rgb(156 101 16 / 0.18)", stroke: "#9c6510" },
  pass: { fill: "rgb(62 106 78 / 0.16)", stroke: "#3e6a4e" },
};

const INK = "#24201b";
const WALL = "#2a2621";
const LINE = "rgb(36 32 27 / 0.75)";
const FAINT = "rgb(36 32 27 / 0.35)";
const DIM = "#5e584f";
const BRICK = "#9e3f26";

// Margins around the plot, in feet.
const M = { l: 10, r: 11, t: 10, b: 15 };

function shortLevel(name: string) {
  return name.replace(/\s*floor$/i, "").trim();
}

export function FloorPlan({
  plan,
  level: levelProp,
  onLevelChange,
  highlight,
  highlightTone = "accent",
  issues,
  changed,
  setbacks,
  tabs = true,
  titleBlock = true,
  className,
  footer,
}: FloorPlanProps) {
  const levels = useMemo(() => levelOrder(plan), [plan]);
  const [levelState, setLevelState] = useState(levels[0]?.id ?? "ground");
  const levelId = levelProp ?? levelState;
  const setLevel = (id: string) => {
    if (onLevelChange) onLevelChange(id);
    if (levelProp === undefined) setLevelState(id);
  };
  useEffect(() => {
    if (!levels.some((l) => l.id === levelId) && levels[0]) setLevel(levels[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levels, levelId]);

  // Jump to the level of the first highlighted element.
  const hlKey = (highlight ?? []).join("|");
  useEffect(() => {
    const ids = highlight ?? [];
    if (!ids.length) return;
    const onLevel = (lid: string) =>
      ids.some((id) => plan.rooms.some((r) => r.id === id && r.level === lid) || plan.openings.some((o) => o.id === id && o.level === lid) || plan.stairs.some((s) => s.id === id && s.from_level === lid));
    if (onLevel(levelId)) return;
    const target = levels.find((l) => onLevel(l.id));
    if (target) setLevel(target.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hlKey]);

  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 800 });
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const W = plan.site.plot.width_ft;
  const D = plan.site.plot.depth_ft;
  const vb = { x: -M.l, y: -M.t, w: W + M.l + M.r, h: D + M.t + M.b };
  const ppf = Math.max(2, Math.min(size.w / vb.w, size.h / vb.h)); // px per ft
  const px = (n: number) => n / ppf; // css px → ft

  const [hover, setHover] = useState<{ room: Room; x: number; y: number } | null>(null);
  const level = levels.find((l) => l.id === levelId) ?? levels[0];
  const roofish = level && (level.id === "roof" || level.index === Math.max(...levels.map((l) => l.index))) && !plan.rooms.some((r) => r.level === level.id && !SITE_TYPES.has(r.type));

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {tabs && levels.length > 1 && (
        <div className="flex items-center gap-1 px-1 pb-3" role="tablist" aria-label="Floor">
          {levels.map((l) => (
            <button
              key={l.id}
              role="tab"
              aria-selected={l.id === levelId}
              onClick={() => setLevel(l.id)}
              className={cn(
                "relative h-8 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                l.id === levelId ? "bg-ink text-sheet" : "text-graphite hover:bg-wash hover:text-ink",
              )}
            >
              {shortLevel(l.name)}
              {(issues ?? []).some((id) => plan.rooms.find((r) => r.id === id)?.level === l.id) && (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-fail" />
              )}
            </button>
          ))}
        </div>
      )}

      <div ref={box} className="relative min-h-0 flex-1" onPointerLeave={() => setHover(null)}>
        <svg
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          className="absolute inset-0 h-full w-full select-none"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`${level?.name ?? "Floor"} plan`}
        >
          <Defs ppf={ppf} />
          <Sheet plan={plan} levelId={level?.id ?? ""} roofish={!!roofish} px={px} ppf={ppf} setbacks={setbacks ?? plan.site.setbacks_ft}
            highlight={highlight} tone={highlightTone} issues={issues} changed={changed}
            onHover={(room, e) => {
              const r = box.current?.getBoundingClientRect();
              if (!room || !r) return setHover(null);
              setHover({ room, x: e.clientX - r.left, y: e.clientY - r.top });
            }}
            hovered={hover?.room.id}
          />
        </svg>

        {hover && (
          <div
            className="pointer-events-none absolute z-10 min-w-36 rounded-xl bg-ink px-3 py-2 text-sheet shadow-float"
            style={{ left: Math.min(hover.x + 14, size.w - 170), top: Math.max(8, hover.y - 64) }}
          >
            <p className="text-[12.5px] font-semibold">{hover.room.name}</p>
            <p className="mt-0.5 text-[12px] text-sheet/75 tabular">
              {sizeLabel(hover.room.rect.w, hover.room.rect.d)}, {num(hover.room.rect.w * hover.room.rect.d)} sq ft
            </p>
            {hover.room.floor_finish && <p className="text-[11.5px] text-sheet/55">{hover.room.floor_finish.replace(/_/g, " ")} floor</p>}
          </div>
        )}
      </div>

      {titleBlock && level && <TitleBlock plan={plan} levelName={level.name} levelId={level.id} footer={footer} />}
    </div>
  );
}

function TitleBlock({ plan, levelName, levelId, footer }: { plan: BuildingPlan; levelName: string; levelId: string; footer?: ReactNode }) {
  const rooms = plan.rooms.filter((r) => r.level === levelId && !SITE_TYPES.has(r.type));
  const covered = rooms.filter((r) => !OPEN_TYPES.has(r.type) || r.type === "porch").reduce((s, r) => s + r.rect.w * r.rect.d, 0);
  const { width_ft: W, depth_ft: D } = plan.site.plot;
  return (
    <div className="mt-3">
      <div className="grid grid-cols-[1.4fr_1fr_1fr] divide-x divide-line border border-line bg-plaster text-[11.5px]">
        <div className="px-3 py-2">
          <p className="font-display-text text-[15px] font-medium leading-tight text-ink">{levelName} plan</p>
          <p className="text-pencil">{plan.site.scheme ? `${plan.site.scheme}, ` : ""}{plan.site.city}</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-pencil">Plot</p>
          <p className="font-medium text-ink tabular">{feetInches(W)} × {feetInches(D)}</p>
        </div>
        <div className="px-3 py-2">
          <p className="text-pencil">{covered ? "Covered" : "Authority"}</p>
          <p className="font-medium text-ink tabular">{covered ? `${num(covered)} sq ft` : plan.site.authority}</p>
        </div>
      </div>
      {footer}
    </div>
  );
}

function Defs({ ppf }: { ppf: number }) {
  // Pattern tiles are in plan feet so they scale with the drawing.
  return (
    <defs>
      <pattern id="fp-tile" width="1" height="1" patternUnits="userSpaceOnUse">
        <path d="M1 0V1M0 1H1" stroke="rgb(36 32 27 / 0.10)" strokeWidth={0.7 / ppf} />
      </pattern>
      <pattern id="fp-paving" width="2" height="1" patternUnits="userSpaceOnUse">
        <path d="M0 1H2M1 0V1" stroke="rgb(36 32 27 / 0.09)" strokeWidth={0.7 / ppf} />
      </pattern>
      <pattern id="fp-deck" width="0.6" height="6" patternUnits="userSpaceOnUse">
        <path d="M0.6 0V6" stroke="rgb(120 90 60 / 0.18)" strokeWidth={0.7 / ppf} />
      </pattern>
      <pattern id="fp-grass" width="2.4" height="2.4" patternUnits="userSpaceOnUse">
        <path d="M0.4 0.9l0.25 -0.45l0.25 0.45M1.6 2.1l0.25 -0.45l0.25 0.45" fill="none" stroke="rgb(62 106 78 / 0.32)" strokeWidth={0.8 / ppf} />
      </pattern>
      <pattern id="fp-roof" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0V1.6" stroke="rgb(36 32 27 / 0.07)" strokeWidth={0.8 / ppf} />
      </pattern>
      <pattern id="fp-issue" width="1.2" height="1.2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0V1.2" stroke="rgb(177 38 44 / 0.35)" strokeWidth={1 / ppf} />
      </pattern>
      <marker id="fp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 1L9 5L0 9Z" fill={INK} />
      </marker>
    </defs>
  );
}

interface SheetProps {
  plan: BuildingPlan;
  levelId: string;
  roofish: boolean;
  px: (n: number) => number;
  ppf: number;
  setbacks: { front: number; rear: number; left: number; right: number };
  highlight?: string[];
  tone: HighlightTone;
  issues?: string[];
  changed?: string[];
  onHover: (room: Room | null, e: React.PointerEvent) => void;
  hovered?: string;
}

function Sheet({ plan, levelId, roofish, px, ppf, setbacks, highlight, tone, issues, changed, onHover, hovered }: SheetProps) {
  const W = plan.site.plot.width_ft;
  const D = plan.site.plot.depth_ft;
  const Y = (y: number) => D - y;
  const levels = useMemo(() => levelOrder(plan), [plan]);
  const level = levels.find((l) => l.id === levelId);
  const isGround = level ? level.index === 0 : true;

  const geo = useMemo(() => {
    const rooms = plan.rooms.filter((r) => r.level === levelId);
    const site = rooms.filter((r) => SITE_TYPES.has(r.type));
    const building = rooms.filter((r) => !SITE_TYPES.has(r.type));
    const { walls, boundaries } = deriveWalls(building);
    const openings = placeOpenings(plan.openings.filter((o) => o.level === levelId), building, walls, boundaries);

    // Roof: the slab is the footprint of the storey below; its edge is the parapet.
    let roofRooms: Room[] = [];
    let parapet: ReturnType<typeof deriveWalls>["walls"] = [];
    if (roofish && level) {
      const below = levels.filter((l) => l.index < level.index).pop();
      roofRooms = below ? plan.rooms.filter((r) => r.level === below.id && !OPEN_TYPES.has(r.type)) : [];
      parapet = deriveWalls(roofRooms).walls.filter((w) => w.exterior);
    }

    const up = plan.stairs.filter((s) => s.from_level === levelId).map((s) => ({ d: stairDrawing(s, plan.levels), dir: "up" as const }));
    const down = up.length ? [] : plan.stairs.filter((s) => s.to_level === levelId).map((s) => ({ d: stairDrawing(s, plan.levels), dir: "down" as const }));
    return { rooms, site, building, walls, boundaries, openings, roofRooms, parapet, stairs: [...up, ...down] };
  }, [plan, levelId, roofish, level, levels]);

  const takenNames = new Set(geo.rooms.map((r) => r.name.toLowerCase()));
  const hl = new Set(highlight ?? []);
  const bad = new Set(issues ?? []);
  const chg = new Set(changed ?? []);
  const t = TONE[tone];

  const gapsFor = (w: (typeof geo.walls)[number]) =>
    geo.openings.filter((o) => o.orient === w.orient && Math.abs(o.c - w.c) < 0.01 && o.b > w.a - 0.01 && o.a < w.b + 0.01).map((o) => ({ a: o.a, b: o.b }));

  const rect = (r: { x: number; y: number; w: number; d: number }) => ({ x: r.x, y: Y(r.y + r.d), width: r.w, height: r.d });

  return (
    <g>
      {/* Road */}
      <g pointerEvents="none">
        <rect x={-M.l + 1} y={D + 2.4} width={W + M.l + M.r - 2} height={6.4} fill="rgb(36 32 27 / 0.06)" />
        <line x1={-M.l + 1} y1={D + 2.4} x2={W + M.r - 1} y2={D + 2.4} stroke={FAINT} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        <line x1={-M.l + 2} y1={D + 5.6} x2={W + M.r - 2} y2={D + 5.6} stroke={FAINT} strokeWidth={0.8} strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
        <text x={W / 2} y={D + 4.9} textAnchor="middle" fontSize={px(10)} fill={DIM} fontFamily="Inter" fontWeight={600} letterSpacing={px(1.2)}>
          {plan.site.road_width_ft ? `${plan.site.road_width_ft}' WIDE ROAD` : "ROAD"}
        </text>
      </g>

      {/* Plot */}
      <rect x={0} y={0} width={W} height={D} fill={isGround ? "#f7f4ee" : "rgb(247 244 238 / 0.55)"} pointerEvents="none" />

      {/* Site areas (ground only) */}
      {isGround &&
        geo.site.map((r) => (
          <g key={r.id} onPointerMove={(e) => onHover(r, e)} onPointerLeave={(e) => onHover(null, e)}>
            <rect {...rect(r.rect)} fill={FILL[r.type] ?? "#ebe9e4"} />
            {PATTERN[r.type] && <rect {...rect(r.rect)} fill={`url(#fp-${PATTERN[r.type]})`} pointerEvents="none" />}
          </g>
        ))}

      {/* Roof slab */}
      {roofish && geo.roofRooms.map((r) => <rect key={r.id} {...rect(r.rect)} fill="#efebe4" pointerEvents="none" />)}
      {roofish && geo.roofRooms.map((r) => <rect key={`${r.id}-h`} {...rect(r.rect)} fill="url(#fp-roof)" pointerEvents="none" />)}

      {/* Room fills */}
      {geo.building.map((r) => (
        <g key={r.id} onPointerMove={(e) => onHover(r, e)} onPointerLeave={(e) => onHover(null, e)} style={{ cursor: "default" }}>
          <rect {...rect(r.rect)} fill={FILL[r.type] ?? "#ece9e3"} />
          {PATTERN[r.type] && <rect {...rect(r.rect)} fill={`url(#fp-${PATTERN[r.type]})`} pointerEvents="none" />}
          {hovered === r.id && <rect {...rect(r.rect)} fill="rgb(158 63 38 / 0.08)" pointerEvents="none" />}
        </g>
      ))}

      {/* Issue + highlight fills */}
      <g pointerEvents="none">
        {geo.rooms.filter((r) => bad.has(r.id)).map((r) => (
          <rect key={`bad-${r.id}`} {...rect(r.rect)} fill="url(#fp-issue)" />
        ))}
        {geo.rooms.filter((r) => hl.has(r.id)).map((r) => (
          <rect key={`hl-${r.id}`} {...rect(r.rect)} fill={t.fill} className="animate-pulse-soft" />
        ))}
      </g>

      {/* Stairs */}
      <g pointerEvents="none">
        {geo.stairs.map(({ d, dir }) => (
          <StairSymbol key={d.stair.id} d={d} dir={dir} Y={Y} px={px} highlighted={hl.has(d.stair.id)} tone={t.stroke} />
        ))}
      </g>

      {/* Open boundaries and railings */}
      <g pointerEvents="none">
        {geo.boundaries.map((b, i) => {
          const [x1, y1, x2, y2] = b.orient === "h" ? [b.a, Y(b.c), b.b, Y(b.c)] : [b.c, Y(b.a), b.c, Y(b.b)];
          if (b.kind === "open") return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={FAINT} strokeWidth={0.8} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />;
          const off = 0.18;
          const [dx, dy] = b.orient === "h" ? [0, off] : [off, 0];
          return (
            <g key={i} stroke={LINE} strokeWidth={0.8} vectorEffect="non-scaling-stroke">
              <line x1={x1 - dx} y1={y1 - dy} x2={x2 - dx} y2={y2 - dy} vectorEffect="non-scaling-stroke" />
              <line x1={x1 + dx} y1={y1 + dy} x2={x2 + dx} y2={y2 + dy} vectorEffect="non-scaling-stroke" />
            </g>
          );
        })}
      </g>

      {/* Parapet (roof) */}
      {roofish && (
        <g pointerEvents="none">
          {geo.parapet.map((w, i) => {
            const th = 0.5;
            const r = w.orient === "h" ? { x: w.a - th / 2, y: Y(w.c) - th / 2, width: w.b - w.a + th, height: th } : { x: w.c - th / 2, y: Y(w.b) - th / 2, width: th, height: w.b - w.a + th };
            return <rect key={i} {...r} fill="#fbfaf7" stroke={INK} strokeWidth={0.9} vectorEffect="non-scaling-stroke" />;
          })}
          <RoofExtras plan={plan} Y={Y} px={px} labelAt={roofLabelAt(geo.roofRooms, plan)} />
        </g>
      )}

      {/* Walls (poché) */}
      <g pointerEvents="none" fill={WALL}>
        {geo.walls.flatMap((w, i) =>
          wallPieces(w, gapsFor(w)).map((p, j) =>
            w.orient === "h" ? (
              <rect key={`${i}-${j}`} x={p.a} y={Y(w.c) - w.thick / 2} width={p.b - p.a} height={w.thick} />
            ) : (
              <rect key={`${i}-${j}`} x={w.c - w.thick / 2} y={Y(p.b)} width={w.thick} height={p.b - p.a} />
            ),
          ),
        )}
      </g>

      {/* Openings */}
      <g pointerEvents="none">
        {geo.openings.map((o) => (
          <OpeningSymbol key={o.opening.id} p={o} Y={Y} highlighted={hl.has(o.opening.id)} bad={bad.has(o.opening.id)} tone={t.stroke} px={px} />
        ))}
      </g>

      {/* Porch columns */}
      <g pointerEvents="none" fill={WALL}>
        {geo.building
          .filter((r) => r.type === "porch")
          .flatMap((r) => {
            const cs: [number, number][] = [];
            const { x, y, w, d } = r.rect;
            const touches = (px_: number, py_: number) =>
              geo.building.some((o) => o.id !== r.id && !OPEN_TYPES.has(o.type) && px_ >= o.rect.x - 0.01 && px_ <= o.rect.x + o.rect.w + 0.01 && py_ >= o.rect.y - 0.01 && py_ <= o.rect.y + o.rect.d + 0.01);
            for (const [cx, cy] of [[x, y], [x + w, y], [x, y + d], [x + w, y + d]] as [number, number][]) if (!touches(cx, cy)) cs.push([cx, cy]);
            // 1 ft square columns tucked inside the porch corner.
            return cs.map(([cx, cy], i) => (
              <rect key={`${r.id}-c${i}`} x={cx === x ? x : x + w - 1} y={cy === y ? Y(y + 1) : Y(y + d)} width={1} height={1} />
            ));
          })}
      </g>

      {/* Room labels (stair halls are labelled by their stair) */}
      <g pointerEvents="none">
        {(isGround ? geo.rooms : geo.building)
          .filter((r) => !(r.type === "stair" && geo.stairs.some(({ d }) => d.outline.x >= r.rect.x - 0.01 && d.outline.y >= r.rect.y - 0.01 && d.outline.x + d.outline.w <= r.rect.x + r.rect.w + 0.01 && d.outline.y + d.outline.d <= r.rect.y + r.rect.d + 0.01)))
          .map((r) => (
            <RoomLabel key={r.id} r={r} Y={Y} px={px} ppf={ppf} site={SITE_TYPES.has(r.type)} taken={takenNames} />
          ))}
      </g>

      {/* Outlines on top: highlights, issues, changes */}
      <g pointerEvents="none" fill="none">
        {geo.rooms.filter((r) => bad.has(r.id)).map((r) => (
          <rect key={`bo-${r.id}`} {...rect(r.rect)} stroke="#b1262c" strokeWidth={1.6} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
        ))}
        {geo.rooms.filter((r) => chg.has(r.id)).map((r) => (
          <rect key={`ch-${r.id}`} {...rect(r.rect)} stroke={BRICK} strokeWidth={1.8} strokeDasharray="6 3" vectorEffect="non-scaling-stroke" />
        ))}
        {geo.rooms.filter((r) => hl.has(r.id)).map((r) => (
          <rect key={`ho-${r.id}`} {...rect(r.rect)} stroke={t.stroke} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
        ))}
      </g>

      {/* Setbacks */}
      <Setbacks W={W} D={D} sb={setbacks} px={px} />

      {/* Boundary wall + gates */}
      <Boundary plan={plan} Y={Y} px={px} />

      {/* Dimensions */}
      <Dimensions W={W} D={D} sb={setbacks} px={px} />

      {/* North arrow + scale bar */}
      <NorthArrow x={W + 6.2} y={-5.2} facing={plan.site.facing} px={px} />
      <ScaleBar x={-M.l + 1.5} y={D + 12} px={px} />
    </g>
  );
}

/**
 * Shorter forms of a room name for tight rooms: "Master Bath" → "M. Bath" → "Bath".
 * A short form is skipped if another room on the level already has that name ("Dirty Kitchen" never becomes "Kitchen").
 */
function nameCandidates(name: string, taken: Set<string>): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  const out = [name];
  if (words.length > 1) {
    out.push(`${words[0][0]}. ${words.slice(1).join(" ")}`);
    out.push(words.slice(1).join(" "));
    out.push(words[words.length - 1]);
  }
  return [...new Set(out)].filter((c, i) => i === 0 || !taken.has(c.toLowerCase()));
}

function RoomLabel({ r, Y, px, ppf, site, taken }: { r: Room; Y: (y: number) => number; px: (n: number) => number; ppf: number; site: boolean; taken: Set<string> }) {
  const { x, y, w, d } = r.rect;
  const cx = x + w / 2;
  const cy = Y(y + d / 2);
  const wPx = w * ppf;
  const hPx = d * ppf;
  const big = ppf > 13;
  const base = site ? (big ? 11 : 10) : big ? 11 : 9.5; // px
  const minFs = 6.5;
  const dimFs = big ? 10 : 8.5;
  const widthOf = (s: string, f: number) => s.length * f * (site ? 0.52 : 0.66);

  // Pick the first name form that fits horizontally, else vertically (tall rooms), else shrunk.
  let label = "";
  let fs = base;
  let vertical = false;
  for (const cand of nameCandidates(r.name, taken)) {
    const text = site ? cand : cand.toUpperCase();
    const wFit = widthOf(text, base) <= wPx - 6 && hPx >= base * 1.5;
    const vFit = widthOf(text, base) <= hPx - 6 && wPx >= base * 1.5 && hPx > wPx;
    if (wFit || vFit) { label = text; vertical = !wFit; break; }
    const room = Math.max(wPx, hPx) - 6;
    const shrunk = (base * room) / widthOf(text, base);
    if (shrunk >= minFs && Math.min(wPx, hPx) >= shrunk * 1.4) { label = text; fs = Math.min(base, shrunk); vertical = hPx > wPx; break; }
  }
  if (!label) return null;
  const across = vertical ? wPx : hPx;
  const along = vertical ? hPx : wPx;
  const showDims = !site && across >= fs * 2.9 && widthOf(sizeLabel(w, d), dimFs) * 0.85 <= along - 6;
  const name = label;
  const lines = showDims ? 2 : 1;
  const lh = 1.25;
  const y0 = -((lines - 1) * fs * lh) / 2;
  return (
    <g transform={`translate(${cx} ${cy})${vertical ? " rotate(-90)" : ""}`} fontFamily="Inter" textAnchor="middle">
      <text y={px(y0 + fs * 0.36)} fontSize={px(fs)} fontWeight={site ? 500 : 600} fill={site ? "rgb(62 106 78 / 0.9)" : INK} letterSpacing={site ? 0 : px(0.5)} fontStyle={site ? "italic" : undefined}>
        {name}
      </text>
      {showDims && (
        <text y={px(y0 + fs * lh + dimFs * 0.36)} fontSize={px(dimFs)} fill={DIM} style={{ fontVariantNumeric: "tabular-nums" }}>
          {sizeLabel(w, d)}
        </text>
      )}
    </g>
  );
}

function OpeningSymbol({ p, Y, highlighted, bad, tone, px }: { p: PlacedOpening; Y: (y: number) => number; highlighted: boolean; bad: boolean; tone: string; px: (n: number) => number }) {
  const o: Opening = p.opening;
  // Work in a local frame: u along the wall (svg), n across it (svg). For h walls svg y is flipped.
  const along = (u: number, n: number): [number, number] => (p.orient === "h" ? [u, Y(p.c) - n] : [p.c + n, Y(u)]);
  const L = p.b - p.a;
  const th = p.thick;
  const sw = p.swingDir; // +1: toward +y/+x in plan
  const stroke = { stroke: INK, vectorEffect: "non-scaling-stroke" as const, fill: "none" };
  const parts: ReactNode[] = [];
  const line = (u1: number, n1: number, u2: number, n2: number, k: string, w = 0.8, extra: object = {}) => {
    const [x1, y1] = along(u1, n1);
    const [x2, y2] = along(u2, n2);
    parts.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} {...stroke} strokeWidth={w} {...extra} />);
  };
  const jambs = () => {
    line(p.a, -th / 2, p.a, th / 2, "ja", 0.8);
    line(p.b, -th / 2, p.b, th / 2, "jb", 0.8);
  };
  const leaf = (hinge: number, toward: number, len: number, k: string, heavy = false) => {
    // Open leaf perpendicular to the wall, and the swing arc back to the closed position.
    const [hx, hy] = along(hinge, sw * (th / 2));
    const [tx, ty] = along(hinge, sw * (th / 2 + len));
    const [cx, cy] = along(hinge + toward * len, sw * (th / 2));
    parts.push(<line key={`${k}-l`} x1={hx} y1={hy} x2={tx} y2={ty} {...stroke} strokeWidth={heavy ? 1.6 : 1.1} />);
    const vx1 = tx - hx, vy1 = ty - hy, vx2 = cx - hx, vy2 = cy - hy;
    const sweep = vx1 * vy2 - vy1 * vx2 > 0 ? 1 : 0;
    parts.push(<path key={`${k}-a`} d={`M${tx} ${ty}A${len} ${len} 0 0 ${sweep} ${cx} ${cy}`} {...stroke} strokeWidth={0.7} strokeDasharray="3 2" />);
  };

  switch (o.type) {
    case "door":
    case "main_door": {
      jambs();
      if (p.hingeAtA) leaf(p.a, 1, L, "d", o.type === "main_door");
      else leaf(p.b, -1, L, "d", o.type === "main_door");
      if (o.type === "main_door") {
        // Entrance marker: a small brick triangle on the approach side, pointing in.
        const mid = (p.a + p.b) / 2;
        const tip = along(mid, -sw * (th / 2 + 0.4));
        const b1 = along(mid - 0.6, -sw * (th / 2 + 1.35));
        const b2 = along(mid + 0.6, -sw * (th / 2 + 1.35));
        parts.push(<path key="entry" d={`M${tip[0]} ${tip[1]}L${b1[0]} ${b1[1]}L${b2[0]} ${b2[1]}Z`} fill={BRICK} />);
      }
      break;
    }
    case "double_door":
      jambs();
      leaf(p.a, 1, L / 2, "d1");
      leaf(p.b, -1, L / 2, "d2");
      break;
    case "sliding_door": {
      jambs();
      const mid = (p.a + p.b) / 2;
      const pw = 0.14;
      for (const [u1, u2, n, k] of [[p.a, mid + 0.25, -th / 6, "s1"], [mid - 0.25, p.b, th / 6, "s2"]] as [number, number, number, string][]) {
        const [x1, y1] = along(u1, n - pw / 2);
        const [x2, y2] = along(u2, n + pw / 2);
        parts.push(<rect key={k} x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} fill="#fbfaf7" stroke={INK} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />);
      }
      break;
    }
    case "arch":
      jambs();
      line(p.a, 0, p.b, 0, "arch", 0.7, { strokeDasharray: "4 3" });
      break;
    case "garage_door":
      jambs();
      line(p.a, 0, p.b, 0, "g", 0.9, { strokeDasharray: "6 3" });
      break;
    case "ventilator":
      jambs();
      line(p.a, -th / 2, p.b, -th / 2, "f1", 0.7);
      line(p.a, th / 2, p.b, th / 2, "f2", 0.7);
      line(p.a, 0, p.b, 0, "g1", 0.9);
      break;
    default: {
      // window, corner_window: frame at both faces and a double glass line
      jambs();
      line(p.a, -th / 2, p.b, -th / 2, "f1", 0.7);
      line(p.a, th / 2, p.b, th / 2, "f2", 0.7);
      line(p.a, -th * 0.11, p.b, -th * 0.11, "g1", 0.9);
      line(p.a, th * 0.11, p.b, th * 0.11, "g2", 0.9);
    }
  }

  const [cx, cy] = along((p.a + p.b) / 2, 0);
  return (
    <g>
      <g fill="#fbfaf7">
        {/* clear the wall gap */}
        {o.type !== "arch" && (() => {
          const [x1, y1] = along(p.a, -th / 2);
          const [x2, y2] = along(p.b, th / 2);
          return <rect x={Math.min(x1, x2)} y={Math.min(y1, y2)} width={Math.abs(x2 - x1)} height={Math.abs(y2 - y1)} />;
        })()}
      </g>
      {parts}
      {(highlighted || bad) && (
        <circle cx={cx} cy={cy} r={Math.max(L / 2 + 0.8, px(14))} fill="none" stroke={bad ? "#b1262c" : tone} strokeWidth={2} vectorEffect="non-scaling-stroke" className="animate-pulse-soft" />
      )}
    </g>
  );
}

function StairSymbol({ d, dir, Y, px, highlighted, tone }: { d: StairDrawing; dir: "up" | "down"; Y: (y: number) => number; px: (n: number) => number; highlighted: boolean; tone: string }) {
  const o = d.outline;
  const pts = (dir === "up" ? d.path : [...d.path].reverse()).map(([x, y]) => `${x},${Y(y)}`).join(" ");
  const [sx, sy] = dir === "up" ? d.path[0] : d.path[d.path.length - 1];
  // Cut line across the first flight
  const f = d.flights[0];
  const cut = f ? f.outline : null;
  let cutPath = "";
  if (cut) {
    const [a, b, c, e] = cut;
    const p1 = [a[0] + (b[0] - a[0]) * 0.55, a[1] + (b[1] - a[1]) * 0.55];
    const p2 = [e[0] + (c[0] - e[0]) * 0.72, e[1] + (c[1] - e[1]) * 0.72];
    cutPath = `M${p1[0]} ${Y(p1[1])}L${p2[0]} ${Y(p2[1])}`;
  }
  return (
    <g>
      <rect x={o.x} y={Y(o.y + o.d)} width={o.w} height={o.d} fill="#f4f1eb" stroke={highlighted ? tone : INK} strokeWidth={highlighted ? 2 : 0.8} vectorEffect="non-scaling-stroke" />
      {d.flights.map((fl, i) => (
        <g key={i}>
          <polygon points={fl.outline.map(([x, y]) => `${x},${Y(y)}`).join(" ")} fill="none" stroke={INK} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
          {fl.treads.map(([x1, y1, x2, y2], k) => (
            <line key={k} x1={x1} y1={Y(y1)} x2={x2} y2={Y(y2)} stroke={INK} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      ))}
      {dir === "up" && cutPath && <path d={cutPath} stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" fill="none" />}
      <polyline points={pts} fill="none" stroke={INK} strokeWidth={0.9} markerEnd="url(#fp-arrow)" vectorEffect="non-scaling-stroke" />
      <circle cx={sx} cy={Y(sy)} r={px(2.2)} fill={INK} />
      <text x={sx} y={Y(sy) + (dir === "up" ? px(13) : -px(7))} textAnchor="middle" fontSize={px(8.5)} fontWeight={700} fill={INK} fontFamily="Inter" letterSpacing={px(0.6)}>
        {dir === "up" ? "UP" : "DN"}
      </text>
    </g>
  );
}

function RoofExtras({ plan, Y, px, labelAt }: { plan: BuildingPlan; Y: (y: number) => number; px: (n: number) => number; labelAt: { x: number; y: number } }) {
  const m = plan.roof.mumty;
  const tank = plan.roof.water_tank;
  return (
    <g>
      {m && (
        <g>
          <rect x={m.rect.x} y={Y(m.rect.y + m.rect.d)} width={m.rect.w} height={m.rect.d} fill="none" stroke={WALL} strokeWidth={EXT_WALL} />
          {(() => {
            // door gap on the door side
            const { x, y, w, d } = m.rect;
            const dw = 3;
            const g =
              m.door_side === "right" ? { x: x + w - EXT_WALL / 2 - 0.05, y: Y(y + d / 2 + dw / 2), width: EXT_WALL + 0.1, height: dw }
              : m.door_side === "left" ? { x: x - EXT_WALL / 2 - 0.05, y: Y(y + d / 2 + dw / 2), width: EXT_WALL + 0.1, height: dw }
              : m.door_side === "front" ? { x: x + w / 2 - dw / 2, y: Y(y) - EXT_WALL / 2 - 0.05, width: dw, height: EXT_WALL + 0.1 }
              : { x: x + w / 2 - dw / 2, y: Y(y + d) - EXT_WALL / 2 - 0.05, width: dw, height: EXT_WALL + 0.1 };
            return <rect {...g} fill="#fbfaf7" />;
          })()}
          <text x={m.rect.x + m.rect.w / 2} y={Y(m.rect.y + m.rect.d) - px(5)} textAnchor="middle" fontSize={px(8.5)} fontWeight={600} fill={DIM} fontFamily="Inter" letterSpacing={px(0.5)}>
            MUMTY {feetInches(m.height_ft)}
          </text>
        </g>
      )}
      {tank && (
        <g>
          <rect x={tank.rect.x} y={Y(tank.rect.y + tank.rect.d)} width={tank.rect.w} height={tank.rect.d} fill="#fbfaf7" stroke={INK} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <path
            d={`M${tank.rect.x} ${Y(tank.rect.y)}L${tank.rect.x + tank.rect.w} ${Y(tank.rect.y + tank.rect.d)}M${tank.rect.x} ${Y(tank.rect.y + tank.rect.d)}L${tank.rect.x + tank.rect.w} ${Y(tank.rect.y)}`}
            stroke={INK}
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          />
          <text x={tank.rect.x + tank.rect.w / 2} y={Y(tank.rect.y) + px(11)} textAnchor="middle" fontSize={px(8.5)} fill={DIM} fontFamily="Inter">
            Water tank
          </text>
        </g>
      )}
      <text x={labelAt.x} y={Y(labelAt.y)} textAnchor="middle" fontSize={px(9.5)} fontWeight={600} fill={DIM} fontFamily="Inter" letterSpacing={px(0.8)}>
        ROOF
      </text>
      <text x={labelAt.x} y={Y(labelAt.y) + px(12)} textAnchor="middle" fontSize={px(8.5)} fill={DIM} fontFamily="Inter">
        Parapet {feetInches(plan.roof.parapet_ft)}
      </text>
    </g>
  );
}

/** A clear spot for the roof label: toward the rear of the slab, away from the mumty and tank. */
function roofLabelAt(rooms: Room[], plan: BuildingPlan) {
  if (!rooms.length) return { x: plan.site.plot.width_ft / 2, y: plan.site.plot.depth_ft * 0.7 };
  const x0 = Math.min(...rooms.map((r) => r.rect.x));
  const x1 = Math.max(...rooms.map((r) => r.rect.x + r.rect.w));
  const y0 = Math.min(...rooms.map((r) => r.rect.y));
  const y1 = Math.max(...rooms.map((r) => r.rect.y + r.rect.d));
  const m = plan.roof.mumty?.rect;
  const cx = m && m.x < (x0 + x1) / 2 ? (Math.max(m.x + m.w, x0) + x1) / 2 : (x0 + x1) / 2;
  return { x: cx, y: y0 + (y1 - y0) * 0.78 };
}

function Setbacks({ W, D, sb, px }: { W: number; D: number; sb: { front: number; rear: number; left: number; right: number }; px: (n: number) => number }) {
  const common = { stroke: BRICK, strokeWidth: 1, strokeDasharray: "7 4", vectorEffect: "non-scaling-stroke" as const };
  const fs = px(8.5);
  return (
    <g pointerEvents="none" opacity={0.85}>
      {sb.front > 0 && (
        <>
          <line x1={0} y1={D - sb.front} x2={W} y2={D - sb.front} {...common} />
          <text x={px(4)} y={D - sb.front - px(4)} fontSize={fs} fill={BRICK} fontFamily="Inter" fontWeight={600} letterSpacing={px(0.4)}>
            BUILDING LINE
          </text>
        </>
      )}
      {sb.rear > 0 && <line x1={0} y1={sb.rear} x2={W} y2={sb.rear} {...common} />}
      {sb.left > 0 && <line x1={sb.left} y1={0} x2={sb.left} y2={D} {...common} />}
      {sb.right > 0 && <line x1={W - sb.right} y1={0} x2={W - sb.right} y2={D} {...common} />}
    </g>
  );
}

function Boundary({ plan, Y, px }: { plan: BuildingPlan; Y: (y: number) => number; px: (n: number) => number }) {
  const W = plan.site.plot.width_ft;
  const D = plan.site.plot.depth_ft;
  const t = 0.45;
  const gates = [...plan.site.gates].sort((a, b) => a.at[0] - b.at[0]);
  // Front wall pieces between gates (plan y = 0 → svg y = D)
  const pieces: [number, number][] = [];
  let x = -t / 2;
  for (const g of gates) {
    const a = g.at[0] - g.width_ft / 2;
    if (a > x) pieces.push([x, a]);
    x = g.at[0] + g.width_ft / 2;
  }
  if (x < W + t / 2) pieces.push([x, W + t / 2]);
  const fill = "#7d756a";
  return (
    <g pointerEvents="none">
      <rect x={-t / 2} y={-t / 2} width={W + t} height={t} fill={fill} />
      <rect x={-t / 2} y={-t / 2} width={t} height={D + t} fill={fill} />
      <rect x={W - t / 2} y={-t / 2} width={t} height={D + t} fill={fill} />
      {pieces.map(([a, b], i) => (
        <rect key={i} x={a} y={Y(0) - t / 2} width={b - a} height={t} fill={fill} />
      ))}
      {gates.map((g) => {
        const a = g.at[0] - g.width_ft / 2;
        const b = g.at[0] + g.width_ft / 2;
        const y = Y(0);
        return (
          <g key={g.id}>
            {g.kind === "sliding" ? (
              <>
                <line x1={a} y1={y + 0.45} x2={b} y2={y + 0.45} stroke={INK} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
                <line x1={b - 1.5} y1={y + 0.45} x2={b + 0.4} y2={y + 0.45} stroke={INK} strokeWidth={0.8} markerEnd="url(#fp-arrow)" vectorEffect="non-scaling-stroke" />
              </>
            ) : (
              <path d={`M${a} ${y}L${a} ${y - (b - a)}A${b - a} ${b - a} 0 0 1 ${b} ${y}`} fill="none" stroke={INK} strokeWidth={0.7} strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
            )}
            <text x={(a + b) / 2} y={y + px(15)} textAnchor="middle" fontSize={px(8)} fill={DIM} fontFamily="Inter" fontWeight={500}>
              {g.kind === "pedestrian" ? "Gate" : "Car gate"}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Dim({ x1, y1, x2, y2, label, px, side = -1 }: { x1: number; y1: number; x2: number; y2: number; label: string; px: (n: number) => number; side?: 1 | -1 }) {
  const vertical = Math.abs(x1 - x2) < 1e-6;
  const tick = 0.55;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const fs = px(9.5);
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={DIM} strokeWidth={0.75} vectorEffect="non-scaling-stroke" />
      {[[x1, y1], [x2, y2]].map(([x, y], i) => (
        <line key={i} x1={x - tick} y1={y + tick} x2={x + tick} y2={y - tick} stroke={DIM} strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
      ))}
      {vertical ? (
        <text transform={`translate(${mx + side * px(5)} ${my}) rotate(-90)`} textAnchor="middle" fontSize={fs} fill={INK} fontFamily="Inter" fontWeight={500} style={{ fontVariantNumeric: "tabular-nums" }}>
          {label}
        </text>
      ) : (
        <text x={mx} y={my + side * px(4)} textAnchor="middle" fontSize={fs} fill={INK} fontFamily="Inter" fontWeight={500} style={{ fontVariantNumeric: "tabular-nums" }}>
          {label}
        </text>
      )}
    </g>
  );
}

function Dimensions({ W, D, sb, px }: { W: number; D: number; sb: { front: number; rear: number; left: number; right: number }; px: (n: number) => number }) {
  const ext = { stroke: FAINT, strokeWidth: 0.6, vectorEffect: "non-scaling-stroke" as const };
  // svg: rear edge at y=0, front edge (road) at y=D.
  const topRow = -2.6;
  const topOuter = -5.4;
  const rightRow = W + 2.8;
  const leftRow = -2.8;
  const chainX: [number, number][] = [];
  let x0 = 0;
  if (sb.left > 0) { chainX.push([0, sb.left]); x0 = sb.left; }
  chainX.push([x0, W - sb.right]);
  if (sb.right > 0) chainX.push([W - sb.right, W]);
  const chainY: [number, number][] = [];
  if (sb.rear > 0) chainY.push([0, sb.rear]);
  chainY.push([sb.rear, D - sb.front]);
  if (sb.front > 0) chainY.push([D - sb.front, D]);
  return (
    <g>
      {/* extension lines */}
      <line x1={0} y1={-0.6} x2={0} y2={topOuter - 0.6} {...ext} />
      <line x1={W} y1={-0.6} x2={W} y2={topOuter - 0.6} {...ext} />
      {sb.right > 0 && <line x1={W - sb.right} y1={-0.6} x2={W - sb.right} y2={topRow - 0.6} {...ext} />}
      <line x1={-0.6} y1={0} x2={leftRow - 0.6} y2={0} {...ext} />
      <line x1={-0.6} y1={D} x2={leftRow - 0.6} y2={D} {...ext} />
      {chainY.map(([a]) => a > 0 && <line key={a} x1={W + 0.6} y1={a} x2={rightRow + 0.6} y2={a} {...ext} />)}
      <line x1={W + 0.6} y1={0} x2={rightRow + 0.6} y2={0} {...ext} />
      <line x1={W + 0.6} y1={D} x2={rightRow + 0.6} y2={D} {...ext} />

      {chainX.length > 1 && chainX.map(([a, b]) => <Dim key={`x${a}`} x1={a} y1={topRow} x2={b} y2={topRow} label={feetInches(b - a)} px={px} />)}
      <Dim x1={0} y1={topOuter} x2={W} y2={topOuter} label={feetInches(W)} px={px} />
      <Dim x1={leftRow} y1={0} x2={leftRow} y2={D} label={feetInches(D)} px={px} />
      {chainY.map(([a, b]) => <Dim key={`y${a}`} x1={rightRow} y1={a} x2={rightRow} y2={b} label={feetInches(b - a)} px={px} side={1} />)}
    </g>
  );
}

function NorthArrow({ x, y, facing, px }: { x: number; y: number; facing: string; px: (n: number) => number }) {
  const r = 2.3;
  const rot = northRotation(facing);
  // The "N" sits beyond the arrow tip but stays upright.
  const rad = (rot * Math.PI) / 180;
  const dist = r + px(8);
  const nx = Math.sin(rad) * dist;
  const ny = -Math.cos(rad) * dist;
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <circle r={r} fill="#fbfaf7" stroke={INK} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
      <g transform={`rotate(${rot})`}>
        <path d={`M0 ${-r * 0.82}L${r * 0.42} ${r * 0.55}L0 ${r * 0.28}Z`} fill={INK} />
        <path d={`M0 ${-r * 0.82}L${-r * 0.42} ${r * 0.55}L0 ${r * 0.28}Z`} fill="#fbfaf7" stroke={INK} strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
      </g>
      <text x={nx} y={ny + px(3.2)} textAnchor="middle" fontSize={px(9)} fontWeight={700} fill={INK} fontFamily="Inter">
        N
      </text>
    </g>
  );
}

function ScaleBar({ x, y, px }: { x: number; y: number; px: (n: number) => number }) {
  const h = 0.55;
  const segs = [0, 5, 10, 20];
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      {segs.slice(0, -1).map((s, i) => (
        <rect key={s} x={s} y={0} width={segs[i + 1] - s} height={h} fill={i % 2 ? "#fbfaf7" : INK} stroke={INK} strokeWidth={0.7} vectorEffect="non-scaling-stroke" />
      ))}
      {segs.map((s) => (
        <text key={s} x={s} y={h + px(11)} textAnchor="middle" fontSize={px(8.5)} fill={DIM} fontFamily="Inter" style={{ fontVariantNumeric: "tabular-nums" }}>
          {s}
        </text>
      ))}
      <text x={20 + px(8)} y={h + px(11)} fontSize={px(8.5)} fill={DIM} fontFamily="Inter">
        ft
      </text>
    </g>
  );
}

export { INT_WALL };
