import { useEffect } from 'react';
import type { ChromeMessage } from '../../interface/messaging';
import { MessageType } from '../../interface/messaging';
import type { ActivityLogEntry, ThinkingProcess, AIConversationEntry } from '../../app/ai/types';
import { suggestionsStore } from '../stores/suggestions-store';
import { activityLogStore } from '../stores/activity-log-store';

export function useChromeMessage(): void {
  useEffect(() => {
    const listener = (message: ChromeMessage) => {
      switch (message.type) {
        case MessageType.SUGGESTIONS_UPDATED: {
          const suggestions = message.payload as Array<{ id: string }>;
          if (Array.isArray(suggestions)) {
            suggestionsStore.getState().addSuggestions(suggestions as never);
          }
          break;
        }
        case MessageType.ACTIVITY_LOG: {
          const entry = message.payload as ActivityLogEntry;
          if (entry) {
            activityLogStore.getState().addLog(entry);
          }
          break;
        }
        case MessageType.THINKING_UPDATE: {
          const process = message.payload as ThinkingProcess;
          if (process) {
            activityLogStore.getState().updateThinking(process);
          }
          break;
        }
        case MessageType.AI_CONVERSATION: {
          const conv = message.payload as AIConversationEntry;
          if (conv) {
            activityLogStore.getState().addConversation(conv);
          }
          break;
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, []);
}
