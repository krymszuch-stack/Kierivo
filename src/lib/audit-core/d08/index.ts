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

export {
  analyzeD08Encoding,
  computeD08TokenAgreement,
  computeD08WeightedOrderStats,
  normalizeD08Text,
  tokenizeD08Text,
} from './extractor';

export {
  D08_BASE_WEIGHTS,
  D08_CONFIG,
  D08_MODULE_ID,
  D08_MODULE_NAME,
  scoreStructuralReadability,
} from './scorer';
