import { MasterVault } from '../types';
import { createEmptyVault } from './sampleVault';
import { parseMasterVaultImport } from './masterVaultImportSchema';
import { migrateAnonymousCVLibrary } from './cvLibraryStorage';
import {
  StorageKeys,
  readJson,
  readJsonForMigration,
  readRaw,
  removeRaw,
  removeRawDurably,
  clearProfileStorageDurably,
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
const rejectedVaultProfileIds = new Set<string>();
// Zamknięcie sesji może zakończyć się pomiędzy kolejnymi zapisami migracji.
// Wynik aktywacji ma wersję również dla publikacji stanu po await w React.
let activationVersion = 0;
let closingOperations = 0;

export function invalidateLocalProfileActivation(): void {
  activationVersion += 1;
}

export function isLocalProfileActivationCurrent(version: number): boolean {
  return closingOperations === 0 && version === activationVersion;
}

interface ActivatedLocalProfile {
  profile: LocalProfile;
  vault: MasterVault;
  activationVersion: number;
}

export function hasRejectedProfileVault(profileId: string): boolean {
  return rejectedVaultProfileIds.has(profileId);
}

/** Wywoływane wyłącznie po świadomym zastąpieniu uszkodzonego Vaultu pełnym importem. */
export function acceptProfileVaultReplacement(profileId: string): void {
  rejectedVaultProfileIds.delete(profileId);
}

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
export async function activateLocalProfile(profileId: string): Promise<ActivatedLocalProfile | null> {
  if (closingOperations > 0) return null;
  const version = ++activationVersion;
  const profile = readSavedProfileIndex().find((candidate) => candidate.id === profileId);
  if (!profile) return null;
  const vault = loadProfileVault(profile.id);
  if (!vault) return null;
  if (!(await writeJsonDurably(StorageKeys.profile, profile))) return null;
  if (!isLocalProfileActivationCurrent(version)) return null;
  return { profile, vault, activationVersion: version };
}

/**
 * Zakłada profil w tej przeglądarce. Nie ma tu weryfikacji, bo nie ma czego
 * weryfikować — i właśnie dlatego funkcja nie nazywa się `login`.
 */
export async function createLocalProfile(
  name: string,
  email?: string
): Promise<ActivatedLocalProfile> {
  if (closingOperations > 0) throw new Error('Sesja jest zamykana. Spróbuj ponownie po zakończeniu operacji.');
  const version = ++activationVersion;
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
  const anonymousApplications = readJsonForMigration(anonymousApplicationsKey);
  const anonymousVault = readJsonForMigration(anonymousVaultKey);
  const anonymousLibrary = readJsonForMigration(anonymousLibraryKey);
  const sourceSnapshots = [anonymousVaultKey, anonymousApplicationsKey, anonymousLibraryKey].map(key => ({ key, raw: readRaw(key) }));
  const previousProfile = readJson<LocalProfile | null>(StorageKeys.profile, null);
  const vault = carriedOver ?? createEmptyVault(trimmedName, trimmedEmail);
  const stagedTargetKeys: string[] = [];
  let profileIndexed = false;
  const assertSourcesCurrent = () => {
    if (!isLocalProfileActivationCurrent(version)) throw new Error('session-changed');
    if (sourceSnapshots.some(({ key, raw }) => readRaw(key) !== raw)) throw new Error('source-changed');
  };

  try {
    if (!anonymousApplications.success || !anonymousVault.success || !anonymousLibrary.success ||
        (anonymousLibrary.raw !== null && !Array.isArray(anonymousLibrary.value)) ||
        (anonymousVault.raw !== null && !carriedOver)) throw new Error('source-unreadable');
    // Nie usuwaj źródeł, dopóki każda kopia nie zostanie potwierdzona przez
    // localStorage albo zatwierdzoną transakcję IndexedDB. Zwykły zapis ma
    // kontrakt „najlepsza próba”; migracja źródłowych CV wymaga potwierdzenia.
    // Także pusty profil musi mieć kopię do wznowienia przed aktywacją;
    // późniejszy autosave komponentu nie jest częścią tej transakcji.
    if (!(await writeJsonDurably(vaultKeyFor(profile.id), vault))) throw new Error('vault');
    stagedTargetKeys.push(vaultKeyFor(profile.id));
    assertSourcesCurrent();

    if (anonymousApplications.raw !== null) {
      const applications = anonymousApplications.value;
      if (!(await writeJsonDurably(applicationsKeyFor(profile.id), applications))) throw new Error('applications');
      stagedTargetKeys.push(applicationsKeyFor(profile.id));
    }

    const libraryTargetKey = cvLibraryKeyFor(profile.id);
    const libraryCopied = await migrateAnonymousCVLibrary(ANONYMOUS_PROFILE_ID, profile.id, false);
    if (!libraryCopied) throw new Error('library');
    if (readRaw(anonymousLibraryKey) !== null) stagedTargetKeys.push(libraryTargetKey);

    assertSourcesCurrent();
    if (!(await rememberLocalProfile(profile))) throw new Error('profile-index');
    profileIndexed = true;
    assertSourcesCurrent();
    if (!(await writeJsonDurably(StorageKeys.profile, profile))) throw new Error('active-profile');
    assertSourcesCurrent();
  } catch (error) {
    // Nie zostawiaj indeksu wskazującego usunięte kopie. Przy odmowie rollbacku
    // zachowaj odzyskiwalne cele zamiast tworzyć martwy zapis profilu.
    let reverted = true;
    if (getActiveProfile()?.id === profile.id) {
      if (previousProfile && isLocalProfileActivationCurrent(version)) reverted = await writeJsonDurably(StorageKeys.profile, previousProfile);
      else reverted = await removeRawDurably(StorageKeys.profile);
      reverted = reverted && getActiveProfile()?.id !== profile.id;
    }
    if (profileIndexed && reverted) {
      reverted = await writeJsonDurably(StorageKeys.localProfiles, readSavedProfileIndex().filter(item => item.id !== profile.id));
    }
    if (reverted) stagedTargetKeys.forEach(removeRaw);
    throw new Error(error instanceof Error && error.message === 'session-changed'
      ? 'Sesja zmieniła się podczas tworzenia profilu. Nie otwarto profilu; spróbuj ponownie.'
      : error instanceof Error && error.message === 'source-changed'
      ? 'Dane zmieniły się podczas tworzenia profilu. Zachowano dane źródłowe; spróbuj ponownie.'
      : error instanceof Error && error.message === 'source-unreadable'
        ? 'Nie można odczytać danych zapisanych przed utworzeniem profilu. Zachowano źródła; przywróć poprawną kopię danych.'
      : 'Nie udało się trwale zapisać danych nowego profilu. Zachowano dane źródłowe; sprawdź miejsce na urządzeniu i spróbuj ponownie.', { cause: error });
  }

  // Wszystkie cele są już trwale zapisane. Teraz można skasować przejściowe
  // źródła bez ryzyka, że odświeżenie odtworzy pusty profil.
  if (carriedOver) removeRaw(anonymousVaultKey);
  if (anonymousApplications.raw !== null) removeRaw(anonymousApplicationsKey);
  removeRaw(anonymousLibraryKey);

  return { profile, vault, activationVersion: version };
}

/** Kończy korzystanie z profilu, ale zostawia zapisane dane na urządzeniu. */
export async function signOutLocalProfile(): Promise<boolean> {
  invalidateLocalProfileActivation();
  closingOperations += 1;
  try {
    if (!(await clearProfileStorageDurably(ANONYMOUS_PROFILE_ID))) return false;
    if (!(await removeRawDurably(StorageKeys.profile))) return false;
    rejectedVaultProfileIds.delete(ANONYMOUS_PROFILE_ID);
    return true;
  } finally { closingOperations -= 1; }
}

export function loadProfileVault(profileId: string): MasterVault | null {
  // Przez readJson, nie surowy parse: dostaje kopertę z sumą kontrolną,
  // migracje schematu i transakcyjny powrót do ostatniego poprawnego stanu,
  // gdy odczyt wykaże uszkodzenie pliku profilu.
  const key = vaultKeyFor(profileId);
  const stored = readJson<unknown>(key, null);
  if (stored === null && readRaw(key) === null) {
    rejectedVaultProfileIds.delete(profileId);
    return null;
  }
  const vault = parseMasterVaultImport(stored);
  if (!vault) {
    rejectedVaultProfileIds.add(profileId);
    return null;
  }
  rejectedVaultProfileIds.delete(profileId);
  return vault;
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
  const key = vaultKeyFor(profileId);
  if (rejectedVaultProfileIds.has(profileId)) return;
  const raw = readRaw(key);
  if (raw !== null && !parseMasterVaultImport(readJson<unknown>(key, null))) {
    rejectedVaultProfileIds.add(profileId);
    return;
  }
  writeJson(key, vault);
}

/**
 * Usuwa profil wraz ze wszystkimi danymi aplikacji z tej przeglądarki.
 *
 * Sprzątanie jest w `storage.ts`, bo tam jest rejestr tego, co aplikacja
 * w ogóle zapisuje. Poprzednia wersja wyliczała klucze ręcznie w tym miejscu
 * i przez to zostawiała za sobą m.in. stan subskrypcji — a „usuń moje dane",
 * które czegoś nie usuwa, jest gorsze niż brak takiej funkcji.
 */
export async function deleteLocalProfile(): Promise<boolean> {
  invalidateLocalProfileActivation();
  closingOperations += 1;
  try {
    const deleted = await wipeAppStorageDurably();
    if (deleted) rejectedVaultProfileIds.clear();
    return deleted;
  } finally { closingOperations -= 1; }
}
