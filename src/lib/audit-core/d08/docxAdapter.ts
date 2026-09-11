import * as mammoth from 'mammoth';

export interface D08DocxExtractionResult {
  extractedText: string;
  extractionPath: 'ARRAY_BUFFER' | 'NODE_BUFFER';
}

function normalizeDocxText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractWithNodeBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  // Specyfikator pozostaje dynamiczny, dzięki czemu browser bundle nie próbuje
  // wykonywać node:buffer. Ta ścieżka istnieje wyłącznie dla Node/CI.
  const nodeBufferSpecifier = 'node:buffer';
  const { Buffer } = await import(/* @vite-ignore */ nodeBufferSpecifier);
  const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
  return result.value ?? '';
}

/**
 * D08 potrzebuje deterministycznego strumienia tekstu z realnego DOCX.
 * Adapter nie udaje pomiaru geometrii DOCX. Dostarcza wyłącznie warstwę
 * tekstową, którą SOURCE_AWARE może porównać ze źródłem CVelocity.
 */
export async function extractD08TextFromDocx(file: File): Promise<D08DocxExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    const extractedText = normalizeDocxText(result.value ?? '');
    if (extractedText.length > 0) {
      return { extractedText, extractionPath: 'ARRAY_BUFFER' };
    }
  } catch {
    // Node/Vitest może rozwiązać Mammoth do wariantu oczekującego Buffer.
  }

  if (typeof process !== 'undefined' && process.versions?.node) {
    const extractedText = normalizeDocxText(await extractWithNodeBuffer(arrayBuffer));
    if (extractedText.length > 0) {
      return { extractedText, extractionPath: 'NODE_BUFFER' };
    }
  }

  throw new Error('D08_DOCX_TEXT_EXTRACTION_FAILED');
}
