import { describe, expect, it } from 'vitest';
import { categorize } from '../../src/lib/categorization/engine';
import type { EmailMessage } from '../../src/types/email';

function makeMessage(overrides: Partial<EmailMessage>): EmailMessage {
  return {
    id: 'id',
    accountId: 'gmail:user@example.com',
    senderEmail: 'someone@example.com',
    subject: 'Hello',
    receivedAt: Date.now(),
    sizeEstimateBytes: 1000,
    labels: ['INBOX'],
    hasListUnsubscribe: false,
    isRead: true,
    ...overrides,
  };
}

describe('categorize', () => {
  it('maps Gmail category labels directly', () => {
    expect(categorize(makeMessage({ labels: ['CATEGORY_SOCIAL'] }))).toBe('social');
    expect(categorize(makeMessage({ labels: ['CATEGORY_PROMOTIONS'] }))).toBe('promotions');
  });

  it('detects finance mail by sender domain', () => {
    expect(categorize(makeMessage({ senderEmail: 'service@paypal.com', labels: [] }))).toBe('finance');
  });

  it('detects shopping mail by subject keywords', () => {
    expect(categorize(makeMessage({ subject: 'Your order has shipped', labels: [] }))).toBe('shopping');
  });

  it('detects marketing keywords in the subject as promotions', () => {
    expect(categorize(makeMessage({ subject: '50% off everything this weekend', labels: [] }))).toBe(
      'promotions',
    );
  });

  it('falls back to newsletters when List-Unsubscribe is present with no stronger signal', () => {
    expect(
      categorize(makeMessage({ hasListUnsubscribe: true, subject: 'Weekly digest', labels: [] })),
    ).toBe('newsletters');
  });

  it('flags noreply senders without List-Unsubscribe as spam-like', () => {
    expect(categorize(makeMessage({ senderEmail: 'noreply@random.io', labels: [] }))).toBe('spam_like');
  });

  it('falls back to personal for a plain inbox message with no signals', () => {
    expect(categorize(makeMessage({ senderEmail: 'friend@gmail.com', subject: 'Dinner Friday?' }))).toBe(
      'personal',
    );
  });

  it('falls back to other when not in the inbox and no signals match', () => {
    expect(
      categorize(makeMessage({ senderEmail: 'friend@gmail.com', subject: 'Dinner Friday?', labels: [] })),
    ).toBe('other');
  });
});
