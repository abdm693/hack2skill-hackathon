import { memo, useCallback, useMemo } from "react";
import * as THREE from "three";
import { useStore } from "zustand";
import { Html } from "@react-three/drei";
import type { Comment, CommentAnchor } from "@contracts/api-types";
import type { ViewerController } from "../core/controller";

export const STATUS_COLOR: Record<Comment["status"], string> = {
  open: "#f59e0b",
  resolved: "#10b981",
  partial: "#3b82f6",
  rejected: "#ef4444",
};

const UP = new THREE.Vector3(0, 1, 0);
const stemGeo = new THREE.CylinderGeometry(0.009, 0.009, 1, 8).translate(0, 0.5, 0);
const headGeo = new THREE.SphereGeometry(0.06, 20, 14);
const ringGeo = new THREE.RingGeometry(0.035, 0.055, 24).rotateX(-Math.PI / 2);
const stemMat = new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#ffffff", emissiveIntensity: 0.35, roughness: 0.4 });
const headMats = new Map<string, THREE.MeshStandardMaterial>();
const headMat = (color: string) => {
  if (!headMats.has(color)) headMats.set(color, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.3, side: THREE.DoubleSide }));
  return headMats.get(color)!;
};

/** Comment pins: sphere + stem in 3D, numbered badge in DOM (drei <Html>), coloured by status. */
export function PinsLayer({ ctrl, comments }: { ctrl: ViewerController; comments?: Comment[] }) {
  const draft = useStore(ctrl.store, (s) => s.draft);
  const ref = useCallback((g: THREE.Group | null) => void (ctrl.pinsGroup = g), [ctrl]);
  return (
    <group ref={ref} name="naqsha-pins">
      {(comments ?? []).map((c, i) => (
        <Pin key={c.id} ctrl={ctrl} id={c.id} n={String(i + 1)} anchor={c.anchor} status={c.status} text={c.text} />
      ))}
      {draft && <Pin key="__draft" ctrl={ctrl} id="__draft" n="+" anchor={draft} status="open" draft />}
    </group>
  );
}

interface PinProps {
  ctrl: ViewerController;
  id: string;
  n: string;
  anchor: Pick<CommentAnchor, "position" | "normal" | "level">;
  status: Comment["status"];
  text?: string;
  draft?: boolean;
}

const Pin = memo(function Pin({ ctrl, id, n, anchor, status, text, draft }: PinProps) {
  const px = anchor.position.join(), nx = anchor.normal.join();
  const { pos, quat, head, length } = useMemo(() => {
    const p = new THREE.Vector3(...anchor.position);
    const nrm = new THREE.Vector3(...anchor.normal);
    if (nrm.lengthSq() < 1e-6) nrm.copy(UP);
    nrm.normalize();
    // stand up from floors, lean out of walls (keeps badges readable from eye height)
    const dir = nrm.clone().lerp(UP, nrm.y > 0.7 ? 1 : 0.45).normalize();
    const len = 0.32;
    return { pos: p, quat: new THREE.Quaternion().setFromUnitVectors(UP, dir), head: dir.clone().multiplyScalar(len), length: len };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px, nx]);
  const color = STATUS_COLOR[status] ?? STATUS_COLOR.open;
  const userData = useMemo(() => ({ pin: id, level: anchor.level, headLocal: head, noPick: true }), [id, anchor.level, head]);
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!draft) ctrl.props.onSelectComment?.(id);
    },
    [ctrl, id, draft],
  );
  return (
    <group position={pos} userData={userData}>
      <group quaternion={quat}>
        <mesh geometry={stemGeo} material={stemMat} scale={[1, length, 1]} renderOrder={2} />
        <mesh geometry={headGeo} material={headMat(color)} position={[0, length, 0]} renderOrder={2} />
        <mesh geometry={ringGeo} material={headMat(color)} position={[0, 0.004, 0]} />
      </group>
      <Html position={head.toArray()} center zIndexRange={[20, 0]} wrapperClass="nq-pin-wrap">
        <button
          type="button"
          className="nq-pin"
          data-nq-ui=""
          data-pin={id}
          data-status={status}
          data-draft={draft ? "1" : "0"}
          style={{ "--pin": color } as React.CSSProperties}
          onClick={onClick}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={draft ? "New comment" : `Comment ${n}${text ? `: ${text}` : ""}`}
        >
          <span className="nq-pin-n">{n}</span>
          {text && <span className="nq-pin-tip">{text.length > 90 ? `${text.slice(0, 88)}…` : text}</span>}
        </button>
      </Html>
    </group>
  );
});
