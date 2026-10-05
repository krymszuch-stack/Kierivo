export function hasNoReportedChronologyAnomalies(logic: {
  chronologyValid: boolean;
  timelineAnomalies: readonly string[];
}): boolean {
  // Sprzeczna flaga modelu nie może ukryć jego własnej listy problemów.
  return logic.chronologyValid && logic.timelineAnomalies.length === 0;
}

export function recommendationsForOffer<T extends { category: string }>(
  recommendations: readonly T[],
  hasJobDescription: boolean,
): T[] {
  // Ten weryfikator nie bada formatowania pliku. ATS oznacza tu porównanie z ofertą.
  return recommendations.filter(item => hasJobDescription || item.category !== 'ATS');
}
