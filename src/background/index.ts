// Service worker entry point: registers alarm handlers that drive account sync and the
// message router that popup/app use to trigger syncs and (in later milestones) bulk jobs.

import { listAccounts } from '../lib/db/accountsRepo';
import { runSyncChunk } from './syncOrchestrator';
import { resumeStaleJobs } from './bulkJobRunner';
import {
  PERIODIC_SYNC_ALARM,
  RESUME_JOBS_ALARM,
  accountIdFromContinueAlarm,
  registerAlarms,
  scheduleSyncContinuation,
} from './alarms';
import './messageRouter';

console.log('[inbox-cleaner-ai] background service worker started');

chrome.runtime.onInstalled.addListener(() => {
  registerAlarms();
});

chrome.runtime.onStartup.addListener(() => {
  registerAlarms();
  void resumeStaleJobs();
});

async function syncAccount(accountId: string): Promise<void> {
  try {
    const result = await runSyncChunk(accountId);
    if (result.hasMore) scheduleSyncContinuation(accountId);
  } catch (error) {
    console.error(`[inbox-cleaner-ai] sync failed for ${accountId}`, error);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === PERIODIC_SYNC_ALARM) {
    void (async () => {
      const accounts = await listAccounts();
      for (const account of accounts) void syncAccount(account.id);
    })();
    return;
  }

  if (alarm.name === RESUME_JOBS_ALARM) {
    void resumeStaleJobs();
    return;
  }

  const accountId = accountIdFromContinueAlarm(alarm.name);
  if (accountId) void syncAccount(accountId);
});
