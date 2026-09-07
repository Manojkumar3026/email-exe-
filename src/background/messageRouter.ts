import type { RuntimeMessage } from '../types/messages';
import type { BulkActionType } from '../types/job';
import { runSyncChunk } from './syncOrchestrator';
import { scheduleSyncContinuation } from './alarms';
import { createJob, getJob, requestCancel } from '../lib/db/jobsRepo';
import { processJobToCompletion, retryFailedIds } from './bulkJobRunner';
import { getAccount } from '../lib/db/accountsRepo';
import { getAdapter } from '../lib/providerAdapter';

async function handleSyncNow(accountId: string): Promise<{ ok: true }> {
  const result = await runSyncChunk(accountId);
  if (result.hasMore) scheduleSyncContinuation(accountId);
  return { ok: true };
}

async function handleStartBulkJob(
  accountId: string,
  actionType: BulkActionType,
  targetMessageIds: string[],
): Promise<{ ok: true; jobId: string }> {
  const job = await createJob(accountId, actionType, targetMessageIds);
  void processJobToCompletion(job.id);
  return { ok: true, jobId: job.id };
}

async function handleCancelJob(jobId: string): Promise<{ ok: true }> {
  await requestCancel(jobId);
  return { ok: true };
}

async function handleRetryJob(jobId: string): Promise<{ ok: true; jobId: string }> {
  const job = await getJob(jobId);
  if (!job) throw new Error(`Unknown job ${jobId}`);
  const retryJobId = await retryFailedIds(job);
  return { ok: true, jobId: retryJobId };
}

async function handleBlockSender(
  accountId: string,
  senderEmail: string,
  existingMessageIds: string[],
): Promise<{ ok: true; jobId: string }> {
  const account = await getAccount(accountId);
  if (!account) throw new Error(`Unknown account ${accountId}`);
  const adapter = await getAdapter(account.provider);
  await adapter.blockSender(account, senderEmail);
  const job = await createJob(accountId, 'delete', existingMessageIds);
  void processJobToCompletion(job.id);
  return { ok: true, jobId: job.id };
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  switch (message.type) {
    case 'SYNC_NOW':
      handleSyncNow(message.accountId)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;

    case 'START_BULK_JOB':
      handleStartBulkJob(message.accountId, message.actionType, message.targetMessageIds)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;

    case 'CANCEL_JOB':
      handleCancelJob(message.jobId)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;

    case 'RETRY_JOB':
      handleRetryJob(message.jobId)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;

    case 'BLOCK_SENDER':
      handleBlockSender(message.accountId, message.senderEmail, message.existingMessageIds)
        .then(sendResponse)
        .catch((error) => sendResponse({ ok: false, error: String(error) }));
      return true;

    default:
      return undefined;
  }
});
