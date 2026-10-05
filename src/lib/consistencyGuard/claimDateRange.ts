import type { ClaimDateRange } from './types';

/** Zwraca przedział wyłącznie wtedy, gdy profil podaje obie jego granice. */
export function claimDateRangeFromProfile(
  start: string | null | undefined,
  end: string | null | undefined,
): ClaimDateRange | undefined {
  const normalizedStart = start?.trim();
  const normalizedEnd = end?.trim();
  if (!normalizedStart || !normalizedEnd) return undefined;
  return { start: normalizedStart, end: normalizedEnd };
}
