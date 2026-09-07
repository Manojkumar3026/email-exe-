import Modal from './ui/Modal';

interface ConfirmDestructiveModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  actionVerb: string; // "delete", "permanently delete", "archive", "mark read", "block"
  affectedCount: number;
  senderCount: number;
  estimatedBytesFreedLabel?: string;
  isPermanent?: boolean;
  isPending?: boolean;
}

export default function ConfirmDestructiveModal({
  open,
  onClose,
  onConfirm,
  actionVerb,
  affectedCount,
  senderCount,
  estimatedBytesFreedLabel,
  isPermanent = false,
  isPending = false,
}: ConfirmDestructiveModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Confirm: ${actionVerb}`}
      footer={
        <button
          onClick={onConfirm}
          disabled={isPending}
          className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
            isPermanent ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
          }`}
        >
          {isPending ? 'Working…' : `Yes, ${actionVerb}`}
        </button>
      }
    >
      <p>
        You are about to <strong>{actionVerb}</strong> {affectedCount.toLocaleString()} email
        {affectedCount === 1 ? '' : 's'} from {senderCount.toLocaleString()} sender
        {senderCount === 1 ? '' : 's'}.
      </p>
      {estimatedBytesFreedLabel && (
        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Estimated space freed: {estimatedBytesFreedLabel}
        </p>
      )}
      {isPermanent ? (
        <p className="mt-3 rounded-md bg-red-50 p-2 text-red-700 dark:bg-red-950/40 dark:text-red-300">
          This is a permanent delete and cannot be undone.
        </p>
      ) : (
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          Deleted messages go to Trash and can be recovered until it empties.
        </p>
      )}
    </Modal>
  );
}
