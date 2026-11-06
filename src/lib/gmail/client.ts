import type { Account } from '../../types/account';
import { ensureFreshAccessToken } from '../auth/refresh';
import { withBackoff } from '../util/backoff';
import { penalizeQuota } from './quota';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

export class GmailApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'GmailApiError';
  }
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 403 || status >= 500;
}

export async function gmailFetch(
  account: Account,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  return withBackoff(
    async () => {
      const token = await ensureFreshAccessToken(account);
      const response = await fetch(`${GMAIL_API_BASE}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${token}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });

      if (!response.ok) {
        const body = await response.clone().text();
        let message = `Gmail API ${response.status} on ${path}: ${body.slice(0, 300)}`;
        try {
          const parsed = JSON.parse(body);
          if (parsed?.error?.message) {
            message = parsed.error.message;
          }
        } catch {}

        let retryAfterSeconds: number | undefined;
        const retryHeader = response.headers.get('Retry-After');
        if (retryHeader) {
          const seconds = Number.parseInt(retryHeader, 10);
          if (!Number.isNaN(seconds) && seconds > 0) {
            retryAfterSeconds = seconds;
          }
        }

        throw new GmailApiError(message, response.status, body, retryAfterSeconds);
      }
      return response;
    },
    (error, attempt) => {
      if (!(error instanceof GmailApiError)) return { retry: false };
      if (!isRetryableStatus(error.status)) return { retry: false };

      let retryAfterMs: number | undefined;
      const msg = error.message.toLowerCase();
      let isQuota =
        error.status === 429 ||
        msg.includes('quota exceeded') ||
        msg.includes('rate limit') ||
        msg.includes('userRateLimitExceeded'.toLowerCase()) ||
        msg.includes('rateLimitExceeded'.toLowerCase());

      if (typeof error.body === 'string') {
        try {
          const parsed = JSON.parse(error.body);
          const reason = parsed?.error?.errors?.[0]?.reason;
          if (
            reason === 'rateLimitExceeded' ||
            reason === 'userRateLimitExceeded' ||
            reason === 'quotaExceeded'
          ) {
            isQuota = true;
          }
        } catch {
          // non-JSON body, ignore
        }
      }

      if (error.status === 403 && !isQuota) {
        return { retry: false };
      }

      if (error.retryAfterSeconds) {
        retryAfterMs = error.retryAfterSeconds * 1000;
      } else if (isQuota) {
        // "Units per minute per user" quota is evaluated over a 60-second rolling window.
        // Short delays fail repeatedly. Use progressive intervals long enough to allow the window to clear.
        const quotaDelays = [30_000, 45_000, 60_000, 75_000];
        retryAfterMs = quotaDelays[Math.min(attempt - 1, quotaDelays.length - 1)];
      }

      if (retryAfterMs) {
        penalizeQuota(account.id, retryAfterMs);
      }

      return { retry: true, retryAfterMs };
    },
    { maxAttempts: 5, baseDelayMs: 1000 },
  );
}

export async function gmailFetchJson<T>(
  account: Account,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await gmailFetch(account, path, init);
  return response.json() as Promise<T>;
}
