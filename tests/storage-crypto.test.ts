import { describe, it, expect } from 'vitest';
import { computeChecksum } from '@app/storage/crypto';

describe('crypto', () => {
  it('should compute SHA-256 checksum', async () => {
    const data = 'Hello, World!';
    const checksum = await computeChecksum(data);

    expect(checksum).toHaveLength(64);
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should produce different checksums for different data', async () => {
    const checksum1 = await computeChecksum('Hello');
    const checksum2 = await computeChecksum('World');

    expect(checksum1).not.toBe(checksum2);
  });

  it('should produce same checksum for same data', async () => {
    const data = 'Test Data';
    const checksum1 = await computeChecksum(data);
    const checksum2 = await computeChecksum(data);

    expect(checksum1).toBe(checksum2);
  });
});
