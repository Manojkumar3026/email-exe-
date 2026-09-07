export const PERIODIC_SYNC_ALARM = 'periodic-sync';
export const PERIODIC_SYNC_INTERVAL_MINUTES = 15;

export function continueSyncAlarmName(accountId: string): string {
  return `continue-sync:${accountId}`;
}

export function registerAlarms(): void {
  chrome.alarms.create(PERIODIC_SYNC_ALARM, { periodInMinutes: PERIODIC_SYNC_INTERVAL_MINUTES });
}

/** Schedules a short one-shot alarm to resume an account's sync shortly after this
 *  invocation ends, respecting the service worker's idle-termination window. */
export function scheduleSyncContinuation(accountId: string): void {
  chrome.alarms.create(continueSyncAlarmName(accountId), { delayInMinutes: 0.5 });
}

export function accountIdFromContinueAlarm(alarmName: string): string | null {
  if (!alarmName.startsWith('continue-sync:')) return null;
  return alarmName.slice('continue-sync:'.length);
}
