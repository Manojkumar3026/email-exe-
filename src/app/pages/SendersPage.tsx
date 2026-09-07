import { useMemo, useState } from 'react';
import { useAccounts } from '../../hooks/useAccounts';
import { useSenders } from '../../hooks/useDashboardStats';
import { useStartBulkAction, useBlockSender, useJobProgress, useCancelJob, useRetryJob } from '../../hooks/useBulkAction';
import { useUIStore } from '../../store/useUIStore';
import { useJobStore } from '../../store/useJobStore';
import { listMessageIdsBySender } from '../../lib/db/messagesRepo';
import SenderTable from '../../components/SenderTable';
import BulkActionToolbar from '../../components/BulkActionToolbar';
import ConfirmDestructiveModal from '../../components/ConfirmDestructiveModal';
import ProgressBar from '../../components/ui/ProgressBar';
import { CATEGORY_LABELS, type CategoryId } from '../../types/category';
import type { SenderAggregate } from '../../types/sender';
import type { BulkActionType } from '../../types/job';

async function resolveTargetIds(accountId: string, senders: SenderAggregate[]): Promise<string[]> {
  const lists = await Promise.all(senders.map((s) => listMessageIdsBySender(accountId, s.senderEmail)));
  return lists.flat();
}

function JobProgressPanel({ jobId }: { jobId: string }) {
  const { data: job } = useJobProgress(jobId);
  const cancelJob = useCancelJob();
  const retryJob = useRetryJob();
  const setActiveJobId = useJobStore((s) => s.setActiveJobId);

  if (!job) return null;

  const isTerminal = job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium capitalize">
          {job.actionType.replace('_', ' ')} — {job.status}
        </span>
        <div className="flex items-center gap-2">
          {!isTerminal && (
            <button
              onClick={() => cancelJob.mutate(job.id)}
              className="text-xs font-medium text-slate-500 underline dark:text-slate-400"
            >
              Cancel
            </button>
          )}
          {isTerminal && (
            <button
              onClick={() => setActiveJobId(null)}
              className="text-xs font-medium text-slate-500 underline dark:text-slate-400"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
      <div className="mt-2">
        <ProgressBar value={job.processedCount} total={job.totalCount} />
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {job.processedCount.toLocaleString()} / {job.totalCount.toLocaleString()} processed ·{' '}
        <span className="text-emerald-600 dark:text-emerald-400">{job.successCount.toLocaleString()} succeeded</span>
        {job.failedCount > 0 && (
          <>
            {' · '}
            <span className="text-red-600 dark:text-red-400">{job.failedCount.toLocaleString()} failed</span>
          </>
        )}
      </p>
      {isTerminal && job.failedCount > 0 && (
        <button
          onClick={() => retryJob.mutate(job.id)}
          className="mt-2 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Retry {job.failedCount.toLocaleString()} failed
        </button>
      )}
    </div>
  );
}

export default function SendersPage() {
  const { data: accounts } = useAccounts();
  const activeAccountId = useUIStore((s) => s.activeAccountId);
  const setActiveAccountId = useUIStore((s) => s.setActiveAccountId);
  const selectedKeys = useUIStore((s) => s.selectedSenderKeys);
  const toggleSenderSelection = useUIStore((s) => s.toggleSenderSelection);
  const clearSenderSelection = useUIStore((s) => s.clearSenderSelection);
  const jobId = useJobStore((s) => s.activeJobId);

  const accountId = activeAccountId ?? accounts?.[0]?.id;
  const { data: senders, isLoading } = useSenders(accountId);
  const startBulkAction = useStartBulkAction();
  const blockSender = useBlockSender();

  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all');
  const [search, setSearch] = useState('');
  const [singleAction, setSingleAction] = useState<{ sender: SenderAggregate; actionType: BulkActionType; verb: string } | null>(null);

  const filtered = useMemo(() => {
    if (!senders) return [];
    return senders.filter((s) => {
      if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
      if (search && !s.senderEmail.toLowerCase().includes(search.toLowerCase()) && !(s.senderName ?? '').toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [senders, categoryFilter, search]);

  const selectedSenders = filtered.filter((s) => selectedKeys.has(s.key));

  async function runBulkAction(actionType: BulkActionType) {
    if (!accountId) return;
    const targetMessageIds = await resolveTargetIds(accountId, selectedSenders);
    startBulkAction.mutate({ accountId, actionType, targetMessageIds });
    clearSenderSelection();
  }

  async function runSingleAction(sender: SenderAggregate, actionType: BulkActionType) {
    if (!accountId) return;
    const targetMessageIds = await resolveTargetIds(accountId, [sender]);
    startBulkAction.mutate({ accountId, actionType, targetMessageIds });
  }

  async function runBlockSender(sender: SenderAggregate) {
    if (!accountId) return;
    const existingMessageIds = await resolveTargetIds(accountId, [sender]);
    blockSender.mutate({ accountId, senderEmail: sender.senderEmail, existingMessageIds });
  }

  if (!accounts || accounts.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Senders</h2>
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Connect an account on the Accounts page to see sender data.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Senders</h2>
        <div className="flex flex-wrap items-center gap-2">
          {accounts.length > 1 && (
            <select
              value={accountId}
              onChange={(e) => setActiveAccountId(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.emailAddress}
                </option>
              ))}
            </select>
          )}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryId | 'all')}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="all">All categories</option>
            {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sender or email…"
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      </div>

      {jobId && <JobProgressPanel jobId={jobId} />}

      <BulkActionToolbar
        selectedSenders={selectedSenders}
        onRun={runBulkAction}
        onClearSelection={clearSenderSelection}
        isPending={startBulkAction.isPending}
      />

      {isLoading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading senders…</p>
      ) : (
        <SenderTable
          senders={filtered}
          selectedKeys={selectedKeys}
          onToggleSelect={toggleSenderSelection}
          onDeleteSender={(sender) => setSingleAction({ sender, actionType: 'delete', verb: 'delete' })}
          onArchiveSender={(sender) => setSingleAction({ sender, actionType: 'archive', verb: 'archive' })}
          onBlockSender={runBlockSender}
        />
      )}

      <ConfirmDestructiveModal
        open={singleAction !== null}
        onClose={() => setSingleAction(null)}
        onConfirm={() => {
          if (singleAction) void runSingleAction(singleAction.sender, singleAction.actionType);
          setSingleAction(null);
        }}
        actionVerb={singleAction?.verb ?? ''}
        affectedCount={singleAction?.sender.messageCount ?? 0}
        senderCount={1}
      />
    </div>
  );
}
