import { CareerGoal, ExperienceYears, IndependenceLevel, ExperienceLevel, ProfilerState } from '../types';

export interface CareerGoalConfig {
  id: CareerGoal;
  title: string;
  description: string;
  defaultSeniority: ExperienceLevel;
  defaultIndependence: IndependenceLevel;
}

export const CAREER_GOALS: CareerGoalConfig[] = [
  {
    id: 'FIRST_JOB',
    title: 'Pierwsza praca lub start w zawodzie',
    description: 'Wchodzisz na rynek pracy, szukasz stażu lub pierwszego zatrudnienia w nowym kierunku.',
    defaultSeniority: 'ENTRY',
    defaultIndependence: 'TRAINEE',
  },
  {
    id: 'EXPERIENCED_ROLE',
    title: 'Praca zgodna z moim doświadczeniem',
    description: 'Robisz to, co znasz, i chcesz kontynuować pracę na podobnym, stabilnym stanowisku.',
    defaultSeniority: 'MID',
    defaultIndependence: 'AUTONOMOUS',
  },
  {
    id: 'MORE_RESPONSIBLE',
    title: 'Bardziej odpowiedzialna praca',
    description: 'Chcesz koordynować pracę, kierować zespołem, brygadą lub wziąć większą odpowiedzialność.',
    defaultSeniority: 'SENIOR',
    defaultIndependence: 'COORDINATOR',
  },
  {
    id: 'CAREER_CHANGE',
    title: 'Zmiana zawodu lub branży',
    description: 'Masz już doświadczenie życiowe i zawodowe, ale chcesz zacząć pracę w nowym fachu.',
    defaultSeniority: 'PIVOT',
    defaultIndependence: 'TRAINEE',
  },
  {
    id: 'SIDE_OR_CASUAL',
    title: 'Praca dodatkowa lub dorywcza',
    description: 'Szukasz zajęcia na część etatu, zleceń, pracy na weekendy lub po godzinach.',
    defaultSeniority: 'MID',
    defaultIndependence: 'AUTONOMOUS',
  },
  {
    id: 'UNDECIDED',
    title: 'Nie wiem jeszcze',
    description: 'Chcesz sprawdzić dostępne możliwości i zobaczyć, co najlepiej pasuje do Twoich umiejętności.',
    defaultSeniority: 'MID',
    defaultIndependence: 'AUTONOMOUS',
  },
];

export interface ExperienceYearsOption {
  id: ExperienceYears;
  label: string;
  sublabel: string;
}

export const EXPERIENCE_YEARS_OPTIONS: ExperienceYearsOption[] = [
  { id: 'NONE', label: 'Brak stażu', sublabel: 'Dopiero zaczynam' },
  { id: 'UP_TO_2', label: 'Do 2 lat', sublabel: 'Pierwsze doświadczenia' },
  { id: '2_TO_5', label: '2–5 lat', sublabel: 'Stabilna praktyka' },
  { id: 'OVER_5', label: 'Ponad 5 lat', sublabel: 'Wieloletnie doświadczenie' },
];

export interface IndependenceOption {
  id: IndependenceLevel;
  label: string;
  description: string;
}

export const INDEPENDENCE_OPTIONS: IndependenceOption[] = [
  {
    id: 'TRAINEE',
    label: 'Wdrażam się',
    description: 'Potrzebuję przyuczenia i opieki w pierwszych tygodniach.',
  },
  {
    id: 'AUTONOMOUS',
    label: 'Pracuję samodzielnie',
    description: 'Wykonuję swoje zadania pewnie i bez stałego nadzoru.',
  },
  {
    id: 'COORDINATOR',
    label: 'Koordynuję i wspieram',
    description: 'Mogę prowadzić innych, organizować zadania lub brać pełną odpowiedzialność.',
  },
];

/**
 * Automatyczne określenie technicznego poziomu ATS na podstawie celów i doświadczenia.
 * Trzymane wewnętrznie dla algorytmów bez narzucania korporacyjnego języka użytkownikowi.
 */
export function resolveSeniorityFromCareerModel(
  profiler: Partial<
    Pick<
      ProfilerState,
      'careerGoal' | 'experienceYears' | 'independenceLevel' | 'industryChangeReady' | 'experienceLevel' | 'autoDetermineSeniority'
    >
  >
): ExperienceLevel {
  // Jeśli użytkownik wyłączył automatyczny dobór i ręcznie wybrał poziom, respektujemy to
  if (profiler.autoDetermineSeniority === false && profiler.experienceLevel) {
    return profiler.experienceLevel;
  }

  // Zmiana branży
  if (profiler.careerGoal === 'CAREER_CHANGE' || profiler.industryChangeReady) {
    return 'PIVOT';
  }

  // Pierwsza praca
  if (profiler.careerGoal === 'FIRST_JOB' || profiler.experienceYears === 'NONE') {
    return 'ENTRY';
  }

  // Większa odpowiedzialność lub rola koordynatora
  if (profiler.careerGoal === 'MORE_RESPONSIBLE' || profiler.independenceLevel === 'COORDINATOR') {
    return 'SENIOR';
  }

  // Staż powyżej 5 lat
  if (profiler.experienceYears === 'OVER_5') {
    return 'SENIOR';
  }

  // Do 2 lat stażu z potrzebą przyuczenia
  if (profiler.experienceYears === 'UP_TO_2' && profiler.independenceLevel === 'TRAINEE') {
    return 'ENTRY';
  }

  // Domyślny stabilny poziom dopasowania ofert
  return 'MID';
}

export function getCareerGoalConfig(goal?: CareerGoal): CareerGoalConfig | undefined {
  return CAREER_GOALS.find((g) => g.id === goal);
}

export function careerGoalTitle(goal?: CareerGoal): string {
  return getCareerGoalConfig(goal)?.title ?? 'Wybierz cel zawodowy';
}
