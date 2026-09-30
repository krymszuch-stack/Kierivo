import { MasterVault } from '../types';

/**
 * Ile z profilu jest naprawdę wypełnione.
 *
 * Liczba jest potrzebna silnikowi „następnego kroku" (`nextAction.ts`), który
 * na jej podstawie decyduje, czy kazać użytkownikowi uzupełnić profil, czy
 * puścić go dalej. Dlatego stoi tutaj, a nie w komponencie: ten sam pomiar
 * czyta pasek postępu w interfejsie i reguła priorytetowa, a dwie kopie
 * rozjechałyby się przy pierwszej zmianie progu.
 *
 * **To jest pomiar pokrycia, nie ocena jakości.** Mówi wyłącznie, które sekcje
 * mają jakąkolwiek treść. Nie udaje, że wie, czy opis doświadczenia jest dobry
 * — od tego są `atsScorer` i `consistencyGuard`, które patrzą na zawartość.
 *
 * Wagi nie są pomiarem, tylko decyzją produktową: mówią, jak bardzo brak danej
 * sekcji blokuje resztę aplikacji. Każda ma przy sobie powód, żeby dało się ją
 * podważyć argumentem, a nie tylko przeczuciem.
 */

export type VaultSectionId =
  | 'identity'
  | 'headline'
  | 'experience'
  | 'hardSkills'
  | 'tools'
  | 'education'
  | 'evidence'
  | 'preferences';

export interface VaultSectionSpec {
  id: VaultSectionId;
  /** Nazwa dla użytkownika — trafia wprost do komunikatu „uzupełnij X". */
  label: string;
  /** Waga = jak mocno brak tej sekcji blokuje resztę aplikacji. */
  weight: number;
  /** Co konkretnie się psuje, gdy sekcja jest pusta. */
  blocks: string;
  isFilled: (vault: MasterVault) => boolean;
}

const hasText = (value: string | undefined | null): boolean => Boolean(value && value.trim());

/**
 * Kolejność w tablicy nie ma znaczenia — o priorytecie podpowiedzi decyduje
 * waga. Trzymana jest mimo to od najbardziej podstawowej sekcji do najbardziej
 * uzupełniającej, żeby czytało się jak formularz.
 */
export const VAULT_SECTIONS: readonly VaultSectionSpec[] = [
  {
    id: 'identity',
    label: 'Dane kontaktowe',
    weight: 1,
    blocks: 'Nagłówek każdego wygenerowanego CV i listu.',
    isFilled: (v) => hasText(v.personalInfo.fullName) && hasText(v.personalInfo.email),
  },
  {
    id: 'headline',
    label: 'Tytuł zawodowy i podsumowanie',
    weight: 1,
    blocks: 'Dopasowanie tytułu do ogłoszenia — osobny składnik oceny Kierivo.',
    isFilled: (v) => hasText(v.personalInfo.title) && hasText(v.personalInfo.summary),
  },
  {
    id: 'experience',
    label: 'Doświadczenie zawodowe',
    weight: 3,
    blocks: 'Rdzeń CV, punkty STAR i cała sekcja treningu przed rozmową.',
    // Sam wpis o firmie to za mało: generator układa treść z `highlights`,
    // więc doświadczenie bez ani jednego punktu nie daje się przetworzyć
    // na nic, co trafi do dokumentu.
    isFilled: (v) => v.history.some((job) => job.highlights.length > 0),
  },
  {
    id: 'hardSkills',
    label: 'Umiejętności twarde',
    weight: 2,
    blocks: 'Pokrycie słów kluczowych — składnik o największej wadze w ocenie Kierivo.',
    isFilled: (v) => v.skillsMatrix.hardSkills.length > 0,
  },
  {
    id: 'tools',
    label: 'Narzędzia i technologie',
    weight: 1,
    blocks: 'Druga połowa dopasowania słów kluczowych.',
    // Dla montera są to narzędzia i sprzęt, nie frameworki. Pole nazywa się
    // „narzędzia i technologie" właśnie dlatego, że domeną tej aplikacji są
    // też prace fizyczne (reguła 8 w `AGENTS.md`).
    isFilled: (v) => v.skillsMatrix.toolsAndTech.length > 0,
  },
  {
    id: 'education',
    label: 'Wykształcenie',
    weight: 1,
    blocks: 'Sekcja wymagana przez większość systemów ATS.',
    isFilled: (v) => v.education.length > 0,
  },
  {
    id: 'evidence',
    label: 'Projekty lub uprawnienia',
    weight: 1,
    blocks: 'Dowody kompetencji — mosty kompetencyjne budują się z nich.',
    // Alternatywa, nie koniunkcja: programista udokumentuje się projektem,
    // elektryk uprawnieniem SEP. Wymaganie obu naraz karałoby jednego i
    // drugiego za to, że pracuje w swojej branży.
    isFilled: (v) => v.projects.length > 0 || v.skillsMatrix.certifications.length > 0,
  },
  {
    id: 'preferences',
    label: 'Filtry i priorytety',
    weight: 1,
    blocks: 'Audyt kryteriów zerojedynkowych — bez nich nie wiadomo, co jest wykluczające.',
    isFilled: (v) => hasText(v.profiler.location.city) || v.profiler.languages.length > 0,
  },
] as const;

const TOTAL_WEIGHT = VAULT_SECTIONS.reduce((sum, section) => sum + section.weight, 0);

export interface VaultCompleteness {
  /** 0–100. Udział wag wypełnionych sekcji w sumie wag wszystkich. */
  percent: number;
  filled: VaultSectionId[];
  missing: VaultSectionId[];
  /**
   * Najcięższa niewypełniona sekcja albo `null`, gdy profil jest kompletny.
   * To ona trafia do komunikatu „uzupełnij…", bo podpowiadanie najlżejszej
   * luki, kiedy brakuje doświadczenia, byłoby marnowaniem uwagi użytkownika.
   */
  weakest: VaultSectionSpec | null;
}

export function measureVaultCompleteness(vault: MasterVault): VaultCompleteness {
  const filled: VaultSectionId[] = [];
  const missing: VaultSectionId[] = [];
  let earned = 0;
  let weakest: VaultSectionSpec | null = null;

  for (const section of VAULT_SECTIONS) {
    if (section.isFilled(vault)) {
      filled.push(section.id);
      earned += section.weight;
      continue;
    }

    missing.push(section.id);

    // Ostre `>` zamiast `>=`: przy równych wagach wygrywa sekcja wcześniejsza
    // w `VAULT_SECTIONS`, czyli ta bardziej podstawowa. Bez tego o kolejności
    // podpowiedzi decydowałby przypadek.
    if (weakest === null || section.weight > weakest.weight) weakest = section;
  }

  return {
    percent: Math.round((earned / TOTAL_WEIGHT) * 100),
    filled,
    missing,
    weakest,
  };
}

/**
 * Profil, w którym nie ma jeszcze nic. Odróżnienie „pusty" od „ledwo zaczęty"
 * jest potrzebne przewodnikowi powitalnemu: kto wpisał choć jedno pole, ten nie
 * jest już nowy i instrukcja na pół ekranu tylko mu przeszkadza.
 */
export function isVaultEmpty(vault: MasterVault): boolean {
  return measureVaultCompleteness(vault).filled.length === 0;
}
