import type { Account } from '../../types/account';
import { ensureFreshAccessToken } from '../auth/refresh';
import { withBackoff } from '../util/backoff';

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1';

export class GmailApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
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
        throw new GmailApiError(
          `Gmail API ${response.status} on ${path}: ${body.slice(0, 300)}`,
          response.status,
          body,
        );
      }
      return response;
    },
    (error) => {
      if (!(error instanceof GmailApiError)) return { retry: false };
      if (!isRetryableStatus(error.status)) return { retry: false };

      let retryAfterMs: number | undefined;
      if (typeof error.body === 'string') {
        try {
          const parsed = JSON.parse(error.body);
          const reason = parsed?.error?.errors?.[0]?.reason;
          if (reason === 'rateLimitExceeded' || reason === 'userRateLimitExceeded' || error.status === 429) {
            retryAfterMs = undefined; // fall back to computed exponential backoff
          }
        } catch {
          // non-JSON body, ignore
        }
      }
      return { retry: true, retryAfterMs };
    },
    { maxAttempts: 6 },
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
