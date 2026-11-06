import { getBucket } from '../util/rateLimiter';

// Stay conservatively within Google Cloud's 'Units per minute per user' cap.
// Standard developer/test projects have a 250 units/min cap for this metric.
// Capacity 15 units, refill 3 units/sec (~180 units/min) keeps traffic safely under 250/min.
const CAPACITY = 15;
const REFILL_PER_SECOND = 3;

export const GMAIL_QUOTA_UNITS = {
  messagesList: 5,
  messagesGet: 5,
  messagesBatchModify: 50,
  messagesBatchDelete: 50,
  messagesTrash: 5,
  labelsList: 1,
  historyList: 2,
} as const;

export async function takeQuota(accountId: string, units: number): Promise<void> {
  await getBucket(`gmail:${accountId}`, CAPACITY, REFILL_PER_SECOND).take(units);
}

export function penalizeQuota(accountId: string, waitMs = 5000): void {
  getBucket(`gmail:${accountId}`, CAPACITY, REFILL_PER_SECOND).penalize(waitMs);
}
