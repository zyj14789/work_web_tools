import { createStore } from 'zustand/vanilla';
import type { Suggestion } from '../../app/ai/types';
import { createMessage, MessageType, sendMessage } from '../../interface/messaging';

interface SuggestionsState {
  suggestions: Suggestion[];
  loading: boolean;
  error: string | null;
}

export const suggestionsStore = createStore<SuggestionsState & {
  loadSuggestions: () => Promise<void>;
  dismissSuggestion: (id: string) => Promise<void>;
  addSuggestions: (suggestions: Suggestion[]) => void;
  clearSuggestions: () => void;
}>((set, get) => ({
  suggestions: [],
  loading: false,
  error: null,

  loadSuggestions: async () => {
    set({ loading: true, error: null });
    try {
      const response = await sendMessage(
        createMessage(MessageType.GET_SUGGESTIONS, undefined, 'sidepanel'),
      );
      if (response.success) {
        set({ suggestions: (response.data as Suggestion[]) || [], loading: false });
      } else {
        set({ loading: false, error: response.error || '加载建议失败' });
      }
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },

  dismissSuggestion: async (id: string) => {
    try {
      await sendMessage(
        createMessage(MessageType.DISMISS_SUGGESTION, { id }, 'sidepanel'),
      );
      set(state => ({
        suggestions: state.suggestions.filter(s => s.id !== id),
      }));
    } catch (error) {
      set({ error: String(error) });
    }
  },

  addSuggestions: (suggestions: Suggestion[]) => {
    set(state => {
      const existing = new Set(state.suggestions.map(s => s.id));
      const newItems = suggestions.filter(s => !existing.has(s.id));
      if (newItems.length === 0) return state;
      return { suggestions: [...newItems, ...state.suggestions].slice(0, 100) };
    });
  },

  clearSuggestions: () => set({ suggestions: [] }),
}));
