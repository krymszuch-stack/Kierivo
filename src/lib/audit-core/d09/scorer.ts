import { deriveConfidenceFromEvidence } from '../confidence';
import type {
  Evidence,
  HardCap,
  MissingEvidence,
  Recommendation,
  ScoreComponent,
} from '../contracts';
import { buildScoreLedger } from '../ledger';
import { resolveD09SemanticRelation } from './ontology';
import type {
  D09AlignmentDiagnostics,
  D09AuditResult,
  D09CandidateEvidence,
  D09JobRequirement,
  D09RequirementMatch,
  D09ScoringInput,
} from './types';

export const D09_MODULE_ID = 'MOD_JOB_ALIGNMENT';
export const D09_MODULE_NAME = 'Dopasowanie do oferty';

export const D09_CONFIG = {
  depthFloor: 0.50,
  geometricEpsilon: 0.05,
  geometricShare: 0.45,
  niceWeightWhenApplicable: 0.20,
  niceExponent: 2.40,
  niceGateStart: 0.45,
  niceGateFull: 0.85,
  sourceCompletenessForKnownAbsence: 0.75,
  evidenceAcceptanceConfidence: 0.40,
  maxUncertaintyWidthForScore: 30,
  maxUnknownMustWeightShareForScore: 0.30,
  parserMinimumConfidence: 0.35,
  coreMustMissingThreshold: 0.20,
  coreMustCap: 35,
  mustCurve: [
    [0.00, 0.00],
    [0.25, 0.08],
    [0.40, 0.28],
    [0.55, 0.60],
    [0.70, 0.77],
    [0.80, 0.90],
    [0.90, 0.96],
    [1.00, 1.00],
  ] as ReadonlyArray<readonly [number, number]>,
} as const;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const clamp100 = (value: number): number => Math.min(100, Math.max(0, value));

function weightedMean(items: Array<{ value: number; weight: number }>): number {
  const denominator = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (denominator <= Number.EPSILON) return 0;
  return items.reduce(
    (sum, item) => sum + clamp01(item.value) * Math.max(0, item.weight),
    0,
  ) / denominator;
}

function normalizedWeightedGeometric(
  items: Array<{ value: number; weight: number }>,
  epsilon = D09_CONFIG.geometricEpsilon,
): number {
  const denominator = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (denominator <= Number.EPSILON) return 0;
  const eps = Math.min(0.25, Math.max(1e-6, epsilon));
  const logMean = items.reduce((sum, item) => {
    const transformed = eps + (1 - eps) * clamp01(item.value);
    return sum + Math.max(0, item.weight) * Math.log(transformed);
  }, 0) / denominator;
  return clamp01((Math.exp(logMean) - eps) / (1 - eps));
}

function monotoneLinearCurve(value: number, anchors = D09_CONFIG.mustCurve): number {
  const x = clamp01(value);
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let index = 1; index < anchors.length; index += 1) {
    const [x1, y1] = anchors[index - 1];
    const [x2, y2] = anchors[index];
    if (x <= x2) {
      const t = (x - x1) / Math.max(Number.EPSILON, x2 - x1);
      return clamp01(y1 + t * (y2 - y1));
    }
  }
  return anchors[anchors.length - 1][1];
}

function smoothstepGate(value: number): number {
  const a = D09_CONFIG.niceGateStart;
  const b = D09_CONFIG.niceGateFull;
  const t = clamp01((value - a) / Math.max(Number.EPSILON, b - a));
  return t * t * (3 - 2 * t);
}

function matchRequirement(
  requirement: D09JobRequirement,
  evidencePool: readonly D09CandidateEvidence[],
  sourceMode: D09ScoringInput['sourceMode'],
  sourceCompletenessConfidence: number,
): D09RequirementMatch {
  if (requirement.kind === 'FORMAL_REFERENCE') {
    return {
      requirement,
      status: 'DEFERRED_FORMAL',
      matchType: 'NONE',
      semanticStrength: 0,
      evidenceDepth: 0,
      fulfillment: 0,
      bestEvidenceId: null,
      bestEvidenceSource: null,
    };
  }

  let best: {
    evidence: D09CandidateEvidence;
    matchType: D09RequirementMatch['matchType'];
    semanticStrength: number;
    fulfillment: number;
  } | null = null;

  for (const evidence of evidencePool) {
    if (evidence.extractionConfidence < D09_CONFIG.evidenceAcceptanceConfidence) continue;
    const relation = resolveD09SemanticRelation(requirement.canonicalId, evidence.canonicalId);
    const fulfillment = relation.strength * (
      D09_CONFIG.depthFloor + (1 - D09_CONFIG.depthFloor) * clamp01(evidence.evidenceDepth)
    );
    if (!best || fulfillment > best.fulfillment) {
      best = {
        evidence,
        matchType: relation.matchType,
        semanticStrength: relation.strength,
        fulfillment,
      };
    }
  }

  if (best && best.fulfillment > 0) {
    return {
      requirement,
      status: best.fulfillment >= 0.85 ? 'CONFIRMED' : 'PARTIAL',
      matchType: best.matchType,
      semanticStrength: best.semanticStrength,
      evidenceDepth: best.evidence.evidenceDepth,
      fulfillment: clamp01(best.fulfillment),
      bestEvidenceId: best.evidence.evidence.id,
      bestEvidenceSource: best.evidence.sourceLabel,
    };
  }

  const absenceIsKnown = sourceMode === 'VAULT' ||
    sourceCompletenessConfidence >= D09_CONFIG.sourceCompletenessForKnownAbsence;
  return {
    requirement,
    status: absenceIsKnown ? 'NOT_FOUND' : 'UNKNOWN',
    matchType: best?.matchType ?? 'NONE',
    semanticStrength: best?.semanticStrength ?? 0,
    evidenceDepth: best?.evidence.evidenceDepth ?? 0,
    fulfillment: 0,
    bestEvidenceId: best?.evidence.evidence.id ?? null,
    bestEvidenceSource: best?.evidence.sourceLabel ?? null,
  };
}

interface ScenarioResult {
  score: number;
  arithmeticMust: number;
  geometricMust: number;
  asymmetricMust: number;
  niceCoverage: number | null;
  mustCurveValue: number;
  niceCurveValue: number | null;
  niceGate: number | null;
}

function computeScenario(
  matches: readonly D09RequirementMatch[],
  unknownValue: number,
  cap: number | null,
): ScenarioResult {
  const scoreableMust = matches.filter((match) =>
    match.requirement.kind !== 'FORMAL_REFERENCE' &&
    (match.requirement.priority === 'MUST' || match.requirement.priority === 'CORE_MUST'));
  const scoreableNice = matches.filter((match) =>
    match.requirement.kind !== 'FORMAL_REFERENCE' && match.requirement.priority === 'NICE');

  const values = (items: readonly D09RequirementMatch[]) => items.map((match) => ({
    value: match.status === 'UNKNOWN' ? unknownValue : match.fulfillment,
    weight: match.requirement.weight,
  }));

  const mustValues = values(scoreableMust);
  const arithmeticMust = weightedMean(mustValues);
  const geometricMust = normalizedWeightedGeometric(mustValues);
  const asymmetricMust = clamp01(
    (1 - D09_CONFIG.geometricShare) * arithmeticMust +
    D09_CONFIG.geometricShare * geometricMust,
  );
  const mustCurveValue = monotoneLinearCurve(asymmetricMust);

  let rawScore: number;
  let niceCoverage: number | null = null;
  let niceCurveValue: number | null = null;
  let niceGate: number | null = null;

  if (scoreableNice.length === 0) {
    rawScore = 100 * mustCurveValue;
  } else {
    niceCoverage = weightedMean(values(scoreableNice));
    niceCurveValue = Math.pow(clamp01(niceCoverage), D09_CONFIG.niceExponent);
    niceGate = smoothstepGate(asymmetricMust);
    const niceWeight = D09_CONFIG.niceWeightWhenApplicable;
    rawScore = 100 * (
      (1 - niceWeight) * mustCurveValue +
      niceWeight * niceGate * niceCurveValue
    );
  }

  const score = cap === null ? rawScore : Math.min(rawScore, cap);
  return {
    score: clamp100(score),
    arithmeticMust,
    geometricMust,
    asymmetricMust,
    niceCoverage,
    mustCurveValue,
    niceCurveValue,
    niceGate,
  };
}

function coreMustHardCaps(matches: readonly D09RequirementMatch[]): HardCap[] {
  const missingCore = matches.filter((match) =>
    match.requirement.priority === 'CORE_MUST' &&
    match.requirement.kind !== 'FORMAL_REFERENCE' &&
    match.status === 'NOT_FOUND' &&
    match.fulfillment < D09_CONFIG.coreMustMissingThreshold,
  );
  if (missingCore.length === 0) return [];
  return [{
    id: 'HC_D09_CORE_MUST_MISSING',
    ruleCode: 'HC_D09_CORE_MUST_MISSING',
    scope: 'MODULE',
    targetId: D09_MODULE_ID,
    capLimit: D09_CONFIG.coreMustCap,
    triggered: true,
    reason: `Brak potwierdzonego dowodu dla ${missingCore.length} jawnie krytycznego wymagania CORE MUST.`,
    evidenceIds: missingCore.flatMap((match) => match.requirement.evidenceIds),
  }];
}

function missingMeasurementEvidence(matches: readonly D09RequirementMatch[]): MissingEvidence[] {
  return matches
    .filter((match) => match.status === 'UNKNOWN')
    .map((match) => ({
      id: `MISS_D09_${match.requirement.id}`,
      requirementCode: 'D09_CANDIDATE_EVIDENCE_UNCERTAIN',
      targetScope: match.requirement.id,
      description: `Nie da się wiarygodnie ustalić, czy CV zawiera dowód dla: ${match.requirement.label}.`,
      severity: match.requirement.priority === 'CORE_MUST' ? 'HIGH' : 'MEDIUM',
      expectedEvidenceWeight: match.requirement.weight,
      suggestedAction: 'Dostarcz pełniejszy dokument albo użyj danych Master Vault zamiast niepewnej ekstrakcji.',
    }));
}

function buildRecommendations(matches: readonly D09RequirementMatch[]): Recommendation[] {
  return matches
    .filter((match) => match.status === 'NOT_FOUND' && match.requirement.kind !== 'FORMAL_REFERENCE')
    .slice(0, 8)
    .map((match, index) => ({
      id: `REC_D09_${index}_${match.requirement.canonicalId}`,
      targetModuleId: D09_MODULE_ID,
      targetSection: 'JOB_ALIGNMENT',
      priority: match.requirement.priority === 'CORE_MUST' ? 'CRITICAL' :
        match.requirement.priority === 'MUST' ? 'HIGH' : 'MEDIUM',
      issue: `Brak dowodu spełnienia wymagania: ${match.requirement.label}.`,
      suggestedAction: 'Jeżeli faktycznie posiadasz tę kompetencję, dodaj prawdziwy dowód w Master Vault lub doświadczeniu. Nie kopiuj frazy z JD bez pokrycia.',
    }));
}

function collectScoreEvidence(
  matches: readonly D09RequirementMatch[],
  priority: 'MUST' | 'NICE',
): string[] {
  const ids = new Set<string>();
  for (const match of matches) {
    const isMust = match.requirement.priority === 'MUST' || match.requirement.priority === 'CORE_MUST';
    if ((priority === 'MUST' && !isMust) || (priority === 'NICE' && match.requirement.priority !== 'NICE')) continue;
    match.requirement.evidenceIds.forEach((id) => ids.add(id));
    if (match.bestEvidenceId) ids.add(match.bestEvidenceId);
  }
  return [...ids];
}

function nullDiagnostics(matches: D09RequirementMatch[] = []): D09AlignmentDiagnostics {
  return {
    arithmeticMust: null,
    geometricMust: null,
    asymmetricMustIndex: null,
    niceCoverage: null,
    mustCurveValue: null,
    niceCurveValue: null,
    niceGate: null,
    requirementMatches: matches,
    deferredFormalRequirements: matches
      .filter((match) => match.status === 'DEFERRED_FORMAL')
      .map((match) => match.requirement),
    uncertainty: { low: 0, high: 100, width: 100, unknownMustWeightShare: 1 },
  };
}

export function scoreD09JobAlignment(input: D09ScoringInput): D09AuditResult {
  if (input.documentClass === 'NON_CV') {
    const confidenceBreakdown = deriveConfidenceFromEvidence({
      expectedEvidenceWeight: 1,
      evidence: input.extraction.evidence,
      sampleScaleK: 3,
    });
    return {
      moduleId: D09_MODULE_ID,
      moduleName: D09_MODULE_NAME,
      domainId: 'JOB_FIT',
      score: null,
      confidence: confidenceBreakdown.combined,
      confidenceBreakdown,
      applicability: 'NOT_APPLICABLE',
      evidence: input.extraction.evidence,
      missingEvidence: [],
      breakdown: [],
      penalties: [],
      hardCaps: [],
      ledger: null,
      verdictCode: 'D09_NON_CV_INPUT',
      verdict: 'Wejście nie zostało sklasyfikowane jako CV, więc Job Alignment nie ma zastosowania.',
      recommendations: [],
      alignment: nullDiagnostics(),
    };
  }

  const scoreableRequirements = input.extraction.requirements.filter((requirement) =>
    requirement.kind !== 'FORMAL_REFERENCE');
  if (scoreableRequirements.length === 0) {
    const insufficient = input.extraction.requirementLikeLines > 0 ||
      input.extraction.parserConfidence < D09_CONFIG.parserMinimumConfidence;
    const confidenceBreakdown = deriveConfidenceFromEvidence({
      expectedEvidenceWeight: Math.max(1, input.extraction.requirementLikeLines),
      evidence: input.extraction.evidence,
      sampleScaleK: 3,
    });
    return {
      moduleId: D09_MODULE_ID,
      moduleName: D09_MODULE_NAME,
      domainId: 'JOB_FIT',
      score: null,
      confidence: confidenceBreakdown.combined,
      confidenceBreakdown,
      applicability: insufficient ? 'INSUFFICIENT_DATA' : 'NOT_APPLICABLE',
      evidence: input.extraction.evidence,
      missingEvidence: [],
      breakdown: [],
      penalties: [],
      hardCaps: [],
      ledger: null,
      verdictCode: insufficient ? 'D09_REQUIREMENTS_UNRESOLVED' : 'D09_NO_SCOREABLE_REQUIREMENTS',
      verdict: insufficient
        ? 'Parser nie ma wystarczających dowodów, aby wiarygodnie zbudować listę wymagań JD.'
        : 'Ogłoszenie nie zawiera wymagań należących do domeny D09.',
      recommendations: [],
      alignment: nullDiagnostics(),
    };
  }

  const matches = input.extraction.requirements.map((requirement) => matchRequirement(
    requirement,
    input.candidateEvidence,
    input.sourceMode,
    input.sourceCompletenessConfidence,
  ));
  const hardCaps = coreMustHardCaps(matches);
  const cap = hardCaps.length > 0 ? Math.min(...hardCaps.map((item) => item.capLimit)) : null;

  const lower = computeScenario(matches, 0, cap);
  const midpoint = computeScenario(matches, 0.5, cap);
  const upper = computeScenario(matches, 1, cap);

  const mustMatches = matches.filter((match) =>
    match.requirement.kind !== 'FORMAL_REFERENCE' &&
    (match.requirement.priority === 'MUST' || match.requirement.priority === 'CORE_MUST'));
  const unknownMustWeight = mustMatches
    .filter((match) => match.status === 'UNKNOWN')
    .reduce((sum, match) => sum + match.requirement.weight, 0);
  const mustWeight = mustMatches.reduce((sum, match) => sum + match.requirement.weight, 0);
  const unknownMustWeightShare = mustWeight > 0 ? unknownMustWeight / mustWeight : 0;
  const uncertainty = {
    low: lower.score,
    high: upper.score,
    width: Math.max(0, upper.score - lower.score),
    unknownMustWeightShare,
  };

  const missingEvidence = missingMeasurementEvidence(matches);
  const matchedCandidateEvidenceIds = new Set(
    matches.map((match) => match.bestEvidenceId).filter((id): id is string => Boolean(id)),
  );
  const candidateEvidenceAtoms = input.candidateEvidence
    .filter((candidate) => matchedCandidateEvidenceIds.has(candidate.evidence.id))
    .map((candidate) => candidate.evidence);
  const allEvidence: Evidence[] = [...input.extraction.evidence, ...candidateEvidenceAtoms];
  const expectedEvidenceWeight = scoreableRequirements.reduce((sum, requirement) => sum + requirement.weight, 0);
  const confidenceBreakdown = deriveConfidenceFromEvidence({
    expectedEvidenceWeight,
    evidence: allEvidence,
    missingEvidence,
    sampleScaleK: 5,
  });

  const tooUncertain = uncertainty.width > D09_CONFIG.maxUncertaintyWidthForScore ||
    unknownMustWeightShare > D09_CONFIG.maxUnknownMustWeightShareForScore ||
    input.extraction.parserConfidence < D09_CONFIG.parserMinimumConfidence;

  if (tooUncertain) {
    return {
      moduleId: D09_MODULE_ID,
      moduleName: D09_MODULE_NAME,
      domainId: 'JOB_FIT',
      score: null,
      confidence: confidenceBreakdown.combined,
      confidenceBreakdown,
      applicability: 'INSUFFICIENT_DATA',
      evidence: allEvidence,
      missingEvidence,
      breakdown: [],
      penalties: [],
      hardCaps,
      ledger: null,
      verdictCode: 'D09_ALIGNMENT_UNCERTAIN',
      verdict: `Zakres możliwego wyniku ${uncertainty.low.toFixed(1)}–${uncertainty.high.toFixed(1)} jest zbyt szeroki, aby publikować pojedynczą liczbę.`,
      recommendations: buildRecommendations(matches),
      alignment: {
        arithmeticMust: midpoint.arithmeticMust,
        geometricMust: midpoint.geometricMust,
        asymmetricMustIndex: midpoint.asymmetricMust,
        niceCoverage: midpoint.niceCoverage,
        mustCurveValue: midpoint.mustCurveValue,
        niceCurveValue: midpoint.niceCurveValue,
        niceGate: midpoint.niceGate,
        requirementMatches: matches,
        deferredFormalRequirements: matches.filter((match) => match.status === 'DEFERRED_FORMAL').map((match) => match.requirement),
        uncertainty,
      },
    };
  }

  const niceExists = matches.some((match) =>
    match.requirement.kind !== 'FORMAL_REFERENCE' && match.requirement.priority === 'NICE');
  const mustMaximum = niceExists ? 80 : 100;
  const niceMaximum = niceExists ? 20 : 0;
  const mustContribution = mustMaximum * midpoint.mustCurveValue;
  const niceContribution = niceExists
    ? niceMaximum * (midpoint.niceGate ?? 0) * (midpoint.niceCurveValue ?? 0)
    : 0;

  const breakdown: ScoreComponent[] = [{
    id: 'MUST_ALIGNMENT',
    name: 'Asymetryczne dopasowanie wymagań MUST',
    rawValue: midpoint.asymmetricMust,
    normalizedValue: midpoint.mustCurveValue,
    baseWeight: niceExists ? 0.80 : 1,
    effectiveWeight: niceExists ? 0.80 : 1,
    contribution: mustContribution,
    maxContribution: mustMaximum,
    unrealizedPotential: mustMaximum - mustContribution,
    evidenceIds: collectScoreEvidence(matches, 'MUST'),
    signalFamily: 'SKILL_PRESENCE',
  }];

  if (niceExists) {
    breakdown.push({
      id: 'NICE_ALIGNMENT',
      name: 'Dodatkowe dopasowanie NICE po bramce MUST',
      rawValue: midpoint.niceCoverage ?? 0,
      normalizedValue: (midpoint.niceGate ?? 0) * (midpoint.niceCurveValue ?? 0),
      baseWeight: 0.20,
      effectiveWeight: 0.20,
      contribution: niceContribution,
      maxContribution: niceMaximum,
      unrealizedPotential: niceMaximum - niceContribution,
      evidenceIds: collectScoreEvidence(matches, 'NICE'),
      signalFamily: 'SKILL_PRESENCE',
    });
  }

  const ledger = buildScoreLedger({
    moduleId: D09_MODULE_ID,
    components: breakdown,
    penalties: [],
    hardCaps,
    confidenceBreakdown,
  });
  const score = ledger.finalScore;
  const verdictCode = score === null ? 'D09_ALIGNMENT_UNAVAILABLE' :
    score >= 85 ? 'D09_ALIGNMENT_EXCEPTIONAL' :
    score >= 75 ? 'D09_ALIGNMENT_STRONG' :
    score >= 60 ? 'D09_ALIGNMENT_SOLID' :
    score >= 40 ? 'D09_ALIGNMENT_PARTIAL' : 'D09_ALIGNMENT_WEAK';

  return {
    moduleId: D09_MODULE_ID,
    moduleName: D09_MODULE_NAME,
    domainId: 'JOB_FIT',
    score,
    confidence: confidenceBreakdown.combined,
    confidenceBreakdown,
    applicability: missingEvidence.length > 0 ? 'PARTIALLY_APPLICABLE' : 'APPLICABLE',
    evidence: allEvidence,
    missingEvidence,
    breakdown,
    penalties: [],
    hardCaps,
    ledger,
    verdictCode,
    verdict: score === null
      ? 'Nie udało się wyznaczyć stabilnego wyniku dopasowania.'
      : `CVelocity Job Alignment: ${score.toFixed(1)}/100. To wewnętrzny audyt zgodności z wymaganiami JD, nie prawdopodobieństwo zatrudnienia.`,
    recommendations: buildRecommendations(matches),
    alignment: {
      arithmeticMust: midpoint.arithmeticMust,
      geometricMust: midpoint.geometricMust,
      asymmetricMustIndex: midpoint.asymmetricMust,
      niceCoverage: midpoint.niceCoverage,
      mustCurveValue: midpoint.mustCurveValue,
      niceCurveValue: midpoint.niceCurveValue,
      niceGate: midpoint.niceGate,
      requirementMatches: matches,
      deferredFormalRequirements: matches.filter((match) => match.status === 'DEFERRED_FORMAL').map((match) => match.requirement),
      uncertainty,
    },
  };
}
