/**
 * Jawnie przykładowy, statyczny wynik na ekranie startowym.
 * Liczba potwierdzonych wymagań, mianownik, procent i lista braków muszą
 * wynikać z tego samego zestawu — osobne stałe rozjechały się w widoku.
 */
const TOTAL_REQUIREMENTS = 18;
const MATCHED_REQUIREMENTS = 15;

export const HOME_MATCH_EXAMPLE = {
  totalRequirements: TOTAL_REQUIREMENTS,
  matchedRequirements: MATCHED_REQUIREMENTS,
  coverage: Math.round((MATCHED_REQUIREMENTS / TOTAL_REQUIREMENTS) * 100),
  missingRequirements: [
    'SAP (moduł MM)',
    'Budżetowanie kosztów transportu',
    'Uprawnienia UDT',
  ],
} as const;
