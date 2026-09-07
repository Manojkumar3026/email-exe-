import type { BulkActionType } from './job';
import type { CategoryId } from './category';

export interface CleanupHistoryEntry {
  id: string;
  accountId: string;
  timestamp: number;
  actionType: BulkActionType;
  senderEmail?: string;
  category?: CategoryId;
  messageCount: number;
  bytesFreed: number;
  undoable: boolean;
}
