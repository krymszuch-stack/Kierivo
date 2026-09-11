import { extractAdaptiveFeatures } from './tokenizer';
import { getAdaptiveModulePolicy } from './registry';
import type {
  AdaptiveCalibrationSnapshot,
  AdaptiveFeatureMatch,
  AdaptiveModuleId,
  AdaptiveRuntimeSignal,
} from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function evaluateAdaptiveRuntimeSignal(
  snapshot: AdaptiveCalibrationSnapshot | null,
  moduleId: AdaptiveModuleId,
  text: string,
): AdaptiveRuntimeSignal {
  const policy = getAdaptiveModulePolicy(moduleId);
  const model = snapshot?.moduleModels[moduleId];
  if (!snapshot || snapshot.status !== 'ACTIVE' || !model || model.features.length === 0) {
    return {
      moduleId,
      evidenceStrength: 0,
      confidence: 0,
      matchedFeatures: [],
      runtimeInfluenceCap: policy.maxRuntimeInfluence,
      snapshotVersion: snapshot?.snapshotVersion ?? null,
    };
  }

  const present = extractAdaptiveFeatures(text, 3);
  const matches: AdaptiveFeatureMatch[] = model.features
    .filter((feature) => present.has(feature.feature))
    .map((feature) => ({
      feature: feature.feature,
      label: feature.label,
      strength: clamp(feature.logOdds / 4, -1, 1),
      confidence: feature.confidence,
    }))
    .sort((a, b) => Math.abs(b.strength * b.confidence) - Math.abs(a.strength * a.confidence))
    .slice(0, 24);

  if (matches.length === 0) {
    return {
      moduleId,
      evidenceStrength: 0,
      confidence: 0,
      matchedFeatures: [],
      runtimeInfluenceCap: policy.maxRuntimeInfluence,
      snapshotVersion: snapshot.snapshotVersion,
    };
  }

  const denominator = matches.reduce((sum, match) => sum + match.confidence, 0);
  const evidenceStrength = denominator > 0
    ? matches.reduce((sum, match) => sum + match.strength * match.confidence, 0) / denominator
    : 0;
  const confidence = 1 - matches.reduce(
    (product, match) => product * (1 - clamp(match.confidence, 0, 1)),
    1,
  );

  return {
    moduleId,
    evidenceStrength: clamp(evidenceStrength, -1, 1),
    confidence: clamp(confidence, 0, 1),
    matchedFeatures: matches,
    runtimeInfluenceCap: policy.maxRuntimeInfluence,
    snapshotVersion: snapshot.snapshotVersion,
  };
}

/**
 * Mechanizm jest celowo ograniczony. Adaptive evidence nie może sam ustalić
 * wyniku modułu ani przebić hard capów. Zwraca tylko niewielką korektę sygnału,
 * którą scorer danego DXX może jawnie zaakceptować i opisać w Score Ledgerze.
 */
export function boundedAdaptiveAdjustment(signal: AdaptiveRuntimeSignal): number {
  return clamp(
    signal.evidenceStrength * signal.confidence * signal.runtimeInfluenceCap,
    -signal.runtimeInfluenceCap,
    signal.runtimeInfluenceCap,
  );
}
