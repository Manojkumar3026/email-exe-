import Dexie, { type EntityTable } from 'dexie';
import type { Account } from '../../types/account';
import type { EmailMessage } from '../../types/email';
import type { SenderAggregate } from '../../types/sender';
import type { CleanupHistoryEntry } from '../../types/history';
import type { BulkActionJob } from '../../types/job';

export interface SyncStateRecord {
  accountId: string;
  cursor?: string; // gmail historyId or graph deltaLink
  lastFullSyncAt?: number;
  lastIncrementalSyncAt?: number;
}

export type InboxCleanerDB = Dexie & {
  accounts: EntityTable<Account, 'id'>;
  messages: EntityTable<EmailMessage, 'id'>;
  senders: EntityTable<SenderAggregate, 'key'>;
  cleanupHistory: EntityTable<CleanupHistoryEntry, 'id'>;
  jobs: EntityTable<BulkActionJob, 'id'>;
  syncState: EntityTable<SyncStateRecord, 'accountId'>;
};

export function createDB(): InboxCleanerDB {
  const db = new Dexie('inbox-cleaner-db') as InboxCleanerDB;

  db.version(1).stores({
    accounts: 'id, provider, status',
    messages: 'id, accountId, senderEmail, category, receivedAt, [accountId+senderEmail], [accountId+category]',
    senders: 'key, accountId, category, messageCount, totalSizeBytes, lastSeenAt, [accountId+category]',
    cleanupHistory: 'id, accountId, timestamp, actionType',
    jobs: 'id, status, accountId',
    syncState: 'accountId',
  });

  return db;
}
