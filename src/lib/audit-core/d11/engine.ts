import type { MasterVault, WorkExperience } from '../../../types';
import type { Evidence, MonthIndex } from '../contracts';
import { runD09FromVault } from '../d09/engine';
import {
  findD09EntitiesInText,
  getD09OntologyEntity,
  normalizeD09EntityText,
  resolveD09SemanticRelation,
} from '../d09/ontology';
import type { D09JobRequirement, D09RequirementMatch } from '../d09/types';
import { toMonthIndex } from '../temporal';
import { halfLifeDecay, scoreD11SkillRecency } from './scorer';
import type { D11AuditResult, D11DatedSkillEvidence } from './types';

function parseExactMonth(value: string | undefined): MonthIndex | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  const match = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(normalized);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || year > 2200 || month < 1 || month > 12) return null;
  return toMonthIndex(year, month);
}

function experienceText(experience: WorkExperience): string {
  return [
    experience.role,
    experience.description ?? '',
    ...experience.highlights.map((highlight) => [
      highlight.text,
      highlight.action,
      highlight.target,
      highlight.tool,
      highlight.metric,
      ...highlight.keywords,
    ].join(' ')),
  ].join(' ');
}

function literalRequirementMatch(requirement: D09JobRequirement, text: string): boolean {
  const needle = normalizeD09EntityText(requirement.label);
  if (needle.length < 3) return false;
  return normalizeD09EntityText(text).includes(needle);
}

function semanticStrengthForRequirement(requirement: D09JobRequirement, text: string): number {
  const knownRequirement = getD09OntologyEntity(requirement.canonicalId);
  if (!knownRequirement) return literalRequirementMatch(requirement, text) ? 1 : 0;

  let best = 0;
  for (const entity of findD09EntitiesInText(text)) {
    best = Math.max(best, resolveD09SemanticRelation(requirement.canonicalId, entity.id).strength);
  }
  return best;
}

function matchedSkillRequirements(matches: readonly D09RequirementMatch[]): D09JobRequirement[] {
  const seen = new Set<string>();
  const requirements: D09JobRequirement[] = [];
  for (const match of matches) {
    if (match.requirement.kind !== 'SKILL') continue;
    if (match.status !== 'CONFIRMED' && match.status !== 'PARTIAL') continue;
    if (seen.has(match.requirement.id)) continue;
    seen.add(match.requirement.id);
    requirements.push(match.requirement);
  }
  return requirements;
}

function buildObservation(input: {
  requirement: D09JobRequirement;
  experience: WorkExperience;
  experienceIndex: number;
  referenceMonth: MonthIndex;
  halfLifeMonths: number;
}): { observation: D11DatedSkillEvidence | null; invalidTemporal: boolean } {
  const text = experienceText(input.experience);
  const semanticStrength = semanticStrengthForRequirement(input.requirement, text);
  if (semanticStrength <= 0) return { observation: null, invalidTemporal: false };

  const startMonth = parseExactMonth(input.experience.startDate);
  if (startMonth !== null && startMonth > input.referenceMonth) {
    return { observation: null, invalidTemporal: true };
  }

  const observedMonth: MonthIndex | null = input.experience.isCurrent
    ? input.referenceMonth
    : parseExactMonth(input.experience.endDate);

  if (observedMonth === null || observedMonth > input.referenceMonth) {
    return { observation: null, invalidTemporal: true };
  }
  if (startMonth !== null && observedMonth < startMonth) {
    return { observation: null, invalidTemporal: true };
  }

  const ageMonths = input.referenceMonth - observedMonth;
  const decay = halfLifeDecay(ageMonths, input.halfLifeMonths);
  const scoreValue = decay * semanticStrength;
  const id = `D11_E_${input.requirement.id}_${input.experience.id}`;
  const evidence: Evidence = {
    id,
    provenance: 'USER_ASSERTED_CANONICAL',
    pointer: {
      source: 'VAULT',
      jsonPath: `history[${input.experienceIndex}]`,
    },
    description: `Datowany dowód użycia „${input.requirement.label}” w roli „${input.experience.role}”.`,
    normalizedPayload: {
      requirementId: input.requirement.id,
      canonicalId: input.requirement.canonicalId,
      observedMonth,
      ageMonths,
      semanticStrength,
      decay,
      scoreValue,
    },
    extractionConfidence: 1,
    correlationKey: `D11:${input.requirement.id}:${input.experience.id}`,
    evidenceImportance: Math.max(0.1, input.requirement.weight),
  };

  return {
    observation: {
      id,
      requirementId: input.requirement.id,
      canonicalId: input.requirement.canonicalId,
      label: input.requirement.label,
      observedMonth,
      ageMonths,
      semanticStrength,
      decay,
      scoreValue,
      evidence,
    },
    invalidTemporal: false,
  };
}

export async function runD11FromVault(input: {
  vault: MasterVault;
  jobDescription: string;
  referenceMonth: MonthIndex;
  halfLifeMonths?: number;
  vaultCompletenessConfidence?: number;
}): Promise<D11AuditResult> {
  const halfLifeMonths = input.halfLifeMonths ?? 48;
  const d09 = await runD09FromVault({
    vault: input.vault,
    jobDescription: input.jobDescription,
    vaultCompletenessConfidence: input.vaultCompletenessConfidence,
  });

  const requirements = matchedSkillRequirements(d09.alignment.requirementMatches);
  const evidenceByRequirementId = new Map<string, D11DatedSkillEvidence[]>();
  const invalidTemporalRequirementIds = new Set<string>();

  for (const requirement of requirements) {
    const observations: D11DatedSkillEvidence[] = [];
    for (const [experienceIndex, experience] of input.vault.history.entries()) {
      const result = buildObservation({
        requirement,
        experience,
        experienceIndex,
        referenceMonth: input.referenceMonth,
        halfLifeMonths,
      });
      if (result.observation) observations.push(result.observation);
      if (result.invalidTemporal) invalidTemporalRequirementIds.add(requirement.id);
    }
    if (observations.length > 0) evidenceByRequirementId.set(requirement.id, observations);
  }

  return scoreD11SkillRecency({
    referenceMonth: input.referenceMonth,
    halfLifeMonths,
    requirements,
    evidenceByRequirementId,
    invalidTemporalRequirementIds,
  });
}
