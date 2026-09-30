import { describe, it, expect } from 'vitest';
import { parseJobDescriptionLocal } from '../jdParser';
import { parseJobDescriptionResponse, parsedJobDescriptionSchema } from '../jdSchema';

/**
 * Guards the boundary where a paid AI result used to be silently thrown away:
 * two different interfaces shared the name `ParsedJobDescription`, so the
 * component read `undefined` from every field while `tsc` stayed green.
 */
describe('kontrakt ParsedJobDescription', () => {
  const SAMPLE_JD = `
    Senior Frontend Developer
    Firma: Acme Sp. z o.o.
    Wymagania: React, TypeScript, Node.js
    Mile widziane: Docker, AWS
    Widełki: 18 000 - 24 000 PLN
  `;

  it('lokalny parser produkuje kształt akceptowany przez schemat sieciowy', () => {
    const local = parseJobDescriptionLocal(SAMPLE_JD);
    const result = parsedJobDescriptionSchema.safeParse(local);

    expect(result.success).toBe(true);
  }, 15000);

  it('odpowiedź o kształcie Gemini przechodzi walidację i zachowuje pola', () => {
    // Dokładnie te klucze deklaruje responseSchema w src/server/gemini.ts.
    const geminiResponse = {
      jobTitle: 'Senior Frontend Developer',
      companyName: 'Acme Sp. z o.o.',
      companyDescription: 'Firma technologiczna',
      seniorityLevel: 'SENIOR',
      requiredHardSkills: ['React', 'TypeScript'],
      requiredSoftSkills: ['Komunikatywność'],
      toolsAndTech: ['Docker', 'AWS'],
      languagesRequired: ['Angielski'],
      coreResponsibilities: ['Rozwój aplikacji'],
      keyKeywords: ['React'],
      benefits: ['Prywatna opieka medyczna'],
      salaryRange: '18 000 - 24 000 PLN',
      workModel: 'REMOTE',
      cleanBodyText: 'Pełna treść ogłoszenia',
    };

    const parsed = parseJobDescriptionResponse(geminiResponse);

    expect(parsed).not.toBeNull();
    expect(parsed!.jobTitle).toBe('Senior Frontend Developer');
    expect(parsed!.companyName).toBe('Acme Sp. z o.o.');
    expect(parsed!.salaryRange).toBe('18 000 - 24 000 PLN');
    expect(parsed!.requiredHardSkills).toContain('React');
    expect(parsed!.toolsAndTech).toContain('Docker');
  });

  it('odrzuca stary, niezgodny kształt zamiast po cichu zwracać puste pola', () => {
    // Interfejs, który wcześniej siedział w types/api.ts. Gdyby taka odpowiedź
    // przeszła, każde pole odczytane przez komponent byłoby undefined.
    const legacyShape = {
      title: 'Senior Frontend Developer',
      company: 'Acme',
      requirements: ['React'],
      techStack: ['Docker'],
      salary: '18 000 PLN',
      niceToHave: [],
      seniorityLevel: 'SENIOR',
      languages: [],
    };

    expect(parseJobDescriptionResponse(legacyShape)).toBeNull();
  });

  it('odrzuca dane, które nie są obiektem', () => {
    expect(parseJobDescriptionResponse(null)).toBeNull();
    expect(parseJobDescriptionResponse('tekst')).toBeNull();
    expect(parseJobDescriptionResponse(undefined)).toBeNull();
  });

  it('pola, których komponent używa do zbudowania oferty, są obecne po obu ścieżkach', () => {
    // Te nazwy czyta handleMatchUrl w JobMatcher.tsx.
    const usedByComponent = [
      'jobTitle',
      'companyName',
      'salaryRange',
      'requiredHardSkills',
      'toolsAndTech',
      'workModel',
    ] as const;

    const local = parseJobDescriptionLocal(SAMPLE_JD);
    const schemaKeys = Object.keys(parsedJobDescriptionSchema.shape);

    for (const field of usedByComponent) {
      expect(schemaKeys).toContain(field);
      expect(local).toHaveProperty(field);
    }
  });
});
