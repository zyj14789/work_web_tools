import { useSyncExternalStore } from 'react';
import { suggestionsStore } from '../stores/suggestions-store';
import type { Suggestion } from '../../app/ai/types';

export function useSuggestions(): {
  suggestions: Suggestion[];
  loading: boolean;
  error: string | null;
  loadSuggestions: () => void;
  dismissSuggestion: (id: string) => void;
  clearSuggestions: () => void;
} {
  const state = useSyncExternalStore(
    suggestionsStore.subscribe,
    () => suggestionsStore.getState(),
  );

  return {
    suggestions: state.suggestions,
    loading: state.loading,
    error: state.error,
    loadSuggestions: () => state.loadSuggestions(),
    dismissSuggestion: (id: string) => state.dismissSuggestion(id),
    clearSuggestions: () => state.clearSuggestions(),
  };
}
