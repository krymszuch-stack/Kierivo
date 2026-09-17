import { describe, it, expect } from 'vitest';
import {
  mapStatusToSimplified,
  matchesStatusFilter,
  getPipelineFilters,
  STATUS_TOOLTIPS,
} from '../trackerStatusConfig';
import { JobApplication } from '../../../types';

describe('trackerStatusConfig', () => {
  it('mapuje 5 statusów domenowych na 4 stany uproszczone', () => {
    expect(mapStatusToSimplified('Do wysłania')).toBe('Do wysłania');
    expect(mapStatusToSimplified('Wysłana')).toBe('Wysłana');
    expect(mapStatusToSimplified('Rozmowa')).toBe('W toku');
    expect(mapStatusToSimplified('Oferta')).toBe('Zakończone');
    expect(mapStatusToSimplified('Odrzucona')).toBe('Zakończone');
  });

  it('każdy status oraz grupa posiada zrozumiały opis w tooltipie', () => {
    const keys = [
      'ALL',
      'Do wysłania',
      'Wysłana',
      'Rozmowa',
      'Oferta',
      'Odrzucona',
      'W toku',
      'Zakończone',
    ] as const;

    for (const key of keys) {
      const tooltip = STATUS_TOOLTIPS[key];
      expect(tooltip).toBeDefined();
      expect(typeof tooltip).toBe('string');
      expect(tooltip.trim().length).toBeGreaterThan(15);
    }
  });

  const sampleApps: JobApplication[] = [
    {
      id: 'app-1',
      company: 'Alpha Corp',
      position: 'Frontend Dev',
      status: 'Do wysłania',
      date: '2026-09-01',
      salary: '18 000 PLN',
    },
    {
      id: 'app-2',
      company: 'Beta Sp. z o.o.',
      position: 'React Engineer',
      status: 'Wysłana',
      date: '2026-09-02',
      salary: '20 000 PLN',
    },
    {
      id: 'app-3',
      company: 'Gamma Tech',
      position: 'Fullstack Dev',
      status: 'Rozmowa',
      date: '2026-09-03',
      salary: '22 000 PLN',
    },
    {
      id: 'app-4',
      company: 'Delta Labs',
      position: 'UI Lead',
      status: 'Oferta',
      date: '2026-09-04',
      salary: '25 000 PLN',
    },
    {
      id: 'app-5',
      company: 'Epsilon Software',
      position: 'Architect',
      status: 'Odrzucona',
      date: '2026-09-05',
      salary: '28 000 PLN',
    },
  ];

  describe('getPipelineFilters', () => {
    it('w trybie domyślnym/uproszczonym zwraca 4 główne statusy + Wszystkie', () => {
      const filters = getPipelineFilters(sampleApps, false);
      expect(filters).toHaveLength(5);

      const labels = filters.map((f) => f.label);
      expect(labels).toEqual(['Wszystkie', 'Do wysłania', 'Wysłane', 'W toku', 'Zakończone']);

      expect(filters.find((f) => f.id === 'ALL')?.count).toBe(5);
      expect(filters.find((f) => f.id === 'Do wysłania')?.count).toBe(1);
      expect(filters.find((f) => f.id === 'Wysłana')?.count).toBe(1);
      expect(filters.find((f) => f.id === 'W toku')?.count).toBe(1);
      // Oferta (1) + Odrzucona (1) = 2 w Zakończone
      expect(filters.find((f) => f.id === 'Zakończone')?.count).toBe(2);

      // Każdy filtr ma przypisany tooltip
      filters.forEach((f) => {
        expect(f.tooltip).toBeTruthy();
      });
    });

    it('w trybie zaawansowanym zwraca pełne granularne rozbicie', () => {
      const filters = getPipelineFilters(sampleApps, true);
      expect(filters).toHaveLength(6);

      const labels = filters.map((f) => f.label);
      expect(labels).toEqual(['Wszystkie', 'Do wysłania', 'Wysłane', 'Rozmowy', 'Oferty', 'Odrzucone']);

      expect(filters.find((f) => f.id === 'Rozmowa')?.count).toBe(1);
      expect(filters.find((f) => f.id === 'Oferta')?.count).toBe(1);
      expect(filters.find((f) => f.id === 'Odrzucona')?.count).toBe(1);
    });
  });

  describe('matchesStatusFilter', () => {
    it('w trybie uproszczonym filtruje wg 4 zredukowanych grup', () => {
      expect(matchesStatusFilter('Do wysłania', 'Do wysłania', false)).toBe(true);
      expect(matchesStatusFilter('Wysłana', 'Do wysłania', false)).toBe(false);

      expect(matchesStatusFilter('Wysłana', 'Wysłana', false)).toBe(true);

      expect(matchesStatusFilter('Rozmowa', 'W toku', false)).toBe(true);
      expect(matchesStatusFilter('Wysłana', 'W toku', false)).toBe(false);

      expect(matchesStatusFilter('Oferta', 'Zakończone', false)).toBe(true);
      expect(matchesStatusFilter('Odrzucona', 'Zakończone', false)).toBe(true);
      expect(matchesStatusFilter('Rozmowa', 'Zakończone', false)).toBe(false);

      expect(matchesStatusFilter('Rozmowa', 'ALL', false)).toBe(true);
    });

    it('w trybie zaawansowanym filtruje ściśle wg dokładnego statusu', () => {
      expect(matchesStatusFilter('Rozmowa', 'Rozmowa', true)).toBe(true);
      expect(matchesStatusFilter('Oferta', 'Oferta', true)).toBe(true);
      expect(matchesStatusFilter('Oferta', 'Odrzucona', true)).toBe(false);
      expect(matchesStatusFilter('Odrzucona', 'Odrzucona', true)).toBe(true);
    });
  });
});
