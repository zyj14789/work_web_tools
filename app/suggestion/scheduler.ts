import type { Suggestion } from '../ai/types';
import type { SuggestionTrigger, PendingSuggestion } from './types';
import { DEFAULT_TRIGGERS } from './types';
import { logger } from '../utils/logger';

export class SuggestionScheduler {
  private triggers: SuggestionTrigger[];
  private pending: PendingSuggestion[] = [];
  private dailyCounts: Map<string, number> = new Map();
  private lastSentTime: Map<string, number> = new Map();
  private dailyResetTime: number;

  constructor(triggers?: SuggestionTrigger[]) {
    this.triggers = triggers || DEFAULT_TRIGGERS;
    this.dailyResetTime = Date.now();
  }

  shouldSend(suggestion: Suggestion): boolean {
    this.checkDailyReset();

    const trigger = this.findTrigger(suggestion);
    if (!trigger) return true;

    const typeKey = `${suggestion.type}:${suggestion.priority}`;

    const dailyCount = this.dailyCounts.get(typeKey) || 0;
    if (dailyCount >= trigger.maxPerDay) {
      logger.debug(`Suggestion throttled: daily limit reached for ${typeKey}`);
      return false;
    }

    const lastSent = this.lastSentTime.get(typeKey) || 0;
    const cooldownRemaining = trigger.cooldown - (Date.now() - lastSent);
    if (cooldownRemaining > 0) {
      this.queuePending(suggestion, cooldownRemaining);
      return false;
    }

    return true;
  }

  recordSent(suggestion: Suggestion): void {
    const typeKey = `${suggestion.type}:${suggestion.priority}`;
    this.dailyCounts.set(typeKey, (this.dailyCounts.get(typeKey) || 0) + 1);
    this.lastSentTime.set(typeKey, Date.now());
  }

  getPendingReady(): Suggestion[] {
    const now = Date.now();
    const ready: Suggestion[] = [];
    const remaining: PendingSuggestion[] = [];

    for (const p of this.pending) {
      if (p.readyAt <= now) {
        if (this.shouldSend(p.suggestion)) {
          ready.push(p.suggestion);
        }
      } else {
        remaining.push(p);
      }
    }

    this.pending = remaining;
    return ready;
  }

  getStats(): { pending: number; sentToday: Record<string, number> } {
    this.checkDailyReset();
    return {
      pending: this.pending.length,
      sentToday: Object.fromEntries(this.dailyCounts.entries()),
    };
  }

  reset(): void {
    this.pending = [];
    this.dailyCounts.clear();
    this.lastSentTime.clear();
    this.dailyResetTime = Date.now();
    logger.info('SuggestionScheduler reset');
  }

  private findTrigger(suggestion: Suggestion): SuggestionTrigger | undefined {
    return this.triggers.find(
      t => t.type === suggestion.type && t.priority === suggestion.priority,
    );
  }

  private queuePending(suggestion: Suggestion, cooldownRemaining: number): void {
    this.pending.push({
      suggestion,
      readyAt: Date.now() + cooldownRemaining,
    });
  }

  private checkDailyReset(): void {
    const now = Date.now();
    if (now - this.dailyResetTime > 24 * 60 * 60 * 1000) {
      this.dailyCounts.clear();
      this.dailyResetTime = now;
    }
  }
}
