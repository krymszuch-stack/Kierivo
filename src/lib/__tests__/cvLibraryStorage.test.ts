import { describe, it, expect, beforeEach } from 'vitest';
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
} from '../cvLibraryStorage';
import { createEmptyVault } from '../sampleVault';
import { MemoryStorage } from './helpers/memoryStorage';
import { resetLastGoodCache, StorageKeys, writeJson } from '../storage';

describe('cvLibraryStorage Suite (CV Library & Token Protection)', () => {
  const PROFILE = 'local-profile-test';
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
    resetLastGoodCache();
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

  it('oddziela dokumenty profili i nie przypisuje wspólnej biblioteki bez zgody', () => {
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
    expect(claimLegacyCVsFor('local-anna')).toBe(1);
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
