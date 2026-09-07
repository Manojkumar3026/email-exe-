import type { Account } from '../../types/account';
import type { EmailMessage } from '../../types/email';
import { chunk } from '../util/chunk';
import { GmailApiError, gmailFetchJson } from './client';
import { GMAIL_QUOTA_UNITS, takeQuota } from './quota';

interface GmailListResponse {
  messages?: { id: string; threadId: string }[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailHeader {
  name: string;
  value: string;
}

interface GmailMessageResource {
  id: string;
  threadId: string;
  labelIds?: string[];
  sizeEstimate?: number;
  internalDate?: string;
  payload?: { headers?: GmailHeader[] };
}

const METADATA_HEADERS = ['From', 'Subject', 'List-Unsubscribe', 'List-Unsubscribe-Post'];

export interface ListPage {
  ids: string[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailProfileResponse {
  emailAddress: string;
  historyId: string;
}

export async function getProfile(account: Account): Promise<GmailProfileResponse> {
  return gmailFetchJson<GmailProfileResponse>(account, '/users/me/profile');
}

export async function listMessageIds(
  account: Account,
  opts: { pageToken?: string; maxResults?: number; q?: string; labelIds?: string[] } = {},
): Promise<ListPage> {
  await takeQuota(account.id, GMAIL_QUOTA_UNITS.messagesList);

  const params = new URLSearchParams({ maxResults: String(opts.maxResults ?? 500) });
  if (opts.pageToken) params.set('pageToken', opts.pageToken);
  if (opts.q) params.set('q', opts.q);
  for (const labelId of opts.labelIds ?? []) params.append('labelIds', labelId);

  const response = await gmailFetchJson<GmailListResponse>(
    account,
    `/users/me/messages?${params.toString()}`,
  );

  return {
    ids: (response.messages ?? []).map((m) => m.id),
    nextPageToken: response.nextPageToken,
    resultSizeEstimate: response.resultSizeEstimate,
  };
}

interface GmailHistoryResponse {
  history?: {
    messagesAdded?: { message: { id: string } }[];
    messagesDeleted?: { message: { id: string } }[];
  }[];
  nextPageToken?: string;
  historyId?: string;
}

export interface HistoryDelta {
  addedIds: string[];
  deletedIds: string[];
  nextPageToken?: string;
  historyId?: string;
  /** True when Gmail reports the startHistoryId is too old — caller must fall back to a full sync. */
  historyExpired: boolean;
}

export async function listHistoryDelta(
  account: Account,
  startHistoryId: string,
  pageToken?: string,
): Promise<HistoryDelta> {
  await takeQuota(account.id, GMAIL_QUOTA_UNITS.historyList);
  const params = new URLSearchParams({ startHistoryId, maxResults: '500' });
  if (pageToken) params.set('pageToken', pageToken);

  try {
    const response = await gmailFetchJson<GmailHistoryResponse>(
      account,
      `/users/me/history?${params.toString()}`,
    );
    const addedIds: string[] = [];
    const deletedIds: string[] = [];
    for (const entry of response.history ?? []) {
      for (const added of entry.messagesAdded ?? []) addedIds.push(added.message.id);
      for (const deleted of entry.messagesDeleted ?? []) deletedIds.push(deleted.message.id);
    }
    return {
      addedIds,
      deletedIds,
      nextPageToken: response.nextPageToken,
      historyId: response.historyId,
      historyExpired: false,
    };
  } catch (error) {
    if (error instanceof GmailApiError && error.status === 404) {
      return { addedIds: [], deletedIds: [], historyExpired: true };
    }
    throw error;
  }
}

function headerValue(headers: GmailHeader[] | undefined, name: string): string | undefined {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function parseFromHeader(value: string | undefined): { name?: string; email: string } {
  if (!value) return { email: 'unknown@unknown' };
  const match = value.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim();
    return { name: name || undefined, email: match[2].trim().toLowerCase() };
  }
  return { email: value.trim().toLowerCase() };
}

export function toEmailMessage(account: Account, resource: GmailMessageResource): EmailMessage {
  const headers = resource.payload?.headers;
  const from = parseFromHeader(headerValue(headers, 'From'));
  const listUnsubscribe = headerValue(headers, 'List-Unsubscribe');
  const listUnsubscribePost = headerValue(headers, 'List-Unsubscribe-Post');
  const labels = resource.labelIds ?? [];

  return {
    id: resource.id,
    accountId: account.id,
    threadId: resource.threadId,
    senderEmail: from.email,
    senderName: from.name,
    subject: headerValue(headers, 'Subject') ?? '(no subject)',
    receivedAt: resource.internalDate ? Number(resource.internalDate) : Date.now(),
    sizeEstimateBytes: resource.sizeEstimate ?? 0,
    labels,
    hasListUnsubscribe: Boolean(listUnsubscribe),
    listUnsubscribeHeader: listUnsubscribe,
    listUnsubscribePostHeader: listUnsubscribePost,
    isRead: !labels.includes('UNREAD'),
  };
}

/**
 * Fetches metadata for a set of message ids. Uses capped-concurrency individual GETs rather
 * than Gmail's multipart batch endpoint — simpler and easier to reason about correctness-wise;
 * the shared quota bucket in quota.ts keeps this within rate limits regardless. Multipart
 * batching remains a viable future optimization if per-message overhead becomes a bottleneck.
 */
export async function getMessagesMetadata(
  account: Account,
  ids: string[],
  concurrency = 10,
): Promise<EmailMessage[]> {
  const results: EmailMessage[] = [];
  const queue = [...ids];

  async function worker() {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      await takeQuota(account.id, GMAIL_QUOTA_UNITS.messagesGet);
      const params = METADATA_HEADERS.map((h) => `metadataHeaders=${encodeURIComponent(h)}`).join('&');
      const resource = await gmailFetchJson<GmailMessageResource>(
        account,
        `/users/me/messages/${id}?format=metadata&${params}`,
      );
      results.push(toEmailMessage(account, resource));
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return results;
}

export interface BatchModifyResult {
  successIds: string[];
  failedIds: string[];
}

async function batchModifyChunk(
  account: Account,
  ids: string[],
  body: { addLabelIds?: string[]; removeLabelIds?: string[] },
): Promise<BatchModifyResult> {
  await takeQuota(account.id, GMAIL_QUOTA_UNITS.messagesBatchModify);
  try {
    await gmailFetchJson(account, '/users/me/messages/batchModify', {
      method: 'POST',
      body: JSON.stringify({ ids, ...body }),
    });
    return { successIds: ids, failedIds: [] };
  } catch {
    return { successIds: [], failedIds: ids };
  }
}

export async function batchModify(
  account: Account,
  ids: string[],
  body: { addLabelIds?: string[]; removeLabelIds?: string[] },
): Promise<BatchModifyResult> {
  const chunks = chunk(ids, 1000);
  const results = await Promise.all(chunks.map((c) => batchModifyChunk(account, c, body)));
  return {
    successIds: results.flatMap((r) => r.successIds),
    failedIds: results.flatMap((r) => r.failedIds),
  };
}

/** Soft delete: moves messages to Trash (recoverable), matching the extension's default. */
export function trashMessages(account: Account, ids: string[]): Promise<BatchModifyResult> {
  return batchModify(account, ids, { addLabelIds: ['TRASH'] });
}

export function archiveMessages(account: Account, ids: string[]): Promise<BatchModifyResult> {
  return batchModify(account, ids, { removeLabelIds: ['INBOX'] });
}

export function markRead(account: Account, ids: string[]): Promise<BatchModifyResult> {
  return batchModify(account, ids, { removeLabelIds: ['UNREAD'] });
}

/** Irreversible. Gated behind an explicit advanced setting + strong confirmation in the UI. */
export async function permanentlyDeleteMessages(
  account: Account,
  ids: string[],
): Promise<BatchModifyResult> {
  const chunks = chunk(ids, 1000);
  const results = await Promise.all(
    chunks.map(async (c) => {
      await takeQuota(account.id, GMAIL_QUOTA_UNITS.messagesBatchDelete);
      try {
        await gmailFetchJson(account, '/users/me/messages/batchDelete', {
          method: 'POST',
          body: JSON.stringify({ ids: c }),
        });
        return { successIds: c, failedIds: [] };
      } catch {
        return { successIds: [], failedIds: c };
      }
    }),
  );
  return {
    successIds: results.flatMap((r) => r.successIds),
    failedIds: results.flatMap((r) => r.failedIds),
  };
}
