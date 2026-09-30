import { MasterVault } from '../types';
import { createEmptyVault } from './sampleVault';
import { migrateAnonymousCVLibrary } from './cvLibraryStorage';
import {
  StorageKeys,
  readJson,
  readRaw,
  removeRaw,
  applicationsKeyFor,
  cvLibraryKeyFor,
  listStorageKeys,
  vaultKeyFor,
  wipeAppStorageDurably,
  writeJson,
  writeJsonDurably,
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
  /** Wersja schematu danych encji (liczba całkowita, np. 1). */
  schemaVersion?: number;
  id: string;
  name: string;
  /** Opcjonalny — profil lokalny nie wymaga adresu e-mail do niczego. */
  email?: string;
  createdAt?: string;
  updatedAt?: string;
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

function readSavedProfileIndex(): LocalProfile[] {
  const saved = readJson<unknown>(StorageKeys.localProfiles, []);
  if (!Array.isArray(saved)) return [];
  return saved.filter((item): item is LocalProfile => (
    typeof item === 'object' && item !== null &&
    'id' in item && typeof item.id === 'string' && item.id.startsWith('local-') &&
    'name' in item && typeof item.name === 'string' &&
    (!('createdAt' in item) || typeof item.createdAt === 'string' || item.createdAt === undefined)
  ));
}

async function rememberLocalProfile(profile: LocalProfile): Promise<boolean> {
  const profiles = readSavedProfileIndex().filter((item) => item.id !== profile.id);
  return writeJsonDurably(StorageKeys.localProfiles, [...profiles, profile]);
}

/** Zwraca zapisane lokalne CV, które można wznowić; odzyskuje też starsze vaulty bez indeksu. */
export async function listSavedLocalProfiles(): Promise<LocalProfile[]> {
  const profiles = new Map(readSavedProfileIndex().map((profile) => [profile.id, profile]));
  const prefix = `${StorageKeys.vault}:`;
  const vaultKeys = await listStorageKeys(prefix);

  for (const key of vaultKeys) {
    const id = key.slice(prefix.length);
    if (!id.startsWith('local-') || profiles.has(id)) continue;
    const vault = loadProfileVault(id);
    if (!vault) continue;
    profiles.set(id, {
      id,
      name: vault.personalInfo.fullName || 'Profil lokalny',
      ...(vault.personalInfo.email ? { email: vault.personalInfo.email } : {}),
    });
  }

  const resumable = [...profiles.values()].filter((profile) => loadProfileVault(profile.id) !== null);
  writeJson(StorageKeys.localProfiles, resumable);
  return resumable.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

/** Wznawia jawnie wybrany profil lokalny; samo podanie nazwy nie może wybrać cudzej kopii. */
export function activateLocalProfile(profileId: string): { profile: LocalProfile; vault: MasterVault } | null {
  const profile = readSavedProfileIndex().find((candidate) => candidate.id === profileId);
  if (!profile) return null;
  const vault = loadProfileVault(profile.id);
  if (!vault) return null;
  writeJson(StorageKeys.profile, profile);
  return { profile, vault };
}

/**
 * Zakłada profil w tej przeglądarce. Nie ma tu weryfikacji, bo nie ma czego
 * weryfikować — i właśnie dlatego funkcja nie nazywa się `login`.
 */
export async function createLocalProfile(
  name: string,
  email?: string
): Promise<{ profile: LocalProfile; vault: MasterVault }> {
  const trimmedName = name.trim();
  const trimmedEmail = email?.trim();

  const now = new Date().toISOString();
  const profile: LocalProfile = {
    schemaVersion: 1,
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: trimmedName,
    ...(trimmedEmail ? { email: trimmedEmail } : {}),
    createdAt: now,
    updatedAt: now,
  };

  const carriedOver = loadProfileVault(ANONYMOUS_PROFILE_ID);
  const anonymousVaultKey = vaultKeyFor(ANONYMOUS_PROFILE_ID);
  const anonymousApplicationsKey = applicationsKeyFor(ANONYMOUS_PROFILE_ID);
  const anonymousLibraryKey = cvLibraryKeyFor(ANONYMOUS_PROFILE_ID);
  const anonymousApplications = readRaw(anonymousApplicationsKey);
  const stagedTargetKeys: string[] = [];

  try {
    // Nie usuwaj źródeł, dopóki każda kopia nie zostanie potwierdzona przez
    // localStorage albo zatwierdzoną transakcję IndexedDB. Zwykły zapis ma
    // kontrakt „najlepsza próba”; migracja źródłowych CV wymaga potwierdzenia.
    if (carriedOver) {
      if (!(await writeJsonDurably(vaultKeyFor(profile.id), carriedOver))) throw new Error('vault');
      stagedTargetKeys.push(vaultKeyFor(profile.id));
    }

    if (anonymousApplications !== null) {
      const applications = readJson(applicationsKeyFor(ANONYMOUS_PROFILE_ID), []);
      if (!(await writeJsonDurably(applicationsKeyFor(profile.id), applications))) throw new Error('applications');
      stagedTargetKeys.push(applicationsKeyFor(profile.id));
    }

    const libraryTargetKey = cvLibraryKeyFor(profile.id);
    const libraryCopied = await migrateAnonymousCVLibrary(ANONYMOUS_PROFILE_ID, profile.id, false);
    if (!libraryCopied) throw new Error('library');
    if (readRaw(anonymousLibraryKey) !== null) stagedTargetKeys.push(libraryTargetKey);

    if (!(await rememberLocalProfile(profile))) throw new Error('profile-index');
    if (!(await writeJsonDurably(StorageKeys.profile, profile))) throw new Error('active-profile');
  } catch {
    stagedTargetKeys.forEach(removeRaw);
    throw new Error('Nie udało się trwale zapisać danych nowego profilu. Dane źródłowe pozostawiono bez zmian; zwolnij miejsce i spróbuj ponownie.');
  }

  // Wszystkie cele są już trwale zapisane. Teraz można skasować przejściowe
  // źródła bez ryzyka, że odświeżenie odtworzy pusty profil.
  if (carriedOver) removeRaw(anonymousVaultKey);
  if (anonymousApplications !== null) removeRaw(anonymousApplicationsKey);
  removeRaw(anonymousLibraryKey);

  const vault = carriedOver ?? createEmptyVault(trimmedName, trimmedEmail);
  return { profile, vault };
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
export function deleteLocalProfile(): Promise<boolean> {
  return wipeAppStorageDurably();
}
