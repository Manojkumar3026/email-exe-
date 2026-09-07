import { describe, expect, it } from 'vitest';
import { buildRecommendations } from '../../src/lib/cleanup-engine/recommendations';
import type { SenderAggregate } from '../../src/types/sender';

function makeSender(overrides: Partial<SenderAggregate>): SenderAggregate {
  return {
    key: 'gmail:user@example.com::sender@example.com',
    senderEmail: 'sender@example.com',
    accountId: 'gmail:user@example.com',
    messageCount: 50,
    totalSizeBytes: 500_000,
    firstSeenAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
    lastSeenAt: Date.now(),
    frequencyPerWeek: 3,
    category: 'promotions',
    hasListUnsubscribe: false,
    unreadCount: 40,
    ...overrides,
  };
}

describe('buildRecommendations', () => {
  it('recommends deleting a high-volume, mostly-unread promotions sender', () => {
    const recs = buildRecommendations([makeSender({})]);
    expect(recs).toHaveLength(1);
    expect(recs[0].action).toBe('delete');
  });

  it('recommends unsubscribing from a newsletter sender with a working unsubscribe link', () => {
    const recs = buildRecommendations([
      makeSender({ category: 'newsletters', hasListUnsubscribe: true, unreadCount: 10 }),
    ]);
    expect(recs[0].action).toBe('unsubscribe');
  });

  it('recommends archiving a high-volume social sender', () => {
    const recs = buildRecommendations([makeSender({ category: 'social', unreadCount: 5 })]);
    expect(recs[0].action).toBe('archive');
  });

  it('skips senders below the minimum message count threshold', () => {
    const recs = buildRecommendations([makeSender({ messageCount: 3 })]);
    expect(recs).toHaveLength(0);
  });

  it('skips a promotions sender with a low unread ratio', () => {
    const recs = buildRecommendations([makeSender({ unreadCount: 2 })]);
    expect(recs).toHaveLength(0);
  });

  it('does not recommend anything for finance/work/personal senders', () => {
    const recs = buildRecommendations([
      makeSender({ category: 'finance' }),
      makeSender({ category: 'work' }),
      makeSender({ category: 'personal' }),
    ]);
    expect(recs).toHaveLength(0);
  });

  it('sorts recommendations by confidence descending', () => {
    const low = makeSender({ senderEmail: 'low@example.com', unreadCount: 30, messageCount: 50 });
    const high = makeSender({
      senderEmail: 'high@example.com',
      unreadCount: 49,
      messageCount: 50,
      hasListUnsubscribe: true,
    });
    const recs = buildRecommendations([low, high]);
    expect(recs[0].senderEmail).toBe('high@example.com');
  });
});
