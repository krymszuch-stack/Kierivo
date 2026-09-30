import { ExperienceFact } from './types';

export const QUALITY_CONSTRAINTS = {
  minTechnologies: 0,
  maxTechnologies: 8,
  minObjects: 1,
  maxObjects: 5,
};

/**
 * Weryfikuje czy fakt doświadczenia jest kompletny i bezpieczny (zero halucynacji).
 */
export function validateExperienceFact(fact: ExperienceFact): { isValid: boolean; reason?: string } {
  if (!fact.verifiedByUser) {
    return { isValid: false, reason: 'Sprawdź i potwierdź, że wszystkie wybrane informacje są zgodne z Twoim doświadczeniem.' };
  }

  if (!fact.role || fact.role.trim().length === 0) {
    return { isValid: false, reason: 'Brak określonego stanowiska.' };
  }

  if (!fact.action || fact.action.trim().length === 0) {
    return { isValid: false, reason: 'Wymagane jest wskazanie głównej czynności.' };
  }

  if (!fact.objects || fact.objects.length < QUALITY_CONSTRAINTS.minObjects) {
    return { isValid: false, reason: 'Wskaż przynajmniej jeden obszar/obiekt pracy.' };
  }

  return { isValid: true };
}
