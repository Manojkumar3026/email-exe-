import { db } from './db';
import type { BulkActionJob, BulkActionType, JobStatus } from '../../types/job';

export async function createJob(
  accountId: string,
  actionType: BulkActionType,
  targetMessageIds: string[],
): Promise<BulkActionJob> {
  const job: BulkActionJob = {
    id: crypto.randomUUID(),
    accountId,
    actionType,
    targetMessageIds,
    cursor: 0,
    status: 'queued',
    totalCount: targetMessageIds.length,
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
    failedIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await db.jobs.put(job);
  return job;
}

export async function getJob(id: string): Promise<BulkActionJob | undefined> {
  return db.jobs.get(id);
}

export async function updateJob(id: string, patch: Partial<BulkActionJob>): Promise<void> {
  await db.jobs.update(id, { ...patch, updatedAt: Date.now() });
}

export async function listJobsForAccount(accountId: string): Promise<BulkActionJob[]> {
  return db.jobs.where('accountId').equals(accountId).reverse().sortBy('createdAt');
}

export async function listJobsByStatus(status: JobStatus): Promise<BulkActionJob[]> {
  return db.jobs.where('status').equals(status).toArray();
}

export async function requestCancel(id: string): Promise<void> {
  await db.jobs.update(id, { status: 'cancelled', updatedAt: Date.now() });
}
