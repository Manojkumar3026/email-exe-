export type CleanupActionKind = 'delete' | 'archive' | 'unsubscribe';

export interface CleanupRecommendation {
  id: string;
  senderEmail: string;
  accountId: string;
  action: CleanupActionKind;
  affectedCount: number;
  estimatedBytesFreed: number;
  reason: string;
  confidence: number; // 0-1
}

export interface CleanupSettings {
  minMessageCountForRecommendation: number;
  minUnreadRatioForDelete: number;
  softDeleteOnly: boolean;
}

export const DEFAULT_CLEANUP_SETTINGS: CleanupSettings = {
  minMessageCountForRecommendation: 20,
  minUnreadRatioForDelete: 0.6,
  softDeleteOnly: true,
};
