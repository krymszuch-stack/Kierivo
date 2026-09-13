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
  niceWeightWhenMustExists: 0.20,
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
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= Number.EPSILON) return 0;
  return items.reduce(
    (sum, item) => sum + clamp01(item.value) * Math.max(0, item.weight),
    0,
  ) / total;
}

function weightedGeometric(items: Array<{ value: number; weight: number }>): number {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= Number.EPSILON) return 0;
  const eps = D09_CONFIG.geometricEpsilon;
  const logMean = items.reduce((sum, item) => {
    const transformed = eps + (1 - eps) * clamp01(item.value);
    return sum + Math.max(0, item.weight) * Math.log(transformed);
  }, 0) / total;
  return clamp01((Math.exp(logMean) - eps) / (1 - eps));
}

function monotoneCurve(value: number): number {
  const x = clamp01(value);
  const anchors = D09_CONFIG.mustCurve;
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i += 1) {
    const [x1, y1] = anchors[i - 1];
    const [x2, y2] = anchors[i];
    if (x <= x2) {
      const t = (x - x1) / Math.max(Number.EPSILON, x2 - x1);
      return clamp01(y1 + t * (y2 - y1));
    }
  }
  return anchors[anchors.length - 1][1];
}

function smoothstep(value: number): number {
  const t = clamp01(
    (value - D09_CONFIG.niceGateStart) /
      Math.max(Number.EPSILON, D09_CONFIG.niceGateFull - D09_CONFIG.niceGateStart),
  );
  return t * t * (3 - 2 * t);
}

function matchRequirement(
  requirement: D09JobRequirement,
  evidencePool: readonly D09CandidateEvidence[],
  input: Pick<D09ScoringInput, 'sourceMode' | 'sourceCompletenessConfidence'>,
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

  for (const candidate of evidencePool) {
    if (candidate.extractionConfidence < D09_CONFIG.evidenceAcceptanceConfidence) continue;
    const relation = resolveD09SemanticRelation(requirement.canonicalId, candidate.canonicalId);
    const fulfillment = relation.strength * (
      D09_CONFIG.depthFloor + (1 - D09_CONFIG.depthFloor) * clamp01(candidate.evidenceDepth)
    );
    if (!best || fulfillment > best.fulfillment) {
      best = { evidence: candidate, ...relation, fulfillment };
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

  const absenceKnown = input.sourceMode === 'VAULT' ||
    input.sourceCompletenessConfidence >= D09_CONFIG.sourceCompletenessForKnownAbsence;
  return {
    requirement,
    status: absenceKnown ? 'NOT_FOUND' : 'UNKNOWN',
    matchType: best?.matchType ?? 'NONE',
    semanticStrength: best?.semanticStrength ?? 0,
    evidenceDepth: best?.evidence.evidenceDepth ?? 0,
    fulfillment: 0,
    bestEvidenceId: best?.evidence.evidence.id ?? null,
    bestEvidenceSource: best?.evidence.sourceLabel ?? null,
  };
}

interface Scenario {
  score: number;
  arithmeticMust: number | null;
  geometricMust: number | null;
  asymmetricMust: number | null;
  niceCoverage: number | null;
  mustCurveValue: number | null;
  niceCurveValue: number | null;
  niceGate: number | null;
}

function scenario(
  matches: readonly D09RequirementMatch[],
  unknownValue: number,
  cap: number | null,
): Scenario {
  const must = matches.filter((m) =>
    m.requirement.kind !== 'FORMAL_REFERENCE' &&
    (m.requirement.priority === 'MUST' || m.requirement.priority === 'CORE_MUST'));
  const nice = matches.filter((m) =>
    m.requirement.kind !== 'FORMAL_REFERENCE' && m.requirement.priority === 'NICE');

  const values = (items: readonly D09RequirementMatch[]) => items.map((m) => ({
    value: m.status === 'UNKNOWN' ? unknownValue : m.fulfillment,
    weight: m.requirement.weight,
  }));

  let arithmeticMust: number | null = null;
  let geometricMust: number | null = null;
  let asymmetricMust: number | null = null;
  let mustCurveValue: number | null = null;
  let niceCoverage: number | null = null;
  let niceCurveValue: number | null = null;
  let niceGate: number | null = null;
  let rawScore = 0;

  if (must.length > 0) {
    const mustValues = values(must);
    arithmeticMust = weightedMean(mustValues);
    geometricMust = weightedGeometric(mustValues);
    asymmetricMust = clamp01(
      (1 - D09_CONFIG.geometricShare) * arithmeticMust +
      D09_CONFIG.geometricShare * geometricMust,
    );
    mustCurveValue = monotoneCurve(asymmetricMust);
  }

  if (nice.length > 0) {
    niceCoverage = weightedMean(values(nice));
    niceCurveValue = Math.pow(clamp01(niceCoverage), D09_CONFIG.niceExponent);
  }

  if (must.length > 0 && nice.length > 0) {
    niceGate = smoothstep(asymmetricMust ?? 0);
    const niceWeight = D09_CONFIG.niceWeightWhenMustExists;
    rawScore = 100 * (
      (1 - niceWeight) * (mustCurveValue ?? 0) +
      niceWeight * niceGate * (niceCurveValue ?? 0)
    );
  } else if (must.length > 0) {
    rawScore = 100 * (mustCurveValue ?? 0);
  } else if (nice.length > 0) {
    // Brak MUST jest prawdziwym N/A dla bariery, nie zerem blokującym NICE.
    rawScore = 100 * (niceCurveValue ?? 0);
  }

  return {
    score: clamp100(cap === null ? rawScore : Math.min(rawScore, cap)),
    arithmeticMust,
    geometricMust,
    asymmetricMust,
    niceCoverage,
    mustCurveValue,
    niceCurveValue,
    niceGate,
  };
}

function coreCaps(matches: readonly D09RequirementMatch[]): HardCap[] {
  const missingCore = matches.filter((m) =>
    m.requirement.priority === 'CORE_MUST' &&
    m.requirement.kind !== 'FORMAL_REFERENCE' &&
    m.status === 'NOT_FOUND' &&
    m.fulfillment < D09_CONFIG.coreMustMissingThreshold,
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
    evidenceIds: missingCore.flatMap((m) => m.requirement.evidenceIds),
  }];
}

function missingMeasurementEvidence(matches: readonly D09RequirementMatch[]): MissingEvidence[] {
  return matches.filter((m) => m.status === 'UNKNOWN').map((m) => ({
    id: `MISS_D09_${m.requirement.id}`,
    requirementCode: 'D09_CANDIDATE_EVIDENCE_UNCERTAIN',
    targetScope: m.requirement.id,
    description: `Nie da się wiarygodnie ustalić, czy CV zawiera dowód dla: ${m.requirement.label}.`,
    severity: m.requirement.priority === 'CORE_MUST' ? 'HIGH' : 'MEDIUM',
    expectedEvidenceWeight: m.requirement.weight,
    suggestedAction: 'Dostarcz pełniejszy dokument albo użyj Master Vault zamiast niepewnej ekstrakcji.',
  }));
}

function recommendations(matches: readonly D09RequirementMatch[]): Recommendation[] {
  return matches
    .filter((m) => m.status === 'NOT_FOUND' && m.requirement.kind !== 'FORMAL_REFERENCE')
    .slice(0, 8)
    .map((m, index) => ({
      id: `REC_D09_${index}_${m.requirement.canonicalId}`,
      targetModuleId: D09_MODULE_ID,
      targetSection: 'JOB_ALIGNMENT',
      priority: m.requirement.priority === 'CORE_MUST' ? 'CRITICAL' :
        m.requirement.priority === 'MUST' ? 'HIGH' : 'MEDIUM',
      issue: `Brak dowodu spełnienia wymagania: ${m.requirement.label}.`,
      suggestedAction: 'Jeżeli faktycznie posiadasz tę kompetencję, dodaj prawdziwy dowód w Master Vault lub doświadczeniu. Nie kopiuj frazy z JD bez pokrycia.',
    }));
}

function scoreEvidenceIds(matches: readonly D09RequirementMatch[], kind: 'MUST' | 'NICE'): string[] {
  const ids = new Set<string>();
  for (const m of matches) {
    const isMust = m.requirement.priority === 'MUST' || m.requirement.priority === 'CORE_MUST';
    if ((kind === 'MUST' && !isMust) || (kind === 'NICE' && m.requirement.priority !== 'NICE')) continue;
    m.requirement.evidenceIds.forEach((id) => ids.add(id));
    if (m.bestEvidenceId) ids.add(m.bestEvidenceId);
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
      .filter((m) => m.status === 'DEFERRED_FORMAL')
      .map((m) => m.requirement),
    uncertainty: { low: 0, high: 100, width: 100, unknownMustWeightShare: 1 },
  };
}

function emptyResult(
  applicability: D09AuditResult['applicability'],
  verdictCode: string,
  verdict: string,
  input: D09ScoringInput,
): D09AuditResult {
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
    applicability,
    evidence: input.extraction.evidence,
    missingEvidence: [],
    breakdown: [],
    penalties: [],
    hardCaps: [],
    ledger: null,
    verdictCode,
    verdict,
    recommendations: [],
    alignment: nullDiagnostics(),
  };
}

export function scoreD09JobAlignment(input: D09ScoringInput): D09AuditResult {
  if (input.documentClass === 'NON_CV') {
    return emptyResult(
      'NOT_APPLICABLE',
      'D09_NON_CV_INPUT',
      'Wejście nie zostało sklasyfikowane jako CV, więc Job Alignment nie ma zastosowania.',
      input,
    );
  }

  const scoreable = input.extraction.requirements.filter((r) => r.kind !== 'FORMAL_REFERENCE');
  if (scoreable.length === 0) {
    const insufficient = input.extraction.requirementLikeLines > 0 ||
      input.extraction.parserConfidence < D09_CONFIG.parserMinimumConfidence;
    return emptyResult(
      insufficient ? 'INSUFFICIENT_DATA' : 'NOT_APPLICABLE',
      insufficient ? 'D09_REQUIREMENTS_UNRESOLVED' : 'D09_NO_SCOREABLE_REQUIREMENTS',
      insufficient
        ? 'Parser nie ma wystarczających dowodów, aby wiarygodnie zbudować listę wymagań JD.'
        : 'Ogłoszenie nie zawiera wymagań należących do domeny D09.',
      input,
    );
  }

  const matches = input.extraction.requirements.map((requirement) =>
    matchRequirement(requirement, input.candidateEvidence, input));
  const hardCaps = coreCaps(matches);
  const effectiveCap = hardCaps.length > 0 ? Math.min(...hardCaps.map((cap) => cap.capLimit)) : null;

  const low = scenario(matches, 0, effectiveCap);
  const mid = scenario(matches, 0.5, effectiveCap);
  const high = scenario(matches, 1, effectiveCap);

  const must = matches.filter((m) =>
    m.requirement.kind !== 'FORMAL_REFERENCE' &&
    (m.requirement.priority === 'MUST' || m.requirement.priority === 'CORE_MUST'));
  const mustWeight = must.reduce((sum, m) => sum + m.requirement.weight, 0);
  const unknownMustWeight = must
    .filter((m) => m.status === 'UNKNOWN')
    .reduce((sum, m) => sum + m.requirement.weight, 0);
  const unknownMustWeightShare = mustWeight > 0 ? unknownMustWeight / mustWeight : 0;
  const uncertainty = {
    low: low.score,
    high: high.score,
    width: Math.max(0, high.score - low.score),
    unknownMustWeightShare,
  };

  const missingEvidence = missingMeasurementEvidence(matches);
  const matchedEvidenceIds = new Set(
    matches.map((m) => m.bestEvidenceId).filter((id): id is string => Boolean(id)),
  );
  const candidateAtoms = input.candidateEvidence
    .filter((candidate) => matchedEvidenceIds.has(candidate.evidence.id))
    .map((candidate) => candidate.evidence);
  const allEvidence: Evidence[] = [...input.extraction.evidence, ...candidateAtoms];
  const expectedEvidenceWeight = scoreable.reduce((sum, r) => sum + r.weight, 0);
  const confidenceBreakdown = deriveConfidenceFromEvidence({
    expectedEvidenceWeight,
    evidence: allEvidence,
    missingEvidence,
    sampleScaleK: 5,
  });

  const tooUncertain = uncertainty.width > D09_CONFIG.maxUncertaintyWidthForScore ||
    unknownMustWeightShare > D09_CONFIG.maxUnknownMustWeightShareForScore ||
    input.extraction.parserConfidence < D09_CONFIG.parserMinimumConfidence;

  const diagnostics: D09AlignmentDiagnostics = {
    arithmeticMust: mid.arithmeticMust,
    geometricMust: mid.geometricMust,
    asymmetricMustIndex: mid.asymmetricMust,
    niceCoverage: mid.niceCoverage,
    mustCurveValue: mid.mustCurveValue,
    niceCurveValue: mid.niceCurveValue,
    niceGate: mid.niceGate,
    requirementMatches: matches,
    deferredFormalRequirements: matches
      .filter((m) => m.status === 'DEFERRED_FORMAL')
      .map((m) => m.requirement),
    uncertainty,
  };

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
      recommendations: recommendations(matches),
      alignment: diagnostics,
    };
  }

  const hasMust = must.length > 0;
  const nice = matches.filter((m) =>
    m.requirement.kind !== 'FORMAL_REFERENCE' && m.requirement.priority === 'NICE');
  const hasNice = nice.length > 0;
  const breakdown: ScoreComponent[] = [];

  if (hasMust) {
    const max = hasNice ? 80 : 100;
    const normalized = mid.mustCurveValue ?? 0;
    const contribution = max * normalized;
    breakdown.push({
      id: 'MUST_ALIGNMENT',
      name: 'Asymetryczne dopasowanie wymagań MUST',
      rawValue: mid.asymmetricMust ?? 0,
      normalizedValue: normalized,
      baseWeight: hasNice ? 0.80 : 1,
      effectiveWeight: hasNice ? 0.80 : 1,
      contribution,
      maxContribution: max,
      unrealizedPotential: Math.max(0, max - contribution),
      evidenceIds: scoreEvidenceIds(matches, 'MUST'),
      signalFamily: 'SKILL_PRESENCE',
    });
  }

  if (hasNice) {
    const max = hasMust ? 20 : 100;
    const normalized = hasMust
      ? (mid.niceGate ?? 0) * (mid.niceCurveValue ?? 0)
      : (mid.niceCurveValue ?? 0);
    const contribution = max * normalized;
    breakdown.push({
      id: 'NICE_ALIGNMENT',
      name: hasMust ? 'Dodatkowe dopasowanie NICE po bramce MUST' : 'Dopasowanie wymagań NICE',
      rawValue: mid.niceCoverage ?? 0,
      normalizedValue: normalized,
      baseWeight: hasMust ? 0.20 : 1,
      effectiveWeight: hasMust ? 0.20 : 1,
      contribution,
      maxContribution: max,
      unrealizedPotential: Math.max(0, max - contribution),
      evidenceIds: scoreEvidenceIds(matches, 'NICE'),
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
      : `Kierivo Job Alignment: ${score.toFixed(1)}/100. To wewnętrzny audyt zgodności z wymaganiami JD, nie prawdopodobieństwo zatrudnienia.`,
    recommendations: recommendations(matches),
    alignment: diagnostics,
  };
}
