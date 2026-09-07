// Incremental, resumable sync per account. Each call processes one bounded chunk (a single
// Gmail list page, ~500 messages) so a single invocation finishes well within the MV3 service
// worker's idle-termination window. Progress (page token / history cursor) is persisted to
// IndexedDB after every chunk, so a killed worker picks up exactly where it left off on the
// next alarm-triggered wake rather than losing progress or re-downloading everything.

import { db } from '../lib/db/db';
import { getAccount, updateAccountStatus } from '../lib/db/accountsRepo';
import { upsertMessages, deleteMessagesByIds, getMessage } from '../lib/db/messagesRepo';
import { upsertSenderAggregatesForMessages, adjustSenderAfterRemoval } from '../lib/db/sendersRepo';
import { categorizeAll } from '../lib/categorization/engine';
import {
  getMessagesMetadata,
  getProfile,
  listHistoryDelta,
  listMessageIds,
} from '../lib/gmail/messages';
import { makeSenderKey } from '../types/sender';
import type { Account } from '../types/account';

export interface SyncChunkResult {
  processedCount: number;
  hasMore: boolean;
}

async function getSyncState(accountId: string) {
  return db.syncState.get(accountId);
}

async function saveSyncState(accountId: string, patch: Partial<{ cursor: string; lastFullSyncAt: number; lastIncrementalSyncAt: number }>) {
  const existing = await getSyncState(accountId);
  await db.syncState.put({ accountId, ...existing, ...patch });
}

async function runFullSyncChunk(account: Account): Promise<SyncChunkResult> {
  const state = await getSyncState(account.id);
  const page = await listMessageIds(account, { pageToken: state?.cursor, maxResults: 250 });

  const rawMessages = await getMessagesMetadata(account, page.ids);
  const categorized = categorizeAll(rawMessages);

  await upsertMessages(categorized);
  await upsertSenderAggregatesForMessages(categorized);

  if (page.nextPageToken) {
    await saveSyncState(account.id, { cursor: page.nextPageToken });
    return { processedCount: categorized.length, hasMore: true };
  }

  // Full baseline sync finished — capture the current historyId so future runs can switch
  // to cheap incremental history.list polling instead of re-listing everything.
  const profile = await getProfile(account);
  await saveSyncState(account.id, {
    cursor: profile.historyId,
    lastFullSyncAt: Date.now(),
    lastIncrementalSyncAt: Date.now(),
  });
  return { processedCount: categorized.length, hasMore: false };
}

async function runIncrementalSyncChunk(account: Account, startHistoryId: string): Promise<SyncChunkResult> {
  const delta = await listHistoryDelta(account, startHistoryId);

  if (delta.historyExpired) {
    // Cursor too old for Gmail to diff from — fall back to a fresh full sync.
    await saveSyncState(account.id, { cursor: undefined, lastFullSyncAt: undefined });
    return { processedCount: 0, hasMore: true };
  }

  const addedIds = [...new Set(delta.addedIds)];
  if (addedIds.length > 0) {
    const rawMessages = await getMessagesMetadata(account, addedIds);
    const categorized = categorizeAll(rawMessages);
    await upsertMessages(categorized);
    await upsertSenderAggregatesForMessages(categorized);
  }

  const deletedIds = [...new Set(delta.deletedIds)];
  if (deletedIds.length > 0) {
    for (const id of deletedIds) {
      const existing = await getMessage(id);
      if (existing) {
        await adjustSenderAfterRemoval(
          makeSenderKey(existing.accountId, existing.senderEmail),
          1,
          existing.sizeEstimateBytes,
        );
      }
    }
    await deleteMessagesByIds(deletedIds);
  }

  await saveSyncState(account.id, {
    cursor: delta.historyId ?? startHistoryId,
    lastIncrementalSyncAt: Date.now(),
  });

  return { processedCount: addedIds.length + deletedIds.length, hasMore: Boolean(delta.nextPageToken) };
}

/** Runs one bounded chunk of sync work for an account. Caller (background/index.ts) is
 *  responsible for scheduling a follow-up alarm when `hasMore` is true. */
export async function runSyncChunk(accountId: string): Promise<SyncChunkResult> {
  const account = await getAccount(accountId);
  if (!account) throw new Error(`Unknown account ${accountId}`);

  try {
    const state = await getSyncState(accountId);
    const result =
      state?.lastFullSyncAt && state.cursor
        ? await runIncrementalSyncChunk(account, state.cursor)
        : await runFullSyncChunk(account);

    if (account.status !== 'connected') await updateAccountStatus(accountId, 'connected');
    await db.accounts.update(accountId, { lastSyncAt: Date.now() });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateAccountStatus(accountId, 'error', message);
    throw error;
  }
}
