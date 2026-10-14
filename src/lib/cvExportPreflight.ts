import type { MasterVault } from '../types';

/** Zapis roboczy może być niepełny; eksport nie może zgadywać brakujących faktów. */
export function getCvExportCompletenessError(vault: Pick<MasterVault, 'history'>): string | null {
  const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  const index = Array.isArray(vault.history) ? vault.history.findIndex(entry =>
    !entry || !hasText(entry.role) || !hasText(entry.startDate) || (!entry.isCurrent && !hasText(entry.endDate))
  ) : -1;
  return index < 0 ? null : `Niekompletny wpis doświadczenia nr ${index + 1}: sprawdź stanowisko, datę rozpoczęcia oraz datę zakończenia lub oznaczenie „obecnie”. Uzupełnij wyłącznie znane fakty albo usuń ten wpis z wersji przeznaczonej do eksportu. Nie zgaduj brakujących danych.`;
}
