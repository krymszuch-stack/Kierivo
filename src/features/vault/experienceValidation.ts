import type { WorkExperience } from '../../types';

export interface ExperienceStepValidationResult {
  isValid: boolean;
  errors: Record<string, { company?: string; role?: string }>;
  message?: string;
}

/**
 * Walidacja minimalnych wymagań kroku Doświadczenie (Krok 2 w Master Vault):
 * - Wymagane jest co najmniej jedno stanowisko
 * - Każde dodane stanowisko musi mieć nazwę firmy i stanowisko
 * - Daty, opis i osiągnięcia STAR są opcjonalne i mogą być uzupełnione później
 */
export function validateExperienceStep(
  history: WorkExperience[] | undefined
): ExperienceStepValidationResult {
  const items = history || [];

  if (items.length === 0) {
    return {
      isValid: false,
      errors: {},
      message: 'Dodaj co najmniej jedno stanowisko pracy (minimum: nazwa firmy i stanowisko).',
    };
  }

  const errors: Record<string, { company?: string; role?: string }> = {};
  let hasError = false;

  for (const exp of items) {
    const companyMissing = !exp.company || exp.company.trim().length === 0;
    const roleMissing = !exp.role || exp.role.trim().length === 0;

    if (companyMissing || roleMissing) {
      hasError = true;
      errors[exp.id] = {
        company: companyMissing ? 'Nazwa firmy jest wymagana' : undefined,
        role: roleMissing ? 'Nazwa stanowiska jest wymagana' : undefined,
      };
    }
  }

  if (hasError) {
    return {
      isValid: false,
      errors,
      message: 'Wpisz nazwę firmy i stanowisko przed przejściem do kolejnego kroku.',
    };
  }

  return {
    isValid: true,
    errors: {},
  };
}

/**
 * Pomocnik nawigacji kroku Doświadczenie (krok 1 w indeksowaniu 0..5, krok 2 z 6 dla użytkownika)
 */
export function canNavigateToNextStep(
  currentStep: number,
  history: WorkExperience[] | undefined
): { allowed: boolean; nextStep: number; result: ExperienceStepValidationResult } {
  if (currentStep === 1) {
    const result = validateExperienceStep(history);
    if (!result.isValid) {
      return { allowed: false, nextStep: currentStep, result };
    }
    return { allowed: true, nextStep: 2, result };
  }

  return {
    allowed: true,
    nextStep: Math.min(5, currentStep + 1),
    result: { isValid: true, errors: {} },
  };
}
