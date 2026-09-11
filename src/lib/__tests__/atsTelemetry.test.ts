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
 * Raport śledczy ma być dowodliwy, więc test pilnuje dokładnie tej matematyki,
 * która jest w opisie formuły: wagi sumują się do jedności, kary zerojedynkowe
 * obniżają wynik końcowy, a werdykty systemów reagują na mierzalne cechy
 * (tabele i wielokolumny bolą legacy najbardziej, gęstość — booleanowe).
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
    expect(zKarami.overallScore).toBeLessThanOrEqual(bez.overallScore);
    // Kary nie mogą ujemnie przewyższyć samej siebie — podłoga zera.
    expect(zKarami.formulaBreakdown.knockoutPenalties).toBeLessThanOrEqual(100);
  });
});

describe('telemetria językowa', () => {
  it('pokrycie lematów liczy frazy po rdzeniu, nie dosłownie', () => {
    // CV ma „Sterowanie PLC", ogłoszenie „sterowanie PLC" + odmianę „sterowania".
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
      'Wdrożyłem system wizyjny.', // tak
      'Odpowiadałem za serwis.', // nie — niedokonany
      'Zoptymalizowałem proces.', // tak
    ].join('\n');

    const ratio = computeActionVerbRatio(tekst);
    expect(ratio).toBeCloseTo(2 / 3, 5);
  });

  it('pusty dokument daje zero, nie NaN', () => {
    expect(computeActionVerbRatio('')).toBe(0);
    expect(computeActionVerbRatio('   \n  ')).toBe(0);
  });

  it('składnik sprawczości w raporcie odzwierciedla ratio', () => {
    const report = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD });
    expect(report.formulaBreakdown.actionVerbsScore)
      .toBe(Math.round(report.linguisticTelemetry.actionVerbRatio * 100));
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

describe('werdykty per system rekrutacyjny', () => {
  it('trzy systemy, każdy z własną kategorią', () => {
    const report = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD });
    expect(report.systemVulnerabilities.map((system) => system.systemId)).toEqual([
      'Taleo_Workday',
      'Greenhouse_Lever',
      'eRecruiter_Traffit',
    ]);
    expect(report.systemVulnerabilities.map((system) => system.systemCategory)).toEqual([
      'Enterprise Legacy',
      'Modern ATS / Boolean',
      'Polish Market (MŚP)',
    ]);
    expect(report.systemVulnerabilities.map((system) => system.featureName)).toEqual([
      'Parsowanie liniowe i odporność strukturalna',
      'Filtry słów kluczowych i gęstość fraz',
      'Mapowanie formularzy i fleksja polska',
    ]);
  });

  it('tabele i wielokolumny bolą legacy bardziej niż booleanowe', () => {
    const bazowy = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD });
    const zepsuty = buildAtsTelemetryReport({
      vault: vaultWithContent,
      jobDescription: JD,
      cvRawText: `${Array.from({ length: 25 }, (_, i) => `KolA${i}      KolB${i}`).join('\n')}\n| a | b |`,
    });

    const spadek = (systemId: string) =>
      bazowy.systemVulnerabilities.find((system) => system.systemId === systemId)!.passProbability -
      zepsuty.systemVulnerabilities.find((system) => system.systemId === systemId)!.passProbability;

    expect(spadek('Taleo_Workday')).toBeGreaterThanOrEqual(spadek('Greenhouse_Lever'));
    expect(zepsuty.systemVulnerabilities.find((system) => system.systemId === 'Taleo_Workday')!
      .criticalRisks.length).toBeGreaterThan(0);
  });

  it('upychanie słów kluczowych karze silniki booleanowskie', () => {
    // Ta sama fraza powtórzona masowo w CV przy krótkim ogłoszeniu.
    const upychanyVault = JSON.parse(JSON.stringify(vaultWithContent)) as MasterVault;
    upychanyVault.skillsMatrix.hardSkills.push('PLC Siemens');
    upychanyVault.history[0].highlights[0].text =
      'PLC Siemens PLC Siemens PLC Siemens PLC Siemens wdrożyłem';

    const krótkieJd = 'Automatyk PLC Siemens.';
    const normalny = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: krótkieJd });
    const upychanie = buildAtsTelemetryReport({ vault: upychanyVault, jobDescription: krótkieJd });

    const ghNormalny = normalny.systemVulnerabilities.find((system) => system.systemId === 'Greenhouse_Lever')!;
    const ghUpychanie = upychanie.systemVulnerabilities.find((system) => system.systemId === 'Greenhouse_Lever')!;

    const maxDensity = Math.max(...upychanie.linguisticTelemetry.matchedLemmas.map((lemma) => lemma.densityRatio));
    if (maxDensity > STUFFING_DENSITY_THRESHOLD) {
      expect(ghUpychanie.passProbability).toBeLessThan(ghNormalny.passProbability);
    }
    expect(maxDensity).toBeGreaterThan(normalny.linguisticTelemetry.matchedLemmas.reduce(
      (max, lemma) => Math.max(max, lemma.densityRatio), 0
    ));
  });

  it('prawdopodobieństwa mieszczą się w przedziale 0–100', () => {
    const report = buildAtsTelemetryReport({ vault: vaultWithContent, jobDescription: JD });
    for (const system of report.systemVulnerabilities) {
      expect(system.passProbability).toBeGreaterThanOrEqual(0);
      expect(system.passProbability).toBeLessThanOrEqual(100);
    }
  });
});
