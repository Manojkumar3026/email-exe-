import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listAccounts, removeAccount, upsertAccount } from '../lib/db/accountsRepo';
import { connectGoogleAccount, disconnectGoogleAccount } from '../lib/auth/googleAuth';
import { connectMicrosoftAccount, disconnectMicrosoftAccount } from '../lib/auth/msalPkce';
import type { Account } from '../types/account';

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

export function useConnectMicrosoftAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const account = await connectMicrosoftAccount();
      await upsertAccount(account);
      return account;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY }),
  });
}

export function useDisconnectAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (account: Account) => {
      if (account.provider === 'gmail') await disconnectGoogleAccount(account.id);
      else await disconnectMicrosoftAccount(account.id);
      await removeAccount(account.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY }),
  });
}
