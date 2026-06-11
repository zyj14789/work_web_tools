import type { AIConfig } from '../../app/ai/types';
import { logger } from '../../app/utils/logger';
import { delay } from '../../app/utils/throttle';

const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

export async function callDeepSeekAPI(
  prompt: string,
  config: AIConfig,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

      const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content: '你是一个广告数据分析助手。请严格按JSON格式返回结果，不要包含其他文字。',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: config.maxTokens,
          temperature: config.temperature,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API returned ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return jsonMatch ? jsonMatch[0] : content;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`API call attempt ${attempt + 1}/${MAX_RETRIES} failed`, lastError.message);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('API request timeout');
      }

      if (attempt < MAX_RETRIES - 1) {
        const backoff = BASE_DELAY * Math.pow(2, attempt);
        await delay(backoff);
      }
    }
  }

  throw lastError || new Error('API call failed');
}

export async function testApiConnection(config: AIConfig): Promise<{ success: boolean; message: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          { role: 'user', content: 'Hello' },
        ],
        max_tokens: 10,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true, message: 'API连接成功' };
    } else if (response.status === 401) {
      return { success: false, message: 'API Key无效，请检查配置' };
    } else {
      return { success: false, message: `API返回错误: ${response.status}` };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `连接失败: ${msg}` };
  }
}
