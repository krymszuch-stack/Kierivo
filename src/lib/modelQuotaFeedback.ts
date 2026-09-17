import { FREE_DAILY_AI_USES } from '../store/useEntitlements';

/**
 * Moduł centralizujący logikę formatowania i komunikacji o limitach
 * operacji modelowych (AI / LLM) oraz łagodnym wygaszaniu (graceful degradation).
 *
 * Zgodnie z AGENTS.md:
 * - Reguła 1: Zero wymyślonych liczb — operujemy na faktycznym stanie licznika dobowego.
 * - Reguła 2: Uczciwa informacja — w Public Pre-Beta nie odsyłamy do nieistniejących płatnych planów.
 */

export interface ModelQuotaFeedback {
  /** Zwięzła etykieta z poprawną gramatyką polską (np. "Zostały Ci 3 analizy dzisiaj w tej becie"). */
  label: string;
  /** Krótka etykieta liczbowa do badge'a (np. "3/25"). */
  shortBadge: string;
  /** Dłuższy opis do tooltipa lub modala wyjaśniający dobowy cykl odnowienia. */
  details: string;
  /** Czy limit dobowy został całkowicie wyczerpany (0 operacji). */
  isExhausted: boolean;
  /** Czy pozostało niewiele zapytań (1-3 operacje) jako wczesne ostrzeżenie. */
  isLow: boolean;
  /** Liczba pozostałych wywołań. */
  remaining: number;
  /** Maksymalny dobowy sufit operacji. */
  maxDaily: number;
}

/**
 * Zwraca poprawną formę fleksyjną rzeczownika "analiza" w języku polskim dla podanej liczby.
 */
export function getPolishAnalysisNoun(count: number): string {
  const abs = Math.abs(count);
  if (abs === 1) return 'analiza';
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return 'analizy';
  }
  return 'analiz';
}

/**
 * Formatuje czytelny komunikat o pozostałym limicie operacji modelowych.
 */
export function formatModelQuotaFeedback(
  remainingUses: number,
  maxDaily: number = FREE_DAILY_AI_USES
): ModelQuotaFeedback {
  const safeRemaining = Math.max(0, Math.floor(remainingUses));
  const isExhausted = safeRemaining <= 0;
  const isLow = safeRemaining > 0 && safeRemaining <= 3;
  const noun = getPolishAnalysisNoun(safeRemaining);

  let label: string;
  if (isExhausted) {
    label = 'Wykorzystano dzisiejszy limit analiz AI';
  } else if (safeRemaining === 1) {
    label = 'Została Ci 1 analiza dzisiaj w tej becie';
  } else if (
    safeRemaining % 10 >= 2 &&
    safeRemaining % 10 <= 4 &&
    (safeRemaining % 100 < 10 || safeRemaining % 100 >= 20)
  ) {
    label = `Zostały Ci ${safeRemaining} ${noun} dzisiaj w tej becie`;
  } else {
    label = `Zostało Ci ${safeRemaining} ${noun} dzisiaj w tej becie`;
  }

  const shortBadge = `${safeRemaining}/${maxDaily}`;

  const details = isExhausted
    ? `Dzienny limit operacji AI (${maxDaily} zapytań/dobę) został wyczerpany. Pula odnowi się automatycznie o północy. Do tego czasu wszystkie analizy, scoring ATS i edycja faktów działają w pełni lokalnie.`
    : `Darmowy dobowy przydział w Public Pre-Beta (0 zł). Pozostało ${safeRemaining} z ${maxDaily} zapytań AI. Pula odnawia się każdej nocy o 00:00.`;

  return {
    label,
    shortBadge,
    details,
    isExhausted,
    isLow,
    remaining: safeRemaining,
    maxDaily,
  };
}

export type DegradationFeature = 'matcher' | 'coach' | 'verifier' | 'general';

export interface GracefulDegradationNotice {
  title: string;
  message: string;
  fallbackActionName: string;
  fallbackDescription: string;
}

/**
 * Dostarcza ustandaryzowany komunikat łagodnego wygaszania (graceful degradation)
 * dla konkretnego modułu aplikacji w przypadku wyczerpania limitu AI lub niedostępności modelu.
 */
export function getModelGracefulDegradationNotice(
  feature: DegradationFeature
): GracefulDegradationNotice {
  switch (feature) {
    case 'matcher':
      return {
        title: 'Limit analiz AI na dziś wyczerpany',
        message:
          'Dzienna pula wywołań modelu została wykorzystana (odnowi się o północy). Ogłoszenie zostanie przeanalizowane przez wbudowany, deterministyczny silnik regułowy Kierivo.',
        fallbackActionName: 'Analizuj silnikiem regułowym',
        fallbackDescription:
          'Lokalna ekstrakcja słów kluczowych, lematyzacja i wielowskaźnikowy scoring ATS działają w 100% bez utraty danych.',
      };

    case 'coach':
      return {
        title: 'Limit symulacji AI na dziś osiągnięty',
        message:
          'Generowanie pytań i ocena odpowiedzi przez model Azure OpenAI odnowią się o północy.',
        fallbackActionName: 'Użyj pytań wbudowanych',
        fallbackDescription:
          'Możesz swobodnie ćwiczyć odpowiedzi w formule STAR na bogatej bazie pytań rekrutacyjnych ze stoperem czasu.',
      };

    case 'verifier':
      return {
        title: 'Weryfikator AI niedostępny (wyczerpany limit)',
        message:
          'Trójstopniowa weryfikacja z modelem LLM odnowi się po północy wraz z nową dobową pulą.',
        fallbackActionName: 'Otwórz Laboratorium Audytu ATS',
        fallbackDescription:
          'Pełna analiza strukturalna, formatowania, gęstości słów kluczowych i zgodności z filtrami ATS jest stale dostępna lokalnie.',
      };

    case 'general':
    default:
      return {
        title: 'Dzisiejszy limit operacji modelowych wyczerpany',
        message:
          'Wykorzystano przydział zapytań AI na dziś. Nowa pula zostanie przyznana automatycznie o północy.',
        fallbackActionName: 'Przejdź do trybu regułowego',
        fallbackDescription:
          'Wszystkie podstawowe funkcjonalności przygotowywania dokumentów, eksportu PDF i audytu działają nieprzerwanie bez modelu.',
      };
  }
}
