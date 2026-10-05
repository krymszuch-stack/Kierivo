import type { LastJobAnalysisSummary } from './storage';
import { getCalculationTimeFreshness } from './analysisPeriod';
import { getAtsRulesFreshness } from './atsScoreProvenance';

export type AdvisorAnalysisMetadata = Pick<LastJobAnalysisSummary,
  'profileUpdatedAt' | 'atsScoreProvenance' | 'calculatedAt' | 'calculationMonth'>;

/** Serwer potwierdza okres i reguły; aktualną rewizję lokalnego profilu sprawdza klient. */
export function isCurrentAdvisorCalculation(context: AdvisorAnalysisMetadata | null | undefined, now = new Date()): boolean {
  return getAtsRulesFreshness(context?.atsScoreProvenance) === 'current' &&
    getCalculationTimeFreshness(context, now) === 'current';
}

/** Tożsamość właściciela migawki pozostaje lokalna i nie jest polem autoryzacji API. */
export function selectAdvisorContextForProfile<T>(snapshot: { profileId: string; context: T } | null, profileId: string): T | null {
  return snapshot?.profileId === profileId ? snapshot.context : null;
}
