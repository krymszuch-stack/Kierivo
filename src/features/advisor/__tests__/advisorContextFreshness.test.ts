import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateJobMatch } from '../../../lib/jobMatcherEngine';
import { createEmptyVault } from '../../../lib/sampleVault';
import { CANONICAL_ATS_SCORE_PROVENANCE, type JobOffer } from '../../../types';
import { getAnalysisFreshness } from '../../../lib/analysisFreshness';
import { isCurrentAdvisorCalculation, selectAdvisorContextForProfile } from '../../../lib/advisorAnalysisFreshness';

afterEach(() => vi.useRealTimers());

describe('aktualność kontekstu Doradcy', () => {
  const now = new Date('2026-10-15T12:00:00.000Z');
  const metadata = { profileUpdatedAt: '2026-10-01T10:00:00.000Z', atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
    calculatedAt: '2026-10-02T12:00:00.000Z', calculationMonth: '2026-10' };

  it('odrzuca kontekst innego profilu nawet przy identycznej rewizji', () => {
    const snapshot = { profileId: 'profil-a', context: metadata };
    expect(selectAdvisorContextForProfile(snapshot, 'profil-b')).toBeNull();
    expect(selectAdvisorContextForProfile(snapshot, 'profil-a')).toBe(metadata);
    expect(selectAdvisorContextForProfile(null, 'profil-a')).toBeNull();
  });

  it('zmiana profilu unieważnia kontekst w tym samym miesiącu', () => {
    expect(getAnalysisFreshness(metadata, '2026-10-03T10:00:00.000Z', now)).toBe('stale');
    expect(getAnalysisFreshness(metadata, metadata.profileUpdatedAt, now)).toBe('current');
  });

  it.each([
    { ...metadata, atsScoreProvenance: 'canonical-v1' },
    { ...metadata, atsScoreProvenance: undefined },
    { ...metadata, calculatedAt: undefined },
    { ...metadata, calculatedAt: '2026-09-02T12:00:00.000Z', calculationMonth: '2026-09' },
    { ...metadata, calculatedAt: '2026-10-16T12:00:00.000Z' },
    { ...metadata, calculationMonth: '2026-09' },
  ])('serwer nie przyjmuje nieaktualnych ani sprzecznych metadanych: %j', (value) => {
    expect(isCurrentAdvisorCalculation(value, now)).toBe(false);
  });

  it('bieżące reguły i okres pozostają dopuszczone', () => {
    expect(isCurrentAdvisorCalculation(metadata, now)).toBe(true);
  });

  it('kontekst rzeczywistego Matchera zachowuje rewizję, reguły i miesiąc obliczenia', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
    const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
    vault.updatedAt = '2026-09-01T10:00:00.000Z';
    vault.history = [{ id: 'warehouse', company: 'Firma testowa', role: 'Magazynier', location: '',
      startDate: '2024-09', endDate: '', isCurrent: true,
      description: 'Przyjmowanie dostaw i kontrola dokumentacji magazynowej.', highlights: [] }];
    const offer: JobOffer = { id: 'proof', title: 'Magazynier', company: '', salary: '', location: '',
      description: 'Wymagania: maksymalnie 2 lata doświadczenia zawodowego.', requirements: [], remote: false, portal: 'synthetic', techStack: [] };
    const result = calculateJobMatch(vault, offer);
    expect(result.advisorContext).toMatchObject({ profileUpdatedAt: vault.updatedAt,
      atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
      calculatedAt: '2026-09-15T12:00:00.000Z', calculationMonth: '2026-09' });
    vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
    expect(getAnalysisFreshness(result.advisorContext, vault.updatedAt)).toBe('stale');
  });
});
