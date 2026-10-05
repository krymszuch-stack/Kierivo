import { z } from 'zod';

const starTalkingPointEnrichmentSchema = z.object({
  relatedRequirement: z.string(),
  situation: z.string(),
  task: z.string(),
  action: z.string(),
  result: z.string(),
  sourceExperienceId: z.string().optional(),
});

const emergencyPhraseEnrichmentSchema = z.object({
  scenario: z.string(),
  phrasePL: z.string(),
  phraseEN: z.string().optional(),
});

export const interviewCheatSheetEnrichmentSchema = z.object({
  starTalkingPoints: z.array(starTalkingPointEnrichmentSchema),
  personalizedFraming: z.string(),
  emergencyPhrases: z.array(emergencyPhraseEnrichmentSchema),
});

export const cachedCheatSheetEnrichmentSchema = z.object({
  hash: z.string().min(1),
  enrichment: interviewCheatSheetEnrichmentSchema,
  cachedAt: z.string().datetime(),
});

export type CheatSheetEnrichment = z.infer<typeof interviewCheatSheetEnrichmentSchema>;
