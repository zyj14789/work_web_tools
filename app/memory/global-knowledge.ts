import type { GlobalKnowledge, IndustryBenchmarks, BestPractice } from './types';

const DEFAULT_BENCHMARKS: IndustryBenchmarks = {
  ctr: { low: 0.5, avg: 2.0, high: 5.0 },
  cpa: { low: 20, avg: 50, high: 100 },
  conversionRate: { low: 1.0, avg: 3.0, high: 8.0 },
  roi: { low: 1.0, avg: 3.0, high: 5.0 },
};

const DEFAULT_BEST_PRACTICES: BestPractice[] = [
  {
    id: 'bp_001',
    category: 'ctr_optimization',
    title: '低CTR创意优化',
    description: 'CTR低于0.5%时，建议更换创意素材，尝试不同风格的图片和文案组合',
    applicableWhen: '计划CTR持续低于行业平均的25%',
    expectedImprovement: 'CTR可提升30-50%',
  },
  {
    id: 'bp_002',
    category: 'budget_allocation',
    title: '预算动态分配',
    description: '将预算向ROI表现好的计划倾斜，表现差的计划降低预算或暂停',
    applicableWhen: '多个计划同时投放且有显著效果差异时',
    expectedImprovement: '整体ROI可提升15-25%',
  },
  {
    id: 'bp_003',
    category: 'cpa_control',
    title: 'CPA过高的出价调整',
    description: 'CPA超过目标150%时，建议逐步降低出价5-10%，观察转化量和CPA变化',
    applicableWhen: 'CPA持续上涨超过目标值',
    expectedImprovement: 'CPA可回落10-20%',
  },
  {
    id: 'bp_004',
    category: 'audience_targeting',
    title: '人群定向优化',
    description: '分析转化人群特征，排除无效人群，使用相似人群扩展功能',
    applicableWhen: '转化率低于1%且曝光量充足时',
    expectedImprovement: '转化率可提升20-40%',
  },
  {
    id: 'bp_005',
    category: 'creative_refresh',
    title: '创意定期更新',
    description: '同一创意投放超过2周后效果递减，建议每1-2周更新一批新创意',
    applicableWhen: '创意投放时间超过14天且效果呈下降趋势',
    expectedImprovement: '维持CTR和转化率稳定',
  },
];

const GLOBAL_KNOWLEDGE_VERSION = '1.0.0';

let cachedKnowledge: GlobalKnowledge | null = null;

export async function getGlobalKnowledge(): Promise<GlobalKnowledge> {
  if (cachedKnowledge) return cachedKnowledge;

  cachedKnowledge = {
    version: GLOBAL_KNOWLEDGE_VERSION,
    industryBenchmarks: DEFAULT_BENCHMARKS,
    bestPractices: DEFAULT_BEST_PRACTICES,
    updatedAt: Date.now(),
    source: 'builtin',
  };

  return cachedKnowledge;
}

export function getBenchmark(metric: string): { low: number; avg: number; high: number } | null {
  const key = metric.toLowerCase();
  const benchmarks: Record<string, { low: number; avg: number; high: number }> = {
    ctr: DEFAULT_BENCHMARKS.ctr,
    '点击率': DEFAULT_BENCHMARKS.ctr,
    cpa: DEFAULT_BENCHMARKS.cpa,
    '转化成本': DEFAULT_BENCHMARKS.cpa,
    conversionrate: DEFAULT_BENCHMARKS.conversionRate,
    '转化率': DEFAULT_BENCHMARKS.conversionRate,
    roi: DEFAULT_BENCHMARKS.roi,
    '投资回报率': DEFAULT_BENCHMARKS.roi,
  };
  return benchmarks[key] || null;
}

export function getBestPractices(category?: string): BestPractice[] {
  if (category) {
    return DEFAULT_BEST_PRACTICES.filter(bp => bp.category === category);
  }
  return DEFAULT_BEST_PRACTICES;
}

export function updateKnowledge(knowledge: GlobalKnowledge): void {
  cachedKnowledge = knowledge;
}
