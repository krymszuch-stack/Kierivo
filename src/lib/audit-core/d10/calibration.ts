import { extractD10Requirements } from './requirementParser';
import type {
  D10FormalRequirementKind,
  D10RequirementPriority,
} from './types';

export interface D10ExpectedRequirement {
  canonicalId: string;
  kind: D10FormalRequirementKind;
  priority: D10RequirementPriority;
}

export interface D10ParserCalibrationCase {
  id: string;
  jobDescription: string;
  expected: D10ExpectedRequirement[];
}

export interface D10ParserCalibrationReport {
  cases: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  precision: number;
  recall: number;
  f1: number;
  priorityAccuracy: number;
  kindAccuracy: number;
  coreMustFalsePositives: number;
}

export interface D10KnockoutObservation {
  id: string;
  shouldKnockout: boolean;
  didKnockout: boolean;
}

export interface D10KnockoutCalibrationReport {
  observations: number;
  falseKnockouts: number;
  missedKnockouts: number;
  falseKnockoutRate: number;
  recall: number;
}

const safeRatio = (numerator: number, denominator: number): number =>
  denominator <= 0 ? 0 : numerator / denominator;

const f1 = (precision: number, recall: number): number =>
  precision + recall <= Number.EPSILON ? 0 : 2 * precision * recall / (precision + recall);

export async function evaluateD10ParserCalibration(
  cases: readonly D10ParserCalibrationCase[],
): Promise<D10ParserCalibrationReport> {
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let priorityCorrect = 0;
  let kindCorrect = 0;
  let coreMustFalsePositives = 0;

  for (const testCase of cases) {
    const result = await extractD10Requirements(testCase.jobDescription);
    const expectedById = new Map(testCase.expected.map((item) => [item.canonicalId, item]));
    const predictedById = new Map(result.requirements.map((item) => [item.canonicalId, item]));

    for (const predicted of result.requirements) {
      const expected = expectedById.get(predicted.canonicalId);
      if (!expected) {
        falsePositives += 1;
        if (predicted.priority === 'CORE_MUST') coreMustFalsePositives += 1;
        continue;
      }
      truePositives += 1;
      if (predicted.priority === expected.priority) priorityCorrect += 1;
      else if (predicted.priority === 'CORE_MUST') coreMustFalsePositives += 1;
      if (predicted.kind === expected.kind) kindCorrect += 1;
    }

    for (const expected of testCase.expected) {
      if (!predictedById.has(expected.canonicalId)) falseNegatives += 1;
    }
  }

  const precision = safeRatio(truePositives, truePositives + falsePositives);
  const recall = safeRatio(truePositives, truePositives + falseNegatives);

  return {
    cases: cases.length,
    truePositives,
    falsePositives,
    falseNegatives,
    precision,
    recall,
    f1: f1(precision, recall),
    priorityAccuracy: safeRatio(priorityCorrect, truePositives),
    kindAccuracy: safeRatio(kindCorrect, truePositives),
    coreMustFalsePositives,
  };
}

export function evaluateD10KnockoutCalibration(
  observations: readonly D10KnockoutObservation[],
): D10KnockoutCalibrationReport {
  const falseKnockouts = observations.filter((item) => item.didKnockout && !item.shouldKnockout).length;
  const missedKnockouts = observations.filter((item) => !item.didKnockout && item.shouldKnockout).length;
  const negatives = observations.filter((item) => !item.shouldKnockout).length;
  const positives = observations.filter((item) => item.shouldKnockout).length;
  const trueKnockouts = observations.filter((item) => item.didKnockout && item.shouldKnockout).length;
  return {
    observations: observations.length,
    falseKnockouts,
    missedKnockouts,
    falseKnockoutRate: safeRatio(falseKnockouts, negatives),
    recall: safeRatio(trueKnockouts, positives),
  };
}

export const D10_CALIBRATION_PRIOR_GATE = {
  minPrecision: 0.95,
  minRecall: 0.9,
  minPriorityAccuracy: 0.9,
  minKindAccuracy: 0.95,
  maxCoreMustFalsePositives: 0,
  maxFalseKnockoutRate: 0,
} as const;

export function d10CalibrationGate(
  parser: D10ParserCalibrationReport,
  knockout?: D10KnockoutCalibrationReport,
): string[] {
  const errors: string[] = [];
  if (parser.precision < D10_CALIBRATION_PRIOR_GATE.minPrecision) errors.push(`precision ${parser.precision.toFixed(3)} < ${D10_CALIBRATION_PRIOR_GATE.minPrecision}`);
  if (parser.recall < D10_CALIBRATION_PRIOR_GATE.minRecall) errors.push(`recall ${parser.recall.toFixed(3)} < ${D10_CALIBRATION_PRIOR_GATE.minRecall}`);
  if (parser.priorityAccuracy < D10_CALIBRATION_PRIOR_GATE.minPriorityAccuracy) errors.push(`priority accuracy ${parser.priorityAccuracy.toFixed(3)} < ${D10_CALIBRATION_PRIOR_GATE.minPriorityAccuracy}`);
  if (parser.kindAccuracy < D10_CALIBRATION_PRIOR_GATE.minKindAccuracy) errors.push(`kind accuracy ${parser.kindAccuracy.toFixed(3)} < ${D10_CALIBRATION_PRIOR_GATE.minKindAccuracy}`);
  if (parser.coreMustFalsePositives > D10_CALIBRATION_PRIOR_GATE.maxCoreMustFalsePositives) errors.push(`false CORE_MUST predictions: ${parser.coreMustFalsePositives}`);
  if (knockout && knockout.falseKnockoutRate > D10_CALIBRATION_PRIOR_GATE.maxFalseKnockoutRate) errors.push(`false knockout rate ${knockout.falseKnockoutRate.toFixed(3)} > 0`);
  return errors;
}
