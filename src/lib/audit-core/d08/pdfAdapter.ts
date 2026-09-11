import type { AuditModuleResult, Evidence } from '../contracts';
import { buildEvidenceId } from '../hash';
import { analyzeD08Encoding, computeD08WeightedOrderStats } from './extractor';
import { D08_BASE_WEIGHTS, scoreStructuralReadability } from './scorer';
import type { D08Signals, D08StructuredFieldSignal } from './types';

const D08_SCHEMA_VERSION = 'D08.v2';

interface PdfItem {
  id: string;
  page: number;
  streamIndex: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

interface PdfLine {
  id: string;
  page: number;
  y: number;
  x: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  itemIds: string[];
}

interface PageBounds {
  page: number;
  width: number;
  height: number;
}

async function loadPdfJs() {
  const pdfjsLib = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  return pdfjsLib;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function coefficientOfVariation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean <= Number.EPSILON) return 0;
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function normalizeHeading(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase('pl-PL')
    .replace(/[.:;|/\\_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SECTION_HEADINGS = new Set([
  'doświadczenie',
  'doświadczenie zawodowe',
  'doswiadczenie',
  'doswiadczenie zawodowe',
  'work experience',
  'experience',
  'employment history',
  'wykształcenie',
  'wyksztalcenie',
  'edukacja',
  'education',
  'umiejętności',
  'umiejetnosci',
  'skills',
  'technical skills',
  'projekty',
  'projects',
  'języki',
  'jezyki',
  'languages',
  'certyfikaty',
  'certifications',
  'podsumowanie',
  'profil',
  'summary',
  'professional summary',
]);

function isUppercaseHeading(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, '');
  return letters.length >= 3 && letters === letters.toLocaleUpperCase('pl-PL');
}

function groupItemsIntoLines(items: PdfItem[]): { lines: PdfLine[]; itemToLine: Map<string, string> } {
  const lines: PdfLine[] = [];
  const itemToLine = new Map<string, string>();
  const pages = [...new Set(items.map((item) => item.page))].sort((a, b) => a - b);

  for (const page of pages) {
    const pageItems = items.filter((item) => item.page === page);
    const tolerance = Math.max(1.5, median(pageItems.map((item) => item.height || item.fontSize || 8)) * 0.30);
    const buckets: Array<{ y: number; items: PdfItem[] }> = [];

    for (const item of [...pageItems].sort((a, b) => b.y - a.y || a.x - b.x)) {
      let bucket = buckets.find((candidate) => Math.abs(candidate.y - item.y) <= tolerance);
      if (!bucket) {
        bucket = { y: item.y, items: [] };
        buckets.push(bucket);
      }
      bucket.items.push(item);
      bucket.y = bucket.items.reduce((sum, current) => sum + current.y, 0) / bucket.items.length;
    }

    buckets.sort((a, b) => b.y - a.y);
    buckets.forEach((bucket, index) => {
      const fragments = [...bucket.items].sort((a, b) => a.x - b.x);
      const x = Math.min(...fragments.map((item) => item.x));
      const maxX = Math.max(...fragments.map((item) => item.x + item.width));
      const height = Math.max(...fragments.map((item) => item.height || item.fontSize || 0));
      const line: PdfLine = {
        id: `P${page}_L${index}`,
        page,
        y: bucket.y,
        x,
        width: Math.max(0, maxX - x),
        height,
        text: fragments.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim(),
        fontSize: median(fragments.map((item) => item.fontSize).filter((value) => value > 0)),
        itemIds: fragments.map((item) => item.id),
      };
      lines.push(line);
      for (const item of fragments) itemToLine.set(item.id, line.id);
    });
  }

  return { lines, itemToLine };
}

function geometryOrder(lines: PdfLine[]): string[] {
  return [...lines]
    .sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x)
    .map((line) => line.id);
}

function streamLineOrder(items: PdfItem[], itemToLine: Map<string, string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of [...items].sort((a, b) => a.streamIndex - b.streamIndex)) {
    const lineId = itemToLine.get(item.id);
    if (lineId && !seen.has(lineId)) {
      seen.add(lineId);
      result.push(lineId);
    }
  }
  return result;
}

function boxOverlapRatio(a: PdfLine, b: PdfLine): number {
  if (a.page !== b.page) return 0;
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.max(a.y - a.height, b.y - b.height);
  const top = Math.min(a.y, b.y);
  if (right <= left || top <= bottom) return 0;

  const overlapArea = (right - left) * (top - bottom);
  const areaA = Math.max(1, a.width * a.height);
  const areaB = Math.max(1, b.width * b.height);
  return clamp01(overlapArea / Math.min(areaA, areaB));
}

function computeOverlapRatio(lines: PdfLine[]): number {
  if (lines.length < 2) return 0;
  const affected = new Set<string>();
  for (let i = 0; i < lines.length; i += 1) {
    for (let j = i + 1; j < lines.length; j += 1) {
      const overlap = boxOverlapRatio(lines[i], lines[j]);
      if (overlap >= 0.25) {
        affected.add(lines[i].id);
        affected.add(lines[j].id);
      }
    }
  }
  return affected.size / lines.length;
}

function computeClippingRatio(items: PdfItem[], bounds: PageBounds[]): number {
  const boundMap = new Map(bounds.map((bound) => [bound.page, bound]));
  let totalChars = 0;
  let clippedChars = 0;

  for (const item of items) {
    const chars = Math.max(1, item.text.length);
    totalChars += chars;
    const page = boundMap.get(item.page);
    if (!page) continue;
    const clipped =
      item.x < -0.5 ||
      item.y - item.height < -0.5 ||
      item.x + item.width > page.width + 0.5 ||
      item.y > page.height + 0.5;
    if (clipped) clippedChars += chars;
  }

  return totalChars > 0 ? clippedChars / totalChars : 0;
}

function duplicateLayerRatio(items: PdfItem[]): number {
  const buckets = new Map<string, number>();
  let totalChars = 0;
  let duplicateChars = 0;

  for (const item of items) {
    const chars = Math.max(1, item.text.length);
    totalChars += chars;
    const key = [
      item.page,
      Math.round(item.x * 2) / 2,
      Math.round(item.y * 2) / 2,
      item.text.normalize('NFKC'),
    ].join('|');
    const count = buckets.get(key) ?? 0;
    if (count > 0) duplicateChars += chars;
    buckets.set(key, count + 1);
  }

  return totalChars > 0 ? clamp01(duplicateChars / totalChars) : 0;
}

function fieldCandidates(lines: PdfLine[]): Array<{ kind: D08StructuredFieldSignal['kind']; raw: string; parseability: number; path: string }> {
  const result: Array<{ kind: D08StructuredFieldSignal['kind']; raw: string; parseability: number; path: string }> = [];
  const seen = new Set<string>();

  const push = (kind: D08StructuredFieldSignal['kind'], raw: string, parseability: number, path: string): void => {
    const key = `${kind}:${raw}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ kind, raw, parseability, path });
  };

  lines.forEach((line, index) => {
    const emailMatches = line.text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) ?? [];
    emailMatches.forEach((raw) => push('EMAIL', raw, 1, `pdf.lines[${index}]`));

    const urlMatches = line.text.match(/(?:https?:\/\/|www\.)[^\s,;]+/gi) ?? [];
    urlMatches.forEach((raw) => push('URL', raw, 1, `pdf.lines[${index}]`));

    const phoneMatches = line.text.match(/(?:\+?\d[\d ()-]{7,}\d)/g) ?? [];
    phoneMatches.forEach((raw) => {
      const digitCount = raw.replace(/\D/g, '').length;
      push('PHONE', raw, digitCount >= 9 && digitCount <= 15 ? 1 : 0.35, `pdf.lines[${index}]`);
    });

    const dateMatches = line.text.match(/\b(?:\d{4}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b/g) ?? [];
    dateMatches.forEach((raw) => {
      const parts = raw.split(/[-/.]/).map(Number);
      let parseability = 1;
      if (parts.length === 3 && parts[0] <= 12 && parts[1] <= 12) parseability = 0.35;
      push('DATE', raw, parseability, `pdf.lines[${index}]`);
    });
  });

  return result;
}

async function makeEvidence(
  jsonPath: string,
  description: string,
  payload: Record<string, string | number | boolean | null>,
  extractionConfidence = 0.95,
): Promise<Evidence> {
  const id = await buildEvidenceId(
    D08_SCHEMA_VERSION,
    'CV',
    jsonPath,
    payload,
    'DERIVED_DETERMINISTIC',
  );
  return {
    id,
    provenance: 'DERIVED_DETERMINISTIC',
    pointer: { source: 'CV', jsonPath },
    description,
    normalizedPayload: payload,
    extractionConfidence,
  };
}

export interface D08PdfExtractionResult {
  extractedText: string;
  signals: D08Signals;
}

export async function extractD08SignalsFromPdf(file: File): Promise<D08PdfExtractionResult> {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const items: PdfItem[] = [];
  const bounds: PageBounds[] = [];
  let totalContentItems = 0;
  let validTextItems = 0;
  let globalStreamIndex = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    bounds.push({ page: pageNumber, width: viewport.width, height: viewport.height });
    const textContent = await page.getTextContent();
    totalContentItems += textContent.items.length;

    for (const rawItem of textContent.items) {
      globalStreamIndex += 1;
      if (!('str' in rawItem) || typeof rawItem.str !== 'string' || rawItem.str.trim().length === 0) continue;
      validTextItems += 1;
      const item = rawItem as typeof rawItem & {
        transform?: ArrayLike<number>;
        width?: number;
        height?: number;
      };
      const transform = item.transform;
      const x = transform?.[4] ?? 0;
      const y = transform?.[5] ?? 0;
      const fontSize = Math.max(
        Math.abs(transform?.[0] ?? 0),
        Math.abs(transform?.[3] ?? 0),
        item.height ?? 0,
      );
      items.push({
        id: `P${pageNumber}_I${globalStreamIndex}`,
        page: pageNumber,
        streamIndex: globalStreamIndex,
        text: item.str,
        x,
        y,
        width: Math.max(0, item.width ?? 0),
        height: Math.max(0, item.height ?? fontSize),
        fontSize,
      });
    }
  }

  const { lines, itemToLine } = groupItemsIntoLines(items);
  const orderedLines = [...lines].sort((a, b) => a.page - b.page || b.y - a.y || a.x - b.x);
  const extractedText = orderedLines.map((line) => line.text).filter(Boolean).join('\n');
  const expectedOrder = geometryOrder(lines);
  const nativeOrder = streamLineOrder(items, itemToLine);
  const expectedIndex = new Map(expectedOrder.map((id, index) => [id, index]));
  const orderStats = computeD08WeightedOrderStats(
    expectedOrder,
    nativeOrder,
    (before, after) => Math.abs((expectedIndex.get(after) ?? 0) - (expectedIndex.get(before) ?? 0)) === 1 ? 2 : 1,
  );

  const bodyFontSize = median(lines.map((line) => line.fontSize).filter((size) => size > 0));
  const headingCandidates = lines.filter((line) => {
    if (!line.text || line.text.length > 70) return false;
    const normalized = normalizeHeading(line.text);
    return SECTION_HEADINGS.has(normalized) || isUppercaseHeading(line.text) || line.fontSize >= bodyFontSize * 1.12;
  });
  const recognizedHeadings = headingCandidates.filter((line) => SECTION_HEADINGS.has(normalizeHeading(line.text)));

  const sectionMatch = headingCandidates.length > 0
    ? recognizedHeadings.length / headingCandidates.length
    : 0;
  let sectionsWithContent = 0;
  recognizedHeadings.forEach((heading) => {
    const index = orderedLines.findIndex((line) => line.id === heading.id);
    const nextHeadingIndex = orderedLines.findIndex(
      (line, candidateIndex) => candidateIndex > index && recognizedHeadings.some((candidate) => candidate.id === line.id),
    );
    const end = nextHeadingIndex > index ? nextHeadingIndex : orderedLines.length;
    if (orderedLines.slice(index + 1, end).some((line) => line.text.trim().length > 0)) sectionsWithContent += 1;
  });
  const sectionBoundaryConsistency = recognizedHeadings.length > 0
    ? sectionsWithContent / recognizedHeadings.length
    : 0;

  const headingSeparationScores = recognizedHeadings.map((line) => {
    if (bodyFontSize <= 0) return 0.7;
    const sizeDelta = Math.max(0, line.fontSize / bodyFontSize - 1);
    return clamp01(0.55 + sizeDelta / 0.35);
  });
  const headingFontSizes = recognizedHeadings.map((line) => line.fontSize).filter((size) => size > 0);
  const headingConsistency = headingFontSizes.length > 1
    ? clamp01(1 - coefficientOfVariation(headingFontSizes))
    : 1;

  const overlapRatio = computeOverlapRatio(lines);
  const clippingRatio = computeClippingRatio(items, bounds);
  const duplicateRatio = duplicateLayerRatio(items);
  const encoding = analyzeD08Encoding(extractedText);
  const fieldsRaw = fieldCandidates(orderedLines);

  const textEvidence = await makeEvidence(
    'pdf.textLayer',
    'PDF.js zwrócił natywną warstwę tekstową dokumentu.',
    {
      totalContentItems,
      validTextItems,
      textCharacters: extractedText.length,
    },
  );
  const orderEvidence = await makeEvidence(
    'pdf.readingOrder',
    'Porównano natywny stream PDF z geometrycznym porządkiem linii.',
    {
      comparablePairWeight: orderStats.comparablePairWeight,
      discordantPairWeight: orderStats.discordantPairWeight,
      discordance: orderStats.discordance,
    },
  );
  const layoutEvidence = await makeEvidence(
    'pdf.layout',
    'Zmierzono clipping i przestrzenne nakładanie linii.',
    { overlapRatio, clippingRatio },
  );
  const encodingEvidence = await makeEvidence(
    'pdf.encoding',
    'Zmierzono nierozwiązane anomalie kodowania po normalizacji NFKC.',
    {
      weightedDamageRatio: encoding.weightedDamageRatio,
      anomalyCount: encoding.anomalies.length,
    },
  );

  const evidence: Evidence[] = [textEvidence, orderEvidence, layoutEvidence, encodingEvidence];
  const sectionEvidence = headingCandidates.length > 0
    ? await makeEvidence(
      'pdf.sections',
      'Zmierzono deterministyczne dopasowanie nagłówków sekcji i ich granice.',
      {
        headingCandidates: headingCandidates.length,
        recognizedHeadings: recognizedHeadings.length,
        sectionMatch,
        sectionBoundaryConsistency,
      },
      0.85,
    )
    : null;
  if (sectionEvidence) evidence.push(sectionEvidence);

  const headingEvidence = recognizedHeadings.length > 0
    ? await makeEvidence(
      'pdf.headings',
      'Zmierzono wizualną separację rozpoznanych nagłówków sekcji.',
      {
        recognizedHeadings: recognizedHeadings.length,
        meanSeparation: headingSeparationScores.reduce((sum, value) => sum + value, 0) / headingSeparationScores.length,
        levelConsistency: headingConsistency,
      },
      0.80,
    )
    : null;
  if (headingEvidence) evidence.push(headingEvidence);

  const structuredFields: D08StructuredFieldSignal[] = [];
  for (const field of fieldsRaw) {
    const fieldEvidence = await makeEvidence(
      field.path,
      `Wykryto pole strukturalne typu ${field.kind}.`,
      { kind: field.kind, parseability: field.parseability },
      0.92,
    );
    evidence.push(fieldEvidence);
    structuredFields.push({
      kind: field.kind,
      parseability: field.parseability,
      evidenceId: fieldEvidence.id,
    });
  }

  const duplicateEvidence = duplicateRatio > 0
    ? await makeEvidence(
      'pdf.duplicateLayer',
      'Wykryto zduplikowane elementy tekstowe w tych samych współrzędnych.',
      { duplicateInvisibleLayerRatio: duplicateRatio },
      0.90,
    )
    : null;
  if (duplicateEvidence) evidence.push(duplicateEvidence);

  const sectionApplicable = headingCandidates.length > 0;
  const headingApplicable = recognizedHeadings.length > 0;
  const validItemRatio = totalContentItems > 0 ? validTextItems / totalContentItems : 0;
  const nativeTextCoverage = extractedText.trim().length > 0 ? clamp01(validItemRatio) : 0;

  let fulfilledEvidenceWeight =
    D08_BASE_WEIGHTS.TEXT_LAYER +
    D08_BASE_WEIGHTS.READING_ORDER +
    D08_BASE_WEIGHTS.LAYOUT_TOPOLOGY +
    D08_BASE_WEIGHTS.ENCODING;
  if (sectionApplicable) fulfilledEvidenceWeight += D08_BASE_WEIGHTS.SECTION_TOPOLOGY;
  if (headingApplicable) fulfilledEvidenceWeight += D08_BASE_WEIGHTS.HEADINGS;
  if (structuredFields.length > 0) fulfilledEvidenceWeight += D08_BASE_WEIGHTS.STRUCTURED_FIELDS;

  const signals: D08Signals = {
    referenceProfile: 'EXTERNAL_DOCUMENT',
    measurementHealth: {
      pipelineHealthy: totalContentItems > 0,
      failureCode: totalContentItems > 0 ? undefined : 'D08_PDF_NO_CONTENT_ITEMS',
      failureMessage: totalContentItems > 0
        ? undefined
        : 'PDF.js nie zwrócił elementów treści potrzebnych do pomiaru.',
    },
    textLayer: {
      applicable: true,
      nativeTextCoverage,
      evidenceIds: [textEvidence.id],
    },
    readingOrder: {
      comparablePairWeight: orderStats.comparablePairWeight,
      discordantPairWeight: orderStats.discordantPairWeight,
      evidenceIds: [orderEvidence.id],
    },
    sections: {
      applicable: sectionApplicable,
      externalDeterministicMatch: sectionApplicable ? sectionMatch : undefined,
      externalBoundaryConsistency: sectionApplicable ? sectionBoundaryConsistency : undefined,
      evidenceIds: sectionEvidence ? [sectionEvidence.id] : [],
    },
    layout: {
      overlapRatio,
      clippingRatio,
      evidenceIds: [layoutEvidence.id],
    },
    encoding: {
      weightedDamageRatio: encoding.weightedDamageRatio,
      evidenceIds: [encodingEvidence.id],
    },
    headings: {
      applicable: headingApplicable,
      meanSeparationScore: headingApplicable
        ? headingSeparationScores.reduce((sum, value) => sum + value, 0) / headingSeparationScores.length
        : undefined,
      levelConsistency: headingApplicable ? headingConsistency : undefined,
      evidenceIds: headingEvidence ? [headingEvidence.id] : [],
    },
    structuredFields,
    lists: {
      applicable: false,
      evidenceIds: [],
    },
    adversarial: {
      hiddenTextMeasured: false,
      duplicateInvisibleLayerMeasured: true,
      duplicateInvisibleLayerRatio: duplicateRatio,
      hiddenTextEvidenceIds: [],
      duplicateLayerEvidenceIds: duplicateEvidence ? [duplicateEvidence.id] : [],
    },
    confidenceInput: {
      expectedEvidenceWeight: 1,
      fulfilledEvidenceWeight: Math.min(1, fulfilledEvidenceWeight),
      provenanceReliability: 0.70,
      extractionQuality: clamp01(validItemRatio),
      independentEvidenceCount: Math.max(1, Math.min(12, pdf.numPages + evidence.length)),
      sampleScaleK: 4,
    },
    evidence,
  };

  return { extractedText, signals };
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
