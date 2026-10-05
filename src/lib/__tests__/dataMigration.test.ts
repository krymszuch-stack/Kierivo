import { describe, it, expect, beforeEach } from 'vitest';
import {
  CURRENT_DATA_SCHEMA_VERSION,
  migrateProfile,
  migrateVault,
  migrateApplications,
  migrateApplication,
  migrateCVLibrary,
  migrateAllStorageAtStartup,
} from '../dataMigration';
import { measureVaultCompleteness } from '../vaultCompleteness';
import { CANONICAL_ATS_SCORE_PROVENANCE } from '../../types';
import { StorageKeys, readJson, resetLastGoodCache, writeJson, vaultKeyFor, applicationsKeyFor } from '../storage';
import { MemoryStorage } from './helpers/memoryStorage';

beforeEach(() => {
  (globalThis as { localStorage?: unknown }).localStorage = new MemoryStorage();
  resetLastGoodCache();
});

describe('dataMigration - Jednolity, wersjonowany schemat danych', () => {
  describe('migrateApplication', () => {
    it('nie podnosi starej wersji reguł podczas migracji ani kolejnego odczytu', () => {
      const raw = {
        id: 'old-rules', company: 'Firma', position: 'Magazynier', atsScore: 41,
        atsScoreProvenance: 'canonical-v1',
        atsScoreContext: { detectedRequirementCount: 4, profileCompleteness: 86, unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0, scoreContextVersion: 5, careerEvidenceAvailable: true, careerEvidenceVersion: 2 },
      };
      const migrated = migrateApplication(raw);
      expect(migrated?.atsScoreProvenance).toBe('canonical-v1');
      expect(migrated?.atsScore).toBe(41);
      expect(migrated?.atsScoreContext).toEqual(raw.atsScoreContext);
      expect(migrateApplication(migrated)).toEqual(migrated);
    });

    it('nie uznaje braku statusu za wysłanie i nie dopisuje firmy', () => {
      const migrated = migrateApplication({ id: 'legacy-draft', company: '', position: 'Serwisant HVAC' });

      expect(migrated).toMatchObject({
        id: 'legacy-draft',
        company: '',
        position: 'Serwisant HVAC',
        status: 'Do wysłania',
      });
    });

    it('nieznany status traktuje zachowawczo jako szkic', () => {
      const migrated = migrateApplication({
        id: 'legacy-unknown-status',
        company: 'Firma Testowa',
        position: 'Monter',
        status: 'nieznany status',
      });

      expect(migrated?.status).toBe('Do wysłania');
    });

    it('usuwa niebezpieczny schemat z odziedziczonego linku oferty', () => {
      const malicious = migrateApplication({
        id: 'legacy-link', company: 'Firma', position: 'Rola', jobUrl: 'javascript:alert(1)',
      });
      const valid = migrateApplication({
        id: 'legacy-safe-link', company: 'Firma', position: 'Rola', jobUrl: ' https://example.com/jobs/1 ',
      });

      expect(malicious?.jobUrl).toBeUndefined();
      expect(valid?.jobUrl).toBe('https://example.com/jobs/1');
    });

    it('zachowuje starszą liczbę, ale nie oznacza jej jako kanonicznej bez dowodu źródła', () => {
      const migrated = migrateApplication({
        id: 'legacy-score', company: 'Firma', position: 'Rola', atsScore: 41,
      });

      expect(migrated?.atsScore).toBe(41);
      expect(migrated?.atsScoreProvenance).toBeUndefined();
    });

    it('zachowuje pochodzenie kanoniczne i odrzuca wynik poza zakresem', () => {
      const canonical = migrateApplication({
        id: 'canonical-score', company: 'Firma', position: 'Rola', atsScore: 0,
        atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
        atsScoreContext: { detectedRequirementCount: 1, profileCompleteness: 86, unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0, scoreContextVersion: 5, careerEvidenceAvailable: true, careerEvidenceVersion: 2 },
      });
      const invalid = migrateApplication({
        id: 'invalid-score', company: 'Firma', position: 'Rola', atsScore: 101,
        atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
      });

      expect(canonical?.atsScore).toBe(0);
      expect(canonical?.atsScoreProvenance).toBe(CANONICAL_ATS_SCORE_PROVENANCE);
      expect(canonical?.atsScoreContext).toEqual({ detectedRequirementCount: 1, profileCompleteness: 86, unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0, unconfirmedRequirementCount: 0, scoreContextVersion: 5, careerEvidenceAvailable: true, careerEvidenceVersion: 2 });

      const legacyContext = migrateApplication({
        id: 'legacy-context', company: 'Firma', position: 'Rola', atsScore: 70,
        atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
        atsScoreContext: { detectedRequirementCount: 5, profileCompleteness: 100, careerEvidenceAvailable: true },
      });
      const incompleteVersionFourContext = migrateApplication({
        id: 'legacy-v4-context', company: 'Firma', position: 'Rola', atsScore: 72,
        atsScoreProvenance: CANONICAL_ATS_SCORE_PROVENANCE,
        atsScoreContext: {
          detectedRequirementCount: 5, profileCompleteness: 100,
          unmetBlockingRequirementCount: 0, unconfirmedBlockingRequirementCount: 0,
          scoreContextVersion: 4, careerEvidenceAvailable: true, careerEvidenceVersion: 2,
        },
      });
      expect(legacyContext?.atsScore).toBe(70);
      expect(legacyContext?.atsScoreContext).toBeUndefined();
      expect(incompleteVersionFourContext?.atsScore).toBe(72);
      expect(incompleteVersionFourContext?.atsScoreContext).toBeUndefined();
      expect(invalid?.atsScore).toBeUndefined();
      expect(invalid?.atsScoreProvenance).toBeUndefined();
    });
  });

  describe('migrateProfile', () => {
    it('migruje starszy profil bez schemaVersion i bez updatedAt', () => {
      const legacy = {
        id: 'local-test-1',
        name: '  Jan Kowalski  ',
        email: '  jan@example.com  ',
        createdAt: '2026-01-01T10:00:00.000Z',
      };

      const migrated = migrateProfile(legacy);
      expect(migrated).not.toBeNull();
      expect(migrated?.schemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
      expect(migrated?.name).toBe('Jan Kowalski');
      expect(migrated?.email).toBe('jan@example.com');
      expect(migrated?.createdAt).toBe('2026-01-01T10:00:00.000Z');
      expect(migrated?.updatedAt).toBe('2026-01-01T10:00:00.000Z');
    });

    it('zwraca null dla uszkodzonych lub pustych rekordów profilu', () => {
      expect(migrateProfile(null)).toBeNull();
      expect(migrateProfile({})).toBeNull();
      expect(migrateProfile({ id: '123' })).toBeNull();
      expect(migrateProfile({ name: 'Jan' })).toBeNull();
    });

    it('jest idempotentne dla profilu już posiadającego aktualny schemat', () => {
      const current = {
        schemaVersion: CURRENT_DATA_SCHEMA_VERSION,
        id: 'local-current-1',
        name: 'Anna Nowak',
        createdAt: '2026-02-01T12:00:00.000Z',
        updatedAt: '2026-02-01T12:00:00.000Z',
      };

      const result = migrateProfile(current);
      expect(result).toBe(current);
    });
  });

  describe('migrateVault', () => {
    it('zachowuje ręcznie wpisaną klauzulę CV podczas migracji Vaultu', () => {
      const migrated = migrateVault({
        version: '1.0',
        personalInfo: {
          fullName: 'Piotr Monter',
          rodoClause: 'Moja klauzula zgody.',
          gdprClause: 'Moja starsza klauzula.',
        },
      });

      expect(migrated.personalInfo.rodoClause).toBe('Moja klauzula zgody.');
      expect(migrated.personalInfo.gdprClause).toBe('Moja starsza klauzula.');
    });

    it('uzupełnia brakujące sekcje (claims, skillsMatrix) i nadaje schemaVersion', () => {
      const partialLegacy = {
        version: '1.0',
        personalInfo: { fullName: 'Piotr Monter' },
        history: [{ id: 'exp-1', role: 'Monter', company: 'ABC', period: '2020-2022', description: '', highlights: [] }],
      };

      const migrated = migrateVault(partialLegacy);
      expect(migrated.schemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
      expect(migrated.version).toBe('1.0');
      expect(migrated.personalInfo.fullName).toBe('Piotr Monter');
      expect(Array.isArray(migrated.claims)).toBe(true);
      expect(migrated.claims).toEqual([]);
      expect(Array.isArray(migrated.skillsMatrix.hardSkills)).toBe(true);
      expect(Array.isArray(migrated.skillsMatrix.toolsAndTech)).toBe(true);
      expect(migrated.history.length).toBe(1);
    });

    it('naprawia brakującą listę punktów STAR bez zmiany treści doświadczenia', () => {
      const currentButIncomplete = {
        schemaVersion: CURRENT_DATA_SCHEMA_VERSION,
        version: '1.0.0',
        updatedAt: '2026-10-02T08:00:00.000Z',
        claims: [],
        personalInfo: { fullName: 'Marek Nowak', email: 'marek@example.invalid', title: '', summary: '' },
        skillsMatrix: { hardSkills: [], softSkills: [], toolsAndTech: [], certifications: [] },
        profiler: { flags: [], experienceLevel: 'MID', location: { city: '', radiusKm: 0, willingnessToTravel: false, hybridWork: false, remoteOnly: false }, languages: [] },
        history: [{ id: 'exp-1', company: 'Firma', role: 'Monter' }],
        education: [],
        projects: [],
      };

      const migrated = migrateVault(currentButIncomplete);

      expect(migrated.history).toHaveLength(1);
      expect(migrated.history[0]).toMatchObject({ id: 'exp-1', company: 'Firma', role: 'Monter', highlights: [] });
      expect(() => measureVaultCompleteness(migrated)).not.toThrow();
      expect(measureVaultCompleteness(migrated).missing).toContain('experience');
    });

    it('dla pustego lub niepoprawnego wejścia generuje bezpieczny pusty vault z schemaVersion', () => {
      const migrated = migrateVault(null);
      expect(migrated.schemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
      expect(migrated.personalInfo.fullName).toBe('');
      expect(Array.isArray(migrated.history)).toBe(true);
      expect(Array.isArray(migrated.claims)).toBe(true);
    });
  });

  describe('migrateApplications', () => {
    it('mapuje dawne statusy angielskie i normalizuje daty', () => {
      const legacyApps = [
        {
          id: 'app-1',
          company: 'Acme Corp',
          position: 'Spawacz TIG',
          status: 'Applied',
          date: '2026/03/15',
          salary: '7000 PLN',
        },
        {
          id: 'app-2',
          company: 'Beta Sp. z o.o.',
          position: 'Automatyk',
          status: 'Interview',
          applied_at: '2026-03-10',
          interviewAt: '2026-03-20T14:00:00.000Z',
        },
        {
          id: 'app-3',
          company: 'Gamma S.A.',
          position: 'Magazynier',
          status: 'Rejected',
          interviewAt: '2026-03-22T10:00:00.000Z', // powinno zostać wyczyszczone
        },
      ];

      const migrated = migrateApplications(legacyApps);
      expect(migrated.length).toBe(3);

      expect(migrated[0].schemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
      expect(migrated[0].status).toBe('Wysłana');
      expect(migrated[0].date).toBe('2026-03-15');

      expect(migrated[1].schemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
      expect(migrated[1].status).toBe('Rozmowa');
      expect(migrated[1].date).toBe('2026-03-10');
      expect(migrated[1].interviewAt).toBe('2026-03-20T14:00:00.000Z');

      expect(migrated[2].schemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
      expect(migrated[2].status).toBe('Odrzucona');
      expect(migrated[2].interviewAt).toBeUndefined();
    });
  });

  describe('migrateCVLibrary', () => {
    it('migruje kolekcję zapisanych CV wraz z zagnieżdżonym vaultem', () => {
      const legacyLibrary = [
        {
          id: 'cv-1',
          title: 'CV Elektryk',
          tags: ['Elektryka'],
          theme: 'classic',
          layout: 'single',
          targetPages: 1,
          downloadCount: 2,
          vault: {
            personalInfo: { fullName: 'Marek Elektryk' },
          },
        },
      ];

      const migrated = migrateCVLibrary(legacyLibrary);
      expect(migrated.length).toBe(1);
      expect(migrated[0].schemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
      expect(migrated[0].vault.schemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
      expect(migrated[0].vault.personalInfo.fullName).toBe('Marek Elektryk');
      expect(Array.isArray(migrated[0].vault.claims)).toBe(true);
    });
  });

  describe('migrateAllStorageAtStartup', () => {
    it('migruje całe repozytorium localStorage i jest w pełni idempotentna', () => {
      // Przygotowanie starych rekordów bez schemaVersion
      writeJson(StorageKeys.profile, {
        id: 'local-old-1',
        name: 'Tomasz Stary',
        createdAt: '2026-01-01T00:00:00.000Z',
      });

      writeJson(vaultKeyFor('anonymous'), {
        version: '1.0',
        personalInfo: { fullName: 'Anonim' },
      });

      writeJson(vaultKeyFor('local-old-1'), {
        version: '1.0',
        personalInfo: { fullName: 'Tomasz Stary' },
      });

      writeJson(applicationsKeyFor('local-old-1'), [
        { id: 'app-old-1', company: 'Firma X', position: 'Rola Y', status: 'Applied' },
      ]);

      writeJson(StorageKeys.cvLibrary, [
        {
          id: 'lib-1',
          title: 'Wersja bazowa',
          tags: [],
          theme: 'modern',
          layout: 'compact',
          targetPages: 1,
          downloadCount: 0,
          vault: { personalInfo: { fullName: 'Tomasz' } },
        },
      ]);

      writeJson('cvelocity:cloud-vault-outbox:user-cloud-1', {
        ownerId: 'user-cloud-1',
        vault: { version: '1.0', personalInfo: { fullName: 'W chmurze' } },
        enqueuedAt: new Date().toISOString(),
      });

      // 1. Pierwszy przebieg migracji
      const firstRun = migrateAllStorageAtStartup();
      expect(firstRun.profilesMigrated).toBe(1);
      expect(firstRun.vaultsMigrated).toBe(2);
      expect(firstRun.applicationsMigrated).toBe(1);
      expect(firstRun.cvLibraryMigrated).toBe(1);
      expect(firstRun.cloudOutboxMigrated).toBe(1);

      // Sprawdzenie czy dane mają teraz schemaVersion === 1
      const p = readJson<any>(StorageKeys.profile, null);
      expect(p.schemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
      expect(p.name).toBe('Tomasz Stary');

      const vAnon = readJson<any>(vaultKeyFor('anonymous'), null);
      expect(vAnon.schemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
      expect(Array.isArray(vAnon.claims)).toBe(true);

      const apps = readJson<any[]>(applicationsKeyFor('local-old-1'), []);
      expect(apps[0].schemaVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
      expect(apps[0].status).toBe('Wysłana');

      // 2. Drugi przebieg - pełna idempotencja (0 kolejnych migracji)
      const secondRun = migrateAllStorageAtStartup();
      expect(secondRun.profilesMigrated).toBe(0);
      expect(secondRun.vaultsMigrated).toBe(0);
      expect(secondRun.applicationsMigrated).toBe(0);
      expect(secondRun.cvLibraryMigrated).toBe(0);
      expect(secondRun.cloudOutboxMigrated).toBe(0);
    });
  });
});
