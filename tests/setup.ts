import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';

// Minimal chrome.* mock sufficient for unit tests that touch storage/runtime.
// Real integration is exercised manually via `chrome://extensions` (see plan verification steps).
const storageData = new Map<string, unknown>();

const chromeMock = {
  storage: {
    local: {
      get: async (keys?: string | string[] | null) => {
        if (!keys) return Object.fromEntries(storageData);
        const keyList = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const key of keyList) if (storageData.has(key)) result[key] = storageData.get(key);
        return result;
      },
      set: async (items: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(items)) storageData.set(key, value);
      },
      remove: async (keys: string | string[]) => {
        for (const key of Array.isArray(keys) ? keys : [keys]) storageData.delete(key);
      },
      clear: async () => storageData.clear(),
    },
  },
  runtime: {
    onMessage: { addListener: () => {}, removeListener: () => {} },
    sendMessage: async () => undefined,
    connect: () => ({
      onMessage: { addListener: () => {} },
      onDisconnect: { addListener: () => {} },
      postMessage: () => {},
    }),
    openOptionsPage: () => {},
  },
  alarms: {
    create: () => {},
    onAlarm: { addListener: () => {} },
    clear: async () => true,
  },
  identity: {
    getAuthToken: (_opts: unknown, cb: (token?: string) => void) => cb(undefined),
    launchWebAuthFlow: (_opts: unknown, cb: (redirectUrl?: string) => void) => cb(undefined),
  },
};

// @ts-expect-error partial mock, sufficient for unit tests
globalThis.chrome = chromeMock;
