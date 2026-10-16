import { memo, useCallback, useMemo } from "react";
import type { BuildingPlan } from "@contracts/plan";
import type { ViewerController } from "../core/controller";

const OUTDOOR = new Set(["porch", "balcony", "terrace", "lawn", "driveway", "courtyard", "open_space"]);
const FACING_AZ: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

/**
 * Plan-view mini map of the walker's level, drawn as seen standing on the street: road at the bottom, plan +x to the
 * right (SVG y = D − y_ft). The walker marker is moved imperatively by the controller (no React renders per frame).
 */
export const MiniMap = memo(function MiniMap({ ctrl, plan, levelId, roomName }: { ctrl: ViewerController; plan: BuildingPlan; levelId: string | null; roomName: string | null }) {
  const { width_ft: W, depth_ft: D } = plan.site.plot;
  const scale = Math.min(150 / W, 196 / D);
  const rooms = useMemo(() => plan.rooms.filter((r) => r.level === (levelId ?? plan.levels[0]?.id)), [plan, levelId]);
  const marker = useCallback((g: SVGGElement | null) => void (ctrl.minimapMarker = g), [ctrl]);
  const level = plan.levels.find((l) => l.id === levelId);
  // the front (road) is down on this map, so north sits at 180° − facing (clockwise from up)
  const north = 180 - (FACING_AZ[plan.site.facing] ?? 0);
  return (
    <div className="nq-mini nq-glass" aria-hidden>
      <div className="nq-mini-label">
        <span>{level?.name ?? "Plan"}</span>
        <span className="nq-mini-north">
          <svg width="11" height="11" viewBox="-6 -6 12 12">
            <path d="M0,-5 L3,3 L0,1.6 L-3,3 Z" transform={`rotate(${north})`} fill="currentColor" />
          </svg>
          N
        </span>
      </div>
      <svg width={W * scale} height={D * scale} viewBox={`-1 -1 ${W + 2} ${D + 2}`}>
        <rect x={0} y={0} width={W} height={D} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.25)" strokeWidth={0.4} strokeDasharray="1.2 1" />
        <line x1={0} y1={D + 0.6} x2={W} y2={D + 0.6} stroke="rgba(255,255,255,0.45)" strokeWidth={0.5} />
        {rooms.map((r) => {
          const here = r.name === roomName;
          const out = OUTDOOR.has(r.type);
          return (
            <rect
              key={r.id}
              x={r.rect.x}
              y={D - (r.rect.y + r.rect.d)}
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
