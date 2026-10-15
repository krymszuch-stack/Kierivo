import type { MasterVault } from '../types';

/** Zapis roboczy może być niepełny; eksport nie może zgadywać brakujących faktów. */
export function getCvExportCompletenessError(vault: Pick<MasterVault, 'history'> & Partial<Pick<MasterVault, 'education' | 'projects'>>): string | null {
  const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  const index = Array.isArray(vault.history) ? vault.history.findIndex(entry =>
    !entry || !hasText(entry.company) || !hasText(entry.role) || !hasText(entry.startDate) || (!entry.isCurrent && !hasText(entry.endDate))
  ) : -1;
  const instruction = 'Uzupełnij wyłącznie znane fakty albo usuń ten wpis z wersji przeznaczonej do eksportu. Nie zgaduj brakujących danych.';
  if (index >= 0) return `Niekompletny wpis doświadczenia nr ${index + 1}: sprawdź pracodawcę, stanowisko, datę rozpoczęcia oraz datę zakończenia lub oznaczenie „obecnie”. ${instruction}`;
  const educationIndex = (vault.education ?? []).findIndex(entry =>
    !entry || !hasText(entry.institution) || (!hasText(entry.degree) && !hasText(entry.fieldOfStudy))
  );
  if (educationIndex >= 0) return `Niekompletny wpis edukacji nr ${educationIndex + 1}: sprawdź szkołę lub uczelnię oraz kierunek albo uzyskany stopień. Trwająca edukacja nie wymaga uzyskanego stopnia. ${instruction}`;
  const projectIndex = (vault.projects ?? []).findIndex(entry => !entry || !hasText(entry.name));
  if (projectIndex >= 0) return `Niekompletny wpis projektu nr ${projectIndex + 1}: brakuje nazwy projektu. ${instruction}`;
  return null;
}
