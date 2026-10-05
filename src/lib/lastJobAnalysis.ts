import type { LastJobAnalysisSummary } from './storage';

export type LastJobAnalysisRead =
  | { state: 'missing' }
  | { state: 'invalid' }
  | { state: 'valid'; value: LastJobAnalysisSummary };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * `localStorage` może zawierać stary albo ręcznie uszkodzony zapis. Walidujemy
 * granicę wejścia, bo widok używa list w `.slice().map()`; nie naprawiamy ich
 * pustymi tablicami, które wyglądałyby jak rzeczywista analiza bez luk.
 */
export function readLastJobAnalysis(value: unknown): LastJobAnalysisRead {
  if (value === null || value === undefined) return { state: 'missing' };
  if (!isRecord(value) ||
      typeof value.position !== 'string' ||
      typeof value.company !== 'string' ||
      !isStringArray(value.strengths) ||
      !isStringArray(value.gaps) ||
      typeof value.analyzedAt !== 'string' ||
      (value.calculatedAt !== undefined && typeof value.calculatedAt !== 'string') ||
      (value.calculationMonth !== undefined && typeof value.calculationMonth !== 'string') ||
      (value.score !== undefined && typeof value.score !== 'number') ||
      (value.atsScoreProvenance !== undefined && typeof value.atsScoreProvenance !== 'string') ||
      (value.profileUpdatedAt !== undefined && typeof value.profileUpdatedAt !== 'string')) {
    return { state: 'invalid' };
  }

  return { state: 'valid', value: value as unknown as LastJobAnalysisSummary };
}
