import { afterEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_ATS_SCORE_PROVENANCE } from '../../types';
import { createEmptyVault } from '../sampleVault';
import { scoreCanonicalAts } from '../canonicalAts';
import { getAtsScoreContext, getSavedAtsScoreDisplayInfo } from '../atsScoreEvidence';
import { getAnalysisFreshness } from '../analysisFreshness';

const SEPTEMBER = new Date('2026-09-15T12:00:00.000Z');
const OCTOBER = new Date('2026-10-15T12:00:00.000Z');
const REVISION = '2026-09-01T10:00:00.000Z';

function currentEmployment() {
  const vault = createEmptyVault('Jan Testowy', 'jan@example.invalid');
  vault.updatedAt = REVISION;
  vault.history = [{
    id: 'current-warehouse', company: 'Firma testowa', role: 'Magazynier', location: '',
    startDate: '2024-09', endDate: '', isCurrent: true,
    description: 'Przyjmowanie dostaw i kontrola dokumentacji magazynowej.', highlights: [],
  }];
  return vault;
}

afterEach(() => vi.useRealTimers());

describe('czas obliczenia kanonicznego wyniku', () => {
  it('rzeczywisty wynik zmienia się po miesiącu przy identycznym profilu', () => {
    vi.useFakeTimers();
    const vault = currentEmployment();
    const offer = 'Wymagania: maksymalnie 2 lata doświadczenia zawodowego.';
    vi.setSystemTime(SEPTEMBER);
    const september = scoreCanonicalAts(vault, offer);
    vi.setSystemTime(OCTOBER);
    const october = scoreCanonicalAts(vault, offer);
    expect(september.components.experience).toBe(100);
    expect(october.components.experience).toBe(0);
    expect(october.score).not.toBe(september.score);
    expect(vault.updatedAt).toBe(REVISION);
  });

  it('nie nazywa wrześniowej oceny aktualną w październiku', () => {
    vi.useFakeTimers();
    vi.setSystemTime(OCTOBER);
    const analysis = {
      profileUpdatedAt: REVISION, atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
      calculatedAt: SEPTEMBER.toISOString(), calculationMonth: '2026-09',
    };
    expect(getAnalysisFreshness(analysis, REVISION)).toBe('stale');
  });

  it('zapis kontekstu miesiąc później zachowuje czas rzeczywistego obliczenia', () => {
    vi.useFakeTimers();
    vi.setSystemTime(SEPTEMBER);
    const result = scoreCanonicalAts(currentEmployment(), 'Wymagania: maksymalnie 2 lata doświadczenia zawodowego.');
    vi.setSystemTime(OCTOBER);
    const context = getAtsScoreContext(result, 86, true);
    expect(context).toMatchObject({ calculatedAt: SEPTEMBER.toISOString(), calculationMonth: '2026-09' });
    expect(getSavedAtsScoreDisplayInfo(result.score, context, CANONICAL_ATS_SCORE_PROVENANCE).state).toBe('unknown');
  });
});
