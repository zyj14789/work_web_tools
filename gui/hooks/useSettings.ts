import { useSyncExternalStore } from 'react';
import { settingsStore } from '../stores/settings-store';
import type { UserSettings } from '../../app/ai/types';

export function useSettings(): UserSettings & {
  loading: boolean;
  error: string | null;
  loadSettings: () => void;
  saveSettings: (partial: Partial<UserSettings>) => Promise<void>;
  testApiKey: (apiKey: string) => Promise<{ success: boolean; message: string }>;
} {
  const state = useSyncExternalStore(
    settingsStore.subscribe,
    () => settingsStore.getState(),
  );

  return {
    ...state.settings,
    loading: state.loading,
    error: state.error,
    loadSettings: () => state.loadSettings(),
    saveSettings: (partial: Partial<UserSettings>) => state.saveSettings(partial),
    testApiKey: (apiKey: string) => state.testApiKey(apiKey),
  };
}
