import { ApplicationStatus, JobApplication, MasterVault } from '../types';
import { LocalProfile } from './localProfile';
import { SavedCVDocument } from './cvLibraryStorage';
import { PendingCloudVaultSave } from './cloudVaultOutbox';
import { createEmptyVault } from './sampleVault';
import { readJson, StorageKeys, writeJson } from './storage';

/**
 * Aktualna wersja jednolitego schematu danych aplikacji (semantyczna wersja encji).
 *
 * Rośnie o 1 za każdym razem, gdy zmienia się kształt encji biznesowych
 * (profil, vault, aplikacje, biblioteka CV).
 */
export const CURRENT_DATA_SCHEMA_VERSION = 1 as const;

export interface MigrationReport {
  profilesMigrated: number;
  vaultsMigrated: number;
  applicationsMigrated: number;
  cvLibraryMigrated: number;
  cloudOutboxMigrated: number;
}

function isBrowser(): boolean {
  return typeof localStorage !== 'undefined';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Migruje rekord profilu użytkownika do aktualnej wersji schematu.
 */
export function migrateProfile(raw: unknown): LocalProfile | null {
  if (!isRecord(raw)) return null;

  const id = typeof raw.id === 'string' ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (!id || !name) return null;

  // Idempotencja: jeśli profil ma już bieżącą wersję schematu i updatedAt
  if (raw.schemaVersion === CURRENT_DATA_SCHEMA_VERSION && typeof raw.updatedAt === 'string') {
    return raw as unknown as LocalProfile;
  }

  const email = typeof raw.email === 'string' && raw.email.trim() ? raw.email.trim() : undefined;
  const createdAt = typeof raw.createdAt === 'string' && raw.createdAt.trim() ? raw.createdAt : new Date().toISOString();
  const updatedAt = typeof raw.updatedAt === 'string' && raw.updatedAt.trim() ? raw.updatedAt : createdAt;

  return {
    schemaVersion: CURRENT_DATA_SCHEMA_VERSION,
    id,
    name,
    ...(email ? { email } : {}),
    createdAt,
    updatedAt,
  };
}

/**
 * Migruje MasterVault do aktualnej wersji schematu, gwarantując obecność
 * wszystkich wymaganych sekcji (claims, skillsMatrix, profiler).
 */
export function migrateVault(raw: unknown): MasterVault {
  if (!isRecord(raw)) {
    const empty = createEmptyVault();
    empty.schemaVersion = CURRENT_DATA_SCHEMA_VERSION;
    empty.claims = [];
    return empty;
  }

  // Idempotencja: jeśli vault posiada już schemaVersion i wymagane tablice
  if (
    raw.schemaVersion === CURRENT_DATA_SCHEMA_VERSION &&
    Array.isArray(raw.claims) &&
    isRecord(raw.personalInfo) &&
    isRecord(raw.skillsMatrix) &&
    isRecord(raw.profiler)
  ) {
    return raw as unknown as MasterVault;
  }

  const version = typeof raw.version === 'string' && raw.version ? raw.version : '1.0.0';
  const updatedAt = typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : new Date().toISOString();

  const empty = createEmptyVault();
  const personalInfoRaw = isRecord(raw.personalInfo) ? raw.personalInfo : {};
  const profilerRaw = isRecord(raw.profiler) ? raw.profiler : {};
  const skillsRaw = isRecord(raw.skillsMatrix) ? raw.skillsMatrix : {};

  // Wsparcie starszych struktur (technical -> hardSkills, tools -> toolsAndTech)
  const hardSkills = Array.isArray(skillsRaw.hardSkills)
    ? (skillsRaw.hardSkills as string[])
    : Array.isArray(skillsRaw.technical)
      ? (skillsRaw.technical as string[])
      : [];
  const toolsAndTech = Array.isArray(skillsRaw.toolsAndTech)
    ? (skillsRaw.toolsAndTech as string[])
    : Array.isArray(skillsRaw.tools)
      ? (skillsRaw.tools as string[])
      : [];
  const softSkills = Array.isArray(skillsRaw.softSkills)
    ? (skillsRaw.softSkills as string[])
    : Array.isArray(skillsRaw.soft)
      ? (skillsRaw.soft as string[])
      : [];

  const migrated: MasterVault = {
    schemaVersion: CURRENT_DATA_SCHEMA_VERSION,
    version,
    updatedAt,
    personalInfo: {
      fullName: typeof personalInfoRaw.fullName === 'string' ? personalInfoRaw.fullName : '',
      email: typeof personalInfoRaw.email === 'string' ? personalInfoRaw.email : '',
      phone: typeof personalInfoRaw.phone === 'string' ? personalInfoRaw.phone : '',
      location: typeof personalInfoRaw.location === 'string' ? personalInfoRaw.location : '',
      linkedin: typeof personalInfoRaw.linkedin === 'string' ? personalInfoRaw.linkedin : '',
      github: typeof personalInfoRaw.github === 'string' ? personalInfoRaw.github : '',
      website: typeof personalInfoRaw.website === 'string' ? personalInfoRaw.website : '',
      photoUrl: typeof personalInfoRaw.photoUrl === 'string' ? personalInfoRaw.photoUrl : '',
      title: typeof personalInfoRaw.title === 'string' ? personalInfoRaw.title : '',
      summary: typeof personalInfoRaw.summary === 'string' ? personalInfoRaw.summary : '',
    },
    profiler: {
      flags: Array.isArray(profilerRaw.flags) ? (profilerRaw.flags as any) : empty.profiler.flags,
      experienceLevel: (profilerRaw.experienceLevel as any) || empty.profiler.experienceLevel,
      location: isRecord(profilerRaw.location) ? (profilerRaw.location as any) : empty.profiler.location,
      languages: Array.isArray(profilerRaw.languages) ? (profilerRaw.languages as any) : empty.profiler.languages,
      ...(Array.isArray(profilerRaw.licenses) ? { licenses: profilerRaw.licenses as string[] } : {}),
      ...(typeof profilerRaw.subRoleId === 'string' ? { subRoleId: profilerRaw.subRoleId } : {}),
      ...(typeof profilerRaw.careerGoal === 'string' ? { careerGoal: profilerRaw.careerGoal as any } : {}),
      ...(typeof profilerRaw.experienceYears === 'string' ? { experienceYears: profilerRaw.experienceYears as any } : {}),
      ...(typeof profilerRaw.independenceLevel === 'string' ? { independenceLevel: profilerRaw.independenceLevel as any } : {}),
      ...(typeof profilerRaw.industryChangeReady === 'boolean' ? { industryChangeReady: profilerRaw.industryChangeReady } : {}),
      ...(typeof profilerRaw.autoDetermineSeniority === 'boolean' ? { autoDetermineSeniority: profilerRaw.autoDetermineSeniority } : {}),
    },
    skillsMatrix: {
      hardSkills,
      softSkills,
      toolsAndTech,
      certifications: Array.isArray(skillsRaw.certifications) ? (skillsRaw.certifications as any) : [],
    },
    history: Array.isArray(raw.history) ? (raw.history as any) : [],
    education: Array.isArray(raw.education) ? (raw.education as any) : [],
    projects: Array.isArray(raw.projects) ? (raw.projects as any) : [],
    claims: Array.isArray(raw.claims) ? (raw.claims as any) : [],
    ...(isRecord(raw.mobilityPreferences) ? { mobilityPreferences: raw.mobilityPreferences as any } : {}),
  };

  return migrated;
}

const STATUS_MAPPING: Record<string, ApplicationStatus> = {
  'Applied': 'Wysłana',
  'Wysłana': 'Wysłana',
  'To send': 'Do wysłania',
  'Do wysłania': 'Do wysłania',
  'Interview': 'Rozmowa',
  'Rozmowa': 'Rozmowa',
  'Offer': 'Oferta',
  'Oferta': 'Oferta',
  'Rejected': 'Odrzucona',
  'Odrzucona': 'Odrzucona',
  'Archive': 'Odrzucona',
  'Archiwum': 'Odrzucona',
};

function normalizeDate(rawDate: unknown): string {
  if (typeof rawDate !== 'string' || !rawDate.trim()) {
    return new Date().toISOString().slice(0, 10);
  }
  const trimmed = rawDate.trim().replace(/\//g, '-');
  // Sprawdź czy format to YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  return isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

/**
 * Migruje pojedynczą aplikację do jednolitego schematu.
 */
export function migrateApplication(raw: unknown): JobApplication | null {
  if (!isRecord(raw)) return null;

  const id = typeof raw.id === 'string' && raw.id ? raw.id : `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const company = typeof raw.company === 'string' ? raw.company.trim() : '';
  const position = typeof raw.position === 'string' ? raw.position.trim() : '';
  if (!company && !position) return null;

  const rawStatus = typeof raw.status === 'string' ? raw.status : 'Wysłana';
  const status: ApplicationStatus = STATUS_MAPPING[rawStatus] ?? 'Wysłana';
  const salary = typeof raw.salary === 'string' ? raw.salary.trim() : '';
  const date = normalizeDate(raw.date || (raw as any).applied_at);

  let interviewAt = typeof raw.interviewAt === 'string' ? raw.interviewAt : undefined;
  // Reguła: Odrzucona aplikacja nie trzyma terminu rozmowy
  if (status === 'Odrzucona') {
    interviewAt = undefined;
  }

  const app: JobApplication = {
    schemaVersion: CURRENT_DATA_SCHEMA_VERSION,
    id,
    company: company || 'Nieznana firma',
    position: position || 'Stanowisko',
    salary,
    date,
    status,
    ...(typeof raw.notes === 'string' ? { notes: raw.notes } : {}),
    ...(typeof raw.jobUrl === 'string' ? { jobUrl: raw.jobUrl } : {}),
    ...(typeof raw.atsScore === 'number' ? { atsScore: raw.atsScore } : {}),
    ...(Array.isArray(raw.missingKeywords) ? { missingKeywords: raw.missingKeywords } : {}),
    ...(interviewAt ? { interviewAt } : {}),
    ...(typeof raw.briefDoneAt === 'string' ? { briefDoneAt: raw.briefDoneAt } : {}),
    ...(typeof raw.debriefSentAt === 'string' ? { debriefSentAt: raw.debriefSentAt } : {}),
    ...(isRecord(raw.documentSnapshot) ? { documentSnapshot: raw.documentSnapshot as any } : {}),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };

  return app;
}

/**
 * Migruje kolekcję aplikacji w Pipeline.
 */
export function migrateApplications(raw: unknown): JobApplication[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(migrateApplication).filter((a): a is JobApplication => Boolean(a));
}

/**
 * Migruje kolekcję zapisanych CV (CV Library).
 */
export function migrateCVLibrary(raw: unknown): SavedCVDocument[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter(isRecord)
    .map((doc) => {
      const migratedVault = migrateVault(doc.vault);
      const now = new Date().toISOString();
      return {
        ...doc,
        schemaVersion: CURRENT_DATA_SCHEMA_VERSION,
        vault: migratedVault,
        updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : now,
      } as SavedCVDocument;
    });
}

/**
 * Główna funkcja migracyjna uruchamiana raz przy starcie aplikacji (main.tsx).
 *
 * Idempotentna: sprawdza istniejący schemaVersion i aktualizuje tylko rekordy
 * wymagające ujednolicenia. Zapisuje z powrotem przez `writeJson`, zapewniając
 * spójną sumę kontrolną i odświeżoną wersję.
 */
export function migrateAllStorageAtStartup(): MigrationReport {
  const report: MigrationReport = {
    profilesMigrated: 0,
    vaultsMigrated: 0,
    applicationsMigrated: 0,
    cvLibraryMigrated: 0,
    cloudOutboxMigrated: 0,
  };

  if (!isBrowser()) return report;

  // 1. Profil lokalny
  try {
    const rawProfile = readJson<Record<string, unknown> | null>(StorageKeys.profile, null);
    if (rawProfile && rawProfile.schemaVersion !== CURRENT_DATA_SCHEMA_VERSION) {
      const migrated = migrateProfile(rawProfile);
      if (migrated) {
        writeJson(StorageKeys.profile, migrated);
        report.profilesMigrated++;
      }
    }
  } catch (err) {
    console.warn('[dataMigration] Błąd podczas migracji profilu:', err);
  }

  // 2. Vaulty (przeszukujemy wszystkie klucze cvelocity:vault:*)
  try {
    const vaultPrefix = `${StorageKeys.vault}:`;
    const vaultKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(vaultPrefix)) {
        vaultKeys.push(k);
      }
    }

    for (const key of vaultKeys) {
      const rawVault = readJson<Record<string, unknown> | null>(key, null);
      if (rawVault && rawVault.schemaVersion !== CURRENT_DATA_SCHEMA_VERSION) {
        const migrated = migrateVault(rawVault);
        writeJson(key, migrated);
        report.vaultsMigrated++;
      }
    }
  } catch (err) {
    console.warn('[dataMigration] Błąd podczas migracji vaultów:', err);
  }

  // 3. Aplikacje (Pipeline)
  try {
    // Stary klucz wspólny cvelocity:applications
    const legacyApps = readJson<unknown>(StorageKeys.applications, null);
    if (Array.isArray(legacyApps) && legacyApps.some((a) => !isRecord(a) || a.schemaVersion !== CURRENT_DATA_SCHEMA_VERSION)) {
      const migrated = migrateApplications(legacyApps);
      writeJson(StorageKeys.applications, migrated);
      report.applicationsMigrated += migrated.length;
    }

    // Klucze per-profil cvelocity:applications:*
    const appsPrefix = `${StorageKeys.applications}:`;
    const appsKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(appsPrefix)) {
        appsKeys.push(k);
      }
    }

    for (const key of appsKeys) {
      const rawApps = readJson<unknown>(key, null);
      if (Array.isArray(rawApps) && rawApps.some((a) => !isRecord(a) || a.schemaVersion !== CURRENT_DATA_SCHEMA_VERSION)) {
        const migrated = migrateApplications(rawApps);
        writeJson(key, migrated);
        report.applicationsMigrated += migrated.length;
      }
    }
  } catch (err) {
    console.warn('[dataMigration] Błąd podczas migracji aplikacji:', err);
  }

  // 4. Biblioteka CV (CV Library)
  try {
    const rawCvLibrary = readJson<unknown>(StorageKeys.cvLibrary, null);
    if (Array.isArray(rawCvLibrary) && rawCvLibrary.some((doc) => !isRecord(doc) || doc.schemaVersion !== CURRENT_DATA_SCHEMA_VERSION)) {
      const migrated = migrateCVLibrary(rawCvLibrary);
      writeJson(StorageKeys.cvLibrary, migrated);
      report.cvLibraryMigrated += migrated.length;
    }
  } catch (err) {
    console.warn('[dataMigration] Błąd podczas migracji biblioteki CV:', err);
  }

  // 5. Cloud Outbox (cvelocity:cloud-vault-outbox:*)
  try {
    const outboxPrefix = 'cvelocity:cloud-vault-outbox:';
    const outboxKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(outboxPrefix)) {
        outboxKeys.push(k);
      }
    }

    for (const key of outboxKeys) {
      const rawPending = readJson<PendingCloudVaultSave | null>(key, null);
      if (rawPending && rawPending.vault && rawPending.vault.schemaVersion !== CURRENT_DATA_SCHEMA_VERSION) {
        const migratedVault = migrateVault(rawPending.vault);
        writeJson(key, { ...rawPending, vault: migratedVault });
        report.cloudOutboxMigrated++;
      }
    }
  } catch (err) {
    console.warn('[dataMigration] Błąd podczas migracji bufora chmurowego:', err);
  }

  const totalMigrated =
    report.profilesMigrated +
    report.vaultsMigrated +
    report.applicationsMigrated +
    report.cvLibraryMigrated +
    report.cloudOutboxMigrated;

  if (totalMigrated > 0) {
    console.info('[dataMigration] Zakończono migrację danych do schematu v' + CURRENT_DATA_SCHEMA_VERSION, report);
  }

  return report;
}
