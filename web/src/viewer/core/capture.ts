/**
 * Canvas capture that works with preserveDrawingBuffer: false — render a fresh frame and read it back in the
 * same task, before the browser composites and clears the drawing buffer.
 */
import type * as THREE from "three";

export interface CaptureOptions {
  width?: number;
  height?: number;
  /** Draw a comment pin at this NDC position (x, y in −1..1). */
  pinNdc?: { x: number; y: number } | null;
  pinColor?: string;
}

/** Copy the current WebGL drawing buffer into a PNG data URL (cover-crop when both width and height are given). */
export function grabCanvas(src: HTMLCanvasElement, opts: CaptureOptions = {}): string {
  const sw = src.width, sh = src.height;
  const maxW = 1600;
  let w = Math.round(opts.width ?? Math.min(sw, maxW));
  let h = Math.round(opts.height ?? (w * sh) / sw);
  w = Math.max(16, w);
  h = Math.max(16, h);
  // cover-crop the source to the requested aspect
  const ta = w / h, sa = sw / sh;
  let cx = 0, cy = 0, cw = sw, ch = sh;
  if (sa > ta) {
    cw = sh * ta;
    cx = (sw - cw) / 2;
  } else if (sa < ta) {
    ch = sw / ta;
    cy = (sh - ch) / 2;
  }
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, cx, cy, cw, ch, 0, 0, w, h);
  if (opts.pinNdc) {
    // NDC → source px → output px
    const px = (((opts.pinNdc.x + 1) / 2) * sw - cx) * (w / cw);
    const py = (((1 - opts.pinNdc.y) / 2) * sh - cy) * (h / ch);
    drawPin(ctx, px, py, Math.max(1, w / 640), opts.pinColor ?? "#f59e0b");
  }
  return c.toDataURL("image/png");
}

/** A map-style pin: ring on the surface, stem, filled head. */
export function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.lineCap = "round";
  // contact ring
  ctx.beginPath();
  ctx.ellipse(x, y, 9 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * s;
  ctx.stroke();
  // stem
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 26 * s);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 3 * s;
  ctx.stroke();
  // head
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 6 * s;
  ctx.beginPath();
  ctx.arc(x, y - 34 * s, 11 * s, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = 2.5 * s;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y - 34 * s, 3.5 * s, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();
}

export function projectToNdc(p: THREE.Vector3, camera: THREE.Camera): { x: number; y: number } | null {
  const v = p.clone().project(camera);
  if (v.z > 1 || v.z < -1) return null;
  return { x: v.x, y: v.y };
}
