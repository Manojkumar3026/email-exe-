import { db } from './db';
import type { Account } from '../../types/account';

export async function upsertAccount(account: Account): Promise<void> {
  await db.accounts.put(account);
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return db.accounts.get(id);
}

export async function listAccounts(): Promise<Account[]> {
  return db.accounts.toArray();
}

export async function removeAccount(id: string): Promise<void> {
  await db.transaction('rw', db.accounts, db.messages, db.senders, db.syncState, async () => {
    await db.accounts.delete(id);
    await db.messages.where('accountId').equals(id).delete();
    await db.senders.where('accountId').equals(id).delete();
    await db.syncState.delete(id);
  });
}

export async function updateAccountStatus(
  id: string,
  status: Account['status'],
  lastError?: string,
): Promise<void> {
  await db.accounts.update(id, { status, lastError });
}
