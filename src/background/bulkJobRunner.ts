// Executes bulk actions (delete/archive/mark-read/permanent-delete) in bounded chunks,
// persisting progress to the `jobs` IndexedDB table after every chunk. If the service worker
// is killed mid-job, `resumeStaleJobs` (called from an alarm + onStartup) picks it back up
// from the last persisted cursor rather than starting over or losing partial progress.

import { getAccount } from '../lib/db/accountsRepo';
import { getMessage, deleteMessagesByIds } from '../lib/db/messagesRepo';
import { db } from '../lib/db/db';
import { adjustSenderAfterRemoval } from '../lib/db/sendersRepo';
import { createJob, getJob, updateJob, listJobsByStatus } from '../lib/db/jobsRepo';
import { recordHistoryEntry } from '../lib/db/historyRepo';
import { makeSenderKey } from '../types/sender';
import {
  archiveMessages,
  markRead,
  permanentlyDeleteMessages,
  trashMessages,
  type BatchModifyResult,
} from '../lib/gmail/messages';
import type { Account } from '../types/account';
import type { BulkActionJob, BulkActionType } from '../types/job';

const CHUNK_SIZE = 200;
const STALE_JOB_THRESHOLD_MS = 90_000;

async function runProviderAction(
  account: Account,
  actionType: BulkActionType,
  ids: string[],
): Promise<BatchModifyResult> {
  switch (actionType) {
    case 'delete':
      return trashMessages(account, ids);
    case 'permanent_delete':
      return permanentlyDeleteMessages(account, ids);
    case 'archive':
      return archiveMessages(account, ids);
    case 'mark_read':
      return markRead(account, ids);
    default:
      throw new Error(`Bulk job runner does not support action "${actionType}" (handled elsewhere).`);
  }
}

async function applyLocalSideEffects(actionType: BulkActionType, successIds: string[]): Promise<number> {
  if (successIds.length === 0) return 0;

  if (actionType === 'delete' || actionType === 'permanent_delete') {
    let bytesFreed = 0;
    for (const id of successIds) {
      const message = await getMessage(id);
      if (!message) continue;
      bytesFreed += message.sizeEstimateBytes;
      await adjustSenderAfterRemoval(
        makeSenderKey(message.accountId, message.senderEmail),
        1,
        message.sizeEstimateBytes,
      );
    }
    await deleteMessagesByIds(successIds);
    return bytesFreed;
  }

  if (actionType === 'archive') {
    await db.messages.where('id').anyOf(successIds).modify((m) => {
      m.labels = m.labels.filter((l) => l !== 'INBOX');
    });
    return 0;
  }

  if (actionType === 'mark_read') {
    await db.messages.where('id').anyOf(successIds).modify((m) => {
      m.labels = m.labels.filter((l) => l !== 'UNREAD');
      m.isRead = true;
    });
    return 0;
  }

  return 0;
}

async function finalizeJob(job: BulkActionJob, totalBytesFreed: number): Promise<void> {
  if (job.actionType === 'delete' || job.actionType === 'permanent_delete' || job.actionType === 'archive') {
    await recordHistoryEntry({
      accountId: job.accountId,
      actionType: job.actionType,
      messageCount: job.successCount,
      bytesFreed: totalBytesFreed,
      undoable: job.actionType === 'delete', // soft delete only — permanent/archive aren't "undo via trash"
    });
  }
}

export async function processJobToCompletion(jobId: string): Promise<void> {
  let job = await getJob(jobId);
  if (!job) return;
  if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') return;

  const account = await getAccount(job.accountId);
  if (!account) {
    await updateJob(jobId, { status: 'failed', errorMessage: 'Account no longer connected.' });
    return;
  }

  if (job.status === 'queued') await updateJob(jobId, { status: 'running' });

  if (job.totalCount === 0) {
    await updateJob(jobId, { status: 'completed' });
    return;
  }

  let totalBytesFreed = 0;

  while (job && job.cursor < job.totalCount) {
    const current = await getJob(jobId);
    if (!current || current.status === 'cancelled') return;

    const nextChunk = current.targetMessageIds.slice(current.cursor, current.cursor + CHUNK_SIZE);

    let result: BatchModifyResult;
    try {
      result = await runProviderAction(account, current.actionType, nextChunk);
    } catch (error) {
      result = { successIds: [], failedIds: nextChunk };
      console.error('[inbox-cleaner-ai] bulk job chunk failed', error);
    }

    totalBytesFreed += await applyLocalSideEffects(current.actionType, result.successIds);

    const cursor = current.cursor + nextChunk.length;
    const processedCount = current.processedCount + nextChunk.length;
    const successCount = current.successCount + result.successIds.length;
    const failedCount = current.failedCount + result.failedIds.length;
    const failedIds = [...current.failedIds, ...result.failedIds];
    const status = cursor >= current.totalCount ? 'completed' : 'running';

    await updateJob(jobId, { cursor, processedCount, successCount, failedCount, failedIds, status });
    job = await getJob(jobId);

    if (status === 'completed' && job) {
      await finalizeJob(job, totalBytesFreed);
    }
  }
}

/** Retries only the ids that failed on the previous pass, as a fresh job. */
export async function retryFailedIds(job: BulkActionJob): Promise<string> {
  const retryJob = await createJob(job.accountId, job.actionType, job.failedIds);
  void processJobToCompletion(retryJob.id);
  return retryJob.id;
}

/** Safety net: resumes any job left in `running` whose last update looks stale, meaning the
 *  service worker was killed mid-chunk. Called from an alarm and from onStartup. */
export async function resumeStaleJobs(): Promise<void> {
  const running = await listJobsByStatus('running');
  const now = Date.now();
  for (const job of running) {
    if (now - job.updatedAt > STALE_JOB_THRESHOLD_MS) {
      void processJobToCompletion(job.id);
    }
  }
}
