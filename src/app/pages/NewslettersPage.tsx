import { useMemo, useState } from 'react';
import { useAccounts } from '../../hooks/useAccounts';
import { useSenders } from '../../hooks/useDashboardStats';
import { useStartBulkAction } from '../../hooks/useBulkAction';
import { getMostRecentMessageForSender, listMessageIdsBySender } from '../../lib/db/messagesRepo';
import { openUnsubscribeLink, parseListUnsubscribe } from '../../lib/unsubscribe/listUnsubscribe';
import ConfirmDestructiveModal from '../../components/ConfirmDestructiveModal';
import { formatBytes } from '../../lib/util/formatBytes';
import type { SenderAggregate } from '../../types/sender';
import type { BulkActionType } from '../../types/job';

function UnsubscribeButton({ accountId, sender }: { accountId: string; sender: SenderAggregate }) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'opened' | 'none'>('idle');

  async function handleUnsubscribe() {
    setStatus('checking');
    const message = await getMostRecentMessageForSender(accountId, sender.senderEmail);
    const parsed = parseListUnsubscribe(message?.listUnsubscribeHeader, message?.listUnsubscribePostHeader);
    const opened = openUnsubscribeLink(parsed);
    setStatus(opened ? 'opened' : 'none');
  }

  return (
    <button
      onClick={handleUnsubscribe}
      disabled={status === 'checking'}
      className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {status === 'checking' && 'Opening…'}
      {status === 'opened' && 'Opened ↗'}
      {status === 'none' && 'No link found'}
      {status === 'idle' && 'Unsubscribe'}
    </button>
  );
}

export default function NewslettersPage() {
  const { data: accounts } = useAccounts();
  const accountId = accounts?.[0]?.id;
  const { data: senders, isLoading } = useSenders(accountId);
  const startBulkAction = useStartBulkAction();
  const [pending, setPending] = useState<{ sender: SenderAggregate; actionType: BulkActionType; verb: string } | null>(null);

  const newsletters = useMemo(
    () => (senders ?? []).filter((s) => s.hasListUnsubscribe).sort((a, b) => b.messageCount - a.messageCount),
    [senders],
  );

  async function runAction(sender: SenderAggregate, actionType: BulkActionType) {
    if (!accountId) return;
    const targetMessageIds = await listMessageIdsBySender(accountId, sender.senderEmail);
    startBulkAction.mutate({ accountId, actionType, targetMessageIds });
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Newsletters</h2>
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Connect an account to detect newsletters.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Newsletters</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Senders detected via the List-Unsubscribe header — {newsletters.length} found.
      </p>

      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>}

      {!isLoading && newsletters.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No newsletters detected yet. Sync an account from the Accounts page first.
        </div>
      )}

      <ul className="space-y-2">
        {newsletters.map((sender) => (
          <li
            key={sender.key}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{sender.senderName ?? sender.senderEmail}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {sender.senderEmail} · {sender.messageCount.toLocaleString()} emails · {formatBytes(sender.totalSizeBytes)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {accountId && <UnsubscribeButton accountId={accountId} sender={sender} />}
              <button
                onClick={() => setPending({ sender, actionType: 'archive', verb: 'archive' })}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Archive all
              </button>
              <button
                onClick={() => setPending({ sender, actionType: 'delete', verb: 'delete' })}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Delete all
              </button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDestructiveModal
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) void runAction(pending.sender, pending.actionType);
          setPending(null);
        }}
        actionVerb={pending?.verb ?? ''}
        affectedCount={pending?.sender.messageCount ?? 0}
        senderCount={1}
      />
    </div>
  );
}
