/**
 * Ask context (stub for `@/app/shell/ask`, which APP-SHELL owns and had not landed on this branch).
 *
 * The dock's Ask field does the right thing per view: each view registers what Ask means while it is mounted
 * (`useAskContext({ placeholder, onSubmit })`), and the dock reads it with `useAsk()`. At integration, replace
 * imports of "@/app/design/ask" with "@/app/shell/ask" (same two names) and delete this file.
 *
 * The optional fields (suggestions, busy) are additive: a dock that does not know them simply ignores them.
 */
import { useEffect, useRef } from "react";
import { create } from "zustand";

export interface AskContext {
  /** Placeholder for the Ask field, e.g. "Tell Naqsha what to change…". */
  placeholder: string;
  /** Called with the trimmed text when the user sends. */
  onSubmit: (text: string) => void | Promise<unknown>;
  /** Two or three one-tap prompts shown above the field (sending one calls onSubmit with it). */
  suggestions?: string[];
  /** While true the field stays editable but sending is held (Naqsha is still working). */
  busy?: boolean;
}

interface Entry { id: number; ctx: AskContext }

const useAskStore = create<{ stack: Entry[] }>(() => ({ stack: [] }));
let seq = 0;

/** Register what the dock's Ask field does while the calling view is mounted. Pass null to register nothing. */
export function useAskContext(ctx: AskContext | null): void {
  const latest = useRef(ctx);
  latest.current = ctx;
  const id = useRef(0);
  const active = !!ctx;
  const placeholder = ctx?.placeholder ?? "";
  const suggestions = (ctx?.suggestions ?? []).join("\u0001");
  const busy = !!ctx?.busy;

  useEffect(() => {
    if (!active) return;
    const myId = ++seq;
    id.current = myId;
    useAskStore.setState((s) => ({ stack: [...s.stack, { id: myId, ctx: snapshot() }] }));
    return () => useAskStore.setState((s) => ({ stack: s.stack.filter((e) => e.id !== myId) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active) return;
    useAskStore.setState((s) => ({ stack: s.stack.map((e) => (e.id === id.current ? { id: e.id, ctx: snapshot() } : e)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, placeholder, suggestions, busy]);

  function snapshot(): AskContext {
    const c = latest.current;
    return {
      placeholder: c?.placeholder ?? "",
      suggestions: c?.suggestions,
      busy: c?.busy,
      onSubmit: (text: string) => latest.current?.onSubmit(text),
    };
  }
}

/** The Ask context of the view on screen (the most recent registration), or null. */
export function useAsk(): AskContext | null {
  return useAskStore((s) => s.stack[s.stack.length - 1]?.ctx ?? null);
}
