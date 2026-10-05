import { z } from 'zod';
import type { InterviewCoachProfileContext } from './interviewCoachContext';

/** Wspólne limity wejścia chronią koszt operacji i wyznaczają zakres kontekstu modelu. */
export const INTERVIEW_COACH_INPUT_LIMITS = {
  role: 120,
  company: 160,
  jobDescription: 2_000,
  question: 1_200,
  answer: 4_000,
  skill: 120,
  experienceRole: 120,
  highlight: 500,
} as const;

const profileContextSchema = z.object({
  roleTitle: z.string().trim().max(INTERVIEW_COACH_INPUT_LIMITS.role).optional(),
  hardSkills: z.array(z.string().trim().max(INTERVIEW_COACH_INPUT_LIMITS.skill)).max(8),
  toolsAndTech: z.array(z.string().trim().max(INTERVIEW_COACH_INPUT_LIMITS.skill)).max(8),
  experience: z.array(z.object({
    role: z.string().trim().max(INTERVIEW_COACH_INPUT_LIMITS.experienceRole),
    highlights: z.array(z.string().trim().max(INTERVIEW_COACH_INPUT_LIMITS.highlight)).max(2),
  }).strict()).max(3),
}).strict();

export const interviewQuestionsInputSchema = z.object({
  profileContext: profileContextSchema.optional(),
  targetRole: z.string().trim().max(INTERVIEW_COACH_INPUT_LIMITS.role).optional(),
  targetCompany: z.string().trim().max(INTERVIEW_COACH_INPUT_LIMITS.company).optional(),
  jobDescription: z.string().trim().max(INTERVIEW_COACH_INPUT_LIMITS.jobDescription).optional(),
});

export const starEvaluationInputSchema = z.object({
  question: z.string().trim().min(1).max(INTERVIEW_COACH_INPUT_LIMITS.question),
  answer: z.string().trim().min(1).max(INTERVIEW_COACH_INPUT_LIMITS.answer),
  targetRole: z.string().trim().max(INTERVIEW_COACH_INPUT_LIMITS.role).optional(),
});

const generatedQuestionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  category: z.enum(['behavioral', 'situational', 'competency']),
  question: z.string().trim().min(1).max(INTERVIEW_COACH_INPUT_LIMITS.question),
  recruiterIntent: z.string().trim().min(1).max(500),
  suggestedStarTips: z.string().trim().min(1).max(500),
}).strict();

export const generatedInterviewQuestionsSchema = z.object({
  questions: z.array(generatedQuestionSchema).max(4),
});
export type GeneratedInterviewQuestion = z.infer<typeof generatedQuestionSchema>;

function parseBoundedInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw Object.assign(new Error('Dane treningu są nieprawidłowe lub przekraczają dozwoloną długość.'), {
      status: 400,
      expose: true,
    });
  }
  return result.data;
}

export function parseInterviewQuestionsInput(input: unknown) {
  return parseBoundedInput<{
    profileContext?: InterviewCoachProfileContext;
    targetRole?: string;
    targetCompany?: string;
    jobDescription?: string;
  }>(interviewQuestionsInputSchema, input);
}

export function parseStarEvaluationInput(input: unknown) {
  return parseBoundedInput<{
    question: string;
    answer: string;
    targetRole?: string;
  }>(starEvaluationInputSchema, input);
}

export function parseGeneratedInterviewQuestions(input: unknown): GeneratedInterviewQuestion[] {
  const result = generatedInterviewQuestionsSchema.safeParse(input);
  if (!result.success) {
    throw Object.assign(new Error('Model zwrócił pytania w nieprawidłowym formacie.'), {
      status: 502,
      expose: true,
    });
  }
  return result.data.questions;
}
