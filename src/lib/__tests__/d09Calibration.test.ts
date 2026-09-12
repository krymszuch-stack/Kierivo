import { describe, expect, it } from 'vitest';
import {
  evaluateD09PairwiseRanking,
  evaluateD09RequirementParser,
  evaluateD09UncertaintyCoverage,
} from '../audit-core/d09/calibration';
import { extractD09Requirements } from '../audit-core/d09/requirementParser';

describe('D09 calibration harness', () => {
  it('liczy precision/recall/F1 również dla klasy MUST/NICE', async () => {
    const predicted = await extractD09Requirements(`
Requirements:
- Java
- PostgreSQL
Nice to have:
- AWS
`);
    const report = evaluateD09RequirementParser(predicted, [
      { canonicalId: 'java', priority: 'MUST', kind: 'SKILL' },
      { canonicalId: 'postgresql', priority: 'MUST', kind: 'SKILL' },
      { canonicalId: 'aws', priority: 'NICE', kind: 'SKILL' },
    ]);

    expect(report.entity.precision).toBe(1);
    expect(report.entity.recall).toBe(1);
    expect(report.exactPriority.f1).toBe(1);
  });

  it('raportuje inwersje rankingu zamiast stroić wyłącznie do pojedynczych score', () => {
    const report = evaluateD09PairwiseRanking(
      [
        { id: 'A', score: 80 },
        { id: 'B', score: 65 },
        { id: 'C', score: 70 },
      ],
      [
        { betterId: 'A', worseId: 'B' },
        { betterId: 'B', worseId: 'C' },
      ],
    );

    expect(report.correctPairs).toBe(1);
    expect(report.inversions).toBe(1);
    expect(report.pairwiseAccuracy).toBe(0.5);
  });

  it('mierzy pokrycie i szerokość przedziałów uncertainty', () => {
    const report = evaluateD09UncertaintyCoverage([
      { low: 60, high: 80, referenceScore: 72 },
      { low: 40, high: 55, referenceScore: 62 },
    ]);

    expect(report.coverageRate).toBe(0.5);
    expect(report.meanIntervalWidth).toBe(17.5);
  });
});
