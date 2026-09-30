import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyVault } from '../sampleVault';
import { enqueueCloudVaultSave } from '../cloudVaultOutbox';
import { resetLastGoodCache } from '../storage';
import { MemoryStorage } from './helpers/memoryStorage';

const mocks = vi.hoisted(() => ({ client: null as unknown }));

vi.mock('../supabaseClient', () => ({
  getSupabaseBrowserClient: () => mocks.client,
}));

import { saveCloudVault } from '../cloudVault';

describe('saveCloudVault — właściciel sesji', () => {
  beforeEach(() => {
    mocks.client = null;
    vi.stubGlobal('localStorage', new MemoryStorage());
    resetLastGoodCache();
  });

  afterEach(() => vi.unstubAllGlobals());

  it('przerywa zapis, jeśli sesja zmieniła się po rozpoczęciu scalania konta', async () => {
    const from = vi.fn();
    mocks.client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'konto-b' } } } }) },
      from,
    };

    await expect(saveCloudVault(createEmptyVault('Profil konta A'), 'konto-a', null))
      .rejects.toThrow('Sesja zmieniła właściciela');
    expect(from).not.toHaveBeenCalled();
  });

  it('zapisuje Vault tylko pod ID z potwierdzonej sesji', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { updated_at: 'rev-2' }, error: null });
    const eqUpdatedAt = vi.fn().mockReturnValue({ select: () => ({ maybeSingle }) });
    const eqOwner = vi.fn().mockReturnValue({ eq: eqUpdatedAt });
    const update = vi.fn().mockReturnValue({ eq: eqOwner });
    const from = vi.fn().mockReturnValue({ update });
    mocks.client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'konto-a' } } } }) },
      from,
    };

    await saveCloudVault(createEmptyVault('Profil konta A'), 'konto-a', 'rev-1');

    expect(from).toHaveBeenCalledWith('vaults');
    expect(update.mock.calls[0][0]).toMatchObject({ data: expect.any(Object) });
    expect(eqOwner).toHaveBeenCalledWith('user_id', 'konto-a');
    expect(eqUpdatedAt).toHaveBeenCalledWith('updated_at', 'rev-1');
  });

  it('zatrzymuje zapis, gdy rewizja w chmurze zmieniła się po odczycie', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqUpdatedAt = vi.fn().mockReturnValue({ select: () => ({ maybeSingle }) });
    const eqOwner = vi.fn().mockReturnValue({ eq: eqUpdatedAt });
    const update = vi.fn().mockReturnValue({ eq: eqOwner });
    mocks.client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'konto-a' } } } }) },
      from: vi.fn().mockReturnValue({ update }),
    };

    await expect(saveCloudVault(createEmptyVault('Stara kopia'), 'konto-a', 'rev-1'))
      .rejects.toThrow('CV zmieniło się na innym urządzeniu');
    expect(eqUpdatedAt).toHaveBeenCalledWith('updated_at', 'rev-1');
  });

  it('wykrywa wyścig dwóch urządzeń zakładających nowy wiersz Vaultu', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    mocks.client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'konto-a' } } } }) },
      from: vi.fn().mockReturnValue({ insert }),
    };

    await expect(saveCloudVault(createEmptyVault('Równoległy zapis'), 'konto-a', null))
      .rejects.toThrow('CV zmieniło się na innym urządzeniu');
    expect(insert.mock.calls[0][0]).toMatchObject({ user_id: 'konto-a' });
  });

  it('przy tej samej rewizji zachowuje cały pending, także usunięcie umiejętności', async () => {
    const remote = createEmptyVault('Profil z innego urządzenia');
    remote.skillsMatrix.hardSkills = ['Linux', 'Windows 11'];
    remote.history = [{
      id: 'remote-history', company: 'Firma z chmury', role: 'Technik', location: '',
      startDate: '2020-01', endDate: '2021-01', isCurrent: false, highlights: [],
    }];
    const pending = createEmptyVault('Lokalny użytkownik');
    pending.personalInfo.summary = 'Nowsze podsumowanie offline.';
    pending.skillsMatrix.hardSkills = ['Windows 11'];
    enqueueCloudVaultSave('konto-a', pending, { baseUpdatedAt: 'rev-2' });

    const maybeSingle = vi.fn().mockResolvedValue({ data: { data: remote, updated_at: 'rev-2' }, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const from = vi.fn().mockReturnValue({ select });
    mocks.client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'konto-a' } } } }) },
      from,
    };

    const snapshot = await (await import('../cloudVault')).fetchCloudVault();

    expect(snapshot.remoteReadSucceeded).toBe(true);
    expect(snapshot.remoteUpdatedAt).toBe('rev-2');
    expect(snapshot.vault?.personalInfo.summary).toBe('Nowsze podsumowanie offline.');
    expect(snapshot.vault?.skillsMatrix.hardSkills).toEqual(['Windows 11']);
    expect(snapshot.vault?.history).toHaveLength(0);
    expect(snapshot.pendingConflict).toBe(false);
  });

  it('przy innej rewizji nie skleja automatycznie nawet niezależnych list', async () => {
    const local = createEmptyVault('Lokalna wersja');
    local.skillsMatrix.hardSkills = ['Windows 11'];
    enqueueCloudVaultSave('konto-a', local, { baseUpdatedAt: 'rev-1' });
    const remote = createEmptyVault('Chmurowa wersja');
    remote.skillsMatrix.hardSkills = ['Linux'];
    const maybeSingle = vi.fn().mockResolvedValue({ data: { data: remote, updated_at: 'rev-2' }, error: null });
    mocks.client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'konto-a' } } } }) },
      from: vi.fn().mockReturnValue({ select: () => ({ maybeSingle }) }),
    };

    const snapshot = await (await import('../cloudVault')).fetchCloudVault('konto-a');
    expect(snapshot.pendingConflict).toBe(true);
    expect(snapshot.vault?.skillsMatrix.hardSkills).toEqual(['Windows 11']);
    expect(snapshot.conflictRemoteVault?.skillsMatrix.hardSkills).toEqual(['Linux']);
  });

  it('różne rewizje z kolidującą edycją zachowują lokalną i chmurową wersję osobno', async () => {
    const local = createEmptyVault('Lokalny profil');
    local.history = [{
      id: 'ten-sam-wpis', company: 'Firma Alfa', role: 'Technik', location: 'Kraków',
      startDate: '2020-01', endDate: '2024-01', isCurrent: false,
      highlights: [{ id: 'punkt', text: 'Lokalna poprawka osiągnięcia', action: '', target: '', tool: '', metric: '', keywords: [] }],
    }];
    enqueueCloudVaultSave('konto-konflikt', local, { baseUpdatedAt: 'rev-before-edit' });

    const remote = createEmptyVault('Zdalny profil');
    remote.history = [{
      ...local.history[0],
      highlights: [{ ...local.history[0].highlights[0], text: 'Zdalna poprawka osiągnięcia' }],
    }];
    const maybeSingle = vi.fn().mockResolvedValue({ data: { data: remote, updated_at: 'rev-after-other-device-edit' }, error: null });
    const from = vi.fn().mockReturnValue({ select: () => ({ maybeSingle }) });
    mocks.client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'konto-konflikt' } } } }) },
      from,
    };

    const snapshot = await (await import('../cloudVault')).fetchCloudVault('konto-konflikt');

    expect(snapshot.pendingConflict).toBe(true);
    expect(snapshot.vault?.history[0].highlights[0].text).toBe('Lokalna poprawka osiągnięcia');
    expect(snapshot.conflictRemoteVault?.history[0].highlights[0].text).toBe('Zdalna poprawka osiągnięcia');
    expect(snapshot.remoteUpdatedAt).toBe('rev-after-other-device-edit');
  });

  it('gdy rewizja pendingu i chmury jest ta sama, zachowuje lokalną edycję istniejącego wpisu', async () => {
    const local = createEmptyVault('Lokalny profil');
    local.history = [{
      id: 'wpis', company: 'Firma Alfa', role: 'Technik', location: 'Kraków',
      startDate: '2020-01', endDate: '2024-01', isCurrent: false,
      highlights: [{ id: 'punkt', text: 'Lokalna poprawka', action: '', target: '', tool: '', metric: '', keywords: [] }],
    }];
    enqueueCloudVaultSave('konto-ta-sama-rewizja', local, { baseUpdatedAt: 'rev-1' });

    const remote = createEmptyVault('Lokalny profil');
    remote.history = [{
      ...local.history[0],
      highlights: [{ ...local.history[0].highlights[0], text: 'Treść sprzed poprawki' }],
    }];
    const maybeSingle = vi.fn().mockResolvedValue({ data: { data: remote, updated_at: 'rev-1' }, error: null });
    const from = vi.fn().mockReturnValue({ select: () => ({ maybeSingle }) });
    mocks.client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'konto-ta-sama-rewizja' } } } }) },
      from,
    };

    const snapshot = await (await import('../cloudVault')).fetchCloudVault('konto-ta-sama-rewizja');

    expect(snapshot.pendingConflict).toBe(false);
    expect(snapshot.vault?.history[0].highlights[0].text).toBe('Lokalna poprawka');
  });

  it('odrzuca odczyt, jeśli właściciel zmienił się w trakcie żądania', async () => {
    const getSession = vi.fn()
      .mockResolvedValueOnce({ data: { session: { user: { id: 'konto-a' } } } })
      .mockResolvedValueOnce({ data: { session: { user: { id: 'konto-b' } } } });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { data: createEmptyVault('Profil B') }, error: null });
    const from = vi.fn().mockReturnValue({ select: () => ({ maybeSingle }) });
    mocks.client = { auth: { getSession }, from };

    await expect((await import('../cloudVault')).fetchCloudVault('konto-a'))
      .rejects.toThrow('Sesja zmieniła właściciela podczas odczytu');
  });

  it('zwraca pending jako lokalny fallback, ale oznacza niepotwierdzony odczyt chmury', async () => {
    const pending = createEmptyVault('Praca offline');
    enqueueCloudVaultSave('konto-a', pending);
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: 'offline' } });
    const from = vi.fn().mockReturnValue({ select: () => ({ maybeSingle }) });
    mocks.client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'konto-a' } } },
        }),
      },
      from,
    };

    const snapshot = await (await import('../cloudVault')).fetchCloudVault('konto-a');

    expect(snapshot.remoteReadSucceeded).toBe(false);
    expect(snapshot.vault?.personalInfo.fullName).toBe('Praca offline');
  });
});
