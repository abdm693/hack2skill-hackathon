import { create } from "zustand";
import type { Envelope } from "@contracts/api-types";

/** Live preview while the user is still editing the plot widget (before it is sent). */
export interface PlotPreview { width: number; depth: number; corner: boolean; envelope: Envelope | null }

export const useSetupUI = create<{ preview: PlotPreview | null; setPreview(p: PlotPreview | null): void }>((set) => ({
  preview: null,
  setPreview: (preview) => set({ preview }),
}));
