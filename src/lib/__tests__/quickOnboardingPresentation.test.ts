import { describe, expect, it } from 'vitest';
import { getTopProblemLabel } from '../quickOnboardingPresentation';

describe('etykiety problemów szybkiego dopasowania', () => {
  it('odróżnia kwalifikację formalną, umiejętność i kontrolę struktury', () => {
    expect(getTopProblemLabel({ category: 'formal', severity: 'critical' })).toBe('Krytyczny wymóg');
    expect(getTopProblemLabel({ category: 'hard_skill', severity: 'warning' })).toBe('Brakująca umiejętność');
    expect(getTopProblemLabel({ category: 'structure', severity: 'warning' })).toBe('Kontrola struktury');
    expect(getTopProblemLabel({ category: 'structure', severity: 'info' })).toBe('Wskazówka jakościowa');
  });
});
