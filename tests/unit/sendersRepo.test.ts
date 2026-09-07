import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../../src/lib/db/db';
import { adjustSenderAfterRemoval, listSenders, upsertSenderAggregatesForMessages } from '../../src/lib/db/sendersRepo';
import { makeSenderKey } from '../../src/types/sender';
import type { EmailMessage } from '../../src/types/email';

const accountId = 'gmail:user@example.com';

function makeMessage(id: string, overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    id,
    accountId,
    senderEmail: 'amazon@amazon.com',
    senderName: 'Amazon',
    subject: 'Your order',
    receivedAt: Date.now(),
    sizeEstimateBytes: 5000,
    labels: ['INBOX'],
    hasListUnsubscribe: false,
    isRead: true,
    category: 'shopping',
    ...overrides,
  };
}

beforeEach(async () => {
  await db.senders.clear();
  await db.messages.clear();
});

describe('sendersRepo aggregation', () => {
  it('creates a new aggregate from a first batch of messages', async () => {
    await upsertSenderAggregatesForMessages([
      makeMessage('m1', { receivedAt: 1000, isRead: false }),
      makeMessage('m2', { receivedAt: 2000, isRead: true }),
    ]);

    const senders = await listSenders(accountId);
    expect(senders).toHaveLength(1);
    expect(senders[0].messageCount).toBe(2);
    expect(senders[0].totalSizeBytes).toBe(10000);
    expect(senders[0].unreadCount).toBe(1);
    expect(senders[0].firstSeenAt).toBe(1000);
    expect(senders[0].lastSeenAt).toBe(2000);
  });

  it('folds a second batch into the existing aggregate incrementally', async () => {
    await upsertSenderAggregatesForMessages([makeMessage('m1', { receivedAt: 1000 })]);
    await upsertSenderAggregatesForMessages([makeMessage('m2', { receivedAt: 5000, sizeEstimateBytes: 2000 })]);

    const senders = await listSenders(accountId);
    expect(senders[0].messageCount).toBe(2);
    expect(senders[0].totalSizeBytes).toBe(7000);
    expect(senders[0].lastSeenAt).toBe(5000);
  });

  it('reduces the aggregate on removal and deletes it once the count hits zero', async () => {
    await upsertSenderAggregatesForMessages([
      makeMessage('m1', { receivedAt: 1000 }),
      makeMessage('m2', { receivedAt: 2000 }),
    ]);
    const key = makeSenderKey(accountId, 'amazon@amazon.com');

    await adjustSenderAfterRemoval(key, 1, 5000);
    let senders = await listSenders(accountId);
    expect(senders[0].messageCount).toBe(1);

    await adjustSenderAfterRemoval(key, 1, 5000);
    senders = await listSenders(accountId);
    expect(senders).toHaveLength(0);
  });
});
