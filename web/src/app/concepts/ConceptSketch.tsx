import { useEffect, useState } from "react";
import { cn } from "@/app/lib/utils";

/**
 * Placeholder while a concept renders: an elevation that keeps drawing itself in pencil,
 * with a slow light sweep and an honest progress estimate (live renders take ~16 s).
 */
export function ConceptSketch({ label, prompt, startedAt, failed, message, className }: {
  label: string;
  prompt?: string;
  startedAt: number;
  failed?: boolean;
  message?: string;
  className?: string;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (failed) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [failed]);
  const secs = Math.max(0, (now - startedAt) / 1000);
  const progress = 1 - Math.exp(-secs / 9);

  return (
    <div className={cn("relative isolate overflow-hidden bg-sheet", className)}>
      <div className="bg-drafting-faint absolute inset-0" />
      <svg viewBox="0 0 320 180" className="absolute inset-0 h-full w-full" fill="none" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <g stroke="rgb(30 27 23 / 0.5)" strokeWidth="0.9" strokeLinejoin="round" className={failed ? "" : "sketch-loop"}>
          <path pathLength={1} d="M30 150H290" />
          <path pathLength={1} d="M74 150V64H226V150" />
          <path pathLength={1} d="M74 64V40H170V64" />
          <path pathLength={1} d="M200 150V50H226" />
          <path pathLength={1} d="M66 104H234" />
          <path pathLength={1} d="M92 122H140V146H92ZM150 74H196V96H150ZM92 74H132V96H92Z" />
          <path pathLength={1} d="M232 112H272V150M232 112V150" />
          <path pathLength={1} d="M40 150V132H72V150M240 132H286V150" />
        </g>
        <g stroke="rgb(158 63 38 / 0.5)" strokeWidth="0.8">
          {Array.from({ length: 7 }, (_, i) => (
            <path key={i} pathLength={1} d={`M${154 + i * 6} 76V94`} className={failed ? "" : "sketch-loop"} style={{ animationDelay: `${0.6 + i * 0.05}s` }} />
          ))}
        </g>
      </svg>
      {!failed && <div className="absolute inset-y-0 -left-1/2 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white/55 to-transparent" />}

      <div className="absolute inset-x-0 bottom-0 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] font-medium text-ink">
            {failed ? `Concept ${label} didn't render` : `Rendering concept ${label}…`}
          </span>
          {!failed && <span className="text-[11.5px] text-pencil tabular">{Math.floor(secs)}s</span>}
        </div>
        {failed ? (
          <p className="mt-1 line-clamp-2 text-[11.5px] text-fail">{message ?? "The image model returned an error."}</p>
        ) : (
          <>
            {prompt && <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-graphite">{prompt}</p>}
            <div className="mt-2 h-[2px] overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-brick transition-[width] duration-300" style={{ width: `${Math.round(progress * 96)}%` }} />
            </div>
          </>
        )}
      </div>
      <style>{`
        .sketch-loop { stroke-dasharray: 1; stroke-dashoffset: 1; animation: sketch 3.6s cubic-bezier(0.65,0,0.35,1) infinite; }
        @keyframes sketch { 0% { stroke-dashoffset: 1; } 45%, 70% { stroke-dashoffset: 0; } 100% { stroke-dashoffset: -1; } }
        @media (prefers-reduced-motion: reduce) { .sketch-loop { animation: none; stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}
