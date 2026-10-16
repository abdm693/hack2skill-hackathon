/** "Explore a sample home": open your copy of a finished sample (made once, then reused). No sign-in needed. */
import { api } from "@/api/client";
import { toast } from "@/app/store/toast";

export async function openSampleHome(navigate: (to: string) => void, sampleId?: string): Promise<boolean> {
  try {
    let id = sampleId;
    if (!id) {
      const samples = await api.listSamples();
      id = samples[0]?.id;
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
