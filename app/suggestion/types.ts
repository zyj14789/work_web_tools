import type { SuggestionType, SuggestionPriority, Suggestion, ExtractedData, DataPoint, UserAction, Pattern } from '../ai/types';
import type { UserSettings } from '../ai/types';

export interface SuggestionTrigger {
  type: SuggestionType;
  priority: SuggestionPriority;
  cooldown: number;
  maxPerDay: number;
}

export interface SuggestionContext {
  currentData: ExtractedData | null;
  historyData: DataPoint[];
  userActions: UserAction[];
  patterns: Pattern[];
  settings: UserSettings;
}

export interface PendingSuggestion {
  suggestion: Suggestion;
  readyAt: number;
}

export const DEFAULT_TRIGGERS: SuggestionTrigger[] = [
  { type: 'anomaly', priority: 'high', cooldown: 5 * 60 * 1000, maxPerDay: 50 },
  { type: 'anomaly', priority: 'medium', cooldown: 10 * 60 * 1000, maxPerDay: 30 },
  { type: 'anomaly', priority: 'low', cooldown: 30 * 60 * 1000, maxPerDay: 20 },
  { type: 'efficiency', priority: 'medium', cooldown: 15 * 60 * 1000, maxPerDay: 15 },
  { type: 'opportunity', priority: 'low', cooldown: 20 * 60 * 1000, maxPerDay: 10 },
  { type: 'strategy', priority: 'medium', cooldown: 30 * 60 * 1000, maxPerDay: 5 },
];
