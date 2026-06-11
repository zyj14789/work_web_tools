import { collectDOMSnapshot } from './dom-snapshot';
import { PageObserver } from './page-observer';
import { UIInjector } from './ui-injector';
import { startNetworkCaptureListener } from './network-observer';
import {
  createMessage,
  MessageType,
  sendMessage,
  createResponse,
  isExtensionContextInvalidated,
  type ChromeMessage,
  type ChromeResponse,
} from '../messaging';
import { logger } from '../../app/utils/logger';

class ContentScript {
  private observer: PageObserver;
  private ui: UIInjector;
  private initialized = false;
  private settings: {
    allowedDomains?: Array<{ domain: string; enabled: boolean }>;
    checkFrequency?: 'realtime' | '5min' | '15min' | 'manual';
  } | null = null;
  private analyzing = false;
  private lastCaptureAt = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private extensionContextInvalidated = false;

  constructor() {
    this.observer = new PageObserver();
    this.ui = new UIInjector();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    logger.info('Content script initializing');

    this.sendActivity('info', 'AI广告助手已加载', 'page',
      `页面: ${window.location.hostname}`);

    this.settings = await this.loadSettings();
    if (this.extensionContextInvalidated) return;

    const allowed = this.checkDomainAllowed(this.settings);
    if (!allowed) {
      logger.info('Domain not in whitelist, skipping activation');
      this.sendActivity('warn', '当前域名不在白名单中，插件未激活', 'system',
        `域名: ${window.location.hostname}`);
      return;
    }

    this.sendActivity('info', '域名白名单检查通过', 'system');

    this.setupMessageListener();
    this.observer.start(() => this.handleObservedPageChange());
    this.observer.trackUserInteractions();
    this.ui.onOpenPanel(() => {
      sendMessage(createMessage(MessageType.OPEN_SIDE_PANEL, undefined))
        .then((response) => {
          if (!response.success && isExtensionContextInvalidated(response.error)) {
            this.invalidateExtensionContext(response.error);
          }
        })
        .catch((error) => {
          if (isExtensionContextInvalidated(error)) {
            this.invalidateExtensionContext(error);
          }
        });
    });
    this.ui.inject();

    this.sendActivity('success', '侧边栏已注入页面', 'system');
    this.setupScheduledCapture(this.settings.checkFrequency || 'realtime');

    if (this.settings.checkFrequency === 'manual') {
      this.ui.updateStatus('手动分析模式');
      this.sendActivity('info', '当前为手动分析模式，可在侧边栏触发分析', 'system');
    } else {
      this.captureAndAnalyze('初始页面扫描', true);
    }
  }

  private async loadSettings(): Promise<{
    allowedDomains?: Array<{ domain: string; enabled: boolean }>;
    checkFrequency?: 'realtime' | '5min' | '15min' | 'manual';
  }> {
    try {
      const response = await sendMessage(
        createMessage(MessageType.GET_SETTINGS, undefined),
      );
      if (!response.success && isExtensionContextInvalidated(response.error)) {
        this.invalidateExtensionContext(response.error);
        return {};
      }
      if (!response.success || !response.data) return {};
      return response.data as {
        allowedDomains?: Array<{ domain: string; enabled: boolean }>;
        checkFrequency?: 'realtime' | '5min' | '15min' | 'manual';
      };
    } catch {
      return {};
    }
  }

  private checkDomainAllowed(settings: {
    allowedDomains?: Array<{ domain: string; enabled: boolean }>;
  } | null): boolean {
    const domains = settings?.allowedDomains || [];

    if (domains.length === 0) return true;

    const currentHost = window.location.hostname.toLowerCase();

    const matched = domains.some(
      d => d.enabled && (currentHost === d.domain.toLowerCase() || currentHost.endsWith('.' + d.domain.toLowerCase())),
    );

    if (!matched) {
      logger.info(`Domain "${currentHost}" not in whitelist`, { whitelist: domains.map(d => d.domain) });
    }

    return matched;
  }

  private setupMessageListener(): void {
    try {
      chrome.runtime.onMessage.addListener(
        (message: ChromeMessage, _sender, sendResponse) => {
          if (this.extensionContextInvalidated) {
            sendResponse(createResponse(false, undefined, 'Extension context invalidated'));
            return false;
          }
          if (message.source === 'background') {
            this.handleBackgroundMessage(message).then(sendResponse);
            return true;
          }
          return false;
        },
      );
    } catch (error) {
      if (isExtensionContextInvalidated(error)) {
        this.invalidateExtensionContext(error);
        return;
      }
      throw error;
    }
  }

  private async handleBackgroundMessage(message: ChromeMessage): Promise<ChromeResponse> {
    switch (message.type) {
      case MessageType.CAPTURE_NOW:
        await this.captureAndAnalyze('手动触发分析', true);
        return createResponse(true);

      case MessageType.HIGHLIGHT_ROWS:
        await this.ui.highlightRows((message.payload as { selectors: string[] })?.selectors || []);
        return createResponse(true);

      case MessageType.SHOW_NOTIFICATION:
        return createResponse(true);

      default:
        return createResponse(false, undefined, `Unknown message type: ${message.type}`);
    }
  }

  private handleObservedPageChange(): void {
    if (this.extensionContextInvalidated) return;
    if (this.settings?.checkFrequency !== 'realtime') return;
    this.captureAndAnalyze('页面变化检测');
  }

  private setupScheduledCapture(frequency: 'realtime' | '5min' | '15min' | 'manual'): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    const interval = frequency === '5min'
      ? 5 * 60 * 1000
      : frequency === '15min'
        ? 15 * 60 * 1000
        : 0;

    if (interval > 0) {
      this.intervalId = setInterval(() => {
        this.captureAndAnalyze(`定时分析(${frequency})`);
      }, interval);
    }
  }

  private async captureAndAnalyze(reason: string, force = false): Promise<void> {
    if (this.extensionContextInvalidated) return;

    const now = Date.now();
    if (this.analyzing) return;
    if (!force && now - this.lastCaptureAt < 15000) return;

    this.analyzing = true;
    this.lastCaptureAt = now;
    try {
      logger.info('Collecting snapshot', { reason });
      this.ui.updateStatus('正在扫描页面...');
      this.sendActivity('info', '正在扫描页面结构...', 'page', reason);

      const snapshot = collectDOMSnapshot();

      this.ui.updateStatus(`已扫描: ${snapshot.tables.length}表格/${snapshot.charts.length}图表`);
      this.sendActivity('success',
        `页面扫描完成：${snapshot.tables.length} 个表格, ${snapshot.charts.length} 个图表`,
        'page',
        `页面标题: ${snapshot.title}`);

      const response = await sendMessage(
        createMessage(MessageType.DOM_SNAPSHOT, snapshot),
      );

      if (!response.success) {
        if (isExtensionContextInvalidated(response.error)) {
          this.invalidateExtensionContext(response.error);
          return;
        }

        logger.error('Failed to send DOM snapshot', response.error);
        this.ui.updateStatus('分析失败');
        this.sendActivity('error', '页面数据发送失败', 'system', response.error);
      } else {
        const suggestions = (response.data as { suggestions?: unknown[] } | undefined)?.suggestions || [];
        this.ui.updateStatus(suggestions.length > 0 ? `发现 ${suggestions.length} 条建议` : '暂无异常建议');
        this.sendActivity('success', '页面数据已发送至AI引擎分析', 'system');
      }
    } catch (error) {
      if (isExtensionContextInvalidated(error)) {
        this.invalidateExtensionContext(error);
        return;
      }

      this.ui.updateStatus('分析失败');
      this.sendActivity('error', '页面分析失败', 'system', String(error));
    } finally {
      this.analyzing = false;
    }
  }

  private sendActivity(
    level: 'info' | 'success' | 'warn' | 'error',
    message: string,
    source: 'system' | 'page' | 'user' = 'system',
    detail?: string,
  ): void {
    if (this.extensionContextInvalidated) return;

    sendMessage(createMessage(MessageType.ACTIVITY_LOG, {
      level,
      message,
      source,
      detail,
      timestamp: Date.now(),
    })).then((response) => {
      if (!response.success && isExtensionContextInvalidated(response.error)) {
        this.invalidateExtensionContext(response.error);
      }
    }).catch((error) => {
      if (isExtensionContextInvalidated(error)) {
        this.invalidateExtensionContext(error);
      }
    });
  }

  private invalidateExtensionContext(reason?: unknown): void {
    if (this.extensionContextInvalidated) return;

    this.extensionContextInvalidated = true;
    this.analyzing = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.observer.stop();
    this.ui.updateStatus('扩展已重新加载，请刷新页面');
    logger.warn('Extension context invalidated; content script stopped. Refresh the page to attach the latest extension context.', reason);
  }
}

const contentScript = new ContentScript();
startNetworkCaptureListener();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => contentScript.initialize());
} else {
  contentScript.initialize();
}
