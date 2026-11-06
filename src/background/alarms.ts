export const PERIODIC_SYNC_ALARM = 'periodic-sync';
export const PERIODIC_SYNC_INTERVAL_MINUTES = 15;

export const RESUME_JOBS_ALARM = 'resume-jobs';
// Chrome's minimum period for a repeating alarm is 1 minute — this is the crash-recovery
// safety net for bulk jobs; the normal path keeps progressing via the live in-worker loop.
export const RESUME_JOBS_INTERVAL_MINUTES = 1;

export function continueSyncAlarmName(accountId: string): string {
  return `continue-sync:${accountId}`;
}

export function registerAlarms(): void {
  chrome.alarms.create(PERIODIC_SYNC_ALARM, { periodInMinutes: PERIODIC_SYNC_INTERVAL_MINUTES });
  chrome.alarms.create(RESUME_JOBS_ALARM, { periodInMinutes: RESUME_JOBS_INTERVAL_MINUTES });
}

/** Schedules a short one-shot alarm to resume an account's sync shortly after this
 *  invocation ends, respecting the service worker's idle-termination window. */
export function scheduleSyncContinuation(accountId: string, delayInMinutes = 0.8): void {
  chrome.alarms.create(continueSyncAlarmName(accountId), { delayInMinutes });
}

export function accountIdFromContinueAlarm(alarmName: string): string | null {
  if (!alarmName.startsWith('continue-sync:')) return null;
  return alarmName.slice('continue-sync:'.length);
}
