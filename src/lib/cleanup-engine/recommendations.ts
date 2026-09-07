import type { SenderAggregate } from '../../types/sender';
import type { CleanupRecommendation, CleanupSettings } from '../../types/cleanup';
import { DEFAULT_CLEANUP_SETTINGS } from '../../types/cleanup';
import { computeConfidence, unreadRatio } from './scoring';
import { formatBytes } from '../util/formatBytes';

function pickAction(sender: SenderAggregate): CleanupRecommendation['action'] | undefined {
  switch (sender.category) {
    case 'promotions':
    case 'spam_like':
      return 'delete';
    case 'newsletters':
      return sender.hasListUnsubscribe ? 'unsubscribe' : 'delete';
    case 'social':
      return 'archive';
    default:
      return undefined;
  }
}

function buildReason(sender: SenderAggregate, action: CleanupRecommendation['action']): string {
  const pctUnread = Math.round(unreadRatio(sender) * 100);
  const base = `${sender.messageCount.toLocaleString()} emails, ${pctUnread}% unread, ${formatBytes(sender.totalSizeBytes)}`;
  if (action === 'unsubscribe') return `${base} — sender supports one-click unsubscribe`;
  return base;
}

/** Pure, deterministic — safe to run in the background or a component render. */
export function buildRecommendations(
  senders: SenderAggregate[],
  settings: CleanupSettings = DEFAULT_CLEANUP_SETTINGS,
): CleanupRecommendation[] {
  const recommendations: CleanupRecommendation[] = [];

  for (const sender of senders) {
    if (sender.messageCount < settings.minMessageCountForRecommendation) continue;
    const action = pickAction(sender);
    if (!action) continue;
    if (action === 'delete' && unreadRatio(sender) < settings.minUnreadRatioForDelete) continue;

    recommendations.push({
      id: sender.key,
      senderEmail: sender.senderEmail,
      accountId: sender.accountId,
      action,
      affectedCount: sender.messageCount,
      estimatedBytesFreed: action === 'unsubscribe' ? 0 : sender.totalSizeBytes,
      reason: buildReason(sender, action),
      confidence: computeConfidence(sender),
    });
  }

  return recommendations.sort((a, b) => b.confidence - a.confidence || b.affectedCount - a.affectedCount);
}
