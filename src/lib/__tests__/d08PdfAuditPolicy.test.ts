import { describe, expect, it } from 'vitest';
import { createCleanD08Signals } from '../audit-core/d08/fixtures';
import { hardenD08PdfSignals } from '../audit-core/d08/pdfAudit';
import { scoreStructuralReadability } from '../audit-core/d08/scorer';

describe('D08 PDF audit policy', () => {
  it('zachowuje diagnostyczny duplicate ratio, ale nie uznaje niewidzialności bez dowodu', () => {
    const raw = createCleanD08Signals();
    raw.referenceProfile = 'EXTERNAL_DOCUMENT';
    raw.adversarial.duplicateInvisibleLayerMeasured = true;
    raw.adversarial.duplicateInvisibleLayerRatio = 0.35;
    raw.adversarial.duplicateLayerEvidenceIds = ['EV_DUPLICATE_GEOMETRY_ONLY'];

    const hardened = hardenD08PdfSignals(raw);

    expect(hardened.adversarial.duplicateInvisibleLayerRatio).toBe(0.35);
    expect(hardened.adversarial.duplicateInvisibleLayerMeasured).toBe(false);

    const result = scoreStructuralReadability(hardened);
    expect(
      result.penalties.some((penalty) => penalty.ruleCode === 'PEN_D08_DUPLICATE_INVISIBLE_LAYER'),
    ).toBe(false);
  });

  it('nie mutuje surowego pakietu sygnałów', () => {
    const raw = createCleanD08Signals();
    raw.adversarial.duplicateInvisibleLayerMeasured = true;

    const hardened = hardenD08PdfSignals(raw);

    expect(raw.adversarial.duplicateInvisibleLayerMeasured).toBe(true);
    expect(hardened).not.toBe(raw);
  });
});
