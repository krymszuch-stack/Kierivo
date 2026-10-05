import { z } from 'zod';

const tailoredHighlightSchema = z.object({
  experienceId: z.string(),
  role: z.string(),
  company: z.string(),
  originalText: z.string(),
  optimizedText: z.string(),
  source: z.enum(['SLOT_FILLING', 'SEMANTIC_CACHE', 'GEMINI_DELTA']),
  keywordsMatched: z.array(z.string()),
}).passthrough();

const tailoredResumeSchema = z.object({
  targetJobTitle: z.string(),
  companyName: z.string(),
  summary: z.string(),
  selectedHighlights: z.array(tailoredHighlightSchema),
  skillsMatched: z.object({
    hardSkills: z.array(z.string()),
    toolsAndTech: z.array(z.string()),
    softSkills: z.array(z.string()),
  }).passthrough(),
  atsScore: z.number().min(0).max(100).nullable(),
  atsScoreProvenance: z.string().optional(),
  experienceOrder: z.array(z.string()).optional(),
}).passthrough();

const savedCvDocumentSchema = z.object({
  schemaVersion: z.number().int().optional(),
  id: z.string().min(1),
  title: z.string(),
  tags: z.array(z.string()),
  theme: z.string(),
  layout: z.string(),
  targetPages: z.union([z.literal(1), z.literal(2)]),
  targetRole: z.string().optional(),
  companyName: z.string().optional(),
  summaryOverride: z.string().optional(),
  vault: z.object({
    personalInfo: z.object({}).passthrough(),
  }).passthrough(),
  tailoredResume: tailoredResumeSchema.nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastExportedAt: z.string().optional(),
  downloadCount: z.number().int().nonnegative(),
}).passthrough();

/** Zwraca tylko kompletne, renderowalne dokumenty i zachowuje nieznane pola historyczne. */
export function parseSavedCvDocuments(value: unknown): unknown[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = savedCvDocumentSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

/** Sprawdza, czy świadome przypisanie legacy nie pominęłoby żadnego wpisu. */
export function areSavedCvDocumentsValid(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  return value.every((entry) => savedCvDocumentSchema.safeParse(entry).success);
}
