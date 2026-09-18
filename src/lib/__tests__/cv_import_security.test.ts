import { describe, it, expect, vi } from 'vitest';
import { extractTextFromAnyFile } from '../cvUniversalParser';

/**
 * Testy ochron importu CV (cvUniversalParser.ts):
 * 1. Limit rozmiaru pliku (10 MB)
 * 2. Walidacja magic bytes (zgodność rozszerzenia z zawartością)
 * 3. Limit dekompresji DOCX (5 MB)
 * 4. Limit stron PDF (200) + timeout (20s)
 */

function makeFile(name: string, bytes: Uint8Array, type = 'application/octet-stream'): File {
  return new File([bytes], name, { type });
}

function makeTextFile(name: string, content: string): File {
  const encoder = new TextEncoder();
  return new File([encoder.encode(content)], name, { type: 'text/plain' });
}

// ---------------------------------------------------------------
// 1. Limit rozmiaru pliku (10 MB)
// ---------------------------------------------------------------
describe('Ochrona 1: limit rozmiaru pliku 10 MB', () => {
  it('odrzuca plik większy niż 10 MB', async () => {
    const bigContent = new Uint8Array(11 * 1024 * 1024);
    bigContent[0] = 0x25; bigContent[1] = 0x50; bigContent[2] = 0x44; bigContent[3] = 0x46;
    const file = makeFile('duze-cv.pdf', bigContent, 'application/pdf');

    await expect(extractTextFromAnyFile(file)).rejects.toThrow(
      /za duży.*11\.0 MB/i
    );
  });

  it('odrzuca pusty plik', async () => {
    const file = makeFile('pusty.pdf', new Uint8Array(0), 'application/pdf');

    await expect(extractTextFromAnyFile(file)).rejects.toThrow(/pusty/i);
  });

  it('akceptuje plik poniżej limitu (tekstowy)', async () => {
    const content = 'Jan Kowalski\nDoświadczenie\nProgramista w Firmie XYZ';
    const file = makeTextFile('cv.txt', content);

    const result = await extractTextFromAnyFile(file);
    expect(result.text).toContain('Jan Kowalski');
    expect(result.format).toBe('TXT');
  });

  it('akceptuje plik .csv poniżej limitu', async () => {
    const content = 'nazwa,wartość\numiejętność,React';
    const file = makeFile('cv.csv', new TextEncoder().encode(content), 'text/csv');

    const result = await extractTextFromAnyFile(file);
    expect(result.text).toContain('React');
    expect(result.format).toBe('CSV');
  });
});

// ---------------------------------------------------------------
// 2. Walidacja magic bytes
// ---------------------------------------------------------------
describe('Ochrona 2: walidacja magic bytes', () => {
  it('odrzuca plik .pdf z błędnymi magic bytes (tekst)', async () => {
    const fakePdf = new TextEncoder().encode('To nie jest plik PDF, to zwykły tekst.');
    const file = makeFile('cv.pdf', fakePdf, 'application/pdf');

    await expect(extractTextFromAnyFile(file)).rejects.toThrow(
      /nie odpowiada rozszerzeniu/i
    );
  });

  it('odrzuca plik .docx z błędnymi magic bytes', async () => {
    const fakeDocx = new TextEncoder().encode('To nie jest DOCX');
    const file = makeFile('cv.docx', fakeDocx);

    await expect(extractTextFromAnyFile(file)).rejects.toThrow(
      /nie odpowiada rozszerzeniu/i
    );
  });

  it('odrzuca plik .pdf z headerem JPEG (FFD8FFE0)', async () => {
    const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const file = makeFile('cv.pdf', jpegHeader, 'application/pdf');

    await expect(extractTextFromAnyFile(file)).rejects.toThrow(
      /nie odpowiada rozszerzeniu/i
    );
  });

  it('odrzuca plik .rtf z błędnymi magic bytes', async () => {
    const fakeRtf = new TextEncoder().encode('To nie jest RTF');
    const file = makeFile('cv.rtf', fakeRtf, 'application/rtf');

    await expect(extractTextFromAnyFile(file)).rejects.toThrow(
      /nie odpowiada rozszerzeniu/i
    );
  });

  it('akceptuje .rtf z poprawnymi magic bytes (7B 5C 72 74)', async () => {
    // RTF header: {\rt
    const rtfContent = new Uint8Array([0x7b, 0x5c, 0x72, 0x74, 0x66, 0x31, 0x20, 0x61, 0x6e]);
    const file = makeFile('cv.rtf', rtfContent, 'application/rtf');

    const result = await extractTextFromAnyFile(file);
    expect(result.format).toBe('RTF');
  });

  it('akceptuje .txt i .csv niezależnie od magic bytes', async () => {
    const txtFile = makeTextFile('cv.txt', 'Dowolna treść');
    const result = await extractTextFromAnyFile(txtFile);
    expect(result.text).toContain('Dowolna treść');
  });

  it('akceptuje .json z BOM UTF-8', async () => {
    const jsonContent = new Uint8Array([0xef, 0xbb, 0xbf, 0x7b, 0x22, 0x6e, 0x61, 0x6d, 0x65, 0x22, 0x7d]);
    const file = makeFile('cv.json', jsonContent, 'application/json');

    const result = await extractTextFromAnyFile(file);
    expect(result.text).toContain('name');
  });
});

// ---------------------------------------------------------------
// 3. Limit dekompresji DOCX (5 MB)
// ---------------------------------------------------------------
describe('Ochrona 3: limit dekompresji DOCX 5 MB', () => {
  it('odrzuca DOCX z tekstem > 5 MB po dekompresji', async () => {
    // Mockujemy mammoth, aby zwrócić tekst > 5 MB
    const hugeText = 'A'.repeat(6 * 1024 * 1024); // 6 MB

    vi.doMock('mammoth', () => ({
      default: {
        extractRawText: vi.fn().mockResolvedValue({ value: hugeText }),
      },
      extractRawText: vi.fn().mockResolvedValue({ value: hugeText }),
    }));

    // Poprawne magic bytes DOCX (ZIP header)
    const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const file = makeFile('cv.docx', zipHeader, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    await expect(extractTextFromAnyFile(file)).rejects.toThrow(
      /za duży po rozpakowaniu|ponad 5 MB/i
    );

    vi.doUnmock('mammoth');
  });

  it('akceptuje DOCX z normalnym tekstem po dekompresji', async () => {
    const normalText = 'Jan Kowalski\nDoświadczenie\nProgramista';

    vi.doMock('mammoth', () => ({
      default: {
        extractRawText: vi.fn().mockResolvedValue({ value: normalText }),
      },
      extractRawText: vi.fn().mockResolvedValue({ value: normalText }),
    }));

    const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const file = makeFile('cv.docx', zipHeader, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    const result = await extractTextFromAnyFile(file);
    expect(result.text).toContain('Jan Kowalski');
    expect(result.format).toBe('DOCX');

    vi.doUnmock('mammoth');
  });
});

// ---------------------------------------------------------------
// 4a. Limit stron PDF (200)
// ---------------------------------------------------------------
describe('Ochrona 4a: limit stron PDF', () => {
  it('odrzuca plik PDF z ponad 200 stronami', async () => {
    // Mockujemy pdf.js, aby zwrócić obiekt z numPages > 200
    const mockGetDocument = vi.fn().mockReturnValue({
      promise: Promise.resolve({
        numPages: 250,
        getPage: vi.fn(),
      }),
    });

    vi.doMock('pdfjs-dist', () => ({
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: mockGetDocument,
    }));
    vi.doMock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }));

    // Poprawne magic bytes PDF
    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const file = makeFile('cv.pdf', pdfHeader, 'application/pdf');

    await expect(extractTextFromAnyFile(file)).rejects.toThrow(
      /za wiele stron.*250/i
    );

    vi.doUnmock('pdfjs-dist');
    vi.doUnmock('pdfjs-dist/build/pdf.worker.min.mjs');
  });
});

// ---------------------------------------------------------------
// 4b. Timeout parsowania PDF (20s)
// ---------------------------------------------------------------
describe('Ochrona 4b: timeout parsowania PDF', () => {
  it('odrzuca PDF gdy parsowanie trwa > 20s', async () => {
    // Symulujemy powolny getDocument — resolve po 25s
    vi.useFakeTimers();

    const slowPromise = new Promise<never>((resolve) => {
      setTimeout(() => resolve({ numPages: 1, getPage: vi.fn() } as any), 25_000);
    });

    const mockGetDocument = vi.fn().mockReturnValue({
      promise: slowPromise,
    });

    vi.doMock('pdfjs-dist', () => ({
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: mockGetDocument,
    }));
    vi.doMock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }));

    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const file = makeFile('cv-slow.pdf', pdfHeader, 'application/pdf');

    const promise = extractTextFromAnyFile(file);
    const rejection = expect(promise).rejects.toThrow(/za dużo czasu/i);
    await vi.dynamicImportSettled();

    // Przesuwamy zegar o 20s — timer abort powinien się odpalić
    await vi.advanceTimersByTimeAsync(20_000);

    await rejection;

    vi.useRealTimers();
    vi.doUnmock('pdfjs-dist');
    vi.doUnmock('pdfjs-dist/build/pdf.worker.min.mjs');
  });
});
