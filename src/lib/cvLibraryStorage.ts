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
import { StorageKeys, readJson, writeJson } from './storage';

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
  'Zweryfikowane ATS',
  'Wysłane',
] as const;

export function getSavedCVs(): SavedCVDocument[] {
  return readJson<SavedCVDocument[]>(StorageKeys.cvLibrary, []);
}

export function saveCV(
  data: Omit<SavedCVDocument, 'id' | 'createdAt' | 'updatedAt' | 'downloadCount'>
): SavedCVDocument {
  const all = getSavedCVs();
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
  writeJson(StorageKeys.cvLibrary, all);
  return newDoc;
}

export function updateCV(id: string, updates: Partial<SavedCVDocument>): SavedCVDocument | null {
  const all = getSavedCVs();
  const index = all.findIndex((doc) => doc.id === id);
  if (index === -1) return null;

  const updated: SavedCVDocument = {
    ...all[index],
    ...updates,
    tags: updates.tags ? Array.from(new Set(updates.tags)) : all[index].tags,
    updatedAt: new Date().toISOString(),
  };

  all[index] = updated;
  writeJson(StorageKeys.cvLibrary, all);
  return updated;
}

export function duplicateCV(id: string, customTitle?: string): SavedCVDocument | null {
  const all = getSavedCVs();
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
  writeJson(StorageKeys.cvLibrary, all);
  return cloned;
}

export function deleteCV(id: string): boolean {
  const all = getSavedCVs();
  const filtered = all.filter((doc) => doc.id !== id);
  if (filtered.length === all.length) return false;

  writeJson(StorageKeys.cvLibrary, filtered);
  return true;
}

export function recordDownload(id: string): void {
  const all = getSavedCVs();
  const index = all.findIndex((doc) => doc.id === id);
  if (index === -1) return;

  all[index].downloadCount = (all[index].downloadCount || 0) + 1;
  all[index].lastExportedAt = new Date().toISOString();
  writeJson(StorageKeys.cvLibrary, all);
}

export function addTag(id: string, tag: string): SavedCVDocument | null {
  const trimmed = tag.trim();
  if (!trimmed) return null;

  const all = getSavedCVs();
  const index = all.findIndex((doc) => doc.id === id);
  if (index === -1) return null;

  const currentTags = new Set(all[index].tags || []);
  currentTags.add(trimmed);
  all[index].tags = Array.from(currentTags);
  all[index].updatedAt = new Date().toISOString();

  writeJson(StorageKeys.cvLibrary, all);
  return all[index];
}

export function removeTag(id: string, tag: string): SavedCVDocument | null {
  const all = getSavedCVs();
  const index = all.findIndex((doc) => doc.id === id);
  if (index === -1) return null;

  all[index].tags = (all[index].tags || []).filter((t) => t !== tag);
  all[index].updatedAt = new Date().toISOString();

  writeJson(StorageKeys.cvLibrary, all);
  return all[index];
}
