import type { Account } from '../../types/account';
import { gmailFetchJson } from './client';

/** "Block sender": creates a Gmail filter that auto-trashes future mail from this address.
 *  Pair with a bulk `delete` job to also clear existing messages from the sender. */
export async function createBlockSenderFilter(account: Account, senderEmail: string): Promise<void> {
  await gmailFetchJson(account, '/users/me/settings/filters', {
    method: 'POST',
    body: JSON.stringify({
      criteria: { from: senderEmail },
      action: { addLabelIds: ['TRASH'], removeLabelIds: ['INBOX'] },
    }),
  });
}
