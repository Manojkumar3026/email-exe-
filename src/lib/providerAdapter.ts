// Uniform contract both provider integrations implement, so sync and bulk-action code in
// background/ never needs to branch on `account.provider` directly.

import type { Account, Provider } from '../types/account';
import type { EmailMessage } from '../types/email';
import { gmailAdapter } from './gmail/adapter';
import { outlookAdapter } from './outlook/adapter';

export interface BatchActionResult {
  successIds: string[];
  failedIds: string[];
}

export interface SyncCursorState {
  cursor?: string;
  lastFullSyncAt?: number;
}

export interface SyncChunkOutcome {
  addedMessages: EmailMessage[];
  deletedIds: string[];
  nextState: SyncCursorState;
  hasMore: boolean;
}

export interface ProviderAdapter {
  /** Processes one bounded chunk of sync work (full crawl or incremental, provider decides
   *  which based on `state`) and returns the next cursor state to persist. */
  runSyncChunk(account: Account, state: SyncCursorState): Promise<SyncChunkOutcome>;
  trash(account: Account, ids: string[]): Promise<BatchActionResult>;
  archive(account: Account, ids: string[]): Promise<BatchActionResult>;
  markRead(account: Account, ids: string[]): Promise<BatchActionResult>;
  permanentDelete(account: Account, ids: string[]): Promise<BatchActionResult>;
  blockSender(account: Account, senderEmail: string): Promise<void>;
}

const adapters = new Map<Provider, ProviderAdapter>([
  ['gmail', gmailAdapter],
  ['outlook', outlookAdapter],
]);

export async function getAdapter(provider: Provider): Promise<ProviderAdapter> {
  const adapter = adapters.get(provider);
  if (!adapter) throw new Error(`No provider adapter registered for "${provider}"`);
  return adapter;
}
