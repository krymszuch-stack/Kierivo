import type { AuditModuleResult } from '../contracts';
import { scoreStructuralReadability } from './scorer';
import type { D08Signals } from './types';
import {
  extractD08SignalsFromPdf as extractRawD08SignalsFromPdf,
  type D08PdfExtractionResult,
} from './pdfAdapter';

/**
 * PDF.js może wiarygodnie wykryć identyczne fragmenty tekstu w tych samych
 * współrzędnych, ale bez analizy renderingu/stylu nie dowodzi, że druga warstwa
 * jest niewidzialna. D08 nie może zamieniać "duplicate" w
 * "duplicate invisible" bez evidence.
 *
 * Ta bramka celowo zachowuje sam ratio diagnostyczny, ale wyłącza możliwość
 * nałożenia kary/capu do czasu pojawienia się niezależnego dowodu widoczności.
 */
export function hardenD08PdfSignals(rawSignals: D08Signals): D08Signals {
  const signals = structuredClone(rawSignals);
  signals.adversarial.duplicateInvisibleLayerMeasured = false;
  return signals;
}

export async function extractD08SignalsFromPdf(file: File): Promise<D08PdfExtractionResult> {
  const result = await extractRawD08SignalsFromPdf(file);
  return {
    ...result,
    signals: hardenD08PdfSignals(result.signals),
  };
}

export async function auditPdfStructuralReadability(file: File): Promise<AuditModuleResult> {
  try {
    const { signals } = await extractD08SignalsFromPdf(file);
    return scoreStructuralReadability(signals);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedSignals: D08Signals = {
      referenceProfile: 'EXTERNAL_DOCUMENT',
      measurementHealth: {
        pipelineHealthy: false,
        failureCode: 'D08_PDF_EXTRACTION_EXCEPTION',
        failureMessage: message,
      },
      textLayer: { applicable: false, evidenceIds: [] },
      readingOrder: { comparablePairWeight: 0, discordantPairWeight: 0, evidenceIds: [] },
      sections: { applicable: false, evidenceIds: [] },
      layout: { evidenceIds: [] },
      encoding: { weightedDamageRatio: 0, evidenceIds: [] },
      headings: { applicable: false, evidenceIds: [] },
      structuredFields: [],
      lists: { applicable: false, evidenceIds: [] },
      adversarial: {
        hiddenTextMeasured: false,
        duplicateInvisibleLayerMeasured: false,
        hiddenTextEvidenceIds: [],
        duplicateLayerEvidenceIds: [],
      },
      confidenceInput: {
        expectedEvidenceWeight: 1,
        fulfilledEvidenceWeight: 0,
        provenanceReliability: 0,
        extractionQuality: 0,
        independentEvidenceCount: 0,
        sampleScaleK: 4,
      },
      evidence: [],
    };
    return scoreStructuralReadability(failedSignals);
  }
}
