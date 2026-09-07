// Google OAuth via chrome.identity.getAuthToken — the native flow for the Chrome profile's
// primary signed-in Google account. No client secret, no PKCE dance; Chrome brokers consent
// and can silently refresh the token as long as the user stays signed into the browser.

import { makeAccountId, type Account } from '../../types/account';
import { getAccessToken as readAccessToken, setTokens, clearTokens } from './tokenStore';

const GOOGLE_TOKEN_ASSUMED_TTL_MS = 55 * 60 * 1000; // getAuthToken doesn't expose exact expiry

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
];

async function getAuthTokenAsync(interactive: boolean): Promise<string | undefined> {
  const result = await chrome.identity.getAuthToken({ interactive });
  return result.token;
}

async function storeGoogleTokens(accountId: string, token: string): Promise<void> {
  await setTokens(accountId, {
    accessToken: token,
    expiresAt: Date.now() + GOOGLE_TOKEN_ASSUMED_TTL_MS,
    scope: GMAIL_SCOPES,
    authMethod: 'chrome-identity',
  });
}

export async function connectGoogleAccount(): Promise<Account> {
  const token = await getAuthTokenAsync(true);
  if (!token) throw new Error('Google sign-in was cancelled or returned no token.');

  const profile = await chrome.identity.getProfileUserInfo({
    accountStatus: chrome.identity.AccountStatus.ANY,
  });
  if (!profile.email) {
    await chrome.identity.removeCachedAuthToken({ token });
    throw new Error(
      'Could not determine the Google account email. Make sure you are signed into Chrome.',
    );
  }

  const accountId = makeAccountId('gmail', profile.email);
  await storeGoogleTokens(accountId, token);

  return {
    id: accountId,
    provider: 'gmail',
    emailAddress: profile.email,
    connectedAt: Date.now(),
    status: 'connected',
  };
}

/** Forces Chrome to fetch a fresh token, discarding whatever it has cached. */
export async function refreshGoogleToken(accountId: string): Promise<string> {
  const stale = await readAccessToken(accountId);
  if (stale) await chrome.identity.removeCachedAuthToken({ token: stale });

  const token = await getAuthTokenAsync(false);
  if (!token) throw new Error('Silent Google token refresh failed — user needs to reconnect.');

  await storeGoogleTokens(accountId, token);
  return token;
}

export async function disconnectGoogleAccount(accountId: string): Promise<void> {
  const token = await readAccessToken(accountId);
  if (token) {
    await chrome.identity.removeCachedAuthToken({ token });
    try {
      await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${encodeURIComponent(token)}`);
    } catch {
      // Best-effort revoke — token is discarded locally regardless.
    }
  }
  await clearTokens(accountId);
}
