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
    delayDeleteMs?: number;
    holdPutCompletion?: (release: () => void) => void;
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
      const request = <T>(operation: () => T, delayMs = 0, holdCompletion = false) => {
        const result: {
          result?: T;
          onsuccess: (() => void) | null;
          onerror: (() => void) | null;
        } = { onsuccess: null, onerror: null };
        const complete = () => {
          try {
            result.result = operation();
            result.onsuccess?.();
            const finish = () => queueMicrotask(() => tx.oncomplete?.());
            if (holdCompletion && options.holdPutCompletion) options.holdPutCompletion(finish);
            else finish();
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
        }, 0, true),
        delete: (key: string) => request(() => {
          if (options.failDelete) throw new Error('synthetic IndexedDB delete failure');
          records.delete(key);
          return undefined;
        }, options.delayDeleteMs),
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
  it.each(['clear', 'remove'] as const)('zwalnia blokadę zapisu także po błędzie usuwania: %s', async action => {
    const key = 'cvelocity:vault:synthetic-delete-failure';
    const records = new Map<string, string>();
    vi.stubGlobal('indexedDB', makeIndexedDb(records, { failClear: true, failDelete: true }));
    const idb = await import('../idbFallback');
    const deletion = action === 'clear' ? idb.idbBackupClearAllDurably() : idb.idbBackupRemoveDurably([key]);
    expect(await idb.idbBackupSetDurably(key, 'zapis w trakcie')).toBe(false);
    expect(await deletion).toBe(false);
    expect(await idb.idbBackupSetDurably(key, 'zapis po błędzie')).toBe(true);
    expect(records.get(key)).toBe('zapis po błędzie');
  });

  it.each(['clear', 'remove'] as const)('blokuje nowe zapisy przez cały czas usuwania: %s', async action => {
    const key = 'cvelocity:vault:synthetic-deleting';
    const records = new Map([[key, 'stare dane']]);
    vi.stubGlobal('indexedDB', makeIndexedDb(records, { delayClearMs: 30, delayDeleteMs: 30 }));
    const idb = await import('../idbFallback');
    const deletion = action === 'clear' ? idb.idbBackupClearAllDurably() : idb.idbBackupRemoveDurably([key]);
    expect(await idb.idbBackupSetDurably(key, 'spóźniony autosave')).toBe(false);
    expect(await idb.idbBackupSet(key, 'kolejny autosave')).toBe(false);
    expect(await deletion).toBe(true);
    expect(records.has(key)).toBe(false);
    expect(idb.idbBackupGetPreferred(key)).toBeNull();
    expect(await idb.idbBackupSetDurably(key, 'nowa sesja')).toBe(true);
    expect(records.get(key)).toBe('nowa sesja');
  });

  it('blokuje localStorage, sessionStorage i cache JSON podczas usuwania zakresu profilu', async () => {
    const records = new Map<string, string>();
    vi.stubGlobal('localStorage', new MemoryStorage());
    vi.stubGlobal('sessionStorage', new MemoryStorage());
    vi.stubGlobal('indexedDB', makeIndexedDb(records, { delayDeleteMs: 30 }));
    const storage = await import('../storage');
    const key = storage.profileDataKeyFor(storage.StorageKeys.applications, 'anonymous');
    const other = storage.profileDataKeyFor(storage.StorageKeys.applications, 'local-other');
    const deletion = storage.clearProfileStorageDurably('anonymous');
    storage.writeJson(key, ['spóźniony autosave']);
    storage.writeRaw(key, 'kolejny autosave');
    storage.writeSessionJson(key, ['rozmowa']);
    expect(await storage.writeJsonDurably(key, ['spóźniony trwały zapis'])).toBe(false);
    storage.writeJson(other, ['inny profil']);
    expect(storage.readJson(other, null)).toEqual(['inny profil']);
    expect(await deletion).toBe(true);
    expect(localStorage.getItem(key)).toBeNull();
    expect(sessionStorage.getItem(key)).toBeNull();
    expect(storage.readJson(key, null)).toBeNull();
    await vi.waitFor(() => expect(records.has(`${key}:last-good`)).toBe(false));
  });

  it.each(['clear', 'remove', 'newer'] as const)('nie publikuje spóźnionego potwierdzenia zapisu po operacji: %s', async (action) => {
    const key = 'cvelocity:vault:synthetic-completed-write';
    const records = new Map<string, string>();
    let release: () => void = () => undefined;
    let notify: () => void = () => undefined;
    const committed = new Promise<void>(resolve => { notify = resolve; });
    let first = true;
    vi.stubGlobal('indexedDB', makeIndexedDb(records, {
      holdPutCompletion: finish => {
        if (first) { first = false; release = finish; notify(); }
        else finish();
      },
    }));
    const idb = await import('../idbFallback');
    const pending = idb.idbBackupSetDurably(key, 'stary zapis');
    await committed;
    expect(records.get(key)).toBe('stary zapis');
    if (action === 'clear') await idb.idbBackupClearAllDurably();
    else if (action === 'remove') await idb.idbBackupRemoveDurably([key]);
    else expect(await idb.idbBackupSetDurably(key, 'nowszy zapis')).toBe(true);
    release();
    expect(await pending).toBe(false);
    expect(idb.idbBackupGetPreferred(key)).toBe(action === 'newer' ? 'nowszy zapis' : null);
    expect(records.get(key)).toBe(action === 'newer' ? 'nowszy zapis' : undefined);
  });

  it.each([
    ['clear', false], ['remove', false], ['newer', false],
    ['clear', true], ['remove', true], ['newer', true],
  ] as const)('odrzuca zapis unieważniony przed otwarciem bazy: %s, trwały=%s', async (action, durable) => {
    const key = 'cvelocity:vault:synthetic-pending-write';
    const records = new Map<string, string>();
    vi.stubGlobal('indexedDB', makeIndexedDb(records));
    const idb = await import('../idbFallback');
    const pending = durable ? idb.idbBackupSetDurably(key, 'stary zapis') : idb.idbBackupSet(key, 'stary zapis');
    if (action === 'clear') await idb.idbBackupClearAllDurably();
    else if (action === 'remove') await idb.idbBackupRemoveDurably([key]);
    else expect(await idb.idbBackupSetDurably(key, 'nowszy zapis')).toBe(true);
    expect(await pending).toBe(false);
    expect(idb.idbBackupGetPreferred(key)).toBe(action === 'newer' ? 'nowszy zapis' : null);
    expect(records.get(key)).toBe(action === 'newer' ? 'nowszy zapis' : undefined);
  });

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

  it('odtwarza ostatni poprawny envelope po korupcji localStorage i zimnym starcie', async () => {
    const records = new Map<string, string>();
    const local = new MemoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('indexedDB', makeIndexedDb(records));

    const { writeJson } = await import('../storage');
    const recoveryKey = 'cvelocity:applications:recovery-test';
    writeJson(recoveryKey, [{ id: 'application-old', company: 'Poprzednia wersja' }]);
    await vi.waitFor(() => expect(records.has(`${recoveryKey}:last-good`)).toBe(true));
    writeJson(recoveryKey, [{ id: 'application-new', company: 'Najnowsza wersja' }]);
    await vi.waitFor(() => {
      const copy = records.get(`${recoveryKey}:last-good`);
      expect(copy).toBeDefined();
      expect(JSON.parse(copy!).data).toContain('application-old');
    });
    const currentEnvelope = JSON.parse(local.getItem(recoveryKey)!) as { data: string; crc: string };
    currentEnvelope.data = currentEnvelope.data.replace('Najnowsza wersja', 'Uszkodzona wersja');
    local.setItem(recoveryKey, JSON.stringify(currentEnvelope));

    vi.resetModules();
    const { preloadIdbMirror: preloadRecovery } = await import('../idbFallback');
    await preloadRecovery();
    const restartedStorage = await import('../storage');
    expect(restartedStorage.readJson(recoveryKey, null)).toEqual([
      { id: 'application-old', company: 'Poprzednia wersja' },
    ]);
    expect(JSON.parse(local.getItem(recoveryKey)!).data).toContain('application-old');

    vi.resetModules();
  });

  it('po przekroczeniu limitu nie odczytuje starego localStorage i odzyskuje nową treść po restarcie', async () => {
    const records = new Map<string, string>();
    const local = new MemoryStorage();
    vi.stubGlobal('localStorage', local);
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
    const { createEmptyVault } = await import('../sampleVault');
    const sourceKeys = [
      vaultKeyFor('anonymous'),
      applicationsKeyFor('anonymous'),
      cvLibraryKeyFor('anonymous'),
    ];
    writeJson(sourceKeys[0], createEmptyVault('Testowy Kandydat', ''));
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
    const { createEmptyVault } = await import('../sampleVault');
    const sourceKey = vaultKeyFor('anonymous');
    const expectedVault = createEmptyVault('Testowy Kandydat', '');
    writeJson(sourceKey, expectedVault);
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
    expect(restartedStorage.readJson(targetKey, null)).toEqual(expectedVault);
  });

  it('po restarcie odzyskuje poprzedni zapis z IndexedDB, gdy envelope localStorage ma błędną sumę', async () => {
    const records = new Map<string, string>();
    const local = new MemoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('indexedDB', makeIndexedDb(records));

    const { writeJson } = await import('../storage');
    const key = 'cvelocity:applications:local-synthetic-recovery';
    writeJson(key, [{ id: 'older', company: 'Example One' }]);
    writeJson(key, [{ id: 'newer', company: 'Example Two' }]);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const damaged = JSON.parse(local.getItem(key)!) as { data: string };
    damaged.data = damaged.data.replace('newer', 'corrupt');
    local.setItem(key, JSON.stringify(damaged));

    vi.resetModules();
    const { preloadIdbMirror } = await import('../idbFallback');
    await preloadIdbMirror();
    const restartedStorage = await import('../storage');

    expect(restartedStorage.readJson(key, null)).toEqual([{ id: 'older', company: 'Example One' }]);
    expect(local.getItem(key)).not.toBeNull();
  });
});
