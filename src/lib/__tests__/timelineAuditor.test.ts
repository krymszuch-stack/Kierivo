import { describe, it, expect } from 'vitest';
import {
  detectCareerGaps,
  detectOverlappingExperiences,
  detectMissingMetrics,
  auditExperienceTimelineAndMetrics,
  hasMeasurableMetric,
  isRemoteOrFlexibleWork,
  calculateMonthsBetween,
  GOOGLE_XYZ_TEMPLATE,
} from '../consistencyGuard/timelineAuditor';
import { WorkExperience } from '../../types';

describe('TimelineAuditor & Logic Validator', () => {
  describe('calculateMonthsBetween & pomocnicze', () => {
    it('poprawnie oblicza liczbę miesięcy przerwy', () => {
      // 2022-04 do 2022-05 -> 0 miesięcy przerwy
      expect(calculateMonthsBetween({ year: 2022, month: 4 }, { year: 2022, month: 5 })).toBe(0);

      // 2022-04 do 2022-11 -> 6 miesięcy przerwy (maj, czerwiec, lipiec, sierpień, wrzesień, październik)
      expect(calculateMonthsBetween({ year: 2022, month: 4 }, { year: 2022, month: 11 })).toBe(6);

      // 2021-06 do 2022-03 -> 8 miesięcy przerwy
      expect(calculateMonthsBetween({ year: 2021, month: 6 }, { year: 2022, month: 3 })).toBe(8);
    });

    it('rozpoznaje tryb pracy zdalnej, hybrydowej i elastycznej', () => {
      expect(isRemoteOrFlexibleWork('Warszawa (Zdalnie)')).toBe(true);
      expect(isRemoteOrFlexibleWork('Kraków', 'Praca w 100% remote')).toBe(true);
      expect(isRemoteOrFlexibleWork('Wrocław', 'Kontrakt B2B')).toBe(true);
      expect(isRemoteOrFlexibleWork('Gdańsk', 'Praca hybrydowa 2 dni z biura')).toBe(true);
      expect(isRemoteOrFlexibleWork('Poznań', 'Praca stacjonarna w biurze')).toBe(false);
    });
  });

  describe('detectCareerGaps (Wykrywanie luk w zatrudnieniu >= 6 miesięcy)', () => {
    it('wykrywa lukę >= 6 miesięcy i generuje alert CAREER_GAP', () => {
      const history: WorkExperience[] = [
        {
          id: 'exp-1',
          company: 'Firma Alfa',
          role: 'Junior Dev',
          location: 'Warszawa',
          startDate: '2020-01',
          endDate: '2021-06',
          isCurrent: false,
          highlights: [{ id: 'hl-1', text: 'Optymalizacja 25%', metric: '25%', target: '', action: '', tool: '', keywords: [] }],
        },
        {
          id: 'exp-2',
          company: 'Firma Beta',
          role: 'Mid Dev',
          location: 'Warszawa',
          startDate: '2022-03', // Przerwa od lipca 2021 do lutego 2022 włącznie = 8 miesięcy
          endDate: '2023-05',
          isCurrent: false,
          highlights: [{ id: 'hl-2', text: 'Wdrożenie +30% TPS', metric: '+30%', target: '', action: '', tool: '', keywords: [] }],
        },
      ];

      const gaps = detectCareerGaps(history);
      expect(gaps).toHaveLength(1);
      expect(gaps[0].type).toBe('CAREER_GAP');
      expect(gaps[0].severity).toBe('WARNING');
      expect(gaps[0].details?.gapMonths).toBe(8);
      expect(gaps[0].details?.previousCompany).toBe('Firma Alfa');
      expect(gaps[0].details?.nextCompany).toBe('Firma Beta');
    });

    it('nie zgłasza alertu dla przerw krótszych niż 6 miesięcy', () => {
      const history: WorkExperience[] = [
        {
          id: 'exp-1',
          company: 'Firma Alfa',
          role: 'Dev',
          location: 'Warszawa',
          startDate: '2021-01',
          endDate: '2021-06',
          isCurrent: false,
          highlights: [],
        },
        {
          id: 'exp-2',
          company: 'Firma Beta',
          role: 'Dev',
          location: 'Warszawa',
          startDate: '2021-09', // 2 miesiące przerwy
          endDate: '2022-01',
          isCurrent: false,
          highlights: [],
        },
      ];

      const gaps = detectCareerGaps(history);
      expect(gaps).toHaveLength(0);
    });

    it('prawidłowo radzi sobie z wieloma nakładającymi się rolami bez fałszywych luk', () => {
      const history: WorkExperience[] = [
        {
          id: 'exp-1',
          company: 'Firma Główna',
          role: 'Architekt',
          location: 'Warszawa',
          startDate: '2020-01',
          endDate: '2022-12', // Trwa do końca 2022
          isCurrent: false,
          highlights: [],
        },
        {
          id: 'exp-2',
          company: 'Projekt Poboczny',
          role: 'Konsultant',
          location: 'Warszawa (Zdalnie)',
          startDate: '2020-06',
          endDate: '2021-06', // Kończy się wcześniej, ale Firma Główna trwa nadal!
          isCurrent: false,
          highlights: [],
        },
        {
          id: 'exp-3',
          company: 'Firma Nowa',
          role: 'CTO',
          location: 'Warszawa',
          startDate: '2023-02', // Tylko 1 miesiąc po Firmie Głównej
          endDate: '2024-01',
          isCurrent: false,
          highlights: [],
        },
      ];

      const gaps = detectCareerGaps(history);
      expect(gaps).toHaveLength(0);
    });
  });

  describe('detectOverlappingExperiences (Kolizje lokalizacji i nakładanie dat)', () => {
    it('generuje LOCATION_CONFLICT gdy 2 role trwają równolegle w różnych miastach stacjonarnie', () => {
      const history: WorkExperience[] = [
        {
          id: 'exp-1',
          company: 'Szpital Warszawa',
          role: 'Lekarz Dyżurny',
          location: 'Warszawa, ul. Banacha',
          startDate: '2022-01',
          endDate: '2023-01',
          isCurrent: false,
          highlights: [],
        },
        {
          id: 'exp-2',
          company: 'Szpital Gdańsk',
          role: 'Kierownik Oddziału',
          location: 'Gdańsk, ul. Smoluchowskiego',
          startDate: '2022-06',
          endDate: '2023-06',
          isCurrent: false,
          highlights: [],
        },
      ];

      const alerts = detectOverlappingExperiences(history);
      const locationConflict = alerts.find((a) => a.type === 'LOCATION_CONFLICT');
      expect(locationConflict).toBeDefined();
      expect(locationConflict?.severity).toBe('ALERT');
      expect(locationConflict?.message).toContain('Warszawa');
      expect(locationConflict?.message).toContain('Gdańsk');
    });

    it('nie zgłasza LOCATION_CONFLICT jeśli jedno ze stanowisk jest zdalne / B2B', () => {
      const history: WorkExperience[] = [
        {
          id: 'exp-1',
          company: 'Fintech Sp. z o.o.',
          role: 'Backend Dev',
          location: 'Warszawa',
          startDate: '2022-01',
          endDate: '2023-01',
          isCurrent: false,
          highlights: [],
        },
        {
          id: 'exp-2',
          company: 'Startup US',
          role: 'Cloud Architect',
          location: 'Nowy Jork (Zdalnie 100%)',
          startDate: '2022-06',
          endDate: '2023-06',
          isCurrent: false,
          highlights: [],
        },
      ];

      const alerts = detectOverlappingExperiences(history);
      const locationConflict = alerts.find((a) => a.type === 'LOCATION_CONFLICT');
      expect(locationConflict).toBeUndefined();
    });

    it('generuje OVERLAPPING_EXPERIENCE gdy stanowiska nakładają się w tym samym mieście bez wzmianki o kontrakcie', () => {
      const history: WorkExperience[] = [
        {
          id: 'exp-1',
          company: 'Bank A',
          role: 'Programista',
          location: 'Warszawa',
          startDate: '2022-01',
          endDate: '2023-01',
          isCurrent: false,
          highlights: [],
        },
        {
          id: 'exp-2',
          company: 'Bank B',
          role: 'Programista',
          location: 'Warszawa',
          startDate: '2022-06',
          endDate: '2023-06',
          isCurrent: false,
          highlights: [],
        },
      ];

      const alerts = detectOverlappingExperiences(history);
      const overlapAlert = alerts.find((a) => a.type === 'OVERLAPPING_EXPERIENCE');
      expect(overlapAlert).toBeDefined();
      expect(overlapAlert?.severity).toBe('WARNING');
    });
  });

  describe('detectMissingMetrics & Formuła Google X-Y-Z', () => {
    it('hasMeasurableMetric rozpoznaje rozmaite formy metryk', () => {
      expect(hasMeasurableMetric('Wzrost sprzedaży o 35% w Q2')).toBe(true);
      expect(hasMeasurableMetric('Zarządzanie budżetem 150 tys. PLN')).toBe(true);
      expect(hasMeasurableMetric('Optymalizacja czasu ładowania z 5s do 800ms')).toBe(true);
      expect(hasMeasurableMetric('Koordynacja zespołu 12 osób')).toBe(true);
      expect(hasMeasurableMetric('Obsługa ponad 500 klientów dziennie')).toBe(true);
      expect(hasMeasurableMetric('Dbałość o czystość kodu', '+25%')).toBe(true);

      // Opisy czysto deklaratywne bez liczb i metryk
      expect(hasMeasurableMetric('Tworzenie oprogramowania i udział w spotkaniach')).toBe(false);
      expect(hasMeasurableMetric('Współpraca z zespołem i raportowanie do zarządu')).toBe(false);
    });

    it('generuje alert MISSING_METRICS gdy stanowisko nie posiada twardych metryk', () => {
      const history: WorkExperience[] = [
        {
          id: 'exp-puste',
          company: 'Software House',
          role: 'Frontend Developer',
          location: 'Kraków',
          startDate: '2022-01',
          endDate: '2023-01',
          isCurrent: false,
          description: 'Praca w metodyce Scrum, pisanie testów i udział w daily.',
          highlights: [
            {
              id: 'hl-1',
              text: 'Tworzenie komponentów w React i stylowanie interfejsu.',
              metric: '',
              target: '',
              action: '',
              tool: '',
              keywords: [],
            },
          ],
        },
      ];

      const alerts = detectMissingMetrics(history);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('MISSING_METRICS');
      expect(alerts[0].severity).toBe('WARNING');
      expect(alerts[0].details?.suggestedFormula).toBe(GOOGLE_XYZ_TEMPLATE);
    });

    it('nie zgłasza MISSING_METRICS gdy stanowisko posiada choć jedno osiągnięcie z metryką', () => {
      const history: WorkExperience[] = [
        {
          id: 'exp-dobre',
          company: 'E-commerce Corp',
          role: 'Tech Lead',
          location: 'Warszawa',
          startDate: '2022-01',
          endDate: '2023-01',
          isCurrent: false,
          highlights: [
            {
              id: 'hl-1',
              text: 'Skrócenie czasu ładowania strony głównej o 45% (z 3.2s do 1.7s).',
              metric: '-45%',
              target: 'Strona główna',
              action: 'Optymalizacja',
              tool: 'Next.js',
              keywords: ['Next.js'],
            },
          ],
        },
      ];

      const alerts = detectMissingMetrics(history);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('auditExperienceTimelineAndMetrics (Audyt zbiorczy)', () => {
    it('zwraca isHealthy: true gdy brak problemów i zbiera wszystkie alerty', () => {
      const healthyHistory: WorkExperience[] = [
        {
          id: 'exp-1',
          company: 'Firma 1',
          role: 'Dev',
          location: 'Warszawa',
          startDate: '2021-01',
          endDate: '2022-01',
          isCurrent: false,
          highlights: [{ id: 'hl-1', text: '+40% TPS', metric: '+40%', target: '', action: '', tool: '', keywords: [] }],
        },
        {
          id: 'exp-2',
          company: 'Firma 2',
          role: 'Dev',
          location: 'Warszawa',
          startDate: '2022-02',
          endDate: '2023-05',
          isCurrent: false,
          highlights: [{ id: 'hl-2', text: '99.9% SLA', metric: '99.9%', target: '', action: '', tool: '', keywords: [] }],
        },
      ];

      const audit = auditExperienceTimelineAndMetrics(healthyHistory);
      expect(audit.isHealthy).toBe(true);
      expect(audit.alerts).toHaveLength(0);
    });
  });
});
