import { describe, it, expect } from 'vitest';
import {
  CAREER_GOALS,
  EXPERIENCE_YEARS_OPTIONS,
  INDEPENDENCE_OPTIONS,
  resolveSeniorityFromCareerModel,
  careerGoalTitle,
} from '../../../data/careerGoals';
import { createEmptyVault } from '../../../lib/sampleVault';
import type { ProfilerState } from '../../../types';

describe('Inkluzywny model celów zawodowych w preferencjach profilu', () => {
  it('zawiera 6 celów zawodowych bez żargonu korporacyjnego', () => {
    expect(CAREER_GOALS).toHaveLength(6);

    const goalIds = CAREER_GOALS.map((g) => g.id);
    expect(goalIds).toEqual([
      'FIRST_JOB',
      'EXPERIENCED_ROLE',
      'MORE_RESPONSIBLE',
      'CAREER_CHANGE',
      'SIDE_OR_CASUAL',
      'UNDECIDED',
    ]);

    // Sprawdzenie, że tytuły nie używają Junior/Mid/Senior
    CAREER_GOALS.forEach((goal) => {
      expect(goal.title).not.toMatch(/junior|mid|senior|lead/i);
      expect(goal.description).not.toMatch(/junior|mid|senior|lead/i);
      expect(goal.title.length).toBeGreaterThan(5);
      expect(goal.description.length).toBeGreaterThan(15);
    });

    expect(careerGoalTitle('FIRST_JOB')).toBe('Pierwsza praca lub start w zawodzie');
    expect(careerGoalTitle('EXPERIENCED_ROLE')).toBe('Praca zgodna z moim doświadczeniem');
    expect(careerGoalTitle('MORE_RESPONSIBLE')).toBe('Bardziej odpowiedzialna praca');
    expect(careerGoalTitle('CAREER_CHANGE')).toBe('Zmiana zawodu lub branży');
    expect(careerGoalTitle('SIDE_OR_CASUAL')).toBe('Praca dodatkowa lub dorywcza');
    expect(careerGoalTitle('UNDECIDED')).toBe('Nie wiem jeszcze');
  });

  it('udostępnia osobne opcje dla stażu pracy i poziomu samodzielności', () => {
    expect(EXPERIENCE_YEARS_OPTIONS).toHaveLength(4);
    expect(EXPERIENCE_YEARS_OPTIONS.map((o) => o.id)).toEqual([
      'NONE',
      'UP_TO_2',
      '2_TO_5',
      'OVER_5',
    ]);

    expect(INDEPENDENCE_OPTIONS).toHaveLength(3);
    expect(INDEPENDENCE_OPTIONS.map((o) => o.id)).toEqual([
      'TRAINEE',
      'AUTONOMOUS',
      'COORDINATOR',
    ]);
  });

  it('automatycznie wylicza wewnętrzny techniczny poziom ATS na podstawie celu i stażu', () => {
    // 1. Pierwsza praca -> ENTRY
    expect(
      resolveSeniorityFromCareerModel({
        careerGoal: 'FIRST_JOB',
        experienceYears: 'NONE',
        independenceLevel: 'TRAINEE',
      })
    ).toBe('ENTRY');

    // 2. Zmiana zawodu / branży -> PIVOT
    expect(
      resolveSeniorityFromCareerModel({
        careerGoal: 'CAREER_CHANGE',
        experienceYears: 'OVER_5',
      })
    ).toBe('PIVOT');

    // 3. Gotowość do zmiany branży (checkbox) -> PIVOT
    expect(
      resolveSeniorityFromCareerModel({
        careerGoal: 'EXPERIENCED_ROLE',
        industryChangeReady: true,
      })
    ).toBe('PIVOT');

    // 4. Bardziej odpowiedzialna praca -> SENIOR
    expect(
      resolveSeniorityFromCareerModel({
        careerGoal: 'MORE_RESPONSIBLE',
        experienceYears: '2_TO_5',
      })
    ).toBe('SENIOR');

    // 5. Rola koordynatora / wspierania innych -> SENIOR
    expect(
      resolveSeniorityFromCareerModel({
        careerGoal: 'EXPERIENCED_ROLE',
        independenceLevel: 'COORDINATOR',
      })
    ).toBe('SENIOR');

    // 6. Ponad 5 lat stażu -> SENIOR
    expect(
      resolveSeniorityFromCareerModel({
        careerGoal: 'EXPERIENCED_ROLE',
        experienceYears: 'OVER_5',
        independenceLevel: 'AUTONOMOUS',
      })
    ).toBe('SENIOR');

    // 7. Stabilna praca zgodna z doświadczeniem (2-5 lat) -> MID
    expect(
      resolveSeniorityFromCareerModel({
        careerGoal: 'EXPERIENCED_ROLE',
        experienceYears: '2_TO_5',
        independenceLevel: 'AUTONOMOUS',
      })
    ).toBe('MID');

    // 8. Początkujący z potrzebą wdrożenia -> ENTRY
    expect(
      resolveSeniorityFromCareerModel({
        careerGoal: 'EXPERIENCED_ROLE',
        experienceYears: 'UP_TO_2',
        independenceLevel: 'TRAINEE',
      })
    ).toBe('ENTRY');
  });

  it('respektuje ręczne nadpisanie poziomu technicznego w sekcji zaawansowanej', () => {
    const profilerWithManualOverride: Pick<
      ProfilerState,
      'careerGoal' | 'experienceYears' | 'independenceLevel' | 'industryChangeReady' | 'experienceLevel' | 'autoDetermineSeniority'
    > = {
      careerGoal: 'FIRST_JOB',
      experienceLevel: 'SENIOR',
      autoDetermineSeniority: false,
    };

    const resolved = resolveSeniorityFromCareerModel(profilerWithManualOverride);
    expect(resolved).toBe('SENIOR');
  });

  it('stan profilera w Master Vault zachowuje spójność po migracji i aktualizacji', () => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    expect(vault.profiler.experienceLevel).toBe('MID');

    // Aktualizacja o cel zawodowy
    vault.profiler.careerGoal = 'CAREER_CHANGE';
    vault.profiler.experienceLevel = resolveSeniorityFromCareerModel(vault.profiler);
    expect(vault.profiler.experienceLevel).toBe('PIVOT');
  });
});
