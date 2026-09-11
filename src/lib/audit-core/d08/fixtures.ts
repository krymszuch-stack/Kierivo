import type { Evidence } from '../contracts';
import type { D08Signals } from './types';

const evidence = (
  id: string,
  jsonPath: string,
  description: string,
): Evidence => ({
  id,
  provenance: 'DERIVED_DETERMINISTIC',
  pointer: {
    source: 'CV',
    jsonPath,
  },
  description,
  extractionConfidence: 0.99,
});

export function createCleanD08Signals(): D08Signals {
  return {
    referenceProfile: 'SOURCE_AWARE',
    measurementHealth: {
      pipelineHealthy: true,
    },
    textLayer: {
      applicable: true,
      sourceTokenCount: 500,
      extractedTokenCount: 500,
      matchedTokenCount: 500,
      evidenceIds: ['EV_TEXT_LAYER'],
    },
    readingOrder: {
      comparablePairWeight: 100,
      discordantPairWeight: 0,
      measurementConfidence: 1,
      evidenceIds: ['EV_READING_ORDER'],
    },
    sections: {
      applicable: true,
      labelMacroF1: 1,
      boundaryF1: 1,
      evidenceIds: ['EV_SECTIONS'],
    },
    layout: {
      overlapRatio: 0,
      clippingRatio: 0,
      ambiguousZOrderRatio: 0,
      nestedComplexityRatio: 0,
      evidenceIds: ['EV_LAYOUT'],
    },
    encoding: {
      weightedDamageRatio: 0,
      evidenceIds: ['EV_ENCODING'],
    },
    headings: {
      applicable: true,
      meanSeparationScore: 1,
      levelConsistency: 1,
      evidenceIds: ['EV_HEADINGS'],
    },
    structuredFields: [
      { kind: 'DATE', parseability: 1, evidenceId: 'EV_DATE_1' },
      { kind: 'EMAIL', parseability: 1, evidenceId: 'EV_EMAIL' },
      { kind: 'PHONE', parseability: 1, evidenceId: 'EV_PHONE' },
    ],
    lists: {
      applicable: true,
      glyphConsistency: 1,
      indentQuality: 1,
      hangingIndentRatio: 1,
      evidenceIds: ['EV_LISTS'],
    },
    adversarial: {
      hiddenTextMeasured: true,
      duplicateInvisibleLayerMeasured: true,
      hiddenTextRatio: 0,
      duplicateInvisibleLayerRatio: 0,
      hiddenTextEvidenceIds: [],
      duplicateLayerEvidenceIds: [],
    },
    confidenceInput: {
      expectedEvidenceWeight: 1,
      fulfilledEvidenceWeight: 1,
      provenanceReliability: 0.95,
      extractionQuality: 0.99,
      independentEvidenceCount: 12,
      sampleScaleK: 4,
    },
    evidence: [
      evidence('EV_TEXT_LAYER', 'document.textLayer', 'Warstwa tekstowa zachowana 1:1.'),
      evidence('EV_READING_ORDER', 'document.readingOrder', 'Brak niezgodności kolejności.'),
      evidence('EV_SECTIONS', 'document.sections', 'Sekcje rozpoznane i poprawnie odgraniczone.'),
      evidence('EV_LAYOUT', 'document.layout', 'Brak overlap/clipping/z-order ambiguity.'),
      evidence('EV_ENCODING', 'document.encoding', 'Brak nierozwiązanych uszkodzeń kodowania.'),
      evidence('EV_HEADINGS', 'document.headings', 'Nagłówki jednoznacznie odróżnialne.'),
      evidence('EV_LISTS', 'document.lists', 'Listy mają spójne glify i wcięcia.'),
    ],
  };
}

export function cloneD08Signals(signals: D08Signals): D08Signals {
  return structuredClone(signals);
}
