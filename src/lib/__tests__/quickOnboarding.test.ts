import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  runQuickAtsCheck,
  extractTopThreeProblems,
  QuickCheckError,
  MIN_CV_CHARS,
  MIN_JD_CHARS,
  type QuickCheckResult,
} from '../quickAtsCheck';
import { createEmptyVault } from '../sampleVault';
import { scoreCanonicalAts } from '../canonicalAts';
import { calculateJobMatch } from '../jobMatcherEngine';
import type { JobOffer } from '../../types';

// Cały wynik obejmuje także czas obliczenia, więc porównanie wymaga wspólnego zegara.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-02T12:00:00.000Z'));
});
afterEach(() => vi.useRealTimers());

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

  it('extractTopThreeProblems zwraca najwyżej 3 rzeczywiste ustalenia dla wyniku z brakami', () => {
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

  it('nie przedstawia nieznanej aktualnosci dokumentu jako krytycznego braku', () => {
    const result = runQuickAtsCheck(SAMPLE_CV_PHYSICAL, SAMPLE_JD_WITH_KNOCKOUT);
    const finding = {
      ruleId: 'sep_g1',
      label: 'Uprawnienia SEP G1 (termin waznosci niepotwierdzony)',
      severity: 'knockout' as const,
      status: 'unknown' as const,
      satisfied: false,
      matchedVia: null,
      hint: 'Profil nie przechowuje terminu waznosci dokumentu.',
    };
    result.knockouts = {
      ...result.knockouts,
      findings: [finding],
      blocking: [],
      unconfirmed: [finding],
      optional: [],
      unclassified: [],
      requirementCount: 0,
      satisfiedCount: 0,
    };

    const problems = extractTopThreeProblems(result);
    expect(problems).toContainEqual(expect.objectContaining({
      id: 'ko-unknown-sep_g1',
      severity: 'warning',
      category: 'formal',
    }));
    expect(problems.some((problem) => problem.id === 'ko-sep_g1' && problem.severity === 'critical')).toBe(false);
  });

  it('utrzymuje ten sam wynik w trybie szybkim i szczegółowym także dla stanowiska fizycznego', () => {
    const quick = runQuickAtsCheck(SAMPLE_CV_PHYSICAL, SAMPLE_JD_WITH_KNOCKOUT);
    const offer: JobOffer = {
      id: 'synthetic-physical-parity',
      title: '',
      company: '',
      salary: '',
      location: '',
      description: SAMPLE_JD_WITH_KNOCKOUT,
      requirements: [],
      remote: false,
      portal: 'synthetic-test',
      techStack: [],
    };
    const advanced = calculateJobMatch(quick.vault, offer);

    expect(quick.canonicalResult).toEqual(advanced.canonicalResult);
    expect(quick.canonicalResult.missingRequirements.join(' ')).toMatch(/sep.{0,40}g3/i);
    expect(quick.canonicalResult.missingRequirements.join(' ')).toMatch(/f.?gaz/i);
  });

  it('Nie dopisuje ogólnych problemów ani porad, gdy analiza nie zwróciła ustaleń', () => {
    // Sztuczny wynik bez braków, ostrzeżeń strukturalnych i zaleceń z analizy.
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
      canonicalResult: scoreCanonicalAts(createEmptyVault(), ''),
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
        unclassified: [],
        unconfirmed: [],
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
    expect(problems).toEqual([]);
  });

  it('Pokazuje zalecenia zwrócone przez analizę, bez dokładania porad niezależnych od CV', () => {
    const result = runQuickAtsCheck(SAMPLE_CV_PHYSICAL, SAMPLE_JD_WITH_KNOCKOUT);
    result.missingSkills = [];
    result.knockouts.findings = result.knockouts.findings.map((finding) => ({ ...finding, satisfied: true, status: 'satisfied' }));
    result.ats.ocrWarnings = [];
    result.ats.badDateFormats = [];
    result.ats.layer1Structure.unparsableElementsWarnings = [];
    result.ats.recommendations = ['Wynik analizy: sprawdź, czy opis doświadczenia odpowiada wymaganiom oferty.'];

    const problems = extractTopThreeProblems(result);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({
      severity: 'info',
      description: 'Wynik analizy: sprawdź, czy opis doświadczenia odpowiada wymaganiom oferty.',
    });
    expect(problems.map((problem) => problem.id)).not.toContain('tip-metrics');
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

    // Ustalenia są ograniczone do pozycji znalezionych w tej analizie.
    const problems = extractTopThreeProblems(result);
    expect(problems.length).toBeLessThanOrEqual(3);
  });

  it('Nie zgłasza jako brakujących umiejętności obecnych w długiej linii CV ani opcji „mile widziane”', () => {
    const cv = [
      'Alicja Testowa',
      'Specjalistka wsparcia IT',
      'Doświadczenie zawodowe:',
      '2022–2025: Specjalistka wsparcia IT w firmie Testowa Sp. z o.o. Obsługa zgłoszeń użytkowników i diagnozowanie problemów z Windows 11 oraz Microsoft 365.',
      'Umiejętności: Windows 11, Microsoft 365, Exchange Online, Active Directory, sieci TCP/IP, Excel, obsługa klienta.',
      'Edukacja: Technik informatyk, 2020.',
      'Języki: angielski B2.',
    ].join('\n');
    const jd = 'Specjalista IT Support. Wymagania: Windows 11, Microsoft 365 i TCP/IP. Mile widziane: Intune, Entra ID i PowerShell. Zakres obowiązków: obsługa zgłoszeń.';
    const result = runQuickAtsCheck(cv, jd);

    expect(result.vault.skillsMatrix.hardSkills).toEqual(expect.arrayContaining(['Windows 11', 'Microsoft 365', 'sieci TCP/IP']));
    expect(result.vault.history[0]).toEqual(expect.objectContaining({
      role: 'Specjalistka wsparcia IT',
      company: 'Testowa Sp. z o.o.',
      description: expect.stringContaining('Obsługa zgłoszeń użytkowników'),
    }));
    expect(result.ats.layer2Nlp.hardSkillsCoverage).toBe(100);
    expect(result.vault.profiler.languages).toEqual(expect.arrayContaining([expect.objectContaining({ level: 'B2' })]));
    expect(result.missingSkills).not.toEqual(expect.arrayContaining(['Intune', 'Entra ID', 'PowerShell']));
  });

  it('odcina opcjonalną umiejętność podaną inline bez dwukropka od pokrycia obowiązkowego', () => {
    const cv = [
      'Alicja Testowa',
      'Specjalistka wsparcia IT',
      'Doświadczenie: 2021–2024, obsługa zgłoszeń i diagnozowanie problemów użytkowników.',
      'Umiejętności: Windows 11, Microsoft 365, Exchange Online, TCP/IP, obsługa klienta.',
      'Edukacja: Technik informatyk, Zespół Szkół Testowych, 2017–2021.',
    ].join('\n');
    const jd = 'Wymagania: Windows 11, Microsoft 365, Exchange Online, TCP/IP i obsługa klienta. Mile widziane Entra ID.';
    const result = runQuickAtsCheck(cv, jd);

    expect(result.ats.layer2Nlp.hardSkillsCoverage).toBe(100);
    expect(result.missingSkills.map((skill) => skill.toLocaleLowerCase('pl-PL'))).not.toContain('entra id');
    expect(result.ats.missingHardSkills.map((skill) => skill.toLocaleLowerCase('pl-PL'))).not.toContain('entra id');
  });

  it.each([
    ['wymaganie mile widziane', 'Mile widziane uprawnienia SEP G3 jako dodatkowy atut kandydata w tej rekrutacji.'],
    ['wzmiankę informacyjną', 'Informacje dodatkowe dotyczące uprawnień SEP G3 w procesie tej rekrutacji. Szczegóły stanowiska i organizacji pracy omówimy podczas rozmowy kwalifikacyjnej.'],
  ])('nie pokazuje %s bez dowodu jako krytycznego braku formalnego', (_name, jd) => {
    const result = runQuickAtsCheck(SAMPLE_CV_PHYSICAL, jd);
    const finding = result.knockouts.findings.find((item) => item.ruleId === 'sep_g3');

    expect(finding?.satisfied).toBe(false);
    expect(finding?.severity).toBe(_name === 'wymaganie mile widziane' ? 'preferred' : 'information');
    expect(extractTopThreeProblems(result).some((problem) => problem.id === 'ko-sep_g3')).toBe(false);
  });

  it('odtwarza syntetyczny przypadek IT bez fałszywych braków, podziału TCP/IP ani duplikatu edukacji', () => {
    const cv = [
      'Alicja Testowa',
      'Kraków | alicja.testowa@example.com',
      '',
      'PODSUMOWANIE ZAWODOWE',
      'Specjalistka wsparcia IT z doświadczeniem w Windows 11, Microsoft 365, Exchange Online i TCP/IP.',
      '',
      'UMIEJĘTNOŚCI',
      'Windows 11, Microsoft 365, Exchange Online, Active Directory, TCP/IP, obsługa klienta',
      '',
      'DOŚWIADCZENIE ZAWODOWE',
      'Specjalistka wsparcia IT — Testowa Sp. z o.o. — 2022–2025',
      'Obsługa zgłoszeń, konfiguracja kont Microsoft 365, diagnoza Windows 11.',
      '',
      'EDUKACJA',
      'Technik informatyk — Zespół Szkół Technicznych — 2016–2020',
    ].join('\n');
    const jd = [
      'Specjalista IT Support',
      'Testowa Firma',
      '',
      'Wymagania:',
      'Windows 11, Microsoft 365, Exchange Online, TCP/IP, obsługa użytkowników.',
      '',
      'Mile widziane: Intune, Entra ID, PowerShell.',
    ].join('\n');
    const result = runQuickAtsCheck(cv, jd);
    const skills = result.vault.skillsMatrix.hardSkills.map((skill) => skill.toLocaleLowerCase('pl-PL'));
    const missing = result.missingSkills.map((skill) => skill.toLocaleLowerCase('pl-PL'));
    const rawMissing = result.ats.missingHardSkills.map((skill) => skill.toLocaleLowerCase('pl-PL'));

    expect(result.ats.layer2Nlp.hardSkillsCoverage).toBe(100);
    expect(missing).not.toContain('specjalista it support testowa');
    expect(rawMissing).not.toContain('specjalista it support testowa');
    for (const optional of ['intune', 'entra id', 'powershell']) {
      expect(missing).not.toContain(optional);
      expect(rawMissing).not.toContain(optional);
    }
    expect(skills.some((skill) => skill === 'tcp/ip' || skill.includes('tcp/ip'))).toBe(true);
    expect(skills).not.toEqual(expect.arrayContaining(['tcp', 'ip']));
    expect(result.vault.education).toHaveLength(1);
    expect(result.vault.education[0]).toEqual(expect.objectContaining({
      degree: 'Technik informatyk',
      institution: 'Zespół Szkół Technicznych',
      fieldOfStudy: '',
      startDate: '2016',
      endDate: '2020',
    }));
    expect(result.vault.personalInfo.summary).toContain('Specjalistka wsparcia IT');
  });
});
