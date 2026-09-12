import type { AdaptiveCorpusDocument } from './types';

export const ADAPTIVE_SOURCE_TRUST = {
  GOLDEN: 1,
  ACADEMIC: 0.85,
  SYNTHETIC: 0.75,
  REAL_ANONYMIZED: 0.5,
} as const;

export type AdaptiveLabelOrigin = 'HUMAN_GOLD' | 'INJECTED_SYNTHETIC' | 'LEGACY_ENGINE' | 'UNLABELED_DISCOVERY';

export interface AdaptiveTrainingCase extends AdaptiveCorpusDocument {
  labelOrigin: AdaptiveLabelOrigin;
}

export interface AdaptiveTrainingPartition {
  training: AdaptiveTrainingCase[];
  holdout: AdaptiveTrainingCase[];
  discoveryOnly: AdaptiveTrainingCase[];
}

function stableBucket(id: string): number {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function sourceWeight(document: AdaptiveCorpusDocument): number {
  return ADAPTIVE_SOURCE_TRUST[document.sourceKind] * (document.weight ?? 1);
}

/**
 * Labels wyprodukowane przez stary silnik nie mogą służyć do uczenia jego
 * następcy, bo powstałaby pętla samopotwierdzenia. Realne CV bez ręcznego gold
 * labela są używane do odkrywania słownictwa i edge-case'ów, ale nie do fitu
 * parametrów score.
 */
export function partitionAdaptiveTrainingCases(
  cases: readonly AdaptiveTrainingCase[],
  holdoutPercent = 20,
): AdaptiveTrainingPartition {
  const training: AdaptiveTrainingCase[] = [];
  const holdout: AdaptiveTrainingCase[] = [];
  const discoveryOnly: AdaptiveTrainingCase[] = [];

  for (const item of cases) {
    if (item.labelOrigin === 'LEGACY_ENGINE' || item.labelOrigin === 'UNLABELED_DISCOVERY') {
      discoveryOnly.push(item);
      continue;
    }
    if (stableBucket(item.id) < holdoutPercent) holdout.push(item);
    else training.push(item);
  }
  return { training, holdout, discoveryOnly };
}
