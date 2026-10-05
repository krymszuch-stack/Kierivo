import type { LastJobAnalysisSummary } from './storage';
import { getAtsRulesFreshness } from './atsScoreProvenance';
import { getCalculationTimeFreshness, parseAnalysisTimestamp } from './analysisPeriod';

export type AnalysisFreshness = 'current' | 'stale' | 'unknown';
type AnalysisRevision = Pick<LastJobAnalysisSummary, 'profileUpdatedAt' | 'atsScoreProvenance' | 'calculatedAt' | 'calculationMonth'>;

/** Aktualność wymaga zgodności danych i reguł, nie tylko daty zapisu. */
export function getAnalysisFreshnessDetails(
  analysis: AnalysisRevision | null | undefined,
  currentProfileUpdatedAt: string | null | undefined,
  now = new Date(),
): { state: AnalysisFreshness; note: string | null } {
  const analysisRevision = parseAnalysisTimestamp(analysis?.profileUpdatedAt);
  const currentRevision = parseAnalysisTimestamp(currentProfileUpdatedAt);
  if (analysisRevision !== null && currentRevision !== null && analysisRevision !== currentRevision) {
    return { state: 'stale', note: 'Profil zmienił się po tej analizie. Wynik może nie uwzględniać aktualnych danych.' };
  }
  const rulesFreshness = getAtsRulesFreshness(analysis?.atsScoreProvenance);
  if (rulesFreshness === 'stale') {
    return { state: 'stale', note: 'Reguły analizy zmieniły się od zapisania tego wyniku. Uruchom analizę ponownie, nawet jeśli profil się nie zmienił.' };
  }
  if (analysisRevision === null || currentRevision === null) {
    return { state: 'unknown', note: 'Nie możemy potwierdzić, na jakiej wersji profilu wykonano tę analizę. Uruchom analizę ponownie, aby odświeżyć wynik.' };
  }
  if (rulesFreshness === 'unknown') {
    return { state: 'unknown', note: 'Nie możemy potwierdzić wersji reguł użytej w tej analizie. Uruchom analizę ponownie, aby odświeżyć wynik.' };
  }
  const timeFreshness = getCalculationTimeFreshness(analysis, now);
  if (timeFreshness === 'stale') {
    return { state: 'stale', note: 'Od tej analizy zmienił się miesiąc. Staż bieżącego zatrudnienia może być już inny. Uruchom analizę ponownie.' };
  }
  if (timeFreshness === 'unknown') {
    return { state: 'unknown', note: 'Nie możemy potwierdzić czasu i miesiąca obliczenia tej analizy. Późniejszy zapis nie dowodzi jej aktualności. Uruchom analizę ponownie.' };
  }
  return { state: 'current', note: null };
}

export function getAnalysisFreshness(analysis: AnalysisRevision | null | undefined, currentProfileUpdatedAt: string | null | undefined, now = new Date()): AnalysisFreshness {
  return getAnalysisFreshnessDetails(analysis, currentProfileUpdatedAt, now).state;
}
