import type { Account } from '../../types/account';
import { categorizeAll } from '../categorization/engine';
import type { ProviderAdapter, SyncChunkOutcome, SyncCursorState } from '../providerAdapter';
import { createBlockSenderFilter } from './filters';
import {
  archiveMessages,
  getMessagesMetadata,
  getProfile,
  listHistoryDelta,
  listMessageIds,
  markRead,
  permanentlyDeleteMessages,
  trashMessages,
} from './messages';

const PAGE_SIZE = 250;

async function runFullSyncChunk(account: Account, state: SyncCursorState): Promise<SyncChunkOutcome> {
  const page = await listMessageIds(account, { pageToken: state.cursor, maxResults: PAGE_SIZE });
  const raw = await getMessagesMetadata(account, page.ids);
  const addedMessages = categorizeAll(raw);

  if (page.nextPageToken) {
    return { addedMessages, deletedIds: [], nextState: { cursor: page.nextPageToken }, hasMore: true };
  }

  const profile = await getProfile(account);
  return {
    addedMessages,
    deletedIds: [],
    nextState: { cursor: profile.historyId, lastFullSyncAt: Date.now() },
    hasMore: false,
  };
}

async function runIncrementalSyncChunk(account: Account, state: SyncCursorState): Promise<SyncChunkOutcome> {
  const startHistoryId = state.cursor!;
  const delta = await listHistoryDelta(account, startHistoryId);

  if (delta.historyExpired) {
    // Cursor too old — restart as a full sync.
    return { addedMessages: [], deletedIds: [], nextState: { cursor: undefined, lastFullSyncAt: undefined }, hasMore: true };
  }

  const addedIds = [...new Set(delta.addedIds)];
  const raw = addedIds.length > 0 ? await getMessagesMetadata(account, addedIds) : [];
  const addedMessages = categorizeAll(raw);
  const deletedIds = [...new Set(delta.deletedIds)];

  return {
    addedMessages,
    deletedIds,
    nextState: { cursor: delta.historyId ?? startHistoryId, lastFullSyncAt: state.lastFullSyncAt },
    hasMore: Boolean(delta.nextPageToken),
  };
}

export const gmailAdapter: ProviderAdapter = {
  runSyncChunk(account, state) {
    const isBaselineDone = Boolean(state.lastFullSyncAt && state.cursor);
    return isBaselineDone ? runIncrementalSyncChunk(account, state) : runFullSyncChunk(account, state);
  },
  trash: trashMessages,
  archive: archiveMessages,
  markRead,
  permanentDelete: permanentlyDeleteMessages,
  async blockSender(account, senderEmail) {
    await createBlockSenderFilter(account, senderEmail);
  },
};
