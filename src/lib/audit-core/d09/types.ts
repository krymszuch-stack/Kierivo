import type { AuditModuleResult, Evidence } from '../contracts';
import type { DocumentClass } from '../ingestion/documentGate';

export type D09RequirementPriority = 'CORE_MUST' | 'MUST' | 'NICE';
export type D09RequirementKind = 'SKILL' | 'DOMAIN' | 'SOFT_SKILL' | 'FORMAL_REFERENCE';
export type D09MatchType =
  | 'EXACT'
  | 'ALIAS'
  | 'EVIDENCE_SUBTYPE_OF_REQUIREMENT'
  | 'EVIDENCE_SUPERTYPE_OF_REQUIREMENT'
  | 'RELATED_ONLY'
  | 'NONE';

export type D09RequirementStatus =
  | 'CONFIRMED'
  | 'PARTIAL'
  | 'NOT_FOUND'
  | 'UNKNOWN'
  | 'DEFERRED_FORMAL';

export type D09CandidateSource =
  | 'VAULT_SKILL'
  | 'VAULT_SUMMARY'
  | 'VAULT_PROJECT'
  | 'VAULT_EXPERIENCE'
  | 'DOCUMENT_SKILLS'
  | 'DOCUMENT_SUMMARY'
  | 'DOCUMENT_PROJECT'
  | 'DOCUMENT_EXPERIENCE'
  | 'DOCUMENT_UNKNOWN'
  | 'INFERRED_SEMANTIC';

export interface D09JobRequirement {
  id: string;
  label: string;
  canonicalId: string;
  kind: D09RequirementKind;
  priority: D09RequirementPriority;
  weight: number;
  sourceText: string;
  extractionConfidence: number;
  evidenceIds: string[];
}

export interface D09RequirementExtractionResult {
  requirements: D09JobRequirement[];
  parserConfidence: number;
  evidence: Evidence[];
  requirementLikeLines: number;
  parsedRequirementLines: number;
}

export interface D09CandidateEvidence {
  id: string;
  canonicalId: string;
  label: string;
  source: D09CandidateSource;
  sourceLabel: string;
  evidenceDepth: number;
  extractionConfidence: number;
  evidence: Evidence;
}

export interface D09RequirementMatch {
  requirement: D09JobRequirement;
  status: D09RequirementStatus;
  matchType: D09MatchType;
  semanticStrength: number;
  evidenceDepth: number;
  fulfillment: number;
  bestEvidenceId: string | null;
  bestEvidenceSource: string | null;
}

export interface D09UncertaintyRange {
  low: number;
  high: number;
  width: number;
  unknownMustWeightShare: number;
}

export interface D09AlignmentDiagnostics {
  arithmeticMust: number | null;
  geometricMust: number | null;
  asymmetricMustIndex: number | null;
  niceCoverage: number | null;
  mustCurveValue: number | null;
  niceCurveValue: number | null;
  niceGate: number | null;
  requirementMatches: D09RequirementMatch[];
  deferredFormalRequirements: D09JobRequirement[];
  uncertainty: D09UncertaintyRange;
}

export interface D09ScoringInput {
  extraction: D09RequirementExtractionResult;
  candidateEvidence: D09CandidateEvidence[];
  documentClass: DocumentClass;
  sourceCompletenessConfidence: number;
  sourceMode: 'VAULT' | 'EXTRACTED_DOCUMENT';
}

export interface D09AuditResult extends AuditModuleResult {
  alignment: D09AlignmentDiagnostics;
}
