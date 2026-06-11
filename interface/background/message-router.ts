import type { ChromeMessage, ChromeResponse } from '../messaging';
import { MessageType, createResponse, sendMessage } from '../messaging';
import { callDeepSeekAPI, testApiConnection } from './api-proxy';
import { getStorageManager } from '../../app/storage/manager';
import type { UserSettings, AIConfig, DOMSnapshot, PageTemplate, PageUnderstanding } from '../../app/ai/types';
import type { ExportScope, MergeStrategy } from '../../app/storage/adapter';
import { logger } from '../../app/utils/logger';
import { activityLogger } from '../../app/utils/activity-logger';
import { AIEngine } from '../../app/ai';
import { MemorySystem } from '../../app/memory';
import { SuggestionEngine } from '../../app/suggestion';
import { hashString } from '../../app/utils/throttle';

let aiEngine: AIEngine | null = null;
let memorySystem: MemorySystem | null = null;
let suggestionEngine: SuggestionEngine | null = null;
let activityUnsubscribers: Array<() => void> = [];

export async function initializeEngines(): Promise<void> {
  memorySystem = new MemorySystem();
  await memorySystem.initialize();

  const storage = getStorageManager().getAdapter();
  const settings = await storage.get<UserSettings>('settings:user');

  aiEngine = new AIEngine({
    apiKey: settings?.apiKey || '',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    maxTokens: 2048,
    temperature: 0.3,
    timeout: 30000,
  });

  suggestionEngine = new SuggestionEngine(aiEngine, memorySystem);

  for (const unsubscribe of activityUnsubscribers) {
    unsubscribe();
  }
  activityUnsubscribers = [];

  activityUnsubscribers.push(activityLogger.onLog((entry) => {
    sendMessage({
      type: MessageType.ACTIVITY_LOG,
      payload: entry,
      source: 'background',
      timestamp: Date.now(),
    }).catch(() => {});
  }));

  activityUnsubscribers.push(activityLogger.onThinking((process) => {
    sendMessage({
      type: MessageType.THINKING_UPDATE,
      payload: process,
      source: 'background',
      timestamp: Date.now(),
    }).catch(() => {});
  }));

  activityUnsubscribers.push(activityLogger.onConversation((conv) => {
    sendMessage({
      type: MessageType.AI_CONVERSATION,
      payload: conv,
      source: 'background',
      timestamp: Date.now(),
    }).catch(() => {});
  }));

  activityLogger.info('AI广告助手已启动', 'system');

  logger.info('Background engines initialized');
}

export async function handleMessage(
  message: ChromeMessage,
  sender?: chrome.runtime.MessageSender,
): Promise<ChromeResponse> {
  logger.debug(`Handling message: ${message.type}`);

  switch (message.type) {
    case MessageType.DOM_SNAPSHOT:
      return handleDOMSnapshot(message);

    case MessageType.USER_ACTION:
      return handleUserAction(message);

    case MessageType.PAGE_CHANGED:
      return handlePageChanged(message);

    case MessageType.GET_SETTINGS:
      return handleGetSettings();

    case MessageType.UPDATE_SETTINGS:
      return handleUpdateSettings(message);

    case MessageType.GET_SUGGESTIONS:
      return handleGetSuggestions();

    case MessageType.DISMISS_SUGGESTION:
      return handleDismissSuggestion(message);

    case MessageType.EXPORT_DATA:
      return handleExportData(message);

    case MessageType.IMPORT_DATA:
      return handleImportData(message);

    case MessageType.CLEAR_DATA:
      return handleClearData();

    case MessageType.TEST_API_KEY:
      return handleTestApiKey(message);

    case MessageType.OPEN_SIDE_PANEL:
      return handleOpenSidePanel(sender);

    case MessageType.REQUEST_ANALYSIS:
      return handleRequestAnalysis();

    case MessageType.GET_ACTIVITY_LOGS:
      return handleGetActivityLogs();

    case MessageType.CLEAR_ACTIVITY_LOGS:
      return handleClearActivityLogs();

    case MessageType.ACTIVITY_LOG:
      return handleActivityLog(message);

    case MessageType.AI_CONVERSATION:
      return handleAIConversation(message);

    default:
      return createResponse(false, undefined, `Unhandled message type: ${message.type}`);
  }
}

async function handleDOMSnapshot(message: ChromeMessage): Promise<ChromeResponse> {
  try {
    const snapshot = message.payload as DOMSnapshot | undefined;
    if (!snapshot) {
      return createResponse(false, undefined, 'No snapshot data');
    }

    if (!aiEngine || !memorySystem || !suggestionEngine) {
      await initializeEngines();
      if (!aiEngine || !memorySystem || !suggestionEngine) {
        return createResponse(false, undefined, 'Engines not initialized');
      }
    }

    const storage = getStorageManager().getAdapter();
    const settings = await getUserSettings();
    const understanding = await getPageUnderstanding(snapshot, aiEngine);
    logger.info('Page understanding result', { pageType: understanding.pageType });

    const extractedData = await aiEngine.extractData(snapshot, understanding);

    memorySystem.session.addExtractedData(extractedData);

    const dataPoint = {
      id: `${Date.now()}-${understanding.templateHash || 'unknown'}`,
      url: extractedData.url,
      timestamp: extractedData.timestamp,
      pageType: extractedData.pageType,
      platform: understanding.platform || 'unknown',
      metrics: Object.fromEntries(
        extractedData.metrics.map(m => [m.name, m.value]),
      ),
      snapshot,
      understanding,
    };

    await memorySystem.user.addDataPoint(dataPoint);

    const historyData = await memorySystem.user.getRecentDataPoints(7);
    const userActions = memorySystem.session.getRecentActions(20);

    const suggestions = await suggestionEngine.processPageData(
      extractedData,
      historyData,
      userActions,
      settings,
    );

    await storage.set('suggestions:current', suggestions);

    await sendMessage({
      type: MessageType.SUGGESTIONS_UPDATED,
      payload: suggestions,
      source: 'background',
      timestamp: Date.now(),
    });

    return createResponse(true, { understanding, extractedData, suggestions });
  } catch (error) {
    logger.error('DOM snapshot handling failed', error);
    return createResponse(false, undefined, String(error));
  }
}

async function handleUserAction(message: ChromeMessage): Promise<ChromeResponse> {
  if (!memorySystem) {
    await initializeEngines();
  }
  if (memorySystem) {
    const payload = message.payload as Record<string, unknown>;
    memorySystem.session.recordAction(
      (payload.type as 'click') || 'other',
      (payload.target as string) || '',
      (payload.pageUrl as string) || '',
      payload.value as string,
    );
  }
  return createResponse(true);
}

async function handlePageChanged(message: ChromeMessage): Promise<ChromeResponse> {
  const payload = message.payload as { url?: string };
  logger.debug('Page changed', { url: payload?.url });
  return createResponse(true);
}

async function getUserSettings(): Promise<UserSettings> {
  const storage = getStorageManager().getAdapter();
  const saved = await storage.get<Partial<UserSettings>>('settings:user');
  const defaults = getDefaultSettings();

  return {
    ...defaults,
    ...saved,
    anomalyThresholds: {
      ...defaults.anomalyThresholds,
      ...(saved?.anomalyThresholds || {}),
    },
    allowedDomains: saved?.allowedDomains || defaults.allowedDomains,
  };
}

async function getPageUnderstanding(
  snapshot: DOMSnapshot,
  engine: AIEngine,
): Promise<PageUnderstanding> {
  const storage = getStorageManager().getAdapter();
  const templateHash = computeTemplateHash(snapshot);
  const templateKey = `pageTemplates:${templateHash}`;
  const cached = await storage.get<PageTemplate>(templateKey);

  if (cached) {
    const updated: PageTemplate = {
      ...cached,
      lastUsedAt: Date.now(),
      hitCount: cached.hitCount + 1,
    };
    await storage.set(templateKey, updated);
    activityLogger.info('页面模板缓存命中，已复用历史识别结果', 'ai',
      `命中次数: ${updated.hitCount}`);
    return {
      ...cached.understanding,
      templateHash,
    };
  }

  const understanding = await engine.understandPage(snapshot);
  const template: PageTemplate = {
    hash: templateHash,
    urlPattern: normalizeUrlPattern(snapshot.url),
    understanding: {
      ...understanding,
      templateHash,
    },
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
    hitCount: 1,
  };

  await storage.set(templateKey, template);
  return template.understanding;
}

function computeTemplateHash(snapshot: DOMSnapshot): string {
  return hashString(`${normalizeUrlPattern(snapshot.url)}:${JSON.stringify(snapshot.tables.map(t => t.headers))}`);
}

function normalizeUrlPattern(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return rawUrl.split('?')[0] || rawUrl;
  }
}

async function handleGetSettings(): Promise<ChromeResponse> {
  const settings = await getUserSettings();
  return createResponse(true, settings);
}

function getDefaultSettings(): UserSettings {
  return {
    apiKey: '',
    allowedDomains: [],
    suggestionsEnabled: true,
    anomalyAlertsEnabled: true,
    efficiencyTipsEnabled: true,
    strategyAdviceEnabled: true,
    checkFrequency: 'realtime',
    sensitivity: 'medium',
    anomalyThresholds: {
      ctrDropPercent: 30,
      costSpikePercent: 50,
      cpaSurgePercent: 50,
      conversionDropPercent: 40,
    },
    theme: 'light',
    language: 'zh',
  };
}

async function handleUpdateSettings(message: ChromeMessage): Promise<ChromeResponse> {
  const storage = getStorageManager().getAdapter();
  const current = await getUserSettings();
  const settings = { ...current, ...(message.payload as Partial<UserSettings>) };
  await storage.set('settings:user', settings);

  if (aiEngine && settings.apiKey) {
    aiEngine.updateConfig({ apiKey: settings.apiKey });
  }

  return createResponse(true, settings);
}

async function handleGetSuggestions(): Promise<ChromeResponse> {
  const storage = getStorageManager().getAdapter();
  const suggestions = await storage.get('suggestions:current');
  return createResponse(true, suggestions || []);
}

async function handleDismissSuggestion(message: ChromeMessage): Promise<ChromeResponse> {
  const storage = getStorageManager().getAdapter();
  const suggestions = await storage.get<Array<{ id: string }>>('suggestions:current');
  const dismissId = (message.payload as { id: string })?.id;

  if (suggestions && dismissId) {
    const updated = suggestions.filter(s => s.id !== dismissId);
    await storage.set('suggestions:current', updated);
  }

  return createResponse(true);
}

async function handleExportData(message: ChromeMessage): Promise<ChromeResponse> {
  const payload = message.payload as { scope: ExportScope };
  const storage = getStorageManager().getAdapter();
  const data = await storage.export(payload.scope || 'all');
  return createResponse(true, data);
}

async function handleImportData(message: ChromeMessage): Promise<ChromeResponse> {
  const payload = message.payload as {
    data: { formatVersion: string; exportedAt: number; checksum: string; userMemory: unknown };
    strategy: MergeStrategy;
  };
  const storage = getStorageManager().getAdapter();

  try {
    const result = await storage.import(
      { ...payload.data, sourceDeviceId: (payload.data as Record<string, unknown>).sourceDeviceId as string || '' },
      payload.strategy,
    );
    return createResponse(true, result);
  } catch (error) {
    return createResponse(false, undefined, String(error));
  }
}

async function handleClearData(): Promise<ChromeResponse> {
  try {
    const storage = getStorageManager().getAdapter();
    await storage.clear();
    aiEngine = null;
    memorySystem = null;
    suggestionEngine = null;
    await initializeEngines();
    return createResponse(true);
  } catch (error) {
    return createResponse(false, undefined, String(error));
  }
}

async function handleTestApiKey(message: ChromeMessage): Promise<ChromeResponse> {
  const payload = message.payload as { apiKey: string };
  const result = await testApiConnection({
    apiKey: payload.apiKey,
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    maxTokens: 10,
    temperature: 0,
    timeout: 10000,
  });
  return createResponse(result.success, result, result.message);
}

async function handleOpenSidePanel(sender?: chrome.runtime.MessageSender): Promise<ChromeResponse> {
  try {
    const tabId = sender?.tab?.id || await getActiveTabId();
    if (!tabId || !chrome.sidePanel?.open) {
      return createResponse(false, undefined, '当前浏览器不支持打开侧边栏');
    }

    await chrome.sidePanel.open({ tabId });
    return createResponse(true);
  } catch (error) {
    return createResponse(false, undefined, String(error));
  }
}

async function handleRequestAnalysis(): Promise<ChromeResponse> {
  try {
    const tabId = await getActiveTabId();
    if (!tabId) {
      return createResponse(false, undefined, '未找到当前活动标签页');
    }

    const response = await chrome.tabs.sendMessage(tabId, {
      type: MessageType.CAPTURE_NOW,
      payload: { reason: 'manual' },
      source: 'background',
      timestamp: Date.now(),
    } satisfies ChromeMessage);

    return response || createResponse(true);
  } catch (error) {
    return createResponse(false, undefined, String(error));
  }
}

async function getActiveTabId(): Promise<number | undefined> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

async function handleGetActivityLogs(): Promise<ChromeResponse> {
  const logs = activityLogger.getLogs(200);
  const thinking = activityLogger.getThinkingProcesses();
  const conversations = activityLogger.getConversations(50);
  return createResponse(true, { logs, thinking, conversations });
}

async function handleClearActivityLogs(): Promise<ChromeResponse> {
  activityLogger.clearLogs();
  return createResponse(true);
}

function handleActivityLog(message: ChromeMessage): ChromeResponse {
  const payload = message.payload as { level: string; message: string; source: string; detail?: string; timestamp: number };
  if (payload && payload.message) {
    activityLogger.addEntry(
      (payload.level as 'info' | 'success' | 'warn' | 'error') || 'info',
      payload.message,
      (payload.source as 'system' | 'ai' | 'page' | 'user') || 'system',
      payload.detail,
    );
  }
  return createResponse(true);
}

function handleAIConversation(message: ChromeMessage): ChromeResponse {
  const payload = message.payload as { title: string; promptSummary: string; responseSummary: string; tokenUsed?: number; duration?: number; status: 'success' | 'error'; error?: string };
  if (payload && payload.title) {
    activityLogger.addConversation(payload);
  }
  return createResponse(true);
}
