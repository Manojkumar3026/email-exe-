import type { Account } from '../../types/account';
import { gmailFetchJson } from './client';
import { GMAIL_QUOTA_UNITS, takeQuota } from './quota';

export interface GmailLabel {
  id: string;
  name: string;
  type: 'system' | 'user';
}

interface GmailLabelsListResponse {
  labels?: GmailLabel[];
}

export async function listLabels(account: Account): Promise<GmailLabel[]> {
  await takeQuota(account.id, GMAIL_QUOTA_UNITS.labelsList);
  const response = await gmailFetchJson<GmailLabelsListResponse>(account, '/users/me/labels');
  return response.labels ?? [];
}
