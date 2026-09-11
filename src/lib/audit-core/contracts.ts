export type ApplicabilityState =
  | 'APPLICABLE'
  | 'PARTIALLY_APPLICABLE'
  | 'NOT_APPLICABLE'
  | 'INSUFFICIENT_DATA';

export type AuditDomainId =
  | 'DOCUMENT_QUALITY'
  | 'JOB_FIT'
  | 'EVIDENCE_QUALITY'
  | 'INTEGRITY'
  | 'FORMAL_READINESS';

export type EvidenceProvenance =
  | 'USER_ASSERTED_CANONICAL'
  | 'EXPLICIT_DOCUMENT_FACT'
  | 'CROSS_SOURCE_CONSISTENT'
  | 'DERIVED_DETERMINISTIC'
  | 'EXTERNALLY_VERIFIED'
  | 'INFERRED_HEURISTIC'
  | 'CONTRADICTION'
  | 'ADVERSARIAL_SIGNAL';

export interface SourcePointer {
  source: 'CV' | 'VAULT' | 'JOB';
  jsonPath: string;
  charStart?: number;
  charEnd?: number;
}

export interface Evidence {
  id: string;
  provenance: EvidenceProvenance;
  pointer: SourcePointer;
  description: string;
  normalizedPayload?: Record<string, string | number | boolean | null>;
  extractionConfidence: number;
}

export interface MissingEvidence {
  id: string;
  requirementCode: string;
  targetScope: string;
  description: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  expectedEvidenceWeight: number;
  suggestedAction: string;
}

export interface ScoreComponent {
  id: string;
  name: string;
  rawValue: number;
  normalizedValue: number;
  baseWeight: number;
  effectiveWeight: number;
  contribution: number;
  maxContribution: number;
  unrealizedPotential: number;
  evidenceIds: string[];
}

export interface Penalty {
  id: string;
  ruleCode: string;
  defectFingerprint: string;
  targetModuleId: string;
  targetComponentId?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  requestedDeduction: number;
  appliedDeduction: number;
  evidenceIds: string[];
  explanation: string;
}

export type HardCapScope = 'MODULE' | 'DOMAIN' | 'GLOBAL';

export interface HardCap {
  id: string;
  ruleCode: string;
  scope: HardCapScope;
  targetId: string;
  capLimit: number;
  triggered: boolean;
  reason: string;
  evidenceIds: string[];
}

export interface Recommendation {
  id: string;
  targetModuleId: string;
  targetSection: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  issue: string;
  suggestedAction: string;
  potentialScoreGain: number;
}

export interface ConfidenceBreakdown {
  coverage: number;
  provenance: number;
  extraction: number;
  sample: number;
  combined: number;
}

export interface ScoreLedger {
  componentScore: number;
  penaltyTotal: number;
  afterPenalties: number;
  effectiveCap: number | null;
  finalScore: number;
  equation: string;
}

export interface AuditModuleResult {
  moduleId: string;
  moduleName: string;
  domainId: AuditDomainId;
  score: number | null;
  confidence: number;
  confidenceBreakdown: ConfidenceBreakdown;
  applicability: ApplicabilityState;
  evidence: Evidence[];
  missingEvidence: MissingEvidence[];
  breakdown: ScoreComponent[];
  penalties: Penalty[];
  hardCaps: HardCap[];
  ledger: ScoreLedger | null;
  verdictCode: string;
  verdict: string;
  recommendations: Recommendation[];
}
