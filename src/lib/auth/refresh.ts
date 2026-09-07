// Provider-agnostic "give me a valid access token" entry point. Gmail/Outlook API clients
// call this instead of reading tokenStore directly, so refresh-on-expiry is never forgotten.

import type { Account } from '../../types/account';
import { getAccessToken, getTokenMeta } from './tokenStore';
import { refreshGoogleToken } from './googleAuth';

const EXPIRY_SAFETY_MARGIN_MS = 2 * 60 * 1000;

export async function ensureFreshAccessToken(account: Account): Promise<string> {
  const meta = await getTokenMeta(account.id);
  if (!meta) throw new Error(`No stored tokens for account ${account.id}. Reconnect required.`);

  const isExpiring = Date.now() + EXPIRY_SAFETY_MARGIN_MS >= meta.expiresAt;
  if (!isExpiring) {
    const token = await getAccessToken(account.id);
    if (token) return token;
  }

  if (account.provider === 'gmail') {
    return refreshGoogleToken(account.id);
  }

  // Outlook PKCE refresh lands in milestone 5 (src/lib/auth/msalPkce.ts).
  throw new Error(`Token refresh not yet implemented for provider "${account.provider}".`);
}
