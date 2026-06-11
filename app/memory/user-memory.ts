import type { DataPoint, Pattern, UserAction, UserSettings } from '../ai/types';
import type { UserMemory } from './types';
import { getStorageManager } from '../storage/manager';
import { logger } from '../utils/logger';
import { generateId } from '../utils/throttle';

const MEMORY_PREFIX = 'userMemory';
const PATTERN_PREFIX = 'patterns';

export class UserMemoryManager {
  private cache: UserMemory | null = null;

  async initialize(deviceId?: string): Promise<UserMemory> {
    const storage = getStorageManager().getAdapter();

    let memory = await storage.get<UserMemory>(`${MEMORY_PREFIX}:main`);
    if (!memory) {
      memory = {
        deviceId: deviceId || generateId(),
        frequentOperations: [],
        preferredMetrics: [],
        customThresholds: {},
        accumulatedData: [],
        patterns: [],
        lastSyncAt: 0,
        syncVersion: 1,
      };
      await this.persist(memory);
    }

    this.cache = memory;
    return memory;
  }

  async addDataPoint(dataPoint: DataPoint): Promise<void> {
    const memory = await this.getMemory();
    memory.accumulatedData.push(dataPoint);

    if (memory.accumulatedData.length > 1000) {
      memory.accumulatedData = memory.accumulatedData.slice(-500);
    }

    await this.persist(memory);
  }

  async getDataPoints(limit = 100, offset = 0): Promise<DataPoint[]> {
    const memory = await this.getMemory();
    return memory.accumulatedData.slice(
      Math.max(0, memory.accumulatedData.length - offset - limit),
      memory.accumulatedData.length - offset,
    );
  }

  async getRecentDataPoints(days = 7): Promise<DataPoint[]> {
    const memory = await this.getMemory();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return memory.accumulatedData.filter(dp => dp.timestamp >= cutoff);
  }

  async addPattern(pattern: Pattern): Promise<void> {
    const memory = await this.getMemory();
    const existingIdx = memory.patterns.findIndex(p => p.id === pattern.id);
    if (existingIdx >= 0) {
      memory.patterns[existingIdx] = pattern;
    } else {
      memory.patterns.push(pattern);
    }
    await this.persist(memory);
  }

  async getPatterns(): Promise<Pattern[]> {
    const memory = await this.getMemory();
    return memory.patterns;
  }

  async updatePreferredMetrics(metrics: string[]): Promise<void> {
    const memory = await this.getMemory();
    memory.preferredMetrics = metrics;
    await this.persist(memory);
  }

  async updateFrequentOperations(operations: string[]): Promise<void> {
    const memory = await this.getMemory();
    memory.frequentOperations = operations;
    await this.persist(memory);
  }

  async updateSyncInfo(syncVersion: number): Promise<void> {
    const memory = await this.getMemory();
    memory.lastSyncAt = Date.now();
    memory.syncVersion = syncVersion;
    await this.persist(memory);
  }

  async getMemory(): Promise<UserMemory> {
    if (this.cache) return this.cache;
    return this.initialize();
  }

  async clearData(): Promise<void> {
    const memory = await this.getMemory();
    memory.accumulatedData = [];
    memory.patterns = [];
    await this.persist(memory);
    logger.info('User memory data cleared');
  }

  private async persist(memory: UserMemory): Promise<void> {
    this.cache = memory;
    const storage = getStorageManager().getAdapter();
    await storage.set<UserMemory>(`${MEMORY_PREFIX}:main`, memory);
  }
}
