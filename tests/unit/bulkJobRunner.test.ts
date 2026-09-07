import { describe, expect, it, vi, beforeEach } from 'vitest';
import { db } from '../../src/lib/db/db';
import { createJob, getJob } from '../../src/lib/db/jobsRepo';
import { upsertMessages } from '../../src/lib/db/messagesRepo';
import { upsertSenderAggregatesForMessages } from '../../src/lib/db/sendersRepo';
import { upsertAccount } from '../../src/lib/db/accountsRepo';
import { listHistory } from '../../src/lib/db/historyRepo';
import { makeSenderKey } from '../../src/types/sender';
import type { EmailMessage } from '../../src/types/email';
import type { Account } from '../../src/types/account';

vi.mock('../../src/lib/gmail/messages', () => ({
  trashMessages: vi.fn(async (_account: unknown, ids: string[]) => ({
    successIds: ids.slice(0, -1),
    failedIds: ids.slice(-1),
  })),
  archiveMessages: vi.fn(async (_account: unknown, ids: string[]) => ({ successIds: ids, failedIds: [] })),
  markRead: vi.fn(async (_account: unknown, ids: string[]) => ({ successIds: ids, failedIds: [] })),
  permanentlyDeleteMessages: vi.fn(async (_account: unknown, ids: string[]) => ({
    successIds: ids,
    failedIds: [],
  })),
}));

const { processJobToCompletion } = await import('../../src/background/bulkJobRunner');

const account: Account = {
  id: 'gmail:user@example.com',
  provider: 'gmail',
  emailAddress: 'user@example.com',
  connectedAt: Date.now(),
  status: 'connected',
};

function makeMessages(count: number): EmailMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `msg-${i}`,
    accountId: account.id,
    senderEmail: 'amazon@amazon.com',
    senderName: 'Amazon',
    subject: 'Order update',
    receivedAt: Date.now() - i * 1000,
    sizeEstimateBytes: 1000,
    labels: ['INBOX'],
    hasListUnsubscribe: false,
    isRead: false,
    category: 'shopping' as const,
  }));
}

beforeEach(async () => {
  await db.accounts.clear();
  await db.messages.clear();
  await db.senders.clear();
  await db.jobs.clear();
  await db.cleanupHistory.clear();
  await upsertAccount(account);
});

describe('processJobToCompletion', () => {
  it('processes all messages, records success/failure counts, and removes deleted messages locally', async () => {
    const messages = makeMessages(5);
    await upsertMessages(messages);
    await upsertSenderAggregatesForMessages(messages);

    const job = await createJob(account.id, 'delete', messages.map((m) => m.id));
    await processJobToCompletion(job.id);

    const finished = await getJob(job.id);
    expect(finished?.status).toBe('completed');
    expect(finished?.processedCount).toBe(5);
    expect(finished?.successCount).toBe(4); // mocked trashMessages fails the last id in each chunk
    expect(finished?.failedCount).toBe(1);

    const remaining = await db.messages.toArray();
    expect(remaining).toHaveLength(1); // only the failed one stays

    const sender = await db.senders.get(makeSenderKey(account.id, 'amazon@amazon.com'));
    expect(sender?.messageCount).toBe(1);

    const history = await listHistory(account.id);
    expect(history).toHaveLength(1);
    expect(history[0].messageCount).toBe(4);
    expect(history[0].undoable).toBe(true);
  });

  it('marks a job with zero targets as completed immediately', async () => {
    const job = await createJob(account.id, 'archive', []);
    await processJobToCompletion(job.id);
    const finished = await getJob(job.id);
    expect(finished?.status).toBe('completed');
    expect(finished?.totalCount).toBe(0);
  });

  it('stops processing once a job is cancelled mid-run', async () => {
    const messages = makeMessages(3);
    await upsertMessages(messages);
    await upsertSenderAggregatesForMessages(messages);

    const job = await createJob(account.id, 'archive', messages.map((m) => m.id));
    await db.jobs.update(job.id, { status: 'cancelled' });
    await processJobToCompletion(job.id);

    const finished = await getJob(job.id);
    expect(finished?.status).toBe('cancelled');
    expect(finished?.processedCount).toBe(0);
  });
});
