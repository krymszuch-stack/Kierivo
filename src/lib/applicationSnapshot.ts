import {
  ApplicationDocumentSnapshot,
  AtsCheckResult,
  CoverLetter,
  GeneratedCvExport,
  JobApplication,
  JobOffer,
  MasterVault,
  TailoredResume,
} from '../types';
import { CURRENT_DATA_SCHEMA_VERSION, migrateVault } from './dataMigration';
import { createEmptyVault } from './sampleVault';

/**
 * Wykonuje głęboką kopię obiektu, odcinając referencje pamięciowe.
 * Preferuje natywne `structuredClone`, z niezawodnym fallbackiem na serializację JSON.
 */
export function deepClone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value);
    } catch {
      // Fallback w przypadku obiektów niemożliwych do sklonowania natywnie
    }
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

export interface BrokenExperienceLink {
  highlightIndex: number;
  experienceId: string;
  role: string;
  company: string;
  suggestedExperienceId?: string;
}

export interface SnapshotIntegrityReport {
  isValid: boolean;
  brokenExperienceLinks: BrokenExperienceLink[];
  brokenExperienceOrderLinks: string[];
  brokenClaimLinks: string[];
  missingRequiredFields: string[];
}

/**
 * Weryfikuje integralność referencyjną snapshotu aplikacji.
 *
 * Sprawdza, czy powiązania w wygenerowanym CV (`selectedHighlights`, `experienceOrder`, claimy)
 * wskazują na istniejące rekordy w zagnieżdżonym `vaultSnapshot`.
 */
export function validateSnapshotIntegrity(
  snapshot: ApplicationDocumentSnapshot
): SnapshotIntegrityReport {
  const brokenExperienceLinks: BrokenExperienceLink[] = [];
  const brokenExperienceOrderLinks: string[] = [];
  const brokenClaimLinks: string[] = [];
  const missingRequiredFields: string[] = [];

  if (!snapshot || typeof snapshot !== 'object') {
    return {
      isValid: false,
      brokenExperienceLinks: [],
      brokenExperienceOrderLinks: [],
      brokenClaimLinks: [],
      missingRequiredFields: ['snapshot'],
    };
  }

  // Wymagane pola główne
  if (snapshot.schemaVersion !== CURRENT_DATA_SCHEMA_VERSION) {
    missingRequiredFields.push('schemaVersion');
  }
  if (!snapshot.createdAt) {
    missingRequiredFields.push('createdAt');
  }
  if (!snapshot.vaultSnapshot) {
    missingRequiredFields.push('vaultSnapshot');
  }
  if (!snapshot.tailoredResume) {
    missingRequiredFields.push('tailoredResume');
  }
  if (!snapshot.jobOfferSnapshot?.title || !snapshot.jobOfferSnapshot?.company) {
    missingRequiredFields.push('jobOfferSnapshot (title/company)');
  }

  const vault = snapshot.vaultSnapshot;
  const tailored = snapshot.tailoredResume;

  if (vault && tailored) {
    const historyList = Array.isArray(vault.history) ? vault.history : [];
    const validHistoryIds = new Set(historyList.map((e) => e.id).filter(Boolean));

    // 1. Walidacja powiązań selectedHighlights -> vaultSnapshot.history
    const highlights = Array.isArray(tailored.selectedHighlights)
      ? tailored.selectedHighlights
      : [];

    highlights.forEach((sh, index) => {
      if (!sh.experienceId || !validHistoryIds.has(sh.experienceId)) {
        // Poszukiwanie pasującego wpisu po nazwie firmy i stanowisku
        const matched = historyList.find(
          (exp) =>
            exp.company?.toLowerCase().trim() === sh.company?.toLowerCase().trim() &&
            exp.role?.toLowerCase().trim() === sh.role?.toLowerCase().trim()
        );

        brokenExperienceLinks.push({
          highlightIndex: index,
          experienceId: sh.experienceId || '',
          role: sh.role || '',
          company: sh.company || '',
          suggestedExperienceId: matched?.id,
        });
      }
    });

    // 2. Walidacja kolejności doświadczenia (experienceOrder)
    if (Array.isArray(tailored.experienceOrder)) {
      for (const orderId of tailored.experienceOrder) {
        if (!validHistoryIds.has(orderId)) {
          brokenExperienceOrderLinks.push(orderId);
        }
      }
    }

    // 3. Walidacja spójności claimów w Vault
    if (Array.isArray(vault.claims)) {
      for (const c of vault.claims) {
        if (!c || !c.id || typeof c.id !== 'string') {
          brokenClaimLinks.push(c?.id || 'unknown_claim');
        }
      }
    }
  }

  const isValid =
    brokenExperienceLinks.length === 0 &&
    brokenExperienceOrderLinks.length === 0 &&
    brokenClaimLinks.length === 0 &&
    missingRequiredFields.length === 0;

  return {
    isValid,
    brokenExperienceLinks,
    brokenExperienceOrderLinks,
    brokenClaimLinks,
    missingRequiredFields,
  };
}

/**
 * Naprawia uszkodzone lub nieaktualne referencje w snapshocie aplikacji.
 * Jeśli `experienceId` w zoptymalizowanym osiągnięciu nie pasuje do żadnego rekordu
 * z `vaultSnapshot.history`, próbuje odnaleźć właściwy rekord na podstawie firmy i roli.
 */
export function repairSnapshotReferences(
  snapshot: ApplicationDocumentSnapshot
): ApplicationDocumentSnapshot {
  const cloned = deepClone(snapshot);
  const vault = cloned.vaultSnapshot;
  const tailored = cloned.tailoredResume;

  if (!vault || !tailored) {
    return cloned;
  }

  const historyList = Array.isArray(vault.history) ? vault.history : [];
  const validHistoryIds = new Set(historyList.map((e) => e.id).filter(Boolean));

  // Naprawa selectedHighlights
  if (Array.isArray(tailored.selectedHighlights)) {
    tailored.selectedHighlights = tailored.selectedHighlights.map((sh) => {
      if (!sh.experienceId || !validHistoryIds.has(sh.experienceId)) {
        const candidate =
          historyList.find(
            (exp) =>
              exp.company?.toLowerCase().trim() === sh.company?.toLowerCase().trim() &&
              exp.role?.toLowerCase().trim() === sh.role?.toLowerCase().trim()
          ) ||
          historyList.find(
            (exp) => exp.company?.toLowerCase().trim() === sh.company?.toLowerCase().trim()
          );

        if (candidate) {
          return {
            ...sh,
            experienceId: candidate.id,
          };
        }
      }
      return sh;
    });
  }

  // Naprawa experienceOrder — usuwamy wiszące identyfikatory
  if (Array.isArray(tailored.experienceOrder)) {
    tailored.experienceOrder = tailored.experienceOrder.filter((id) =>
      validHistoryIds.has(id)
    );
  }

  return cloned;
}

export interface CreateApplicationDocumentSnapshotParams {
  vault: MasterVault;
  tailoredResume: TailoredResume;
  jobOffer:
    | JobOffer
    | {
        id?: string;
        title: string;
        company: string;
        salary?: string;
        location?: string;
        description?: string;
        url?: string;
      };
  atsResult?: AtsCheckResult | null;
  coverLetter?: CoverLetter | null;
  exportedCv?: GeneratedCvExport | null;
  createdAt?: string;
}

/**
 * Tworzy w pełni niezależny, znormalizowany i zweryfikowany snapshot dokumentów aplikacji.
 *
 * Gwarantuje:
 * 1. Pełną izolację pamięciową (deep clone) — mutacje MasterVault nie zmienią snapshotu.
 * 2. Wersjonowanie schematu (`schemaVersion: 1`).
 * 3. Normalizację struktury Vaulta (`migrateVault`).
 * 4. Samonaprawę wiszących referencji (`repairSnapshotReferences`).
 */
export function createApplicationDocumentSnapshot(
  params: CreateApplicationDocumentSnapshotParams
): ApplicationDocumentSnapshot {
  const clonedVault = migrateVault(deepClone(params.vault));
  const clonedTailored = deepClone(params.tailoredResume);
  const clonedCoverLetter = params.coverLetter ? deepClone(params.coverLetter) : undefined;
  const clonedAtsResult = params.atsResult ? deepClone(params.atsResult) : undefined;
  const clonedExportedCv = params.exportedCv ? deepClone(params.exportedCv) : undefined;

  const rawSnapshot: ApplicationDocumentSnapshot = {
    schemaVersion: CURRENT_DATA_SCHEMA_VERSION,
    createdAt: params.createdAt || new Date().toISOString(),
    tailoredResume: clonedTailored,
    coverLetter: clonedCoverLetter,
    vaultSnapshot: clonedVault,
    jobOfferSnapshot: {
      id: params.jobOffer.id,
      title: params.jobOffer.title || '',
      company: params.jobOffer.company || '',
      salary: params.jobOffer.salary || '',
      location: params.jobOffer.location || '',
      description: params.jobOffer.description || '',
      url: params.jobOffer.url || '',
    },
    atsResultSnapshot: clonedAtsResult,
    exportedCv: clonedExportedCv,
  };

  return repairSnapshotReferences(rawSnapshot);
}

/**
 * Rozstrzyga, z jakiego MasterVault powinny korzystać widoki renderujące i eksportujące dla danej aplikacji.
 *
 * Jeżeli aplikacja posiada `documentSnapshot.vaultSnapshot`, zwraca ten historyczny,
 * niezmienny profil. W przeciwnym razie zwraca bezpieczną kopię podanego `fallbackVault`
 * lub pusty profil początkowy (zgodnie z Regułą 1: Zero wymyślonych danych).
 */
export function resolveApplicationVault(
  application: JobApplication | null | undefined,
  fallbackVault?: MasterVault
): MasterVault {
  if (application?.documentSnapshot?.vaultSnapshot) {
    return deepClone(application.documentSnapshot.vaultSnapshot);
  }
  if (fallbackVault) {
    return deepClone(fallbackVault);
  }
  return createEmptyVault();
}
