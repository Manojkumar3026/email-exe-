import { db } from './db';
import type { EmailMessage } from '../../types/email';
import type { SenderAggregate } from '../../types/sender';
import { makeSenderKey } from '../../types/sender';

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function computeFrequencyPerWeek(messageCount: number, firstSeenAt: number, lastSeenAt: number): number {
  const spanWeeks = Math.max((lastSeenAt - firstSeenAt) / MS_PER_WEEK, 1);
  return messageCount / spanWeeks;
}

/**
 * Incrementally folds a batch of newly-synced (already categorized) messages into the
 * `senders` aggregate table. Never recomputes aggregates via a full table scan, so this
 * stays fast even with 100k+ messages already stored.
 */
export async function upsertSenderAggregatesForMessages(messages: EmailMessage[]): Promise<void> {
  if (messages.length === 0) return;

  const grouped = new Map<string, EmailMessage[]>();
  for (const message of messages) {
    const key = makeSenderKey(message.accountId, message.senderEmail);
    const group = grouped.get(key);
    if (group) group.push(message);
    else grouped.set(key, [message]);
  }

  await db.transaction('rw', db.senders, async () => {
    for (const [key, group] of grouped) {
      const existing = await db.senders.get(key);
      const newest = group.reduce((a, b) => (a.receivedAt >= b.receivedAt ? a : b));
      const oldestInBatch = group.reduce((a, b) => (a.receivedAt <= b.receivedAt ? a : b));

      const messageCount = (existing?.messageCount ?? 0) + group.length;
      const totalSizeBytes = (existing?.totalSizeBytes ?? 0) + group.reduce((sum, m) => sum + m.sizeEstimateBytes, 0);
      const firstSeenAt = Math.min(existing?.firstSeenAt ?? Infinity, oldestInBatch.receivedAt);
      const lastSeenAt = Math.max(existing?.lastSeenAt ?? -Infinity, newest.receivedAt);
      const unreadCount = (existing?.unreadCount ?? 0) + group.filter((m) => !m.isRead).length;
      const hasListUnsubscribe = existing?.hasListUnsubscribe || group.some((m) => m.hasListUnsubscribe);

      const useNewCategory = !existing || newest.receivedAt >= existing.lastSeenAt;
      const category = useNewCategory ? newest.category ?? existing?.category ?? 'other' : existing.category;

      const aggregate: SenderAggregate = {
        key,
        senderEmail: newest.senderEmail,
        senderName: newest.senderName ?? existing?.senderName,
        accountId: newest.accountId,
        messageCount,
        totalSizeBytes,
        firstSeenAt,
        lastSeenAt,
        frequencyPerWeek: computeFrequencyPerWeek(messageCount, firstSeenAt, lastSeenAt),
        category,
        hasListUnsubscribe,
        unreadCount,
      };

      await db.senders.put(aggregate);
    }
  });
}

export async function listSenders(accountId?: string): Promise<SenderAggregate[]> {
  if (accountId) return db.senders.where('accountId').equals(accountId).toArray();
  return db.senders.toArray();
}

export async function getSender(key: string): Promise<SenderAggregate | undefined> {
  return db.senders.get(key);
}

export async function removeSenderAggregate(key: string): Promise<void> {
  await db.senders.delete(key);
}

export async function adjustSenderAfterRemoval(
  key: string,
  removedCount: number,
  removedBytes: number,
): Promise<void> {
  await db.transaction('rw', db.senders, async () => {
    const existing = await db.senders.get(key);
    if (!existing) return;
    const messageCount = Math.max(0, existing.messageCount - removedCount);
    if (messageCount === 0) {
      await db.senders.delete(key);
      return;
    }
    await db.senders.update(key, {
      messageCount,
      totalSizeBytes: Math.max(0, existing.totalSizeBytes - removedBytes),
    });
  });
}
