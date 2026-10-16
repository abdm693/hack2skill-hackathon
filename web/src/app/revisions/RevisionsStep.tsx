/** Pre-overhaul route (/p/:id/revisions) → RevisionsView. Delete at integration (see design/compat.tsx). */
import { CompatView } from "@/app/design/compat";
import { RevisionsView } from "./RevisionsView";

export function RevisionsStep() {
  return <CompatView view={RevisionsView} />;
}
