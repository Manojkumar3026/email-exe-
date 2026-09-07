import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAccounts, removeAccount, upsertAccount } from '../lib/db/accountsRepo';
import { connectGoogleAccount, disconnectGoogleAccount } from '../lib/auth/googleAuth';

export const ACCOUNTS_QUERY_KEY = ['accounts'] as const;

export function useAccounts() {
  return useQuery({ queryKey: ACCOUNTS_QUERY_KEY, queryFn: listAccounts });
}

export function useConnectGoogleAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const account = await connectGoogleAccount();
      await upsertAccount(account);
      return account;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY }),
  });
}

export function useDisconnectAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      await disconnectGoogleAccount(accountId);
      await removeAccount(accountId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY }),
  });
}
