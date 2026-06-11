import { createStore } from 'zustand/vanilla';

interface MemoryState {
  dataPointCount: number;
  patternCount: number;
  lastSyncAt: number | null;
  loading: boolean;
}

export const memoryStore = createStore<MemoryState & {
  updateStats: (stats: Partial<MemoryState>) => void;
}>((set) => ({
  dataPointCount: 0,
  patternCount: 0,
  lastSyncAt: null,
  loading: false,

  updateStats: (stats: Partial<MemoryState>) => set(stats),
}));
