import type { MasterVault } from '../types';

/** Zwraca tylko klauzulę wpisaną wprost przez użytkownika; brak nie oznacza zgody. */
export function getExplicitCvConsentClause(vault: MasterVault): string {
  return vault.personalInfo?.rodoClause?.trim() || vault.personalInfo?.gdprClause?.trim() || '';
}
