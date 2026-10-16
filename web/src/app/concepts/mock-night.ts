/**
 * Mock mode only: POST /concepts/night. The live API edits each day image into the same view at night; the mock
 * grades the day image in a canvas (blue hour, a darker sky, warm light low down) so the Day/Night toggle can be
 * exercised end to end. Results stay in memory for the session.
 */
import type { Concept } from "@contracts/api-types";
import type { SSEHandlers, StreamOptions } from "@/api/client";
import { dispatchSSE } from "@/api/sse";
import { db, sleep } from "@/api/mock/db";

const memo = new Map<string, string>();

async function grade(url: string): Promise<string> {
  const hit = memo.get(url);
  if (hit) return hit;
  const img = new Image();
  img.src = url;
  await img.decode();
  const w = Math.min(1280, img.naturalWidth);
  const h = Math.round((img.naturalHeight * w) / img.naturalWidth);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) return url;
  g.filter = "brightness(0.42) saturate(0.75) contrast(1.08)";
  g.drawImage(img, 0, 0, w, h);
  g.filter = "none";
  // Blue hour: a cool wash, deeper toward the sky.
  g.globalCompositeOperation = "multiply";
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, "rgb(40 58 110)");
  sky.addColorStop(0.45, "rgb(92 112 170)");
  sky.addColorStop(1, "rgb(150 150 170)");
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // Interior and porch light: warm pools low in the frame where the house is.
  g.globalCompositeOperation = "screen";
  const pools: [number, number, number][] = [
    [0.32, 0.5, 0.07],
    [0.5, 0.48, 0.08],
    [0.68, 0.5, 0.07],
    [0.42, 0.72, 0.09],
    [0.6, 0.74, 0.08],
  ];
  for (const [x, y, r] of pools) {
    const rad = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w);
    rad.addColorStop(0, "rgba(255, 184, 104, 0.55)");
    rad.addColorStop(1, "rgba(255, 176, 92, 0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, w, h);
  }
  g.globalCompositeOperation = "source-over";
  const out = c.toDataURL("image/jpeg", 0.86);
  memo.set(url, out);
  return out;
}

export async function mockNight(pid: string, ids: string[], handlers: SSEHandlers, opts?: StreamOptions): Promise<void> {
  const project = db().projects.find((p) => p.id === pid);
  const concepts = ids.map((id) => project?.concepts.find((c) => c.id === id)).filter((c): c is Concept => !!c);
  // All night edits run in parallel live; they land a few seconds apart.
  await Promise.all(
    concepts.map(async (concept, index) => {
      await sleep(2600 + index * 650 + Math.random() * 900, opts?.signal);
      try {
        const night_url = await grade(concept.url);
        if (opts?.signal?.aborted) return;
        dispatchSSE(handlers, "concept", { index, concept: { ...concept, night_url } });
      } catch (e) {
        dispatchSSE(handlers, "concept.failed", { index, message: e instanceof Error ? e.message : "The night view failed." });
      }
    }),
  );
  if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  dispatchSSE(handlers, "done", {});
}
