import { ApplicationStatus, JobApplication, MasterVault } from '../types';
import { isValidOffsetDateTime } from './isoDateTime';
import { normalizeApplicationInterviews, projectInterviewAt } from './applicationInterview';
import { isAtsScoreProvenance } from './atsScoreProvenance';
import { isValidAtsScoreContext } from './atsScoreEvidence';
import { normalizeExternalHttpUrl } from './externalHttpUrl';
import { LocalProfile } from './localProfile';
import { SavedCVDocument } from './cvLibraryStorage';
import { PendingCloudVaultSave } from './cloudVaultOutbox';
import { createEmptyVault } from './sampleVault';
import { readJson, StorageKeys, writeJson } from './storage';
import { isValidAtsScore } from './canonicalAts';
import { isApplicationEvent } from './applicationRecordSchema';

/**
 * Aktualna wersja jednolitego schematu danych aplikacji (semantyczna wersja encji).
 *
 * Rośnie o 1 za każdym razem, gdy zmienia się kształt encji biznesowych
 * (profil, vault, aplikacje, biblioteka CV).
 */
export const CURRENT_DATA_SCHEMA_VERSION = 1 as const;
/** Wersjonujemy aplikacje osobno, aby ich migracje nie przebudowywały vaultów/profili. */
export const CURRENT_APPLICATION_SCHEMA_VERSION = 2 as const;

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
    Array.isArray(raw.history) &&
    raw.history.every((entry) => isRecord(entry) && Array.isArray(entry.highlights)) &&
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
      ...(typeof personalInfoRaw.rodoClause === 'string' ? { rodoClause: personalInfoRaw.rodoClause } : {}),
      ...(typeof personalInfoRaw.gdprClause === 'string' ? { gdprClause: personalInfoRaw.gdprClause } : {}),
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
    // W starych wpisach brakowało czasem `highlights`. Zachowujemy doświadczenie,
    // ale pustą listę traktujemy jako brak potwierdzonych punktów — nie wolno
    // ani wywrócić kokpitu, ani dorobić użytkownikowi treści CV.
    history: Array.isArray(raw.history)
      ? raw.history
        .filter(isRecord)
        .map((entry) => ({
          ...entry,
          highlights: Array.isArray(entry.highlights) ? entry.highlights : [],
        })) as any
      : [],
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
  const raw = rawDate.trim();
  // Sprawdź czy format to YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  // Format DD.MM.YYYY lub DD-MM-YYYY lub DD/MM/YYYY
  const dmyMatch = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const day = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const month = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  // Format YYYY-MM
  const ymMatch = raw.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (ymMatch) {
    const year = ymMatch[1];
    const month = String(parseInt(ymMatch[2], 10)).padStart(2, '0');
    return `${year}-${month}-01`;
  }
  const parsed = new Date(raw.replace(/\//g, '-'));
  return isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

/**
 * Migruje pojedynczą aplikację do jednolitego schematu.
 */
export function migrateApplication(raw: unknown): JobApplication | null {
  if (!isRecord(raw)) return null;

  // Zachowaj pola dodane przez nowsze/eksperymentalne części aplikacji.
  // Pola kanoniczne poniżej nadal są walidowane i nadpisują surowe wartości.
  const knownFields = new Set([
    'schemaVersion', 'id', 'company', 'position', 'salary', 'date', 'applied_at', 'status',
    'notes', 'jobUrl', 'atsScore', 'atsScoreProvenance', 'atsScoreContext', 'missingKeywords',
    'interviewAt', 'events', 'migrationQuarantine', 'briefDoneAt', 'debriefSentAt',
    'documentSnapshot', 'updatedAt',
  ]);
  const preservedFields = Object.fromEntries(
    Object.entries(raw).filter(([key]) => !knownFields.has(key)),
  );

  const id = typeof raw.id === 'string' && raw.id ? raw.id : `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const company = typeof raw.company === 'string' ? raw.company.trim() : '';
  const position = typeof raw.position === 'string' ? raw.position.trim() : '';
  if (!company && !position) return null;

  // Brak albo nieznany status nie jest dowodem, że kandydat wysłał aplikację.
  const rawStatus = typeof raw.status === 'string' ? raw.status : 'Do wysłania';
  const status: ApplicationStatus = STATUS_MAPPING[rawStatus] ?? 'Do wysłania';
  const salary = typeof raw.salary === 'string' ? raw.salary.trim() : '';
  const date = normalizeDate(raw.date || (raw as any).applied_at);
  const jobUrl = normalizeExternalHttpUrl(raw.jobUrl);
  const rawEvents = Array.isArray(raw.events) ? raw.events : [];
  const validEvents = rawEvents.filter(isApplicationEvent);
  const existingQuarantine = Array.isArray(raw.migrationQuarantine) ? raw.migrationQuarantine : [];
  const newlyQuarantinedEvents = rawEvents
    .filter((event) => !isApplicationEvent(event))
    .map((rawPayload) => ({ rawPayload, reason: 'invalid_application_event' }));
  if (raw.events !== undefined && !Array.isArray(raw.events)) {
    newlyQuarantinedEvents.push({ rawPayload: raw.events, reason: 'events_not_array' });
  }
  // Ponowny start nie może dopisywać kolejnych kopii tej samej uszkodzonej wartości.
  const quarantinePayloads = new Set(existingQuarantine.map((entry) => {
    const payload = isRecord(entry) && 'rawPayload' in entry ? entry.rawPayload : entry;
    try { return JSON.stringify(payload); } catch { return undefined; }
  }));
  const migrationQuarantine = [
    ...existingQuarantine,
    ...newlyQuarantinedEvents.filter((entry) => {
      const serialized = JSON.stringify(entry.rawPayload);
      if (quarantinePayloads.has(serialized)) return false;
      quarantinePayloads.add(serialized);
      return true;
    }).map((entry) => ({ ...entry, quarantinedAtSchema: CURRENT_APPLICATION_SCHEMA_VERSION })),
  ];

  const legacyInterviewAt = typeof raw.interviewAt === 'string' && isValidOffsetDateTime(raw.interviewAt)
    ? raw.interviewAt
    : undefined;
  const migrationNow = Date.now();
  const events = validEvents.map((event) => status === 'Odrzucona' &&
    event.kind === 'interview' && event.state !== 'cancelled' && Date.parse(event.scheduledAt) >= migrationNow
    ? { ...event, state: 'cancelled' as const }
    : event);
  // Obecność dowolnej rozmowy w osi jest rozstrzygająca: odwołanego
  // legacy terminu nie wolno reaktywować przez ponowną syntezę z interviewAt.
  if (status !== 'Odrzucona' && legacyInterviewAt && !events.some((event) => event.kind === 'interview')) {
    events.push({
      id: `legacy-interview-${id}`,
      kind: 'interview',
      scheduledAt: legacyInterviewAt,
      state: 'confirmed',
      source: 'user',
    });
  }
  const interviewAt = projectInterviewAt(events);

  const app: JobApplication = {
    ...preservedFields,
    schemaVersion: CURRENT_APPLICATION_SCHEMA_VERSION,
    id,
    company,
    position,
    salary,
    date,
    status,
    ...(typeof raw.notes === 'string' ? { notes: raw.notes } : {}),
    ...(jobUrl ? { jobUrl } : {}),
    ...(isValidAtsScore(raw.atsScore) ? { atsScore: raw.atsScore } : {}),
    ...(isAtsScoreProvenance(raw.atsScoreProvenance) && isValidAtsScore(raw.atsScore)
      ? { atsScoreProvenance: raw.atsScoreProvenance }
      : {}),
    ...(isAtsScoreProvenance(raw.atsScoreProvenance) &&
      isValidAtsScore(raw.atsScore) && isValidAtsScoreContext(raw.atsScoreContext)
      ? { atsScoreContext: raw.atsScoreContext }
      : {}),
    ...(Array.isArray(raw.missingKeywords) ? { missingKeywords: raw.missingKeywords } : {}),
    ...(interviewAt ? { interviewAt } : {}),
    ...(raw.events !== undefined || legacyInterviewAt ? { events } : {}),
    ...(migrationQuarantine.length > 0 ? { migrationQuarantine } : {}),
    ...(typeof raw.briefDoneAt === 'string' ? { briefDoneAt: raw.briefDoneAt } : {}),
    ...(typeof raw.debriefSentAt === 'string' ? { debriefSentAt: raw.debriefSentAt } : {}),
    ...(isRecord(raw.documentSnapshot) ? { documentSnapshot: raw.documentSnapshot as any } : {}),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  };

  return normalizeApplicationInterviews(app);
}

/**
 * Migruje kolekcję aplikacji w Pipeline.
 */
export function migrateApplications(raw: unknown): JobApplication[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(migrateApplication).filter((a): a is JobApplication => Boolean(a));
}

/** Zachowuje nieprzetwarzalne rekordy obok aplikacji udanych w migracji. */
function migrateApplicationRecordsForStorage(raw: unknown[]): { records: unknown[]; migratedCount: number } {
  let migratedCount = 0;
  const records = raw.map((record) => {
    if (isRecord(record) && record.schemaVersion === CURRENT_APPLICATION_SCHEMA_VERSION) return record;
    const migrated = migrateApplication(record);
    if (!migrated) return record;
    migratedCount++;
    return migrated;
  });
  return { records, migratedCount };
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
    if (Array.isArray(legacyApps) && legacyApps.some((a) => !isRecord(a) || a.schemaVersion !== CURRENT_APPLICATION_SCHEMA_VERSION)) {
      const migrated = migrateApplicationRecordsForStorage(legacyApps);
      writeJson(StorageKeys.applications, migrated.records);
      report.applicationsMigrated += migrated.migratedCount;
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
      if (Array.isArray(rawApps) && rawApps.some((a) => !isRecord(a) || a.schemaVersion !== CURRENT_APPLICATION_SCHEMA_VERSION)) {
        const migrated = migrateApplicationRecordsForStorage(rawApps);
        writeJson(key, migrated.records);
        report.applicationsMigrated += migrated.migratedCount;
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
