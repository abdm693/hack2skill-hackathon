/**
 * House (DESIGN.md "House: explore and walk HUD"): the 3D home full-bleed with glass-hud toolbars in fixed zones —
 * the floor stack on the left edge; Orbit · Walk, View (light, layers, section, neighbours, cars, "Render this
 * view") and the version switcher bottom-left; the room navigator and comment mode bottom-right. Walk's own Finish
 * asks before starting a revision. The dock's Ask sends a conversational revision ("Tell Naqsha what to change…").
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, CircleAlert, DoorOpen, Footprints, Layers, MessageSquarePlus, Moon, Orbit, Search, Sparkles, Sun, Sunset, X } from "lucide-react";
import type { Layer } from "@contracts/house-sdk";
import type { Comment, Project, Version } from "@contracts/api-types";
import type { BuildingPlan, ComplianceReport } from "@contracts/plan";
import { HouseViewer, type ViewerHandle } from "@/viewer/HouseViewer";
import type { DesignSectionSrc, SectionResult } from "@/engine";
import { api, errorMessage } from "@/api/client";
import { cn, feetInches, hourLabel, relativeTime } from "@/app/lib/utils";
import { resolveVersion } from "@/app/lib/views";
import { useProject } from "@/app/store/project";
import { toast } from "@/app/store/toast";
import { useAskContext } from "@/app/shell/ask";
import { useShell } from "@/app/shell/state";
import { flow, useFlow } from "@/app/design/flow";
import { FloorStack, stackItems } from "@/app/design/FloorStack";
import { Button, Dialog, EASE_OUT, IconButton, Kbd, Popover, Segmented, notify, useHotkeys, useMediaQuery } from "@/app/design/kit";
import { useViewNav } from "@/app/design/nav";
import { sectionPhrase, versionLine } from "@/app/design/words";
import { CATEGORY, SITE_TYPES, hueColor, levelKey, levelName, levelsOf, sentenceCase } from "@/app/plan/model";
import { notesLine } from "@/app/plan/compliance";
import { ReviseStatus } from "@/app/revisions/ReviseStatus";
import { Composer, type CommentDraft } from "./Composer";
import { RoomNavigator } from "./RoomNavigator";

export { RoomNavigator };
import { RenderLightbox } from "./RenderLightbox";
import { placeholderSnapshot } from "./snapshot";

const FT = 0.3048;
const LAYERS: { id: Layer; label: string }[] = [
  { id: "structure", label: "Walls and slabs" },
  { id: "facade", label: "Facade" },
  { id: "interior", label: "Interiors" },
  { id: "furniture", label: "Furniture" },
  { id: "landscape", label: "Garden and street" },
  { id: "lighting", label: "Lights" },
];
type Light = "day" | "dusk" | "night";
const ALL_LAYERS: Record<Layer, boolean> = { structure: true, facade: true, interior: true, furniture: true, landscape: true, lighting: true, custom: true };

export function HouseView({ project, onProjectChange, active = true }: { project: Project; onProjectChange(p: Project): void; active?: boolean }) {
  const goTo = useViewNav();
  const [params, setParams] = useSearchParams();
  // Beside the dock only when there is room for both clusters and a 720px dock between them.
  const wide = useMediaQuery("(min-width: 1600px)");
  const phone = useMediaQuery("(max-width: 767px)");

  // ?v= is a version id or its number (?v=2); one that doesn't exist falls back to the latest, and says so.
  const vParam = params.get("v");
  const resolved = resolveVersion(project, vParam);
  const vid = resolved.id ?? "";
  useEffect(() => {
    if (!active || !vParam || resolved.known) return;
    toast.show(`There's no version ${vParam.replace(/^v/i, "")} of this home. Showing the latest.`);
    setParams((p) => { const n = new URLSearchParams(p); n.delete("v"); return n; }, { replace: true });
  }, [active, vParam, resolved.known, setParams]);
  const version = useFlow((s) => (vid ? s.versions[vid] : undefined));
  const comments = useFlow((s) => (vid ? s.comments[vid] : undefined));
  const revise = useFlow((s) => (s.revise?.pid === project.id ? s.revise : null));
  useEffect(() => {
    if (vid) void flow.loadVersion(project.id, vid);
  }, [project.id, vid]);
  useEffect(() => {
    if (vid) void flow.loadComments(project.id, vid);
  }, [project.id, vid]);
  useEffect(() => {
    void flow.resume(project);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]);

  // Keep showing the last version while the next one loads (no blank canvas on a version switch).
  const [shown, setShown] = useState<Version | undefined>(version);
  useEffect(() => {
    if (version) setShown(version);
  }, [version]);
  const plan = shown?.plan;
  const sections: DesignSectionSrc[] = useMemo(
    () => (shown ? shown.sections.map((s) => ({ name: s.name, layer: s.layer, body: s.code })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown?.id, shown?.sections],
  );
  const isLatest = !!shown && shown.id === project.current_version_id;
  const latestVid = project.current_version_id;

  // ── Viewer state ──
  const viewer = useRef<ViewerHandle>(null);
  const ready = useRef(false);
  // The query string holds the state the shell's commands can set: ?mode=walk, ?floor, ?room, ?light, ?comment, ?v.
  const mode: "orbit" | "walk" = params.get("mode") === "walk" ? "walk" : "orbit";
  const setMode = useCallback(
    (m: "orbit" | "walk") => {
      setParams((p) => { const n = new URLSearchParams(p); if (m === "walk") n.set("mode", "walk"); else n.delete("mode"); return n; }, { replace: true });
    },
    [setParams],
  );
  const levels = useMemo(() => (plan ? levelsOf(plan) : []), [plan]);
  const [floor, setFloorState] = useState<string>(() => params.get("floor") ?? "all");
  const visibleLevels = useMemo(() => {
    if (mode === "walk" || floor === "all" || !levels.length) return undefined;
    const i = levels.findIndex((l) => l.id === floor);
    return i < 0 ? undefined : levels.slice(0, i + 1).map((l) => l.id);
  }, [floor, levels, mode]);
  const [layers, setLayers] = useState<Record<Layer, boolean>>(ALL_LAYERS);
  const [cutFt, setCutFt] = useState<number | null>(null);
  const lightParam = params.get("light");
  const light: Light = lightParam === "night" || lightParam === "dusk" ? lightParam : "day";
  const setLight = (l: Light) => {
    setParams((p) => { const n = new URLSearchParams(p); if (l === "day") n.delete("light"); else n.set("light", l); return n; }, { replace: true });
  };
  const [hour, setHour] = useState(13);
  // Night: the viewer's own night lighting (night prop) with the sun set; dusk is just after sunset.
  const sunHour = light === "night" ? 19.5 : light === "dusk" ? 18.9 : hour;
  const [ghost, setGhost] = useState(true);
  const [cars, setCars] = useState<"auto" | "show" | "hide">("auto");
  const [commentMode, setCommentMode] = useState(false);
  const [draft, setDraft] = useState<CommentDraft | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [room, setRoom] = useState<{ id: string | null; level: string | null }>({ id: params.get("room"), level: null });
  const initialRoom = useRef<string | null>(params.get("room"));
  const [render, setRender] = useState<{ before: string; after?: string; error?: string } | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishWalk, setFinishWalk] = useState(false);
  const [failed, setFailed] = useState<SectionResult[]>([]);
  const [built, setBuilt] = useState(false);
  // What the 3D build found lives in the project store, so Plan's sheet and the status line count it too.
  const asBuilt = useProject((s) => (shown ? s.asBuilt[shown.id] ?? null : null));
  const setAsBuilt = (vidFor: string, r: ComplianceReport | null) => useProject.getState().setAsBuilt(vidFor, r);
  const topFt = useMemo(() => (plan ? Math.max(...plan.levels.map((l) => l.elevation_ft + l.height_ft)) + 2 : 30), [plan]);

  const applyFloor = useCallback((id: string) => {
    setFloorState(id);
    viewer.current?.setFloor(id);
  }, []);
  const setFloor = (id: string) => {
    // Tap the active floor again (orbit) to see the whole house.
    const next = mode === "orbit" && id === floor && id !== "all" ? "all" : id;
    applyFloor(next);
    setParams((p) => { const n = new URLSearchParams(p); if (next === "all") n.delete("floor"); else n.set("floor", next); return n; }, { replace: true });
  };
  // ?floor= set from outside (the command bar).
  const floorParam = params.get("floor");
  useEffect(() => {
    if (!floorParam || floorParam === floor || !levels.some((l) => l.id === floorParam)) return;
    applyFloor(floorParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorParam, levels]);

  const goToRoom = (id: string) => {
    const r = plan?.rooms.find((x) => x.id === id);
    if (!r) return;
    if (mode === "orbit") setFloorState(r.level);
    setRoom({ id, level: r.level });
    viewer.current?.goToRoom(id);
  };

  const capture = useCallback(
    async (width = 1280) => {
      try {
        const img = await viewer.current?.capture({ width, height: Math.round((width * 9) / 16) });
        if (img) return img;
      } catch (e) {
        console.warn("capture failed", e);
      }
      return placeholderSnapshot(plan, "3D view", width, Math.round((width * 9) / 16));
    },
    [plan],
  );

  const onReady = useCallback(
    async (result: { summary: Parameters<typeof api.asBuilt>[2]; sections: SectionResult[] }) => {
      setFailed(result.sections.filter((s) => !s.ok));
      const first = !ready.current;
      ready.current = true;
      setBuilt(true);
      // A deep link to a room (?room=f_bed2) goes there once the house is built; a floor (?floor=) shows that floor.
      const linked = initialRoom.current;
      if (linked && shown?.plan.rooms.some((r) => r.id === linked)) {
        initialRoom.current = null;
        viewer.current?.goToRoom(linked);
      } else if (first && floor !== "all" && shown?.plan.levels.some((l) => l.id === floor)) {
        viewer.current?.setFloor(floor);
      }
      if (!shown) return;
      const key = `naqsha.thumb.${shown.id}`;
      let done = false;
      try { done = !!localStorage.getItem(key); } catch { /* ignore */ }
      if (!done && viewer.current) {
        try {
          const img = await viewer.current.capture({ width: 960, height: 540 });
          if (img) {
            const { url } = await api.saveThumbnail(project.id, shown.id, img);
            try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
            onProjectChange({ ...project, thumbnail_url: url });
          }
        } catch (e) {
          console.warn("thumbnail failed", e);
        }
      }
      try {
        setAsBuilt(shown.id, await api.asBuilt(project.id, shown.id, result.summary));
      } catch {
        // Keep what the version already carries (stored with it by an earlier build).
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, project, onProjectChange],
  );

  const repair = async (r: SectionResult) => {
    if (!shown) return;
    try {
      await api.repairSection(project.id, shown.id, { section: r.name, error: r.error ?? "failed to build" }, {
        section: ({ section }) => {
          const v = useFlow.getState().versions[shown.id] ?? shown;
          flow.cacheVersion({ ...v, sections: v.sections.map((s) => (s.name === section.name ? section : s)) });
        },
      });
      setFailed((f) => f.filter((x) => x.name !== r.name));
    } catch (e) {
      notify.error("Couldn't rebuild that part", e);
    }
  };

  const startRender = async () => {
    const img = await capture(1280);
    setRender({ before: img });
    try {
      const { url } = await api.render(project.id, { image_data_url: img, version_id: shown?.id });
      setRender((r) => (r ? { ...r, after: url } : r));
    } catch (e) {
      setRender((r) => (r ? { ...r, error: errorMessage(e) } : r));
    }
  };

  const saveDraft = async (text: string) => {
    if (!draft || !shown) return false;
    const c = await flow.addComment(project.id, { version_id: shown.id, text, anchor: draft.anchor, camera: draft.camera, snapshot_data_url: draft.snapshot || undefined });
    if (!c) return false;
    setDraft(null);
    setSelected(c.id);
    return true;
  };

  const openComments = useMemo(() => (comments ?? []).filter((c) => c.status === "open"), [comments]);
  // Pins are numbered by when they were made, the same numbers as Plan and the comments sheet (pinNumbers).
  const ordered = useMemo(() => [...(comments ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)), [comments]);
  const selectedComment = comments?.find((c) => c.id === selected);

  const startRevise = (ids: string[], instruction?: string) => {
    if (!latestVid) return;
    setFinishOpen(false);
    setMode("orbit");
    void flow.revise(project.id, { version_id: latestVid, comment_ids: ids.length ? ids : undefined, instruction });
  };

  // ?room= set from outside (the command bar's rooms) while the house is open.
  const roomParam = params.get("room");
  useEffect(() => {
    if (!active || !roomParam || roomParam === room.id) return;
    if (!ready.current) {
      initialRoom.current = roomParam;
      return;
    }
    const r = plan?.rooms.find((x) => x.id === roomParam);
    if (!r) return;
    setRoom({ id: r.id, level: r.level });
    viewer.current?.goToRoom(r.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomParam, active]);

  // ?comment=<id> ("Show where" in the comments sheet): fly to the pin once it is loaded, then forget the param.
  const commentParam = params.get("comment");
  useEffect(() => {
    if (!active || !commentParam || !comments) return;
    const c = comments.find((x) => x.id === commentParam);
    if (!c) return;
    setSelected(c.id);
    viewer.current?.flyTo(c);
    setParams((p) => { const n = new URLSearchParams(p); n.delete("comment"); return n; }, { replace: true });
  }, [active, commentParam, comments, setParams]);

  // When a revision lands, follow the new version (the camera stays where it is).
  const lastRevised = useRef<string | null>(null);
  useEffect(() => {
    const v = revise?.version;
    if (!v || lastRevised.current === v.id) return;
    lastRevised.current = v.id;
    if (params.get("v")) setParams((p) => { const n = new URLSearchParams(p); n.delete("v"); return n; }, { replace: true });
  }, [revise?.version, params, setParams]);

  useAskContext(
    active && latestVid
      ? {
          placeholder: "Tell Naqsha what to change…",
          // "Revise with N comments" is the shell's Next pill; typed, it opens the same choice.
          busy: revise?.status === "running",
          onSubmit: (text) => {
            if (/^revise with \d+ comments?$/i.test(text.trim())) useShell.getState().openComments({ apply: true });
            else startRevise([], text);
          },
        }
      : null,
  );

  useHotkeys(
    {
      v: () => setMode(mode === "walk" ? "orbit" : "walk"),
      c: () => mode === "orbit" && isLatest && setCommentMode((c) => !c),
      m: () => setNavOpen((o) => !o),
      Escape: () => {
        if (commentMode && !draft) setCommentMode(false);
        setSelected(null);
      },
    },
    active,
  );
  /** Comment: in orbit, click to pin; in walk, pin at the crosshair, exactly as the C key does. */
  const comment = () => {
    if (mode === "walk") {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "c", code: "KeyC", bubbles: true }));
      return;
    }
    setCommentMode((c) => !c);
  };

  // Notes from the 3D model: the chip opens them; on phones the title menu does (shell state).
  const notesOpen = useShell((s) => s.asBuiltOpen);
  const setNotesOpen = useShell((s) => s.setAsBuiltOpen);

  // Room navigator
  const [navOpen, setNavOpen] = useState(false);
  const roomPill = useRef<HTMLButtonElement>(null);
  const viewBtn = useRef<HTMLButtonElement>(null);
  const versionBtn = useRef<HTMLButtonElement>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);

  if (!shown || !plan) {
    return (
      <div className="grid h-full place-items-center bg-hud text-hud-ink-2">
        <span className="text-[14px]">{vid ? "Opening the house…" : "The house appears here once the plan is drawn."}</span>
      </div>
    );
  }

  const currentRoom = room.id ? plan.rooms.find((r) => r.id === room.id) : undefined;
  // Walking where no room is drawn: the roof reads "Roof", the street "Outside".
  const walkLevel = !currentRoom && mode === "walk" && room.level ? levels.find((l) => l.id === room.level) : undefined;
  const items = stackItems(levels, (l) => levelKey(l, levels), levelName);
  const asBuiltNotes = asBuilt?.checks.filter((c) => c.status !== "pass") ?? [];
  const noteRoom = (ids: string[] | undefined) => {
    for (const id of ids ?? []) {
      if (plan.rooms.some((r) => r.id === id)) return id;
      const o = plan.openings.find((x) => x.id === id);
      const side = o?.between.find((b) => b !== "exterior" && plan.rooms.some((r) => r.id === b));
      if (side) return side;
      const base = plan.rooms.filter((r) => id.startsWith(`${r.id}_`)).sort((a, b) => b.id.length - a.id.length)[0];
      if (base) return base.id;
    }
    return null;
  };
  // Clear of the dock (the shell publishes its height as --dock-h); beside it only on very wide screens.
  // One row above the dock (phones too: mode · view · version · rooms · comment); parts that didn't build sit above it.
  const row = (n: number) => (wide ? undefined : { bottom: `calc(var(--dock-h, 96px) + ${8 + n * 52}px)` });
  const roomLabel = currentRoom
    ? `${sentenceCase(currentRoom.name)} · ${levelName(levels.find((l) => l.id === currentRoom.level)!).replace(/ floor$/i, "")}`
    : walkLevel ? (walkLevel.index === 0 ? "Outside" : levelName(walkLevel)) : "Rooms";
  const roomsButton = (
    <HudButton ref={roomPill} onClick={() => setNavOpen((o) => !o)} pressed={navOpen} label={phone ? (roomLabel === "Rooms" ? "Rooms" : `Rooms: ${roomLabel}`) : "Rooms (M)"} icon={phone}>
      {phone ? (
        <DoorOpen className="size-[18px]" strokeWidth={1.75} />
      ) : (
        <>
          <span className="max-w-[180px] truncate">{roomLabel}</span>
          <ChevronDown className="size-3.5 text-hud-ink-2" strokeWidth={1.75} />
        </>
      )}
    </HudButton>
  );
  const commentButton = isLatest ? (
    <HudButton onClick={comment} pressed={commentMode} label={phone ? (commentMode ? "Comment: tap the house to pin" : "Comment") : "Comment (C)"} accent={commentMode} icon={phone && !openComments.length}>
      <MessageSquarePlus className={phone ? "size-[18px]" : "size-4"} strokeWidth={1.75} />
      <span className="max-sm:hidden">{commentMode ? "Click to pin" : "Comment"}</span>
      {openComments.length > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-white/15 px-1.5 font-mono text-[11px] tabular-nums">{openComments.length}</span>}
    </HudButton>
  ) : null;

  return (
    <div className="nq-house relative h-full overflow-hidden bg-hud">
      <style>{HUD_CSS}</style>
      {/* isolate: the viewer's pins use huge z-indexes; keep them inside the canvas so sheets and dialogs sit above. */}
      <div className="absolute inset-0 isolate">
        <HouseViewer
          ref={viewer}
          plan={plan}
          sections={sections}
          mode={mode}
          visibleLevels={visibleLevels}
          layers={layers}
          sectionCut={cutFt == null ? null : cutFt * FT}
          sunHour={sunHour}
          night={light === "night"}
          ghostContext={ghost}
          hideVehicles={cars === "auto" ? undefined : cars === "hide"}
          preserveCamera
          comments={ordered}
          commentMode={commentMode && isLatest}
          onAddComment={(d) => isLatest && setDraft(d)}
          onSelectComment={(id) => setSelected(id)}
          onReady={(res) => void onReady(res)}
          onRoomChange={(id, level) => {
            setRoom({ id, level });
            // ?floor follows the walker, so Orbit opens on the floor you were walking
            if (level && mode === "walk" && level !== floor) {
              setFloorState(level);
              setParams((p) => { const n = new URLSearchParams(p); n.set("floor", level); return n; }, { replace: true });
            }
          }}
          onExitWalk={(reason) => {
            // F ("finish"): the viewer stays in walk with the pointer free until the person confirms.
            if (reason === "finish") {
              if (isLatest && openComments.length) setFinishOpen(true);
              else setFinishWalk(true);
              return;
            }
            setMode("orbit");
          }}
        />
      </div>

      {/* Left edge: floors */}
      {levels.length > 1 && built && (
        <div data-nq-recede="" className={cn("absolute left-3 z-20 sm:left-4", phone ? "top-[calc(var(--chrome-top)+12px)]" : "top-1/2 -translate-y-1/2")}>
          <FloorStack items={items} value={mode === "walk" ? room.level ?? floor : floor} onChange={setFloor} tone="hud" extra={mode === "orbit" ? { id: "all", key: "All", name: "Whole house" } : undefined} />
        </div>
      )}

      {/* Top centre: a revision in progress */}
      <div className="pointer-events-none absolute inset-x-0 top-[var(--chrome-top)] z-20 flex justify-center px-3">
        <AnimatePresence>
          {revise && (
            <div className="pointer-events-auto">
              <ReviseStatus run={revise} tone="hud" onOpen={() => goTo("revisions")} onDismiss={() => flow.clear("revise")} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom-left: mode, view, version. Phones keep one row: rooms and comment join it as named icons. */}
      <div data-nq-recede="" className={cn("absolute left-3 z-20 flex items-center gap-2 sm:left-4", phone ? "right-3" : "flex-wrap", wide && "bottom-4")} style={row(0)}>
        <Segmented
          label="Mode"
          tone="hud"
          size={phone ? "lg" : "md"}
          value={mode}
          onChange={setMode}
          options={[
            { value: "orbit", label: <span className="inline-flex items-center gap-1.5"><Orbit className={phone ? "size-[18px]" : "size-4"} strokeWidth={1.75} aria-hidden />{!phone && "Orbit"}</span>, aria: phone ? "Orbit" : undefined, title: "Orbit (V)" },
            { value: "walk", label: <span className="inline-flex items-center gap-1.5"><Footprints className={phone ? "size-[18px]" : "size-4"} strokeWidth={1.75} aria-hidden />{!phone && "Walk"}</span>, aria: phone ? "Walk" : undefined, title: "Walk (V)" },
          ]}
        />
        <HudButton ref={viewBtn} onClick={() => setViewOpen((o) => !o)} pressed={viewOpen} label="View" icon={phone}>
          <Layers className={phone ? "size-[18px]" : "size-4"} strokeWidth={1.75} />
          <span className="max-sm:hidden">View</span>
        </HudButton>
        <HudButton ref={versionBtn} onClick={() => setVersionOpen((o) => !o)} pressed={versionOpen} label={`Versions: version ${shown.n}${isLatest ? "" : ", not the latest"}`}>
          <span className="font-mono tabular-nums">v{shown.n}</span>
          {!isLatest && <span className="text-hud-ink-2 max-sm:hidden">· not the latest</span>}
          <ChevronDown className="size-3.5 text-hud-ink-2" strokeWidth={1.75} />
        </HudButton>
        {phone && (
          <div className="ml-auto flex items-center gap-2">
            {roomsButton}
            {commentButton}
          </div>
        )}
      </div>

      {/* Bottom-right: rooms and comments */}
      {!phone && (
        <div className={cn("absolute right-3 z-20 flex items-center gap-2 sm:right-4", wide && "bottom-4")} style={row(0)}>
          {roomsButton}
          {commentButton}
        </div>
      )}

      {/* Notes from the as-built check (phones: in the title menu) and parts that didn't build */}
      <div data-nq-recede="" className={cn("pointer-events-none absolute left-3 z-20 flex flex-col items-start gap-2 sm:left-4", wide && "bottom-[64px]")} style={row(1)}>
        {asBuiltNotes.length > 0 && (
          <AsBuiltNotes
            notes={asBuiltNotes.map((c) => ({ id: c.id, text: c.message, room: noteRoom(c.element_ids) }))}
            roomName={(id) => sentenceCase(plan.rooms.find((r) => r.id === id)?.name ?? "")}
            onShow={(id) => goToRoom(id)}
            chip={!phone}
            open={notesOpen}
            onOpenChange={setNotesOpen}
          />
        )}
        {failed.map((f) => (
          <div key={f.name} className="glass-hud pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pl-3 pr-1.5 text-[13px]">
            <CircleAlert className="size-3.5 text-[#F5B97A]" strokeWidth={2} />
            {sectionPhrase(f.name, plan).replace(/^\w/, (c) => c.toUpperCase())} didn't build
            <Button size="sm" variant="primary" onClick={() => void repair(f)}>
              Rebuild
            </Button>
          </div>
        ))}
      </div>

      {/* A selected pin */}
      <AnimatePresence>
        {selectedComment && !draft && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="glass-hud absolute right-3 top-[var(--chrome-top)] z-30 w-[min(360px,calc(100vw-24px))] rounded-card p-4 sm:right-4"
          >
            <PinCard
              c={selectedComment}
              n={ordered.findIndex((c) => c.id === selectedComment.id) + 1}
              onFly={() => viewer.current?.flyTo(selectedComment)}
              onThread={() => useShell.getState().openComments({ focus: selectedComment.id })}
              onClose={() => setSelected(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Composer */}
      <AnimatePresence>
        {draft && (
          <div className="absolute inset-0 z-50 grid place-items-center bg-black/30 p-3">
            <Composer draft={draft} plan={plan} onCancel={() => { setDraft(null); viewer.current?.cancelDraft(); }} onSave={saveDraft} />
          </div>
        )}
      </AnimatePresence>

      {/* Popovers */}
      <Popover open={viewOpen} onClose={() => setViewOpen(false)} anchor={viewBtn} side="top" tone="hud" className="w-[300px]" sheetBelow={640} label="View">
        <ViewPanel
          light={light}
          onLight={setLight}
          hour={hour}
          onHour={setHour}
          layers={layers}
          onLayer={(id) => setLayers((s) => ({ ...s, [id]: !s[id] }))}
          cutFt={cutFt}
          topFt={topFt}
          onCut={setCutFt}
          ghost={ghost}
          onGhost={setGhost}
          cars={cars}
          onCars={setCars}
          mode={mode}
          onRender={() => {
            setViewOpen(false);
            void startRender();
          }}
        />
      </Popover>
      <Popover open={versionOpen} onClose={() => setVersionOpen(false)} anchor={versionBtn} side="top" tone="hud" className="w-[300px]" sheetBelow={640} label="Versions">
        <VersionMenu
          project={project}
          current={shown.id}
          onPick={(id) => {
            setVersionOpen(false);
            setSelected(null);
            setParams((p) => { const n = new URLSearchParams(p); if (id === project.current_version_id) n.delete("v"); else n.set("v", id); return n; });
          }}
          onRevisions={() => goTo("revisions")}
        />
      </Popover>
      <Popover
        open={navOpen}
        onClose={() => setNavOpen(false)}
        anchor={roomPill}
        side="top"
        align="end"
        tone="hud"
        className="w-[300px]"
        sheetBelow={768}
        sheetFull
        label="Rooms"
        avoid={() => [document.querySelector(".nq-house .nq-mini")]}
      >
        <RoomNavigator
          plan={plan}
          open={navOpen}
          current={room.id}
          currentLevel={mode === "walk" ? room.level : null}
          onGo={(id) => {
            setNavOpen(false);
            goToRoom(id);
          }}
          onFloor={(id) => {
            // The same path as the floor stack's R: glide there (never the tap-again "whole house" toggle).
            setNavOpen(false);
            applyFloor(id);
            setParams((p) => { const n = new URLSearchParams(p); n.set("floor", id); return n; }, { replace: true });
          }}
        />
      </Popover>

      <Dialog
        open={finishWalk}
        onClose={() => setFinishWalk(false)}
        title="Finish the walk-through?"
        description={isLatest ? "You haven't pinned anything yet. Press C while walking to pin a comment where you stand; Naqsha turns your comments into the next version." : "This is an earlier version. Switch to the latest to pin comments and revise."}
        actions={
          <>
            <Button variant="quiet" onClick={() => setFinishWalk(false)}>
              Keep walking
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setFinishWalk(false);
                setMode("orbit");
              }}
            >
              Back to orbit
            </Button>
          </>
        }
      />
      <FinishDialog
        open={finishOpen}
        comments={openComments}
        ordered={ordered}
        onClose={() => setFinishOpen(false)}
        onRevise={(ids) => startRevise(ids)}
      />

      <AnimatePresence>{render && <RenderLightbox before={render.before} after={render.after} error={render.error} onClose={() => setRender(null)} onRetry={() => void startRender()} />}</AnimatePresence>
    </div>
  );
}

/** Make room for the toolbars inside the viewer's own HUD (viewer classes; harmless if they change). */
const HUD_CSS = `
.nq-house .nq-glass { background: rgb(24 24 27 / 0.75); }
.nq-house .nq-mini-north, .nq-house .nq-mini-caption, .nq-house .nq-build-meta, .nq-house .nq-kbd { font-size: 12px; }
.nq-house .nq-mini-floor { position: relative; min-width: 28px; min-height: 26px; font-size: 12px; }
@media (pointer: coarse), (max-width: 639px) { .nq-house .nq-mini-floor::after { content: ""; position: absolute; inset: min(0px, calc((100% - 44px) / 2)); } }
.nq-house .nq-build-pill, .nq-house .nq-room, .nq-house .nq-banner, .nq-house .nq-mini { top: var(--chrome-top, 72px); }
.nq-house .nq-hints, .nq-house .nq-commenting, .nq-house .nq-chip-mock, .nq-house .nq-touch-btns { bottom: calc(var(--dock-h, 96px) + 60px); }
.nq-house .nq-toast { bottom: calc(var(--dock-h, 96px) + 112px); }
@media (max-width: 767px) { .nq-house .nq-hints, .nq-house .nq-commenting, .nq-house .nq-chip-mock, .nq-house .nq-touch-btns { bottom: calc(var(--dock-h, 96px) + 112px); } .nq-house .nq-toast { bottom: calc(var(--dock-h, 96px) + 164px); } }
@media (min-width: 1600px) { .nq-house .nq-hints, .nq-house .nq-commenting, .nq-house .nq-chip-mock { bottom: 76px; } .nq-house .nq-toast { bottom: 128px; } }
`;

const HudButton = ({ ref, onClick, pressed, label, accent, icon, children }: { ref?: React.Ref<HTMLButtonElement>; onClick: () => void; pressed?: boolean; label: string; accent?: boolean; /** A 44px round icon button (phones). */ icon?: boolean; children: ReactNode }) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    aria-pressed={pressed}
    aria-label={label}
    title={label}
    className={cn(
      "inline-flex h-11 shrink-0 items-center gap-2 rounded-full text-[13px] font-medium outline-none transition-colors focus-visible:shadow-focus",
      icon ? "w-11 justify-center" : "px-4",
      accent ? "bg-accent text-white shadow-e2" : "glass-hud hover:bg-[rgb(40_40_44/0.88)]",
    )}
  >
    {children}
  </button>
);

function Toggle({ on, onChange, children }: { on: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 rounded-control px-2 py-1.5 text-left text-[13px] outline-none hover:bg-white/8 focus-visible:shadow-focus">
      <span className={on ? "text-hud-ink" : "text-hud-ink-2"}>{children}</span>
      <span className={cn("relative h-5 w-8 shrink-0 rounded-full transition-colors duration-(--dur-fast)", on ? "bg-hud-accent" : "bg-white/18")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform duration-(--dur-fast)", on ? "translate-x-3.5" : "translate-x-0.5")} />
      </span>
    </button>
  );
}

function ViewPanel({
  light,
  onLight,
  hour,
  onHour,
  layers,
  onLayer,
  cutFt,
  topFt,
  onCut,
  ghost,
  onGhost,
  cars,
  onCars,
  mode,
  onRender,
}: {
  light: Light;
  onLight: (l: Light) => void;
  hour: number;
  onHour: (h: number) => void;
  layers: Record<Layer, boolean>;
  onLayer: (id: Layer) => void;
  cutFt: number | null;
  topFt: number;
  onCut: (v: number | null) => void;
  ghost: boolean;
  onGhost: (v: boolean) => void;
  cars: "auto" | "show" | "hide";
  onCars: (v: "auto" | "show" | "hide") => void;
  mode: "orbit" | "walk";
  onRender: () => void;
}) {
  return (
    <div className="space-y-3 p-1">
      <Segmented
        label="Light"
        tone="hud"
        value={light}
        onChange={onLight}
        className="w-full [&>button]:flex-1 [&>button]:justify-center"
        options={[
          { value: "day", label: <span className="inline-flex items-center gap-1.5"><Sun className="size-3.5" strokeWidth={1.75} />Day</span> },
          { value: "dusk", label: <span className="inline-flex items-center gap-1.5"><Sunset className="size-3.5" strokeWidth={1.75} />Dusk</span> },
          { value: "night", label: <span className="inline-flex items-center gap-1.5"><Moon className="size-3.5" strokeWidth={1.75} />Night</span> },
        ]}
      />
      {/* Always here (disabled at dusk and night), so the light control above never moves under the cursor. */}
      <label className={cn("block px-2", light !== "day" && "opacity-45")}>
        <span className="flex justify-between text-[12px] text-hud-ink-2">
          <span>Sun</span>
          <span className="font-mono tabular-nums text-hud-ink">{light === "day" ? hourLabel(hour) : light === "dusk" ? "After sunset" : "Night"}</span>
        </span>
        <input type="range" min={7} max={17.5} step={0.25} value={hour} disabled={light !== "day"} onChange={(e) => onHour(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-hud-accent)] disabled:cursor-not-allowed" aria-label="Time of day" />
      </label>
      <div className="border-t border-white/10 pt-2">
        <p className="px-2 pb-1 text-[12px] text-hud-ink-2">Show</p>
        {LAYERS.map((l) => (
          <Toggle key={l.id} on={layers[l.id]} onChange={() => onLayer(l.id)}>
            {l.label}
          </Toggle>
        ))}
        <Toggle on={ghost} onChange={onGhost}>
          See through the neighbours
        </Toggle>
        {/* What is on screen: "auto" shows cars in Orbit and hides them in Walk (the viewer's own default). */}
        <Toggle on={cars === "show" || (cars === "auto" && mode === "orbit")} onChange={(v) => onCars(v ? "show" : "hide")}>
          Cars
        </Toggle>
      </div>
      <div className="border-t border-white/10 px-2 pt-2">
        <Toggle on={cutFt != null} onChange={(v) => onCut(v ? Math.round(topFt * 0.42) : null)}>
          Cut away
        </Toggle>
        {cutFt != null && (
          <label className="mt-1 block px-2">
            <span className="flex justify-between text-[12px] text-hud-ink-2">
              <span>Cut at</span>
              <span className="font-mono tabular-nums text-hud-ink">{feetInches(Math.round(cutFt))}</span>
            </span>
            <input type="range" min={1} max={Math.round(topFt)} step={0.5} value={cutFt} onChange={(e) => onCut(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-hud-accent)]" aria-label="Cut-away height" />
          </label>
        )}
      </div>
      <Button variant="secondary" size="md" className="w-full" icon={<Sparkles className="size-4" strokeWidth={1.75} />} onClick={onRender}>
        Render this view
      </Button>
    </div>
  );
}

function VersionMenu({ project, current, onPick, onRevisions }: { project: Project; current: string; onPick: (id: string) => void; onRevisions: () => void }) {
  const list = [...project.versions].sort((a, b) => b.n - a.n);
  return (
    <div>
      <p className="px-2 pb-1 pt-1 text-[12px] text-hud-ink-2">Versions · the camera stays put</p>
      <ul>
        {list.map((v) => (
          <li key={v.id}>
            <button type="button" onClick={() => onPick(v.id)} className={cn("flex w-full items-start gap-3 rounded-control px-2 py-2 text-left outline-none hover:bg-white/8 focus-visible:shadow-focus", v.id === current && "bg-white/10")}>
              <span className="mt-0.5 font-mono text-[13px] tabular-nums">v{v.n}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px]">
                  {v.n === 1 ? "First design" : versionLine(v.summary)}
                  {v.id === project.current_version_id && <span className="text-hud-accent"> · Latest</span>}
                </span>
                <span className="block text-[12px] text-hud-ink-2">{relativeTime(v.created_at)}</span>
              </span>
              {v.id === current && <Check className="mt-0.5 size-4 text-hud-accent" strokeWidth={2} />}
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onRevisions} className="mt-1 w-full rounded-control px-2 py-2 text-left text-[13px] font-medium text-hud-accent hover:bg-white/8">
        See what changed
      </button>
    </div>
  );
}

function PinCard({ c, n, onFly, onThread, onClose }: { c: Comment; n: number; onFly: () => void; onThread: () => void; onClose: () => void }) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white ring-2 ring-white" style={{ background: hueColor(c) }}>
          {n}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] text-hud-ink-2">
            {c.author?.name ?? "You"} · {relativeTime(c.created_at)}
          </p>
          <p className="mt-0.5 text-body">{c.text}</p>
          {c.resolution && <p className="mt-2 text-[13px] text-hud-ink-2">{c.resolution}</p>}
        </div>
        <IconButton label="Close" variant="hud" size={28} onClick={onClose}>
          <X className="size-3.5" strokeWidth={1.75} />
        </IconButton>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="hud" size="sm" onClick={onThread}>
          {c.replies?.length ? `${c.replies.length} ${c.replies.length === 1 ? "reply" : "replies"}` : "Reply"}
        </Button>
        <Button variant="hud" size="sm" onClick={onFly}>
          Look at it
        </Button>
      </div>
    </div>
  );
}

function AsBuiltNotes({
  notes,
  roomName,
  onShow,
  chip = true,
  open,
  onOpenChange: setOpen,
}: {
  notes: { id: string; text: string; room: string | null }[];
  roomName: (id: string) => string;
  onShow: (roomId: string) => void;
  /** False on phones: the title menu opens the list instead, as a sheet. */
  chip?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      {chip && (
        <button ref={ref} type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="glass-hud pointer-events-auto inline-flex h-9 items-center gap-2 rounded-full px-3 text-[13px] outline-none focus-visible:shadow-focus">
          <CircleAlert className="size-3.5 text-[#F5B97A]" strokeWidth={2} />
          {notesLine(notes.length)}
        </button>
      )}
      <Popover open={open} onClose={() => setOpen(false)} anchor={ref} side="top" tone="hud" className="w-[340px]" sheetBelow={chip ? 640 : 100000} label="Notes from the 3D model">
        <p className="px-1 pb-1.5 pt-0.5 text-[12px] text-hud-ink-2">What I found while building it in 3D</p>
        <ul className="space-y-1 text-[13px] leading-snug">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-2 rounded-control px-1 py-1.5">
              <span className="mt-[7px] size-1 shrink-0 rounded-full bg-[#F5B97A]" />
              <span className="min-w-0 flex-1">{n.text}</span>
              {n.room && (
                <button
                  type="button"
                  onClick={() => { setOpen(false); onShow(n.room!); }}
                  className="hit-44 relative shrink-0 rounded-full px-2.5 py-1 text-[12.5px] font-medium text-hud-accent outline-none hover:bg-white/10"
                  aria-label={`Show me ${roomName(n.room)}`}
                >
                  Show me
                </button>
              )}
            </li>
          ))}
        </ul>
      </Popover>
    </>
  );
}

function FinishDialog({ open, comments, ordered, onClose, onRevise }: { open: boolean; comments: Comment[]; ordered: Comment[]; onClose: () => void; onRevise: (ids: string[]) => void }) {
  // Team comments go in by default; a client's comment waits until the owner includes it (DESIGN.md "Comments").
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    if (open) setPicked(comments.filter((c) => c.author?.role !== "client").map((c) => c.id));
  }, [open, comments]);
  const n = picked.length;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Revise with ${n} ${n === 1 ? "comment" : "comments"}?`}
      description="Naqsha reads each one where it was pinned, changes the plan and the house, checks every rule again and answers each comment. It takes a few minutes; you can keep walking."
      actions={
        <>
          <Button variant="quiet" onClick={onClose}>
            Not yet
          </Button>
          <Button variant="primary" disabled={!n} onClick={() => onRevise(picked)}>
            Revise
          </Button>
        </>
      }
    >
      <ul className="max-h-[40vh] space-y-1 overflow-y-auto [scrollbar-width:thin]">
        {comments.map((c) => {
          const on = picked.includes(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                className="flex w-full items-start gap-3 rounded-control px-2 py-2 text-left outline-none hover:bg-surface-2 focus-visible:shadow-focus"
              >
                <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-[5px]", on ? "bg-accent text-white" : "shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]")}>{on && <Check className="size-3" strokeWidth={3} />}</span>
                <span className="grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white" style={{ background: hueColor(c) }}>
                  {ordered.findIndex((x) => x.id === c.id) + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body text-ink">{c.text}</span>
                  <span className="block text-[12.5px] text-ink-3">
                    {c.author?.name ?? "You"}
                    {c.author?.role === "client" ? " · Client" : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
