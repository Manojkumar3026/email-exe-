import { getBucket } from '../util/rateLimiter';

// Gmail API's default per-user quota is 250 units/sec; stay comfortably under it.
const CAPACITY = 200;
const REFILL_PER_SECOND = 200;

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
