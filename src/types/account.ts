export type Provider = 'gmail' | 'outlook';

export interface EncryptedTokenBlob {
  iv: string; // base64
  ciphertext: string; // base64
}

export interface AccountTokens {
  accessToken: EncryptedTokenBlob;
  refreshToken?: EncryptedTokenBlob; // outlook (PKCE) only; google refresh is silent via chrome.identity
  expiresAt: number; // epoch ms
  scope: string[];
  /** Google accounts authenticated via chrome.identity.getAuthToken have no explicit code_verifier flow. */
  authMethod: 'chrome-identity' | 'pkce';
}

export type AccountStatus = 'connected' | 'needs_reauth' | 'error';

export interface Account {
  id: string; // `${provider}:${emailAddress}`
  provider: Provider;
  emailAddress: string;
  displayName?: string;
  connectedAt: number;
  lastSyncAt?: number;
  syncCursor?: string; // Gmail historyId or Graph deltaLink
  status: AccountStatus;
  lastError?: string;
}

export function makeAccountId(provider: Provider, emailAddress: string): string {
  return `${provider}:${emailAddress.toLowerCase()}`;
}
