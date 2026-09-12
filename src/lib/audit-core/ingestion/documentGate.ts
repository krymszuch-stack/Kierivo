export type DocumentClass = 'CV' | 'NON_CV' | 'UNKNOWN';

export interface DocumentGateResult {
  documentClass: DocumentClass;
  confidence: number;
  reasons: string[];
}

const CV_HEADINGS = [
  /\bexperience\b/i,
  /\bwork experience\b/i,
  /\bemployment history\b/i,
  /\bdoświadczenie\b/i,
  /\beducation\b/i,
  /\bwykształcenie\b/i,
  /\bedukacja\b/i,
  /\bskills\b/i,
  /\bumiejętności\b/i,
  /\bprojects\b/i,
  /\bprojekty\b/i,
];

const NON_CV_PATTERNS = [
  /\bhow to (write|create|improve) (a )?cv\b/i,
  /\bjak (napisać|stworzyć|poprawić) (dobre )?cv\b/i,
  /\bporadnik\b.*\bcv\b/i,
  /\bmetoda 5 why\b/i,
  /\bgóra lodowa\b/i,
  /\biceberg model\b/i,
];

const CONTACT_PATTERN = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?\d[\d ()-]{7,}\d)/;

export function classifyDocumentForAudit(text: string): DocumentGateResult {
  const normalized = text.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { documentClass: 'UNKNOWN', confidence: 0, reasons: ['EMPTY_DOCUMENT'] };
  }

  const headingHits = CV_HEADINGS.filter((pattern) => pattern.test(normalized)).length;
  const hasContact = CONTACT_PATTERN.test(normalized);
  const nonCvHits = NON_CV_PATTERNS.filter((pattern) => pattern.test(normalized)).length;

  if (nonCvHits >= 2 && headingHits === 0 && !hasContact) {
    return {
      documentClass: 'NON_CV',
      confidence: Math.min(0.95, 0.75 + 0.08 * nonCvHits),
      reasons: ['TUTORIAL_OR_INFOGRAPHIC_PATTERNS', 'NO_CV_STRUCTURE_CUES'],
    };
  }

  if (headingHits >= 2 || (headingHits >= 1 && hasContact)) {
    return {
      documentClass: 'CV',
      confidence: Math.min(0.98, 0.70 + 0.08 * headingHits + (hasContact ? 0.08 : 0)),
      reasons: ['CV_SECTION_CUES', ...(hasContact ? ['CONTACT_CUE'] : [])],
    };
  }

  return {
    documentClass: 'UNKNOWN',
    confidence: 0.45,
    reasons: ['INSUFFICIENT_CLASSIFICATION_EVIDENCE'],
  };
}
