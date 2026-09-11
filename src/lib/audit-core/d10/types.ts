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

export interface D10FormalRequirement {
  id: string;
  kind: D10FormalRequirementKind;
  priority: D10RequirementPriority;
  label: string;
  canonicalId: string;
  sourceText: string;
  extractionConfidence: number;
  weight: number;
  evidenceIds: string[];
  languageLevel?: CefrLevel;
  educationLevel?: EducationLevel;
  fieldConstraint?: string | null;
  issuerConstraint?: string | null;
  validityRequired?: boolean;
}

export interface D10RequirementExtractionResult {
  requirements: D10FormalRequirement[];
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
}

export interface D10FormalDiagnostics {
  mandatoryCoverage: number | null;
  preferredCoverage: number | null;
  unknownMandatoryWeightShare: number;
  matches: D10RequirementMatch[];
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
