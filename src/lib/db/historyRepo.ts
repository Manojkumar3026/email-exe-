import { db } from './db';
import type { CleanupHistoryEntry } from '../../types/history';

export async function recordHistoryEntry(
  entry: Omit<CleanupHistoryEntry, 'id' | 'timestamp'>,
): Promise<void> {
  const record: CleanupHistoryEntry = { ...entry, id: crypto.randomUUID(), timestamp: Date.now() };
  await db.cleanupHistory.put(record);
}

export async function listHistory(accountId?: string, limit = 200): Promise<CleanupHistoryEntry[]> {
  const collection = accountId
    ? db.cleanupHistory.where('accountId').equals(accountId)
    : db.cleanupHistory.toCollection();
  const entries = await collection.reverse().sortBy('timestamp');
  return entries.slice(0, limit);
}
