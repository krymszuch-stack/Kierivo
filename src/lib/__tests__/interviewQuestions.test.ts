import { describe, expect, it } from 'vitest';
import {
  PRERECORDED_INTERVIEW_QUESTIONS,
  TOKEN_INJECTED_INTERVIEW_QUESTIONS,
  buildTokenContext,
  getAllInterviewQuestions,
  getInjectedQuestions,
  getPrerecordedQuestions,
  injectTokensIntoQuestion,
} from '../interviewQuestions';
import type { MasterVault } from '../../types';
import type { ParsedJobDescription } from '../jdParser';
import { createEmptyVault } from '../sampleVault';

describe('Baza pytań rekrutacyjnych (35 Prerecorded + 25 Token-Injected)', () => {
  it('zawiera dokładnie 35 wzorcowych pytań prerecorded i 25 pytań z tokenami', () => {
    expect(PRERECORDED_INTERVIEW_QUESTIONS.length).toBe(35);
    expect(TOKEN_INJECTED_INTERVIEW_QUESTIONS.length).toBe(25);

    const all = getAllInterviewQuestions();
    expect(all.totalCount).toBe(60);
    expect(all.prerecordedCount).toBe(35);
    expect(all.injectedCount).toBe(25);
  });

  it('każde pytanie prerecorded ma unikalne ID, cel rekrutera i kompletny przewodnik STAR', () => {
    const ids = new Set<string>();

    for (const q of PRERECORDED_INTERVIEW_QUESTIONS) {
      expect(ids.has(q.id)).toBe(false);
      ids.add(q.id);

      expect(q.question.length).toBeGreaterThan(15);
      expect(q.intent.length).toBeGreaterThan(10);
      expect(q.starHint.situation.length).toBeGreaterThan(5);
      expect(q.starHint.task.length).toBeGreaterThan(5);
      expect(q.starHint.action.length).toBeGreaterThan(5);
      expect(q.starHint.result.length).toBeGreaterThan(5);
      expect(q.recommendedDurationSec).toBe(60);
      expect(q.tags.length).toBeGreaterThan(0);
    }
  });

  it('spełnia Regułę 8: zawiera pytania dla zawodów technicznych i fizycznych (Trade)', () => {
    const tradeQuestions = getPrerecordedQuestions({ category: 'TRADE' });
    expect(tradeQuestions.length).toBeGreaterThanOrEqual(8);

    const specializations = tradeQuestions.map((q) => q.tradeSpecialization).filter(Boolean);
    expect(specializations).toContain('Instalacje & HVAC');
    expect(specializations).toContain('Spawalnictwo & Ślusarstwo');
    expect(specializations).toContain('Elektryka & Automatyka');
    expect(specializations).toContain('Logistyka & Magazyn');
    expect(specializations).toContain('Transport & Spedycja');
    expect(specializations).toContain('Obróbka CNC & Produkcja');
    expect(specializations).toContain('Medycyna & Ochrona Zdrowia');
    expect(specializations).toContain('BHP & Uprawnienia');
  });

  it('poprawnie wstrzykuje tokeny z API / kontekstu do szablonów', () => {
    const question = TOKEN_INJECTED_INTERVIEW_QUESTIONS[0]; // token_q01
    const context = {
      rola: 'Inżynier Spawalnik',
      luka_kompetencyjna: 'metoda TIG 141',
    };

    const injected = injectTokensIntoQuestion(question, context);

    expect(injected.isFullyInjected).toBe(true);
    expect(injected.resolvedQuestion).toContain('Inżynier Spawalnik');
    expect(injected.resolvedQuestion).toContain('metoda TIG 141');
    expect(injected.resolvedQuestion).not.toContain('{{');
  });

  it('używa fallbackQuestion lub wartości domyślnych w przypadku brakujących tokenów', () => {
    const question = TOKEN_INJECTED_INTERVIEW_QUESTIONS[0];
    const emptyContext = {};

    const injected = injectTokensIntoQuestion(question, emptyContext);

    // Question has defaultTokens for rola and luka_kompetencyjna, so it resolves gracefully
    expect(injected.resolvedQuestion.length).toBeGreaterThan(15);
    expect(injected.resolvedQuestion).not.toContain('{{');
  });

  it('ekstrahuje kontekst tokenów z MasterVault i ParsedJobDescription', () => {
    const mockVault: Partial<MasterVault> = {
      personalInfo: {
        fullName: 'Jan Kowalski',
        summary: 'Monter instalacji',
        firstName: 'Jan',
        lastName: 'Kowalski',
        email: 'jan@example.com',
        phone: '123456789',
        location: 'Kraków',
        title: 'Monter Instalacji HVAC',
      },
      history: [
        {
          id: 'exp_1',
          company: 'Termo-Klim Sp. z o.o.',
          role: 'Monter HVAC',
          location: 'Kraków',
          startDate: '2020-01',
          endDate: '2023-12',
          isCurrent: false,
          description: 'Montaż pomp ciepła',
          highlights: [
            {
              id: 'h_1',
              text: 'Zmontowałem 45 kotłów kondensacyjnych',
              action: 'Zmontowałem',
              metric: '45 instalacji bez awarii',
              tool: 'Analizator spalin Testo 300',
              target: 'kotły kondensacyjne i pompy ciepła',
              keywords: ['kotły', 'testo'],
            },
          ],
        },
      ],
    };

    const mockJD: Partial<ParsedJobDescription> = {
      jobTitle: 'Starszy Serwisant HVAC',
      companyName: 'Viessmann Serwis',
      mandatoryRequirements: ['Uprawnienia F-Gaz'],
      toolsAndTech: ['Testo 300', 'Pompy ciepła'],
    };

    const context = buildTokenContext(mockVault, mockJD);

    expect(context.rola).toBe('Starszy Serwisant HVAC');
    expect(context.firma).toBe('Viessmann Serwis');
    expect(context.luka_kompetencyjna).toBe('Uprawnienia F-Gaz');
    expect(context.metryka).toBe('45 instalacji bez awarii');
    expect(context.obiekt).toBe('kotły kondensacyjne i pompy ciepła');

    const injectedList = getInjectedQuestions(context);
    expect(injectedList.length).toBe(25);

    // Sprawdź czy pytanie o lukę kompetencyjną otrzymało F-Gaz
    const q1 = injectedList.find((q) => q.id === 'token_q01');
    expect(q1?.resolvedQuestion).toContain('Starszy Serwisant HVAC');
    expect(q1?.resolvedQuestion).toContain('Uprawnienia F-Gaz');
  });

  it('pobiera firmę, metrykę i rolę z datowanej najnowszej pracy, nie z pierwszej karty', () => {
    const vault = createEmptyVault();
    vault.personalInfo.title = '';
    vault.history = [
      { id: 'old', company: 'Starsza firma', role: 'Magazynier', location: '', startDate: '2018-01', endDate: '2020-12', isCurrent: false, highlights: [{ id: 'old-h', text: 'Starszy wynik', action: '', target: '', tool: 'Stare narzędzie', metric: '8 sztuk', keywords: [] }] },
      { id: 'new', company: 'Nowsza firma', role: 'Technik wsparcia IT', location: '', startDate: '2022-01', endDate: '2024-06', isCurrent: false, highlights: [{ id: 'new-h', text: 'Nowszy wynik', action: '', target: 'stacje robocze', tool: 'Microsoft 365', metric: '120 zgłoszeń', keywords: [] }] },
    ];
    const context = buildTokenContext(vault);

    expect(context).toMatchObject({
      rola: 'Technik wsparcia IT', firma: 'Nowsza firma', metryka: '120 zgłoszeń',
      narzedzie: 'Microsoft 365', obiekt: 'stacje robocze',
    });
  });
});
