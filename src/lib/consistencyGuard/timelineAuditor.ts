import { WorkExperience } from '../../types';
import { ConsistencyAlert } from './types';
import { formatMonthYear, parseDateToYearMonth } from '../dateUtils';
import { employmentIntervalForJob } from '../experience';

/**
 * Zwraca znormalizowany rok i miesiąc z ciągu daty (np. '2022-05', '2022.05', '05.2022', '2022', 'Obecnie').
 */
export function parseYearMonthToNumbers(dateStr: string | undefined | null): { year: number; month: number } | null {
  return parseDateToYearMonth(dateStr);
}

function experiencePeriod(exp: WorkExperience): { start: { year: number; month: number }; end: { year: number; month: number } } | null {
  // Ta sama granica kompletności i przyszłych dat co w HUD i scorerze.
  // Brak końca nie jest dowodem jednodniowej ani miesięcznej roli.
  if (!employmentIntervalForJob(exp)) return null;
  const start = parseYearMonthToNumbers(exp.startDate);
  const end = exp.isCurrent
    ? parseYearMonthToNumbers('obecnie')
    : parseYearMonthToNumbers(exp.endDate);
  if (!start || !end || end.year * 12 + end.month < start.year * 12 + start.month) return null;
  return { start, end };
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

  // Przykłady w nawiasach kwadratowych są instrukcją, a nie dowodem osiągnięcia.
  const evidenceText = trimmed.replace(/\[[^\]]*\]/g, ' ');
  return METRIC_PATTERNS.some((pattern) => pattern.test(evidenceText));
}

/**
 * Szablon rekomendacji Google X-Y-Z.
 */
export const GOOGLE_XYZ_TEMPLATE =
  'Osiągnąłem [konkretny rezultat], mierzone przez [rzeczywisty wskaźnik], wdrażając [metodę lub narzędzie].';

/**
 * Wykrywa luki w zatrudnieniu >= 6 miesięcy (0.5 roku).
 */
export function detectCareerGaps(history: WorkExperience[]): ConsistencyAlert[] {
  const alerts: ConsistencyAlert[] = [];
  if (!history || history.length < 2) return alerts;

  // Filtrujemy i sortujemy pozycje rosnąco według daty rozpoczęcia
  const validExperiences = history
    .map((exp) => {
      const period = experiencePeriod(exp);
      return period ? { experience: exp, ...period } : null;
    })
    .filter((item): item is { experience: WorkExperience; start: { year: number; month: number }; end: { year: number; month: number } } => item !== null)
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
          title: `Nieopisany okres między wpisami (~${gapMonths} mies.)`,
          message: `Między kompletnymi wpisami w „${runningLastExp.company}” (${formatMonthYear(
            gapStartFormatted
          )}) a „${current.experience.company}” (${formatMonthYear(
            gapEndFormatted
          )}) jest ${gapMonths} miesięcy bez pokrycia tymi wpisami. Brak wpisu nie potwierdza przerwy w pracy ani błędu. Sprawdź pozostałą historię; jeśli chcesz wyjaśnić okres, wpisz wyłącznie rzeczywiste informacje.`,
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
      const period = experiencePeriod(exp);
      return {
        exp,
        startMonths: period ? period.start.year * 12 + period.start.month : null,
        endMonths: period ? period.end.year * 12 + period.end.month : null,
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

        // Nazwy lokalizacji i miesiące nie potwierdzają obecności w dwóch
        // miejscach w tych samych godzinach ani trybu pracy.
        if (locA && locB && !isARemote && !isBRemote && locA.toLowerCase() !== locB.toLowerCase()) {
          alerts.push({
            id: `alert_location_conflict_${a.exp.id}_${b.exp.id}`,
            sectionId: 'experience',
            type: 'LOCATION_CONFLICT',
            severity: 'WARNING',
            title: 'Różne lokalizacje w nakładających się miesiącach — do sprawdzenia',
            message: `Wpisy w „${a.exp.company}” (${locA}) oraz „${b.exp.company}” (${locB}) obejmują wspólne miesiące. Daty miesięczne i lokalizacje nie potwierdzają jednoczesnej pracy w dwóch miejscach. Sprawdź dokładne daty i rzeczywisty tryb współpracy; nie zmieniaj lokalizacji tylko po to, aby usunąć uwagę.`,
            details: {
              sourceProject: a.exp.company,
              conflictingCompany: b.exp.company,
              conflictingLocation: locB,
              experienceId: a.exp.id,
            },
          });
        } else if (!isARemote && !isBRemote) {
          // Brak oznaczenia elastycznej pracy nie potwierdza pełnego etatu.
          alerts.push({
            id: `alert_overlap_${a.exp.id}_${b.exp.id}`,
            sectionId: 'experience',
            type: 'OVERLAPPING_EXPERIENCE',
            severity: 'WARNING',
            title: 'Nakładające się okresy zatrudnienia',
            message: `Wpisy w „${a.exp.company}” i „${b.exp.company}” obejmują wspólne miesiące. Nie oznacza to automatycznie sprzeczności ani jednoczesnych pełnych etatów. Jeśli potrzebne jest wyjaśnienie, podaj rzeczywiste daty lub formę współpracy.`,
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
        title: 'Nie wykryto wyniku liczbowego w opisie',
        message: `W opisie stanowiska „${exp.role || 'Nowe stanowisko'}” w „${exp.company || 'Firma'}” nie wykryto wyniku liczbowego. Jeśli masz sprawdzalne dane, możesz je dopisać. W przeciwnym razie opisz konkretną czynność i jej jakościowy rezultat bez wymyślania liczb.`,
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

  // Pominięcie nieczytelnego wpisu nie może zmienić niepełnego audytu w zdrowy wynik.
  const invalidDateRanges: ConsistencyAlert[] = (history ?? [])
    .filter(exp => (exp.company || exp.role || exp.startDate || exp.endDate) && !experiencePeriod(exp))
    .map(exp => ({
      id: `alert_timeline_dates_${exp.id}`,
      claimId: `claim_exp_${exp.id}`,
      sectionId: 'experience',
      type: 'INVALID_DATE_RANGE',
      severity: 'ALERT',
      title: 'Nie można sprawdzić okresu zatrudnienia',
      message: `Wpis „${exp.role || 'Stanowisko'}” w „${exp.company || 'Firma'}” ma niekompletne, nieczytelne, odwrócone lub przyszłe daty. Nie uwzględniono go w porównaniu okresów; nie potwierdzono pełnej chronologii.`,
      details: { experienceId: exp.id, sourceProject: exp.company },
    }));
  const allAlerts = [...invalidDateRanges, ...locationConflicts, ...overlappingExperiences, ...careerGaps, ...missingMetrics];

  return {
    alerts: allAlerts,
    careerGaps,
    locationConflicts,
    overlappingExperiences,
    missingMetrics,
    isHealthy: allAlerts.length === 0,
  };
}
