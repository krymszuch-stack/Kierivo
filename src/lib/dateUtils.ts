/**
 * Narzędzia do obsługi, formatowania i walidacji dat (miesiąc + rok).
 *
 * Wspiera formaty:
 * - YYYY-MM (standard bazowy w MasterVault, np. '2024-09')
 * - MM.YYYY (częsty polski format wpisywany ręcznie, np. '09.2024')
 * - Nazwy słowne po polsku (np. 'wrzesień 2024', 'wrz 2024')
 * - Obsługę 'Obecnie' / 'W trakcie'
 */

export const POLISH_MONTHS = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
] as const;

export const POLISH_MONTHS_SHORT = [
  'sty',
  'lut',
  'mar',
  'kwi',
  'maj',
  'cze',
  'lip',
  'sie',
  'wrz',
  'paź',
  'lis',
  'gru',
] as const;

/**
 * Parsuje dowolny wpisany ciąg znaków do znormalizowanego formatu 'YYYY-MM'.
 * Zwraca null, jeśli format nie jest rozpoznawalny.
 */
export function parseMonthYear(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Już w formacie YYYY-MM
  const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }

  // 2. Format MM.YYYY lub MM/YYYY lub MM-YYYY
  const plMatch = trimmed.match(/^(\d{1,2})[-/.](\d{4})$/);
  if (plMatch) {
    const month = parseInt(plMatch[1], 10);
    const year = parseInt(plMatch[2], 10);
    if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
  }

  // 3. Samo YYYY (np. '2024') -> mapujemy na styczeń danego roku
  const yearOnlyMatch = trimmed.match(/^(\d{4})$/);
  if (yearOnlyMatch) {
    const year = parseInt(yearOnlyMatch[1], 10);
    if (year >= 1900 && year <= 2100) {
      return `${year}-01`;
    }
  }

  // 4. Nazwa słowna po polsku, np. "wrzesień 2024", "wrz 2024"
  const lower = trimmed.toLowerCase();
  for (let i = 0; i < POLISH_MONTHS.length; i++) {
    const full = POLISH_MONTHS[i];
    const short = POLISH_MONTHS_SHORT[i];
    // Granica słowa zapobiega dopasowaniu 'sie' wewnątrz 'wrzesień'
    const wordPattern = new RegExp(`(^|\\s|[.,/\\-])(?:${full}|${short})($|\\s|[.,/\\-])`, 'i');
    if (wordPattern.test(lower)) {
      const yearMatch = lower.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) {
        return `${yearMatch[1]}-${String(i + 1).padStart(2, '0')}`;
      }
    }
  }

  return null;
}

/**
 * Format przyjazny dla oka po polsku: np. '2024-09' -> 'wrzesień 2024'.
 */
export function formatMonthYear(
  value: string | null | undefined,
  options?: { short?: boolean; fallback?: string }
): string {
  if (!value) return options?.fallback ?? '';
  const parsed = parseMonthYear(value);
  if (!parsed) return value;

  const [yearStr, monthStr] = parsed.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return value;

  const monthName = options?.short ? POLISH_MONTHS_SHORT[monthIdx] : POLISH_MONTHS[monthIdx];
  return `${monthName} ${yearStr}`;
}

/**
 * Zwraca bieżący miesiąc i rok w formacie 'YYYY-MM'.
 */
export function getCurrentMonthYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Sprawdza, czy podana data (YYYY-MM) przypada w przyszłości względem bieżącego miesiąca.
 */
export function isFutureMonthYear(value: string | null | undefined): boolean {
  if (!value) return false;
  const parsed = parseMonthYear(value);
  if (!parsed) return false;

  const current = getCurrentMonthYear();
  return parsed > current;
}

/**
 * Weryfikuje spójność chronologiczną zakresu (startDate vs endDate).
 * Zwraca błędy lub ostrzeżenia.
 */
export function validateDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  isCurrent?: boolean
): { error?: string; warning?: string } {
  const parsedStart = parseMonthYear(startDate);
  const parsedEnd = parseMonthYear(endDate);

  if (parsedStart && isFutureMonthYear(parsedStart)) {
    return {
      warning: 'Data rozpoczęcia przypada w przyszłości.',
    };
  }

  if (!isCurrent && parsedStart && parsedEnd) {
    if (parsedStart > parsedEnd) {
      return {
        error: 'Data rozpoczęcia nie może być późniejsza niż data zakończenia.',
      };
    }
  }

  return {};
}
