import { useState } from 'react';
import type { SenderAggregate } from '../types/sender';
import type { BulkActionType } from '../types/job';
import { formatBytes } from '../lib/util/formatBytes';
import ConfirmDestructiveModal from './ConfirmDestructiveModal';

interface PendingAction {
  actionType: BulkActionType;
  actionVerb: string;
  isPermanent: boolean;
}

const ACTIONS: PendingAction[] = [
  { actionType: 'archive', actionVerb: 'archive', isPermanent: false },
  { actionType: 'mark_read', actionVerb: 'mark read', isPermanent: false },
  { actionType: 'delete', actionVerb: 'delete', isPermanent: false },
];

const PERMANENT_ACTION: PendingAction = {
  actionType: 'permanent_delete',
  actionVerb: 'permanently delete',
  isPermanent: true,
};

interface BulkActionToolbarProps {
  selectedSenders: SenderAggregate[];
  onRun: (actionType: BulkActionType) => void;
  onClearSelection: () => void;
  isPending?: boolean;
}

export default function BulkActionToolbar({
  selectedSenders,
  onRun,
  onClearSelection,
  isPending,
}: BulkActionToolbarProps) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (selectedSenders.length === 0) return null;

  const affectedCount = selectedSenders.reduce((sum, s) => sum + s.messageCount, 0);
  const affectedBytes = selectedSenders.reduce((sum, s) => sum + s.totalSizeBytes, 0);

  return (
    <>
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3 text-sm dark:border-brand-900 dark:bg-brand-950/40">
        <span className="font-medium">
          {selectedSenders.length} sender{selectedSenders.length === 1 ? '' : 's'} selected ·{' '}
          {affectedCount.toLocaleString()} emails · {formatBytes(affectedBytes)}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {ACTIONS.map((action) => (
            <button
              key={action.actionType}
              onClick={() => setPending(action)}
              className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium capitalize text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {action.actionVerb}
            </button>
          ))}
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 underline dark:text-slate-400"
          >
            Advanced
          </button>
          {showAdvanced && (
            <button
              onClick={() => setPending(PERMANENT_ACTION)}
              className="rounded-md border border-red-300 bg-white px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Permanently delete
            </button>
          )}
          <button
            onClick={onClearSelection}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
          >
            Clear
          </button>
        </div>
      </div>

      <ConfirmDestructiveModal
        open={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={() => {
          if (pending) onRun(pending.actionType);
          setPending(null);
        }}
        actionVerb={pending?.actionVerb ?? ''}
        affectedCount={affectedCount}
        senderCount={selectedSenders.length}
        estimatedBytesFreedLabel={formatBytes(affectedBytes)}
        isPermanent={pending?.isPermanent}
        isPending={isPending}
      />
    </>
  );
}
