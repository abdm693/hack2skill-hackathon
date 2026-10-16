/** Pre-overhaul route (/p/:id/concepts) → ConceptsView. Delete at integration (see design/compat.tsx). */
import { CompatView } from "@/app/design/compat";
import { ConceptsView } from "./ConceptsView";

export function ConceptsStep() {
  return <CompatView view={ConceptsView} />;
}
