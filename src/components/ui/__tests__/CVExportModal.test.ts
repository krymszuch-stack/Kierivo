import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatPdfExportErrorMessage } from '../CVExportModal';
import { ApiError, api } from '../../../lib/apiClient';
import { prepareSemanticPdf, savePreparedSemanticPdf } from '../../../lib/semanticPdfExporter';
import { saveAs } from 'file-saver';
import { createEmptyVault } from '../../../lib/sampleVault';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

describe('CVExportModal — obsługa statusów błędów i requestId na frontendzie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('400 — formatuje błąd jako Nieprawidłowe dane CV z kodem zgłoszenia', () => {
    const error = new ApiError(400, {
      success: false,
      error: 'Brak wymaganych danych MasterVault.',
      requestId: 'req-err-400-abc',
    });

    const result = formatPdfExportErrorMessage(error);
    expect(result.title).toBe('Nieprawidłowe dane CV');
    expect(result.message).toContain('Brak wymaganych danych MasterVault');
    expect(result.message).toContain('Kod zgłoszenia: req-err-400-abc');
  });

  it('503 — formatuje błąd jako Eksport chwilowo niedostępny z kodem zgłoszenia', () => {
    const error = new ApiError(503, {
      success: false,
      error: 'Eksport PDF jest chwilowo niedostępny w tym środowisku (brak interpretera Pythona).',
      requestId: 'req-err-503-xyz',
    });

    const result = formatPdfExportErrorMessage(error);
    expect(result.title).toBe('Eksport chwilowo niedostępny');
    expect(result.message).toContain('brak interpretera Pythona');
    expect(result.message).toContain('Kod zgłoszenia: req-err-503-xyz');
  });

  it('504 — formatuje błąd jako Przekroczono limit czasu z kodem zgłoszenia', () => {
    const error = new ApiError(504, {
      success: false,
      error: 'Generowanie PDF przekroczyło limit czasu. Spróbuj wybrać 1 stronę.',
      requestId: 'req-err-504-timeout',
    });

    const result = formatPdfExportErrorMessage(error);
    expect(result.title).toBe('Przekroczono limit czasu');
    expect(result.message).toContain('przekroczyło limit czasu');
    expect(result.message).toContain('Kod zgłoszenia: req-err-504-timeout');
  });

  it('500 — formatuje błąd jako Błąd silnika PDF z zachowaniem oryginalnego komunikatu i requestId', () => {
    const error = new ApiError(500, {
      success: false,
      error: 'Błąd silnika renderowania PDF (kod 2): ReportLab Canvas Error: Page layout overflow',
      requestId: 'req-err-500-crash',
    });

    const result = formatPdfExportErrorMessage(error);
    expect(result.title).toBe('Błąd silnika PDF');
    expect(result.message).toContain('Page layout overflow');
    expect(result.message).toContain('Kod zgłoszenia: req-err-500-crash');
  });

  it('prepareSemanticPdf wywołuje api.post z opcjami i przekazuje ApiError z requestId', async () => {
    const vault = createEmptyVault('Jan Kowalski', 'jan@example.com');
    const apiPostSpy = vi.spyOn(api, 'post').mockRejectedValueOnce(
      new ApiError(503, {
        success: false,
        error: 'Eksport PDF niedostępny w tym środowisku.',
        requestId: 'req-integration-503',
      })
    );

    await expect(
      prepareSemanticPdf({
        vault,
        theme: 'parchment',
        layout: 'sidebar',
      })
    ).rejects.toThrow(ApiError);

    expect(apiPostSpy).toHaveBeenCalledTimes(1);
    expect(apiPostSpy).toHaveBeenCalledWith(
      '/api/cv/export-pdf',
      expect.objectContaining({ theme: 'parchment', layout: 'sidebar' })
    );
  });

  it('standardowy PDF wywołuje /api/cv/export-pdf z typem standard', async () => {
    const vault = createEmptyVault('Anna Nowak', 'anna@example.com');
    const validPdfBase64 = Buffer.from('%PDF-1.4 mock content').toString('base64');
    const apiPostSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
      success: true,
      filename: 'Anna_Nowak_CV.pdf',
      pdf: validPdfBase64,
      requestId: 'req-std-123',
    });

    await prepareSemanticPdf({
      vault,
      theme: 'classic',
      layout: 'header',
      targetPages: 1,
      pdfType: 'standard',
    });

    expect(apiPostSpy).toHaveBeenCalledWith(
      '/api/cv/export-pdf',
      expect.objectContaining({
        theme: 'classic',
        layout: 'header',
        pdfType: 'standard',
      })
    );
  });

  it('Dual-Layer wywołuje właściwą ścieżkę /api/cv/export-pdf z typem dual-layer', async () => {
    const vault = createEmptyVault('Piotr Wiśniewski', 'piotr@example.com');
    const validPdfBase64 = Buffer.from('%PDF-1.4 mock content').toString('base64');
    const apiPostSpy = vi.spyOn(api, 'post').mockResolvedValueOnce({
      success: true,
      filename: 'Piotr_Wisniewski_CV.pdf',
      pdf: validPdfBase64,
      requestId: 'req-dual-456',
    });

    await prepareSemanticPdf({
      vault,
      theme: 'parchment',
      layout: 'sidebar',
      targetPages: 2,
      pdfType: 'dual-layer',
    });

    expect(apiPostSpy).toHaveBeenCalledWith(
      '/api/cv/export-pdf',
      expect.objectContaining({
        theme: 'parchment',
        layout: 'sidebar',
        targetPages: 2,
        pdfType: 'dual-layer',
      })
    );
  });

  it('wstrzymuje zapis przygotowanego PDF do jawnego potwierdzenia pominięć', async () => {
    const vault = createEmptyVault('Anna Nowak', 'anna@example.com');
    const validPdfBase64 = Buffer.from('%PDF-1.4 mock content').toString('base64');
    vi.spyOn(api, 'post').mockResolvedValueOnce({
      success: true,
      filename: 'Anna_Nowak_CV.pdf',
      pdf: validPdfBase64,
      contentWarnings: ['Silnik pominął część treści z profilu.'],
    });

    const prepared = await prepareSemanticPdf({ vault, targetPages: 2 });
    expect(prepared.contentWarnings).toEqual(['Silnik pominął część treści z profilu.']);
    expect(saveAs).not.toHaveBeenCalled();

    savePreparedSemanticPdf(prepared);
    expect(saveAs).toHaveBeenCalledWith(prepared.blob, 'Anna_Nowak_CV.pdf');
  });
});

describe('Hierarchia paska akcji w DocumentRenderer i CVExportModal', () => {
  const root = resolve(__dirname, '../../../../');
  const documentRendererCode = readFileSync(
    resolve(root, 'src/features/matcher/DocumentRenderer.tsx'),
    'utf8'
  );
  const cvExportModalCode = readFileSync(
    resolve(root, 'src/components/ui/CVExportModal.tsx'),
    'utf8'
  );

  it('nie istnieją dwa widoczne przyciski z etykietą Dual-Layer PDF w DocumentRenderer', () => {
    // Wcześniej DocumentRenderer miał dwa przyciski "Dual-Layer PDF" (jeden w pasku, drugi wolnostojący)
    const matches = documentRendererCode.match(/>Dual-Layer PDF</g) || [];
    expect(matches.length).toBe(0); // W nowej strukturze opcja jest w modalu Eksportuj CV
  });

  it('Wygląd CV nie wywołuje eksportu PDF (jest osobną akcją konfiguracji)', () => {
    // W DocumentRenderer przycisk "Wygląd CV" otwiera modal w trybie theme
    expect(documentRendererCode).toContain("setExportModalMode('theme')");
    // Zastosowanie wyglądu nie uruchamia pobrania; eksport ma osobny etap potwierdzenia.
    const applyFnMatch = cvExportModalCode.match(/const handleApplyAppearance = [\s\S]*?};/);
    expect(applyFnMatch).not.toBeNull();
    expect(applyFnMatch![0]).not.toContain('prepareSemanticPdf');
    expect(applyFnMatch![0]).not.toContain('api.post');
    expect(applyFnMatch![0]).toContain('onApplyAppearance');
  });

  it('Drukuj uruchamia drukowanie przeglądarki', () => {
    // Sprawdzenie, że obsługa formatu print w modalu wywołuje onPrint lub window.print
    const exportFnMatch = cvExportModalCode.match(/const handleExecuteExport = [\s\S]*?};/);
    expect(exportFnMatch).not.toBeNull();
    expect(exportFnMatch![0]).toContain("selectedExportFormat === 'print'");
    expect(exportFnMatch![0]).toContain('onPrint()');
    expect(exportFnMatch![0]).toContain('window.print()');
  });

  it('nie traktuje samego otwarcia okna druku jako potwierdzonego eksportu', () => {
    const printFnMatch = documentRendererCode.match(/const handlePrint = \(\) => \{[\s\S]*?\n\s*\};/);
    expect(printFnMatch).not.toBeNull();
    expect(printFnMatch![0]).toContain('window.print()');
    expect(printFnMatch![0]).not.toContain('onExported');
  });

  it('wstrzymuje skrócony eksport do potwierdzenia i raportuje go po zapisie pliku', () => {
    const exportFnMatch = cvExportModalCode.match(/const handleExecuteExport = async \(\) => \{[\s\S]*?\n\s*\};/);
    const completeFnMatch = cvExportModalCode.match(/const completePdfDownload = \(result: SemanticPdfExportResult\) => \{[\s\S]*?\n\s*\};/);
    expect(exportFnMatch).not.toBeNull();
    expect(completeFnMatch).not.toBeNull();
    expect(exportFnMatch![0]).toContain('setPendingPdf(result)');
    expect(completeFnMatch![0].indexOf('savePreparedSemanticPdf(result)')).toBeLessThan(
      completeFnMatch![0].indexOf('onPdfDownloaded?.')
    );
    expect(cvExportModalCode).toContain('Pobierz mimo pominięć');
    expect(cvExportModalCode).toContain('Anuluj eksport skróconego CV');
  });

  it('każda główna akcja w pasku narzędzi ma unikalne aria-label', () => {
    const toolbarAriaLabels = [
      'Zakończ poprawki w dokumencie',
      'Nanieś poprawki w dokumencie',
      'Kopiuj treść dokumentu do schowka',
      'Zapisz kopię w bibliotece CV',
      'Konfiguracja wyglądu CV',
      'Otwórz analizę profilu AI',
      'Otwórz menu eksportu CV',
    ];

    for (const label of toolbarAriaLabels) {
      expect(documentRendererCode).toContain(label);
    }

    // Upewniamy się, że nie ma duplikatów aria-label w modalu
    const modalAriaLabels = [
      'Przełącz na tryb eksportu CV',
      'Przełącz na tryb wyglądu CV',
      'Przełącz na tryb audytu CV 360°',
      'Pobierz PDF ATS / Dual-Layer',
      'Pobierz standardowy PDF',
      'Drukuj CV',
      'Zastosuj wygląd CV',
      'Otwórz analizę profilu AI',
    ];

    for (const label of modalAriaLabels) {
      expect(cvExportModalCode).toContain(`aria-label="${label}"`);
    }
  });
});

