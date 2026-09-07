// Microsoft OAuth via the Authorization Code + PKCE flow, driven through
// chrome.identity.launchWebAuthFlow. No client secret — the Azure app must be registered
// as a public/native client. Unlike Google, Microsoft's flow gives us an explicit
// refresh_token that we must store and use ourselves (see refreshMicrosoftToken below).

import { makeAccountId, type Account } from '../../types/account';
import { getRefreshToken, setTokens, clearTokens } from './tokenStore';

const MS_CLIENT_ID = import.meta.env.VITE_MS_CLIENT_ID ?? '';
const MS_TENANT = import.meta.env.VITE_MS_TENANT || 'common';
const GRAPH_SCOPES = ['offline_access', 'Mail.Read', 'Mail.ReadWrite', 'User.Read'];

function authorizeEndpoint(): string {
  return `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/authorize`;
}

function tokenEndpoint(): string {
  return `https://login.microsoftonline.com/${MS_TENANT}/oauth2/v2.0/token`;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function generateCodeVerifier(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}

async function exchangeCodeForTokens(code: string, codeVerifier: string, redirectUri: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    scope: GRAPH_SCOPES.join(' '),
  });
  const response = await fetch(tokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error(`Microsoft token exchange failed: ${await response.text()}`);
  return response.json();
}

async function exchangeRefreshToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: GRAPH_SCOPES.join(' '),
  });
  const response = await fetch(tokenEndpoint(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) throw new Error(`Microsoft token refresh failed: ${await response.text()}`);
  return response.json();
}

async function storeMicrosoftTokens(accountId: string, tokens: TokenResponse): Promise<void> {
  await setTokens(accountId, {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    scope: tokens.scope.split(' '),
    authMethod: 'pkce',
  });
}

interface GraphMeResponse {
  mail?: string;
  userPrincipalName: string;
  displayName?: string;
}

export async function connectMicrosoftAccount(): Promise<Account> {
  if (!MS_CLIENT_ID) {
    throw new Error('VITE_MS_CLIENT_ID is not configured. See .env.example and the setup guide.');
  }

  const redirectUri = chrome.identity.getRedirectURL();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();

  const authUrl = new URL(authorizeEndpoint());
  authUrl.searchParams.set('client_id', MS_CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', GRAPH_SCOPES.join(' '));
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('response_mode', 'query');

  const responseUrl = await chrome.identity.launchWebAuthFlow({ url: authUrl.toString(), interactive: true });
  if (!responseUrl) throw new Error('Microsoft sign-in was cancelled.');

  const redirected = new URL(responseUrl);
  const returnedState = redirected.searchParams.get('state');
  const code = redirected.searchParams.get('code');
  const error = redirected.searchParams.get('error_description');
  if (error) throw new Error(error);
  if (!code) throw new Error('Microsoft sign-in did not return an authorization code.');
  if (returnedState !== state) throw new Error('OAuth state mismatch — possible CSRF, aborting.');

  const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

  const meResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!meResponse.ok) throw new Error('Failed to read the Microsoft account profile.');
  const me: GraphMeResponse = await meResponse.json();
  const email = me.mail || me.userPrincipalName;

  const accountId = makeAccountId('outlook', email);
  await storeMicrosoftTokens(accountId, tokens);

  return {
    id: accountId,
    provider: 'outlook',
    emailAddress: email,
    displayName: me.displayName,
    connectedAt: Date.now(),
    status: 'connected',
  };
}

export async function refreshMicrosoftToken(accountId: string): Promise<string> {
  const refreshToken = await getRefreshToken(accountId);
  if (!refreshToken) throw new Error('No Microsoft refresh token stored — reconnect required.');
  const tokens = await exchangeRefreshToken(refreshToken);
  await storeMicrosoftTokens(accountId, tokens);
  return tokens.access_token;
}

export async function disconnectMicrosoftAccount(accountId: string): Promise<void> {
  // Public-client PKCE tokens have no simple extension-side revoke endpoint; discarding the
  // stored tokens is the practical disconnect action (matches what most MSAL-based apps do).
  await clearTokens(accountId);
}
