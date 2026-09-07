import { describe, expect, it, vi } from 'vitest';
import { withBackoff } from '../../src/lib/util/backoff';

describe('withBackoff', () => {
  it('returns the result on first success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withBackoff(fn, () => ({ retry: false }));
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success when isRetryable says so', async () => {
    let attempts = 0;
    const fn = vi.fn().mockImplementation(async () => {
      attempts++;
      if (attempts < 3) throw new Error('transient');
      return 'ok';
    });

    const result = await withBackoff(fn, () => ({ retry: true, retryAfterMs: 1 }), {
      maxAttempts: 5,
    });
    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('gives up and rethrows once maxAttempts is reached', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    await expect(
      withBackoff(fn, () => ({ retry: true, retryAfterMs: 1 }), { maxAttempts: 3 }),
    ).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry when isRetryable returns false', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanent'));
    await expect(withBackoff(fn, () => ({ retry: false }))).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
