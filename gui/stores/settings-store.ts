import { createStore } from 'zustand/vanilla';
import type { UserSettings } from '../../app/ai/types';
import { createMessage, MessageType, sendMessage } from '../../interface/messaging';

interface SettingsState {
  settings: UserSettings;
  loading: boolean;
  error: string | null;
}

const defaultSettings: UserSettings = {
  apiKey: '',
  allowedDomains: [],
  suggestionsEnabled: true,
  anomalyAlertsEnabled: true,
  efficiencyTipsEnabled: true,
  strategyAdviceEnabled: true,
  checkFrequency: 'realtime',
  sensitivity: 'medium',
  anomalyThresholds: {
    ctrDropPercent: 30,
    costSpikePercent: 50,
    cpaSurgePercent: 50,
    conversionDropPercent: 40,
  },
  theme: 'light',
  language: 'zh',
};

export const settingsStore = createStore<SettingsState & {
  loadSettings: () => Promise<void>;
  saveSettings: (settings: Partial<UserSettings>) => Promise<void>;
  testApiKey: (apiKey: string) => Promise<{ success: boolean; message: string }>;
  setError: (error: string | null) => void;
}>((set, get) => ({
  settings: defaultSettings,
  loading: false,
  error: null,

  loadSettings: async () => {
    set({ loading: true, error: null });
    try {
      const response = await sendMessage(
        createMessage(MessageType.GET_SETTINGS, undefined, 'popup'),
      );
      if (response.success && response.data) {
        set({ settings: response.data as UserSettings, loading: false });
      } else {
        set({ loading: false, error: response.error || '加载设置失败' });
      }
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },

  saveSettings: async (partial: Partial<UserSettings>) => {
    set({ loading: true, error: null });
    try {
      const current = get().settings;
      const updated = { ...current, ...partial };
      const response = await sendMessage(
        createMessage(MessageType.UPDATE_SETTINGS, updated, 'popup'),
      );
      if (response.success) {
        set({ settings: updated, loading: false });
      } else {
        set({ loading: false, error: response.error || '保存设置失败' });
      }
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },

  testApiKey: async (apiKey: string) => {
    try {
      const response = await sendMessage(
        createMessage(MessageType.TEST_API_KEY, { apiKey }, 'popup'),
      );
      if (response.success && response.data) {
        return response.data as { success: boolean; message: string };
      }
      return { success: false, message: response.error || '测试失败' };
    } catch (error) {
      return { success: false, message: String(error) };
    }
  },

  setError: (error: string | null) => set({ error }),
}));
