import { useRef, useState } from "react";
import type { ViewerController } from "../core/controller";

const R = 48; // joystick travel (px)

const capture = (el: Element, id: number) => {
  try {
    el.setPointerCapture(id);
  } catch {
    /* synthetic or already-released pointer */
  }
};

/** Two-zone touch controls: left = floating joystick, right = drag to look. Plus comment / finish buttons. */
export function TouchControls({ ctrl }: { ctrl: ViewerController }) {
  const [joy, setJoy] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  const joyRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const lookRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const input = ctrl.walk.input;

  const endJoy = () => {
    joyRef.current = null;
    input.joy.x = input.joy.y = 0;
    setJoy(null);
  };

  return (
    <>
      <div
        className="nq-touch-zone"
        data-nq-ui=""
        style={{ left: 0, width: "45%" }}
        onPointerDown={(e) => {
          if (joyRef.current) return;
          const r = e.currentTarget.getBoundingClientRect();
          joyRef.current = { id: e.pointerId, x: e.clientX - r.left, y: e.clientY - r.top };
          capture(e.currentTarget, e.pointerId);
          setJoy({ x: joyRef.current.x, y: joyRef.current.y, kx: 0, ky: 0 });
        }}
        onPointerMove={(e) => {
          const j = joyRef.current;
          if (!j || e.pointerId !== j.id) return;
          const r = e.currentTarget.getBoundingClientRect();
          let dx = e.clientX - r.left - j.x, dy = e.clientY - r.top - j.y;
          const len = Math.hypot(dx, dy);
          if (len > R) {
            dx = (dx / len) * R;
            dy = (dy / len) * R;
          }
          input.joy.x = dx / R;
          input.joy.y = -dy / R;
          setJoy({ x: j.x, y: j.y, kx: dx, ky: dy });
        }}
        onPointerUp={(e) => {
          if (joyRef.current && e.pointerId === joyRef.current.id) endJoy();
        }}
        onPointerCancel={endJoy}
      >
        {joy && (
          <div className="nq-joy" style={{ left: joy.x, top: joy.y }}>
            <i style={{ transform: `translate(${joy.kx}px, ${joy.ky}px)` }} />
          </div>
        )}
      </div>
      <div
        className="nq-touch-zone"
        data-nq-ui=""
        style={{ right: 0, width: "55%" }}
        onPointerDown={(e) => {
          lookRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          capture(e.currentTarget, e.pointerId);
        }}
        onPointerMove={(e) => {
          const l = lookRef.current;
          if (!l || e.pointerId !== l.id) return;
          input.look.dx += (e.clientX - l.x) * 1.7;
          input.look.dy += (e.clientY - l.y) * 1.7;
          l.x = e.clientX;
          l.y = e.clientY;
        }}
        onPointerUp={() => (lookRef.current = null)}
        onPointerCancel={() => (lookRef.current = null)}
      />
      <div className="nq-touch-btns" data-nq-ui="">
        <button className="nq-btn" onClick={() => ctrl.placeComment(0, 0, true)}>
          Comment
        </button>
        <button className="nq-btn ghost" onClick={() => ctrl.finishWalk()}>
          Finish
        </button>
      </div>
    </>
  );
}
