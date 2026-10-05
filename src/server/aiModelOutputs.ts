import { z } from 'zod';
import { interviewCheatSheetEnrichmentSchema } from '../lib/interviewCheatSheetEnrichmentSchema';

const textList = z.array(z.string());

export const jobDescriptionOutputSchema = z.object({
  jobTitle: z.string(),
  companyName: z.string(),
  companyDescription: z.string(),
  seniorityLevel: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE', 'UNKNOWN']),
  requiredHardSkills: textList,
  requiredSoftSkills: textList,
  toolsAndTech: textList,
  languagesRequired: textList,
  coreResponsibilities: textList,
  keyKeywords: textList,
  benefits: textList,
  perksAndPlusy: textList,
  mandatoryRequirements: textList,
  salaryRange: z.string(),
  workModel: z.enum(['REMOTE', 'HYBRID', 'ON_SITE', 'FLEXIBLE', 'UNKNOWN']),
  recruitmentMode: z.string(),
  recruitmentModeReason: z.string(),
  cleanBodyText: z.string(),
});

export const advisorOutputSchema = z.object({
  explanation: z.string(),
  tips: textList,
  slangAnalysis: z.string().optional(),
  actionItems: textList,
});

export const coverLetterOutputSchema = z.object({
  hook: z.string(),
  proofPoints: textList,
  callToAction: z.string(),
  fullText: z.string(),
});

export const interviewCheatSheetOutputSchema = interviewCheatSheetEnrichmentSchema;

// Poprawna składnia JSON nie potwierdza kontraktu propozycji. Wadliwe reguły
// odrzucamy zamiast usuwać je po cichu i udawać kompletny wynik.
export const rewriteProposalOutputSchema = z.object({
  proposedText: z.string().trim().min(1),
  explanation: z.string().trim().min(1),
  appliedRules: z.array(z.string().trim().min(1)),
});

/** Waliduje kształt nieufnej odpowiedzi modelu przed użyciem jej przez aplikację. */
export function validateAiModelOutput<T>(
  schema: z.ZodType<T>,
  value: unknown,
  context: string
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  console.error(`[ai] Model zwrócił nieprawidłową strukturę (${context}).`);
  throw Object.assign(new Error('Model zwrócił odpowiedź w nieprawidłowym formacie.'), { status: 502 });
}
