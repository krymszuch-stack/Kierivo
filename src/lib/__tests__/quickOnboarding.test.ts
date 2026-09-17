import { describe, it, expect } from 'vitest';
import {
  runQuickAtsCheck,
  extractTopThreeProblems,
  QuickCheckError,
  MIN_CV_CHARS,
  MIN_JD_CHARS,
  type QuickCheckResult,
} from '../quickAtsCheck';
import { createEmptyVault } from '../sampleVault';

describe('Uproszczony onboarding — minimalny happy path (QuickOnboarding)', () => {
  const SAMPLE_CV_PHYSICAL = `
Jan Kowalski
Monter Urządzeń Grzewczych i Sanitarnych
Kraków | jan.kowalski@example.com | +48 600 000 000

Doświadczenie zawodowe:
TermoKlim Sp. z o.o. | Monter Instalacji | 2020-01 – 2023-12
- Montaż i serwis ponad 120 jednostek klimatyzacji split i pomp ciepła.
- Pomiary szczelności układów chłodniczych manometrami i pompą próżniową.
- Wykonywanie prób ciśnieniowych i protokołów odbioru technicznego.

Umiejętności:
- Montaż instalacji HVAC, lutowanie twarde, próby ciśnieniowe
- Narzędzia: manometry, pompa próżniowa, zaciskarka PEX
- Uprawnienia SEP G1 eksploatacja do 1 kV, prawo jazdy kat. B
`.trim();

  const SAMPLE_JD_WITH_KNOCKOUT = `
Poszukujemy doświadczonego Serwisanta Pomp Ciepła i Kotłów Gazowych.
Lokalizacja: Kraków i okolice (praca w terenie)

Wymagania bezwzględne:
- Ważne uprawnienia SEP G3 (dozór i eksploatacja)
- Certyfikat F-Gaz dla personelu (kategoria I)
- Doświadczenie w montażu pomp ciepła i diagnostyce kotłów gazowych
- Umiejętność czytania schematów hydraulicznych i automatyki
- Prawo jazdy kat. B
`.trim();

  it('Test 1: extractTopThreeProblems zwraca dokładnie 3 problemy dla wyniku z brakami', () => {
    const result = runQuickAtsCheck(SAMPLE_CV_PHYSICAL, SAMPLE_JD_WITH_KNOCKOUT);
    const problems = extractTopThreeProblems(result);

    expect(problems).toHaveLength(3);
    expect(problems[0]).toBeDefined();
    expect(problems[1]).toBeDefined();
    expect(problems[2]).toBeDefined();

    for (const p of problems) {
      expect(p.id).toBeTruthy();
      expect(p.title).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(['critical', 'warning', 'info']).toContain(p.severity);
      expect(['formal', 'hard_skill', 'structure']).toContain(p.category);
    }
  });

  it('Test 2: Niespełnione kryteria formalne (knockouts) mają pierwszeństwo i status critical', () => {
    const result = runQuickAtsCheck(SAMPLE_CV_PHYSICAL, SAMPLE_JD_WITH_KNOCKOUT);
    const problems = extractTopThreeProblems(result);

    // W ofercie jest wymóg F-Gaz i SEP G3, których Jan Kowalski nie ma w CV (ma tylko SEP G1)
    const criticalProblems = problems.filter((p) => p.severity === 'critical');
    expect(criticalProblems.length).toBeGreaterThanOrEqual(1);
    expect(criticalProblems[0].category).toBe('formal');
  });

  it('Test 3: extractTopThreeProblems dopełnia dokładnie do 3 pozycji zaleceniami, gdy brak krytycznych błędów', () => {
    // Sztuczny wynik z idealnym dopasowaniem (0 niespełnionych wymagań, 0 brakujących umiejętności)
    const mockIdealResult: QuickCheckResult = {
      ats: {
        overallScore: 98,
        keywordCoverageScore: 100,
        structureScore: 95,
        formattingScore: 100,
        appliedProfile: 'PHYSICAL',
        layer1Structure: {
          layoutScore: 100,
          headerNormalizationScore: 100,
          detectedSections: [],
          missingStandardSections: [],
          unparsableElementsWarnings: [],
          isSingleColumnCompliant: true,
        },
        layer2Nlp: {
          hardSkillsCoverage: 100,
          formalReqsCoverage: 100,
          softSkillsFilterCount: 0,
          extractedJdPhrasesCount: 5,
          lemmatizedMatches: [],
        },
        layer3Scoring: {
          hardSkillScore: 100,
          recencyScore: 1,
          titleMatchScore: 100,
          formulaBreakdown: '',
        },
        matchedKeywords: ['HVAC'],
        missingHardSkills: [],
        missingSoftSkills: [],
        ocrWarnings: [],
        badDateFormats: [],
        gapAnalysis: [],
        recommendations: [],
      },
      vault: createEmptyVault(),
      parsed: {
        personalInfo: { fullName: 'Jan', email: 'jan@example.com', phone: '', location: '', title: '', summary: '' },
        history: [],
        education: [],
        projects: [],
        hardSkills: [],
        softSkills: [],
        toolsAndTech: [],
        certifications: [],
        rawText: '',
        detectedFormat: 'TXT',
      },
      missingSkills: [],
      knockouts: {
        requirementCount: 1,
        satisfiedCount: 1,
        blocking: [],
        optional: [],
        findings: [
          {
            ruleId: 'b',
            label: 'Prawo jazdy kat. B',
            satisfied: true,
            severity: 'knockout',
            matchedVia: 'text',
          },
        ],
      },
      detectedSubRole: null,
    };

    const problems = extractTopThreeProblems(mockIdealResult);
    expect(problems).toHaveLength(3);
    // Wszystkie pozycje to zalecenia optymalizacyjne ('info')
    expect(problems.every((p) => p.severity === 'info')).toBe(true);
  });

  it('Test 4: Walidacja długości wejścia — minimalny limit znaków z czytelnym polem błędu', () => {
    // Zbyt krótkie CV
    expect(() => runQuickAtsCheck('Krótkie CV', SAMPLE_JD_WITH_KNOCKOUT)).toThrowError(
      QuickCheckError
    );

    try {
      runQuickAtsCheck('Krótkie CV', SAMPLE_JD_WITH_KNOCKOUT);
    } catch (err) {
      expect((err as QuickCheckError).field).toBe('cv');
    }

    // Zbyt krótkie ogłoszenie (poniżej MIN_JD_CHARS)
    const longCv = 'A'.repeat(MIN_CV_CHARS + 20);
    const shortJd = 'A'.repeat(MIN_JD_CHARS - 1);
    expect(() => runQuickAtsCheck(longCv, shortJd)).toThrowError(QuickCheckError);

    try {
      runQuickAtsCheck(longCv, shortJd);
    } catch (err) {
      expect((err as QuickCheckError).field).toBe('jd');
    }
  });

  it('Test 5: Happy path — wyekstrahowany vault i wynik są kompletne i gotowe do trybu zaawansowanego', () => {
    const result = runQuickAtsCheck(SAMPLE_CV_PHYSICAL, SAMPLE_JD_WITH_KNOCKOUT);

    // Sprawdzenie wyekstrahowanego Vaulta
    expect(result.vault.personalInfo.fullName).toBe('Jan Kowalski');
    expect(result.vault.history.length).toBeGreaterThanOrEqual(1);
    expect(result.vault.history[0].company).toContain('TermoKlim');
    expect(result.vault.skillsMatrix.hardSkills.length).toBeGreaterThan(0);

    // Sprawdzenie punktacji ATS
    expect(result.ats.overallScore).toBeGreaterThan(0);
    expect(result.ats.overallScore).toBeLessThanOrEqual(100);

    // Sprawdzenie 3 problemów
    const problems = extractTopThreeProblems(result);
    expect(problems).toHaveLength(3);
  });
});
