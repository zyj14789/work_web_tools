import type { AIConfig, DOMSnapshot, PageUnderstanding, ExtractedData, AnomalyResult, Suggestion, Pattern, DataPoint, ThinkingProcess, CampaignData, NetworkRequestSnapshot } from './types';
import type { SuggestionContext } from '../suggestion/types';
import { buildPageUnderstandingPrompt, buildDataExtractionPrompt, buildAnomalyDetectionPrompt, buildSuggestionPrompt, buildPatternMiningPrompt } from './prompt-builder';
import { logger } from '../utils/logger';
import { hashString, delay } from '../utils/throttle';
import { activityLogger } from '../utils/activity-logger';

type LocalMetricSpec = {
  canonical: string;
  aliases: string[];
  unit?: string;
  aggregation: 'sum' | 'avg';
};

type MetricBucketMap = Map<string, { spec: LocalMetricSpec; values: number[] }>;

const LOCAL_METRIC_SPECS: LocalMetricSpec[] = [
  { canonical: '曝光', aliases: ['曝光', '展现', '展示', 'impression', 'impressions'], aggregation: 'sum' },
  { canonical: '点击', aliases: ['点击', 'click', 'clicks'], aggregation: 'sum' },
  { canonical: 'CTR', aliases: ['ctr', '点击率'], unit: '%', aggregation: 'avg' },
  { canonical: '消耗', aliases: ['消耗', '花费', 'cost', 'spend', '金额'], aggregation: 'sum' },
  { canonical: '转化量', aliases: ['转化量', '转化数', '转化', 'conversion', 'conversions'], aggregation: 'sum' },
  { canonical: 'CPA', aliases: ['cpa', '转化成本', '获客成本'], aggregation: 'avg' },
  { canonical: '转化率', aliases: ['转化率', 'cvr'], unit: '%', aggregation: 'avg' },
  { canonical: 'ROI', aliases: ['roi', 'roas', '投入产出'], aggregation: 'avg' },
  { canonical: '预算', aliases: ['预算', 'budget'], aggregation: 'sum' },
];

const DEFAULT_AI_CONFIG: AIConfig = {
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
  maxTokens: 2048,
  temperature: 0.3,
  timeout: 30000,
};

export class AIEngine {
  private config: AIConfig;

  constructor(config?: Partial<AIConfig>) {
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
  }

  updateConfig(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config };
  }

  async understandPage(snapshot: DOMSnapshot): Promise<PageUnderstanding> {
    const tp = activityLogger.startThinkingProcess('AI页面结构分析');
    activityLogger.addThinkingStep(tp, 'preparing', '正在准备页面结构数据...');
    activityLogger.info(`采集到 ${snapshot.tables.length} 个表格, ${snapshot.charts.length} 个图表`, 'page');

    if (!this.hasApiKey()) {
      const fallback = this.buildLocalUnderstanding(snapshot);
      activityLogger.addThinkingStep(tp, 'done', '未配置API Key，已使用本地规则识别页面',
        `识别为:${pageTypeLabel(fallback.pageType)} 指标:${fallback.keyMetrics.join(', ') || '无'}`);
      activityLogger.completeThinkingProcess(tp);
      return fallback;
    }

    const prompt = buildPageUnderstandingPrompt(snapshot);
    activityLogger.addThinkingStep(tp, 'calling', '正在调用DeepSeek识别页面结构...',
      `表格数:${snapshot.tables.length} 图表数:${snapshot.charts.length}`);

    try {
      const response = await this.callAPI(prompt, tp, '页面结构分析');
      const parsed = this.parseJSONResponse<PageUnderstanding>(response);

      activityLogger.addThinkingStep(tp, 'done', `页面识别完成：${pageTypeLabel(parsed.pageType || 'other')}`,
        `置信度:${Math.round((parsed.confidence || 0) * 100)}%`);
      activityLogger.completeThinkingProcess(tp);

      return {
        pageType: parsed.pageType || 'other',
        dataRegions: parsed.dataRegions || [],
        keyMetrics: parsed.keyMetrics || [],
        timeRange: parsed.timeRange,
        platform: parsed.platform,
        confidence: parsed.confidence || 0.5,
        templateHash: this.buildTemplateHash(snapshot),
      };
    } catch (error) {
      const fallback = this.buildLocalUnderstanding(snapshot);
      activityLogger.warn('AI页面识别失败，已切换为本地规则识别', 'ai', String(error));
      return fallback;
    }
  }

  async extractData(
    snapshot: DOMSnapshot,
    understanding: PageUnderstanding,
  ): Promise<ExtractedData> {
    const tp = activityLogger.startThinkingProcess('AI数据提取');
    activityLogger.addThinkingStep(tp, 'preparing', '正在整理页面关键词...');
    activityLogger.info(`识别到 ${understanding.keyMetrics.length} 个关键指标: ${understanding.keyMetrics.join(', ')}`, 'ai');

    if (!this.hasApiKey()) {
      const fallback = this.extractDataLocally(snapshot, understanding);
      activityLogger.addThinkingStep(tp, 'done', `本地提取完成：${fallback.metrics.length} 个指标`,
        fallback.campaigns && fallback.campaigns.length > 0 ? `包含 ${fallback.campaigns.length} 个计划样本` : '无计划维度数据');
      activityLogger.completeThinkingProcess(tp);
      return fallback;
    }

    const prompt = buildDataExtractionPrompt(snapshot, understanding as unknown as Record<string, unknown>);
    activityLogger.addThinkingStep(tp, 'calling', '正在调用DeepSeek提取业务数据...');

    try {
      const response = await this.callAPI(prompt, tp, '业务数据提取');
      const parsed = this.parseJSONResponse<ExtractedData>(response);

      const metricCount = parsed.metrics?.length || 0;
      const campaignCount = parsed.campaigns?.length || 0;
      activityLogger.addThinkingStep(tp, 'done', `数据提取完成：${metricCount} 个指标`,
        campaignCount > 0 ? `包含 ${campaignCount} 个计划数据` : '无计划维度数据');
      activityLogger.completeThinkingProcess(tp);

      return {
        url: parsed.url || snapshot.url,
        timestamp: parsed.timestamp || Date.now(),
        pageType: parsed.pageType || understanding.pageType,
        metrics: parsed.metrics || [],
        dimensions: parsed.dimensions || {},
        campaigns: parsed.campaigns || [],
        rawText: parsed.rawText || '',
      };
    } catch (error) {
      const fallback = this.extractDataLocally(snapshot, understanding);
      activityLogger.warn('AI数据提取失败，已切换为本地规则提取', 'ai', String(error));
      return fallback;
    }
  }

  async detectAnomalies(
    current: ExtractedData,
    history: DataPoint[],
  ): Promise<AnomalyResult[]> {
    const tp = activityLogger.startThinkingProcess('AI异常检测分析');
    activityLogger.addThinkingStep(tp, 'preparing', '正在对比历史数据...');
    activityLogger.info(`当前数据: ${current.metrics.length} 个指标, 历史数据: ${history.length} 条`, 'ai');

    const historySummaries = history.map(dp => ({
      timestamp: dp.timestamp,
      metrics: dp.metrics,
    }));

    const prompt = buildAnomalyDetectionPrompt(
      current as unknown as Record<string, unknown>,
      historySummaries,
    );
    activityLogger.addThinkingStep(tp, 'calling', '正在调用DeepSeek检测数据异常...');

    const response = await this.callAPI(prompt, tp, '异常检测分析');
    const parsed = this.parseJSONResponse<{ anomalies: AnomalyResult[] }>(response);
    const anomalies = parsed.anomalies || [];

    if (anomalies.length === 0) {
      activityLogger.addThinkingStep(tp, 'done', '未检测到异常', '所有指标处于正常范围');
      activityLogger.success('✅ 数据正常，未发现异常', 'ai');
    } else {
      const highCount = anomalies.filter(a => a.severity === 'high').length;
      activityLogger.addThinkingStep(tp, 'done', `检测到 ${anomalies.length} 个异常`,
        highCount > 0 ? `其中 ${highCount} 个高严重度` : '均为中低严重度');
      if (highCount > 0) {
        activityLogger.warn(`⚠️ 发现 ${highCount} 个高严重度异常`, 'ai');
      }
    }
    activityLogger.completeThinkingProcess(tp);

    return anomalies;
  }

  async generateSuggestions(
    anomalies: AnomalyResult[],
    context: SuggestionContext,
  ): Promise<Suggestion[]> {
    if (anomalies.length === 0 || !this.hasApiKey()) return [];

    const tp = activityLogger.startThinkingProcess('AI优化建议生成');
    activityLogger.addThinkingStep(tp, 'preparing', '正在分析异常数据上下文...');

    const prompt = buildSuggestionPrompt(
      anomalies as unknown as Record<string, unknown>[],
      {
        pageType: context.currentData?.pageType,
        metrics: context.currentData?.metrics,
        historyCount: context.historyData?.length || 0,
        patternCount: context.patterns?.length || 0,
      },
    );
    activityLogger.addThinkingStep(tp, 'calling', '正在调用DeepSeek生成优化建议...');

    const response = await this.callAPI(prompt, tp, '优化建议生成');
    const parsed = this.parseJSONResponse<{ suggestions: Suggestion[] }>(response);
    const suggestions = parsed.suggestions || [];

    activityLogger.addThinkingStep(tp, 'done', `生成 ${suggestions.length} 条优化建议`);
    activityLogger.completeThinkingProcess(tp);

    return suggestions;
  }

  async minePatterns(dataPoints: DataPoint[]): Promise<Pattern[]> {
    if (dataPoints.length < 5) {
      logger.debug('Not enough data points for pattern mining', { count: dataPoints.length });
      return [];
    }

    if (!this.hasApiKey()) {
      return this.minePatternsLocally(dataPoints);
    }

    const tp = activityLogger.startThinkingProcess('AI知识模式挖掘');
    activityLogger.addThinkingStep(tp, 'preparing', `正在分析 ${dataPoints.length} 条历史数据...`);

    const summaries = dataPoints.map(dp => ({
      timestamp: dp.timestamp,
      metrics: dp.metrics,
      pageType: dp.pageType,
    }));

    const prompt = buildPatternMiningPrompt(summaries);
    activityLogger.addThinkingStep(tp, 'calling', '正在调用DeepSeek挖掘优化模式...');

    try {
      const response = await this.callAPI(prompt, tp, '知识模式挖掘');
      const parsed = this.parseJSONResponse<{ patterns: Pattern[] }>(response);
      const patterns = parsed.patterns || [];

      activityLogger.addThinkingStep(tp, 'done', `发现 ${patterns.length} 个优化模式`);
      activityLogger.completeThinkingProcess(tp);

      return patterns;
    } catch (error) {
      activityLogger.warn('AI模式挖掘失败，已切换为本地趋势挖掘', 'ai', String(error));
      return this.minePatternsLocally(dataPoints);
    }
  }

  private hasApiKey(): boolean {
    return this.config.apiKey.trim().length > 0;
  }

  private buildLocalUnderstanding(snapshot: DOMSnapshot): PageUnderstanding {
    const tableMetrics = snapshot.tables.flatMap(table => table.headers
      .map(header => this.findMetricSpec(header))
      .filter((spec): spec is LocalMetricSpec => Boolean(spec))
      .map(spec => spec.canonical));
    const textSources = [
      ...snapshot.keyTexts,
      snapshot.pageText || '',
      ...(snapshot.hiddenFields || []).map(field => `${field.name} ${field.id} ${field.value}`),
      ...(snapshot.dataAttributes || []).map(item => `${item.text} ${JSON.stringify(item.attributes)}`),
      ...(snapshot.scriptData || []).map(item => item.content),
      ...(snapshot.networkRequests || []).map(req => `${req.url} ${req.responseText}`),
    ].filter(Boolean);
    const textMetrics = textSources.flatMap(text => LOCAL_METRIC_SPECS
      .filter(spec => spec.aliases.some(alias => text.toLowerCase().includes(alias.toLowerCase())))
      .map(spec => spec.canonical));
    const keyMetrics = Array.from(new Set([...tableMetrics, ...textMetrics]));
    const hasReportSignals = keyMetrics.length > 0;
    const hasCampaignSignals = textSources.concat(snapshot.tables.flatMap(t => t.headers))
      .some(text => /计划|广告组|广告|campaign|ad group/i.test(text));
    const pageType = hasReportSignals ? 'report' : hasCampaignSignals ? 'campaign_list' : snapshot.forms.length > 0 ? 'settings' : 'other';
    const templateHash = this.buildTemplateHash(snapshot);

    return {
      pageType,
      dataRegions: snapshot.tables.map((table, index) => ({
        selector: table.selector,
        type: 'table',
        label: `表格 ${index + 1}`,
        metrics: table.headers
          .map(header => this.findMetricSpec(header)?.canonical)
          .filter((metric): metric is string => Boolean(metric)),
      })),
      keyMetrics,
      timeRange: this.extractTimeRange(snapshot),
      platform: snapshot.metadata.platform,
      confidence: hasReportSignals ? 0.68 : 0.45,
      templateHash,
    };
  }

  private extractDataLocally(
    snapshot: DOMSnapshot,
    understanding: PageUnderstanding,
  ): ExtractedData {
    const metricBuckets: MetricBucketMap = new Map();
    const campaigns: CampaignData[] = [];

    for (const table of snapshot.tables) {
      const metricColumns = table.headers
        .map((header, index) => ({ index, spec: this.findMetricSpec(header) }))
        .filter((item): item is { index: number; spec: LocalMetricSpec } => Boolean(item.spec));
      const nameColumn = table.headers.findIndex(header => /计划|广告组|广告|campaign|name|名称/i.test(header));
      const statusColumn = table.headers.findIndex(header => /状态|status/i.test(header));

      for (const row of table.sampleRows) {
        const rowMetrics = [];
        for (const { index, spec } of metricColumns) {
          const value = this.parseMetricValue(row[index]);
          if (value === null) continue;

          this.addMetricValue(metricBuckets, spec, value);
          rowMetrics.push({ name: spec.canonical, value, unit: spec.unit });
        }

        if (rowMetrics.length > 0 && nameColumn >= 0) {
          const name = row[nameColumn]?.trim();
          if (name) {
            campaigns.push({
              id: hashString(`${snapshot.url}:${name}`),
              name,
              status: statusColumn >= 0 ? (row[statusColumn] || '') : '',
              metrics: rowMetrics,
            });
          }
        }
      }
    }

    this.collectMetricsFromNetwork(snapshot.networkRequests || [], metricBuckets, campaigns, snapshot.url);
    this.collectMetricsFromText(snapshot.pageText || snapshot.keyTexts.join('\n'), metricBuckets);

    const metrics = Array.from(metricBuckets.values()).map(({ spec, values }) => ({
      name: spec.canonical,
      value: spec.aggregation === 'avg'
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : values.reduce((sum, value) => sum + value, 0),
      unit: spec.unit,
    }));

    return {
      url: snapshot.url,
      timestamp: Date.now(),
      pageType: understanding.pageType,
      metrics,
      dimensions: {
        platform: understanding.platform || snapshot.metadata.platform,
        timeRange: understanding.timeRange || '',
      },
      campaigns,
      rawText: this.buildSnapshotText(snapshot),
    };
  }

  private findMetricSpec(text: string): LocalMetricSpec | undefined {
    const normalized = text.toLowerCase().replace(/\s+/g, '');
    return LOCAL_METRIC_SPECS.find(spec =>
      spec.aliases.some(alias => normalized.includes(alias.toLowerCase().replace(/\s+/g, ''))),
    );
  }

  private addMetricValue(metricBuckets: MetricBucketMap, spec: LocalMetricSpec, value: number): void {
    if (!Number.isFinite(value)) return;
    const existing = metricBuckets.get(spec.canonical) || { spec, values: [] };
    existing.values.push(value);
    metricBuckets.set(spec.canonical, existing);
  }

  private collectMetricsFromText(text: string, metricBuckets: MetricBucketMap): void {
    if (!text) return;

    for (const spec of LOCAL_METRIC_SPECS) {
      for (const alias of spec.aliases) {
        const escaped = escapeRegExp(alias);
        const pattern = new RegExp(`${escaped}[^\\d\\-￥¥$]{0,16}([￥¥$]?\\s*-?\\d[\\d,]*(?:\\.\\d+)?\\s*(?:%|万|亿)?)`, 'gi');
        for (const match of text.matchAll(pattern)) {
          const value = this.parseMetricValue(match[1]);
          if (value !== null) {
            this.addMetricValue(metricBuckets, spec, value);
          }
        }
      }
    }
  }

  private collectMetricsFromNetwork(
    requests: NetworkRequestSnapshot[],
    metricBuckets: MetricBucketMap,
    campaigns: CampaignData[],
    pageUrl: string,
  ): void {
    for (const request of requests) {
      const parsed = parseJsonLike(request.responseText);
      if (parsed === null) continue;
      this.traverseJsonMetrics(parsed, metricBuckets, campaigns, pageUrl, request.url);
    }
  }

  private traverseJsonMetrics(
    value: unknown,
    metricBuckets: MetricBucketMap,
    campaigns: CampaignData[],
    pageUrl: string,
    sourceUrl: string,
  ): void {
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 100)) {
        this.traverseJsonMetrics(item, metricBuckets, campaigns, pageUrl, sourceUrl);
      }
      return;
    }

    if (!isRecord(value)) return;

    const campaign = this.extractCampaignFromRecord(value, pageUrl, sourceUrl);
    if (campaign && !campaigns.some(item => item.id === campaign.id)) {
      campaigns.push(campaign);
    }

    for (const [key, raw] of Object.entries(value)) {
      const spec = this.findMetricSpec(key);
      if (spec) {
        const metricValue = typeof raw === 'number' ? raw : this.parseMetricValue(String(raw ?? ''));
        if (metricValue !== null) {
          this.addMetricValue(metricBuckets, spec, metricValue);
        }
      }

      if (typeof raw === 'object' && raw !== null) {
        this.traverseJsonMetrics(raw, metricBuckets, campaigns, pageUrl, sourceUrl);
      }
    }
  }

  private extractCampaignFromRecord(
    record: Record<string, unknown>,
    pageUrl: string,
    sourceUrl: string,
  ): CampaignData | null {
    const name = firstStringValue(record, ['campaignName', 'campaign_name', 'planName', 'adName', 'name', '计划名称', '广告名称']);
    if (!name) return null;

    const id = firstStringValue(record, ['campaignId', 'campaign_id', 'planId', 'adId', 'id', '计划ID', '广告ID'])
      || hashString(`${pageUrl}:${sourceUrl}:${name}`);
    const status = firstStringValue(record, ['status', 'state', '计划状态', '状态']) || '';
    const metrics: CampaignData['metrics'] = [];
    for (const [key, raw] of Object.entries(record)) {
      const spec = this.findMetricSpec(key);
      const value = typeof raw === 'number' ? raw : this.parseMetricValue(String(raw ?? ''));
      if (spec && value !== null) {
        metrics.push({ name: spec.canonical, value, unit: spec.unit });
      }
    }

    if (metrics.length === 0) return null;

    return {
      id,
      name,
      status,
      metrics,
    };
  }

  private parseMetricValue(raw: string | undefined): number | null {
    if (!raw) return null;
    const normalized = raw
      .replace(/,/g, '')
      .replace(/[￥¥$]/g, '')
      .replace(/\s+/g, '')
      .trim();
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;

    let value = Number(match[0]);
    if (!Number.isFinite(value)) return null;

    if (normalized.includes('万')) value *= 10000;
    if (normalized.includes('亿')) value *= 100000000;

    return value;
  }

  private extractTimeRange(snapshot: DOMSnapshot): string | undefined {
    const text = snapshot.keyTexts.join(' ');
    const dateRange = text.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}\s*(?:至|-|~)\s*\d{4}[/-]\d{1,2}[/-]\d{1,2}/);
    if (dateRange) return dateRange[0];
    const relativeRange = text.match(/今日|昨日|近7天|近七天|近30天|近三十天|本周|本月|上月/);
    return relativeRange?.[0];
  }

  private buildSnapshotText(snapshot: DOMSnapshot): string {
    const tableText = snapshot.tables
      .map(table => [table.headers.join('\t'), ...table.sampleRows.map(row => row.join('\t'))].join('\n'))
      .join('\n\n');
    const networkText = (snapshot.networkRequests || [])
      .map(req => `${req.method} ${req.url}\n${req.responseText}`)
      .join('\n\n');
    return [
      snapshot.keyTexts.join('\n'),
      snapshot.pageText || '',
      tableText,
      networkText,
    ].filter(Boolean).join('\n\n').slice(0, 12000);
  }

  private minePatternsLocally(dataPoints: DataPoint[]): Pattern[] {
    const metricKeys = Array.from(new Set(dataPoints.flatMap(dp => Object.keys(dp.metrics))));
    const patterns: Pattern[] = [];

    for (const key of metricKeys) {
      const values = dataPoints
        .map(dp => dp.metrics[key])
        .filter(value => typeof value === 'number' && Number.isFinite(value));
      if (values.length < 5) continue;

      const firstHalf = values.slice(0, Math.floor(values.length / 2));
      const secondHalf = values.slice(Math.floor(values.length / 2));
      const firstAvg = firstHalf.reduce((sum, value) => sum + value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, value) => sum + value, 0) / secondHalf.length;
      if (firstAvg === 0) continue;

      const changePercent = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
      if (Math.abs(changePercent) < 20) continue;

      patterns.push({
        id: hashString(`${key}:${Math.round(changePercent)}:${dataPoints.length}`),
        type: key.toLowerCase().includes('cpa') || key.includes('消耗') ? 'risk' : 'trend',
        description: `${key}在近期样本中${changePercent > 0 ? '上升' : '下降'}${Math.abs(changePercent).toFixed(1)}%`,
        confidence: Math.min(0.85, Math.abs(changePercent) / 100),
        discoveredAt: Date.now(),
        relatedMetrics: [key],
        evidence: `前半段均值 ${firstAvg.toFixed(2)}，后半段均值 ${secondAvg.toFixed(2)}`,
        actionable: true,
      });
    }

    return patterns.slice(0, 5);
  }

  private buildTemplateHash(snapshot: DOMSnapshot): string {
    return hashString(`${normalizeUrlPattern(snapshot.url)}:${JSON.stringify(snapshot.tables.map(t => t.headers))}`);
  }

  private async callAPI(prompt: string, thinkingProcess?: ThinkingProcess, title?: string, retryCount = 0): Promise<string> {
    const maxRetries = 3;
    const startTime = Date.now();
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), this.config.timeout);

    const promptSummary = this.summarizePrompt(prompt);

    try {
      const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'system', content: '你是一个广告数据分析助手。请严格按JSON格式返回结果，不要包含其他文字。' },
            { role: 'user', content: prompt },
          ],
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
        }),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const tokenUsed = data.usage?.total_tokens || 0;
      const duration = Date.now() - startTime;

      if (thinkingProcess) {
        activityLogger.addThinkingStep(thinkingProcess, 'processing', 'AI正在分析返回结果...',
          `Token: ${tokenUsed}`);
      }

      if (title) {
        const respSummary = content.substring(0, 150).replace(/\n/g, ' ');
        activityLogger.addConversation({
          title,
          promptSummary,
          responseSummary: respSummary,
          tokenUsed,
          duration,
          status: 'success',
        });
      }

      return this.extractJSON(content);
    } catch (error) {
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      if (title && retryCount >= maxRetries - 1) {
        activityLogger.addConversation({
          title,
          promptSummary,
          responseSummary: '',
          tokenUsed: 0,
          duration,
          status: 'error',
          error: String(error),
        });
      }

      const isClientError = error instanceof Error && /^API error 4\d\d/.test(error.message);
      if (retryCount < maxRetries && error instanceof Error && error.name !== 'AbortError' && !isClientError) {
        const backoffMs = Math.pow(2, retryCount) * 1000;
        logger.warn(`API call failed, retrying in ${backoffMs}ms (${retryCount + 1}/${maxRetries})`, error);
        if (thinkingProcess) {
          activityLogger.addThinkingStep(thinkingProcess, 'calling',
            `API请求失败，正在重试(${retryCount + 1}/${maxRetries})...`);
        }
        await delay(backoffMs);
        return this.callAPI(prompt, thinkingProcess, title, retryCount + 1);
      }

      logger.error('API call failed after retries', error);
      if (thinkingProcess) {
        activityLogger.failThinkingProcess(thinkingProcess, String(error));
      }
      throw error;
    }
  }

  private extractJSON(text: string): string {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    return text;
  }

  private parseJSONResponse<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      logger.error('Failed to parse AI response as JSON', { text: text.substring(0, 200) });
      return {} as T;
    }
  }

  private summarizePrompt(prompt: string): string {
    const normalizedHeader = prompt.substring(0, 180).replace(/\n/g, ' ');
    const dataSource = prompt.match(/## 数据源快照\s*([\s\S]*?)\n\n## 请以JSON格式返回/);
    if (dataSource?.[1]) {
      return `${normalizedHeader}\n\n数据源片段:\n${dataSource[1].slice(0, 1400)}`;
    }

    const domSnapshot = prompt.match(/## DOM结构快照\s*([\s\S]*?)\n\n## 请以JSON格式返回/);
    if (domSnapshot?.[1]) {
      return `${normalizedHeader}\n\nDOM片段:\n${domSnapshot[1].slice(0, 1200)}`;
    }

    return normalizedHeader;
  }
}

function normalizeUrlPattern(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl.split('?')[0] || rawUrl;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseJsonLike(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/[\[{][\s\S]*[\]}]/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstStringValue(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return null;
}

function pageTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    report: '投放报表',
    campaign_list: '计划列表',
    ad_creative: '广告创意',
    settings: '设置页面',
    other: '其他页面',
  };
  return labels[type] || type;
}
