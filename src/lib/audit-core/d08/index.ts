export type {
  D08AdversarialSignals,
  D08ComponentId,
  D08EncodingSignals,
  D08HeadingSignals,
  D08LayoutSignals,
  D08ListSignals,
  D08MeasurementHealth,
  D08ReadingOrderSignals,
  D08ReferenceProfile,
  D08SectionSignals,
  D08Signals,
  D08StructuredFieldSignal,
  D08TextLayerSignals,
} from './types';

export type {
  D08EncodingAnalysis,
  D08EncodingAnomaly,
  D08EncodingAnomalyType,
  D08OrderStats,
  D08TokenAgreement,
} from './extractor';

export type { D08PdfExtractionResult } from './pdfAdapter';

export {
  analyzeD08Encoding,
  computeD08TokenAgreement,
  computeD08WeightedOrderStats,
  normalizeD08Text,
  tokenizeD08Text,
} from './extractor';

export {
  auditPdfStructuralReadability,
  extractD08SignalsFromPdf,
  hardenD08PdfSignals,
} from './pdfAudit';

export {
  D08_BASE_WEIGHTS,
  D08_CONFIG,
  D08_MODULE_ID,
  D08_MODULE_NAME,
  scoreStructuralReadability as scoreStructuralReadabilityUnchecked,
} from './scorer';

export {
  D08_READING_ORDER_MIN_SCORING_CONFIDENCE,
  hardenD08ScoringSignals,
  scoreStructuralReadability,
} from './strictScorer';
