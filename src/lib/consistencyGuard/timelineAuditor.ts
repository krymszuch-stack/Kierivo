import { WorkExperience } from '../../types';
import { ConsistencyAlert } from './types';
import { formatMonthYear } from '../dateUtils';

/**
 * Zwraca znormalizowany rok i miesiąc z ciągu daty (np. '2022-05', '2022.05', '2022', 'Obecnie').
 */
export function parseYearMonthToNumbers(dateStr: string | undefined | null): { year: number; month: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const trimmed = dateStr.trim().toLowerCase();
  if (['obecnie', 'present', 'current', 'teraz', 'now'].includes(trimmed)) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  const matchYm = /^(\d{4})(?:[-/.](\d{1,2}))?/.exec(trimmed);
  if (matchYm) {
    const year = parseInt(matchYm[1], 10);
    const month = matchYm[2] ? parseInt(matchYm[2], 10) : 1;
    if (isNaN(year)) return null;
    return { year, month: Math.min(12, Math.max(1, month)) };
  }

  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  return null;
}

/**
 * Oblicza liczbę pełnych miesięcy przerwy pomiędzy zakończeniem pierwszej pozycji a rozpoczęciem kolejnej.
 * Np. koniec 2022-04 i start 2022-05 -> 0 miesięcy przerwy (płynne przejście).
 * Koniec 2022-04 i start 2022-11 -> 6 miesięcy przerwy (maj, czerwiec, lipiec, sierpień, wrzesień, październik).
 */
export function calculateMonthsBetween(
  endPeriod: { year: number; month: number },
  startPeriod: { year: number; month: number }
): number {
  const monthsDiff = (startPeriod.year - endPeriod.year) * 12 + (startPeriod.month - endPeriod.month) - 1;
  return Math.max(0, monthsDiff);
}

/**
 * Sprawdza, czy podany ciąg znaków lub lokalizacja zawiera informację o pracy zdalnej, hybrydowej lub elastycznej.
 */
export function isRemoteOrFlexibleWork(location?: string, description?: string, role?: string): boolean {
  const text = `${location || ''} ${description || ''} ${role || ''}`.toLowerCase();
  const remoteRegex = /\b(zdaln[a-ząćęłńóśźż]*|remote|hybryd[a-ząćęłńóśźż]*|hybrid|home\s*office|teleprac[a-ząćęłńóśźż]*|b2b|freelance|kontrakt|zlecenie|dorywcz[a-ząćęłńóśźż]*|part-time|p[oó]ł\s*etatu)\b/i;
  return remoteRegex.test(text);
}

/**
 * Wzorzec regex wykrywający twarde, mierzalne metryki (liczby, %, kwoty, wielokrotności, redukcję czasu itp.).
 */
export const METRIC_PATTERNS = [
  /\b\d+([.,]\d+)?\s*%/,                                                                  // Procenty, np. 25%, +40%, -15.5%
  /\b\d+([.,]\d+)?\s*(pln|zł|złotych|usd|eur|gbp|chf|\$|€|£)\b/i,                         // Waluty
  /\b\d+([.,]\d+)?\s*(k|kilo|tys|tys[.]?|tysiąc[a-ząćęłńóśźż]*|mln|milion[a-ząćęłńóśźż]*|mld|x|razy)\b/i, // Skróty skali i krotności
  /\b(z\s+\d+([.,]\d+)?\s*(h|godz|dni|min|s|sek|ms)\s+do\s+\d+([.,]\d+)?\s*(h|godz|dni|min|s|sek|ms)?|o\s+\d+([.,]\d+)?\s*(h|godz|dni|min|s|sek|ms|tyg|%))\b/i, // Skrócenie czasu / poprawa
  /\b\d+\s*(\+|plus)?\s*(klient[a-ząćęłńóśźż]*|użytkownik[a-ząćęłńóśźż]*|user[a-ząćęłńóśźż]*|zgłosze[a-ząćęłńóśźż]*|projekt[a-ząćęłńóśźż]*|wdroże[a-ząćęłńóśźż]*|osób|pracownik[a-ząćęłńóśźż]*|stanowisk|transakcj[a-ząćęłńóśźż]*|serwer[a-ząćęłńóśźż]*|kontener[a-ząćęłńóśźż]*|instalacj[a-ząćęłńóśźż]*|napraw[a-ząćęłńóśźż]*)\b/i,
  /\b(99\.\d+%|sla|uptime|0\s+wypadk[a-ząćęłńóśźż]*|<\s*\d+([.,]\d+)?\s*(s|sek|ms))\b/i,  // Jakość, SLA, bezpieczeństwo, czasy < 1s
];

/**
 * Weryfikuje, czy osiągnięcie lub opis zawiera mierzalny wskaźnik zgodny z formułą Google X-Y-Z.
 */
export function hasMeasurableMetric(text?: string, metricField?: string): boolean {
  if (metricField && metricField.trim().length > 0) return true;
  if (!text || typeof text !== 'string') return false;

  const trimmed = text.trim();
  if (!trimmed) return false;

  return METRIC_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Szablon rekomendacji Google X-Y-Z.
 */
export const GOOGLE_XYZ_TEMPLATE =
  'Osiągnąłem [konkretny rezultat], mierzone przez [wskaźnik, np. +25% / 100 tys. PLN / skrócenie o 2h], wdrażając [metodę lub narzędzie].';

/**
 * Wykrywa luki w zatrudnieniu >= 6 miesięcy (0.5 roku).
 */
export function detectCareerGaps(history: WorkExperience[]): ConsistencyAlert[] {
  const alerts: ConsistencyAlert[] = [];
  if (!history || history.length < 2) return alerts;

  // Filtrujemy i sortujemy pozycje rosnąco według daty rozpoczęcia
  const validExperiences = history
    .map((exp) => {
      const start = parseYearMonthToNumbers(exp.startDate);
      const end = exp.isCurrent
        ? parseYearMonthToNumbers('obecnie')
        : parseYearMonthToNumbers(exp.endDate) || start;

      return {
        experience: exp,
        start,
        end,
      };
    })
    .filter((item): item is { experience: WorkExperience; start: { year: number; month: number }; end: { year: number; month: number } } =>
      item.start !== null && item.end !== null
    )
    .sort((a, b) => {
      const diffYear = a.start.year - b.start.year;
      return diffYear !== 0 ? diffYear : a.start.month - b.start.month;
    });

  if (validExperiences.length < 2) return alerts;

  // Śledzimy maksymalną dotychczasową datę zakończenia, aby nie zgłaszać fałszywych luk
  // w przypadku wielu nakładających się ról
  let runningMaxEnd = validExperiences[0].end;
  let runningLastExp = validExperiences[0].experience;

  for (let i = 1; i < validExperiences.length; i++) {
    const current = validExperiences[i];

    // Porównujemy początek bieżącego stanowiska z najdalszym dotychczasowym zakończeniem
    const currentStartTotalMonths = current.start.year * 12 + current.start.month;
    const maxEndTotalMonths = runningMaxEnd.year * 12 + runningMaxEnd.month;

    if (currentStartTotalMonths > maxEndTotalMonths) {
      const gapMonths = calculateMonthsBetween(runningMaxEnd, current.start);

      if (gapMonths >= 6) {
        const gapStartFormatted = `${runningMaxEnd.year}-${String(runningMaxEnd.month).padStart(2, '0')}`;
        const gapEndFormatted = `${current.start.year}-${String(current.start.month).padStart(2, '0')}`;

        alerts.push({
          id: `alert_gap_${runningLastExp.id}_${current.experience.id}`,
          sectionId: 'experience',
          type: 'CAREER_GAP',
          severity: 'WARNING',
          title: `Luka w zatrudnieniu (~${gapMonths} mies.)`,
          message: `Wykryto ${gapMonths}-miesięczną przerwę między stanowiskiem w „${runningLastExp.company}” (${formatMonthYear(
            gapStartFormatted
          )}) a „${current.experience.company}” (${formatMonthYear(
            gapEndFormatted
          )}). Rekruterzy zwracają uwagę na przerwy > 6 mies. Warto uzupełnić ten okres wpisem o kursach, freelance lub urlopie.`,
          details: {
            gapMonths,
            gapStart: gapStartFormatted,
            gapEnd: gapEndFormatted,
            previousCompany: runningLastExp.company,
            nextCompany: current.experience.company,
            differenceYears: gapMonths / 12,
            sourceProject: runningLastExp.company,
          },
        });
      }
    }

    // Aktualizujemy najdalszy punkt zakończenia
    const currentEndTotalMonths = current.end.year * 12 + current.end.month;
    if (currentEndTotalMonths > maxEndTotalMonths) {
      runningMaxEnd = current.end;
      runningLastExp = current.experience;
    }
  }

  return alerts;
}

/**
 * Wykrywa nakładające się okresy zatrudnienia i kolizje fizycznych lokalizacji.
 */
export function detectOverlappingExperiences(history: WorkExperience[]): ConsistencyAlert[] {
  const alerts: ConsistencyAlert[] = [];
  if (!history || history.length < 2) return alerts;

  const validExperiences = history
    .map((exp) => {
      const start = parseYearMonthToNumbers(exp.startDate);
      const end = exp.isCurrent
        ? parseYearMonthToNumbers('obecnie')
        : parseYearMonthToNumbers(exp.endDate) || start;

      return {
        exp,
        startMonths: start ? start.year * 12 + start.month : null,
        endMonths: end ? end.year * 12 + end.month : null,
      };
    })
    .filter((item): item is { exp: WorkExperience; startMonths: number; endMonths: number } =>
      item.startMonths !== null && item.endMonths !== null
    );

  for (let i = 0; i < validExperiences.length; i++) {
    for (let j = i + 1; j < validExperiences.length; j++) {
      const a = validExperiences[i];
      const b = validExperiences[j];

      // Sprawdzenie nachodzenia na siebie przedziałów czasowych
      const overlapStart = Math.max(a.startMonths, b.startMonths);
      const overlapEnd = Math.min(a.endMonths, b.endMonths);

      if (overlapStart <= overlapEnd) {
        // Okresy nakładają się w czasie
        const isARemote = isRemoteOrFlexibleWork(a.exp.location, a.exp.description, a.exp.role);
        const isBRemote = isRemoteOrFlexibleWork(b.exp.location, b.exp.description, b.exp.role);

        const locA = (a.exp.location || '').trim();
        const locB = (b.exp.location || '').trim();

        // Jeśli oba stanowiska mają zdefiniowaną fizyczną lokalizację, miasta się różnią i żadne nie jest zdalne
        if (locA && locB && !isARemote && !isBRemote && locA.toLowerCase() !== locB.toLowerCase()) {
          alerts.push({
            id: `alert_location_conflict_${a.exp.id}_${b.exp.id}`,
            sectionId: 'experience',
            type: 'LOCATION_CONFLICT',
            severity: 'ALERT',
            title: 'Kolizja lokalizacji w nakładających się terminach',
            message: `Stanowiska w „${a.exp.company}” (${locA}) oraz „${b.exp.company}” (${locB}) trwają równolegle w różnych miastach stacjonarnie. Jeśli jedno z nich było zdalne lub hybrydowe, dopisz „(Zdalnie)” w lokalizacji, aby wyeliminować podejrzenie błędu.`,
            details: {
              sourceProject: a.exp.company,
              conflictingCompany: b.exp.company,
              conflictingLocation: locB,
              experienceId: a.exp.id,
            },
          });
        } else if (!isARemote && !isBRemote) {
          // Nakładające się pełne etaty bez oznaczenia B2B/freelance/zdalnie
          alerts.push({
            id: `alert_overlap_${a.exp.id}_${b.exp.id}`,
            sectionId: 'experience',
            type: 'OVERLAPPING_EXPERIENCE',
            severity: 'WARNING',
            title: 'Nakładające się okresy zatrudnienia',
            message: `Równoległe zatrudnienie w „${a.exp.company}” i „${b.exp.company}”. Rekruterzy mogą dopytywać o jednoczesne etaty — warto doprecyzować formę współpracy (np. B2B, część etatu, zlecenie).`,
            details: {
              sourceProject: a.exp.company,
              conflictingCompany: b.exp.company,
              experienceId: a.exp.id,
            },
          });
        }
      }
    }
  }

  return alerts;
}

/**
 * Wykrywa stanowiska bez mierzalnych metryk (Google X-Y-Z / STAR).
 */
export function detectMissingMetrics(history: WorkExperience[]): ConsistencyAlert[] {
  const alerts: ConsistencyAlert[] = [];
  if (!history || history.length === 0) return alerts;

  for (const exp of history) {
    if (!exp.company && !exp.role) continue; // Puste szkice ignorujemy

    const hasAnyMetricInHighlights = (exp.highlights || []).some((hl) =>
      hasMeasurableMetric(hl.text, hl.metric)
    );
    const hasMetricInDescription = hasMeasurableMetric(exp.description);

    if (!hasAnyMetricInHighlights && !hasMetricInDescription) {
      alerts.push({
        id: `alert_metric_missing_${exp.id}`,
        sectionId: 'experience',
        type: 'MISSING_METRICS',
        severity: 'WARNING',
        title: 'Brak mierzalnych rezultatów (Formuła Google X-Y-Z)',
        message: `Stanowisko „${exp.role || 'Nowe stanowisko'}” w „${exp.company || 'Firma'}” nie posiada liczb, procentów ani wymiernych osiągnięć. Rekruterzy oceniają opisy bez twardych metryk nawet o 50% niżej.`,
        details: {
          sourceProject: exp.company,
          experienceId: exp.id,
          suggestedFormula: GOOGLE_XYZ_TEMPLATE,
        },
      });
    }
  }

  return alerts;
}

/**
 * Przeprowadza pełen audyt osi czasu, chronologii i jakości metryk.
 */
export function auditExperienceTimelineAndMetrics(history: WorkExperience[]): {
  alerts: ConsistencyAlert[];
  careerGaps: ConsistencyAlert[];
  locationConflicts: ConsistencyAlert[];
  overlappingExperiences: ConsistencyAlert[];
  missingMetrics: ConsistencyAlert[];
  isHealthy: boolean;
} {
  const careerGaps = detectCareerGaps(history);
  const locationConflictsAndOverlaps = detectOverlappingExperiences(history);
  const locationConflicts = locationConflictsAndOverlaps.filter((a) => a.type === 'LOCATION_CONFLICT');
  const overlappingExperiences = locationConflictsAndOverlaps.filter((a) => a.type === 'OVERLAPPING_EXPERIENCE');
  const missingMetrics = detectMissingMetrics(history);

  const allAlerts = [...locationConflicts, ...overlappingExperiences, ...careerGaps, ...missingMetrics];

  return {
    alerts: allAlerts,
    careerGaps,
    locationConflicts,
    overlappingExperiences,
    missingMetrics,
    isHealthy: allAlerts.length === 0,
  };
}
