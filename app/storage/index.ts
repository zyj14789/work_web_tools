export type {
  StorageAdapter,
  ExportData,
  ExportScope,
  MergeStrategy,
  MergeResult,
  ConflictResolution,
  StorageConfig,
  CloudConfig,
} from './adapter';

export { LocalStorageAdapter } from './local-adapter';
export { CloudStorageAdapter } from './cloud-adapter';
export { StorageManager, getStorageManager, setStorageManager } from './manager';
export type { StorageMode } from './manager';
export { computeChecksum, encryptData, decryptData } from './crypto';
export { mergeData } from './merge';
