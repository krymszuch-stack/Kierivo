import type {
  ApplicabilityState,
  AuditDomainId,
  AuditMode,
  AuditModuleResult,
  AuditRunContext,
  DomainContribution,
  DomainResult,
  GlobalConsensusResult,
  HardCap,
  MissingEvidence,
} from './contracts';
import { effectiveCap } from './hardCaps';
import { buildAuditIntegritySignature } from './signature';

export const ALL_AUDIT_DOMAINS: readonly AuditDomainId[] = [
  'DOCUMENT_QUALITY',
  'JOB_FIT',
  'EVIDENCE_QUALITY',
  'INTEGRITY',
  'FORMAL_READINESS',
] as const;

const clamp100 = (value: number): number => Math.max(0, Math.min(100, value));
const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export interface WeightedValue {
  value: number;
  weight: number;
}

/**
 * Generalized mean używany w benchmarkach D07. p=0 daje przesuniętą średnią
 * geometryczną. delta stabilizuje zero i nie ma znaczenia semantycznego.
 */
export function generalizedMean(
  values: readonly WeightedValue[],
  p: number,
  delta = 1,
): number {
  const active = values.filter((item) => item.weight > 0 && Number.isFinite(item.value));
  if (active.length === 0) throw new Error('Nie można agregować pustego zbioru wartości.');
  const weightSum = active.reduce((sum, item) => sum + item.weight, 0);

  if (Math.abs(p) < 1e-12) {
    const logMean = active.reduce(
      (sum, item) => sum + (item.weight / weightSum) * Math.log(Math.max(0, item.value) + delta),
      0,
    );
    return clamp100(Math.exp(logMean) - delta);
  }

  const powered = active.reduce(
    (sum, item) => sum + (item.weight / weightSum) * Math.pow(Math.max(0, item.value) + delta, p),
    0,
  );
  return clamp100(Math.pow(powered, 1 / p) - delta);
}

export function benchmarkAggregationModels(values: readonly WeightedValue[]): Record<string, number> {
  return {
    'p=-1': generalizedMean(values, -1),
    'p=-0.5': generalizedMean(values, -0.5),
    'p=0': generalizedMean(values, 0),
    'p=0.5': generalizedMean(values, 0.5),
    'p=1': generalizedMean(values, 1),
  };
}

function geometricConfidence(values: readonly WeightedValue[]): number {
  if (values.length === 0) return 0;
  const weightSum = values.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (weightSum <= Number.EPSILON) return 0;
  const epsilon = 1e-9;
  const logMean = values.reduce(
    (sum, item) => sum + (Math.max(0, item.weight) / weightSum) * Math.log(Math.max(epsilon, clamp01(item.value))),
    0,
  );
  return clamp01(Math.exp(logMean));
}

export interface DomainAggregationPolicy {
  domainId: AuditDomainId;
  moduleWeights: Record<string, number>;
  /** Moduły, których brak/INSUFFICIENT_DATA blokuje score domeny. */
  requiredModuleIds?: string[];
}

function weightFor(moduleId: string, policy: DomainAggregationPolicy): number {
  return Math.max(0, policy.moduleWeights[moduleId] ?? 0);
}

function domainApplicability(
  modules: readonly AuditModuleResult[],
  hasBlockingMissing: boolean,
): ApplicabilityState {
  if (hasBlockingMissing) return 'INSUFFICIENT_DATA';
  if (modules.length === 0 || modules.every((module) => module.applicability === 'NOT_APPLICABLE')) {
    return 'NOT_APPLICABLE';
  }
  if (modules.some((module) => module.applicability === 'INSUFFICIENT_DATA')) {
    return 'INSUFFICIENT_DATA';
  }
  if (modules.some((module) => module.applicability === 'PARTIALLY_APPLICABLE')) {
    return 'PARTIALLY_APPLICABLE';
  }
  return 'APPLICABLE';
}

export function aggregateDomain(
  moduleResults: readonly AuditModuleResult[],
  policy: DomainAggregationPolicy,
): DomainResult {
  const domainModules = moduleResults.filter((module) => module.domainId === policy.domainId);
  const required = new Set(policy.requiredModuleIds ?? []);
  const presentIds = new Set(domainModules.map((module) => module.moduleId));
  const missingRequiredIds = [...required].filter((id) => !presentIds.has(id));
  const insufficientRequired = domainModules.filter(
    (module) => required.has(module.moduleId) && module.applicability === 'INSUFFICIENT_DATA',
  );
  const hasBlockingMissing = missingRequiredIds.length > 0 || insufficientRequired.length > 0;
  const applicability = domainApplicability(domainModules, hasBlockingMissing);

  const activeForConfidence = domainModules.filter(
    (module) => module.applicability !== 'NOT_APPLICABLE' && weightFor(module.moduleId, policy) > 0,
  );
  const confidence = geometricConfidence(
    activeForConfidence.map((module) => ({
      value: module.confidence,
      weight: weightFor(module.moduleId, policy),
    })),
  );

  const missingEvidence: MissingEvidence[] = [
    ...domainModules.flatMap((module) => module.missingEvidence),
    ...missingRequiredIds.map((moduleId): MissingEvidence => ({
      id: `MISS_DOMAIN_${policy.domainId}_${moduleId}`,
      requirementCode: `DOMAIN_REQUIRED_MODULE_${moduleId}`,
      targetScope: policy.domainId,
      description: `Brakuje wymaganego modułu ${moduleId} w domenie ${policy.domainId}.`,
      severity: 'CRITICAL',
      expectedEvidenceWeight: weightFor(moduleId, policy),
      suggestedAction: 'Uruchom wymagany moduł albo uzupełnij dane niezbędne do jego oceny.',
    })),
  ];

  const domainCaps = domainModules
    .flatMap((module) => module.hardCaps)
    .filter((cap) => cap.scope === 'DOMAIN' && cap.targetId === policy.domainId);

  if (applicability === 'NOT_APPLICABLE') {
    return {
      domainId: policy.domainId,
      score: null,
      confidence: 0,
      applicability,
      contributingModules: [],
      contributions: [],
      hardCaps: domainCaps,
      missingEvidence,
      equationText: 'N/A — domena nie dotyczy tego audytu.',
    };
  }

  if (applicability === 'INSUFFICIENT_DATA') {
    return {
      domainId: policy.domainId,
      score: null,
      confidence,
      applicability,
      contributingModules: domainModules.map((module) => module.moduleId),
      contributions: [],
      hardCaps: domainCaps,
      missingEvidence,
      equationText: 'Brak wyniku — co najmniej jeden aktywny moduł domeny ma INSUFFICIENT_DATA lub wymagany moduł nie istnieje.',
    };
  }

  const scored = domainModules.filter(
    (module) =>
      module.score !== null &&
      module.applicability !== 'NOT_APPLICABLE' &&
      weightFor(module.moduleId, policy) > 0,
  );

  if (scored.length === 0) {
    return {
      domainId: policy.domainId,
      score: null,
      confidence,
      applicability: 'INSUFFICIENT_DATA',
      contributingModules: [],
      contributions: [],
      hardCaps: domainCaps,
      missingEvidence,
      equationText: 'Brak modułu z uczciwie policzalnym score.',
    };
  }

  const totalBaseWeight = scored.reduce((sum, module) => sum + weightFor(module.moduleId, policy), 0);
  const contributions: DomainContribution[] = scored.map((module) => ({
    moduleId: module.moduleId,
    score: module.score!,
    confidence: module.confidence,
    baseWeight: weightFor(module.moduleId, policy),
    effectiveWeight: weightFor(module.moduleId, policy) / totalBaseWeight,
  }));

  const raw = generalizedMean(
    contributions.map((item) => ({ value: item.score, weight: item.effectiveWeight })),
    0,
  );
  const cap = effectiveCap(domainCaps, 'DOMAIN', policy.domainId);
  const score = cap === null ? raw : Math.min(raw, cap);

  return {
    domainId: policy.domainId,
    score,
    confidence,
    applicability,
    contributingModules: contributions.map((item) => item.moduleId),
    contributions,
    hardCaps: domainCaps,
    missingEvidence,
    equationText: cap === null
      ? `Gδ(${contributions.map((item) => `${item.moduleId}:${item.score.toFixed(4)}@${item.effectiveWeight.toFixed(6)}`).join(', ')}) = ${score.toFixed(4)}`
      : `min(Gδ(...)=${raw.toFixed(4)}, cap=${cap}) = ${score.toFixed(4)}`,
  };
}

export interface GlobalConsensusInput {
  context: AuditRunContext;
  moduleResults: readonly AuditModuleResult[];
  domainPolicies: readonly DomainAggregationPolicy[];
  domainWeights: Record<AuditDomainId, number>;
  /** W TARGETED_APPLICATION domyślnie JOB_FIT. */
  requiredDomains?: AuditDomainId[];
  canonicalSignalsForSignature: unknown;
  moduleConfigVersions: Record<string, string>;
}

const defaultRequiredDomains = (mode: AuditMode): AuditDomainId[] =>
  mode === 'TARGETED_APPLICATION' ? ['JOB_FIT'] : [];

function emptyDomainPolicy(domainId: AuditDomainId): DomainAggregationPolicy {
  return { domainId, moduleWeights: {}, requiredModuleIds: [] };
}

export async function buildGlobalConsensus(input: GlobalConsensusInput): Promise<GlobalConsensusResult> {
  const domainResults = {} as Record<AuditDomainId, DomainResult>;
  for (const domainId of ALL_AUDIT_DOMAINS) {
    const policy = input.domainPolicies.find((candidate) => candidate.domainId === domainId) ?? emptyDomainPolicy(domainId);
    domainResults[domainId] = aggregateDomain(input.moduleResults, policy);
  }

  const requiredDomains = new Set(input.requiredDomains ?? defaultRequiredDomains(input.context.mode));
  const blockingIssues: string[] = [];
  for (const domainId of ALL_AUDIT_DOMAINS) {
    const result = domainResults[domainId];
    if (requiredDomains.has(domainId) && result.applicability === 'NOT_APPLICABLE') {
      blockingIssues.push(`${domainId}: required domain cannot be NOT_APPLICABLE`);
    }
    if (result.applicability === 'INSUFFICIENT_DATA') {
      blockingIssues.push(`${domainId}: insufficient data`);
    }
  }

  const activeDomains = ALL_AUDIT_DOMAINS
    .map((domainId) => domainResults[domainId])
    .filter((result) => result.applicability !== 'NOT_APPLICABLE');

  const confidenceValues = activeDomains.map((result) => ({
    value: result.confidence,
    weight: Math.max(0, input.domainWeights[result.domainId] ?? 0),
  })).filter((item) => item.weight > 0);
  const overallConfidence = geometricConfidence(confidenceValues);

  const scoredDomains = activeDomains.filter((result) => result.score !== null);
  let overallScore: number | null = null;
  let equationText = 'Brak wyniku globalnego.';

  if (blockingIssues.length === 0 && scoredDomains.length > 0) {
    const weighted = scoredDomains
      .map((result) => ({
        value: result.score!,
        weight: Math.max(0, input.domainWeights[result.domainId] ?? 0),
      }))
      .filter((item) => item.weight > 0);
    if (weighted.length > 0) {
      const raw = generalizedMean(weighted, 0);
      const globalCaps = input.moduleResults
        .flatMap((module) => module.hardCaps)
        .filter((cap) => cap.scope === 'GLOBAL' && cap.triggered);
      const cap = globalCaps.length > 0 ? Math.min(...globalCaps.map((item) => item.capLimit)) : null;
      overallScore = cap === null ? raw : Math.min(raw, cap);
      equationText = cap === null
        ? `Global Gδ = ${overallScore.toFixed(4)}`
        : `min(Global Gδ=${raw.toFixed(4)}, globalCap=${cap}) = ${overallScore.toFixed(4)}`;
    }
  }

  const moduleResults = Object.fromEntries(input.moduleResults.map((module) => [module.moduleId, module]));
  const effectiveHardCaps: HardCap[] = input.moduleResults
    .flatMap((module) => module.hardCaps)
    .filter((cap) => cap.triggered);
  const criticalMissingEvidence = activeDomains
    .flatMap((domain) => domain.missingEvidence)
    .filter((item) => item.severity === 'CRITICAL' || item.severity === 'HIGH');

  const auditIntegritySignature = await buildAuditIntegritySignature({
    engineVersion: input.context.engineVersion,
    auditMode: input.context.mode,
    referenceMonth: input.context.referenceMonth,
    canonicalSignals: input.canonicalSignalsForSignature,
    moduleConfigVersions: input.moduleConfigVersions,
    corpusSchemaVersion: input.context.corpusSchemaVersion,
  });

  return {
    auditRunId: input.context.auditRunId,
    engineVersion: input.context.engineVersion,
    mode: input.context.mode,
    overallScore,
    overallConfidence,
    domainResults,
    moduleResults,
    effectiveHardCaps,
    criticalMissingEvidence,
    blockingIssues,
    equationText,
    auditIntegritySignature,
  };
}
