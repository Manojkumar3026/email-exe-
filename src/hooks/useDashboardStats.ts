import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listSenders } from '../lib/db/sendersRepo';
import { listAccounts } from '../lib/db/accountsRepo';
import type { CategoryId } from '../types/category';
import type { SenderAggregate } from '../types/sender';

export const SENDERS_QUERY_KEY = ['senders'] as const;

export function useSenders(accountId?: string) {
  return useQuery({
    queryKey: [...SENDERS_QUERY_KEY, accountId ?? 'all'],
    queryFn: () => listSenders(accountId),
  });
}

// Cleanup-worthy candidates: bulky, low-value categories with enough volume to matter.
const CLEANUP_CANDIDATE_CATEGORIES: CategoryId[] = ['promotions', 'newsletters', 'spam_like', 'social'];
const MIN_MESSAGE_COUNT_FOR_SAVINGS = 15;

export interface DashboardStats {
  totalEmails: number;
  storageBytes: number;
  categoryCounts: Record<CategoryId, number>;
  topSenders: SenderAggregate[];
  potentialCleanupBytes: number;
  potentialCleanupCount: number;
  connectedAccountCount: number;
}

function computeStats(senders: SenderAggregate[], accountCount: number): DashboardStats {
  const categoryCounts = {} as Record<CategoryId, number>;
  let totalEmails = 0;
  let storageBytes = 0;
  let potentialCleanupBytes = 0;
  let potentialCleanupCount = 0;

  for (const sender of senders) {
    totalEmails += sender.messageCount;
    storageBytes += sender.totalSizeBytes;
    categoryCounts[sender.category] = (categoryCounts[sender.category] ?? 0) + sender.messageCount;

    if (
      CLEANUP_CANDIDATE_CATEGORIES.includes(sender.category) &&
      sender.messageCount >= MIN_MESSAGE_COUNT_FOR_SAVINGS
    ) {
      potentialCleanupBytes += sender.totalSizeBytes;
      potentialCleanupCount += sender.messageCount;
    }
  }

  const topSenders = [...senders].sort((a, b) => b.messageCount - a.messageCount).slice(0, 10);

  return {
    totalEmails,
    storageBytes,
    categoryCounts,
    topSenders,
    potentialCleanupBytes,
    potentialCleanupCount,
    connectedAccountCount: accountCount,
  };
}

export function useDashboardStats(accountId?: string) {
  const sendersQuery = useSenders(accountId);
  const accountsQuery = useQuery({ queryKey: ['accounts'], queryFn: listAccounts });

  const stats = useMemo<DashboardStats | undefined>(() => {
    if (!sendersQuery.data) return undefined;
    return computeStats(sendersQuery.data, accountsQuery.data?.length ?? 0);
  }, [sendersQuery.data, accountsQuery.data]);

  return {
    stats,
    isLoading: sendersQuery.isLoading || accountsQuery.isLoading,
    isError: sendersQuery.isError || accountsQuery.isError,
  };
}
