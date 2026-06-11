import type { NetworkRequestSnapshot } from '../../app/ai/types';

const MESSAGE_SOURCE = 'AI_AD_ASSISTANT_NETWORK_HOOK';
const MAX_REQUESTS = 40;

const requests: NetworkRequestSnapshot[] = [];
let started = false;

export function startNetworkCaptureListener(): void {
  if (started) return;
  started = true;

  window.addEventListener('message', (event) => {
    // Removed event.source !== window check — unreliable across MAIN/ISOLATED worlds
    const data = event.data as {
      source?: string;
      type?: string;
      payload?: NetworkRequestSnapshot;
    };
    if (!data || data.source !== MESSAGE_SOURCE || data.type !== 'network') return;
    if (!data.payload || !isUsefulPayload(data.payload)) return;

    requests.push(data.payload);
    // Copy response body to clipboard as formatted JSON
    try {
      const parsed = JSON.parse(data.payload.responseText);
      copyToClipboard(JSON.stringify(parsed, null, 2));
    } catch {
      copyToClipboard(data.payload.responseText);
    }
    if (requests.length > MAX_REQUESTS) {
      requests.splice(0, requests.length - MAX_REQUESTS);
    }
  });
}

export function getRecentNetworkRequests(limit = 20): NetworkRequestSnapshot[] {
  return requests.slice(-limit);
}

function isUsefulPayload(payload: NetworkRequestSnapshot): boolean {
  const contentType = payload.contentType.toLowerCase();
  const text = payload.responseText.trim();

  if (!payload.url || payload.status === 0) return false;
  if (contentType.includes('json')) return true;
  // Match common Java web backend action suffixes
  if (/\.(?:json|do|action|jsp|htm)(?:\?|$)/i.test(payload.url) && /^[{[]/.test(text)) return true;
  return /^[{[]/.test(text);
}

/**
 * Copy text to clipboard.
 * Uses navigator.clipboard on HTTPS; falls back to execCommand('copy') on HTTP.
 */
function copyToClipboard(text: string): void {
  try {
    // Prefer async clipboard API (works on HTTPS / localhost)
    navigator.clipboard.writeText(text).catch(() => {
      console.warn('[AI_WEB_HELPER] clipboard API failed, using fallback');
      fallbackCopy(text);
    });
    console.log('[AI_WEB_HELPER] Clipboard writeText called, len=' + text.length);
  } catch {
    console.warn('[AI_WEB_HELPER] clipboard API not available, using fallback');
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string): void {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}
