import type { AtsScoreContext } from '../types';
import { getUnconfirmedBlockingRequirements, getUnmetBlockingRequirements, isValidAtsScore, type CanonicalAtsScore } from './canonicalAts';
import { hasLimitedMatchEvidence } from './matchInterpretation';
import { getAtsRulesFreshness } from './atsScoreProvenance';
import { getCalculationTimeFreshness } from './analysisPeriod';

/** Zachowujemy liczbę z historii, ale nie interpretujemy jej według nowych reguł. */
export function getSavedAtsScoreDisplayInfo(score: unknown, context: AtsScoreContext | undefined, provenance: unknown, now = new Date()) {
  const rulesFreshness = getAtsRulesFreshness(provenance);
  if (!isValidAtsScore(score)) return getAtsScoreDisplayInfo(score, context);
  if (rulesFreshness === 'current') {
    const display = getAtsScoreDisplayInfo(score, context);
    if (display.state === 'unknown') return display;
    const timeFreshness = getCalculationTimeFreshness(context, now);
    if (timeFreshness === 'current') return display;
    return {
      state: 'unknown' as const,
      label: `Wynik historyczny: ${score}%`,
      note: timeFreshness === 'stale'
        ? 'Od obliczenia wyniku zmienił się miesiąc. Staż bieżącego zatrudnienia może być już inny. Uruchom analizę ponownie.'
        : 'Nie możemy potwierdzić czasu i miesiąca obliczenia tego wyniku. Późniejszy zapis dokumentu nie odświeża oceny. Uruchom analizę ponownie.',
    };
  }
  return {
    state: 'unknown' as const,
    label: `Wynik historyczny: ${score}%`,
    note: rulesFreshness === 'stale'
      ? 'Wynik obliczono wcześniejszymi regułami Kierivo. Nie jest porównywalny z bieżącą oceną. Uruchom analizę ponownie.'
      : 'Nie zapisano rozpoznanej wersji reguł obliczeń. Nie możemy potwierdzić aktualności wyniku. Uruchom analizę ponownie.',
  };
}

export type ValidAtsScoreContext = AtsScoreContext & Required<Pick<
  AtsScoreContext,
  | 'unmetBlockingRequirementCount'
  | 'unconfirmedBlockingRequirementCount'
  | 'unconfirmedRequirementCount'
  | 'scoreContextVersion'
  | 'careerEvidenceVersion'
  | 'careerEvidenceAvailable'
>>;

/** Zachowuje dokładny zakres danych użyty do kanonicznego wyniku w Pipeline. */
export function getAtsScoreContext(
  result: CanonicalAtsScore | undefined,
  profileCompleteness: number,
  careerEvidenceAvailable: boolean,
): AtsScoreContext | undefined {
  if (result?.state !== 'SCORABLE' || !isValidAtsScore(result.score)) return undefined;
  return {
    ...(result.calculatedAt !== undefined ? { calculatedAt: result.calculatedAt } : {}),
    ...(result.calculationMonth !== undefined ? { calculationMonth: result.calculationMonth } : {}),
    detectedRequirementCount: result.matchedRequirements.length + result.missingRequirements.length + result.unconfirmedRequirements.length,
    profileCompleteness,
    unmetBlockingRequirementCount: getUnmetBlockingRequirements(result).length,
    unconfirmedBlockingRequirementCount: getUnconfirmedBlockingRequirements(result).length,
    unconfirmedRequirementCount: result.unconfirmedRequirements.length,
    scoreContextVersion: 5,
    careerEvidenceAvailable,
    careerEvidenceVersion: 2,
  };
}

export function isValidAtsScoreContext(value: unknown): value is ValidAtsScoreContext {
  if (!value || typeof value !== 'object') return false;
  const context = value as Partial<AtsScoreContext>;
  return context.scoreContextVersion === 5 &&
    Number.isInteger(context.unmetBlockingRequirementCount) &&
    (context.unmetBlockingRequirementCount ?? -1) >= 0 &&
    (context.unmetBlockingRequirementCount ?? 0) <= (context.detectedRequirementCount ?? -1) &&
    Number.isInteger(context.unconfirmedBlockingRequirementCount) &&
    (context.unconfirmedBlockingRequirementCount ?? -1) >= 0 &&
    Number.isInteger(context.unconfirmedRequirementCount) &&
    (context.unconfirmedRequirementCount ?? -1) >= 0 &&
    (context.unconfirmedRequirementCount ?? 0) <= (context.detectedRequirementCount ?? -1) &&
    (context.unconfirmedRequirementCount ?? -1) >= (context.unconfirmedBlockingRequirementCount ?? 0) &&
    (context.unmetBlockingRequirementCount ?? 0) + (context.unconfirmedRequirementCount ?? 0) <= (context.detectedRequirementCount ?? -1) &&
    context.careerEvidenceVersion === 2 &&
    Number.isInteger(context.detectedRequirementCount) &&
    (context.detectedRequirementCount ?? 0) > 0 &&
    Number.isInteger(context.profileCompleteness) &&
    (context.profileCompleteness ?? -1) >= 0 &&
    (context.profileCompleteness ?? 101) <= 100 &&
    typeof context.careerEvidenceAvailable === 'boolean';
}

export function getAtsScoreDisplayInfo(score: unknown, context?: AtsScoreContext) {
  if (!isValidAtsScore(score)) {
    return {
      state: 'unknown' as const,
      label: 'Niezweryfikowany wynik',
      note: 'Zapisany wynik nie jest liczbą z zakresu 0–100, więc nie można pokazać go jako oceny.',
    };
  }

  if (!context) {
    return {
      state: 'unknown' as const,
      label: `Wynik historyczny: ${score}%`,
      note: 'Nie zapisano liczby rozpoznanych wymagań ani kompletności profilu, więc zakres tej oceny jest nieznany.',
    };
  }

  // Podsumowanie ostatniej analizy jest wczytywane bezpośrednio z localStorage.
  // Częściowy lub uszkodzony kontekst nie może przejść dalej jako pełny wynik.
  if (!isValidAtsScoreContext(context)) {
    return {
      state: 'unknown' as const,
      label: `Wynik historyczny: ${score}%`,
      note: 'Zapisany kontekst oceny jest niekompletny lub nieprawidłowy, więc zakres tego wyniku jest nieznany.',
    };
  }

  const unmetBlockingRequirementCount = context.unmetBlockingRequirementCount ?? -1;
  const unconfirmedBlockingRequirementCount = context.unconfirmedBlockingRequirementCount ?? -1;
  const unconfirmedRequirementCount = context.unconfirmedRequirementCount ?? -1;
  if (context.scoreContextVersion !== 5 || context.careerEvidenceVersion !== 2 ||
      !Number.isInteger(unmetBlockingRequirementCount) || unmetBlockingRequirementCount < 0 ||
      !Number.isInteger(unconfirmedBlockingRequirementCount) || unconfirmedBlockingRequirementCount < 0 ||
      !Number.isInteger(unconfirmedRequirementCount) || unconfirmedRequirementCount < 0) {
    return {
      state: 'unknown' as const,
      label: `Wynik historyczny: ${score}%`,
      note: 'Starszy zapis nie określa, czy profil zawierał merytoryczny opis doświadczenia lub projektu; zakres wyniku jest nieznany.',
    };
  }

  if (unmetBlockingRequirementCount > 0) {
    const count = unmetBlockingRequirementCount;
    const unknownFormalNote = unconfirmedBlockingRequirementCount > 0
      ? ` Dodatkowo ${unconfirmedBlockingRequirementCount} ${unconfirmedBlockingRequirementCount === 1 ? 'wymóg formalny wymaga' : 'wymogi formalne wymagają'} potwierdzenia; brak danych nie oznacza ich spełnienia ani niespełnienia.`
      : '';
    const otherUnknownCount = unconfirmedRequirementCount - unconfirmedBlockingRequirementCount;
    const otherUnknownNote = otherUnknownCount > 0
      ? ` Dodatkowo ${otherUnknownCount} ${otherUnknownCount === 1 ? 'wymóg wymaga' : 'wymogi wymagają'} potwierdzenia; brak danych nie oznacza ich spełnienia ani niespełnienia.`
      : '';
    return {
      state: 'limited' as const,
      label: `Niepotwierdzony wymóg obowiązkowy: ${score}%`,
      note: `Profil nie potwierdza ${count} ${count === 1 ? 'wymogu, który oferta oznacza jako obowiązkowy' : 'wymogów, które oferta oznacza jako obowiązkowe'}. Wynik nie oznacza spełnienia tych kryteriów.${unknownFormalNote}${otherUnknownNote}`,
    };
  }

  if (unconfirmedRequirementCount > unconfirmedBlockingRequirementCount) {
    const otherUnknownCount = unconfirmedRequirementCount - unconfirmedBlockingRequirementCount;
    return {
      state: 'limited' as const,
      label: 'Wstępny wynik — wymagania do potwierdzenia',
      note: `${otherUnknownCount} ${otherUnknownCount === 1 ? 'wymóg wymaga' : 'wymogi wymagają'} potwierdzenia, ponieważ profil nie zawiera wszystkich potrzebnych danych. Nie uznajemy ich za spełnione ani za niespełnione.${unconfirmedBlockingRequirementCount > 0 ? ` Dodatkowo ${unconfirmedBlockingRequirementCount} ${unconfirmedBlockingRequirementCount === 1 ? 'wymóg formalny wymaga' : 'wymogi formalne wymagają'} potwierdzenia.` : ''}`,
    };
  }
  if (unconfirmedBlockingRequirementCount > 0) {
    const count = unconfirmedBlockingRequirementCount;
    return {
      state: 'limited' as const,
      label: 'Wstępny wynik — niepełne dane formalne',
      note: `${count} ${count === 1 ? 'wymóg formalny wymaga' : 'wymogi formalne wymagają'} potwierdzenia, ponieważ profil nie zawiera wszystkich potrzebnych danych. Nie uznajemy ich za spełnione ani za niespełnione.`,
    };
  }
  if (context.careerEvidenceAvailable === false) {
    return {
      state: 'limited' as const,
      label: `Wynik wstępny: ${score}%`,
      note: 'Brak merytorycznego opisu doświadczenia lub projektu; wynik nie potwierdza dopasowania zawodowego.',
    };
  }

  if (context.careerEvidenceAvailable !== true) {
    return {
      state: 'unknown' as const,
      label: `Wynik historyczny: ${score}%`,
      note: 'Nie zapisano informacji, czy profil zawiera doświadczenie lub projekt, więc zakres tej oceny jest nieznany.',
    };
  }

  if (hasLimitedMatchEvidence({
    profileCompleteness: context.profileCompleteness,
    totalRequirementCount: context.detectedRequirementCount,
    fitEvidenceAvailable: context.careerEvidenceAvailable,
    blockingRequirements: unmetBlockingRequirementCount > 0 ? ['unmet'] : [],
    unconfirmedRequirementCount,
  })) {
    const profileReason = context.profileCompleteness < 50
      ? `profil był uzupełniony w ${context.profileCompleteness}%`
      : null;
    const requirementsReason = context.detectedRequirementCount < 3
      ? `rozpoznano tylko ${context.detectedRequirementCount} ${context.detectedRequirementCount === 1 ? 'wymaganie' : 'wymagania'}`
      : null;
    const reasons = [profileReason, requirementsReason].filter((reason): reason is string => Boolean(reason));
    return {
      state: 'limited' as const,
      label: `Wynik wstępny: ${score}%`,
      note: `Ograniczona podstawa: ${reasons.join(' i ')}.`,
    };
  }

  return {
    state: 'full' as const,
    label: `Wynik Kierivo: ${score}%`,
    note: `Zapisano przy ${context.detectedRequirementCount} rozpoznanych wymaganiach i ${context.profileCompleteness}% kompletności profilu.`,
  };
}
