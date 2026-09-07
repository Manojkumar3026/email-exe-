import type { EmailMessage } from '../../types/email';
import type { CategoryId } from '../../types/category';
import { CATEGORY_RULES } from './rules';

/** Pure, deterministic categorization — no React/chrome.* dependencies, safe to run
 *  in the background worker during sync or in a unit test. */
export function categorize(message: EmailMessage): CategoryId {
  for (const rule of CATEGORY_RULES) {
    const result = rule(message);
    if (result) return result;
  }
  // No marketing/finance/shopping/social signal and it's a direct inbox message — most
  // likely 1:1 correspondence rather than automated mail.
  return message.labels.includes('INBOX') ? 'personal' : 'other';
}

export function categorizeAll(messages: EmailMessage[]): EmailMessage[] {
  return messages.map((message) => ({ ...message, category: categorize(message) }));
}
