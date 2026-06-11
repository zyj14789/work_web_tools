import type { StorageAdapter, ExportData, ExportScope, MergeStrategy, MergeResult, CloudConfig } from './adapter';
import { logger } from '../utils/logger';

export class CloudStorageAdapter implements StorageAdapter {
  private apiEndpoint: string;
  private authToken: string;

  constructor(config: CloudConfig) {
    this.apiEndpoint = config.apiEndpoint;
    this.authToken = config.authToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.apiEndpoint}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Cloud API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await this.request<{ data: T }>(`/storage/${encodeURIComponent(key)}`);
      return result.data ?? null;
    } catch (error) {
      logger.error(`CloudStorageAdapter.get failed for key: ${key}`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await this.request(`/storage/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify({ data: value }),
    });
  }

  async remove(key: string): Promise<void> {
    await this.request(`/storage/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
  }

  async getAll(): Promise<Record<string, unknown>> {
    const result = await this.request<{ items: Record<string, unknown> }>('/storage');
    return result.items ?? {};
  }

  async clear(): Promise<void> {
    await this.request('/storage', { method: 'DELETE' });
  }

  async export(scope: ExportScope): Promise<ExportData> {
    const result = await this.request<ExportData>(`/export?scope=${scope}`);
    return result;
  }

  async import(data: ExportData, strategy: MergeStrategy): Promise<MergeResult> {
    const result = await this.request<MergeResult>('/import', {
      method: 'POST',
      body: JSON.stringify({ data, strategy }),
    });
    return result;
  }
}
