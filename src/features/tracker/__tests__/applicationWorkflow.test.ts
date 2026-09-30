import { beforeEach, describe, expect, it } from 'vitest';
import type { JobApplication, MasterVault } from '../../../types';
import { MemoryStorage } from '../../../lib/__tests__/helpers/memoryStorage';
import {
  loadApplicationsFor,
  saveApplicationsFor,
} from '../../../store/useApplications';
import { getApplicationDisplayInfo, getApplicationSnapshotDisplayInfo } from '../applicationDisplay';
import { calculateApplicationProgress } from '../applicationMetrics';
import { getPipelineFilters, matchesStatusFilter, mapStatusToSimplified } from '../trackerStatusConfig';
import { createApplicationDocumentSnapshot } from '../../../lib/applicationSnapshot';
import { createEmptyVault } from '../../../lib/sampleVault';

describe('Application Tracker - Cykl życia i powiązania modułu aplikacji', () => {
  const profileId = 'test-worker-profile';

  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  });

  it('poprawnie zapisuje, odczytuje i aktualizuje aplikacje w izolowanym profilu', () => {
    const app1: JobApplication = {
      id: 'app-001',
      company: 'Budimex S.A.',
      position: 'Monter instalacji HVAC',
      salary: '7 500 PLN brutto',
      date: '2026-09-30',
      status: 'Do wysłania',
    };

    saveApplicationsFor(profileId, [app1]);
    let stored = loadApplicationsFor(profileId);
    expect(stored).toHaveLength(1);
    expect(stored[0].company).toBe('Budimex S.A.');
    expect(stored[0].status).toBe('Do wysłania');

    // Aktualizacja statusu na Rozmowa z terminem
    const updatedApp: JobApplication = {
      ...stored[0],
      status: 'Rozmowa',
      interviewAt: '2026-10-05T10:00:00.000Z',
    };
    saveApplicationsFor(profileId, [updatedApp]);
    stored = loadApplicationsFor(profileId);
    expect(stored[0].status).toBe('Rozmowa');
    expect(stored[0].interviewAt).toBe('2026-10-05T10:00:00.000Z');

    // Reguła biznesowa withStatusRules: zmiana na Odrzucona automatycznie czyści interviewAt
    const rejectedApp: JobApplication = {
      ...stored[0],
      status: 'Odrzucona',
    };
    saveApplicationsFor(profileId, [rejectedApp]);
    stored = loadApplicationsFor(profileId);
    expect(stored[0].status).toBe('Odrzucona');
    expect(stored[0].interviewAt).toBeUndefined();
  });

  it('oblicza metryki progresu pipeline (calculateApplicationProgress) zgodnie z regułą 1', () => {
    // Puste aplikacje -> null (brak dzielenia przez 0, zero wymyślonych danych)
    expect(calculateApplicationProgress([])).toEqual({
      percent: null,
      eligibleCount: 0,
      progressedCount: 0,
    });

    // Tylko szkice 'Do wysłania' -> brak wysłanych, percent: null
    expect(calculateApplicationProgress(['Do wysłania', 'Do wysłania'])).toEqual({
      percent: null,
      eligibleCount: 0,
      progressedCount: 0,
    });

    // 2 wysłane, 1 rozmowa, 1 oferta, 1 odrzucona
    // Łącznie kwalifikujących się: 2+1+1+1 = 5
    // Z sukcesem (Rozmowa lub Oferta): 2
    // 2 / 5 = 40%
    const progress = calculateApplicationProgress(['Wysłana', 'Wysłana', 'Rozmowa', 'Oferta', 'Odrzucona', 'Do wysłania']);
    expect(progress.eligibleCount).toBe(5);
    expect(progress.progressedCount).toBe(2);
    expect(progress.percent).toBe(40);
  });

  it('prawidłowo formatuje etykiety aplikacji i snaphotu (applicationDisplay)', () => {
    const rawApp: JobApplication = {
      id: 'app-002',
      company: '',
      position: '',
      salary: '',
      date: '2026-09-30',
      status: 'Wysłana',
    };

    // Brak danych firmy i stanowiska
    const displayEmpty = getApplicationDisplayInfo(rawApp);
    expect(displayEmpty.companyLabel).toBe('Nie podano firmy');
    expect(displayEmpty.positionLabel).toBe('Nie podano stanowiska');
    expect(displayEmpty.initial).toBe('?');

    // Obsługa legacy 'Nieznana firma'
    const legacyApp = { company: 'Nieznana firma', position: 'Magazynier' };
    const displayLegacy = getApplicationDisplayInfo(legacyApp);
    expect(displayLegacy.companyLabel).toBe('Nie podano firmy');
    expect(displayLegacy.positionLabel).toBe('Magazynier');

    // Pełne dane
    const fullApp = { company: 'Volvo Tech', position: 'Spawacz TIG' };
    const displayFull = getApplicationDisplayInfo(fullApp);
    expect(displayFull.companyLabel).toBe('Volvo Tech');
    expect(displayFull.positionLabel).toBe('Spawacz TIG');
    expect(displayFull.contextLabel).toBe('Volvo Tech — Spawacz TIG');
    expect(displayFull.initial).toBe('V');

    // Podgląd ze snapshotu dokumentu
    const appWithSnapshot: JobApplication = {
      ...rawApp,
      documentSnapshot: {
        schemaVersion: 1,
        createdAt: '2026-09-30T12:00:00.000Z',
        jobOfferSnapshot: {
          title: 'Kierownik Bazy Magazynowej',
          company: 'DHL Supply Chain',
        },
        tailoredResume: {} as any,
        vaultSnapshot: {} as any,
      },
    };
    const displaySnapshot = getApplicationSnapshotDisplayInfo(appWithSnapshot);
    expect(displaySnapshot.companyLabel).toBe('DHL Supply Chain');
    expect(displaySnapshot.positionLabel).toBe('Kierownik Bazy Magazynowej');
  });

  it('filtruje statusy w trybie uproszczonym (4 etapy) oraz zaawansowanym (6 stanów)', () => {
    // Mapowanie uproszczone
    expect(mapStatusToSimplified('Do wysłania')).toBe('Do wysłania');
    expect(mapStatusToSimplified('Wysłana')).toBe('Wysłana');
    expect(mapStatusToSimplified('Rozmowa')).toBe('W toku');
    expect(mapStatusToSimplified('Oferta')).toBe('Zakończone');
    expect(mapStatusToSimplified('Odrzucona')).toBe('Zakończone');

    // Dopasowanie filtra: tryb 4 etapów
    expect(matchesStatusFilter('Rozmowa', 'W toku', false)).toBe(true);
    expect(matchesStatusFilter('Oferta', 'Zakończone', false)).toBe(true);
    expect(matchesStatusFilter('Odrzucona', 'Zakończone', false)).toBe(true);
    expect(matchesStatusFilter('Wysłana', 'Zakończone', false)).toBe(false);

    // Dopasowanie filtra: tryb zaawansowany
    expect(matchesStatusFilter('Rozmowa', 'Rozmowa', true)).toBe(true);
    expect(matchesStatusFilter('Rozmowa', 'W toku', true)).toBe(false);
    expect(matchesStatusFilter('Oferta', 'Oferta', true)).toBe(true);

    // Liczniki w filtrach
    const testApps: JobApplication[] = [
      { id: '1', company: 'A', position: 'X', salary: '', date: '', status: 'Do wysłania' },
      { id: '2', company: 'B', position: 'Y', salary: '', date: '', status: 'Wysłana' },
      { id: '3', company: 'C', position: 'Z', salary: '', date: '', status: 'Rozmowa' },
      { id: '4', company: 'D', position: 'W', salary: '', date: '', status: 'Oferta' },
      { id: '5', company: 'E', position: 'V', salary: '', date: '', status: 'Odrzucona' },
    ];

    const simplifiedFilters = getPipelineFilters(testApps, false);
    expect(simplifiedFilters.map((f) => [f.id, f.count])).toEqual([
      ['ALL', 5],
      ['Do wysłania', 1],
      ['Wysłana', 1],
      ['W toku', 1],
      ['Zakończone', 2],
    ]);

    const advancedFilters = getPipelineFilters(testApps, true);
    expect(advancedFilters.map((f) => [f.id, f.count])).toEqual([
      ['ALL', 5],
      ['Do wysłania', 1],
      ['Wysłana', 1],
      ['Rozmowa', 1],
      ['Oferta', 1],
      ['Odrzucona', 1],
    ]);
  });

  it('integruje snapshot z MasterVault bez mutacji profilu bazowego', () => {
    const vault: MasterVault = createEmptyVault('Adam Nowak', 'adam@example.com');
    vault.personalInfo.title = 'Elektryk budowlany';
    vault.history = [
      {
        id: 'hist-1',
        company: 'Elektro-Instal',
        role: 'Elektryk',
        location: 'Warszawa',
        isCurrent: false,
        startDate: '2021-01',
        endDate: '2024-01',
        highlights: [
          {
            id: 'hl-1',
            text: 'Pomiary odbiorcze instalacji',
            action: 'Pomiary',
            target: 'instalacji',
            tool: 'Miernik',
            metric: '100%',
            keywords: ['pomiary'],
          },
        ],
      },
    ];

    const snapshot = createApplicationDocumentSnapshot({
      vault,
      tailoredResume: {
        targetJobTitle: 'Elektromonter',
        companyName: 'Strabag',
        summary: 'Doświadczony monter',
        selectedHighlights: [
          {
            experienceId: 'hist-1',
            role: 'Elektryk',
            company: 'Elektro-Instal',
            originalText: 'Pomiary odbiorcze instalacji',
            optimizedText: 'Pomiary odbiorcze instalacji 230/400V',
            source: 'SLOT_FILLING',
            keywordsMatched: ['pomiary'],
          },
        ],
        skillsMatched: { hardSkills: ['SEP E1'], toolsAndTech: [], softSkills: [] },
        atsScore: 88,
      },
      jobOffer: {
        id: 'offer-1',
        title: 'Elektromonter',
        company: 'Strabag',
        salary: '8 000 PLN',
      },
    });

    // Modyfikacja bieżącego vaulta nie wpływa na utrwalony snapshot
    vault.personalInfo.title = 'Główny Inżynier Budowy';
    vault.history[0].company = 'Inna Firma';

    expect(snapshot.vaultSnapshot.personalInfo.title).toBe('Elektryk budowlany');
    expect(snapshot.vaultSnapshot.history[0].company).toBe('Elektro-Instal');
    expect(snapshot.tailoredResume.selectedHighlights[0].experienceId).toBe('hist-1');
  });
});
