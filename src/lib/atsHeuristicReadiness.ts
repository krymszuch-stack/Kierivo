export interface AtsHeuristicReadinessInput {
  /** Czy profil zawiera treść kandydata, a nie tylko nazwę lub puste sekcje renderera. */
  hasCandidateDocumentEvidence: boolean;
  /** Czy oferta dostarczyła mianownik do pomiaru dopasowania i gęstości fraz. */
  hasKeywordRequirementDenominator: boolean;
}

export interface AtsHeuristicReadiness {
  structure: { available: boolean; reason: string | null };
  phrases: { available: boolean; reason: string | null };
  language: { available: boolean; reason: string | null };
}

/**
 * Profile heurystyczne mają własne wymagania wejściowe. Brak dokumentu nie
 * może przechodzić jako stabilny układ, a brak wymagań nie ma mianownika dla
 * pokrycia fraz. Utrzymujemy te bramki w jednym miejscu, by kolejne profile
 * mogły zadeklarować swoje minimum bez rozrzucania fallbacków po UI.
 */
export function getAtsHeuristicReadiness(
  input: AtsHeuristicReadinessInput
): AtsHeuristicReadiness {
  const documentReason = 'Brak treści profilu kandydata do oceny.';
  const requirementReason = 'Oferta nie zawiera rozpoznanych wymagań do pomiaru fraz.';

  return {
    structure: {
      available: input.hasCandidateDocumentEvidence,
      reason: input.hasCandidateDocumentEvidence ? null : documentReason,
    },
    phrases: {
      available: input.hasCandidateDocumentEvidence && input.hasKeywordRequirementDenominator,
      reason: !input.hasCandidateDocumentEvidence
        ? documentReason
        : input.hasKeywordRequirementDenominator
          ? null
          : requirementReason,
    },
    language: {
      available: input.hasCandidateDocumentEvidence,
      reason: input.hasCandidateDocumentEvidence ? null : documentReason,
    },
  };
}
