import { StorageKeys, profileDataKeyFor, readJson, writeJson } from './storage';
import { parseAtsLabDraft, type AtsLabDraft } from './atsLabDraftSchema';
export type { AtsLabDraft } from './atsLabDraftSchema';

/** Szkic oferty i stanowiska nie może przechodzić między profilami. */
export function loadAtsLabDraft(profileId: string): AtsLabDraft {
  return parseAtsLabDraft(readJson<unknown>(profileDataKeyFor(StorageKeys.draftAtsLab, profileId), {}));
}

export function saveAtsLabDraft(profileId: string, draft: AtsLabDraft): void {
  writeJson(profileDataKeyFor(StorageKeys.draftAtsLab, profileId), draft);
}
