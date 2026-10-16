/**
 * PLACEHOLDER (APP-SHELL) until APP-FLOWS lands the real Plan view at this path.
 * It shows the existing design screen (plan, compliance, run) inside the new shell, with the agreed props.
 */
import type { Project } from "@contracts/api-types";
import { DesignStep } from "@/app/design/DesignStep";
import { ViewFrame } from "@/app/shell/ViewFrame";

export function PlanView(_: { project: Project; onProjectChange(p: Project): void }) {
  return (
    <ViewFrame>
      <div className="mx-auto h-full max-w-[1440px] overflow-hidden">
        <DesignStep />
      </div>
    </ViewFrame>
  );
}
