/**
 * Glue for the pre-overhaul router (App.tsx → ProjectLayout → *Step), so the new views run on this branch before
 * the shell lands: each old step renders its new view with the project from the old store, plus a minimal dock
 * (Naqsha's line, suggestions and the Ask field from `useAskContext`).
 *
 * Integration: once the shell routes /app/p/:id/{brief,concepts,plan,house,revisions} to the views and its dock reads
 * `@/app/shell/ask`, delete this file and the five *Step.tsx wrappers (setup/SetupStep, concepts/ConceptsStep,
 * design/DesignStep, explore/ExploreStep, revisions/RevisionsStep).
 */
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp } from "lucide-react";
import type { Project } from "@contracts/api-types";
import { cn } from "@/app/lib/utils";
import { useProject } from "@/app/store/project";
import { useAsk } from "./ask";
import { useNaqshaActivity } from "./flow";
import { BreathingDot, Chip, EASE_OUT } from "./kit";

export type ViewComponent = ComponentType<{ project: Project; onProjectChange(p: Project): void }>;

export function CompatView({ view: View }: { view: ViewComponent }) {
  const project = useProject((s) => s.project);
  const onProjectChange = useCallback((p: Project) => useProject.setState({ project: p }), []);
  if (!project) return null;
  return (
    <div className="relative h-full overflow-hidden">
      <View project={project} onProjectChange={onProjectChange} />
      <FlowDock />
    </div>
  );
}

/** A stand-in for the shell's dock: Naqsha's line, two or three suggestions and the Ask field. */
export function FlowDock() {
  const ask = useAsk();
  const activity = useNaqshaActivity();
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(160, Math.max(52, el.scrollHeight))}px`;
  }, [text]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (!ask && !activity.busy) return null;
  const send = (t: string) => {
    const v = t.trim();
    if (!v || !ask || ask.busy) return;
    void ask.onSubmit(v);
    setText("");
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[35] flex justify-center px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto w-full max-w-[720px]">
        <AnimatePresence initial={false}>
          {(activity.line || (ask?.suggestions?.length && !text && !ask.busy)) && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.2, ease: EASE_OUT }} className="mb-2 flex flex-wrap items-center gap-2 px-1">
              {activity.line && (
                <span className="inline-flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1.5 text-[13px] text-ink shadow-e1 backdrop-blur">
                  <BreathingDot />
                  {activity.line}
                </span>
              )}
              {!activity.busy &&
                !ask?.busy &&
                ask?.suggestions?.slice(0, 3).map((s) => (
                  <Chip key={s} tone="suggestion" onClick={() => send(s)}>
                    {s}
                  </Chip>
                ))}
            </motion.div>
          )}
        </AnimatePresence>
        {ask && (
          <div className="flex items-end gap-2 rounded-[26px] bg-surface p-1.5 pl-5 shadow-e2 focus-within:shadow-[0_0_0_1px_var(--color-accent),0_12px_32px_-12px_rgb(17_17_19/0.18)]">
            <textarea
              ref={ref}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(text);
                }
              }}
              placeholder={ask.placeholder}
              aria-label="Ask Naqsha"
              className="max-h-[148px] min-h-10 flex-1 resize-none bg-transparent py-2.5 text-body-lg text-ink outline-none placeholder:text-ink-4"
            />
            <AnimatePresence>
              {text.trim() && (
                <motion.button
                  type="button"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                  onClick={() => send(text)}
                  disabled={ask.busy}
                  aria-label="Send"
                  className={cn("mb-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white transition-colors hover:bg-accent-press disabled:opacity-40")}
                >
                  <ArrowUp className="size-4" strokeWidth={2} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
