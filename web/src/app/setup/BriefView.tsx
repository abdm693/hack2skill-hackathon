/**
 * PLACEHOLDER (APP-SHELL) until APP-FLOWS lands the real Brief view at this path.
 * It shows the existing setup conversation inside the new shell, with the agreed props.
 */
import type { Project } from "@contracts/api-types";
import { useAskContext } from "@/app/shell/ask";
import { ViewFrame } from "@/app/shell/ViewFrame";
import { SetupStep } from "./SetupStep";

export function BriefView({ project }: { project: Project; onProjectChange(p: Project): void }) {
  // The setup conversation has its own composer; keep the dock's Next pill only.
  useAskContext({ line: null, suggestions: [], hidden: project.stage === "setup" });
  return (
    <ViewFrame>
      <div className="mx-auto h-full max-w-[1280px] overflow-hidden rounded-t-panel bg-surface shadow-e1">
        <SetupStep />
      </div>
    </ViewFrame>
  );
}
