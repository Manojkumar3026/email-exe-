import type { Account } from '../../types/account';
import { categorizeAll } from '../categorization/engine';
import type { ProviderAdapter, SyncChunkOutcome, SyncCursorState } from '../providerAdapter';
import {
  createBlockSenderRule,
  deleteMessagesPermanently,
  fetchDeltaPage,
  markMessagesRead,
  moveMessages,
  toEmailMessage,
} from './messages';

async function runSyncChunk(account: Account, state: SyncCursorState): Promise<SyncChunkOutcome> {
  const page = await fetchDeltaPage(account, state.cursor);
  const addedMessages = categorizeAll(page.addedMessages.map((m) => toEmailMessage(account, m)));

  const nextCursor = page.nextLink ?? page.deltaLink ?? state.cursor;
  const reachedDeltaLink = Boolean(page.deltaLink) && !page.nextLink;

  return {
    addedMessages,
    deletedIds: page.removedIds,
    nextState: {
      cursor: nextCursor,
      lastFullSyncAt: reachedDeltaLink ? (state.lastFullSyncAt ?? Date.now()) : state.lastFullSyncAt,
    },
    hasMore: Boolean(page.nextLink),
  };
}

export const outlookAdapter: ProviderAdapter = {
  runSyncChunk,
  trash: (account, ids) => moveMessages(account, ids, 'deleteditems'),
  archive: (account, ids) => moveMessages(account, ids, 'archive'),
  markRead: markMessagesRead,
  permanentDelete: deleteMessagesPermanently,
  async blockSender(account, senderEmail) {
    await createBlockSenderRule(account, senderEmail);
  },
};
