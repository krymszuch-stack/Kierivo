export interface CalibrationSnapshotCase {
  caseId: string;
  score: number | null;
  confidence: number;
  hardCapRuleCodes: string[];
}

export interface CalibrationRelation {
  betterCaseId: string;
  worseCaseId: string;
}

export interface CalibrationDriftReport {
  engineVersion: string;
  configVersion: string;
  corpusVersion: string;
  casesChanged: number;
  medianAbsoluteDelta: number;
  p95AbsoluteDelta: number;
  maxAbsoluteDelta: number;
  rankInversions: Array<{ betterCaseId: string; worseCaseId: string }>;
  newHardCaps: string[];
  removedHardCaps: string[];
  confidenceDeltaSummary: {
    medianAbsoluteDelta: number;
    p95AbsoluteDelta: number;
    maxAbsoluteDelta: number;
  };
}

const quantile = (values: readonly number[], q: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1));
  return sorted[index];
};

const summary = (values: readonly number[]) => ({
  medianAbsoluteDelta: quantile(values, 0.5),
  p95AbsoluteDelta: quantile(values, 0.95),
  maxAbsoluteDelta: values.length > 0 ? Math.max(...values) : 0,
});

export interface BuildCalibrationDriftInput {
  engineVersion: string;
  configVersion: string;
  corpusVersion: string;
  before: readonly CalibrationSnapshotCase[];
  after: readonly CalibrationSnapshotCase[];
  expectedRelations?: readonly CalibrationRelation[];
}

export function buildCalibrationDriftReport(
  input: BuildCalibrationDriftInput,
): CalibrationDriftReport {
  const beforeById = new Map(input.before.map((item) => [item.caseId, item]));
  const afterById = new Map(input.after.map((item) => [item.caseId, item]));
  const commonIds = [...beforeById.keys()].filter((id) => afterById.has(id)).sort();

  const scoreDeltas: number[] = [];
  const confidenceDeltas: number[] = [];
  let casesChanged = 0;

  for (const id of commonIds) {
    const before = beforeById.get(id)!;
    const after = afterById.get(id)!;
    const scoreDelta = before.score === null || after.score === null
      ? before.score === after.score ? 0 : 100
      : Math.abs(after.score - before.score);
    const confidenceDelta = Math.abs(after.confidence - before.confidence);
    scoreDeltas.push(scoreDelta);
    confidenceDeltas.push(confidenceDelta);
    if (scoreDelta > 1e-9 || confidenceDelta > 1e-9) casesChanged += 1;
  }

  const beforeCaps = new Set(input.before.flatMap((item) => item.hardCapRuleCodes));
  const afterCaps = new Set(input.after.flatMap((item) => item.hardCapRuleCodes));

  const rankInversions = (input.expectedRelations ?? []).filter((relation) => {
    const better = afterById.get(relation.betterCaseId)?.score;
    const worse = afterById.get(relation.worseCaseId)?.score;
    return better !== null && better !== undefined && worse !== null && worse !== undefined && better <= worse;
  });

  const scoreSummary = summary(scoreDeltas);
  return {
    engineVersion: input.engineVersion,
    configVersion: input.configVersion,
    corpusVersion: input.corpusVersion,
    casesChanged,
    medianAbsoluteDelta: scoreSummary.medianAbsoluteDelta,
    p95AbsoluteDelta: scoreSummary.p95AbsoluteDelta,
    maxAbsoluteDelta: scoreSummary.maxAbsoluteDelta,
    rankInversions,
    newHardCaps: [...afterCaps].filter((cap) => !beforeCaps.has(cap)).sort(),
    removedHardCaps: [...beforeCaps].filter((cap) => !afterCaps.has(cap)).sort(),
    confidenceDeltaSummary: summary(confidenceDeltas),
  };
}

export interface DriftGatePolicy {
  maxMedianAbsoluteDelta: number;
  maxP95AbsoluteDelta: number;
  maxAbsoluteDelta: number;
  allowRankInversions: boolean;
}

export function calibrationDriftGate(
  report: CalibrationDriftReport,
  policy: DriftGatePolicy,
): string[] {
  const errors: string[] = [];
  if (report.medianAbsoluteDelta > policy.maxMedianAbsoluteDelta) {
    errors.push(`Median drift ${report.medianAbsoluteDelta} > ${policy.maxMedianAbsoluteDelta}.`);
  }
  if (report.p95AbsoluteDelta > policy.maxP95AbsoluteDelta) {
    errors.push(`P95 drift ${report.p95AbsoluteDelta} > ${policy.maxP95AbsoluteDelta}.`);
  }
  if (report.maxAbsoluteDelta > policy.maxAbsoluteDelta) {
    errors.push(`Max drift ${report.maxAbsoluteDelta} > ${policy.maxAbsoluteDelta}.`);
  }
  if (!policy.allowRankInversions && report.rankInversions.length > 0) {
    errors.push(`Wykryto ${report.rankInversions.length} inwersji oczekiwanych relacji.`);
  }
  return errors;
}
