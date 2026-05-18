import { create } from "zustand";

// Tiny global mirror of the SSE stream state so the TopBar / sub-bars can
// surface a "live" / "reconnecting" pip without prop-drilling from Shell.
export type StreamState = "connecting" | "open" | "closed";

interface Store {
  state: StreamState;
  set: (s: StreamState) => void;
}

export const useOrdersStreamStateStore = create<Store>((set) => ({
  state: "closed",
  set: (state) => set({ state }),
}));
