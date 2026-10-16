/** DOM overlays for HouseViewer. They subscribe to low-frequency store slices only; nothing here renders per frame. */
import { useCallback, useMemo, useRef } from "react";
import { useStore } from "zustand";
import type { BuildingPlan } from "@contracts/plan";
import type { ViewerController } from "../core/controller";
import { MiniMap } from "./MiniMap";
import { TouchControls } from "./TouchControls";

const prettySection = (name?: string) => {
  if (!name) return "";
  const m = name.match(/^furnish_(.+)$/);
  if (m) return `Furnishing ${m[1].replace(/^[gf]_/, "").replace(/_/g, " ")}`;
  return name.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
};

export function Hud({ ctrl, plan, commentMode }: { ctrl: ViewerController; plan: BuildingPlan; commentMode: boolean }) {
  const mode = useStore(ctrl.store, (s) => s.mode);
  return (
    <div className="nq-layer">
      <BuildOverlay ctrl={ctrl} />
      {mode === "orbit" ? <OrbitHud ctrl={ctrl} commentMode={commentMode} /> : <WalkHud ctrl={ctrl} plan={plan} commentMode={commentMode} />}
      <Toast ctrl={ctrl} />
    </div>
  );
}

function BuildOverlay({ ctrl }: { ctrl: ViewerController }) {
  const b = useStore(ctrl.store, (s) => s.build);
  if (b.phase === "error") {
    return (
      <div className="nq-error nq-glass" role="alert">
        <b>Couldn’t build the 3D model</b>
        {b.error}
      </div>
    );
  }
  const pct = b.total ? Math.round((b.done / b.total) * 100) : 0;
  return (
    <>
      {b.phase === "building" && b.first && (
        <div className="nq-build-card nq-glass" role="status" aria-live="polite">
          <h3>Assembling your home</h3>
          <p>{b.done === 0 ? "Laying out the plan…" : prettySection(b.current)}</p>
          <div className="nq-bar">
            <i style={{ width: `${Math.max(4, pct)}%` }} />
          </div>
          <div className="nq-build-meta">
            <span>{b.total ? `${b.done} of ${b.total} layers` : `${b.done} layers`}</span>
            <span>{pct}%</span>
          </div>
        </div>
      )}
      {b.phase === "building" && !b.first && (
        <div className="nq-build-pill nq-glass" role="status">
          <span className="nq-spin" />
          {prettySection(b.current) || "Updating"} · {b.done}/{b.total || "…"}
        </div>
      )}
      {b.mock && b.phase !== "building" && <div className="nq-chip-mock nq-glass">Preview geometry · engine pending</div>}
    </>
  );
}

function OrbitHud({ ctrl, commentMode }: { ctrl: ViewerController; commentMode: boolean }) {
  const hover = useStore(ctrl.store, (s) => s.hover);
  const tipRef = useCallback((el: HTMLDivElement | null) => void (ctrl.tooltipEl = el), [ctrl]);
  return (
    <>
      {commentMode && (
        <div className="nq-banner nq-glass">
          <span className="nq-dot" />
          <span>Comment mode · click any surface to pin a note</span>
        </div>
      )}
      <div ref={tipRef} className="nq-tip nq-glass" data-on={hover ? "1" : "0"} aria-hidden>
        {hover && (
          <>
            <b>{hover.title}</b>
            {hover.subtitle && <span>{hover.subtitle}</span>}
          </>
        )}
      </div>
    </>
  );
}

function WalkHud({ ctrl, plan, commentMode }: { ctrl: ViewerController; plan: BuildingPlan; commentMode: boolean }) {
  const phase = useStore(ctrl.store, (s) => s.walk);
  const room = useStore(ctrl.store, (s) => s.room);
  const levelId = useStore(ctrl.store, (s) => s.level);
  const target = useStore(ctrl.store, (s) => s.target);
  const touch = useStore(ctrl.store, (s) => s.touch);
  const levelName = useMemo(() => plan.levels.find((l) => l.id === levelId)?.name, [plan, levelId]);
  const active = phase === "active";
  return (
    <>
      {(active || phase === "commenting" || phase === "paused") && room && (
        <div className="nq-room nq-glass">
          <small>You are in</small>
          <strong>{room}</strong>
          {levelName && <span>{levelName}</span>}
        </div>
      )}
      {(active || phase === "paused" || phase === "commenting") && <MiniMap ctrl={ctrl} plan={plan} levelId={levelId} roomName={room} />}
      {active && (
        <>
          <div className="nq-cross" data-target={target ? "1" : "0"} data-comment={commentMode ? "1" : "0"}>
            <b />
            <i />
          </div>
          {target && <div className="nq-target">{target.title}</div>}
          {!touch && (
            <div className="nq-hints nq-glass">
              <span><span className="nq-kbd">W</span><span className="nq-kbd">A</span><span className="nq-kbd">S</span><span className="nq-kbd">D</span> move</span>
              <span><span className="nq-kbd">Shift</span> run</span>
              <span><span className="nq-kbd">C</span> comment</span>
              <span><span className="nq-kbd">F</span> finish</span>
              <span><span className="nq-kbd">Esc</span> pause</span>
              {plan.levels.length > 1 && <span className="nq-hint-floors"><span className="nq-kbd">1–{plan.levels.length}</span> floor</span>}
            </div>
          )}
          {touch && <TouchControls ctrl={ctrl} />}
        </>
      )}
      <WalkGate ctrl={ctrl} phase={phase} touch={touch} floors={plan.levels.length} />
    </>
  );
}

function WalkGate({ ctrl, phase, touch, floors }: { ctrl: ViewerController; phase: string; touch: boolean; floors: number }) {
  const start = useCallback(() => ctrl.requestLock(), [ctrl]);
  const exit = useCallback(() => ctrl.exitWalk(), [ctrl]);
  const startRef = useRef<HTMLButtonElement>(null);
  if (phase === "ready" || phase === "paused") {
    const paused = phase === "paused";
    return (
      <div className="nq-gate nq-ui" data-nq-ui="" onClick={start}>
        <div className="nq-gate-card nq-glass" onClick={(e) => e.stopPropagation()}>
          <h3>{paused ? "Paused" : "Walk through your home"}</h3>
          <p>{paused ? "Pick up where you left off, or head back to the overview." : touch ? "Drag the left pad to move and the right side to look around." : "Look around with the mouse and move like in a game. Pin comments on anything you’d change."}</p>
          <div className="nq-gate-actions">
            <button ref={startRef} className="nq-btn" onClick={start} autoFocus>
              {paused ? "Resume walk" : touch ? "Tap to start" : "Click to start"}
            </button>
            <button className="nq-btn ghost" onClick={exit}>
              {paused ? "Exit walk" : "Back to overview"}
            </button>
          </div>
          {!touch && (
            <div className="nq-gate-keys">
              <span><span className="nq-kbd">WASD</span> move</span>
              <span><span className="nq-kbd">Shift</span> run</span>
              <span><span className="nq-kbd">C</span> comment</span>
              <span><span className="nq-kbd">F</span> finish</span>
              <span><span className="nq-kbd">Esc</span> pause</span>
              {floors > 1 && <span><span className="nq-kbd">1–{floors}</span> jump to floor</span>}
            </div>
          )}
        </div>
      </div>
    );
  }
  if (phase === "commenting") {
    return (
      <div className="nq-commenting nq-glass nq-ui" data-nq-ui="">
        <span className="nq-dot" />
        Comment pinned · add your note, then keep walking
        <button className="nq-btn" onClick={start}>
          Resume walk
        </button>
      </div>
    );
  }
  return null;
}

function Toast({ ctrl }: { ctrl: ViewerController }) {
  const t = useStore(ctrl.store, (s) => s.toast);
  if (!t) return null;
  return (
    <div key={t.id} className="nq-toast nq-glass" role="status">
      {t.text}
    </div>
  );
}
