import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryStorage } from '../../lib/__tests__/helpers/memoryStorage';
import { profileDataKeyFor, StorageKeys, resetLastGoodCache } from '../../lib/storage';
import { createEmptyVault } from '../../lib/sampleVault';
import type { JobApplication } from '../../types';

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  // Sklepy trzymają stan w zmiennych modułowych, więc każdy test dostaje
  // świeże rejestry modułów — inaczej dane przenikałyby między testami.
  vi.resetModules();
  resetLastGoodCache();
});

const STARA_DATA = '2020-01-01T00:00:00.000Z';

const aplikacja = (nadpisane: Partial<JobApplication> = {}): JobApplication => ({
  id: 'app-1',
  company: 'Firma',
  position: 'Stanowisko',
  salary: '',
  date: '2026-01-01',
  status: 'Rozmowa',
  ...nadpisane,
});

describe('odporność sklepów na „usuń moje dane"', () => {
  it('czyszczenie jednego zakresu resetuje jego cache i zachowuje pozostały profil', async () => {
    const storage = await import('../../lib/storage');
    const milestones = await import('../milestonesStore');
    const apps = await import('../useApplications');
    milestones.markShortcutsHintSeen('anonymous');
    milestones.markShortcutsHintSeen('local-other');
    storage.writeJson(storage.applicationsKeyFor('anonymous'), [aplikacja(), null]);
    apps.loadApplicationsFor('anonymous');
    expect(await storage.clearProfileStorageDurably('anonymous')).toBe(true);
    expect(milestones.getMilestones('anonymous')).toEqual({});
    expect(milestones.getMilestones('local-other').shortcutsHintSeenAt).toBeDefined();
    apps.saveApplicationsFor('anonymous', []);
    expect(storage.readJson(storage.applicationsKeyFor('anonymous'), null)).toEqual([]);
  });
  it('wipeAppStorage powiadamia zarejestrowane sklepy; odpinięty przestaje dostawać zdarzenia', async () => {
    const storage = await import('../../lib/storage');
    const zdarzenia: string[] = [];
    const odpnij = storage.onAppStorageWiped(() => zdarzenia.push('a'));
    storage.onAppStorageWiped(() => zdarzenia.push('b'));

    storage.wipeAppStorage();
    expect(zdarzenia).toEqual(['a', 'b']);

    odpnij();
    storage.wipeAppStorage();
    expect(zdarzenia).toEqual(['a', 'b', 'b']);
  });

  it('kamienie milowe sprzed wymazania nie odradzają się przy pierwszym zapisie po nim', async () => {
    const storage = await import('../../lib/storage');
    const key = profileDataKeyFor(StorageKeys.uxMilestones, 'profile-a');
    localStorage.setItem(
      key,
      JSON.stringify({ vaultStartedAt: STARA_DATA })
    );

    const sklep = await import('../milestonesStore');
    expect(sklep.getMilestones('profile-a').vaultStartedAt).toBe(STARA_DATA);

    storage.wipeAppStorage();

    // Klucz zniknął ze schowka i kopia w pamięci też — dopiero ta para gwarantuje,
    // że kolejny zapis nie odzyska usuniętego stanu.
    expect(localStorage.getItem(key)).toBeNull();
    expect(sklep.getMilestones('profile-a')).toEqual({});

    // Regresja, którą widział ten plik przed naprawą: syncMilestones porównywał
    // się z pamięcią sprzed wymazania i odzyskiwał stare znaczniki do schowka.
    sklep.syncMilestones('profile-a', { vault: createEmptyVault(), applications: [aplikacja()] });

    const zapis = localStorage.getItem(key);
    expect(zapis).not.toBeNull();
    expect(zapis).not.toContain(STARA_DATA);
    expect(sklep.getMilestones('profile-a').vaultStartedAt).not.toBe(STARA_DATA);
  });

  it('nie przenosi odblokowań aplikacji ani podpowiedzi do drugiego profilu', async () => {
    const store = await import('../milestonesStore');
    store.syncMilestones('profile-a', { vault: createEmptyVault(), applications: [aplikacja()] });
    store.markShortcutsHintSeen('profile-a');

    expect(store.getMilestones('profile-a').firstApplicationAt).toBeDefined();
    expect(store.getMilestones('profile-a').shortcutsHintSeenAt).toBeDefined();
    expect(store.getMilestones('profile-b')).toEqual({});
  });

  it('nie zapisuje Vaultu starego profilu do nowego profilu podczas przełączenia', async () => {
    const store = await import('../milestonesStore');
    store.syncMilestonesForProfile('profile-b', 'profile-a', {
      vault: createEmptyVault(),
      applications: [aplikacja()],
    });

    expect(store.getMilestones('profile-b')).toEqual({});
  });
});
