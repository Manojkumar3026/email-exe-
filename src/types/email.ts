import type { CategoryId } from './category';

/** Metadata only — the message body is never fetched or stored. */
export interface EmailMessage {
  id: string; // provider message id
  accountId: string;
  threadId?: string;
  senderEmail: string;
  senderName?: string;
  subject: string;
  receivedAt: number; // epoch ms
  sizeEstimateBytes: number;
  labels: string[]; // gmail labelIds or graph categories
  hasListUnsubscribe: boolean;
  listUnsubscribeHeader?: string;
  listUnsubscribePostHeader?: string;
  isRead: boolean;
  category?: CategoryId;
}
