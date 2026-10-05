/**
 * Procent ze starej lub zewnętrznej migawki nie jest wiarygodny tylko dlatego,
 * że ma typ number. Nie przycinamy błędnych wartości do 0/100, bo wyglądałyby
 * wtedy jak poprawny pomiar.
 */
export function normalizePercentageEvidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    return null;
  }

  return Math.round(value);
}
