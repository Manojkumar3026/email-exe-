import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SyncNowMessage } from '../types/messages';

export function useSyncNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const message: SyncNowMessage = { type: 'SYNC_NOW', accountId };
      const response = await chrome.runtime.sendMessage(message);
      if (response && response.ok === false) throw new Error(response.error ?? 'Sync failed');
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['senders'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}
