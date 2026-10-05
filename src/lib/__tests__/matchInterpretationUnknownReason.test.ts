import { describe, expect, it } from 'vitest';
import { getMatchInterpretation } from '../matchInterpretation';

describe('interpretacja niepewnego wyniku', () => {
  it('podaje niepotwierdzony wymog zamiast sugerowac zbyt mala probke', () => {
    const message = getMatchInterpretation({
      score: 88,
      activeSuggestionCount: 0,
      profileCompleteness: 92,
      matchedRequirementCount: 4,
      totalRequirementCount: 5,
      fitEvidenceAvailable: true,
      unconfirmedRequirements: ['Wymagana aktualno\u015b\u0107 prawa jazdy B'],
    });

    expect(message).toContain('Nie mo\u017cna potwierdzi\u0107: Wymagana aktualno\u015b\u0107 prawa jazdy B');
    expect(message).not.toContain('rozpoznano tylko 5');
    expect(message).toContain('nie obni\u017caj\u0105 wyniku jako braki');
  });
});
