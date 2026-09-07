export type BulkActionType =
  | 'delete'
  | 'permanent_delete'
  | 'archive'
  | 'mark_read'
  | 'block'
  | 'unsubscribe';

export type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface BulkActionJob {
  id: string;
  accountId: string;
  actionType: BulkActionType;
  /** Full target set, resolved up front from selected senders/categories. */
  targetMessageIds: string[];
  /** Index into targetMessageIds of the next unprocessed item — enables resume after SW restart. */
  cursor: number;
  status: JobStatus;
  totalCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  failedIds: string[];
  createdAt: number;
  updatedAt: number;
  errorMessage?: string;
}
