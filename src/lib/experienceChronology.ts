export interface ExperienceChronologyFields {
  role?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
}

interface DatePrecisionRange {
  earliestMonth: number;
  latestMonth: number;
}

/** Rok bez miesiąca to zakres, nie grudzień wybrany arbitralnie. */
function datePrecisionRange(value: string | undefined): DatePrecisionRange | null {
  const normalized = (value ?? '').trim().toLowerCase();
  const monthYear = normalized.match(/^(\d{1,2})[-/.]((?:19|20)\d{2})$/);
  if (monthYear) {
    const month = Number(monthYear[1]);
    const year = Number(monthYear[2]);
    if (month >= 1 && month <= 12) {
      const ordinal = year * 12 + month;
      return { earliestMonth: ordinal, latestMonth: ordinal };
    }
  }

  const yearMonth = normalized.match(/^((?:19|20)\d{2})[-/.](\d{1,2})$/);
  if (yearMonth) {
    const year = Number(yearMonth[1]);
    const month = Number(yearMonth[2]);
    if (month >= 1 && month <= 12) {
      const ordinal = year * 12 + month;
      return { earliestMonth: ordinal, latestMonth: ordinal };
    }
  }

  const yearOnly = normalized.match(/^((?:19|20)\d{2})$/);
  if (yearOnly) {
    const firstMonth = Number(yearOnly[1]) * 12 + 1;
    return { earliestMonth: firstMonth, latestMonth: firstMonth + 11 };
  }

  return null;
}

interface LatestExperienceAnalysis<T extends ExperienceChronologyFields> {
  role: string;
  entry: T | null;
}

function analyzeLatestExperience<T extends ExperienceChronologyFields>(
  history: readonly T[],
): LatestExperienceAnalysis<T> {
  if (history.length === 0) return { role: '', entry: null };
  if (history.length === 1) {
    return { role: (history[0].role ?? '').trim(), entry: history[0] };
  }

  const current = history.filter((entry) => entry.isCurrent);
  if (current.length > 0) {
    const roles = new Set(current.map((entry) => (entry.role ?? '').trim()).filter(Boolean));
    return {
      role: roles.size === 1 ? Array.from(roles)[0] : '',
      entry: current.length === 1 ? current[0] : null,
    };
  }

  const dated = history.map((entry) => ({
    entry,
    role: (entry.role ?? '').trim(),
    range: datePrecisionRange(entry.endDate),
  }));
  if (dated.some((item) => !item.range || !item.role)) return { role: '', entry: null };

  const certainlyLatest = dated.filter((candidate) =>
    dated.every((other) => candidate === other || candidate.range!.earliestMonth > other.range!.latestMonth)
  );
  if (certainlyLatest.length === 1) {
    return { role: certainlyLatest[0].role, entry: certainlyLatest[0].entry };
  }

  // Zakresy roczne mogą się pokrywać; wspólny tytuł pozwala podać samą rolę,
  // ale nie daje podstaw, by przypisać firmę lub metrykę do jednego wpisu.
  const possibleLatestRoles = new Set(
    dated
      .filter((candidate) => dated.every((other) =>
        candidate === other || other.range!.earliestMonth <= candidate.range!.latestMonth
      ))
      .map((item) => item.role)
  );
  return { role: possibleLatestRoles.size === 1 ? Array.from(possibleLatestRoles)[0] : '', entry: null };
}

/** Rola z najnowszego doświadczenia bez zależności od kolejności kart w edytorze. */
export function inferLatestExperienceRole<T extends ExperienceChronologyFields>(history: readonly T[]): string {
  return analyzeLatestExperience(history).role;
}

/** Pełny wpis tylko wtedy, gdy daty jednoznacznie wskazują jedną pozycję. */
export function getLatestExperience<T extends ExperienceChronologyFields>(history: readonly T[]): T | null {
  return analyzeLatestExperience(history).entry;
}
