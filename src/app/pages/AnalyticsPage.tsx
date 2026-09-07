import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccounts } from '../../hooks/useAccounts';
import { useSenders } from '../../hooks/useDashboardStats';
import { getMonthlyMessageCounts } from '../../lib/db/messagesRepo';
import { listHistory } from '../../lib/db/historyRepo';
import SenderBarChart from '../../components/charts/SenderBarChart';
import { formatBytes } from '../../lib/util/formatBytes';

export default function AnalyticsPage() {
  const { data: accounts } = useAccounts();
  const accountId = accounts?.[0]?.id;
  const { data: senders } = useSenders(accountId);
  const [trendLoaded, setTrendLoaded] = useState(false);

  const monthlyTrend = useQuery({
    queryKey: ['monthly-trend', accountId],
    queryFn: () => getMonthlyMessageCounts(accountId!, 6),
    enabled: Boolean(accountId) && trendLoaded,
  });

  const history = useQuery({
    queryKey: ['history', accountId],
    queryFn: () => listHistory(accountId, 50),
    enabled: Boolean(accountId),
  });

  const top50 = useMemo(
    () => [...(senders ?? [])].sort((a, b) => b.messageCount - a.messageCount).slice(0, 50),
    [senders],
  );
  const topStorage = useMemo(
    () =>
      [...(senders ?? [])]
        .sort((a, b) => b.totalSizeBytes - a.totalSizeBytes)
        .slice(0, 10)
        .map((s) => ({ label: s.senderName ?? s.senderEmail, value: s.totalSizeBytes })),
    [senders],
  );
  const mostFrequent = useMemo(
    () =>
      [...(senders ?? [])]
        .sort((a, b) => b.frequencyPerWeek - a.frequencyPerWeek)
        .slice(0, 10)
        .map((s) => ({ label: s.senderName ?? s.senderEmail, value: Math.round(s.frequencyPerWeek * 10) / 10 })),
    [senders],
  );
  const newsletterSenders = useMemo(() => (senders ?? []).filter((s) => s.hasListUnsubscribe), [senders]);

  if (!accounts || accounts.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Analytics</h2>
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Connect an account to see analytics.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Analytics</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold">Top storage consumers</h3>
          <SenderBarChart data={topStorage} formatValue={formatBytes} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-3 text-sm font-semibold">Most frequent senders</h3>
          <SenderBarChart data={mostFrequent} formatValue={(v) => `${v}/wk`} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Monthly email trend</h3>
          {!trendLoaded && (
            <button
              onClick={() => setTrendLoaded(true)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Compute trend
            </button>
          )}
        </div>
        {!trendLoaded && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Scans stored messages once to bucket them by month — click to compute.
          </p>
        )}
        {trendLoaded && monthlyTrend.isLoading && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Computing…</p>
        )}
        {trendLoaded && monthlyTrend.data && (
          <SenderBarChart
            data={monthlyTrend.data.map((m) => ({ label: m.month, value: m.count }))}
            formatValue={(v) => v.toLocaleString()}
          />
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold">Newsletter statistics</h3>
        <p className="text-sm">
          {newsletterSenders.length.toLocaleString()} newsletter sender{newsletterSenders.length === 1 ? '' : 's'} ·{' '}
          {newsletterSenders.reduce((sum, s) => sum + s.messageCount, 0).toLocaleString()} emails
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold">Top 50 senders</h3>
        <div className="max-h-96 overflow-y-auto">
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {top50.map((s, i) => (
              <li key={s.key} className="flex items-center justify-between py-1.5">
                <span className="truncate">
                  {i + 1}. {s.senderName ?? s.senderEmail}
                </span>
                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                  {s.messageCount.toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h3 className="mb-3 text-sm font-semibold">Cleanup history</h3>
        {!history.data || history.data.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No cleanup actions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {history.data.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-1.5">
                <span className="capitalize">
                  {h.actionType.replace('_', ' ')} · {h.messageCount.toLocaleString()} emails
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {formatBytes(h.bytesFreed)} · {new Date(h.timestamp).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
