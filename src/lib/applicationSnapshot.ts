import {
  ApplicationDocumentSnapshot,
  AtsCheckResult,
  CoverLetter,
  CvExportEvent,
  ExportedDocumentSnapshot,
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
 * Znajduje jednoznaczny odpowiednik punktu doświadczenia po zmianie ID.
 * Firma i rola nie wystarczają: ta sama osoba może wrócić do tego samego
 * pracodawcy na tym samym stanowisku. Gdy takich wpisów jest kilka, tekst
 * źródłowego punktu rozstrzyga; przy nadal niejednoznacznym wyniku nie zgadujemy.
 */
function findMatchingExperience(
  history: MasterVault['history'],
  highlight: TailoredResume['selectedHighlights'][number],
): MasterVault['history'][number] | undefined {
  const company = highlight.company?.trim().toLocaleLowerCase('pl-PL') ?? '';
  const role = highlight.role?.trim().toLocaleLowerCase('pl-PL') ?? '';
  const originalText = highlight.originalText?.trim().toLocaleLowerCase('pl-PL') ?? '';
  const sourceMatches = originalText
    ? history.filter((experience) => experience.highlights.some(
      (item) => item.text?.trim().toLocaleLowerCase('pl-PL') === originalText
    ))
    : [];
  if (sourceMatches.length === 1) return sourceMatches[0];
  if (sourceMatches.length > 1) {
    const contextualMatches = sourceMatches.filter((experience) =>
      (experience.company?.trim().toLocaleLowerCase('pl-PL') ?? '') === company &&
      (experience.role?.trim().toLocaleLowerCase('pl-PL') ?? '') === role
    );
    if (contextualMatches.length === 1) return contextualMatches[0];
    return undefined;
  }

  const companyMatches = history.filter((experience) =>
    (experience.company?.trim().toLocaleLowerCase('pl-PL') ?? '') === company
  );
  const roleMatches = companyMatches.filter((experience) =>
    (experience.role?.trim().toLocaleLowerCase('pl-PL') ?? '') === role
  );

  if (roleMatches.length === 1) return roleMatches[0];
  if (companyMatches.length === 1) return companyMatches[0];
  return undefined;
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
      const linkedExperience = historyList.find((experience) => experience.id === sh.experienceId);
      const originalText = sh.originalText?.trim().toLocaleLowerCase('pl-PL') ?? '';
      const sourceMatchesLinkedExperience = !originalText || !linkedExperience || linkedExperience.highlights.some(
        (item) => item.text?.trim().toLocaleLowerCase('pl-PL') === originalText
      );

      if (!sh.experienceId || !validHistoryIds.has(sh.experienceId) || !sourceMatchesLinkedExperience) {
        const matched = findMatchingExperience(historyList, sh);

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
 * Jeśli `experienceId` nie prowadzi do wpisu zawierającego oryginalny tekst punktu,
 * próbuje odnaleźć źródło po tym tekście. Firma i rola są fallbackiem tylko wtedy,
 * gdy wskazują jednoznaczny rekord.
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
      const linkedExperience = historyList.find((experience) => experience.id === sh.experienceId);
      const originalText = sh.originalText?.trim().toLocaleLowerCase('pl-PL') ?? '';
      const sourceMatchesLinkedExperience = !originalText || !linkedExperience || linkedExperience.highlights.some(
        (item) => item.text?.trim().toLocaleLowerCase('pl-PL') === originalText
      );

      if (!sh.experienceId || !validHistoryIds.has(sh.experienceId) || !sourceMatchesLinkedExperience) {
        const candidate = findMatchingExperience(historyList, sh);

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
  exportedDocument?: ExportedDocumentSnapshot | null;
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
  const clonedExportedDocument = params.exportedDocument ? deepClone(params.exportedDocument) : undefined;

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
    exportedDocument: clonedExportedDocument,
  };

  return repairSnapshotReferences(rawSnapshot);
}

/** Buduje snapshot z dokładnie tych danych, które przekazał zakończony eksport. */
export function createApplicationDocumentSnapshotFromExport(
  params: Omit<CreateApplicationDocumentSnapshotParams, 'exportedCv' | 'exportedDocument'>,
  event: CvExportEvent,
): ApplicationDocumentSnapshot {
  return createApplicationDocumentSnapshot({
    ...params,
    vault: event.vault ?? params.vault,
    tailoredResume: event.tailoredResume ?? params.tailoredResume,
    coverLetter: event.coverLetter ?? params.coverLetter,
    exportedCv: event.exportedCv,
    exportedDocument: event.document,
  });
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

/**
 * Odtwarza ofertę, na podstawie której zapisano aplikację. Ściąga na rozmowę
 * ma używać tego snapshotu, a nie oferty, którą użytkownik analizuje później.
 */
export function resolveApplicationJobOffer(application: JobApplication | null | undefined): JobOffer | null {
  const snapshot = application?.documentSnapshot?.jobOfferSnapshot;
  if (!snapshot) return null;

  const description = snapshot.description?.trim() || '';
  // Starsza migracja zapisywała placeholder „Nieznana firma” jako fakt.
  // Nie przekazujemy go dalej do pytań rekrutacyjnych ani wzbogacania AI.
  const storedCompany = snapshot.company || application?.company || '';
  const company = storedCompany === 'Nieznana firma' ? '' : storedCompany;
  return {
    id: snapshot.id || application?.id || '',
    title: snapshot.title || application?.position || '',
    company,
    salary: snapshot.salary || '',
    location: snapshot.location || '',
    description,
    rawDescription: description,
    url: snapshot.url || application?.jobUrl || '',
  };
}
