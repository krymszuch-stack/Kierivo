import { MasterVault } from '../../types';
import { extractProfileFromVault } from './extractor';
import { generateSummaries } from './generator';
import { SummarySuggestion } from './types';

export * from './types';
export * from './extractor';
export * from './generator';

/**
 * Główny punkt wejściowy do beztokenowego generatora podsumowania zawodowego.
 * Czerpie fakty bezpośrednio z MasterVault i tworzy deterministyczne,
 * oparte wyłącznie na potwierdzonych danych propozycje podsumowań.
 */
export function generateSummarySuggestions(
  vault: MasterVault,
  count = 4
): SummarySuggestion[] {
  const profile = extractProfileFromVault(vault);
  return generateSummaries(profile, count);
}

/** Zachowane dla kompatybilności wstecznej — nie tworzy ani nie modyfikuje fałszywych wag. */
export function recordPositiveFeedback(
  _styleId?: string,
  _usedLexemes?: Record<string, string>,
  _rewardWeight?: number
): void {}
