export interface StarComponentFeedback {
  score: number;
  feedback: string;
}

export type StarVerdict = 'EXCELLENT' | 'SOLID' | 'NEEDS_REFINEMENT';

export interface StarAnswerEvaluation {
  overallScore: number;
  verdict: StarVerdict;
  starBreakdown: {
    situation: StarComponentFeedback;
    task: StarComponentFeedback;
    action: StarComponentFeedback;
    result: StarComponentFeedback;
  };
  strengths: string[];
  improvements: string[];
  exemplaryResponse: string;
}

export function getStarVerdict(score: number): StarVerdict {
  if (score >= 8) return 'EXCELLENT';
  if (score >= 6) return 'SOLID';
  return 'NEEDS_REFINEMENT';
}

function isScore(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 1 && value <= 10;
}

function readComponent(value: unknown, name: string): StarComponentFeedback {
  if (!value || typeof value !== 'object') throw new Error(`Brak oceny komponentu STAR: ${name}.`);
  const component = value as Record<string, unknown>;
  if (!isScore(component.score) || typeof component.feedback !== 'string' || !component.feedback.trim()) {
    throw new Error(`Nieprawidłowa ocena lub informacja zwrotna komponentu STAR: ${name}.`);
  }
  return { score: component.score, feedback: component.feedback.trim() };
}

function readTextList(value: unknown, name: string): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`Nieprawidłowa lista w ocenie STAR: ${name}.`);
  }
  return value.map((item: string) => item.trim());
}

/** Waliduje nieufny JSON modelu i wyprowadza werdykt z jedynej skali wyniku. */
export function normalizeStarAnswerEvaluation(value: unknown): StarAnswerEvaluation {
  if (!value || typeof value !== 'object') throw new Error('Model nie zwrócił obiektu oceny STAR.');
  const parsed = value as Record<string, unknown>;
  if (!isScore(parsed.overallScore)) throw new Error('Model zwrócił wynik STAR poza skalą 1–10.');
  if (!parsed.starBreakdown || typeof parsed.starBreakdown !== 'object') {
    throw new Error('Model nie zwrócił pełnego rozbicia STAR.');
  }
  if (typeof parsed.exemplaryResponse !== 'string') throw new Error('Model nie zwrócił szkicu odpowiedzi STAR.');
  const breakdown = parsed.starBreakdown as Record<string, unknown>;

  return {
    overallScore: parsed.overallScore,
    verdict: getStarVerdict(parsed.overallScore),
    starBreakdown: {
      situation: readComponent(breakdown.situation, 'Situation'),
      task: readComponent(breakdown.task, 'Task'),
      action: readComponent(breakdown.action, 'Action'),
      result: readComponent(breakdown.result, 'Result'),
    },
    strengths: readTextList(parsed.strengths, 'mocne strony'),
    improvements: readTextList(parsed.improvements, 'luki'),
    exemplaryResponse: parsed.exemplaryResponse.trim(),
  };
}
