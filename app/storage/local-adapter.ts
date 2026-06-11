import { openDB, type IDBPDatabase } from 'idb';
import type { StorageAdapter, ExportData, ExportScope, MergeStrategy, MergeResult, StorageConfig } from './adapter';
import { logger } from '../utils/logger';
import { generateId, hashString } from '../utils/throttle';
import { validateExportData } from '../utils/validator';
import { mergeData } from './merge';
import { computeChecksum } from './crypto';

const DEFAULT_CONFIG: StorageConfig = {
  dbName: 'ai-ad-assistant',
  version: 1,
};

const STORE_NAMES = {
  USER_MEMORY: 'userMemory',
  PATTERNS: 'patterns',
  SETTINGS: 'settings',
  PAGE_TEMPLATES: 'pageTemplates',
  SYNC_META: 'syncMeta',
};

export class LocalStorageAdapter implements StorageAdapter {
  private db: IDBPDatabase | null = null;
  private config: StorageConfig;

  constructor(config?: Partial<StorageConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private async getDB(): Promise<IDBPDatabase> {
    if (this.db) return this.db;
    this.db = await openDB(this.config.dbName, this.config.version, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAMES.USER_MEMORY)) {
          db.createObjectStore(STORE_NAMES.USER_MEMORY);
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.PATTERNS)) {
          db.createObjectStore(STORE_NAMES.PATTERNS);
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.SETTINGS)) {
          db.createObjectStore(STORE_NAMES.SETTINGS);
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.PAGE_TEMPLATES)) {
          db.createObjectStore(STORE_NAMES.PAGE_TEMPLATES);
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.SYNC_META)) {
          db.createObjectStore(STORE_NAMES.SYNC_META);
        }
      },
    });
    return this.db;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      const storeName = this.resolveStore(key);
      if (!storeName) {
        for (const name of Object.values(STORE_NAMES)) {
          const result = await db.get(name, key);
          if (result !== undefined) return result as T;
        }
        return null;
      }
      const result = await db.get(storeName, key);
      return result !== undefined ? (result as T) : null;
    } catch (error) {
      logger.error(`LocalStorageAdapter.get failed for key: ${key}`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.getDB();
      const storeName = this.resolveStore(key);
      await db.put(storeName, value, key);
    } catch (error) {
      logger.error(`LocalStorageAdapter.set failed for key: ${key}`, error);
      throw error;
    }
  }

  async remove(key: string): Promise<void> {
    try {
      const db = await this.getDB();
      const storeName = this.resolveStore(key);
      await db.delete(storeName, key);
    } catch (error) {
      logger.error(`LocalStorageAdapter.remove failed for key: ${key}`, error);
      throw error;
    }
  }

  async getAll(): Promise<Record<string, unknown>> {
    try {
      const db = await this.getDB();
      const result: Record<string, unknown> = {};
      for (const storeName of Object.values(STORE_NAMES)) {
        const keys = await db.getAllKeys(storeName);
        for (const key of keys) {
          result[`${storeName}:${String(key)}`] = await db.get(storeName, key);
        }
      }
      return result;
    } catch (error) {
      logger.error('LocalStorageAdapter.getAll failed', error);
      return {};
    }
  }

  async clear(): Promise<void> {
    try {
      const db = await this.getDB();
      for (const storeName of Object.values(STORE_NAMES)) {
        await db.clear(storeName);
      }
      logger.info('LocalStorageAdapter: all data cleared');
    } catch (error) {
      logger.error('LocalStorageAdapter.clear failed', error);
      throw error;
    }
  }

  async export(scope: ExportScope): Promise<ExportData> {
    try {
      const allData = await this.getAll();
      let exportedData: Record<string, unknown>;

      switch (scope) {
        case 'config':
          exportedData = this.filterByPrefix(allData, `${STORE_NAMES.SETTINGS}:`);
          break;
        case 'data':
          exportedData = this.filterByPrefix(allData, `${STORE_NAMES.USER_MEMORY}:`);
          break;
        case 'all':
        default:
          exportedData = allData;
      }

      const memorySnapshot = JSON.stringify(exportedData);
      const checksum = await computeChecksum(memorySnapshot);

      const deviceId = await this.getDeviceId();

      return {
        formatVersion: '1.0.0',
        exportedAt: Date.now(),
        sourceDeviceId: deviceId,
        userMemory: exportedData,
        checksum,
      };
    } catch (error) {
      logger.error('LocalStorageAdapter.export failed', error);
      throw error;
    }
  }

  async import(data: ExportData, strategy: MergeStrategy): Promise<MergeResult> {
    try {
      const validation = validateExportData(data);
      if (!validation.valid) {
        throw new Error(`Invalid export data: ${validation.message}`);
      }

      const memorySnapshot = JSON.stringify(data.userMemory);
      const computedChecksum = await computeChecksum(memorySnapshot);
      if (computedChecksum !== data.checksum) {
        throw new Error('Checksum mismatch: data may be corrupted');
      }

      const existingData = await this.getAll();
      const incomingData = data.userMemory as Record<string, unknown>;
      const { existingMemoryKey, incomingMemoryKey, memoryMerge } = this.mergeUserMemoryRecord(
        existingData,
        incomingData,
        strategy,
      );

      const genericExisting = { ...existingData };
      const genericIncoming = { ...incomingData };
      if (existingMemoryKey) delete genericExisting[existingMemoryKey];
      if (incomingMemoryKey) delete genericIncoming[incomingMemoryKey];

      const mergeResult = mergeData(genericExisting, genericIncoming, strategy);

      if (memoryMerge) {
        mergeResult.merged[memoryMerge.key] = memoryMerge.value;
        mergeResult.stats.added += memoryMerge.stats.added;
        mergeResult.stats.updated += memoryMerge.stats.updated;
        mergeResult.stats.skipped += memoryMerge.stats.skipped;
        mergeResult.stats.conflicts += memoryMerge.stats.conflicts;
      }

      for (const [key, value] of Object.entries(mergeResult.merged)) {
        const storeName = this.extractStoreName(key);
        const storeKey = this.extractKey(key);
        const db = await this.getDB();
        await db.put(storeName, value, storeKey);
      }

      await this.set('syncMeta:lastImport', {
        timestamp: Date.now(),
        sourceDeviceId: data.sourceDeviceId,
        stats: mergeResult.stats,
      });

      logger.info('LocalStorageAdapter.import completed', mergeResult.stats);
      return mergeResult.stats;
    } catch (error) {
      logger.error('LocalStorageAdapter.import failed', error);
      throw error;
    }
  }

  private resolveStore(key: string): string {
    if (key.startsWith('userMemory:')) return STORE_NAMES.USER_MEMORY;
    if (key.startsWith('patterns:')) return STORE_NAMES.PATTERNS;
    if (key.startsWith('settings:')) return STORE_NAMES.SETTINGS;
    if (key.startsWith('pageTemplates:')) return STORE_NAMES.PAGE_TEMPLATES;
    if (key.startsWith('syncMeta:')) return STORE_NAMES.SYNC_META;
    return STORE_NAMES.USER_MEMORY;
  }

  private extractStoreName(fullKey: string): string {
    const colonIndex = fullKey.indexOf(':');
    if (colonIndex === -1) return STORE_NAMES.USER_MEMORY;
    const prefix = fullKey.substring(0, colonIndex);
    const storeMap: Record<string, string> = {
      userMemory: STORE_NAMES.USER_MEMORY,
      patterns: STORE_NAMES.PATTERNS,
      settings: STORE_NAMES.SETTINGS,
      pageTemplates: STORE_NAMES.PAGE_TEMPLATES,
      syncMeta: STORE_NAMES.SYNC_META,
    };
    return storeMap[prefix] || STORE_NAMES.USER_MEMORY;
  }

  private extractKey(fullKey: string): string {
    const colonIndex = fullKey.indexOf(':');
    return colonIndex === -1 ? fullKey : fullKey.substring(colonIndex + 1);
  }

  private filterByPrefix(data: Record<string, unknown>, prefix: string): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key.startsWith(prefix)) {
        result[key] = value;
      }
    }
    return result;
  }

  private async getDeviceId(): Promise<string> {
    let deviceId = await this.get<string>('syncMeta:deviceId');
    if (!deviceId) {
      deviceId = generateId();
      await this.set('syncMeta:deviceId', deviceId);
    }
    return deviceId;
  }

  private mergeUserMemoryRecord(
    existingData: Record<string, unknown>,
    incomingData: Record<string, unknown>,
    strategy: MergeStrategy,
  ): {
    existingMemoryKey?: string;
    incomingMemoryKey?: string;
    memoryMerge?: {
      key: string;
      value: Record<string, unknown>;
      stats: MergeResult;
    };
  } {
    const existingMemoryKey = Object.keys(existingData).find(isUserMemoryMainKey);
    const incomingMemoryKey = Object.keys(incomingData).find(isUserMemoryMainKey);
    if (!incomingMemoryKey) return { existingMemoryKey, incomingMemoryKey };

    const incomingMemory = toRecord(incomingData[incomingMemoryKey]);
    if (!incomingMemory) return { existingMemoryKey, incomingMemoryKey };

    const existingMemory = existingMemoryKey ? toRecord(existingData[existingMemoryKey]) : null;
    if (!existingMemory) {
      return {
        existingMemoryKey,
        incomingMemoryKey,
        memoryMerge: {
          key: incomingMemoryKey,
          value: incomingMemory,
          stats: { added: 1, updated: 0, skipped: 0, conflicts: 0 },
        },
      };
    }

    const dataMerge = mergeArrayByIdentity(
      toArray(existingMemory.accumulatedData),
      toArray(incomingMemory.accumulatedData),
      strategy,
      ['id', 'campaignId+date+metricType', 'url+timestamp+pageType'],
    );
    const patternMerge = mergeArrayByIdentity(
      toArray(existingMemory.patterns),
      toArray(incomingMemory.patterns),
      strategy,
      ['id', 'type+description'],
    );

    const mergedMemory: Record<string, unknown> = {
      ...existingMemory,
      frequentOperations: uniqueStrings([
        ...toStringArray(existingMemory.frequentOperations),
        ...toStringArray(incomingMemory.frequentOperations),
      ]),
      preferredMetrics: uniqueStrings([
        ...toStringArray(existingMemory.preferredMetrics),
        ...toStringArray(incomingMemory.preferredMetrics),
      ]),
      customThresholds: {
        ...toRecord(existingMemory.customThresholds),
        ...toRecord(incomingMemory.customThresholds),
      },
      accumulatedData: dataMerge.items,
      patterns: patternMerge.items,
      lastSyncAt: Date.now(),
      syncVersion: Math.max(
        Number(existingMemory.syncVersion || 1),
        Number(incomingMemory.syncVersion || 1),
      ) + 1,
    };

    return {
      existingMemoryKey,
      incomingMemoryKey,
      memoryMerge: {
        key: existingMemoryKey || incomingMemoryKey,
        value: mergedMemory,
        stats: {
          added: dataMerge.stats.added + patternMerge.stats.added,
          updated: dataMerge.stats.updated + patternMerge.stats.updated,
          skipped: dataMerge.stats.skipped + patternMerge.stats.skipped,
          conflicts: dataMerge.stats.conflicts + patternMerge.stats.conflicts,
        },
      },
    };
  }
}

function isUserMemoryMainKey(key: string): boolean {
  return key === 'userMemory:main' || key.endsWith(':userMemory:main');
}

function mergeArrayByIdentity(
  existing: unknown[],
  incoming: unknown[],
  strategy: MergeStrategy,
  identityRules: string[],
): { items: unknown[]; stats: MergeResult } {
  const stats: MergeResult = { added: 0, updated: 0, skipped: 0, conflicts: 0 };
  const items = [...existing];
  const index = new Map<string, number>();

  items.forEach((item, itemIndex) => {
    const key = getIdentityKey(item, identityRules);
    if (key) index.set(key, itemIndex);
  });

  for (const item of incoming) {
    const key = getIdentityKey(item, identityRules);
    if (!key || !index.has(key)) {
      items.push(item);
      if (key) index.set(key, items.length - 1);
      stats.added++;
      continue;
    }

    const existingIndex = index.get(key)!;
    const existingItem = items[existingIndex];

    switch (strategy.conflictResolution) {
      case 'server-wins':
        items[existingIndex] = item;
        stats.updated++;
        break;
      case 'client-wins':
        stats.skipped++;
        break;
      case 'manual':
        stats.conflicts++;
        break;
      case 'latest':
      default:
        if (isIncomingNewer(existingItem, item)) {
          items[existingIndex] = item;
          stats.updated++;
        } else {
          stats.skipped++;
        }
        break;
    }
  }

  return { items, stats };
}

function getIdentityKey(item: unknown, rules: string[]): string | null {
  const record = toRecord(item);
  if (!record) return null;

  for (const rule of rules) {
    const parts = rule.split('+');
    const values = parts.map(part => record[part]);
    if (values.every(value => value !== undefined && value !== null && value !== '')) {
      return `${rule}:${values.join('|')}`;
    }
  }

  return null;
}

function isIncomingNewer(existing: unknown, incoming: unknown): boolean {
  const existingRecord = toRecord(existing);
  const incomingRecord = toRecord(incoming);
  if (!existingRecord || !incomingRecord) return true;

  const existingTime = Number(
    existingRecord.timestamp ?? existingRecord.updatedAt ?? existingRecord.discoveredAt ?? 0,
  );
  const incomingTime = Number(
    incomingRecord.timestamp ?? incomingRecord.updatedAt ?? incomingRecord.discoveredAt ?? 0,
  );

  return incomingTime >= existingTime;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
