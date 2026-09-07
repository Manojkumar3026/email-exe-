import { useState } from 'react';
import {
  useAccounts,
  useConnectGoogleAccount,
  useConnectMicrosoftAccount,
  useDisconnectAccount,
} from '../../hooks/useAccounts';
import { useSyncNow } from '../../hooks/useSync';
import { listMessageIds, getMessagesMetadata } from '../../lib/gmail/messages';
import { formatDistanceFromNow } from '../../lib/util/formatBytes';
import type { Account } from '../../types/account';

function TestFetchPanel({ account }: { account: Account }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function runTestFetch() {
    setStatus('loading');
    setError(null);
    try {
      const page = await listMessageIds(account, { maxResults: 50 });
      const messages = await getMessagesMetadata(account, page.ids);
      setCount(messages.length);
      setStatus('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  }

  return (
    <div className="mt-2 flex items-center gap-3 text-sm">
      <button
        onClick={runTestFetch}
        disabled={status === 'loading'}
        className="rounded-md border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        {status === 'loading' ? 'Fetching…' : 'Fetch first 50 messages'}
      </button>
      {status === 'done' && (
        <span className="text-emerald-600 dark:text-emerald-400">Fetched {count} messages</span>
      )}
      {status === 'error' && <span className="text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

export default function AccountsPage() {
  const { data: accounts, isLoading } = useAccounts();
  const connectGoogle = useConnectGoogleAccount();
  const connectMicrosoft = useConnectMicrosoftAccount();
  const disconnect = useDisconnectAccount();
  const syncNow = useSyncNow();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Accounts</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => connectMicrosoft.mutate()}
            disabled={connectMicrosoft.isPending}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {connectMicrosoft.isPending ? 'Connecting…' : 'Connect Outlook'}
          </button>
          <button
            onClick={() => connectGoogle.mutate()}
            disabled={connectGoogle.isPending}
            className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {connectGoogle.isPending ? 'Connecting…' : 'Connect Gmail'}
          </button>
        </div>
      </div>

      {(connectGoogle.isError || connectMicrosoft.isError) && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {connectGoogle.error instanceof Error
            ? connectGoogle.error.message
            : connectMicrosoft.error instanceof Error
              ? connectMicrosoft.error.message
              : 'Failed to connect.'}
        </p>
      )}

      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading accounts…</p>}

      {!isLoading && (accounts?.length ?? 0) === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No accounts connected yet. Connect a Gmail or Outlook account to get started.
        </div>
      )}

      <ul className="space-y-3">
        {accounts?.map((account) => (
          <li
            key={account.id}
            className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{account.emailAddress}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {account.provider} · {account.status}
                  {account.lastSyncAt && ` · synced ${formatDistanceFromNow(account.lastSyncAt)}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => syncNow.mutate(account.id)}
                  disabled={syncNow.isPending}
                  className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {syncNow.isPending ? 'Syncing…' : 'Sync now'}
                </button>
                <button
                  onClick={() => disconnect.mutate(account)}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Disconnect
                </button>
              </div>
            </div>
            {syncNow.isError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {syncNow.error instanceof Error ? syncNow.error.message : 'Sync failed'}
              </p>
            )}
            {account.provider === 'gmail' && <TestFetchPanel account={account} />}
          </li>
        ))}
      </ul>
    </div>
  );
}
