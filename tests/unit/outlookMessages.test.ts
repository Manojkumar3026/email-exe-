import { describe, expect, it } from 'vitest';
import { toEmailMessage } from '../../src/lib/outlook/messages';
import type { Account } from '../../src/types/account';

const account: Account = {
  id: 'outlook:user@example.com',
  provider: 'outlook',
  emailAddress: 'user@example.com',
  connectedAt: Date.now(),
  status: 'connected',
};

describe('outlook toEmailMessage', () => {
  it('parses sender, subject, read state, and List-Unsubscribe header', () => {
    const message = toEmailMessage(account, {
      id: 'm1',
      subject: 'Weekly newsletter',
      from: { emailAddress: { name: 'Newsletter Co', address: 'news@example.com' } },
      receivedDateTime: '2024-01-15T12:00:00Z',
      isRead: false,
      categories: [],
      internetMessageHeaders: [{ name: 'List-Unsubscribe', value: '<https://example.com/unsub>' }],
      bodyPreview: 'Hello there',
      hasAttachments: false,
    });

    expect(message.senderEmail).toBe('news@example.com');
    expect(message.senderName).toBe('Newsletter Co');
    expect(message.subject).toBe('Weekly newsletter');
    expect(message.isRead).toBe(false);
    expect(message.hasListUnsubscribe).toBe(true);
    expect(message.receivedAt).toBe(new Date('2024-01-15T12:00:00Z').getTime());
  });

  it('falls back gracefully for a minimal resource', () => {
    const message = toEmailMessage(account, { id: 'm2' });
    expect(message.senderEmail).toBe('unknown@unknown');
    expect(message.subject).toBe('(no subject)');
    expect(message.isRead).toBe(true);
    expect(message.hasListUnsubscribe).toBe(false);
  });

  it('increases the size estimate when attachments are present', () => {
    const withAttachment = toEmailMessage(account, { id: 'm3', hasAttachments: true });
    const without = toEmailMessage(account, { id: 'm4', hasAttachments: false });
    expect(withAttachment.sizeEstimateBytes).toBeGreaterThan(without.sizeEstimateBytes);
  });
});
