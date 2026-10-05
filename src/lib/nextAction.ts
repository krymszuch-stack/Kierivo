import { JobApplication, MasterVault } from '../types';
import { CANONICAL_ATS_SCORE_PROVENANCE } from '../types';
import { NavTabId } from './navigation';
import { VaultSectionSpec, measureVaultCompleteness } from './vaultCompleteness';
import { hasCanonicalAtsScore } from './canonicalAts';
import { hasLimitedMatchEvidence } from './matchInterpretation';
import { isValidAtsScoreContext } from './atsScoreEvidence';
import { getCalculationTimeFreshness } from './analysisPeriod';

/**
 * Silnik „następnego kroku" — jedna rekomendacja zamiast tablicy z funkcjami.
 *
 * Powód istnienia tego pliku jest produktowy, nie techniczny. Aplikacja ma
 * kilkanaście modułów i użytkownik po wejściu nie wie, który z nich jest jego
 * następnym ruchem; przy takim wyborze najczęstszą decyzją jest brak decyzji.
 * Ten moduł odpowiada na jedno pytanie — „co mam zrobić teraz" — i to on
 * zamienia listę narzędzi w kolejność kroków.
 *
 * Zbudowany jako tablica reguł z predykatami, a nie drabina `if`-ów, żeby
 * dołożenie reguły było dopisaniem wpisu, a jej priorytet dało się przeczytać
 * z kolejności w tablicy. Wygrywa pierwsza pasująca.
 *
 * **Czysta funkcja bez dostępu do sieci i do schowka.** Cały stan dostaje
 * w argumencie — łącznie z bieżącym czasem, bo reguła „rozmowa za mniej niż
 * 48 godzin" bez wstrzykniętego `now` nie dałaby się przetestować inaczej niż
 * podmianą zegara systemowego. To także warunek przeniesienia silnika na
 * serwer w przyszłości: żadna z tych reguł nie dotyka przeglądarki.
 */

export type NextActionType =
  | 'pre_call_brief'
  | 'prepare_followup'
  | 'complete_vault'
  | 'analyze_job'
  | 'improve_ats'
  | 'follow_up_application'
  | 'daily_challenge';

export interface NextActionDeepLink {
  tab: NavTabId;
  /** Aplikacja, której dotyczy krok — Pipeline podświetla wtedy jej kartę. */
  applicationId?: string;
}

export interface NextAction {
  actionType: NextActionType;
  title: string;
  description: string;
  deepLink: NextActionDeepLink;
  /**
   * Szacowany czas kroku w minutach. Jest **deklaracją projektanta**, ile ten
   * krok ma zajmować, a nie pomiarem — służy do tego, żeby użytkownik wiedział,
   * czy zmieści się przed wyjściem z domu.
   */
  estimatedMinutes: number;
  /** Dane, które ekran pokazuje przy rekomendacji. Zawsze z realnego stanu. */
  context: NextActionContext;
}

export interface NextActionContext {
  company?: string;
  position?: string;
  /** Godziny do rozmowy, zaokrąglone w dół. */
  hoursToInterview?: number;
  /** Dni od wysłania aplikacji. */
  daysSinceApplied?: number;
  atsScore?: number;
  /** Najwyżej trzy — tyle da się poprawić za jednym posiedzeniem. */
  missingKeywords?: string[];
  vaultPercent?: number;
  weakestSection?: string;
}

export interface NextActionInput {
  vault: MasterVault;
  applications: JobApplication[];
  /** Wstrzykiwany, żeby reguły czasowe dało się przetestować. */
  now: Date;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Próg „rozmowa tuż-tuż" z części A.3 raportu strategicznego. */
const INTERVIEW_SOON_HOURS = 48;
/** Poniżej tego progu profil nie wystarcza, żeby dopasowanie było wiarygodne. */
const VAULT_READY_PERCENT = 60;
/** Wynik ATS, poniżej którego warto jeszcze poprawiać dokument. */
const ATS_GOOD_ENOUGH = 70;
/** Po tylu dniach ciszy wypada się przypomnieć. */
const STALE_APPLICATION_DAYS = 7;

/** Statusy, przy których aplikacja jeszcze się toczy. */
const ACTIVE_STATUSES = new Set<JobApplication['status']>(['Wysłana', 'Rozmowa']);

/**
 * Zamienia tekst na czas albo `null`. Wpis z ręcznie wpisaną datą potrafi być
 * pusty lub uszkodzony, a `new Date('')` daje `Invalid Date`, które w każdym
 * porównaniu zachowuje się jak `false` — czyli po cichu wyłącza regułę zamiast
 * zgłosić problem.
 */
function parseInstant(value: string | undefined): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

interface Rule {
  actionType: NextActionType;
  evaluate: (input: NextActionInput) => NextAction | null;
}

/**
 * Reguły w kolejności priorytetu — pierwsza pasująca wygrywa.
 *
 * Kolejność jest odwzorowaniem tego, co użytkownik traci, gdy kroku nie zrobi.
 * Nieprzygotowana rozmowa za dobę jest stratą nieodwracalną, niewysłany
 * follow-up prawie nieodwracalną, a niedokończony profil da się uzupełnić
 * jutro. Dlatego rzeczy pilne stoją nad ważnymi.
 */
const RULES: readonly Rule[] = [
  // 1. Rozmowa w ciągu 48 godzin, do której nie ma przygotowania.
  {
    actionType: 'pre_call_brief',
    evaluate: ({ applications, now }) => {
      const upcoming = applications
        .filter((app) => app.status === 'Rozmowa' && !app.briefDoneAt)
        .map((app) => ({ app, at: parseInstant(app.interviewAt) }))
        .filter((entry): entry is { app: JobApplication; at: number } => entry.at !== null)
        .filter((entry) => {
          const distance = entry.at - now.getTime();
          return distance >= 0 && distance <= INTERVIEW_SOON_HOURS * HOUR_MS;
        })
        // Najbliższa rozmowa, nie pierwsza z brzegu.
        .sort((a, b) => a.at - b.at)[0];

      if (!upcoming) return null;

      const hours = Math.floor((upcoming.at - now.getTime()) / HOUR_MS);

      return {
        actionType: 'pre_call_brief',
        title: 'Przygotuj się do rozmowy',
        description:
          hours <= 1
            ? `Rozmowa z ${upcoming.app.company} zaraz się zaczyna. Przejrzyj checklistę i trzy historie STAR.`
            : `Rozmowa z ${upcoming.app.company} za ${hours} h. Przejdź checklistę przed rozmową i przypomnij sobie trzy historie STAR.`,
        deepLink: { tab: 'pipeline', applicationId: upcoming.app.id },
        estimatedMinutes: 15,
        context: {
          company: upcoming.app.company,
          position: upcoming.app.position,
          hoursToInterview: hours,
        },
      };
    },
  },

  // 2. Rozmowa się odbyła, a follow-up nie poszedł.
  {
    actionType: 'prepare_followup',
    evaluate: ({ applications, now }) => {
      const finished = applications
        .filter((app) => app.status === 'Rozmowa' && !app.debriefSentAt)
        .map((app) => ({ app, at: parseInstant(app.interviewAt) }))
        .filter((entry): entry is { app: JobApplication; at: number } => entry.at !== null)
        .filter((entry) => entry.at < now.getTime())
        // Najświeższa rozmowa — im starsza, tym mniejszy sens maila.
        .sort((a, b) => b.at - a.at)[0];

      if (!finished) return null;

      return {
        actionType: 'prepare_followup',
        title: 'Przygotuj follow-up po rozmowie',
        description: `Rozmowa z ${finished.app.company} już się odbyła. Otwórz aplikację, dopisz podsumowanie i ręcznie oznacz follow-up po wysłaniu wiadomości — Kierivo nie wysyła jej za Ciebie.`,
        deepLink: { tab: 'pipeline', applicationId: finished.app.id },
        estimatedMinutes: 10,
        context: { company: finished.app.company, position: finished.app.position },
      };
    },
  },

  // 3. Profil zbyt ubogi, żeby dopasowanie cokolwiek znaczyło.
  {
    actionType: 'complete_vault',
    evaluate: ({ vault }) => {
      const completeness = measureVaultCompleteness(vault);
      if (completeness.percent >= VAULT_READY_PERCENT) return null;

      const weakest: VaultSectionSpec | null = completeness.weakest;
      if (!weakest) return null;

      return {
        actionType: 'complete_vault',
        title: `Uzupełnij: ${weakest.label}`,
        description: `Uzupełnij ${weakest.label}. Profil jest wypełniony w ${completeness.percent}%.`,
        deepLink: { tab: 'profil' },
        estimatedMinutes: 5,
        context: {
          vaultPercent: completeness.percent,
          weakestSection: weakest.label,
        },
      };
    },
  },

  // 4. Profil gotowy, ale Pipeline nie zawiera zapisanej aplikacji.
  {
    actionType: 'analyze_job',
    evaluate: ({ applications }) => {
      if (applications.length > 0) return null;

      return {
        actionType: 'analyze_job',
        title: 'Wklej ofertę do analizy',
        description:
          'Profil jest gotowy. Wklej treść ogłoszenia albo jego adres, a zobaczysz dopasowanie i braki, zanim wyślesz zgłoszenie.',
        deepLink: { tab: 'aplikuj' },
        estimatedMinutes: 3,
        context: {},
      };
    },
  },

  // 5. Aplikacja w toku z wynikiem ATS poniżej progu.
  {
    actionType: 'improve_ats',
    evaluate: ({ applications, now }) => {
      const weakest = applications
        .filter((app) => ACTIVE_STATUSES.has(app.status))
        // Migracja zachowuje starszą liczbę, ale bez wersji źródła nie wiadomo,
        // czy była kanoniczna. Nie używamy jej do rekomendacji ani do zawstydzania.
        .filter((app): app is JobApplication & {
          atsScore: number;
          atsScoreProvenance: typeof CANONICAL_ATS_SCORE_PROVENANCE;
        } => hasCanonicalAtsScore(app) &&
          isValidAtsScoreContext(app.atsScoreContext) &&
          getCalculationTimeFreshness(app.atsScoreContext, now) === 'current' &&
          !hasLimitedMatchEvidence({
            profileCompleteness: app.atsScoreContext.profileCompleteness,
            totalRequirementCount: app.atsScoreContext.detectedRequirementCount,
            fitEvidenceAvailable: app.atsScoreContext.careerEvidenceAvailable,
            blockingRequirements: (app.atsScoreContext.unmetBlockingRequirementCount ?? 0) > 0 ? ['unmet'] : [],
            unconfirmedRequirementCount: app.atsScoreContext.unconfirmedRequirementCount ?? 0,
          }) &&
          app.atsScore < ATS_GOOD_ENOUGH)
        .sort((a, b) => a.atsScore - b.atsScore)[0];

      if (!weakest) return null;

      const missing = (weakest.missingKeywords ?? []).slice(0, 3);
      const listed = missing.length > 0 ? ` Brakuje: ${missing.join(', ')}.` : '';

      return {
        actionType: 'improve_ats',
        title: 'Popraw dopasowanie do oferty',
        description: `${weakest.position} w ${weakest.company} ma ${weakest.atsScore}% dopasowania.${listed}`,
        deepLink: { tab: 'aplikuj', applicationId: weakest.id },
        estimatedMinutes: 8,
        context: {
          company: weakest.company,
          position: weakest.position,
          atsScore: weakest.atsScore,
          missingKeywords: missing,
        },
      };
    },
  },

  // 6. Wysłana aplikacja, o której od tygodnia cisza.
  {
    actionType: 'follow_up_application',
    evaluate: ({ applications, now }) => {
      const stale = applications
        .filter((app) => app.status === 'Wysłana')
        .map((app) => ({ app, at: parseInstant(app.date) }))
        .filter((entry): entry is { app: JobApplication; at: number } => entry.at !== null)
        .filter((entry) => now.getTime() - entry.at >= STALE_APPLICATION_DAYS * DAY_MS)
        // Najstarsza — ta, przy której cisza trwa najdłużej.
        .sort((a, b) => a.at - b.at)[0];

      if (!stale) return null;

      const days = Math.floor((now.getTime() - stale.at) / DAY_MS);

      return {
        actionType: 'follow_up_application',
        title: 'Przypomnij się rekruterowi',
        description: `Aplikacja do ${stale.app.company} czeka bez odpowiedzi od ${days} dni. Krótka wiadomość kosztuje minutę.`,
        deepLink: { tab: 'pipeline', applicationId: stale.app.id },
        estimatedMinutes: 5,
        context: {
          company: stale.app.company,
          position: stale.app.position,
          daysSinceApplied: days,
        },
      };
    },
  },
] as const;

/**
 * Zadania na dzień, w którym nic nie pali się samo.
 *
 * Rotacja jest deterministyczna — ten sam dzień daje to samo zadanie, więc
 * odświeżenie strony niczego nie przestawia. Wszystkie pozycje prowadzą do
 * istniejących ekranów; to jest rotacja po realnych funkcjach, a nie
 * generowanie treści.
 */
const DAILY_CHALLENGES: ReadonlyArray<Omit<NextAction, 'context'>> = [
  {
    actionType: 'daily_challenge',
    title: 'Przećwicz elevator pitch',
    description: 'Trzy warianty na 15, 30 i 90 sekund. Nagraj się i posłuchaj, gdzie się gubisz.',
    deepLink: { tab: 'trenuj' },
    estimatedMinutes: 10,
  },
  {
    actionType: 'daily_challenge',
    title: 'Zrób jedną próbną rundę pytań',
    description: 'Losowy zestaw pytań pod Twój profil, z oceną odpowiedzi w strukturze STAR.',
    deepLink: { tab: 'trenuj' },
    estimatedMinutes: 15,
  },
  {
    actionType: 'daily_challenge',
    title: 'Przejrzyj mosty kompetencyjne',
    description: 'Zobacz, które z Twoich umiejętności da się przełożyć na branżę, w którą celujesz.',
    deepLink: { tab: 'trenuj' },
    estimatedMinutes: 10,
  },
  {
    actionType: 'daily_challenge',
    title: 'Dopisz jedno osiągnięcie z metryką',
    description: 'Punkt z liczbą waży w CV więcej niż trzy bez niej. Wybierz jedno stanowisko i dopisz jeden.',
    deepLink: { tab: 'profil' },
    estimatedMinutes: 5,
  },
] as const;

function dailyChallenge(now: Date): NextAction {
  // Numer dnia od epoki — zmienia się o północy czasu lokalnego i nie zależy
  // od długości miesiąca ani od tego, w którym tygodniu roku jesteśmy.
  const dayNumber = Math.floor(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / DAY_MS
  );
  const picked = DAILY_CHALLENGES[Math.abs(dayNumber) % DAILY_CHALLENGES.length];
  return { ...picked, context: {} };
}

/**
 * Zwraca jeden krok — nigdy `null`. Ekran główny ma zawsze coś pokazać, a
 * „nie mam dla Ciebie sugestii" jest gorszą odpowiedzią niż zadanie treningowe.
 */
export function resolveNextAction(input: NextActionInput): NextAction {
  for (const rule of RULES) {
    const action = rule.evaluate(input);
    if (action) return action;
  }
  return dailyChallenge(input.now);
}

/** Kolejność reguł — wystawiona wyłącznie na potrzeby testów i diagnostyki. */
export const NEXT_ACTION_PRIORITY: readonly NextActionType[] = [
  ...RULES.map((rule) => rule.actionType),
  'daily_challenge',
] as const;
