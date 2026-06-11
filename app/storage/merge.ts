import type { MergeStrategy, MergeResult } from './adapter';
import { logger } from '../utils/logger';

interface MergeStats {
  added: number;
  updated: number;
  skipped: number;
  conflicts: number;
}

export function mergeData(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
  strategy: MergeStrategy,
): { merged: Record<string, unknown>; stats: MergeStats } {
  const merged: Record<string, unknown> = { ...existing };
  const stats: MergeStats = { added: 0, updated: 0, skipped: 0, conflicts: 0 };

  for (const [key, value] of Object.entries(incoming)) {
    if (!(key in existing)) {
      merged[key] = value;
      stats.added++;
      continue;
    }

    const existingValue = existing[key];
    const isDuplicate = checkDuplicate(existingValue, value, strategy.deduplicateBy);

    if (!isDuplicate) {
      switch (strategy.conflictResolution) {
        case 'latest':
          if (isNewerValue(existingValue, value)) {
            merged[key] = value;
            stats.updated++;
          } else {
            stats.skipped++;
          }
          break;
        case 'client-wins':
          stats.skipped++;
          break;
        case 'server-wins':
          merged[key] = value;
          stats.updated++;
          break;
        case 'manual':
          stats.conflicts++;
          break;
      }
    } else {
      stats.skipped++;
    }
  }

  logger.info('Merge completed', stats);
  return { merged, stats };
}

function checkDuplicate(
  existing: unknown,
  incoming: unknown,
  deduplicateBy: string[],
): boolean {
  if (deduplicateBy.length === 0) return false;

  const existObj = toRecord(existing);
  const incomObj = toRecord(incoming);

  if (!existObj || !incomObj) return false;

  for (const key of deduplicateBy) {
    const existVal = getNestedValue(existObj, key);
    const incomVal = getNestedValue(incomObj, key);

    if (existVal !== undefined && incomVal !== undefined && existVal === incomVal) {
      return true;
    }
  }

  return false;
}

function isNewerValue(existing: unknown, incoming: unknown): boolean {
  const existObj = toRecord(existing);
  const incomObj = toRecord(incoming);

  if (!existObj || !incomObj) return true;

  const existTime = existObj.timestamp ?? existObj.exportedAt ?? existObj.updatedAt ?? 0;
  const incomTime = incomObj.timestamp ?? incomObj.exportedAt ?? incomObj.updatedAt ?? 0;

  return Number(incomTime) > Number(existTime);
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current;
}
