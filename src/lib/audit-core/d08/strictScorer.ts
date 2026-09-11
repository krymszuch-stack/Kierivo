import type { AuditModuleResult } from '../contracts';
import { D08_BASE_WEIGHTS, scoreStructuralReadability as scoreUnchecked } from './scorer';
import type { D08Signals } from './types';

/**
 * Reading-order może tworzyć bardzo dotkliwy hard cap, dlatego sama heurystyka
 * geometrii nie ma prawa wpływać na wynik. Na etapie D08 v2 wymagamy wysokiej
 * pewności pomiaru. Próg jest priorem kalibracyjnym i podlega golden corpus.
 */
export const D08_READING_ORDER_MIN_SCORING_CONFIDENCE = 0.85;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function hardenD08ScoringSignals(rawSignals: D08Signals): D08Signals {
  const signals = structuredClone(rawSignals);
  const orderConfidence = clamp01(signals.readingOrder.measurementConfidence ?? 0);

  if (orderConfidence < D08_READING_ORDER_MIN_SCORING_CONFIDENCE) {
    signals.readingOrder.comparablePairWeight = 0;
    signals.readingOrder.discordantPairWeight = 0;

    // Coverage confidence ma odzwierciedlać fakt, że jeden z kluczowych wymiarów
    // nie jest wystarczająco udowodniony. Nie usuwamy go z oczekiwanego mianownika.
    signals.confidenceInput.fulfilledEvidenceWeight = Math.max(
      0,
      signals.confidenceInput.fulfilledEvidenceWeight - D08_BASE_WEIGHTS.READING_ORDER,
    );
  }

  return signals;
}

export function scoreStructuralReadability(signals: D08Signals): AuditModuleResult {
  return scoreUnchecked(hardenD08ScoringSignals(signals));
}
