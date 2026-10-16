/**
 * The setup conversation: messages, the streaming draft and the in-flight turn. Lives outside the view so a turn
 * keeps streaming while people look at another view, and so the dock's Ask field and the widgets share one sender.
 */
import { create } from "zustand";
import type { ChatMessage, Envelope } from "@contracts/api-types";
import { api, isAbortError, type IntakeBody } from "@/api/client";
import { intake } from "@/app/design/endpoints";
import { patchProject, refreshProject } from "@/app/design/flow";
import { notify } from "@/app/design/kit";

/** Live preview while the plot widget is being edited (the canvas follows it before it is sent). */
export interface PlotPreview { width: number; depth: number; corner: boolean; envelope: Envelope | null }

interface ChatState {
  pid: string | null;
  loaded: boolean;
  messages: ChatMessage[];
  draft: string | null;
  busy: boolean;
  failed: IntakeBody | null;
  /** Set when "Decide everything for me" ran: carry on to concepts, a plan and a walkable house. */
  autopilot: boolean;
  preview: PlotPreview | null;
}

export const useChat = create<ChatState>(() => ({
  pid: null,
  loaded: false,
  messages: [],
  draft: null,
  busy: false,
  failed: null,
  autopilot: false,
  preview: null,
}));

let ctrl: AbortController | null = null;
let seq = 0;
const lid = () => `local-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const live = (pid: string) => useChat.getState().pid === pid;

export const chat = {
  async open(pid: string) {
    if (useChat.getState().pid === pid && useChat.getState().loaded) return;
    ctrl?.abort();
    useChat.setState({ pid, loaded: false, messages: [], draft: null, busy: false, failed: null, autopilot: false, preview: null });
    try {
      const messages = await api.getMessages(pid);
      if (!live(pid)) return;
      useChat.setState({ messages, loaded: true });
      if (!messages.length) await chat.send(pid, { action: "start" });
    } catch (e) {
      if (!live(pid)) return;
      useChat.setState({ loaded: true });
      notify.error("Couldn't open the conversation", e);
    }
  },

  async send(pid: string, body: IntakeBody, display?: string) {
    const st = useChat.getState();
    if (st.busy || st.pid !== pid) return;
    const retry = st.failed === body;
    if (body.action !== "start" && !retry) {
      const text = display ?? (body.action === "skip_question" ? "Decide for me" : body.action === "skip_all" ? "Decide everything for me" : body.message ?? "");
      useChat.setState({ messages: [...st.messages, { id: lid(), role: "user", text, created_at: new Date().toISOString() }] });
    }
    if (body.action === "skip_all") useChat.setState({ autopilot: true });
    useChat.setState({ busy: true, draft: "", failed: null });
    ctrl = new AbortController();
    try {
      await intake(
        pid,
        body,
        {
          "message.delta": ({ text }) => live(pid) && useChat.setState({ draft: (useChat.getState().draft ?? "") + text }),
          message: (m) => {
            if (!live(pid)) return;
            const msgs = [...useChat.getState().messages];
            if (m.role === "user") {
              // The server echoes the person's turn; keep our wording, adopt its id.
              let i = -1;
              for (let k = msgs.length - 1; k >= 0; k--) if (msgs[k].id.startsWith("local-")) { i = k; break; }
              if (i >= 0) msgs[i] = { ...m, text: msgs[i].text };
              else if (!msgs.some((x) => x.id === m.id)) msgs.push(m);
              useChat.setState({ messages: msgs });
              return;
            }
            useChat.setState({ messages: [...msgs.filter((x) => x.id !== m.id), m], draft: null });
          },
          brief: ({ brief, envelope }) => live(pid) && patchProject(pid, { brief, envelope }),
          "intake.complete": ({ brief, envelope }) => {
            if (!live(pid)) return;
            patchProject(pid, (p) => ({ brief, envelope, stage: p.stage === "setup" ? "concepts" : p.stage }));
          },
        },
        { signal: ctrl.signal, idleTimeoutMs: 90_000 },
      );
    } catch (e) {
      if (isAbortError(e) || !live(pid)) return;
      useChat.setState({ failed: body, autopilot: false });
      notify.error("Naqsha couldn't reply", e, { label: "Try again", run: () => void chat.send(pid, body) });
    } finally {
      if (live(pid)) {
        const draft = useChat.getState().draft;
        if (draft && draft.trim()) {
          useChat.setState({ messages: [...useChat.getState().messages, { id: lid(), role: "assistant", text: draft, created_at: new Date().toISOString() }] });
        }
        useChat.setState({ busy: false, draft: null });
        void refreshProject(pid);
      }
    }
  },

  setPreview(preview: PlotPreview | null) {
    useChat.setState({ preview });
  },

  stopAutopilot() {
    useChat.setState({ autopilot: false });
  },
};
