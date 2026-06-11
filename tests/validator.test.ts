import { describe, it, expect } from 'vitest';
import { validateApiKey, validateUrl, validateExportData } from '@app/utils/validator';

describe('validator', () => {
  describe('validateApiKey', () => {
    it('should accept valid API key', () => {
      const result = validateApiKey('sk-abc123def456ghi789jkl012mno345pqr678stu');
      expect(result.valid).toBe(true);
    });

    it('should reject empty key', () => {
      const result = validateApiKey('');
      expect(result.valid).toBe(false);
    });

    it('should reject key without sk- prefix', () => {
      const result = validateApiKey('abc123def456');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URL', () => {
      expect(validateUrl('https://api.deepseek.com').valid).toBe(true);
    });

    it('should reject invalid URL', () => {
      expect(validateUrl('not-a-url').valid).toBe(false);
    });

    it('should reject empty URL', () => {
      expect(validateUrl('').valid).toBe(false);
    });
  });

  describe('validateExportData', () => {
    it('should accept valid export data', () => {
      const result = validateExportData({
        formatVersion: '1.0.0',
        exportedAt: Date.now(),
        checksum: 'abc123',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject missing formatVersion', () => {
      const result = validateExportData({ exportedAt: Date.now(), checksum: 'abc' });
      expect(result.valid).toBe(false);
    });

    it('should reject null data', () => {
      const result = validateExportData(null);
      expect(result.valid).toBe(false);
    });
  });
});
