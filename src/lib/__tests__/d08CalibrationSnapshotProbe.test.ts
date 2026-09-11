import { describe, expect, it } from 'vitest';
import { D08_GOLDEN_CORPUS } from '../audit-core/d08/goldenCorpus';
import { scoreStructuralReadability } from '../audit-core/d08/strictScorer';

describe('D08 — calibration snapshot probe', () => {
  it('emituje deterministyczny snapshot syntetycznego corpus do zamrożenia jako baseline', () => {
    const snapshot = D08_GOLDEN_CORPUS.map((testCase) => {
      const result = scoreStructuralReadability(testCase.signals);
      return {
        caseId: testCase.id,
        score: result.score === null ? null : Number(result.score.toFixed(6)),
        confidence: Number(result.confidence.toFixed(6)),
        hardCapRuleCodes: result.hardCaps
          .filter((cap) => cap.triggered)
          .map((cap) => cap.ruleCode)
          .sort(),
      };
    });

    // Marker jest tymczasowo jawny w logu CI, aby baseline pochodził z runtime,
    // a nie z ręcznie przepisywanych lub "ładnych" liczb.
    console.log(`D08_BASELINE_SNAPSHOT=${JSON.stringify(snapshot)}`);

    expect(snapshot).toHaveLength(D08_GOLDEN_CORPUS.length);
    expect(new Set(snapshot.map((item) => item.caseId)).size).toBe(snapshot.length);
  });
});
