import { adaptiveDocumentFingerprint, extractAdaptiveFeatures } from './tokenizer';
import type {
  AdaptiveCorpusDocument,
  AdaptiveLexemeFeature,
  AdaptiveModuleModel,
  AdaptiveModulePolicy,
} from './types';

interface LearnOptions {
  alpha?: number;
  maxNgram?: 1 | 2 | 3;
  maxFeaturesPerLabel?: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function ngramSize(feature: string): 1 | 2 | 3 {
  if (feature.startsWith('__meta_')) return 1;
  const words = feature.trim().split(/\s+/).length;
  return Math.min(3, Math.max(1, words)) as 1 | 2 | 3;
}

export function deduplicateAdaptiveCorpus(documents: readonly AdaptiveCorpusDocument[]): AdaptiveCorpusDocument[] {
  const byFingerprint = new Map<string, AdaptiveCorpusDocument>();
  for (const document of documents) {
    const fingerprint = adaptiveDocumentFingerprint(document.text);
    const current = byFingerprint.get(fingerprint);
    if (!current) {
      byFingerprint.set(fingerprint, document);
      continue;
    }
    byFingerprint.set(fingerprint, {
      ...current,
      labels: [...new Set([...current.labels, ...document.labels])],
      weight: Math.max(current.weight ?? 1, document.weight ?? 1),
    });
  }
  return [...byFingerprint.values()];
}

function computeFeatureStats(input: {
  feature: string;
  label: string;
  positiveDocuments: number;
  negativeDocuments: number;
  supportPositive: number;
  supportNegative: number;
  alpha: number;
}): AdaptiveLexemeFeature {
  const {
    feature,
    label,
    positiveDocuments,
    negativeDocuments,
    supportPositive,
    supportNegative,
    alpha,
  } = input;

  const posAbsent = Math.max(0, positiveDocuments - supportPositive);
  const negAbsent = Math.max(0, negativeDocuments - supportNegative);
  const positiveRate = (supportPositive + alpha) / (positiveDocuments + 2 * alpha);
  const negativeRate = (supportNegative + alpha) / (negativeDocuments + 2 * alpha);
  const posOdds = (supportPositive + alpha) / (posAbsent + alpha);
  const negOdds = (supportNegative + alpha) / (negAbsent + alpha);
  const logOdds = Math.log(posOdds) - Math.log(negOdds);
  const variance =
    1 / (supportPositive + alpha) +
    1 / (posAbsent + alpha) +
    1 / (supportNegative + alpha) +
    1 / (negAbsent + alpha);
  const zScore = logOdds / Math.sqrt(Math.max(Number.EPSILON, variance));
  const lift = positiveRate / Math.max(1e-9, negativeRate);
  const support = supportPositive + supportNegative;
  const sampleConfidence = 1 - Math.exp(-support / 8);
  const effectConfidence = Math.min(1, Math.abs(zScore) / 4);
  const confidence = clamp01(sampleConfidence * effectConfidence);

  return {
    feature,
    ngramSize: ngramSize(feature),
    label,
    supportPositive,
    supportNegative,
    positiveDocuments,
    negativeDocuments,
    positiveRate,
    negativeRate,
    logOdds,
    zScore,
    lift,
    confidence,
    direction: logOdds >= 0 ? 'POSITIVE' : 'NEGATIVE',
  };
}

export function learnAdaptiveModuleModel(
  policy: AdaptiveModulePolicy,
  documents: readonly AdaptiveCorpusDocument[],
  modelVersion: string,
  options: LearnOptions = {},
): AdaptiveModuleModel {
  const deduplicated = deduplicateAdaptiveCorpus(documents);
  const alpha = options.alpha ?? 0.5;
  const maxNgram = options.maxNgram ?? 3;
  const maxFeaturesPerLabel = options.maxFeaturesPerLabel ?? 120;
  const featureSets = deduplicated.map((document) => extractAdaptiveFeatures(document.text, maxNgram));
  const learned: AdaptiveLexemeFeature[] = [];

  for (const label of policy.learnableLabels) {
    const positiveIndexes = deduplicated
      .map((document, index) => document.labels.includes(label) ? index : -1)
      .filter((index) => index >= 0);
    const negativeIndexes = deduplicated
      .map((document, index) => !document.labels.includes(label) ? index : -1)
      .filter((index) => index >= 0);

    if (positiveIndexes.length === 0 || negativeIndexes.length === 0) continue;

    const candidateFeatures = new Set<string>();
    for (const index of positiveIndexes) {
      for (const feature of featureSets[index]) candidateFeatures.add(feature);
    }

    const labelFeatures: AdaptiveLexemeFeature[] = [];
    for (const feature of candidateFeatures) {
      const supportPositive = positiveIndexes.reduce(
        (sum, index) => sum + (featureSets[index].has(feature) ? 1 : 0),
        0,
      );
      const supportNegative = negativeIndexes.reduce(
        (sum, index) => sum + (featureSets[index].has(feature) ? 1 : 0),
        0,
      );
      const stats = computeFeatureStats({
        feature,
        label,
        positiveDocuments: positiveIndexes.length,
        negativeDocuments: negativeIndexes.length,
        supportPositive,
        supportNegative,
        alpha,
      });
      const support = supportPositive + supportNegative;
      const strongPositive = stats.direction === 'POSITIVE' && stats.lift >= policy.minLift;
      const strongNegative = stats.direction === 'NEGATIVE' && (1 / Math.max(stats.lift, 1e-9)) >= policy.minLift;
      if (
        support >= policy.minDocumentSupport &&
        Math.abs(stats.zScore) >= policy.minAbsZScore &&
        (strongPositive || strongNegative)
      ) {
        labelFeatures.push(stats);
      }
    }

    labelFeatures
      .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore) || b.confidence - a.confidence)
      .slice(0, maxFeaturesPerLabel)
      .forEach((feature) => learned.push(feature));
  }

  return {
    moduleId: policy.moduleId,
    modelVersion,
    features: learned,
    sourceLabels: policy.learnableLabels,
    trainedDocuments: documents.length,
    effectiveDocuments: deduplicated.length,
  };
}
