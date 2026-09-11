import type { Evidence } from './contracts';

export type CanonicalSectionKind =
  | 'HEADER'
  | 'SUMMARY'
  | 'SKILLS'
  | 'EXPERIENCE'
  | 'PROJECTS'
  | 'EDUCATION'
  | 'CERTIFICATIONS'
  | 'LANGUAGES'
  | 'OTHER'
  | 'UNKNOWN';

export type CanonicalDocumentSource = 'CVELOCITY_VAULT' | 'CVELOCITY_EXPORT' | 'EXTERNAL_DOCUMENT';

export interface CanonicalDocumentBlock {
  id: string;
  text: string;
  section: CanonicalSectionKind;
  sourcePath: string;
  extractionConfidence: number;
  evidenceIds: string[];
}

export interface CanonicalDocumentRepresentation {
  source: CanonicalDocumentSource;
  fullText: string;
  blocks: CanonicalDocumentBlock[];
  extractionConfidence: number;
  evidence: Evidence[];
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function buildPlainTextCanonicalDocument(
  text: string,
  options?: {
    source?: CanonicalDocumentSource;
    extractionConfidence?: number;
    evidence?: Evidence[];
  },
): CanonicalDocumentRepresentation {
  const normalized = text.normalize('NFKC').replace(/\r\n?/g, '\n').trim();
  const extractionConfidence = clamp01(options?.extractionConfidence ?? 0.5);
  return {
    source: options?.source ?? 'EXTERNAL_DOCUMENT',
    fullText: normalized,
    blocks: normalized
      ? normalized.split(/\n{2,}|\n(?=[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ\s/&+-]{2,}$)/m)
        .map((block, index) => ({
          id: `plain_block_${index}`,
          text: block.trim(),
          section: 'UNKNOWN' as const,
          sourcePath: `plain.blocks[${index}]`,
          extractionConfidence,
          evidenceIds: [],
        }))
        .filter((block) => block.text.length > 0)
      : [],
    extractionConfidence,
    evidence: [...(options?.evidence ?? [])],
  };
}
