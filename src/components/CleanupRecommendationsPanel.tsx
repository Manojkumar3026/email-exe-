import { useMemo, useState } from 'react';
import type { SenderAggregate } from '../types/sender';
import { buildRecommendations } from '../lib/cleanup-engine/recommendations';
import { useStartBulkAction } from '../hooks/useBulkAction';
import { getMostRecentMessageForSender, listMessageIdsBySender } from '../lib/db/messagesRepo';
import { openUnsubscribeLink, parseListUnsubscribe } from '../lib/unsubscribe/listUnsubscribe';

interface CleanupRecommendationsPanelProps {
  accountId: string;
  senders: SenderAggregate[];
}

export default function CleanupRecommendationsPanel({ accountId, senders }: CleanupRecommendationsPanelProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const startBulkAction = useStartBulkAction();

  const recommendations = useMemo(
    () => buildRecommendations(senders).filter((r) => !dismissed.has(r.id)).slice(0, 5),
    [senders, dismissed],
  );

  async function accept(recommendation: (typeof recommendations)[number]) {
    if (recommendation.action === 'unsubscribe') {
      const message = await getMostRecentMessageForSender(accountId, recommendation.senderEmail);
      openUnsubscribeLink(parseListUnsubscribe(message?.listUnsubscribeHeader, message?.listUnsubscribePostHeader));
    } else {
      const targetMessageIds = await listMessageIdsBySender(accountId, recommendation.senderEmail);
      startBulkAction.mutate({ accountId, actionType: recommendation.action, targetMessageIds });
    }
    setDismissed((prev) => new Set(prev).add(recommendation.id));
  }

  function ignore(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
  }

  if (recommendations.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <h3 className="mb-3 text-sm font-semibold">One-click cleanup</h3>
      <ul className="space-y-2">
        {recommendations.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-2.5 text-sm dark:bg-slate-800/60">
            <div className="min-w-0 flex-1">
              <p className="truncate">
                <span className="font-medium capitalize">{r.action}</span> {r.affectedCount.toLocaleString()} emails from{' '}
                <span className="font-medium">{r.senderEmail}</span>
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{r.reason}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => accept(r)}
                className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
              >
                Accept
              </button>
              <button
                onClick={() => ignore(r.id)}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-white dark:border-slate-700 dark:hover:bg-slate-900"
              >
                Ignore
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
