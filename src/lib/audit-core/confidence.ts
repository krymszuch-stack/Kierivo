import type { ConfidenceBreakdown } from './contracts';

export interface ConfidenceInput {
  expectedEvidenceWeight: number;
  fulfilledEvidenceWeight: number;
  provenanceReliability: number;
  extractionQuality: number;
  independentEvidenceCount: number;
  sampleScaleK: number;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function computeAuditConfidence(input: ConfidenceInput): ConfidenceBreakdown {
  const expected = Math.max(0, input.expectedEvidenceWeight);
  const fulfilled = Math.max(0, input.fulfilledEvidenceWeight);

  const coverage = expected > 0 ? clamp01(fulfilled / expected) : 0;
  const provenance = clamp01(input.provenanceReliability);
  const extraction = clamp01(input.extractionQuality);

  const nEff = Math.max(0, input.independentEvidenceCount);
  const k = Math.max(Number.EPSILON, input.sampleScaleK);
  const sample = clamp01(1 - Math.exp(-nEff / k));

  const combined =
    Math.pow(coverage, 0.40) *
    Math.pow(provenance, 0.25) *
    Math.pow(extraction, 0.20) *
    Math.pow(sample, 0.15);

  return {
    coverage,
    provenance,
    extraction,
    sample,
    combined: clamp01(combined),
  };
}
