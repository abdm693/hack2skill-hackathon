/** "Explore a sample home": open your copy of a finished sample (made once, then reused). No sign-in needed. */
import type { Project } from "@contracts/api-types";
import { api } from "@/api/client";
import { plotLabel } from "@/api/domain";
import { toast } from "@/app/store/toast";

/** "Sample · 10 marla modern home, Johar Town" → "10 marla modern home, Johar Town" (the card already says Sample). */
export function sampleTitle(name: string): string {
  const t = name.replace(/^\s*sample\s*[·:\-–—]\s*/i, "").trim();
  return t ? t.replace(/^\w/, (c) => c.toUpperCase()) : name;
}

/** "10 marla · Johar Town · Modern contemporary", from the sample's brief. */
export function sampleCaption(p: Project): string {
  const b = p.brief;
  const style = b?.style ? b.style.replace(/(\s)(\w)/g, (_, sp: string, c: string) => sp + c.toLowerCase()) : null;
  // A model-written "DHA / Johar Town" is not a place; fall back to the city.
  const place = b?.scheme && !b.scheme.includes("/") ? b.scheme : b?.city || null;
  return [b?.plot?.area_marla ? plotLabel(b.plot.area_marla) : null, place, style].filter(Boolean).join(" · ");
}

/** The sample the landing hero animates (the 10 marla modern home), else the first one. */
export function heroSample(samples: Project[]): Project | undefined {
  return samples.find((s) => Math.abs((s.brief?.plot?.area_marla ?? 0) - 10) < 0.6) ?? samples[0];
}

export async function openSampleHome(navigate: (to: string) => void, sampleId?: string): Promise<boolean> {
  try {
    let id = sampleId;
    if (!id) {
      const samples = await api.listSamples();
      id = heroSample(samples)?.id;
    }
    if (!id) {
      toast.show("No sample home is available right now. Start your own instead.");
      return false;
    }
    const p = await api.cloneProject(id);
    navigate(`/app/p/${p.id}/${p.current_version_id ? "house" : ""}`);
    return true;
  } catch (e) {
    toast.error("Couldn't open the sample home", e);
    return false;
  }
}
