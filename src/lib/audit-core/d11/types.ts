import type { AuditModuleResult, Evidence, MissingEvidence, MonthIndex } from '../contracts';
import type { D09JobRequirement } from '../d09/types';

export type D11RequirementRecencyStatus =
  | 'SCORED'
  | 'NO_DATED_EVIDENCE'
  | 'INVALID_TEMPORAL_EVIDENCE';

export interface D11DatedSkillEvidence {
  id: string;
  requirementId: string;
  canonicalId: string;
  label: string;
  observedMonth: MonthIndex;
  ageMonths: number;
  semanticStrength: number;
  decay: number;
  scoreValue: number;
  evidence: Evidence;
}

export interface D11RequirementRecency {
  requirement: D09JobRequirement;
  status: D11RequirementRecencyStatus;
  halfLifeMonths: number;
  freshestAgeMonths: number | null;
  normalizedRecency: number | null;
  bestEvidenceId: string | null;
}

export interface D11RecencyDiagnostics {
  halfLifeMonths: number;
  matchedSkillRequirementCount: number;
  scoredRequirementCount: number;
  scoredRequirementWeight: number;
  matchedRequirementWeight: number;
  requirements: D11RequirementRecency[];
  datedEvidence: D11DatedSkillEvidence[];
  temporalMissingEvidence: MissingEvidence[];
}

export interface D11ScoringInput {
  referenceMonth: MonthIndex;
  halfLifeMonths?: number;
  requirements: D09JobRequirement[];
  evidenceByRequirementId: Map<string, D11DatedSkillEvidence[]>;
  invalidTemporalRequirementIds?: Set<string>;
}

export interface D11AuditResult extends AuditModuleResult {
  recency: D11RecencyDiagnostics;
}
