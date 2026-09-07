import { describe, expect, it } from 'vitest';
import { toEmailMessage } from '../../src/lib/gmail/messages';
import type { Account } from '../../src/types/account';

const account: Account = {
  id: 'gmail:user@example.com',
  provider: 'gmail',
  emailAddress: 'user@example.com',
  connectedAt: Date.now(),
  status: 'connected',
};

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
