// Incremental, resumable sync per account, provider-agnostic via lib/providerAdapter.ts.
// Each call processes one bounded chunk so a single invocation finishes well within the MV3
// service worker's idle-termination window. Progress (page token / delta cursor) is persisted
// to IndexedDB after every chunk, so a killed worker picks up exactly where it left off on the
// next alarm-triggered wake rather than losing progress or re-downloading everything.

import { db } from '../lib/db/db';
import { getAccount, updateAccountStatus } from '../lib/db/accountsRepo';
import { upsertMessages, deleteMessagesByIds, getMessage } from '../lib/db/messagesRepo';
import { upsertSenderAggregatesForMessages, adjustSenderAfterRemoval } from '../lib/db/sendersRepo';
import { getAdapter } from '../lib/providerAdapter';
import { makeSenderKey } from '../types/sender';

export interface SyncChunkResult {
  processedCount: number;
  hasMore: boolean;
}

async function getSyncState(accountId: string) {
  return db.syncState.get(accountId);
}

async function saveSyncState(
  accountId: string,
  patch: Partial<{ cursor?: string; lastFullSyncAt?: number; lastIncrementalSyncAt: number }>,
) {
  const existing = await getSyncState(accountId);
  await db.syncState.put({ accountId, ...existing, ...patch });
}

/** Runs one bounded chunk of sync work for an account. Caller (background/index.ts) is
 *  responsible for scheduling a follow-up alarm when `hasMore` is true. */
export async function runSyncChunk(accountId: string): Promise<SyncChunkResult> {
  const account = await getAccount(accountId);
  if (!account) throw new Error(`Unknown account ${accountId}`);

  try {
    const state = (await getSyncState(accountId)) ?? { accountId };
    const adapter = await getAdapter(account.provider);
    const outcome = await adapter.runSyncChunk(account, {
      cursor: state.cursor,
      lastFullSyncAt: state.lastFullSyncAt,
    });

    if (outcome.addedMessages.length > 0) {
      await upsertMessages(outcome.addedMessages);
      await upsertSenderAggregatesForMessages(outcome.addedMessages);
    }

    if (outcome.deletedIds.length > 0) {
      const uniqueDeleted = [...new Set(outcome.deletedIds)];
      for (const id of uniqueDeleted) {
        const existing = await getMessage(id);
        if (existing) {
          await adjustSenderAfterRemoval(
            makeSenderKey(existing.accountId, existing.senderEmail),
            1,
            existing.sizeEstimateBytes,
          );
        }
      }
      await deleteMessagesByIds(uniqueDeleted);
    }

    await saveSyncState(accountId, {
      cursor: outcome.nextState.cursor,
      lastFullSyncAt: outcome.nextState.lastFullSyncAt,
      lastIncrementalSyncAt: Date.now(),
    });

    if (account.status !== 'connected') await updateAccountStatus(accountId, 'connected');
    await db.accounts.update(accountId, { lastSyncAt: Date.now() });

    return {
      processedCount: outcome.addedMessages.length + outcome.deletedIds.length,
      hasMore: outcome.hasMore,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateAccountStatus(accountId, 'error', message);
    throw error;
  }
}
