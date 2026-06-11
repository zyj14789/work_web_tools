import type { StorageAdapter, CloudConfig } from './adapter';
import { LocalStorageAdapter } from './local-adapter';
import { CloudStorageAdapter } from './cloud-adapter';
import { logger } from '../utils/logger';

export type StorageMode = 'local' | 'cloud';

export class StorageManager {
  private adapter: StorageAdapter;
  private mode: StorageMode;

  constructor(mode: StorageMode = 'local', config?: CloudConfig) {
    this.mode = mode;
    this.adapter = this.createAdapter(mode, config);
    logger.info(`StorageManager initialized in ${mode} mode`);
  }

  private createAdapter(mode: StorageMode, config?: CloudConfig): StorageAdapter {
    switch (mode) {
      case 'local':
        return new LocalStorageAdapter();
      case 'cloud':
        if (!config) {
          logger.warn('Cloud config not provided, falling back to local storage');
          return new LocalStorageAdapter();
        }
        return new CloudStorageAdapter(config);
      default:
        return new LocalStorageAdapter();
    }
  }

  getAdapter(): StorageAdapter {
    return this.adapter;
  }

  getMode(): StorageMode {
    return this.mode;
  }

  switchAdapter(mode: StorageMode, config?: CloudConfig): void {
    this.mode = mode;
    this.adapter = this.createAdapter(mode, config);
    logger.info(`StorageManager switched to ${mode} mode`);
  }
}

let defaultManager: StorageManager | null = null;

export function getStorageManager(): StorageManager {
  if (!defaultManager) {
    defaultManager = new StorageManager('local');
  }
  return defaultManager;
}

export function setStorageManager(manager: StorageManager): void {
  defaultManager = manager;
}
