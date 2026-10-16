import { useRef, useState } from "react";
import type { ViewerController } from "../core/controller";

const R = 48; // joystick travel (px)

/** Two-zone touch controls: left = floating joystick, right = drag to look. Plus comment / finish buttons. */
export function TouchControls({ ctrl }: { ctrl: ViewerController }) {
  const [joy, setJoy] = useState<{ x: number; y: number; kx: number; ky: number } | null>(null);
  const joyId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const last = useRef({ x: 0, y: 0 });
  const input = ctrl.walk.input;

  return (
    <>
      <div
        className="nq-touch-zone"
        data-nq-ui=""
        style={{ left: 0, width: "45%" }}
        onPointerDown={(e) => {
          if (joyId.current !== null) return;
          joyId.current = e.pointerId;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          const r = e.currentTarget.getBoundingClientRect();
          setJoy({ x: e.clientX - r.left, y: e.clientY - r.top, kx: 0, ky: 0 });
        }}
        onPointerMove={(e) => {
          if (e.pointerId !== joyId.current || !joy) return;
          const r = e.currentTarget.getBoundingClientRect();
          let dx = e.clientX - r.left - joy.x, dy = e.clientY - r.top - joy.y;
          const len = Math.hypot(dx, dy);
          if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
          input.joy.x = dx / R;
          input.joy.y = -dy / R;
          setJoy({ ...joy, kx: dx, ky: dy });
        }}
        onPointerUp={(e) => {
          if (e.pointerId !== joyId.current) return;
          joyId.current = null;
          input.joy.x = input.joy.y = 0;
          setJoy(null);
        }}
        onPointerCancel={() => {
          joyId.current = null;
          input.joy.x = input.joy.y = 0;
          setJoy(null);
        }}
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
          lookId.current = e.pointerId;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          last.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (e.pointerId !== lookId.current) return;
          input.look.dx += (e.clientX - last.current.x) * 1.7;
          input.look.dy += (e.clientY - last.current.y) * 1.7;
          last.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (lookId.current = null)}
        onPointerCancel={() => (lookId.current = null)}
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
