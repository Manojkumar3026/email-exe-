import { describe, expect, it } from 'vitest';
import { toEmailMessage, parseFromHeader } from '../../src/lib/gmail/messages';
import type { Account } from '../../src/types/account';

const account: Account = {
  id: 'gmail:user@example.com',
  provider: 'gmail',
  emailAddress: 'user@example.com',
  connectedAt: Date.now(),
  status: 'connected',
};

describe('parseFromHeader', () => {
  it('correctly handles standard Name <email> format', () => {
    expect(parseFromHeader('Amazon <no-reply@amazon.com>')).toEqual({
      name: 'Amazon',
      email: 'no-reply@amazon.com',
    });
  });

  it('correctly handles escaped quotes in sender name', () => {
    expect(parseFromHeader('"\\"openweather team\\"" <robot5@openweathermap.org>')).toEqual({
      name: 'openweather team',
      email: 'robot5@openweathermap.org',
    });
    expect(parseFromHeader('\\"openweather team\\" <robot5@openweathermap.org>')).toEqual({
      name: 'openweather team',
      email: 'robot5@openweathermap.org',
    });
  });

  it('correctly handles outer quotes wrapping entire header', () => {
    expect(parseFromHeader('"\\"openweather team\\" <robot5@openweathermap.org>"')).toEqual({
      name: 'openweather team',
      email: 'robot5@openweathermap.org',
    });
  });

  it('correctly handles names containing quotes', () => {
    const raw = '"reg -one week internship programme in \\"nourishing the mind with ml feast\\"" <internship@college.edu>';
    expect(parseFromHeader(raw)).toEqual({
      name: 'reg -one week internship programme in "nourishing the mind with ml feast"',
      email: 'internship@college.edu',
    });
  });

  it('handles bare email address', () => {
    expect(parseFromHeader('user@example.com')).toEqual({
      name: undefined,
      email: 'user@example.com',
    });
  });

  it('handles empty or missing values gracefully', () => {
    expect(parseFromHeader(undefined)).toEqual({ email: 'unknown@unknown' });
    expect(parseFromHeader('')).toEqual({ email: 'unknown@unknown' });
  });
});

describe('toEmailMessage', () => {
  it('parses sender name/email, subject, and List-Unsubscribe from headers', () => {
    const message = toEmailMessage(account, {
      id: 'msg1',
      threadId: 'thread1',
      labelIds: ['INBOX', 'CATEGORY_PROMOTIONS'],
      sizeEstimate: 12345,
      internalDate: '1700000000000',
      payload: {
        headers: [
          { name: 'From', value: 'Amazon <no-reply@amazon.com>' },
          { name: 'Subject', value: 'Your order has shipped' },
          { name: 'List-Unsubscribe', value: '<mailto:unsub@amazon.com>' },
        ],
      },
    });

    expect(message.senderEmail).toBe('no-reply@amazon.com');
    expect(message.senderName).toBe('Amazon');
    expect(message.subject).toBe('Your order has shipped');
    expect(message.hasListUnsubscribe).toBe(true);
    expect(message.isRead).toBe(true);
    expect(message.sizeEstimateBytes).toBe(12345);
    expect(message.labels).toContain('CATEGORY_PROMOTIONS');
  });

  it('marks a message unread when the UNREAD label is present', () => {
    const message = toEmailMessage(account, {
      id: 'msg2',
      threadId: 'thread2',
      labelIds: ['INBOX', 'UNREAD'],
      payload: { headers: [{ name: 'From', value: 'plain@example.com' }] },
    });
    expect(message.isRead).toBe(false);
    expect(message.senderName).toBeUndefined();
  });

  it('falls back gracefully when From header is missing', () => {
    const message = toEmailMessage(account, { id: 'msg3', threadId: 'thread3' });
    expect(message.senderEmail).toBe('unknown@unknown');
    expect(message.subject).toBe('(no subject)');
  });
});

describe('trashMessages', () => {
  it('calls messages.trash endpoint for each message id', async () => {
    const { trashMessages } = await import('../../src/lib/gmail/messages');
    const client = await import('../../src/lib/gmail/client');
    const calls: { path: string; init?: RequestInit }[] = [];

    const spy = vi.spyOn(client, 'gmailFetchJson').mockImplementation(async (_acc, path, init) => {
      calls.push({ path, init });
      return { id: 'msg1' } as any;
    });

    const result = await trashMessages(account, ['msg1', 'msg2']);
    expect(result.successIds).toEqual(['msg1', 'msg2']);
    expect(result.failedIds).toEqual([]);
    expect(calls).toEqual([
      { path: '/users/me/messages/msg1/trash', init: { method: 'POST' } },
      { path: '/users/me/messages/msg2/trash', init: { method: 'POST' } },
    ]);

    spy.mockRestore();
  });
});
