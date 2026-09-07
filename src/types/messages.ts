// Typed envelopes for chrome.runtime message passing between popup/app and the
// background service worker. Extended in later milestones (sync, bulk jobs).

import type { BulkActionType } from './job';

export interface SyncNowMessage {
  type: 'SYNC_NOW';
  accountId: string;
}

export interface AccountsChangedMessage {
  type: 'ACCOUNTS_CHANGED';
}

export interface StartBulkJobMessage {
  type: 'START_BULK_JOB';
  accountId: string;
  actionType: BulkActionType;
  targetMessageIds: string[];
}

export interface CancelJobMessage {
  type: 'CANCEL_JOB';
  jobId: string;
}

export interface RetryJobMessage {
  type: 'RETRY_JOB';
  jobId: string;
}

export interface BlockSenderMessage {
  type: 'BLOCK_SENDER';
  accountId: string;
  senderEmail: string;
  existingMessageIds: string[];
}

export type RuntimeMessage =
  | SyncNowMessage
  | AccountsChangedMessage
  | StartBulkJobMessage
  | CancelJobMessage
  | RetryJobMessage
  | BlockSenderMessage;
