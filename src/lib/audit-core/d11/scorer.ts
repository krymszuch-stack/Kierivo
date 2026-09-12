import { deriveConfidenceFromEvidence } from '../confidence';
import type { MissingEvidence, ScoreComponent } from '../contracts';
import { buildScoreLedger } from '../ledger';
import type {
  D11AuditResult,
  D11RequirementRecency,
  D11ScoringInput,
} from './types';

const MODULE_ID = 'MOD_SKILL_RECENCY';
const MODULE_NAME = 'Competency Recency & Half-Life Decay';
const DEFAULT_HALF_LIFE_MONTHS = 48;

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function temporalMissing(requirementId: string, label: string, weight: number, invalid: boolean): MissingEvidence {
  return {
    id: `D11_MISSING_${requirementId}`,
    requirementCode: invalid ? 'D11_INVALID_TEMPORAL_EVIDENCE' : 'D11_DATED_SKILL_EVIDENCE_REQUIRED',
    targetScope: requirementId,
    description: invalid
      ? `Dla kompetencji „${label}” znaleziono dowód, ale jego data jest niespójna lub nieparsowalna.`
      : `Dla kompetencji „${label}” brakuje wiarygodnego, datowanego dowodu użycia.`,
    severity: 'MEDIUM',
    expectedEvidenceWeight: Math.max(0.1, weight),
    suggestedAction: 'Dodaj prawdziwy, datowany przykład użycia kompetencji w doświadczeniu lub projekcie. Nie przenoś słowa do nowszej roli bez faktycznego użycia.',
  };
}

export function halfLifeDecay(ageMonths: number, halfLifeMonths: number): number {
  if (!Number.isFinite(ageMonths) || ageMonths < 0) throw new Error('ageMonths musi być nieujemne.');
  if (!Number.isFinite(halfLifeMonths) || halfLifeMonths <= 0) throw new Error('halfLifeMonths musi być dodatnie.');
  return Math.pow(0.5, ageMonths / halfLifeMonths);
}

export function scoreD11SkillRecency(input: D11ScoringInput): D11AuditResult {
  const halfLifeMonths = input.halfLifeMonths ?? DEFAULT_HALF_LIFE_MONTHS;
  if (!Number.isFinite(halfLifeMonths) || halfLifeMonths <= 0) {
    throw new Error('D11 halfLifeMonths musi być dodatnie.');
  }

  const skillRequirements = input.requirements.filter((requirement) => requirement.kind === 'SKILL');
  if (skillRequirements.length === 0) {
    return {
      moduleId: MODULE_ID,
      moduleName: MODULE_NAME,
      domainId: 'JOB_FIT',
      score: null,
      confidence: 0,
      confidenceBreakdown: { coverage: 0, provenance: 0, extraction: 0, sample: 0, combined: 0 },
      applicability: 'NOT_APPLICABLE',
      evidence: [],
      missingEvidence: [],
      breakdown: [],
      penalties: [],
      hardCaps: [],
      ledger: null,
      verdictCode: 'D11_NOT_APPLICABLE',
      verdict: 'Brak dopasowanych wymagań kompetencyjnych, dla których D11 mógłby mierzyć świeżość.',
      recommendations: [],
      recency: {
        halfLifeMonths,
        matchedSkillRequirementCount: 0,
        scoredRequirementCount: 0,
        scoredRequirementWeight: 0,
        matchedRequirementWeight: 0,
        requirements: [],
        datedEvidence: [],
        temporalMissingEvidence: [],
      },
    };
  }

  const requirementRows: D11RequirementRecency[] = [];
  const missingEvidence: MissingEvidence[] = [];
  const datedEvidence = [] as D11AuditResult['recency']['datedEvidence'];

  for (const requirement of skillRequirements) {
    const observations = input.evidenceByRequirementId.get(requirement.id) ?? [];
    datedEvidence.push(...observations);
    if (observations.length === 0) {
      const invalid = input.invalidTemporalRequirementIds?.has(requirement.id) ?? false;
      missingEvidence.push(temporalMissing(requirement.id, requirement.label, requirement.weight, invalid));
      requirementRows.push({
        requirement,
        status: invalid ? 'INVALID_TEMPORAL_EVIDENCE' : 'NO_DATED_EVIDENCE',
        halfLifeMonths,
        freshestAgeMonths: null,
        normalizedRecency: null,
        bestEvidenceId: null,
      });
      continue;
    }

    const best = [...observations].sort((a, b) => b.scoreValue - a.scoreValue || a.ageMonths - b.ageMonths)[0];
    requirementRows.push({
      requirement,
      status: 'SCORED',
      halfLifeMonths,
      freshestAgeMonths: best.ageMonths,
      normalizedRecency: clamp01(best.scoreValue),
      bestEvidenceId: best.id,
    });
  }

  const scoredRows = requirementRows.filter(
    (row): row is D11RequirementRecency & { normalizedRecency: number; bestEvidenceId: string } =>
      row.status === 'SCORED' && row.normalizedRecency !== null && row.bestEvidenceId !== null,
  );

  if (scoredRows.length === 0) {
    const confidenceBreakdown = deriveConfidenceFromEvidence({
      expectedEvidenceWeight: skillRequirements.reduce((sum, item) => sum + item.weight, 0),
      evidence: [],
      missingEvidence,
      sampleScaleK: 3,
    });
    return {
      moduleId: MODULE_ID,
      moduleName: MODULE_NAME,
      domainId: 'JOB_FIT',
      score: null,
      confidence: confidenceBreakdown.combined,
      confidenceBreakdown,
      applicability: 'INSUFFICIENT_DATA',
      evidence: [],
      missingEvidence,
      breakdown: [],
      penalties: [],
      hardCaps: [],
      ledger: null,
      verdictCode: 'D11_INSUFFICIENT_TEMPORAL_EVIDENCE',
      verdict: 'Kompetencje są obecne, ale brak wystarczających datowanych dowodów, aby uczciwie wyliczyć ich świeżość.',
      recommendations: [],
      recency: {
        halfLifeMonths,
        matchedSkillRequirementCount: skillRequirements.length,
        scoredRequirementCount: 0,
        scoredRequirementWeight: 0,
        matchedRequirementWeight: skillRequirements.reduce((sum, item) => sum + item.weight, 0),
        requirements: requirementRows,
        datedEvidence,
        temporalMissingEvidence: missingEvidence,
      },
    };
  }

  const scoredWeight = scoredRows.reduce((sum, row) => sum + Math.max(0, row.requirement.weight), 0);
  const matchedWeight = skillRequirements.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  const effectiveDenominator = Math.max(Number.EPSILON, scoredWeight);

  const components: ScoreComponent[] = scoredRows.map((row) => {
    const effectiveWeight = Math.max(0, row.requirement.weight) / effectiveDenominator;
    const normalizedValue = clamp01(row.normalizedRecency);
    const maxContribution = effectiveWeight * 100;
    const contribution = normalizedValue * maxContribution;
    return {
      id: `D11_${row.requirement.id}`,
      name: `Świeżość: ${row.requirement.label}`,
      rawValue: row.freshestAgeMonths ?? 0,
      normalizedValue,
      baseWeight: matchedWeight > Number.EPSILON ? Math.max(0, row.requirement.weight) / matchedWeight : 0,
      effectiveWeight,
      contribution,
      maxContribution,
      unrealizedPotential: maxContribution - contribution,
      evidenceIds: [row.bestEvidenceId],
    };
  });

  const evidence = datedEvidence.map((item) => item.evidence);
  const confidenceBreakdown = deriveConfidenceFromEvidence({
    expectedEvidenceWeight: matchedWeight,
    evidence,
    missingEvidence,
    sampleScaleK: 3,
  });
  const ledger = buildScoreLedger({
    moduleId: MODULE_ID,
    components,
    penalties: [],
    hardCaps: [],
    confidenceBreakdown,
  });
  const score = ledger.finalScore;
  const partial = scoredRows.length < skillRequirements.length;

  return {
    moduleId: MODULE_ID,
    moduleName: MODULE_NAME,
    domainId: 'JOB_FIT',
    score,
    confidence: confidenceBreakdown.combined,
    confidenceBreakdown,
    applicability: partial ? 'PARTIALLY_APPLICABLE' : 'APPLICABLE',
    evidence,
    missingEvidence,
    breakdown: components,
    penalties: [],
    hardCaps: [],
    ledger,
    verdictCode: score !== null && score >= 75 ? 'D11_RECENCY_STRONG' : score !== null && score >= 50 ? 'D11_RECENCY_MIXED' : 'D11_RECENCY_STALE',
    verdict: partial
      ? 'Wynik obejmuje wyłącznie kompetencje z wiarygodnym datowanym dowodem; brak dat nie został potraktowany jako stara kompetencja.'
      : 'Wynik mierzy świeżość potwierdzonych kompetencji wymaganych przez ofertę z ciągłym zanikiem half-life.',
    recommendations: [],
    recency: {
      halfLifeMonths,
      matchedSkillRequirementCount: skillRequirements.length,
      scoredRequirementCount: scoredRows.length,
      scoredRequirementWeight: scoredWeight,
      matchedRequirementWeight: matchedWeight,
      requirements: requirementRows,
      datedEvidence,
      temporalMissingEvidence: missingEvidence,
    },
  };
}
