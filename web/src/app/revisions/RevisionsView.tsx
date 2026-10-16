/**
 * PLACEHOLDER (APP-SHELL) until APP-FLOWS lands the real Revisions view at this path.
 * It shows the existing revisions screen inside the new shell, with the agreed props.
 */
import type { Project } from "@contracts/api-types";
import { ViewFrame } from "@/app/shell/ViewFrame";
import { RevisionsStep } from "./RevisionsStep";

export function RevisionsView(_: { project: Project; onProjectChange(p: Project): void }) {
  return (
    <ViewFrame>
      <div className="mx-auto h-full max-w-[1280px] overflow-hidden">
        <RevisionsStep />
      </div>
    </ViewFrame>
  );
}
