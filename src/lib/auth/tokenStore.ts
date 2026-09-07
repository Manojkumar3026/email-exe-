// Single choke point for reading/writing account tokens. Background and app code must
// go through here rather than touching chrome.storage directly, so encryption can never
// accidentally be bypassed.

import type { AccountTokens } from '../../types/account';
import { decryptString, encryptString } from './crypto';

function storageKey(accountId: string): string {
  return `icai:tokens:${accountId}`;
}

interface StoredTokens {
  accessToken: { iv: string; ciphertext: string };
  refreshToken?: { iv: string; ciphertext: string };
  expiresAt: number;
  scope: string[];
  authMethod: AccountTokens['authMethod'];
}

export async function setTokens(
  accountId: string,
  plain: { accessToken: string; refreshToken?: string; expiresAt: number; scope: string[]; authMethod: AccountTokens['authMethod'] },
): Promise<void> {
  const accessToken = await encryptString(plain.accessToken);
  const refreshToken = plain.refreshToken ? await encryptString(plain.refreshToken) : undefined;

  const record: StoredTokens = {
    accessToken,
    refreshToken,
    expiresAt: plain.expiresAt,
    scope: plain.scope,
    authMethod: plain.authMethod,
  };
  await chrome.storage.local.set({ [storageKey(accountId)]: record });
}

export async function getAccessToken(accountId: string): Promise<string | null> {
  const stored = await chrome.storage.local.get(storageKey(accountId));
  const record = stored[storageKey(accountId)] as StoredTokens | undefined;
  if (!record) return null;
  return decryptString(record.accessToken);
}

export async function getRefreshToken(accountId: string): Promise<string | null> {
  const stored = await chrome.storage.local.get(storageKey(accountId));
  const record = stored[storageKey(accountId)] as StoredTokens | undefined;
  if (!record?.refreshToken) return null;
  return decryptString(record.refreshToken);
}

export async function getTokenMeta(
  accountId: string,
): Promise<{ expiresAt: number; scope: string[]; authMethod: AccountTokens['authMethod'] } | null> {
  const stored = await chrome.storage.local.get(storageKey(accountId));
  const record = stored[storageKey(accountId)] as StoredTokens | undefined;
  if (!record) return null;
  return { expiresAt: record.expiresAt, scope: record.scope, authMethod: record.authMethod };
}

export async function clearTokens(accountId: string): Promise<void> {
  await chrome.storage.local.remove(storageKey(accountId));
}
