import type { ExtractedData, DataPoint, AnomalyResult, Suggestion } from '../ai/types';
import { generateId } from '../utils/throttle';

export function generateStrategyAdvice(
  currentData: ExtractedData,
  anomalies: AnomalyResult[],
  historyData: DataPoint[],
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  for (const anomaly of anomalies) {
    const advice = buildAdviceForAnomaly(anomaly, currentData);
    if (advice) {
      suggestions.push(advice);
    }
  }

  const campaignAdvice = analyzeCampaigns(currentData);
  suggestions.push(...campaignAdvice);

  const budgetAdvice = analyzeBudgetAllocation(currentData, historyData);
  suggestions.push(...budgetAdvice);

  return suggestions;
}

function buildAdviceForAnomaly(
  anomaly: AnomalyResult,
  currentData: ExtractedData,
): Suggestion | null {
  const adviceMap: Record<string, { title: string; actionHint: string }> = {
    ctr_drop: {
      title: '建议优化低CTR计划创意',
      actionHint: '更换创意素材，尝试不同风格的图片和文案组合，A/B测试找到最佳方案',
    },
    cost_spike: {
      title: '建议检查消耗异常计划',
      actionHint: '检查出价设置是否有误，确认人群定向范围，考虑设置日预算上限',
    },
    cpa_surge: {
      title: '建议调整高CPA计划出价',
      actionHint: '逐步降低出价5-10%，观察转化量和CPA变化，避免大幅调整导致量级大幅下降',
    },
    conversion_drop: {
      title: '建议排查转化下降原因',
      actionHint: '检查落地页是否正常、转化跟踪代码是否正确、人群定向是否需要更新',
    },
    cost_stagnation: {
      title: '建议检查投放状态',
      actionHint: '确认计划是否被暂停、预算是否耗尽、出价是否过低导致没有曝光',
    },
  };

  const advice = adviceMap[anomaly.type];
  if (!advice) return null;

  return {
    id: generateId(),
    type: 'strategy',
    priority: anomaly.severity,
    title: advice.title,
    description: `基于检测到的"${anomaly.title}"，${advice.actionHint}`,
    confidence: 0.7,
    actionHint: advice.actionHint,
    createdAt: Date.now(),
  };
}

function analyzeCampaigns(currentData: ExtractedData): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const campaigns = currentData.campaigns || [];

  if (campaigns.length === 0) return suggestions;

  const lowCTRCampaigns = campaigns.filter(c => {
    const ctr = c.metrics.find(
      m => m.name.toLowerCase().includes('ctr') || m.name.includes('点击率'),
    );
    return ctr && ctr.value < 1.0;
  });

  if (lowCTRCampaigns.length > 0) {
    suggestions.push({
      id: generateId(),
      type: 'strategy',
      priority: 'medium',
      title: `${lowCTRCampaigns.length}个计划CTR偏低`,
      description: `${lowCTRCampaigns.map(c => c.name).join('、')}的点击率低于1%，建议优化创意或调整人群定向`,
      confidence: 0.75,
      actionHint: '优先优化CTR最低的2-3个计划',
      createdAt: Date.now(),
    });
  }

  const highCPACampaigns = campaigns.filter(c => {
    const cpa = c.metrics.find(
      m => m.name.toLowerCase().includes('cpa') || m.name.includes('转化成本'),
    );
    return cpa && cpa.value > 100;
  });

  if (highCPACampaigns.length > 0) {
    suggestions.push({
      id: generateId(),
      type: 'strategy',
      priority: 'medium',
      title: `${highCPACampaigns.length}个计划CPA过高`,
      description: `${highCPACampaigns.map(c => c.name).join('、')}的转化成本超过100元，建议调整出价策略`,
      confidence: 0.7,
      actionHint: '逐步降低出价，同时关注转化量变化',
      createdAt: Date.now(),
    });
  }

  return suggestions;
}

function analyzeBudgetAllocation(
  currentData: ExtractedData,
  historyData: DataPoint[],
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  const budgetNearDepletion = (currentData.campaigns || []).filter(c => {
    const cost = c.metrics.find(
      m => m.name.toLowerCase().includes('消耗') || m.name.toLowerCase().includes('cost'),
    );
    return cost && cost.value > 0;
  });

  if (budgetNearDepletion.length > 3) {
    suggestions.push({
      id: generateId(),
      type: 'strategy',
      priority: 'medium',
      title: '多计划预算管理建议',
      description: `当前有${budgetNearDepletion.length}个活跃计划，建议定期检查预算使用情况，将预算向ROI更高的计划倾斜`,
      confidence: 0.6,
      actionHint: '分析各计划ROI，将预算从低ROI计划转移至高ROI计划',
      createdAt: Date.now(),
    });
  }

  return suggestions;
}
