import type {
  ConfidenceBreakdown,
  Evidence,
  EvidenceProvenance,
  MissingEvidence,
} from './contracts';

export interface ConfidenceWeights {
  coverage: number;
  provenance: number;
  extraction: number;
  sample: number;
}

export interface ConfidenceInput {
  expectedEvidenceWeight: number;
  fulfilledEvidenceWeight: number;
  provenanceReliability: number;
  extractionQuality: number;
  independentEvidenceCount: number;
  sampleScaleK: number;
  weights?: ConfidenceWeights;
}

export const DEFAULT_CONFIDENCE_WEIGHTS: ConfidenceWeights = {
  coverage: 0.40,
  provenance: 0.25,
  extraction: 0.20,
  sample: 0.15,
};

/** Priory startowe. CALIBRATION_REQUIRED zgodnie z D07. */
export const DEFAULT_PROVENANCE_RELIABILITY: Record<EvidenceProvenance, number> = {
  EXTERNALLY_VERIFIED: 1.00,
  CROSS_SOURCE_CONSISTENT: 0.90,
  USER_ASSERTED_CANONICAL: 0.75,
  EXPLICIT_DOCUMENT_FACT: 0.70,
  DERIVED_DETERMINISTIC: 0.70,
  INFERRED_HEURISTIC: 0.45,
  CONTRADICTION: 0.30,
  ADVERSARIAL_SIGNAL: 0.70,
};

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function normalizeWeights(weights: ConfidenceWeights): ConfidenceWeights {
  const positive = {
    coverage: Math.max(0, weights.coverage),
    provenance: Math.max(0, weights.provenance),
    extraction: Math.max(0, weights.extraction),
    sample: Math.max(0, weights.sample),
  };
  const sum = positive.coverage + positive.provenance + positive.extraction + positive.sample;
  if (sum <= Number.EPSILON) throw new Error('Wagi confidence nie mogą sumować się do zera.');
  return {
    coverage: positive.coverage / sum,
    provenance: positive.provenance / sum,
    extraction: positive.extraction / sum,
    sample: positive.sample / sum,
  };
}

export function computeAuditConfidence(input: ConfidenceInput): ConfidenceBreakdown {
  const expected = Math.max(0, input.expectedEvidenceWeight);
  const fulfilled = Math.max(0, input.fulfilledEvidenceWeight);
  const coverage = expected > 0 ? clamp01(fulfilled / expected) : 0;
  const provenance = clamp01(input.provenanceReliability);
  const extraction = clamp01(input.extractionQuality);
  const nEff = Math.max(0, input.independentEvidenceCount);
  const k = Math.max(Number.EPSILON, input.sampleScaleK);
  const sample = clamp01(1 - Math.exp(-nEff / k));
  const weights = normalizeWeights(input.weights ?? DEFAULT_CONFIDENCE_WEIGHTS);

  const combined =
    Math.pow(coverage, weights.coverage) *
    Math.pow(provenance, weights.provenance) *
    Math.pow(extraction, weights.extraction) *
    Math.pow(sample, weights.sample);

  return { coverage, provenance, extraction, sample, combined: clamp01(combined) };
}

function weightedMean(values: Array<{ value: number; weight: number }>): number {
  const totalWeight = values.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (totalWeight <= Number.EPSILON) return 0;
  return values.reduce(
    (sum, item) => sum + clamp01(item.value) * Math.max(0, item.weight),
    0,
  ) / totalWeight;
}

/**
 * Liczy n_eff po grupach korelacji, a nie po liczbie stanowisk czy długości CV.
 * Dowody o tym samym correlationKey dają najwyżej jeden pełny atom.
 */
export function estimateEffectiveIndependentSampleSize(evidence: readonly Evidence[]): number {
  const groups = new Map<string, number>();
  for (const atom of evidence) {
    const key = atom.correlationKey ?? atom.id;
    const importance = clamp01(atom.evidenceImportance ?? 1);
    groups.set(key, Math.max(groups.get(key) ?? 0, importance));
  }
  return [...groups.values()].reduce((sum, value) => sum + value, 0);
}

export interface DeriveConfidenceInputOptions {
  expectedEvidenceWeight: number;
  evidence: readonly Evidence[];
  missingEvidence?: readonly MissingEvidence[];
  sampleScaleK: number;
  provenanceReliability?: Partial<Record<EvidenceProvenance, number>>;
  weights?: ConfidenceWeights;
}

export function deriveConfidenceFromEvidence(
  options: DeriveConfidenceInputOptions,
): ConfidenceBreakdown {
  const priors = { ...DEFAULT_PROVENANCE_RELIABILITY, ...options.provenanceReliability };
  const fulfilledEvidenceWeight = options.evidence.reduce(
    (sum, atom) => sum + Math.max(0, atom.evidenceImportance ?? 1),
    0,
  );
  const missingExpectedWeight = (options.missingEvidence ?? []).reduce(
    (sum, item) => sum + Math.max(0, item.expectedEvidenceWeight),
    0,
  );
  const expected = Math.max(
    options.expectedEvidenceWeight,
    fulfilledEvidenceWeight + missingExpectedWeight,
  );

  const provenanceReliability = weightedMean(
    options.evidence.map((atom) => ({
      value: priors[atom.provenance] ?? 0,
      weight: atom.evidenceImportance ?? 1,
    })),
  );
  const extractionQuality = weightedMean(
    options.evidence.map((atom) => ({
      value: atom.extractionConfidence,
      weight: atom.evidenceImportance ?? 1,
    })),
  );

  return computeAuditConfidence({
    expectedEvidenceWeight: expected,
    fulfilledEvidenceWeight,
    provenanceReliability,
    extractionQuality,
    independentEvidenceCount: estimateEffectiveIndependentSampleSize(options.evidence),
    sampleScaleK: options.sampleScaleK,
    weights: options.weights,
  });
}

export function confidenceBand(confidence: number): 'INSUFFICIENT' | 'LOW' | 'STANDARD' | 'HIGH' {
  const value = clamp01(confidence);
  if (value < 0.35) return 'INSUFFICIENT';
  if (value < 0.55) return 'LOW';
  if (value < 0.80) return 'STANDARD';
  return 'HIGH';
}
