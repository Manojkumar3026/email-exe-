import type { Account } from '../../types/account';
import type { EmailMessage } from '../../types/email';
import { graphFetchJson } from './client';
import { executeGraphBatch } from './batch';
import type { BatchActionResult } from '../providerAdapter';

const SELECT_FIELDS = [
  'id',
  'subject',
  'from',
  'receivedDateTime',
  'isRead',
  'categories',
  'internetMessageHeaders',
  'bodyPreview',
  'hasAttachments',
].join(',');

const DELTA_BASE = `/me/mailFolders/inbox/messages/delta?$select=${SELECT_FIELDS}&$top=50`;

interface GraphHeader {
  name: string;
  value: string;
}

interface GraphMessageResource {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  isRead?: boolean;
  categories?: string[];
  internetMessageHeaders?: GraphHeader[];
  bodyPreview?: string;
  hasAttachments?: boolean;
  '@removed'?: { reason: string };
}

interface GraphDeltaResponse {
  value: GraphMessageResource[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

function headerValue(headers: GraphHeader[] | undefined, name: string): string | undefined {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

/** Graph doesn't expose a message size field in v1.0; approximate from body preview length
 *  and attachment presence. Documented limitation — see the setup guide. */
function estimateSizeBytes(resource: GraphMessageResource): number {
  const base = 2000;
  const bodyBytes = (resource.bodyPreview?.length ?? 0) * 3;
  const attachmentAllowance = resource.hasAttachments ? 50_000 : 0;
  return base + bodyBytes + attachmentAllowance;
}

export function toEmailMessage(account: Account, resource: GraphMessageResource): EmailMessage {
  const listUnsubscribe = headerValue(resource.internetMessageHeaders, 'List-Unsubscribe');
  const listUnsubscribePost = headerValue(resource.internetMessageHeaders, 'List-Unsubscribe-Post');

  return {
    id: resource.id,
    accountId: account.id,
    senderEmail: (resource.from?.emailAddress?.address ?? 'unknown@unknown').toLowerCase(),
    senderName: resource.from?.emailAddress?.name,
    subject: resource.subject || '(no subject)',
    receivedAt: resource.receivedDateTime ? new Date(resource.receivedDateTime).getTime() : Date.now(),
    sizeEstimateBytes: estimateSizeBytes(resource),
    labels: resource.categories ?? [],
    hasListUnsubscribe: Boolean(listUnsubscribe),
    listUnsubscribeHeader: listUnsubscribe,
    listUnsubscribePostHeader: listUnsubscribePost,
    isRead: resource.isRead ?? true,
  };
}

export interface GraphDeltaPage {
  addedMessages: GraphMessageResource[];
  removedIds: string[];
  nextLink?: string;
  deltaLink?: string;
}

/** `cursorUrl` is either undefined (start a fresh full crawl), an @odata.nextLink (continue
 *  crawling), or an @odata.deltaLink (poll for incremental changes since last sync). */
export async function fetchDeltaPage(account: Account, cursorUrl?: string): Promise<GraphDeltaPage> {
  const url = cursorUrl ?? `https://graph.microsoft.com/v1.0${DELTA_BASE}`;
  const response = await graphFetchJson<GraphDeltaResponse>(account, url);

  const addedMessages = response.value.filter((m) => !m['@removed']);
  const removedIds = response.value.filter((m) => m['@removed']).map((m) => m.id);

  return {
    addedMessages,
    removedIds,
    nextLink: response['@odata.nextLink'],
    deltaLink: response['@odata.deltaLink'],
  };
}

function idsToBatchResult(ids: string[], statuses: Map<string, boolean>): BatchActionResult {
  const successIds: string[] = [];
  const failedIds: string[] = [];
  for (const id of ids) (statuses.get(id) ? successIds : failedIds).push(id);
  return { successIds, failedIds };
}

export async function moveMessages(
  account: Account,
  ids: string[],
  destinationId: 'deleteditems' | 'archive',
): Promise<BatchActionResult> {
  const statuses = await executeGraphBatch(
    account,
    ids.map((id) => ({ id, method: 'POST', url: `/me/messages/${id}/move`, body: { destinationId } })),
  );
  return idsToBatchResult(ids, statuses);
}

export async function markMessagesRead(account: Account, ids: string[]): Promise<BatchActionResult> {
  const statuses = await executeGraphBatch(
    account,
    ids.map((id) => ({ id, method: 'PATCH', url: `/me/messages/${id}`, body: { isRead: true } })),
  );
  return idsToBatchResult(ids, statuses);
}

export async function deleteMessagesPermanently(account: Account, ids: string[]): Promise<BatchActionResult> {
  const statuses = await executeGraphBatch(
    account,
    ids.map((id) => ({ id, method: 'DELETE', url: `/me/messages/${id}` })),
  );
  return idsToBatchResult(ids, statuses);
}

export async function createBlockSenderRule(account: Account, senderEmail: string): Promise<void> {
  await graphFetchJson(account, '/me/mailFolders/inbox/messageRules', {
    method: 'POST',
    body: JSON.stringify({
      displayName: `Inbox Cleaner AI: block ${senderEmail}`,
      sequence: 1,
      isEnabled: true,
      conditions: { senderContains: [senderEmail] },
      actions: { moveToFolder: 'deleteditems', stopProcessingRules: true },
    }),
  });
}
