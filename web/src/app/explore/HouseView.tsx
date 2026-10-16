/**
 * PLACEHOLDER (APP-SHELL) until APP-FLOWS lands the real House view at this path.
 * The 3D home with comment pins (share/HouseStage), for the version in ?v= or the current one.
 */
import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import type { Project } from "@contracts/api-types";
import { useProject } from "@/app/store/project";
import { HouseStage } from "@/app/share/HouseStage";
import { Spinner } from "@/app/ui/Spinner";

export function HouseView({ project }: { project: Project; onProjectChange(p: Project): void }) {
  const [params] = useSearchParams();
  const vid = params.get("v") ?? project.current_version_id ?? "";
  const version = useProject((s) => s.versions[vid]);
  const loadVersion = useProject((s) => s.loadVersion);
  const commentsFor = useProject((s) => s.commentsFor);
  const loadComments = useProject((s) => s.loadComments);
  useEffect(() => {
    if (vid) void loadVersion(vid);
  }, [vid, loadVersion]);
  useEffect(() => {
    if (vid && commentsFor !== vid) void loadComments(vid);
  }, [vid, commentsFor, loadComments]);

  if (!version) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-hud text-hud-ink-2">
        <span className="flex items-center gap-2.5 text-[14px]"><Spinner /> Opening the house…</span>
      </div>
    );
  }
  return <HouseStage key={version.id} project={project} version={version} />;
}
