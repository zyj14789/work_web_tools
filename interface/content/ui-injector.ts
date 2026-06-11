import { logger } from '../../app/utils/logger';

const CONTAINER_ID = 'ai-ad-assistant-container';

export class UIInjector {
  private container: HTMLElement | null = null;
  private shadowRoot: ShadowRoot | null = null;
  private openHandler: (() => void) | null = null;

  inject(): void {
    if (document.getElementById(CONTAINER_ID)) {
      return;
    }

    this.container = document.createElement('div');
    this.container.id = CONTAINER_ID;
    this.container.style.cssText = `
      all: initial;
      position: fixed;
      top: 96px;
      right: 16px;
      width: 184px;
      height: auto;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    this.shadowRoot = this.container.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = this.getBaseStyles();
    this.shadowRoot.appendChild(style);

    const appRoot = document.createElement('div');
    appRoot.id = 'ai-ad-assistant-root';
    appRoot.innerHTML = `
      <div class="assistant-card">
        <div class="assistant-header">
          <span class="assistant-dot"></span>
          <span class="assistant-title">AI广告助手</span>
        </div>
        <div id="assistant-status" class="assistant-status">正在监听页面数据</div>
        <button id="assistant-open" type="button">打开侧边栏</button>
      </div>
    `;
    this.shadowRoot.appendChild(appRoot);

    document.body.appendChild(this.container);
    this.shadowRoot.getElementById('assistant-open')?.addEventListener('click', () => {
      this.openHandler?.();
    });
    logger.info('UI injected into page');
  }

  onOpenPanel(handler: () => void): void {
    this.openHandler = handler;
  }

  updateStatus(status: string): void {
    const el = this.shadowRoot?.getElementById('assistant-status');
    if (el) {
      el.textContent = status;
    }
  }

  getAppRoot(): HTMLElement | null {
    return this.shadowRoot?.getElementById('ai-ad-assistant-root') || null;
  }

  async highlightRows(selectors: string[]): Promise<void> {
    const doc = document;
    const styleId = 'ai-ad-highlight-style';

    let styleEl = doc.getElementById(styleId);
    if (!styleEl) {
      styleEl = doc.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        .ai-ad-assistant-highlight {
          background-color: rgba(255, 200, 0, 0.2) !important;
          border-left: 3px solid #f59e0b !important;
          transition: background-color 0.3s ease;
        }
        .ai-ad-assistant-highlight:hover {
          background-color: rgba(255, 200, 0, 0.35) !important;
        }
      `;
      doc.head.appendChild(styleEl);
    }

    for (const selector of selectors) {
      try {
        const elements = doc.querySelectorAll(selector);
        elements.forEach(el => {
          el.classList.add('ai-ad-assistant-highlight');
        });
      } catch (e) {
        logger.warn(`Failed to highlight selector: ${selector}`);
      }
    }

    logger.debug(`Highlighted ${selectors.length} selectors`);
  }

  clearHighlights(): void {
    document.querySelectorAll('.ai-ad-assistant-highlight').forEach(el => {
      el.classList.remove('ai-ad-assistant-highlight');
    });
  }

  remove(): void {
    this.clearHighlights();
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.shadowRoot = null;
    }

    const styleEl = document.getElementById('ai-ad-highlight-style');
    if (styleEl) {
      styleEl.remove();
    }

    logger.info('UI removed from page');
  }

  private getBaseStyles(): string {
    return `
      :host {
        all: initial;
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #1a1a2e;
        box-sizing: border-box;
      }

      *, *::before, *::after {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      h1 { font-size: 18px; font-weight: 700; }
      h2 { font-size: 16px; font-weight: 600; }
      h3 { font-size: 14px; font-weight: 600; }

      button {
        cursor: pointer;
        font-family: inherit;
        font-size: 13px;
        border: 1px solid #2563eb;
        border-radius: 6px;
        padding: 6px 10px;
        transition: all 0.2s;
        background: #2563eb;
        color: #ffffff;
        width: 100%;
      }
      button:hover { opacity: 0.85; }
      button:active { transform: scale(0.97); }

      .assistant-card {
        width: 184px;
        padding: 10px;
        border: 1px solid rgba(15, 23, 42, 0.12);
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.96);
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.18);
      }

      .assistant-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      }

      .assistant-dot {
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: #16a34a;
      }

      .assistant-title {
        font-size: 13px;
        font-weight: 700;
        color: #111827;
      }

      .assistant-status {
        min-height: 16px;
        margin-bottom: 8px;
        color: #6b7280;
        font-size: 12px;
        line-height: 16px;
      }

      input, select {
        font-family: inherit;
        font-size: 13px;
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        outline: none;
        transition: border-color 0.2s;
      }
      input:focus, select:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
    `;
  }
}
