import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { MapPin, X } from "lucide-react";
import type { BuildingPlan } from "@contracts/plan";
import type { Comment, CommentAnchor } from "@contracts/api-types";
import { Button } from "@/app/ui/Button";
import { Chip } from "@/app/ui/primitives";
import { anchorLabel } from "./snapshot";

export interface CommentDraft {
  anchor: CommentAnchor;
  camera: Comment["camera"];
  snapshot: string;
}

const QUICK = ["Make this bigger", "Change material", "Move this", "Remove this", "More light here", "Add storage"];

/** Small popover to write a comment pinned at a point in the 3D view. */
export function Composer({
  draft,
  plan,
  onCancel,
  onSave,
}: {
  draft: CommentDraft;
  plan?: BuildingPlan;
  onCancel: () => void;
  onSave: (text: string) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    const ok = await onSave(text.trim());
    setSaving(false);
    if (!ok) return;
  };
  const where = anchorLabel(draft.anchor, plan);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-[22px] bg-sheet shadow-float ring-1 ring-ink/10"
      role="dialog"
      aria-label="New comment"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        e.stopPropagation();
      }}
    >
      <div className="relative">
        {draft.snapshot ? <img src={draft.snapshot} alt="" className="aspect-[16/8] w-full object-cover" /> : <div className="aspect-[16/8] w-full bg-night" />}
        <span className="absolute left-3 top-3 inline-flex max-w-[80%] items-center gap-1.5 rounded-full bg-ink/80 px-2.5 py-1 text-[12px] font-medium text-sheet backdrop-blur">
          <MapPin className="size-3.5 shrink-0 text-[#e7a58f]" strokeWidth={2} />
          <span className="truncate">{where}</span>
        </span>
        <button onClick={onCancel} aria-label="Cancel" className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-ink/70 text-sheet hover:bg-ink">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <Chip key={q} size="sm" onClick={() => { setText(q); ref.current?.focus(); }}>
              {q}
            </Chip>
          ))}
        </div>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
              e.preventDefault();
              void save();
            }
          }}
          rows={3}
          placeholder="What would you change here?"
          className="mt-3 w-full resize-none rounded-xl bg-wash px-3 py-2.5 text-[14px] text-ink outline-none ring-brick placeholder:text-pencil focus:ring-1"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11.5px] text-pencil">Argon reads every comment when you finish the walkthrough.</span>
          <Button variant="primary" size="sm" disabled={!text.trim()} loading={saving} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
