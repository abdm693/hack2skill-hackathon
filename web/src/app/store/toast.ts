import { create } from "zustand";
import { errorMessage, isAbortError } from "@/api/client";

export type ToastTone = "error" | "success" | "info";

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  action?: { label: string; run: () => void };
}

interface ToastState {
  toasts: Toast[];
  push(t: Omit<Toast, "id">, ttlMs?: number): number;
  dismiss(id: number): void;
}

let seq = 1;

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push(t, ttlMs = 5200) {
    const id = seq++;
    set({ toasts: [...get().toasts.slice(-3), { ...t, id }] });
    if (ttlMs > 0) setTimeout(() => get().dismiss(id), ttlMs);
    return id;
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  error(title: string, e?: unknown, action?: Toast["action"]) {
    if (e && isAbortError(e)) return;
    useToasts.getState().push({ tone: "error", title, body: e ? errorMessage(e) : undefined, action }, 8000);
  },
  success(title: string, body?: string) {
    useToasts.getState().push({ tone: "success", title, body });
  },
  info(title: string, body?: string) {
    useToasts.getState().push({ tone: "info", title, body });
  },
};
