/**
 * The comments sheet (right): All · Mine · Team · Client · Open · Resolved, grouped by floor and room, with threads.
 * "Apply N open comments" lets the owner or team pick which notes feed the next revision.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageSquarePlus } from "lucide-react";
import type { Comment, Project } from "@contracts/api-types";
import { userId } from "@/api/client";
import { cn } from "@/app/lib/utils";
import { canEdit } from "@/app/lib/views";
import { useAuth } from "@/app/store/auth";
import { useProject } from "@/app/store/project";
import { Button } from "@/app/ui/Button";
import { Chip } from "@/app/ui/Chip";
import { Sheet } from "@/app/ui/Sheet";
import { ease } from "@/app/ui/motion";
import { CommentItem } from "./CommentItem";
import { FILTERS, groupComments, matches, pinNumbers, type CommentFilter } from "./model";

export function CommentsSheet({
  open,
  onClose,
  project,
  clientView,
  applyMode,
  onApplyModeChange,
  focusId,
  onShow,
  onApply,
  emptyHint,
}: {
  open: boolean;
  onClose: () => void;
  project: Project;
  clientView?: boolean;
  applyMode?: boolean;
  onApplyModeChange?: (on: boolean) => void;
  /** Scroll to this comment and flash it. */
  focusId?: string | null;
  onShow?: (c: Comment) => void;
  /** Start a revision with these comments. */
  onApply?: (ids: string[]) => void;
  /** What to say when there are no comments yet. */
  emptyHint?: string;
}) {
  const comments = useProject((s) => s.comments);
  const commentsFor = useProject((s) => s.commentsFor);
  const versions = useProject((s) => s.versions);
  const guestName = useProject((s) => s.guestName);
  const reviseRunning = useProject((s) => s.revise.status === "running");
  const user = useAuth((s) => s.user);
  const [filter, setFilter] = useState<CommentFilter>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const refs = useRef(new Map<string, HTMLElement>());

  const versionId = commentsFor ?? project.current_version_id;
  const plan = versionId ? versions[versionId]?.plan : undefined;
  const list = useMemo(() => comments.filter((c) => !versionId || c.version_id === versionId), [comments, versionId]);
  const numbers = useMemo(() => pinNumbers(list), [list]);
  const me = useMemo(() => ({ ids: [user?.uid, clientView ? undefined : userId()].filter(Boolean) as string[], name: clientView ? guestName : user?.name }), [user, clientView, guestName]);
  const shown = useMemo(() => list.filter((c) => matches(c, filter, me)), [list, filter, me]);
  const groups = useMemo(() => groupComments(shown, plan), [shown, plan]);
  const openList = useMemo(() => list.filter((c) => c.status === "open"), [list]);
  const moderator = !clientView && canEdit(project);
  const isLatest = versionId === project.current_version_id;
  const canApply = moderator && isLatest && openList.length > 0 && !!onApply;

  // Apply mode starts with every open comment included (only when it turns on); any can be unticked.
  const openRef = useRef(openList);
  openRef.current = openList;
  useEffect(() => {
    if (applyMode) setPicked(new Set(openRef.current.map((c) => c.id)));
  }, [applyMode]);

  useEffect(() => {
    if (!open || !focusId) return;
    const t = setTimeout(() => refs.current.get(focusId)?.scrollIntoView({ block: "center", behavior: "smooth" }), 120);
    return () => clearTimeout(t);
  }, [open, focusId]);

  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const count = picked.size;
  const footer = applyMode && canApply ? (
    <div className="flex items-center gap-2">
      <Button variant="quiet" size="md" onClick={() => onApplyModeChange?.(false)}>Cancel</Button>
      <Button
        variant="primary"
        size="md"
        className="flex-1"
        disabled={!count || reviseRunning}
        onClick={() => onApply?.([...picked])}
      >
        {count ? `Apply ${count} ${count === 1 ? "comment" : "comments"}` : "Pick at least one"}
      </Button>
    </div>
  ) : canApply ? (
    <Button variant="secondary" size="md" className="w-full" onClick={() => onApplyModeChange?.(true)} disabled={reviseRunning}>
      Apply {openList.length} open {openList.length === 1 ? "comment" : "comments"}…
    </Button>
  ) : undefined;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="right"
      title={applyMode && canApply ? "Choose what to change" : "Comments"}
      footer={footer}
      bodyClassName="pt-1"
    >
      {applyMode && canApply ? (
        <p className="mb-2 text-[13px] leading-[18px] text-ink-3">
          Naqsha will make a new version with these changes and answer each one in its thread.
        </p>
      ) : (
        list.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1" role="group" aria-label="Filter comments">
            {FILTERS.map((f) => (
              <Chip key={f.id} size="sm" selected={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </Chip>
            ))}
          </div>
        )
      )}

      {!isLatest && list.length > 0 && (
        <p className="mb-2 rounded-[12px] bg-surface-2 px-3 py-2 text-[13px] leading-[18px] text-ink-2">These notes are on an earlier version.</p>
      )}

      {list.length === 0 ? (
        <div className="grid place-items-center px-4 py-14 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-surface-2 text-ink-3">
            <MessageSquarePlus className="size-5" strokeWidth={1.75} />
          </span>
          <p className="mt-3 text-[15px] font-semibold text-ink">No comments yet</p>
          <p className="mt-1 max-w-[260px] text-[13px] leading-[18px] text-ink-3">
            {emptyHint ?? "Press C in the House view, then click anywhere to pin a note. Naqsha turns notes into the next version."}
          </p>
        </div>
      ) : shown.length === 0 ? (
        <p className="px-1 py-10 text-center text-[13px] text-ink-3">Nothing here with this filter.</p>
      ) : (
        <div className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {groups.map((g) => {
              const items = applyMode && canApply ? g.items.filter((c) => c.status === "open") : g.items;
              if (!items.length) return null;
              return (
                <motion.section
                  key={g.key}
                  layout="position"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, ease: ease.out }}
                  className="pt-2"
                >
                  <h3 className="sticky top-0 z-[1] -mx-5 bg-surface/95 px-5 py-1.5 text-[12px] font-medium text-ink-3 backdrop-blur-sm">{g.label}</h3>
                  <div className={cn("flex flex-col divide-y divide-line")}>
                    {items.map((c) => (
                      <CommentItem
                        key={c.id}
                        ref={(el) => {
                          if (el) refs.current.set(c.id, el);
                          else refs.current.delete(c.id);
                        }}
                        comment={c}
                        number={numbers.get(c.id)}
                        me={me}
                        moderator={moderator}
                        clientView={clientView}
                        highlight={focusId === c.id}
                        onShow={onShow}
                        selectable={applyMode && canApply}
                        selected={picked.has(c.id)}
                        onToggle={() => toggle(c.id)}
                      />
                    ))}
                  </div>
                </motion.section>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </Sheet>
  );
}
