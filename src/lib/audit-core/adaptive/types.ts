export type AdaptiveModuleId =
  | 'MOD_STRUCTURAL_READABILITY'
  | 'MOD_JOB_ALIGNMENT'
  | 'MOD_FORMAL_REQUIREMENTS'
  | 'MOD_SKILL_RECENCY'
  | 'MOD_ROLE_ALIGNMENT'
  | 'MOD_IMPACT_QUANTIFICATION'
  | 'MOD_LINGUISTIC_NATURALNESS'
  | 'MOD_FACT_CONSISTENCY'
  | 'MOD_APPLICATION_READINESS'
  | 'MOD_CVELOCITY_CONSENSUS';

export type AdaptiveFeatureKind =
  | 'LEXEME'
  | 'CHARACTER_PATTERN'
  | 'NUMERIC_CONTEXT'
  | 'TEMPORAL_PATTERN'
  | 'ROLE_TITLE'
  | 'FORMAL_TERM'
  | 'CALIBRATION_ONLY';

export type AdaptiveSnapshotStatus = 'SHADOW' | 'VALIDATED' | 'ACTIVE' | 'REJECTED';

export interface AdaptiveCorpusDocument {
  id: string;
  text: string;
  labels: string[];
  sourceKind: 'REAL_ANONYMIZED' | 'SYNTHETIC' | 'ACADEMIC' | 'GOLDEN';
  weight?: number;
}

export interface AdaptiveLexemeFeature {
  feature: string;
  ngramSize: 1 | 2 | 3;
  label: string;
  supportPositive: number;
  supportNegative: number;
  positiveDocuments: number;
  negativeDocuments: number;
  positiveRate: number;
  negativeRate: number;
  logOdds: number;
  zScore: number;
  lift: number;
  confidence: number;
  direction: 'POSITIVE' | 'NEGATIVE';
}

export interface AdaptiveModulePolicy {
  moduleId: AdaptiveModuleId;
  featureKinds: AdaptiveFeatureKind[];
  learnableLabels: string[];
  minDocumentSupport: number;
  minAbsZScore: number;
  minLift: number;
  maxRuntimeInfluence: number;
  allowAutomaticActivation: boolean;
  notes: string;
}

export interface AdaptiveModuleModel {
  moduleId: AdaptiveModuleId;
  modelVersion: string;
  features: AdaptiveLexemeFeature[];
  sourceLabels: string[];
  trainedDocuments: number;
  effectiveDocuments: number;
}

export interface AdaptiveValidationMetrics {
  precision: number;
  recall: number;
  f1: number;
  expectedCalibrationError: number;
  rankInversions: number;
  medianAbsoluteScoreDrift: number;
  p95AbsoluteScoreDrift: number;
}

export interface AdaptiveCalibrationSnapshot {
  snapshotVersion: string;
  corpusFingerprint: string;
  createdAt: string;
  status: AdaptiveSnapshotStatus;
  moduleModels: Partial<Record<AdaptiveModuleId, AdaptiveModuleModel>>;
  validation?: Partial<Record<AdaptiveModuleId, AdaptiveValidationMetrics>>;
  privacy: {
    storesRawText: false;
    storesUserIdentifiers: false;
    minimumDocumentSupport: number;
    piiFiltered: true;
  };
}

export interface AdaptiveFeatureMatch {
  feature: string;
  label: string;
  strength: number;
  confidence: number;
}

export interface AdaptiveRuntimeSignal {
  moduleId: AdaptiveModuleId;
  evidenceStrength: number;
  confidence: number;
  matchedFeatures: AdaptiveFeatureMatch[];
  runtimeInfluenceCap: number;
  snapshotVersion: string | null;
}
