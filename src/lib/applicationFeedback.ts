import { api } from './apiClient';
import type { JobApplication, ApplicationDocumentSnapshot } from '../types';
import { deepClone, repairSnapshotReferences } from './applicationSnapshot';

/**
 * Ankieta po eksporcie dokumentu — logika bez DOM-u.
 *
 * Komponent `src/features/tracker/ApplicationFeedbackModal.tsx` jest wyłącznie
 * cienkim spięciem: pyta, zbiera kliknięcia i woła to, co jest tutaj. Powód
 * jest ten sam co przy `cvQuestionEngine` — testy biegną w Node, bez `jsdom`,
 * więc wszystko, co ma być sprawdzone, musi dać się zawołać z modułu.
 *
 * Zasada prywatności identyczna jak w `crowdsourceIntel.ts`: do wspólnej bazy
 * wychodzą wyłącznie metadane oferty (firma, stanowisko) plus odpowiedź
 * z zamkniętej listy. Żadnego `user_id`, żadnej treści CV, żadnych notatek.
 * Ankieta ma pokazywać, gdzie proces rekrutacyjny się sypie — a nie kto się
 * gdzie stara.
 */

/** Oferta, o którą pytamy. Tyle, ile trzeba do wpisu w Pipeline wraz z niezmiennym snapshotem. */
export interface PendingApplication {
  jobId: string;
  company: string;
  title: string;
  sourceUrl?: string;
  salary?: string;
  atsScore?: number;
  missingKeywords?: string[];
  documentSnapshot?: ApplicationDocumentSnapshot;
}

export const APPLICATION_CHANNELS = [
  'Pracuj.pl',
  'LinkedIn',
  'Strona kariery firmy',
  'Inne',
] as const;
export type ApplicationChannel = (typeof APPLICATION_CHANNELS)[number];

export const SALARY_TRANSPARENCY_OPTIONS = [
  { id: 'jawne', label: 'Tak, jawne' },
  { id: 'brak', label: 'Nie, brak' },
  { id: 'rozbiezne', label: 'Rozbieżne z rynkiem' },
] as const;
export type SalaryTransparency = (typeof SALARY_TRANSPARENCY_OPTIONS)[number]['id'];

export const FAILURE_REASONS = [
  { id: 'formularz', label: 'Wymagali formularza z osobnymi pytaniami' },
  { id: 'format-pliku', label: 'Portal odrzucił format pliku' },
  { id: 'wygasla', label: 'Oferta wygasła / błąd linku' },
  { id: 'rezygnacja', label: 'Zrezygnowałem po analizie wymagań' },
] as const;
export type FailureReason = (typeof FAILURE_REASONS)[number]['id'];

/**
 * Domyślny kanał zgadywany z adresu oferty.
 *
 * To jedynie ustawienie kursora na najbardziej prawdopodobnej odpowiedzi —
 * nic nie wysyłamy, dopóki użytkownik nie kliknie. Zgadywanie *za* niego
 * byłoby wymyślonym pomiarem (reguła 1).
 */
export function guessChannel(sourceUrl?: string): ApplicationChannel | null {
  if (!sourceUrl) return null;
  let host: string;
  try {
    host = new URL(sourceUrl).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }

  if (host.includes('pracuj.pl')) return 'Pracuj.pl';
  if (host.includes('linkedin.')) return 'LinkedIn';
  return null;
}

export interface ApplicationFeedbackPayload {
  companyName: string;
  jobTitle: string;
  appliedSuccessfully: boolean;
  applicationChannel: string | null;
  salaryTransparency: string | null;
  failureReason: string | null;
}

export function buildFeedbackPayload(
  pending: PendingApplication,
  answer: {
    appliedSuccessfully: boolean;
    channel?: ApplicationChannel | null;
    salaryTransparency?: SalaryTransparency | null;
    failureReason?: FailureReason | null;
  }
): ApplicationFeedbackPayload | null {
  const companyName = pending.company?.trim() ?? '';
  const jobTitle = pending.title?.trim() ?? '';

  // Bez firmy albo stanowiska wiersz nie mówi nikomu nic — lepiej go nie
  // dokładać niż zaśmiecać wspólną tabelę (reguła 1).
  if (companyName.length < 2 || jobTitle.length < 2) return null;

  return {
    companyName,
    jobTitle,
    appliedSuccessfully: answer.appliedSuccessfully,
    applicationChannel: answer.appliedSuccessfully ? answer.channel ?? null : null,
    salaryTransparency: answer.appliedSuccessfully ? answer.salaryTransparency ?? null : null,
    failureReason: answer.appliedSuccessfully ? null : answer.failureReason ?? null,
  };
}

/**
 * Wysyłka „odpal i zapomnij". Tryb lokalny odpowie 501, brak sieci rzuci —
 * ani jedno, ani drugie nie ma prawa przerwać tego, co użytkownik właśnie
 * robił, więc funkcja nie rzuca i nie zwraca nic do pokazania.
 */
export function sendApplicationFeedback(payload: ApplicationFeedbackPayload | null): void {
  if (!payload) return;
  void api.post('/api/intel/application-feedback', payload).catch(() => undefined);
}

/** Wpis do Pipeline zbudowany z oferty, o którą właśnie zapytaliśmy. */
export function buildApplicationFromPending(
  pending: PendingApplication,
  status: JobApplication['status'],
  options: { notes?: string; today?: string } = {}
): JobApplication {
  return {
    id: pending.jobId,
    company: pending.company.trim(),
    position: pending.title.trim(),
    salary: pending.salary ?? '',
    date: options.today ?? new Date().toISOString().slice(0, 10),
    status,
    notes: options.notes,
    jobUrl: pending.sourceUrl,
    // Wynik ATS przepisujemy tylko wtedy, gdy faktycznie był mierzony.
    // `undefined` znaczy „nie mierzono", zero znaczyłoby „zmierzono fatalnie".
    atsScore: pending.atsScore,
    missingKeywords: pending.missingKeywords,
    documentSnapshot: pending.documentSnapshot
      ? repairSnapshotReferences(deepClone(pending.documentSnapshot))
      : undefined,
  };
}

/** Notatka przy ścieżce problemu — powód w treści, żeby nie zginął. */
export function noteForFailure(reason: FailureReason | null): string {
  const label = FAILURE_REASONS.find((item) => item.id === reason)?.label;
  return label
    ? `Nie wysłano: ${label.toLowerCase()}.`
    : 'Nie wysłano — zgłoszenie czeka na dokończenie.';
}
