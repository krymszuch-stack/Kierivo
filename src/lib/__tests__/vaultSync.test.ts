import { describe, expect, it } from 'vitest';
import {
  getLocalVaultForCloudOwner,
  isLocalVaultEligibleForCloudOwner,
  isVaultBoundToCloudOwner,
  resolveVaultOnSignIn,
} from '../vaultSync';
import { ANONYMOUS_PROFILE_ID } from '../localProfile';
import { createEmptyVault } from '../sampleVault';
import { MasterVault, WorkExperience } from '../../types';

function job(overrides: Partial<WorkExperience> = {}): WorkExperience {
  return {
    id: 'exp-1',
    company: 'GROMGAZ',
    role: 'Monter',
    location: 'Kraków',
    startDate: '2020-01',
    endDate: '2023-01',
    isCurrent: false,
    highlights: [
      { id: 'hl-1', text: 'Przeglądy kotłów', action: '', target: '', tool: '', metric: '', keywords: [] },
    ],
    ...overrides,
  };
}

/** Vault z treścią — `isVaultEmpty` patrzy na wypełnione sekcje, nie na sam obiekt. */
function pelny(overrides: Partial<MasterVault> = {}): MasterVault {
  const base = createEmptyVault('Jan Kowalski', 'jan@example.com');
  return {
    ...base,
    personalInfo: { ...base.personalInfo, title: 'Monter', summary: 'Serwis gazowy.' },
    skillsMatrix: { ...base.skillsMatrix, hardSkills: ['Przeglądy kotłów'] },
    history: [job()],
    ...overrides,
  };
}

describe('rozstrzyganie konfliktu vaultu przy logowaniu', () => {
  it('nie używa vaultu innego lokalnego profilu do bootstrapu cudzego konta', () => {
    const alicja = pelny();
    const eligible = getLocalVaultForCloudOwner(alicja, 'local-profile-alicja', 'cloud-owner-bob');

    expect(isLocalVaultEligibleForCloudOwner('local-profile-alicja', 'cloud-owner-bob')).toBe(false);
    expect(eligible.personalInfo.fullName).not.toBe('Jan Kowalski');
    expect(eligible.history).toEqual([]);
    expect(isLocalVaultEligibleForCloudOwner('cloud-owner-bob', 'cloud-owner-bob')).toBe(true);
    expect(isLocalVaultEligibleForCloudOwner(ANONYMOUS_PROFILE_ID, 'cloud-owner-bob')).toBe(true);
    expect(isVaultBoundToCloudOwner('local-profile-alicja', 'cloud-owner-bob')).toBe(false);
    expect(isVaultBoundToCloudOwner(ANONYMOUS_PROFILE_ID, 'cloud-owner-bob')).toBe(false);
    expect(isVaultBoundToCloudOwner('cloud-owner-bob', 'cloud-owner-bob')).toBe(true);
  });

  it('pusta chmura i lokalna praca → wysyła lokalny (migracja na konto)', () => {
    const local = pelny();
    const wynik = resolveVaultOnSignIn(local, null);

    expect(wynik.action).toBe('wyslij-lokalny');
    expect(wynik.shouldUpload).toBe(true);
    expect(wynik.vault).toBe(local);
  });

  it('pełna chmura i pusta przeglądarka → pokazuje chmurę i niczego nie odsyła', () => {
    const cloud = pelny();
    const wynik = resolveVaultOnSignIn(createEmptyVault(), cloud);

    expect(wynik.action).toBe('uzyj-chmury');
    expect(wynik.shouldUpload).toBe(false);
    expect(wynik.vault).toBe(cloud);
  });

  it('NIGDY nie nadpisuje niepustej chmury pustym lokalnym vaultem', () => {
    // To jest jedyny scenariusz, w którym ta funkcja mogłaby komuś skasować CV.
    // Dlatego ma własny test, a nie tylko wynika z kolejności warunków.
    const cloud = pelny();
    const wynik = resolveVaultOnSignIn(createEmptyVault(), cloud);

    expect(wynik.shouldUpload).toBe(false);
    expect(wynik.vault.history).toHaveLength(1);
  });

  it('obie strony z treścią → scala i odsyła, nie gubiąc żadnej', () => {
    const cloud = pelny({ history: [job({ id: 'exp-cloud', company: 'Termika' })] });
    const local = pelny({ history: [job({ id: 'exp-local', company: 'GROMGAZ' })] });

    const wynik = resolveVaultOnSignIn(local, cloud);

    expect(wynik.action).toBe('scal-i-wyslij');
    expect(wynik.shouldUpload).toBe(true);
    const firmy = wynik.vault.history.map((h) => h.company);
    expect(firmy).toContain('Termika');
    expect(firmy).toContain('GROMGAZ');
  });

  it('wstrzymuje pierwsze logowanie, gdy lokalna i chmurowa wersja tej samej pracy różnią się', () => {
    const local = pelny();
    const cloud = pelny();
    local.history[0].highlights[0].text = 'Lokalna poprawka osiągnięcia';
    cloud.history[0].highlights[0].text = 'Zdalna poprawka osiągnięcia';

    const wynik = resolveVaultOnSignIn(local, cloud);

    expect(wynik.action).toBe('konflikt');
    expect(wynik.shouldUpload).toBe(false);
    expect(wynik.vault.history[0].highlights[0].text).toBe('Lokalna poprawka osiągnięcia');
  });

  it('scalanie nie dubluje tego samego stanowiska', () => {
    const cloud = pelny();
    const local = pelny();
    const wynik = resolveVaultOnSignIn(local, cloud);

    expect(wynik.vault.history).toHaveLength(1);
  });

  it('scalanie zachowuje umiejętności z obu stron', () => {
    const cloud = pelny({
      skillsMatrix: { ...createEmptyVault().skillsMatrix, hardSkills: ['Spawanie MIG'] },
    });
    const local = pelny({
      skillsMatrix: { ...createEmptyVault().skillsMatrix, hardSkills: ['Przeglądy kotłów'] },
    });

    const wynik = resolveVaultOnSignIn(local, cloud);
    expect(wynik.vault.skillsMatrix.hardSkills).toEqual(
      expect.arrayContaining(['Spawanie MIG', 'Przeglądy kotłów'])
    );
  });

  it('obie strony puste → nic do zrobienia', () => {
    const wynik = resolveVaultOnSignIn(createEmptyVault(), createEmptyVault());
    expect(wynik.action).toBe('nic');
    expect(wynik.shouldUpload).toBe(false);
  });

  it('nieudany odczyt chmury (null) nie kasuje lokalnej pracy', () => {
    // `null` znaczy zarówno „świeże konto", jak i „odczyt się nie powiódł".
    // W obu przypadkach lokalna praca musi przetrwać.
    const local = pelny();
    expect(resolveVaultOnSignIn(local, null).vault).toBe(local);
  });
});
