import { db } from './db';
import { parseFromHeader } from '../gmail/messages';
import { upsertSenderAggregatesForMessages } from './sendersRepo';
import type { EmailMessage } from '../../types/email';

/**
 * Checks for and repairs any existing stored messages or senders corrupted by
 * prior unescaped header parsing (e.g. senderEmail containing angle brackets or escaped quotes).
 */
export async function sanitizeStoredData(): Promise<{ fixedMessagesCount: number }> {
  try {
    const allMessages = await db.messages.toArray();
    const needsFix: EmailMessage[] = [];

    for (const msg of allMessages) {
      if (
        msg.senderEmail.includes('<') ||
        msg.senderEmail.includes('>') ||
        msg.senderEmail.includes('"') ||
        msg.senderEmail.includes('\\')
      ) {
        const parsed = parseFromHeader(msg.senderEmail);
        msg.senderEmail = parsed.email;
        if (parsed.name && (!msg.senderName || msg.senderName.includes('\\') || msg.senderName.includes('"'))) {
          msg.senderName = parsed.name;
        }
        needsFix.push(msg);
      } else if (msg.senderName && (msg.senderName.includes('\\') || msg.senderName.startsWith('"'))) {
        const parsed = parseFromHeader(`"${msg.senderName}" <${msg.senderEmail}>`);
        if (parsed.name) {
          msg.senderName = parsed.name;
          needsFix.push(msg);
        }
      }
    }

    if (needsFix.length === 0) {
      return { fixedMessagesCount: 0 };
    }

    console.log(`[inbox-cleaner-ai] Sanitizing ${needsFix.length} messages with malformed sender headers...`);
    await db.messages.bulkPut(needsFix);

    // Remove any malformed sender aggregates
    const allSenders = await db.senders.toArray();
    const malformedSenderKeys: string[] = [];
    for (const s of allSenders) {
      if (
        s.key.includes('<') ||
        s.key.includes('>') ||
        s.key.includes('"') ||
        s.key.includes('\\') ||
        s.senderEmail.includes('<') ||
        s.senderEmail.includes('"') ||
        s.senderEmail.includes('\\')
      ) {
        malformedSenderKeys.push(s.key);
      }
    }

    if (malformedSenderKeys.length > 0) {
      await db.senders.bulkDelete(malformedSenderKeys);
    }

    // Re-fold the fixed messages into senders table
    await upsertSenderAggregatesForMessages(needsFix);

    console.log(`[inbox-cleaner-ai] Successfully sanitized ${needsFix.length} messages and repaired senders.`);
    return { fixedMessagesCount: needsFix.length };
  } catch (error) {
    console.error('[inbox-cleaner-ai] Failed to sanitize stored data', error);
    return { fixedMessagesCount: 0 };
  }
}
