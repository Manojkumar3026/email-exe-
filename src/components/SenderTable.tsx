import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import type { SenderAggregate } from '../types/sender';
import { CATEGORY_LABELS } from '../types/category';
import { formatBytes, formatDistanceFromNow } from '../lib/util/formatBytes';

const ROW_HEIGHT = 64;

interface SenderTableProps {
  senders: SenderAggregate[];
  selectedKeys: Set<string>;
  onToggleSelect: (key: string) => void;
  onDeleteSender: (sender: SenderAggregate) => void;
  onArchiveSender: (sender: SenderAggregate) => void;
  onBlockSender: (sender: SenderAggregate) => void;
  height?: number;
}

interface RowData extends SenderTableProps {
  senders: SenderAggregate[];
}

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const sender = data.senders[index];
  const isSelected = data.selectedKeys.has(sender.key);

  return (
    <div
      style={style}
      className={`flex items-center gap-3 border-b border-slate-100 px-3 text-sm dark:border-slate-800 ${
        isSelected ? 'bg-brand-50 dark:bg-brand-950/30' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => data.onToggleSelect(sender.key)}
        aria-label={`Select ${sender.senderEmail}`}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{sender.senderName ?? sender.senderEmail}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{sender.senderEmail}</p>
      </div>
      <span className="hidden w-24 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-center text-xs font-medium text-slate-600 sm:block dark:bg-slate-800 dark:text-slate-300">
        {CATEGORY_LABELS[sender.category]}
      </span>
      <span className="w-16 shrink-0 text-right tabular-nums">{sender.messageCount.toLocaleString()}</span>
      <span className="hidden w-20 shrink-0 text-right tabular-nums md:block">{formatBytes(sender.totalSizeBytes)}</span>
      <span className="hidden w-28 shrink-0 text-right text-xs text-slate-500 lg:block dark:text-slate-400">
        {formatDistanceFromNow(sender.lastSeenAt)}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={() => data.onArchiveSender(sender)}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Archive
        </button>
        <button
          onClick={() => data.onDeleteSender(sender)}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Delete
        </button>
        <button
          onClick={() => data.onBlockSender(sender)}
          className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Block
        </button>
      </div>
    </div>
  );
}

export default function SenderTable(props: SenderTableProps) {
  const { senders, height = 480 } = props;

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3 border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span className="w-4" />
        <span className="flex-1">Sender</span>
        <span className="hidden w-24 text-center sm:block">Category</span>
        <span className="w-16 text-right">Emails</span>
        <span className="hidden w-20 text-right md:block">Size</span>
        <span className="hidden w-28 text-right lg:block">Last email</span>
        <span className="w-[190px]">Actions</span>
      </div>
      {senders.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          No senders match the current filters.
        </div>
      ) : (
        <FixedSizeList
          height={height}
          width="100%"
          itemCount={senders.length}
          itemSize={ROW_HEIGHT}
          itemData={props}
        >
          {Row}
        </FixedSizeList>
      )}
    </div>
  );
}
