import { getAdaptiveModulePolicy } from './registry';
import type {
  AdaptiveCalibrationSnapshot,
  AdaptiveModuleId,
  AdaptiveValidationMetrics,
} from './types';

export interface AdaptiveActivationDecision {
  allowed: boolean;
  reasons: string[];
}

export const DEFAULT_ADAPTIVE_ACTIVATION_THRESHOLDS = {
  minPrecision: 0.72,
  minRecall: 0.62,
  minF1: 0.68,
  maxExpectedCalibrationError: 0.10,
  maxRankInversions: 0,
  maxMedianAbsoluteScoreDrift: 1.5,
  maxP95AbsoluteScoreDrift: 4,
} as const;

export function validateAdaptiveMetrics(
  moduleId: AdaptiveModuleId,
  metrics: AdaptiveValidationMetrics,
): AdaptiveActivationDecision {
  const policy = getAdaptiveModulePolicy(moduleId);
  const reasons: string[] = [];
  const t = DEFAULT_ADAPTIVE_ACTIVATION_THRESHOLDS;

  if (!policy.allowAutomaticActivation) {
    reasons.push('Polityka modułu wymaga jawnej akceptacji człowieka przed aktywacją snapshotu.');
  }
  if (metrics.precision < t.minPrecision) reasons.push(`Precision ${metrics.precision.toFixed(3)} < ${t.minPrecision}.`);
  if (metrics.recall < t.minRecall) reasons.push(`Recall ${metrics.recall.toFixed(3)} < ${t.minRecall}.`);
  if (metrics.f1 < t.minF1) reasons.push(`F1 ${metrics.f1.toFixed(3)} < ${t.minF1}.`);
  if (metrics.expectedCalibrationError > t.maxExpectedCalibrationError) {
    reasons.push(`ECE ${metrics.expectedCalibrationError.toFixed(3)} > ${t.maxExpectedCalibrationError}.`);
  }
  if (metrics.rankInversions > t.maxRankInversions) {
    reasons.push(`Wykryto ${metrics.rankInversions} inwersji relacji jakości.`);
  }
  if (metrics.medianAbsoluteScoreDrift > t.maxMedianAbsoluteScoreDrift) {
    reasons.push(`Mediana driftu ${metrics.medianAbsoluteScoreDrift.toFixed(2)} > ${t.maxMedianAbsoluteScoreDrift}.`);
  }
  if (metrics.p95AbsoluteScoreDrift > t.maxP95AbsoluteScoreDrift) {
    reasons.push(`P95 driftu ${metrics.p95AbsoluteScoreDrift.toFixed(2)} > ${t.maxP95AbsoluteScoreDrift}.`);
  }

  return { allowed: reasons.length === 0, reasons };
}

export function snapshotCanBecomeActive(snapshot: AdaptiveCalibrationSnapshot): AdaptiveActivationDecision {
  const reasons: string[] = [];
  const modelEntries = Object.entries(snapshot.moduleModels) as Array<[
    AdaptiveModuleId,
    NonNullable<AdaptiveCalibrationSnapshot['moduleModels'][AdaptiveModuleId]>,
  ]>;

  if (snapshot.status !== 'VALIDATED') {
    reasons.push(`Snapshot ma status ${snapshot.status}; wymagany VALIDATED.`);
  }
  if (modelEntries.length === 0) reasons.push('Snapshot nie zawiera żadnego modelu modułowego.');

  for (const [moduleId] of modelEntries) {
    const metrics = snapshot.validation?.[moduleId];
    if (!metrics) {
      reasons.push(`${moduleId}: brak metryk holdout.`);
      continue;
    }
    const decision = validateAdaptiveMetrics(moduleId, metrics);
    // Brak automatic activation jest oczekiwany. Tutaj raportujemy pozostałe
    // problemy matematyczne, a promocję wykonuje osobna jawna akcja administracyjna.
    for (const reason of decision.reasons.filter((item) => !item.startsWith('Polityka modułu'))) {
      reasons.push(`${moduleId}: ${reason}`);
    }
  }
  return { allowed: reasons.length === 0, reasons };
}
