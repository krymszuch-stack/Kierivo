/**
 * Zarządzanie Biblioteką Zapisanych Wersji CV (CV Library).
 *
 * Umożliwia użytkownikowi:
 * 1. Zapisywanie wielu wersji CV pod różne oferty pracy z tagami branżowymi.
 * 2. Bezpieczny, ponowny eksport PDF bez utraty limitu lub kredytu pobrania.
 * 3. Błyskawiczne klonowanie wersji (duplikacja) pod nowe stanowisko.
 * 4. Edycję zapisanego wariantu i organizację tagami.
 */

import { MasterVault, TailoredResume } from '../types';
import { StorageKeys, cvLibraryKeyFor, readJson, readJsonForMigration, removeRaw, writeJson, writeJsonDurably } from './storage';
import { areSavedCvDocumentsValid, parseSavedCvDocuments } from './savedCvDocumentSchema';
import { mergeMigrationRecords } from './mergeMigrationRecords';

export interface SavedCVDocument {
  /** Wersja schematu danych encji (liczba całkowita, np. 1). */
  schemaVersion?: number;
  id: string;
  title: string;
  tags: string[];
  theme: string;
  layout: string;
  targetPages: 1 | 2;
  targetRole?: string;
  companyName?: string;
  summaryOverride?: string;
  vault: MasterVault;
  tailoredResume?: TailoredResume | null;
  createdAt: string;
  updatedAt: string;
  lastExportedAt?: string;
  downloadCount: number;
}

export const PRESET_TAGS = [
  'Automatyka',
  'Utrzymanie Ruchu',
  'Elektryka',
  'Mechanika',
  'Robotyka',
  'IT / Bazy',
  'Produkcja',
  '1-stronicowe',
  '2-stronicowe',
  'Wersja EN',
  'Analiza ATS Kierivo',
  'Wysłane',
] as const;

export function getSavedCVs(profileId: string): SavedCVDocument[] {
  return parseSavedCvDocuments(
    readJson<unknown>(cvLibraryKeyFor(profileId), [])
  ) as SavedCVDocument[];
}

/** Stare dokumenty pozostają nieprzypisane do czasu świadomego działania. */
export function getUnassignedLegacyCVs(): SavedCVDocument[] {
  return parseSavedCvDocuments(readJson<unknown>(StorageKeys.cvLibrary, [])) as SavedCVDocument[];
}

/** Przenosi starą wspólną bibliotekę dopiero po potwierdzeniu przez użytkownika. */
export async function claimLegacyCVsFor(profileId: string): Promise<number> {
  if (!profileId) return 0;
  const source = readJsonForMigration(StorageKeys.cvLibrary);
  if (!source.success || source.raw === null) return 0;
  const rawLegacy = source.value;
  if (!areSavedCvDocumentsValid(rawLegacy)) return 0;
  const legacy = parseSavedCvDocuments(rawLegacy) as SavedCVDocument[];
  if (legacy.length === 0) return 0;
  const target = readJsonForMigration(cvLibraryKeyFor(profileId));
  if (!target.success || (target.raw !== null && !areSavedCvDocumentsValid(target.value))) return 0;
  const current = parseSavedCvDocuments(target.raw === null ? [] : target.value) as SavedCVDocument[];
  const merged = mergeMigrationRecords(current, legacy);
  if (!merged) return 0;
  // Źródło jest jedyną odzyskiwalną kopią, dopóki LS lub transakcja IDB
  // nie potwierdzi zapisu. Zwykły writeJson może skończyć tylko w pamięci.
  const persisted = await writeJsonDurably(cvLibraryKeyFor(profileId), merged);
  const currentSource = readJsonForMigration(StorageKeys.cvLibrary);
  if (!persisted || !currentSource.success || currentSource.raw !== source.raw) return 0;
  removeRaw(StorageKeys.cvLibrary);
  return legacy.length;
}

/** Jednorazowe przeniesienie danych z anonimowego profilu do właśnie utworzonego profilu. */
export async function migrateAnonymousCVLibrary(
  fromProfileId: string,
  toProfileId: string,
  removeSource = true,
): Promise<boolean> {
  const key = cvLibraryKeyFor(fromProfileId);
  const source = readJsonForMigration(key);
  if (!source.success) return false;
  const rawAnonymous = source.raw === null ? [] : source.value;
  if (!Array.isArray(rawAnonymous)) return false;
  // Migracja kopiuje surowe legacy bez selektywnego wycinania pól. Widok nadal
  // waliduje każdy rekord osobno; źródło usuwamy wyłącznie po trwałym zapisie kopii.
  const anonymous = rawAnonymous;
  if (anonymous.length === 0) return true;
  const target = readJsonForMigration(cvLibraryKeyFor(toProfileId));
  if (!target.success || (target.raw !== null && !Array.isArray(target.value))) return false;
  const existing = target.raw === null ? [] : target.value as unknown[];
  const merged = mergeMigrationRecords(existing, anonymous);
  if (!merged) return false;
  const saved = await writeJsonDurably(
    cvLibraryKeyFor(toProfileId),
    merged,
  );
  const currentSource = readJsonForMigration(key);
  if (!saved || !currentSource.success || currentSource.raw !== source.raw) return false;
  if (removeSource) removeRaw(key);
  return true;
}

export function saveCV(
  profileId: string,
  data: Omit<SavedCVDocument, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>
): SavedCVDocument {
  const all = getSavedCVs(profileId);
  const now = new Date().toISOString();
  const newDoc: SavedCVDocument = {
    ...data,
    schemaVersion: 1,
    id: `cv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    tags: Array.isArray(data.tags) ? Array.from(new Set(data.tags)) : [],
    createdAt: now,
    updatedAt: now,
    downloadCount: 0,
  };

  all.unshift(newDoc);
  writeJson(cvLibraryKeyFor(profileId), all);
  return newDoc;
}

export function updateCV(profileId: string, id: string, updates: Partial<SavedCVDocument>): SavedCVDocument | null {
  const all = getSavedCVs(profileId);
  const index = all.findIndex((doc) => doc.id === id);
  if (index === -1) return null;

  const updated: SavedCVDocument = {
    ...all[index],
    ...updates,
    tags: updates.tags ? Array.from(new Set(updates.tags)) : all[index].tags,
    updatedAt: new Date().toISOString(),
  };

  all[index] = updated;
  writeJson(cvLibraryKeyFor(profileId), all);
  return updated;
}

export function duplicateCV(profileId: string, id: string, customTitle?: string): SavedCVDocument | null {
  const all = getSavedCVs(profileId);
  const source = all.find((doc) => doc.id === id);
  if (!source) return null;

  const now = new Date().toISOString();
  const cloned: SavedCVDocument = {
    ...JSON.parse(JSON.stringify(source)),
    id: `cv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: customTitle?.trim() || `${source.title} (Kopia)`,
    createdAt: now,
    updatedAt: now,
    downloadCount: 0,
    lastExportedAt: undefined,
  };

  all.unshift(cloned);
  writeJson(cvLibraryKeyFor(profileId), all);
  return cloned;
}

export function deleteCV(profileId: string, id: string): boolean {
  const all = getSavedCVs(profileId);
  const filtered = all.filter((doc) => doc.id !== id);
  if (filtered.length === all.length) return false;

  writeJson(cvLibraryKeyFor(profileId), filtered);
  return true;
}

export function recordDownload(profileId: string, id: string): void {
  const all = getSavedCVs(profileId);
  const index = all.findIndex((doc) => doc.id === id);
  if (index === -1) return;

  all[index].downloadCount = (all[index].downloadCount || 0) + 1;
  all[index].lastExportedAt = new Date().toISOString();
  writeJson(cvLibraryKeyFor(profileId), all);
}

export function addTag(profileId: string, id: string, tag: string): SavedCVDocument | null {
  const trimmed = tag.trim();
  if (!trimmed) return null;

  const all = getSavedCVs(profileId);
  const index = all.findIndex((doc) => doc.id === id);
  if (index === -1) return null;

  const currentTags = new Set(all[index].tags || []);
  currentTags.add(trimmed);
  all[index].tags = Array.from(currentTags);
  all[index].updatedAt = new Date().toISOString();

  writeJson(cvLibraryKeyFor(profileId), all);
  return all[index];
}

export function removeTag(profileId: string, id: string, tag: string): SavedCVDocument | null {
  const all = getSavedCVs(profileId);
  const index = all.findIndex((doc) => doc.id === id);
  if (index === -1) return null;

  all[index].tags = (all[index].tags || []).filter((t) => t !== tag);
  all[index].updatedAt = new Date().toISOString();

  writeJson(cvLibraryKeyFor(profileId), all);
  return all[index];
}
