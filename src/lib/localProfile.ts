import { MasterVault } from '../types';
import { createEmptyVault } from './sampleVault';
import {
  StorageKeys,
  readJson,
  readRaw,
  removeRaw,
  applicationsKeyFor,
  vaultKeyFor,
  wipeAppStorage,
  writeJson,
} from './storage';

/**
 * Profil lokalny — jawny stan przejściowy, zanim wejdzie Supabase Auth.
 *
 * Ten moduł zastąpił `auth.ts`, który udawał system kont: hashował hasła
 * (PBKDF2-SHA1, 1000 iteracji — ~1300× poniżej normy OWASP), trzymał sekrety
 * TOTP obok hasha w localStorage i „szyfrował" vault kluczem `'default_key'`,
 * zapisując obok **drugą, jawną kopię**, którą odczyt i tak preferował. Żadna
 * z tych funkcji nie miała wywołań: jedyny ekran logowania wpuszczał każdego
 * bez sprawdzania czegokolwiek.
 *
 * Zamiast zostawiać atrapę bezpieczeństwa, nazywamy rzecz po imieniu: to jest
 * profil zapisany w tej przeglądarce, bez konta i bez ochrony kryptograficznej.
 * Interfejs mówi to użytkownikowi wprost, a `SECURITY.md` opisuje to samo.
 * Prawdziwe uwierzytelnienie i szyfrowanie w spoczynku wchodzą razem z Supabase.
 */
export interface LocalProfile {
  id: string;
  name: string;
  /** Opcjonalny — profil lokalny nie wymaga adresu e-mail do niczego. */
  email?: string;
  createdAt: string;
}

/**
 * Vault osoby, która nie założyła jeszcze profilu.
 *
 * Klin ATS (`QuickAtsCheck`) działa bez rejestracji i musi mieć gdzie zapisać
 * wynik, zanim ktokolwiek poda imię. Stały identyfikator zamiast osobnego
 * klucza globalnego oznacza jedną ścieżkę zapisu zamiast dwóch — wcześniej były
 * dwie i `App.tsx` pisał w obie naraz przy każdej zmianie.
 */
export const ANONYMOUS_PROFILE_ID = 'anonymous';

export function getActiveProfile(): LocalProfile | null {
  const parsed = readJson<LocalProfile | null>(StorageKeys.profile, null);
  return parsed && typeof parsed.id === 'string' && parsed.id ? parsed : null;
}

/**
 * Zakłada profil w tej przeglądarce. Nie ma tu weryfikacji, bo nie ma czego
 * weryfikować — i właśnie dlatego funkcja nie nazywa się `login`.
 */
export function createLocalProfile(
  name: string,
  email?: string
): { profile: LocalProfile; vault: MasterVault } {
  const trimmedName = name.trim();
  const trimmedEmail = email?.trim();

  const profile: LocalProfile = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmedName,
    ...(trimmedEmail ? { email: trimmedEmail } : {}),
    createdAt: new Date().toISOString(),
  };

  writeJson(StorageKeys.profile, profile);

  // Praca wykonana przed założeniem profilu nie może przepaść w momencie, w
  // którym użytkownik poda imię — to jest dokładnie ta chwila, w której klin
  // ATS ma go przekonać, że warto zostać.
  const carriedOver = loadProfileVault(ANONYMOUS_PROFILE_ID);
  if (carriedOver) {
    saveProfileVault(profile.id, carriedOver);
    removeRaw(vaultKeyFor(ANONYMOUS_PROFILE_ID));
  }

  // Historia utworzona przed podaniem imienia należy do osoby, która właśnie
  // zakłada profil. Przenosimy wyłącznie klucz anonimowy, nigdy dawną wspólną
  // historię — automatyczne przypisanie jej mogłoby ujawnić cudze aplikacje.
  const anonymousApplications = readRaw(applicationsKeyFor(ANONYMOUS_PROFILE_ID));
  if (anonymousApplications !== null) {
    writeJson(applicationsKeyFor(profile.id), readJson(applicationsKeyFor(ANONYMOUS_PROFILE_ID), []));
    removeRaw(applicationsKeyFor(ANONYMOUS_PROFILE_ID));
  }

  if (carriedOver) {
    return { profile, vault: carriedOver };
  }

  const existing = loadProfileVault(profile.id);
  return { profile, vault: existing ?? createEmptyVault(trimmedName, trimmedEmail) };
}

/** Kończy korzystanie z profilu, ale zostawia zapisane dane na urządzeniu. */
export function signOutLocalProfile(): void {
  removeRaw(StorageKeys.profile);
  removeRaw(vaultKeyFor(ANONYMOUS_PROFILE_ID));
}

export function loadProfileVault(profileId: string): MasterVault | null {
  // Przez readJson, nie surowy parse: dostaje kopertę z sumą kontrolną,
  // migracje schematu i transakcyjny powrót do ostatniego poprawnego stanu,
  // gdy odczyt wykaże uszkodzenie pliku profilu.
  return readJson<MasterVault | null>(vaultKeyFor(profileId), null);
}

/**
 * Zapisuje vault w localStorage **czystym tekstem** — i to jest świadoma,
 * opisana decyzja, nie przeoczenie. Poprzednia wersja szyfrowała drugą kopię
 * kluczem `'default_key'` zaszytym w kodzie, co przy modelu zagrożeń „XSS czyta
 * localStorage" nie chroni przed niczym: atakujący, który wykonuje skrypt na
 * stronie, odczyta ten klucz z tego samego bundla. Dwie kopie tych samych
 * danych to była wtedy sama wada, bez żadnej korzyści.
 *
 * Realna ochrona to konto z danymi po stronie serwera — `BACKEND_MODE=cloud`.
 */
export function saveProfileVault(profileId: string, vault: MasterVault): void {
  writeJson(vaultKeyFor(profileId), vault);
}

/**
 * Usuwa profil wraz ze wszystkimi danymi aplikacji z tej przeglądarki.
 *
 * Sprzątanie jest w `storage.ts`, bo tam jest rejestr tego, co aplikacja
 * w ogóle zapisuje. Poprzednia wersja wyliczała klucze ręcznie w tym miejscu
 * i przez to zostawiała za sobą m.in. stan subskrypcji — a „usuń moje dane",
 * które czegoś nie usuwa, jest gorsze niż brak takiej funkcji.
 */
export function deleteLocalProfile(): void {
  wipeAppStorage();
}
