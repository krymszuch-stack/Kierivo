import { describe, expect, it } from 'vitest';
import { createCleanD08Signals } from '../audit-core/d08/fixtures';
import { scoreStructuralReadability } from '../audit-core/d08/scorer';

describe('D08 — semantyka sygnałów niezmierzonych', () => {
  it('niezmierzony hidden text nie uruchamia kary ani hard capu nawet gdy ratio przypadkiem istnieje', () => {
    const signals = createCleanD08Signals();
    signals.adversarial.hiddenTextMeasured = false;
    signals.adversarial.hiddenTextRatio = 0.9;
    signals.adversarial.hiddenTextEvidenceIds = ['EV_UNTRUSTED_HIDDEN_RATIO'];

    const result = scoreStructuralReadability(signals);

    expect(result.penalties.some((penalty) => penalty.ruleCode === 'PEN_D08_HIDDEN_TEXT')).toBe(false);
    expect(result.hardCaps.some((cap) => cap.ruleCode === 'HC_D08_HIDDEN_TEXT_MASSIVE')).toBe(false);
  });

  it('niezmierzona duplicate invisible layer nie uruchamia kary', () => {
    const signals = createCleanD08Signals();
    signals.adversarial.duplicateInvisibleLayerMeasured = false;
    signals.adversarial.duplicateInvisibleLayerRatio = 0.8;
    signals.adversarial.duplicateLayerEvidenceIds = ['EV_UNTRUSTED_DUPLICATE_RATIO'];

    const result = scoreStructuralReadability(signals);

    expect(
      result.penalties.some((penalty) => penalty.ruleCode === 'PEN_D08_DUPLICATE_INVISIBLE_LAYER'),
    ).toBe(false);
  });

  it('layout liczony tylko z clippingu nie zakłada, że niezmierzone overlap/z-order/nesting są idealne', () => {
    const signals = createCleanD08Signals();
    signals.layout = {
      clippingRatio: 0.05,
      evidenceIds: ['EV_ONLY_CLIPPING_MEASURED'],
    };

    const result = scoreStructuralReadability(signals);
    const layout = result.breakdown.find((component) => component.id === 'LAYOUT_TOPOLOGY');

    expect(layout).toBeDefined();
    expect(layout!.normalizedValue).toBeCloseTo(Math.exp(-10 * 0.05), 12);
  });

  it('brak wszystkich podpomiarów layoutu nie daje darmowego 100', () => {
    const signals = createCleanD08Signals();
    signals.layout = { evidenceIds: [] };

    const result = scoreStructuralReadability(signals);

    expect(result.breakdown.some((component) => component.id === 'LAYOUT_TOPOLOGY')).toBe(false);
    expect(result.missingEvidence.some((missing) => missing.requirementCode === 'D08_LAYOUT_TOPOLOGY_MEASUREMENT')).toBe(true);
  });
});
