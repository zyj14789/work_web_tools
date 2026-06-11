import type { ExtractedData, DataPoint, AnomalyResult, AnomalyType, AnomalySeverity } from '../ai/types';
import { logger } from '../utils/logger';
import { generateId } from '../utils/throttle';

const DEFAULT_THRESHOLDS = {
  ctrDropPercent: 30,
  costSpikePercent: 50,
  cpaSurgePercent: 50,
  conversionDropPercent: 40,
};

export function detectAnomalies(
  currentData: ExtractedData,
  historyData: DataPoint[],
  thresholds: Partial<typeof DEFAULT_THRESHOLDS> = {},
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const th = { ...DEFAULT_THRESHOLDS, ...thresholds };

  const currentMetrics: Record<string, number> = {};
  for (const m of currentData.metrics) {
    currentMetrics[m.name.toLowerCase()] = m.value;
  }

  const historyMetrics = aggregateHistoryMetrics(historyData);

  if (historyData.length < 3) {
    logger.debug('Not enough history data for anomaly detection');
    return anomalies;
  }

  checkCTRDrop(currentMetrics, historyMetrics, th.ctrDropPercent, anomalies);
  checkCostIssues(currentMetrics, historyMetrics, th.costSpikePercent, anomalies);
  checkCPASurge(currentMetrics, historyMetrics, th.cpaSurgePercent, anomalies);
  checkConversionDrop(currentMetrics, historyMetrics, th.conversionDropPercent, anomalies);

  return anomalies;
}

function aggregateHistoryMetrics(historyData: DataPoint[]): Record<string, { sum: number; count: number; values: number[] }> {
  const result: Record<string, { sum: number; count: number; values: number[] }> = {};

  for (const dp of historyData) {
    for (const key of Object.keys(dp.metrics)) {
      const lowerKey = key.toLowerCase();
      if (!result[lowerKey]) {
        result[lowerKey] = { sum: 0, count: 0, values: [] };
      }
      result[lowerKey].sum += dp.metrics[key];
      result[lowerKey].count++;
      result[lowerKey].values.push(dp.metrics[key]);
    }
  }

  return result;
}

function getHistoryAvg(
  historyMetrics: Record<string, { sum: number; count: number; values: number[] }>,
  metricKeys: string[],
): number | null {
  let totalSum = 0;
  let totalCount = 0;

  for (const key of metricKeys) {
    const data = historyMetrics[key];
    if (data && data.count > 0) {
      totalSum += data.sum;
      totalCount += data.count;
    }
  }

  return totalCount > 0 ? totalSum / totalCount : null;
}

function getCurrentValue(metrics: Record<string, number>, metricKeys: string[]): number | null {
  for (const key of metricKeys) {
    if (metrics[key] !== undefined) {
      return metrics[key];
    }
  }
  return null;
}

function calculateDeviation(current: number, expected: number): number {
  return expected !== 0 ? Math.abs((current - expected) / expected) * 100 : 0;
}

function checkCTRDrop(
  current: Record<string, number>,
  history: Record<string, { sum: number; count: number; values: number[] }>,
  threshold: number,
  anomalies: AnomalyResult[],
): void {
  const currentCTR = getCurrentValue(current, ['ctr', '点击率']);
  const avgCTR = getHistoryAvg(history, ['ctr', '点击率']);

  if (currentCTR !== null && avgCTR !== null && currentCTR < avgCTR) {
    const deviation = calculateDeviation(currentCTR, avgCTR);
    if (deviation >= threshold) {
      anomalies.push(createAnomaly(
        'ctr_drop',
        deviation >= threshold * 1.5 ? 'high' : 'medium',
        'CTR异常下降',
        `当前CTR(${currentCTR.toFixed(2)}%)较历史均值(${avgCTR.toFixed(2)}%)下降${deviation.toFixed(1)}%`,
        currentCTR,
        avgCTR,
        deviation,
      ));
    }
  }
}

function checkCostIssues(
  current: Record<string, number>,
  history: Record<string, { sum: number; count: number; values: number[] }>,
  threshold: number,
  anomalies: AnomalyResult[],
): void {
  const currentCost = getCurrentValue(current, ['消耗', 'cost', '花费']);
  const avgCost = getHistoryAvg(history, ['消耗', 'cost', '花费']);

  if (currentCost !== null && avgCost !== null && avgCost > 0) {
    const deviation = calculateDeviation(currentCost, avgCost);

    if (currentCost > avgCost && deviation >= threshold) {
      anomalies.push(createAnomaly(
        'cost_spike',
        'high',
        '消耗异常飙升',
        `当前消耗(${currentCost.toFixed(2)})较历史均值(${avgCost.toFixed(2)})上涨${deviation.toFixed(1)}%`,
        currentCost,
        avgCost,
        deviation,
      ));
    }

    if (currentCost < avgCost * 0.01) {
      anomalies.push(createAnomaly(
        'cost_stagnation',
        'medium',
        '消耗停滞',
        `当前消耗(${currentCost.toFixed(2)})远低于历史均值(${avgCost.toFixed(2)})，可能是投放异常`,
        currentCost,
        avgCost,
        calculateDeviation(currentCost, avgCost),
      ));
    }
  }
}

function checkCPASurge(
  current: Record<string, number>,
  history: Record<string, { sum: number; count: number; values: number[] }>,
  threshold: number,
  anomalies: AnomalyResult[],
): void {
  const currentCPA = getCurrentValue(current, ['cpa', '转化成本']);
  const avgCPA = getHistoryAvg(history, ['cpa', '转化成本']);

  if (currentCPA !== null && avgCPA !== null && currentCPA > avgCPA) {
    const deviation = calculateDeviation(currentCPA, avgCPA);
    if (deviation >= threshold) {
      anomalies.push(createAnomaly(
        'cpa_surge',
        'high',
        'CPA异常上涨',
        `当前CPA(${currentCPA.toFixed(2)})较历史均值(${avgCPA.toFixed(2)})上涨${deviation.toFixed(1)}%`,
        currentCPA,
        avgCPA,
        deviation,
      ));
    }
  }
}

function checkConversionDrop(
  current: Record<string, number>,
  history: Record<string, { sum: number; count: number; values: number[] }>,
  threshold: number,
  anomalies: AnomalyResult[],
): void {
  const currentConv = getCurrentValue(current, ['转化量', 'conversions', '转化数']);
  const avgConv = getHistoryAvg(history, ['转化量', 'conversions', '转化数']);

  if (currentConv !== null && avgConv !== null && currentConv < avgConv) {
    const deviation = calculateDeviation(currentConv, avgConv);
    if (deviation >= threshold) {
      anomalies.push(createAnomaly(
        'conversion_drop',
        'high',
        '转化量骤减',
        `当前转化量(${currentConv})较历史均值(${avgConv.toFixed(0)})下降${deviation.toFixed(1)}%`,
        currentConv,
        avgConv,
        deviation,
      ));
    }
  }
}

function createAnomaly(
  type: AnomalyType,
  severity: AnomalySeverity,
  title: string,
  description: string,
  currentValue: number,
  expectedValue: number,
  deviationPercent: number,
): AnomalyResult {
  return {
    id: generateId(),
    type,
    severity,
    title,
    description,
    currentValue,
    expectedValue,
    deviationPercent,
    relatedMetrics: [],
    relatedCampaignIds: [],
    timestamp: Date.now(),
    confidence: Math.min(0.95, deviationPercent / 100),
  };
}
