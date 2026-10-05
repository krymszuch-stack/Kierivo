import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateInterviewQuestionsWithAi,
  evaluateStarAnswerWithAi,
} from '../services/interviewCoach.service';
import * as geminiClientModule from '../geminiClient';
import { createEmptyVault } from '../../lib/sampleVault';
import { buildInterviewCoachProfileContext } from '../../lib/interviewCoachContext';

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
    it('odrzuca nadmiarowy kontekst przed połączeniem z modelem', async () => {
      await expect(generateInterviewQuestionsWithAi({
        targetRole: 'r'.repeat(121),
      })).rejects.toMatchObject({ status: 400, expose: true });
      expect(geminiClientModule.generateWithUsage).not.toHaveBeenCalled();
    });

    it('odrzuca błędny kształt JSON pytań zamiast zwracać dane, które wywrócą widok', async () => {
      vi.spyOn(geminiClientModule, 'generateWithUsage').mockResolvedValueOnce({
        text: JSON.stringify({ questions: [{ id: 'q1', category: 'nieznana', question: 123 }] }),
        usageMetadata: {},
      });

      await expect(generateInterviewQuestionsWithAi({})).rejects.toMatchObject({ status: 502, expose: true });
    });

    it('nie podstawia fikcyjnego stanowiska ani firmy przy pustym profilu', async () => {
      vi.spyOn(geminiClientModule, 'generateWithUsage').mockResolvedValueOnce({
        text: JSON.stringify({ questions: [] }),
        usageMetadata: {},
      });

      await generateInterviewQuestionsWithAi({});

      const prompt = String(vi.mocked(geminiClientModule.generateWithUsage).mock.calls[0][0].contents);
      expect(prompt).toContain('Nie podano stanowiska');
      expect(prompt).toContain('Nie podano firmy');
      expect(prompt).toContain('Nie podano treści ogłoszenia');
      expect(prompt).not.toMatch(/Senior Software Engineer|Firma Rekrutująca|Standardowe wymagania rynkowe/);
    });

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
        profileContext: buildInterviewCoachProfileContext(mockVault),
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
      expect(sentText).not.toContain('Enterprise Cloud');
      expect(sentText).toContain('Nie zakładaj, że kandydat pracuje w IT');
    });
  });

  it('pseudonimizuje niezaufany kontekst i tresc oferty przed wyslaniem', async () => {
    vi.spyOn(geminiClientModule, 'generateWithUsage').mockResolvedValueOnce({
      text: JSON.stringify({ questions: [] }),
      usageMetadata: {},
    });

    await generateInterviewQuestionsWithAi({
      targetRole: 'Technik wsparcia',
      jobDescription: 'Kontakt: rekrutacja@example.invalid, +48 600 700 800.',
      profileContext: {
        hardSkills: ['Kontakt: jan.kowalski@example.invalid'],
        toolsAndTech: ['600 700 800'],
        experience: [],
      },
    });

    const sentText = String(vi.mocked(geminiClientModule.generateWithUsage).mock.calls[0][0].contents);
    expect(sentText).not.toContain('rekrutacja@example.invalid');
    expect(sentText).not.toContain('jan.kowalski@example.invalid');
    expect(sentText).not.toContain('600 700 800');
    expect(sentText).toContain('[EMAIL]');
    expect(sentText).toContain('[TELEFON]');
  });

  describe('evaluateStarAnswerWithAi', () => {
    it('odrzuca zbyt długie pytanie przed połączeniem z modelem', async () => {
      await expect(evaluateStarAnswerWithAi({
        question: 'q'.repeat(1201),
        answer: 'Odpowiedź',
      })).rejects.toMatchObject({ status: 400, expose: true });
      expect(geminiClientModule.generateWithUsage).not.toHaveBeenCalled();
    });

    it('pseudonimizuje tresc odpowiedzi i pytania podane bezposrednio do API', async () => {
      vi.spyOn(geminiClientModule, 'generateWithUsage').mockResolvedValueOnce({
        text: JSON.stringify({
          overallScore: 6,
          verdict: 'SOLID',
          starBreakdown: {
            situation: { score: 6, feedback: 'Sytuacja.' },
            task: { score: 6, feedback: 'Zadanie.' },
            action: { score: 6, feedback: 'Dzialanie.' },
            result: { score: 6, feedback: 'Rezultat.' },
          },
          strengths: ['Konkretna odpowiedz.'],
          improvements: ['Doprecyzuj zakres.'],
          exemplaryResponse: 'Opis przykladowy.',
        }),
        usageMetadata: {},
      });

      await evaluateStarAnswerWithAi({
        question: 'Opisz incydent, kontakt jan.kowalski@example.invalid.',
        answer: 'Telefon do zespolu: +48 600 700 800. Przywrocilem usluge.',
      });

      const sentText = String(vi.mocked(geminiClientModule.generateWithUsage).mock.calls[0][0].contents);
      expect(sentText).not.toContain('jan.kowalski@example.invalid');
      expect(sentText).not.toContain('+48 600 700 800');
      expect(sentText).toContain('[EMAIL]');
      expect(sentText).toContain('[TELEFON]');
    });

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
          'Podczas migracji 50 mikroserwisów do Azure AKS utrzymywałem wskaźnik 99.99% uptime.',
      };

      vi.spyOn(geminiClientModule, 'generateWithUsage').mockResolvedValueOnce({
        text: JSON.stringify(mockEvaluationResponse),
        usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 300, totalTokenCount: 800 },
      });

      const result = await evaluateStarAnswerWithAi({
        question: 'Opowiedz o najtrudniejszej awarii, którą rozwiązałeś.',
        answer: 'Gdy padł klaster produkcyjny, natychmiast zalogowałem się do konsoli Azure i cofnąłem deployment. Przywróciłem działanie w 4 minuty.',
        targetRole: 'Senior Cloud Architect',
      });

      expect(result.evaluation.overallScore).toBe(8);
      expect(result.evaluation.verdict).toBe('EXCELLENT');
      expect(result.evaluation.starBreakdown.action.score).toBe(9);
      expect(result.evaluation.exemplaryResponse).not.toContain('Enterprise Cloud');
      const sentText = String(vi.mocked(geminiClientModule.generateWithUsage).mock.calls[0][0].contents);
      expect(sentText).toContain('Liczby są opcjonalne');
      expect(sentText).toContain('nie dopisuj żadnych faktów');
      expect(sentText).not.toContain('jan@example.com');
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
