import type { RuntimeMessage } from '../types/messages';
import { runSyncChunk } from './syncOrchestrator';
import { scheduleSyncContinuation } from './alarms';

async function handleSyncNow(accountId: string): Promise<{ ok: true }> {
  const result = await runSyncChunk(accountId);
  if (result.hasMore) scheduleSyncContinuation(accountId);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === 'SYNC_NOW') {
    handleSyncNow(message.accountId)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true; // keep the message channel open for the async response
  }
  return undefined;
});
