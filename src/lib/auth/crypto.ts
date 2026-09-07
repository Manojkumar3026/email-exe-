// AES-GCM encryption for OAuth tokens at rest in chrome.storage.local.
//
// MV3 extensions have no OS keystore access, so the AES key itself must also live in
// chrome.storage.local. This protects tokens against casual inspection (other extensions,
// someone poking at storage in devtools) — not against a fully compromised machine, which
// is the realistic security bar for a backend-less extension.

import type { EncryptedTokenBlob } from '../../types/account';

const KEY_STORAGE_KEY = 'icai:cryptoKey';

let cachedKey: CryptoKey | null = null;

function bufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function loadOrCreateKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const stored = await chrome.storage.local.get(KEY_STORAGE_KEY);
  const existing = stored[KEY_STORAGE_KEY] as string | undefined;

  if (existing) {
    const raw = base64ToBuffer(existing);
    cachedKey = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, [
      'encrypt',
      'decrypt',
    ]);
    return cachedKey;
  }

  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
  const exported = await crypto.subtle.exportKey('raw', key);
  await chrome.storage.local.set({ [KEY_STORAGE_KEY]: bufferToBase64(exported) });
  cachedKey = key;
  return key;
}

export async function encryptString(plaintext: string): Promise<EncryptedTokenBlob> {
  const key = await loadOrCreateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return { iv: bufferToBase64(iv), ciphertext: bufferToBase64(ciphertext) };
}

export async function decryptString(blob: EncryptedTokenBlob): Promise<string> {
  const key = await loadOrCreateKey();
  const iv = base64ToBuffer(blob.iv);
  const ciphertext = base64ToBuffer(blob.ciphertext);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}
