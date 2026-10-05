import type { CanonicalAtsScore } from '../../lib/canonicalAts';
import { normalizePercentageEvidence } from '../../lib/percentageEvidence';

/** Gdy istnieje kanon, pusta lista jest wynikiem, a nie powodem do fallbacku. */
export function getDisplayedMissingRequirements(
  legacyMissing: string[] | undefined,
  canonicalResult?: CanonicalAtsScore,
): string[] {
  return canonicalResult ? canonicalResult.missingRequirements : legacyMissing ?? [];
}

/** Tekst rekomendacji musi opisywać te same luki, które pokazuje kanoniczny raport. */
export function getDisplayedRecommendations(
  recommendations: string[] | undefined,
  canonicalResult?: CanonicalAtsScore,
): string[] {
  if (!canonicalResult) return recommendations ?? [];
  if (canonicalResult.state === 'SCORABLE' && normalizePercentageEvidence(canonicalResult.score) === null) {
    return [];
  }

  const unrelatedRecommendations = (recommendations ?? []).filter((recommendation) =>
    !/^Brakujące wymagania:/i.test(recommendation) &&
    !/^100% kluczowych wymagań/i.test(recommendation)
  );

  if (canonicalResult.state === 'NO_REQUIREMENTS_DETECTED') {
    return ['W tym ogłoszeniu nie wykryto wymagań, które można porównać z profilem.', ...unrelatedRecommendations];
  }
  if (canonicalResult.state === 'UNCONFIRMED_REQUIREMENTS') {
    return [`${canonicalResult.reason} Uzupełnij lub sprawdź dane w profilu, jeśli możesz je potwierdzić.`, ...unrelatedRecommendations];
  }
  if (canonicalResult.state !== 'SCORABLE') return unrelatedRecommendations;

  const missingCount = canonicalResult.missingRequirements.length;
  const unconfirmedSummary = canonicalResult.unconfirmedRequirements.length > 0
    ? `Nie można potwierdzić wymogów z oferty: ${canonicalResult.unconfirmedRequirements.join(', ')}. Sprawdź te informacje przed oceną dopasowania.`
    : null;
  const summary = missingCount > 0
    ? `${missingCount > 3 ? 'Najważniejsze braki' : 'Brakujące wymagania'}: ${canonicalResult.missingRequirements.slice(0, 3).join(', ')}.${missingCount > 3 ? ` Łącznie ${missingCount} pozycji; pełna lista znajduje się powyżej.` : ''} Uzupełnij profil tylko potwierdzonymi informacjami; w przeciwnym razie pozostaw je jako luki.`
    : unconfirmedSummary ?? 'Wszystkie wykryte wymagania są potwierdzone w profilu.';

  return [summary, ...(missingCount > 0 && unconfirmedSummary ? [unconfirmedSummary] : []), ...unrelatedRecommendations];
}
