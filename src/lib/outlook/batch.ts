import type { Account } from '../../types/account';
import { chunk } from '../util/chunk';
import { graphFetchJson } from './client';

export interface GraphBatchRequest {
  id: string;
  method: 'GET' | 'PATCH' | 'DELETE' | 'POST';
  url: string; // relative to v1.0, e.g. "/me/messages/{id}"
  body?: unknown;
}

interface GraphBatchResponseItem {
  id: string;
  status: number;
  body?: unknown;
}

interface GraphBatchResponse {
  responses: GraphBatchResponseItem[];
}

const MAX_BATCH_SIZE = 20;
const MAX_CONCURRENT_BATCHES = 4;

/** Executes an arbitrary set of Graph requests via $batch, chunked at 20/call with capped
 *  concurrency. Returns a map of request id -> whether it succeeded (2xx). */
export async function executeGraphBatch(
  account: Account,
  requests: GraphBatchRequest[],
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  const chunks = chunk(requests, MAX_BATCH_SIZE);
  const queue = [...chunks];

  async function worker() {
    for (;;) {
      const batch = queue.shift();
      if (!batch) return;
      try {
        const response = await graphFetchJson<GraphBatchResponse>(account, '/$batch', {
          method: 'POST',
          body: JSON.stringify({
            requests: batch.map((r) => ({
              id: r.id,
              method: r.method,
              url: r.url,
              ...(r.body ? { body: r.body, headers: { 'Content-Type': 'application/json' } } : {}),
            })),
          }),
        });
        for (const item of response.responses) {
          results.set(item.id, item.status >= 200 && item.status < 300);
        }
      } catch {
        for (const r of batch) results.set(r.id, false);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_BATCHES, chunks.length) }, worker));
  return results;
}
