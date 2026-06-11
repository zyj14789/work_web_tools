import { describe, it, expect } from 'vitest';
import { detectAnomalies } from '@app/suggestion/anomaly-detector';
import type { ExtractedData, DataPoint } from '@app/ai/types';

function makeData(metrics: Array<{ name: string; value: number }>): ExtractedData {
  return {
    url: 'https://example.com',
    timestamp: Date.now(),
    pageType: 'report',
    metrics,
    dimensions: {},
    campaigns: [],
    rawText: '',
  };
}

function makeDataPoint(metrics: Record<string, number>, daysAgo = 0): DataPoint {
  return {
    id: `dp-${daysAgo}`,
    url: 'https://example.com',
    timestamp: Date.now() - daysAgo * 86400000,
    pageType: 'report',
    platform: 'test',
    metrics,
    snapshot: null as never,
    understanding: null as never,
  };
}

describe('detectAnomalies', () => {
  it('should return empty when history is too short', () => {
    const current = makeData([{ name: 'CTR', value: 1.0 }]);
    const history: DataPoint[] = [
      makeDataPoint({ ctr: 2.0 }, 1),
    ];

    const result = detectAnomalies(current, history);
    expect(result).toHaveLength(0);
  });

  it('should detect CTR drop', () => {
    const current = makeData([{ name: 'CTR', value: 1.0 }]);
    const history: DataPoint[] = [
      makeDataPoint({ ctr: 3.0 }, 1),
      makeDataPoint({ ctr: 3.2 }, 2),
      makeDataPoint({ ctr: 2.9 }, 3),
    ];

    const result = detectAnomalies(current, history);
    expect(result.length).toBeGreaterThan(0);
    const ctrAnomaly = result.find(a => a.type === 'ctr_drop');
    expect(ctrAnomaly).toBeDefined();
    expect(ctrAnomaly!.currentValue).toBe(1.0);
  });

  it('should detect CPA surge', () => {
    const current = makeData([
      { name: 'CPA', value: 150 },
      { name: 'CTR', value: 3.0 },
    ]);
    const history: DataPoint[] = [
      makeDataPoint({ cpa: 50, ctr: 3.0 }, 1),
      makeDataPoint({ cpa: 55, ctr: 3.1 }, 2),
      makeDataPoint({ cpa: 48, ctr: 2.9 }, 3),
    ];

    const result = detectAnomalies(current, history);
    const cpaAnomaly = result.find(a => a.type === 'cpa_surge');
    expect(cpaAnomaly).toBeDefined();
  });

  it('should detect conversion drop', () => {
    const current = makeData([
      { name: '转化量', value: 50 },
      { name: 'CTR', value: 3.0 },
    ]);
    const history: DataPoint[] = [
      makeDataPoint({ '转化量': 200, ctr: 3.0 }, 1),
      makeDataPoint({ '转化量': 190, ctr: 3.1 }, 2),
      makeDataPoint({ '转化量': 210, ctr: 2.9 }, 3),
    ];

    const result = detectAnomalies(current, history);
    const convAnomaly = result.find(a => a.type === 'conversion_drop');
    expect(convAnomaly).toBeDefined();
  });

  it('should return empty when data is normal', () => {
    const current = makeData([
      { name: 'CTR', value: 2.8 },
      { name: 'CPA', value: 52 },
    ]);
    const history: DataPoint[] = [
      makeDataPoint({ ctr: 3.0, cpa: 50 }, 1),
      makeDataPoint({ ctr: 3.2, cpa: 55 }, 2),
      makeDataPoint({ ctr: 2.9, cpa: 48 }, 3),
    ];

    const result = detectAnomalies(current, history);
    expect(result).toHaveLength(0);
  });
});
