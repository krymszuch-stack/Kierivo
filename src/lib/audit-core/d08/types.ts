import type { ConfidenceInput } from '../confidence';
import type { Evidence } from '../contracts';

export type D08ReferenceProfile = 'SOURCE_AWARE' | 'EXTERNAL_DOCUMENT';

export type D08ComponentId =
  | 'TEXT_LAYER'
  | 'READING_ORDER'
  | 'SECTION_TOPOLOGY'
  | 'LAYOUT_TOPOLOGY'
  | 'ENCODING'
  | 'HEADINGS'
  | 'STRUCTURED_FIELDS'
  | 'LISTS';

export interface D08TextLayerSignals {
  applicable: boolean;
  sourceTokenCount?: number;
  extractedTokenCount?: number;
  matchedTokenCount?: number;
  independentAgreementF1?: number;
  nativeTextCoverage?: number;
  evidenceIds: string[];
}

export interface D08ReadingOrderSignals {
  comparablePairWeight: number;
  discordantPairWeight: number;
  evidenceIds: string[];
}

export interface D08SectionSignals {
  applicable: boolean;
  labelMacroF1?: number;
  boundaryF1?: number;
  externalDeterministicMatch?: number;
  externalBoundaryConsistency?: number;
  evidenceIds: string[];
}

export interface D08LayoutSignals {
  overlapRatio?: number;
  clippingRatio?: number;
  ambiguousZOrderRatio?: number;
  nestedComplexityRatio?: number;
  evidenceIds: string[];
}

export interface D08EncodingSignals {
  weightedDamageRatio: number;
  evidenceIds: string[];
}

export interface D08HeadingSignals {
  applicable: boolean;
  meanSeparationScore?: number;
  levelConsistency?: number;
  evidenceIds: string[];
}

export interface D08StructuredFieldSignal {
  kind: 'DATE' | 'EMAIL' | 'PHONE' | 'URL' | 'OTHER';
  parseability: number;
  evidenceId: string;
}

export interface D08ListSignals {
  applicable: boolean;
  glyphConsistency?: number;
  indentQuality?: number;
  hangingIndentRatio?: number;
  evidenceIds: string[];
}

export interface D08AdversarialSignals {
  hiddenTextMeasured: boolean;
  duplicateInvisibleLayerMeasured: boolean;
  hiddenTextRatio?: number;
  duplicateInvisibleLayerRatio?: number;
  hiddenTextEvidenceIds: string[];
  duplicateLayerEvidenceIds: string[];
}

export interface D08MeasurementHealth {
  pipelineHealthy: boolean;
  failureCode?: string;
  failureMessage?: string;
}

export interface D08Signals {
  referenceProfile: D08ReferenceProfile;
  measurementHealth: D08MeasurementHealth;
  textLayer: D08TextLayerSignals;
  readingOrder: D08ReadingOrderSignals;
  sections: D08SectionSignals;
  layout: D08LayoutSignals;
  encoding: D08EncodingSignals;
  headings: D08HeadingSignals;
  structuredFields: D08StructuredFieldSignal[];
  lists: D08ListSignals;
  adversarial: D08AdversarialSignals;
  confidenceInput: ConfidenceInput;
  evidence: Evidence[];
}
