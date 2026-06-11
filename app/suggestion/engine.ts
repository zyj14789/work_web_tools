import type { ExtractedData, DataPoint, AnomalyResult, Suggestion, UserAction, UserSettings } from '../ai/types';
import { AIEngine } from '../ai';
import { MemorySystem } from '../memory';
import { detectAnomalies } from './anomaly-detector';
import { analyzeEfficiency } from './efficiency-analyzer';
import { generateStrategyAdvice } from './strategy-advisor';
import { SuggestionScheduler } from './scheduler';
import type { SuggestionContext } from './types';
import { logger } from '../utils/logger';

export class SuggestionEngine {
  private aiEngine: AIEngine;
  private memory: MemorySystem;
  private scheduler: SuggestionScheduler;

  constructor(aiEngine: AIEngine, memory: MemorySystem) {
    this.aiEngine = aiEngine;
    this.memory = memory;
    this.scheduler = new SuggestionScheduler();
  }

  async processPageData(
    currentData: ExtractedData,
    historyData: DataPoint[],
    userActions: UserAction[],
    settings?: UserSettings,
  ): Promise<Suggestion[]> {
    const allSuggestions: Suggestion[] = [];

    if (settings && !settings.suggestionsEnabled) {
      logger.debug('Suggestions disabled by user settings');
      return allSuggestions;
    }

    try {
      const anomalies = settings?.anomalyAlertsEnabled === false
        ? []
        : detectAnomalies(currentData, historyData, this.resolveThresholds(settings));
      if (anomalies.length > 0) {
        logger.info(`Detected ${anomalies.length} anomalies`);

        const anomalySuggestions = this.convertAnomaliesToSuggestions(anomalies);
        for (const s of anomalySuggestions) {
          if (this.scheduler.shouldSend(s)) {
            this.scheduler.recordSent(s);
            allSuggestions.push(s);
          }
        }

        const patterns = await this.memory.user.getPatterns();
        const userSettings = settings || await this.memory.user.getMemory().then(m => ({
          ...m.customThresholds as Record<string, number>,
        })) as UserSettings;

        const context: SuggestionContext = {
          currentData,
          historyData,
          userActions,
          patterns,
          settings: userSettings,
        };

        const aiSuggestions = settings?.strategyAdviceEnabled === false
          ? []
          : await this.aiEngine.generateSuggestions(anomalies, context);
        for (const s of aiSuggestions) {
          if (this.scheduler.shouldSend(s)) {
            this.scheduler.recordSent(s);
            allSuggestions.push(s);
          }
        }
      }

      if (settings?.efficiencyTipsEnabled !== false) {
        const efficiencySuggestions = analyzeEfficiency(userActions);
        for (const s of efficiencySuggestions) {
          if (this.scheduler.shouldSend(s)) {
            this.scheduler.recordSent(s);
            allSuggestions.push(s);
          }
        }
      }

      if (settings?.strategyAdviceEnabled !== false) {
        const strategySuggestions = generateStrategyAdvice(currentData, anomalies, historyData);
        for (const s of strategySuggestions) {
          if (this.scheduler.shouldSend(s)) {
            this.scheduler.recordSent(s);
            allSuggestions.push(s);
          }
        }
      }

      const pendingReady = this.scheduler.getPendingReady();
      allSuggestions.push(...pendingReady);

    } catch (error) {
      logger.error('SuggestionEngine.processPageData failed', error);
    }

    return this.sortByPriority(allSuggestions);
  }

  private convertAnomaliesToSuggestions(anomalies: AnomalyResult[]): Suggestion[] {
    return anomalies.map(a => ({
      id: a.id,
      type: 'anomaly' as const,
      priority: a.severity,
      title: a.title,
      description: a.description,
      confidence: a.confidence,
      relatedData: a,
      createdAt: a.timestamp,
    }));
  }

  private sortByPriority(suggestions: Suggestion[]): Suggestion[] {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return suggestions.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
    );
  }

  getScheduler(): SuggestionScheduler {
    return this.scheduler;
  }

  private resolveThresholds(settings?: UserSettings): Partial<UserSettings['anomalyThresholds']> {
    if (!settings?.anomalyThresholds) return {};

    const multiplier = settings.sensitivity === 'low'
      ? 1.35
      : settings.sensitivity === 'high'
        ? 0.75
        : 1;

    return {
      ctrDropPercent: settings.anomalyThresholds.ctrDropPercent * multiplier,
      costSpikePercent: settings.anomalyThresholds.costSpikePercent * multiplier,
      cpaSurgePercent: settings.anomalyThresholds.cpaSurgePercent * multiplier,
      conversionDropPercent: settings.anomalyThresholds.conversionDropPercent * multiplier,
    };
  }
}
