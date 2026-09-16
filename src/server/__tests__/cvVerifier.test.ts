import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MasterVault } from '../../types';
import { verifyCvWithTripleLoop } from '../services/cvVerifier.service';

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
            complianceScore: 90,
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

  it('gwarantuje zero wycieku PII (email, telefon, photoUrl) do promptu modelu', async () => {
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
});
