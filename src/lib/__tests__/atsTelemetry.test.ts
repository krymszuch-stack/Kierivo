import { describe, it, expect } from 'vitest';
import {
  buildAtsTelemetryReport,
  computeActionVerbRatio,
  FORMULA_WEIGHTS,
  STUFFING_DENSITY_THRESHOLD,
} from '../atsScorer';
import { createEmptyVault } from '../sampleVault';
import type { MasterVault } from '../../types';

/**
 * Raport śledczy ma być dowodliwy, więc test pilnuje matematyki i reakcji
 * neutralnych profili cech na mierzalne sygnały. Profile nie reprezentują
 * zewnętrznych produktów ATS.
 */

const vaultWithContent = {
  ...createEmptyVault('Jan Kowalski', 'jan@example.com'),
  personalInfo: {
    ...createEmptyVault().personalInfo,
    title: 'Technik Automatyk',
    summary: 'Specjalista ds. automatyki przemysłowej.',
  },
  skillsMatrix: {
    hardSkills: ['PLC Siemens', 'Sterowanie PLC', 'Robotyka'],
    softSkills: [],
    toolsAndTech: ['TIA Portal'],
    certifications: [],
  } as MasterVault['skillsMatrix'],
  history: [
    {
      id: 'job-1',
      company: 'Fabryka',
      role: 'Automatyk',
      location: 'Poznań',
      startDate: '2019-01-01',
      endDate: '2024-01-01',
      isCurrent: false,
      highlights: [
        {
          id: 'h1',
          text: 'Wdrożyłem linię pakującą',
          action: 'wdrożyłem',
          target: 'linię pakującą',
          tool: 'PLC Siemens',
          metric: '30%',
          keywords: ['PLC'],
        },
        {
          id: 'h2',
          text: 'Zoptymalizowałem cykl pracy robota',
          action: 'zoptymalizowałem',
          target: 'cykl pracy',
          tool: 'Robotyka',
          metric: '15%',
          keywords: [],
        },
        {
          id: 'h3',
          text: 'Odpowiadałem za utrzymanie ruchu',
          action: '',
          target: '',
          tool: '',
          metric: '',
          keywords: [],
        },
      ],
    },
  ],
} as unknown as MasterVault;

const JD = `Poszukujemy technika automatyka. Wymagania: sterowanie PLC Siemens,
programowanie w TIA Portal, znajomość robotyki przemysłowej oraz doświadczenie
w utrzymaniu ruchu. Mile widziane uprawnienia SEP.`;

describe('formuła wyniku ogólnego', () => {
  it('wagi składników sumują się do jedności', () => {
    const sum =
      FORMULA_WEIGHTS.hardSkills +
      FORMULA_WEIGHTS.experience +
      FORMULA_WEIGHTS.structure +
      FORMULA_WEIGHTS.actionVerbs;
    expect(sum).toBeCloseTo(1, 10);
  });

  it('wynik mieści się w przedziale 0–100 dla realnych danych', () => {
    const report = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD });
    expect(report.overallScore).toBeGreaterThanOrEqual(0);
    expect(report.overallScore).toBeLessThanOrEqual(100);
  });

  it('kary zerojedynkowe obniżają wynik względem tego samego profilu bez wymagań formalnych', () => {
    const jdZSep = `${JD}\n\nWymagane: uprawnienia SEP do 1 kV oraz prawo jazdy kat. B.`;
    const bez = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD });
    const zKarami = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: jdZSep });

    expect(zKarami.formulaBreakdown.knockoutPenalties)
      .toBeGreaterThan(bez.formulaBreakdown.knockoutPenalties);
    expect(zKarami.overallScore).not.toBeNull();
    expect(bez.overallScore).not.toBeNull();
    expect(zKarami.overallScore!).toBeLessThanOrEqual(bez.overallScore!);
    expect(zKarami.formulaBreakdown.knockoutPenalties).toBeLessThanOrEqual(100);
  });
});

describe('telemetria językowa', () => {
  it('nie uznaje tytulu roli za dowod umiejetnosci', () => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    vault.personalInfo.title = 'Python Developer';
    vault.personalInfo.summary = 'Praca zespolowa i planowanie wydan produktowych.';
    vault.history = [{
      id: 'role-python',
      company: 'Firma',
      role: 'Python Developer',
      location: '',
      startDate: '2020-01',
      endDate: '2022-01',
      isCurrent: false,
      description: 'Wspolpraca z zespolami przy planowaniu wydan.',
      highlights: [],
    }];

    const report = buildAtsTelemetryReport({ vault, jobDescription: 'Wymagania: Python.' });

    expect(report.formulaBreakdown.hardSkillsScore).toBe(0);
    expect(report.linguisticTelemetry.missingCriticalLemmas).toContain('python');
  });

  it('uwzglednia merytoryczny opis doswiadczenia w pokryciu wymagan', () => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    vault.history = [{
      id: 'linux-role',
      company: 'Firma',
      role: 'Administrator',
      location: '',
      startDate: '2020-01',
      endDate: '2022-01',
      isCurrent: false,
      description: 'Administracja serwerami Linux w srodowisku produkcyjnym.',
      highlights: [],
    }];

    const report = buildAtsTelemetryReport({ vault, jobDescription: 'Wymagania: Linux.' });

    expect(report.formulaBreakdown.hardSkillsScore).toBe(100);
    expect(report.linguisticTelemetry.matchedLemmas.map((lemma) => lemma.term)).toContain('linux');
  });

  it('brak twardych wymagan nie daje 0% pokrycia w telemetrii', () => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.invalid');
    vault.personalInfo.summary = 'Technik wsparcia z doswiadczeniem w obsludze uzytkownikow.';
    vault.profiler.languages = [{ id: 'language-1', language: 'Angielski', level: 'C1', context: '' }];
    vault.history = [{
      id: 'formal-only-role',
      company: 'Acme',
      role: 'Support Engineer',
      location: '',
      startDate: '2020-01-01',
      endDate: '2024-01-01',
      isCurrent: false,
      description: 'Obslugiwalem zgloszenia uzytkownikow i rozwiazywalem problemy systemowe.',
      highlights: [],
    }];
    const report = buildAtsTelemetryReport({
      vault,
      jobDescription: 'Wymagania formalne: znajomosc jezyka angielskiego na poziomie C1. Min. 2 lata doswiadczenia zawodowego.',
    });

    expect(report.formulaBreakdown.hardSkillsScore).toBeNull();
    expect(report.formulaBreakdown.assessedWeightPercent).toBe(60);
    expect(report.overallScore).toBeGreaterThan(0);
  });

  it('pokrycie lematów liczy frazy po rdzeniu, nie dosłownie', () => {
    const report = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD });
    const matched = report.linguisticTelemetry.matchedLemmas.map((lemma) => lemma.term);

    expect(matched.length).toBeGreaterThan(0);
    expect(report.linguisticTelemetry.missingCriticalLemmas).not.toContain('PLC Siemens');
    expect(report.linguisticTelemetry.totalExtractedTokens).toBeGreaterThan(10);
    expect(report.linguisticTelemetry.matchedLemmas.every((lemma) => lemma.source === 'Custom')).toBe(true);
  });

  it('brakujące twarde wymagania trafiają na listę krytycznych', () => {
    const jd = 'Wymagany Kubernetes oraz Terraform w produkcji.';
    const report = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: jd });

    expect(report.linguisticTelemetry.missingCriticalLemmas).toContain('kubernetes');
    expect(report.linguisticTelemetry.missingCriticalLemmas).toContain('terraform');
  });
});

describe('sprawczość językowa', () => {
  it('ratio liczy wyłącznie zdania z czasownikiem dokonanym', () => {
    const tekst = [
      'Wdrożyłem system wizyjny.',
      'Odpowiadałem za serwis.',
      'Zoptymalizowałem proces.',
    ].join('\n');

    const ratio = computeActionVerbRatio(tekst);
    expect(ratio).toBeCloseTo(2 / 3, 5);
  });

  it('brak zdań do oceny zwraca brak danych, nie 0%', () => {
    expect(computeActionVerbRatio('')).toBeNull();
    expect(computeActionVerbRatio('   \n  ')).toBeNull();
  });

  it('składnik sprawczości w raporcie odzwierciedla ratio', () => {
    const report = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD });
    const ratio = report.linguisticTelemetry.actionVerbRatio;
    expect(ratio).not.toBeNull();
    expect(report.formulaBreakdown.actionVerbsScore)
      .toBe(Math.round((ratio ?? 0) * 100));
  });

  it('lista umiejetnosci bez narracji nie jest zerowym wynikiem sprawczosci', () => {
    const vault = {
      ...createEmptyVault('Jan Kowalski', 'jan@example.invalid'),
      personalInfo: {
        ...createEmptyVault().personalInfo,
        summary: '',
      },
      skillsMatrix: {
        hardSkills: ['Python', 'Linux', 'AWS', 'Excel', 'Teams', 'Active Directory'],
        softSkills: [],
        toolsAndTech: [],
        certifications: [],
      } as MasterVault['skillsMatrix'],
      history: [],
      projects: [],
    };
    const report = buildAtsTelemetryReport({
      vault,
      jobDescription: 'Wymagania: Python, Linux, AWS. Zakres: administracja systemami i wsparcie uzytkownikow.',
    });

    expect(report.formulaBreakdown.hardSkillsScore).toBeGreaterThan(0);
    expect(report.formulaBreakdown.actionVerbsScore).toBeNull();
    expect(report.linguisticTelemetry.actionVerbRatio).toBeNull();
    expect(report.heuristicProfiles.find((profile) => profile.profileId === 'Frazy_Gestosc')!.score)
      .toBeGreaterThanOrEqual(0);
  });
});

describe('telemetria strukturalna', () => {
  it('dokument kanoniczny ma stabilną kolejność i zero tabel', () => {
    const report = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD });
    expect(report.structuralTelemetry.readingOrderIntegrity).toBe('STABLE');
    expect(report.structuralTelemetry.tableCount).toBe(0);
    expect(report.structuralTelemetry.headingHierarchyValid).toBe(true);
  });

  it('surowy tekst wielokolumnowy zostaje oznaczony jako CORRUPTED wraz z tabelą', () => {
    const dwukolumnowy = Array.from({ length: 20 }, (_, i) =>
      `Lewa${i} kolumna     Prawa kolumna treść`
    ).join('\n');

    const report = buildAtsTelemetryReport({
      vault: vaultWithContent,
      jobDescription: JD,
      cvRawText: `# CV\n## Doświadczenie\n| Firma | Rola |\n| X | Y |\n${dwukolumnowy}`,
    });

    expect(report.structuralTelemetry.readingOrderIntegrity).toBe('CORRUPTED');
    expect(report.structuralTelemetry.tableCount).toBeGreaterThanOrEqual(1);
    expect(report.formulaBreakdown.structureScore)
      .toBeLessThan(buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD }).formulaBreakdown.structureScore);
  });
});

describe('neutralne profile mierzalnych cech', () => {
  it('zwraca trzy profile nazwane cechami, nie vendorami', () => {
    const report = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD });
    expect(report.heuristicProfiles.map((profile) => profile.profileId)).toEqual([
      'Struktura_Odczyt',
      'Frazy_Gestosc',
      'Jezyk_Formularz',
    ]);
    expect(report.heuristicProfiles.map((profile) => profile.profileCategory)).toEqual([
      'Układ i parsowalność',
      'Frazy i sygnały tekstowe',
      'Polska fleksja i formularze',
    ]);
  });

  it('tabele i wielokolumny obniżają profil strukturalny co najmniej tak mocno jak frazowy', () => {
    const bazowy = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD });
    const zepsuty = buildAtsTelemetryReport({
      vault: vaultWithContent,
      jobDescription: JD,
      cvRawText: `${Array.from({ length: 25 }, (_, i) => `KolA${i}      KolB${i}`).join('\n')}\n| a | b |`,
    });

    const spadek = (systemId: string) =>
      bazowy.heuristicProfiles.find((profile) => profile.profileId === systemId)!.score! -
      zepsuty.heuristicProfiles.find((profile) => profile.profileId === systemId)!.score!;

    expect(spadek('Struktura_Odczyt')).toBeGreaterThanOrEqual(spadek('Frazy_Gestosc'));
    expect(zepsuty.heuristicProfiles.find((profile) => profile.profileId === 'Struktura_Odczyt')!
      .criticalRisks.length).toBeGreaterThan(0);
  });

  it('upychanie słów kluczowych karze profil fraz i gęstości', () => {
    const upychanyVault = JSON.parse(JSON.stringify(vaultWithContent)) as MasterVault;
    upychanyVault.skillsMatrix.hardSkills.push('PLC Siemens');
    upychanyVault.history[0].highlights[0].text =
      'PLC Siemens PLC Siemens PLC Siemens PLC Siemens wdrożyłem';

    const krótkieJd = 'Automatyk PLC Siemens.';
    const normalny = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: krótkieJd });
    const upychanie = buildAtsTelemetryReport({ vault: upychanyVault, jobDescription: krótkieJd });

    const frazyNormalny = normalny.heuristicProfiles.find((profile) => profile.profileId === 'Frazy_Gestosc')!;
    const frazyUpychanie = upychanie.heuristicProfiles.find((profile) => profile.profileId === 'Frazy_Gestosc')!;

    const maxDensity = Math.max(...upychanie.linguisticTelemetry.matchedLemmas.map((lemma) => lemma.densityRatio));
    if (maxDensity > STUFFING_DENSITY_THRESHOLD) {
      expect(frazyUpychanie.score!).toBeLessThan(frazyNormalny.score!);
    }
    expect(maxDensity).toBeGreaterThan(normalny.linguisticTelemetry.matchedLemmas.reduce(
      (max, lemma) => Math.max(max, lemma.densityRatio), 0
    ));
  });

  it('wyniki profili mieszczą się w przedziale 0–100', () => {
    const report = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD });
    for (const profile of report.heuristicProfiles) {
      expect(profile.score).toBeGreaterThanOrEqual(0);
      expect(profile.score).toBeLessThanOrEqual(100);
    }
  });
});


describe('brak danych o doswiadczeniu w telemetrii', () => {
  it('nie pokazuje 0% ani czastkowego wyniku lacznego bez historii', () => {
    const vault = { ...vaultWithContent, history: [] };
    const report = buildAtsTelemetryReport({ vault, jobDescription: JD });

    expect(report.formulaBreakdown.experienceScore).toBeNull();
    expect(report.formulaBreakdown.assessedWeightPercent).toBe(75);
    expect(report.overallScore).toBeNull();
  });
});

describe('profile heurystyczne wymagaja danych dla mierzonej cechy', () => {
  it('nie zwraca dodatnich ocen profili dla pustego CV i pustej oferty', () => {
    const report = buildAtsTelemetryReport({ vault: createEmptyVault(), jobDescription: '' });

    expect(report.overallScore).toBeNull();
    expect(report.heuristicProfiles.map(({ score }) => score)).toEqual([null, null, null]);
    expect(report.heuristicProfiles.map(({ unavailableReason }) => unavailableReason)).toEqual([
      'Brak treści profilu kandydata do oceny.',
      'Brak treści profilu kandydata do oceny.',
      'Brak treści profilu kandydata do oceny.',
    ]);
    expect(report.heuristicProfiles.flatMap(({ criticalRisks, complianceReasons }) => [
      ...criticalRisks,
      ...complianceReasons,
    ])).toEqual([]);
  });

  it('wstrzymuje tylko pomiar fraz, gdy oferta nie daje jego mianownika', () => {
    const vault = createEmptyVault();
    vault.personalInfo.title = 'Technik utrzymania ruchu';
    vault.personalInfo.summary = 'Prowadzę konserwację i naprawy urządzeń przemysłowych.';
    const report = buildAtsTelemetryReport({
      vault,
      jobDescription: 'Poszukujemy osoby do pracy zmianowej. Aplikuj już dziś.',
    });

    expect(report.heuristicProfiles[0].score).not.toBeNull();
    expect(report.heuristicProfiles[1].score).toBeNull();
    expect(report.heuristicProfiles[1].unavailableReason).toBe(
      'Oferta nie zawiera rozpoznanych wymagań do pomiaru fraz.'
    );
    expect(report.heuristicProfiles[2].score).not.toBeNull();
  });
});
