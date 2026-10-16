/**
 * The 3D home, full-bleed, with comment pins: Orbit · Walk (V), C to comment, click a pin to open its thread.
 * Used by the client view, and as the House view until APP-FLOWS's explore/HouseView lands.
 * Reads ?mode=walk and ?comment=<id> (fly to a pin) from the URL.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { MessageSquarePlus } from "lucide-react";
import type { Comment, Project, Version } from "@contracts/api-types";
import type { DesignSectionSrc } from "@/engine";
import { HouseViewer, type ViewerHandle } from "@/viewer/HouseViewer";
import { api } from "@/api/client";
import { cn } from "@/app/lib/utils";
import { isTyping, usePhone } from "@/app/lib/hooks";
import { roleOf } from "@/app/lib/views";
import { useProject } from "@/app/store/project";
import { toast } from "@/app/store/toast";
import { Segmented } from "@/app/ui/Segmented";
import { Tooltip } from "@/app/ui/Tooltip";
import { Kbd } from "@/app/ui/Kbd";
import { ease } from "@/app/ui/motion";
import { useShell } from "@/app/shell/state";
import { anchorPlace } from "./anchor";
import { NewComment } from "./NewComment";

type Draft = { anchor: Comment["anchor"]; camera: Comment["camera"]; snapshot: string };

export function HouseStage({ project, version, clientView }: { project: Project; version: Version; clientView?: boolean }) {
  const [params, setParams] = useSearchParams();
  const phone = usePhone();
  const comments = useProject((s) => s.comments);
  const addComment = useProject((s) => s.addComment);
  const patchProject = useProject((s) => s.patchProject);
  const openComments = useShell((s) => s.openComments);
  const viewer = useRef<ViewerHandle>(null);
  const [commentMode, setCommentMode] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [build, setBuild] = useState<{ done: number; total: number } | null>({ done: 0, total: version.sections.length });

  const mode: "orbit" | "walk" = params.get("mode") === "walk" ? "walk" : "orbit";
  const setMode = useCallback(
    (m: "orbit" | "walk") =>
      setParams((p) => {
        const n = new URLSearchParams(p);
        if (m === "walk") n.set("mode", "walk");
        else n.delete("mode");
        return n;
      }, { replace: true }),
    [setParams],
  );

  const sections: DesignSectionSrc[] = useMemo(() => version.sections.map((s) => ({ name: s.name, layer: s.layer, body: s.code })), [version.sections]);
  const shown = useMemo(() => comments.filter((c) => c.version_id === version.id), [comments, version.id]);

  // C toggles comment mode in orbit (in walk, the viewer handles C itself); V switches Orbit and Walk.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || draft) return;
      if ((e.key === "c" || e.key === "C") && mode === "orbit") setCommentMode((v) => !v);
      if (e.key === "v" || e.key === "V") setMode(mode === "walk" ? "orbit" : "walk");
      if (e.key === "Escape" && commentMode) setCommentMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, commentMode, draft, setMode]);

  // ?comment=<id>: fly to that pin once the house is built.
  const focusId = params.get("comment");
  useEffect(() => {
    if (!focusId || build) return;
    const c = shown.find((x) => x.id === focusId);
    if (c) viewer.current?.flyTo(c);
  }, [focusId, build, shown]);

  const onReady = useCallback(
    async () => {
      setBuild(null);
      if (clientView || roleOf(project) === "client") return;
      // First build of a version: keep a real 3D thumbnail for the homes grid.
      const key = `naqsha.thumb.${version.id}`;
      let done = false;
      try { done = !!localStorage.getItem(key); } catch { /* ignore */ }
      if (done || !viewer.current) return;
      try {
        const img = await viewer.current.capture({ width: 960, height: 720 });
        if (!img) return;
        const { url } = await api.saveThumbnail(project.id, version.id, img);
        try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
        patchProject({ thumbnail_url: url });
      } catch (e) {
        console.warn("thumbnail failed", e);
      }
    },
    [clientView, project, version.id, patchProject],
  );

  const post = async (text: string) => {
    if (!draft) return false;
    const c = await addComment({ version_id: version.id, text, anchor: draft.anchor, camera: draft.camera, snapshot_data_url: draft.snapshot || undefined });
    if (!c) return false;
    setDraft(null);
    setCommentMode(false);
    toast.show("Comment pinned");
    openComments({ focus: c.id });
    return true;
  };

  const hudBottom = phone ? "calc(var(--dock-h) + 12px)" : "var(--chrome)";

  return (
    <div className="absolute inset-0 overflow-hidden bg-hud">
      <HouseViewer
        ref={viewer}
        plan={version.plan}
        sections={sections}
        mode={mode}
        comments={shown}
        commentMode={commentMode || mode === "walk"}
        onAddComment={(d) => setDraft(d)}
        onSelectComment={(id) => openComments({ focus: id })}
        onBuildProgress={(_, done, total) => setBuild({ done, total })}
        onReady={() => void onReady()}
        onExitWalk={() => setMode("orbit")}
      />

      {/* Building */}
      <AnimatePresence>
        {build && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            className="pointer-events-none absolute inset-x-0 z-[5] flex justify-center"
            style={{ top: phone ? 128 : 84 }}
          >
            <span className="glass-hud inline-flex items-center gap-2.5 rounded-full px-4 py-2 text-[13px] font-medium">
              <span className="size-1.5 rounded-full bg-hud-accent animate-breathe" />
              {build.total ? `Building your home, ${Math.min(build.done, build.total)} of ${build.total}` : "Building your home…"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orbit · Walk, Comment */}
      <div className="pointer-events-none absolute z-[6] flex items-center gap-2" style={{ left: "var(--chrome)", bottom: hudBottom }}>
        <div className="glass-hud pointer-events-auto rounded-full">
          <Segmented<"orbit" | "walk">
            label="Camera"
            value={mode}
            onChange={setMode}
            tone="hud"
            className="h-11 bg-transparent p-1"
            options={[{ value: "orbit", label: "Orbit", title: "Orbit (V)" }, { value: "walk", label: "Walk", title: "Walk (V)" }]}
          />
        </div>
        {mode === "orbit" && (
          <Tooltip content={commentMode ? "Click anywhere on the house" : "Pin a comment"} shortcut={["C"]}>
            <button
              type="button"
              onClick={() => setCommentMode((v) => !v)}
              aria-pressed={commentMode}
              className={cn(
                "pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium outline-none transition-colors focus-visible:shadow-focus",
                commentMode ? "bg-hud-ink text-ink" : "glass-hud hover:bg-[rgb(24_24_27/.72)]",
              )}
            >
              <MessageSquarePlus className="size-4" strokeWidth={1.75} />
              <span className={phone ? "sr-only" : ""}>{commentMode ? "Click to pin" : "Comment"}</span>
              {!phone && !commentMode && <Kbd tone="hud">C</Kbd>}
            </button>
          </Tooltip>
        )}
      </div>

      {/* New comment */}
      <div className="pointer-events-none absolute inset-x-0 z-[30] flex justify-center px-3" style={{ bottom: "calc(var(--dock-h) + 12px)" }}>
        <AnimatePresence>
          {draft && (
            <NewComment
              key="new"
              snapshot={draft.snapshot}
              place={anchorPlace(draft.anchor, version.plan)}
              askName={clientView}
              onCancel={() => setDraft(null)}
              onPost={post}
            />
          )}
        </AnimatePresence>
      </div>
      <motion.div aria-hidden initial={false} animate={{ opacity: commentMode ? 1 : 0 }} transition={{ duration: 0.2, ease: ease.out }} className="pointer-events-none absolute inset-0 z-[4] shadow-[inset_0_0_0_3px_var(--color-hud-accent)]" />
    </div>
  );
}
