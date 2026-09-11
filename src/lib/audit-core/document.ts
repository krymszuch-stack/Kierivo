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

const SECTION_PATTERNS: Array<{ section: CanonicalSectionKind; pattern: RegExp }> = [
  { section: 'SUMMARY', pattern: /^(summary|professional summary|profil|podsumowanie|podsumowanie zawodowe)$/i },
  { section: 'SKILLS', pattern: /^(skills|technical skills|umiejętności|umiejetnosci|kluczowe umiejętności.*)$/i },
  { section: 'EXPERIENCE', pattern: /^(experience|work experience|employment history|doświadczenie|doswiadczenie|doświadczenie zawodowe)$/i },
  { section: 'PROJECTS', pattern: /^(projects|projekty)$/i },
  { section: 'EDUCATION', pattern: /^(education|edukacja|wykształcenie|wyksztalcenie)$/i },
  { section: 'CERTIFICATIONS', pattern: /^(certifications|certificates|certyfikaty|certyfikacje)$/i },
  { section: 'LANGUAGES', pattern: /^(languages|języki|jezyki)$/i },
];

function sectionFromHeading(line: string): CanonicalSectionKind | null {
  const normalized = line
    .normalize('NFKC')
    .replace(/[.:;|/\\_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const candidate of SECTION_PATTERNS) {
    if (candidate.pattern.test(normalized)) return candidate.section;
  }
  return null;
}

function segmentText(
  normalized: string,
  extractionConfidence: number,
): CanonicalDocumentBlock[] {
  if (!normalized) return [];
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  const blocks: CanonicalDocumentBlock[] = [];
  let currentSection: CanonicalSectionKind = 'HEADER';
  let buffer: string[] = [];
  let blockIndex = 0;

  const flush = (): void => {
    if (buffer.length === 0) return;
    blocks.push({
      id: `text_block_${blockIndex}`,
      text: buffer.join('\n'),
      section: currentSection,
      sourcePath: `plain.blocks[${blockIndex}]`,
      extractionConfidence,
      evidenceIds: [],
    });
    blockIndex += 1;
    buffer = [];
  };

  for (const line of lines) {
    const detected = sectionFromHeading(line);
    if (detected) {
      flush();
      currentSection = detected;
      continue;
    }
    buffer.push(line);
  }
  flush();

  return blocks;
}

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
    blocks: segmentText(normalized, extractionConfidence),
    extractionConfidence,
    evidence: [...(options?.evidence ?? [])],
  };
}
