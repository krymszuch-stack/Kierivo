import { describe, expect, it } from 'vitest';
import { createEmptyVault } from '../../../lib/sampleVault';
import { scoreCanonicalAts } from '../../../lib/canonicalAts';
import { getDisplayedMissingRequirements, getDisplayedRecommendations } from '../canonicalRecommendations';

describe('rekomendacje zgodne z kanonicznym wynikiem', () => {
  it('pokazuje ten sam wymagany staż i braki co raport, zachowując inne wskazówki', () => {
    const profile = createEmptyVault('Alicja Testowa');
    profile.personalInfo.summary = 'Doświadczenie w tworzeniu i utrzymaniu systemów backendowych.';
    profile.history = [{
      id: 'exp', company: 'Przykładowa Firma', role: 'Backend Developer', location: '',
      startDate: '2022-01', endDate: '2024-01', isCurrent: false,
      highlights: [{ id: 'work', text: 'Programowanie w Pythonie.', action: '', target: '', tool: '', metric: '', keywords: [] }],
    }];
    const canonical = scoreCanonicalAts(
      profile,
      'Backend Developer\nRequirements:\nPython, SQL, at least 5 years of experience.',
    );

    const recommendations = getDisplayedRecommendations([
      'Brakujące wymagania: sql.',
      'Sprawdź daty i role, w których używałeś technologii.',
    ], canonical);

    expect(recommendations[0]).toContain('Min. 5 lat doświadczenia');
    expect(recommendations[0]).toContain('sql');
    expect(recommendations).toContain('Sprawdź daty i role, w których używałeś technologii.');
    expect(recommendations).toHaveLength(2);
  });

  it('nie nazywa braku wykrytych wymagań pełnym dopasowaniem', () => {
    const profile = createEmptyVault('Alicja Testowa');
    profile.personalInfo.summary = 'Doświadczenie w różnych zadaniach zespołowych i organizacyjnych.';
    const canonical = scoreCanonicalAts(profile, 'Miła atmosfera oraz owoce w biurze każdego dnia.');

    expect(canonical.state).toBe('NO_REQUIREMENTS_DETECTED');
    expect(getDisplayedRecommendations([], canonical)[0]).toContain('nie wykryto wymagań');
  });

  it('nie przywraca braków legacy, gdy kanoniczny raport zwraca pustą listę', () => {
    const profile = createEmptyVault('Alicja Testowa');
    profile.personalInfo.summary = 'Doświadczenie w różnych zadaniach zespołowych i organizacyjnych.';
    const canonical = scoreCanonicalAts(profile, 'Miła atmosfera oraz owoce w biurze każdego dnia.');

    expect(canonical.missingRequirements).toEqual([]);
    expect(getDisplayedMissingRequirements(['AWS', 'SEP G1'], canonical)).toEqual([]);
  });

  it('nie sugeruje, że trzy pozycje wyczerpują dłuższą listę braków', () => {
    const profile = createEmptyVault('Alicja Testowa');
    const baseline = scoreCanonicalAts(profile, 'Wymagania\nPython, SQL.');
    const canonical = {
      ...baseline,
      state: 'SCORABLE' as const,
      missingRequirements: ['SQL', 'Python', 'Docker', 'Azure'],
    };

    expect(canonical.missingRequirements.length).toBeGreaterThan(3);
    const recommendation = getDisplayedRecommendations([], canonical)[0];
    expect(recommendation).toContain('Najważniejsze braki:');
    expect(recommendation).toContain(`Łącznie ${canonical.missingRequirements.length} pozycji`);
    expect(recommendation).not.toContain('Brakujące wymagania:');
  });
});
