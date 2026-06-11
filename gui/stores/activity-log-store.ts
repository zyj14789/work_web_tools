import { createStore } from 'zustand/vanilla';
import type { ActivityLogEntry, ThinkingProcess, AIConversationEntry } from '../../app/ai/types';
import { createMessage, MessageType, sendMessage } from '../../interface/messaging';

interface ActivityLogState {
  logs: ActivityLogEntry[];
  thinkingProcesses: ThinkingProcess[];
  conversations: AIConversationEntry[];
  latestThinking: ThinkingProcess | null;
  loading: boolean;
}

export const activityLogStore = createStore<ActivityLogState & {
  addLog: (entry: ActivityLogEntry) => void;
  updateThinking: (process: ThinkingProcess) => void;
  addConversation: (conv: AIConversationEntry) => void;
  loadLogs: () => Promise<void>;
  clearLogs: () => Promise<void>;
}>((set) => ({
  logs: [],
  thinkingProcesses: [],
  conversations: [],
  latestThinking: null,
  loading: false,

  addLog: (entry: ActivityLogEntry) => {
    set(state => ({
      logs: [...state.logs.slice(-399), entry],
    }));
  },

  updateThinking: (process: ThinkingProcess) => {
    set(state => {
      const idx = state.thinkingProcesses.findIndex(p => p.id === process.id);
      const updated = idx >= 0
        ? state.thinkingProcesses.map((p, i) => i === idx ? process : p)
        : [...state.thinkingProcesses.slice(-19), process];
      return {
        thinkingProcesses: updated,
        latestThinking: process,
      };
    });
  },

  addConversation: (conv: AIConversationEntry) => {
    set(state => ({
      conversations: [...state.conversations.slice(-99), conv],
    }));
  },

  loadLogs: async () => {
    set({ loading: true });
    try {
      const response = await sendMessage(
        createMessage(MessageType.GET_ACTIVITY_LOGS, undefined, 'sidepanel'),
      );
      if (response.success && response.data) {
        const data = response.data as {
          logs: ActivityLogEntry[];
          thinking: ThinkingProcess[];
          conversations?: AIConversationEntry[];
        };
        set({
          logs: data.logs || [],
          thinkingProcesses: data.thinking || [],
          conversations: data.conversations || [],
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  clearLogs: async () => {
    await sendMessage(
      createMessage(MessageType.CLEAR_ACTIVITY_LOGS, undefined, 'sidepanel'),
    );
    set({ logs: [], thinkingProcesses: [], conversations: [], latestThinking: null });
  },
}));
