import { describe, expect, it } from 'vitest';
import type { ZodType } from 'zod';
import {
  advisorOutputSchema,
  coverLetterOutputSchema,
  interviewCheatSheetOutputSchema,
  jobDescriptionOutputSchema,
  rewriteProposalOutputSchema,
  validateAiModelOutput,
} from '../aiModelOutputs';

describe('granica struktury odpowiedzi AI', () => {
  const schemas: Array<[string, ZodType<unknown>]> = [
    ['oferta', jobDescriptionOutputSchema], ['doradca', advisorOutputSchema],
    ['list', coverLetterOutputSchema], ['ściąga', interviewCheatSheetOutputSchema],
    ['redakcja fragmentu', rewriteProposalOutputSchema],
  ];
  const invalidRoots = schemas.flatMap(([name, schema]) =>
    [null, [], true, 12, 'tekst'].map((value) => [name, JSON.stringify(value), schema, value] as const));
  it.each(invalidRoots)('odrzuca nieobiektowy korzeń odpowiedzi: %s / %s', (_name, _label, schema, value) => {
    expect(() => validateAiModelOutput(schema, value, 'test-root')).toThrowError(expect.objectContaining({ status: 502 }));
  });
  it.each([
    ['oferta', jobDescriptionOutputSchema, { jobTitle: 'Monter', requiredHardSkills: 'SEP' }],
    ['doradca', advisorOutputSchema, { explanation: 'Wyjaśnienie', tips: 'jedna wskazówka', actionItems: [] }],
    ['list', coverLetterOutputSchema, { hook: 5, proofPoints: [], callToAction: 'Kontakt', fullText: '' }],
    ['ściąga', interviewCheatSheetOutputSchema, { starTalkingPoints: [{ result: 4 }], personalizedFraming: '', emergencyPhrases: [] }],
  ])('odrzuca nieprawidłowy kształt: %s', (_name, schema, output) => {
    expect(() => validateAiModelOutput(schema as ZodType<unknown>, output, 'test')).toThrowError(
      expect.objectContaining({ status: 502 })
    );
  });

  it('zachowuje prawidłowe puste listy, jeśli model zwrócił kompletny kontrakt', () => {
    const valid = {
      jobTitle: '', companyName: '', companyDescription: '', seniorityLevel: 'UNKNOWN' as const,
      requiredHardSkills: [], requiredSoftSkills: [], toolsAndTech: [], languagesRequired: [],
      coreResponsibilities: [], keyKeywords: [], benefits: [], perksAndPlusy: [], mandatoryRequirements: [],
      salaryRange: '', workModel: 'UNKNOWN' as const, recruitmentMode: '', recruitmentModeReason: '', cleanBodyText: '',
    };
    expect(validateAiModelOutput(jobDescriptionOutputSchema, valid, 'test')).toEqual(valid);
  });
});
