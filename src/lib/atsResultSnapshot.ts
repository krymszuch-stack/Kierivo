import type { AtsCheckResult } from '../types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/**
 * Historyczne migawki są danymi wejściowymi, nie zaufanym wynikiem TypeScript.
 * Raport ATS wymaga tych list do liczenia sygnałów i renderowania wierszy; brak
 * którejkolwiek z nich nie może zostać zamieniony w pusty, zielony wynik.
 */
export function getRenderableAtsResultSnapshot(value: unknown): AtsCheckResult | null {
  if (!isRecord(value)) return null;

  const requiredLists = [
    value.matchedKeywords,
    value.missingHardSkills,
    value.missingSoftSkills,
    value.ocrWarnings,
    value.badDateFormats,
    value.gapAnalysis,
    value.recommendations,
  ];
  if (!requiredLists.every(isStringArray)) return null;

  return value as unknown as AtsCheckResult;
}
