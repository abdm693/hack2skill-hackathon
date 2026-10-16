/** Pre-overhaul route (/p/:id/design) → PlanView. Delete at integration (see design/compat.tsx). */
import { CompatView } from "./compat";
import { PlanView } from "@/app/plan/PlanView";

export function DesignStep() {
  return <CompatView view={PlanView} />;
}
