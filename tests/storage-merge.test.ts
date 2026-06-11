import { describe, it, expect } from 'vitest';
import { mergeData } from '@app/storage/merge';
import type { MergeStrategy } from '@app/storage/adapter';

describe('mergeData', () => {
  const defaultStrategy: MergeStrategy = {
    deduplicateBy: ['id'],
    conflictResolution: 'latest',
  };

  it('should add new items when not in existing data', () => {
    const existing = {};
    const incoming = { 'key1': { id: '1', name: 'test', timestamp: 1000 } };

    const { merged, stats } = mergeData(existing, incoming, defaultStrategy);

    expect(stats.added).toBe(1);
    expect(stats.updated).toBe(0);
    expect(stats.skipped).toBe(0);
    expect(merged).toHaveProperty('key1');
  });

  it('should skip duplicates based on deduplicateBy (same key)', () => {
    const existing = { 'key1': { id: '1', name: 'old', timestamp: 1000 } };
    const incoming = { 'key1': { id: '1', name: 'new', timestamp: 2000 } };

    const { stats } = mergeData(existing, incoming, defaultStrategy);

    expect(stats.skipped).toBe(1);
    expect(stats.added).toBe(0);
  });

  it('should update when incoming is newer with latest strategy', () => {
    const existing = { 'key1': { id: '1', name: 'old', timestamp: 1000 } };
    const incoming = { 'key1': { id: '2', name: 'new', timestamp: 2000 } };

    const { stats } = mergeData(existing, incoming, defaultStrategy);

    expect(stats.updated).toBe(1);
  });

  it('should keep existing with client-wins strategy', () => {
    const existing = { 'key1': { id: '1', name: 'old', timestamp: 1000 } };
    const incoming = { 'key1': { id: '2', name: 'new', timestamp: 2000 } };
    const strategy: MergeStrategy = { ...defaultStrategy, conflictResolution: 'client-wins' };

    const { stats } = mergeData(existing, incoming, strategy);

    expect(stats.skipped).toBe(1);
    expect(stats.updated).toBe(0);
  });

  it('should always update with server-wins strategy', () => {
    const existing = { 'key1': { id: '1', name: 'old', timestamp: 2000 } };
    const incoming = { 'key1': { id: '2', name: 'new', timestamp: 1000 } };
    const strategy: MergeStrategy = { ...defaultStrategy, conflictResolution: 'server-wins' };

    const { stats } = mergeData(existing, incoming, strategy);

    expect(stats.updated).toBe(1);
  });

  it('should count conflicts with manual strategy', () => {
    const existing = { 'key1': { id: '1', name: 'old', timestamp: 1000 } };
    const incoming = { 'key1': { id: '2', name: 'new', timestamp: 2000 } };
    const strategy: MergeStrategy = { ...defaultStrategy, conflictResolution: 'manual' };

    const { stats } = mergeData(existing, incoming, strategy);

    expect(stats.conflicts).toBe(1);
    expect(stats.updated).toBe(0);
  });

  it('should handle empty deduplicateBy', () => {
    const existing = { 'key1': { id: '1', timestamp: 2000 } };
    const incoming = { 'key1': { id: '1', timestamp: 1000 } };
    const strategy: MergeStrategy = { deduplicateBy: [], conflictResolution: 'latest' };

    const { stats } = mergeData(existing, incoming, strategy);

    expect(stats.skipped).toBe(1);
  });
});
