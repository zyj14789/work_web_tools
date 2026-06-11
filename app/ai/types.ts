// ============================================================
// AI广告投放助手 - AI引擎类型定义
// ============================================================

// === DOM快照 ===
export interface TableStructure {
  selector: string;
  headers: string[];
  rowCount: number;
  sampleRows: string[][];
}

export interface ChartHint {
  selector: string;
  type: 'canvas' | 'svg' | 'div';
  className: string;
  id: string;
}

export interface FormStructure {
  selector: string;
  inputs: { name: string; type: string; value: string }[];
  submitText: string;
}

export interface HiddenFieldHint {
  selector: string;
  name: string;
  id: string;
  value: string;
}

export interface DataAttributeHint {
  selector: string;
  text: string;
  attributes: Record<string, string>;
}

export interface ScriptDataHint {
  label: string;
  content: string;
}

export interface NetworkRequestSnapshot {
  id: string;
  url: string;
  method: string;
  status: number;
  contentType: string;
  timestamp: number;
  duration?: number;
  requestBody?: string;
  responseText: string;
}

export interface PageMetadata {
  url: string;
  title: string;
  platform: string;
  lastModified: string;
}

export interface DOMSnapshot {
  url: string;
  title: string;
  timestamp: number;
  tables: TableStructure[];
  charts: ChartHint[];
  forms: FormStructure[];
  keyTexts: string[];
  hiddenFields?: HiddenFieldHint[];
  dataAttributes?: DataAttributeHint[];
  scriptData?: ScriptDataHint[];
  networkRequests?: NetworkRequestSnapshot[];
  pageText?: string;
  metadata: PageMetadata;
}

// === 页面理解 ===
export type PageType = 'report' | 'campaign_list' | 'ad_creative' | 'settings' | 'other';

export interface DataRegion {
  selector: string;
  type: 'table' | 'chart' | 'metric_card' | 'filter_bar';
  label: string;
  metrics: string[];
}

export interface PageUnderstanding {
  pageType: PageType;
  dataRegions: DataRegion[];
  keyMetrics: string[];
  timeRange?: string;
  platform?: string;
  confidence: number;
  templateHash?: string;
}

// === 数据提取 ===
export interface MetricValue {
  name: string;
  value: number;
  unit?: string;
  changePercent?: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface ExtractedData {
  url: string;
  timestamp: number;
  pageType: PageType;
  metrics: MetricValue[];
  dimensions: Record<string, string>;
  campaigns?: CampaignData[];
  rawText: string;
}

export interface CampaignData {
  id: string;
  name: string;
  status: string;
  metrics: MetricValue[];
}

// === 异常检测 ===
export type AnomalyType = 'ctr_drop' | 'cost_spike' | 'cpa_surge' | 'conversion_drop' | 'cost_stagnation';

export type AnomalySeverity = 'high' | 'medium' | 'low';

export interface AnomalyResult {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  title: string;
  description: string;
  currentValue: number;
  expectedValue: number;
  deviationPercent: number;
  relatedMetrics: string[];
  relatedCampaignIds: string[];
  timestamp: number;
  confidence: number;
}

// === 建议 ===
export type SuggestionType = 'anomaly' | 'opportunity' | 'efficiency' | 'strategy';

export type SuggestionPriority = 'high' | 'medium' | 'low';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  title: string;
  description: string;
  confidence: number;
  relatedData?: unknown;
  actionHint?: string;
  createdAt: number;
  dismissed?: boolean;
  dismissedAt?: number;
}

export interface SuggestionTrigger {
  type: SuggestionType;
  priority: SuggestionPriority;
  cooldown: number;
  maxPerDay: number;
}

export interface SuggestionContext {
  currentData: ExtractedData;
  historyData: DataPoint[];
  userActions: UserAction[];
  patterns: Pattern[];
  settings: UserSettings;
}

// === 模式 ===
export interface Pattern {
  id: string;
  type: 'optimization' | 'risk' | 'trend';
  description: string;
  confidence: number;
  discoveredAt: number;
  relatedMetrics: string[];
  evidence: string;
  actionable: boolean;
}

// === 数据点 ===
export interface DataPoint {
  id: string;
  url: string;
  timestamp: number;
  pageType: PageType;
  platform: string;
  metrics: Record<string, number>;
  snapshot: DOMSnapshot;
  understanding: PageUnderstanding;
}

// === 用户操作 ===
export interface UserAction {
  id: string;
  type: 'click' | 'input' | 'navigate' | 'filter' | 'export' | 'other';
  target: string;
  value?: string;
  timestamp: number;
  pageUrl: string;
  count?: number;
}

// === 设置 ===
export interface UserSettings {
  apiKey: string;
  allowedDomains: DomainEntry[];
  suggestionsEnabled: boolean;
  anomalyAlertsEnabled: boolean;
  efficiencyTipsEnabled: boolean;
  strategyAdviceEnabled: boolean;
  checkFrequency: 'realtime' | '5min' | '15min' | 'manual';
  sensitivity: 'low' | 'medium' | 'high';
  anomalyThresholds: AnomalyThresholds;
  theme: 'light' | 'dark';
  language: 'zh' | 'en';
}

export interface AnomalyThresholds {
  ctrDropPercent: number;
  costSpikePercent: number;
  cpaSurgePercent: number;
  conversionDropPercent: number;
}

export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

// === 页面模板缓存 ===
export interface PageTemplate {
  hash: string;
  urlPattern: string;
  understanding: PageUnderstanding;
  createdAt: number;
  lastUsedAt: number;
  hitCount: number;
}

// === 域名白名单 ===
export interface DomainEntry {
  domain: string;
  enabled: boolean;
  label?: string;
}

// === 用户可读日志 ===
export type ActivityLogLevel = 'info' | 'success' | 'warn' | 'error' | 'thinking';

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  level: ActivityLogLevel;
  message: string;
  detail?: string;
  step?: string;
  duration?: number;
  source: 'system' | 'ai' | 'page' | 'user';
}

// === AI对话流 ===
export interface AIConversationEntry {
  id: string;
  timestamp: number;
  title: string;
  promptSummary: string;
  responseSummary: string;
  tokenUsed?: number;
  duration?: number;
  status: 'success' | 'error';
  error?: string;
}
// === AI思考过程 ===
export interface ThinkingStep {
  id: string;
  phase: 'preparing' | 'calling' | 'processing' | 'done' | 'error';
  label: string;
  detail?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  error?: string;
}

export interface ThinkingProcess {
  id: string;
  title: string;
  startTime: number;
  endTime?: number;
  steps: ThinkingStep[];
  status: 'running' | 'completed' | 'error';
  error?: string;
}
