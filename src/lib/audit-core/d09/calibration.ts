import type { D09RequirementExtractionResult, D09RequirementKind, D09RequirementPriority } from './types';

export interface D09RequirementAnnotation {
  canonicalId: string;
  priority: D09RequirementPriority;
  kind: D09RequirementKind;
}

export interface D09BinaryMetrics {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
}

export interface D09ParserCalibrationReport {
  entity: D09BinaryMetrics;
  exactPriority: D09BinaryMetrics;
  priorityConfusion: Record<D09RequirementPriority, Record<D09RequirementPriority | 'MISSING', number>>;
}

const safeRatio = (numerator: number, denominator: number): number =>
  denominator > 0 ? numerator / denominator : 0;

function binaryMetrics(tp: number, fp: number, fn: number): D09BinaryMetrics {
  const precision = safeRatio(tp, tp + fp);
  const recall = safeRatio(tp, tp + fn);
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  return { tp, fp, fn, precision, recall, f1 };
}

const annotationKey = (item: Pick<D09RequirementAnnotation, 'canonicalId' | 'priority'>): string =>
  `${item.canonicalId}::${item.priority}`;

export function evaluateD09RequirementParser(
  predicted: D09RequirementExtractionResult,
  expected: readonly D09RequirementAnnotation[],
): D09ParserCalibrationReport {
  const predictedEntityIds = new Set(predicted.requirements.map((item) => item.canonicalId));
  const expectedEntityIds = new Set(expected.map((item) => item.canonicalId));

  const entityTp = [...predictedEntityIds].filter((id) => expectedEntityIds.has(id)).length;
  const entityFp = [...predictedEntityIds].filter((id) => !expectedEntityIds.has(id)).length;
  const entityFn = [...expectedEntityIds].filter((id) => !predictedEntityIds.has(id)).length;

  const predictedExact = new Set(predicted.requirements.map(annotationKey));
  const expectedExact = new Set(expected.map(annotationKey));
  const exactTp = [...predictedExact].filter((key) => expectedExact.has(key)).length;
  const exactFp = [...predictedExact].filter((key) => !expectedExact.has(key)).length;
  const exactFn = [...expectedExact].filter((key) => !predictedExact.has(key)).length;

  const priorities: D09RequirementPriority[] = ['CORE_MUST', 'MUST', 'NICE'];
  const priorityConfusion = Object.fromEntries(
    priorities.map((truth) => [
      truth,
      { CORE_MUST: 0, MUST: 0, NICE: 0, MISSING: 0 },
    ]),
  ) as D09ParserCalibrationReport['priorityConfusion'];
  const predictedById = new Map(predicted.requirements.map((item) => [item.canonicalId, item]));
  for (const truth of expected) {
    const actual = predictedById.get(truth.canonicalId);
    priorityConfusion[truth.priority][actual?.priority ?? 'MISSING'] += 1;
  }

  return {
    entity: binaryMetrics(entityTp, entityFp, entityFn),
    exactPriority: binaryMetrics(exactTp, exactFp, exactFn),
    priorityConfusion,
  };
}

export interface D09RankedCandidateObservation {
  id: string;
  score: number;
}

export interface D09ExpectedPair {
  betterId: string;
  worseId: string;
}

export interface D09RankingReport {
  comparablePairs: number;
  correctPairs: number;
  ties: number;
  inversions: number;
  pairwiseAccuracy: number;
}

/**
 * Pairwise ranking jest celowo pierwszoplanową metryką kalibracyjną D09.
 * Ekspertom znacznie łatwiej i stabilniej oznaczyć „A lepiej pasuje do JD niż B”
 * niż wymyślić arbitralny ground-truth score 73/100.
 */
export function evaluateD09PairwiseRanking(
  observations: readonly D09RankedCandidateObservation[],
  expectedPairs: readonly D09ExpectedPair[],
): D09RankingReport {
  const scores = new Map(observations.map((item) => [item.id, item.score]));
  let correctPairs = 0;
  let ties = 0;
  let inversions = 0;
  let comparablePairs = 0;

  for (const pair of expectedPairs) {
    const better = scores.get(pair.betterId);
    const worse = scores.get(pair.worseId);
    if (better === undefined || worse === undefined) continue;
    comparablePairs += 1;
    if (Math.abs(better - worse) < 1e-9) ties += 1;
    else if (better > worse) correctPairs += 1;
    else inversions += 1;
  }

  return {
    comparablePairs,
    correctPairs,
    ties,
    inversions,
    pairwiseAccuracy: safeRatio(correctPairs, comparablePairs),
  };
}

export interface D09UncertaintyObservation {
  low: number;
  high: number;
  referenceScore: number;
}

export interface D09UncertaintyCoverageReport {
  total: number;
  covered: number;
  coverageRate: number;
  meanIntervalWidth: number;
}

/**
 * Jeśli później będziemy mieli ekspercki reference score, sprawdzamy czy
 * deklarowany przedział uncertainty faktycznie go obejmuje. Zbyt wąskie
 * przedziały to fałszywa pewność; zbyt szerokie są bezużyteczne.
 */
export function evaluateD09UncertaintyCoverage(
  observations: readonly D09UncertaintyObservation[],
): D09UncertaintyCoverageReport {
  const total = observations.length;
  const covered = observations.filter((item) =>
    item.referenceScore >= item.low && item.referenceScore <= item.high).length;
  const meanIntervalWidth = total > 0
    ? observations.reduce((sum, item) => sum + Math.max(0, item.high - item.low), 0) / total
    : 0;
  return {
    total,
    covered,
    coverageRate: safeRatio(covered, total),
    meanIntervalWidth,
  };
}
