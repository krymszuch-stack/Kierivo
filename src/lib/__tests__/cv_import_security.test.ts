import { describe, it, expect, vi, afterEach } from 'vitest';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { DocxArchiveLimitError, extractTextFromAnyFile, InvalidDocxError, UnsupportedLegacyDocFormatError, UnsupportedMasterVaultJsonCvError } from '../cvUniversalParser';

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

async function createDocxFile(text: string, name = 'cv.docx'): Promise<File> {
  const doc = new Document({
    sections: [{ children: [new Paragraph({ children: [new TextRun(text)] })] }],
  });
  const buffer = await Packer.toBuffer(doc);
  return makeFile(
    name,
    new Uint8Array(buffer),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
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

  it('odrzuca poprawny nagłówek starego Word .doc z informacją o konwersji', async () => {
    // OLE Compound File signature plików Word 97–2003; format .doc nie jest DOCX/ZIP.
    const legacyWordHeader = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    const file = makeFile('cv.doc', legacyWordHeader, 'application/msword');

    const error = await extractTextFromAnyFile(file).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(UnsupportedLegacyDocFormatError);
    expect(error).toMatchObject({
      code: 'UNSUPPORTED_LEGACY_DOC_FORMAT',
      message: expect.stringMatching(/Word 97.?2003.*DOCX|zapisz.*DOCX/i),
    });
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

  it('odrzuca uszkodzony kontener DOCX zamiast zwracaÄ‡ jego surowe bajty jako tekst CV', async () => {
    const cvText = new TextEncoder().encode('Jan Kowalski\nDoĹ›wiadczenie zawodowe\nTechnik wsparcia IT');
    const malformedDocx = new Uint8Array(4 + cvText.length);
    malformedDocx.set([0x50, 0x4b, 0x03, 0x04]);
    malformedDocx.set(cvText, 4);
    const file = makeFile('uszkodzone-cv.docx', malformedDocx);

    const error = await extractTextFromAnyFile(file).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(InvalidDocxError);
    expect(error).toMatchObject({
      code: 'INVALID_DOCX',
      message: expect.stringMatching(/dokumentu DOCX.*uszkodzony/i),
    });
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

  it('kieruje JSON profilu do importu MasterVault zamiast analizować go jak tekst CV', async () => {
    const jsonContent = new TextEncoder().encode('\uFEFF{"personalInfo":{"fullName":"Jan Kowalski"},"history":[]}');
    const file = makeFile('cv.json', jsonContent, 'application/json');

    const error = await extractTextFromAnyFile(file).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(UnsupportedMasterVaultJsonCvError);
    expect(error).toMatchObject({
      code: 'MASTERVAULT_JSON_IS_NOT_CV',
      message: expect.stringMatching(/kopię profilu MasterVault.*edytorze profilu/i),
    });
  });
});

// ---------------------------------------------------------------
// 3. Limit dekompresji DOCX (5 MB)
// ---------------------------------------------------------------
describe('Ochrona 3: limit dekompresji DOCX 5 MB', () => {
  it('odrzuca archiwum z nadmiernym rozmiarem przed ekstrakcją Mammoth', async () => {
    const validFile = await createDocxFile('Jan Kowalski\nDoświadczenie zawodowe\nTechnik wsparcia IT');
    const bytes = new Uint8Array(await validFile.arrayBuffer());
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let endRecordOffset = -1;
    for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) {
        endRecordOffset = offset;
        break;
      }
    }
    expect(endRecordOffset).toBeGreaterThanOrEqual(0);

    const directoryOffset = view.getUint32(endRecordOffset + 16, true);
    const entryCount = view.getUint16(endRecordOffset + 10, true);
    let cursor = directoryOffset;
    let patchedDocumentEntry = false;
    for (let index = 0; index < entryCount; index += 1) {
      expect(view.getUint32(cursor, true)).toBe(0x02014b50);
      const nameLength = view.getUint16(cursor + 28, true);
      const extraLength = view.getUint16(cursor + 30, true);
      const commentLength = view.getUint16(cursor + 32, true);
      const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
      if (name === 'word/document.xml') {
        view.setUint32(cursor + 24, 21 * 1024 * 1024, true);
        patchedDocumentEntry = true;
        break;
      }
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    expect(patchedDocumentEntry).toBe(true);

    const file = makeFile('cv-decompression-bomb.docx', bytes);
    const error = await extractTextFromAnyFile(file).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(DocxArchiveLimitError);
    expect(error).toMatchObject({ code: 'DOCX_ARCHIVE_LIMIT' });
  });

  it('odrzuca DOCX z tekstem > 5 MB po dekompresji', async () => {
    // Generujemy prawidłowy kontener DOCX/ZIP zawierający [Content_Types].xml, word/document.xml i relacje,
    // którego tekst po dekompresji przekracza 5 MB (ok. 5.2 MB), a sam plik dzięki kompresji zajmuje kilkanaście KB.
    const hugeText = 'A'.repeat(5.2 * 1024 * 1024);
    const file = await createDocxFile(hugeText, 'cv-huge.docx');

    await expect(extractTextFromAnyFile(file)).rejects.toThrow(
      /za duży po rozpakowaniu|zbyt duży po rozpakowaniu|ponad 5 MB/i
    );
  }, 25000);

  it('akceptuje DOCX z normalnym tekstem po dekompresji', async () => {
    const normalText = 'Jan Kowalski\nDoświadczenie\nProgramista';
    const file = await createDocxFile(normalText, 'cv-normal.docx');

    const result = await extractTextFromAnyFile(file);
    expect(result.text).toContain('Jan Kowalski');
    expect(result.format).toBe('DOCX');
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

    const promise = extractTextFromAnyFile(file);
    await expect(promise).rejects.toThrow(/zbyt wiele stron/i);
    await expect(promise).rejects.toThrow(/250/);
    await expect(promise).rejects.toThrow(/200/);

    vi.doUnmock('pdfjs-dist');
    vi.doUnmock('pdfjs-dist/build/pdf.worker.min.mjs');
  });
});

// ---------------------------------------------------------------
// 4b. Timeout parsowania PDF (20s)
// ---------------------------------------------------------------
interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Ochrona 4b: timeout parsowania PDF', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock('pdfjs-dist');
    vi.doUnmock('pdfjs-dist/build/pdf.worker.min.mjs');
  });

  it('odrzuca PDF gdy parsowanie trwa > 20s', async () => {
    vi.useFakeTimers();

    const deferred = createDeferred<{ numPages: number; getPage: () => unknown }>();
    const documentCalled = createDeferred<void>();

    const mockGetDocument = vi.fn().mockImplementation(({ signal }: { signal?: AbortSignal }) => {
      documentCalled.resolve();
      if (signal?.aborted) {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        deferred.reject(err);
      } else {
        signal?.addEventListener('abort', () => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          deferred.reject(err);
        });
      }
      return { promise: deferred.promise };
    });

    vi.doMock('pdfjs-dist', () => ({
      GlobalWorkerOptions: { workerSrc: '' },
      getDocument: mockGetDocument,
    }));
    vi.doMock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }));

    const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const file = makeFile('cv-slow.pdf', pdfHeader, 'application/pdf');

    try {
      const promise = extractTextFromAnyFile(file);
      // Rejestrujemy asercję oczekującą odrzucenia z komunikatem timeoutu
      const rejectionPromise = expect(promise).rejects.toThrow(/za dużo czasu/i);
      await vi.dynamicImportSettled();

      // Czekamy na dojście do wywołania getDocument, które rejestruje timer 20s
      await documentCalled.promise;

      // Przesuwamy fake timer o 20 sekund
      await vi.advanceTimersByTimeAsync(20_000);

      // Potwierdzamy asercją odrzucenie z komunikatem timeoutu
      await rejectionPromise;
    } finally {
      vi.useRealTimers();
      vi.doUnmock('pdfjs-dist');
      vi.doUnmock('pdfjs-dist/build/pdf.worker.min.mjs');
    }
  });
});
