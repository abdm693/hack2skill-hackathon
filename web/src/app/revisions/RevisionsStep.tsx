/** Pre-overhaul route (/p/:id/revisions). Delete at integration (see design/compat.tsx). */
import { CompatView } from "@/app/design/compat";
import { PlanView } from "@/app/plan/PlanView";

export function RevisionsStep() {
  return <CompatView view={PlanView} />;
}
