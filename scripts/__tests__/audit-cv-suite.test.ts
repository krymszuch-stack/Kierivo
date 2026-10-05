import { describe, expect, it } from 'vitest';
import { getAuditResultFailures, type AuditResult } from '../audit-cv-suite';

const validResult: AuditResult = {
  scenarioId: 1,
  role: 'Monter',
  category: 'Techniczna',
  latencyMs: 12,
  canonicalScore: 74,
  components: { skills: 80, experience: 65, structure: 100, formal: null },
  matchedRequirementsCount: 3,
  missingRequirementsCount: 1,
  semanticCoveragePct: null,
  summaryPseudonymizationPassed: true,
};

describe('bramka lokalnego audytu CV', () => {
  it('akceptuje brak pomiaru skladowej i semantyki jako null', () => {
    expect(getAuditResultFailures([validResult])).toEqual([]);
  });

  it('odrzuca niepoprawny procent, czas i nieudana pseudonimizacje', () => {
    const result: AuditResult = {
      ...validResult,
      latencyMs: Number.NaN,
      canonicalScore: 101,
      components: { ...validResult.components, skills: Number.POSITIVE_INFINITY },
      summaryPseudonymizationPassed: false,
    };

    expect(getAuditResultFailures([result])).toEqual([
      'Scenariusz 1 (Monter): Kanon ATS poza zakresem 0-100.',
      'Scenariusz 1 (Monter): Skills poza zakresem 0-100.',
      'Scenariusz 1 (Monter): nieprawidłowy pomiar czasu.',
      'Scenariusz 1 (Monter): pseudonimizacja podsumowania nie przeszła kontroli.',
    ]);
  });
});
