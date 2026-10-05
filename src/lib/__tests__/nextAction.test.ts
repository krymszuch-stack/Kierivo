import { describe, it, expect } from 'vitest';
import { resolveNextAction, NEXT_ACTION_PRIORITY } from '../nextAction';
import { measureVaultCompleteness } from '../vaultCompleteness';
import { createEmptyVault } from '../sampleVault';
import { CANONICAL_ATS_SCORE_PROVENANCE, JobApplication, MasterVault } from '../../types';

/**
 * Testy trzymają się jednej zasady: każda reguła dostaje przypadek, w którym
 * ma zadziałać, i przypadek graniczny, w którym ma **nie** zadziałać. Sama
 * kolejność reguł jest sprawdzana osobno, bo to ona jest tutaj produktem —
 * silnik bez ustalonego priorytetu doradzałby losowo.
 */

const NOW = new Date('2026-05-20T10:00:00.000Z');

/** Profil na tyle wypełniony, żeby reguła „uzupełnij profil" go przepuściła. */
function readyVault(): MasterVault {
  const vault = createEmptyVault('Anna Nowak', 'anna@example.pl');
  vault.personalInfo.title = 'Elektryk';
  vault.personalInfo.summary = 'Dziesięć lat przy instalacjach przemysłowych.';
  vault.history = [
    {
      id: 'job-1',
      company: 'Zakład Energetyczny',
      role: 'Elektryk',
      location: 'Poznań',
      startDate: '2016-01',
      endDate: '',
      isCurrent: true,
      highlights: [
        {
          id: 'h-1',
          text: 'Skróciłem przestoje linii o 18%.',
          action: 'Przebudowałem',
          target: 'rozdzielnicę',
          tool: 'SEP G1',
          metric: '18%',
          keywords: ['SEP', 'rozdzielnica'],
        },
      ],
    },
  ];
  vault.skillsMatrix.hardSkills = ['Instalacje elektryczne', 'Pomiary'];
  vault.skillsMatrix.toolsAndTech = ['Miernik cęgowy'];
  vault.education = [
    {
      id: 'edu-1',
      institution: 'Technikum Elektryczne',
      degree: 'Technik elektryk',
      fieldOfStudy: 'Elektryka',
      startDate: '2011',
      endDate: '2015',
    },
  ];
  vault.skillsMatrix.certifications = [
    { id: 'cert-1', name: 'SEP G1 E', issuer: 'SEP' },
  ];
  vault.profiler.location.city = 'Poznań';
  return vault;
}

function application(overrides: Partial<JobApplication> = {}): JobApplication {
  return {
    id: 'app-1',
    company: 'Elektrobud',
    position: 'Elektryk utrzymania ruchu',
    salary: '',
    // Świeża data, żeby nie wpadła w regułę „aplikacja bez odpowiedzi".
    date: '2026-05-19',
    status: 'Wysłana',
    ...overrides,
  };
}

describe('Silnik następnego kroku', () => {
  describe('reguła 1 — przygotowanie przed rozmową', () => {
    it('wygrywa, gdy rozmowa jest za mniej niż 48 godzin i brakuje przygotowania', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [
          application({ status: 'Rozmowa', interviewAt: '2026-05-21T09:00:00.000Z' }),
        ],
        now: NOW,
      });

      expect(action.actionType).toBe('pre_call_brief');
      expect(action.context.hoursToInterview).toBe(23);
      expect(action.deepLink).toEqual({ tab: 'pipeline', applicationId: 'app-1' });
    });

    it('milczy, gdy przygotowanie jest już odhaczone', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [
          application({
            status: 'Rozmowa',
            interviewAt: '2026-05-21T09:00:00.000Z',
            briefDoneAt: '2026-05-20T08:00:00.000Z',
          }),
        ],
        now: NOW,
      });

      expect(action.actionType).not.toBe('pre_call_brief');
    });

    it('milczy, gdy do rozmowy jest więcej niż 48 godzin', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [
          application({ status: 'Rozmowa', interviewAt: '2026-05-25T09:00:00.000Z' }),
        ],
        now: NOW,
      });

      expect(action.actionType).not.toBe('pre_call_brief');
    });

    it('wybiera rozmowę najbliższą w czasie, a nie pierwszą z listy', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [
          application({ id: 'later', status: 'Rozmowa', interviewAt: '2026-05-21T18:00:00.000Z' }),
          application({ id: 'sooner', status: 'Rozmowa', interviewAt: '2026-05-20T14:00:00.000Z' }),
        ],
        now: NOW,
      });

      expect(action.deepLink.applicationId).toBe('sooner');
    });
  });

  describe('reguła 2 — follow-up po rozmowie', () => {
    it('podpowiada przygotowanie follow-upu, gdy rozmowa się odbyła i nie oznaczono wysłania', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [
          application({ status: 'Rozmowa', interviewAt: '2026-05-19T09:00:00.000Z' }),
        ],
        now: NOW,
      });

      expect(action.actionType).toBe('prepare_followup');
      expect(action.title).toBe('Przygotuj follow-up po rozmowie');
      expect(action.description).toContain('Kierivo nie wysyła jej za Ciebie');
      expect(action.description).toContain('ręcznie oznacz follow-up');
      expect(action.context.company).toBe('Elektrobud');
    });

    it('milczy, gdy follow-up został wysłany', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [
          application({
            status: 'Rozmowa',
            interviewAt: '2026-05-19T09:00:00.000Z',
            debriefSentAt: '2026-05-19T15:00:00.000Z',
          }),
        ],
        now: NOW,
      });

      expect(action.actionType).not.toBe('prepare_followup');
    });

    it('ustępuje rozmowie, która dopiero się odbędzie', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [
          application({ id: 'po', status: 'Rozmowa', interviewAt: '2026-05-19T09:00:00.000Z' }),
          application({ id: 'przed', status: 'Rozmowa', interviewAt: '2026-05-21T09:00:00.000Z' }),
        ],
        now: NOW,
      });

      expect(action.actionType).toBe('pre_call_brief');
      expect(action.deepLink.applicationId).toBe('przed');
    });
  });

  describe('reguła 3 — uzupełnienie profilu', () => {
    it('wskazuje najcięższą brakującą sekcję pustego profilu', () => {
      const action = resolveNextAction({
        vault: createEmptyVault(),
        applications: [],
        now: NOW,
      });

      expect(action.actionType).toBe('complete_vault');
      expect(action.context.weakestSection).toBe('Doświadczenie zawodowe');
      expect(action.deepLink.tab).toBe('profil');
    });

    it('ustępuje rozmowie za dobę, mimo że profil jest pusty', () => {
      const action = resolveNextAction({
        vault: createEmptyVault(),
        applications: [
          application({ status: 'Rozmowa', interviewAt: '2026-05-21T09:00:00.000Z' }),
        ],
        now: NOW,
      });

      expect(action.actionType).toBe('pre_call_brief');
    });
  });

  describe('reguła 4 — brak aplikacji w Pipeline', () => {
    it('prosi o wklejenie oferty, gdy profil gotowy i nie ma aplikacji', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [],
        now: NOW,
      });

      expect(action.actionType).toBe('analyze_job');
      expect(action.title).toBe('Wklej ofertę do analizy');
      expect(action.title).not.toMatch(/pierwsz/i);
      expect(action.deepLink.tab).toBe('aplikuj');
    });
  });

  describe('reguła 5 — poprawa dopasowania ATS', () => {
    it('wskazuje najsłabszą aplikację i najwyżej trzy braki', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [
          application({ id: 'lepsza', atsScore: 65, atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE, atsScoreContext: { calculatedAt: '2026-05-01T12:00:00.000Z', calculationMonth: '2026-05', detectedRequirementCount: 4, profileCompleteness: 86, unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0, scoreContextVersion: 5, careerEvidenceAvailable: true, careerEvidenceVersion: 2 }, missingKeywords: ['UDT'] }),
          application({
            id: 'gorsza',
            atsScore: 41,
            atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
            atsScoreContext: { calculatedAt: '2026-05-01T12:00:00.000Z', calculationMonth: '2026-05', detectedRequirementCount: 4, profileCompleteness: 86, unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0, scoreContextVersion: 5, careerEvidenceAvailable: true, careerEvidenceVersion: 2 },
            missingKeywords: ['SEP G2', 'UDT', 'F-Gaz', 'praca na wysokości'],
          }),
        ],
        now: NOW,
      });

      expect(action.actionType).toBe('improve_ats');
      expect(action.deepLink.applicationId).toBe('gorsza');
      expect(action.context.missingKeywords).toEqual(['SEP G2', 'UDT', 'F-Gaz']);
    });

    it('nie rusza aplikacji bez zmierzonego wyniku', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [application({ atsScore: undefined })],
        now: NOW,
      });

      expect(action.actionType).not.toBe('improve_ats');
    });

    it('nie używa starszej liczby bez kanonicznego źródła wyniku', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [application({ atsScore: 12, missingKeywords: ['Windows'] })],
        now: NOW,
      });

      expect(action.actionType).not.toBe('improve_ats');
    });

    it('nie zaleca poprawiania wyniku o ograniczonej albo nieznanej podstawie', () => {
      const actions = [
        application({
          atsScore: 41,
          atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
          atsScoreContext: { detectedRequirementCount: 1, profileCompleteness: 100, careerEvidenceAvailable: true, careerEvidenceVersion: 2 },
        }),
        application({
          atsScore: 42,
          atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
          atsScoreContext: { detectedRequirementCount: 4, profileCompleteness: 49, careerEvidenceAvailable: true, careerEvidenceVersion: 2 },
        }),
        application({
          atsScore: 43,
          atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
        }),
      ];

      for (const record of actions) {
        const action = resolveNextAction({ vault: readyVault(), applications: [record], now: NOW });
        expect(action.actionType).not.toBe('improve_ats');
      }
    });

    it('nie zaleca poprawy na podstawie liczby obliczonej poprzednimi regułami', () => {
      const action = resolveNextAction({
        vault: readyVault(), now: NOW,
        applications: [application({
          atsScore: 12, atsScoreProvenance: 'canonical-v1', missingKeywords: ['UDT'],
          atsScoreContext: { detectedRequirementCount: 4, profileCompleteness: 86, unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0, scoreContextVersion: 5, careerEvidenceAvailable: true, careerEvidenceVersion: 2 },
        })],
      });
      expect(action.actionType).not.toBe('improve_ats');
    });

    it('nie zaleca poprawy na podstawie oceny z poprzedniego miesiąca', () => {
      const context = {
        detectedRequirementCount: 4, profileCompleteness: 86,
        unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0,
        unconfirmedRequirementCount: 0, scoreContextVersion: 5 as const,
        careerEvidenceAvailable: true, careerEvidenceVersion: 2 as const,
        calculatedAt: '2026-04-20T10:00:00.000Z', calculationMonth: '2026-04',
      };
      const action = resolveNextAction({
        vault: readyVault(), now: NOW,
        applications: [application({ atsScore: 12, atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE, atsScoreContext: context, missingKeywords: ['UDT'] })],
      });
      expect(action.actionType).not.toBe('improve_ats');
    });

    it('nie rusza aplikacji odrzuconej ani zakończonej ofertą', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [
          application({ id: 'odrzucona', status: 'Odrzucona', atsScore: 30 }),
          application({ id: 'oferta', status: 'Oferta', atsScore: 35 }),
        ],
        now: NOW,
      });

      expect(action.actionType).not.toBe('improve_ats');
    });
  });

  describe('reguła 6 — przypomnienie po tygodniu ciszy', () => {
    it('podpowiada kontakt po siedmiu dniach bez odpowiedzi', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [application({ date: '2026-05-10' })],
        now: NOW,
      });

      expect(action.actionType).toBe('follow_up_application');
      expect(action.context.daysSinceApplied).toBe(10);
    });

    it('milczy przed upływem tygodnia', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [application({ date: '2026-05-17' })],
        now: NOW,
      });

      expect(action.actionType).not.toBe('follow_up_application');
    });

    it('wybiera aplikację, przy której cisza trwa najdłużej', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [
          application({ id: 'nowsza', date: '2026-05-11' }),
          application({ id: 'starsza', date: '2026-04-02' }),
        ],
        now: NOW,
      });

      expect(action.deepLink.applicationId).toBe('starsza');
    });
  });

  describe('reguła 7 — zadanie na dziś', () => {
    it('zawsze zwraca krok, gdy nic się nie pali', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [application({ status: 'Oferta' })],
        now: NOW,
      });

      expect(action.actionType).toBe('daily_challenge');
      expect(action.title).not.toBe('');
    });

    it('daje ten sam wynik przez cały dzień i inny nazajutrz', () => {
      const input = { vault: readyVault(), applications: [application({ status: 'Oferta' })] };

      const rano = resolveNextAction({ ...input, now: new Date('2026-05-20T07:00:00') });
      const wieczorem = resolveNextAction({ ...input, now: new Date('2026-05-20T22:00:00') });
      const nazajutrz = resolveNextAction({ ...input, now: new Date('2026-05-21T07:00:00') });

      expect(rano.title).toBe(wieczorem.title);
      expect(nazajutrz.title).not.toBe(rano.title);
    });
  });

  describe('odporność na uszkodzone dane', () => {
    it('pomija wpis z niepoprawną datą rozmowy zamiast się wywrócić', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [application({ status: 'Rozmowa', interviewAt: 'jutro po południu' })],
        now: NOW,
      });

      expect(action.actionType).toBe('daily_challenge');
    });

    it('pomija wpis z pustą datą wysłania', () => {
      const action = resolveNextAction({
        vault: readyVault(),
        applications: [application({ date: '' })],
        now: NOW,
      });

      expect(action.actionType).not.toBe('follow_up_application');
    });
  });

  it('trzyma priorytet reguł zapisany w raporcie strategicznym', () => {
    expect(NEXT_ACTION_PRIORITY).toEqual([
      'pre_call_brief',
      'prepare_followup',
      'complete_vault',
      'analyze_job',
      'improve_ats',
      'follow_up_application',
      'daily_challenge',
    ]);
  });
});

describe('Pomiar kompletności profilu', () => {
  it('pusty profil to zero procent', () => {
    expect(measureVaultCompleteness(createEmptyVault()).percent).toBe(0);
  });

  it('wypełniony profil przekracza próg gotowości', () => {
    expect(measureVaultCompleteness(readyVault()).percent).toBeGreaterThanOrEqual(60);
  });

  it('doświadczenie bez ani jednego punktu nie liczy się jako wypełnione', () => {
    const vault = readyVault();
    vault.history[0].highlights = [];

    expect(measureVaultCompleteness(vault).missing).toContain('experience');
  });

  it('uprawnienie zastępuje projekt — elektryk nie ma portfolio na GitHubie', () => {
    const vault = readyVault();
    vault.projects = [];

    expect(measureVaultCompleteness(vault).missing).not.toContain('evidence');
  });
});
