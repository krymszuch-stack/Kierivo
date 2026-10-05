import { describe, expect, it } from 'vitest';
import { getRenderableAtsResultSnapshot } from '../atsResultSnapshot';

const completeSnapshot = {
  overallScore: 72,
  keywordCoverageScore: 70,
  structureScore: 74,
  formattingScore: null,
  appliedProfile: 'OFFICE_IT',
  layer1Structure: {},
  layer2Nlp: {},
  layer3Scoring: {},
  matchedKeywords: ['Windows'],
  missingHardSkills: ['PowerShell'],
  missingSoftSkills: [],
  ocrWarnings: [],
  badDateFormats: [],
  gapAnalysis: [],
  recommendations: [],
};

describe('odczyt historycznej migawki wyniku ATS', () => {
  it('dopuszcza kompletną migawkę bez ponownego liczenia wyniku', () => {
    expect(getRenderableAtsResultSnapshot(completeSnapshot)).toBe(completeSnapshot);
  });

  it.each([
    null,
    'wynik',
    { keywordCoverageScore: 50 },
    { ...completeSnapshot, ocrWarnings: undefined },
    { ...completeSnapshot, missingHardSkills: [{ skill: 'PowerShell' }] },
  ])('odrzuca wadliwą strukturę bez przekształcania jej w pusty raport', (snapshot) => {
    expect(getRenderableAtsResultSnapshot(snapshot)).toBeNull();
  });
});
