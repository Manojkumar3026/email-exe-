// Typed envelopes for chrome.runtime message passing between popup/app and the
// background service worker. Extended in later milestones (sync, bulk jobs).

export interface SyncNowMessage {
  type: 'SYNC_NOW';
  accountId: string;
}

export interface AccountsChangedMessage {
  type: 'ACCOUNTS_CHANGED';
}

export type RuntimeMessage = SyncNowMessage | AccountsChangedMessage;
