import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Download, RefreshCw, X } from "lucide-react";
import { Button, IconButton } from "@/app/ui/Button";
import { Spinner } from "@/app/ui/primitives";

/** Before/after viewer for an AI render of the current 3D view. */
export function RenderLightbox({
  before,
  after,
  error,
  onClose,
  onRetry,
}: {
  before: string;
  after?: string;
  error?: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  const [pos, setPos] = useState(50);
  const [secs, setSecs] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (after || error) return;
    const t0 = Date.now();
    const t = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(t);
  }, [after, error]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
      if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };

  return (
    <motion.div
      className="fixed inset-0 z-40 flex flex-col bg-black/85 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label="Photoreal render"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sheet sm:px-6">
        <div>
          <p className="font-display-text text-[19px]">Photoreal render</p>
          <p className="text-[12.5px] text-sheet/60">
            {after ? "Drag the line to compare the 3D view with the AI render." : error ? "The render didn't come back." : "Turning this view into a photo with the image model…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {after && (
            <a href={after} download="naqsha-render.jpg" target="_blank" rel="noreferrer">
              <Button variant="glass" size="sm" icon={<Download className="size-3.5" strokeWidth={1.75} />}>
                Download
              </Button>
            </a>
          )}
          <IconButton label="Close" tone="dark" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-8">
        <div
          ref={box}
          className="relative aspect-video max-h-full w-full max-w-[1400px] touch-none select-none overflow-hidden rounded-2xl bg-black ring-1 ring-white/10"
          onPointerDown={(e) => { if (!after) return; dragging.current = true; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); move(e.clientX); }}
          onPointerMove={(e) => dragging.current && move(e.clientX)}
          onPointerUp={() => (dragging.current = false)}
        >
          <img src={before} alt="3D view" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
          {after && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
              style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
            >
              <img src={after} alt="AI render" className="h-full w-full object-cover" draggable={false} />
            </motion.div>
          )}
          {after && (
            <>
              <div className="pointer-events-none absolute inset-y-0 w-px bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.5)]" style={{ left: `${pos}%` }} />
              <div
                className="pointer-events-none absolute top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-float"
                style={{ left: `${pos}%` }}
              >
                <span className="text-[13px] font-semibold">⇆</span>
              </div>
              <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-medium text-white">3D view</span>
              <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-medium text-white">AI render</span>
            </>
          )}
          {!after && !error && (
            <div className="absolute inset-0 grid place-items-center bg-black/35">
              <div className="flex items-center gap-3 rounded-full bg-black/70 px-5 py-2.5 text-[14px] text-white">
                <Spinner className="text-[#e7a58f]" /> Rendering… <span className="tabular text-white/60">{secs}s</span>
              </div>
              <div className="absolute inset-y-0 -left-1/3 w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center bg-black/55">
              <div className="max-w-sm text-center text-white">
                <p className="text-[15px] font-medium">{error}</p>
                <Button variant="primary" className="mt-4" icon={<RefreshCw className="size-4" strokeWidth={1.75} />} onClick={onRetry}>
                  Try again
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
