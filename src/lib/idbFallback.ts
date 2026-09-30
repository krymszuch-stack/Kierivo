/**
 * Awaryjny magazyn IndexedDB dla danych, których localStorage nie przyjął.
 *
 * localStorage ma twardy limit (~5 MB na domenę) i potrafi rzucić
 * QuotaExceededError w momencie, w którym użytkownik właśnie skończył pisać
 * najdłuższy opis stanowiska. Utrata tego zapisu jest nieakceptowalna, więc
 * nadmiar ląduje w IndexedDB — tej samej origin, ale z limitem liczonym
 * w setkach megabajtów.
 *
 * Interfejs jest synchroniczny z punktu widzenia reszty aplikacji celowo:
 * odczyt obsługuje w pamięci podręcznej lustrzanych kluczy, zasilanej przy
 * starcie i aktualizowanej przy każdym zapisie awaryjnym. Asynchroniczność
 * IndexedDB nigdy nie przecieka do wywołań `readJson`.
 */

const DB_NAME = 'cvelocity-backup';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

/** Klucze, które trafiły do IndexedDB i tam trzeba ich szukać przy odczycie. */
const mirroredKeys = new Set<string>();
const mirrorCache = new Map<string, string>();
/** Wpisy zapisane jako fallback w tej sesji są nowsze niż stary localStorage. */
const preferredMirrorKeys = new Set<string>();
/** Wersje blokują spóźnione odczyty startowe przed cofnięciem zmian z tej sesji. */
const keyVersions = new Map<string, number>();
let clearVersion = 0;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function bumpKeyVersion(key: string): void {
  keyVersions.set(key, (keyVersions.get(key) ?? 0) + 1);
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      // Środowisko bez IndexedDB (testy w Node, SSR) — funkcja spada do no-op,
      // a odpowiedzialność za dane zostaje przy localStorage.
      resolve(null);
      return;
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        let result: T | null = null;
        try {
          const tx = db.transaction(STORE_NAME, mode);
          const request = operation(tx.objectStore(STORE_NAME));
          request.onsuccess = () => {
            result = request.result ?? null;
          };
          request.onerror = () => resolve(null);
          tx.oncomplete = () => resolve(result);
          tx.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

/** Zapis awaryjny. Zwraca `true`, gdy dane faktycznie dotarły do IndexedDB. */
export function idbBackupSet(key: string, value: string): Promise<boolean> {
  bumpKeyVersion(key);
  mirrorCache.set(key, value);
  mirroredKeys.add(key);
  preferredMirrorKeys.add(key);

  return withStore<IDBValidKey>('readwrite', (store) => store.put(value, key)).then(
    (result) => result !== null,
  );

}

/** Zapis migracyjny: lustro uznajemy za gotowe dopiero po zatwierdzeniu transakcji IDB. */
export async function idbBackupSetDurably(key: string, value: string): Promise<boolean> {
  bumpKeyVersion(key);
  const persisted = await withStore<IDBValidKey>('readwrite', (store) => store.put(value, key));
  if (persisted === null) return false;
  mirrorCache.set(key, value);
  mirroredKeys.add(key);
  preferredMirrorKeys.add(key);
  return true;
}

/** Wartość zapisana jako fallback w tej sesji wygrywa ze starszą kopią LS. */
export function idbBackupGetPreferred(key: string): string | null {
  return preferredMirrorKeys.has(key) ? mirrorCache.get(key) ?? null : null;
}

/** Szybki odczyt z lustra pamięciowego; asynchroniczne DOBicie do IndexedDB tylko przy chłodnym starcie. */
export function idbBackupGet(key: string): string | null {
  const cached = mirrorCache.get(key);
  if (cached !== undefined) return cached;

  if (!mirroredKeys.has(key)) return null;

  // Klucz oznaczony jako lustro, ale jeszcze bez wartości w pamięci (chłodny
  // start przed preloadingiem). Nie blokujemy — kolejny odczyt znajdzie już
  // dane zasilone przez `preloadIdbMirror`.
  return null;
}

/** Zasila lustro pamięciowe wszystkimi kluczami zapasowymi. Wywoływane raz przy starcie modułu storage. */
export async function preloadIdbMirror(): Promise<void> {
  const preloadClearVersion = clearVersion;
  const keys = await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
  if (!keys) return;

  for (const key of keys) {
    if (typeof key !== 'string') continue;
    const preloadKeyVersion = keyVersions.get(key) ?? 0;
    mirroredKeys.add(key);
    const value = await withStore<string>('readonly', (store) => store.get(key));
    if (
      typeof value === 'string' &&
      preloadClearVersion === clearVersion &&
      preloadKeyVersion === (keyVersions.get(key) ?? 0) &&
      !preferredMirrorKeys.has(key)
    ) {
      mirrorCache.set(key, value);
    }
  }
}

/** Klucze IndexedDB pod danym prefiksem, np. stare Vaulty przekroczonego limitu localStorage. */
export async function idbBackupKeys(prefix: string): Promise<string[]> {
  await preloadIdbMirror();
  const keys = await withStore<IDBValidKey[]>('readonly', (store) => store.getAllKeys());
  if (!keys) return [];
  return keys.filter((key): key is string => typeof key === 'string' && key.startsWith(prefix));
}

/** Usuwa wpis zapasowy (np. przy „usuń moje dane"). */
export function idbBackupRemove(key: string): void {
  bumpKeyVersion(key);
  mirrorCache.delete(key);
  mirroredKeys.delete(key);
  preferredMirrorKeys.delete(key);
  void withStore('readwrite', (store) => store.delete(key));
}

/** Potwierdza wymazanie kopii przed zgłoszeniem użytkownikowi sukcesu usunięcia danych. */
export async function idbBackupClearAllDurably(): Promise<boolean> {
  clearVersion += 1;
  mirrorCache.clear();
  mirroredKeys.clear();
  preferredMirrorKeys.clear();

  // Gdy API nie istnieje, aplikacja nie mogła zapisać tu danych. Błąd otwarcia
  // istniejącej bazy jest inny: nie wolno go uznać za potwierdzone usunięcie.
  if (typeof indexedDB === 'undefined') return true;
  const db = await openDb();
  if (!db) return false;

  return new Promise<boolean>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const request = tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
      request.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** Synchroniczna ścieżka resetu stanu; usunięcie konta czeka na wariant trwały. */
export function idbBackupClearAll(): void {
  void idbBackupClearAllDurably();
}
