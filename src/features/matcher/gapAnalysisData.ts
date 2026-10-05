import type { AtsCheckResult } from '../../types';
import type { CanonicalAtsScore } from '../../lib/canonicalAts';
import { normalizePercentageEvidence } from '../../lib/percentageEvidence';

export interface GapMetric {
  label: string;
  value: number | undefined;
}

/** W bieżącym raporcie używa kanonu; starsze migawki mają wyłącznie diagnostykę legacy. */
export function buildGapMetrics(
  result: AtsCheckResult,
  canonicalResult?: CanonicalAtsScore,
): GapMetric[] {
  if (canonicalResult) {
    return [
      { label: 'Umiejętności wymagane w ofercie', value: normalizePercentageEvidence(canonicalResult.components.skills) ?? undefined },
      { label: 'Staż i świeżość dopasowań', value: normalizePercentageEvidence(canonicalResult.components.experience) ?? undefined },
      { label: 'Struktura dokumentu', value: normalizePercentageEvidence(canonicalResult.components.structure) ?? undefined },
      { label: 'Wymogi formalne', value: normalizePercentageEvidence(canonicalResult.components.formal) ?? undefined },
    ];
  }

  return [
    { label: 'Kompetencje Twarde & Technologie', value: normalizePercentageEvidence(result.layer2Nlp?.hardSkillsCoverage) ?? undefined },
    { label: 'Wymogi Formalne & Wykształcenie', value: normalizePercentageEvidence(result.layer2Nlp?.formalReqsCoverage) ?? undefined },
    { label: 'Świeżość Umiejętności (Recency Bias)', value: normalizePercentageEvidence(result.layer3Scoring?.recencyScore) ?? undefined },
    { label: 'Dopasowanie Tytułu Stanowiska (Title Density)', value: normalizePercentageEvidence(result.layer3Scoring?.titleMatchScore) ?? undefined },
  ];
}
