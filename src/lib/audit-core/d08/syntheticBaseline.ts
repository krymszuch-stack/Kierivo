import type { CalibrationSnapshotCase } from '../drift';

/**
 * Techniczny baseline D08 wygenerowany z runtime scorer na syntetycznym corpus
 * 2026-09-11. To NIE jest walidacja rynkowa ani empiryczna kalibracja na CV.
 * Jego rolą jest wykrywanie niezamierzonego driftu matematyki przed dołączeniem
 * korpusu prawdziwych dokumentów.
 */
export const D08_SYNTHETIC_BASELINE: readonly CalibrationSnapshotCase[] = [
  { caseId: 'D08_01_CLEAN_SINGLE_COLUMN', score: 100, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_02_CLEAN_TWO_COLUMN_ORDER_SAFE', score: 100, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_03_TWO_COLUMN_INTERLEAVED', score: 40, confidence: 0.977757, hardCapRuleCodes: ['HC_D08_READING_ORDER_CRITICAL'] },
  { caseId: 'D08_04_THREE_COLUMN_ORDER_SAFE', score: 100, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_05_SCAN_NO_NATIVE_TEXT', score: 25, confidence: 0.977757, hardCapRuleCodes: ['HC_D08_TEXT_LAYER_CRITICAL'] },
  { caseId: 'D08_06_OCR_LAYER_CORRECT', score: 100, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_07_MOJIBAKE_POLISH', score: 90.677562, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_08_NFKC_LIGATURE_CLEAN', score: 100, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_09_NESTED_TABLE_LAYOUT', score: 98.189204, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_10_FLOATING_BOX_OVERLAP', score: 95.541609, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_11_CLIPPED_TEXT', score: 96.630637, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_12_MIXED_DATES_PARSEABLE', score: 99.883333, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_13_AMBIGUOUS_DATES', score: 96.966667, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_14_MINIMALIST_HEADINGS_PARSEABLE', score: 99.0585, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_15_INCONSISTENT_LIST_INDENTS', score: 98.24, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_16_NO_LISTS_VALID', score: 100, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_17_HIDDEN_WHITE_TEXT', score: 88.028448, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_18_OFF_PAGE_TEXT', score: 94.134551, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_19_DUPLICATE_TEXT_LAYER_CONFIRMED', score: 90.497871, confidence: 0.977757, hardCapRuleCodes: [] },
  { caseId: 'D08_20_POLISH_DIACRITICS_CLEAN', score: 100, confidence: 0.977757, hardCapRuleCodes: [] },
] as const;
