import { describe, expect, it } from 'vitest';
import { createCleanD08Signals } from '../audit-core/d08/fixtures';
import {
  D08_READING_ORDER_MIN_SCORING_CONFIDENCE,
  hardenD08ScoringSignals,
  scoreStructuralReadability,
} from '../audit-core/d08/strictScorer';

describe('D08 — reading-order evidence gate', () => {
  it('heurystyczna kolejność bez confidence nie wpływa na score ani hard cap', () => {
    const signals = createCleanD08Signals();
    signals.referenceProfile = 'EXTERNAL_DOCUMENT';
    delete signals.readingOrder.measurementConfidence;
    signals.readingOrder.discordantPairWeight = 90;

    const result = scoreStructuralReadability(signals);

    expect(result.breakdown.some((component) => component.id === 'READING_ORDER')).toBe(false);
    expect(result.hardCaps.some((cap) => cap.ruleCode === 'HC_D08_READING_ORDER_CRITICAL')).toBe(false);
    expect(result.missingEvidence.some((missing) => missing.requirementCode === 'D08_READING_ORDER_MEASUREMENT')).toBe(true);
  });

  it('niski confidence usuwa wymiar z punktacji i obniża coverage confidence', () => {
    const signals = createCleanD08Signals();
    signals.readingOrder.measurementConfidence = D08_READING_ORDER_MIN_SCORING_CONFIDENCE - 0.01;
    const beforeCoverage = signals.confidenceInput.fulfilledEvidenceWeight;

    const hardened = hardenD08ScoringSignals(signals);

    expect(hardened.readingOrder.comparablePairWeight).toBe(0);
    expect(hardened.confidenceInput.fulfilledEvidenceWeight)
      .toBeCloseTo(beforeCoverage - 0.22, 12);
  });

  it('wysokie confidence pozwala rygorystycznie ocenić i ograniczyć zły reading-order', () => {
    const signals = createCleanD08Signals();
    signals.readingOrder.measurementConfidence = 1;
    signals.readingOrder.discordantPairWeight = 35;

    const result = scoreStructuralReadability(signals);

    expect(result.breakdown.some((component) => component.id === 'READING_ORDER')).toBe(true);
    expect(result.hardCaps.some((cap) => cap.ruleCode === 'HC_D08_READING_ORDER_CRITICAL')).toBe(true);
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeLessThanOrEqual(40);
  });
});
