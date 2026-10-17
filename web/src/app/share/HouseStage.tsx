/**
 * The 3D home, full-bleed, with comment pins: Orbit · Walk (V), C to comment, click a pin to open its thread.
 * Used by the client view, and as the House view until APP-FLOWS's explore/HouseView lands.
 * Reads ?mode=walk and ?comment=<id> (fly to a pin) from the URL.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, MessageSquarePlus } from "lucide-react";
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
import { Popover } from "@/app/design/kit";
import { RoomNavigator } from "@/app/explore/RoomNavigator";
import { levelName, levelsOf, sentenceCase } from "@/app/plan/model";
import { anchorPlace } from "./anchor";
import { NewComment } from "./NewComment";

type Draft = { anchor: Comment["anchor"]; camera: Comment["camera"]; snapshot: string };

export function HouseStage({
  project,
  version,
  clientView,
  active = true,
}: {
  project: Project;
  version: Version;
  clientView?: boolean;
  /** False while kept mounted behind another view: no shortcuts, no HUD. */
  active?: boolean;
}) {
  const [params, setParams] = useSearchParams();
  const phone = usePhone();
  const comments = useProject((s) => s.comments);
  const addComment = useProject((s) => s.addComment);
  const patchProject = useProject((s) => s.patchProject);
  const openComments = useShell((s) => s.openComments);
  const viewer = useRef<ViewerHandle>(null);
  const [commentMode, setCommentMode] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  // The viewer shows its own build progress; we only need to know when the house is ready.
  const [building, setBuilding] = useState(true);
  // Walk: the room navigator (M) and the room you are in.
  const [navOpen, setNavOpen] = useState(false);
  const [room, setRoom] = useState<string | null>(null);
  const roomPill = useRef<HTMLButtonElement>(null);

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
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey || draft) return;
      if ((e.key === "c" || e.key === "C") && mode === "orbit") setCommentMode((v) => !v);
      if (e.key === "v" || e.key === "V") setMode(mode === "walk" ? "orbit" : "walk");
      if (e.key === "m" || e.key === "M") setNavOpen((o) => !o);
      if (e.key === "Escape" && commentMode) setCommentMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, mode, commentMode, draft, setMode]);

  // ?comment=<id>: fly to that pin once the house is built.
  const focusId = params.get("comment");
  useEffect(() => {
    if (!focusId || building) return;
    const c = shown.find((x) => x.id === focusId);
    if (c) viewer.current?.flyTo(c);
  }, [focusId, building, shown]);

  const onReady = useCallback(
    async () => {
      setBuilding(false);
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

  // Above the dock at every width, as in the owner's House.
  const hudBottom = "calc(var(--dock-h, 96px) + 12px)";
  /** In walk, pin at the crosshair, exactly as the C key does; in orbit, click to pin. */
  const comment = () => {
    if (mode === "walk") window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", code: "KeyC", bubbles: true }));
    else setCommentMode((v) => !v);
  };
  const levels = useMemo(() => levelsOf(version.plan), [version.plan]);
  const current = room ? version.plan.rooms.find((r) => r.id === room) : undefined;

  return (
    <div className={cn("absolute inset-0 overflow-hidden bg-hud", !active && "pointer-events-none invisible")} aria-hidden={active ? undefined : true}>
      <HouseViewer
        ref={viewer}
        plan={version.plan}
        sections={sections}
        mode={mode}
        comments={shown}
        commentMode={commentMode || mode === "walk"}
        onAddComment={(d) => setDraft(d)}
        onSelectComment={(id) => openComments({ focus: id })}
        onReady={() => void onReady()}
        onExitWalk={() => setMode("orbit")}
        onRoomChange={(id) => setRoom(id)}
      />

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
        <button
          ref={roomPill}
          type="button"
          onClick={() => setNavOpen((o) => !o)}
          aria-expanded={navOpen}
          aria-label="Rooms (M)"
          title="Rooms (M)"
          className="glass-hud pointer-events-auto inline-flex h-11 max-w-[220px] items-center gap-2 rounded-full px-4 text-[14px] font-medium outline-none hover:bg-[rgb(24_24_27/.86)]"
        >
          <span className="truncate">
            {current ? `${sentenceCase(current.name)} · ${(levels.find((l) => l.id === current.level) ? levelName(levels.find((l) => l.id === current.level)!) : "").replace(/ floor$/i, "")}` : "Rooms"}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-hud-ink-2" strokeWidth={1.75} />
          {!phone && <Kbd tone="hud">M</Kbd>}
        </button>
        {(
          <Tooltip content={mode === "walk" ? "Pin a comment where you look" : commentMode ? "Click anywhere on the house" : "Pin a comment"} shortcut={["C"]}>
            <button
              type="button"
              onClick={comment}
              aria-pressed={mode === "orbit" ? commentMode : undefined}
              aria-label="Comment (C)"
              className={cn(
                "pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-medium outline-none transition-colors focus-visible:shadow-focus",
                commentMode ? "bg-hud-ink text-ink" : "glass-hud hover:bg-[rgb(24_24_27/.86)]",
              )}
            >
              <MessageSquarePlus className="size-4" strokeWidth={1.75} />
              <span className={phone ? "sr-only" : ""}>{commentMode ? "Click to pin" : "Comment"}</span>
              {!phone && !commentMode && <Kbd tone="hud">C</Kbd>}
            </button>
          </Tooltip>
        )}
      </div>

      <Popover
        open={navOpen && active}
        onClose={() => setNavOpen(false)}
        anchor={roomPill}
        side="top"
        tone="hud"
        className="w-[300px]"
        sheetBelow={768}
        sheetFull
        label="Rooms"
        avoid={() => [document.querySelector(".nq-mini")]}
      >
        <RoomNavigator
          plan={version.plan}
          open={navOpen}
          current={room}
          onGo={(id) => {
            setNavOpen(false);
            if (mode !== "walk") setMode("walk");
            viewer.current?.goToRoom(id);
          }}
          onFloor={(id) => {
            setNavOpen(false);
            viewer.current?.setFloor(id);
          }}
        />
      </Popover>

      {/* New comment */}
      <div className="pointer-events-none absolute inset-x-0 z-[30] flex justify-center px-3" style={{ bottom: "calc(var(--dock-h) + 12px)" }}>
        <AnimatePresence>
          {draft && (
            <NewComment
              key="new"
              snapshot={draft.snapshot}
              place={anchorPlace(draft.anchor, version.plan)}
              askName={clientView}
              onCancel={() => { setDraft(null); viewer.current?.cancelDraft(); }}
              onPost={post}
            />
          )}
        </AnimatePresence>
      </div>
      <motion.div aria-hidden initial={false} animate={{ opacity: commentMode ? 1 : 0 }} transition={{ duration: 0.2, ease: ease.out }} className="pointer-events-none absolute inset-0 z-[4] shadow-[inset_0_0_0_3px_var(--color-hud-accent)]" />
    </div>
  );
}
