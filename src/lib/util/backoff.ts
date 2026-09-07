export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries `fn` with exponential backoff + jitter. `isRetryable` decides whether a thrown
 * error (or a returned Response with a non-2xx status) should trigger another attempt;
 * a `retryAfterMs` it returns overrides the computed backoff delay (honors `Retry-After`).
 */
export async function withBackoff<T>(
  fn: (attempt: number) => Promise<T>,
  isRetryable: (error: unknown, attempt: number) => { retry: boolean; retryAfterMs?: number },
  options: RetryOptions = {},
): Promise<T> {
  const { maxAttempts = 5, baseDelayMs = 500, maxDelayMs = 30_000 } = options;

  let attempt = 0;
  for (;;) {
    attempt++;
    try {
      return await fn(attempt);
    } catch (error) {
      const { retry, retryAfterMs } = isRetryable(error, attempt);
      if (!retry || attempt >= maxAttempts) throw error;

      const computed = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.random() * computed * 0.25;
      await sleep(retryAfterMs ?? computed + jitter);
    }
  }
}
