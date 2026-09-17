/**
 * Czysty silnik domenowy przetwarzania i wczytywania CV (CV Ingestion Engine).
 *
 * Wydzielony z komponentu CVParserModal.tsx w celu:
 * 1. Zapewnienia czystej, w 100% testowalnej warstwy bez zależności od Reacta i DOM.
 * 2. Unifikacji logiki rozpoznawania formatów (Smart Portable PDF, DOCX/PDF z dysku, surowy tekst).
 * 3. Centralizacji reguł formatowania podsumowań scalania MasterVault.
 */

import { parseTextToMasterVault, type ParsedCVResult } from './cvUniversalParser';
import type { AppliedImportCounts } from './vaultImportMerge';

export interface ResolveCvIngestionParams {
  extractedText: string;
  portableResult?: ParsedCVResult;
  fileName?: string;
  isFile: boolean;
}

export interface CvTextValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Minimalna dopuszczalna długość wklejonego tekstu CV do analizy heurystycznej.
 */
export const MIN_RAW_CV_LENGTH = 30;

/**
 * Weryfikuje minimalną jakość wklejonego surowego tekstu CV.
 */
export function validateRawCvText(text: string): CvTextValidationResult {
  const trimmed = (text || '').trim();
  if (!trimmed || trimmed.length < MIN_RAW_CV_LENGTH) {
    return {
      valid: false,
      error: 'Wklejony tekst jest zbyt krótki do analizy (wymagane minimum 30 znaków).',
    };
  }
  return { valid: true };
}

/**
 * Ustala deterministyczny wynik parsowania CV oraz wykryty format źródłowy.
 * Respektuje pierwszeństwo rekordu certyfikowanego Smart Portable PDF przed parsowaniem heurystycznym tekstu.
 */
export function resolveCvIngestionResult({
  extractedText,
  portableResult,
  fileName,
  isFile,
}: ResolveCvIngestionParams): ParsedCVResult {
  const result = portableResult || parseTextToMasterVault(extractedText);

  if (isFile) {
    result.detectedFormat = portableResult
      ? 'Smart Portable PDF'
      : (fileName?.split('.').pop()?.toUpperCase() || 'Plik');
  } else {
    result.detectedFormat = 'Wklejony tekst';
  }

  return result;
}

/**
 * Formatuje podsumowanie liczbowe nowo dodanych pozycji do profilu po operacji scalenia.
 */
export function formatCvMergeSummary(added: Partial<AppliedImportCounts>): string {
  const parts: string[] = [];

  if (added.history) {
    parts.push(`${added.history} stanowisk`);
  }
  if (added.education) {
    parts.push(`${added.education} szkół`);
  }

  const skillCount =
    (added.hardSkills || 0) +
    (added.softSkills || 0) +
    (added.toolsAndTech || 0) +
    (added.certifications || 0);

  if (skillCount > 0) {
    parts.push(`${skillCount} pozycji umiejętności`);
  }

  if (parts.length === 0) {
    return 'Nie wykryto nowych pozycji do dodania.';
  }

  return `Dodano: ${parts.join(', ')}.`;
}
