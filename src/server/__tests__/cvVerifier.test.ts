import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MasterVault } from '../../types';
import { verifyCvWithTripleLoop } from '../services/cvVerifier.service';
import { generateWithUsage } from '../geminiClient';

const sentPrompts: string[] = [];

vi.mock('../geminiClient', async () => {
  const actual = await vi.importActual<typeof import('../geminiClient')>('../geminiClient');
  return {
    ...actual,
    getActiveAiModel: () => 'gpt-4o',
    generateWithUsage: vi.fn(async (params: Record<string, unknown>) => {
      sentPrompts.push(String(params.contents));
      return {
        text: JSON.stringify({
          overallScore: 88,
          verdict: 'READY_TO_APPLY',
          summary: 'Bardzo silny profil z mierzalnymi wynikami i czytelną ścieżką kariery.',
          atsLoop: {
            atsScore: 92,
            parsedRole: 'Inżynier Automatyki',
            recognizedKeywords: ['PLC Siemens', 'SCADA', 'SQL'],
            missingCriticalKeywords: ['TIA Portal V19'],
            atsFormatRisks: [],
          },
          recruiterLoop: {
            recruiterScore: 85,
            headlineClarity: 'EXCELLENT',
            strengthsFound: ['Mierzalne redukcje przestojów o 38%'],
            weaknessesOrFluff: [],
            achievementMetricRatePct: 80,
          },
          logicComplianceLoop: {
            consistencyScore: 90,
            chronologyValid: true,
            timelineAnomalies: [],
            logicalInconsistencies: [],
            rodoCompliant: true,
            privacyRisks: [],
          },
          actionableRecommendations: [
            {
              priority: 1,
              category: 'ATS',
              title: 'Dodaj wersję środowiska TIA Portal',
              description: 'Ogłoszenie precyzuje wersję V19.',
              suggestedFix: 'Doprecyzuj w punkcie doświadczenia.',
            },
          ],
        }),
        usageMetadata: { promptTokenCount: 150, candidatesTokenCount: 120 },
      };
    }),
  };
});

const sampleVault: Partial<MasterVault> = {
  personalInfo: {
    fullName: 'Michał Kowalczyk',
    email: 'michal.kowalczyk@example.pl',
    phone: '+48 601 234 567',
    location: 'Warszawa',
    photoUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD...',
    title: 'Inżynier Automatyki i Utrzymania Ruchu',
    summary: 'Specjalista z 10-letnim stażem w utrzymaniu ruchu linii produkcyjnych.',
  },
  skillsMatrix: {
    hardSkills: ['PLC Siemens', 'SCADA'],
    softSkills: ['Zarządzanie zespołem'],
    toolsAndTech: ['SQL', 'Excel'],
    certifications: [{ id: '1', name: 'SEP E do 1kV', issuer: 'SEP' }],
  },
  history: [
    {
      id: 'h1',
      company: 'NordGlass S.A.',
      role: 'Inżynier Utrzymania Ruchu',
      startDate: '2021-03',
      endDate: '',
      isCurrent: true,
      location: 'Warszawa',
      highlights: [
        {
          id: 'hl1',
          text: 'Zredukowałem przestoje linii hartowania szkła o 38% w 18 miesięcy.',
          action: 'Zredukowałem przestoje',
          target: 'linie hartowania',
          tool: 'SCADA',
          metric: '38%',
          keywords: ['przestoje', 'SCADA'],
        },
      ],
    },
  ],
  education: [],
  projects: [],
};

describe('cvVerifier.service - Potrójna Pętla AI Weryfikacji CV', () => {
  beforeEach(() => {
    sentPrompts.length = 0;
    vi.mocked(generateWithUsage).mockClear();
  });

  it('generuje raport 360° z poprawną strukturą 3 pętli', async () => {
    const report = await verifyCvWithTripleLoop({
      vault: sampleVault as MasterVault,
      targetRole: 'Inżynier Automatyki',
      targetCompany: 'NordGlass',
      jobDescription: 'Poszukujemy doświadczonego Inżyniera Automatyki ze znajomością PLC Siemens.',
    });

    expect(report.overallScore).toBe(88);
    expect(report.verdict).toBe('READY_TO_APPLY');
    expect(report.atsLoop.atsScore).toBe(92);
    expect(report.atsLoop.recognizedKeywords).toContain('PLC Siemens');
    expect(report.recruiterLoop.recruiterScore).toBe(85);
    expect(report.logicComplianceLoop.chronologyValid).toBe(true);
    expect(report.actionableRecommendations.length).toBeGreaterThan(0);
  });

  it('usuwa podany email, telefon i zdjęcie z promptu modelu', async () => {
    await verifyCvWithTripleLoop({
      vault: sampleVault as MasterVault,
      targetRole: 'Inżynier Automatyki',
    });

    expect(sentPrompts.length).toBe(1);
    const sent = sentPrompts[0];

    // Sprawdzamy że dane wrażliwe nie trafiły do promptu
    expect(sent).not.toContain('michal.kowalczyk@example.pl');
    expect(sent).not.toContain('+48 601 234 567');
    expect(sent).not.toContain('data:image');
  });

  it('opisuje jedną opinię AI o danych profilu bez udawania pomiaru rekrutera i niezależnych audytów', async () => {
    await verifyCvWithTripleLoop({ vault: sampleVault as MasterVault });
    expect(generateWithUsage).toHaveBeenCalledTimes(1);
    const sent = sentPrompts[0];
    expect(sent).not.toMatch(/6 sekund|niezależnych pętlach|czołowych agencji headhunterskich/u);
    expect(sent).toContain('Oceny są opinią modelu');
    expect(sent).toContain('Nie potwierdzaj prawdziwości deklaracji ani zgodności prawnej');
  });

  it('pseudonimizuje caly prompt, takze edukacje i dane kontaktowe oferty', async () => {
    const privateVault = structuredClone(sampleVault) as MasterVault;
    const privateName = privateVault.personalInfo.fullName;
    privateVault.education = [{
      id: 'education-private',
      institution: `${privateName} Technical School`,
      degree: 'Technik',
      fieldOfStudy: 'Automatyka',
      startDate: '2010',
      endDate: '2014',
    }];

    await verifyCvWithTripleLoop({
      vault: privateVault,
      targetRole: privateName,
      jobDescription: 'Aplikuj: rekrutacja@example.invalid, tel. +48 600 700 800. Wymagane PLC Siemens.',
    });

    const sent = sentPrompts.at(-1) ?? '';
    expect(sent).not.toContain(privateName);
    expect(sent).not.toContain('rekrutacja@example.invalid');
    expect(sent).not.toContain('+48 600 700 800');
    expect(sent).toContain('Wymagane PLC Siemens');
    expect(sent).toContain('2021-03');
  });

  it('odrzuca pusty profil przed wysłaniem danych do modelu', async () => {
    await expect(verifyCvWithTripleLoop({ vault: { personalInfo: {} } as MasterVault }))
      .rejects.toMatchObject({ status: 422, expose: true });

    expect(sentPrompts).toHaveLength(0);
    expect(generateWithUsage).not.toHaveBeenCalled();
  });

  it('oznacza brak oferty i stanowiska zamiast wstawiać fikcyjne wartości', async () => {
    const report = await verifyCvWithTripleLoop({ vault: sampleVault as MasterVault });

    expect(report.hasJobDescription).toBe(false);
    expect(report.overallScore).toBeNull();
    expect(report.verdict).toBeNull();
    expect(report.atsLoop.atsScore).toBeNull();
    expect(report.atsLoop.parsedRole).toBe('');
    expect(report.atsLoop.recognizedKeywords).toEqual([]);
    expect(report.atsLoop.missingCriticalKeywords).toEqual([]);
    expect(report.atsLoop.atsFormatRisks).toEqual([]);
    expect(sentPrompts.length).toBe(1);
    const sent = sentPrompts[0];
    expect(sent).toContain('"targetRole": "Inżynier Automatyki i Utrzymania Ruchu"');
    expect(sent).toContain('"targetCompany": "nie podano"');
    expect(sent).toContain('Nie podano treści ogłoszenia.');
    expect(sent).not.toContain('Firma Rekrutująca');
  });
  it('nie przedstawia oszacowanego ryzyka formatowania, bo wejściem nie jest CV w pliku', async () => {
    const oferta = 'Wymagamy PLC Siemens i do?wiadczenia w automatyce.';
    const baseline = await verifyCvWithTripleLoop({ vault: sampleVault as MasterVault, jobDescription: oferta });
    vi.mocked(generateWithUsage).mockResolvedValueOnce({
      text: JSON.stringify({
        ...baseline,
        atsLoop: {
          ...baseline.atsLoop,
          atsFormatRisks: [{ severity: 'HIGH', issue: 'Nieznany układ PDF', fix: 'U?yj jednej kolumny.' }],
        },
      }),
    } as never);

    const report = await verifyCvWithTripleLoop({ vault: sampleVault as MasterVault, jobDescription: oferta });

    expect(report.hasJobDescription).toBe(true);
    expect(report.atsLoop.atsFormatRisks).toEqual([]);
  });

  it('zachowuje prawidłowe zera i wyprowadza werdykt z wyniku kanonicznego', async () => {
    const baseline = await verifyCvWithTripleLoop({ vault: sampleVault as MasterVault, jobDescription: 'Wymagamy PLC Siemens.' });
    const response = {
      ...baseline,
      overallScore: 0,
      verdict: 'READY_TO_APPLY',
      atsLoop: { ...baseline.atsLoop, atsScore: 0 },
      recruiterLoop: { ...baseline.recruiterLoop, recruiterScore: 0, achievementMetricRatePct: 0 },
      logicComplianceLoop: { ...baseline.logicComplianceLoop, consistencyScore: 0 },
    };
    vi.mocked(generateWithUsage).mockResolvedValueOnce({ text: JSON.stringify(response) } as never);

    const report = await verifyCvWithTripleLoop({ vault: sampleVault as MasterVault, jobDescription: 'Wymagamy PLC Siemens.' });

    expect(report.overallScore).toBe(0);
    expect(report.atsLoop.atsScore).toBe(0);
    expect(report.recruiterLoop.recruiterScore).toBe(0);
    expect(report.recruiterLoop.achievementMetricRatePct).toBe(100);
    expect(report.logicComplianceLoop.consistencyScore).toBe(0);
    expect(report.logicComplianceLoop.rodoCompliant).toBeNull();
    expect(report.verdict).toBe('CRITICAL_FIXES_NEEDED');
  });

  it('odrzuca brak chronologii i nigdy nie uznaje RODO na podstawie odpowiedzi modelu', async () => {
    const baseline = await verifyCvWithTripleLoop({ vault: sampleVault as MasterVault });
    const incomplete = { ...baseline, logicComplianceLoop: { ...baseline.logicComplianceLoop } };
    delete (incomplete.logicComplianceLoop as Partial<typeof incomplete.logicComplianceLoop>).chronologyValid;
    vi.mocked(generateWithUsage).mockResolvedValueOnce({ text: JSON.stringify(incomplete) } as never);

    await expect(verifyCvWithTripleLoop({ vault: sampleVault as MasterVault }))
      .rejects.toMatchObject({ status: 502 });

    const claimsRodoCompliance = {
      ...baseline,
      logicComplianceLoop: { ...baseline.logicComplianceLoop, rodoCompliant: true },
    };
    vi.mocked(generateWithUsage).mockResolvedValueOnce({ text: JSON.stringify(claimsRodoCompliance) } as never);
    const report = await verifyCvWithTripleLoop({ vault: sampleVault as MasterVault });
    expect(report.logicComplianceLoop.rodoCompliant).toBeNull();
  });

  it('wylicza udział punktów z metryką z CV i pokazuje brak danych bez punktów', async () => {
    const withTwoPoints = structuredClone(sampleVault) as MasterVault;
    withTwoPoints.history![0].highlights.push({
      id: 'hl2', text: 'Współpraca przy naprawach.', action: '', target: '', tool: '', metric: '', keywords: [],
    });
    const measured = await verifyCvWithTripleLoop({ vault: withTwoPoints });
    expect(measured.recruiterLoop.achievementMetricRatePct).toBe(50);

    const withoutPoints = structuredClone(sampleVault) as MasterVault;
    withoutPoints.history![0].highlights = [];
    const empty = await verifyCvWithTripleLoop({ vault: withoutPoints });
    expect(empty.recruiterLoop.achievementMetricRatePct).toBeNull();
  });

  it('bez oferty usuwa rekomendacje ATS, zachowując uwagi o treści profilu', async () => {
    const baseline = await verifyCvWithTripleLoop({ vault: sampleVault as MasterVault, jobDescription: 'Wymagamy PLC Siemens.' });
    const readability = { priority: 2, category: 'RECRUITER', title: 'Doprecyzuj opis działania', description: 'Opisz zakres swojego zadania.' };
    vi.mocked(generateWithUsage).mockResolvedValueOnce({
      text: JSON.stringify({ ...baseline, actionableRecommendations: [...baseline.actionableRecommendations, readability] }),
    } as never);
    const report = await verifyCvWithTripleLoop({ vault: sampleVault as MasterVault });
    expect(report.actionableRecommendations).toEqual([readability]);
  });

  it('nie uznaje chronologii za wolną od sprzeczności, gdy model zwrócił anomalie dat', async () => {
    const baseline = await verifyCvWithTripleLoop({ vault: sampleVault as MasterVault });
    vi.mocked(generateWithUsage).mockResolvedValueOnce({ text: JSON.stringify({
      ...baseline,
      logicComplianceLoop: { ...baseline.logicComplianceLoop, chronologyValid: true, timelineAnomalies: ['Koniec pracy poprzedza początek.'] },
    }) } as never);
    const report = await verifyCvWithTripleLoop({ vault: sampleVault as MasterVault });
    expect(report.logicComplianceLoop.chronologyValid).toBe(false);
    expect(report.logicComplianceLoop.timelineAnomalies).toEqual(['Koniec pracy poprzedza początek.']);
  });
});
