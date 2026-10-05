import { ATS_SCORE_PROVENANCES, CANONICAL_ATS_SCORE_PROVENANCE, type AtsScoreProvenance } from '../types';

export function isAtsScoreProvenance(value: unknown): value is AtsScoreProvenance {
  return ATS_SCORE_PROVENANCES.some((version) => version === value);
}

/** Nieznanego znacznika nie uznajemy za dowód użycia starszych ani bieżących reguł. */
export function getAtsRulesFreshness(value: unknown): 'current' | 'stale' | 'unknown' {
  if (value === CANONICAL_ATS_SCORE_PROVENANCE) return 'current';
  return isAtsScoreProvenance(value) ? 'stale' : 'unknown';
}
