import { memo, useCallback, useMemo } from "react";
import * as THREE from "three";
import { useStore } from "zustand";
import { Html } from "@react-three/drei";
import type { Comment, CommentAnchor } from "@contracts/api-types";
import type { ViewerController } from "../core/controller";

/** DESIGN author hues (--color-author-1…6): a person keeps their colour across Plan and House. */
export const AUTHOR_HUES = ["#0D7C72", "#6A4FD6", "#C23F78", "#A8641A", "#4F6378", "#2F7A3A"];

export function authorHue(c: Pick<Comment, "author">): string {
  const key = c.author?.id || c.author?.name;
  if (!key) return AUTHOR_HUES[0];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AUTHOR_HUES[h % AUTHOR_HUES.length];
}

/**
 * Comment pins: a 24 px teardrop whose tip sits exactly on the anchor point, in the author's hue with a white ring
 * and the comment's number (the same number as in Plan). DOM via drei <Html>; the controller hides pins on hidden
 * floors or above the section cut, and marks occluded ones (dimmed in orbit, hidden while walking).
 */
export function PinsLayer({ ctrl, comments }: { ctrl: ViewerController; comments?: Comment[] }) {
  const draft = useStore(ctrl.store, (s) => s.draft);
  const selected = useStore(ctrl.store, (s) => s.selectedPin);
  const ref = useCallback((g: THREE.Group | null) => void (ctrl.pinsGroup = g), [ctrl]);
  return (
    <group ref={ref} name="naqsha-pins">
      {(comments ?? []).map((c, i) => (
        <Pin key={c.id} ctrl={ctrl} id={c.id} n={String(i + 1)} anchor={c.anchor} status={c.status} text={c.text} hue={authorHue(c)} author={c.author?.name} selected={selected === c.id} />
      ))}
      {draft && <Pin key="__draft" ctrl={ctrl} id="__draft" n="+" anchor={draft} status="open" hue="#2747F5" draft />}
    </group>
  );
}

interface PinProps {
  ctrl: ViewerController;
  id: string;
  n: string;
  anchor: Pick<CommentAnchor, "position" | "normal" | "level">;
  status: Comment["status"];
  hue: string;
  text?: string;
  author?: string;
  draft?: boolean;
  selected?: boolean;
}

const STATUS_WORD: Record<Comment["status"], string> = { open: "", resolved: "Done", partial: "Partly done", rejected: "Not possible" };

const Pin = memo(function Pin({ ctrl, id, n, anchor, status, hue, text, author, draft, selected }: PinProps) {
  const px = anchor.position.join(), nx = anchor.normal.join();
  const { pos, normal } = useMemo(() => {
    const nrm = new THREE.Vector3(...anchor.normal);
    if (nrm.lengthSq() < 1e-6) nrm.set(0, 1, 0);
    return { pos: new THREE.Vector3(...anchor.position), normal: nrm.normalize() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px, nx]);
  const userData = useMemo(() => ({ pin: id, level: anchor.level, normal, noPick: true }), [id, anchor.level, normal]);
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!draft) ctrl.selectPin(id);
    },
    [ctrl, id, draft],
  );
  const word = STATUS_WORD[status];
  return (
    <group position={pos} userData={userData}>
      <Html zIndexRange={[20, 0]} wrapperClass="nq-pin-wrap">
        <button
          type="button"
          className="nq-pin"
          data-nq-ui=""
          data-pin={id}
          data-status={status}
          data-draft={draft ? "1" : "0"}
          data-selected={selected ? "1" : "0"}
          style={{ "--pin": hue } as React.CSSProperties}
          onClick={onClick}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={draft ? "New comment" : `Comment ${n}${author ? ` by ${author}` : ""}${word ? ` (${word.toLowerCase()})` : ""}${text ? `: ${text}` : ""}`}
        >
          <span className="nq-pin-drop" aria-hidden>
            <span className="nq-pin-n">{n}</span>
          </span>
          {text && (
            <span className="nq-pin-tip" aria-hidden>
              {author && <b>{author}</b>}
              {text.length > 90 ? `${text.slice(0, 88)}…` : text}
              {word && <i>{word}</i>}
            </span>
          )}
        </button>
      </Html>
    </group>
  );
});
