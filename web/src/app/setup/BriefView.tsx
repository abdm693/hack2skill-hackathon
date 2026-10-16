/**
 * Brief (DESIGN.md "Brief (conversational setup)"): the conversation docked on the left; on the right the plot to
 * scale with the LDA envelope and the live, editable brief. One message can fill the whole brief; Naqsha answers
 * "Here's what I understood", then asks at most three things (floors, roof, style), each with "Decide for me".
 * "Decide everything for me" goes all the way to a plan and a walkable house.
 */
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, X } from "lucide-react";
import type { Brief, ChatMessage, Project } from "@contracts/api-types";
import { api } from "@/api/client";
import { plotLabel } from "@/api/domain";
import { cn } from "@/app/lib/utils";
import { useAskContext } from "@/app/shell/ask";
import { Button, EASE_SHEET, IconButton, notify, useMediaQuery } from "@/app/design/kit";
import { useViewNav } from "@/app/design/nav";
import { BriefSheet } from "./BriefSheet";
import { chat, useChat } from "./chat";
import { Conversation } from "./Conversation";
import { PlotCanvas } from "./PlotCanvas";

const NO_MESSAGES: ChatMessage[] = [];

export function BriefView({ project, onProjectChange }: { project: Project; onProjectChange(p: Project): void }) {
  const goTo = useViewNav();
  const phone = useMediaQuery("(max-width: 1023px)");
  const messages = useChat((s) => (s.pid === project.id ? s.messages : NO_MESSAGES));
  const draft = useChat((s) => (s.pid === project.id ? s.draft : null));
  const busy = useChat((s) => s.pid === project.id && s.busy);
  const autopilot = useChat((s) => s.pid === project.id && s.autopilot);
  const failed = useChat((s) => s.pid === project.id && !!s.failed);
  // A turn that never got a reply (it failed, or the page was reloaded mid-turn).
  const unanswered = !busy && messages[messages.length - 1]?.role === "user" ? messages[messages.length - 1].text : undefined;
  const preview = useChat((s) => (s.pid === project.id ? s.preview : null));
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    void chat.open(project.id);
  }, [project.id]);

  const complete = project.stage !== "setup";
  const brief = project.brief;
  const send = useCallback((body: Parameters<typeof chat.send>[1], display?: string) => void chat.send(project.id, body, display), [project.id]);

  // "Decide everything for me": once the brief is complete, carry on to concepts (which choose and plan).
  useEffect(() => {
    if (!autopilot || !complete || busy) return;
    chat.stopAutopilot();
    goTo("concepts", { state: { autopilot: true } });
  }, [autopilot, complete, busy, goTo]);

  const save = useCallback(
    async (patch: Partial<Brief>, decided: string[]) => {
      if (!project.brief) return;
      const next: Brief = { ...project.brief, ...patch, auto_filled: (project.brief.auto_filled ?? []).filter((f) => !decided.includes(f)) };
      onProjectChange({ ...project, brief: next });
      try {
        const p = await api.updateProject(project.id, { brief: next });
        onProjectChange(p);
      } catch (e) {
        onProjectChange(project);
        notify.error("Couldn't save the brief", e);
      }
    },
    [project, onProjectChange],
  );

  const onSuggestion = (s: string) => {
    if (/^show me (the )?concepts?$/i.test(s.trim())) goTo("concepts");
    else send({ message: s }, s);
  };

  useAskContext({
    placeholder: complete ? "Anything to add or change? A prayer room, a third storey…" : "Tell me about the plot and who will live there",
    suggestions: complete ? undefined : ["Decide everything for me"],
    busy,
    onSubmit: (text) => (/^decide everything for me$/i.test(text.trim()) ? send({ action: "skip_all" }) : send({ message: text }, text)),
  });

  const w = preview?.width ?? brief?.plot?.width_ft ?? 0;
  const d = preview?.depth ?? brief?.plot?.depth_ft ?? 0;
  const env = preview?.envelope ?? project.envelope;
  const corner = preview?.corner ?? brief?.plot?.corner ?? false;

  const canvas = (
    <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
      <div className="min-w-0 flex-1">
        <div className="relative overflow-hidden rounded-media bg-surface shadow-e1">
          {w && d ? (
            <PlotCanvas width={w} depth={d} envelope={env} corner={corner} facing={brief?.facing} className="mx-auto block h-auto max-h-[64vh] w-full" />
          ) : (
            <EmptyPlot />
          )}
          <AnimatePresence>
            {preview && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute left-4 top-4 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-medium text-accent">
                Preview
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        {brief?.plot?.width_ft ? (
          <p className="mt-3 px-1 text-[13px] text-ink-3">
            {plotLabel(brief.plot.area_marla)} {brief.plot.corner ? "corner" : "mid-row"} plot{brief.scheme ? ` in ${brief.scheme}` : ""}. The blue line is how far LDA lets you build.
          </p>
        ) : null}
      </div>
      <BriefSheet brief={brief} envelope={project.envelope} save={save} className="w-full shrink-0 xl:w-[360px]" />
    </div>
  );

  const nextCard = complete && !busy && (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: 0.1 }} className="mt-6 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-card bg-surface-2 px-4 py-3">
      <p className="text-[14px] text-ink-2">Next: four exteriors, by day and by night.</p>
      <Button variant="primary" size="sm" iconRight={<ArrowRight className="size-4" strokeWidth={1.75} />} onClick={() => goTo("concepts")}>
        Show me concepts
      </Button>
    </motion.div>
  );

  return (
    <div className="relative h-full overflow-hidden bg-canvas">
      {/* Conversation, docked on the left (full width on phones) */}
      <section
        aria-label="Conversation"
        className={cn(
          "absolute z-10 flex flex-col overflow-hidden bg-surface",
          phone ? "inset-x-0 bottom-[132px] top-[104px]" : "bottom-[132px] left-3 top-[72px] w-[420px] rounded-panel shadow-e2",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-ink">Brief</p>
            <p className="truncate text-[12.5px] text-ink-3">{complete ? "Ready. Change anything, any time." : "One message is enough."}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!complete && !phone && (
              <Button variant="quiet" size="sm" onClick={() => send({ action: "skip_all" })} disabled={busy}>
                Decide everything for me
              </Button>
            )}
            {phone && (
              <Button variant="secondary" size="sm" onClick={() => setSheet(true)}>
                Plot and brief
              </Button>
            )}
          </div>
        </div>
        <Conversation
          className="flex-1"
          messages={messages}
          draft={draft}
          busy={busy}
          complete={complete}
          brief={brief}
          envelope={project.envelope}
          send={send}
          onSuggestion={onSuggestion}
          onPreferences={(preferences) => void save({ preferences }, [])}
          failed={failed || !!unanswered}
          onRetry={() => void chat.retry(project.id, unanswered)}
          footer={nextCard}
        />
      </section>

      {/* Plot and live brief */}
      {!phone && (
        <div className="absolute inset-y-0 left-[444px] right-0 overflow-y-auto [scrollbar-width:thin]">
          <div className="mx-auto max-w-[1040px] px-6 pb-32 pt-[72px]">{canvas}</div>
        </div>
      )}

      <AnimatePresence>
        {phone && sheet && (
          <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-(--scrim)" onClick={() => setSheet(false)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.32, ease: EASE_SHEET }}
              className="absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-panel bg-canvas px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 [scrollbar-width:thin]"
              role="dialog"
              aria-label="Plot and brief"
            >
              <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center justify-between bg-canvas/95 px-4 pb-2 backdrop-blur">
                <span className="h-1 w-9 rounded-full bg-line-strong" />
                <IconButton label="Close" size={32} onClick={() => setSheet(false)}>
                  <X className="size-4" strokeWidth={1.75} />
                </IconButton>
              </div>
              {canvas}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyPlot() {
  return (
    <div className="grid aspect-[4/3] place-items-center px-8 text-center">
      <div>
        <svg viewBox="0 0 120 150" className="mx-auto h-28 w-auto" aria-hidden>
          <rect x="22" y="12" width="76" height="112" fill="none" stroke="#CFCFC8" strokeDasharray="4 4" />
          <path d="M6 140H114" stroke="#E4E4DF" strokeWidth="6" />
        </svg>
        <p className="mt-3 text-body text-ink-3">Your plot appears here, to scale, with what LDA lets you build.</p>
      </div>
    </div>
  );
}
