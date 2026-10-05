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
import type { MasterVault } from '../types';
import { createEmptyVault } from './sampleVault';
import { hasSufficientCvContent } from './canonicalAts';
import { MAX_DOCUMENT_TEXT_CHARS } from './textNormalization';

/** Buduje profil z odczytanych pól CV, bez dopisywania brakujących danych. */
export function vaultFromParsedCv(parsed: ParsedCVResult): MasterVault {
  const vault = createEmptyVault(parsed.personalInfo.fullName, parsed.personalInfo.email);

  return {
    ...vault,
    personalInfo: { ...vault.personalInfo, ...parsed.personalInfo },
    profiler: { ...vault.profiler, languages: parsed.languages || [] },
    skillsMatrix: {
      ...vault.skillsMatrix,
      hardSkills: parsed.hardSkills,
      softSkills: parsed.softSkills,
      toolsAndTech: parsed.toolsAndTech,
      certifications: parsed.certifications,
    },
    history: parsed.history,
    education: parsed.education,
    rawText: parsed.rawText,
  } as MasterVault;
}

export interface ResolveCvIngestionParams {
  extractedText: string;
  portableResult?: ParsedCVResult;
  parsedResult?: ParsedCVResult;
  fileName?: string;
  isFile: boolean;
}

export interface CvTextValidationResult {
  valid: boolean;
  error?: string;
  parsedResult?: ParsedCVResult;
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
  if (trimmed.length > MAX_DOCUMENT_TEXT_CHARS) {
    return {
      valid: false,
      error: `Tekst CV przekracza limit ${MAX_DOCUMENT_TEXT_CHARS.toLocaleString('pl-PL')} znaków. Skróć tekst lub podziel dokument przed importem.`,
    };
  }
  if (!trimmed || trimmed.length < MIN_RAW_CV_LENGTH) {
    return {
      valid: false,
      error: 'Wklejony tekst jest zbyt krótki do analizy (wymagane minimum 30 znaków).',
    };
  }

  // Sama długość przepuszczała przypadkowe ciągi i pozwalała parserowi uznać
  // powtarzane znaki za imię. Zastosuj ten sam próg treści, którego używa kanon ATS.
  const parsed = parseTextToMasterVault(trimmed);
  if (parsed.hasCyrillicScript) {
    return {
      valid: false,
      error: 'Wykryto alfabet cyrylicki. Automatyczne parsowanie CV obsługuje tekst po polsku i angielsku; przetłumacz treść albo uzupełnij profil ręcznie.',
    };
  }
  if (!hasSufficientCvContent(vaultFromParsedCv(parsed))) {
    return {
      valid: false,
      error: 'Nie wykryto wystarczającej treści zawodowej. Dodaj opis doświadczenia, umiejętności, podsumowanie, projekty lub kwalifikacje.',
    };
  }
  return { valid: true, parsedResult: parsed };
}

/**
 * Ustala deterministyczny wynik parsowania CV oraz wykryty format źródłowy.
 * Respektuje pierwszeństwo rekordu certyfikowanego Smart Portable PDF przed parsowaniem heurystycznym tekstu.
 */
export function resolveCvIngestionResult({
  extractedText,
  portableResult,
  parsedResult,
  fileName,
  isFile,
}: ResolveCvIngestionParams): ParsedCVResult {
  const result = portableResult || parsedResult || parseTextToMasterVault(extractedText);

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
