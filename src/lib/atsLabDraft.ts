import { StorageKeys, profileDataKeyFor, readJson, writeJson } from './storage';

export interface AtsLabDraft {
  jd?: string;
  role?: string;
}

/** Szkic oferty i stanowiska nie może przechodzić między profilami. */
export function loadAtsLabDraft(profileId: string): AtsLabDraft {
  return readJson<AtsLabDraft>(profileDataKeyFor(StorageKeys.draftAtsLab, profileId), {});
}

export function saveAtsLabDraft(profileId: string, draft: AtsLabDraft): void {
  writeJson(profileDataKeyFor(StorageKeys.draftAtsLab, profileId), draft);
}
