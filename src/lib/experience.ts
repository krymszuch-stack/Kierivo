import { parseDateToDecimalYear } from './consistencyGuard/consistencyEngine';

/**
 * Kanoniczna matematyka stażu — unia przedziałów (reguła: T = miara unii).
 *
 * Wcześniej staż liczyły trzy różne mechanizmy i każdy był inaczej złamany:
 * `computeExperienceScore` sumował naiwnie (`2020-22 + 2021-23 = 4` zamiast 3)
 * i zerował stanowiska bieżące (`isCurrent → end = start`); `renderHudFromClaims`
 * dodawał pełny czas trwania za KAŻDY punktor (2-letnia rola z 5 punktorami
 * raportowała 12 lat); `calculateYearsDifference` parsował pojedynczą datę
 * jako przedział (`2020-01` → 19 lat) i działał tylko przez przypadkowe
 * skasowanie się dwóch błędów.
 *
 * Jeden przedział na wpis historii. Punktory nie są czasem.
 */

export interface EmploymentInterval {
  start: number;
  end: number;
  sourceId: string;
}

function toDecimal(dateStr: string | undefined): number | null {
  if (!dateStr) return null;
  return parseDateToDecimalYear(dateStr);
}

/**
 * Przedział zatrudnienia dla wpisu historii. Bieżące stanowisko kończy się
 * DZIŚ (nie w dacie startu). Nieprawidłowe/przyszłe/odwrócone przedziały
 * są odrzucane (zwracają null) zamiast wymyślać staż.
 */
export function employmentIntervalForJob(job: {
  id?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
}): EmploymentInterval | null {
  const startRaw = (job?.startDate ?? '').trim();
  if (!startRaw) return null;
  const start = toDecimal(startRaw);
  if (start === null) return null;

  const now = toDecimal('Obecnie');
  const endRaw = job?.isCurrent ? 'Obecnie' : (job?.endDate ?? '').trim();
  const end = endRaw ? toDecimal(endRaw) : start;
  if (end === null) return null;

  if (start > end) return null;
  // Start w przyszłości (powyżej miesiąca tolerancji) — nie jest stażem.
  if (now !== null && start > now + 1 / 12) return null;

  return { start, end, sourceId: job?.id ?? '' };
}

/** Suma rozłącznej unii przedziałów w latach (sortowanie + scalań). */
export function unionYears(intervals: EmploymentInterval[]): number {
  const valid = intervals
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end >= i.start)
    .sort((a, b) => a.start - b.start);
  if (valid.length === 0) return 0;
  let total = 0;
  let curStart = valid[0].start;
  let curEnd = valid[0].end;
  for (let k = 1; k < valid.length; k++) {
    const next = valid[k];
    if (next.start <= curEnd) {
      curEnd = Math.max(curEnd, next.end);
    } else {
      total += curEnd - curStart;
      curStart = next.start;
      curEnd = next.end;
    }
  }
  total += curEnd - curStart;
  return Math.max(0, total);
}

/** Unia stażu dla całej historii (jedna miara na wpis, nie na punktor). */
export function unionExperienceYears(
  history: Array<{ id?: string; startDate?: string; endDate?: string; isCurrent?: boolean }> | undefined | null
): number {
  if (!Array.isArray(history) || history.length === 0) return 0;
  const intervals: EmploymentInterval[] = [];
  for (const job of history) {
    const iv = employmentIntervalForJob(job ?? {});
    if (iv) intervals.push(iv);
  }
  return unionYears(intervals);
}
