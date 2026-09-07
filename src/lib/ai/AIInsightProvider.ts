import type { EmailMessage } from '../../types/email';
import type { SenderAggregate } from '../../types/sender';
import type { CleanupHistoryEntry } from '../../types/history';
import type { CleanupRecommendation } from '../../types/cleanup';

export interface DuplicateGroup {
  groupKey: string;
  ids: string[];
}

export interface WeeklyHealthReport {
  summary: string;
  highlights: string[];
  suggestedActions: CleanupRecommendation[];
}

/**
 * Swappable insight backend. `ruleBasedProvider.ts` is the default (deterministic,
 * no external calls); a future version can implement this interface against a real model
 * without touching any of the UI or background code that consumes it.
 */
export interface AIInsightProvider {
  detectDuplicates(messages: EmailMessage[]): Promise<DuplicateGroup[]>;
  scoreImportance(sender: SenderAggregate): Promise<number>;
  generateWeeklyHealthReport(input: {
    senders: SenderAggregate[];
    history: CleanupHistoryEntry[];
  }): Promise<WeeklyHealthReport>;
  suggestSmartUnsubscribe(senders: SenderAggregate[]): Promise<CleanupRecommendation[]>;
}
