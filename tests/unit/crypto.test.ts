import { describe, expect, it } from 'vitest';
import { decryptString, encryptString } from '../../src/lib/auth/crypto';

describe('token crypto', () => {
  it('round-trips a plaintext string through encrypt/decrypt', async () => {
    const plaintext = 'ya29.super-secret-access-token';
    const blob = await encryptString(plaintext);

    expect(blob.iv).not.toBe('');
    expect(blob.ciphertext).not.toContain(plaintext);

    const decrypted = await decryptString(blob);
    expect(decrypted).toBe(plaintext);
  });

  it('produces a different ciphertext each time (fresh IV)', async () => {
    const a = await encryptString('same-input');
    const b = await encryptString('same-input');
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  it('reuses the same key across calls so it persists across "restarts"', async () => {
    const blob = await encryptString('persisted-token');
    // Simulates a fresh module load reading the key back from chrome.storage.local.
    const decrypted = await decryptString(blob);
    expect(decrypted).toBe('persisted-token');
  });
});
