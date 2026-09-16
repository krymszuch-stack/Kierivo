import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSavedCVs,
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
import { resetLastGoodCache } from '../storage';

describe('cvLibraryStorage Suite (CV Library & Token Protection)', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
    resetLastGoodCache();
  });

  it('zapisuje nową wersję CV i nadaje unikalny identyfikator oraz znaczniki czasu', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const doc = saveCV({
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

    const all = getSavedCVs();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(doc.id);
  });

  it('umożliwia duplikację wersji CV z nowym tytułem (klonowanie pod inną ofertę)', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const original = saveCV({
      title: 'Wersja Bazowa UR',
      tags: ['Utrzymanie Ruchu'],
      theme: 'parchment',
      layout: 'sidebar',
      targetPages: 1,
      vault,
    });

    const clone = duplicateCV(original.id, 'Wersja pod Fabrykę Baterii');
    expect(clone).not.toBeNull();
    expect(clone!.id).not.toBe(original.id);
    expect(clone!.title).toBe('Wersja pod Fabrykę Baterii');
    expect(clone!.tags).toEqual(['Utrzymanie Ruchu']);
    expect(clone!.theme).toBe('parchment');

    const all = getSavedCVs();
    expect(all.length).toBe(2);
  });

  it('wspiera dodawanie, usuwanie i unikalność tagów', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const doc = saveCV({
      title: 'CV Test',
      tags: ['Automatyka'],
      theme: 'blueprint',
      layout: 'sidebar',
      targetPages: 1,
      vault,
    });

    addTag(doc.id, 'Robotyka');
    // Duplikat nie powinien się dodać
    addTag(doc.id, 'Robotyka');

    let updated = getSavedCVs().find((d) => d.id === doc.id);
    expect(updated?.tags).toEqual(['Automatyka', 'Robotyka']);

    removeTag(doc.id, 'Automatyka');
    updated = getSavedCVs().find((d) => d.id === doc.id);
    expect(updated?.tags).toEqual(['Robotyka']);
  });

  it('aktualizuje tytuł i tagi za pomocą updateCV', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const doc = saveCV({
      title: 'Stary Tytuł',
      tags: ['Automatyka'],
      theme: 'classic',
      layout: 'sidebar',
      targetPages: 1,
      vault,
    });

    const res = updateCV(doc.id, { title: 'Nowy Tytuł', tags: ['Robotyka', 'Wersja EN'] });
    expect(res).not.toBeNull();
    expect(res?.title).toBe('Nowy Tytuł');
    expect(res?.tags).toEqual(['Robotyka', 'Wersja EN']);

    const all = getSavedCVs();
    expect(all[0].title).toBe('Nowy Tytuł');
  });

  it('zlicza ponowne pobrania bez utraty dokumentu', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const doc = saveCV({
      title: 'CV Gotowe do wysyłki',
      tags: ['Wysłane'],
      theme: 'classic',
      layout: 'sidebar',
      targetPages: 1,
      vault,
    });

    expect(doc.downloadCount).toBe(0);
    recordDownload(doc.id);
    recordDownload(doc.id);

    const updated = getSavedCVs().find((d) => d.id === doc.id);
    expect(updated?.downloadCount).toBe(2);
    expect(updated?.lastExportedAt).toBeDefined();
  });

  it('usuwa dokument z biblioteki', () => {
    const vault = createEmptyVault('Jan Nowak', 'jan@nowak.pl');
    const doc = saveCV({
      title: 'Do usunięcia',
      tags: [],
      theme: 'classic',
      layout: 'sidebar',
      targetPages: 1,
      vault,
    });

    expect(getSavedCVs().length).toBe(1);
    const deleted = deleteCV(doc.id);
    expect(deleted).toBe(true);
    expect(getSavedCVs().length).toBe(0);
  });
});
