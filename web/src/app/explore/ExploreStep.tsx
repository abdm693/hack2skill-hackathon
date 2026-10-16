/** Pre-overhaul route (/p/:id/explore) → HouseView. Delete at integration (see design/compat.tsx). */
import { CompatView } from "@/app/design/compat";
import { HouseView } from "./HouseView";

export function ExploreStep() {
  return <CompatView view={HouseView} />;
}
