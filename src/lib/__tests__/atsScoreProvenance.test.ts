import { describe, expect, it } from 'vitest';
import { CANONICAL_ATS_SCORE_PROVENANCE, type AtsScoreContext } from '../../types';
import { getAtsRulesFreshness } from '../atsScoreProvenance';
import { getSavedAtsScoreDisplayInfo } from '../atsScoreEvidence';
import { getAnalysisFreshnessDetails } from '../analysisFreshness';

const context: AtsScoreContext = {
  detectedRequirementCount: 4, profileCompleteness: 86,
  unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0,
  unconfirmedRequirementCount: 0, scoreContextVersion: 5,
  careerEvidenceAvailable: true, careerEvidenceVersion: 2,
  calculatedAt: '2026-10-01T12:00:00.000Z', calculationMonth: '2026-10',
};

describe('wersja reguł zapisanej oceny', () => {
  it('odróżnia bieżącą, historyczną i nieznaną wersję', () => {
    expect(getAtsRulesFreshness(CANONICAL_ATS_SCORE_PROVENANCE)).toBe('current');
    expect(getAtsRulesFreshness('canonical-v1')).toBe('stale');
    for (const value of [undefined, null, 2, '', 'canonical-v999']) {
      expect(getAtsRulesFreshness(value)).toBe('unknown');
    }
  });

  it('zachowuje bieżącą interpretację wyłącznie przy bieżących regułach', () => {
    expect(getSavedAtsScoreDisplayInfo(68, context, CANONICAL_ATS_SCORE_PROVENANCE, new Date('2026-10-02T12:00:00.000Z'))).toMatchObject({ state: 'full', label: 'Wynik Kierivo: 68%' });
    expect(getSavedAtsScoreDisplayInfo(68, context, 'canonical-v1')).toMatchObject({ state: 'unknown', label: 'Wynik historyczny: 68%' });
    expect(getSavedAtsScoreDisplayInfo(68, context, 'canonical-v1').note).toContain('wcześniejszymi regułami');
  });

  it('nie dopisuje wersji reguł do nieoznaczonej liczby', () => {
    expect(getSavedAtsScoreDisplayInfo(68, context, undefined).note).toContain('Nie zapisano rozpoznanej wersji');
    expect(getSavedAtsScoreDisplayInfo(68, context, 'canonical-v999').state).toBe('unknown');
  });

  it('nie przedstawia uszkodzonej liczby jako historycznego procentu', () => {
    for (const value of [101, -1, NaN, Infinity, '68']) {
      expect(getSavedAtsScoreDisplayInfo(value, context, 'canonical-v1').label).toBe('Niezweryfikowany wynik');
    }
  });

  it('wyjaśnia zmianę reguł przy identycznej rewizji profilu', () => {
    const revision = '2026-10-02T10:00:00.000Z';
    expect(getAnalysisFreshnessDetails({ profileUpdatedAt: revision, atsScoreProvenance: 'canonical-v1' }, revision)).toMatchObject({ state: 'stale', note: expect.stringContaining('Reguły analizy zmieniły się') });
    expect(getAnalysisFreshnessDetails({ profileUpdatedAt: revision }, revision)).toMatchObject({ state: 'unknown', note: expect.stringContaining('wersji reguł') });
  });
});
