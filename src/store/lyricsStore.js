import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useLyricsStore = create(
  persist(
    (set, get) => ({
      cues: [],                     // parsed LRC cues
      meta: {},                     // { ar, ti, by … }
      active: { lineId: null, wordId: null },

      loadLrc: ({ meta, cues }) => set({ meta, cues }),
      clear: () => set({ cues: [], meta: {}, active: { lineId: null, wordId: null } }),

      setActive: (lineId, wordId) =>
        set({ active: { lineId, wordId } }),

      shiftAll: (deltaMs) =>
        set({
          cues: get().cues.map((c) => ({ ...c, ms: c.ms + deltaMs })),
        }),
    }),
    { name: "lyrics-store" }
  )
);
