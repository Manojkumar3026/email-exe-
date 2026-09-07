import { describe, expect, it } from 'vitest';

describe('test pipeline smoke test', () => {
  it('runs and has access to the chrome.* mock', async () => {
    await chrome.storage.local.set({ hello: 'world' });
    const result = await chrome.storage.local.get('hello');
    expect(result.hello).toBe('world');
  });
});
