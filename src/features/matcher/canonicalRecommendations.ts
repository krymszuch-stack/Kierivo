import type { CanonicalAtsScore } from '../../lib/canonicalAts';

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

  const unrelatedRecommendations = (recommendations ?? []).filter((recommendation) =>
    !/^Brakujące wymagania:/i.test(recommendation) &&
    !/^100% kluczowych wymagań/i.test(recommendation)
  );

  if (canonicalResult.state === 'NO_REQUIREMENTS_DETECTED') {
    return ['W tym ogłoszeniu nie wykryto wymagań, które można porównać z profilem.', ...unrelatedRecommendations];
  }
  if (canonicalResult.state !== 'SCORABLE') return unrelatedRecommendations;

  const missingCount = canonicalResult.missingRequirements.length;
  const summary = missingCount > 0
    ? `${missingCount > 3 ? 'Najważniejsze braki' : 'Brakujące wymagania'}: ${canonicalResult.missingRequirements.slice(0, 3).join(', ')}.${missingCount > 3 ? ` Łącznie ${missingCount} pozycji; pełna lista znajduje się powyżej.` : ''} Uzupełnij profil tylko potwierdzonymi informacjami; w przeciwnym razie pozostaw je jako luki.`
    : 'Wszystkie wykryte wymagania są potwierdzone w profilu.';

  return [summary, ...unrelatedRecommendations];
}
