import { describe, expect, it } from 'vitest';
import { createCleanD08Signals, cloneD08Signals } from '../audit-core/d08/fixtures';
import {
  D08_BASE_WEIGHTS,
  D08_CONFIG,
  scoreStructuralReadability,
} from '../audit-core/d08/scorer';

describe('D08 Structural Readability — kontrakt bazowy', () => {
  it('wagi bazowe sumują się do 1', () => {
    const sum = Object.values(D08_BASE_WEIGHTS).reduce((acc, value) => acc + value, 0);
    expect(sum).toBeCloseTo(1, 12);
  });

  it('czysty dokument daje wynik bliski 100 bez hard capów', () => {
    const result = scoreStructuralReadability(createCleanD08Signals());

    expect(result.applicability).toBe('APPLICABLE');
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThan(95);
    expect(result.hardCaps).toHaveLength(0);
    expect(result.penalties).toHaveLength(0);
    expect(result.ledger?.finalScore).toBe(result.score);
  });

  it('runtime score i ledger finalScore są identyczne', () => {
    const signals = createCleanD08Signals();
    signals.layout.clippingRatio = 0.03;
    signals.adversarial.hiddenTextRatio = 0.02;
    signals.adversarial.hiddenTextEvidenceIds = ['EV_HIDDEN'];

    const result = scoreStructuralReadability(signals);

    expect(result.score).not.toBeNull();
    expect(result.ledger).not.toBeNull();
    expect(result.ledger!.finalScore).toBe(result.score);
    expect(result.ledger!.componentScore - result.ledger!.penaltyTotal)
      .toBeCloseTo(result.ledger!.afterPenalties, 12);
  });

  it('każdy aktywny komponent pozostaje w zakresie 0..1 i ma spójny wkład', () => {
    const result = scoreStructuralReadability(createCleanD08Signals());

    for (const component of result.breakdown) {
      expect(component.normalizedValue).toBeGreaterThanOrEqual(0);
      expect(component.normalizedValue).toBeLessThanOrEqual(1);
      expect(component.effectiveWeight).toBeGreaterThan(0);
      expect(component.contribution).toBeCloseTo(
        component.normalizedValue * component.effectiveWeight * 100,
        12,
      );
      expect(component.unrealizedPotential).toBeCloseTo(
        component.maxContribution - component.contribution,
        12,
      );
    }
  });
});

describe('D08 — brak danych i N/A', () => {
  it('awaria pipeline zwraca INSUFFICIENT_DATA i score=null', () => {
    const signals = createCleanD08Signals();
    signals.measurementHealth = {
      pipelineHealthy: false,
      failureCode: 'TEST_EXTRACTOR_FAILURE',
      failureMessage: 'syntetyczna awaria extractora',
    };

    const result = scoreStructuralReadability(signals);

    expect(result.applicability).toBe('INSUFFICIENT_DATA');
    expect(result.score).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.ledger).toBeNull();
  });

  it('brak wymaganej miary warstwy tekstowej nie jest renormalizowany do dobrego wyniku', () => {
    const signals = createCleanD08Signals();
    delete signals.textLayer.sourceTokenCount;

    const result = scoreStructuralReadability(signals);

    expect(result.applicability).toBe('INSUFFICIENT_DATA');
    expect(result.score).toBeNull();
    expect(result.verdictCode).toBe('D08_TEXT_LAYER_MEASUREMENT_MISSING');
  });

  it('brak list oznacza N/A komponentu, nie 0 ani darmowe 100', () => {
    const base = scoreStructuralReadability(createCleanD08Signals());
    const signals = createCleanD08Signals();
    signals.lists = {
      applicable: false,
      evidenceIds: [],
    };

    const noLists = scoreStructuralReadability(signals);

    expect(noLists.breakdown.some((component) => component.id === 'LISTS')).toBe(false);
    expect(noLists.score).not.toBeNull();
    expect(noLists.score!).toBeGreaterThan(95);
    expect(Math.abs(noLists.score! - base.score!)).toBeLessThan(1);
  });

  it('brak pól strukturalnych nie daje darmowych punktów', () => {
    const signals = createCleanD08Signals();
    signals.structuredFields = [];

    const result = scoreStructuralReadability(signals);

    expect(result.breakdown.some((component) => component.id === 'STRUCTURED_FIELDS')).toBe(false);
    const weightSum = result.breakdown.reduce((sum, component) => sum + component.effectiveWeight, 0);
    expect(weightSum).toBeCloseTo(1, 12);
  });
});

describe('D08 — monotoniczność i izolacja', () => {
  it('zwiększenie niezgodności kolejności obniża score', () => {
    const clean = createCleanD08Signals();
    const mild = cloneD08Signals(clean);
    const severe = cloneD08Signals(clean);

    mild.readingOrder.discordantPairWeight = 5;
    severe.readingOrder.discordantPairWeight = 15;

    const cleanScore = scoreStructuralReadability(clean).score!;
    const mildScore = scoreStructuralReadability(mild).score!;
    const severeScore = scoreStructuralReadability(severe).score!;

    expect(cleanScore).toBeGreaterThan(mildScore);
    expect(mildScore).toBeGreaterThan(severeScore);
  });

  it('naprawienie uszkodzenia kodowania nie może obniżyć wyniku', () => {
    const damaged = createCleanD08Signals();
    damaged.encoding.weightedDamageRatio = 0.015;

    const repaired = cloneD08Signals(damaged);
    repaired.encoding.weightedDamageRatio = 0.002;

    expect(scoreStructuralReadability(repaired).score!)
      .toBeGreaterThan(scoreStructuralReadability(damaged).score!);
  });

  it('dwie kolumny same w sobie nie są sygnałem D08', () => {
    const oneColumn = createCleanD08Signals();
    const twoColumnSafe = cloneD08Signals(oneColumn);

    // Topologia jest identyczna jakościowo; D08 nie posiada pola "columnCount".
    expect(scoreStructuralReadability(twoColumnSafe).score)
      .toBe(scoreStructuralReadability(oneColumn).score);
  });

  it('pogorszenie samego clippingu obniża wyłącznie jakość layoutu i wynik końcowy', () => {
    const clean = createCleanD08Signals();
    const clipped = cloneD08Signals(clean);
    clipped.layout.clippingRatio = 0.08;

    const cleanResult = scoreStructuralReadability(clean);
    const clippedResult = scoreStructuralReadability(clipped);

    const cleanLayout = cleanResult.breakdown.find((component) => component.id === 'LAYOUT_TOPOLOGY')!;
    const clippedLayout = clippedResult.breakdown.find((component) => component.id === 'LAYOUT_TOPOLOGY')!;

    expect(clippedLayout.normalizedValue).toBeLessThan(cleanLayout.normalizedValue);
    expect(clippedResult.score!).toBeLessThan(cleanResult.score!);
  });
});

describe('D08 — hard capy', () => {
  it('krytyczny reading-order uruchamia cap 40', () => {
    const signals = createCleanD08Signals();
    signals.readingOrder.discordantPairWeight = 30;

    const result = scoreStructuralReadability(signals);

    expect(result.hardCaps.some((cap) => cap.ruleCode === 'HC_D08_READING_ORDER_CRITICAL')).toBe(true);
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeLessThanOrEqual(D08_CONFIG.hardCaps.readingOrderCap);
    expect(result.ledger?.effectiveCap).toBe(D08_CONFIG.hardCaps.readingOrderCap);
  });

  it('utrata większości referencyjnego tekstu uruchamia cap warstwy tekstowej', () => {
    const signals = createCleanD08Signals();
    signals.textLayer.extractedTokenCount = 180;
    signals.textLayer.matchedTokenCount = 180;

    const result = scoreStructuralReadability(signals);

    expect(result.hardCaps.some((cap) => cap.ruleCode === 'HC_D08_TEXT_LAYER_CRITICAL')).toBe(true);
    expect(result.score!).toBeLessThanOrEqual(D08_CONFIG.hardCaps.sourceRecallCap);
  });

  it('krytyczne uszkodzenie kodowania uruchamia cap 45', () => {
    const signals = createCleanD08Signals();
    signals.encoding.weightedDamageRatio = 0.04;

    const result = scoreStructuralReadability(signals);

    expect(result.hardCaps.some((cap) => cap.ruleCode === 'HC_D08_ENCODING_CRITICAL')).toBe(true);
    expect(result.score!).toBeLessThanOrEqual(D08_CONFIG.hardCaps.encodingCap);
  });

  it('masowy ukryty tekst uruchamia penalty i hard cap', () => {
    const signals = createCleanD08Signals();
    signals.adversarial.hiddenTextRatio = 0.30;
    signals.adversarial.hiddenTextEvidenceIds = ['EV_HIDDEN_MASSIVE'];

    const result = scoreStructuralReadability(signals);

    expect(result.penalties.some((penalty) => penalty.ruleCode === 'PEN_D08_HIDDEN_TEXT')).toBe(true);
    expect(result.hardCaps.some((cap) => cap.ruleCode === 'HC_D08_HIDDEN_TEXT_MASSIVE')).toBe(true);
    expect(result.score!).toBeLessThanOrEqual(D08_CONFIG.hardCaps.hiddenTextCap);
  });
});

describe('D08 — confidence jest niezależne od score', () => {
  it('czysty dokument z małą liczbą niezależnych dowodów ma niższe confidence, ale nie sztucznie niższy score', () => {
    const rich = createCleanD08Signals();
    const sparse = cloneD08Signals(rich);
    sparse.confidenceInput.independentEvidenceCount = 1;

    const richResult = scoreStructuralReadability(rich);
    const sparseResult = scoreStructuralReadability(sparse);

    expect(sparseResult.confidence).toBeLessThan(richResult.confidence);
    expect(sparseResult.breakdown.map((component) => component.normalizedValue))
      .toEqual(richResult.breakdown.map((component) => component.normalizedValue));
  });

  it('bardzo niski confidence ukrywa score zamiast fabrykować liczbę', () => {
    const signals = createCleanD08Signals();
    signals.confidenceInput = {
      expectedEvidenceWeight: 1,
      fulfilledEvidenceWeight: 0.05,
      provenanceReliability: 0.2,
      extractionQuality: 0.2,
      independentEvidenceCount: 0.1,
      sampleScaleK: 4,
    };

    const result = scoreStructuralReadability(signals);

    expect(result.confidence).toBeLessThan(0.35);
    expect(result.applicability).toBe('INSUFFICIENT_DATA');
    expect(result.score).toBeNull();
  });
});
