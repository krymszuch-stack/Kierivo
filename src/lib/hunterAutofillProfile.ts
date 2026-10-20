import type { MasterVault } from '../types';

export interface HunterAutofillProfile {
  schemaVersion: 1;
  fields: Record<string, string>;
}

/**
 * Eksportuje tylko pola zgodne z importerem Huntera. Nie zgadujemy adresu,
 * stanowiska ani rozstrzygnięcia spornych wariantów LinkedIn/języka.
 */
export function buildHunterAutofillProfile(vault: MasterVault): HunterAutofillProfile | null {
  const personalInfo = vault.personalInfo;
  const fields: Record<string, string> = {};
  const add = (key: string, value: string | undefined) => {
    const normalized = value?.trim();
    if (normalized) fields[key] = normalized;
  };

  add('given-name', personalInfo.firstName);
  add('family-name', personalInfo.lastName);
  add('email', personalInfo.email);
  add('tel', personalInfo.phone);

  return Object.keys(fields).length ? { schemaVersion: 1, fields } : null;
}
