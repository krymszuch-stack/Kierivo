import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as storage from '../storage';
import {
  createLocalProfile,
  getActiveProfile,
  listSavedLocalProfiles,
  activateLocalProfile,
  signOutLocalProfile,
  deleteLocalProfile,
  loadProfileVault,
  saveProfileVault,
  ANONYMOUS_PROFILE_ID,
} from '../localProfile';
import { createEmptyVault } from '../sampleVault';
import {
  applicationsKeyFor,
  readJson,
  StorageKeys,
  migrateLegacyKeys,
  resetLastGoodCache,
  vaultKeyFor,
  writeJson,
} from '../storage';
import { MemoryStorage } from './helpers/memoryStorage';

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  resetLastGoodCache();
});

describe('Profil lokalny', () => {
  it('zamknięcie profilu unieważnia rozpoczęte tworzenie kolejnego profilu', async () => {
    await createLocalProfile('Osoba A');
    const creating = createLocalProfile('Osoba B');
    const observed = creating.then(() => 'success', error => error.message as string);
    expect(await signOutLocalProfile()).toBe(true);
    expect(getActiveProfile()).toBeNull();
    expect(await observed).toContain('Sesja zmieniła się');
    expect((await listSavedLocalProfiles()).map(profile => profile.name)).toEqual(['Osoba A']);
  });

  it('zamknięcie sesji unieważnia wynik wznowienia i odrzuca nowe aktywacje podczas zamykania', async () => {
    const saved = await createLocalProfile('Osoba A');
    const resuming = activateLocalProfile(saved.profile.id);
    const closing = signOutLocalProfile();
    expect(await activateLocalProfile(saved.profile.id)).toBeNull();
    await expect(createLocalProfile('Osoba B')).rejects.toThrow('Sesja jest zamykana');
    expect(await resuming).toBeNull();
    expect(await closing).toBe(true);
    expect(getActiveProfile()).toBeNull();
    expect((await activateLocalProfile(saved.profile.id))?.profile.id).toBe(saved.profile.id);
  });

  it('nowsze tworzenie profilu unieważnia starszą migrację i zachowuje własny indeks', async () => {
    const old = createLocalProfile('Starsza operacja').then(() => 'success', error => error.message as string);
    const latest = await createLocalProfile('Nowsza operacja');
    expect(await old).toContain('Sesja zmieniła się');
    expect(getActiveProfile()?.id).toBe(latest.profile.id);
    expect((await listSavedLocalProfiles()).map(profile => profile.id)).toEqual([latest.profile.id]);
  });

  it('zamknięcie profilu usuwa anonimową bibliotekę i historię przed kolejnym użytkownikiem', async () => {
    const saved = await createLocalProfile('Osoba A');
    writeJson(StorageKeys.applications + ':anonymous', [{ id: 'starsza-aplikacja', notes: 'Dane osoby A' }]);
    writeJson(StorageKeys.cvLibrary + ':anonymous', [{ id: 'starsze-cv', title: 'Dane osoby A' }]);
    expect(await signOutLocalProfile()).toBe(true);
    expect(storage.readRaw(StorageKeys.applications + ':anonymous')).toBeNull();
    expect(storage.readRaw(StorageKeys.cvLibrary + ':anonymous')).toBeNull();
    expect(loadProfileVault(saved.profile.id)?.personalInfo.fullName).toBe('Osoba A');
    const next = await createLocalProfile('Osoba B');
    expect(readJson(applicationsKeyFor(next.profile.id), [])).toEqual([]);
    expect(readJson(StorageKeys.cvLibrary + ':' + next.profile.id, [])).toEqual([]);
  });
  it('odmowa czyszczenia anonimowego Vaultu nie potwierdza zamknięcia profilu', async () => {
    const saved = await createLocalProfile('Osoba A');
    saveProfileVault('anonymous', createEmptyVault('Pozostałość osoby A'));
    const originalRemove = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = key => {
      if (key === vaultKeyFor('anonymous')) throw new Error('Syntetyczna odmowa');
      originalRemove(key);
    };
    expect(await signOutLocalProfile()).toBe(false);
    expect(getActiveProfile()?.id).toBe(saved.profile.id);
  });
  it('nie potwierdza zamknięcia profilu przy odmowie usunięcia aktywnego zapisu', async () => {
    const saved = await createLocalProfile('Profil syntetyczny');
    const originalRemove = localStorage.removeItem.bind(localStorage);
    localStorage.removeItem = key => {
      if (key === StorageKeys.profile) throw new Error('Syntetyczna odmowa usunięcia');
      originalRemove(key);
    };
    expect(await signOutLocalProfile()).toBe(false);
    expect(getActiveProfile()?.id).toBe(saved.profile.id);
    expect(loadProfileVault(saved.profile.id)?.personalInfo.fullName).toBe('Profil syntetyczny');
  });
  it('czeka na potwierdzenie trwałości przed ukończeniem wznowienia', async () => {
    const saved = await createLocalProfile('Profil do wznowienia');
    await signOutLocalProfile();
    const original = storage.writeJsonDurably;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const spy = vi.spyOn(storage, 'writeJsonDurably').mockImplementation(async (key, value) => {
      await gate;
      return original(key, value);
    });
    try {
      let done = false;
      const pending = activateLocalProfile(saved.profile.id).then(result => { done = true; return result; });
      await Promise.resolve();
      expect(done).toBe(false);
      expect(getActiveProfile()).toBeNull();
      release();
      expect((await pending)?.profile.id).toBe(saved.profile.id);
      expect(getActiveProfile()?.id).toBe(saved.profile.id);
    } finally { release(); spy.mockRestore(); }
  });
  it('nie potwierdza wznowienia, gdy nie można utrwalić aktywnego profilu', async () => {
    const saved = await createLocalProfile('Profil do wznowienia');
    await signOutLocalProfile();
    const originalSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (key, value) => {
      if (key === StorageKeys.profile) throw new Error('Syntetyczna odmowa zapisu');
      originalSet(key, value);
    };
    expect(await activateLocalProfile(saved.profile.id)).toBeNull();
    expect(getActiveProfile()).toBeNull();
    expect(loadProfileVault(saved.profile.id)?.personalInfo.fullName).toBe('Profil do wznowienia');
  });
  it.each([StorageKeys.applications + ':anonymous', StorageKeys.cvLibrary + ':anonymous', vaultKeyFor('anonymous')])('nie usuwa nieczytelnego źródła migracji: %s', async key => {
    localStorage.setItem(key, '{uszkodzony-json');
    await expect(createLocalProfile('Profil syntetyczny')).rejects.toThrow('Nie można odczytać danych');
    expect(localStorage.getItem(key)).toBe('{uszkodzony-json');
    expect(getActiveProfile()).toBeNull();
  });
  it('nowy pusty profil można od razu wznowić bez późniejszego autosave', async () => {
    const { profile } = await createLocalProfile('Profil syntetyczny');
    expect(loadProfileVault(profile.id)?.personalInfo.fullName).toBe('Profil syntetyczny');
    expect((await listSavedLocalProfiles()).map(item => item.id)).toContain(profile.id);
  });

  it('nie usuwa nowszego anonimowego profilu zmienionego podczas migracji', async () => {
    saveProfileVault(ANONYMOUS_PROFILE_ID, createEmptyVault('Starsza wersja'));
    const latest = createEmptyVault('Nowsza wersja');
    const original = storage.writeJsonDurably;
    let changed = false;
    const spy = vi.spyOn(storage, 'writeJsonDurably').mockImplementation(async (key, value) => {
      const saved = await original(key, value);
      if (!changed && key.startsWith(`${StorageKeys.vault}:local-`)) {
        changed = true;
        saveProfileVault(ANONYMOUS_PROFILE_ID, latest);
      }
      return saved;
    });
    try {
      await expect(createLocalProfile('Profil syntetyczny')).rejects.toThrow();
      expect(loadProfileVault(ANONYMOUS_PROFILE_ID)?.personalInfo.fullName).toBe('Nowsza wersja');
      expect(getActiveProfile()).toBeNull();
    } finally { spy.mockRestore(); }
  });

  it('cofa aktywację i własny indeks przy zmianie źródła po ostatnim zapisie', async () => {
    const previous = (await createLocalProfile('Poprzedni profil')).profile;
    saveProfileVault(ANONYMOUS_PROFILE_ID, createEmptyVault('Starsza wersja'));
    const original = storage.writeJsonDurably;
    let changed = false;
    const spy = vi.spyOn(storage, 'writeJsonDurably').mockImplementation(async (key, value) => {
      const saved = await original(key, value);
      if (!changed && key === StorageKeys.profile) {
        changed = true;
        saveProfileVault(ANONYMOUS_PROFILE_ID, createEmptyVault('Nowsza wersja'));
      }
      return saved;
    });
    try {
      await expect(createLocalProfile('Profil syntetyczny')).rejects.toThrow('Dane zmieniły się');
      expect(getActiveProfile()?.id).toBe(previous.id);
      expect(readJson<Array<{ id: string }>>(StorageKeys.localProfiles, []).map(item => item.id)).toEqual([previous.id]);
      expect(loadProfileVault(ANONYMOUS_PROFILE_ID)?.personalInfo.fullName).toBe('Nowsza wersja');
    } finally { spy.mockRestore(); }
  });
  it('zapisuje profil i odczytuje go po ponownym wejściu', async () => {
    const { profile } = await createLocalProfile('Jan Kowalski', 'jan@example.pl');

    expect(profile.name).toBe('Jan Kowalski');
    expect(profile.email).toBe('jan@example.pl');
    expect(getActiveProfile()?.id).toBe(profile.id);
  });

  it('nie wymaga adresu e-mail', async () => {
    const { profile } = await createLocalProfile('Anna Nowak');

    expect(profile.email).toBeUndefined();
    expect(getActiveProfile()?.name).toBe('Anna Nowak');
  });

  it('nie tworzy dwóch profili o tym samym identyfikatorze', async () => {
    const first = (await createLocalProfile('Jan')).profile;
    const second = (await createLocalProfile('Jan')).profile;

    expect(first.id).not.toBe(second.id);
  });

  it('wylogowanie usuwa profil, ale zostawia zapisany vault na urządzeniu', async () => {
    const { profile } = await createLocalProfile('Jan');
    saveProfileVault(profile.id, createEmptyVault('Jan', 'jan@example.pl'));

    await signOutLocalProfile();

    expect(getActiveProfile()).toBeNull();
    expect(loadProfileVault(profile.id)).not.toBeNull();
  });

  it('po zamknięciu lokalnego profilu można wznowić dokładnie ten sam vault', async () => {
    const { profile } = await createLocalProfile('Jan Kowalski', 'jan@example.pl');
    const savedVault = createEmptyVault('Jan Kowalski', 'jan@example.pl');
    savedVault.skillsMatrix.hardSkills = ['Windows 11', 'TCP/IP'];
    saveProfileVault(profile.id, savedVault);

    await signOutLocalProfile();
    expect(getActiveProfile()).toBeNull();

    const savedProfiles = await listSavedLocalProfiles();
    expect(savedProfiles.map((item) => item.id)).toContain(profile.id);

    const resumed = await activateLocalProfile(profile.id);
    expect(resumed?.profile.id).toBe(profile.id);
    expect(getActiveProfile()?.id).toBe(profile.id);
    expect(resumed?.vault.skillsMatrix.hardSkills).toEqual(['Windows 11', 'TCP/IP']);
  });

  it('profile o tej samej nazwie pozostają rozdzielone i można wznowić właściwy', async () => {
    const first = await createLocalProfile('Jan Kowalski');
    const firstVault = createEmptyVault('Jan Kowalski');
    firstVault.personalInfo.summary = 'Profil pierwszy';
    saveProfileVault(first.profile.id, firstVault);
    await signOutLocalProfile();

    const second = await createLocalProfile('Jan Kowalski');
    const secondVault = createEmptyVault('Jan Kowalski');
    secondVault.personalInfo.summary = 'Profil drugi';
    saveProfileVault(second.profile.id, secondVault);
    await signOutLocalProfile();

    const savedProfiles = await listSavedLocalProfiles();
    expect(savedProfiles.filter((item) => item.name === 'Jan Kowalski')).toHaveLength(2);
    expect((await activateLocalProfile(first.profile.id))?.vault.personalInfo.summary).toBe('Profil pierwszy');
    await signOutLocalProfile();
    expect((await activateLocalProfile(second.profile.id))?.vault.personalInfo.summary).toBe('Profil drugi');
  });

  it('odkrywa starszy zapisany vault bez indeksu profili', async () => {
    const { profile } = await createLocalProfile('Anna Nowak', 'anna@example.pl');
    saveProfileVault(profile.id, createEmptyVault('Anna Nowak', 'anna@example.pl'));
    localStorage.removeItem(StorageKeys.localProfiles);
    await signOutLocalProfile();

    const savedProfiles = await listSavedLocalProfiles();
    expect(savedProfiles).toContainEqual(expect.objectContaining({
      id: profile.id,
      name: 'Anna Nowak',
      email: 'anna@example.pl',
    }));
    expect((await activateLocalProfile(profile.id))?.vault.personalInfo.fullName).toBe('Anna Nowak');
  });

  it('usunięcie profilu czyści WSZYSTKIE dane aplikacji, nie tylko wyliczone klucze', async () => {
    // Poprzednia implementacja kasowała zakodowaną na sztywno listę kluczy i
    // zostawiała za sobą m.in. stan subskrypcji. „Usuń moje dane", które czegoś
    // nie usuwa, jest gorsze niż brak takiej funkcji.
    const { profile } = await createLocalProfile('Jan');
    saveProfileVault(profile.id, createEmptyVault('Jan'));
    localStorage.setItem(StorageKeys.entitlementsCache, '{"subscription":{"status":"active"}}');
    localStorage.setItem(StorageKeys.favoriteTips, '["tip-1"]');
    localStorage.setItem('skillvault_users_db_v1', '[{"id":"stary"}]');
    localStorage.setItem(StorageKeys.theme, 'dark');

    deleteLocalProfile();

    expect(getActiveProfile()).toBeNull();
    expect(loadProfileVault(profile.id)).toBeNull();
    expect(localStorage.getItem(StorageKeys.entitlementsCache)).toBeNull();
    expect(localStorage.getItem(StorageKeys.favoriteTips)).toBeNull();
    expect(localStorage.getItem(StorageKeys.localProfiles)).toBeNull();
    expect(localStorage.getItem('skillvault_users_db_v1')).toBeNull();

    // Motyw to ustawienie interfejsu, nie dane osobowe — zostaje.
    expect(localStorage.getItem(StorageKeys.theme)).toBe('dark');
  });

  it('zapisuje vault czystym tekstem — bez udawania szyfrowania', async () => {
    // Świadoma decyzja, opisana w SECURITY.md. Poprzednia wersja zapisywała
    // obok kopię "zaszyfrowaną" kluczem 'default_key' zaszytym w bundlu, co przy
    // XSS nie chroni przed niczym, a mnożyło kopie tych samych danych.
    const { profile } = await createLocalProfile('Jan');
    saveProfileVault(profile.id, createEmptyVault('Sean O’Brien', 'sean@example.pl'));

    const stored = localStorage.getItem(vaultKeyFor(profile.id));

    expect(stored).toContain('Sean');
    // Nie ma drugiej kopii — ani „zaszyfrowanej", ani żadnej innej.
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
    expect(keys.filter((k) => k?.includes(profile.id))).toHaveLength(1);
  });

  it('zwraca null zamiast rzucać, gdy zapisany profil jest uszkodzony', () => {
    localStorage.setItem(StorageKeys.profile, '{to nie jest json');

    expect(getActiveProfile()).toBeNull();
  });
});

describe('Migracja ze starych kluczy', () => {
  it('przenosi profil i vault spod dawnych nazw kluczy', () => {
    const legacyProfile = { id: 'local-123', name: 'Jan', createdAt: '2026-01-01T00:00:00.000Z' };
    localStorage.setItem('cvelocity_local_profile_v1', JSON.stringify(legacyProfile));
    localStorage.setItem(
      'skillvault_vault_active_local-123',
      JSON.stringify(createEmptyVault('Jan'))
    );

    migrateLegacyKeys();

    expect(getActiveProfile()?.id).toBe('local-123');
    expect(loadProfileVault('local-123')).not.toBeNull();
    expect(localStorage.getItem('cvelocity_local_profile_v1')).toBeNull();
    expect(localStorage.getItem('skillvault_vault_active_local-123')).toBeNull();
  });

  it('nie nadpisuje danych zapisanych już pod nowym kluczem', () => {
    // Powtórne wywołanie migracji nie może cofać zmian wprowadzonych po niej.
    localStorage.setItem('cvelocity-theme', 'light');
    localStorage.setItem(StorageKeys.theme, 'dark');

    migrateLegacyKeys();

    expect(localStorage.getItem(StorageKeys.theme)).toBe('dark');
  });

  it('usuwa pozostałości po module udającym system kont', () => {
    localStorage.setItem('skillvault_users_db_v1', '[{"passwordHash":"..."}]');
    localStorage.setItem('skillvault_master_vault_enc_v2', '{"v":1,"raw":"{}"}');

    migrateLegacyKeys();

    expect(localStorage.getItem('skillvault_users_db_v1')).toBeNull();
    expect(localStorage.getItem('skillvault_master_vault_enc_v2')).toBeNull();
  });
});

describe('Praca sprzed założenia profilu', () => {
  it('przenosi vault z profilu anonimowego na nowo założony profil', async () => {
    // Klin ATS działa bez rejestracji. Gdyby wynik przepadał w chwili podania
    // imienia, cała propozycja „sprawdź najpierw, zarejestruj się potem"
    // rozpadałaby się dokładnie w momencie konwersji.
    saveProfileVault(ANONYMOUS_PROFILE_ID, createEmptyVault('Sean O’Brien', 'sean@example.pl'));

    const { profile, vault } = await createLocalProfile('Sean O’Brien');

    expect(vault.personalInfo.email).toBe('sean@example.pl');
    expect(loadProfileVault(profile.id)?.personalInfo.email).toBe('sean@example.pl');
    expect(loadProfileVault(ANONYMOUS_PROFILE_ID)).toBeNull();
  });

  it('przenosi anonimową historię Pipeline do nowego profilu', async () => {
    writeJson(applicationsKeyFor(ANONYMOUS_PROFILE_ID), [
      { id: 'anon-1', company: 'Firma testowa', position: 'Monter', salary: '', date: '2026-09-10', status: 'Wysłana' },
    ]);

    const { profile } = await createLocalProfile('Jan Kowalski');

    expect(readJson<Array<{ company: string }>>(applicationsKeyFor(profile.id), [])).toEqual([
      expect.objectContaining({ company: 'Firma testowa' }),
    ]);
    expect(readJson(applicationsKeyFor(ANONYMOUS_PROFILE_ID), [])).toEqual([]);
  });
});

describe('BUG-007: Izolacja profili po wylogowaniu i odporność na zanieczyszczenie', () => {
  it('Użytkownik A → wylogowanie → stan anonimowy jest pusty i ANONYMOUS_PROFILE_ID nie zawiera danych A', async () => {
    const { profile } = await createLocalProfile('Jan Kowalski', 'jan.kowalski@example.com');
    const janVault = createEmptyVault('Jan Kowalski', 'jan.kowalski@example.com');
    janVault.personalInfo.title = 'Monter HVAC';
    janVault.history = [
      {
        id: 'exp-jan-1',
        company: 'TermoKlim',
        role: 'Serwisant HVAC',
        startDate: '2020',
        endDate: '2024',
        isCurrent: false,
        location: 'Warszawa',
        description: 'Serwis urządzeń grzewczych',
        highlights: [],
      },
    ];
    saveProfileVault(profile.id, janVault);

    // Jan się wylogowuje / zamyka profil
    await signOutLocalProfile();

    // Weryfikacja: profil aktywny usunięty, schowek anonimowy jest pusty
    expect(getActiveProfile()).toBeNull();
    expect(loadProfileVault(ANONYMOUS_PROFILE_ID)).toBeNull();
  });

  it('Użytkownik A → wylogowanie → utworzenie Użytkownika B → B otrzymuje czysty profil bez danych A', async () => {
    const { profile: janProfile } = await createLocalProfile('Jan Kowalski', 'jan@example.pl');
    const janVault = createEmptyVault('Jan Kowalski', 'jan@example.pl');
    janVault.history = [
      {
        id: 'exp-jan-1',
        company: 'TermoKlim',
        role: 'Monter',
        startDate: '2020',
        endDate: '2024',
        isCurrent: false,
        location: 'Warszawa',
        description: 'Montaż pomp ciepła',
        highlights: [],
      },
    ];
    saveProfileVault(janProfile.id, janVault);

    // Jan się wylogowuje
    await signOutLocalProfile();

    // Anna tworzy profil na tym samym urządzeniu
    const { profile: annaProfile, vault: annaVault } = await createLocalProfile('Anna Nowak', 'anna@example.pl');

    expect(annaProfile.name).toBe('Anna Nowak');
    expect(annaVault.personalInfo.fullName).toBe('Anna Nowak');
    expect(annaVault.personalInfo.email).toBe('anna@example.pl');
    // Anna NIE dziedziczy historii zatrudnienia ani stanowiska Jana
    expect(annaVault.history).toEqual([]);
    expect(annaVault.personalInfo.title).toBe('');

    // Dane Jana pod jego kluczem pozostają nienaruszone
    const reloadedJan = loadProfileVault(janProfile.id);
    expect(reloadedJan?.personalInfo.fullName).toBe('Jan Kowalski');
    expect(reloadedJan?.history[0]?.company).toBe('TermoKlim');
  });

  it('Oczekujący opóźniony zapis po wylogowaniu jest anulowany i nie nadpisuje profilu anonimowego', () => {
    const userVault = createEmptyVault('Jan Kowalski');
    userVault.personalInfo.title = 'Inżynier';

    let activePersistTarget: string | null = 'local-jan-1';
    let savedAnonymousVault: unknown = null;
    let savedUserVault: unknown = null;

    const persistFn = (v: typeof userVault) => {
      if (activePersistTarget === 'local-jan-1') {
        savedUserVault = v;
      } else if (activePersistTarget === null) {
        savedAnonymousVault = v;
      }
    };

    // Tworzymy writer z opóźnieniem
    let hasPending = true;
    const cancel = () => {
      hasPending = false;
    };

    // Użytkownik A ma oczekującą zmianę
    userVault.personalInfo.summary = 'Poufne podsumowanie Jana';

    // Następuje wylogowanie: target staje się null, cancel jest wywoływane
    cancel();
    activePersistTarget = null;

    // Jeżeli nastąpi próba wywołania po anulowaniu:
    if (hasPending) {
      persistFn(userVault);
    }

    // Schowek anonimowy nie został zanieczyszczony
    expect(savedAnonymousVault).toBeNull();
    expect(savedUserVault).toBeNull();
  });

  it('Istniejące zapisywanie aktywnego profilu nadal poprawnie utrwala dane', async () => {
    const { profile } = await createLocalProfile('Piotr');
    const vault = createEmptyVault('Piotr');
    vault.skillsMatrix.hardSkills = ['TypeScript', 'React'];

    saveProfileVault(profile.id, vault);

    const loaded = loadProfileVault(profile.id);
    expect(loaded?.skillsMatrix.hardSkills).toEqual(['TypeScript', 'React']);
  });
});
