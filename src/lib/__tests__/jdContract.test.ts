import { describe, it, expect } from 'vitest';
import { parseJobDescriptionLocal } from '../jdParser';
import { parseJobDescriptionResponse, parsedJobDescriptionSchema } from '../jdSchema';

/**
 * Guards the boundary where a paid AI result used to be silently thrown away:
 * two different interfaces shared the name `ParsedJobDescription`, so the
 * component read `undefined` from every field while `tsc` stayed green.
 */
describe('kontrakt ParsedJobDescription', () => {
  it('rozpoznaje krótkie nagłówki Required i Requirements', () => {
    for (const header of ['Required', 'Requirements']) {
      const parsed = parseJobDescriptionLocal(`${header}\nServiceNow, Incident triage.`);
      expect(parsed.sourceSections?.required).toContain('ServiceNow, Incident triage.');
      expect(parsed.toolsAndTech).toContain('ServiceNow');
      expect(parsed.requiredHardSkills).toContain('Incident triage');
    }
  });

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

  it('walidacja zachowuje zakres i źródło wszystkich wymagań stażu', () => {
    const local = parseJobDescriptionLocal('Wymagania\nMinimum 3 lata doświadczenia zawodowego.\nMinimum 5 lat doświadczenia w spawaniu TIG.');
    const parsed = parseJobDescriptionResponse(local);
    expect(parsed?.experienceRequirements).toEqual(local.experienceRequirements);
    expect(parsed?.experienceRequirements).toHaveLength(2);
    expect(parsed?.experienceRequirements?.[1].scopeText).toBe('w spawaniu TIG');
  });

  it('walidacja zachowuje dodatni ułamek roku zamiast odrzucać wynik parsera', () => {
    const local = parseJobDescriptionLocal('Wymagania\nMinimum 1,5 roku doświadczenia zawodowego.');
    const parsed = parseJobDescriptionResponse(local);
    expect(parsed?.experienceRequirements?.[0].years).toBe(1.5);
    expect(parsed?.experienceMinYears).toBe(1.5);
  });

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

  it('nie gubi kierunku granic stażu podczas walidacji kontraktu', () => {
    const local = parseJobDescriptionLocal('Requirements\nExperience: at most 5 years.\nMore than 2 years of experience.');
    const validated = parseJobDescriptionResponse(local);
    expect(validated?.experienceRequirements).toEqual(local.experienceRequirements);
    expect(validated?.experienceRequirements?.map(({ comparison }) => comparison)).toEqual(['at_most', 'more_than']);
    expect(parseJobDescriptionResponse({ ...local, experienceRequirements: [{ ...local.experienceRequirements?.[0], comparison: 'guess' }] })).toBeNull();
  });

  it('nie zamienia brakującego lub niepoprawnego poziomu stanowiska na MID', () => {
    const base = { jobTitle: 'Magazynier', companyName: '' };
    expect(parsedJobDescriptionSchema.parse(base).seniorityLevel).toBe('UNKNOWN');
    expect(parsedJobDescriptionSchema.parse({ ...base, seniorityLevel: 'UNSURE' }).seniorityLevel).toBe('UNKNOWN');
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
