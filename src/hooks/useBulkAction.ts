import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJob } from '../lib/db/jobsRepo';
import { useJobStore } from '../store/useJobStore';
import { useToastStore } from '../store/useToastStore';
import type { BulkActionType } from '../types/job';
import type { BlockSenderMessage, RetryJobMessage, RuntimeMessage, StartBulkJobMessage } from '../types/messages';

async function sendMessage<T = unknown>(message: RuntimeMessage): Promise<T> {
  const response = await chrome.runtime.sendMessage(message);
  if (response && response.ok === false) throw new Error(response.error ?? 'Action failed');
  return response as T;
}

export function useStartBulkAction() {
  const queryClient = useQueryClient();
  const setActiveJobId = useJobStore((s) => s.setActiveJobId);

  return useMutation({
    mutationFn: async (args: { accountId: string; actionType: BulkActionType; targetMessageIds: string[] }) => {
      const message: StartBulkJobMessage = { type: 'START_BULK_JOB', ...args };
      return sendMessage<{ ok: true; jobId: string }>(message);
    },
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    },
  });
}

export function useBlockSender() {
  const queryClient = useQueryClient();
  const setActiveJobId = useJobStore((s) => s.setActiveJobId);

  return useMutation({
    mutationFn: async (args: { accountId: string; senderEmail: string; existingMessageIds: string[] }) => {
      const message: BlockSenderMessage = { type: 'BLOCK_SENDER', ...args };
      return sendMessage<{ ok: true; jobId: string }>(message);
    },
    onSuccess: (data) => {
      setActiveJobId(data.jobId);
      queryClient.invalidateQueries({ queryKey: ['senders'] });
    },
  });
}

export function useRetryJob() {
  const setActiveJobId = useJobStore((s) => s.setActiveJobId);
  return useMutation({
    mutationFn: async (jobId: string) => {
      const message: RetryJobMessage = { type: 'RETRY_JOB', jobId };
      return sendMessage<{ ok: true; jobId: string }>(message);
    },
    onSuccess: (data) => setActiveJobId(data.jobId),
  });
}

export function useCancelJob() {
  return useMutation({
    mutationFn: async (jobId: string) => sendMessage({ type: 'CANCEL_JOB', jobId }),
  });
}

const TERMINAL_STATUSES = new Set(['completed', 'cancelled', 'failed']);
const toastedJobIds = new Set<string>();

export function useJobProgress(jobId: string | null) {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  return useQuery({
    queryKey: ['job', jobId],
    queryFn: () => (jobId ? getJob(jobId) : Promise.resolve(undefined)),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const job = query.state.data;
      if (!job || TERMINAL_STATUSES.has(job.status)) {
        if (job) {
          queryClient.invalidateQueries({ queryKey: ['senders'] });
          if (!toastedJobIds.has(job.id)) {
            toastedJobIds.add(job.id);
            if (job.status === 'completed') {
              addToast(
                `${job.successCount.toLocaleString()} emails ${job.actionType.replace('_', ' ')}d` +
                  (job.failedCount > 0 ? ` (${job.failedCount} failed)` : ''),
                job.failedCount > 0 ? 'error' : 'success',
              );
            } else if (job.status === 'failed') {
              addToast(job.errorMessage ?? 'Bulk action failed', 'error');
            }
          }
        }
        return false;
      }
      return 500;
    },
  });
}
