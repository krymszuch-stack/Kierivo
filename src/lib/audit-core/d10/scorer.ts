import { computeAuditConfidence } from '../confidence';
import type {
  HardCap,
  MissingEvidence,
  Recommendation,
  ScoreComponent,
} from '../contracts';
import { buildScoreLedger } from '../ledger';
import {
  buildD10LogicalRequirementUnits,
  satisfiedAnyOfAlternativeIds,
  type D10LogicalRequirementUnit,
} from './logicalUnits';
import { matchD10Requirement } from './matching';
import type {
  D10AuditResult,
  D10RequirementMatch,
  D10ScoringInput,
} from './types';

const MODULE_ID = 'MOD_FORMAL_REQUIREMENTS';
const MODULE_NAME = 'Wymagania formalne i uprawnienia';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const round = (value: number): number => Math.round(value * 1e6) / 1e6;

function weightedCoverage(units: readonly D10LogicalRequirementUnit[]): number | null {
  if (units.length === 0) return null;
  const denominator = units.reduce((sum, unit) => sum + Math.max(0, unit.weight), 0);
  if (denominator <= Number.EPSILON) return null;
  return units.reduce(
    (sum, unit) => sum + unit.fulfillment * Math.max(0, unit.weight),
    0,
  ) / denominator;
}

function unitExtractionConfidence(unit: D10LogicalRequirementUnit): number {
  return Math.min(...unit.memberMatches.map((match) => match.requirement.extractionConfidence));
}

function component(
  id: string,
  name: string,
  value: number,
  baseWeight: number,
  effectiveWeight: number,
  evidenceIds: string[],
): ScoreComponent {
  const contribution = value * effectiveWeight * 100;
  const maxContribution = effectiveWeight * 100;
  return {
    id,
    name,
    rawValue: round(value),
    normalizedValue: round(value),
    baseWeight,
    effectiveWeight,
    contribution: round(contribution),
    maxContribution: round(maxContribution),
    unrealizedPotential: round(maxContribution - contribution),
    evidenceIds: [...new Set(evidenceIds)],
    signalFamily: 'FORMAL_REQUIREMENT',
  };
}

function notApplicableResult(input: D10ScoringInput): D10AuditResult {
  const noFormalHints = input.extraction.requirementLikeLines === 0;
  return {
    moduleId: MODULE_ID,
    moduleName: MODULE_NAME,
    domainId: 'FORMAL_READINESS',
    score: null,
    confidence: noFormalHints ? 1 : input.extraction.parserConfidence,
    confidenceBreakdown: {
      coverage: noFormalHints ? 1 : 0,
      provenance: noFormalHints ? 1 : 0.7,
      extraction: noFormalHints ? 1 : input.extraction.parserConfidence,
      sample: noFormalHints ? 1 : 0,
      combined: noFormalHints ? 1 : input.extraction.parserConfidence,
    },
    applicability: noFormalHints ? 'NOT_APPLICABLE' : 'INSUFFICIENT_DATA',
    evidence: [...input.extraction.evidence],
    missingEvidence: noFormalHints ? [] : [{
      id: 'MISS_D10_PARSE_FORMAL_REQUIREMENT',
      requirementCode: 'D10_PARSE_FORMAL_REQUIREMENT',
      targetScope: 'jobDescription',
      description: 'JD wygląda na zawierające wymóg formalny, ale parser nie umiał go bezpiecznie sklasyfikować.',
      severity: 'HIGH',
      expectedEvidenceWeight: 1,
      suggestedAction: 'Zweryfikuj ręcznie wymagania formalne z ogłoszenia lub rozszerz taksonomię D10 po walidacji.',
    }],
    breakdown: [],
    penalties: [],
    hardCaps: [],
    ledger: null,
    verdictCode: noFormalHints ? 'D10_NOT_APPLICABLE' : 'D10_REQUIREMENT_PARSE_UNCERTAIN',
    verdict: noFormalHints
      ? 'Oferta nie zawiera wykrywalnych wymagań formalnych.'
      : 'Nie udało się wiarygodnie zinterpretować wymagań formalnych.',
    recommendations: [],
    formal: {
      mandatoryCoverage: null,
      preferredCoverage: null,
      unknownMandatoryWeightShare: 0,
      matches: [],
      groups: input.extraction.groups,
      missingCoreMustIds: [],
      adaptiveSignal: input.extraction.adaptiveSignal,
    },
  };
}

export function scoreD10FormalRequirements(input: D10ScoringInput): D10AuditResult {
  const requirements = input.extraction.requirements;
  if (requirements.length === 0) return notApplicableResult(input);

  const matches = requirements.map((requirement) => matchD10Requirement(
    requirement,
    input.candidateEvidence,
    input.sourceCompletenessConfidence,
    input.referenceDateIso,
  ));
  const units = buildD10LogicalRequirementUnits(matches, input.extraction.groups);
  const satisfiedAlternatives = satisfiedAnyOfAlternativeIds(units);

  const mandatoryUnits = units.filter((unit) => unit.priority !== 'PREFERRED');
  const preferredUnits = units.filter((unit) => unit.priority === 'PREFERRED');
  const totalMandatoryWeight = mandatoryUnits.reduce((sum, unit) => sum + unit.weight, 0);
  const unknownMandatoryWeight = mandatoryUnits
    .filter((unit) => unit.status === 'UNKNOWN')
    .reduce((sum, unit) => sum + unit.weight, 0);
  const unknownMandatoryWeightShare = totalMandatoryWeight > 0
    ? unknownMandatoryWeight / totalMandatoryWeight
    : 0;
  const unknownCore = mandatoryUnits.some(
    (unit) => unit.priority === 'CORE_MUST' && unit.status === 'UNKNOWN',
  );

  const missingEvidence: MissingEvidence[] = matches
    .filter((match) =>
      !satisfiedAlternatives.has(match.requirement.id) &&
      (match.status === 'UNKNOWN' || match.status === 'NOT_FOUND'),
    )
    .map((match) => ({
      id: `MISS_D10_${match.requirement.id}`,
      requirementCode: match.requirement.canonicalId,
      targetScope: match.requirement.kind,
      description: match.status === 'UNKNOWN'
        ? `Nie da się potwierdzić ani wykluczyć: ${match.requirement.label}.`
        : `Nie znaleziono dowodu spełnienia: ${match.requirement.label}.`,
      severity: match.requirement.priority === 'CORE_MUST'
        ? 'CRITICAL'
        : match.requirement.priority === 'MUST'
          ? 'HIGH'
          : 'MEDIUM',
      expectedEvidenceWeight: match.requirement.weight,
      suggestedAction: match.status === 'UNKNOWN'
        ? 'Uzupełnij Master Vault albo dostarcz dokument z czytelnym dowodem formalnym.'
        : `Dodaj prawdziwy dowód kwalifikacji „${match.requirement.label}”, jeśli go posiadasz.`,
    }));

  if (unknownCore || unknownMandatoryWeightShare > 0) {
    const totalUnitWeight = units.reduce((sum, unit) => sum + unit.weight, 0);
    const knownUnitWeight = units
      .filter((unit) => unit.status !== 'UNKNOWN')
      .reduce((sum, unit) => sum + unit.weight, 0);
    const confidenceBreakdown = computeAuditConfidence({
      expectedEvidenceWeight: totalUnitWeight,
      fulfilledEvidenceWeight: knownUnitWeight,
      provenanceReliability: input.sourceMode === 'VAULT' ? 0.9 : 0.7,
      extractionQuality: clamp01(input.extraction.parserConfidence * input.sourceCompletenessConfidence),
      independentEvidenceCount: units.length,
      sampleScaleK: 3,
    });
    return {
      moduleId: MODULE_ID,
      moduleName: MODULE_NAME,
      domainId: 'FORMAL_READINESS',
      score: null,
      confidence: confidenceBreakdown.combined,
      confidenceBreakdown,
      applicability: 'INSUFFICIENT_DATA',
      evidence: [
        ...input.extraction.evidence,
        ...input.candidateEvidence.map((item) => item.evidence),
      ],
      missingEvidence,
      breakdown: [],
      penalties: [],
      hardCaps: [],
      ledger: null,
      verdictCode: 'D10_UNKNOWN_MANDATORY_REQUIREMENT',
      verdict: 'Co najmniej jednego obowiązkowego wymogu formalnego nie da się rzetelnie zweryfikować.',
      recommendations: missingEvidence.map((item): Recommendation => ({
        id: `REC_${item.id}`,
        targetModuleId: MODULE_ID,
        targetSection: item.targetScope,
        priority: item.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
        issue: item.description,
        suggestedAction: item.suggestedAction,
      })),
      formal: {
        mandatoryCoverage: null,
        preferredCoverage: null,
        unknownMandatoryWeightShare: round(unknownMandatoryWeightShare),
        matches,
        groups: input.extraction.groups,
        missingCoreMustIds: [],
        adaptiveSignal: input.extraction.adaptiveSignal,
      },
    };
  }

  const knownPreferredUnits = preferredUnits.filter((unit) => unit.status !== 'UNKNOWN');
  const mandatoryCoverage = weightedCoverage(mandatoryUnits);
  const preferredCoverage = weightedCoverage(knownPreferredUnits);

  const mandatoryPresent = mandatoryCoverage !== null;
  const preferredPresent = preferredCoverage !== null;
  const baseMandatory = mandatoryPresent ? 0.85 : 0;
  const basePreferred = preferredPresent ? 0.15 : 0;
  const weightTotal = baseMandatory + basePreferred;
  const effectiveMandatory = weightTotal > 0 ? baseMandatory / weightTotal : 0;
  const effectivePreferred = weightTotal > 0 ? basePreferred / weightTotal : 0;

  const breakdown: ScoreComponent[] = [];
  if (mandatoryPresent) {
    breakdown.push(component(
      'D10_MANDATORY_FORMAL',
      'Wymagania obowiązkowe',
      mandatoryCoverage!,
      0.85,
      effectiveMandatory,
      mandatoryUnits.flatMap((unit) => unit.evidenceIds),
    ));
  }
  if (preferredPresent) {
    breakdown.push(component(
      'D10_PREFERRED_FORMAL',
      'Wymagania preferowane',
      preferredCoverage!,
      0.15,
      effectivePreferred,
      knownPreferredUnits.flatMap((unit) => unit.evidenceIds),
    ));
  }

  const hardCaps: HardCap[] = [];
  const missingCoreUnits = mandatoryUnits.filter(
    (unit) => unit.priority === 'CORE_MUST' &&
      unit.status !== 'UNKNOWN' &&
      unit.fulfillment < 0.5 &&
      unitExtractionConfidence(unit) >= 0.9 &&
      input.sourceCompletenessConfidence >= 0.85,
  );
  for (const unit of missingCoreUnits) {
    hardCaps.push({
      id: `HC_D10_CORE_${unit.id}`,
      ruleCode: 'HC_D10_MISSING_CORE_FORMAL_REQUIREMENT',
      scope: 'MODULE',
      targetId: MODULE_ID,
      capLimit: 35,
      triggered: true,
      reason: `Nie spełniono jednoznacznie oznaczonego CORE_MUST: ${unit.label}.`,
      evidenceIds: unit.evidenceIds,
      missingEvidenceIds: unit.memberMatches.map((match) => `MISS_D10_${match.requirement.id}`),
    });
  }

  const knownWeight = units
    .filter((unit) => unit.status !== 'UNKNOWN')
    .reduce((sum, unit) => sum + unit.weight, 0);
  const totalWeight = units.reduce((sum, unit) => sum + unit.weight, 0);
  const meanRequirementConfidence = units.reduce(
    (sum, unit) => sum + unitExtractionConfidence(unit) * unit.weight,
    0,
  ) / Math.max(Number.EPSILON, totalWeight);
  const confidenceBreakdown = computeAuditConfidence({
    expectedEvidenceWeight: totalWeight,
    fulfilledEvidenceWeight: knownWeight,
    provenanceReliability: input.sourceMode === 'VAULT' ? 0.9 : 0.7,
    extractionQuality: clamp01(
      meanRequirementConfidence * input.sourceCompletenessConfidence,
    ),
    independentEvidenceCount: units.length,
    sampleScaleK: 3,
  });

  const ledger = buildScoreLedger({
    moduleId: MODULE_ID,
    components: breakdown,
    penalties: [],
    hardCaps,
    confidenceBreakdown,
  });
  const score = ledger.finalScore;

  const recommendations: Recommendation[] = matches
    .filter((match) =>
      !satisfiedAlternatives.has(match.requirement.id) &&
      (match.status === 'NOT_FOUND' || match.status === 'PARTIAL'),
    )
    .map((match) => ({
      id: `REC_D10_${match.requirement.id}`,
      targetModuleId: MODULE_ID,
      targetSection: match.requirement.kind,
      priority: match.requirement.priority === 'CORE_MUST'
        ? 'CRITICAL'
        : match.requirement.priority === 'MUST'
          ? 'HIGH'
          : 'MEDIUM',
      issue: `${match.requirement.label}: ${match.explanation}`,
      suggestedAction: `Jeśli faktycznie spełniasz wymóg „${match.requirement.label}”, dodaj jednoznaczny dowód. Nie deklaruj kwalifikacji, której nie posiadasz.`,
      potentialScoreGainRange: { min: 0, max: round(match.requirement.weight / Math.max(totalWeight, 1) * 100) },
    }));

  const partialPreferred = preferredUnits.some((unit) => unit.status === 'UNKNOWN');
  const applicability = partialPreferred ? 'PARTIALLY_APPLICABLE' : 'APPLICABLE';
  const verdictCode = hardCaps.length > 0
    ? 'D10_CORE_FORMAL_MISSING'
    : score !== null && score >= 90
      ? 'D10_FORMAL_STRONG'
      : score !== null && score >= 70
        ? 'D10_FORMAL_PARTIAL'
        : 'D10_FORMAL_GAPS';

  return {
    moduleId: MODULE_ID,
    moduleName: MODULE_NAME,
    domainId: 'FORMAL_READINESS',
    score,
    confidence: confidenceBreakdown.combined,
    confidenceBreakdown,
    applicability,
    evidence: [
      ...input.extraction.evidence,
      ...input.candidateEvidence.map((item) => item.evidence),
    ],
    missingEvidence,
    breakdown,
    penalties: [],
    hardCaps,
    ledger,
    verdictCode,
    verdict: hardCaps.length > 0
      ? 'Brakuje co najmniej jednego krytycznego wymogu formalnego.'
      : score !== null && score >= 90
        ? 'Formalne wymagania oferty są spełnione bardzo dobrze.'
        : score !== null && score >= 70
          ? 'Większość formalnych wymagań jest spełniona, ale istnieją luki.'
          : 'Występują istotne braki względem formalnych wymagań oferty.',
    recommendations,
    formal: {
      mandatoryCoverage: mandatoryCoverage === null ? null : round(mandatoryCoverage),
      preferredCoverage: preferredCoverage === null ? null : round(preferredCoverage),
      unknownMandatoryWeightShare: 0,
      matches,
      groups: input.extraction.groups,
      missingCoreMustIds: missingCoreUnits.map((unit) => unit.id),
      adaptiveSignal: input.extraction.adaptiveSignal,
    },
  };
}
