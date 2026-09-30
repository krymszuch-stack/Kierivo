import type { AtsCheckResult } from '../../types';
import type { CanonicalAtsScore } from '../../lib/canonicalAts';

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
      { label: 'Umiejętności wymagane w ofercie', value: canonicalResult.components.skills ?? undefined },
      { label: 'Staż i świeżość dopasowań', value: canonicalResult.components.experience ?? undefined },
      { label: 'Struktura dokumentu', value: canonicalResult.components.structure ?? undefined },
      { label: 'Wymogi formalne', value: canonicalResult.components.formal ?? undefined },
    ];
  }

  return [
    { label: 'Kompetencje Twarde & Technologie', value: result.layer2Nlp?.hardSkillsCoverage ?? result.keywordCoverageScore },
    { label: 'Wymogi Formalne & Wykształcenie', value: result.layer2Nlp?.formalReqsCoverage },
    { label: 'Świeżość Umiejętności (Recency Bias)', value: result.layer3Scoring?.recencyScore },
    { label: 'Dopasowanie Tytułu Stanowiska (Title Density)', value: result.layer3Scoring?.titleMatchScore },
  ];
}
