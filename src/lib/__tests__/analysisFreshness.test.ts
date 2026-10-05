import { describe, expect, it } from 'vitest';
import { getAnalysisFreshness } from '../analysisFreshness';
import { CANONICAL_ATS_SCORE_PROVENANCE } from '../../types';

describe('getAnalysisFreshness', () => {
  it('nie uznaje wyniku ze starszych reguł za aktualny przy tym samym profilu', () => {
    const analysis = { profileUpdatedAt: '2026-10-01T10:00:00.000Z', atsScoreProvenance: 'canonical-v1' };
    expect(getAnalysisFreshness(analysis, analysis.profileUpdatedAt)).toBe('stale');
  });

  it('nie potwierdza aktualności zapisu bez wersji reguł', () => {
    expect(getAnalysisFreshness({ profileUpdatedAt: '2026-10-01T10:00:00.000Z' }, '2026-10-01T10:00:00.000Z')).toBe('unknown');
  });

  it('uznaje analizę za aktualną, gdy rewizja profilu się zgadza', () => {
    expect(getAnalysisFreshness({ profileUpdatedAt: '2026-10-01T10:00:00.000Z', atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE, calculatedAt: '2026-10-01T12:00:00.000Z', calculationMonth: '2026-10' }, '2026-10-01T10:00:00.000Z', new Date('2026-10-02T12:00:00.000Z'))).toBe('current');
  });

  it('oznacza analizę jako nieaktualną po zmianie rewizji profilu', () => {
    expect(getAnalysisFreshness({ profileUpdatedAt: '2026-10-01T10:00:00.000Z' }, '2026-10-01T10:00:01.000Z')).toBe('stale');
  });

  it('nie udaje, że zna świeżość starych analiz ani niekompletnych profili', () => {
    expect(getAnalysisFreshness({}, '2026-10-01T10:00:00.000Z')).toBe('unknown');
    expect(getAnalysisFreshness({ profileUpdatedAt: '2026-10-01T10:00:00.000Z' }, undefined)).toBe('unknown');
    expect(getAnalysisFreshness({ profileUpdatedAt: 'nieznana-rewizja' }, 'nieznana-rewizja')).toBe('unknown');
  });

  it('nie uznaje równe, niekanoniczne ani niemożliwe daty za tę samą rewizję', () => {
    for (const invalid of ['03/04/2020', '2026-10-01', '2026-02-30T10:00:00.000Z']) {
      expect(getAnalysisFreshness({ profileUpdatedAt: invalid }, invalid)).toBe('unknown');
    }
  });
});
