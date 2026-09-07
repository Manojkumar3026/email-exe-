import { describe, expect, it } from 'vitest';
import { ruleBasedProvider } from '../../src/lib/ai/ruleBasedProvider';
import type { EmailMessage } from '../../src/types/email';
import type { SenderAggregate } from '../../src/types/sender';

function makeMessage(id: string, overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    id,
    accountId: 'gmail:user@example.com',
    senderEmail: 'sender@example.com',
    subject: 'Weekly digest',
    receivedAt: Date.now(),
    sizeEstimateBytes: 1000,
    labels: [],
    hasListUnsubscribe: false,
    isRead: true,
    ...overrides,
  };
}

describe('ruleBasedProvider.detectDuplicates', () => {
  it('groups messages with the same sender and normalized subject', async () => {
    const groups = await ruleBasedProvider.detectDuplicates([
      makeMessage('m1', { subject: 'Weekly digest' }),
      makeMessage('m2', { subject: 'Re: Weekly digest' }),
      makeMessage('m3', { subject: 'Something else' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].ids.sort()).toEqual(['m1', 'm2']);
  });

  it('returns no groups when nothing repeats', async () => {
    const groups = await ruleBasedProvider.detectDuplicates([
      makeMessage('m1', { subject: 'A' }),
      makeMessage('m2', { subject: 'B' }),
    ]);
    expect(groups).toHaveLength(0);
  });
});

describe('ruleBasedProvider.scoreImportance', () => {
  const baseSender: SenderAggregate = {
    key: 'k',
    senderEmail: 'a@b.com',
    accountId: 'gmail:user@example.com',
    messageCount: 10,
    totalSizeBytes: 1000,
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now(),
    frequencyPerWeek: 1,
    category: 'work',
    hasListUnsubscribe: false,
    unreadCount: 0,
  };

  it('scores a low-engagement promotions sender lower than a work sender', async () => {
    const workScore = await ruleBasedProvider.scoreImportance(baseSender);
    const promoScore = await ruleBasedProvider.scoreImportance({ ...baseSender, category: 'promotions' });
    expect(workScore).toBeGreaterThan(promoScore);
  });
});
