/** Floating pieces of the project shell that are open (sheets, dialogs). */
import { create } from "zustand";

export type LeftPanel = "chat" | null;
export type RightPanel = "comments" | null;

interface ShellState {
  left: LeftPanel;
  right: RightPanel;
  share: boolean;
  /** The comments sheet opens on "Apply N open comments" (from the Next pill). */
  applyMode: boolean;
  /** A comment to scroll to and highlight in the sheet. */
  focusComment: string | null;
  toggleChat(open?: boolean): void;
  openComments(opts?: { apply?: boolean; focus?: string | null }): void;
  closeComments(): void;
  setShare(open: boolean): void;
  setApplyMode(on: boolean): void;
  reset(): void;
}

export const useShell = create<ShellState>((set, get) => ({
  left: null,
  right: null,
  share: false,
  applyMode: false,
  focusComment: null,
  toggleChat(open) {
    const next = open ?? get().left !== "chat";
    set({ left: next ? "chat" : null });
  },
  openComments({ apply = false, focus = null } = {}) {
    set({ right: "comments", applyMode: apply, focusComment: focus });
  },
  closeComments() {
    set({ right: null, applyMode: false, focusComment: null });
  },
  setShare(open) {
    set({ share: open });
  },
  setApplyMode(on) {
    set({ applyMode: on });
  },
  reset() {
    set({ left: null, right: null, share: false, applyMode: false, focusComment: null });
  },
}));
