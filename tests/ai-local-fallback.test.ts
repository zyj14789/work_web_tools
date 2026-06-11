import { describe, expect, it } from 'vitest';
import { AIEngine } from '@app/ai';
import type { DOMSnapshot } from '@app/ai/types';

function makeSnapshot(): DOMSnapshot {
  return {
    url: 'https://ads.example.com/report?range=7d',
    title: '投放报表',
    timestamp: Date.now(),
    tables: [
      {
        selector: 'table.report',
        headers: ['计划名称', '状态', '曝光', '点击', 'CTR', '消耗', '转化量', 'CPA'],
        rowCount: 2,
        sampleRows: [
          ['计划A', '投放中', '1,000', '20', '2%', '100', '5', '20'],
          ['计划B', '投放中', '2,000', '30', '1.5%', '150', '3', '50'],
        ],
      },
    ],
    charts: [],
    forms: [],
    keyTexts: ['近7天', '曝光', '点击率', '转化成本'],
    metadata: {
      url: 'https://ads.example.com/report?range=7d',
      title: '投放报表',
      platform: '测试广告平台',
      lastModified: '',
    },
  };
}

describe('AIEngine local fallback', () => {
  it('understands report pages without an API key', async () => {
    const engine = new AIEngine({ apiKey: '' });
    const understanding = await engine.understandPage(makeSnapshot());

    expect(understanding.pageType).toBe('report');
    expect(understanding.platform).toBe('测试广告平台');
    expect(understanding.keyMetrics).toContain('CTR');
    expect(understanding.templateHash).toBeTruthy();
  });

  it('extracts metrics and campaign samples without an API key', async () => {
    const engine = new AIEngine({ apiKey: '' });
    const snapshot = makeSnapshot();
    const understanding = await engine.understandPage(snapshot);
    const extracted = await engine.extractData(snapshot, understanding);

    expect(extracted.metrics.find(metric => metric.name === '曝光')?.value).toBe(3000);
    expect(extracted.metrics.find(metric => metric.name === 'CTR')?.value).toBe(1.75);
    expect(extracted.metrics.find(metric => metric.name === '消耗')?.value).toBe(250);
    expect(extracted.campaigns).toHaveLength(2);
  });
});
