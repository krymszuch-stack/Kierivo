import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage } from './helpers/memoryStorage';

function makeIndexedDb(
  records: Map<string, string>,
  options: {
    delayGetMs?: number;
    onGetStarted?: (key: string) => void;
    failPut?: (key: string, value: string) => boolean;
    failDelete?: boolean;
    failClear?: boolean;
    delayClearMs?: number;
  } = {},
): IDBFactory {
  const database = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => undefined,
    transaction: () => {
      const tx: {
        oncomplete: (() => void) | null;
        onerror: (() => void) | null;
        onabort: (() => void) | null;
        objectStore: () => IDBObjectStore;
      } = {
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore: () => store as unknown as IDBObjectStore,
      };
      const request = <T>(operation: () => T, delayMs = 0) => {
        const result: {
          result?: T;
          onsuccess: (() => void) | null;
          onerror: (() => void) | null;
        } = { onsuccess: null, onerror: null };
        const complete = () => {
          try {
            result.result = operation();
            result.onsuccess?.();
            queueMicrotask(() => tx.oncomplete?.());
          } catch {
            result.onerror?.();
            tx.onerror?.();
          }
        };
        if (delayMs > 0) setTimeout(complete, delayMs);
        else queueMicrotask(complete);
        return result as unknown as IDBRequest<T>;
      };
      const store = {
        getAllKeys: () => request(() => [...records.keys()]),
        get: (key: string) => {
          options.onGetStarted?.(key);
          const snapshot = records.get(key);
          return request(() => snapshot, options.delayGetMs);
        },
        put: (value: string, key: string) => request(() => {
          if (options.failPut?.(key, value)) throw new Error('synthetic IndexedDB write failure');
          records.set(key, value);
          return key;
        }),
        delete: (key: string) => request(() => {
          if (options.failDelete) throw new Error('synthetic IndexedDB delete failure');
          records.delete(key);
          return undefined;
        }),
        clear: () => request(() => {
          if (options.failClear) throw new Error('synthetic IndexedDB clear failure');
          records.clear();
          return undefined;
        }, options.delayClearMs),
      };
      return tx as unknown as IDBTransaction;
    },
  } as unknown as IDBDatabase;

  return {
    open: () => {
      const opened: {
        result?: IDBDatabase;
        onupgradeneeded: (() => void) | null;
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
      } = { onupgradeneeded: null, onsuccess: null, onerror: null };
      queueMicrotask(() => {
        opened.result = database;
        opened.onupgradeneeded?.();
        opened.onsuccess?.();
      });
      return opened as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('awaryjny zapis Vaultu do IndexedDB', () => {
  it('potwierdza usunięcie profilu dopiero po zakończeniu transakcji IndexedDB', async () => {
    const key = 'cvelocity:vault:local-synthetic-idb';
    const localKey = 'cvelocity:vault:local-synthetic-ls';
    const records = new Map([[key, 'zapasowy profil']]);
    const local = new MemoryStorage();
    local.setItem(localKey, 'profil w localStorage');
    local.setItem('cvelocity:theme', 'dark');
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('window', {});
    vi.stubGlobal('indexedDB', makeIndexedDb(records, { delayClearMs: 30 }));

    const { deleteLocalProfile } = await import('../localProfile');
    const storage = await import('../storage');
    let completed = false;
    const deletion = deleteLocalProfile().then((result) => {
      completed = true;
      return result;
    });
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(completed).toBe(false);
    expect(records.has(key)).toBe(true);
    expect(await deletion).toBe(true);
    expect(records.has(key)).toBe(false);
    expect(local.getItem(localKey)).toBeNull();
    expect(local.getItem('cvelocity:theme')).toBe('dark');
    storage.writeRaw(localKey, 'spóźniony zapis starego profilu');
    expect(local.getItem(localKey)).toBeNull();
    expect(storage.isPrivacyWipeInProgress()).toBe(true);
  });

  it('nie zgłasza sukcesu usunięcia, gdy IndexedDB odrzuci czyszczenie', async () => {
    const key = 'cvelocity:vault:local-synthetic';
    const records = new Map([[key, 'zapasowy profil']]);
    const local = new MemoryStorage();
    local.setItem(key, 'profil w localStorage');
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('indexedDB', makeIndexedDb(records, { failClear: true, failDelete: true }));

    const { deleteLocalProfile } = await import('../localProfile');
    expect(await deleteLocalProfile()).toBe(false);
    expect(local.getItem(key)).toBeNull();
    expect(records.get(key)).toBe('zapasowy profil');

    vi.resetModules();
    const { preloadIdbMirror } = await import('../idbFallback');
    await preloadIdbMirror();
    const restartedStorage = await import('../storage');
    expect(restartedStorage.readRaw(key)).toBe('zapasowy profil');
  });

  it('nie pozwala, by opóźnione preload nadpisało nowszy zapis z bieżącej sesji', async () => {
    const key = 'cvelocity:vault:synthetic-racing-profile';
    const oldValue = 'starszy snapshot z IndexedDB';
    const newValue = 'nowszy zapis użytkownika';
    const records = new Map([[key, oldValue]]);
    let notifyGetStarted: (() => void) | undefined;
    const getStarted = new Promise<void>((resolve) => { notifyGetStarted = resolve; });
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('indexedDB', makeIndexedDb(records, {
      delayGetMs: 20,
      onGetStarted: (requestedKey) => {
        if (requestedKey === key) notifyGetStarted?.();
      },
    }));

    const { idbBackupSet, idbBackupGetPreferred, preloadIdbMirror } = await import('../idbFallback');
    const preload = preloadIdbMirror();
    await getStarted;
    await idbBackupSet(key, newValue);
    await preload;

    expect(idbBackupGetPreferred(key)).toBe(newValue);
  });

  it('nie odtwarza usuniętych danych z preloadu trwającego podczas czyszczenia', async () => {
    const key = 'cvelocity:vault:synthetic-cleared-profile';
    const records = new Map([[key, 'dane do usunięcia']]);
    let notifyGetStarted: (() => void) | undefined;
    const getStarted = new Promise<void>((resolve) => { notifyGetStarted = resolve; });
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('indexedDB', makeIndexedDb(records, {
      delayGetMs: 20,
      onGetStarted: (requestedKey) => {
        if (requestedKey === key) notifyGetStarted?.();
      },
    }));

    const { idbBackupClearAll, idbBackupGet, preloadIdbMirror } = await import('../idbFallback');
    const preload = preloadIdbMirror();
    await getStarted;
    idbBackupClearAll();
    await preload;

    expect(idbBackupGet(key)).toBeNull();
    await vi.waitFor(() => expect(records.has(key)).toBe(false));
  });

  it('po przekroczeniu limitu nie odczytuje starego localStorage i odzyskuje nową treść po restarcie', async () => {
    const records = new Map<string, string>();
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('indexedDB', makeIndexedDb(records));

    const { writeRaw, readRaw } = await import('../storage');
    const key = 'cvelocity:vault:synthetic-large-profile';
    const oldValue = 'poprzedni profil';
    const newValue = 'x'.repeat(5_000_001);
    localStorage.setItem(key, oldValue);

    writeRaw(key, newValue);
    expect(readRaw(key)).toBe(newValue);

    await vi.waitFor(() => expect(localStorage.getItem(key)).toBeNull());
    expect(records.get(key)).toBe(newValue);

    vi.resetModules();
    const { preloadIdbMirror } = await import('../idbFallback');
    await preloadIdbMirror();
    const restartedStorage = await import('../storage');

    expect(restartedStorage.readRaw(key)).toBe(newValue);
  });

  it.each([
    ['Vault', 'cvelocity:vault:local-', 'cvelocity:vault:anonymous'],
    ['aplikacji', 'cvelocity:applications:local-', 'cvelocity:applications:anonymous'],
    ['biblioteki CV', 'cvelocity:cv-library:local-', 'cvelocity:cv-library:anonymous'],
  ])('zachowuje anonimowe źródła, gdy trwały zapis kopii %s nie powiedzie się', async (_name, failedTargetPrefix, failedSourceKey) => {
    const records = new Map<string, string>();
    const local = new MemoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('indexedDB', makeIndexedDb(records, {
      failPut: (key) => key.startsWith(failedTargetPrefix),
    }));

    const { StorageKeys, applicationsKeyFor, cvLibraryKeyFor, vaultKeyFor, writeJson } = await import('../storage');
    const sourceKeys = [
      vaultKeyFor('anonymous'),
      applicationsKeyFor('anonymous'),
      cvLibraryKeyFor('anonymous'),
    ];
    writeJson(sourceKeys[0], { personalInfo: { fullName: 'Testowy Kandydat' } });
    writeJson(sourceKeys[1], [{ id: 'application-synthetic', company: 'Firma syntetyczna' }]);
    writeJson(sourceKeys[2], [{ id: 'cv-synthetic', title: 'CV syntetyczne' }]);
    const originalSetItem = local.setItem.bind(local);
    local.setItem = (key, value) => {
      if (key.startsWith(failedTargetPrefix)) throw new Error('synthetic localStorage quota failure');
      originalSetItem(key, value);
    };

    const { createLocalProfile } = await import('../localProfile');
    await expect(createLocalProfile('Testowy Kandydat')).rejects.toThrow(/trwale zapisać/i);

    expect(sourceKeys).toContain(failedSourceKey);
    for (const key of sourceKeys) expect(local.getItem(key)).not.toBeNull();
    expect(local.getItem(StorageKeys.profile)).toBeNull();
    vi.resetModules();
    const restartedStorage = await import('../storage');
    for (const key of sourceKeys) expect(restartedStorage.readJson(key, null)).not.toBeNull();
  });

  it('usuwa anonimowe źródło dopiero po zatwierdzeniu kopii Vaultu w IndexedDB', async () => {
    const records = new Map<string, string>();
    const local = new MemoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('indexedDB', makeIndexedDb(records));
    const { writeJson, vaultKeyFor } = await import('../storage');
    const sourceKey = vaultKeyFor('anonymous');
    writeJson(sourceKey, { personalInfo: { fullName: 'Testowy Kandydat' } });
    const originalSetItem = local.setItem.bind(local);
    local.setItem = (key, value) => {
      if (key.startsWith('cvelocity:vault:local-')) throw new Error('synthetic localStorage quota failure');
      originalSetItem(key, value);
    };

    const { createLocalProfile } = await import('../localProfile');
    const { profile } = await createLocalProfile('Testowy Kandydat');
    const targetKey = vaultKeyFor(profile.id);

    expect(local.getItem(sourceKey)).toBeNull();
    expect(records.has(targetKey)).toBe(true);
    vi.resetModules();
    const { preloadIdbMirror } = await import('../idbFallback');
    await preloadIdbMirror();
    const restartedStorage = await import('../storage');
    expect(restartedStorage.readJson(targetKey, null)).toEqual({ personalInfo: { fullName: 'Testowy Kandydat' } });
  });
});
