// Google OAuth via chrome.identity.getAuthToken — the native flow for the Chrome profile's
// primary signed-in Google account. No client secret, no PKCE dance; Chrome brokers consent
// and can silently refresh the token as long as the user stays signed into the browser.

import { makeAccountId, type Account } from '../../types/account';
import { getAccessToken as readAccessToken, setTokens, clearTokens } from './tokenStore';

const GOOGLE_TOKEN_ASSUMED_TTL_MS = 55 * 60 * 1000; // getAuthToken doesn't expose exact expiry

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
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

async function fetchUserEmail(token: string): Promise<string | undefined> {
  let apiErrorMessage: string | undefined;

  // 1. Try standard userinfo endpoint
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { email?: string };
      if (data.email) return data.email;
    }
  } catch {
    // Ignore
  }

  // 2. Try Gmail API profile (accessible via gmail.readonly scope)
  try {
    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { emailAddress?: string };
      if (data.emailAddress) return data.emailAddress;
    } else {
      const errText = await res.text();
      console.error('Gmail API profile check failed:', res.status, errText);
      try {
        const errJson = JSON.parse(errText);
        if (errJson?.error?.message) {
          apiErrorMessage = errJson.error.message;
        }
      } catch {
        apiErrorMessage = errText;
      }
    }
  } catch (err) {
    console.error('Failed to call Gmail API profile endpoint:', err);
  }

  // 3. Try chrome.identity.getProfileUserInfo
  try {
    const profile = await chrome.identity.getProfileUserInfo({
      accountStatus: chrome.identity.AccountStatus.ANY,
    });
    if (profile.email) return profile.email;
  } catch {
    // Ignore
  }

  if (apiErrorMessage) {
    throw new Error(`Google API responded with error: ${apiErrorMessage}`);
  }

  return undefined;
}

export async function connectGoogleAccount(): Promise<Account> {
  const token = await getAuthTokenAsync(true);
  if (!token) throw new Error('Google sign-in was cancelled or returned no token.');

  try {
    const email = await fetchUserEmail(token);
    if (!email) {
      throw new Error(
        'Could not determine the Google account email. Please check your connection and try again.',
      );
    }

    const accountId = makeAccountId('gmail', email);
    await storeGoogleTokens(accountId, token);

    return {
      id: accountId,
      provider: 'gmail',
      emailAddress: email,
      connectedAt: Date.now(),
      status: 'connected',
    };
  } catch (err) {
    await chrome.identity.removeCachedAuthToken({ token });
    throw err;
  }
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
