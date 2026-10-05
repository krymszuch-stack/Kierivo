import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as storage from '../../lib/storage';
import type { JobApplication } from '../../types';
import { applicationsKeyFor, readJson, resetLastGoodCache, StorageKeys, writeJson } from '../../lib/storage';
import { MemoryStorage } from '../../lib/__tests__/helpers/memoryStorage';
import {
  claimLegacyApplicationsFor,
  loadApplicationsFor,
  loadUnassignedLegacyApplications,
  saveApplicationsFor,
} from '../useApplications';

const application = (id: string, company: string): JobApplication => ({
  id,
  company,
  position: 'Stanowisko testowe',
  salary: '',
  date: '2026-09-10',
  status: 'Wysłana',
});

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  resetLastGoodCache();
});

describe('Izolacja historii Pipeline', () => {
  it('nie usuwa odmiennej aplikacji o identycznym ID', async () => {
    const doc = application('collision', 'Firma syntetyczna');
    writeJson(applicationsKeyFor('collision-target'), [doc]);
    writeJson(StorageKeys.applications, [{ ...doc, notes: 'Notatka wyłącznie w źródle' }]);
    const source = localStorage.getItem(StorageKeys.applications);
    const target = localStorage.getItem(applicationsKeyFor('collision-target'));
    expect(await claimLegacyApplicationsFor('collision-target')).toBe(0);
    expect(localStorage.getItem(StorageKeys.applications)).toBe(source);
    expect(localStorage.getItem(applicationsKeyFor('collision-target'))).toBe(target);
  });
  it('nie zastępuje nieczytelnej historii docelowej starszymi aplikacjami', async () => {
    writeJson(StorageKeys.applications, [application('legacy-target-corrupt', 'Firma syntetyczna')]);
    const source = localStorage.getItem(StorageKeys.applications);
    localStorage.setItem(applicationsKeyFor('target-unreadable'), '{uszkodzone');
    expect(await claimLegacyApplicationsFor('target-unreadable')).toBe(0);
    expect(localStorage.getItem(applicationsKeyFor('target-unreadable'))).toBe('{uszkodzone');
    expect(localStorage.getItem(StorageKeys.applications)).toBe(source);
  });
  it.each(['przed', 'podczas'])('nie usuwa uszkodzonej historii legacy mimo kopii w pamięci: %s', async moment => {
    writeJson(StorageKeys.applications, [application('legacy-corrupt', 'Firma syntetyczna')]);
    const corrupt = () => localStorage.setItem(StorageKeys.applications, '{uszkodzone');
    const original = storage.writeJsonDurably;
    const spy = vi.spyOn(storage, 'writeJsonDurably').mockImplementation(async (key, value) => {
      const saved = await original(key, value);
      if (moment === 'podczas') corrupt();
      return saved;
    });
    try {
      if (moment === 'przed') corrupt();
      expect(await claimLegacyApplicationsFor('target-corrupt-' + moment)).toBe(0);
      expect(localStorage.getItem(StorageKeys.applications)).toBe('{uszkodzone');
    } finally { spy.mockRestore(); }
  });
  it('zachowuje jedyną kopię legacy przy odmowie zapisu historii', async () => {
    writeJson(StorageKeys.applications, [application('legacy-failure', 'Firma syntetyczna')]);
    const source = localStorage.getItem(StorageKeys.applications);
    const originalSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => { if (key === applicationsKeyFor('target-failure')) throw new Error('Odmowa zapisu syntetyczna'); originalSet(key, value); };
    expect(await claimLegacyApplicationsFor('target-failure')).toBe(0);
    expect(localStorage.getItem(StorageKeys.applications)).toBe(source);
  });

  it('nie usuwa nowego wadliwego wpisu dodanego do źródła podczas zapisu', async () => {
    const legacy = application('legacy-change', 'Firma syntetyczna');
    writeJson(StorageKeys.applications, [legacy]);
    const changed = [legacy, null];
    const spy = vi.spyOn(storage, 'writeJsonDurably').mockImplementationOnce(async () => { writeJson(StorageKeys.applications, changed); return true; });
    try {
      expect(await claimLegacyApplicationsFor('target-change')).toBe(0);
      expect(readJson(StorageKeys.applications, [])).toEqual(changed);
    } finally { spy.mockRestore(); }
  });
  it('dwa profile zapisują i odczytują wyłącznie własne aplikacje', () => {
    const profilA = 'local-profil-a';
    const profilB = 'local-profil-b';

    saveApplicationsFor(profilA, [application('a-1', 'Firma A')]);
    saveApplicationsFor(profilB, [application('b-1', 'Firma B')]);

    expect(loadApplicationsFor(profilA).map((entry) => entry.company)).toEqual(['Firma A']);
    expect(loadApplicationsFor(profilB).map((entry) => entry.company)).toEqual(['Firma B']);
    expect(readJson<JobApplication[]>(applicationsKeyFor(profilA), [])).toHaveLength(1);
    expect(readJson<JobApplication[]>(applicationsKeyFor(profilB), [])).toHaveLength(1);
  });

  it('zachowuje dawną wspólną historię do czasu świadomego przypisania', async () => {
    const profil = 'local-profil-a';
    saveApplicationsFor(profil, [application('a-1', 'Nowa historia')]);
    writeJson(StorageKeys.applications, [application('legacy-1', 'Starsza historia')]);

    expect(loadApplicationsFor(profil).map((entry) => entry.company)).toEqual(['Nowa historia']);
    expect(loadUnassignedLegacyApplications().map((entry) => entry.company)).toEqual(['Starsza historia']);

    expect(await claimLegacyApplicationsFor(profil)).toBe(1);
    expect(loadApplicationsFor(profil).map((entry) => entry.company)).toEqual(['Nowa historia', 'Starsza historia']);
    expect(loadUnassignedLegacyApplications()).toEqual([]);
  });
});
