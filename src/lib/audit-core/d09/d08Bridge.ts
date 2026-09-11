import type { AuditModuleResult } from '../contracts';
import {
  buildPlainTextCanonicalDocument,
  type CanonicalDocumentRepresentation,
  type CanonicalDocumentSource,
} from '../document';
import type { D08PdfExtractionResult } from '../d08/pdfAdapter';

export function buildCanonicalDocumentFromD08Pdf(
  extraction: D08PdfExtractionResult,
  d08Result: AuditModuleResult,
  source: CanonicalDocumentSource = 'EXTERNAL_DOCUMENT',
): CanonicalDocumentRepresentation {
  return buildPlainTextCanonicalDocument(extraction.extractedText, {
    source,
    // Celowo confidence, nie score D08. Job Alignment nie może być mnożony
    // przez ocenę layoutu, ale musi znać wiarygodność materiału wejściowego.
    extractionConfidence: d08Result.confidence,
    evidence: extraction.signals.evidence,
  });
}
