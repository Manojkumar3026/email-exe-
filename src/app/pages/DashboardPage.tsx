import { useDashboardStats, useSenders } from '../../hooks/useDashboardStats';
import { useAccounts } from '../../hooks/useAccounts';
import { formatBytes } from '../../lib/util/formatBytes';
import { CATEGORY_LABELS } from '../../types/category';
import StatCard from '../../components/ui/StatCard';
import Skeleton from '../../components/ui/Skeleton';
import CleanupRecommendationsPanel from '../../components/CleanupRecommendationsPanel';

export default function DashboardPage() {
  const { data: accounts } = useAccounts();
  const { stats, isLoading } = useDashboardStats();
  const { data: senders } = useSenders(accounts?.[0]?.id);

  if (!accounts || accounts.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Connect a Gmail or Outlook account on the Accounts page to see inbox stats here.
        </div>
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Dashboard</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Dashboard</h2>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Emails analyzed" value={stats.totalEmails.toLocaleString()} />
        <StatCard label="Storage used" value={formatBytes(stats.storageBytes)} />
        <StatCard
          label="Space recoverable"
          value={formatBytes(stats.potentialCleanupBytes)}
          hint={`${stats.potentialCleanupCount.toLocaleString()} emails`}
        />
        <StatCard label="Connected accounts" value={String(stats.connectedAccountCount)} />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {(['promotions', 'social', 'newsletters', 'updates', 'spam_like'] as const).map((cat) => (
          <StatCard
            key={cat}
            label={CATEGORY_LABELS[cat]}
            value={(stats.categoryCounts[cat] ?? 0).toLocaleString()}
          />
        ))}
      </div>

      {accounts[0] && senders && <CleanupRecommendationsPanel accountId={accounts[0].id} senders={senders} />}

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold">Top senders</h3>
        {stats.topSenders.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No sender data yet — trigger a sync from the Accounts page.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats.topSenders.map((sender) => (
              <li key={sender.key} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{sender.senderName ?? sender.senderEmail}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{sender.senderEmail}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{sender.messageCount.toLocaleString()} emails</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{formatBytes(sender.totalSizeBytes)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
