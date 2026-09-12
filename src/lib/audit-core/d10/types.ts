import type {
  AdaptiveRuntimeSignal,
} from '../adaptive/types';
import type {
  AuditModuleResult,
  Evidence,
} from '../contracts';

export type D10FormalRequirementKind =
  | 'LICENSE'
  | 'CERTIFICATION'
  | 'LANGUAGE'
  | 'EDUCATION'
  | 'DRIVING_LICENSE'
  | 'WORK_AUTHORIZATION'
  | 'CLEARANCE'
  | 'OTHER_FORMAL';

export type D10RequirementPriority = 'CORE_MUST' | 'MUST' | 'PREFERRED';
export type D10RequirementGroupOperator = 'ANY_OF' | 'ALL_OF';

export type D10RequirementStatus =
  | 'CONFIRMED'
  | 'PARTIAL'
  | 'NOT_FOUND'
  | 'UNKNOWN';

export type D10CandidateSource =
  | 'VAULT_LANGUAGE'
  | 'VAULT_LICENSE'
  | 'VAULT_CERTIFICATION'
  | 'VAULT_EDUCATION'
  | 'DOCUMENT_EXPLICIT'
  | 'DOCUMENT_INFERRED';

export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'NATIVE';

export type EducationLevel =
  | 'PRIMARY'
  | 'VOCATIONAL'
  | 'SECONDARY'
  | 'BACHELOR'
  | 'MASTER'
  | 'DOCTORATE';

export interface D10SourceSpan {
  /** Offset within the line identified by the Evidence jsonPath. */
  start: number;
  /** Exclusive end offset within the same line. */
  end: number;
}

export interface D10FormalRequirement {
  id: string;
  kind: D10FormalRequirementKind;
  priority: D10RequirementPriority;
  label: string;
  canonicalId: string;
  sourceText: string;
  sourceSpan?: D10SourceSpan;
  extractionConfidence: number;
  weight: number;
  evidenceIds: string[];
  groupId?: string;
  groupOperator?: D10RequirementGroupOperator;
  languageLevel?: CefrLevel;
  educationLevel?: EducationLevel;
  fieldConstraint?: string | null;
  issuerConstraint?: string | null;
  validityRequired?: boolean;
}

export interface D10RequirementGroup {
  id: string;
  operator: D10RequirementGroupOperator;
  priority: D10RequirementPriority;
  memberRequirementIds: string[];
  memberCanonicalIds: string[];
  sourceText: string;
  extractionConfidence: number;
  evidenceIds: string[];
}

export interface D10RequirementExtractionResult {
  requirements: D10FormalRequirement[];
  groups: D10RequirementGroup[];
  parserConfidence: number;
  evidence: Evidence[];
  requirementLikeLines: number;
  parsedRequirementLines: number;
  adaptiveSignal?: AdaptiveRuntimeSignal;
}

export interface D10CandidateEvidence {
  id: string;
  kind: D10FormalRequirementKind;
  label: string;
  canonicalId: string;
  source: D10CandidateSource;
  extractionConfidence: number;
  evidence: Evidence;
  sourceSpan?: D10SourceSpan;
  languageLevel?: CefrLevel;
  educationLevel?: EducationLevel;
  fieldOfStudy?: string | null;
  issuer?: string | null;
  issuedAt?: string | null;
  validUntil?: string | null;
}

export interface D10RequirementMatch {
  requirement: D10FormalRequirement;
  status: D10RequirementStatus;
  fulfillment: number;
  bestEvidenceId: string | null;
  bestEvidenceLabel: string | null;
  explanation: string;
  /** Punkty widoczne w UI; null gdy moduł nie może uczciwie wystawić score. */
  earnedPoints?: number | null;
  maxPoints?: number | null;
}

export interface D10FormalDiagnostics {
  mandatoryCoverage: number | null;
  preferredCoverage: number | null;
  unknownMandatoryWeightShare: number;
  matches: D10RequirementMatch[];
  groups: D10RequirementGroup[];
  missingCoreMustIds: string[];
  adaptiveSignal?: AdaptiveRuntimeSignal;
}

export interface D10ScoringInput {
  extraction: D10RequirementExtractionResult;
  candidateEvidence: D10CandidateEvidence[];
  sourceMode: 'VAULT' | 'EXTRACTED_DOCUMENT';
  sourceCompletenessConfidence: number;
  /** ISO date injected by the audit run. Never use Date.now() in scorer logic. */
  referenceDateIso: string;
}

export interface D10AuditResult extends AuditModuleResult {
  formal: D10FormalDiagnostics;
}
