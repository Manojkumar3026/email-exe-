import type { CategoryId } from './category';

export interface SenderAggregate {
  /** Compound key: `${accountId}::${senderEmail}` */
  key: string;
  senderEmail: string;
  senderName?: string;
  accountId: string;
  messageCount: number;
  totalSizeBytes: number;
  firstSeenAt: number;
  lastSeenAt: number;
  frequencyPerWeek: number;
  category: CategoryId;
  hasListUnsubscribe: boolean;
  unreadCount: number;
}

export function makeSenderKey(accountId: string, senderEmail: string): string {
  return `${accountId}::${senderEmail.toLowerCase()}`;
}
