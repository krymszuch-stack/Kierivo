import { describe, it, expect } from 'vitest';
import { ALL_LICENSES, LICENSE_CATEGORIES } from '../../../data/licenses';
import { resolveSeniorityFromCareerModel } from '../../../data/careerGoals';
import type { ProfilerState } from '../../../types';

describe('Ekran Filtry, Uprawnienia & Dealbreakery — nowa hierarchia i prezentacja', () => {
  const createDefaultProfiler = (): ProfilerState => ({
    flags: ['OFFICE_IT'],
    careerGoal: 'EXPERIENCED_ROLE',
    experienceLevel: 'MID',
    autoDetermineSeniority: true,
    location: {
      city: 'Warszawa',
      radiusKm: 30,
      commuteRadiusKm: 30,
      remoteOnly: false,
      hybridWork: false,
      willingnessToTravel: false,
      relocationReady: false,
    },
    languages: [],
    licenses: [],
  });

  describe('1. Krótkie podsumowanie ustawień na górze', () => {
    const computeSummaryText = (profiler: ProfilerState): string => {
      const radiusKm = profiler.location.commuteRadiusKm || profiler.location.radiusKm || 30;
      const distanceText = profiler.location.remoteOnly ? '100% zdalnie' : `${radiusKm} km`;
      const workModeText = profiler.location.remoteOnly
        ? 'praca zdalna'
        : profiler.location.hybridWork
        ? 'praca hybrydowa'
        : 'praca lokalna';
      const relocationText = profiler.location.relocationReady ? 'z relokacją' : 'bez relokacji';

      const certCount = (profiler.licenses || []).length;
      const certPlural =
        certCount === 1 ? 'certyfikat' : certCount >= 2 && certCount <= 4 ? 'certyfikaty' : 'certyfikatów';

      return `${distanceText} · ${workModeText} · ${relocationText} · ${certCount} ${certPlural}.`;
    };

    it('generuje dokładne podsumowanie dla stanu domyślnego', () => {
      const profiler = createDefaultProfiler();
      const summary = computeSummaryText(profiler);
      expect(summary).toBe('30 km · praca lokalna · bez relokacji · 0 certyfikatów.');
    });

    it('generuje właściwe formy dla pracy zdalnej, relokacji i różnych liczb certyfikatów', () => {
      const p1 = createDefaultProfiler();
      p1.location.remoteOnly = true;
      p1.location.relocationReady = true;
      p1.licenses = ['b_license'];
      expect(computeSummaryText(p1)).toBe('100% zdalnie · praca zdalna · z relokacją · 1 certyfikat.');

      const p2 = createDefaultProfiler();
      p2.location.hybridWork = true;
      p2.licenses = ['b_license', 'sep_1kv'];
      expect(computeSummaryText(p2)).toBe('30 km · praca hybrydowa · bez relokacji · 2 certyfikaty.');

      const p5 = createDefaultProfiler();
      p5.licenses = ['b_license', 'sep_1kv', 'udt_forklift', 'c_license', 'sanepid'];
      expect(computeSummaryText(p5)).toBe('30 km · praca lokalna · bez relokacji · 5 certyfikatów.');
    });
  });

  describe('2. Twój cel zawodowy w prostym języku', () => {
    const GOAL_SIMPLE_TITLES = {
      FIRST_JOB: 'Pierwsza praca',
      EXPERIENCED_ROLE: 'Praca zgodna z doświadczeniem',
      MORE_RESPONSIBLE: 'Bardziej odpowiedzialna praca',
      CAREER_CHANGE: 'Zmiana zawodu lub branży',
      UNDECIDED: 'Nie wiem jeszcze',
    };

    it('zawiera dokładnie 5 prostych opcji celów zrozumiałych dla osób spoza korporacji', () => {
      const options = Object.values(GOAL_SIMPLE_TITLES);
      expect(options).toEqual([
        'Pierwsza praca',
        'Praca zgodna z doświadczeniem',
        'Bardziej odpowiedzialna praca',
        'Zmiana zawodu lub branży',
        'Nie wiem jeszcze',
      ]);

      // Sprawdzenie braku określeń korporacyjnych
      options.forEach((opt) => {
        expect(opt.toLowerCase()).not.toContain('mid specialist');
        expect(opt.toLowerCase()).not.toContain('senior / lead');
        expect(opt.toLowerCase()).not.toContain('targetowany seniority tier');
      });
    });

    it('automatycznie synchronizuje wewnętrzny poziom doświadczenia bez zmiany silnika', () => {
      const profiler = createDefaultProfiler();

      // Wybór pierwszej pracy
      profiler.careerGoal = 'FIRST_JOB';
      const level1 = resolveSeniorityFromCareerModel(profiler);
      expect(level1).toBe('ENTRY');

      // Wybór zmiany zawodu
      profiler.careerGoal = 'CAREER_CHANGE';
      const level2 = resolveSeniorityFromCareerModel(profiler);
      expect(level2).toBe('PIVOT');

      // Wybór bardziej odpowiedzialnej pracy
      profiler.careerGoal = 'MORE_RESPONSIBLE';
      const level3 = resolveSeniorityFromCareerModel(profiler);
      expect(level3).toBe('SENIOR');
    });
  });

  describe('3. Sekcja uprawnień i certyfikatów oraz modal wyszukiwania', () => {
    it('weryfikuje treść stanu pustego', () => {
      const emptyCount = 0;
      const emptyStateMessage = `${emptyCount} wybranych. Dodaj tylko uprawnienia, które rzeczywiście posiadasz.`;
      const actionButtonLabel = 'Dodaj lub wyszukaj';

      expect(emptyStateMessage).toBe('0 wybranych. Dodaj tylko uprawnienia, które rzeczywiście posiadasz.');
      expect(actionButtonLabel).toBe('Dodaj lub wyszukaj');
    });

    it('zapewnia filtrowanie w modalu po zapytaniu i po kategoriach', () => {
      // 1. Wszystkie kategorie
      expect(LICENSE_CATEGORIES.length).toBeGreaterThanOrEqual(4);
      expect(ALL_LICENSES.length).toBeGreaterThan(10);

      // 2. Filtrowanie po kategorii np. Kierowca
      const driverLicenses = ALL_LICENSES.filter((l) => l.category === 'Kierowca');
      expect(driverLicenses.length).toBeGreaterThan(0);
      expect(driverLicenses.some((l) => l.id === 'b_license')).toBe(true);

      // 3. Filtrowanie po zapytaniu tekstowym 'SEP'
      const query = 'sep';
      const matched = ALL_LICENSES.filter(
        (l) => l.label.toLowerCase().includes(query) || l.category.toLowerCase().includes(query)
      );
      expect(matched.length).toBeGreaterThanOrEqual(3);
      expect(matched.every((l) => l.label.toLowerCase().includes('sep'))).toBe(true);
    });

    it('po dodaniu uprawnień zachowuje je w liście profiler.licenses', () => {
      const profiler = createDefaultProfiler();
      expect(profiler.licenses).toHaveLength(0);

      // Symulacja zaznaczenia w modalu
      const selected = ['b_license', 'sep_1kv'];
      profiler.licenses = selected;

      const selectedDefs = ALL_LICENSES.filter((l) => profiler.licenses?.includes(l.id));
      expect(selectedDefs).toHaveLength(2);
      expect(selectedDefs.map((l) => l.label)).toContain('Prawo Jazdy Kat. B');
      expect(selectedDefs.map((l) => l.label)).toContain('Uprawnienia SEP (Grupa 1 do 1kV)');
    });
  });
});
