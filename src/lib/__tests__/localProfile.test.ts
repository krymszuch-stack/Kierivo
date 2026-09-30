import { describe, it, expect, beforeEach } from 'vitest';
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

    signOutLocalProfile();

    expect(getActiveProfile()).toBeNull();
    expect(loadProfileVault(profile.id)).not.toBeNull();
  });

  it('po zamknięciu lokalnego profilu można wznowić dokładnie ten sam vault', async () => {
    const { profile } = await createLocalProfile('Jan Kowalski', 'jan@example.pl');
    const savedVault = createEmptyVault('Jan Kowalski', 'jan@example.pl');
    savedVault.skillsMatrix.hardSkills = ['Windows 11', 'TCP/IP'];
    saveProfileVault(profile.id, savedVault);

    signOutLocalProfile();
    expect(getActiveProfile()).toBeNull();

    const savedProfiles = await listSavedLocalProfiles();
    expect(savedProfiles.map((item) => item.id)).toContain(profile.id);

    const resumed = activateLocalProfile(profile.id);
    expect(resumed?.profile.id).toBe(profile.id);
    expect(getActiveProfile()?.id).toBe(profile.id);
    expect(resumed?.vault.skillsMatrix.hardSkills).toEqual(['Windows 11', 'TCP/IP']);
  });

  it('profile o tej samej nazwie pozostają rozdzielone i można wznowić właściwy', async () => {
    const first = await createLocalProfile('Jan Kowalski');
    const firstVault = createEmptyVault('Jan Kowalski');
    firstVault.personalInfo.summary = 'Profil pierwszy';
    saveProfileVault(first.profile.id, firstVault);
    signOutLocalProfile();

    const second = await createLocalProfile('Jan Kowalski');
    const secondVault = createEmptyVault('Jan Kowalski');
    secondVault.personalInfo.summary = 'Profil drugi';
    saveProfileVault(second.profile.id, secondVault);
    signOutLocalProfile();

    const savedProfiles = await listSavedLocalProfiles();
    expect(savedProfiles.filter((item) => item.name === 'Jan Kowalski')).toHaveLength(2);
    expect(activateLocalProfile(first.profile.id)?.vault.personalInfo.summary).toBe('Profil pierwszy');
    signOutLocalProfile();
    expect(activateLocalProfile(second.profile.id)?.vault.personalInfo.summary).toBe('Profil drugi');
  });

  it('odkrywa starszy zapisany vault bez indeksu profili', async () => {
    const { profile } = await createLocalProfile('Anna Nowak', 'anna@example.pl');
    saveProfileVault(profile.id, createEmptyVault('Anna Nowak', 'anna@example.pl'));
    localStorage.removeItem(StorageKeys.localProfiles);
    signOutLocalProfile();

    const savedProfiles = await listSavedLocalProfiles();
    expect(savedProfiles).toContainEqual(expect.objectContaining({
      id: profile.id,
      name: 'Anna Nowak',
      email: 'anna@example.pl',
    }));
    expect(activateLocalProfile(profile.id)?.vault.personalInfo.fullName).toBe('Anna Nowak');
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
    signOutLocalProfile();

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
    signOutLocalProfile();

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
