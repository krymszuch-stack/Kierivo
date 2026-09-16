import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateInterviewQuestionsWithAi,
  evaluateStarAnswerWithAi,
} from '../services/interviewCoach.service';
import * as geminiClientModule from '../geminiClient';
import { createEmptyVault } from '../../lib/sampleVault';

vi.mock('../geminiClient', async () => {
  const actual = await vi.importActual('../geminiClient');
  return {
    ...actual,
    generateWithUsage: vi.fn(),
  };
});

describe('InterviewCoach Service (Azure OpenAI STAR Coach)', () => {
  const mockVault = createEmptyVault('Jan Kowalski', 'jan@example.com');
  mockVault.personalInfo.title = 'Senior Cloud Architect';
  mockVault.skillsMatrix.hardSkills = ['Kubernetes', 'Go', 'Azure'];
  mockVault.history = [
    {
      id: 'exp-1',
      company: 'Enterprise Cloud Sp. z o.o.',
      role: 'Cloud Architect',
      location: 'Warszawa',
      startDate: '2021-01',
      endDate: '2023-01',
      isCurrent: false,
      highlights: [
        {
          id: 'hl-1',
          text: 'Migracja 50 mikroserwisów do Azure AKS ze wskaźnikiem 99.99% uptime.',
          metric: '99.99%',
          target: '',
          action: '',
          tool: '',
          keywords: ['Azure', 'Kubernetes'],
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateInterviewQuestionsWithAi', () => {
    it('generuje 4 celowane pytania rekrutacyjne i nie ujawnia PII kandydata', async () => {
      const mockQuestionsResponse = {
        questions: [
          {
            id: 'q_1',
            category: 'behavioral',
            question: 'Opowiedz o sytuacji, gdy podczas migracji w chmurze wystąpiła nieprzewidziana awaria.',
            recruiterIntent: 'Weryfikacja opanowania i procedur rollback',
            suggestedStarTips: 'Skup się na szybkim przywróceniu SLA i wnioskach poincydentowych',
          },
          {
            id: 'q_2',
            category: 'situational',
            question: 'Jak zaprojektowałbyś architekturę multi-region w Azure przy ograniczonym budżecie?',
            recruiterIntent: 'Zdolność do optymalizacji kosztów FinOps',
            suggestedStarTips: 'Przedstaw kompromisy między redundancją a kosztem egressu',
          },
        ],
      };

      vi.spyOn(geminiClientModule, 'generateWithUsage').mockResolvedValueOnce({
        text: JSON.stringify(mockQuestionsResponse),
        usageMetadata: { promptTokenCount: 400, candidatesTokenCount: 250, totalTokenCount: 650 },
      });

      const result = await generateInterviewQuestionsWithAi({
        vault: mockVault,
        targetRole: 'Senior Cloud Architect',
        targetCompany: 'FinTech Corp',
      });

      expect(result.questions).toHaveLength(2);
      expect(result.questions[0].category).toBe('behavioral');
      expect(result.questions[0].question).toContain('migracji');
      expect(result.usage?.totalTokenCount).toBe(650);

      // Weryfikacja braku PII (np. email i nazwisko nie mogą trafić do promptu)
      const callArgs = vi.mocked(geminiClientModule.generateWithUsage).mock.calls[0][0];
      const sentText = String(callArgs.contents);
      expect(sentText).not.toContain('jan@example.com');
      expect(sentText).not.toContain('Jan Kowalski');
    });
  });

  describe('evaluateStarAnswerWithAi', () => {
    it('ocenia wypowiedź kandydata pod kątem struktury STAR i zwraca punktację z wersją wzorcową', async () => {
      const mockEvaluationResponse = {
        overallScore: 8,
        verdict: 'SOLID',
        starBreakdown: {
          situation: { score: 8, feedback: 'Zwięzły zarys sytuacji produkcyjnej.' },
          task: { score: 8, feedback: 'Jasno określona odpowiedzialność za SLA.' },
          action: { score: 9, feedback: 'Dobre użycie formy pierwszej osoby (ja wdrożyłem).' },
          result: { score: 7, feedback: 'Warto dodać precyzyjną kwotę oszczędności.' },
        },
        strengths: ['Konkretne narzędzia (Terraform, Azure AKS)', 'Klarowna rola lidera'],
        improvements: ['Brak dokładnego czasu przestoju'],
        exemplaryResponse:
          'Podczas migracji klastra AKS w Enterprise Cloud zdiagnozowałem błąd konfiguracji Ingressu. Wdrożyłem automatyczny rollback w Terraformie w 4 minuty, unikając przestoju dla 50 tys. użytkowników.',
      };

      vi.spyOn(geminiClientModule, 'generateWithUsage').mockResolvedValueOnce({
        text: JSON.stringify(mockEvaluationResponse),
        usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300, totalTokenCount: 800 },
      });

      const result = await evaluateStarAnswerWithAi({
        question: 'Opowiedz o najtrudniejszej awarii, którą rozwiązałeś.',
        answer: 'Gdy padł klaster produkcyjny, natychmiast zalogowałem się do konsoli Azure i cofnąłem deployment. Przywróciłem działanie w 4 minuty.',
        targetRole: 'Senior Cloud Architect',
        vault: mockVault,
      });

      expect(result.evaluation.overallScore).toBe(8);
      expect(result.evaluation.verdict).toBe('SOLID');
      expect(result.evaluation.starBreakdown.action.score).toBe(9);
      expect(result.evaluation.exemplaryResponse).toContain('Enterprise Cloud');
    });

    it('rzuca błąd gdy treść odpowiedzi jest pusta', async () => {
      await expect(
        evaluateStarAnswerWithAi({
          question: 'Pytanie testowe',
          answer: '   ',
        })
      ).rejects.toThrow('Brak treści odpowiedzi');
    });
  });
});
