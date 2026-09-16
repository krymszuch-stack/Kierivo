/**
 * Eksport dwuwarstwowego PDF ze strony klienta (przeglądarka).
 *
 * Pobiera wygenerowany dokument z backendu Kierivo i uruchamia pobieranie
 * binarnego pliku .pdf za pomocą biblioteki `file-saver`.
 */

import { saveAs } from 'file-saver';
import { clientEnv } from './clientEnv';
import { MasterVault, TailoredResume } from '../types';

export interface SemanticPdfExportOptions {
  vault: MasterVault;
  tailoredResume?: TailoredResume | null;
  theme?: string;
  layout?: string;
  targetPages?: number;
  summaryOverride?: string;
  targetRole?: string;
  companyName?: string;
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

/**
 * Pobiera listę dostępnych motywów i układów z silnika.
 */
export async function fetchSemanticThemes(): Promise<{
  themes: SemanticThemeItem[];
  layouts: SemanticLayoutItem[];
}> {
  try {
    const res = await fetch(`${clientEnv.apiUrl}/api/cv/themes`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
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

/**
 * Wywołuje backendowy silnik mvcv i pobiera gotowy plik PDF.
 */
export async function downloadSemanticPdf(options: SemanticPdfExportOptions): Promise<void> {
  const res = await fetch(`${clientEnv.apiUrl}/api/cv/export-pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    let errorMsg = 'Nie udało się wygenerować pliku PDF.';
    try {
      const errJson = await res.json();
      if (errJson.error) errorMsg = errJson.error;
    } catch {
      // ignoruj błąd parsowania JSON
    }
    throw new Error(errorMsg);
  }

  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const name = options.vault.personalInfo?.fullName?.replace(/\s+/g, '_') || 'Kandydat';
  const filename = match && match[1] ? decodeURIComponent(match[1]) : `CV_${name}.pdf`;

  const blob = await res.blob();
  saveAs(blob, filename);
}
