export interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  getAll(): Promise<Record<string, unknown>>;
  clear(): Promise<void>;
  export(scope: ExportScope): Promise<ExportData>;
  import(data: ExportData, strategy: MergeStrategy): Promise<MergeResult>;
}

export type ExportScope = 'all' | 'config' | 'data';

export type ConflictResolution = 'latest' | 'manual' | 'server-wins' | 'client-wins';

export interface MergeStrategy {
  deduplicateBy: string[];
  conflictResolution: ConflictResolution;
}

export interface MergeResult {
  added: number;
  updated: number;
  skipped: number;
  conflicts: number;
}

export interface ExportData {
  formatVersion: string;
  exportedAt: number;
  sourceDeviceId: string;
  userMemory: unknown;
  checksum: string;
  userId?: string;
  syncToken?: string;
}

export interface StorageConfig {
  dbName: string;
  version: number;
}

export interface CloudConfig {
  apiEndpoint: string;
  authToken: string;
}
