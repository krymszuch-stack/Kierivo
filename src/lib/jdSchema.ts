import { z } from 'zod';
import type { ParsedJobDescription } from './jdParser';

/**
 * Runtime validation for job-description data crossing the network boundary.
 *
 * `res.json()` returns `any`, so TypeScript cannot catch a shape mismatch between
 * what the server sends and what the component reads — which is exactly how a
 * mismatched interface silently discarded every parsed field. Validating here
 * turns that class of bug into an explicit, testable failure.
 */
export const parsedJobDescriptionSchema = z.object({
  jobTitle: z.string(),
  companyName: z.string(),
  seniorityLevel: z.enum(['ENTRY', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE']).catch('MID'),
  requiredHardSkills: z.array(z.string()).default([]),
  requiredSoftSkills: z.array(z.string()).default([]),
  toolsAndTech: z.array(z.string()).default([]),
  languagesRequired: z.array(z.string()).default([]),
  coreResponsibilities: z.array(z.string()).default([]),
  keyKeywords: z.array(z.string()).default([]),
  benefits: z.array(z.string()).optional(),
  perksAndPlusy: z.array(z.string()).optional(),
  mandatoryRequirements: z.array(z.string()).optional(),
  salaryRange: z.string().optional(),
  workModel: z.string().optional(),
  recruitmentMode: z.enum(['ATS_CORPORATE', 'CRAFT_LOCAL', 'HYBRID']).optional(),
  recruitmentModeReason: z.string().optional(),
  sourceUrl: z.string().optional(),
  niceToHaveHardSkills: z.array(z.string()).optional(),
  niceToHaveSoftSkills: z.array(z.string()).optional(),
  formalRequirements: z.array(z.object({
    id: z.string(),
    label: z.string(),
    required: z.boolean(),
    severity: z.enum(['knockout', 'preferred', 'information']),
    sourceText: z.string(),
  })).optional(),
  experienceMinYears: z.number().nullable().optional(),
  structuredLanguages: z.array(z.object({
    language: z.string(),
    level: z.string().optional(),
    required: z.boolean(),
    sourceText: z.string(),
  })).optional(),
  location: z.string().optional(),
  contractTypes: z.array(z.string()).optional(),
  salary: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string(),
    period: z.string(),
    grossNet: z.string(),
  }).nullable().optional(),
  sourceSections: z.record(z.string(), z.array(z.string())).optional(),
});

/**
 * Returns the parsed offer, or `null` when the payload does not match — callers
 * then fall back to the local parser rather than proceeding with empty fields.
 */
export function parseJobDescriptionResponse(input: unknown): ParsedJobDescription | null {
  const result = parsedJobDescriptionSchema.safeParse(input);
  return result.success ? (result.data as ParsedJobDescription) : null;
}
