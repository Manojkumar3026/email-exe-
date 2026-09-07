import { useMemo } from 'react';
import { useAccounts } from '../../hooks/useAccounts';
import { useSenders } from '../../hooks/useDashboardStats';
import CategoryPieChart from '../../components/charts/CategoryPieChart';
import SenderBarChart from '../../components/charts/SenderBarChart';
import { buildRecommendations } from '../../lib/cleanup-engine/recommendations';
import { formatBytes } from '../../lib/util/formatBytes';
import type { CategoryId } from '../../types/category';

export default function StorageAnalyzerPage() {
  const { data: accounts } = useAccounts();
  const accountId = accounts?.[0]?.id;
  const { data: senders } = useSenders(accountId);

  const bytesByCategory = useMemo(() => {
    const map: Partial<Record<CategoryId, number>> = {};
    for (const sender of senders ?? []) {
      map[sender.category] = (map[sender.category] ?? 0) + sender.totalSizeBytes;
    }
    return map;
  }, [senders]);

  const topStorageConsumers = useMemo(
    () =>
      [...(senders ?? [])]
        .sort((a, b) => b.totalSizeBytes - a.totalSizeBytes)
        .slice(0, 10)
        .map((s) => ({ label: s.senderName ?? s.senderEmail, value: s.totalSizeBytes })),
    [senders],
  );

  const recommendations = useMemo(() => buildRecommendations(senders ?? []).slice(0, 5), [senders]);

  if (!accounts || accounts.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Storage Analyzer</h2>
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Connect an account to analyze storage usage.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Storage Analyzer</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold">Storage by category</h3>
          <CategoryPieChart valuesByCategory={bytesByCategory} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold">Top storage consumers</h3>
          <SenderBarChart data={topStorageConsumers} formatValue={formatBytes} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold">Cleanup opportunities</h3>
        {recommendations.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No high-confidence opportunities right now.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {recommendations.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span className="truncate">
                  <span className="font-medium capitalize">{r.action}</span> {r.senderEmail} — {r.reason}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
