import type { MasterVault } from '../types';
import { identifyingValues, pseudonymize } from '../server/pseudonymize';

/** Ograniczony kontekst do ćwiczeń; nie przekazujemy całego MasterVault do API. */
export interface InterviewCoachProfileContext {
  roleTitle?: string;
  hardSkills: string[];
  toolsAndTech: string[];
  experience: Array<{ role: string; highlights: string[] }>;
}

export function buildInterviewCoachProfileContext(vault: MasterVault): InterviewCoachProfileContext {
  const safeText = (value: string) => pseudonymize(value, identifyingValues(vault)).text;

  return {
    roleTitle: safeText(vault.personalInfo?.title?.trim() || '') || undefined,
    hardSkills: (vault.skillsMatrix?.hardSkills ?? []).slice(0, 8).map(safeText),
    toolsAndTech: (vault.skillsMatrix?.toolsAndTech ?? []).slice(0, 8).map(safeText),
    experience: (vault.history ?? []).slice(0, 3).map((entry) => ({
      // Nazwy firm i daty nie są potrzebne do wygenerowania pytania.
      role: safeText(entry.role || ''),
      highlights: (entry.highlights ?? []).slice(0, 2).map((highlight) => safeText(highlight.text || '')),
    })),
  };
}
