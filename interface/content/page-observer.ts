import { throttle } from '../../app/utils/throttle';
import { logger } from '../../app/utils/logger';
import { createMessage, MessageType, sendMessage } from '../messaging';

export class PageObserver {
  private observer: MutationObserver | null = null;
  private url: string;
  private clickHandler: ((event: MouseEvent) => void) | null = null;
  private inputHandler: ((event: Event) => void) | null = null;

  constructor() {
    this.url = window.location.href;
  }

  start(onStableChange?: () => void): void {
    const handleChange = throttle(() => {
      if (window.location.href !== this.url) {
        const previousUrl = this.url;
        this.url = window.location.href;
        logger.debug('URL changed', { url: this.url });
        sendMessage(createMessage(MessageType.PAGE_CHANGED, { url: this.url }));
        sendMessage(createMessage(MessageType.USER_ACTION, {
          type: 'navigate',
          target: new URL(this.url).pathname || '/',
          value: previousUrl,
          timestamp: Date.now(),
          pageUrl: this.url,
        }));
        sendMessage(createMessage(MessageType.ACTIVITY_LOG, {
          level: 'info',
          message: `页面切换至: ${new URL(this.url).pathname || '/'}`,
          source: 'page',
          timestamp: Date.now(),
        })).catch(() => {});
      }

      onStableChange?.();
    }, 2000);

    this.observer = new MutationObserver(handleChange);
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        logger.debug('Page became visible');
      }
    });

    sendMessage(createMessage(MessageType.ACTIVITY_LOG, {
      level: 'info',
      message: '页面监听已启动，正在追踪操作...',
      source: 'system',
      timestamp: Date.now(),
    })).catch(() => {});
    logger.info('PageObserver started');
  }

  trackUserInteractions(): void {
    let lastClickTime = 0;
    let lastLogTime = 0;
    const handleClick = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastClickTime < 1000) return;
      lastClickTime = now;

      const target = e.target as HTMLElement;
      const tag = target.tagName.toLowerCase();
      const text = target.textContent?.trim().substring(0, 50) || '';
      const id = target.id || '';
      const classes = target.className?.toString()?.substring(0, 100) || '';

      const actionTarget = id || `${tag}${classes ? '.' + classes.split(' ').slice(0, 2).join('.') : ''}: ${text}`;

      sendMessage(createMessage(MessageType.USER_ACTION, {
        type: 'click',
        target: actionTarget,
        timestamp: Date.now(),
        pageUrl: window.location.href,
      }));

      if (now - lastLogTime > 3000) {
        lastLogTime = now;
        const shortTarget = text || actionTarget.substring(0, 30);
        sendMessage(createMessage(MessageType.ACTIVITY_LOG, {
          level: 'info',
          message: `用户操作: 点击了 "${shortTarget}"`,
          source: 'user',
          detail: `元素: ${tag}${id ? '#' + id : ''}`,
          timestamp: Date.now(),
        })).catch(() => {});
      }
    };

    const handleInput = throttle((event: unknown) => {
      const target = (event as Event).target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (!target || !('value' in target)) return;

      const name = target.name || target.id || target.getAttribute('placeholder') || target.tagName.toLowerCase();
      const type = target.tagName.toLowerCase() === 'select' || /filter|筛选|搜索|search/i.test(name)
        ? 'filter'
        : 'input';
      const value = target.type === 'password' ? '***' : String(target.value || '').substring(0, 80);

      sendMessage(createMessage(MessageType.USER_ACTION, {
        type,
        target: name,
        value,
        timestamp: Date.now(),
        pageUrl: window.location.href,
      }));
    }, 1200);

    this.clickHandler = handleClick;
    this.inputHandler = handleInput;

    document.addEventListener('click', handleClick);
    document.addEventListener('change', handleInput, true);
    document.addEventListener('input', handleInput, true);

    logger.info('User interaction tracking started');
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
    if (this.inputHandler) {
      document.removeEventListener('change', this.inputHandler, true);
      document.removeEventListener('input', this.inputHandler, true);
      this.inputHandler = null;
    }
    logger.info('PageObserver stopped');
  }
}
