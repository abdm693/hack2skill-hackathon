import { useId } from "react";
import { motion } from "motion/react";
import type { Envelope } from "@contracts/api-types";
import { feetInches, num } from "@/app/lib/utils";

const BEARING: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

/** Rotation (deg, clockwise from screen-up) of a north arrow when the road is drawn at the bottom. */
export function northRotation(facing?: string): number {
  return (180 - (BEARING[facing ?? "N"] ?? 0) + 360) % 360;
}

const spring = { type: "spring" as const, stiffness: 140, damping: 22, mass: 0.9 };

/**
 * The LDA envelope: plot with the road at the bottom, hatched setbacks, the buildable rectangle and
 * its dimensions. Animates between plots (preview → confirmed).
 */
export function EnvelopeDiagram({
  width,
  depth,
  envelope,
  corner,
  facing,
  className,
}: {
  width: number;
  depth: number;
  envelope: Envelope | null;
  corner?: boolean;
  facing?: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const VW = 320;
  const VH = 330;
  const padL = 40;
  const padR = 34;
  const padT = 34;
  const padB = 62;
  const s = Math.min((VW - padL - padR) / width, (VH - padT - padB) / depth);
  const w = width * s;
  const h = depth * s;
  const ox = padL + (VW - padL - padR - w) / 2;
  const oy = padT + (VH - padT - padB - h) / 2;
  const sx = (x: number) => ox + x * s;
  const sy = (y: number) => oy + (depth - y) * s; // road (y=0) at the bottom

  const sb = envelope?.setbacks_ft ?? { front: 0, rear: 0, left: 0, right: 0 };
  const r = envelope?.buildable_rect ?? { x: 0, y: 0, w: width, d: depth };
  const buildArea = r.w * r.d;
  const perFloor = envelope ? Math.min(buildArea, envelope.max_ground_coverage_sqft) : 0;
  const splay = corner ? (width * depth) / 225 <= 10 ? 5 : 10 : 0;

  const roadY = sy(0) + 10;
  const ink = "var(--color-ink)";
  const dim = "var(--color-graphite)";
  const brick = "var(--color-brick)";

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className={className} role="img" aria-label={`Plot ${width} by ${depth} feet with LDA setbacks`}>
      <defs>
        <pattern id={`h-${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V6" stroke="rgb(158 63 38 / 0.42)" strokeWidth="1" />
        </pattern>
        <marker id={`t-${id}`} viewBox="-4 -4 8 8" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M-3 3L3 -3" stroke={dim} strokeWidth="1" />
        </marker>
      </defs>

      {/* road */}
      <rect x={6} y={roadY} width={VW - 12} height={24} fill="rgb(30 27 23 / 0.06)" />
      <path d={`M10 ${roadY + 12}H${VW - 10}`} stroke="rgb(30 27 23 / 0.28)" strokeWidth="1" strokeDasharray="7 6" />
      <text x={VW / 2} y={roadY + 38} textAnchor="middle" fontSize="9.5" fill="var(--color-pencil)" fontFamily="Inter" letterSpacing="0.5">
        Road
      </text>

      {/* setbacks (hatched) */}
      <motion.rect initial={false} animate={{ x: sx(0), y: sy(depth), width: w, height: h }} transition={spring} fill={`url(#h-${id})`} />

      {/* buildable rectangle */}
      <motion.rect
        initial={false}
        animate={{ x: sx(r.x), y: sy(r.y + r.d), width: r.w * s, height: r.d * s }}
        transition={spring}
        fill="var(--color-sheet)"
        stroke={brick}
        strokeWidth="1.25"
        strokeDasharray="5 3"
      />

      {/* plot boundary */}
      <motion.rect initial={false} animate={{ x: sx(0), y: sy(depth), width: w, height: h }} transition={spring} fill="none" stroke={ink} strokeWidth="1.6" />
      {splay > 0 && (
        <path d={`M${sx(width - splay)} ${sy(0)}L${sx(width)} ${sy(splay)}`} stroke={ink} strokeWidth="1" strokeDasharray="3 2" />
      )}

      {envelope && (
        <g fontFamily="Inter" fontSize="9" fill={brick} fontWeight="600" textAnchor="middle">
          {sb.front > 0 && <text x={sx(width / 2)} y={sy(sb.front / 2) + 3}>{feetInches(sb.front)} front</text>}
          {sb.rear > 0 && <text x={sx(width / 2)} y={sy(depth - sb.rear / 2) + 3}>{feetInches(sb.rear)} rear</text>}
          {sb.right > 0 && (
            <text transform={`translate(${sx(width - sb.right / 2) + 3} ${sy(depth / 2)}) rotate(-90)`}>{feetInches(sb.right)} side</text>
          )}
          {sb.left > 0 && (
            <text transform={`translate(${sx(sb.left / 2) + 3} ${sy(depth / 2)}) rotate(-90)`}>{feetInches(sb.left)} side</text>
          )}
        </g>
      )}

      {/* buildable label */}
      {envelope && r.w * s > 70 && (
        <g textAnchor="middle" fontFamily="Inter">
          <text x={sx(r.x + r.w / 2)} y={sy(r.y + r.d / 2) - 4} fontSize="10.5" fontWeight="600" fill={ink}>
            Buildable
          </text>
          <text x={sx(r.x + r.w / 2)} y={sy(r.y + r.d / 2) + 10} fontSize="9.5" fill={dim}>
            {feetInches(r.w)} × {feetInches(r.d)}
          </text>
          <text x={sx(r.x + r.w / 2)} y={sy(r.y + r.d / 2) + 23} fontSize="9.5" fill={dim}>
            {num(perFloor)} sq ft a floor
          </text>
        </g>
      )}

      {/* overall dimensions */}
      <g stroke={dim} strokeWidth="0.8">
        <line x1={sx(0)} y1={oy - 14} x2={sx(width)} y2={oy - 14} markerStart={`url(#t-${id})`} markerEnd={`url(#t-${id})`} />
        <line x1={sx(0)} y1={oy - 19} x2={sx(0)} y2={oy - 4} />
        <line x1={sx(width)} y1={oy - 19} x2={sx(width)} y2={oy - 4} />
        <line x1={ox - 16} y1={sy(0)} x2={ox - 16} y2={sy(depth)} markerStart={`url(#t-${id})`} markerEnd={`url(#t-${id})`} />
        <line x1={ox - 21} y1={sy(0)} x2={ox - 4} y2={sy(0)} />
        <line x1={ox - 21} y1={sy(depth)} x2={ox - 4} y2={sy(depth)} />
      </g>
      <g fontFamily="Inter" fontSize="10" fontWeight="500" fill={ink} textAnchor="middle">
        <rect x={sx(width / 2) - 22} y={oy - 21} width={44} height={13} fill="var(--color-sheet)" />
        <text x={sx(width / 2)} y={oy - 11}>{feetInches(width)}</text>
        <g transform={`translate(${ox - 16} ${sy(depth / 2)}) rotate(-90)`}>
          <rect x={-22} y={-7} width={44} height={13} fill="var(--color-sheet)" />
          <text y={3.5}>{feetInches(depth)}</text>
        </g>
      </g>

      {/* north arrow */}
      <g transform={`translate(${VW - 18} 22)`}>
        <g transform={`rotate(${northRotation(facing)})`}>
          <path d="M0 -10L4.5 6L0 3L-4.5 6Z" fill={ink} />
        </g>
        <text y={21} textAnchor="middle" fontSize="8.5" fontWeight="600" fill={ink} fontFamily="Inter">
          N
        </text>
      </g>
    </svg>
  );
}
