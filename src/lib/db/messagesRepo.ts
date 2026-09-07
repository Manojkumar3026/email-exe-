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

export async function countByCategory(accountId?: string): Promise<Record<string, number>> {
  const collection = accountId ? db.messages.where('accountId').equals(accountId) : db.messages.toCollection();
  const counts: Record<string, number> = {};
  await collection.each((message) => {
    const category = message.category ?? 'other';
    counts[category] = (counts[category] ?? 0) + 1;
  });
  return counts;
}
