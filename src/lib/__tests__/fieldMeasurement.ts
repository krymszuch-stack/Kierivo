/** Wspólna normalizacja pustych wartości i liczb używana przez benchmarki parsera. */
export function isMissingMeasuredValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized === '' || normalized.toLocaleUpperCase('en-US') === 'UNKNOWN';
  }
  return Array.isArray(value) && value.length === 0;
}

export function finiteMeasuredNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeMeasuredText(value: string): string {
  return value.toLocaleLowerCase('pl-PL').trim().replace(/\s+/g, ' ');
}

export type MeasuredTextStatus = 'CORRECT' | 'PARTIAL' | 'INCORRECT';

export function compareMeasuredText(gold: string, parsed: string): MeasuredTextStatus {
  const expected = normalizeMeasuredText(gold);
  const actual = normalizeMeasuredText(parsed);
  if (expected === actual) return 'CORRECT';

  const expectedTerms = new Set(expected.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1));
  const actualTerms = actual.split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1);
  return actualTerms.some((term) => expectedTerms.has(term)) ? 'PARTIAL' : 'INCORRECT';
}
