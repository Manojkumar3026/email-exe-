import type { SenderAggregate } from '../../types/sender';

export function unreadRatio(sender: SenderAggregate): number {
  if (sender.messageCount === 0) return 0;
  return sender.unreadCount / sender.messageCount;
}

/** Rough 0-1 confidence that acting on this sender is a good idea — high unread ratio
 *  (mail piling up unread) and a working unsubscribe link both push confidence up. */
export function computeConfidence(sender: SenderAggregate): number {
  const ratio = unreadRatio(sender);
  const unsubscribeBonus = sender.hasListUnsubscribe ? 0.25 : 0;
  return Math.min(1, ratio * 0.7 + unsubscribeBonus + Math.min(sender.messageCount / 500, 0.15));
}
