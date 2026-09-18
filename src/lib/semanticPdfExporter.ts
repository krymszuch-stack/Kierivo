/**
 * Eksport dwuwarstwowego PDF ze strony klienta (przeglądarka).
 *
 * Pobiera wygenerowany dokument z backendu Kierivo i uruchamia pobieranie
 * binarnego pliku .pdf za pomocą biblioteki `file-saver`.
 * Po eksporcie zwraca wyniki walidacji ATS (jeśli dostępne).
 */

import { saveAs } from 'file-saver';
import { api, ApiError } from './apiClient';
import { MasterVault, TailoredResume } from '../types';
import type { AtsPdfValidationReport } from './atsPdfValidator';

export interface SemanticPdfExportOptions {
  vault: MasterVault;
  tailoredResume?: TailoredResume | null;
  theme?: string;
  layout?: string;
  targetPages?: number;
  avatar?: 'circle' | 'square' | 'none';
  summaryOverride?: string;
  targetRole?: string;
  companyName?: string;
  pdfType?: 'standard' | 'dual-layer';
}

export interface SemanticThemeItem {
  id: string;
  name: string;
  accent: string;
  bg: string;
  font: string;
  desc: string;
}

export interface SemanticLayoutItem {
  id: string;
  name: string;
  kind: string;
  desc: string;
}

export interface SemanticPdfApiResponse {
  success: true;
  requestId?: string;
  filename: string;
  pdf: string;
  atsValidation?: AtsPdfValidationReport | null;
}

/**
 * Pobiera listę dostępnych motywów i układów z silnika.
 */
export async function fetchSemanticThemes(): Promise<{
  themes: SemanticThemeItem[];
  layouts: SemanticLayoutItem[];
}> {
  try {
    const data = await api.get<{
      success: boolean;
      themes?: SemanticThemeItem[];
      layouts?: SemanticLayoutItem[];
    }>('/api/cv/themes');

    return {
      themes: data.themes || [],
      layouts: data.layouts || [],
    };
  } catch {
    return {
      themes: [],
      layouts: [],
    };
  }
}

export interface SemanticPdfExportResult {
  /** Wyniki walidacji ATS (null jeśli walidacja nie była dostępna) */
  atsValidation: AtsPdfValidationReport | null;
  /** Nazwa pliku */
  filename: string;
  /** Identyfikator żądania do logów/diagnostyki */
  requestId?: string;
}

/**
 * Wywołuje backendowy silnik mvcv przez api.post i pobiera gotowy plik PDF.
 * Po eksporcie zwraca wyniki walidacji ATS oraz requestId.
 */
export async function downloadSemanticPdf(options: SemanticPdfExportOptions): Promise<SemanticPdfExportResult> {
  const data = await api.post<SemanticPdfApiResponse>('/api/cv/export-pdf', options);

  if (!data || !data.pdf) {
    throw new ApiError(500, {
      success: false,
      error: 'Serwer nie zwrócił danych wygenerowanego pliku PDF.',
      requestId: data?.requestId,
    });
  }

  const name = options.vault.personalInfo?.fullName?.replace(/\s+/g, '_') || 'Kandydat';
  const filename = data.filename || `CV_${name}.pdf`;

  // Dekoduj base64 PDF i zapisz przez file-saver
  const binaryStr = atob(data.pdf);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: 'application/pdf' });
  saveAs(blob, filename);

  return {
    atsValidation: data.atsValidation ?? null,
    filename,
    requestId: data.requestId,
  };
}

