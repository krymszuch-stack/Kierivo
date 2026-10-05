import { describe, expect, it } from 'vitest';
import {
  INTERVIEW_COACH_INPUT_LIMITS as limits,
  interviewQuestionsInputSchema,
  parseInterviewQuestionsInput,
  parseStarEvaluationInput,
  starEvaluationInputSchema,
} from '../interviewCoachInput';

describe('kontrakt ograniczonego wejścia Trenera STAR', () => {
  it('przyjmuje wartości na granicy limitów', () => {
    expect(starEvaluationInputSchema.safeParse({
      question: 'q'.repeat(limits.question),
      answer: 'a'.repeat(limits.answer),
      targetRole: 'r'.repeat(limits.role),
    }).success).toBe(true);
    expect(interviewQuestionsInputSchema.safeParse({
      targetCompany: 'c'.repeat(limits.company),
      jobDescription: 'j'.repeat(limits.jobDescription),
      profileContext: {
        roleTitle: 'r'.repeat(limits.role),
        hardSkills: ['s'.repeat(limits.skill)],
        toolsAndTech: [],
        experience: [{ role: 'e'.repeat(limits.experienceRole), highlights: ['h'.repeat(limits.highlight)] }],
      },
    }).success).toBe(true);
  });

  it('odrzuca pola tekstowe przekraczające limit', () => {
    expect(starEvaluationInputSchema.safeParse({
      question: 'q'.repeat(limits.question + 1), answer: 'Odpowiedź',
    }).success).toBe(false);
    expect(starEvaluationInputSchema.safeParse({
      question: 'Pytanie', answer: 'a'.repeat(limits.answer + 1),
    }).success).toBe(false);
    expect(interviewQuestionsInputSchema.safeParse({
      profileContext: {
        hardSkills: [], toolsAndTech: [],
        experience: [{ role: 'Rola', highlights: ['h'.repeat(limits.highlight + 1)] }],
      },
    }).success).toBe(false);
  });

  it('odrzuca błędny kształt kontekstu profileContext jako bezpieczny błąd klienta', () => {
    expect(() => parseInterviewQuestionsInput({ profileContext: { hardSkills: ['Windows'] } }))
      .toThrow(expect.objectContaining({ status: 400, expose: true }));
    expect(() => parseStarEvaluationInput({ question: 'Pytanie', answer: '   ' }))
      .toThrow(expect.objectContaining({ status: 400, expose: true }));
  });
});
