import { describe, expect, it } from 'vitest';
import { getAtsHeuristicReadiness } from '../atsHeuristicReadiness';

describe('dostepnosc profili telemetrycznych', () => {
  it('wstrzymuje wszystkie liczby bez tresci profilu', () => {
    const readiness = getAtsHeuristicReadiness({
      hasCandidateDocumentEvidence: false,
      hasKeywordRequirementDenominator: false,
    });

    expect(readiness.structure).toEqual({ available: false, reason: 'Brak treści profilu kandydata do oceny.' });
    expect(readiness.phrases.available).toBe(false);
    expect(readiness.language.available).toBe(false);
  });

  it('nie tworzy profilu fraz bez wymagan z rozpoznanym mianownikiem', () => {
    const readiness = getAtsHeuristicReadiness({
      hasCandidateDocumentEvidence: true,
      hasKeywordRequirementDenominator: false,
    });

    expect(readiness.structure.available).toBe(true);
    expect(readiness.phrases).toEqual({
      available: false,
      reason: 'Oferta nie zawiera rozpoznanych wymagań do pomiaru fraz.',
    });
    expect(readiness.language.available).toBe(true);
  });

  it('udostepnia profile, gdy obie strony pomiaru sa obecne', () => {
    const readiness = getAtsHeuristicReadiness({
      hasCandidateDocumentEvidence: true,
      hasKeywordRequirementDenominator: true,
    });

    expect(Object.values(readiness).every(({ available, reason }) => available && reason === null)).toBe(true);
  });
});
