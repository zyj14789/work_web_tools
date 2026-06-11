// ============================================================
// AI广告投放助手 - 记忆系统类型定义
// ============================================================

import type { DataPoint, UserAction, Pattern, ExtractedData } from '../ai/types';

export interface SessionMemory {
  pageHistory: PageView[];
  actionSequence: UserAction[];
  extractedData: ExtractedData[];
}

export interface PageView {
  url: string;
  title: string;
  entryTime: number;
  exitTime?: number;
  duration?: number;
  actions: UserAction[];
}

export interface UserMemory {
  deviceId: string;
  frequentOperations: string[];
  preferredMetrics: string[];
  customThresholds: Record<string, number>;
  accumulatedData: DataPoint[];
  patterns: Pattern[];
  lastSyncAt: number;
  syncVersion: number;
}

export interface GlobalKnowledge {
  version: string;
  industryBenchmarks: IndustryBenchmarks;
  bestPractices: BestPractice[];
  updatedAt: number;
  source: 'builtin' | 'synced';
}

export interface IndustryBenchmarks {
  ctr: { low: number; avg: number; high: number };
  cpa: { low: number; avg: number; high: number };
  conversionRate: { low: number; avg: number; high: number };
  roi: { low: number; avg: number; high: number };
}

export interface BestPractice {
  id: string;
  category: string;
  title: string;
  description: string;
  applicableWhen: string;
  expectedImprovement: string;
}
