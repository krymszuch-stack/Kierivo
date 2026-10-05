import { api } from './apiClient';
import { isAtsScoreProvenance } from './atsScoreProvenance';
import type { JobApplication, ApplicationDocumentSnapshot, AtsScoreContext, AtsScoreProvenance } from '../types';
import { deepClone, repairSnapshotReferences } from './applicationSnapshot';
import { isValidAtsScoreContext } from './atsScoreEvidence';

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
  atsScoreProvenance?: AtsScoreProvenance;
  atsScoreContext?: AtsScoreContext;
  missingKeywords?: string[];
  documentSnapshot?: ApplicationDocumentSnapshot;
}

/**
 * Łączy odpowiedź z właściwą aplikacją.
 *
 * Najpierw szukamy stabilnego ID. Dawny jednoprzebiegowy warunek
 * `id === jobId || firma+stanowisko` zwracał wcześniejszą pozycję o tej samej
 * nazwie, nawet gdy dokładne ID znajdowało się niżej na liście. Dopasowanie
 * po nazwach jest bezpieczne tylko wtedy, gdy zgadza się też konkretny URL;
 * dwie oferty tej samej firmy i stanowiska mogą być różnymi rekrutacjami.
 */
export function findExistingApplicationForPending(
  applications: JobApplication[],
  pending: PendingApplication,
): JobApplication | undefined {
  const byId = applications.find((entry) => entry.id === pending.jobId);
  if (byId) return byId;

  const sourceUrl = pending.sourceUrl?.trim();
  if (!sourceUrl) return undefined;

  const company = pending.company.trim().toLocaleLowerCase('pl-PL');
  const title = pending.title.trim().toLocaleLowerCase('pl-PL');
  return applications.find((entry) =>
    entry.jobUrl?.trim() === sourceUrl &&
    entry.company.trim().toLocaleLowerCase('pl-PL') === company &&
    entry.position.trim().toLocaleLowerCase('pl-PL') === title
  );
}

/**
 * Przy odpowiedzi do już zapisanej oferty aktualizujemy wyłącznie to, co
 * użytkownik właśnie potwierdził. Eksport ponownego CV nie może cofnąć etapu
 * rekrutacji ani zastąpić historycznego CV/oferty lub notatek z rozmowy.
 */
export function buildExistingApplicationFeedbackPatch(
  existing: JobApplication,
  candidate: JobApplication,
  reportedStatus: JobApplication['status'],
  feedbackNote?: string,
): Partial<JobApplication> {
  const note = feedbackNote?.trim();
  let notes = existing.notes;
  if (note) {
    const lines = (notes ?? '').split(/\r?\n/).map((line) => line.trim());
    if (!lines.includes(note)) {
      notes = notes?.trim() ? `${notes.trimEnd()}\n${note}` : note;
    }
  }

  return {
    // Feedback może awansować wpis roboczy, ale nigdy nadpisywać postępu
    // ani wyniku procesu, które użytkownik zapisał później.
    status: existing.status === 'Do wysłania' ? reportedStatus : existing.status,
    notes,
    // Migawka to historia niezmienna. Dołączamy ją tylko do starego wpisu,
    // który nie ma jeszcze żadnej migawki.
    documentSnapshot: existing.documentSnapshot ?? candidate.documentSnapshot,
  };
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
    atsScoreProvenance: pending.atsScoreProvenance,
    ...(isAtsScoreProvenance(pending.atsScoreProvenance) &&
      isValidAtsScoreContext(pending.atsScoreContext)
      ? { atsScoreContext: pending.atsScoreContext }
      : {}),
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
