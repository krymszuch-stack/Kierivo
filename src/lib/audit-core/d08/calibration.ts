import {
  calibrationDriftGate,
  type CalibrationDriftReport,
  type CalibrationRelation,
  type CalibrationSnapshotCase,
} from '../drift';
import { D08_GOLDEN_CORPUS } from './goldenCorpus';
import { scoreStructuralReadability } from './strictScorer';

export const D08_ENGINE_VERSION = 'D08.structural-readability.v2';
export const D08_CONFIG_VERSION = 'D08.priors.2026-09-11';
export const D08_SYNTHETIC_CORPUS_VERSION = 'D08.synthetic-corpus.v1';

/**
 * Relacje semantyczne, które są ważniejsze od pojedynczych progów liczbowych.
 * Ich odwrócenie oznacza regresję logiki modułu nawet wtedy, gdy średni drift
 * score wygląda niewinnie.
 */
export const D08_EXPECTED_RELATIONS: CalibrationRelation[] = [
  { betterCaseId: 'D08_01_CLEAN_SINGLE_COLUMN', worseCaseId: 'D08_03_TWO_COLUMN_INTERLEAVED' },
  { betterCaseId: 'D08_01_CLEAN_SINGLE_COLUMN', worseCaseId: 'D08_05_SCAN_NO_NATIVE_TEXT' },
  { betterCaseId: 'D08_20_POLISH_DIACRITICS_CLEAN', worseCaseId: 'D08_07_MOJIBAKE_POLISH' },
  { betterCaseId: 'D08_01_CLEAN_SINGLE_COLUMN', worseCaseId: 'D08_10_FLOATING_BOX_OVERLAP' },
  { betterCaseId: 'D08_01_CLEAN_SINGLE_COLUMN', worseCaseId: 'D08_11_CLIPPED_TEXT' },
  { betterCaseId: 'D08_12_MIXED_DATES_PARSEABLE', worseCaseId: 'D08_13_AMBIGUOUS_DATES' },
  { betterCaseId: 'D08_01_CLEAN_SINGLE_COLUMN', worseCaseId: 'D08_17_HIDDEN_WHITE_TEXT' },
  { betterCaseId: 'D08_01_CLEAN_SINGLE_COLUMN', worseCaseId: 'D08_19_DUPLICATE_TEXT_LAYER_CONFIRMED' },
];

export const D08_SYNTHETIC_DRIFT_POLICY = {
  maxMedianAbsoluteDelta: 0.25,
  maxP95AbsoluteDelta: 1,
  maxAbsoluteDelta: 2,
  maxConfidenceP95AbsoluteDelta: 0.02,
  allowRankInversions: false,
} as const;

export function buildD08CalibrationSnapshot(): CalibrationSnapshotCase[] {
  return D08_GOLDEN_CORPUS.map((testCase) => {
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
}

/**
 * D07 raportuje drift hard-capów i confidence, ale bazowy gate skupia się na
 * score/rankingu. D08 traktuje zmianę hard capa oraz duży drift confidence jako
 * zmianę semantyki, więc dokłada je do własnej bramki.
 */
export function d08SyntheticDriftGate(report: CalibrationDriftReport): string[] {
  const errors = calibrationDriftGate(report, D08_SYNTHETIC_DRIFT_POLICY);

  if (report.newHardCaps.length > 0) {
    errors.push(`Nowe hard capy bez jawnej akceptacji: ${report.newHardCaps.join(', ')}.`);
  }
  if (report.removedHardCaps.length > 0) {
    errors.push(`Usunięte hard capy bez jawnej akceptacji: ${report.removedHardCaps.join(', ')}.`);
  }
  if (
    report.confidenceDeltaSummary.p95AbsoluteDelta >
    D08_SYNTHETIC_DRIFT_POLICY.maxConfidenceP95AbsoluteDelta
  ) {
    errors.push(
      `P95 confidence drift ${report.confidenceDeltaSummary.p95AbsoluteDelta} > ${D08_SYNTHETIC_DRIFT_POLICY.maxConfidenceP95AbsoluteDelta}.`,
    );
  }

  return errors;
}
