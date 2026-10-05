import { describe, expect, it } from 'vitest';
import { createEmptyVault } from '../sampleVault';
import { getExplicitCvConsentClause } from '../cvConsentClause';

describe('jawna klauzula zgody w CV', () => {
  it('nie tworzy klauzuli, kiedy użytkownik jej nie wpisał', () => {
    expect(getExplicitCvConsentClause(createEmptyVault())).toBe('');
  });

  it('zwraca wyłącznie niepustą klauzulę wpisaną w Vault', () => {
    const vault = createEmptyVault();
    vault.personalInfo.rodoClause = '  Moja klauzula zgody.  ';
    expect(getExplicitCvConsentClause(vault)).toBe('Moja klauzula zgody.');
  });

  it('korzysta z pola zgodności wstecznej, gdy podstawowe pole jest puste', () => {
    const vault = createEmptyVault();
    vault.personalInfo.rodoClause = '   ';
    vault.personalInfo.gdprClause = 'Moja klauzula GDPR.';
    expect(getExplicitCvConsentClause(vault)).toBe('Moja klauzula GDPR.');
  });
});
