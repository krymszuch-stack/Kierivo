export type AuditMode = 'GENERAL_CV' | 'TARGETED_APPLICATION';

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

export type Severity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type PenaltySeverity = Exclude<Severity, 'INFO'>;
export type HardCapScope = 'MODULE' | 'DOMAIN' | 'GLOBAL';

export type SignalFamily =
  | 'STRUCTURE'
  | 'CONTACT'
  | 'TEMPORAL'
  | 'SKILL_PRESENCE'
  | 'SKILL_CONTEXT'
  | 'FORMAL_REQUIREMENT'
  | 'ROLE_ALIGNMENT'
  | 'METRIC_IMPACT'
  | 'LANGUAGE_QUALITY'
  | 'FACT_CONSISTENCY';

export type MonthIndex = number;

export interface AuditRunContext {
  auditRunId: string;
  engineVersion: string;
  configVersion: string;
  corpusSchemaVersion: string;
  mode: AuditMode;
  referenceMonth: MonthIndex;
}

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
  redactedSnippet?: string;
  contentHash?: string;
  extractionConfidence: number;
  /** Grupa korelacji używana do wyznaczania efektywnej liczby niezależnych dowodów. */
  correlationKey?: string;
  /** Waga epistemiczna atomu. Nie jest wagą score. */
  evidenceImportance?: number;
  signalFamily?: SignalFamily;
}

export interface MissingEvidence {
  id: string;
  requirementCode: string;
  targetScope: string;
  description: string;
  severity: Severity;
  expectedEvidenceWeight: number;
  suggestedAction: string;
}

export interface EvidenceRequirement {
  code: string;
  expectedWeight: number;
  required: boolean;
  modes?: AuditMode[];
}

export interface ScoreComponent {
  id: string;
  name: string;
  rawValue: number;
  normalizedValue: number;
  /** Waga przed legalną renormalizacją N/A. */
  baseWeight: number;
  /** Waga faktycznie wykorzystana w równaniu. */
  effectiveWeight: number;
  contribution: number;
  maxContribution: number;
  unrealizedPotential: number;
  evidenceIds: string[];
  signalFamily?: SignalFamily;
}

export interface Penalty {
  id: string;
  ruleCode: string;
  defectFingerprint: string;
  targetModuleId: string;
  targetComponentId?: string;
  severity: PenaltySeverity;
  requestedDeduction: number;
  appliedDeduction: number;
  evidenceIds: string[];
  explanation: string;
}

export interface HardCap {
  id: string;
  ruleCode: string;
  scope: HardCapScope;
  targetId: string;
  capLimit: number;
  triggered: boolean;
  reason: string;
  evidenceIds: string[];
  missingEvidenceIds?: string[];
}

export interface Recommendation {
  id: string;
  targetModuleId: string;
  targetSection: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  issue: string;
  suggestedAction: string;
  /** Orientacyjny przedział. Nigdy obietnica dokładnego wzrostu bez gwarancji modelu. */
  potentialScoreGainRange?: { min: number; max: number };
}

export interface ConfidenceBreakdown {
  coverage: number;
  provenance: number;
  extraction: number;
  sample: number;
  combined: number;
}

export interface ScoreLedgerComponentRow {
  componentId: string;
  name: string;
  earned: number;
  maximum: number;
  unrealized: number;
  effectiveWeight: number;
  evidenceIds: string[];
}

export interface ScoreLedgerPenaltyRow {
  penaltyId: string;
  ruleCode: string;
  requestedDeduction: number;
  appliedDeduction: number;
  defectFingerprint: string;
  evidenceIds: string[];
}

export interface ScoreLedgerCapRow {
  capId: string;
  ruleCode: string;
  scope: HardCapScope;
  capLimit: number;
  triggered: boolean;
  reason: string;
  evidenceIds: string[];
  missingEvidenceIds: string[];
}

export interface ScoreLedger {
  moduleId: string;
  componentTotal: number;
  penaltyTotal: number;
  scoreAfterPenalties: number;
  effectiveCap: number | null;
  finalScore: number | null;
  equationText: string;
  componentRows: ScoreLedgerComponentRow[];
  penaltyRows: ScoreLedgerPenaltyRow[];
  capRows: ScoreLedgerCapRow[];
  confidenceBreakdown: ConfidenceBreakdown;
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

export interface DomainContribution {
  moduleId: string;
  score: number;
  confidence: number;
  baseWeight: number;
  effectiveWeight: number;
}

export interface DomainResult {
  domainId: AuditDomainId;
  score: number | null;
  confidence: number;
  applicability: ApplicabilityState;
  contributingModules: string[];
  contributions: DomainContribution[];
  hardCaps: HardCap[];
  missingEvidence: MissingEvidence[];
  equationText: string;
}

export interface GlobalConsensusResult {
  auditRunId: string;
  engineVersion: string;
  mode: AuditMode;
  overallScore: number | null;
  overallConfidence: number;
  domainResults: Record<AuditDomainId, DomainResult>;
  moduleResults: Record<string, AuditModuleResult>;
  effectiveHardCaps: HardCap[];
  criticalMissingEvidence: MissingEvidence[];
  blockingIssues: string[];
  equationText: string;
  auditIntegritySignature: string;
}

export interface SignalOwnership {
  family: SignalFamily;
  primaryModuleId: string;
  secondaryConsumers: string[];
}

export type FieldKnowledgeState<T> =
  | { state: 'VALUE'; value: T }
  | { state: 'NOT_APPLICABLE' }
  | { state: 'UNKNOWN' }
  | { state: 'DECLINED' };
