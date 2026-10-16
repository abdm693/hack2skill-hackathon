/** Pre-overhaul route (/p/:id/setup) → BriefView. Delete at integration (see design/compat.tsx). */
import { CompatView } from "@/app/design/compat";
import { BriefView } from "./BriefView";

export function SetupStep() {
  return <CompatView view={BriefView} />;
}
