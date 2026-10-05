import type { TailoredResume } from '../types';

export type DocumentSkillGroups = Pick<
  TailoredResume['skillsMatched'],
  'hardSkills' | 'toolsAndTech' | 'softSkills'
>;

function sameItems(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

/**
 * Sklejka CV jest osobnym dokumentem: sugestie dopasowania aktualizują wersję CV,
 * a ręczne poprawki renderera muszą pozostać widoczne bez nadpisywania Vaultu.
 */
export function resolveDocumentSkillGroups(
  originalVaultSkills: DocumentSkillGroups,
  draftVaultSkills: DocumentSkillGroups,
  tailoredSkills?: DocumentSkillGroups | null,
): DocumentSkillGroups {
  const fields: Array<keyof DocumentSkillGroups> = ['hardSkills', 'toolsAndTech', 'softSkills'];
  const resolved = {} as DocumentSkillGroups;

  for (const field of fields) {
    const original = originalVaultSkills[field] ?? [];
    const draft = draftVaultSkills[field] ?? original;
    const tailored = tailoredSkills?.[field];

    resolved[field] = sameItems(original, draft) && tailored
      ? [...tailored]
      : [...draft];
  }

  return resolved;
}
