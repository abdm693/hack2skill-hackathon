import { memo, useCallback, useMemo } from "react";
import type { BuildingPlan } from "@contracts/plan";
import type { ViewerController } from "../core/controller";

const OUTDOOR = new Set(["porch", "balcony", "terrace", "lawn", "driveway", "courtyard", "open_space"]);

/** Plan-view mini map of the walker's level (road at the top, like the top-down 3D view). */
export const MiniMap = memo(function MiniMap({ ctrl, plan, levelId, roomName }: { ctrl: ViewerController; plan: BuildingPlan; levelId: string | null; roomName: string | null }) {
  const { width_ft: W, depth_ft: D } = plan.site.plot;
  const scale = Math.min(150 / W, 196 / D);
  const rooms = useMemo(() => plan.rooms.filter((r) => r.level === (levelId ?? plan.levels[0]?.id)), [plan, levelId]);
  const marker = useCallback((g: SVGGElement | null) => void (ctrl.minimapMarker = g), [ctrl]);
  const level = plan.levels.find((l) => l.id === levelId);
  return (
    <div className="nq-mini nq-glass" aria-hidden>
      <div className="nq-mini-label">
        <span>{level?.name ?? "Plan"}</span>
        <span>N ↑</span>
      </div>
      <svg width={W * scale} height={D * scale} viewBox={`-1 -1 ${W + 2} ${D + 2}`}>
        <rect x={0} y={0} width={W} height={D} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.25)" strokeWidth={0.4} strokeDasharray="1.2 1" />
        {rooms.map((r) => {
          const here = r.name === roomName;
          const out = OUTDOOR.has(r.type);
          return (
            <rect
              key={r.id}
              x={r.rect.x}
              y={r.rect.y}
              width={r.rect.w}
              height={r.rect.d}
              fill={here ? "rgba(245,165,36,0.32)" : out ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.10)"}
              stroke={here ? "rgba(245,165,36,0.9)" : "rgba(255,255,255,0.38)"}
              strokeWidth={here ? 0.55 : 0.3}
            />
          );
        })}
        <g ref={marker}>
          <circle r={2.6} fill="rgba(245,165,36,0.25)" />
          <path d="M0,-2.6 L1.8,1.8 L0,0.9 L-1.8,1.8 Z" fill="#fff" stroke="#f5a524" strokeWidth={0.35} strokeLinejoin="round" />
        </g>
      </svg>
    </div>
  );
});
