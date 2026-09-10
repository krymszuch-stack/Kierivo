import { beforeEach, describe, expect, it } from 'vitest';
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

  it('zachowuje dawną wspólną historię do czasu świadomego przypisania', () => {
    const profil = 'local-profil-a';
    saveApplicationsFor(profil, [application('a-1', 'Nowa historia')]);
    writeJson(StorageKeys.applications, [application('legacy-1', 'Starsza historia')]);

    expect(loadApplicationsFor(profil).map((entry) => entry.company)).toEqual(['Nowa historia']);
    expect(loadUnassignedLegacyApplications().map((entry) => entry.company)).toEqual(['Starsza historia']);

    expect(claimLegacyApplicationsFor(profil)).toBe(1);
    expect(loadApplicationsFor(profil).map((entry) => entry.company)).toEqual(['Nowa historia', 'Starsza historia']);
    expect(loadUnassignedLegacyApplications()).toEqual([]);
  });
});
