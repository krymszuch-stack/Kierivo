import { describe, expect, it } from 'vitest';
import { createEmptyVault } from '../sampleVault';
import { parseMasterVaultImport } from '../masterVaultImportSchema';

describe('walidacja importu MasterVault JSON', () => {
  it('przyjmuje kompletny eksport i zachowuje rozszerzenia', () => {
    const exported = { ...createEmptyVault('Profil testowy', ''), integrationMarker: 'zachować' };
    const parsed = parseMasterVaultImport(exported);
    expect(parsed?.personalInfo.fullName).toBe('Profil testowy');
    expect((parsed as (typeof parsed & { integrationMarker: string }) | null)?.integrationMarker).toBe('zachować');
  });

  it.each([
    ['niekompletne dane osobowe', { ...createEmptyVault(), personalInfo: 'profil' }],
    ['niepoprawną historię', { ...createEmptyVault(), history: [null] }],
    ['niepoprawne wyróżnienie doświadczenia', {
      ...createEmptyVault(),
      history: [{ ...createEmptyVault().history[0], highlights: [null] }],
    }],
    ['niepoprawne ustawienia lokalizacji', {
      ...createEmptyVault(),
      profiler: { ...createEmptyVault().profiler, location: { city: 'Kraków', radiusKm: 'dużo' } },
    }],
    ['niepoprawne certyfikaty', {
      ...createEmptyVault(),
      skillsMatrix: { ...createEmptyVault().skillsMatrix, certifications: [null] },
    }],
  ])('odrzuca %s bez częściowego importu', (_label, value) => {
    expect(parseMasterVaultImport(value)).toBeNull();
  });

  it('odrzuca nieobiektowy korzeń JSON', () => {
    expect(parseMasterVaultImport(null)).toBeNull();
    expect(parseMasterVaultImport([])).toBeNull();
  });
});
