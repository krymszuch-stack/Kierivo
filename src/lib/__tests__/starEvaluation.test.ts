import { describe, expect, it } from 'vitest';
import { getStarVerdict, normalizeStarAnswerEvaluation } from '../starEvaluation';

const validEvaluation = {
  overallScore: 8,
  verdict: 'SOLID',
  starBreakdown: {
    situation: { score: 8, feedback: 'Tlo jest czytelne.' },
    task: { score: 8, feedback: 'Cel jest jasny.' },
    action: { score: 8, feedback: 'Dzialania sa konkretne.' },
    result: { score: 8, feedback: 'Skutek opisano.' },
  },
  strengths: ['Konkretna odpowiedz.'],
  improvements: ['Doprecyzuj zakres.'],
  exemplaryResponse: 'Szkic oparty na faktach.',
};

describe('walidacja i werdykt oceny STAR', () => {
  it.each([[10, 'EXCELLENT'], [8, 'EXCELLENT'], [7, 'SOLID'], [6, 'SOLID'], [5, 'NEEDS_REFINEMENT'], [1, 'NEEDS_REFINEMENT']])(
    'mapuje wynik %i na zgodny werdykt',
    (score, verdict) => expect(getStarVerdict(score as number)).toBe(verdict),
  );

  it('nie ufa werdyktowi tekstowemu modelu, gdy przeczy on wynikowi liczbowemu', () => {
    expect(normalizeStarAnswerEvaluation(validEvaluation).verdict).toBe('EXCELLENT');
  });

  it('odrzuca wynik i komponent poza skalą zamiast pokazywać fałszywy procent', () => {
    expect(() => normalizeStarAnswerEvaluation({ ...validEvaluation, overallScore: 11 }))
      .toThrow('poza skalą 1–10');
    expect(() => normalizeStarAnswerEvaluation({
      ...validEvaluation,
      starBreakdown: { ...validEvaluation.starBreakdown, action: { score: 0, feedback: 'Brak.' } },
    })).toThrow('Nieprawidłowa ocena');
  });
});
