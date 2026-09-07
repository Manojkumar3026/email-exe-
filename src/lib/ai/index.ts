import type { AIInsightProvider } from './AIInsightProvider';
import { ruleBasedProvider } from './ruleBasedProvider';

export type { AIInsightProvider } from './AIInsightProvider';

/** Swap this to a different implementation to change the insight backend everywhere
 *  at once — nothing outside this file needs to change. */
export function getAIInsightProvider(): AIInsightProvider {
  return ruleBasedProvider;
}
