import { db } from './db';
import type { EmailMessage } from '../../types/email';

export async function upsertMessages(messages: EmailMessage[]): Promise<void> {
  await db.messages.bulkPut(messages);
}

export async function getMessage(id: string): Promise<EmailMessage | undefined> {
  return db.messages.get(id);
}

export async function countMessages(accountId?: string): Promise<number> {
  if (accountId) return db.messages.where('accountId').equals(accountId).count();
  return db.messages.count();
}

export async function listMessagesBySender(
  accountId: string,
  senderEmail: string,
  limit = 500,
): Promise<EmailMessage[]> {
  return db.messages
    .where('[accountId+senderEmail]')
    .equals([accountId, senderEmail])
    .limit(limit)
    .toArray();
}

export async function getMostRecentMessageForSender(
  accountId: string,
  senderEmail: string,
): Promise<EmailMessage | undefined> {
  const rows = await db.messages.where('[accountId+senderEmail]').equals([accountId, senderEmail]).toArray();
  return rows.reduce<EmailMessage | undefined>(
    (latest, m) => (!latest || m.receivedAt > latest.receivedAt ? m : latest),
    undefined,
  );
}

export async function listMessageIdsBySender(
  accountId: string,
  senderEmail: string,
): Promise<string[]> {
  const rows = await db.messages
    .where('[accountId+senderEmail]')
    .equals([accountId, senderEmail])
    .primaryKeys();
  return rows as string[];
}

export async function deleteMessagesByIds(ids: string[]): Promise<void> {
  await db.messages.bulkDelete(ids);
}

/** Scans the account's messages once to bucket counts by month. O(n) over stored messages —
 *  acceptable as an on-demand analytics computation, not something run on every render. */
export async function getMonthlyMessageCounts(
  accountId: string,
  monthsBack = 6,
): Promise<{ month: string; count: number }[]> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - (monthsBack - 1));
  cutoff.setDate(1);
  cutoff.setHours(0, 0, 0, 0);

  const buckets = new Map<string, number>();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(cutoff);
    d.setMonth(d.getMonth() + i);
    buckets.set(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, 0);
  }

  await db.messages
    .where('accountId')
    .equals(accountId)
    .and((m) => m.receivedAt >= cutoff.getTime())
    .each((m) => {
      const d = new Date(m.receivedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    });

  return [...buckets.entries()].map(([month, count]) => ({ month, count }));
}

export async function countByCategory(accountId?: string): Promise<Record<string, number>> {
  const collection = accountId ? db.messages.where('accountId').equals(accountId) : db.messages.toCollection();
  const counts: Record<string, number> = {};
  await collection.each((message) => {
    const category = message.category ?? 'other';
    counts[category] = (counts[category] ?? 0) + 1;
  });
  return counts;
}
