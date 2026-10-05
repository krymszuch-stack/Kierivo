import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as storage from '../storage';
import {
  claimLegacyCVsFor,
  getSavedCVs,
  getUnassignedLegacyCVs,
  migrateAnonymousCVLibrary,
  saveCV,
  updateCV,
  duplicateCV,
  deleteCV,
  recordDownload,
  addTag,
  removeTag,
  PRESET_TAGS,
} from '../cvLibraryStorage';
import { createEmptyVault } from '../sampleVault';
import { MemoryStorage } from './helpers/memoryStorage';
import { cvLibraryKeyFor, readJson, resetLastGoodCache, StorageKeys, writeJson } from '../storage';

describe('cvLibraryStorage Suite (CV Library & Token Protection)', () => {
  const PROFILE = 'local-profile-test';
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
    resetLastGoodCache();
  });

  it('nie traktuje nieczytelnego źródła migracji jak pustej biblioteki', async () => {
    localStorage.setItem(cvLibraryKeyFor('broken-source'), '{uszkodzony-json');
    expect(await migrateAnonymousCVLibrary('broken-source', 'target-broken')).toBe(false);
    expect(localStorage.getItem(cvLibraryKeyFor('broken-source'))).toBe('{uszkodzony-json');
  });

  it('migracja anonimowa zachowuje wadliwe wpisy obu list bez wyjątku', async () => {
    writeJson(cvLibraryKeyFor('raw-source'), [null, { title: 'Wpis bez ID' }]);
    writeJson(cvLibraryKeyFor('raw-target'), [42]);
    expect(await migrateAnonymousCVLibrary('raw-source', 'raw-target')).toBe(true);
    expect(readJson(cvLibraryKeyFor('raw-target'), [])).toEqual([42, null, { title: 'Wpis bez ID' }]);
    expect(localStorage.getItem(cvLibraryKeyFor('raw-source'))).toBeNull();
  });

  it.each(['legacy', 'anonymous'])('nie usuwa odmiennego CV o identycznym ID: %s', async mode => {
    const doc = saveCV('collision-target', { title: 'Wersja docelowa', tags: [], theme: 'classic', layout: 'sidebar', targetPages: 1, vault: createEmptyVault('Profil syntetyczny') });
    const sourceKey = mode === 'legacy' ? StorageKeys.cvLibrary : cvLibraryKeyFor('collision-source');
    writeJson(sourceKey, [{ ...doc, title: 'Wersja źródłowa' }]);
    const source = localStorage.getItem(sourceKey);
    const target = localStorage.getItem(cvLibraryKeyFor('collision-target'));
    if (mode === 'legacy') expect(await claimLegacyCVsFor('collision-target')).toBe(0);
    else expect(await migrateAnonymousCVLibrary('collision-source', 'collision-target')).toBe(false);
    expect(localStorage.getItem(sourceKey)).toBe(source);
    expect(localStorage.getItem(cvLibraryKeyFor('collision-target'))).toBe(target);
  });

  it.each(['przed', 'podczas'])('nie usuwa uszkodzonego źródła legacy mimo kopii w pamięci: %s', async moment => {
    const valid = saveCV('source-corrupt', { title: 'CV syntetyczne', tags: [], theme: 'classic', layout: 'sidebar', targetPages: 1, vault: createEmptyVault('Profil syntetyczny') });
    writeJson(StorageKeys.cvLibrary, [valid]);
    const corrupt = () => localStorage.setItem(StorageKeys.cvLibrary, '{uszkodzone');
    const original = storage.writeJsonDurably;
    const spy = vi.spyOn(storage, 'writeJsonDurably').mockImplementation(async (key, value) => {
      const saved = await original(key, value);
      if (moment === 'podczas') corrupt();
      return saved;
    });
    try {
      if (moment === 'przed') corrupt();
      expect(await claimLegacyCVsFor('target-corrupt')).toBe(0);
      expect(localStorage.getItem(StorageKeys.cvLibrary)).toBe('{uszkodzone');
    } finally { spy.mockRestore(); }
  });

  it('zachowuje jedyną kopię legacy przy odmowie zapisu przypisanej biblioteki', async () => {
    const valid = saveCV('source-failure', { title: 'CV syntetyczne', tags: [], theme: 'classic', layout: 'sidebar', targetPages: 1, vault: createEmptyVault('Profil syntetyczny') });
    writeJson(StorageKeys.cvLibrary, [valid]);
    const source = localStorage.getItem(StorageKeys.cvLibrary);
    const originalSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => { if (key === cvLibraryKeyFor('target-failure')) throw new Error('Odmowa zapisu syntetyczna'); originalSet(key, value); };
    expect(await claimLegacyCVsFor('target-failure')).toBe(0);
    expect(localStorage.getItem(StorageKeys.cvLibrary)).toBe(source);
  });

  it('nie zastępuje nieczytelnej biblioteki docelowej starszymi CV', async () => {
    const valid = saveCV('source-target-corrupt', { title: 'CV syntetyczne', tags: [], theme: 'classic', layout: 'sidebar', targetPages: 1, vault: createEmptyVault('Profil syntetyczny') });
    writeJson(StorageKeys.cvLibrary, [valid]);
    const source = localStorage.getItem(StorageKeys.cvLibrary);
    localStorage.setItem(cvLibraryKeyFor('target-unreadable'), '{uszkodzone');
    expect(await claimLegacyCVsFor('target-unreadable')).toBe(0);
    expect(localStorage.getItem(cvLibraryKeyFor('target-unreadable'))).toBe('{uszkodzone');
    expect(localStorage.getItem(StorageKeys.cvLibrary)).toBe(source);
  });

  it('nie usuwa źródła zmienionego podczas oczekiwania na zapis', async () => {
    const valid = saveCV('source-change', { title: 'CV syntetyczne', tags: [], theme: 'classic', layout: 'sidebar', targetPages: 1, vault: createEmptyVault('Profil syntetyczny') });
    writeJson(StorageKeys.cvLibrary, [valid]);
    const changed = [{ ...valid, title: 'Nowsza wersja źródła' }];
    const spy = vi.spyOn(storage, 'writeJsonDurably').mockImplementationOnce(async () => { writeJson(StorageKeys.cvLibrary, changed); return true; });
    try {
      expect(await claimLegacyCVsFor('target-change')).toBe(0);
      expect(readJson(StorageKeys.cvLibrary, [])).toEqual(changed);
    } finally { spy.mockRestore(); }
  });

  it('migracja anonimowej biblioteki nie usuwa nowszej wersji źródła', async () => {
    const valid = saveCV('anonymous-race', { title: 'Starsze CV', tags: [], theme: 'classic', layout: 'sidebar', targetPages: 1, vault: createEmptyVault('Profil syntetyczny') });
    const changed = [{ ...valid, title: 'Nowsze CV' }];
    const spy = vi.spyOn(storage, 'writeJsonDurably').mockImplementationOnce(async () => { writeJson(cvLibraryKeyFor('anonymous-race'), changed); return true; });
    try {
      expect(await migrateAnonymousCVLibrary('anonymous-race', 'target-anonymous-race')).toBe(false);
      expect(readJson(cvLibraryKeyFor('anonymous-race'), [])).toEqual(changed);
    } finally { spy.mockRestore(); }
  });

  it('nie proponuje etykiety sugerujacej zewnetrzna weryfikacje ATS', () => {
    expect(PRESET_TAGS).toContain('Analiza ATS Kierivo');
    expect(PRESET_TAGS).not.toContain('Zweryfikowane ATS');
  });

  it('pomija wadliwe rekordy lokalne i zachowuje poprawny dokument biblioteki', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const valid = saveCV(PROFILE, {
      title: 'CV testowe', tags: ['IT'], theme: 'cobalt', layout: 'sidebar', targetPages: 1, vault,
    });
    writeJson(cvLibraryKeyFor(PROFILE), [valid, { ...valid, id: 'broken-tags', tags: null }, null]);

    expect(getSavedCVs(PROFILE).map((document) => document.id)).toEqual([valid.id]);
  });

  it('nie usuwa legacy biblioteki, gdy przypisanie musiałoby pominąć wadliwy wpis', async () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const valid = saveCV('legacy-source', {
      title: 'CV do przypisania', tags: ['IT'], theme: 'cobalt', layout: 'sidebar', targetPages: 1, vault,
    });
    const legacy = [valid, { ...valid, id: 'bad-legacy', tags: null }];
    writeJson(StorageKeys.cvLibrary, legacy);

    expect(await claimLegacyCVsFor('local-target')).toBe(0);
    expect(readJson<unknown>(StorageKeys.cvLibrary, null)).toEqual(legacy);
    expect(getSavedCVs('local-target')).toEqual([]);
  });

  it('zapisuje nową wersję CV i nadaje unikalny identyfikator oraz znaczniki czasu', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const doc = saveCV(PROFILE, {
      title: 'Automatyk Siemens - KGHM',
      tags: ['Automatyka', '1-stronicowe'],
      theme: 'cobalt',
      layout: 'sidebar',
      targetPages: 1,
      targetRole: 'Inżynier Automatyk',
      companyName: 'KGHM',
      vault,
    });

    expect(doc.id).toMatch(/^cv_/);
    expect(doc.title).toBe('Automatyk Siemens - KGHM');
    expect(doc.tags).toEqual(['Automatyka', '1-stronicowe']);
    expect(doc.downloadCount).toBe(0);

    const all = getSavedCVs(PROFILE);
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(doc.id);
  });

  it('umożliwia duplikację wersji CV z nowym tytułem (klonowanie pod inną ofertę)', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const original = saveCV(PROFILE, {
      title: 'Wersja Bazowa UR',
      tags: ['Utrzymanie Ruchu'],
      theme: 'parchment',
      layout: 'sidebar',
      targetPages: 1,
      vault,
    });

    const clone = duplicateCV(PROFILE, original.id, 'Wersja pod Fabrykę Baterii');
    expect(clone).not.toBeNull();
    expect(clone!.id).not.toBe(original.id);
    expect(clone!.title).toBe('Wersja pod Fabrykę Baterii');
    expect(clone!.tags).toEqual(['Utrzymanie Ruchu']);
    expect(clone!.theme).toBe('parchment');

    const all = getSavedCVs(PROFILE);
    expect(all.length).toBe(2);
  });

  it('wspiera dodawanie, usuwanie i unikalność tagów', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const doc = saveCV(PROFILE, {
      title: 'CV Test',
      tags: ['Automatyka'],
      theme: 'blueprint',
      layout: 'sidebar',
      targetPages: 1,
      vault,
    });

    addTag(PROFILE, doc.id, 'Robotyka');
    // Duplikat nie powinien się dodać
    addTag(PROFILE, doc.id, 'Robotyka');

    let updated = getSavedCVs(PROFILE).find((d) => d.id === doc.id);
    expect(updated?.tags).toEqual(['Automatyka', 'Robotyka']);

    removeTag(PROFILE, doc.id, 'Automatyka');
    updated = getSavedCVs(PROFILE).find((d) => d.id === doc.id);
    expect(updated?.tags).toEqual(['Robotyka']);
  });

  it('aktualizuje tytuł i tagi za pomocą updateCV', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const doc = saveCV(PROFILE, {
      title: 'Stary Tytuł',
      tags: ['Automatyka'],
      theme: 'classic',
      layout: 'sidebar',
      targetPages: 1,
      vault,
    });

    const res = updateCV(PROFILE, doc.id, { title: 'Nowy Tytuł', tags: ['Robotyka', 'Wersja EN'] });
    expect(res).not.toBeNull();
    expect(res?.title).toBe('Nowy Tytuł');
    expect(res?.tags).toEqual(['Robotyka', 'Wersja EN']);

    const all = getSavedCVs(PROFILE);
    expect(all[0].title).toBe('Nowy Tytuł');
  });

  it('zlicza ponowne pobrania bez utraty dokumentu', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const doc = saveCV(PROFILE, {
      title: 'CV Gotowe do wysyłki',
      tags: ['Wysłane'],
      theme: 'classic',
      layout: 'sidebar',
      targetPages: 1,
      vault,
    });

    expect(doc.downloadCount).toBe(0);
    recordDownload(PROFILE, doc.id);
    recordDownload(PROFILE, doc.id);

    const updated = getSavedCVs(PROFILE).find((d) => d.id === doc.id);
    expect(updated?.downloadCount).toBe(2);
    expect(updated?.lastExportedAt).toBeDefined();
  });

  it('usuwa dokument z biblioteki', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const doc = saveCV(PROFILE, {
      title: 'Do usunięcia',
      tags: [],
      theme: 'classic',
      layout: 'sidebar',
      targetPages: 1,
      vault,
    });

    expect(getSavedCVs(PROFILE).length).toBe(1);
    const deleted = deleteCV(PROFILE, doc.id);
    expect(deleted).toBe(true);
    expect(getSavedCVs(PROFILE).length).toBe(0);
  });

  it('oddziela dokumenty profili i nie przypisuje wspólnej biblioteki bez zgody', async () => {
    const jan = createEmptyVault('Jan Nowak');
    const anna = createEmptyVault('Anna Nowak');
    const base = { tags: [], theme: 'classic', layout: 'sidebar', targetPages: 1 as const };
    saveCV('local-jan', { ...base, title: 'Jan — prywatne CV', vault: jan });
    saveCV('local-anna', { ...base, title: 'Anna — prywatne CV', vault: anna });
    const legacy = saveCV('legacy', { ...base, title: 'Stare CV', vault: jan });
    const rawLegacy = getSavedCVs('legacy');
    // Symuluje starą wersję, która zapisywała wspólną tablicę pod kluczem globalnym.
    writeJson(StorageKeys.cvLibrary, rawLegacy);

    expect(getSavedCVs('local-jan').map((doc) => doc.title)).toEqual(['Jan — prywatne CV']);
    expect(getSavedCVs('local-anna').map((doc) => doc.title)).toEqual(['Anna — prywatne CV']);
    expect(getUnassignedLegacyCVs()).toHaveLength(1);
    expect(await claimLegacyCVsFor('local-anna')).toBe(1);
    expect(getSavedCVs('local-anna').map((doc) => doc.title)).toEqual(['Anna — prywatne CV', 'Stare CV']);
    expect(getUnassignedLegacyCVs()).toEqual([]);
    expect(legacy.id).toBeTruthy();
  });

  it('przenosi bibliotekę anonimową tylko do nowo tworzonego profilu', async () => {
    const vault = createEmptyVault('Anonim');
    const base = { tags: [], theme: 'classic', layout: 'sidebar', targetPages: 1 as const };
    saveCV('anonymous', { ...base, title: 'Moje CV', vault });
    expect(await migrateAnonymousCVLibrary('anonymous', 'local-created')).toBe(true);

    expect(getSavedCVs('anonymous')).toEqual([]);
    expect(getSavedCVs('local-created').map((doc) => doc.title)).toEqual(['Moje CV']);
  });
});
