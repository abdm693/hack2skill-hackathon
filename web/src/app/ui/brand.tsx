import { useState, type CSSProperties } from "react";
import type { Envelope } from "@contracts/api-types";
import { cn } from "@/app/lib/utils";

export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 64 64" className="size-7 shrink-0" aria-hidden>
        <rect width="64" height="64" rx="15" fill="var(--color-brick)" />
        <g fill="none" stroke="var(--color-sheet)" strokeWidth="3.4" strokeLinecap="square">
          <rect x="15" y="13" width="34" height="38" />
          <path d="M15 31h14M29 31v-6M37 13v12M37 31h12M29 51V41" />
        </g>
      </svg>
      <span className="font-display-tight text-[21px] font-medium leading-none text-ink">Naqsha</span>
      {!compact && (
        <span className="font-urdu text-[15px] leading-none text-pencil" lang="ur" dir="rtl" style={{ marginTop: 2 }}>
          نقشہ
        </span>
      )}
    </span>
  );
}

/**
 * The hero elevation: a two-storey Lahore house that draws itself, then gets stamped.
 * Scale 8 px/ft; ground at y=290, plinth 278, first floor 190, roof 102, parapet 74.
 * If the page opens in a background tab, it renders fully drawn instead of animating.
 */
export function HouseLineArt({ className }: { className?: string }) {
  const [animate] = useState(() => typeof document === "undefined" || document.visibilityState === "visible");
  const d = (delay: number, dur = 1.4): CSSProperties | undefined =>
    animate ? { strokeDasharray: 1, strokeDashoffset: 1, animation: `draw ${dur}s cubic-bezier(0.22,1,0.36,1) ${delay}s forwards` } : undefined;
  const fade = (animation: string): CSSProperties | undefined => (animate ? { opacity: 0, animation } : undefined);
  const ink = "var(--color-ink)";
  const faint = "rgb(30 27 23 / 0.16)";
  return (
    <svg viewBox="0 0 420 330" className={cn("h-auto w-full", className)} fill="none" aria-label="Line drawing of a two-storey house with LDA approval stamp">
      <defs>
        <pattern id="stone" width="12" height="7" patternUnits="userSpaceOnUse">
          <path d="M0 6.5h12M6 0v6.5" stroke={faint} strokeWidth="1" />
        </pattern>
        <path id="stampCircle" d="M 0,0 m -31,0 a 31,31 0 1,1 62,0 a 31,31 0 1,1 -62,0" />
      </defs>

      {/* construction lines */}
      <g stroke={faint} strokeWidth="0.75">
        <path pathLength={1} d="M18 278H402" style={d(0.05, 1.1)} />
        <path pathLength={1} d="M18 190H402" style={d(0.12, 1.1)} />
        <path pathLength={1} d="M18 102H402" style={d(0.19, 1.1)} />
        <path pathLength={1} d="M60 20V312M340 20V312" style={d(0.26, 1.1)} />
      </g>
      <g fill="var(--color-pencil)" fontFamily="Inter, sans-serif" fontSize="7.5" style={fade("appear 0.6s ease-out 1s forwards")}>
        <text x="20" y="274">+1'6"</text>
        <text x="20" y="186">+12'6"</text>
        <text x="20" y="98">+23'6"</text>
      </g>

      {/* ground */}
      <path pathLength={1} d="M10 290H410" stroke={ink} strokeWidth="1.4" style={d(0.3)} />

      {/* building outline */}
      <g stroke={ink} strokeWidth="1.25" strokeLinejoin="round">
        {/* mumty + tank */}
        <path pathLength={1} d="M64 102V30H128V102" style={d(0.55)} />
        <path pathLength={1} d="M60 30H132" style={d(0.6)} />
        <path pathLength={1} d="M134 102V66H172V102" style={d(0.65)} />
        {/* parapet & roof */}
        <path pathLength={1} d="M60 74H300V102" style={d(0.5)} />
        <path pathLength={1} d="M156 102H300" style={d(0.55)} />
        {/* main mass: first floor over porch and drawing */}
        <path pathLength={1} d="M60 74V196H300" style={d(0.6)} />
        {/* ground floor */}
        <path pathLength={1} d="M156 196V278H300V74" style={d(0.7)} />
        {/* porch canopy */}
        <path pathLength={1} d="M52 196H156M52 204H156M52 196V204" style={d(0.8)} />
        <path pathLength={1} d="M64 204V278" style={d(0.85)} />
        {/* plinth */}
        <path pathLength={1} d="M52 278H312V290" style={d(0.75)} />
      </g>

      {/* stone pier */}
      <g style={fade("appear 0.8s ease-out 1.25s forwards")}>
        <rect x="270" y="74" width="30" height="204" fill="url(#stone)" />
      </g>
      <path pathLength={1} d="M270 74V278" stroke={ink} strokeWidth="1" style={d(1.0)} />

      {/* first-floor frame + fins */}
      <g stroke={ink} strokeWidth="1">
        <path pathLength={1} d="M160 110H266V188H160Z" style={d(1.05)} />
        <path pathLength={1} d="M168 118H258V180H168Z" strokeWidth="0.75" style={d(1.15)} />
      </g>
      <g stroke={ink} strokeWidth="0.9">
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} pathLength={1} d={`M${172 + i * 9.4} 120V178`} style={d(1.25 + i * 0.04, 0.9)} />
        ))}
      </g>
      {/* bedroom 2 window over porch */}
      <g stroke={ink} strokeWidth="0.9">
        <path pathLength={1} d="M84 128H136V172H84Z" style={d(1.1)} />
        <path pathLength={1} d="M110 128V172M84 150H136" strokeWidth="0.6" style={d(1.3)} />
      </g>
      {/* drawing room window */}
      <g stroke={ink} strokeWidth="0.9">
        <path pathLength={1} d="M176 218H256V264H176Z" style={d(1.2)} />
        <path pathLength={1} d="M202.7 218V264M229.3 218V264" strokeWidth="0.6" style={d(1.35)} />
        <path pathLength={1} d="M170 266H262" style={d(1.4)} />
      </g>
      {/* main door in porch */}
      <path pathLength={1} d="M120 278V226H148V278" stroke={ink} strokeWidth="0.9" style={d(1.2)} />
      {/* car */}
      <path
        pathLength={1}
        d="M70 276V262Q72 256 80 254L92 246Q96 243 104 243H126Q132 243 136 248L142 256Q148 258 148 264V276M78 276A6 6 0 1 0 90 276M128 276A6 6 0 1 0 140 276"
        stroke={ink}
        strokeWidth="0.85"
        style={d(1.45, 1.2)}
      />
      {/* mumty door */}
      <path pathLength={1} d="M104 102V62H122V102" stroke={ink} strokeWidth="0.8" style={d(1.0)} />
      {/* roof railing */}
      <path pathLength={1} d="M172 92H262M172 92V102M202 92V102M232 92V102M262 92V102" stroke={ink} strokeWidth="0.6" style={d(1.3)} />

      {/* boundary wall & gate */}
      <g stroke={ink} strokeWidth="1">
        <path pathLength={1} d="M164 290V258H340V290" style={d(1.5)} />
        <path pathLength={1} d="M40 290V256H52V290" style={d(1.55)} />
        <path pathLength={1} d="M54 262H158V290" strokeWidth="0.8" style={d(1.6)} />
      </g>
      <g stroke={ink} strokeWidth="0.55">
        {Array.from({ length: 13 }, (_, i) => (
          <path key={i} pathLength={1} d={`M${60 + i * 7.6} 264V290`} style={d(1.65 + i * 0.02, 0.6)} />
        ))}
      </g>

      {/* palm in the side space */}
      <g stroke={ink} strokeWidth="0.9" strokeLinecap="round">
        <path pathLength={1} d="M352 290C350 250 348 210 346 168" style={d(1.6)} />
        <path pathLength={1} d="M346 168C330 160 318 166 308 178M346 168C360 156 376 158 388 170M346 168C342 150 332 142 318 140M346 168C354 150 366 144 380 144M346 168C346 154 350 142 356 134" style={d(1.75)} />
      </g>

      {/* dimensions */}
      <g stroke="var(--color-graphite)" strokeWidth="0.8">
        <path pathLength={1} d="M60 306H340M56 310L64 302M336 310L344 302M60 300V312M340 300V312" style={d(1.9, 1)} />
        <path pathLength={1} d="M380 74V278M376 82L384 70M376 286L384 274M374 74H386M374 278H386" style={d(1.95, 1)} />
      </g>
      <g fill="var(--color-graphite)" fontFamily="Inter, sans-serif" fontSize="9" fontWeight="500" style={fade("appear 0.5s ease-out 2.4s forwards")}>
        <text x="200" y="320" textAnchor="middle">35'-0"</text>
        <text x="394" y="180" textAnchor="middle" transform="rotate(-90 394 180)">25'-6" to parapet</text>
      </g>

      {/* approval stamp */}
      <g transform="translate(222 46) rotate(-12)">
        <g style={{ ...fade("stamp 0.55s cubic-bezier(0.2,0.9,0.2,1.2) 2.7s forwards"), transformOrigin: "0 0" }}>
          <circle r="40" fill="var(--color-paper)" fillOpacity="0.92" stroke="var(--color-brick)" strokeWidth="1.6" />
          <circle r="35" stroke="var(--color-brick)" strokeWidth="0.7" />
          <circle r="22" stroke="var(--color-brick)" strokeWidth="0.7" />
          <text fill="var(--color-brick)" fontFamily="Inter, sans-serif" fontSize="6.8" fontWeight="600" letterSpacing="1.6">
            <textPath href="#stampCircle" startOffset="0">LDA BUILDING & ZONING · CHECKED ·</textPath>
          </text>
          <path d="M-9 0.5L-2.5 7L10 -6.5" stroke="var(--color-brick)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}

/** Thumbnail for projects without imagery: the plot with its setbacks, or a blank sheet. */
export function PlotSketch({ envelope, width, depth, className }: { envelope?: Envelope | null; width?: number; depth?: number; className?: string }) {
  const W = width || 0;
  const D = depth || 0;
  if (!W || !D) {
    return (
      <svg viewBox="0 0 160 100" className={cn("h-full w-full", className)} aria-hidden>
        <g stroke="rgb(30 27 23 / 0.22)" fill="none" strokeWidth="0.75" strokeDasharray="3 3">
          <rect x="58" y="22" width="44" height="56" />
        </g>
        <path d="M80 44v12M74 50h12" stroke="var(--color-brick)" strokeWidth="1.2" />
      </svg>
    );
  }
  const scale = Math.min(110 / W, 74 / D);
  const w = W * scale;
  const h = D * scale;
  const x0 = (160 - w) / 2;
  const y0 = (100 - h) / 2 - 2;
  const sb = envelope?.setbacks_ft;
  const r = envelope?.buildable_rect;
  // y flips: road (y=0) at the bottom
  return (
    <svg viewBox="0 0 160 100" className={cn("h-full w-full", className)} aria-hidden>
      <defs>
        <pattern id="ps-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V4" stroke="rgb(158 63 38 / 0.35)" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect x={x0} y={y0} width={w} height={h} fill="url(#ps-hatch)" stroke="var(--color-ink)" strokeWidth="0.9" />
      {sb && r && (
        <rect
          x={x0 + r.x * scale}
          y={y0 + (D - r.y - r.d) * scale}
          width={r.w * scale}
          height={r.d * scale}
          fill="var(--color-sheet)"
          stroke="var(--color-brick)"
          strokeWidth="0.9"
          strokeDasharray="2.5 1.5"
        />
      )}
      <path d={`M${x0 - 8} ${y0 + h + 6}H${x0 + w + 8}`} stroke="rgb(30 27 23 / 0.35)" strokeWidth="0.75" />
      <text x={80} y={y0 + h + 13} textAnchor="middle" fontSize="6" fill="var(--color-pencil)" fontFamily="Inter, sans-serif">
        {W}' × {D}'
      </text>
    </svg>
  );
}
