import type { AIInsightProvider, DuplicateGroup } from './AIInsightProvider';
import { unreadRatio } from '../cleanup-engine/scoring';
import { buildRecommendations } from '../cleanup-engine/recommendations';
import { formatBytes } from '../util/formatBytes';

function normalizeSubject(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/^(re|fwd?):\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export const ruleBasedProvider: AIInsightProvider = {
  async detectDuplicates(messages) {
    const groups = new Map<string, string[]>();
    for (const message of messages) {
      const key = `${message.senderEmail}::${normalizeSubject(message.subject)}`;
      const group = groups.get(key);
      if (group) group.push(message.id);
      else groups.set(key, [message.id]);
    }
    const duplicates: DuplicateGroup[] = [];
    for (const [groupKey, ids] of groups) {
      if (ids.length > 1) duplicates.push({ groupKey, ids });
    }
    return duplicates;
  },

  async scoreImportance(sender) {
    const lowValueCategories = new Set(['promotions', 'spam_like', 'social', 'newsletters']);
    const base = lowValueCategories.has(sender.category) ? 0.2 : 0.7;
    const engagementPenalty = unreadRatio(sender) * 0.3;
    return Math.max(0, Math.min(1, base - engagementPenalty));
  },

  async generateWeeklyHealthReport({ senders, history }) {
    const totalEmails = senders.reduce((sum, s) => sum + s.messageCount, 0);
    const totalBytes = senders.reduce((sum, s) => sum + s.totalSizeBytes, 0);
    const recentHistory = history.filter((h) => Date.now() - h.timestamp < 7 * 24 * 60 * 60 * 1000);
    const bytesFreedThisWeek = recentHistory.reduce((sum, h) => sum + h.bytesFreed, 0);
    const emailsRemovedThisWeek = recentHistory.reduce((sum, h) => sum + h.messageCount, 0);

    const suggestedActions = buildRecommendations(senders).slice(0, 5);
    const highValueCandidateBytes = suggestedActions.reduce((sum, r) => sum + r.estimatedBytesFreed, 0);

    const highlights = [
      `${totalEmails.toLocaleString()} emails analyzed across ${senders.length.toLocaleString()} senders, using ${formatBytes(totalBytes)}.`,
      emailsRemovedThisWeek > 0
        ? `Cleaned up ${emailsRemovedThisWeek.toLocaleString()} emails this week, freeing ${formatBytes(bytesFreedThisWeek)}.`
        : 'No cleanup actions taken this week.',
      suggestedActions.length > 0
        ? `${suggestedActions.length} more sender${suggestedActions.length === 1 ? '' : 's'} could be cleaned up for an estimated ${formatBytes(highValueCandidateBytes)} more.`
        : 'No further high-confidence cleanup opportunities right now.',
    ];

    return {
      summary: `Inbox health: ${totalEmails.toLocaleString()} emails tracked, ${formatBytes(totalBytes)} used.`,
      highlights,
      suggestedActions,
    };
  },

  async suggestSmartUnsubscribe(senders) {
    return buildRecommendations(senders).filter((r) => r.action === 'unsubscribe');
  },
};
