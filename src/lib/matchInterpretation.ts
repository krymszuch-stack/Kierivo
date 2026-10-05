import { getCanonicalScoreBand, CANONICAL_SCORE_BAND_LABELS } from './canonicalAts';
import type { CanonicalState } from './canonicalAts';

/** Mapper fraz nie może przedstawiać przypuszczalnych braków jako wymagań, gdy kanon nie ocenił oferty. */
export function shouldDisplayMappedEvidence(canonicalState: CanonicalState | undefined): boolean {
  return canonicalState === undefined || canonicalState === 'SCORABLE';
}

export interface MatchInterpretationInput {
  score: number | null;
  reason?: string;
  mainGap?: string;
  activeSuggestionCount: number;
  profileCompleteness?: number;
  matchedRequirementCount?: number;
  totalRequirementCount?: number;
  /** False oznacza brak podstaw do rzetelnej oceny dopasowania zawodowego. */
  fitEvidenceAvailable?: boolean;
  /** Wymogi formalne o statusie knockout, których profil nie potwierdza. */
  blockingRequirements?: string[];
  /** Wymogi, których nie da się rozstrzygnąć na podstawie zapisanych danych. */
  unconfirmedRequirements?: string[];
  unconfirmedRequirementCount?: number;
}

/** Mała próbka wymagań nie uzasadnia pełnej, kategorycznej etykiety dopasowania. */
export function hasLimitedMatchEvidence({
  profileCompleteness,
  totalRequirementCount,
  fitEvidenceAvailable,
  blockingRequirements,
  unconfirmedRequirements,
  unconfirmedRequirementCount,
}: Pick<MatchInterpretationInput, 'profileCompleteness' | 'totalRequirementCount' | 'fitEvidenceAvailable' | 'blockingRequirements' | 'unconfirmedRequirements' | 'unconfirmedRequirementCount'>): boolean {
  return (profileCompleteness !== undefined && profileCompleteness < 50) ||
    (totalRequirementCount !== undefined && totalRequirementCount > 0 && totalRequirementCount < 3) ||
    fitEvidenceAvailable === false ||
    Boolean(blockingRequirements?.length) || Boolean(unconfirmedRequirements?.length) || (unconfirmedRequirementCount ?? 0) > 0;
}

/** Przy ograniczonych danych etykieta nie przedstawia liczby jako pelnego dopasowania. */
export function getCanonicalScoreMetricLabel(limitedEvidence: boolean, fullLabel: string): string {
  return limitedEvidence ? 'Wstępny wynik' : fullLabel;
}

/** Dobiera opis wyniku do luk i sugestii, które widok faktycznie pokazuje. */
export function getMatchInterpretation({
  score,
  reason,
  mainGap,
  activeSuggestionCount,
  profileCompleteness,
  matchedRequirementCount,
  totalRequirementCount,
  fitEvidenceAvailable,
  blockingRequirements = [],
  unconfirmedRequirements = [],
}: MatchInterpretationInput): string {
  if (score === null && unconfirmedRequirements.length > 0) {
    return `Nie ma podstaw do policzenia wyniku. Nie można potwierdzić wymogów: ${unconfirmedRequirements.join(', ')}. Profil nie zawiera wiarygodnych danych potrzebnych do ich oceny.`;
  }

  if (score === null) {
    return reason || 'Nie udało się obliczyć wyniku. Uzupełnij treść CV i oferty.';
  }

  if (blockingRequirements.length > 0) {
    const unknownNote = unconfirmedRequirements.length > 0
      ? ` Nie można też potwierdzić: ${unconfirmedRequirements.join(', ')}.`
      : '';
    return `Nie potwierdzono obowi\u0105zkowego wymogu: ${blockingRequirements.join(', ')}. Wynik ${score}% jest ocen\u0105 wa\u017con\u0105 i nie oznacza spe\u0142nienia tego kryterium.${unknownNote}`;
  }

  if (unconfirmedRequirements.length > 0) {
    return `Wynik wstępny. Nie można potwierdzić: ${unconfirmedRequirements.join(', ')}. Profil nie zawiera wiarygodnych danych potrzebnych do ich oceny, więc te wymogi nie obniżają wyniku jako braki.`;
  }

  if (hasLimitedMatchEvidence({ profileCompleteness, totalRequirementCount, fitEvidenceAvailable })) {
    const reasons: string[] = [];
    if (profileCompleteness !== undefined && profileCompleteness < 50) {
      reasons.push(`profil jest uzupełniony w ${profileCompleteness}%`);
    }
    if (totalRequirementCount !== undefined && totalRequirementCount > 0 && totalRequirementCount < 3) {
      reasons.push(`rozpoznano tylko ${totalRequirementCount} ${totalRequirementCount === 1 ? 'wymaganie' : 'wymagania'}`);
    }
    if (fitEvidenceAvailable === false) {
      reasons.push('brakuje podstaw do rzetelnej oceny dopasowania zawodowego');
    }
    const requirementsSummary = totalRequirementCount
      ? `Potwierdzono ${matchedRequirementCount ?? 0} z ${totalRequirementCount} rozpoznanych wymagań.`
      : 'Nie rozpoznano wymagań, które pozwalałyby ocenić pokrycie oferty.';
    return `Wynik wstępny. Ograniczenia: ${reasons.join('; ')}. ${requirementsSummary} Sprawdź odczyt oferty i uzupełnij profil przed wyciągnięciem wniosku o dopasowaniu.`;
  }

  const band = getCanonicalScoreBand(score);
  if (band === 'high') {
    return mainGap
      ? `${CANONICAL_SCORE_BAND_LABELS[band]}. Sprawdź jeszcze największą lukę: ${mainGap}.`
      : 'Świetne dopasowanie! Twój profil pokrywa kluczowe wymagania pracodawcy.';
  }
  if (band === 'moderate') {
    if (mainGap) {
      return `${CANONICAL_SCORE_BAND_LABELS[band]}. Warto przed wysłaniem sprawdzić lukę: ${mainGap}.`;
    }
    return activeSuggestionCount > 0
      ? `${CANONICAL_SCORE_BAND_LABELS[band]}. Sprawdź poniższe sugestie przed wysłaniem CV.`
      : `${CANONICAL_SCORE_BAND_LABELS[band]}. Nie wykryliśmy brakujących wymagań ani aktywnych sugestii w tej analizie.`;
  }
  return mainGap
    ? `${CANONICAL_SCORE_BAND_LABELS[band]}. Widoczna luka: ${mainGap}. Sprawdź, czy wynika z brakującego faktu, czy z odczytu parsera.`
    : `${CANONICAL_SCORE_BAND_LABELS[band]}. Sprawdź rozpoznane wymagania i uzupełnij wyłącznie potwierdzone informacje.`;
}
