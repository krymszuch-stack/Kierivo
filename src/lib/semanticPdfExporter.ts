/**
 * Eksport dwuwarstwowego PDF ze strony klienta (przeglądarka).
 *
 * Pobiera wygenerowany dokument z backendu Kierivo i uruchamia pobieranie
 * binarnego pliku .pdf za pomocą biblioteki `file-saver`.
 * Po eksporcie zwraca wyniki walidacji ATS (jeśli dostępne).
 */

import { saveAs } from 'file-saver';
import { clientEnv } from './clientEnv';
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

export interface SemanticPdfExportResult {
  /** Wyniki walidacji ATS (null jeśli walidacja nie była dostępna) */
  atsValidation: AtsPdfValidationReport | null;
  /** Nazwa pliku */
  filename: string;
}

/**
 * Wywołuje backendowy silnik mvcv i pobiera gotowy plik PDF.
 * Po eksporcie zwraca wyniki walidacji ATS.
 */
export async function downloadSemanticPdf(options: SemanticPdfExportOptions): Promise<SemanticPdfExportResult> {
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

  const contentType = res.headers.get('content-type') || '';
  const name = options.vault.personalInfo?.fullName?.replace(/\s+/g, '_') || 'Kandydat';

  // Obsługa nowej odpowiedzi JSON (z walidacją ATS)
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (data.pdf) {
      // Dekoduj base64 PDF
      const binaryStr = atob(data.pdf);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const filename = data.filename || `CV_${name}.pdf`;
      saveAs(blob, filename);

      return {
        atsValidation: data.atsValidation ?? null,
        filename,
      };
    }
  }

  // Fallback: binarny PDF (stary format bez walidacji)
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match && match[1] ? decodeURIComponent(match[1]) : `CV_${name}.pdf`;

  const blob = await res.blob();
  saveAs(blob, filename);

  // Próbuj odczytać wyniki z headerów
  const atsScore = res.headers.get('X-ATS-Score');
  const atsStatus = res.headers.get('X-ATS-Status');
  const atsTagged = res.headers.get('X-ATS-Tagged');

  return {
    atsValidation: atsScore
      ? {
          vendors: [],
          overallScore: parseInt(atsScore, 10) || 0,
          overallStatus: (atsStatus as 'PASS' | 'WARN' | 'FAIL') || 'WARN',
          taggedPdfPresent: atsTagged === 'true',
          invisibleTextDetected: false,
          generalRecommendations: [],
          validatedAt: new Date().toISOString(),
        }
      : null,
    filename,
  };
}
