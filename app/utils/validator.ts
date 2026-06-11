const API_KEY_REGEX = /^sk-[a-zA-Z0-9]{32,}$/;
const URL_REGEX = /^https?:\/\/.+/;

export function validateApiKey(key: string): { valid: boolean; message: string } {
  if (!key || key.trim().length === 0) {
    return { valid: false, message: 'API Key不能为空' };
  }
  if (!API_KEY_REGEX.test(key.trim())) {
    return { valid: false, message: 'API Key格式不正确，应以sk-开头' };
  }
  return { valid: true, message: 'API Key格式有效' };
}

export function validateUrl(url: string): { valid: boolean; message: string } {
  if (!url || url.trim().length === 0) {
    return { valid: false, message: 'URL不能为空' };
  }
  try {
    new URL(url.trim());
    return { valid: true, message: 'URL格式有效' };
  } catch {
    return { valid: false, message: 'URL格式不正确' };
  }
}

export function validateExportData(data: unknown): { valid: boolean; message: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, message: '数据格式无效' };
  }
  const d = data as Record<string, unknown>;
  if (!d.formatVersion || typeof d.formatVersion !== 'string') {
    return { valid: false, message: '缺少formatVersion字段' };
  }
  if (!d.exportedAt || typeof d.exportedAt !== 'number') {
    return { valid: false, message: '缺少exportedAt字段' };
  }
  if (!d.checksum || typeof d.checksum !== 'string') {
    return { valid: false, message: '缺少checksum字段' };
  }
  return { valid: true, message: '数据格式有效' };
}
