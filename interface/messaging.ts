export enum MessageType {
  PAGE_LOADED = 'page:loaded',
  DOM_SNAPSHOT = 'dom:snapshot',
  USER_ACTION = 'user:action',
  PAGE_CHANGED = 'page:changed',

  INJECT_UI = 'ui:inject',
  HIGHLIGHT_ROWS = 'ui:highlight',
  SHOW_NOTIFICATION = 'ui:notify',
  OPEN_SIDE_PANEL = 'ui:open-side-panel',
  CAPTURE_NOW = 'page:capture-now',
  REQUEST_ANALYSIS = 'analysis:request',

  GET_SETTINGS = 'settings:get',
  UPDATE_SETTINGS = 'settings:update',
  GET_SUGGESTIONS = 'suggestions:get',
  DISMISS_SUGGESTION = 'suggestion:dismiss',
  EXPORT_DATA = 'data:export',
  IMPORT_DATA = 'data:import',
  CLEAR_DATA = 'data:clear',
  TEST_API_KEY = 'api:test',

  SETTINGS_UPDATED = 'settings:updated',
  SUGGESTIONS_UPDATED = 'suggestions:updated',
  EXPORT_READY = 'export:ready',
  IMPORT_COMPLETE = 'import:complete',

  ACTIVITY_LOG = 'activity:log',
  THINKING_UPDATE = 'thinking:update',
  AI_CONVERSATION = 'ai:conversation',
  GET_ACTIVITY_LOGS = 'activity:get',
  CLEAR_ACTIVITY_LOGS = 'activity:clear',
}

export interface ChromeMessage<T = unknown> {
  type: MessageType;
  payload?: T;
  source: 'content' | 'background' | 'popup' | 'sidepanel';
  timestamp: number;
}

export interface ChromeResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function createMessage<T>(type: MessageType, payload?: T, source: ChromeMessage['source'] = 'content'): ChromeMessage<T> {
  return {
    type,
    payload,
    source,
    timestamp: Date.now(),
  };
}

export function createResponse<T>(success: boolean, data?: T, error?: string): ChromeResponse<T> {
  return { success, data, error };
}

export function isExtensionContextInvalidated(error?: unknown): boolean {
  return String(error || '').toLowerCase().includes('extension context invalidated');
}

export function sendMessage<T, R = unknown>(message: ChromeMessage<T>): Promise<ChromeResponse<R>> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
        resolve(createResponse(false, undefined, 'Extension context invalidated') as ChromeResponse<R>);
        return;
      }

      chrome.runtime.sendMessage(message, (response: ChromeResponse<R>) => {
        if (chrome.runtime.lastError) {
          resolve(createResponse(false, undefined, chrome.runtime.lastError.message) as ChromeResponse<R>);
        } else {
          resolve(response || (createResponse(false, undefined, 'No response') as ChromeResponse<R>));
        }
      });
    } catch (error) {
      resolve(createResponse(false, undefined, String(error)) as ChromeResponse<R>);
    }
  });
}
