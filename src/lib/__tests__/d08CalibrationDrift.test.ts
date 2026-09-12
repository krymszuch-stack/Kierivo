import { describe, expect, it } from 'vitest';
import { buildCalibrationDriftReport } from '../audit-core/drift';
import {
  buildD08CalibrationSnapshot,
  D08_CONFIG_VERSION,
  D08_ENGINE_VERSION,
  D08_EXPECTED_RELATIONS,
  D08_SYNTHETIC_CORPUS_VERSION,
  d08SyntheticDriftGate,
} from '../audit-core/d08/calibration';
import { D08_SYNTHETIC_BASELINE } from '../audit-core/d08/syntheticBaseline';

describe('D08 — synthetic calibration drift gate', () => {
  it('obecny scorer odtwarza zamrożony runtime baseline 1:1', () => {
    const current = buildD08CalibrationSnapshot();
    const report = buildCalibrationDriftReport({
      engineVersion: D08_ENGINE_VERSION,
      configVersion: D08_CONFIG_VERSION,
      corpusVersion: D08_SYNTHETIC_CORPUS_VERSION,
      before: D08_SYNTHETIC_BASELINE,
      after: current,
      expectedRelations: D08_EXPECTED_RELATIONS,
    });

    expect(report.casesChanged).toBe(0);
    expect(report.medianAbsoluteDelta).toBe(0);
    expect(report.p95AbsoluteDelta).toBe(0);
    expect(report.maxAbsoluteDelta).toBe(0);
    expect(report.rankInversions).toHaveLength(0);
    expect(report.newHardCaps).toHaveLength(0);
    expect(report.removedHardCaps).toHaveLength(0);
    expect(report.confidenceDeltaSummary.maxAbsoluteDelta).toBe(0);
    expect(d08SyntheticDriftGate(report)).toEqual([]);
  });

  it('odrzuca niejawny duży drift nawet gdy dotyczy pojedynczego przypadku', () => {
    const perturbed = buildD08CalibrationSnapshot().map((item) =>
      item.caseId === 'D08_10_FLOATING_BOX_OVERLAP'
        ? { ...item, score: item.score === null ? null : item.score - 12 }
        : item,
    );
    const report = buildCalibrationDriftReport({
      engineVersion: D08_ENGINE_VERSION,
      configVersion: D08_CONFIG_VERSION,
      corpusVersion: D08_SYNTHETIC_CORPUS_VERSION,
      before: D08_SYNTHETIC_BASELINE,
      after: perturbed,
      expectedRelations: D08_EXPECTED_RELATIONS,
    });

    expect(report.maxAbsoluteDelta).toBeGreaterThan(2);
    expect(d08SyntheticDriftGate(report).length).toBeGreaterThan(0);
  });

  it('odrzuca niejawne dodanie hard capa nawet bez zmiany score', () => {
    const perturbed = buildD08CalibrationSnapshot().map((item) =>
      item.caseId === 'D08_10_FLOATING_BOX_OVERLAP'
        ? { ...item, hardCapRuleCodes: [...item.hardCapRuleCodes, 'HC_D08_TEST_UNAPPROVED'] }
        : item,
    );
    const report = buildCalibrationDriftReport({
      engineVersion: D08_ENGINE_VERSION,
      configVersion: D08_CONFIG_VERSION,
      corpusVersion: D08_SYNTHETIC_CORPUS_VERSION,
      before: D08_SYNTHETIC_BASELINE,
      after: perturbed,
      expectedRelations: D08_EXPECTED_RELATIONS,
    });

    expect(report.newHardCaps).toContain('HC_D08_TEST_UNAPPROVED');
    expect(d08SyntheticDriftGate(report).some((error) => error.includes('hard cap'))).toBe(true);
  });

  it('odrzuca odwrócenie relacji semantycznej', () => {
    const perturbed = buildD08CalibrationSnapshot().map((item) => {
      if (item.caseId === 'D08_07_MOJIBAKE_POLISH') return { ...item, score: 100 };
      if (item.caseId === 'D08_20_POLISH_DIACRITICS_CLEAN') return { ...item, score: 90 };
      return item;
    });
    const report = buildCalibrationDriftReport({
      engineVersion: D08_ENGINE_VERSION,
      configVersion: D08_CONFIG_VERSION,
      corpusVersion: D08_SYNTHETIC_CORPUS_VERSION,
      before: D08_SYNTHETIC_BASELINE,
      after: perturbed,
      expectedRelations: D08_EXPECTED_RELATIONS,
    });

    expect(report.rankInversions).toContainEqual({
      betterCaseId: 'D08_20_POLISH_DIACRITICS_CLEAN',
      worseCaseId: 'D08_07_MOJIBAKE_POLISH',
    });
    expect(d08SyntheticDriftGate(report).length).toBeGreaterThan(0);
  });
});
