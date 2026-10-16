import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, ArrowUp, CircleCheck, DraftingCompass, PanelRight, Sparkles, X } from "lucide-react";
import type { ChatMessage } from "@contracts/api-types";
import { plotLabel } from "@/api/domain";
import { cn } from "@/app/lib/utils";
import { useProject } from "@/app/store/project";
import { Button } from "@/app/ui/Button";
import { BriefPanel } from "./BriefPanel";
import { ChipsInput, MapInput, PlotInput, QuestionFrame, RoomsInput, StyleInput, type Send } from "./inputs";

const THINKING = ["Reading your answer", "Checking it against the LDA rules", "Updating your brief", "Choosing the next question"];
const THINKING_FIRST = ["Opening a fresh brief", "Loading the LDA rulebook", "Preparing the first question"];

export function SetupStep() {
  const navigate = useNavigate();
  const project = useProject((s) => s.project)!;
  const messages = useProject((s) => s.messages);
  const draft = useProject((s) => s.draft);
  const busy = useProject((s) => s.intakeBusy);
  const startIntake = useProject((s) => s.startIntake);
  const sendIntake = useProject((s) => s.sendIntake);
  const [briefOpen, setBriefOpen] = useState(false);

  const complete = project.stage !== "setup";
  const lastAssistant = useMemo(() => [...messages].reverse().find((m) => m.role === "assistant"), [messages]);
  const lastIsAssistant = messages[messages.length - 1]?.role === "assistant";
  const activeQuestion = !complete && !busy && lastIsAssistant ? lastAssistant : undefined;

  useEffect(() => {
    if (!messages.length && !busy) void startIntake();
  }, [messages.length, busy, startIntake]);

  const send: Send = (body, display) => void sendIntake(body, display);
  const skip = () => void sendIntake({ action: "skip_question" });

  // Auto-scroll to the newest turn unless the reader scrolled up.
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const onScroll = () => {
    const el = scroller.current;
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
  };
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, draft, busy, complete]);

  const brief = project.brief;
  const summaryBits = [
    brief?.plot?.area_marla ? plotLabel(brief.plot.area_marla) : null,
    brief?.storeys ? `${brief.storeys} storeys` : null,
    brief?.bedrooms ? `${brief.bedrooms} bedrooms` : null,
    brief?.style || null,
  ].filter(Boolean) as string[];

  return (
    <div className="flex h-full">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h1 className="font-display-text text-[19px] font-medium leading-tight text-ink">Tell the architect about your home</h1>
            <p className="hidden text-[12.5px] text-graphite sm:block">One tap per question. Skip anything and the AI chooses for you.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!complete && (
              <Button
                variant="outline"
                size="sm"
                icon={<Sparkles className="size-3.5 text-brick" strokeWidth={1.75} />}
                onClick={() => send({ action: "skip_all" })}
                disabled={busy}
              >
                <span className="hidden sm:inline">Skip setup — design it for me</span>
                <span className="sm:hidden">Design it for me</span>
              </Button>
            )}
            <button
              onClick={() => setBriefOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-ink shadow-[0_0_0_1px_var(--color-line-strong)] lg:hidden"
            >
              <PanelRight className="size-3.5" strokeWidth={1.75} /> Brief
            </button>
          </div>
        </div>

        <div ref={scroller} onScroll={onScroll} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[720px] px-4 pb-10 pt-6 sm:px-6">
            {messages.map((m) => (
              <Turn key={m.id} m={m}>
                {activeQuestion?.id === m.id && <QuestionWidget m={m} send={send} skip={skip} busy={busy} />}
              </Turn>
            ))}
            {busy && (draft ? <Draft text={draft} /> : <Thinking hints={messages.length ? THINKING : THINKING_FIRST} />)}

            <AnimatePresence>
              {complete && !busy && (
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="mt-8 rounded-[26px] bg-ink/[0.035] p-1.5 ring-1 ring-ink/[0.06]"
                >
                  <div className="rounded-[21px] bg-plaster px-5 py-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.8)] sm:px-6">
                    <div className="flex items-center gap-2 text-[13px] font-semibold text-pass">
                      <CircleCheck className="size-4" strokeWidth={2} /> Brief complete
                    </div>
                    <p className="mt-2 font-display-text text-[22px] leading-snug text-ink">
                      {summaryBits.length ? summaryBits.join(", ") : "Your home"}
                      {brief?.scheme ? ` in ${brief.scheme}` : ""}.
                    </p>
                    <p className="mt-1.5 text-[13.5px] text-graphite">
                      Next: four photoreal exterior concepts, sketched in parallel. You pick one, and it guides the plan and the 3D model.
                    </p>
                    <Button
                      variant="primary"
                      size="xl"
                      className="mt-5"
                      onClick={() => navigate("../concepts")}
                      trailing={<ArrowRight className="size-[18px]" strokeWidth={1.75} />}
                    >
                      Generate concepts
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <Composer busy={busy} complete={complete} onSend={(text) => send({ message: text }, text)} />
      </section>

      <aside className="scrollbar-thin hidden w-[400px] shrink-0 overflow-y-auto border-l border-line bg-sheet lg:block xl:w-[440px]">
        <BriefPanel brief={project.brief} envelope={project.envelope} askingField={activeQuestion?.field} askingFacing={activeQuestion?.input === "map" && !!activeQuestion.chips?.length} />
      </aside>

      {/* Phone/tablet: brief as a bottom sheet */}
      <AnimatePresence>
        {briefOpen && (
          <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-ink/30" onClick={() => setBriefOpen(false)} />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              className="scrollbar-thin absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-[26px] bg-sheet shadow-float"
            >
              <div className="sticky top-0 z-10 flex justify-between bg-sheet/95 px-5 pt-3 backdrop-blur">
                <span className="mx-auto h-1 w-10 rounded-full bg-line-strong" />
                <button onClick={() => setBriefOpen(false)} aria-label="Close brief" className="absolute right-3 top-2 rounded-full p-1.5 text-graphite hover:bg-wash">
                  <X className="size-4" />
                </button>
              </div>
              <BriefPanel brief={project.brief} envelope={project.envelope} askingField={activeQuestion?.field} askingFacing={activeQuestion?.input === "map" && !!activeQuestion.chips?.length} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Avatar() {
  return (
    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brick text-sheet shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]">
      <DraftingCompass className="size-4" strokeWidth={1.6} />
    </span>
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((p, i) => (
        <p key={i} className={cn("text-[15px] leading-[1.6] text-ink", i > 0 && "mt-2.5")}>
          {p}
        </p>
      ))}
    </>
  );
}

function Turn({ m, children }: { m: ChatMessage; children?: ReactNode }) {
  if (m.role === "user") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-5 flex justify-end">
        <div className="max-w-[85%] rounded-[20px] rounded-br-md bg-ink px-4 py-2.5 text-[14.5px] leading-snug text-sheet">{m.text}</div>
      </motion.div>
    );
  }
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mt-6 flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1 pt-1">
        <Paragraphs text={m.text} />
        {children}
      </div>
    </motion.div>
  );
}

function Thinking({ hints }: { hints: string[] }) {
  const [i, setI] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = Date.now();
    const a = setInterval(() => setI((x) => Math.min(x + 1, hints.length - 1)), 2400);
    const b = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 flex items-center gap-3" aria-live="polite">
      <Avatar />
      <div className="flex items-center gap-3 rounded-full bg-plaster px-4 py-2 shadow-[0_0_0_1px_var(--color-line)]">
        <span className="flex gap-1">
          {[0, 1, 2].map((k) => (
            <motion.span
              key={k}
              className="size-1.5 rounded-full bg-brick"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
              transition={{ duration: 1.1, repeat: Infinity, delay: k * 0.16, ease: "easeInOut" }}
            />
          ))}
        </span>
        <AnimatePresence mode="wait">
          <motion.span
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="text-[13px] text-graphite"
          >
            {hints[i]}…
          </motion.span>
        </AnimatePresence>
        {elapsed >= 4 && <span className="text-[12px] text-pencil tabular">{elapsed}s</span>}
      </div>
    </motion.div>
  );
}

function Draft({ text }: { text: string }) {
  return (
    <div className="mt-6 flex gap-3">
      <Avatar />
      <div className="min-w-0 flex-1 pt-1">
        <Paragraphs text={text} />
        <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-caret bg-brick" />
      </div>
    </div>
  );
}

function QuestionWidget({ m, send, skip, busy }: { m: ChatMessage; send: Send; skip: () => void; busy: boolean }) {
  const brief = useProject((s) => s.project?.brief ?? null);
  switch (m.input) {
    case "plot":
      return (
        <QuestionFrame onSkip={skip} disabled={busy} skipLabel="Skip, assume 10 marla">
          <PlotInput onSend={send} disabled={busy} brief={brief} />
        </QuestionFrame>
      );
    case "style":
      return (
        <QuestionFrame onSkip={skip} disabled={busy} skipLabel="Skip, you choose">
          <StyleInput onSend={send} disabled={busy} current={brief?.style} />
        </QuestionFrame>
      );
    case "rooms":
      return (
        <QuestionFrame onSkip={skip} disabled={busy} skipLabel="Skip, you choose">
          <RoomsInput onSend={send} disabled={busy} brief={brief} />
        </QuestionFrame>
      );
    case "map":
      return (
        <QuestionFrame onSkip={skip} disabled={busy} prominentSkip>
          <MapInput onSend={send} onSkip={skip} disabled={busy} chips={m.chips} />
        </QuestionFrame>
      );
    default:
      if (m.chips?.length) {
        return (
          <QuestionFrame onSkip={skip} disabled={busy} skipLabel="Skip, you choose">
            <ChipsInput chips={m.chips} multi={m.multi} onSend={send} disabled={busy} />
          </QuestionFrame>
        );
      }
      if (m.allow_skip) {
        return (
          <QuestionFrame onSkip={skip} disabled={busy} skipLabel="Skip, you choose">
            <p className="text-[12.5px] text-pencil">Type your answer below.</p>
          </QuestionFrame>
        );
      }
      return null;
  }
}

function Composer({ busy, complete, onSend }: { busy: boolean; complete: boolean; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSend(t);
    setText("");
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);
  return (
    <div className="border-t border-line bg-paper/80 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-[720px] items-end gap-2 rounded-[22px] bg-plaster p-1.5 pl-4 shadow-[0_0_0_1px_var(--color-line),0_6px_20px_-14px_rgb(30_27_23/0.35)] focus-within:shadow-[0_0_0_1.5px_var(--color-brick),0_6px_20px_-14px_rgb(30_27_23/0.35)]">
        <textarea
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={complete ? "Anything else? e.g. elderly parents on the ground floor" : "Type an answer, or tap an option above"}
          aria-label="Message the AI architect"
          className="max-h-[140px] min-h-9 flex-1 resize-none bg-transparent py-2 text-[14.5px] leading-snug text-ink outline-none placeholder:text-pencil"
        />
        <button
          onClick={submit}
          disabled={!text.trim() || busy}
          aria-label="Send"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-brick text-sheet transition-[background-color,transform,opacity] hover:bg-brick-deep active:scale-95 disabled:opacity-30"
        >
          <ArrowUp className="size-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
