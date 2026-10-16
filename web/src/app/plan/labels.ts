/**
 * Room labels that never collide and never go blank. For each room (largest first) try its name forms
 * horizontally, then vertically for tall rooms, at 12 → 10 px; a form must fit inside the room and miss every
 * label already placed. If nothing fits, the room gets a numbered key and a legend line instead.
 * Sizes are screen px; positions are plan feet (y up). Text is measured with canvas in the real font.
 */
import type { Room } from "@contracts/plan";
import { sizeLabel } from "@/app/lib/utils";
import { nameForms } from "./model";

export interface Box { x0: number; y0: number; x1: number; y1: number }

export type Label =
  | { room: Room; kind: "text"; name: string; dims: string | null; delta?: string; fs: number; dimFs: number; vertical: boolean; cx: number; cy: number }
  | { room: Room; kind: "key"; n: number; cx: number; cy: number };

let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, number>();

/** Width in px of `text` at `fs` px (sans 500, or mono). */
export function measure(text: string, fs: number, mono = false): number {
  const key = `${mono ? "m" : "s"}|${fs}|${text}`;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  if (!ctx && typeof document !== "undefined") ctx = document.createElement("canvas").getContext("2d");
  let w = text.length * fs * (mono ? 0.62 : 0.56);
  if (ctx) {
    ctx.font = mono ? `500 ${fs}px "Geist Mono", ui-monospace, monospace` : `500 ${fs}px Geist, ui-sans-serif, system-ui, sans-serif`;
    w = ctx.measureText(text).width;
  }
  cache.set(key, w);
  return w;
}

export function clearMeasureCache() {
  cache.clear();
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * @param ppf  screen px per plan foot
 * @param avoid boxes (plan ft) that labels must not cover, e.g. stair symbols
 */
export function layoutLabels(rooms: Room[], ppf: number, opts: { avoid?: Box[]; taken?: Set<string>; site?: Set<string>; deltas?: Map<string, string> } = {}): Label[] {
  const placed: Box[] = [...(opts.avoid ?? [])];
  const out: Label[] = [];
  const taken = opts.taken ?? new Set(rooms.map((r) => r.name.toLowerCase()));
  const order = [...rooms].sort((a, b) => b.rect.w * b.rect.d - a.rect.w * a.rect.d);
  let key = 0;
  const pad = 4 / ppf; // 4px inside the room edge (walls)
  const NAME = [12, 11, 10];
  const DIM = 10.5;

  for (const r of order) {
    const { x, y, w, d } = r.rect;
    const inner = { x0: x + pad, y0: y + pad, x1: x + w - pad, y1: y + d - pad };
    const cx = x + w / 2;
    const cy = y + d / 2;
    const iw = (inner.x1 - inner.x0) * ppf; // px
    const ih = (inner.y1 - inner.y0) * ppf;
    const site = opts.site?.has(r.id);
    const delta = opts.deltas?.get(r.id);
    const dims = site ? null : `${sizeLabel(r.rect.w, r.rect.d)}${delta ? ` · ${delta}` : ""}`;
    let done = false;

    // Candidate positions: centre, then nudged up/down by a third of the free height.
    const shifts = [0, 0.22, -0.22, 0.34, -0.34];

    outer: for (const form of nameForms(r, taken)) {
      for (const fs of NAME) {
        const nameW = measure(form, fs);
        const dimW = dims ? measure(dims, DIM, true) : 0;
        for (const vertical of ih > iw * 1.25 ? [false, true] : [false]) {
          const along = vertical ? ih : iw;
          const across = vertical ? iw : ih;
          if (nameW > along || fs * 1.25 > across) continue;
          const withDims = !!dims && dimW <= along && fs * 1.25 + DIM * 1.3 <= across;
          for (const useDims of withDims ? [true, false] : [false]) {
            const blockW = Math.max(nameW, useDims ? dimW : 0);
            const blockH = fs * 1.2 + (useDims ? DIM * 1.3 : 0);
            for (const sh of shifts) {
              const offset = sh * (vertical ? w : d);
              const px = vertical ? cx + offset : cx;
              const py = vertical ? cy : cy + offset;
              const hw = (vertical ? blockH : blockW) / 2 / ppf;
              const hh = (vertical ? blockW : blockH) / 2 / ppf;
              const box = { x0: px - hw, y0: py - hh, x1: px + hw, y1: py + hh };
              if (box.x0 < inner.x0 || box.x1 > inner.x1 || box.y0 < inner.y0 || box.y1 > inner.y1) continue;
              if (placed.some((p) => overlaps(p, box))) continue;
              placed.push(box);
              out.push({ room: r, kind: "text", name: form, dims: useDims ? sizeLabel(r.rect.w, r.rect.d) : null, delta: useDims ? delta : undefined, fs, dimFs: DIM, vertical, cx: px, cy: py });
              done = true;
              break outer;
            }
          }
        }
      }
    }
    if (!done) {
      key += 1;
      const rad = 8 / ppf;
      out.push({ room: r, kind: "key", n: key, cx, cy });
      placed.push({ x0: cx - rad, y0: cy - rad, x1: cx + rad, y1: cy + rad });
    }
  }
  // Number keys in reading order (front-left first) so the legend reads naturally.
  const keys = out.filter((l): l is Extract<Label, { kind: "key" }> => l.kind === "key").sort((a, b) => a.cy - b.cy || a.cx - b.cx);
  keys.forEach((k, i) => (k.n = i + 1));
  return out;
}
