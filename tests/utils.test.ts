import { describe, it, expect } from 'vitest';
import { generateId, hashString, delay, throttle, debounce } from '@app/utils/throttle';

describe('utility functions', () => {
  describe('generateId', () => {
    it('should generate non-empty string', () => {
      const id = generateId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe('string');
    });

    it('should generate unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()));
      expect(ids.size).toBe(100);
    });
  });

  describe('hashString', () => {
    it('should produce consistent hash', () => {
      expect(hashString('hello')).toBe(hashString('hello'));
    });

    it('should produce different hash for different input', () => {
      expect(hashString('hello')).not.toBe(hashString('world'));
    });
  });

  describe('delay', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      await delay(10);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(5);
    });
  });

  describe('throttle', () => {
    it('should call function immediately on first call', () => {
      let calls = 0;
      const fn = throttle(() => { calls++; }, 100);

      fn();
      expect(calls).toBe(1);
    });

    it('should throttle subsequent calls', () => {
      let calls = 0;
      const fn = throttle(() => { calls++; }, 100);

      fn();
      fn();
      fn();

      expect(calls).toBe(1);
    });
  });

  describe('debounce', () => {
    it('should debounce rapid calls', async () => {
      let calls = 0;
      const fn = debounce(() => { calls++; }, 20);

      fn();
      fn();
      fn();

      expect(calls).toBe(0);

      await delay(30);
      expect(calls).toBe(1);
    });
  });
});
