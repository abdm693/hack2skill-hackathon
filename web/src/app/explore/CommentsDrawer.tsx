import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Camera, Check, MessageSquarePlus, PencilLine, Trash, X } from "lucide-react";
import type { BuildingPlan } from "@contracts/plan";
import type { Comment } from "@contracts/api-types";
import { assetUrl } from "@/api/client";
import { cn, relativeTime } from "@/app/lib/utils";
import { Button, IconButton } from "@/app/ui/Button";
import { Pill, type Tone } from "@/app/ui/primitives";
import { anchorLabel } from "./snapshot";

export const STATUS_TONE: Record<Comment["status"], Tone> = { open: "neutral", resolved: "pass", partial: "warn", rejected: "fail" };
export const STATUS_LABEL: Record<Comment["status"], string> = { open: "Open", resolved: "Resolved", partial: "Partly done", rejected: "Not possible" };

export function CommentsDrawer({
  comments,
  plan,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onCommentView,
  onFinish,
  onClose,
  finishing,
  readOnly,
}: {
  comments: Comment[];
  plan?: BuildingPlan;
  selectedId?: string | null;
  onSelect: (c: Comment) => void;
  onEdit: (c: Comment, text: string) => void;
  onDelete: (c: Comment) => void;
  onCommentView: () => void;
  onFinish: () => void;
  onClose: () => void;
  finishing?: boolean;
  readOnly?: boolean;
}) {
  const open = comments.filter((c) => c.status === "open").length;
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3.5">
        <div>
          <p className="font-display-text text-[18px] font-medium text-sheet">Comments</p>
          <p className="text-[12px] text-sheet/55">
            {comments.length ? `${comments.length} on this version, ${open} open` : "Pin what you'd change"}
          </p>
        </div>
        <IconButton label="Close comments" tone="dark" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {!comments.length && (
          <div className="rounded-2xl border border-dashed border-white/15 px-4 py-6 text-center">
            <MessageSquarePlus className="mx-auto size-5 text-sheet/50" strokeWidth={1.5} />
            <p className="mt-2 text-[13px] text-sheet/80">No comments yet</p>
            <p className="mt-1 text-[12px] leading-relaxed text-sheet/50">
              Turn on Comment and click any wall, window or piece of furniture. In walk mode, press C.
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {comments.map((c) => (
            <motion.div
              key={c.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <CommentCard
                c={c}
                plan={plan}
                selected={selectedId === c.id}
                onSelect={() => onSelect(c)}
                onEdit={(t) => onEdit(c, t)}
                onDelete={() => onDelete(c)}
                readOnly={readOnly || c.status !== "open"}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="space-y-2 border-t border-white/10 p-3">
        {!readOnly && (
          <Button variant="glass" className="w-full" icon={<Camera className="size-4" strokeWidth={1.75} />} onClick={onCommentView}>
            Comment on this view
          </Button>
        )}
        {!readOnly && (
          <Button
            variant="primary"
            className="w-full justify-between pl-5"
            disabled={!open || finishing}
            loading={finishing}
            onClick={onFinish}
            trailing={<ArrowRight className="size-4" strokeWidth={1.75} />}
          >
            Finish walkthrough ({open} comment{open === 1 ? "" : "s"})
          </Button>
        )}
      </div>
    </div>
  );
}

function CommentCard({
  c,
  plan,
  selected,
  onSelect,
  onEdit,
  onDelete,
  readOnly,
}: {
  c: Comment;
  plan?: BuildingPlan;
  selected: boolean;
  onSelect: () => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(c.text);
  const snap = assetUrl(c.snapshot_url);
  return (
    <div
      className={cn(
        "group overflow-hidden rounded-2xl bg-white/[0.06] ring-1 transition-colors",
        selected ? "ring-[#e7a58f]" : "ring-white/10 hover:bg-white/[0.09]",
      )}
    >
      <button onClick={onSelect} className="flex w-full gap-3 p-2.5 text-left" title="Fly to this comment">
        <span className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-black/30">
          {snap && <img src={snap} alt="" className="h-full w-full object-cover" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11.5px] text-sheet/55">{anchorLabel(c.anchor, plan)}</span>
          {!editing && <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-sheet">{c.text}</span>}
          <span className="mt-1.5 flex items-center gap-2">
            <Pill tone={STATUS_TONE[c.status]} className="h-5 text-[10.5px]">
              {STATUS_LABEL[c.status]}
            </Pill>
            <span className="text-[11px] text-sheet/40">{relativeTime(c.created_at)}</span>
          </span>
        </span>
      </button>
      {editing && (
        <div className="px-2.5 pb-2.5">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            rows={3}
            autoFocus
            className="w-full resize-none rounded-lg bg-black/30 px-2.5 py-2 text-[13px] text-sheet outline-none ring-[#e7a58f] focus:ring-1"
          />
          <div className="mt-1.5 flex justify-end gap-1.5">
            <Button size="xs" variant="glass" onClick={() => { setEditing(false); setText(c.text); }}>
              Cancel
            </Button>
            <Button size="xs" variant="primary" icon={<Check className="size-3" />} onClick={() => { setEditing(false); if (text.trim() && text !== c.text) onEdit(text.trim()); }}>
              Save
            </Button>
          </div>
        </div>
      )}
      {c.resolution && (
        <p className="border-t border-white/10 px-3 py-2 text-[12px] leading-relaxed text-sheet/70">{c.resolution}</p>
      )}
      {!readOnly && !editing && (
        <div className="flex justify-end gap-0.5 px-1.5 pb-1.5 opacity-70 transition-opacity group-hover:opacity-100">
          <IconButton label="Edit comment" tone="dark" className="size-7" onClick={() => setEditing(true)}>
            <PencilLine className="size-3.5" strokeWidth={1.75} />
          </IconButton>
          <IconButton label="Delete comment" tone="dark" className="size-7" onClick={onDelete}>
            <Trash className="size-3.5" strokeWidth={1.75} />
          </IconButton>
        </div>
      )}
    </div>
  );
}
