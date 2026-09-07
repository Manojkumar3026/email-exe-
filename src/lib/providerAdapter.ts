// Uniform contract both provider integrations implement, so sync and bulk-action code in
// background/ never needs to branch on `account.provider` directly.

import type { Account, Provider } from '../types/account';
import type { EmailMessage } from '../types/email';

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

const adapters = new Map<Provider, () => Promise<ProviderAdapter>>([
  ['gmail', async () => (await import('./gmail/adapter')).gmailAdapter],
  ['outlook', async () => (await import('./outlook/adapter')).outlookAdapter],
]);

export async function getAdapter(provider: Provider): Promise<ProviderAdapter> {
  const loader = adapters.get(provider);
  if (!loader) throw new Error(`No provider adapter registered for "${provider}"`);
  return loader();
}
