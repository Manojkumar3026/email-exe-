import type { Account } from '../../types/account';
import { ensureFreshAccessToken } from '../auth/refresh';
import { withBackoff } from '../util/backoff';
import { getBucket } from '../util/rateLimiter';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export class GraphApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'GraphApiError';
  }
}

// Graph doesn't publish a fixed per-second quota the way Gmail does; this cap keeps request
// concurrency conservative regardless.
export function graphBucket(accountId: string) {
  return getBucket(`graph:${accountId}`, 10, 10);
}

export async function graphFetch(account: Account, path: string, init: RequestInit = {}): Promise<Response> {
  return withBackoff(
    async () => {
      await graphBucket(account.id).take();
      const token = await ensureFreshAccessToken(account);
      const url = path.startsWith('http') ? path : `${GRAPH_BASE}${path}`;
      const response = await fetch(url, {
        ...init,
        headers: {
          ...init.headers,
          Authorization: `Bearer ${token}`,
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        },
      });

      if (!response.ok) {
        const retryAfterHeader = response.headers.get('Retry-After');
        const body = await response.clone().text();
        throw new GraphApiError(
          `Graph API ${response.status} on ${path}: ${body.slice(0, 300)}`,
          response.status,
          retryAfterHeader ? Number(retryAfterHeader) : undefined,
        );
      }
      return response;
    },
    (error) => {
      if (!(error instanceof GraphApiError)) return { retry: false };
      if (error.status !== 429 && error.status < 500) return { retry: false };
      return { retry: true, retryAfterMs: error.retryAfterSeconds ? error.retryAfterSeconds * 1000 : undefined };
    },
    { maxAttempts: 6 },
  );
}

export async function graphFetchJson<T>(account: Account, path: string, init?: RequestInit): Promise<T> {
  const response = await graphFetch(account, path, init);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
