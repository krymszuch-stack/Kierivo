import { idbBackupClearAll, idbBackupClearAllDurably, idbBackupGet, idbBackupGetPreferred, idbBackupKeys, idbBackupRemove, idbBackupRemoveDurably, idbBackupSet, idbBackupSetDurably, preloadIdbMirror } from './idbFallback';
import type { AtsCalculationTime, AtsScoreContext } from '../types';
import { beginStorageDeletion, isStorageWriteBlocked } from './storageDeletionGuard';

/**
 * Jedyne miejsce, które wie, co ta aplikacja zapisuje w przeglądarce.
 *
 * Wcześniej klucze były rozsiane po ośmiu plikach w trzech konwencjach naraz:
 * `cvelocity-theme` z myślnikiem, `cvelocity_applications_data` z podkreśleniem
 * i `skillvault_vault_active_*` po dawnej marce. Każde nowe miejsce zapisu
 * trzeba było pamiętać dopisać do `deleteLocalProfile()`, a raz już się nie
 * udało — „usuń moje dane" zostawiało za sobą stan subskrypcji, co wyłapał
 * dopiero test regresyjny.
 *
 * Rejestr poniżej odwraca ten kierunek: usuwanie danych iteruje po tym, co jest
 * tutaj zadeklarowane, więc klucz nieobecny w rejestrze nie istnieje.
 */

/** Jedna konwencja: `cvelocity:<nazwa>`. */
const PREFIX = 'cvelocity:';

export const StorageKeys = {
  theme: `${PREFIX}theme`,
  profile: `${PREFIX}profile`,
  /** Lista zapisanych profili lokalnych, dostępna po zamknięciu aktywnego profilu. */
  localProfiles: `${PREFIX}local-profiles`,
  vault: `${PREFIX}vault`,
  /** Ostatnia potwierdzona rewizja chmurowego Vaultu per konto. */
  cloudVaultRevision: `${PREFIX}cloud-vault-revision`,
  /** Niewysłane pełne snapshoty chmurowe per konto. */
  cloudVaultOutbox: `${PREFIX}cloud-vault-outbox`,
  applications: `${PREFIX}applications`,
  sidebarCollapsed: `${PREFIX}sidebar-collapsed`,
  favoriteTips: `${PREFIX}favorite-tips`,
  entitlementsCache: `${PREFIX}entitlements-cache`,
  cheatSheetCache: `${PREFIX}cheatsheet`,
  onboardingDismissed: `${PREFIX}onboarding-dismissed`,
  interviewLoops: `${PREFIX}interview-loops`,
  drillHistory: `${PREFIX}drill-history`,
  cockpitProgress: `${PREFIX}cockpit-progress`,
  uxMilestones: `${PREFIX}ux-milestones`,
  cvQuestionsSkipped: `${PREFIX}cv-questions-skipped`,
  /** Szkice formularzy per widok — giną przy zamknięciu przeglądarki (sessionStorage-semantyka w LS). */
  draftAtsLab: `${PREFIX}draft-ats-lab`,
  /** Historia Doradcy tylko na czas bieżącej sesji przeglądarki. */
  advisorConversation: `${PREFIX}advisor-conversation`,
  /** Stan włączenia asysty lokalnej Ollamy w Doradcy regułowym. */
  advisorOllamaEnabled: `${PREFIX}advisor-ollama-enabled`,
  /** Wybrany model lokalnej Ollamy w Doradcy regułowym. */
  advisorOllamaModel: `${PREFIX}advisor-ollama-model`,
  /** Dobrowolna zgoda na lokalne, zbiorcze liczniki użycia funkcji. */
  productInsightsEnabled: `${PREFIX}product-insights-enabled`,
  /** Lokalne liczniki bez treści CV, pytań, ofert, identyfikatorów ani wysyłki. */
  productInsights: `${PREFIX}product-insights`,
  /**
   * Bufor niedostarczonych zgłoszeń błędów (errorReporter). Treść jest
   * zanonimizowana jeszcze przed zapisem — klucz trafia do tego rejestru nie dla
   * prywatności (tej pilnuje sanityzer), tylko po to, żeby „usuń moje dane"
   * obejmowało go jak każdy inny zapis aplikacji.
   */
  errorReportBuffer: `${PREFIX}error-report-buffer`,
  /** Ustawienia ułatwień dostępu (wysoki kontrast, powiększenie tekstu, czytelność WCAG). */
  a11ySettings: `${PREFIX}a11y-settings`,
  /** Samouczący się bank leksemów i adaptacyjnych wag podsumowań NLG (RLAIF / Knowledge Distillation). */
  learnedLexicon: `${PREFIX}learned-lexicon`,
  /** Biblioteka zapisanych wersji CV (CV Library). */
  cvLibrary: `${PREFIX}cv-library`,
  /** Widok zaawansowany panelu pipeline (pełne rozbicie statusów i kolumn). */
  pipelineAdvancedMode: `${PREFIX}pipeline-advanced-mode`,
  /** Plan nauki użytkownika (Mój plan nauki / Mój następny krok). */
  learningPlan: `${PREFIX}learning-plan`,
  /** Ostatnia wykonana analiza dopasowania oferty (stanowisko, firma, wynik, mocne strony, braki). */
  lastJobAnalysis: `${PREFIX}last-job-analysis`,
} as const;

export interface LastJobAnalysisSummary extends AtsCalculationTime {
  position: string;
  company: string;
  /** Brak liczby oznacza, że oferta/profil nie dały podstaw do oceny. */
  score?: number;
  strengths: string[];
  gaps: string[];
  analyzedAt: string;
  /** Rewizja profilu użyta do obliczenia wyniku; brak oznacza starszy, nieweryfikowalny zapis. */
  profileUpdatedAt?: string;
  /** Wersja reguł użyta przy analizie; brak nie dowodzi aktualności wyniku. */
  atsScoreProvenance?: string;
  requirementsCount?: number;
  matchedCount?: number;
  /** Zakres danych użyty do wyniku; brak oznacza, że starszej oceny nie da się zweryfikować. */
  atsScoreContext?: AtsScoreContext;
}

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

/** Dane prywatne biblioteki CV są zapisywane osobno dla każdego profilu. */
export function cvLibraryKeyFor(profileId: string): string {
  return `${StorageKeys.cvLibrary}:${profileId}`;
}

/** Klucze z treścią użytkownika muszą być izolowane między lokalnymi kontami. */
export function profileDataKeyFor(key: StorageKey, profileId: string): string {
  return `${key}:${profileId}`;
}

/** Kopia ostatniego poprawnego envelope leży wyłącznie w IndexedDB, poza limitem localStorage. */
function recoveryKeyFor(key: string): string {
  return `${key}:last-good`;
}

/** Vault zapisywany pod profilem. */
export function vaultKeyFor(profileId: string): string {
  return `${StorageKeys.vault}:${profileId}`;
}

/**
 * Historia Pipeline należy do profilu tak samo jak vault. Adres e-mail nie
 * może wejść do klucza: bywa zmieniany, a identyfikator profilu jest stały.
 */
export function applicationsKeyFor(profileId: string): string {
  return `${StorageKeys.applications}:${profileId}`;
}

/**
 * Cache spersonalizowanej części ściągi, kluczowany skrótem (oferta + vault).
 *
 * Wchodzi pod wspólny prefiks świadomie. Wpis zawiera punkty STAR zbudowane
 * z prawdziwej historii zatrudnienia, więc jest daną osobową i musi znikać
 * razem z resztą przy `wipeAppStorage()` — dokładnie tego pilnuje ten rejestr.
 */
export function cheatSheetCacheKeyFor(hash: string): string {
  return `${StorageKeys.cheatSheetCache}:${hash}`;
}

/**
 * Ustawienia interfejsu przeżywają usunięcie profilu: motyw i ułatwienia dostępności
 * nie są danymi osobowymi, a przywitanie słabowidzącego nagłym jasnym motywem
 * lub małym fontem po wyczyszczeniu CV utrudniłoby korzystanie z aplikacji.
 */
const PRESERVED_ON_WIPE = new Set<string>([
  StorageKeys.theme,
  StorageKeys.a11ySettings,
  StorageKeys.advisorOllamaEnabled,
  StorageKeys.advisorOllamaModel,
  StorageKeys.productInsightsEnabled,
  StorageKeys.pipelineAdvancedMode,
]);

/**
 * Mapa starych kluczy na nowe, uruchamiana raz przy starcie aplikacji.
 *
 * Bez niej wdrożenie tej zmiany skasowałoby dane każdemu, kto już czegokolwiek
 * w aplikacji użył — dane nie zniknęłyby z dysku, ale aplikacja przestałaby
 * wiedzieć, gdzie ich szukać, co dla użytkownika jest tym samym.
 */
const LEGACY_KEY_MAP: Record<string, string> = {
  'cvelocity-theme': StorageKeys.theme,
  'cvelocity_local_profile_v1': StorageKeys.profile,
  'cvelocity_applications_data': StorageKeys.applications,
  'cvelocity_sidebar_collapsed': StorageKeys.sidebarCollapsed,
  'cvelocity-favorite-tips': StorageKeys.favoriteTips,
  'cvelocity-auth-state': StorageKeys.entitlementsCache,
};

/** Prefiksy sprzątane przy usuwaniu profilu — łącznie z dawną marką. */
const OWNED_PREFIXES = ['cvelocity', 'skillvault'];

// Usunięcie konta trwa dłużej niż jeden render Reacta. Stary autosave nie może
// odtworzyć profilu między wymazaniem IDB a przeładowaniem czystej aplikacji.
let privacyWipeInProgress = false;

export function isPrivacyWipeInProgress(): boolean {
  return privacyWipeInProgress;
}

export function beginPrivacyWipe(): void {
  // W testach Node nie ma cyklu życia strony; w przeglądarce blokada trwa do
  // wymuszonego odświeżenia po usunięciu konta/profilu.
  if (typeof window !== 'undefined') privacyWipeInProgress = true;
}

function isBrowser(): boolean {
  return typeof localStorage !== 'undefined';
}

function hasSessionStorage(): boolean {
  return typeof sessionStorage !== 'undefined';
}

export function readSessionJson<T>(key: string, fallback: T): T {
  if (!hasSessionStorage()) return fallback;
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeSessionJson(key: string, value: unknown): void {
  if (!hasSessionStorage() || privacyWipeInProgress || isStorageWriteBlocked(key)) return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Tryb prywatny lub limit schowka — rozmowa nadal działa w pamięci Reacta.
  }
}

export function removeSession(key: string): void {
  if (!hasSessionStorage()) return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* jw. */
  }
}

/** Aktualna wersja schematu zapisu JSON — rośnie przy migracji kształtu danych. */
export const SCHEMA_VERSION = 2;

/** Miękki próg: powyżej tego rozmiaru zapis idzie prosto do IndexedDB (limit LS ~5 MB). */
const LS_SOFT_LIMIT_CHARS = 5_000_000;

/**
 * FNV-1a (32-bit) — suma kontrolna wykrywalności uszkodzeń.
 *
 * Celowo nie kryptograficzna: nie broni przed atakującym, tylko przed realnym
 * wrogiem danych — uciętym zapisem przy nagłym zamknięciu karty. Wykrycie musi
 * być tanie, bo liczone jest przy każdym odczycie vaultu.
 */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function readRaw(key: string): string | null {
  if (!isBrowser()) return null;
  try {
    // Gdy bieżący zapis przekroczył limit LS, jego kopia w pamięci jest
    // nowsza od starego wpisu LS. Po zatwierdzeniu IDB stary wpis jest usuwany.
    const preferredBackup = idbBackupGetPreferred(key);
    if (preferredBackup !== null) return preferredBackup;

    const value = localStorage.getItem(key);
    if (value !== null) return value;
    // Klucza nie ma w localStorage — może żyje w kopii zapasowej IndexedDB
    // (zapisany tam, gdy LS odmówił posłuszeństwa).
    return idbBackupGet(key);
  } catch {
    // Prywatne okno albo zablokowane dane witryny — brak zapisu to nie awaria.
    return null;
  }
}

export function writeRaw(key: string, value: string): void {
  if (!isBrowser() || privacyWipeInProgress || isStorageWriteBlocked(key)) return;

  const fallbackToIndexedDb = () => {
    void idbBackupSet(key, value).then((persisted) => {
      // Nie usuwaj poprzedniego, odzyskiwalnego wpisu, dopóki transakcja IDB
      // naprawdę się nie zatwierdziła. Chroni to przed przerwaniem zapisu.
      if (!persisted || idbBackupGetPreferred(key) !== value) return;
      try {
        localStorage.removeItem(key);
      } catch {
        // Kopia IDB pozostaje dostępna; nie maskuj błędu zapisu pierwotnego.
      }
    });
  };

  // Proaktywny przekierunek: powyżej miękkiego progu LS i tak rzuci limitem
  // przy najmniej odpowiednim momencie (najdłuższy wpis użytkownika). Nie
  // czekamy na gwarantowaną porażkę.
  if (value.length > LS_SOFT_LIMIT_CHARS) {
    fallbackToIndexedDb();
    return;
  }

  try {
    localStorage.setItem(key, value);
    // Mały zapis LS jest teraz źródłem aktualnym. Usuń ewentualną starszą
    // kopię IDB, żeby nie odrodziła się po późniejszym braku wpisu LS.
    idbBackupRemove(key);
  } catch {
    // QuotaExceededError (przepełniony limit) albo tryb prywatny. Dla limitu
    // dane ratuje kopia w IndexedDB; dla trybu prywatnego po prostu nie ma
    // dokąd pisać i zostajemy przy pamięci sesyjnej.
    fallbackToIndexedDb();
  }
}

/**
 * Zapis dla operacji wymagających potwierdzenia trwałości, np. migracji i aktywacji profilu.
 * Zwraca sukces dopiero po synchronicznym zapisie LS albo zatwierdzonej
 * transakcji IDB; zwykły `writeRaw` celowo nie czeka na awaryjny zapis.
 */
export async function writeRawDurably(key: string, value: string): Promise<boolean> {
  if (!isBrowser() || privacyWipeInProgress || isStorageWriteBlocked(key)) return false;

  if (value.length <= LS_SOFT_LIMIT_CHARS) {
    try {
      localStorage.setItem(key, value);
      idbBackupRemove(key);
      return true;
    } catch {
      // Gdy limit lub tryb prywatny blokuje LS, wymagamy potwierdzenia IDB.
    }
  }

  if (!(await idbBackupSetDurably(key, value))) return false;
  try {
    localStorage.removeItem(key);
    return localStorage.getItem(key) === null;
  } catch {
    // Pozostaw źródło migracji w spokoju, jeśli stara kopia celu nie mogła
    // zostać usunięta i po restarcie mogłaby przesłonić nową kopię IDB.
    return false;
  }
}

export function removeRaw(key: string): void {
  if (!isBrowser()) return;
  idbBackupRemove(key);
  idbBackupRemove(recoveryKeyFor(key));
  lastGood.delete(key);
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(recoveryKeyFor(key));
  } catch {
    /* jw. */
  }
}

/** Zamknięcie profilu nie może pozostawić kopii pozwalającej odzyskać aktywną sesję. */
export async function removeRawDurably(key: string): Promise<boolean> {
  return removeKeysDurably([key]);
}

async function removeKeysDurably(primaryKeys: string[], sessionKeys: string[] = []): Promise<boolean> {
  if (!isBrowser()) return false;
  const keys = primaryKeys.flatMap(key => [key, recoveryKeyFor(key)]);
  const release = beginStorageDeletion([...keys, ...sessionKeys]);
  try {
    try {
      for (const item of keys) localStorage.removeItem(item);
      if (keys.some(item => localStorage.getItem(item) !== null)) return false;
      if (hasSessionStorage()) {
        for (const item of sessionKeys) sessionStorage.removeItem(item);
        if (sessionKeys.some(item => sessionStorage.getItem(item) !== null)) return false;
      }
    } catch { return false; }
    if (!(await idbBackupRemoveDurably(keys))) return false;
    for (const key of primaryKeys) lastGood.delete(key);
    return true;
  } finally { release(); }
}

const profileStorageClearedListeners = new Set<(profileId: string) => void>();

export function onProfileStorageCleared(listener: (profileId: string) => void): () => void {
  profileStorageClearedListeners.add(listener);
  return () => { profileStorageClearedListeners.delete(listener); };
}

/** Rejestr obejmuje nowe dane profilu bez kolejnej ręcznej listy czyszczenia. */
export async function clearProfileStorageDurably(profileId: string): Promise<boolean> {
  const keys = Object.values(StorageKeys).map(key => profileDataKeyFor(key, profileId));
  if (!(await removeKeysDurably(keys, keys))) return false;
  for (const listener of profileStorageClearedListeners) listener(profileId);
  return true;
}

/** Wypisuje klucze aplikacji także z awaryjnego IndexedDB; potrzebne do odzyskania dawnych profili. */
export async function listStorageKeys(prefix: string): Promise<string[]> {
  if (!isBrowser()) return [];
  const localKeys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) localKeys.push(key);
    }
  } catch {
    return idbBackupKeys(prefix);
  }
  return [...new Set([...localKeys, ...(await idbBackupKeys(prefix))])];
}

/**
 * Czyści pamięć ostatnich poprawnych stanów.
 *
 * Użytek dwojaki: `wipeAppStorage` woła ją po wymazaniu (dane usunięte nie
 * mogą wrócić z pamięci), a testy izolują nią scenariusze między przypadkami,
 * bo mapa jest modułowa i przeżywałaby podmianę atrapy schowka.
 */
export function resetLastGoodCache(): void {
  lastGood.clear();
}

// ---------------------------------------------------------------------------
// Ostatni poprawny stan i migracje schematu
// ---------------------------------------------------------------------------

/**
 * Pamięć sesyjna ostatnich poprawnie sparsowanych wartości.
 *
 * Gdy suma kontrola świeżego odczytu się nie zgadza (ucięty zapis), serwujemy
 * z tej pamięci poprzedni znany dobry stan — transakcyjny revert na poziomie
 * danych: aplikacja działa dalej na ostatnich prawdziwych danych zamiast
 * na pustce.
 */
const lastGood = new Map<string, unknown>();

type MigrationFn = (data: unknown) => unknown;
const keyMigrations = new Map<string, Map<number, MigrationFn>>();

/**
 * Rejestruje przejścia schematu dla klucza: `{ 1: fnZ1do2 }`. Przy odczycie
 * koperty starszej wersji funkcje wykonują się po kolei aż do `SCHEMA_VERSION`.
 */
export function registerKeyMigration(
  key: string,
  migrations: Record<number, MigrationFn>
): void {
  const existing = keyMigrations.get(key) ?? new Map<number, MigrationFn>();
  for (const [version, fn] of Object.entries(migrations)) {
    existing.set(Number(version), fn);
  }
  keyMigrations.set(key, existing);
}

interface StorageEnvelope {
  cvel: number;
  crc: string;
  data: string;
}

function isEnvelope(value: unknown): value is StorageEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'cvel' in value &&
    'crc' in value &&
    'data' in value &&
    typeof (value as { data?: unknown }).data === 'string'
  );
}

function decodeStoredValue(key: string, raw: string): { data: unknown } | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    let data: unknown = parsed;
    let version = SCHEMA_VERSION;
    if (isEnvelope(parsed)) {
      if (fnv1a(parsed.data) !== parsed.crc) return null;
      version = parsed.cvel;
      data = JSON.parse(parsed.data);
    }
    const migrations = keyMigrations.get(key);
    if (migrations && version < SCHEMA_VERSION) {
      for (let currentVersion = version; currentVersion < SCHEMA_VERSION; currentVersion++) {
        const migrate = migrations.get(currentVersion);
        if (migrate) data = migrate(data);
      }
    }
    return { data };
  } catch {
    return null;
  }
}

/** Migracja usuwająca źródło nie może uznać awaryjnego pustego stanu za odczyt. */
export function readJsonForMigration(key: string):
  | { success: true; raw: string | null; value: unknown }
  | { success: false; raw: string } {
  const raw = readRaw(key);
  if (raw === null) return { success: true, raw, value: undefined };
  const decoded = decodeStoredValue(key, raw);
  return decoded ? { success: true, raw, value: decoded.data } : { success: false, raw };
}

function createEnvelope(data: unknown): string | null {
  try {
    const dataString = JSON.stringify(data);
    return dataString === undefined
      ? null
      : JSON.stringify({ cvel: SCHEMA_VERSION, crc: fnv1a(dataString), data: dataString });
  } catch {
    return null;
  }
}

function recoverLastGood<T>(key: string, fallback: T): T {
  const backupRaw = idbBackupGet(recoveryKeyFor(key));
  const recovered = backupRaw === null ? null : decodeStoredValue(key, backupRaw);
  if (backupRaw !== null && recovered) {
    console.warn(`[storage] Odzyskano ${key} z kopii IndexedDB po błędzie odczytu.`);
    const currentEnvelope = createEnvelope(recovered.data);
    if (currentEnvelope) writeRaw(key, currentEnvelope);
    lastGood.set(key, recovered.data);
    return recovered.data as T;
  }
  return (lastGood.get(key) as T | undefined) ?? fallback;
}

/** Odczyt JSON-a z kopertą, sumą kontrolną, migracjami i awaryjnym ostatnim dobrym stanem. */
export function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key);
  if (raw === null) return recoverLastGood(key, fallback);

  try {
    const parsed: unknown = JSON.parse(raw);

    let data: unknown = parsed;
    let version = SCHEMA_VERSION;

    if (isEnvelope(parsed)) {
      version = parsed.cvel;
      // Suma kontrolna liczy się z dokładnym stringiem danych w kopercie.
      if (fnv1a(parsed.data) !== parsed.crc) {
        console.warn(`[storage] Suma kontrolna się nie zgadza dla ${key} — wracam do ostatniego poprawnego stanu.`);
        return recoverLastGood(key, fallback);
      }
      data = JSON.parse(parsed.data);
    }

    const migrations = keyMigrations.get(key);
    if (migrations && version < SCHEMA_VERSION) {
      for (let v = version; v < SCHEMA_VERSION; v++) {
        const migrate = migrations.get(v);
        if (migrate) data = migrate(data);
      }
    }

    lastGood.set(key, data);
    return data as T;
  } catch {
    // Uszkodzony JSON (np. ucięty przy zamknięciu przeglądarki).
    return recoverLastGood(key, fallback);
  }
}

/** Zapis JSON-a w kopercie z sumą kontrolną FNV-1a i aktualną wersją schematu. */
export function writeJson(key: string, value: unknown): void {
  if (privacyWipeInProgress || isStorageWriteBlocked(key)) return;
  try {
    const dataString = JSON.stringify(value);
    if (dataString === undefined) return; // Cykl w strukturze — nie ma czego zapisać.

    const envelope = JSON.stringify({
      cvel: SCHEMA_VERSION,
      crc: fnv1a(dataString),
      // Dane jako string w środku: suma kontrolna musi obejmować dokładne
      // bajty treści, nie wynik ponownej serializacji obiektu.
      data: dataString,
    });

    const previousRaw = readRaw(key);
    const previousValid = previousRaw === null ? null : decodeStoredValue(key, previousRaw);
    writeRaw(key, envelope);
    // Asynchroniczna kopia w IndexedDB chroni poprzedni poprawny zapis przed
    // uszkodzeniem po restarcie, bez podwajania danych w localStorage.
    void idbBackupSetDurably(recoveryKeyFor(key), previousValid && previousRaw !== null ? previousRaw : envelope);
    lastGood.set(key, value);
  } catch {
    // Cykl w strukturze danych — nie ma czego zapisać.
  }
}

/** Zapis koperty JSON z potwierdzeniem trwałości przed publikacją sukcesu operacji. */
export async function writeJsonDurably(key: string, value: unknown): Promise<boolean> {
  if (privacyWipeInProgress || isStorageWriteBlocked(key)) return false;
  try {
    const data = JSON.stringify(value);
    if (data === undefined) return false;
    const envelope = JSON.stringify({ cvel: SCHEMA_VERSION, crc: fnv1a(data), data });
    const persisted = await writeRawDurably(key, envelope);
    if (persisted) lastGood.set(key, value);
    return persisted;
  } catch {
    return false;
  }
}

if (typeof window !== 'undefined') {
  void preloadIdbMirror();
}

function migrateLegacyEntry(legacy: string, current: string): void {
  try {
    const value = localStorage.getItem(legacy);
    if (value === null) return;
    if (localStorage.getItem(current) === null) localStorage.setItem(current, value);
    if (localStorage.getItem(current) === value) removeRaw(legacy);
  } catch {
    return;
  }
}

/**
 * Przenosi dane spod starych kluczy pod nowe. Idempotentna: klucz docelowy,
 * który już istnieje, nie jest nadpisywany, więc powtórne wywołanie nie cofa
 * niczego, co użytkownik zdążył zmienić po migracji.
 */
export function migrateLegacyKeys(): void {
  if (!isBrowser()) return;

  for (const [legacy, current] of Object.entries(LEGACY_KEY_MAP)) {
    migrateLegacyEntry(legacy, current);
  }

  // Vaulty profilowe mają w kluczu identyfikator profilu, więc nie da się ich
  // wypisać z góry — trzeba przejść po tym, co faktycznie leży w schowku.
  const legacyVaultPrefix = 'skillvault_vault_active_';
  const toMigrate: Array<[string, string]> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(legacyVaultPrefix)) continue;
    toMigrate.push([key, vaultKeyFor(key.slice(legacyVaultPrefix.length))]);
  }

  for (const [legacy, current] of toMigrate) {
    migrateLegacyEntry(legacy, current);
  }

  // Pozostałości po module udającym system kont: baza „użytkowników" z hashami
  // haseł i sekretami TOTP oraz vault „zaszyfrowany" kluczem zaszytym w kodzie.
  // Nic tego już nie czyta, a są to dane osobowe — zostawianie ich w cudzej
  // przeglądarce nie ma żadnego uzasadnienia.
  removeRaw('skillvault_users_db_v1');
  removeRaw('skillvault_master_vault_enc_v2');

  // Moduł punktów został usunięty. Dane nie mają już konsumenta ani celu,
  // dlatego znikają przy pierwszym uruchomieniu nowej wersji zamiast zalegać
  // bezterminowo w przeglądarce.
  removeRaw(`${PREFIX}gamification`);
  removeRaw(`${PREFIX}xp-ledger`);
}

/**
 * Powiadomienia o wymazaniu danych.
 *
 * Sklepy modułowe trzymają kopie danych w pamięci między renderami. Samo
 * usunięcie kluczy ze schowka nie czyści tych kopii, więc pierwsza zmiana po
 * „usuń moje dane" odzyskiwała usuniętą listę do localStorage — dane wracały
 * po operacji, która miała być nieodwracalna. Rejestr zna moment wymazania,
 * więc to on rozsyła informację; sklep rejestruje reset zamiast każdy kolejny
 * wywołujący pamiętać o ręcznym czyszczeniu.
 */
const wipeListeners = new Set<() => void>();

/** Podpina reset pamięci pod `wipeAppStorage()`. Zwraca funkcję odpinającą. */
export function onAppStorageWiped(listener: () => void): () => void {
  wipeListeners.add(listener);
  return () => {
    wipeListeners.delete(listener);
  };
}

/**
 * Usuwa z tej przeglądarki wszystkie dane aplikacji poza ustawieniami
 * interfejsu. Iteruje po prefiksach zamiast po liście kluczy, żeby dane zapisane
 * przez kod, który powstanie później, też zostały objęte.
 */
function removeOwnedBrowserKeys(): boolean {
  let cleared = true;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || PRESERVED_ON_WIPE.has(key)) continue;
      if (OWNED_PREFIXES.some((prefix) => key.startsWith(prefix))) doomed.push(key);
    }
    for (const key of doomed) {
      removeRaw(key);
      if (localStorage.getItem(key) !== null) cleared = false;
    }
  } catch {
    cleared = false;
  }

  if (hasSessionStorage()) {
    try {
      const sessionKeys: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && OWNED_PREFIXES.some((prefix) => key.startsWith(prefix))) sessionKeys.push(key);
      }
      for (const key of sessionKeys) {
        sessionStorage.removeItem(key);
        if (sessionStorage.getItem(key) !== null) cleared = false;
      }
    } catch {
      cleared = false;
    }
  }
  return cleared;
}

export function wipeAppStorage(): void {
  if (!isBrowser()) return;
  removeOwnedBrowserKeys();

  // Kopia zapasowa IndexedDB należy do tej samej umowy „klucz nieobecny w
  // rejestrze nie istnieje" — bez tego „usuń moje dane" odradzałoby profile
  // z kopii awaryjnej.
  idbBackupClearAll();

  // Dopiero po faktycznym wymazaniu: subskrybent w callbacku musi widzieć stan
  // po usunięciu, nie przed.
  wipeListeners.forEach((notify) => notify());
}

/** Ścieżka „Usuń profil/konto” czeka na zatwierdzenie wymazania kopii IDB. */
export async function wipeAppStorageDurably(): Promise<boolean> {
  if (!isBrowser()) return false;
  beginPrivacyWipe();
  const localCleared = removeOwnedBrowserKeys();
  const idbCleared = await idbBackupClearAllDurably();
  wipeListeners.forEach((notify) => notify());
  return localCleared && idbCleared;
}
