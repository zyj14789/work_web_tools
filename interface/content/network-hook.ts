(() => {
  const MESSAGE_SOURCE = 'AI_AD_ASSISTANT_NETWORK_HOOK';
  const MAX_TEXT_LENGTH = 120000;
  const MAX_POST_LENGTH = 30000;
  let seq = 0;

  const sensitiveKeyPattern = /(password|passwd|pwd|token|secret|authorization|cookie|session|api[_-]?key)/i;

  function post(payload: Record<string, unknown>) {
    try {
      window.postMessage({
        source: MESSAGE_SOURCE,
        type: 'network',
        payload,
      }, '*');
    } catch {
      // Ignore page-level messaging failures.
    }
  }

  function sanitizeText(value: unknown): string {
    const text = stringifyBody(value).slice(0, MAX_TEXT_LENGTH);
    return text
      .replace(/("(?:password|passwd|pwd|token|secret|authorization|cookie|session|api[_-]?key)"\s*:\s*)"[^"]*"/gi, '$1"***"')
      .replace(/((?:password|passwd|pwd|token|secret|authorization|cookie|session|api[_-]?key)=)[^&\s"]+/gi, '$1***')
      .slice(0, MAX_POST_LENGTH);
  }

  function stringifyBody(value: unknown): string {
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (value instanceof URLSearchParams) return value.toString();
    if (typeof FormData !== 'undefined' && value instanceof FormData) {
      const pairs: string[] = [];
      value.forEach((entryValue, key) => {
        pairs.push(`${key}=${sensitiveKeyPattern.test(key) ? '***' : String(entryValue).slice(0, 500)}`);
      });
      return pairs.join('&');
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) return `[Blob ${value.type || 'unknown'} ${value.size} bytes]`;
    if (value instanceof ArrayBuffer) return `[ArrayBuffer ${value.byteLength} bytes]`;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  function shouldCapture(contentType: string, url: string, text: string): boolean {
    const lowerType = contentType.toLowerCase();
    const trimmed = text.trim();
    if (lowerType.includes('json')) return true;
    // Match common Java web backend action suffixes
    if (/\.(?:json|do|action|jsp|htm)(?:\?|$)/i.test(url) && /^[{[]/.test(trimmed)) return true;
    return /^[{[]/.test(trimmed);
  }

  function getFetchUrl(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input.url;
  }

  function getFetchMethod(input: RequestInfo | URL, init?: RequestInit): string {
    if (init?.method) return init.method.toUpperCase();
    if (typeof input === 'object' && 'method' in input && input.method) return input.method.toUpperCase();
    return 'GET';
  }

  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const startedAt = Date.now();
      const response = await originalFetch.apply(this, [input, init] as Parameters<typeof fetch>);

      try {
        const clone = response.clone();
        const contentType = clone.headers.get('content-type') || '';
        const text = await clone.text();
        const url = response.url || getFetchUrl(input);

        if (shouldCapture(contentType, url, text)) {
          post({
            id: `fetch-${startedAt}-${++seq}`,
            url,
            method: getFetchMethod(input, init),
            status: response.status,
            contentType,
            timestamp: startedAt,
            duration: Date.now() - startedAt,
            requestBody: sanitizeText(init?.body),
            responseText: sanitizeText(text),
          });
          console.log('[AI_WEB_HELPER] Captured fetch:', getFetchMethod(input, init), url.slice(0, 120), response.status, contentType.slice(0, 40));
        } else {
          console.debug('[AI_WEB_HELPER] Skipped fetch:', getFetchMethod(input, init), url.slice(0, 120), response.status, `type=${contentType.slice(0, 40)} body_preview=${text.slice(0, 80)}`);
        }
      } catch (e) {
        console.error('[AI_WEB_HELPER] Fetch capture error:', (e as Error)?.message ?? e);
      }

      return response;
    };
  }

  const OriginalXHR = window.XMLHttpRequest;
  if (typeof OriginalXHR === 'function') {
    const originalOpen = OriginalXHR.prototype.open;
    const originalSend = OriginalXHR.prototype.send;

    OriginalXHR.prototype.open = function patchedOpen(method: string, url: string | URL, ...rest: unknown[]) {
      Object.defineProperty(this, '__aiAdRequestInfo', {
        value: {
          method: String(method || 'GET').toUpperCase(),
          url: String(url),
          startedAt: 0,
          requestBody: '',
        },
        configurable: true,
      });
      return originalOpen.apply(this, [method, url, ...rest] as Parameters<typeof originalOpen>);
    };

    OriginalXHR.prototype.send = function patchedSend(body?: Document | XMLHttpRequestBodyInit | null) {
      const info = (this as XMLHttpRequest & {
        __aiAdRequestInfo?: {
          method: string;
          url: string;
          startedAt: number;
          requestBody: string;
        };
      }).__aiAdRequestInfo;
      if (info) {
        info.startedAt = Date.now();
        info.requestBody = sanitizeText(body);
      }

      this.addEventListener('loadend', function onLoadEnd() {
        try {
          const reqInfo = (this as XMLHttpRequest & {
            __aiAdRequestInfo?: {
              method: string;
              url: string;
              startedAt: number;
              requestBody: string;
            };
          }).__aiAdRequestInfo;
          if (!reqInfo) return;

          const contentType = this.getResponseHeader('content-type') || '';
          let text = '';
          if (this.responseType === '' || this.responseType === 'text') {
            text = this.responseText || '';
          } else if (this.responseType === 'json') {
            text = stringifyBody(this.response);
          } else {
            // Fallback: try responseText even for non-standard responseTypes
            try { text = this.responseText || ''; } catch { text = ''; }
            if (!text) {
              try { text = stringifyBody(this.response); } catch { text = ''; }
            }
          }

            if (shouldCapture(contentType, reqInfo.url, text)) {
              post({
                id: `xhr-${reqInfo.startedAt}-${++seq}`,
                url: reqInfo.url,
                method: reqInfo.method,
                status: this.status,
                contentType,
                timestamp: reqInfo.startedAt,
                duration: Date.now() - reqInfo.startedAt,
                requestBody: reqInfo.requestBody,
                responseText: sanitizeText(text),
              });
              console.log('[AI_WEB_HELPER] Captured XHR:', reqInfo.method, reqInfo.url.slice(0, 120), this.status, contentType.slice(0, 40));
            } else {
              console.debug('[AI_WEB_HELPER] Skipped XHR:', reqInfo.method, reqInfo.url.slice(0, 120), this.status, `type=${contentType.slice(0, 40)} body_preview=${text.slice(0, 80)}`);
            }
        } catch (e) {
          console.error('[AI_WEB_HELPER] XHR capture error:', (e as Error)?.message ?? e);
        }
      });

      return originalSend.apply(this, [body] as Parameters<typeof originalSend>);
    };
  }
})();
